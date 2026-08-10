import express from "express";

import protect from "../../middlewares/auth.middleware.js";
import checkPermission from "../../middlewares/permission.middleware.js";

import customerController from "./customer.controller.js";

const router =
  express.Router();

router.post(
  "/",
  protect,
  checkPermission("canManageCustomers"),
  customerController.createCustomer
);

router.get(
  "/",
  protect,
  checkPermission("canViewCustomers"),
  customerController.getCustomers
);

router.get(
  "/:id",
  protect,
  checkPermission("canViewCustomers"),
  customerController.getCustomerById
);

export default router;