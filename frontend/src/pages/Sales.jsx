import { useDeferredValue, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";

import {
  useLocation,
  useNavigate
} from "react-router-dom";

import request from "../api/client.js";

import { formatCurrency } from "../utils/formatters.js";
import { notifySalesUpdated } from "../utils/salesEvents.js";

const Sales = () => {

  const navigate = useNavigate();

  const location = useLocation();

  const params = new URLSearchParams(
    location.search
  );

  const staffFilter =
    params.get("staff") || "";

  const [sales, setSales] = useState([]);

  const [loading, setLoading] =
    useState(true);

  const [search, setSearch] =
    useState(staffFilter);
  const deferredSearch = useDeferredValue(search);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [openActionId, setOpenActionId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [viewMode, setViewMode] = useState("active");
  const [deletedRecords, setDeletedRecords] = useState([]);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentReference, setPaymentReference] = useState("");
  const [updatingPayment, setUpdatingPayment] = useState(false);
  const { user } = useAuth();
  const isOwner = user?.role === "owner" || user?.role === "super_admin";

  // =====================================
  // LOAD SALES
  // =====================================

  const loadSales = async (signal) => {
    try {
      setLoading(true);
      const query = new URLSearchParams({ page: String(page), limit: "25" });
      if (deferredSearch.trim()) query.set("search", deferredSearch.trim());
      const data = await request(`/sales?${query.toString()}`, { signal });
      setSales(Array.isArray(data) ? data : data?.sales || []);
      if (data?.pagination) setPagination(data.pagination);
    } catch (err) {
      if (err.name !== "AbortError") console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    loadSales(controller.signal);
    return () => controller.abort();
  }, [page, deferredSearch]);

  useEffect(() => {
    setPage(1);
  }, [deferredSearch]);

  useEffect(() => {
    if (isOwner && viewMode === "archived") {
      loadDeletedRecords();
    }
  }, [isOwner, viewMode]);

  const loadDeletedRecords = async () => {
    if (!isOwner) return;

    try {
      setArchiveLoading(true);
      const data = await request("/transactions/deleted-records");
      setDeletedRecords(data);
    } catch (err) {
      console.error(err);
      setDeletedRecords([]);
    } finally {
      setArchiveLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      setDeleting(true);
      await request(`/transactions/${deleteTarget._id}`, { method: "DELETE" });
      setStatusMessage(`Deleted transaction #${deleteTarget.receiptId}`);
      setDeleteTarget(null);
      notifySalesUpdated();
      await loadSales();
      if (viewMode === "archived") {
        await loadDeletedRecords();
      }
    } catch (err) {
      setStatusMessage(err.message || "Unable to delete transaction");
    } finally {
      setDeleting(false);
    }
  };

  const handlePaymentUpdate = async () => {
    if (!paymentTarget) return;
    try {
      setUpdatingPayment(true);
      await request(`/sales/${paymentTarget._id}/payment`, {
        method: "PATCH",
        body: JSON.stringify({ paymentMethod, paymentReference })
      });
      setPaymentTarget(null);
      setStatusMessage("Payment method updated");
      notifySalesUpdated();
      await loadSales();
    } catch (err) {
      setStatusMessage(err.message || "Unable to update payment method");
    } finally {
      setUpdatingPayment(false);
    }
  };

  // =====================================
  // FILTERED SALES
  // =====================================

  const filteredSales = sales;

  // =====================================
  // LOADING
  // =====================================

  if (loading) {

    return (
      <div className="p-6">
        Loading sales...
      </div>
    );
  }

  return (

    <section className="page-stack dark:text-slate-100">

      {/* HEADER */}

      <div className="page-heading dark:border-slate-700 dark:bg-slate-900/80">

        <div>

          <span className="dark:text-emerald-300">
            Sales Center
          </span>

          <h1 className="dark:text-slate-100">
            Sales History
          </h1>

        </div>

        <p className="dark:text-slate-300">
          Track receipts, staff activity and completed transactions.
        </p>

      </div>

      {/* SEARCH */}

      <div className="tool-panel sales-search-panel dark:border-slate-700 dark:bg-slate-900">

        <div className="panel-heading justify-between">

          <div>

            <h2 className="dark:text-slate-100">
              Search Transactions
            </h2>

            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
              Search by receipt, staff, customer or product
            </p>

          </div>

          {isOwner && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setViewMode("active")}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${viewMode === "active" ? "bg-slate-900 text-white dark:bg-emerald-600 dark:text-white" : "border border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"}`}
              >
                Active Transactions
              </button>
              <button
                type="button"
                onClick={() => setViewMode("archived")}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${viewMode === "archived" ? "bg-slate-900 text-white dark:bg-emerald-600 dark:text-white" : "border border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"}`}
              >
                Deleted Records Archive
              </button>
            </div>
          )}

        </div>

        <div className="table-search dark:border-slate-700 dark:bg-slate-950">

          <input
            className="dark:text-slate-100 dark:placeholder:text-slate-400"
            placeholder="Search receipt, staff, customer or item..."
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
          />

        </div>

      </div>

      {/* SALES TABLE */}

      <div className="tool-panel">

        <div className="panel-heading">

          <div>

            <h2>
              {viewMode === "archived" ? "Deleted Records Archive" : "All Transactions"}
            </h2>

            <p className="text-sm text-gray-500 mt-1">
              {viewMode === "archived"
                ? "Read-only audit log of deleted transactions."
                : "Click any transaction to view full receipt."}
            </p>

          </div>

          <div className="text-sm text-gray-500">
            {viewMode === "archived"
              ? `${deletedRecords.length} archived records`
              : `${filteredSales.length} transactions`}
          </div>

        </div>

        <div className="product-table">

          {/* HEADER */}

          <div className="product-row sales-row product-row-head">

            <span>
              Receipt
            </span>

            <span>
              {viewMode === "archived" ? "Deleted At" : "Items Sold"}
            </span>

            <span>
              Total
            </span>

            {viewMode === "active" && <span>Payment</span>}

            <span>
              {viewMode === "archived" ? "Deleted By" : "Staff"}
            </span>

            <span>
              {viewMode === "archived" ? "Status" : "Action"}
            </span>

          </div>

          {/* EMPTY */}

          {viewMode === "active" ? (
            <>
              {!filteredSales.length && (
                <div className="empty-state">
                  {sales.length === 0 ? (
                    <div className="text-center">
                      <p className="mb-3">No transactions yet. Create your first sale in the POS.</p>
                      <div>
                        <button onClick={() => navigate('/app/pos')} className="ghost-button">
                          Open POS
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p>No transactions match your search. Clear filters or adjust search terms.</p>
                    </div>
                  )}
                </div>
              )}
              {filteredSales.map((sale) => (
                <div
                  key={sale._id}
                  className="product-row sales-row text-left hover:bg-gray-50 transition"
                >
                  {/* RECEIPT */}
                  <button
                    type="button"
                    onClick={() => navigate(`/app/sales/${sale._id}`)}
                    className="text-left"
                  >
                    <div className="font-semibold text-blue-600">
                      #{sale.receiptId}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(sale.createdAt).toLocaleString()}
                    </div>
                  </button>

                  {/* ITEMS */}
                  <span>
                    <div className="font-medium">
                      {sale.items
                        ?.slice(0, 2)
                        .map((item) => item.name)
                        .join(", ")}
                      {sale.items?.length > 2 && " ..."}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {sale.items?.length}
                      {" "}
                      item(s)
                    </div>
                  </span>

                  {/* TOTAL */}
                  <span className="font-semibold">
                    {formatCurrency(sale.totalAmount)}
                  </span>

                  <span className="text-xs font-semibold capitalize text-slate-600">
                    {(sale.paymentMethod || "cash").replace("_", " ")}
                  </span>

                  {/* STAFF */}
                  <span>
                    {sale.createdBy?.name || "Unknown"}
                  </span>

                  {/* ACTION */}
                        <span className="relative flex justify-end">
                          <button
                            type="button"
                            onClick={() => setOpenActionId(openActionId === sale._id ? null : sale._id)}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                            aria-expanded={openActionId === sale._id}
                          >
                            Actions <span aria-hidden="true">⌄</span>
                          </button>
                          {openActionId === sale._id && (
                            <div className="absolute right-0 top-full z-20 mt-2 w-44 rounded-xl border border-slate-200 bg-white p-1 text-left shadow-xl dark:border-slate-700 dark:bg-slate-900">
                              <button type="button" onClick={() => navigate(`/app/sales/${sale._id}`)} className="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">View receipt</button>
                              {isOwner && <button type="button" onClick={() => { setPaymentTarget(sale); setPaymentMethod(sale.paymentMethod || "cash"); setPaymentReference(sale.paymentReference || ""); setOpenActionId(null); }} className="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30">Edit payment</button>}
                              {isOwner && <button type="button" onClick={() => { setDeleteTarget(sale); setOpenActionId(null); }} className="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30">Archive sale</button>}
                            </div>
                          )}
                        </span>
                </div>
              ))}
            </>
          ) : (
            <>
              {archiveLoading ? (
                <div className="p-6">Loading deleted records...</div>
              ) : !deletedRecords.length ? (
                <div className="empty-state">No deleted records yet.</div>
              ) : (
                deletedRecords.map((sale) => (
                  <div
                    key={sale._id}
                    className="product-row text-left hover:bg-gray-50 transition"
                  >
                    <span>
                      <div className="font-semibold text-slate-800">
                        #{sale.receiptId || sale._id}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {sale.customerName || "Walk-in"}
                      </div>
                    </span>
                    <span className="text-xs text-gray-500">
                      {sale.deletedAt ? new Date(sale.deletedAt).toLocaleString() : "—"}
                    </span>
                    <span className="font-semibold">
                      {formatCurrency(sale.totalAmount)}
                    </span>
                    <span className="text-slate-700 text-sm">
                      {sale.deletedBy || "Owner"}
                    </span>
                    <span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-slate-600">
                        Deleted
                      </span>
                    </span>
                  </div>
                ))
              )}
            </>
          )}

        </div>

        {viewMode === "active" && pagination.totalPages > 1 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-700">
            <span className="text-sm text-slate-500 dark:text-slate-400">Showing {((pagination.page - 1) * pagination.limit) + 1}-{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}</span>
            <div className="flex gap-2">
              <button type="button" disabled={page === 1} onClick={() => setPage((current) => current - 1)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 disabled:opacity-40 dark:border-slate-600 dark:text-slate-300">Previous</button>
              <button type="button" disabled={page >= pagination.totalPages} onClick={() => setPage((current) => current + 1)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 disabled:opacity-40 dark:border-slate-600 dark:text-slate-300">Next</button>
            </div>
          </div>
        )}

      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4">
          <div className="w-full max-w-md rounded-[2rem] border border-white/40 bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-rose-100 text-xl">🗑️</div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Archive this receipt?</h3>
                <p className="text-sm text-slate-500">This action is owner-only and can be undone by restoring from the archive later.</p>
              </div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              <p className="font-semibold text-slate-900">Receipt #{deleteTarget.receiptId}</p>
              <p>{formatCurrency(deleteTarget.totalAmount)} • {new Date(deleteTarget.createdAt).toLocaleString()}</p>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setDeleteTarget(null)} className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">
                Cancel
              </button>
              <button type="button" onClick={handleDelete} disabled={deleting} className="rounded-2xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                {deleting ? "Archiving..." : "Archive Receipt"}
              </button>
            </div>
          </div>
        </div>
      )}

      {paymentTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4">
          <div className="w-full max-w-md rounded-[2rem] border border-white/40 bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-black text-slate-900">Correct payment method</h3>
            <p className="mt-1 text-sm text-slate-500">Receipt #{paymentTarget.receiptId}</p>
            <div className="mt-5 space-y-3">
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="bank_transfer">Bank transfer</option>
                <option value="credit">Credit / debt</option>
                <option value="other">Other</option>
              </select>
              {paymentMethod !== "cash" && paymentMethod !== "credit" && (
                <input value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} placeholder="Reference (optional)" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              )}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setPaymentTarget(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">Cancel</button>
              <button type="button" onClick={handlePaymentUpdate} disabled={updatingPayment} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{updatingPayment ? "Saving..." : "Save correction"}</button>
            </div>
          </div>
        </div>
      )}

    </section>
  );
};

export default Sales;