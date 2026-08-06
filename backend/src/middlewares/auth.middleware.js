import jwt from "jsonwebtoken";
import User from "../modules/users/user.model.js";
import Business from "../modules/businesses/business.model.js";
import SystemSettings from "../modules/admin/systemSettings.model.js";

const protect = async (req, res, next) => {
  try {
    // 🔐 TOKEN
    const authHeader = req.headers.authorization;

    const token =
      authHeader && authHeader.startsWith("Bearer ")
        ? authHeader.split(" ")[1]
        : null;

    if (!token) {
      return res.status(401).json({
        message: "No token provided"
      });
    }

    // 🔓 VERIFY
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    // 🔥 FETCH USER
    const user = await User.findById(decoded.id).populate(
      "business"
    );

    if (!user) {
      return res.status(401).json({
        message: "User not found"
      });
    }

    // 🚫 DISABLED
    if (user.isActive === false) {
      return res.status(403).json({
        message: "Account disabled"
      });
    }

    // 🔥 BUSINESS ID FALLBACK SYSTEM
    let businessId = null;

    if (user.business) {
      if (typeof user.business === "string") {
        businessId = user.business;
      } else if (user.business._id) {
        businessId = user.business._id.toString();
      } else {
        businessId = user.business.toString();
      }
    }

    if (!businessId && decoded.businessId) {
      businessId =
        decoded.businessId._id?.toString?.() ||
        decoded.businessId.toString();
    }

    // 🔥 SUPER ADMIN IMPERSONATION
    const impersonatedBusiness =
      req.headers["x-business-id"];

    if (
      impersonatedBusiness &&
      user.role === "super_admin"
    ) {
      businessId = impersonatedBusiness;
    }

    const allowsNoBusiness = ["super_admin", "affiliate"].includes(user.role);

    // 🚫 BLOCK NORMAL USERS WITH NO BUSINESS
    if (!businessId && !allowsNoBusiness) {
      return res.status(400).json({
        message: "No business linked to user"
      });
    }

    // 🔥 REAL-TIME BUSINESS STATUS
    const activeBusiness = businessId
      ? await Business.findById(businessId).lean()
      : null;

    const isProFromBusiness =
      activeBusiness?.isPro ||
      activeBusiness?.subscription?.plan === "pro" &&
        activeBusiness?.subscription?.status === "active";

    // 🚫 BLOCK ACCESS IF BUSINESS SUSPENDED/ARCHIVED/DELETED (unless super_admin)
    if (
      activeBusiness &&
      (activeBusiness.status === "suspended" || activeBusiness.status === "deleted" || activeBusiness.status === "archived") &&
      user.role !== "super_admin"
    ) {
      const settings = await SystemSettings.findOne().lean();
      return res.status(403).json({
        message: activeBusiness.status === "deleted" ? "Organization removed - contact admin" : (activeBusiness.status === "suspended" ? "Organization suspended - contact admin" : "Organization archived - contact admin"),
        adminContact: settings?.adminContact || { name: "Support", email: "support@marthington.com", phone: "" }
      });
    }

    const branchId = user.branch
      ? typeof user.branch === "string"
        ? user.branch
        : user.branch._id?.toString?.() || user.branch.toString()
      : null;

    req.user = {
      id: user._id.toString(),
      _id: user._id.toString(),
      email: user.email || "",
      name: user.name || "",
      role: user.role,
      businessId,
      branchId,
      industryType:
        activeBusiness?.industryType ||
        user.business?.industryType ||
        decoded.industryType ||
        "retail",
      isPro: isProFromBusiness || false,
      permissions: user.permissions || {},
      isActive: user.isActive
    };

    next();

  } catch (err) {
    console.error("AUTH ERROR:", err);

    if (err && err.name === "TokenExpiredError") {
      return res.status(401).json({
        message: "Token expired"
      });
    }

    return res.status(401).json({
      message: "Invalid or expired token"
    });
  }
};

export default protect;