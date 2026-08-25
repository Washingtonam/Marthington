export const canDeleteSale = (user = {}) => {
  const role = user?.role;
  return role === 'owner' || role === 'super_admin';
};

export const canRestoreSale = (user = {}) => canDeleteSale(user);

export const PAYMENT_METHODS = Object.freeze(["cash", "card", "bank_transfer", "credit", "other"]);

export const normalizePaymentMethod = (value = "cash") => {
  const normalized = String(value).trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "transfer" || normalized === "banktransfer") return "bank_transfer";
  if (normalized === "debt" || normalized === "credit_sale") return "credit";
  return PAYMENT_METHODS.includes(normalized) ? normalized : "other";
};

export const isCreditPayment = (value) => normalizePaymentMethod(value) === "credit";

export const buildProductCompensationEntries = (sale = {}, { businessId, branchId = null, createdBy = null, type = 'return', notePrefix = 'Sale reversal' } = {}) => {
  if (!sale || !Array.isArray(sale.items)) {
    return [];
  }

  return sale.items
    .filter((item) => item.itemType === 'product' || !item.itemType)
    .map((item) => {
      const quantity = Number(item.quantity || 0);
      const productId = item.product;

      if (!productId || quantity <= 0) {
        return null;
      }

      return {
        business: businessId,
        ...(branchId ? { branch: branchId } : {}),
        product: productId,
        type,
        quantity,
        unitCost: Number(item.costPrice || 0),
        note: `${notePrefix} ${sale._id || sale.receiptId || 'sale'}`,
        createdBy
      };
    })
    .filter(Boolean);
};

export const buildSaleLedgerEntry = ({ sale, businessId, createdBy = null, status = 'reversed', notePrefix = 'Sale reversal' } = {}) => {
  const totalAmount = Number(sale?.totalAmount || 0);
  const saleId = sale?._id || null;
  const receiptId = sale?.receiptId || 'sale';

  const profit = Array.isArray(sale?.items)
    ? sale.items.reduce((sum, item) => {
        const sellingPrice = Number(item.sellingPrice || 0);
        const costPrice = Number(item.costPrice || 0);
        const quantity = Number(item.quantity || 0);

        return sum + (sellingPrice - costPrice) * quantity;
      }, 0)
    : 0;

  return {
    businessId,
    transactionType: 'income',
    category: 'sales',
    description: `${notePrefix} ${receiptId}`,
    amount: totalAmount,
    profit,
    accountName: 'Sales Revenue',
    postingType: 'credit',
    sourceModel: 'Sale',
    sourceId: saleId,
    branchId: sale?.branch || null,
    status,
    occurredAt: new Date(),
    createdBy,
    isDeleted: false
  };
};

export const buildSalesQuery = ({ businessId, isSuperAdmin = false, includeDeleted = false, canAccessDeleted = false } = {}) => {
  const query = {};

  if (!isSuperAdmin) {
    query.business = businessId;
  }

  if (includeDeleted) {
    if (!canAccessDeleted) {
      return { ...query, isDeleted: { $ne: true } };
    }
    return { ...query, isDeleted: true };
  }

  return { ...query, isDeleted: { $ne: true } };
};

export const getCustomerSaleImpact = ({ paymentMethod = 'cash', totalAmount = 0, action = 'delete' } = {}) => {
  const amount = Number(totalAmount || 0);
  const isDelete = action === 'delete';
  const isCredit = isCreditPayment(paymentMethod);

  return {
    totalSpentDelta: isDelete ? -amount : amount,
    totalOrdersDelta: isDelete ? -1 : 1,
    outstandingBalanceDelta: isCredit ? (isDelete ? -amount : amount) : 0
  };
};
