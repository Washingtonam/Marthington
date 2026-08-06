import User from "./user.model.js";
import Branch from "../branches/branch.model.js";
import bcrypt from "bcryptjs";

// 🔥 CREATE STAFF
export const createStaff = async (req, res) => {
  try {
    const { name, email, password, permissions, branch } = req.body;

    if (req.user.role !== "owner" && req.user.role !== "super_admin") {
      return res.status(403).json({ message: "Unauthorized" });
    }

    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (branch) {
      const branchRecord = await Branch.findOne({ _id: branch, business: req.user.businessId });
      if (!branchRecord) {
        return res.status(400).json({ message: "Invalid branch assignment" });
      }
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "Email already in use" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const staff = await User.create({
      name,
      email,
      password: hashedPassword,
      role: "staff",
      business: req.user.businessId,
      branch: branch || null,
      isActive: true,
      permissions: {
        canViewDashboard: false,
        canManageProducts: false,
        canViewProducts: true,
        canMakeSale: true,
        canViewSales: true,
        canViewReports: false,
        canOverridePrice: false,
        canManageStaff: false,
        canManageSettings: false,
        ...permissions
      }
    });

    res.json(staff);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// 🔥 GET STAFF
export const getStaff = async (req, res) => {
  try {
    const users = await User.find({
      business: req.user.businessId,
      role: "staff"
    }).select("-password");

    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// 🔥 UPDATE STAFF PERMISSIONS
export const updateStaff = async (req, res) => {
  try {
    const { permissions, branch } = req.body;

    const staff = await User.findById(req.params.id);

    if (!staff) {
      return res.status(404).json({ message: "Staff not found" });
    }

    if (
      req.user.role !== "super_admin" &&
      staff.business.toString() !== req.user.businessId
    ) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    if (permissions !== undefined) {
      staff.permissions = {
        ...staff.permissions,
        ...permissions
      };
    }

    if (branch !== undefined) {
      const branchRecord = await Branch.findOne({ _id: branch, business: req.user.businessId });
      if (!branchRecord) {
        return res.status(400).json({ message: "Invalid branch assignment" });
      }
      staff.branch = branch;
    }

    await staff.save();

    res.json(staff);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// 🔥 TOGGLE STAFF STATUS
export const toggleStaffStatus = async (req, res) => {
  try {
    const staff = await User.findById(req.params.id);

    if (!staff) {
      return res.status(404).json({ message: "Staff not found" });
    }

    if (
      req.user.role !== "super_admin" &&
      staff.business.toString() !== req.user.businessId
    ) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    staff.isActive = !staff.isActive;

    await staff.save();

    res.json({
      message: `Staff ${staff.isActive ? "enabled" : "disabled"}`,
      staff
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};