import request from "./client.js";

export const getSuppliers = () => request("/suppliers");

export const getSupplierById = (id) => request(`/suppliers/${id}`);

export const createSupplier = (payload) =>
  request("/suppliers", {
    method: "POST",
    body: JSON.stringify(payload)
  });

export const updateSupplier = (id, payload) =>
  request(`/suppliers/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });

export const deleteSupplier = (id) =>
  request(`/suppliers/${id}`, {
    method: "DELETE"
  });
