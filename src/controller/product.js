import mongoose from "mongoose";
import { Product } from "../models/product.js";
import { Expense } from "../models/Expense.js";
import Sale from "../models/sale.js";
import { logAudit } from "../utils/audit.js";

/**
 * Helper to safely extract and validate authorization context
 */
const getAuthContext = (req) => {
  const companyId = req.user.company;
  const inputer = req.user._id;

  if (!companyId || !inputer) return null;

  return {
    companyId,
    inputer,
    companyObjId: mongoose.Types.ObjectId.isValid(companyId)
      ? new mongoose.Types.ObjectId(companyId)
      : companyId,
  };
};

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
    const auth = getAuthContext(req);
    if (!auth) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Missing company & inputer context.",
      });
    }
    const { companyId, companyObjId } = auth;

    const [
      totalProducts,
      lowStockCount,
      inventoryValueResult,
      expensesValueResult,
      salesValueResult,
    ] = await Promise.all([
      // Total Products Count scoped by company
      Product.countDocuments({ companyId }),

      // Low Stock Items Count scoped by company
      Product.countDocuments({
        companyId,
        $expr: { $lte: ["$stockQuantity", "$lowStockThreshold"] },
      }),

      // Total Inventory Retail Value Calculation: Sum(stockQuantity * unitPrice)
      Product.aggregate([
        { $match: { companyId: companyObjId } },
        {
          $group: {
            _id: null,
            totalRetailValue: {
              $sum: { $multiply: ["$stockQuantity", "$unitPrice"] },
            },
          },
        },
      ]),

      // Total Expenses Calculation: Sum(amount) scoped by company
      Expense.aggregate([
        { $match: { companyId: companyObjId } },
        {
          $group: {
            _id: null,
            totalExpensesAmount: { $sum: "$amount" },
          },
        },
      ]),

      // Total Revenue Calculation from Sales scoped by company
      Sale.aggregate([
        { $match: { companyId: companyObjId } },
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
    const auth = getAuthContext(req);
    if (!auth) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Missing company & inputer context.",
      });
    }
    const { companyId } = auth;

    const products = await Product.find({ companyId }).sort({ createdAt: -1 });

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
        unitsPerPack: product.unitsPerPack,
        packSellingPrice: product.packSellingPrice,
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
    const auth = getAuthContext(req);
    if (!auth) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Missing company & inputer context.",
      });
    }
    const { companyId, inputer } = auth;

    const rawItems = Array.isArray(req.body.items)
      ? req.body.items
      : [req.body];

    if (rawItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No product data provided in request body.",
      });
    }

    const existingCount = await Product.countDocuments({ companyId });

    const preparedItems = rawItems.map((item, index) => {
      const generatedCode = `PRD-${101 + existingCount + index}`;
      const finalCode = item.sku || item.productCode || generatedCode;

      return {
        companyId,
        inputer,
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

        // ✨ NEW: Extracts the wholesale pack rate from your frontend payload mapping
        packSellingPrice: parseFloat(item.packSellingPrice) || 0.0,

        expectedProfit: parseFloat(item.expectedProfit) || 0.0,
        lowStockThreshold: parseInt(item.lowStockThreshold, 10) || 4,
      };
    });

    const createdProducts = await Product.insertMany(preparedItems);

    // Dynamic routing: single entries link to the product; bulk items link to the company
    if (createdProducts.length === 1) {
      await logAudit(
        inputer,
        "CREATE_PRODUCT",
        createdProducts[0]._id, // Fixed: Added [0] index to avoid missing property crashes
        "Product",
        "Product", // Updated path fallback parameter consistency
        companyId,
        "Successful",
      );
    } else {
      await logAudit(
        inputer,
        "CREATE_PRODUCT_BULK",
        companyId,
        "Company",
        "Company",
        companyId,
        "Successful",
      );
    }

    return res.status(201).json({
      success: true,
      message: `${createdProducts.length} product(s) created successfully`,
      count: createdProducts.length,
      products: createdProducts,
    });
  } catch (error) {
    console.error("Error creating product(s):", error);

    const auth = getAuthContext(req);
    if (auth) {
      await logAudit(
        auth.inputer,
        "CREATE_PRODUCT",
        auth.companyId,
        "Company",
        "Company",
        auth.companyId,
        "Failed",
      );
    }

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to create product(s)",
    });
  }
};

