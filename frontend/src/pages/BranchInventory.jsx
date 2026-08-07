import { useEffect, useState } from "react";
import { getBranchInventory, importBranchInventory, getImportStatus, updateBranchInventory } from "../api/branches.js";
import { getBranches } from "../api/branches.js";

const BranchInventory = () => {
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

  const loadInventory = async (branchIdValue) => {
    if (!branchIdValue) return;
    try {
      setLoading(true);
      const data = await getBranchInventory(branchIdValue);
      setInventory(data || []);
      const edits = (data || []).reduce((map, item) => {
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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBranches();
  }, []);

  useEffect(() => {
    if (branchId) {
      loadInventory(branchId);
    }
  }, [branchId]);

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
      await loadInventory(branchId);
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
      await loadInventory(branchId);
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
        await loadInventory(branchId);
      } else {
        result = { success: true, data: res };
        setImportResult(result);
        await loadInventory(branchId);
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

          {loading ? (
            <div className="text-sm text-slate-500">Loading inventory...</div>
          ) : inventory.length === 0 ? (
            <div className="space-y-3">
              <div className="text-sm text-slate-500">No inventory found for this location.</div>
                  {branchId ? (
                <div>
                  <p className="text-sm text-slate-500">You can import all catalog products into this branch to start tracking stock.</p>
                  <button onClick={handleImport} className="btn btn-primary mt-3" disabled={importing}>
                    {importing ? "Importing..." : "Import All Inventory"}
                  </button>
                </div>
              ) : (
                <div className="text-sm text-slate-500">Select a branch to import inventory.</div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {saveMessage && (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-800">
                  {saveMessage}
                </div>
              )}
              {inventory.map((item) => {
                const edit = inventoryEdits[item._id] || { quantity: item.quantity ?? 0, branchPrice: item.branchPrice ?? item.product?.price ?? 0 };
                return (
                  <div key={item._id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-slate-900">{item.product?.name || "Unnamed product"}</h3>
                        <p className="text-sm text-slate-500">SKU: {item.product?.sku || "N/A"}</p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-600">
                        {item.quantity ?? 0}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <label className="block text-sm text-slate-500">
                        Quantity
                        <input
                          type="number"
                          min="0"
                          value={edit.quantity}
                          onChange={(e) => handleInventoryChange(item._id, "quantity", e.target.value)}
                          className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700"
                        />
                      </label>
                      <label className="block text-sm text-slate-500">
                        Price
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={edit.branchPrice}
                          onChange={(e) => handleInventoryChange(item._id, "branchPrice", e.target.value)}
                          className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700"
                        />
                      </label>
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <button
                        onClick={() => saveInventoryItem(item)}
                        className="btn btn-primary"
                        disabled={savingItemId === item._id}
                      >
                        {savingItemId === item._id ? "Saving..." : "Save"}
                      </button>
                      <p className="text-xs text-slate-500">Last saved inventory entry</p>
                    </div>
                  </div>
                );
              })}
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
