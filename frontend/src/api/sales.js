import request from "./client";

export const updateSaleStatus = async (id, status) => request(`/sales/${id}/status`, {
  method: "PATCH",
  body: JSON.stringify({ status }),
});
