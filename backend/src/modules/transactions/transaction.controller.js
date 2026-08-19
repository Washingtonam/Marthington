import Transaction from "./transaction.model.js";

const assertOwner = (req, res) => {
  if (req.user.role !== "owner") {
    res.status(403).json({ message: "Forbidden" });
    return false;
  }
  return true;
};

const getTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find({
      businessId: req.user.businessId,
      isDeleted: { $ne: true }
    })
      .sort({ createdAt: -1 })
      .lean();

    res.json(transactions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getRevenueStats = async (req, res) => {
  try {
    const query = {
      businessId: req.user.businessId,
      isDeleted: { $ne: true }
    };

    const transactions = await Transaction.find(query).lean();

    const totalRevenue = transactions
      .filter((tx) => tx.transactionType === "income")
      .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

    const totalExpenses = transactions
      .filter((tx) => tx.transactionType === "expense" && (!tx.postingType || tx.postingType === "debit"))
      .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

    const netRevenue = totalRevenue - totalExpenses;

    res.json({
      totalRevenue,
      totalExpenses,
      netRevenue,
      transactionCount: transactions.length
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getProfitReports = async (req, res) => {
  try {
    const query = {
      businessId: req.user.businessId,
      isDeleted: { $ne: true }
    };

    const transactions = await Transaction.find(query).lean();

    const totalProfit = transactions.reduce(
      (sum, tx) => sum + (Number(tx.profit) || 0),
      0
    );

    const profitByType = transactions.reduce((report, tx) => {
      const type = tx.transactionType || "other";
      report[type] = (report[type] || 0) + (Number(tx.profit) || 0);
      return report;
    }, {});

    res.json({
      totalProfit,
      profitByType,
      transactionCount: transactions.length
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteTransaction = async (req, res) => {
  try {
    if (!assertOwner(req, res)) return;

    const transaction = await Transaction.findOne({
      _id: req.params.id,
      businessId: req.user.businessId
    });

    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    if (transaction.isDeleted) {
      return res.status(400).json({ message: "Transaction already deleted" });
    }

    transaction.isDeleted = true;
    transaction.deletedAt = new Date();
    transaction.deletedBy = req.user.id;
    await transaction.save();

    res.json({ message: "Transaction deleted", transaction });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getDeletedRecords = async (req, res) => {
  try {
    if (!assertOwner(req, res)) return;

    const deletedTransactions = await Transaction.find({
      businessId: req.user.businessId,
      isDeleted: true
    })
      .sort({ deletedAt: -1 })
      .lean();

    res.json(deletedTransactions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getLedgerEntries = async (req, res) => {
  try {
    const { startDate, endDate, type } = req.query;
    const query = {
      businessId: req.user.businessId,
      isDeleted: { $ne: true }
    };

    if (startDate || endDate) {
      query.occurredAt = {};
      if (startDate) {
        query.occurredAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.occurredAt.$lte = end;
      }
    }

    if (type && type !== "all") {
      query.transactionType = type;
    }

    const entries = await Transaction.find(query)
      .sort({ occurredAt: -1, createdAt: -1 })
      .lean();

    const totalDebits = entries
      .filter((entry) => entry.postingType === "debit")
      .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);

    const totalCredits = entries
      .filter((entry) => entry.postingType === "credit")
      .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);

    const summary = {
      count: entries.length,
      totalDebits,
      totalCredits,
      net: totalCredits - totalDebits
    };

    res.json({ entries, summary });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export default {
  getTransactions,
  getRevenueStats,
  getProfitReports,
  deleteTransaction,
  getDeletedRecords,
  getLedgerEntries
};
