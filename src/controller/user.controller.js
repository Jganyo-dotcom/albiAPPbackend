import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/user.js";
import Company from "../models/company.js";
import { sendUniversalMail } from "../utils/mailServices.js";
import { logAudit } from "../utils/audit.js";
import AuditLog from "../models/AuditLogsSchema.js";
import {
  updatePasswordSchema,
  updateProfileSchema,
} from "../validations/managerval.js";
import { checkPasswordAuth, harsh } from "../utils/hasher.js";

// @desc    Register a new user & company
// @route   POST /api/auth/register
export const registerUser = async (req, res) => {
  try {
    const { name, email, password, role, companyName, address } = req.body;

    // 1. Validate required fields
    if (!name || !email || !password || !companyName) {
      return res.status(400).json({
        message: "Name, email, password, and companyName are required",
      });
    }

    // 2. Normalize email to prevent case-sensitivity login bugs
    const normalizedEmail = email.toLowerCase().trim();

    // 3. Check if user already exists
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "An account with this email already exists" });
    }

    // 4. Extract initials from the name (e.g., "Elikem Shela" -> "ES")
    const initials =
      name
        .trim()
        .split(/\s+/)
        .map((word) => word.charAt(0))
        .join("")
        .toUpperCase() || "CMP";

    let generatedReference = "";
    let isUnique = false;
    let attempts = 0;

    // 5. Collision check loop for unique reference code
    while (!isUnique && attempts < 10) {
      const randomNumber = Math.floor(1000 + Math.random() * 9000); // 4-digit number
      generatedReference = `${initials}-${randomNumber}`;

      const referenceExists = await Company.findOne({
        reference: generatedReference,
      });

      if (!referenceExists) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      return res.status(500).json({
        message:
          "Failed to generate a unique company reference. Please try again.",
      });
    }

    // 6. Create the Company
    const newCompany = await Company.create({
      name: companyName.trim(),
      reference: generatedReference,
      address: address ? address.trim() : "",
    });

    // 7. Hash user password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 8. Create User linked to the Company
    let user;
    try {
      user = await User.create({
        name: name.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        role: role || "Store Admin",
        company: newCompany._id,
      });
    } catch (userError) {
      // Rollback company creation if user creation fails
      await Company.findByIdAndDelete(newCompany._id);
      throw userError;
    }

    // 9. Non-blocking Mail Delivery (Won't fail registration if mailer is down)
    try {
      sendUniversalMail("verification_Mail", {
        recipientEmail: normalizedEmail,
        recipientName: user.name,
        companyRef: generatedReference,
        subject: "Your Credentials are Ready",
      });
    } catch (mailError) {
      console.error(
        "Warning: Registration email failed to send:",
        mailError.message,
      );
    }

    // 10. Generate JWT token for instant session login
    const token = jwt.sign(
      { id: user._id, companyId: newCompany._id },
      process.env.JWT_SECRET,
      { expiresIn: "30d" },
    );

    // 11. Response payload
    return res.status(201).json({
      message: "Registration and company creation successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      company: {
        id: newCompany._id,
        name: newCompany.name,
        reference: newCompany.reference,
      },
    });
  } catch (error) {
    console.error("Register & Company Creation Error:", error);
    return res
      .status(500)
      .json({ message: "Server error during registration" });
  }
};

// Helper function to generate a 6-digit OTP
const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

