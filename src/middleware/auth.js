import jwt from "jsonwebtoken";
import User from "../models/user.js";

// Helper function to generate a 6-digit OTP
const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

export const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Fetch user from DB (Include devices and OTP fields, exclude password)
      const user = await User.findById(decoded.id).select("-password");

      if (!user) {
        return res.status(401).json({ message: "User account not found" });
      }

      // 1. Get Device Identifier (Prioritize a custom header, fallback to User-Agent)
      const deviceId = req.headers["x-device-id"] || req.headers["user-agent"];

      if (!deviceId) {
        return res
          .status(400)
          .json({ message: "Device identification missing" });
      }

      // 2. Check if the device is recognized
      const isDeviceRecognized =
        user.devices && user.devices.includes(deviceId);

      if (!isDeviceRecognized) {
        // 3. Generate 6-digit OTP and expiration (e.g., 10 minutes)
        const otp = generateOTP();
        user.deviceOtp = otp;
        user.deviceOtpExpires = Date.now() + 10 * 60 * 1000;

        // Save the pending device temporarily so we know which one to authorize later
        user.pendingDevice = deviceId;
        await user.save();

        // 4. TODO: Send OTP to user's email here (e.g., sendEmail(user.email, otp))
        console.log(`OTP for ${user.email}: ${otp}`);

        return res.status(403).json({
          message:
            "Unfamiliar device detected. An OTP has been sent to your email.",
          requiresOtp: true,
        });
      }

      // If device is recognized, attach full user object and proceed
      req.user = user;
      return next();
    } catch (error) {
      console.error("Token verification error:", error);
      return res.status(401).json({ message: "Not authorized, invalid token" });
    }
  }

  if (!token) {
    return res.status(401).json({ message: "Not authorized, token missing" });
  }
};
