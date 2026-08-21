import express from "express";
import {
  forgotPassword,
  loginUser,
  registerUser,
  resetPassword,
  verify,
} from "../controller/user.controller.js";

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/verify", verify);
router.post("/reset-password", resetPassword);
router.post("/forgot-password", forgotPassword);

export default router;
