import User from "../models/user.js";
import { harsh } from "../utils/hasher.js";
import { getAuthContext } from "./product.js";
// 1. Import the validator schema
import {
  registerEmployeeSchema,
  updateBusinessSchema,
} from "../validations/managerval.js";
import CompanyConfig from "../models/companyConfig.js";
import Company from "../models/company.js"; // Make sure this path matches your file structure

export const registerNewEmplyee = async (req, res) => {
  try {
    const auth = getAuthContext(req);
    if (!auth) {
      return res.status(400).json({ message: "invalid auth context" });
    }
    const { companyId } = auth;

    // 1. Validate the request body using Joi
    const { error, value } = registerEmployeeSchema.validate(req.body, {
      abortEarly: true,
    });

    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const { name, email, password } = value;

    // 2. NEW: Check if a user with this email already exists globally
    const emailExists = await User.findOne({
      company: companyId,
      email: email,
    });
    if (emailExists) {
      return res
        .status(400)
        .json({ message: "This email address is already registered." });
    }

    // 3. Hash the password safely
    const harshedPassword = await harsh(password);

    // 4. Create the new user record
    const user = await User.create({
      name: name,
      company: companyId,
      email: email,
      password: harshedPassword,
      role: "Store Keeper",
    });

    return res.status(201).json({
      message: "Registration and company creation successful",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("Register & Company Creation Error:", err);
    return res
      .status(500)
      .json({ message: "Server error during registration" });
  }
};

export const getAllCompanyEmployees = async (req, res) => {
  try {
    const companyId = req.user.company;

    // FIXED: Using standard MongoDB $ne operator to exclude "Store Admin"
    const employees = await User.find({
      company: companyId,
      role: { $ne: "Store Admin" },
    }).select("-password");

    // Return the list of employees
    return res.status(200).json({
      success: true,
      count: employees.length,
      employees: employees,
    });
  } catch (error) {
    console.error("Get Company Employees Error:", error);
    return res.status(500).json({
      message: "Server error fetching company employees.",
    });
  }
};

// FUNCTION 1: Fetch Business Settings

export const getBusinessConfig = async (req, res) => {
  try {
    const companyId = req.user.company;
    // 1. Fetch from the Company collection
    let actuals = await Company.findById(companyId);
    if (!actuals) {
      return res.status(404).json({ message: "Company profile not found." });
    }

    // 2. Fetch from the Configuration collection, build it if missing
    let config = await CompanyConfig.findOne({ company: companyId });
    if (!config) {
      config = await CompanyConfig.create({
        company: companyId,
        currency: "GHS (₵)",
        taxRate: 0,
        receiptMessage: "Thank you for buying from us",
      });
    }

    // 3. Construct a unified responsive object with no schema redundancy
    const companyData = {
      storeName: actuals.name,
      companyRef: actuals.reference, // Maps database 'reference' to your layout name
      address: actuals.address || "",
      currency: config.currency,
      taxRate: config.taxRate,
      receiptMessage: config.receiptMessage,
    };

    return res.status(200).json({ success: true, business: companyData });
  } catch (error) {
    console.error("Fetch Config Error:", error);
    return res
      .status(500)
      .json({ message: "Server error retrieving business setup." });
  }
};

export const updateBusinessConfig = async (req, res) => {
  try {
    const companyId = req.user.company;

    if (req.user.role !== "Store Admin" && req.user.role !== "Manager") {
      return res.status(403).json({ message: "Access denied. Admins only." });
    }

    // 1. Validate incoming form parameters via Joi
    const { error, value } = updateBusinessSchema.validate(req.body, {
      abortEarly: true,
    });
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const { name, companyRef, address, currency, taxRate, receiptMessage } =
      value;

    // 2. Global check on the Company collection to verify unique codes
    const refExists = await Company.findOne({
      reference: companyRef, // Your schema uses 'reference'
      _id: { $ne: companyId },
    });

    if (refExists) {
      return res.status(400).json({
        message: `The reference code "${companyRef}" is already taken by another store. Please choose a different one.`,
      });
    }

    // 3. Update core details inside the Company Schema
    const updatedCompany = await Company.findByIdAndUpdate(
      companyId,
      {
        $set: {
          name: name,
          reference: companyRef,
          address: address,
        },
      },
      { returnDocument: "after" },
    );

    // 4. Update core settings parameters inside the Settings Configuration Schema
    const updatedConfig = await CompanyConfig.findOneAndUpdate(
      { company: companyId },
      {
        $set: {
          currency: currency,
          taxRate: taxRate,
          receiptMessage: receiptMessage,
        },
      },
      { returnDocument: "after" },
    );

    // 5. Send back a unified success response
    return res.status(200).json({
      message: "Business configuration saved successfully.",
      business: {
        storeName: updatedCompany.name,
        companyRef: updatedCompany.reference,
        address: updatedCompany.address,
        currency: updatedConfig.currency,
        taxRate: updatedConfig.taxRate,
        receiptMessage: updatedConfig.receiptMessage,
      },
    });
  } catch (error) {
    console.error("Update Config Error:", error);
    return res
      .status(500)
      .json({ message: "Server error saving configuration layout." });
  }
};
