import { Product } from "../models/product.js";
import { Expense } from "../models/Expense.js";
import Sale from "../models/sale.js"; // Imported to include Sales in Dashboard Metrics

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
    const [
      totalProducts,
      lowStockCount,
      inventoryValueResult,
      expensesValueResult,
      salesValueResult,
    ] = await Promise.all([
      // Total Products Count
      Product.countDocuments(),

      // Low Stock Items Count
      Product.countDocuments({
        $expr: { $lte: ["$stockQuantity", "$lowStockThreshold"] },
      }),

      // Total Inventory Retail Value Calculation: Sum(stockQuantity * unitPrice)
      Product.aggregate([
        {
          $group: {
            _id: null,
            totalRetailValue: {
              $sum: { $multiply: ["$stockQuantity", "$unitPrice"] },
            },
          },
        },
      ]),

      // Total Expenses Calculation: Sum(amount)
      Expense.aggregate([
        {
          $group: {
            _id: null,
            totalExpensesAmount: { $sum: "$amount" },
          },
        },
      ]),

      // Total Revenue Calculation from Sales
      Sale.aggregate([
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$totalAmount" },
          },
        },
      ]),
    ]);

    const totalInventoryValue = inventoryValueResult[0]?.totalRetailValue || 0;
    const totalExpenses = expensesValueResult[0]?.totalExpensesAmount || 0;
    const totalRevenue = salesValueResult[0]?.totalRevenue || 0;

    return res.status(200).json({
      success: true,
      metrics: {
        totalProducts,
        lowStockCount,
        totalInventoryValue: parseFloat(totalInventoryValue.toFixed(2)),
        totalExpenses: parseFloat(totalExpenses.toFixed(2)),
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        netProfit: parseFloat((totalRevenue - totalExpenses).toFixed(2)),
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
      const unitPrice = product.unitPrice || 0;
      const costPrice = product.costPrice || 0;
      const margin = unitPrice - costPrice;

      return {
        id: product._id,
        productCode: product.productCode,
        name: product.name,
        category: product.category,
        stockQuantity: product.stockQuantity,
        costPrice,
        unitPrice,
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
    const rawItems = Array.isArray(req.body.items)
      ? req.body.items
      : [req.body];

    if (rawItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No product data provided in request body.",
      });
    }

    const existingCount = await Product.countDocuments();

    const preparedItems = rawItems.map((item, index) => {
      const generatedCode = `PRD-${101 + existingCount + index}`;
      const finalCode = item.sku || item.productCode || generatedCode;

      return {
        productCode: finalCode,
        name: item.name,
        category: item.category,
        packsPurchased: parseInt(item.packsPurchased, 10) || 0,
        unitsPerPack: parseInt(item.unitsPerPack, 10) || 1,
        stockQuantity:
          parseInt(item.totalQuantity ?? item.stockQuantity, 10) || 0,
        costPricePerPack: parseFloat(item.costPricePerPack) || 0.0,
        costPrice: parseFloat(item.unitCostPrice ?? item.costPrice) || 0.0,
        unitPrice: parseFloat(item.unitSellingPrice ?? item.unitPrice) || 0.0,
        expectedProfit: parseFloat(item.expectedProfit) || 0.0,
        lowStockThreshold: parseInt(item.lowStockThreshold, 10) || 4,
      };
    });

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

    const qtyToAdd = parseInt(addedQuantity, 10);
    if (isNaN(qtyToAdd) || qtyToAdd <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid positive quantity is required",
      });
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

    let expenseCode = req.body.expenseCode;
    if (!expenseCode) {
      const count = await Expense.countDocuments();
      expenseCode = `EXP-${301 + count}`;
    }

    const userId = req.user?.id || req.user?._id || null;

    const newExpense = await Expense.create({
      expenseCode,
      date: req.body.date || getCurrentFormattedDate(),
      time: req.body.time || getCurrentStandardTime(),
      category,
      amount: parseFloat(amount),
      purpose,
      paymentMethod: paymentMethod || "Cash",
      loggedBy: userId,
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

// Reverse/Delete an expense and recalculate total expenses
export const reverseExpense = async (req, res) => {
  try {
    const { expenseId } = req.params;

    const expense = await Expense.findById(expenseId);
    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense record not found.",
      });
    }

    const reversedAmount = expense.amount || 0;

    await Expense.findByIdAndDelete(expenseId);

    const aggregateResult = await Expense.aggregate([
      {
        $group: {
          _id: null,
          totalExpenses: { $sum: "$amount" },
        },
      },
    ]);

    const newTotalExpenses = aggregateResult[0]?.totalExpenses || 0;

    return res.status(200).json({
      success: true,
      message: "Expense reversed successfully.",
      reversedExpenseId: expenseId,
      slashedAmount: reversedAmount,
      totalExpenses: newTotalExpenses,
    });
  } catch (error) {
    console.error("Error reversing expense:", error);
    return res.status(500).json({
      success: false,
      message: "Server error: Failed to reverse expense.",
      error: error.message,
    });
  }
};
