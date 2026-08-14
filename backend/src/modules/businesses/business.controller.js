import Business from "./business.model.js";
import cloudinary from "../../utils/cloudinary.js";

// 🔥 NORMALIZE BUSINESS RESPONSE (SINGLE SOURCE OF TRUTH)
const formatBusiness = (business) => {
  const obj = business?.toObject ? business.toObject() : business || {};
  const industryType = obj.industryType || "retail";
  const businessType = obj.businessType || "general_services";
  const subscription = {
    plan: obj.subscription?.plan || "free",
    status: obj.subscription?.status || "trial",
    billingCycle: obj.subscription?.billingCycle || null,
    startedAt: obj.subscription?.startedAt || null,
    expiresAt: obj.subscription?.expiresAt || null,
    amount: obj.subscription?.amount || 0,
    tier: obj.subscription?.tier || "",
    reference: obj.subscription?.reference || ""
  };

  return {
    ...obj,
    industryType,
    businessType,
    plan: subscription.plan,
    isPro:
      obj.isPro === true ||
      (subscription.plan === "pro" && subscription.status === "active"),
    subscription
  };
};

// 🔥 GET BUSINESS (HARDENED)
export const getBusiness = async (req, res) => {
  try {
    if (!req.user?.businessId) {
      const fallbackBusiness = {
        industryType: "retail",
        businessType: "general_services",
        name: "",
        address: "",
        phone: "",
        email: "",
        receiptFooter: "",
        receiptTheme: "",
        logo: "",
        products: [],
        subscription: {
          plan: "free",
          status: "trial",
          billingCycle: null,
          startedAt: null,
          expiresAt: null,
          amount: 0,
          tier: "",
          reference: ""
        },
        isPro: false,
        studentCount: 0,
        activePatientCount: 0
      };

      return res.status(200).json({
        success: true,
        data: fallbackBusiness
      });
    }

    const rawBusiness = await Business.findById(req.user.businessId);

    if (!rawBusiness) {
      return res.status(404).json({
        success: false,
        message: "Business not found"
      });
    }

    const business = {
      ...rawBusiness.toObject(),
      industryType: rawBusiness?.industryType || "retail",
      businessType: rawBusiness?.businessType || "general_services",
      name: rawBusiness?.name || "",
      address: rawBusiness?.address || "",
      phone: rawBusiness?.phone || "",
      email: rawBusiness?.email || "",
      receiptFooter: rawBusiness?.receiptFooter || "",
      receiptTheme: rawBusiness?.receiptTheme || "",
      logo: rawBusiness?.logo || "",
      products: Array.isArray(rawBusiness?.products) ? rawBusiness.products : [],
      subscription: {
        ...(rawBusiness?.subscription || {}),
        plan: rawBusiness?.subscription?.plan || "free",
        status: rawBusiness?.subscription?.status || "trial",
        billingCycle: rawBusiness?.subscription?.billingCycle || null,
        startedAt: rawBusiness?.subscription?.startedAt || null,
        expiresAt: rawBusiness?.subscription?.expiresAt || null,
        amount: rawBusiness?.subscription?.amount || 0,
        tier: rawBusiness?.subscription?.tier || "",
        reference: rawBusiness?.subscription?.reference || ""
      },
      isPro:
        rawBusiness?.isPro === true ||
        (rawBusiness?.subscription?.plan === "pro" &&
          rawBusiness?.subscription?.status === "active"),
      studentCount: rawBusiness?.studentCount || 0,
      activePatientCount: rawBusiness?.activePatientCount || 0
    };

    return res.status(200).json({
      success: true,
      data: business
    });
  } catch (err) {
    console.error("❌ GET BUSINESS ERROR:", err);

    const fallbackBusiness = {
      industryType: "retail",
      businessType: "general_services",
      name: "",
      address: "",
      phone: "",
      email: "",
      receiptFooter: "",
      receiptTheme: "",
      logo: "",
      products: [],
      subscription: {
        plan: "free",
        status: "trial",
        billingCycle: null,
        startedAt: null,
        expiresAt: null,
        amount: 0,
        tier: "",
        reference: ""
      },
      isPro: false,
      studentCount: 0,
      activePatientCount: 0
    };

    return res.status(200).json({
      success: true,
      data: fallbackBusiness
    });
  }
};

// 🔥 UPDATE BUSINESS SETTINGS (HARDENED)
export const updateBusiness = async (req, res) => {
  try {
    // 🚫 BLOCK INVALID USER STATE
    if (!req.user?.businessId) {
      return res.status(400).json({
        message: "No business linked to user"
      });
    }

    const business = await Business.findById(req.user.businessId);

    if (!business) {
      return res.status(404).json({
        message: "Business not found"
      });
    }

    const {
      name,
      address,
      phone,
      email,
      receiptFooter,
      receiptTheme,
      businessType,
      industryType,
      logo,
      approvalRules
    } = req.body;

    // 🔥 LOGO UPLOAD
    if (req.file) {
      const base64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;

      const result = await cloudinary.uploader.upload(base64, {
        folder: "business_logos"
      });

      business.logo = result.secure_url;
    }

    // 🔥 REMOVE LOGO
    if (logo === "") {
      business.logo = "";
    }

    // 🔥 UPDATE FIELDS (SAFE MERGE)
    business.name = name ?? business.name;
    business.address = address ?? business.address;
    business.phone = phone ?? business.phone;
    business.email = email ?? business.email;
    business.receiptFooter = receiptFooter ?? business.receiptFooter;
    business.receiptTheme = receiptTheme ?? business.receiptTheme;
    business.businessType = businessType ?? business.businessType;
    business.industryType = industryType || business.industryType || "retail";

    if (approvalRules) {
      business.approvalRules = {
        ...business.approvalRules,
        ...approvalRules,
        exemptCategories: Array.isArray(approvalRules.exemptCategories)
          ? approvalRules.exemptCategories
          : business.approvalRules?.exemptCategories || [],
        trustedSuppliers: Array.isArray(approvalRules.trustedSuppliers)
          ? approvalRules.trustedSuppliers
          : business.approvalRules?.trustedSuppliers || []
      };
    }

    await business.save();

    res.json(formatBusiness(business));

  } catch (err) {
    console.error("❌ UPDATE BUSINESS ERROR:", err);
    res.status(500).json({
      message: err.message
    });
  }
};