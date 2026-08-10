import { useEffect, useState, useRef } from "react";
import request from "../api/client.js";
import { getBranches } from "../api/branches.js";
import "../styles.css";
import { FiEye, FiEyeOff } from 'react-icons/fi';

const initialForm = {
  name: "",
  email: "",
  password: "",
  role: "staff",
  branch: "",
  permissions: {
    canViewDashboard: false,
    canManageProducts: false,
    canViewProducts: true,
    canMakeSale: true,
    canViewSales: true,
    canViewReports: false,
    canOverridePrice: false,
    canManageStaff: false,
    canManageSettings: false,
    canViewBranches: false,
    canManageBranches: false,
    canViewBranchInventory: false,
    canManageBranchInventory: false,
    canViewCustomers: false,
    canManageCustomers: false,
    canViewInvoices: false,
    canManageInvoices: false,
    canViewExpenses: false,
    canManageExpenses: false,
    canViewPayments: false,
    canManagePayments: false,
    canAccessPOS: true,
    canApplyDiscounts: false,
    canProcessReturns: false,
    canViewSalesReports: false,
    canViewFinancialReports: false,
    canViewStaffReports: false,
    canInviteStaff: false,
    canEditStaffPermissions: false,
    canDeactivateStaff: false,
    canManageBilling: false,
    canManageBusinessProfile: false,
    canManageIntegrations: false
  }
};

const permissionLabels = {
  canViewDashboard: {
    label: "View dashboard",
    description: "Allow access to the main business dashboard overview."
  },
  canManageProducts: {
    label: "Manage products & services",
    description: "Create, edit, and delete products or services."
  },
  canViewProducts: {
    label: "View products & services",
    description: "See products and services inside the POS catalog."
  },
  canMakeSale: {
    label: "Create sales",
    description: "Process sales and complete checkout in POS."
  },
  canViewSales: {
    label: "View sales records",
    description: "Access invoices, orders, and sales history."
  },
  canViewReports: {
    label: "View reports",
    description: "Open analytics, revenue, and profit reports."
  },
  canOverridePrice: {
    label: "Override prices",
    description: "Allow price adjustments during checkout."
  },
  canManageStaff: {
    label: "Manage staff",
    description: "Create, update, and remove staff accounts."
  },
  canManageSettings: {
    label: "Manage settings",
    description: "Change business settings, billing, and integrations."
  },
  canViewBranches: {
    label: "View branches",
    description: "See branch listings and branch details."
  },
  canManageBranches: {
    label: "Manage branches",
    description: "Create, update, and delete branch locations."
  },
  canViewBranchInventory: {
    label: "View branch inventory",
    description: "See inventory quantities for branch locations."
  },
  canManageBranchInventory: {
    label: "Manage branch inventory",
    description: "Import and edit branch-specific inventory and pricing."
  },
  canViewCustomers: {
    label: "View customers",
    description: "See customer records and order history."
  },
  canManageCustomers: {
    label: "Manage customers",
    description: "Create and update customer records."
  },
  canViewInvoices: {
    label: "View invoices",
    description: "See invoices and sales receipts."
  },
  canManageInvoices: {
    label: "Manage invoices",
    description: "Create, update, and delete invoices."
  },
  canViewExpenses: {
    label: "View expenses",
    description: "See expense records and reports."
  },
  canManageExpenses: {
    label: "Manage expenses",
    description: "Create, update, and delete expense entries."
  },
  canViewPayments: {
    label: "View payments",
    description: "See payment records and transaction details."
  },
  canManagePayments: {
    label: "Manage payments",
    description: "Process and reconcile payment transactions."
  },
  canAccessPOS: {
    label: "Access POS",
    description: "Open and use the POS interface."
  },
  canApplyDiscounts: {
    label: "Apply discounts",
    description: "Allow discount or promotion application during checkout."
  },
  canProcessReturns: {
    label: "Process returns",
    description: "Handle returned items and refunds in sales."
  },
  canViewSalesReports: {
    label: "View sales reports",
    description: "See detailed sales performance analytics."
  },
  canViewFinancialReports: {
    label: "View financial reports",
    description: "See financial performance and profit analytics."
  },
  canViewStaffReports: {
    label: "View staff reports",
    description: "See team performance and staff activity reports."
  },
  canInviteStaff: {
    label: "Invite staff",
    description: "Create new staff accounts and invite team members."
  },
  canEditStaffPermissions: {
    label: "Edit staff permissions",
    description: "Change staff permissions and role settings."
  },
  canDeactivateStaff: {
    label: "Deactivate staff",
    description: "Disable or remove staff accounts."
  },
  canManageBilling: {
    label: "Manage billing",
    description: "Change billing details and subscription plans."
  },
  canManageBusinessProfile: {
    label: "Manage business profile",
    description: "Edit business details and company profile."
  },
  canManageIntegrations: {
    label: "Manage integrations",
    description: "Configure external services and integrations."
  }
};

