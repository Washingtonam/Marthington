const checkPermission = (permission) => {
  return (req, res, next) => {
    try {
      // 🔥 SUPER ADMIN FULL ACCESS
      if (req.user.role === "super_admin") {
        return next();
      }

      // 🔥 OWNER FULL ACCESS
      if (req.user.role === "owner") {
        return next();
      }

      const permissions = req.user.permissions || {};

      const branchScopedPosAccess =
        (permission === "canViewBranches" || permission === "canViewBranchInventory") &&
        permissions.canAccessPOS === true;

      if (!permissions[permission] && !branchScopedPosAccess) {
        return res.status(403).json({
          message: "Permission denied"
        });
      }

      next();

    } catch (err) {
      return res.status(500).json({
        message: "Permission check failed"
      });
    }
  };
};

export default checkPermission;