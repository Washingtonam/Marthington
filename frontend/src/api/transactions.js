import request from "./client";

export const getLedgerEntries = async (query = {}) => {
  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.append(key, value);
    }
  });

  const suffix = params.toString() ? `?${params.toString()}` : "";
  return request(`/transactions/ledger${suffix}`);
};

export const getRevenueStats = async () => request("/transactions/revenue-stats");
export const getProfitReports = async () => request("/transactions/profit-reports");