const rolePermissionPresets = {
  staff: {
    canViewDashboard: false,
    canManageProducts: false,
    canViewProducts: true,
    canMakeSale: true,
    canViewSales: true,
    canViewReports: false,
    canOverridePrice: false,
    canManageStaff: false,
    canManageSettings: false,
    canViewBranches: false,
    canManageBranches: false,
    canViewBranchInventory: false,
    canManageBranchInventory: false,
    canViewCustomers: false,
    canManageCustomers: false,
    canViewInvoices: false,
    canManageInvoices: false,
    canViewExpenses: false,
    canManageExpenses: false,
    canViewPayments: false,
    canManagePayments: false,
    canAccessPOS: true,
    canApplyDiscounts: false,
    canProcessReturns: false,
    canViewSalesReports: false,
    canViewFinancialReports: false,
    canViewStaffReports: false,
    canInviteStaff: false,
    canEditStaffPermissions: false,
    canDeactivateStaff: false,
    canManageBilling: false,
    canManageBusinessProfile: false,
    canManageIntegrations: false
  },
  cashier: {
    canViewDashboard: false,
    canManageProducts: false,
    canViewProducts: true,
    canMakeSale: true,
    canViewSales: true,
    canViewReports: false,
    canOverridePrice: false,
    canManageStaff: false,
    canManageSettings: false,
    canViewBranches: false,
    canManageBranches: false,
    canViewBranchInventory: false,
    canManageBranchInventory: false,
    canViewCustomers: true,
    canManageCustomers: false,
    canViewInvoices: false,
    canManageInvoices: false,
    canViewExpenses: false,
    canManageExpenses: false,
    canViewPayments: false,
    canManagePayments: false,
    canAccessPOS: true,
    canApplyDiscounts: false,
    canProcessReturns: false,
    canViewSalesReports: false,
    canViewFinancialReports: false,
    canViewStaffReports: false,
    canInviteStaff: false,
    canEditStaffPermissions: false,
    canDeactivateStaff: false,
    canManageBilling: false,
    canManageBusinessProfile: false,
    canManageIntegrations: false
  },
  manager: {
    canViewDashboard: true,
    canManageProducts: true,
    canViewProducts: true,
    canMakeSale: true,
    canViewSales: true,
    canViewReports: true,
    canOverridePrice: false,
    canManageStaff: true,
    canManageSettings: false,
    canViewBranches: true,
    canManageBranches: true,
    canViewBranchInventory: true,
    canManageBranchInventory: true,
    canViewCustomers: true,
    canManageCustomers: true,
    canViewInvoices: true,
    canManageInvoices: false,
    canViewExpenses: true,
    canManageExpenses: false,
    canViewPayments: true,
    canManagePayments: false,
    canAccessPOS: true,
    canApplyDiscounts: false,
    canProcessReturns: false,
    canViewSalesReports: true,
    canViewFinancialReports: true,
    canViewStaffReports: true,
    canInviteStaff: true,
    canEditStaffPermissions: true,
    canDeactivateStaff: true,
    canManageBilling: false,
    canManageBusinessProfile: false,
    canManageIntegrations: false
  }
};

const permissionGroups = {
  inventory: ["canManageProducts", "canViewProducts", "canViewBranches", "canManageBranches", "canViewBranchInventory", "canManageBranchInventory"],
  customers: ["canViewCustomers", "canManageCustomers"],
  finance: ["canViewInvoices", "canManageInvoices", "canViewExpenses", "canManageExpenses", "canViewPayments", "canManagePayments", "canViewFinancialReports"],
  pos: ["canAccessPOS", "canMakeSale", "canViewSales", "canApplyDiscounts", "canProcessReturns"],
  reports: ["canViewReports", "canViewSalesReports", "canViewStaffReports"],
  staff: ["canManageStaff", "canInviteStaff", "canEditStaffPermissions", "canDeactivateStaff"],
  settings: ["canManageSettings", "canManageBilling", "canManageBusinessProfile", "canManageIntegrations"]
};