export const loginUser = async (req, res) => {
  try {
    const { companyReference, email, password } = req.body;

    // 1. Validate incoming fields
    if (!companyReference || !email || !password) {
      return res.status(400).json({
        message: "Please provide company reference, email, and password",
      });
    }

    const normalizedCompanyRef = companyReference.toUpperCase().trim();
    const normalizedEmail = email.toLowerCase().trim();

    // 2. Find the company by its unique reference code
    const company = await Company.findOne({
      reference: normalizedCompanyRef,
    });
    console.log(company._id);
    if (!company) {
      return res
        .status(401)
        .json({ message: "Invalid company reference, email, or password" });
    }

    // 3. Find the user by email AND verify company linkage
    const user = await User.findOne({
      email: normalizedEmail,
      company: company._id,
    });

    if (!user) {
      return res
        .status(401)
        .json({ message: "Invalid company reference, email, or password" });
    }

    // 4. Verify password match
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      await logAudit(
        user._id,
        "LOGIN",
        user._id,
        "Company",
        "Company",
        company._id,
        "Failed",
      );
      return res
        .status(401)
        .json({ message: "Invalid company reference, email, or password" });
    }

    // ⭐ NEW: 4.5. Device Verification Logic
    // Extract unique ID from header or fall back to user-agent
    const deviceId = req.headers["x-device-id"] || req.headers["user-agent"];
    if (!deviceId) {
      return res.status(400).json({ message: "Device identification missing" });
    }

    const isDeviceRecognized = user.devices && user.devices.includes(deviceId);

    if (!isDeviceRecognized && user.role === "Store Admin") {
      const otp = generateOTP();

      // Save device OTP configurations to the user document
      user.deviceOtp = otp;
      user.deviceOtpExpires = Date.now() + 10 * 60 * 1000; // Valid for 10 minutes
      user.pendingDevice = deviceId;
      await user.save();

      // Trigger your universal mail handler
      // We are passing the code inside 'companyRef' because your template consumes it there
      await sendUniversalMail("verification_OTP", {
        recipientEmail: user.email,
        recipientName: user.name,
        subject: "Secure Login: Verify Your New Device",
        companyRef: otp,
        companyName: company.name,
      });

      // Audit log the verification hold
      await logAudit(
        user._id,
        "LOGIN_VERIFICATION_REQUIRED",
        user._id,
        "Company",
        "Company",
        company._id,
        "Successful",
      );

      // Return a 403 telling the frontend to display the OTP input form
      return res.status(200).json({
        message:
          "Unfamiliar device detected. An OTP has been sent to your email.",
        requiresOtp: true,
        email: user.email,
      });
    }

    // 5. Generate token payload (Proceed if device is recognized)
    const token = jwt.sign(
      { id: user._id, companyId: company._id },
      process.env.JWT_SECRET,
      { expiresIn: "30d" },
    );

    // SUCCESSFUL LOGIN: Log it right before sending response
    await logAudit(
      user._id,
      "LOGIN",
      user._id,
      "Company",
      "Company",
      company._id,
      "Successful",
    );

    // 6. Return response
    return res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      company: {
        id: company._id,
        name: company.name,
        reference: company.reference,
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    await logAudit(null, "LOGIN", null, "Company", "Company", null, "Failed");
    return res.status(500).json({ message: "Server error during login" });
  }
};

