import express from "express";
import protect from "../../middlewares/auth.middleware.js";
import syncController from "./sync.controller.js";

const router = express.Router();

router.get("/bootstrap", protect, syncController.getBootstrapSnapshot);

export default router;