const Staff = () => {
  const [staff, setStaff] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showDrawer, setShowDrawer] = useState(false);
  const [isDrawerMounted, setIsDrawerMounted] = useState(false);
  const [openGroup, setOpenGroup] = useState("inventory");
  const [showDetails, setShowDetails] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [branches, setBranches] = useState([]);
  const drawerRef = useRef(null);

  // =====================================
  // LOAD BRANCHES
  // =====================================
  useEffect(() => {
    const loadBranches = async () => {
      try {
        const data = await getBranches();
        setBranches(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to load branches", err);
      }
    };

    loadBranches();
  }, []);

  // =====================================
  // LOAD STAFF
  // =====================================
  useEffect(() => {
    const load = async () => {
      try {
        const data = await request("/staff");
        setStaff(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // =====================================
  // CHANGE
  // =====================================
  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "role" && !editingId) {
      setForm((prev) => ({
        ...prev,
        role: value,
        permissions: {
          ...rolePermissionPresets[value]
        }
      }));
      return;
    }

    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // =====================================
  // PERMISSIONS
  // =====================================
  const togglePermission = (permission) => {
    setForm((prev) => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [permission]: !prev.permissions[permission]
      }
    }));
  };

  const toggleShowDetail = (permission) => {
    setShowDetails((prev) => ({ ...prev, [permission]: !prev[permission] }));
  };

  // =====================================
  // SUBMIT
  // =====================================
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      setSaving(true);
      if (!editingId) {
        const res = await request("/staff", {
          method: "POST",
          body: JSON.stringify(form)
        });
        setStaff((prev) => [res.user, ...prev]);
      } else {
        const res = await request(`/staff/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(form)
        });
        setStaff((prev) => prev.map((u) => (u._id === editingId ? res.user : u)));
        setEditingId(null);
      }
      setForm(initialForm);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // =====================================
  // EDIT
  // =====================================
  const handleEdit = (user) => {
    setEditingId(user._id);
    setForm({
      name: user.name || "",
      email: user.email || "",
      password: "",
      role: user.role || "staff",
      branch: user.branch?._id || user.branch || "",
      permissions: user.permissions || initialForm.permissions
    });
    setShowDrawer(true);
  };

  // keep drawer mounted while animating close
  useEffect(() => {
    if (showDrawer) setIsDrawerMounted(true);
  }, [showDrawer]);

  useEffect(() => {
    if (!showDrawer && isDrawerMounted) {
      const t = setTimeout(() => setIsDrawerMounted(false), 300);
      return () => clearTimeout(t);
    }
  }, [showDrawer, isDrawerMounted]);

  const closeDrawer = () => setShowDrawer(false);

  // =====================================
  // DELETE
  // =====================================
  const handleDelete = async (id) => {
    const confirmed = window.confirm("Delete staff member?");
    if (!confirmed) return;
    try {
      await request(`/staff/${id}`, { method: "DELETE" });
      setStaff((prev) => prev.filter((u) => u._id !== id));
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <section className="products-layout single-column">
      {/* STAFF LIST */}
      <div className="w-full">
        <div className="page-heading flex items-center justify-between">
          <div>
            <span>Team Management</span>
            <h1>Staff Workspace</h1>
          </div>
          <div className="page-actions">
            <button onClick={() => { setShowDrawer(true); setEditingId(null); setForm(initialForm); }} className="add-team-btn">+ Add Team Member</button>
          </div>
        </div>

          <div className="product-table mt-4 w-full">
          <div className="product-row product-row-head table-header">
            <span>STAFF MEMBER</span>
            <span>ROLE</span>
            <span>BRANCH</span>
            <span>ACCOUNT STATUS</span>
            <span />
          </div>

          {loading && <div className="empty-state">Syncing team data...</div>}
          {!loading && !staff.length && <div className="empty-state">No staff found. Add your first team member!</div>}

          {staff.map((user) => (
            <div key={user._id} className="product-row staff-row">
              <span>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center font-semibold text-slate-700">{(user.name || "").split(" ").map(s=>s[0]).slice(0,2).join("")}</div>
                  <div>
                    <div className="font-semibold">{user.name}</div>
                    <div className="email-muted">{user.email}</div>
                  </div>
                </div>
              </span>
              <span>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${user.role === 'owner' ? 'bg-slate-800 text-white' : user.role === 'manager' ? 'bg-indigo-100 text-indigo-800' : user.role === 'cashier' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-800'}`}>{user.role}</span>
              </span>
              <span>
                <span className="text-sm text-slate-700">{user.branch?.name || user.branch || 'Head office'}</span>
              </span>
              <span>
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${user.isActive !== false ? 'bg-green-500' : 'bg-amber-400'}`} />
                  <span className="text-sm text-slate-700">{user.isActive !== false ? 'Active' : 'Pending'}</span>
                </div>
              </span>
              <span className="flex gap-4 items-center justify-end">
                <div className="relative">
                  <button aria-haspopup="menu" aria-expanded={openMenuId === user._id} onClick={() => setOpenMenuId(openMenuId === user._id ? null : user._id)} className="more-options-button">⋯</button>
                  {openMenuId === user._id && (
                    <div className="dropdown-menu">
                      <button onClick={() => { setOpenMenuId(null); handleEdit(user); }} className="dropdown-item">Edit</button>
                      <button onClick={() => { setOpenMenuId(null); handleDelete(user._id); }} className="dropdown-item danger">Remove</button>
                    </div>
                  )}
                </div>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* DRAWER: form slides in from right */}
      {isDrawerMounted && (
        <div className="fixed inset-0 z-50 flex">
          <div className={`absolute inset-0 bg-black/40 backdrop-blur-sm drawer-backdrop ${showDrawer ? 'open' : ''}`} onClick={closeDrawer} />
          <div ref={drawerRef} className={`ml-auto w-full max-w-md bg-white h-full shadow-2xl p-6 transform transition-transform drawer-panel ${showDrawer ? 'open' : ''}`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">{editingId ? 'Modify Staff' : 'New Team Member'}</h2>
              <button onClick={() => setShowDrawer(false)} className="text-gray-500">✕</button>
            </div>

            {error && <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm mb-4 border border-red-100">{error}</div>}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">Full name</label>
                <input className="input-field" name="name" value={form.name} onChange={handleChange} placeholder="John Doe" required />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">Email address</label>
                <input className="input-field" name="email" type="email" value={form.email} onChange={handleChange} required disabled={editingId} />
              </div>

              {!editingId && (
                <div className="space-y-1 relative">
                  <label className="text-sm font-semibold text-slate-700">Default password</label>
                    <div className="relative">
                    <input className="input-field pr-10" name="password" type={showPassword ? 'text' : 'password'} value={form.password} onChange={handleChange} required />
                    <button type="button" onClick={() => setShowPassword(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">{showPassword ? <FiEyeOff /> : <FiEye />}</button>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">Role preset</label>
                <select className="input-field capitalize" name="role" value={form.role} onChange={handleChange}>
                  <option value="staff">Staff</option>
                  <option value="cashier">Cashier</option>
                  <option value="manager">Manager</option>
                </select>
                <p className="text-xs text-slate-500">Choose a role preset to preload default permissions for this team member.</p>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">Assigned branch</label>
                <select className="input-field" name="branch" value={form.branch} onChange={handleChange}>
                  <option value="">Head office</option>
                  {branches.map((branch) => (
                    <option key={branch._id} value={branch._id}>{branch.name}</option>
                  ))}
                </select>
              </div>

              {/* Permissions grouped into accordions */}
              <div className="border border-gray-100 rounded-2xl p-4 bg-gray-50">
                <h3 className="font-bold text-sm text-gray-700 mb-3 flex items-center gap-2">🛡️ Security & Permissions</h3>

                {Object.keys(permissionGroups).map((groupKey) => (
                  <div key={groupKey} className="mb-3">
                    <button type="button" onClick={() => setOpenGroup(openGroup === groupKey ? '' : groupKey)} className="w-full flex items-center justify-between p-3 bg-white rounded-xl border">
                          <div className="text-sm font-semibold capitalize">
                            {groupKey === 'inventory' && 'Inventory Management'}
                            {groupKey === 'customers' && 'Customer Management'}
                            {groupKey === 'finance' && 'Finance'}
                            {groupKey === 'pos' && 'POS & Sales'}
                            {groupKey === 'reports' && 'Reports'}
                            {groupKey === 'staff' && 'Staff Management'}
                            {groupKey === 'settings' && 'Settings'}
                          </div>
                          <div className="text-xs text-gray-400">{openGroup === groupKey ? '−' : '+'}</div>
                    </button>
                    {openGroup === groupKey && (
                      <div className="mt-2 space-y-2">
                        {permissionGroups[groupKey].map((permission) => {
                          const meta = permissionLabels[permission];
                          return (
                            <div key={permission} className="flex items-start justify-between p-3 bg-white rounded-xl border">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <div className="text-sm font-semibold text-slate-800">{meta.label}</div>
                                  <div className="relative group">
                                    <button type="button" onClick={() => toggleShowDetail(permission)} className="text-xs text-gray-400">i</button>
                                    <div className="permission-tooltip hidden group-hover:block absolute right-0 top-6 w-64 z-50 p-2 bg-white border rounded shadow">{meta.description}</div>
                                  </div>
                                </div>
                                {showDetails[permission] && <div className="text-xs text-gray-500 mt-1">{meta.description}</div>}
                              </div>
                              <div>
                                <button type="button" onClick={() => togglePermission(permission)} className={`w-12 h-6 rounded-full p-1 ${form.permissions[permission] ? 'bg-slate-900' : 'bg-gray-200'}`}>
                                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${form.permissions[permission] ? 'translate-x-6' : ''}`} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <button type="submit" disabled={saving} className="w-full bg-black text-white py-3 rounded-2xl font-bold hover:bg-gray-800 transition-all shadow-lg active:scale-95 disabled:bg-gray-400">
                {saving ? "Saving..." : editingId ? "Update Account" : "Create Account"}
              </button>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};

export default Staff;