export const verifyDeviceOtp = async (req, res) => {
  const { email, otp } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if OTP matches and hasn't expired
    if (
      !user.deviceOtp ||
      user.deviceOtp !== otp ||
      Date.now() > user.deviceOtpExpires
    ) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    // Add the pending device to the recognized list
    if (user.pendingDevice && !user.devices.includes(user.pendingDevice)) {
      user.devices.push(user.pendingDevice);
    }

    // Clear OTP fields
    user.deviceOtp = undefined;
    user.deviceOtpExpires = undefined;
    user.pendingDevice = undefined;

    await user.save();

    return res
      .status(200)
      .json({ message: "Device successfully authorized. You can now log in." });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

export const resendDeviceOtp = async (req, res) => {
  try {
    const { companyReference, email } = req.body;

    // 1. Validate fields
    if (!companyReference || !email) {
      return res.status(400).json({
        message: "Please provide company reference and email address",
      });
    }

    const normalizedCompanyRef = companyReference.toUpperCase().trim();
    const normalizedEmail = email.toLowerCase().trim();

    // 2. Verify the company exists
    const company = await Company.findOne({ reference: normalizedCompanyRef });
    if (!company) {
      return res.status(404).json({ message: "Company reference not found" });
    }

    // 3. Find the user linked to this company
    const user = await User.findOne({
      email: normalizedEmail,
      company: company._id,
    });

    if (!user) {
      return res.status(404).json({ message: "User account not found" });
    }

    // 4. Ensure there is an active device verification process pending
    if (!user.pendingDevice) {
      return res.status(400).json({
        message:
          "No pending device verification found for this account. Please log in again.",
      });
    }

    // ⭐ NEW: 4.5. Anti-Spam / Rate-Limiting Guard (60 Seconds Cooldown)
    const COOLDOWN_MS = 60 * 1000; // 60 seconds
    if (user.lastOtpResentAt) {
      const timePassed = Date.now() - new Date(user.lastOtpResentAt).getTime();

      if (timePassed < COOLDOWN_MS) {
        const secondsLeft = Math.ceil((COOLDOWN_MS - timePassed) / 1000);
        return res.status(429).json({
          // 429 is the standard HTTP status for Too Many Requests
          message: `Please wait ${secondsLeft} second(s) before requesting another security code.`,
          retryAfterSeconds: secondsLeft,
        });
      }
    }

    // 5. Generate a brand new OTP code
    const newOtp = generateOTP();
    user.deviceOtp = newOtp;
    user.deviceOtpExpires = Date.now() + 10 * 60 * 1000; // Reset validity timer for 10 minutes
    user.lastOtpResentAt = Date.now(); // Record current timestamp to restart cooldown block
    await user.save();

    // 6. Deliver the code via your universal mail system
    await sendUniversalMail("verification_OTP", {
      recipientEmail: user.email,
      recipientName: user.name,
      subject: "Resend Code: Verify Your New Device",
      companyRef: newOtp,
      companyName: company.name,
    });

    return res.status(200).json({
      message: "A fresh security code has been routed to your email.",
    });
  } catch (error) {
    console.error("Resend OTP Error:", error);
    return res
      .status(500)
      .json({ message: "Server error while resending security code" });
  }
};

export const getUserProfile = async (req, res) => {
  try {
    // Using findOne so it returns a single object instead of an array
    const user = await User.findOne({
      _id: req.user.id,
      company: req.user.company,
    }).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User profile not found." });
    }
    return res.status(200).json(user);
  } catch (error) {
    return res.status(500).json({ message: "Server error fetching profile." });
  }
};

export const updateUserProfile = async (req, res) => {
  try {
    // 1. Validate the incoming data
    const { error, value } = updateProfileSchema.validate(req.body, {
      abortEarly: true,
    });
    if (error)
      return res.status(400).json({ message: error.details[0].message });

    const { name, email, phone } = value;

    // 2. Check if the new email is already taken by someone else in this company
    if (email) {
      const emailExists = await User.findOne({
        company: req.user.company,
        email: email,
        _id: { $ne: req.user.id }, // Skip checking the current user
      });
      if (emailExists) {
        return res.status(400).json({
          message:
            "This email is already taken by another user in this company.",
        });
      }
    }

    // 3. Update the user fields and save to database
    const user = await User.findOne({
      _id: req.user.id,
      company: req.user.company,
    });
    if (!user)
      return res.status(404).json({ message: "User profile not found." });

    if (name) user.name = name;
    if (email) user.email = email;
    if (phone) user.phone = phone;

    await user.save();

    // 4. Send back the updated user data safely (without sending the password)
    return res.status(200).json({
      message: "Profile updated successfully.",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
      },
    });
  } catch (error) {
    console.error("Update Profile Error:", error);
    return res.status(500).json({ message: "Server error updating profile." });
  }
};

