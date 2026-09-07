import User from "../models/user.js";
import { harsh } from "../utils/hasher.js";
import { getAuthContext } from "./product.js";
// 1. Import the validator schema
import { registerEmployeeSchema } from "../validations/managerval.js";

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
