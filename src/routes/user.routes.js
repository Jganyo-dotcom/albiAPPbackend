import express from "express";
import { loginUser, registerUser, verify } from "../controller/user.controller.js";


const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/verify", verify);

export default router;
