import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    productCode: {
      type: String,
      required: [true, "Product code is required"],
      unique: true,
      trim: true,
      uppercase: true, // Stores as PRD-101 / SKU-5350
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
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
    },
    category: {
      type: String,
      required: true,
      default: "Any",
    },
    packsPurchased: {
      type: Number,
      min: [0, "Packs purchased cannot be negative"],
      default: 0,
    },
    unitsPerPack: {
      type: Number,
      min: [1, "Units per pack must be at least 1"],
      default: 1,
    },
    stockQuantity: {
      type: Number,
      required: true,
      min: [0, "Stock quantity cannot be negative"],
      default: 0,
    },
    costPricePerPack: {
      type: Number,
      min: [0, "Cost price per pack cannot be negative"],
      default: 0.0,
    },
    costPrice: {
      type: Number,
      required: true,
      min: [0, "Cost price cannot be negative"],
      default: 0.0,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: [0, "Unit selling price cannot be negative"],
      default: 0.0,
    },
    expectedProfit: {
      type: Number,
      default: 0.0,
    },
    lowStockThreshold: {
      type: Number,
      default: 10,
      min: 0,
    },
  },
  {
    timestamps: true,
  },
);

export const Product =
  mongoose.models.Product || mongoose.model("Product", productSchema);