// Restock Product (Increment Stock)
export const restockProduct = async (req, res) => {
  try {
    const auth = getAuthContext(req);
    if (!auth) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Missing company & inputer context.",
      });
    }
    const { companyId, inputer } = auth;

    const { productId } = req.params;
    const { addedQuantity, restockType } = req.body; // ✨ NEW: Extracts restockType ("Piece" or "Pack")

    const rawQty = parseInt(addedQuantity, 10);
    if (isNaN(rawQty) || rawQty <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid positive quantity is required",
      });
    }

    // 1. Fetch product first to inspect its configuration schema details
    const productExists = await Product.findOne({ _id: productId, companyId });
    if (!productExists) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    // 🔄 DETECT UNIT TYPE: Adjust multiplication based on selection
    const isPackRestock = restockType === "Pack";
    const unitsInPack = parseInt(productExists.unitsPerPack, 10) || 1;

    // Scale up total pieces if restocked by bulk packs
    const totalUnitsToAdd = isPackRestock ? rawQty * unitsInPack : rawQty;

    // 2. Perform atomic stock incrementation
    const updatedProduct = await Product.findOneAndUpdate(
      { _id: productId, companyId },
      { $inc: { stockQuantity: totalUnitsToAdd } },
      { returnDocument: "after" },
    );

    // 3. Compile custom description text string for log messages
    const restockSummaryText = isPackRestock
      ? `${rawQty} pack(s) (${totalUnitsToAdd} single units)`
      : `${rawQty} single unit(s)`;

    // 🔄 TRIGGER AUDIT LOG: Passing the custom summary tail string cleanly
    await logAudit(
      inputer,
      "RESTOCK_PRODUCT",
      updatedProduct._id,
      "Product",
      "Product",
      companyId,
      "Successful",
      restockSummaryText, // Pass the metric text variables here
    );

    return res.status(200).json({
      success: true,
      message: isPackRestock
        ? `Successfully added ${rawQty} packs (${totalUnitsToAdd} units)`
        : `Successfully added ${rawQty} units`,
      product: updatedProduct,
    });
  } catch (error) {
    console.error("Restock Error:", error);
    const auth = getAuthContext(req);
    if (auth) {
      await logAudit(
        auth.inputer,
        "RESTOCK_PRODUCT",
        req.params.productId,
        "Product",
        "Product",
        auth.companyId,
        "Failed",
      );
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Update Product Retail & Cost Prices
export const updateProductPrices = async (req, res) => {
  try {
    const auth = getAuthContext(req);
    if (!auth) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Missing company & inputer context.",
      });
    }
    const { companyId, inputer } = auth;

    const { productId } = req.params;
    const {
      name,
      category,
      costPrice,
      unitPrice,
      packSellingPrice, // ✨ NEW: Extracts the wholesale pack selling price from req.body
      stockQuantity,
      lowStockThreshold,
    } = req.body;

    const updateFields = {};

    if (name !== undefined) updateFields.name = name;
    if (category !== undefined) updateFields.category = category;
    if (costPrice !== undefined) updateFields.costPrice = parseFloat(costPrice);
    if (unitPrice !== undefined) updateFields.unitPrice = parseFloat(unitPrice);

    // ✨ NEW: Updates the wholesale pack price configuration field safely if passed
    if (packSellingPrice !== undefined)
      updateFields.packSellingPrice = parseFloat(packSellingPrice);

    if (stockQuantity !== undefined)
      updateFields.stockQuantity = parseInt(stockQuantity, 10);
    if (lowStockThreshold !== undefined)
      updateFields.lowStockThreshold = parseInt(lowStockThreshold, 10);

    const updatedProduct = await Product.findOneAndUpdate(
      { _id: productId, companyId },
      updateFields,
      { returnDocument: "after", runValidators: true },
    );

    if (!updatedProduct) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    // Trigger Audit Log
    await logAudit(
      inputer,
      "UPDATE_PRODUCT",
      updatedProduct._id,
      "Product",
      "Product",
      companyId,
      "Successful",
    );

    const margin = updatedProduct.unitPrice - updatedProduct.costPrice;

    return res.status(200).json({
      success: true,
      message: "Product updated successfully",
      product: updatedProduct,
      newMargin: parseFloat(margin.toFixed(2)),
    });
  } catch (error) {
    const auth = getAuthContext(req);
    if (auth) {
      await logAudit(
        auth.inputer,
        "UPDATE_PRODUCT",
        req.params.productId,
        "Product",
        "Product",
        auth.companyId,
        "Failed",
      );
    }
    return res.status(400).json({ success: false, message: error.message });
  }
};

