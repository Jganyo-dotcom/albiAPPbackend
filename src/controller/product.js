import { Product } from "../models/Product.js";
import { Expense } from "../models/Expense.js";

// Helper function to format standard time (e.g. 05:21 PM)
const getCurrentStandardTime = () => {
  return new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

// Helper function to format date (e.g. 2026-08-12)
const getCurrentFormattedDate = () => {
  return new Date().toISOString().split("T")[0];
};

// ==========================================
// 1. DASHBOARD METRICS CALCULATION
// ==========================================
export const getDashboardMetrics = async (req, res) => {
  try {
    // Total Products Count
    const totalProducts = await Product.countDocuments();

    // Low Stock Items Count
    const lowStockCount = await Product.countDocuments({
      $expr: { $lte: ["$stockQuantity", "$lowStockThreshold"] },
    });

    // Total Inventory Retail Value Calculation: Sum(stockQuantity * unitPrice)
    const inventoryValueResult = await Product.aggregate([
      {
        $group: {
          _id: null,
          totalRetailValue: {
            $sum: { $multiply: ["$stockQuantity", "$unitPrice"] },
          },
        },
      },
    ]);

    const totalInventoryValue =
      inventoryValueResult.length > 0
        ? inventoryValueResult[0].totalRetailValue
        : 0;

    // Total Expenses Calculation: Sum(amount)
    const expensesValueResult = await Expense.aggregate([
      {
        $group: {
          _id: null,
          totalExpensesAmount: { $sum: "$amount" },
        },
      },
    ]);

    const totalExpenses =
      expensesValueResult.length > 0
        ? expensesValueResult[0].totalExpensesAmount
        : 0;

    return res.status(200).json({
      success: true,
      metrics: {
        totalProducts,
        lowStockCount,
        totalInventoryValue: parseFloat(totalInventoryValue.toFixed(2)),
        totalExpenses: parseFloat(totalExpenses.toFixed(2)),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// 2. PRODUCT CONTROLLERS
// ==========================================

// Get All Products + Calculate Margin per item dynamically
export const getProducts = async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });

    const formattedProducts = products.map((product) => {
      const margin = product.unitPrice - product.costPrice;
      return {
        id: product._id,
        productCode: product.productCode,
        name: product.name,
        category: product.category,
        stockQuantity: product.stockQuantity,
        costPrice: product.costPrice,
        unitPrice: product.unitPrice,
        margin: parseFloat(margin.toFixed(2)),
        lowStockThreshold: product.lowStockThreshold,
        isLowStock: product.stockQuantity <= product.lowStockThreshold,
      };
    });

    return res.status(200).json({ success: true, products: formattedProducts });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Add New Product + Auto Generate Product Code (PRD-101)

export const createProduct = async (req, res) => {
  try {
    // 1. Detect if frontend sent an 'items' array or a single object
    const rawItems = Array.isArray(req.body.items)
      ? req.body.items
      : [req.body];

    if (rawItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No product data provided in request body.",
      });
    }

    // 2. Fetch current total count to increment PRD-XXX codes if missing
    const existingCount = await Product.countDocuments();

    // 3. Format and sanitize every item to match schema
    const preparedItems = rawItems.map((item, index) => {
      const generatedCode = `PRD-${101 + existingCount + index}`;
      const finalCode = item.sku || item.productCode || generatedCode;

      return {
        productCode: finalCode,
        name: item.name,
        category: item.category,
        packsPurchased: parseInt(item.packsPurchased) || 0,
        unitsPerPack: parseInt(item.unitsPerPack) || 1,
        stockQuantity: parseInt(item.totalQuantity ?? item.stockQuantity) || 0,
        costPricePerPack: parseFloat(item.costPricePerPack) || 0.0,
        costPrice: parseFloat(item.unitCostPrice ?? item.costPrice) || 0.0,
        unitPrice: parseFloat(item.unitSellingPrice ?? item.unitPrice) || 0.0,
        expectedProfit: parseFloat(item.expectedProfit) || 0.0,
        lowStockThreshold: parseInt(item.lowStockThreshold) || 4,
      };
    });

    // 4. Insert into database
    const createdProducts = await Product.insertMany(preparedItems);

    return res.status(201).json({
      success: true,
      message: `${createdProducts.length} product(s) created successfully`,
      count: createdProducts.length,
      products: createdProducts,
    });
  } catch (error) {
    console.error("Error creating product(s):", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to create product(s)",
    });
  }
};

// Restock Product (Increment Stock)
export const restockProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const { addedQuantity } = req.body;

    const qtyToAdd = parseInt(addedQuantity);
    if (isNaN(qtyToAdd) || qtyToAdd <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "Valid quantity is required" });
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      { $inc: { stockQuantity: qtyToAdd } },
      { new: true },
    );

    if (!updatedProduct) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    return res.status(200).json({
      success: true,
      message: `Successfully added ${qtyToAdd} units`,
      product: updatedProduct,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Update Product Retail & Cost Prices
export const updateProductPrices = async (req, res) => {
  try {
    const { productId } = req.params;
    const {
      name,
      category,
      costPrice,
      unitPrice,
      stockQuantity,
      lowStockThreshold,
    } = req.body;

    // Construct update payload dynamically based on incoming body fields
    const updateFields = {};

    if (name !== undefined) updateFields.name = name;
    if (category !== undefined) updateFields.category = category;
    if (costPrice !== undefined) updateFields.costPrice = parseFloat(costPrice);
    if (unitPrice !== undefined) updateFields.unitPrice = parseFloat(unitPrice);
    if (stockQuantity !== undefined)
      updateFields.stockQuantity = parseInt(stockQuantity, 10);
    if (lowStockThreshold !== undefined)
      updateFields.lowStockThreshold = parseInt(lowStockThreshold, 10);

    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      updateFields,
      { new: true, runValidators: true },
    );

    if (!updatedProduct) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    const margin = updatedProduct.unitPrice - updatedProduct.costPrice;

    return res.status(200).json({
      success: true,
      message: "Product updated successfully",
      product: updatedProduct,
      newMargin: parseFloat(margin.toFixed(2)),
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// ==========================================
// 3. EXPENSE CONTROLLERS
// ==========================================

// Get All Expenses
export const getExpenses = async (req, res) => {
  try {
    const expenses = await Expense.find().sort({ createdAt: -1 });
    return res.status(200).json({ success: true, expenses });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Log New Operational Expense
export const createExpense = async (req, res) => {
  try {
    const { category, amount, purpose, paymentMethod } = req.body;

    // Auto-generate code if missing
    let expenseCode = req.body.expenseCode;
    if (!expenseCode) {
      const count = await Expense.countDocuments();
      expenseCode = `EXP-${301 + count}`;
    }

    const newExpense = await Expense.create({
      expenseCode,
      date: req.body.date || getCurrentFormattedDate(), // YYYY-MM-DD
      time: req.body.time || getCurrentStandardTime(), // 05:21 PM
      category,
      amount: parseFloat(amount),
      purpose,
      paymentMethod: paymentMethod || "Cash",
      loggedBy: req.user.id,
    });

    return res.status(201).json({
      success: true,
      message: "Expense logged successfully",
      expense: newExpense,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};
