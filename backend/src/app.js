import cors from "cors";
import express from "express";

import authRoutes from "./modules/auth/auth.routes.js";
import affiliateAuthRoutes from "./modules/auth/affiliate.routes.js";
import productRoutes from "./modules/products/product.routes.js";
import salesRoutes from "./modules/sales/sales.routes.js";
import userRoutes from "./modules/users/users.routes.js";
import businessRoutes from "./modules/businesses/business.routes.js";
import adminRoutes from "./modules/admin/admin.routes.js";
import subscriptionRoutes from "./modules/subscriptions/subscription.routes.js";
import serviceRoutes from "./modules/services/service.routes.js";
import analyticsRoutes from "./modules/analytics/analytics.routes.js";
import reportsRoutes from "./modules/reports/reports.routes.js";
import staffRoutes from "./modules/staff/staff.routes.js";
import invoiceRoutes from "./modules/invoices/invoice.routes.js";
import transactionRoutes from "./modules/transactions/transaction.routes.js";
import customerRoutes from "./modules/customers/customer.routes.js";
import schoolRoutes from "./modules/schools/school.routes.js";
import hospitalRoutes from "./modules/hospitals/hospital.routes.js";
import billingRoutes from "./modules/billing/billing.routes.js";
import flutterwaveRoutes from "./modules/payments/flutterwave.routes.js";
import branchRoutes from "./modules/branches/branch.routes.js";
import branchInventoryRoutes from "./modules/branches/branchInventory.routes.js";
import branchTransferRoutes from "./modules/branches/branchTransfer.routes.js";

// 🔥 ADD THIS
import paymentRoutes from "./modules/payments/payment.routes.js";
import expenseRoutes from "./modules/expenses/expense.routes.js";
import supplierRoutes from "./modules/suppliers/supplier.routes.js";
import purchaseOrderRoutes from "./modules/purchaseOrders/purchaseOrder.routes.js";
import affiliateRoutes from "./modules/affiliates/affiliate.routes.js";
import payoutRoutes from "./modules/affiliates/payout.routes.js";
import notificationRoutes from "./modules/notifications/notification.routes.js";
import categoryBudgetRoutes from "./modules/budgets/categoryBudget.routes.js";
import budgetAlertRoutes from "./modules/budgets/budgetAlert.routes.js";
import syncRoutes from "./modules/sync/sync.routes.js";

const app = express();

app.use(cors());
app.use(express.json({
  verify: (req, res, buf, encoding) => {
    if (req.originalUrl && req.originalUrl.startsWith("/api/payments/paystack/webhook")) {
      req.rawBody = buf.toString(encoding || "utf8");
    }
  }
}));

// 🔥 ROUTES
app.use("/api/auth", authRoutes);
app.use("/api/affiliate-auth", affiliateAuthRoutes);
app.use("/api/products", productRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/users", userRoutes);
app.use("/api/business", businessRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/staff", staffRoutes);
// 🔥 PAYMENT ROUTE (VERY IMPORTANT)
app.use("/api/payments", paymentRoutes);
app.use("/api/flutterwave", flutterwaveRoutes);
// 🔥 SUBSCRIPTION ROUTE
app.use("/api/subscription", subscriptionRoutes);
// 🔥 SERVICE ROUTE
app.use("/api/services", serviceRoutes);
app.use("/api/schools", schoolRoutes);
app.use("/api/hospitals", hospitalRoutes);
// 🔥 ANALYTICS ROUTE
app.use("/api/analytics", analyticsRoutes);
// 🔥 REPORTS ROUTE
app.use("/api/reports", reportsRoutes);
// 🔥 BILLING ROUTE
app.use("/api/billing", billingRoutes);
// 🔥 INVOICE ROUTE
app.use("/api/invoices", invoiceRoutes);
// 🔥 TRANSACTION ROUTE
app.use("/api/transactions", transactionRoutes);
// 🔥 CUSTOMER ROUTE
app.use("/api/customers", customerRoutes);
app.use("/api/suppliers", supplierRoutes);
app.use("/api/purchase-orders", purchaseOrderRoutes);
app.use("/api/branches/inventory", branchInventoryRoutes);
app.use("/api/branches/transfers", branchTransferRoutes);
app.use("/api/branches", branchRoutes);
// 🔥 EXPENSES ROUTE
app.use("/api/expenses", expenseRoutes);
app.use("/api/category-budgets", categoryBudgetRoutes);
app.use("/api/budget-alerts", budgetAlertRoutes);
app.use("/api/sync", syncRoutes);
app.use("/api/affiliates", affiliateRoutes);
app.use("/api/affiliates/payouts", payoutRoutes);
app.use("/api/notifications", notificationRoutes);
// HEALTH CHECK
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});


// 404 HANDLER
app.use((req, res) => {
  res.status(404).json({ message: "Route not found." });
});

// GLOBAL ERROR HANDLER
app.use((err, req, res, next) => {
  console.error('GLOBAL ERROR:', err && err.stack ? err.stack : err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
});

export default app;