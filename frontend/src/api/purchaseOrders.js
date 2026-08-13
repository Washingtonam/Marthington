import request from "./client.js";

export const getPurchaseOrders = (params = {}) => {
  const query = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");

  return request(`/purchase-orders${query ? `?${query}` : ""}`);
};

export const createPurchaseOrder = (payload) =>
  request("/purchase-orders", {
    method: "POST",
    body: JSON.stringify(payload)
  });

export const updatePurchaseOrder = (id, payload) =>
  request(`/purchase-orders/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
