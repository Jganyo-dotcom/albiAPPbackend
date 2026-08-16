import mongoose from "mongoose";

// Item schema specific to a sale transaction
const saleItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    name: { type: String, required: true },
    qty: { type: Number, required: true, default: 1, min: 1 },
    unitPrice: { type: Number, required: true, default: 0 },
    unitCost: { type: Number, default: 0 }, // Optional: helpful for calculating profit margins later
  },
  { _id: false },
);

// Main Sale Schema
const saleSchema = new mongoose.Schema(
  {
    // --- LINK TO CUSTOMER ---
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer", // Connects this sale to a document in the Customer collection
      required: [true, "Customer reference is required"],
    },
    inputer: {
      type: mongoose.Schema.Types.ObjectId, // Fixed path to ObjectId
      required: true,
      ref: "User", // Fixed: Model names must be passed as a string
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true, // Speeds up queries across all store sales
    },
    // Optional receipt/invoice identifier
    invoiceNumber: {
      type: String,
      trim: true,
    },

    // Items purchased in this transaction
    items: [saleItemSchema],

    // --- FINANCIAL SUMMARY FOR THIS SALE ---
    totalAmount: {
      type: Number,
      required: [true, "Total bill amount is required"],
      default: 0,
    },
    amountPaid: {
      type: Number,
      required: [true, "Amount paid today is required"],
      default: 0,
    },
    totalCredit: {
      type: Number,
      default: 0, // Automatically calculated in pre-save hook
    },
    amountOwe: {
      type: Number,
      default: 0, // Automatically calculated in pre-save hook
    },

    // Payment Tracking
    paymentMethod: {
      type: String,
      enum: ["Cash", "Mobile Money", "Card", "Bank Transfer"],
      default: "Cash",
    },
    paymentStatus: {
      type: String,
      enum: ["Paid", "Partial", "Unpaid"],
      default: "Paid",
    },

    notes: { type: String, default: "" },
  },
  { timestamps: true },
);

// --- PRE-SAVE HOOK ---
// Automatically calculates debt (amountOwe) and status before saving

const Sale = mongoose.model("Sale", saleSchema);
export default Sale;
