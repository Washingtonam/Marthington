import request from "./client.js";

export const getInvoices = (params = {}) => {
  const query = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");

  return request(`/invoices${query ? `?${query}` : ""}`);
};

export const createInvoice = (data) =>
  request("/invoices", {
    method: "POST",
    body: JSON.stringify(data)
  });

export const getInvoice = (id) =>
  request(`/invoices/${id}`);

export const updateInvoicePayment = (invoiceId, paymentAmount, paymentMethod = "cash", referenceNumber = "", notes = "") =>
  request(`/invoices/${invoiceId}/payment`, {
    method: "PUT",
    body: JSON.stringify({ paymentAmount, paymentMethod, referenceNumber, notes })
  });

export const updateInvoice = (invoiceId, data) =>
  request(`/invoices/${invoiceId}`, {
    method: "PUT",
    body: JSON.stringify(data)
  });

export const deleteInvoice = (invoiceId) =>
  request(`/invoices/${invoiceId}`, {
    method: "DELETE"
  });

export const shareInvoice = (invoiceId, recipientEmail, message = "") =>
  request(`/invoices/${invoiceId}/share`, {
    method: "POST",
    body: JSON.stringify({ recipientEmail, message })
  });

export const getInvoiceEmailHistory = (invoiceId) =>
  request(`/invoices/${invoiceId}/email-history`);