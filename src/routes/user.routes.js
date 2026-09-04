import express from "express";
import {
  forgotPassword,
  getBusinessSettings,
  getCompanyEmployees,
  getUserProfile,
  loginUser,
  registerUser,
  resetPassword,
  verify,
} from "../controller/user.controller.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/verify", verify);
router.post("/reset-password", resetPassword);
router.post("/forgot-password", forgotPassword);
router.use(protect)

router.get("/user/profile", getUserProfile);
router.get("/employees", getCompanyEmployees);
router.get("/business-settings", getBusinessSettings);

export default router;
