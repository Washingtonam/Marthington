import User from "../users/user.model.js";
import Business from "../businesses/business.model.js";
import SystemSettings from "../admin/systemSettings.model.js";
import bcrypt from "bcryptjs";
import generateToken from "../../utils/generateToken.js";
import jwt from "jsonwebtoken";

// 🔥 REGISTER (FULL BUSINESS ONBOARDING)
const register = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      businessName,
      address,
      phone,
      industryType = "retail",
      referredBy = null
    } = req.body;

    // CHECK EXISTING USER
      const existingUser = await User.findOne({ email: (email || "").toLowerCase().trim() });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // CREATE BUSINESS (🔥 NOW COMPLETE)
    const business = await Business.create({
      name: businessName,
      address,
      phone,
      industryType,
      referredBy: referredBy || null
    });

    // CREATE OWNER (🔥 FULL PERMISSIONS)
      const user = await User.create({
        name,
        email: (email || "").toLowerCase().trim(),
      password: hashedPassword,
      role: "owner",
      business: business._id,

      permissions: {
        canViewDashboard: true,
        canManageProducts: true,
        canViewProducts: true,
        canMakeSale: true,
        canViewSales: true,
        canViewReports: true,
        canOverridePrice: true,
        canViewBranches: true,
        canManageBranches: true,
        canViewBranchInventory: true,
        canManageBranchInventory: true,
        canViewCustomers: true,
        canManageCustomers: true,
        canViewInvoices: true,
        canManageInvoices: true,
        canViewExpenses: true,
        canManageExpenses: true,
        canViewPayments: true,
        canManagePayments: true,
        canAccessPOS: true,
        canApplyDiscounts: true,
        canProcessReturns: true,
        canViewSalesReports: true,
        canViewFinancialReports: true,
        canViewStaffReports: true,
        canInviteStaff: true,
        canEditStaffPermissions: true,
        canDeactivateStaff: true,
        canManageStaff: true,
        canManageSettings: true,
        canManageBilling: true,
        canManageBusinessProfile: true,
        canManageIntegrations: true
      }
    });

    // LINK OWNER → BUSINESS
    business.owner = user._id;
    await business.save();

    const token = generateToken(
      user,
      business.industryType,
      false
    );

    const refreshToken = jwt.sign(
      { id: user._id },
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    user.refreshToken = refreshToken;
    await user.save();

    res.json({
      token,
      refreshToken,
      user: {
        ...user.toObject(),
        industryType: business.industryType,
        isPro: false
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


// 🔐 LOGIN (🔥 WITH ACTIVE CHECK)
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

      const user = await User.findOne({ email: (email || "").toLowerCase().trim() }).populate(
      "business"
    );

    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    // 🔥 CHECK IF DISABLED
    if (!user.isActive) {
      return res.status(403).json({ message: "Account disabled" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid password" });
    }

    const business = user.business || {};

    // Block login if business suspended, archived or deleted
    if (business.status === "suspended" || business.status === "deleted" || business.status === "archived") {
      const settings = await SystemSettings.findOne().lean();
      return res.status(403).json({
        message: business.status === "deleted" ? "Organization removed - contact admin" : (business.status === "suspended" ? "Organization suspended - contact admin" : "Organization archived - contact admin"),
        adminContact: settings?.adminContact || { name: "Support", email: "support@marthington.com", phone: "" }
      });
    }

    const industryType =
      business.industryType || "retail";

    const isPro =
      business.isPro ||
      (business.subscription?.plan === "pro" &&
        business.subscription?.status === "active") ||
      false;

    const token = generateToken(user, industryType, isPro);

    const refreshToken = jwt.sign(
      { id: user._id },
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    user.refreshToken = refreshToken;
    await user.save();

    res.json({
      token,
      refreshToken,
      user: {
        ...user.toObject(),
        industryType,
        isPro
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 🔁 REFRESH ACCESS TOKEN
const refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ message: "No refresh token provided" });
    }

    let decoded;
    try {
      decoded = jwt.verify(
        refreshToken,
        process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET
      );
    } catch (err) {
      return res.status(401).json({ message: "Invalid or expired refresh token" });
    }

    const user = await User.findById(decoded.id).populate("business");
    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    const business = user.business || {};

    // Block refresh if business suspended, archived or deleted
    if (business.status === "suspended" || business.status === "deleted" || business.status === "archived") {
      const settings = await SystemSettings.findOne().lean();
      return res.status(403).json({
        message: business.status === "deleted" ? "Organization removed - contact admin" : (business.status === "suspended" ? "Organization suspended - contact admin" : "Organization archived - contact admin"),
        adminContact: settings?.adminContact || { name: "Support", email: "support@marthington.com", phone: "" }
      });
    }

    const industryType = business.industryType || "retail";

    const isPro =
      business.isPro ||
      (business.subscription?.plan === "pro" &&
        business.subscription?.status === "active") ||
      false;

    const token = generateToken(user, industryType, isPro);

    const newRefresh = jwt.sign(
      { id: user._id },
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    user.refreshToken = newRefresh;
    await user.save();

    res.json({
      token,
      refreshToken: newRefresh,
      user: {
        ...user.toObject(),
        industryType,
        isPro
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export default {
  register,
  login,
  refresh
};