import express from "express";
import {
  forgotPassword,
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
import { getAllCompanyEmployees, getBusinessConfig, registerNewEmplyee, updateBusinessConfig } from "../controller/managerEmplyeeSettings.js";

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


//////////////////////
//admin rights route 
router.post("/create-employee", registerNewEmplyee);
router.get("/all-employees", getAllCompanyEmployees);

//////////////////////////////////////
// settings
router.put("/business-settings",updateBusinessConfig );
router.get("/business-settings",getBusinessConfig );




export default router;
