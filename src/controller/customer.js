import Customer from "../models/customer.js";
import Sale from "../models/Sale.js";
import { Product } from "../models/product.js";
import ExcelJS from "exceljs/dist/exceljs.js";
import PaymentLedger from "../models/paymentLedger.js";

/**
 * 1. POST /api/sales/sync
 * Syncs offline/bulk transactions: Creates/Updates Customer and saves individual Sales
 */

export const syncCustomers = async (req, res) => {
  try {
    const { customers } = req.body;

    if (!customers || !Array.isArray(customers) || customers.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No customer records provided for sync.",
      });
    }

    // 1. Gather all product ObjectIDs for a single DB batch query
    const productIds = [];
    customers.forEach((c) => {
      (c.items || []).forEach((item) => {
        const id = item.id || item.product || item._id;
        if (id) productIds.push(id);
      });
    });

    // Fetch actual products from MongoDB
    const dbProducts = await Product.find({ _id: { $in: productIds } });
    const productMap = new Map(dbProducts.map((p) => [p._id.toString(), p]));

    const stockUpdates = [];
    const createdSales = [];

    for (const c of customers) {
      if (!c.fullName || !c.phone) {
        throw new Error(`Missing required contact info for customer entry.`);
      }

      let calculatedTotalAmount = 0;
      const saleItems = [];
      const customerItems = [];

      // 2. Calculate true total using the correct Product Schema field (unitPrice)
      for (const item of c.items || []) {
        const productId = item.id || item.product || item._id;
        const dbProduct = productMap.get(productId?.toString());

        if (!dbProduct) {
          throw new Error(`Product not found in database for ID: ${productId}`);
        }

        const qty = parseInt(item.qty, 10) || 1;

        // FIXED: Pull directly from dbProduct.unitPrice (Product Schema)
        const unitPrice = Number(dbProduct.unitPrice ?? item.unitPrice ?? 0);
        const unitCost = Number(dbProduct.costPrice ?? item.unitCost ?? 0);

        const itemSubtotal = unitPrice * qty;
        calculatedTotalAmount += itemSubtotal;

        // Structure item for Sale schema (contains unitCost)
        saleItems.push({
          product: dbProduct._id,
          name: dbProduct.name || item.name,
          qty,
          unitPrice,
          unitCost,
        });

        // Structure item for Customer schema
        customerItems.push({
          product: dbProduct._id,
          name: dbProduct.name || item.name,
          qty,
          unitPrice,
        });

        // Prepare bulk update for inventory stock reduction
        stockUpdates.push({
          updateOne: {
            filter: { _id: dbProduct._id },
            update: { $inc: { stockQuantity: -Math.abs(qty) } },
          },
        });
      }

      // 3. Extract amount paid today sent from the frontend
      const amountPaidToday = parseFloat(c.amountSpent ?? c.amountPaid ?? 0);

      // Calculate debt (amountOwe)
      const amountOwe =
        calculatedTotalAmount > amountPaidToday
          ? calculatedTotalAmount - amountPaidToday
          : 0;

      // FIXED: Match enum ["Paid", "Partial", "Unpaid"] on Sale schema
      let paymentStatus = "Paid";
      if (amountOwe > 0 && amountPaidToday > 0) {
        paymentStatus = "Partial";
      } else if (amountOwe > 0 && amountPaidToday === 0) {
        paymentStatus = "Unpaid";
      }

      // 4. Find or Create/Update Customer Document
      const phoneTrimmed = c.phone.trim();
      let customerRecord = await Customer.findOne({ phone: phoneTrimmed });

      if (!customerRecord) {
        customerRecord = await Customer.create({
          fullName: c.fullName.trim(),
          phone: phoneTrimmed,
          email: c.email ? c.email.trim() : "",
          address: c.address ? c.address.trim() : "",
          customerType: c.customerType || "Walk-in",
          paymentMethod: c.paymentMethod || "Cash",
          totalAmount: calculatedTotalAmount,
          amountSpent: amountPaidToday, // Customer Schema uses amountSpent
          amountOwe: amountOwe,
          notes: c.notes ? c.notes.trim() : "",
          items: customerItems,
        });
      } else {
        // Cumulatively increment balances for existing customer
        customerRecord.totalAmount += calculatedTotalAmount;
        customerRecord.amountSpent += amountPaidToday;
        customerRecord.amountOwe += amountOwe;
        customerRecord.items.push(...customerItems);
        await customerRecord.save();
      }

      // 5. Create Sale Document
      const newSale = await Sale.create({
        customer: customerRecord._id,
        items: saleItems,
        totalAmount: calculatedTotalAmount,
        amountPaid: amountPaidToday,
        amountOwe: amountOwe,
        paymentMethod: c.paymentMethod || "Cash",
        paymentStatus: paymentStatus,
        notes: c.notes ? c.notes.trim() : "",
      });

      createdSales.push(newSale);
    }

    // 6. Execute stock reductions
    if (stockUpdates.length > 0) {
      await Product.bulkWrite(stockUpdates);
    }

    return res.status(201).json({
      success: true,
      message: `${createdSales.length} sales synced successfully.`,
      data: createdSales,
    });
  } catch (error) {
    console.error("Sync Error:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to sync customer sales records.",
    });
  }
};
/**
 * 2. GET /api/sales
 * Paginated sales ledger querying the Sale model directly
 */
