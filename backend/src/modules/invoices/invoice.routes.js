import express from "express";

import protect from "../../middlewares/auth.middleware.js";
import checkPermission from "../../middlewares/permission.middleware.js";
import checkSubscription from "../../middlewares/subscription.middleware.js";

import invoiceController from "./invoice.controller.js";

const router =
  express.Router();

router.post(
  "/",
  protect,
  checkSubscription,
  checkPermission("canManageInvoices"),
  invoiceController.createInvoice
);

router.put(
  "/:invoiceId/payment",
  protect,
  checkPermission("canManageInvoices"),
  invoiceController.updateInvoicePayment
);

router.put(
  "/:id",
  protect,
  checkPermission("canManageInvoices"),
  invoiceController.updateInvoice
);

router.delete(
  "/:id",
  protect,
  checkPermission("canManageInvoices"),
  invoiceController.deleteInvoice
);

router.put(
  "/:invoiceId/return-item",
  protect,
  checkPermission("canManageInvoices"),
  invoiceController.returnInvoiceItem
);

router.get(
  "/",
  protect,
  checkPermission("canViewInvoices"),
  invoiceController.getInvoices
);

router.get(
  "/:id",
  protect,
  checkPermission("canViewInvoices"),
  invoiceController.getInvoiceById
);

router.get(
  "/:invoiceId/pdf",
  protect,
  checkPermission("canViewInvoices"),
  invoiceController.getInvoicePDF
);

router.post(
  "/:invoiceId/share",
  protect,
  checkPermission("canManageInvoices"),
  invoiceController.shareInvoice
);

router.get(
  "/:invoiceId/email-history",
  protect,
  checkPermission("canViewInvoices"),
  invoiceController.getInvoiceEmailHistory
);

export default router;