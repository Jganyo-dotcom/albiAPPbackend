import Joi from "joi";

// Schema for validating the register body
export const registerEmployeeSchema = Joi.object({
  name: Joi.string().trim().min(2).required().messages({
    "string.empty": "Name is required",
    "any.required": "Name is required",
  }),
  role: Joi.string().trim().min(2).required().messages({
    "string.empty": "Name is required",
    "any.required": "Name is required",
  }),
  email: Joi.string().trim().email().required().messages({
    "string.email": "Please provide a valid email address",
    "string.empty": "Email is required",
    "any.required": "Email is required",
  }),
  password: Joi.string().min(6).required().messages({
    "string.min": "Password must be at least 6 characters long",
    "string.empty": "Password is required",
    "any.required": "Password is required",
  }),
});

// Schema 1: For updating general profile details
export const updateProfileSchema = Joi.object({
  name: Joi.string().trim().min(2).optional(),
  email: Joi.string().trim().email().optional(),
  phone: Joi.string().trim().min(10).max(10).optional(),
  address: Joi.string().trim().min(5).optional(),
});

// Schema 2: For updating password only
export const updatePasswordSchema = Joi.object({
  currentPassword: Joi.string().required().messages({
    "any.required": "Current password is required to verify your identity.",
  }),
  newPassword: Joi.string().min(6).required().messages({
    "string.min": "New password must be at least 6 characters long.",
    "any.required": "New password is required.",
  }),
  confirmPassword: Joi.any().valid(Joi.ref("newPassword")).required().messages({
    "any.only": "New passwords do not match.",
    "any.required": "Confirm password is required.",
  }),
});

// Schema for validating store settings changes




export const updateBusinessSchema = Joi.object({
  name: Joi.string().trim().min(2).required().messages({
    "string.empty": "Store/Business name is required.",
  }),
  companyRef: Joi.string()
    .trim()
    .uppercase()
    .regex(/^[A-Z]{2}-\d{4}$/)
    .required()
    .messages({
      "string.empty": "Store/Business reference is required.",
      "string.pattern.base": "Reference code must be in the format: 2 letters followed by a hyphen and 4 numbers (e.g., AB-1234).",
    }),
  currency: Joi.string().required(),
  address: Joi.string().trim().allow(""),
  taxRate: Joi.number().min(0).max(100).required(),
  receiptMessage: Joi.string().trim().allow(""),
});