export const getSalesLedger = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const search = req.query.search ? req.query.search.trim() : "";
    const debtStatus = req.query.status || "ALL"; // ALL, OWING, PAID
    const paymentMethod = req.query.paymentMethod || "ALL";
    const { startDate, endDate } = req.query;

    const skip = (page - 1) * limit;
    const query = {};

    // 1. Debt Status Filter
    if (debtStatus === "OWING") {
      query.amountOwe = { $gt: 0 };
    } else if (debtStatus === "PAID") {
      query.amountOwe = { $lte: 0 };
    }

    // 2. Payment Method Filter
    if (paymentMethod !== "ALL") {
      query.paymentMethod = paymentMethod;
    }

    // 3. Date Range Filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    // 4. Search Filter
    if (search) {
      const matchingCustomers = await Customer.find({
        $or: [
          { fullName: { $regex: search, $options: "i" } },
          { phone: { $regex: search, $options: "i" } },
        ],
      }).select("_id");

      const customerIds = matchingCustomers.map((c) => c._id);
      query.customer = { $in: customerIds };
    }

    // 5. Execute DB Queries in Parallel
    const [sales, totalItems, aggregateMetrics] = await Promise.all([
      Sale.find(query)
        .populate("customer", "fullName phone customerType")
        .populate("items.product", "name price category")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),

      Sale.countDocuments(query),

      Sale.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$totalAmount" },
            totalCollected: { $sum: "$amountPaid" },
            totalOutstandingDebt: { $sum: "$amountOwe" },
          },
        },
      ]),
    ]);

    const metrics = aggregateMetrics[0] || {
      totalRevenue: 0,
      totalCollected: 0,
      totalOutstandingDebt: 0,
    };

    return res.status(200).json({
      success: true,
      data: sales,
      pagination: {
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        currentPage: page,
        limit,
      },
      metrics,
    });
  } catch (error) {
    console.error("Error fetching sales ledger:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to retrieve sales ledger" });
  }
};

/**
 * 3. GET /api/sales/export
 * Generates Excel report from Sale collection
 */
export const exportSalesToExcel = async (req, res) => {
  try {
    const debtStatus = req.query.status || "ALL";
    const paymentMethod = req.query.paymentMethod || "ALL";

    const query = {};
    if (debtStatus === "OWING") query.amountOwe = { $gt: 0 };
    if (debtStatus === "PAID") query.amountOwe = { $lte: 0 };
    if (paymentMethod !== "ALL") query.paymentMethod = paymentMethod;

    const sales = await Sale.find(query)
      .populate("customer", "fullName phone customerType")
      .populate("items.product", "name")
      .sort({ createdAt: -1 });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Sales Ledger");

    worksheet.columns = [
      { header: "Date & Time", key: "createdAt", width: 22 },
      { header: "Customer Name", key: "fullName", width: 24 },
      { header: "Phone Number", key: "phone", width: 16 },
      { header: "Payment Method", key: "paymentMethod", width: 18 },
      { header: "Items Bought", key: "itemsSummary", width: 35 },
      { header: "Total Bill", key: "totalAmount", width: 15 },
      { header: "Amount Paid", key: "amountPaid", width: 15 },
      { header: "Amount Owing", key: "amountOwe", width: 15 },
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFF" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "107C41" },
    };

    sales.forEach((record) => {
      const itemsSummary = record.items
        .map(
          (item) =>
            `${item.name || item.product?.name || "Item"} (x${item.qty})`,
        )
        .join(", ");

      worksheet.addRow({
        createdAt: new Date(record.createdAt).toLocaleString(),
        fullName: record.customer?.fullName || "Walk-in Customer",
        phone: record.customer?.phone || "N/A",
        paymentMethod: record.paymentMethod,
        itemsSummary,
        totalAmount: (record.totalAmount || 0).toFixed(2),
        amountPaid: (record.amountPaid || 0).toFixed(2),
        amountOwe: (record.amountOwe || 0).toFixed(2),
      });
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Sales_Ledger_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );

    await workbook.xlsx.write(res);
    res.status(200).end();
  } catch (error) {
    console.error("Error exporting Excel file:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to export Excel report" });
  }
};

/**
 * 4. GET /api/sales/:id/receipt
 * Retrieves single Sale document by Sale ID
 */
export const getSaleReceipt = async (req, res) => {
  try {
    const { id } = req.params;

    const saleRecord = await Sale.findById(id)
      .populate("customer", "fullName phone email address customerType")
      .populate("items.product", "name price category description");

    if (!saleRecord) {
      return res
        .status(404)
        .json({ success: false, message: "Receipt transaction not found" });
    }

    res.status(200).json({ success: true, data: saleRecord });
  } catch (error) {
    console.error("Error fetching receipt:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to load receipt details" });
  }
};

