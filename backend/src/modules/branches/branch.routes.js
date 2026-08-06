import express from "express";
import protect from "../../middlewares/auth.middleware.js";
import branchController from "./branch.controller.js";

const router = express.Router();

router.get("/", protect, branchController.getBranches);
router.post("/", protect, branchController.createBranch);
router.put("/:id", protect, branchController.updateBranch);
router.delete("/:id", protect, branchController.deleteBranch);

export default router;
