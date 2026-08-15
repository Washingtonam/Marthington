import { useEffect, useState } from "react";
import { getBranchInventory, importBranchInventory, getImportStatus, updateBranchInventory } from "../api/branches.js";
import { getBranches } from "../api/branches.js";
import { useAuth } from "../context/AuthContext.jsx";

const BranchInventory = () => {
  const { user } = useAuth();
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState("");
  const [sourceType, setSourceType] = useState("headOffice");
  const [sourceBranchId, setSourceBranchId] = useState("");
  const [inventory, setInventory] = useState([]);
  const [inventoryEdits, setInventoryEdits] = useState({});
  const [savingItemId, setSavingItemId] = useState(null);
  const [saveMessage, setSaveMessage] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkSaveMessage, setBulkSaveMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalItems: 0, hasNextPage: false, hasPrevPage: false });

  const loadBranches = async () => {
    try {
      const data = await getBranches();
      setBranches(data || []);
      const firstBranchId = (data?.[0]?._id) || "";
      setBranchId(firstBranchId);
      const firstSourceBranch = (data || []).find((branch) => branch._id !== firstBranchId)?._id || "";
      setSourceBranchId(firstSourceBranch);
    } catch (err) {
      console.error(err);
    }
  };

  const loadInventory = async (branchIdValue, pageValue = 1, searchValue = search) => {
    if (!branchIdValue) return;
    try {
      setLoading(true);
      const data = await getBranchInventory({ branchId: branchIdValue, page: pageValue, limit: 20, search: searchValue });
      const responseInventory = Array.isArray(data) ? data : data?.inventory || [];
      setInventory(responseInventory);
      setPagination(data?.pagination || { currentPage: 1, totalPages: 1, totalItems: responseInventory.length, hasNextPage: false, hasPrevPage: false });
      const edits = responseInventory.reduce((map, item) => {
        map[item._id] = {
          quantity: item.quantity ?? 0,
          branchPrice: item.branchPrice ?? item.product?.price ?? 0
        };
        return map;
      }, {});
      setInventoryEdits(edits);
      setSaveMessage("");
      setBulkSaveMessage("");
    } catch (err) {
      console.error(err);
      setInventory([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBranches();
  }, []);

  // 🔥 LISTEN FOR INVENTORY UPDATES FROM EXPENSE APPROVAL
  useEffect(() => {
    if (!window.BroadcastChannel) return;
    
    const channel = new BroadcastChannel("inventory-updates");
    const handleInventoryUpdate = (event) => {
      if (event.data?.type === "inventory-changed") {
        console.log("📦 Inventory changed, refreshing branch inventory...");
        if (branchId) {
          loadInventory(branchId, page, search);
        }
      }
    };
    
    channel.addEventListener("message", handleInventoryUpdate);
    return () => {
      channel.removeEventListener("message", handleInventoryUpdate);
      channel.close();
    };
  }, [branchId, page, search]);

  useEffect(() => {
    if (branchId) {
      setPage(1);
      loadInventory(branchId, 1, search);
    }
  }, [branchId]);

  useEffect(() => {
    if (!branchId) return;
    const timeout = window.setTimeout(() => {
      setPage(1);
      loadInventory(branchId, 1, search);
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    if (!branches.length || !branchId) return;

    if (!sourceBranchId || sourceBranchId === branchId) {
      const nextSourceBranch = branches.find((branch) => branch._id !== branchId)?._id || "";
      setSourceBranchId(nextSourceBranch);
    }
  }, [branches, branchId, sourceBranchId]);

  const [showConfirm, setShowConfirm] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const handleImport = () => {
    if (!branchId) return;
    if (sourceType === "branch" && !sourceBranchId) {
      setImportResult({ success: false, message: "Select a source branch before importing." });
      return;
    }
    setShowConfirm(true);
    setImportResult(null);
  };

  const handleInventoryChange = (itemId, field, value) => {
    setInventoryEdits((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: field === "quantity" ? Number(value) : Number(value)
      }
    }));
  };

  const saveInventoryItem = async (item) => {
    const edit = inventoryEdits[item._id];
    if (!edit) return;

    try {
      setSavingItemId(item._id);
      setSaveMessage("");
      await updateBranchInventory({
        branchId,
        productId: item.product?._id,
        quantity: edit.quantity,
        branchPrice: edit.branchPrice
      });
      setSaveMessage(`Updated ${item.product?.name || "product"} successfully.`);
      await loadInventory(branchId, page, search);
    } catch (err) {
      setSaveMessage(err.message || "Failed to save inventory item.");
    } finally {
      setSavingItemId(null);
    }
  };

  const saveAllInventoryItems = async () => {
    if (!inventory.length) return;

    try {
      setBulkSaving(true);
      setBulkSaveMessage("");
      for (const item of inventory) {
        const edit = inventoryEdits[item._id];
        if (!edit) continue;
        await updateBranchInventory({
          branchId,
          productId: item.product?._id,
          quantity: edit.quantity,
          branchPrice: edit.branchPrice
        });
      }
      setBulkSaveMessage("All inventory items updated successfully.");
      await loadInventory(branchId, page, search);
    } catch (err) {
      setBulkSaveMessage(err.message || "Failed to save inventory changes.");
    } finally {
      setBulkSaving(false);
    }
  };

  const confirmImport = async () => {
    if (!branchId) return;

    const importPayload = {
      branchId,
      sourceType,
      sourceBranchId: sourceType === "branch" ? sourceBranchId : undefined,
    };

    try {
      setImporting(true);
      setImportResult(null);
      const res = await importBranchInventory(importPayload);
      let result;

      if (res?.jobId) {
        const jobId = res.jobId;
        let attempts = 0;
        const maxAttempts = 120; // ~2 minutes

        while (attempts < maxAttempts) {
          // eslint-disable-next-line no-await-in-loop
          const statusRes = await getImportStatus(jobId);
          const status = statusRes?.status;

          if (status === "completed") {
            result = { success: true, data: statusRes.metadata };
            break;
          }

          if (status === "failed") {
            result = { success: false, message: statusRes?.error || "Import failed" };
            break;
          }

          // wait 1s
          // eslint-disable-next-line no-await-in-loop
          await new Promise((r) => setTimeout(r, 1000));
          attempts += 1;
        }

        if (!result) {
          result = { success: false, message: "Import timed out" };
        }

        setImportResult(result);
        await loadInventory(branchId, 1, search);
      } else {
        result = { success: true, data: res };
        setImportResult(result);
        await loadInventory(branchId, 1, search);
      }
    } catch (err) {
      setImportResult({ success: false, message: err.message || String(err) });
    } finally {
      setImporting(false);
      setShowConfirm(false);
    }
  };

  return (
    <section className="page-stack">
      <div className="page-heading">
        <div>
          <span className="text-sm uppercase tracking-[0.3em] text-slate-500">Inventory</span>
          <h1 className="mt-2 text-4xl font-semibold text-slate-900">Inventory Stock</h1>
        </div>
        <p className="max-w-2xl text-sm text-slate-500">
          Import products into a branch location and manage inventory counts in one place.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr,320px]">
        <div className="page-card">
            <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Inventory per location</h2>
              <p className="text-sm text-slate-500">Select a branch to review and manage inventory.</p>
            </div>
              <button onClick={handleImport} className="btn btn-secondary" disabled={!branchId || importing}>
                {importing ? "Importing..." : "Import Inventory"}
              </button>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700">Branch</label>
            <select
              className="form-select mt-2 w-full"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
            >
              {user?.role === "owner" && (
                <option value="headOffice">Head Office</option>
              )}
              {branches.map((branch) => (
                <option key={branch._id} value={branch._id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700">Import Source</label>
            <select
              className="form-select mt-2 w-full"
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value)}
            >
              <option value="headOffice">Head Office Catalog</option>
              <option value="branch">Another Branch</option>
            </select>
          </div>

          {sourceType === "branch" && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700">Source Branch</label>
              <select
                className="form-select mt-2 w-full"
                value={sourceBranchId}
                onChange={(e) => setSourceBranchId(e.target.value)}
              >
                <option value="">Select source branch</option>
                {branches
                  .filter((branch) => branch._id !== branchId)
                  .map((branch) => (
                    <option key={branch._id} value={branch._id}>
                      {branch.name}
                    </option>
                  ))}
              </select>
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700">Search products</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or SKU"
              className="form-input mt-2 w-full"
            />
          </div>

          {loading ? (
            <div className="text-sm text-slate-500">Loading inventory...</div>
          ) : inventory.length === 0 ? (
            <div className="space-y-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5">
              <div>
                <p className="text-base font-semibold text-slate-800">This branch has no inventory imported yet.</p>
                <p className="mt-1 text-sm text-slate-600">
                  {branchId === "headOffice"
                    ? "Head office inventory is visible here, but no product has been assigned to this branch yet."
                    : `No stock has been imported for ${branches.find((branch) => branch._id === branchId)?.name || "this branch"} yet.`}
                </p>
              </div>

              {branchId ? (
                <div className="space-y-2">
                  <p className="text-sm text-slate-600">
                    Import from the head office catalog or another branch to begin tracking stock movements and sales for this location.
                  </p>
                  <button onClick={handleImport} className="btn btn-primary" disabled={importing}>
                    {importing ? "Importing..." : "Import Inventory"}
                  </button>
                </div>
              ) : (
                <div className="text-sm text-slate-500">Select a branch first to import inventory.</div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {saveMessage && (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-800">
                  {saveMessage}
                </div>
              )}
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <div className="grid grid-cols-[2fr,1fr,1fr,auto] gap-3 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  <span>Product</span>
                  <span>Stock</span>
                  <span>Price</span>
                  <span>Action</span>
                </div>
                {inventory.map((item) => {
                  const edit = inventoryEdits[item._id] || { quantity: item.quantity ?? 0, branchPrice: item.branchPrice ?? item.product?.price ?? 0 };
                  return (
                    <div key={item._id} className="grid grid-cols-[2fr,1fr,1fr,auto] items-center gap-3 border-t border-slate-200 px-4 py-3">
                      <div>
                        <div className="font-semibold text-slate-900">{item.product?.name || "Unnamed product"}</div>
                        <div className="text-sm text-slate-500">SKU: {item.product?.sku || "N/A"}</div>
                      </div>
                      <input
                        type="number"
                        min="0"
                        value={edit.quantity}
                        onChange={(e) => handleInventoryChange(item._id, "quantity", e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white p-2 text-sm text-slate-700"
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={edit.branchPrice}
                        onChange={(e) => handleInventoryChange(item._id, "branchPrice", e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white p-2 text-sm text-slate-700"
                      />
                      <button
                        onClick={() => saveInventoryItem(item)}
                        className="btn btn-primary"
                        disabled={savingItemId === item._id}
                      >
                        {savingItemId === item._id ? "Saving..." : "Save"}
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-500">Showing {inventory.length} of {pagination.totalItems} items</p>
                <div className="flex items-center gap-2">
                  <button
                    className="btn"
                    disabled={!pagination.hasPrevPage || loading}
                    onClick={() => {
                      const nextPage = Math.max(page - 1, 1);
                      setPage(nextPage);
                      loadInventory(branchId, nextPage, search);
                    }}
                  >
                    Previous
                  </button>
                  <span className="text-sm text-slate-600">Page {pagination.currentPage} of {pagination.totalPages}</span>
                  <button
                    className="btn"
                    disabled={!pagination.hasNextPage || loading}
                    onClick={() => {
                      const nextPage = page + 1;
                      setPage(nextPage);
                      loadInventory(branchId, nextPage, search);
                    }}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="page-card">
          <h2 className="text-xl font-semibold">Inventory actions</h2>
          <p className="mt-2 text-sm text-slate-500">
            Import all matching catalog products into the selected branch and manage inventory counts here.
          </p>
          <button
            onClick={saveAllInventoryItems}
            className="btn btn-primary mt-4 w-full"
            disabled={bulkSaving || inventory.length === 0}
          >
            {bulkSaving ? "Saving all..." : "Save all inventory changes"}
          </button>
          {bulkSaveMessage && (
            <p className={`mt-3 text-sm ${bulkSaveMessage.includes("failed") ? "text-rose-700" : "text-emerald-700"}`}>
              {bulkSaveMessage}
            </p>
          )}
        </div>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => { if (!importing) setShowConfirm(false); }} />
          <div className="bg-white p-6 rounded-xl shadow-lg z-10 w-full max-w-md">
            <h3 className="text-lg font-bold">Confirm Import</h3>
            <p className="mt-3 text-sm text-slate-600">
              This will register all catalog products into the selected branch&apos;s inventory.
              Central stock will not be changed when performing a bulk import.
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Import source: {sourceType === "headOffice" ? "Head Office Catalog" : "Branch inventory"}
            </p>

            {importResult && (
              <div className={`mt-3 p-3 rounded ${importResult.success ? 'bg-green-50 text-green-800' : 'bg-rose-50 text-rose-800'}`}>
                {importResult.success ? `Imported ${importResult.data?.imported ?? 0} items` : importResult.message}
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-3">
              <button className="btn" onClick={() => setShowConfirm(false)} disabled={importing}>Cancel</button>
              <button className="btn btn-primary" onClick={confirmImport} disabled={importing}>
                {importing ? 'Importing…' : 'Confirm Import'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default BranchInventory;
