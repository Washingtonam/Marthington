import { useEffect, useMemo, useState } from "react";
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
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [viewMode, setViewMode] = useState("active");
  const [deletedRecords, setDeletedRecords] = useState([]);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const { user } = useAuth();
  const isOwner = user?.role === "owner";

  // =====================================
  // LOAD SALES
  // =====================================

  const loadSales = async () => {
    try {
      setLoading(true);
      const data = await request("/sales");
      setSales(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSales();
  }, []);

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

  // =====================================
  // FILTERED SALES
  // =====================================

  const filteredSales = useMemo(() => {

    return sales.filter((sale) => {

      const term =
        search.toLowerCase();

      const receipt =
        sale.receiptId
          ?.toLowerCase() || "";

      const customer =
        sale.customerName
          ?.toLowerCase() || "";

      const staff =
        sale.createdBy?.name
          ?.toLowerCase() || "";

      const items =
        sale.items
          ?.map((item) =>
            item.name?.toLowerCase()
          )
          .join(" ");

      return (
        receipt.includes(term) ||
        customer.includes(term) ||
        staff.includes(term) ||
        items.includes(term)
      );
    });

  }, [sales, search]);

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

      <div className="tool-panel dark:border-slate-700 dark:bg-slate-900">

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

          <div className="product-row product-row-head">

            <span>
              Receipt
            </span>

            <span>
              {viewMode === "archived" ? "Deleted At" : "Items Sold"}
            </span>

            <span>
              Total
            </span>

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
                  className="product-row text-left hover:bg-gray-50 transition"
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

                  {/* STAFF */}
                  <span>
                    {sale.createdBy?.name || "Unknown"}
                  </span>

                  {/* ACTION */}
                  <span className="flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => navigate(`/app/sales/${sale._id}`)}
                      className="text-blue-600 font-medium"
                    >
                      View Receipt
                    </button>
                    {user?.role === "owner" && (
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(sale)}
                        className="rounded-full border border-rose-200 p-2 text-sm font-semibold text-rose-600 hover:bg-rose-50"
                        aria-label={`Delete transaction ${sale.receiptId}`}
                      >
                        🗑️
                      </button>
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

    </section>
  );
};

export default Sales;