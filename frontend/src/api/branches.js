import request from "./client.js";

export const getBranches = async () => {
  return request("/branches");
};

export const createBranch = async (payload) => {
  return request("/branches", {
    method: "POST",
    body: JSON.stringify(payload)
  });
};

export const updateBranch = async (branchId, payload) => {
  return request(`/branches/${branchId}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
};

export const deleteBranch = async (branchId) => {
  return request(`/branches/${branchId}`, {
    method: "DELETE"
  });
};

export const getBranchInventory = async (branchId) => {
  return request(`/branches/inventory?branchId=${encodeURIComponent(branchId)}`);
};

export const importBranchInventory = async ({ branchId, sourceType = "headOffice", sourceBranchId } = {}) => {
  return request("/branches/inventory/import", {
    method: "POST",
    body: JSON.stringify({ branchId, sourceType, sourceBranchId })
  });
};

export const updateBranchInventory = async ({ branchId, productId, quantity, branchPrice }) => {
  return request("/branches/inventory", {
    method: "PUT",
    body: JSON.stringify({ branchId, productId, quantity, branchPrice })
  });
};

export const getImportStatus = async (jobId) => {
  return request(`/branches/inventory/import/${jobId}`);
};
