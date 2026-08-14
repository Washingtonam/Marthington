export const PURCHASE_ORDER_BUDGET_CONFIG = {
  LARGE_PURCHASE_THRESHOLD: 100000,
  APPROVAL_REQUIRED_ROLES: ["owner", "super_admin", "manager"],
  WARNING_MESSAGE: "Purchase exceeds the large-purchase approval threshold. Manager approval is required before this order can be finalized."
};

export const getPurchaseApprovalStatus = (totalAmount) => {
  const amount = Number(totalAmount || 0);
  const threshold = PURCHASE_ORDER_BUDGET_CONFIG.LARGE_PURCHASE_THRESHOLD;

  if (amount <= 0) {
    return {
      requiresApproval: false,
      threshold,
      reason: null,
      amount
    };
  }

  const requiresApproval = amount >= threshold;

  return {
    requiresApproval,
    threshold,
    amount,
    reason: requiresApproval ? PURCHASE_ORDER_BUDGET_CONFIG.WARNING_MESSAGE : null
  };
};

export default PURCHASE_ORDER_BUDGET_CONFIG;
