import express from "express";
import protect from "../../middlewares/auth.middleware.js";
import checkPermission from "../../middlewares/permission.middleware.js";
import productController from "./product.controller.js";
import upload from "../../middlewares/upload.middleware.js";


const router = express.Router();


// 🔥 CREATE PRODUCT
router.post(
  "/",
  protect,
  checkPermission("canManageProducts"),
  productController.createProduct
);


// 🔥 BULK IMPORT PRODUCTS
router.post(
  "/bulk-import",
  protect,
  checkPermission("canManageProducts"),
  upload.single("file"),
  productController.bulkImportProducts
);

// 🔥 BULK DELETE PRODUCTS
router.delete(
  "/bulk",
  protect,
  checkPermission("canManageProducts"),
  productController.bulkDeleteProducts
);

// 🔥 GET PRODUCTS FOR AUTOCOMPLETE
router.get(
  "/autocomplete",
  protect,
  productController.getProductsForAutocomplete
);

// 🔥 GET PRODUCTS
router.get(
  "/",
  protect,
  checkPermission("canViewProducts"),
  productController.getProducts
);


// 🔥 UPDATE PRODUCT
router.put(
  "/:id",
  protect,
  checkPermission("canManageProducts"),
  productController.updateProduct
);


// 🔥 DELETE PRODUCT
router.delete(
  "/:id",
  protect,
  checkPermission("canManageProducts"),
  productController.deleteProduct
);


export default router;