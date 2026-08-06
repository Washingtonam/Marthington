import Business from "../businesses/business.model.js";
import User from "../users/user.model.js";
import Sale from "../sales/sale.model.js";
import Product from "../products/product.model.js";
import SystemSettings from "./systemSettings.model.js";
import PayoutRequest from "../affiliates/payoutRequest.model.js";
import AffiliatePayout from "../affiliates/affiliatePayout.model.js";
import WithdrawalHistory from "../affiliates/withdrawalHistory.model.js";
import Notification from "../notifications/notification.model.js";
import PayoutHistory from "../affiliates/payoutHistory.model.js";
import mongoose from "mongoose";
import Audit from "./audit.model.js";
import OperationLog from "../../models/operationLog.model.js";
import importQueue from "../../queues/importQueue.js";

// 🔥 NORMALIZER (SINGLE SOURCE OF TRUTH)
const formatBusiness = (business) => {
  const obj = business.toObject();

  const subPlan = obj.subscription?.plan;

  return {
    ...obj,
    plan: subPlan || "free",
    isPro: obj.isPro === true || subPlan === "pro",
    subscription: {
      ...obj.subscription,
      plan: subPlan || "free",
      status: obj.subscription?.status || "trial"
    }
  };
};

// 🔥 OVERVIEW (DASHBOARD)
const getOverview = async (req, res) => {
  try {
    const businessesCount = await Business.countDocuments();
    const usersCount = await User.countDocuments();
    const salesRecords = await Sale.find();

    const totalRevenue = salesRecords.reduce(
      (sum, sale) => sum + (sale.totalAmount || 0),
      0
    );

    const activeSubscriptions = await Business.countDocuments({
      "subscription.status": "active"
    });

    const industryCounts = {
      retail: 0,
      school: 0,
      hospital: 0
    };

    const salesSummary = await Sale.aggregate([
      {
        $group: {
          _id: "$business",
          totalSales: { $sum: "$totalAmount" },
          saleCount: { $sum: 1 }
        }
      }
    ]);

    const salesMap = salesSummary.reduce((map, item) => {
      map[item._id?.toString()] = {
        totalSales: item.totalSales,
        saleCount: item.saleCount
      };
      return map;
    }, {});

    const businessList = await Business.find()
      .populate("owner", "name email")
      .sort({ createdAt: -1 });

    const formattedBusinesses = businessList.map((business) => {
      const obj = formatBusiness(business);

      const industry = obj.industryType || "retail";
      if (industryCounts[industry] !== undefined) {
        industryCounts[industry] += 1;
      }

      const summary = salesMap[business._id.toString()] || {
        totalSales: 0,
        saleCount: 0
      };

      return {
        ...obj,
        ownerEmail: business.owner?.email || "",
        totalSalesRecord: summary.totalSales,
        saleCount: summary.saleCount,
        studentCount: obj.studentCount || 0,
        activePatientCount: obj.activePatientCount || 0
      };
    });

    res.json({
      stats: {
        totalRevenue,
        totalUsers: usersCount,
        activeSubscriptions,
        industryCounts,
        totalBusinesses: businessesCount
      },
      businesses: formattedBusinesses
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 🔥 ADMIN CONTROL (FULL FIX)
const updateSubscription = async (req, res) => {
  try {
    const {
      plan,
      billingCycle,
      duration,
      industryType,
      tier
    } = req.body;

    if (!["free", "pro"].includes(plan)) {
      return res.status(400).json({ message: "Invalid plan" });
    }

    const business = await Business.findById(req.params.id);

    if (!business) {
      return res.status(404).json({ message: "Business not found" });
    }

    let update = {};

    if (industryType && ["retail", "school", "hospital"].includes(industryType)) {
      update.industryType = industryType;
    }

    if (plan === "free") {
      update.plan = "free";
      update.subscription = {
        plan: "free",
        billingCycle: null,
        status: "expired",
        startedAt: null,
        expiresAt: null,
        amount: 0,
        tier: tier || "",
        reference: "admin_downgrade"
      };
    } else {
      const now = new Date();

      let baseDate =
        business.subscription?.expiresAt &&
        business.subscription.expiresAt > now
          ? new Date(business.subscription.expiresAt)
          : now;

      const cycle = billingCycle || "monthly";
      const dur = duration || 1;

      if (cycle === "yearly") {
        baseDate.setFullYear(baseDate.getFullYear() + dur);
      } else {
        baseDate.setMonth(baseDate.getMonth() + dur);
      }

      update.plan = "pro";
      update.subscription = {
        plan: "pro",
        billingCycle: cycle,
        status: "active",
        startedAt: business.subscription?.startedAt || now,
        expiresAt: baseDate,
        amount: 0,
        tier: tier || business.subscription?.tier || "Premium Plan",
        reference: "admin_override"
      };
    }

    const updated = await Business.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true }
    );

    res.json({
      message: "Subscription updated successfully",
      business: formatBusiness(updated)
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ================= BUSINESS STATUS CONTROLS =================
const suspendBusiness = async (req, res) => {
  try {
    const id = req.params.id;
    const reason = req.body.reason || "";
    const business = await Business.findById(id);
    if (!business) return res.status(404).json({ message: "Business not found" });
    business.status = "suspended";
    await business.save();
    // audit
    await Audit.create({ operatorId: req.user.id, operatorEmail: req.user.email, action: "suspend", targetEntity: business._id, reason: reason || "suspended by admin" });
    res.json({ message: "Business suspended" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const unsuspendBusiness = async (req, res) => {
  try {
    const id = req.params.id;
    const reason = req.body.reason || "";
    const business = await Business.findById(id);
    if (!business) return res.status(404).json({ message: "Business not found" });
    business.status = "active";
    await business.save();
    await Audit.create({ operatorId: req.user.id, operatorEmail: req.user.email, action: "unsuspend", targetEntity: business._id, reason: reason || "unsuspended by admin" });
    res.json({ message: "Business unsuspended" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteBusiness = async (req, res) => {
  try {
    const id = req.params.id;
    const permanent = req.query.permanent === "true";
    const reason = (req.body && req.body.reason) || "";

    if (permanent && !reason) {
      return res.status(400).json({ message: "Reason is required for permanent deletion" });
    }

    const business = await Business.findById(id);
    if (!business) return res.status(404).json({ message: "Business not found" });

    // soft-delete by default
    if (!permanent) {
      business.status = "deleted";
      await business.save();
      await Audit.create({ operatorId: req.user.id, operatorEmail: req.user.email, action: "soft-delete", targetEntity: business._id, reason: reason || "soft deleted by admin" });
      return res.json({ message: "Business marked as deleted (soft)" });
    }

    // Permanently remove business and related data within a transaction
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const Invoice = (await import("../invoices/invoice.model.js")).default;
        const Customer = (await import("../customers/customer.model.js")).default;
        const Expense = (await import("../expenses/expense.model.js")).default;
        const PurchaseOrder = (await import("../purchaseOrders/purchaseOrder.model.js")).default;
        const Supplier = (await import("../suppliers/supplier.model.js")).default;

        await Product.deleteMany({ business: business._id }).session(session);
        await Invoice.deleteMany({ business: business._id }).session(session);
        await Sale.deleteMany({ business: business._id }).session(session);
        await Customer.deleteMany({ business: business._id }).session(session);
        await Expense.deleteMany({ business: business._id }).session(session);
        await PurchaseOrder.deleteMany({ business: business._id }).session(session);
        await Supplier.deleteMany({ business: business._id }).session(session);

        // Remove users belonging to this business
        await User.deleteMany({ business: business._id }).session(session);

        // Finally remove the business document
        await Business.deleteOne({ _id: business._id }).session(session);

        // create audit within transaction
        await Audit.create([{ operatorId: req.user.id, operatorEmail: req.user.email, action: "permanent-delete", targetEntity: business._id, reason }], { session });
      });

      res.json({ message: "Business permanently deleted" });
    } finally {
      session.endSession();
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const archiveBusiness = async (req, res) => {
  try {
    const id = req.params.id;
    const reason = req.body.reason || "";
    const business = await Business.findById(id);
    if (!business) return res.status(404).json({ message: "Business not found" });
    business.status = "archived";
    await business.save();
    await Audit.create({ operatorId: req.user.id, operatorEmail: req.user.email, action: "archive", targetEntity: business._id, reason: reason || "archived by admin" });
    res.json({ message: "Business archived" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const unarchiveBusiness = async (req, res) => {
  try {
    const id = req.params.id;
    const reason = req.body.reason || "";
    const business = await Business.findById(id);
    if (!business) return res.status(404).json({ message: "Business not found" });
    business.status = "active";
    await business.save();
    await Audit.create({ operatorId: req.user.id, operatorEmail: req.user.email, action: "unarchive", targetEntity: business._id, reason: reason || "unarchived by admin" });
    res.json({ message: "Business unarchived" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getAffiliateSettings = async (req, res) => {
  try {
    let settings = await SystemSettings.findOne();

    if (!settings) {
      settings = await SystemSettings.create({ globalAffiliateRate: 20 });
    }

    res.json({
      message: "Affiliate settings fetched successfully",
      settings
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateAffiliateSettings = async (req, res) => {
  try {
    const { globalAffiliateRate } = req.body;

    if (typeof globalAffiliateRate !== "number" || globalAffiliateRate < 0 || globalAffiliateRate > 100) {
      return res.status(400).json({ message: "globalAffiliateRate must be a number between 0 and 100" });
    }

    let settings = await SystemSettings.findOne();

    if (!settings) {
      settings = await SystemSettings.create({ globalAffiliateRate });
    } else {
      settings.globalAffiliateRate = globalAffiliateRate;
      await settings.save();
    }

    res.json({
      message: "Affiliate settings updated successfully",
      settings
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateAdminContact = async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    let settings = await SystemSettings.findOne();
    if (!settings) {
      settings = await SystemSettings.create({ adminContact: { name, email, phone } });
    } else {
      settings.adminContact = { name: name || settings.adminContact?.name || "Support", email: email || settings.adminContact?.email || "support@marthington.com", phone: phone || settings.adminContact?.phone || "" };
      await settings.save();
    }
    res.json({ message: "Admin contact updated", adminContact: settings.adminContact });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ================= AFFILIATE ADMIN ACTIONS =================
const listAffiliates = async (req, res) => {
  try {
    const affiliates = await User.find({ role: "affiliate" })
      .select("name email affiliateCode walletBalance totalEarned createdAt")
      .sort({ createdAt: -1 })
      .lean();

    const settings = await SystemSettings.findOne();
    const globalRate = Number(settings?.globalAffiliateRate ?? 20);

    const totalPaid = await AffiliatePayout.aggregate([
      { $group: { _id: null, total: { $sum: "$commissionEarned" } } }
    ]);

    const settingsDoc = await SystemSettings.findOne();
    const stats = {
      totalPartners: affiliates.length,
      pendingPayouts: await PayoutRequest.countDocuments({ status: "pending" }),
      totalPaidCommissions: Number(settingsDoc?.totalCommissionsCleared ?? (totalPaid[0] && totalPaid[0].total) ?? 0)
    };

    res.json({ affiliates, globalRate, stats });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getPartnerPayoutHistory = async (req, res) => {
  try {
    const partnerId = req.params.id;
    const history = await WithdrawalHistory.find({ partnerId })
      .sort({ date: -1 })
      .lean();

    res.json({ history });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getWithdrawalHistory = async (req, res) => {
  try {
    const history = await WithdrawalHistory.find({})
      .populate("partnerId", "name email affiliateCode")
      .sort({ date: -1 })
      .lean();

    res.json({ history });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ================= OPERATION LOGS (IMPORTS) =================
const listOperationLogs = async (req, res) => {
  try {
    const {
      status,
      search,
      operationType,
      page = 1,
      limit = 50,
      sortBy = "createdAt",
      sortDir = "desc",
      from,
      to,
      user,
      branch
    } = req.query;

    const q = {};
    if (status) q.status = status;
    if (operationType) q.operationType = operationType;
    if (user && mongoose.Types.ObjectId.isValid(user)) q.user = mongoose.Types.ObjectId(user);
    if (branch && mongoose.Types.ObjectId.isValid(branch)) q.branch = mongoose.Types.ObjectId(branch);

    if (from || to) {
      q.createdAt = {};
      if (from) q.createdAt.$gte = new Date(from);
      if (to) q.createdAt.$lte = new Date(to);
    }

    if (search) {
      const or = [];
      or.push({ operationType: { $regex: search, $options: "i" } });
      or.push({ error: { $regex: search, $options: "i" } });
      if (mongoose.Types.ObjectId.isValid(search)) {
        try {
          const oid = mongoose.Types.ObjectId(search);
          or.push({ _id: oid });
          or.push({ branch: oid });
          or.push({ business: oid });
          or.push({ user: oid });
        } catch (e) {
          // ignore
        }
      }
      q.$or = or;
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await OperationLog.countDocuments(q);

    // validate sortBy against allowed fields
    const allowedSort = ["createdAt", "status", "operationType"];
    const sortField = allowedSort.includes(sortBy) ? sortBy : "createdAt";
    const sortDirection = sortDir === "asc" ? 1 : -1;

    const logs = await OperationLog.find(q)
      .sort({ [sortField]: sortDirection })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    res.json({ total, page: Number(page), limit: Number(limit), logs });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const retryOperationLog = async (req, res) => {
  try {
    const id = req.params.id;
    const log = await OperationLog.findById(id);
    if (!log) return res.status(404).json({ message: "Operation log not found" });
    if (log.status !== "failed") return res.status(400).json({ message: "Only failed jobs can be retried" });

    // reset status and enqueue job
    log.status = "pending";
    log.error = undefined;
    log.metadata = {};
    await log.save();

    try {
      await importQueue.add({ jobId: id.toString(), businessId: log.business.toString(), branchId: log.branch?.toString(), userId: log.user?.toString() });
    } catch (err) {
      console.error("Retry enqueue failed; falling back to inline processing:", err.message || err);
      if (importQueue.addInline) {
        await importQueue.addInline({ jobId: id.toString(), businessId: log.business.toString(), branchId: log.branch?.toString(), userId: log.user?.toString() });
      }
    }

    res.json({ message: "Retry enqueued", jobId: id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getOperationLog = async (req, res) => {
  try {
    const id = req.params.id;
    const log = await OperationLog.findById(id).lean();
    if (!log) return res.status(404).json({ message: "Operation log not found" });
    res.json({ log });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const processAffiliatePayout = async (req, res) => {
  try {
    const affiliateId = req.params.id;
    const affiliate = await User.findById(affiliateId);
    if (!affiliate) return res.status(404).json({ message: "Affiliate not found" });

    const amount = Number(affiliate.walletBalance || 0);
    if (amount <= 0) return res.status(400).json({ message: "No balance to payout" });

    // Create payout request record marked as paid and create an affiliate payout history
    const payout = await PayoutRequest.create({
      affiliate: affiliate._id,
      affiliateCode: affiliate.affiliateCode || "",
      amountRequested: amount,
      status: "paid",
      processedAt: new Date()
    });

    await AffiliatePayout.create({
      affiliate: affiliate._id,
      affiliateCode: affiliate.affiliateCode || "",
      business: null,
      businessName: affiliate.name || "",
      amountPaid: amount,
      commissionEarned: amount,
      rateApplied: 0,
      status: "credited",
      transactionDate: new Date()
    });

    // Zero out wallet
    affiliate.walletBalance = 0;
    await affiliate.save();

    res.json({ message: "Payout cleared", amount, payoutId: payout._id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ================= PAYOUT REQUESTS =================
const listPayoutRequests = async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const q = {};
    if (status) q.status = status;

    const skip = (Number(page) - 1) * Number(limit);

    const total = await PayoutRequest.countDocuments(q);
    const requests = await PayoutRequest.find(q)
      .populate("affiliate", "name email phone address affiliateCode paymentDetails walletBalance bankName accountNumber accountName")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    res.json({ total, page: Number(page), limit: Number(limit), requests });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const settlePayoutRequest = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const payoutId = req.params.id;
    
    // Step 1: Fetch the payout request to validate and extract partnerId
    const payout = await PayoutRequest.findById(payoutId).session(session);
    if (!payout) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Payout request not found" });
    }

    if (payout.status !== "pending") {
      await session.abortTransaction();
      return res.status(400).json({ message: "Request already processed" });
    }

    // Step 2: Extract and preserve partnerId from the found document
    const partnerId = payout.partnerId || payout.affiliate;
    if (!partnerId) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Payout request missing partner reference" });
    }

    const amountRequested = Number(payout.amountRequested || 0);
    if (amountRequested <= 0) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Invalid payout amount" });
    }

    // Step 3: Find the Partner and validate balance
    const partner = await User.findById(partnerId).session(session);
    if (!partner) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Partner not found" });
    }

    if (Number(partner.walletBalance || 0) < amountRequested) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Insufficient wallet balance for this payout" });
    }

    // Step 4: Update PayoutRequest status using findByIdAndUpdate (safer than save)
    // This ensures partnerId is preserved and all required fields are maintained
    const updatedPayout = await PayoutRequest.findByIdAndUpdate(
      payoutId,
      {
        status: "approved",
        processedAt: new Date(),
        adminNote: req.body.note || ""
      },
      { session, new: true, runValidators: true }
    );

    if (!updatedPayout) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Failed to update payout request" });
    }

    // Step 5: Deduct from partner wallet balance
    await User.findByIdAndUpdate(
      partnerId,
      { $inc: { walletBalance: -amountRequested } },
      { session }
    );

    // Step 6: Create WithdrawalHistory record
    await WithdrawalHistory.create([
      {
        partnerId: partnerId,
        payoutRequestId: payout._id,
        amount: amountRequested,
        status: "Approved",
        note: req.body.note || "",
        date: new Date()
      }
    ], { session });

    // Step 7: Create notification for partner
    await Notification.create([
      {
        recipient: partnerId,
        type: "payout_approved",
        title: "Withdrawal Approved",
        message: `Your withdrawal request of ₦${amountRequested.toLocaleString()} has been approved and sent to your bank account.`,
        amount: amountRequested,
        payoutRequestId: payout._id,
        actionUrl: "/partners/dashboard"
      }
    ], { session });

    await session.commitTransaction();

    res.json({ message: "Payout settled successfully", payout: updatedPayout });
  } catch (err) {
    await session.abortTransaction();
    console.error("SETTLE PAYOUT ERROR:", err);
    res.status(500).json({ message: err.message });
  } finally {
    session.endSession();
  }
};

const rejectPayoutRequest = async (req, res) => {
  try {
    const id = req.params.id;
    const payout = await PayoutRequest.findById(id);
    if (!payout) return res.status(404).json({ message: "Payout request not found" });
    if (payout.status !== "pending") return res.status(400).json({ message: "Request already processed" });

    payout.status = "rejected";
    payout.processedAt = new Date();
    payout.adminNote = req.body.note || "Rejected by admin";
    await payout.save();

    await WithdrawalHistory.create({
      partnerId: payout.partnerId || payout.affiliate,
      payoutRequestId: payout._id,
      amount: Number(payout.amountRequested || 0),
      status: "Rejected",
      note: payout.adminNote,
      date: new Date()
    });

    await Notification.create({
      recipient: payout.partnerId || payout.affiliate,
      type: "payout_rejected",
      title: "Withdrawal Rejected",
      message: `Your withdrawal request of ₦${Number(payout.amountRequested || 0).toLocaleString()} was rejected. ${payout.adminNote}`,
      amount: Number(payout.amountRequested || 0),
      payoutRequestId: payout._id,
      actionUrl: "/partners/dashboard"
    });

    res.json({ message: "Payout rejected", payout });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const approvePayoutRequest = async (req, res) => {
  try {
    const id = req.params.id;
    const payout = await PayoutRequest.findById(id);
    if (!payout) return res.status(404).json({ message: "Payout request not found" });
    if (payout.status !== "pending") return res.status(400).json({ message: "Request already processed" });

    // mark paid
    payout.status = "paid";
    payout.processedAt = new Date();
    payout.adminNote = req.body.note || "";
    await payout.save();

    // create affiliate payout record for history
    const affiliate = await User.findById(payout.affiliate);

    await AffiliatePayout.create({
      affiliate: payout.affiliate,
      affiliateCode: payout.affiliateCode || affiliate?.affiliateCode || "",
      business: null,
      businessName: affiliate?.name || "",
      amountPaid: payout.amountRequested,
      commissionEarned: payout.amountRequested,
      rateApplied: 0,
      status: "credited",
      transactionDate: new Date()
    });

    // Create notification for partner
    await Notification.create({
      recipient: payout.affiliate,
      type: "payout_approved",
      title: "Payout Request Approved",
      message: `Your payout request of ₦${payout.amountRequested.toLocaleString()} has been approved and will be processed to your bank account (${affiliate?.paymentDetails?.bankName || "Your Bank"}).`,
      amount: payout.amountRequested,
      payoutRequestId: payout._id,
      actionUrl: "/partners/dashboard"
    });

    res.json({ message: "Payout approved" , payout });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 🔥 PARTNERS LEDGER WITH FULL PROFILE DETAILS
const getPartnersLedger = async (req, res) => {
  try {
    const { page = 1, limit = 50, search = "" } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    // Build search query
    const searchQuery = search ? {
      $or: [
        { "affiliate.name": { $regex: search, $options: "i" } },
        { "affiliate.email": { $regex: search, $options: "i" } },
        { "affiliate.phone": { $regex: search, $options: "i" } },
        { "affiliate.affiliateCode": { $regex: search, $options: "i" } }
      ]
    } : {};

    // Use aggregation to populate and get all affiliate details
    const ledger = await AffiliatePayout.aggregate([
      {
        $lookup: {
          from: "users",
          localField: "affiliate",
          foreignField: "_id",
          as: "affiliateData"
        }
      },
      { $unwind: { path: "$affiliateData", preserveNullAndEmptyArrays: true } },
      {
        $match: searchQuery
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $skip: skip
      },
      {
        $limit: Number(limit)
      },
      {
        $project: {
          _id: 1,
          affiliate: "$affiliateData._id",
          affiliateCode: 1,
          name: "$affiliateData.name",
          email: "$affiliateData.email",
          phone: { $ifNull: ["$affiliateData.phoneNumber", "$affiliateData.phone"] },
          address: "$affiliateData.address",
          walletBalance: "$affiliateData.walletBalance",
          totalEarned: "$affiliateData.totalEarned",
          bankName: { $ifNull: ["$affiliateData.bankName", "$affiliateData.paymentDetails.bankName"] },
          accountNumber: { $ifNull: ["$affiliateData.accountNumber", "$affiliateData.paymentDetails.accountNumber"] },
          accountName: { $ifNull: ["$affiliateData.accountName", "$affiliateData.paymentDetails.accountName"] },
          amountPaid: 1,
          commissionEarned: 1,
          status: 1,
          transactionDate: 1,
          createdAt: 1
        }
      }
    ]);

    const total = await AffiliatePayout.countDocuments();

    res.json({
      total,
      page: Number(page),
      limit: Number(limit),
      ledger
    });
  } catch (err) {
    console.error("GET PARTNERS LEDGER ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

// 🔥 SETTLE BALANCE - ATOMIC TRANSACTION
const settleBalance = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { affiliateId, amount, note } = req.body;

    if (!affiliateId || !amount || amount <= 0) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Invalid affiliate ID or amount" });
    }

    const affiliate = await User.findById(affiliateId).session(session);
    if (!affiliate) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Affiliate not found" });
    }

    if (Number(affiliate.walletBalance || 0) < Number(amount)) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Insufficient wallet balance" });
    }

    const settledAmount = Number(amount);

    await User.findByIdAndUpdate(
      affiliateId,
      { $inc: { walletBalance: -settledAmount } },
      { session }
    );

    await AffiliatePayout.create(
      [{
        affiliate: affiliateId,
        affiliateCode: affiliate.affiliateCode || "",
        businessName: affiliate.name || "Settlement",
        amountPaid: settledAmount,
        commissionEarned: settledAmount,
        rateApplied: 0,
        status: "settled",
        transactionDate: new Date()
      }],
      { session }
    );

    await PayoutHistory.create([
      {
        partnerId: affiliateId,
        amount: settledAmount,
        status: "Paid",
        date: new Date(),
        note: note || ""
      }
    ], { session });

    const settings = await SystemSettings.findOne({}).session(session);
    if (settings) {
      settings.globalAffiliateRate = Number(settings.globalAffiliateRate ?? 20);
      await settings.save({ session });
    }

    await SystemSettings.findOneAndUpdate(
      {},
      { $inc: { totalCommissionsCleared: settledAmount } },
      { session, upsert: true, new: true }
    );

    await Notification.create(
      [{
        recipient: affiliateId,
        type: "payout_settled",
        title: "Payout Processed Successfully",
        message: `Your payout of ₦${settledAmount.toLocaleString()} has been approved and processed to your bank account (${affiliate.paymentDetails?.bankName || "Your Bank"}). ${note ? `Note: ${note}` : ""}`,
        amount: settledAmount,
        actionUrl: "/partners/dashboard"
      }],
      { session }
    );

    await session.commitTransaction();

    res.json({
      message: "Balance settled successfully",
      affiliate: {
        name: affiliate.name,
        email: affiliate.email,
        newWalletBalance: Number(affiliate.walletBalance || 0) - settledAmount,
        settledAmount
      }
    });

  } catch (err) {
    await session.abortTransaction();
    console.error("SETTLE BALANCE ERROR:", err);
    res.status(500).json({ message: err.message });
  } finally {
    session.endSession();
  }
};

// 🔥 BUSINESS DETAILS (FINAL FIX — NO MORE 500)
const getBusinessDetails = async (req, res) => {
  try {
    const businessId = req.params.id;

    const business = await Business.findById(businessId);

    if (!business) {
      return res.status(404).json({
        message: "Business not found"
      });
    }

    const products = await Product.find({ business: businessId })
      .select("name price stock createdAt") // ✅ FIXED
      .sort({ createdAt: -1 });

    const sales = await Sale.find({ business: businessId })
      .select("totalAmount createdAt")
      .sort({ createdAt: -1 })
      .limit(20);

    const users = await User.find({ business: businessId })
      .select("name email role createdAt");

    res.json({
      business: formatBusiness(business),
      products: products || [],
      sales: sales || [],
      users: users || []
    });

  } catch (err) {
    console.error("🔥 ADMIN BUSINESS ERROR:", err);
    res.status(500).json({
      message: "Failed to load business"
    });
  }
};

export default {
  getOverview,
  updateSubscription,
  getBusinessDetails,
  getAffiliateSettings,
  updateAffiliateSettings
  ,
  // business controls
  suspendBusiness,
  unsuspendBusiness,
  deleteBusiness,
  archiveBusiness,
  unarchiveBusiness,
  updateAdminContact,
  // affiliates
  listAffiliates,
  getPartnerPayoutHistory,
  getWithdrawalHistory,
  processAffiliatePayout,
  // payouts
  listPayoutRequests,
  settlePayoutRequest,
  approvePayoutRequest,
  rejectPayoutRequest,
  // ledger and settlement
  getPartnersLedger,
  settleBalance,
  // operation logs
  listOperationLogs,
  retryOperationLog,
  getOperationLog
};
