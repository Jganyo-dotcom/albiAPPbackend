import mongoose from "mongoose";

// 1. Schema for individual items (Just the product details)
const itemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product", // Links directly to your Product collection
      required: true,
    },
    name: { type: String }, // Product name (saved for quick display)
    qty: { type: Number, required: true, default: 1 },
    unitPrice: { type: Number, required: true, default: 0 },
  },
  { _id: false },
);

// 2. Main Customer Schema (The overall bill and customer details)
const customerSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, "Customer full name is required"],
      trim: true,
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
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
    },

    // --- FINANCIAL CALCULATIONS ---
    totalAmount: {
      type: Number,
      default: 0,
      // The grand total of all items (calculated from DB)
    },
    amountSpent: {
      type: Number,
      required: [true, "Amount spent (paid right now) is required"],
      // What the customer actually handed you today
    },
    amountOwe: {
      type: Number,
      default: 0,
      // The debt (totalAmount - amountSpent)
    },
    // ------------------------------

    paymentMethod: {
      type: String,
      enum: ["Cash", "Mobile Money", "Card", "Bank Transfer"],
      default: "Cash",
    },
    customerType: {
      type: String,
      enum: ["Walk-in", "Regular", "Wholesale"],
      default: "Walk-in",
    },

    // Optional Fields
    email: { type: String, default: "" },
    address: { type: String, default: "" },
    notes: { type: String, default: "" },

    // Linked purchased items
    items: [itemSchema],
  },
  { timestamps: true },
);

const Customer = mongoose.model("Customer", customerSchema);
export default Customer;
