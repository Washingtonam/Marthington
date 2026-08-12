export const canDeleteSale = (user = {}) => {
  const role = user?.role;
  return role === 'owner' || role === 'super_admin';
};

export const canRestoreSale = (user = {}) => canDeleteSale(user);

export const buildSalesQuery = ({ businessId, isSuperAdmin = false, includeDeleted = false, canAccessDeleted = false } = {}) => {
  const query = {};

  if (!isSuperAdmin) {
    query.business = businessId;
  }

  if (includeDeleted) {
    if (!canAccessDeleted) {
      return { ...query, isDeleted: { $ne: true } };
    }
    return { ...query, isDeleted: true };
  }

  return { ...query, isDeleted: { $ne: true } };
};
