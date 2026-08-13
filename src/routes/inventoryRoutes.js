import express from "express";
import {
  getProducts,
  getDashboardMetrics,
  createProduct,
  restockProduct,
  updateProductPrices,
  getExpenses,
  createExpense,
  reverseExpense,
} from "../controller/product.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

// Metrics
router.get("/metrics", getDashboardMetrics);

// Product Routes
router.get("/products", getProducts);
router.post("/products", createProduct);
router.patch("/products/:productId/restock", restockProduct);
router.patch("/products/:productId/price", updateProductPrices); //same as edit he whole thing


// Expense Routes
router.get("/expenses", getExpenses);
router.post("/expenses", createExpense);
router.delete("/expenses/:expenseId", reverseExpense);

export default router;
