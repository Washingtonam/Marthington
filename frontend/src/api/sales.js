import request from "./client";

export const updateSaleStatus = async (id, status) => request(`/sales/${id}/status`, {
  method: "PATCH",
  body: JSON.stringify({ status }),
});

export const bulkUpdateSaleStatus = async (saleIds, status) => request(`/sales/bulk-status`, {
  method: "PATCH",
  body: JSON.stringify({ saleIds, status }),
});