/**
 * 5. POST /api/sales/:id/pay-debt
 * Pays debt against a specific Sale transaction ID
 */
export const payDebt = async (req, res) => {
  try {
    const { id } = req.params; // Sale ID
    const { paymentAmount, note } = req.body;

    const parsedAmount = parseFloat(paymentAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid payment amount" });
    }

    const saleRecord = await Sale.findById(id).populate("customer");
    if (!saleRecord) {
      return res
        .status(404)
        .json({ success: false, message: "Sale transaction not found" });
    }

    if (saleRecord.amountOwe <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "This bill has no outstanding debt" });
    }

    if (parsedAmount > saleRecord.amountOwe) {
      return res.status(400).json({
        success: false,
        message: `Payment amount exceeds remaining bill debt of ${saleRecord.amountOwe}`,
      });
    }

    // Reduce debt on Sale
    saleRecord.amountPaid += parsedAmount;
    saleRecord.amountOwe = Math.max(0, saleRecord.amountOwe - parsedAmount);
    await saleRecord.save();

    // Log in Payment Ledger linked to Customer
    const ledgerEntry = await PaymentLedger.create({
      customerId: saleRecord.customer._id || saleRecord.customer,
      amountPaid: parsedAmount,
      note: note || `Debt payment for Sale #${saleRecord._id}`,
      paymentDate: new Date(),
    });

    res.status(200).json({
      success: true,
      message: "Debt payment updated successfully",
      data: {
        sale: saleRecord,
        receipt: ledgerEntry,
      },
    });
  } catch (error) {
    console.error("Error logging debt payment:", error);
    res.status(500).json({
      success: false,
      message: "Server error processing debt payment",
    });
  }
};

/**
 * 6. GET /api/sales/debtors
 * Gets all unpaid sales transactions
 */
export const getDebtors = async (req, res) => {
  try {
    const debtors = await Sale.find({ amountOwe: { $gt: 0 } })
      .populate("customer", "fullName phone customerType")
      .sort({ amountOwe: -1 });

    return res.status(200).json(debtors);
  } catch (error) {
    console.error("Error fetching debtors:", error);
    return res.status(500).json({
      message: "Server error fetching debtors",
      error: error.message,
    });
  }
};

/**
 * 7. GET /api/customer or /api/sales/customers
 * Returns directory of all registered customers with real-time aggregated sales totals
 */
export const getAllCustomersSummary = async (req, res) => {
  try {
    const search = req.query.search ? req.query.search.trim() : "";
    const matchStage = {};

    if (search) {
      matchStage.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    const customers = await Customer.aggregate([
      { $match: matchStage },
      {
        $lookup: {
          from: "sales", // MongoDB collection name for Sale model
          localField: "_id",
          foreignField: "customer",
          as: "salesHistory",
        },
      },
      {
        $project: {
          _id: 1,
          fullName: 1,
          phone: 1,
          email: 1,
          address: 1,
          customerType: 1,
          createdAt: 1,
          totalPurchases: { $size: "$salesHistory" },
          totalSpent: { $sum: "$salesHistory.totalAmount" },
          totalPaid: { $sum: "$salesHistory.amountPaid" },
          totalOwing: { $sum: "$salesHistory.amountOwe" },
          lastPurchaseDate: { $max: "$salesHistory.createdAt" },
        },
      },
      { $sort: { totalSpent: -1, createdAt: -1 } },
    ]);

    return res.status(200).json({
      success: true,
      count: customers.length,
      data: customers,
    });
  } catch (error) {
    console.error("Error fetching customers summary:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch customer summary list",
      error: error.message,
    });
  }
};

/**
 * 8. GET /api/customer/:id/history or /api/sales/customer/:id/history
 * Returns the full itemized purchase statement ("Spool History") for a single customer
 */
export const getCustomerShoppingHistory = async (req, res) => {
  try {
    const { id } = req.params;

    const customerRecord = await Customer.findById(id);
    if (!customerRecord) {
      return res.status(404).json({
        success: false,
        message: "Customer record not found",
      });
    }

    // Retrieve all sales linked to this customer
    const salesHistory = await Sale.find({ customer: id })
      .populate("items.product", "name price category")
      .sort({ createdAt: -1 });

    // Calculate aggregated lifetime statistics
    const summary = salesHistory.reduce(
      (acc, sale) => {
        acc.totalOrders += 1;
        acc.totalSpent += sale.totalAmount || 0;
        acc.totalPaid += sale.amountPaid || 0;
        acc.totalOwing += sale.amountOwe || 0;
        return acc;
      },
      { totalOrders: 0, totalSpent: 0, totalPaid: 0, totalOwing: 0 },
    );

    return res.status(200).json({
      success: true,
      customer: customerRecord,
      summary,
      history: salesHistory,
    });
  } catch (error) {
    console.error("Error fetching customer history:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve customer purchase history",
      error: error.message,
    });
  }
};
