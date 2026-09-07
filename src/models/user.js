import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Company",
    },
    email: {
      type: String,
      required: [true, "Email address is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 6,
    },
    phone: {
      type: String,
      trim: true,
      default: "", // Defaults to an empty string if not provided
    },
    role: {
      type: String,
      enum: ["Store Admin", "Manager", "Cashier", "Store Keeper"],
      default: "Store Admin",
    },
    resetToken: {
      type: String,
      default: null,
    },
    resetTokenExpires: {
      type: Date,
      default: null,
    },
    // New fields for managing unauthorized device logins
    devices: {
      type: [String],
      default: [], // Array of trusted device fingerprints or IDs
    },
    deviceOtp: {
      type: String,
      default: null,
    },
    deviceOtpExpires: {
      type: Date,
      default: null,
    },
    pendingDevice: {
      type: String,
      default: null, // Holds the unknown device until OTP is verified
    },
    lastOtpResentAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

export default mongoose.models.User || mongoose.model("User", userSchema);
