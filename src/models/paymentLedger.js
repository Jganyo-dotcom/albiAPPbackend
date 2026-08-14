import mongoose from "mongoose";

const paymentLedgerSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    company: {
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
    amountPaid: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentDate: {
      type: Date,
      default: Date.now,
    },
    note: {
      type: String,
      default: "",
    },
  },
  { timestamps: true },
);

export default mongoose.model("PaymentLedger", paymentLedgerSchema);