export const updateUserPassword = async (req, res) => {
  try {
    // 1. Validate the incoming passwords
    const { error, value } = updatePasswordSchema.validate(req.body, {
      abortEarly: true,
    });
    if (error)
      return res.status(400).json({ message: error.details[0].message });

    const { currentPassword, newPassword } = value;

    // 2. Find the user in the database
    const user = await User.findOne({
      _id: req.user.id,
      company: req.user.company,
    });
    if (!user)
      return res.status(404).json({ message: "User profile not found." });

    // 3. Verify old password (Fixed typo: user.password instead of user.pasword)
    const isMatch = await checkPasswordAuth(currentPassword, user.password);
    if (!isMatch) {
      return res
        .status(400)
        .json({ message: "The current password you entered is incorrect." });
    }
    console.log(isMatch);

    // 4. Hash and save the new password

    user.password = await harsh(newPassword);
    await user.save();

    // 5. Send back a clean success message
    return res.status(200).json({ message: "Password updated successfully." });
  } catch (error) {
    console.error("Update Password Error:", error);
    return res.status(500).json({ message: "Server error updating password." });
  }
};

export const getCompanyEmployees = async (req, res) => {
  try {
    // Fixed Mongoose syntax to properly exclude Store Admins ($ne operator)
    const employees = await User.find({
      company: req.user.company,
      role: { $ne: "Store Admin" },
    }).select("-password");

    return res.status(200).json(employees);
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error fetching employees." });
  }
};

export const verify = async (req, res) => {
  let token;

  // 1. Check if token exists in the Authorization header and starts with 'Bearer'
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      // 2. Extract token from the "Bearer <token>" string
      token = req.headers.authorization.split(" ")[1];

      // 3. Verify the token signature using secret
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // 4. Fetch user from DB using decoded ID (exclude password)
      const user = await User.findById(decoded.id).select("-password");

      // 5. If user no longer exists in DB, deny access
      if (!user) {
        return res.status(401).json({ message: "User account not found" });
      }

      return res.status(200).json({ success: true, message: "All is well" });
    } catch (error) {
      console.error("Token verification error:", error);
      return res.status(401).json({ message: "Not authorized, invalid token" });
    }
  }

  // If no token was found at all
  if (!token) {
    return res.status(401).json({ message: "Not authorized, token missing" });
  }
};

// @desc    Send password reset email (Requires Company Reference + Email)
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = async (req, res) => {
  try {
    const { companyref, email } = req.body;

    // 1. Validate both inputs exist
    if (!companyref || !email) {
      return res.status(400).json({
        message: "Please provide both Company Reference and Email address",
      });
    }

    const normalizedCompanyRef = companyref.toUpperCase().trim();
    const normalizedEmail = email.toLowerCase().trim();

    // 2. Find the company by reference code
    const company = await Company.findOne({
      reference: normalizedCompanyRef,
    });

    if (!company) {
      // AUDIT LOG: Company code does not exist

      return res.status(200).json({
        message: "Password reset link sent to your email address.",
      });
    }

    // 3. Find user linked to this specific company & email
    const user = await User.findOne({
      email: normalizedEmail,
      company: company._id,
    });

    if (!user) {
      // AUDIT LOG: Email doesn't match any user inside this specific company
      await logAudit(
        null, // No performing user logged in
        "PASSWORD_RESET_REQ", // Action
        null, // No target user found
        "Company", // EntityType
        "Company", // Path
        company._id, // We have the company ID
        "Failed", // Status
      );

      return res.status(404).json({
        message: "Invalid company reference or email address",
      });
    }

    // 4. Generate 15-minute JWT reset token
    const resetToken = jwt.sign(
      { id: user._id, companyId: company._id },
      process.env.JWT_SECRET,
      { expiresIn: "15m" },
    );

    // Save token and 1-hour expiration timestamp to database
    user.resetToken = resetToken;
    user.resetTokenExpires = Date.now() + 3600000; // 1 hour in milliseconds
    await user.save();

    // 5. Construct frontend URL
    const frontendUrl = process.env.FRONTEND_URL;
    const resetUrl = `${frontendUrl}/forgetPassword?token=${resetToken}`;

    // 6. Send email
    try {
      await sendUniversalMail("reset_password_Mail", {
        recipientEmail: normalizedEmail,
        recipientName: user.name,
        companyRef: company.reference,
        resetUrl,
        subject: "Password Reset Request",
      });

      // SUCCESSFUL AUDIT LOG: Mail sent completely
      await logAudit(
        user._id, // The user requested it
        "RESET_PASSWORD", // Maps to your audit.js switch case
        user._id, // Target is their own account profile
        "Company", // EntityType (Uses Company table/User)
        "Company", // Path
        company._id, // Company ID
        "Successful", // Status
      );
    } catch (mailError) {
      console.error("Failed to send reset email:", mailError.message);

      return res.status(500).json({
        message: "Could not send reset email. Please try again later.",
      });
    }

    return res.status(200).json({
      message: "Password reset link sent to your email address.",
    });
  } catch (error) {
    console.error("Forgot Password Error:", error);
    return res
      .status(500)
      .json({ message: "Server error during password reset request" });
  }
};

