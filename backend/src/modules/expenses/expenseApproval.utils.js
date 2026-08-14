export const shouldAutoApproveExpense = ({
  amount,
  category,
  supplierId,
  businessSettings = {}
}) => {
  const settings = {
    autoApproveEnabled: false,
    maxAutoApproveAmount: 0,
    exemptCategories: [],
    trustedSuppliers: [],
    ...businessSettings
  };

  const normalizedAmount = Number(amount) || 0;
  const normalizedCategory = category || "miscellaneous";
  const normalizedSupplier = supplierId || null;

  if (!settings.autoApproveEnabled) {
    return {
      shouldAutoApprove: false,
      status: "pending",
      reason: "Automatic approval is disabled for this business."
    };
  }

  if (settings.trustedSuppliers?.includes(normalizedSupplier)) {
    return {
      shouldAutoApprove: true,
      status: "approved",
      reason: "Expense auto-approved because the supplier is a trusted supplier."
    };
  }

  if (settings.exemptCategories?.includes(normalizedCategory)) {
    if (normalizedAmount <= Number(settings.maxAutoApproveAmount || 0)) {
      return {
        shouldAutoApprove: true,
        status: "approved",
        reason: "Expense auto-approved because the category is exempt and under the configured threshold."
      };
    }

    return {
      shouldAutoApprove: false,
      status: "pending",
      reason: "Expense exceeds the auto-approval limit for the exempt category."
    };
  }

  return {
    shouldAutoApprove: false,
    status: "pending",
    reason: "Expense is not exempt and no trusted supplier rule applies, so it stays pending."
  };
};

export const getAutoApprovalConfig = (businessSettings = {}) => ({
  autoApproveEnabled: Boolean(businessSettings.autoApproveEnabled),
  maxAutoApproveAmount: Number(businessSettings.maxAutoApproveAmount || 0),
  exemptCategories: Array.isArray(businessSettings.exemptCategories)
    ? businessSettings.exemptCategories
    : [],
  trustedSuppliers: Array.isArray(businessSettings.trustedSuppliers)
    ? businessSettings.trustedSuppliers
    : []
});
