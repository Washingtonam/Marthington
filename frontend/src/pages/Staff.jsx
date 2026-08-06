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
    canManageSettings: false
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
  }
};

const permissionGroups = {
  inventory: ["canManageProducts", "canViewProducts"],
  financials: ["canMakeSale", "canViewSales", "canOverridePrice"],
  administration: ["canViewDashboard", "canViewReports", "canManageStaff", "canManageSettings"]
};

const Staff = () => {
  const [staff, setStaff] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showDrawer, setShowDrawer] = useState(false);
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
    <section className="products-layout">
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
      {showDrawer && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowDrawer(false)} />
          <div ref={drawerRef} className="ml-auto w-full max-w-md bg-white h-full shadow-2xl p-6 transform transition-transform">
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
                <label className="text-sm font-semibold text-slate-700">Designated role</label>
                <select className="input-field capitalize" name="role" value={form.role} onChange={handleChange}>
                  <option value="staff">Staff</option>
                  <option value="cashier">Cashier</option>
                  <option value="manager">Manager</option>
                </select>
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
                      <div className="text-sm font-semibold capitalize">{groupKey === 'inventory' ? 'Inventory Management' : groupKey === 'financials' ? 'Financials & POS' : 'Administration'}</div>
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