import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/user.js";
import Company from "../models/company.js";
import { sendUniversalMail } from "../utils/mailServices.js";

// @desc    Register a new user
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

    // 2. Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "An account with this email already exists" });
    }

    // 3. Extract initials from the name (e.g., "Elikem Shela" -> "ES")
    const initials = name
      .split(" ")
      .map((word) => word.charAt(0))
      .join("")
      .toUpperCase();

    let generatedReference = "";
    let isUnique = false;

    // 4. Regenerate loop: Keeps running if the generated code already exists in the DB
    while (!isUnique) {
      const randomNumber = Math.floor(1000 + Math.random() * 9000); // 4-digit number
      generatedReference = `${initials}-${randomNumber}`;

      // Check database for collisions
      const referenceExists = await Company.findOne({
        reference: generatedReference,
      });
      if (!referenceExists) {
        isUnique = true; // Break the loop if it's completely unique
      }
    }

    // 5. Create the Company
    const newCompany = await Company.create({
      name: companyName,
      reference: generatedReference,
      address: address || "",
    });

    // 6. Hash user password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 7. Create User linked to the Company
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: role || "Store Admin",
      company: newCompany._id,
    });

    await sendUniversalMail("verification_Mail", {
      recipientEmail: email,
      recipientName: name,
      companyRef: generatedReference,
      subject: "Your Credentials are Ready",
    });

    // 8. Generate JWT inline (no external helper function called)
    // 9. Response payload
    return res.status(201).json({
      message: "Registration and company creation successful",
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

export const loginUser = async (req, res) => {
  try {
    const { companyReference, email, password } = req.body;

    // 1. Validate incoming fields
    if (!companyReference || !email || !password) {
      return res.status(400).json({
        message: "Please provide company reference, email, and password",
      });
    }

    // 2. Find the company by its unique reference code
    const company = await Company.findOne({
      reference: companyReference.toUpperCase().trim(),
    });
    if (!company) {
      return res
        .status(401)
        .json({ message: "Invalid company reference, email, or password" });
    }

    // 3. Find the user by email AND make sure they belong to this specific company ID
    const user = await User.findOne({
      email: email.toLowerCase().trim(),
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

    // 5. Generate token inline (Fixed: Changed broken 'userId' reference to 'user._id')
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "30d",
    });

    // 6. Return response with populated company metadata
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
