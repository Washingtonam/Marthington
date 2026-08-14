import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiMail, FiPackage, FiPhone, FiPlus, FiSearch, FiTruck, FiBox } from "react-icons/fi";
import { createSupplier, getSuppliers, updateSupplier } from "../api/suppliers.js";
import { formatCurrency } from "../utils/formatters.js";
import RecordReceiptModal from "../components/RecordReceiptModal.jsx";

const emptyForm = () => ({
  name: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
  isActive: true
});

const Suppliers = () => {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [form, setForm] = useState(emptyForm());

  const loadSuppliers = async () => {
    try {
      const data = await getSuppliers();
      setSuppliers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load suppliers:", err);
      setSuppliers([]);
    }
  };

  useEffect(() => {
    loadSuppliers();
  }, []);

  const filteredSuppliers = useMemo(() => {
    const query = search.toLowerCase();

    return suppliers.filter((supplier) => {
      const matchQuery =
        !query ||
        [supplier.name, supplier.phone, supplier.email, supplier.address]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));

      if (!matchQuery) return false;

      if (filter === "active") return supplier.isActive !== false;
      if (filter === "inactive") return supplier.isActive === false;
      if (filter === "owing") return Number(supplier.outstandingBalance || 0) > 0;
      return true;
    });
  }, [suppliers, filter, search]);

  const summary = useMemo(() => {
    const totalSuppliers = suppliers.length;
    const activeSuppliers = suppliers.filter((supplier) => supplier.isActive !== false).length;
    const outstandingBalance = suppliers.reduce((sum, supplier) => sum + Number(supplier.outstandingBalance || 0), 0);
    const totalPurchases = suppliers.reduce((sum, supplier) => sum + Number(supplier.totalPurchases || 0), 0);

    return { totalSuppliers, activeSuppliers, outstandingBalance, totalPurchases };
  }, [suppliers]);

  const openCreateDrawer = () => {
    setEditingSupplier(null);
    setForm(emptyForm());
    setDrawerOpen(true);
  };

  const openEditDrawer = (supplier) => {
    setEditingSupplier(supplier);
    setForm({
      name: supplier.name || "",
      phone: supplier.phone || "",
      email: supplier.email || "",
      address: supplier.address || "",
      notes: supplier.notes || "",
      isActive: supplier.isActive !== false
    });
    setDrawerOpen(true);
  };

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const trimmedName = form.name.trim();
    if (!trimmedName) {
      alert("Supplier name is required.");
      return;
    }

    try {
      const payload = {
        name: trimmedName,
        phone: form.phone.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
        notes: form.notes.trim(),
        isActive: form.isActive
      };

      if (editingSupplier) {
        await updateSupplier(editingSupplier._id, payload);
      } else {
        await createSupplier(payload);
      }

      setDrawerOpen(false);
      setEditingSupplier(null);
      setForm(emptyForm());
      await loadSuppliers();
    } catch (err) {
      console.error("Failed to save supplier:", err);
      alert(err.message || "Failed to save supplier");
    }
  };

  return (
    <section className="mx-auto max-w-7xl space-y-6">
      <div className="rounded-[32px] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-emerald-50 p-5 shadow-sm sm:p-6 dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950/20">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-emerald-600 dark:text-emerald-400">Procurement</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Suppliers</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Manage vendors, purchase activity, and incoming stock relationships in one place.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => setReceiptModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-600 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-600 shadow-sm transition-all duration-150 hover:bg-emerald-50 active:scale-[0.99] dark:border-emerald-500 dark:bg-emerald-950/20 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
            >
              <FiBox className="h-4 w-4" />
              Record Receipt
            </button>
            <button
              type="button"
              onClick={openCreateDrawer}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-emerald-700 active:scale-[0.99]"
            >
              <FiPlus />
              Add Supplier
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total suppliers", value: summary.totalSuppliers, icon: FiTruck },
          { label: "Active suppliers", value: summary.activeSuppliers, icon: FiPackage },
          { label: "Outstanding payable", value: formatCurrency(summary.outstandingBalance), icon: FiPhone },
          { label: "Total purchases", value: formatCurrency(summary.totalPurchases), icon: FiMail }
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <Icon />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{card.label}</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{card.value}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1">
            <label className="sr-only" htmlFor="supplier-search">Search suppliers</label>
            <div className="relative">
              <FiSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="supplier-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name, phone, or email"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm outline-none transition-all duration-150 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { key: "all", label: "All" },
              { key: "active", label: "Active" },
              { key: "inactive", label: "Inactive" },
              { key: "owing", label: "Owing" }
            ].map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setFilter(option.key)}
                className={`rounded-full px-3 py-2 text-sm font-medium transition-all duration-150 active:scale-[0.99] ${
                  filter === option.key
                    ? "bg-emerald-600 text-white"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                <th className="pb-3">Supplier</th>
                <th className="pb-3">Contact</th>
                <th className="pb-3">Purchases</th>
                <th className="pb-3">Payable</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredSuppliers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                    No suppliers match this view yet.
                  </td>
                </tr>
              ) : (
                filteredSuppliers.map((supplier) => (
                  <tr key={supplier._id} className="text-sm text-slate-700 dark:text-slate-300">
                    <td className="py-4 pr-4">
                      <button
                        type="button"
                        onClick={() => navigate(`/app/suppliers/${supplier._id}`)}
                        className="text-left font-semibold text-slate-900 hover:text-emerald-600 dark:text-slate-100"
                      >
                        {supplier.name}
                      </button>
                    </td>
                    <td className="py-4 pr-4">
                      <div className="space-y-1">
                        {supplier.phone ? <p>{supplier.phone}</p> : null}
                        {supplier.email ? <p>{supplier.email}</p> : null}
                        {!supplier.phone && !supplier.email ? <p className="text-slate-400">No contact</p> : null}
                      </div>
                    </td>
                    <td className="py-4 pr-4">{formatCurrency(Number(supplier.totalPurchases || 0))}</td>
                    <td className="py-4 pr-4">{formatCurrency(Number(supplier.outstandingBalance || 0))}</td>
                    <td className="py-4 pr-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${supplier.isActive === false ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"}`}>
                        {supplier.isActive === false ? "Inactive" : "Active"}
                      </span>
                    </td>
                    <td className="py-4 pr-4">
                      <button
                        type="button"
                        onClick={() => openEditDrawer(supplier)}
                        className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-xl rounded-[28px] border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                {editingSupplier ? "Edit supplier" : "Add supplier"}
              </h2>
              <button type="button" onClick={() => setDrawerOpen(false)} className="text-sm text-slate-500">Close</button>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Supplier name</label>
                <input name="name" value={form.name} onChange={handleChange} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:bg-white dark:border-slate-700 dark:bg-slate-950" required />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Phone</label>
                  <input name="phone" value={form.phone} onChange={handleChange} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:bg-white dark:border-slate-700 dark:bg-slate-950" />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Email</label>
                  <input name="email" type="email" value={form.email} onChange={handleChange} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:bg-white dark:border-slate-700 dark:bg-slate-950" />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Address</label>
                <input name="address" value={form.address} onChange={handleChange} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:bg-white dark:border-slate-700 dark:bg-slate-950" />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Notes</label>
                <textarea name="notes" value={form.notes} onChange={handleChange} rows="4" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:bg-white dark:border-slate-700 dark:bg-slate-950" />
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <input type="checkbox" name="isActive" checked={form.isActive} onChange={handleChange} />
                Active supplier
              </label>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setDrawerOpen(false)} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">Cancel</button>
                <button type="submit" className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">{editingSupplier ? "Save changes" : "Create supplier"}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <RecordReceiptModal
        isOpen={receiptModalOpen}
        onClose={() => setReceiptModalOpen(false)}
        onSuccess={() => loadSuppliers()}
      />
    </section>
  );
};

export default Suppliers;
