import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FiArrowLeft, FiBox, FiMail, FiPhone, FiMapPin, FiPackage, FiPlus, FiTruck } from "react-icons/fi";
import { getSupplierById } from "../api/suppliers.js";
import { createPurchaseOrder, updatePurchaseOrder } from "../api/purchaseOrders.js";
import { getProducts } from "../api/products.js";
import { formatCurrency } from "../utils/formatters.js";

const SupplierDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [supplierData, setSupplierData] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({
    status: "pending",
    notes: "",
    items: [
      { product: "", name: "", quantity: 1, costPrice: 0 }
    ]
  });

  const loadSupplier = async () => {
    try {
      setLoading(true);
      const data = await getSupplierById(id);
      setSupplierData(data);
    } catch (err) {
      console.error("Failed to load supplier details:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) loadSupplier();
  }, [id]);

  useEffect(() => {
    const loadProductsForOrder = async () => {
      try {
        const data = await getProducts();
        setProducts(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to load products:", err);
      }
    };

    loadProductsForOrder();
  }, []);

  const summaryCards = useMemo(() => {
    if (!supplierData?.summary) return [];

    return [
      { label: "Total purchases", value: formatCurrency(supplierData.summary.totalPurchases || 0) },
      { label: "Outstanding balance", value: formatCurrency(supplierData.summary.outstandingBalance || 0) },
      { label: "Invoices", value: supplierData.summary.invoiceCount || 0 },
      { label: "Purchase orders", value: supplierData.summary.purchaseOrderCount || 0 }
    ];
  }, [supplierData]);

  if (loading) {
    return (
      <section className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500">Loading supplier details...</p>
        </div>
      </section>
    );
  }

  if (!supplierData?.supplier) {
    return (
      <section className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h1 className="text-2xl font-semibold">Supplier not found</h1>
          <button
            type="button"
            onClick={() => navigate("/app/suppliers")}
            className="mt-4 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Back to suppliers
          </button>
        </div>
      </section>
    );
  }

  const { supplier, invoices = [], purchaseOrders = [], stockReceipts = [], supplierItems = [] } = supplierData;

  const updateDraftItem = (index, field, value) => {
    setDraft((current) => {
      const nextItems = [...current.items];
      nextItems[index] = { ...nextItems[index], [field]: value };

      if (field === "product") {
        const chosen = products.find((product) => product._id === value);
        nextItems[index].name = chosen?.name || nextItems[index].name || "";
        nextItems[index].costPrice = Number(chosen?.costPrice ?? nextItems[index].costPrice ?? 0);
      }

      if (field === "quantity" || field === "costPrice") {
        const quantity = Number(nextItems[index].quantity || 0);
        const costPrice = Number(nextItems[index].costPrice || 0);
        nextItems[index].total = quantity * costPrice;
      }

      return { ...current, items: nextItems };
    });
  };

  const addDraftItem = () => {
    setDraft((current) => ({
      ...current,
      items: [...current.items, { product: "", name: "", quantity: 1, costPrice: 0 }]
    }));
  };

  const removeDraftItem = (index) => {
    setDraft((current) => ({
      ...current,
      items: current.items.filter((_, itemIndex) => itemIndex !== index)
    }));
  };

  const submitPurchaseOrder = async () => {
    try {
      setCreating(true);

      const validItems = draft.items
        .filter((item) => item.name || item.product)
        .map((item) => ({
          product: item.product || null,
          name: item.name || "Item",
          quantity: Number(item.quantity || 0),
          costPrice: Number(item.costPrice || 0),
          total: Number(item.quantity || 0) * Number(item.costPrice || 0)
        }));

      if (!validItems.length) {
        alert("Add at least one item to the purchase order.");
        return;
      }

      await createPurchaseOrder({
        supplier: supplier._id,
        status: draft.status,
        notes: draft.notes,
        items: validItems
      });

      setFormOpen(false);
      setDraft({
        status: "pending",
        notes: "",
        items: [{ product: "", name: "", quantity: 1, costPrice: 0 }]
      });
      await loadSupplier();
    } catch (err) {
      console.error("Failed to create purchase order:", err);
      alert(err.message || "Failed to create purchase order");
    } finally {
      setCreating(false);
    }
  };

  const updateOrderStatus = async (orderId, nextStatus) => {
    try {
      const order = purchaseOrders.find((entry) => entry._id === orderId);
      if (!order) return;

      await updatePurchaseOrder(orderId, {
        status: nextStatus,
        notes: order.notes || "",
        items: (order.items || []).map((item) => ({
          product: item.product?._id || item.product || null,
          name: item.name || "Item",
          quantity: Number(item.quantity || 0),
          costPrice: Number(item.costPrice || 0),
          total: Number(item.total || Number(item.costPrice || 0) * Number(item.quantity || 0))
        }))
      });

      await loadSupplier();
    } catch (err) {
      console.error("Failed to update purchase order status:", err);
      alert(err.message || "Failed to update purchase order status");
    }
  };

  return (
    <section className="mx-auto max-w-7xl space-y-6">
      <div className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => navigate("/app/suppliers")}
              className="mt-1 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              aria-label="Go back to suppliers"
            >
              <FiArrowLeft />
            </button>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-emerald-600">Supplier</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{supplier.name}</h1>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
            <FiTruck />
            {supplier.isActive === false ? "Inactive" : "Active"}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <div key={card.label} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{card.label}</p>
            <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{card.value}</p>
          </div>
        ))}
      </div>

      {formOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-3xl rounded-[28px] border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Create purchase order</h2>
              <button type="button" onClick={() => setFormOpen(false)} className="text-sm text-slate-500">Close</button>
            </div>

            <div className="mt-5 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Status</label>
                  <select
                    value={draft.status}
                    onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:bg-white dark:border-slate-700 dark:bg-slate-950"
                  >
                    <option value="pending">Pending</option>
                    <option value="received">Received</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              {draft.items.map((item, index) => (
                <div key={`${item.product || "new"}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Item {index + 1}</span>
                    {draft.items.length > 1 ? (
                      <button type="button" onClick={() => removeDraftItem(index)} className="text-xs font-medium text-rose-600">Remove</button>
                    ) : null}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Product</label>
                      <select
                        value={item.product}
                        onChange={(event) => updateDraftItem(index, "product", event.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900"
                      >
                        <option value="">Select product</option>
                        {products.map((product) => (
                          <option key={product._id} value={product._id}>{product.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Custom name</label>
                      <input
                        value={item.name}
                        onChange={(event) => updateDraftItem(index, "name", event.target.value)}
                        placeholder="Item name"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Quantity</label>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(event) => updateDraftItem(index, "quantity", Number(event.target.value || 0))}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Unit cost</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.costPrice}
                        onChange={(event) => updateDraftItem(index, "costPrice", Number(event.target.value || 0))}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900"
                      />
                    </div>
                  </div>

                  <div className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                    Line total: {formatCurrency(Number(item.quantity || 0) * Number(item.costPrice || 0))}
                  </div>
                </div>
              ))}

              <button type="button" onClick={addDraftItem} className="text-sm font-medium text-emerald-600 hover:text-emerald-700">+ Add another item</button>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Notes</label>
                <textarea
                  value={draft.notes}
                  onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
                  rows="3"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:bg-white dark:border-slate-700 dark:bg-slate-950"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setFormOpen(false)} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">Cancel</button>
                <button type="button" onClick={submitPurchaseOrder} disabled={creating} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70">
                  {creating ? "Creating..." : "Create order"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="space-y-6">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Supplier profile</h2>

            <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
              {supplier.phone ? (
                <div className="flex items-center gap-3">
                  <FiPhone className="mt-0.5" />
                  <span>{supplier.phone}</span>
                </div>
              ) : null}

              {supplier.email ? (
                <div className="flex items-center gap-3">
                  <FiMail className="mt-0.5" />
                  <span>{supplier.email}</span>
                </div>
              ) : null}

              {supplier.address ? (
                <div className="flex items-center gap-3">
                  <FiMapPin className="mt-0.5" />
                  <span>{supplier.address}</span>
                </div>
              ) : null}

              {!supplier.phone && !supplier.email && !supplier.address ? (
                <p className="text-slate-500">No contact details saved for this supplier yet.</p>
              ) : null}
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Notes</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">
              {supplier.notes || "No notes saved for this supplier."}
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2">
              <FiPackage className="text-emerald-600" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Recent incoming invoices</h2>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    <th className="pb-3">Invoice</th>
                    <th className="pb-3">Date</th>
                    <th className="pb-3">Amount</th>
                    <th className="pb-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {invoices.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="py-6 text-center text-slate-500">No incoming invoices yet.</td>
                    </tr>
                  ) : (
                    invoices.slice(0, 5).map((invoice) => (
                      <tr key={invoice._id} className="text-slate-700 dark:text-slate-300">
                        <td className="py-3 pr-4 font-medium">{invoice.invoiceNumber || "INV"}</td>
                        <td className="py-3 pr-4">{new Date(invoice.createdAt).toLocaleDateString()}</td>
                        <td className="py-3 pr-4">{formatCurrency(invoice.totalAmount || 0)}</td>
                        <td className="py-3 pr-4">
                          <span className="inline-flex rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                            {invoice.paymentStatus || "Unpaid"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FiTruck className="text-emerald-600" />
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Purchase orders</h2>
              </div>

              <button
                type="button"
                onClick={() => setFormOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                <FiPlus />
                New PO
              </button>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    <th className="pb-3">Order</th>
                    <th className="pb-3">Date</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3">Items</th>
                    <th className="pb-3">Total</th>
                    <th className="pb-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {purchaseOrders.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-6 text-center text-slate-500">No purchase orders linked to this supplier.</td>
                    </tr>
                  ) : (
                    purchaseOrders.slice(0, 5).map((order) => (
                      <tr key={order._id} className="text-slate-700 dark:text-slate-300">
                        <td className="py-3 pr-4 font-medium">{order._id?.slice(-6).toUpperCase() || "PO"}</td>
                        <td className="py-3 pr-4">{new Date(order.createdAt).toLocaleDateString()}</td>
                        <td className="py-3 pr-4">
                          <span className="inline-flex rounded-full bg-sky-100 px-2 py-1 text-xs font-medium text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                            {order.status || "pending"}
                          </span>
                        </td>
                        <td className="py-3 pr-4">{order.items?.length || 0}</td>
                        <td className="py-3 pr-4">{formatCurrency(order.totalAmount || 0)}</td>
                        <td className="py-3 pr-4">
                          {order.status !== "received" ? (
                            <button
                              type="button"
                              onClick={() => updateOrderStatus(order._id, "received")}
                              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                            >
                              Mark received
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400">Received</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2">
              <FiBox className="text-emerald-600" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Items received from this supplier</h2>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    <th className="pb-3">Product</th>
                    <th className="pb-3">Date</th>
                    <th className="pb-3">Qty</th>
                    <th className="pb-3">Unit Cost</th>
                    <th className="pb-3">Total</th>
                    <th className="pb-3">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {supplierItems.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-6 text-center text-slate-500">No inventory items recorded from this supplier yet.</td>
                    </tr>
                  ) : (
                    supplierItems.slice(0, 10).map((item) => (
                      <tr key={item._id} className="text-slate-700 dark:text-slate-300">
                        <td className="py-3 pr-4 font-medium">{item.productName}</td>
                        <td className="py-3 pr-4">{new Date(item.date).toLocaleDateString()}</td>
                        <td className="py-3 pr-4">{item.quantity}</td>
                        <td className="py-3 pr-4">{formatCurrency(item.unitCost || 0)}</td>
                        <td className="py-3 pr-4">{formatCurrency(item.total || 0)}</td>
                        <td className="py-3 pr-4">
                          <span className="inline-flex rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                            {item.source}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2">
              <FiBox className="text-emerald-600" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Stock receipts</h2>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    <th className="pb-3">Product</th>
                    <th className="pb-3">Receipt</th>
                    <th className="pb-3">Qty</th>
                    <th className="pb-3">Unit</th>
                    <th className="pb-3">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {stockReceipts.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="py-6 text-center text-slate-500">No stock receipts connected to this supplier yet.</td>
                    </tr>
                  ) : (
                    stockReceipts.slice(0, 6).map((receipt) => (
                      <tr key={receipt._id} className="text-slate-700 dark:text-slate-300">
                        <td className="py-3 pr-4 font-medium">{receipt.productName}</td>
                        <td className="py-3 pr-4">{receipt.invoiceNumber}</td>
                        <td className="py-3 pr-4">{receipt.quantity}</td>
                        <td className="py-3 pr-4">{formatCurrency(receipt.unitPrice || 0)}</td>
                        <td className="py-3 pr-4">{formatCurrency(receipt.total || 0)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SupplierDetail;
