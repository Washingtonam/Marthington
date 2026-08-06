import request from "./client.js";

export const getPayoutRequests = async (query = "") => {
  const q = query ? `?${query}` : "";
  return request(`/admin/payout-requests${q}`);
};

export const approvePayout = async (id, payload = {}) => {
  return request(`/admin/payout-requests/${id}/approve`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
};

export const rejectPayout = async (id, payload = {}) => {
  return request(`/admin/payout-requests/${id}/reject`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
};

export const getAffiliateLedgerOverview = async (query = "") => {
  const q = query ? `?${query}` : "";
  return request(`/admin/affiliates${q}`);
};

export const getAffiliateSettings = async () => request(`/admin/affiliate-settings`);

export const updateAffiliateSettings = async (payload) => request(`/admin/affiliate-settings`, {
  method: "PUT",
  body: JSON.stringify(payload)
});

export const getPartnersLedger = async (query = "") => {
  const q = query ? `?${query}` : "";
  return request(`/admin/partners-ledger${q}`);
};

export const getPartnerPayoutHistory = async (id) => request(`/admin/affiliates/${id}/payout-history`);

export const getWithdrawalHistory = async () => request(`/admin/withdrawal-history`);

export const getOperationLogs = async (query = "") => {
  const q = query ? `?${query}` : "";
  return request(`/admin/operation-logs${q}`);
};

export const retryOperationLog = async (id) => {
  return request(`/admin/operation-logs/${id}/retry`, {
    method: "POST"
  });
};

export const getOperationLog = async (id) => {
  return request(`/admin/operation-logs/${id}`);
};

export const getPendingPayoutRequests = async () => request(`/admin/payout-requests?status=pending`);

export const settlePayoutRequest = async (id, payload = {}) => request(`/admin/payouts/${id}/settle`, {
  method: "POST",
  body: JSON.stringify(payload)
});

export const rejectPayoutRequest = async (id, payload = {}) => request(`/admin/payout-requests/${id}/reject`, {
  method: "PUT",
  body: JSON.stringify(payload)
});

export const settleBalance = async (payload) => {
  return request(`/admin/settle-payout`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
};

export default {
  getPayoutRequests,
  approvePayout,
  rejectPayout,
  getAffiliateLedgerOverview,
  getAffiliateSettings,
  updateAffiliateSettings,
  getPartnersLedger,
  getPartnerPayoutHistory,
  settleBalance
};
