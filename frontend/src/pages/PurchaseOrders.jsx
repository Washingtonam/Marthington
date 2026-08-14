import { useEffect, useMemo, useState } from "react";
import { FiCheckCircle, FiClipboard, FiPlus, FiSearch, FiEdit2, FiTrash2, FiBox, FiAlertCircle, FiX } from "react-icons/fi";
import request from "../api/client.js";
import { formatCurrency } from "../utils/formatters.js";
import { getSuppliers } from "../api/suppliers.js";
import RecordReceiptModal from "../components/RecordReceiptModal.jsx";
import { getBranches } from "../api/branches.js";

const PAYMENT_TERMS = [
  { value: "immediate", label: "Immediate Payment" },
  { value: "net30", label: "Net 30 Days" },
  { value: "net60", label: "Net 60 Days" }
];

const PurchaseOrders = () => {
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState({ type: "", text: "" });
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingPO, setEditingPO] = useState(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [selectedPOForReceipt, setSelectedPOForReceipt] = useState(null);
  const [processing, setProcessing] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    supplier: "",
    items: [{ product: "", quantity: "", costPrice: "" }],
    destinationBranch: "",
    paymentTerms: "immediate",
    notes: ""
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [poData, supplierData, branchData, productData] = await Promise.all([
          request("/purchaseOrders"),
          getSuppliers(),
          getBranches(),
          request("/products")
        ]);

        setPurchaseOrders(Array.isArray(poData) ? poData : []);
        setSuppliers(Array.isArray(supplierData) ? supplierData : []);
        setBranches(Array.isArray(branchData) ? branchData : []);
        setProducts(Array.isArray(productData) ? productData : []);
      } catch (err) {
        setStatusMsg({ type: "error", text: "Failed to load data." });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const filteredPOs = useMemo(() => {
    let filtered = purchaseOrders;

    if (filterStatus !== "all") {
      filtered = filtered.filter(po => po.status === filterStatus);
    }

    if (selectedSupplier) {
      filtered = filtered.filter(po => po.supplier?._id === selectedSupplier);
    }

    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(po =>
        po.supplier?.name?.toLowerCase().includes(q) ||
        po._id?.toLowerCase().includes(q) ||
        po.notes?.toLowerCase().includes(q)
      );
    }

    return filtered;
  }, [purchaseOrders, filterStatus, selectedSupplier, search]);

  const metrics = useMemo(() => {
    const pending = purchaseOrders.filter(po => po.status === "pending").length;
    const partial = purchaseOrders.filter(po => po.status === "partial").length;
    const received = purchaseOrders.filter(po => po.status === "received").length;
    const cancelled = purchaseOrders.filter(po => po.status === "cancelled").length;
    const totalValue = purchaseOrders.reduce((sum, po) => sum + (Number(po.totalAmount) || 0), 0);
    const outstandingValue = purchaseOrders
      .filter(po => po.status !== "received" && po.status !== "cancelled")
      .reduce((sum, po) => sum + (Number(po.totalAmount) || 0), 0);

    return { pending, partial, received, cancelled, totalValue, outstandingValue };
  }, [purchaseOrders]);

  const handleAddItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { product: "", quantity: "", costPrice: "" }]
    }));
  };

  const handleRemoveItem = (index) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;

    // Auto-calculate total if quantity and costPrice are set
    if (field === "quantity" || field === "costPrice") {
      const qty = Number(newItems[index].quantity) || 0;
      const price = Number(newItems[index].costPrice) || 0;
      newItems[index].total = qty * price;
    }

    setFormData(prev => ({ ...prev, items: newItems }));
  };

  const handleCreatePO = async (e) => {
    e.preventDefault();

    try {
      setProcessing(true);

      if (!formData.supplier) {
        setStatusMsg({ type: "error", text: "Please select a supplier" });
        return;
      }

      const validItems = formData.items.filter(item => item.product && item.quantity && item.costPrice);
      if (validItems.length === 0) {
        setStatusMsg({ type: "error", text: "Please add at least one item" });
        return;
      }

      const payload = {
        supplier: formData.supplier,
        items: validItems.map(item => ({
          product: item.product,
          quantity: Number(item.quantity),
          costPrice: Number(item.costPrice),
          total: Number(item.quantity) * Number(item.costPrice)
        })),
        destinationBranch: formData.destinationBranch || null,
        paymentTerms: formData.paymentTerms,
        notes: formData.notes
      };

      if (editingPO) {
        await request(`/purchaseOrders/${editingPO._id}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
        setStatusMsg({ type: "success", text: "Purchase order updated successfully" });
      } else {
        await request("/purchaseOrders", {
          method: "POST",
          body: JSON.stringify(payload)
        });
        setStatusMsg({ type: "success", text: "Purchase order created successfully" });
      }

      // Reload data
      const poData = await request("/purchaseOrders");
      setPurchaseOrders(Array.isArray(poData) ? poData : []);

      // Reset form
      setIsCreateOpen(false);
      setEditingPO(null);
      setFormData({
        supplier: "",
        items: [{ product: "", quantity: "", costPrice: "" }],
        destinationBranch: "",
        paymentTerms: "immediate",
        notes: ""
      });
    } catch (err) {
      setStatusMsg({ type: "error", text: err.message || "Failed to create purchase order" });
    } finally {
      setProcessing(false);
    }
  };

  const handleDeletePO = async (id) => {
    if (!window.confirm("Are you sure you want to delete this purchase order?")) return;

    try {
      setProcessing(true);
      await request(`/purchaseOrders/${id}`, { method: "DELETE" });
      setPurchaseOrders(prev => prev.filter(po => po._id !== id));
      setStatusMsg({ type: "success", text: "Purchase order deleted" });
    } catch (err) {
      setStatusMsg({ type: "error", text: err.message || "Failed to delete PO" });
    } finally {
      setProcessing(false);
    }
  };

  const handleOpenEdit = (po) => {
    setEditingPO(po);
    setFormData({
      supplier: po.supplier?._id || "",
      items: po.items.map(item => ({
        product: item.product?._id || item.product,
        quantity: item.quantity,
        costPrice: item.costPrice,
        total: item.total
      })),
      destinationBranch: po.destinationBranch?._id || "",
      paymentTerms: po.paymentTerms || "immediate",
      notes: po.notes || ""
    });
    setIsCreateOpen(true);
  };

  if (loading) {
    return (
      <section className="mx-auto max-w-7xl space-y-6 p-4">
        <div className="text-center text-slate-500">Loading purchase orders...</div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl space-y-6">
      {/* Status Message */}
      {statusMsg.text && (
        <div className={`rounded-lg p-4 ${statusMsg.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
          {statusMsg.text}
        </div>
      )}

      {/* Header */}
      <div className="rounded-[32px] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-emerald-50 p-5 shadow-sm sm:p-6 dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950/20">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-emerald-600 dark:text-emerald-400">
              Procurement
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              Purchase Orders
            </h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Create, track, and manage supplier orders in one place.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setEditingPO(null);
              setFormData({
                supplier: "",
                items: [{ product: "", quantity: "", costPrice: "" }],
                destinationBranch: "",
                paymentTerms: "immediate",
                notes: ""
              });
              setIsCreateOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-emerald-700 active:scale-[0.99]"
          >
            <FiPlus />
            New Purchase Order
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-blue-50 p-3 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
              <FiClipboard />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Pending Orders</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">{metrics.pending}</p>
            </div>
          </div>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-amber-50 p-3 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              <FiBox />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Partial Receipt</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">{metrics.partial}</p>
            </div>
          </div>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              <FiCheckCircle />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Completed</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">{metrics.received}</p>
            </div>
          </div>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-red-50 p-3 text-red-700 dark:bg-red-950/40 dark:text-red-300">
              <FiAlertCircle />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Outstanding Value</p>
              <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                {formatCurrency(metrics.outstandingValue)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <div className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex-1">
              <div className="relative">
                <FiSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by supplier or PO ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm outline-none transition-all duration-150 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
            </div>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition-all duration-150 focus:border-emerald-500 focus:bg-white dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="partial">Partial</option>
              <option value="received">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <select
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition-all duration-150 focus:border-emerald-500 focus:bg-white dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="">All Suppliers</option>
              {suppliers.map(s => (
                <option key={s._id} value={s._id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* PO List */}
      <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        {filteredPOs.length === 0 ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400">
            <p className="text-lg font-semibold">No purchase orders found</p>
            <p className="text-sm mt-1">Create your first purchase order to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Supplier</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Amount</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Items</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Date</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {filteredPOs.map(po => (
                  <tr key={po._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-slate-100">{po.supplier?.name || "Unknown"}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Terms: {po.paymentTerms || "Immediate"}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-900 dark:text-slate-100">
                      {formatCurrency(po.totalAmount)}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                      {po.items?.length || 0} items
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                        po.status === "pending" ? "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300" :
                        po.status === "partial" ? "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300" :
                        po.status === "received" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300" :
                        "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400"
                      }`}>
                        {po.status.charAt(0).toUpperCase() + po.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                      {new Date(po.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        {(po.status === "pending" || po.status === "partial") && (
                          <button
                            onClick={() => {
                              setSelectedPOForReceipt(po);
                              setReceiptModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300"
                          >
                            📦 Receive
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenEdit(po)}
                          className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-300"
                        >
                          <FiEdit2 className="h-3 w-3" /> Edit
                        </button>
                        <button
                          onClick={() => handleDeletePO(po._id)}
                          className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-300"
                        >
                          <FiTrash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit PO Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-3xl rounded-[28px] border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-emerald-50 to-cyan-50 px-6 py-5 dark:border-slate-800 dark:from-emerald-950/30 dark:to-cyan-950/30">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                {editingPO ? "Edit Purchase Order" : "Create New Purchase Order"}
              </h2>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <FiX className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePO} className="p-6 space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Supplier *
                  </label>
                  <select
                    value={formData.supplier}
                    onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:bg-white dark:border-slate-700 dark:bg-slate-950"
                  >
                    <option value="">-- Select Supplier --</option>
                    {suppliers.map(s => (
                      <option key={s._id} value={s._id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Payment Terms
                  </label>
                  <select
                    value={formData.paymentTerms}
                    onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:bg-white dark:border-slate-700 dark:bg-slate-950"
                  >
                    {PAYMENT_TERMS.map(term => (
                      <option key={term.value} value={term.value}>{term.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Destination Branch
                  </label>
                  <select
                    value={formData.destinationBranch}
                    onChange={(e) => setFormData({ ...formData, destinationBranch: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:bg-white dark:border-slate-700 dark:bg-slate-950"
                  >
                    <option value="">-- Select Branch (Optional) --</option>
                    {branches.map(b => (
                      <option key={b._id} value={b._id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Items Section */}
              <div>
                <label className="mb-3 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Order Items *
                </label>
                <div className="space-y-3">
                  {formData.items.map((item, idx) => (
                    <div key={idx} className="flex gap-3 items-end p-4 border border-slate-200 rounded-xl bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
                      <div className="flex-1">
                        <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Product</label>
                        <select
                          value={item.product}
                          onChange={(e) => handleItemChange(idx, "product", e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-slate-600 dark:bg-slate-900"
                        >
                          <option value="">-- Select Product --</option>
                          {products.map(p => (
                            <option key={p._id} value={p._id}>{p.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="w-24">
                        <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Qty</label>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-slate-600 dark:bg-slate-900"
                        />
                      </div>

                      <div className="w-32">
                        <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Unit Cost</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.costPrice}
                          onChange={(e) => handleItemChange(idx, "costPrice", e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-slate-600 dark:bg-slate-900"
                        />
                      </div>

                      <div className="w-28">
                        <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Total</label>
                        <div className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-emerald-600">
                          {formatCurrency((Number(item.quantity) || 0) * (Number(item.costPrice) || 0))}
                        </div>
                      </div>

                      {formData.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="rounded-lg p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                        >
                          <FiTrash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleAddItem}
                  className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/30 dark:bg-emerald-950/30 dark:text-emerald-300"
                >
                  + Add Item
                </button>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows="3"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:bg-white dark:border-slate-700 dark:bg-slate-950"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processing}
                  className="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {processing ? "Saving..." : editingPO ? "Update Order" : "Create Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Receipt Modal */}
      <RecordReceiptModal
        isOpen={receiptModalOpen}
        onClose={() => {
          setReceiptModalOpen(false);
          setSelectedPOForReceipt(null);
        }}
        onSuccess={async () => {
          const poData = await request("/purchaseOrders");
          setPurchaseOrders(Array.isArray(poData) ? poData : []);
        }}
      />
    </section>
  );
};

export default PurchaseOrders;
