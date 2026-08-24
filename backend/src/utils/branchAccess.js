const isPrivileged = (user = {}) => user.role === "owner" || user.role === "super_admin";

const hasViewAccess = (user = {}, branchId) => {
  if (isPrivileged(user)) return true;

  const requestedBranchId = String(branchId || "");
  const assignedBranchId = String(user.branchId || "");
  const permissions = user.permissions || {};

  if (requestedBranchId === assignedBranchId) {
    return permissions.canViewBranchInventory === true || permissions.canManageBranchInventory === true;
  }

  return permissions.canViewAllBranchInventory === true || permissions.canManageAllBranchInventory === true;
};

const hasManageAccess = (user = {}, branchId) => {
  if (isPrivileged(user)) return true;

  const requestedBranchId = String(branchId || "");
  const assignedBranchId = String(user.branchId || "");
  const permissions = user.permissions || {};

  if (requestedBranchId === assignedBranchId) {
    return permissions.canManageBranchInventory === true;
  }

  return permissions.canManageAllBranchInventory === true;
};

export const canAccessBranch = (user = {}, branchId, action = "view") => {
  if (!branchId || branchId === "headOffice") return isPrivileged(user);
  return action === "manage" ? hasManageAccess(user, branchId) : hasViewAccess(user, branchId);
};

export const resolveBranchId = ({ user = {}, requestedBranchId } = {}) => {
  const requested = requestedBranchId?._id || requestedBranchId || null;

  if (isPrivileged(user)) return requested || null;
  if (!user.branchId) return null;
  if (!requested || String(requested) === String(user.branchId)) return String(user.branchId);

  if (hasViewAccess(user, requested)) return String(requested);
  return undefined;
};

export const resolveOperationalBranchId = ({ user = {}, requestedBranchId } = {}) => {
  const requested = requestedBranchId?._id || requestedBranchId || null;

  if (isPrivileged(user)) return requested;
  if (!user.branchId) return undefined;
  if (!requested || String(requested) === String(user.branchId)) return String(user.branchId);
  if (hasManageAccess(user, requested)) return String(requested);
  return undefined;
};

export const getScopedBranchQuery = (user = {}, businessId, requestedBranchId) => {
  if (isPrivileged(user) && !requestedBranchId) return { business: businessId };

  const branchId = resolveBranchId({ user, requestedBranchId });

  if (branchId === undefined) return null;
  return { business: businessId, branch: branchId };
};

export { isPrivileged };
