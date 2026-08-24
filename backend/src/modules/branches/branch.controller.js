import Branch from "./branch.model.js";
import User from "../users/user.model.js";
import { isPrivileged } from "../../utils/branchAccess.js";
import BranchInventory from "./branchInventory.model.js";
import InventoryMovement from "../inventory/inventory.model.js";
import Sale from "../sales/sale.model.js";
import Invoice from "../invoices/invoice.model.js";
import Expense from "../expenses/expense.model.js";

const createBranch = async (req, res) => {
  try {
    if (req.user.role !== "owner" && req.user.role !== "super_admin") {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const { name, address, phone, manager } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Branch name is required" });
    }

    const existing = await Branch.findOne({
      business: req.user.businessId,
      name: name.trim()
    });

    if (existing) {
      return res.status(409).json({ message: "A branch with that name already exists" });
    }

    const branch = await Branch.create({
      business: req.user.businessId,
      name: name.trim(),
      address: address || "",
      phone: phone || "",
      manager: manager || undefined
    });

    if (manager) {
      const user = await User.findById(manager);
      if (user && user.business?.toString() === req.user.businessId) {
        branch.manager = user._id;
        await branch.save();
      }
    }

    res.status(201).json(branch);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getBranches = async (req, res) => {
  try {
    let branchQuery = { business: req.user.businessId };

    const canViewAllBranches =
      isPrivileged(req.user) ||
      req.user.permissions?.canViewAllBranchInventory === true;

    if (!canViewAllBranches && req.user.branchId) {
      branchQuery = {
        ...branchQuery,
        _id: req.user.branchId
      };
    }

    const branches = await Branch.find(branchQuery)
      .populate("manager", "name email role")
      .lean();

    res.json(branches);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateBranch = async (req, res) => {
  try {
    if (req.user.role !== "owner" && req.user.role !== "super_admin") {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const branch = await Branch.findOne({
      _id: req.params.id,
      business: req.user.businessId
    });

    if (!branch) {
      return res.status(404).json({ message: "Branch not found" });
    }

    const { name, address, phone, status, manager } = req.body;

    if (name !== undefined) branch.name = String(name).trim();
    if (address !== undefined) branch.address = address;
    if (phone !== undefined) branch.phone = phone;
    if (status !== undefined) branch.status = status;

    if (manager !== undefined) {
      const user = await User.findById(manager);
      if (!user || user.business?.toString() !== req.user.businessId) {
        return res.status(400).json({ message: "Invalid branch manager" });
      }
      branch.manager = user._id;
    }

    await branch.save();
    res.json(branch);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteBranch = async (req, res) => {
  try {
    if (req.user.role !== "owner" && req.user.role !== "super_admin") {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const branch = await Branch.findOneAndDelete({
      _id: req.params.id,
      business: req.user.businessId
    });

    if (!branch) {
      return res.status(404).json({ message: "Branch not found" });
    }

    const [inventoryCount, movementCount, saleCount, invoiceCount, expenseCount] = await Promise.all([
      BranchInventory.countDocuments({ business: req.user.businessId, branch: branch._id }),
      InventoryMovement.countDocuments({ business: req.user.businessId, branch: branch._id }),
      Sale.countDocuments({ business: req.user.businessId, branch: branch._id }),
      Invoice.countDocuments({ business: req.user.businessId, branch: branch._id }),
      Expense.countDocuments({ business: req.user.businessId, branch: branch._id })
    ]);

    if (inventoryCount || movementCount || saleCount || invoiceCount || expenseCount) {
      return res.status(409).json({
        message: "Cannot delete a branch with historical records. Deactivate it instead.",
        counts: { inventoryCount, movementCount, saleCount, invoiceCount, expenseCount }
      });
    }

    res.json({ message: "Branch deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export default {
  createBranch,
  getBranches,
  updateBranch,
  deleteBranch
};
