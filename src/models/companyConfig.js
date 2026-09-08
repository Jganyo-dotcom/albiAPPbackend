import mongoose from "mongoose";

const companyConfigSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      unique: true, // Only one configuration setup allowed per company
    },
    currency: {
      type: String,
      default: "GHS (₵)",
    },
    taxRate: {
      type: Number,
      default: 0,
    },
    receiptMessage: {
      type: String,
      trim: true,
      default: "Thank you for buying from us",
    },
  },
  { timestamps: true },
);

const CompanyConfig = mongoose.model("CompanyConfig", companyConfigSchema);
export default CompanyConfig;
