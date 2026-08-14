import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema(
  {
    expenseCode: {
      type: String,
      required: [true, "Expense code is required"],
      unique: true,
      trim: true,
      uppercase: true, // Stores as EXP-301
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true, // Speeds up queries across all store sales
    },
    inputer: {
      type: mongoose.Schema.Types.ObjectId, // Fixed path to ObjectId
      required: true,
      ref: "User", // Fixed: Model names must be passed as a string
    },
    date: {
      type: String, // Saved as YYYY-MM-DD
      required: [true, "Date is required"],
    },
    time: {
      type: String, // Saved as standard time e.g. 05:21 PM
      required: [true, "Time is required"],
    },
    category: {
      type: String,
      required: [true, "Expense category is required"],
    },
    amount: {
      type: Number,
      required: [true, "Expense amount is required"],
      min: [0, "Amount cannot be negative"],
    },
    purpose: {
      type: String,
      required: [true, "Expense explanation/purpose is required"],
      trim: true,
    },
    paymentMethod: {
      type: String,
      enum: ["Cash", "Mobile Money"],
      default: "Cash",
    },
    loggedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

export const Expense = mongoose.model("Expense", expenseSchema);
