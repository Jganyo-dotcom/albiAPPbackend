import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/user.js";
import Company from "../models/company.js";
import { sendUniversalMail } from "../utils/mailServices.js";

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
      await sendUniversalMail("verification_Mail", {
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

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
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
      return res
        .status(401)
        .json({ message: "Invalid company reference, email, or password" });
    }

    // 5. Generate token payload
    const token = jwt.sign(
      { id: user._id, companyId: company._id },
      process.env.JWT_SECRET,
      { expiresIn: "30d" },
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
    return res.status(500).json({ message: "Server error during login" });
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

      return res.status(200).json({message:"All is well"})
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
