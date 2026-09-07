import express from "express";
import {
  forgotPassword,
  getBusinessSettings,
  getCompanyEmployees,
  getUserProfile,
  loginUser,
  registerUser,
  resendDeviceOtp,
  resetPassword,
  updateUserPassword,
  updateUserProfile,
  verify,
  verifyDeviceOtp,
} from "../controller/user.controller.js";
import { protect } from "../middleware/auth.js";
import { registerNewEmplyee } from "../controller/managerEmplyee.js";

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/verify", verify);
router.post("/verify-otp", verifyDeviceOtp);
router.post("/resend-otp", resendDeviceOtp);
router.post("/reset-password", resetPassword);
router.post("/forgot-password", forgotPassword);

router.use(protect)
router.get("/user/profile", getUserProfile);
router.post("/user/change-password", updateUserPassword);
router.patch("/update-user/profile", updateUserProfile);
router.get("/employees", getCompanyEmployees);
router.get("/business-settings", getBusinessSettings);

//////////////////////
//admin rights route 
router.post("/create-employee", registerNewEmplyee);

export default router;
