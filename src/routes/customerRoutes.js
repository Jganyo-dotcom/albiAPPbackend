import express from "express";
import {
  exportSalesToExcel,
  getSaleReceipt,
  getSalesLedger,
  payDebt,
  syncCustomers,
  getDebtors,
  getAllCustomersSummary,
  getFinancialOverview,
} from "../controller/customer.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// Apply authentication middleware to all routes in this router
router.use(protect);

// ====================================================
// 1. STATIC POST ROUTES
// ====================================================
// Bulk sync route matching frontend sync call
router.post("/sync", syncCustomers);

// Pay debt with customerId sent in request body (POST /api/customer/pay-debt)
router.post("/pay-debt", payDebt);

// ====================================================
// 2. STATIC GET ROUTES (Must come before dynamic /:id routes)
// ====================================================
router.get("/export", exportSalesToExcel);
router.get("/debtors", getDebtors);
router.get("/directory", getAllCustomersSummary);
router.get("/financial/overview", getFinancialOverview);

// ====================================================
// 3. ROOT BASE ROUTE
// ====================================================
router.get("/", getSalesLedger);

// ====================================================
// 4. DYNAMIC / PARAMETERIZED ROUTES (Must come last)
// ====================================================
router.get("/:id/receipt", getSaleReceipt);
router.post("/:id/pay-debt", payDebt); // Fallback if ID is supplied directly in URL path

export default router;