// ==========================================
// 3. EXPENSE CONTROLLERS
// ==========================================

// Get All Expenses
export const getExpenses = async (req, res) => {
  try {
    const auth = getAuthContext(req);
    if (!auth) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Missing company & inputer context.",
      });
    }
    const { companyId } = auth;

    const expenses = await Expense.find({ companyId }).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, expenses });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Log New Operational Expense
export const createExpense = async (req, res) => {
  try {
    const auth = getAuthContext(req);
    if (!auth) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Missing company & inputer context.",
      });
    }
    const { companyId, inputer } = auth;

    const { category, amount, purpose, paymentMethod } = req.body;

    let expenseCode = req.body.expenseCode;
    if (!expenseCode) {
      const count = await Expense.countDocuments({ companyId });
      // Append a short timestamp or random string snippet to guarantee uniqueness
      const uniqueId = Date.now().toString().slice(-4);
      expenseCode = `EXP-${301 + count}-${uniqueId}`;
    }

    const newExpense = await Expense.create({
      companyId,
      inputer,
      expenseCode,
      date: req.body.date || getCurrentFormattedDate(),
      time: req.body.time || getCurrentStandardTime(),
      category,
      amount: parseFloat(amount),
      purpose,
      paymentMethod: paymentMethod || "Cash",
      loggedBy: inputer,
    });

    // Trigger Audit Log
    await logAudit(
      inputer,
      "CREATE_EXPENSE",
      newExpense._id,
      "Expense",
      "Expense",
      companyId,
      "Successful",
    );

    return res.status(201).json({
      success: true,
      message: "Expense logged successfully",
      expense: newExpense,
    });
  } catch (error) {
    const auth = getAuthContext(req);
    if (auth) {
      await logAudit(
        auth.inputer,
        "CREATE_EXPENSE",
        null,
        "Expense",
        "Expense",
        auth.companyId,
        "Failed",
      );
    }
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const reverseExpense = async (req, res) => {
  try {
    const auth = getAuthContext(req);
    if (!auth) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Missing company & inputer context.",
      });
    }
    const { companyId, companyObjId, inputer } = auth;

    const { expenseId } = req.params;

    const expense = await Expense.findOne({ _id: expenseId, companyId });
    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense record not found.",
      });
    }

    const reversedAmount = expense.amount || 0;

    await Expense.findOneAndDelete({ _id: expenseId, companyId });

    // Trigger Audit Log (Log before aggregation to capture data context)
    await logAudit(
      inputer,
      "REVERSE_EXPENSE",
      expenseId,
      "Expense",
      "Expense",
      companyId,
      "Successful",
    );
    console.log(expenseId);
    const aggregateResult = await Expense.aggregate([
      { $match: { companyId: companyObjId } },
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
    const auth = getAuthContext(req);
    if (auth) {
      await logAudit(
        auth.inputer,
        "REVERSE_EXPENSE",
        req.params.expenseId,
        "Expense",
        "Expense",
        auth.companyId,
        "Failed",
      );
    }
    return res.status(500).json({
      success: false,
      message: "Server error: Failed to reverse expense.",
      error: error.message,
    });
  }
};