// @desc    Verify reset token & update user password
// @route   POST /api/auth/reset-password
// @access  Public
export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    // 1. Validate inputs
    if (!token || !newPassword) {
      return res.status(400).json({
        message: "Reset token and new password are required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters long",
      });
    }

    // 2. Decode and verify the token signature (CRITICAL STEP ADDED BACK)
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      return res.status(400).json({
        message: "Invalid or expired token. Please request a new link.",
      });
    }

    // 3. Find user matching ID, saved token, and valid expiration date
    const user = await User.findOne({
      _id: decoded.id,
      resetToken: token,
      resetTokenExpires: { $gt: Date.now() },
    });

    if (!user) {
      // AUDIT LOG: Valid signature but token does not match DB or has expired
      await logAudit(
        decoded.id || null, // Attempted user id from decoded token
        "PASSWORD_RESET_SUBMIT",
        decoded.id || null,
        "Company",
        "Company",
        decoded.companyId || null,
        "Failed",
      );

      return res.status(400).json({
        message: "Reset link is invalid, expired, or has already been used.",
      });
    }

    // 4. Hash new password & clear database reset fields to prevent reuse
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.resetToken = undefined;
    user.resetTokenExpires = undefined;
    await user.save();

    // SUCCESSFUL AUDIT LOG: Password successfully updated
    await logAudit(
      user._id, // The user who triggered the update
      "RESET_PASSWORD", // Matches your audit.js switch case
      user._id, // Target is their own profile
      "Company", // EntityType (Uses Company table/User)
      "Company", // Path
      user.company, // Linked company reference ID
      "Successful", // Status
    );

    return res.status(200).json({
      message: "Password successfully updated! You can now log in.",
    });
  } catch (error) {
    console.error("Reset Password Error:", error);
    return res
      .status(500)
      .json({ message: "Server error while updating password" });
  }
};

export const getCompanyAuditLogs = async (req, res) => {
  try {
    // 1. Get the company ID from the authenticated user token payload
    const userCompanyId = req.user.company;

    if (!userCompanyId) {
      return res
        .status(400)
        .json({ message: "Authentication error: Company context missing." });
    }

    // 2. Fetch logs and apply simple .populate() chains
    const logs = await AuditLog.find({ company: userCompanyId })
      .populate("userId", "name role email") // Pulls data for the person who did the action
      .populate("entityId") // Automatically uses 'entityType' value to choose User or Customer
      .sort({ createdAt: -1 }); // Newest logs first

    // 3. Return the populated logs
    return res.status(200).json({
      success: true,
      count: logs.length,
      data: logs,
    });
  } catch (error) {
    console.error("Error fetching company audit logs:", error);
    return res
      .status(500)
      .json({ message: "Server error while fetching log history." });
  }
};
