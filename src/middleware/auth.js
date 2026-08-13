import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const protect = async (req, res, next) => {
  let token;

  // 1. Check if token exists in the Authorization header and starts with 'Bearer'
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      // 2. Extract token from the "Bearer <token>" string
      token = req.headers.authorization.split(" ")[1];

      // 3. Verify the token signature using your environment variable secret
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // 4. Fetch user from DB using the ID decoded from the token (exclude password)
      req.user = await User.findById(decoded.id).select("-password");

      // 5. If user no longer exists in DB, deny access
      if (!req.user) {
        return res.status(401).json({ message: "User account not found" });
      }

      // 6. Continue to the next route or middleware
      return next();
    } catch (error) {
      console.error("Token verification error:", error);
      return res.status(401).json({ message: "Not authorized, invalid token" });
    }
  }

  // If no token was found at all
  if (!token) {
    return res.status(401).json({ message: "Not authorized, token missing" });
  }
};
