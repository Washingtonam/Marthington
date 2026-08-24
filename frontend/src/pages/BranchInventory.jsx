import { useEffect, useState } from "react";
import request from "../api/client.js";
import { getBranchInventory, importBranchInventory, getImportStatus, updateBranchInventory, createTransferRequest, getTransferRequests, reviewTransferRequest } from "../api/branches.js";
import { getBranches } from "../api/branches.js";
import { createService, getServices } from "../api/services.js";
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
  const [catalogDrawerOpen, setCatalogDrawerOpen] = useState(false);
  const [catalogType, setCatalogType] = useState("product");
  const [catalogForm, setCatalogForm] = useState({ name: "", category: "", sku: "", costPrice: "", sellingPrice: "", stock: "", duration: "", code: "", description: "" });
  const [catalogMatches, setCatalogMatches] = useState([]);
  const [catalogSearching, setCatalogSearching] = useState(false);
  const [catalogSaving, setCatalogSaving] = useState(false);
  const [catalogMessage, setCatalogMessage] = useState("");
  const [transferRequests, setTransferRequests] = useState([]);
  const [transferForm, setTransferForm] = useState({ sourceType: "headOffice", sourceBranch: "", product: "", quantity: "" });
  const [transferMessage, setTransferMessage] = useState("");
  const [transferSaving, setTransferSaving] = useState(false);
  const [reviewNote, setReviewNote] = useState({});
  const canReviewTransfers = user?.role === "owner" || user?.role === "super_admin";
  const canRequestTransfers = Boolean(user?.permissions?.canManageBranchInventory) && user?.role !== "owner";

  const loadBranches = async () => {
    try {
      const data = await getBranches();
      const availableBranches = Array.isArray(data) ? data : [];
      setBranches(availableBranches);
      const assignedBranchId = user?.branch?._id || user?.branch || "";
      const defaultBranchId = user?.role === "owner"
        ? "headOffice"
        : availableBranches.find((branch) => branch._id === assignedBranchId)?._id || "";
      setBranchId(defaultBranchId);
      const firstSourceBranch = availableBranches.find((branch) => branch._id !== defaultBranchId)?._id || "";
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
  }, [user]);

  useEffect(() => {
    if (!canReviewTransfers && !canRequestTransfers) return;
    getTransferRequests(canReviewTransfers ? "pending" : "")
      .then((data) => setTransferRequests(Array.isArray(data) ? data : []))
      .catch(() => setTransferRequests([]));
  }, [canReviewTransfers, canRequestTransfers]);

  const submitTransferRequest = async (event) => {
    event.preventDefault();
    if (!transferForm.product || !transferForm.quantity || !branchId || branchId === "headOffice") return;
    try {
      setTransferSaving(true);
      setTransferMessage("");
      await createTransferRequest({ ...transferForm, targetBranch: branchId, quantity: Number(transferForm.quantity) });
      setTransferForm((current) => ({ ...current, product: "", quantity: "" }));
      setTransferMessage("Transfer request submitted for approval.");
    } catch (err) {
      setTransferMessage(err.message || "Could not submit transfer request.");
    } finally {
      setTransferSaving(false);
    }
  };

  const handleTransferReview = async (requestId, status) => {
    try {
      await reviewTransferRequest(requestId, status, reviewNote[requestId] || "");
      setTransferRequests((current) => current.filter((item) => item._id !== requestId));
      setTransferMessage(`Transfer request ${status}.`);
    } catch (err) {
      setTransferMessage(err.message || "Could not review transfer request.");
    }
  };

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

  useEffect(() => {
    const searchTerm = catalogForm.name.trim();
    if (!catalogDrawerOpen || searchTerm.length < 2) {
      setCatalogMatches([]);
      return undefined;
    }

    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      setCatalogSearching(true);
      try {
        const result = catalogType === "product"
          ? await request(`/products/autocomplete?search=${encodeURIComponent(searchTerm)}&limit=8`)
          : await getServices({ search: searchTerm });
        if (cancelled) return;
        const items = catalogType === "product"
          ? result?.products || []
          : Array.isArray(result) ? result : result?.services || result?.data || [];
        setCatalogMatches(items.map((item) => ({ ...item, catalogType })));
      } catch (err) {
        if (!cancelled) setCatalogMatches([]);
      } finally {
        if (!cancelled) setCatalogSearching(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [catalogDrawerOpen, catalogForm.name, catalogType]);

  const openCatalogDrawer = (type) => {
    setCatalogType(type);
    setCatalogForm({ name: "", category: "", sku: "", costPrice: "", sellingPrice: "", stock: "", duration: "", code: "", description: "" });
    setCatalogMatches([]);
    setCatalogMessage("");
    setCatalogDrawerOpen(true);
  };

  const closeCatalogDrawer = () => {
    if (catalogSaving) return;
    setCatalogDrawerOpen(false);
  };

  const handleCatalogChange = (event) => {
    const { name, value } = event.target;
    setCatalogForm((current) => ({ ...current, [name]: value }));
    setCatalogMessage("");
  };

  const selectCatalogMatch = (item) => {
    setCatalogForm((current) => ({
      ...current,
      name: item.name || "",
      category: item.category || current.category,
      sku: item.sku || current.sku,
      code: item.code || current.code,
      costPrice: item.costPrice ?? current.costPrice,
      sellingPrice: item.price ?? item.sellingPrice ?? current.sellingPrice,
      stock: item.stock ?? current.stock,
      duration: item.duration ?? current.duration,
      description: item.description || current.description
    }));
    setCatalogMessage(`Existing ${catalogType} selected. Saving will update it instead of creating a duplicate.`);
  };

  const handleCatalogSubmit = async (event) => {
    event.preventDefault();
    if (!catalogForm.name.trim()) return;

    try {
      setCatalogSaving(true);
      setCatalogMessage("");
      if (catalogType === "product") {
        await request("/products", {
          method: "POST",
          body: JSON.stringify({
            name: catalogForm.name.trim(),
            category: catalogForm.category,
            sku: catalogForm.sku,
            costPrice: Number(catalogForm.costPrice) || 0,
            sellingPrice: Number(catalogForm.sellingPrice) || 0,
            stock: Number(catalogForm.stock) || 0
          })
        });
      } else {
        await createService({
          name: catalogForm.name.trim(),
          category: catalogForm.category,
          code: catalogForm.code,
          costPrice: Number(catalogForm.costPrice) || 0,
          price: Number(catalogForm.sellingPrice) || 0,
          duration: Number(catalogForm.duration) || 0,
          description: catalogForm.description
        });
      }
      setCatalogMessage(`${catalogType === "product" ? "Product" : "Service"} saved successfully.`);
      setCatalogMatches([]);
      if (branchId) await loadInventory(branchId, 1, search);
    } catch (err) {
      setCatalogMessage(err.message || "Could not save catalog item.");
    } finally {
      setCatalogSaving(false);
    }
  };

  return (
    <section className="page-stack">
      <div className="page-heading">
        <div>
          <span className="text-sm uppercase tracking-[0.3em] text-slate-500">Inventory</span>
          <h1 className="mt-2 text-4xl font-semibold text-slate-900">Inventory Stock</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => openCatalogDrawer("product")} className="btn btn-primary">+ Add product</button>
          <button onClick={() => openCatalogDrawer("service")} className="btn btn-secondary">+ Add service</button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="page-card"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Stock control</p><p className="mt-2 text-sm text-slate-600">Adjust quantities and branch pricing.</p></div>
        <div className="page-card"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Product catalog</p><p className="mt-2 text-sm text-slate-600">Create products without leaving inventory.</p></div>
        <div className="page-card"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Service catalog</p><p className="mt-2 text-sm text-slate-600">Keep sellable services connected to POS.</p></div>
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

      {(canRequestTransfers || canReviewTransfers) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {canRequestTransfers && (
            <form className="page-card space-y-4" onSubmit={submitTransferRequest}>
              <div>
                <h2 className="text-xl font-semibold">Request stock transfer</h2>
                <p className="mt-1 text-sm text-slate-500">Ask an owner to replenish this branch without changing stock immediately.</p>
              </div>
              <select className="form-select w-full" value={transferForm.sourceType} onChange={(e) => setTransferForm({ ...transferForm, sourceType: e.target.value, sourceBranch: "" })}>
                <option value="headOffice">From Head Office</option>
                <option value="branch">From another branch</option>
              </select>
              {transferForm.sourceType === "branch" && (
                <select className="form-select w-full" value={transferForm.sourceBranch} onChange={(e) => setTransferForm({ ...transferForm, sourceBranch: e.target.value })}>
                  <option value="">Select source branch</option>
                  {branches.filter((branch) => branch._id !== branchId).map((branch) => <option key={branch._id} value={branch._id}>{branch.name}</option>)}
                </select>
              )}
              <select className="form-select w-full" value={transferForm.product} onChange={(e) => setTransferForm({ ...transferForm, product: e.target.value })}>
                <option value="">Select product</option>
                {inventory.map((item) => item.product?._id && <option key={item.product._id} value={item.product._id}>{item.product.name} ({item.product.sku || "no SKU"})</option>)}
              </select>
              <input className="form-input w-full" type="number" min="1" step="1" placeholder="Quantity" value={transferForm.quantity} onChange={(e) => setTransferForm({ ...transferForm, quantity: e.target.value })} />
              <button className="btn btn-primary" type="submit" disabled={transferSaving || !inventory.length}>{transferSaving ? "Submitting..." : "Submit request"}</button>
              {transferMessage && <p className="text-sm text-slate-600">{transferMessage}</p>}
              {transferRequests.length > 0 && (
                <div className="border-t border-slate-200 pt-3">
                  <p className="text-sm font-semibold text-slate-700">Your recent requests</p>
                  <div className="mt-2 space-y-2">
                    {transferRequests.slice(0, 5).map((transfer) => (
                      <div key={transfer._id} className="flex items-center justify-between gap-3 text-sm">
                        <span>{transfer.product?.name || "Product"} x {transfer.quantity}</span>
                        <span className={`font-semibold capitalize ${transfer.status === "approved" ? "text-emerald-700" : transfer.status === "rejected" ? "text-rose-700" : "text-amber-700"}`}>{transfer.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </form>
          )}

          {canReviewTransfers && (
            <div className="page-card space-y-3">
              <div>
                <h2 className="text-xl font-semibold">Pending transfer requests</h2>
                <p className="mt-1 text-sm text-slate-500">Approve or reject stock movement requests before inventory changes.</p>
              </div>
              {!transferRequests.length && <p className="text-sm text-slate-500">No pending requests.</p>}
              {transferRequests.map((transfer) => (
                <div key={transfer._id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex flex-wrap justify-between gap-2 text-sm">
                    <strong>{transfer.product?.name || "Product"} x {transfer.quantity}</strong>
                    <span className="text-slate-500">{transfer.requestedBy?.name || "Staff"}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{transfer.sourceType === "headOffice" ? "Head Office" : transfer.sourceBranch?.name} to {transfer.targetBranch?.name}</p>
                  <input className="form-input mt-2 w-full" placeholder="Review note (optional)" value={reviewNote[transfer._id] || ""} onChange={(e) => setReviewNote({ ...reviewNote, [transfer._id]: e.target.value })} />
                  <div className="mt-2 flex gap-2">
                    <button className="btn btn-primary" onClick={() => handleTransferReview(transfer._id, "approved")}>Approve</button>
                    <button className="btn" onClick={() => handleTransferReview(transfer._id, "rejected")}>Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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

      {catalogDrawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={closeCatalogDrawer} />
          <aside className="relative ml-auto flex h-full w-full max-w-[460px] flex-col overflow-y-auto bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">Inventory catalog</p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-900">Add {catalogType}</h2>
                <p className="mt-1 text-sm text-slate-500">Search first so existing catalog items stay connected.</p>
              </div>
              <button type="button" onClick={closeCatalogDrawer} className="rounded-full border border-slate-200 px-3 py-1 text-lg text-slate-500">×</button>
            </div>

            <form onSubmit={handleCatalogSubmit} className="grid gap-4 px-6 py-6">
              <label className="text-sm font-semibold text-slate-700">
                {catalogType === "product" ? "Product name" : "Service name"}
                <input name="name" value={catalogForm.name} onChange={handleCatalogChange} placeholder={`Search or enter ${catalogType} name`} required autoFocus className="form-input mt-2 w-full" />
              </label>

              {catalogSearching && <p className="text-sm text-slate-500">Searching your catalog...</p>}
              {!catalogSearching && catalogMatches.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-800">Similar catalog items</p>
                  <div className="mt-2 grid gap-2">
                    {catalogMatches.map((item) => (
                      <button key={item._id} type="button" onClick={() => selectCatalogMatch(item)} className="rounded-lg border border-amber-200 bg-white p-3 text-left hover:border-amber-400">
                        <span className="block font-semibold text-slate-900">{item.name}</span>
                        <span className="mt-1 block text-xs text-slate-500">{item.category || "General"} · {item.sku || item.code || "No code"}{catalogType === "product" ? ` · Stock ${item.stock ?? 0}` : ""}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {catalogMessage && <p className={`rounded-xl p-3 text-sm ${catalogMessage.includes("successfully") ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700"}`}>{catalogMessage}</p>}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-semibold text-slate-700">Category<input name="category" value={catalogForm.category} onChange={handleCatalogChange} placeholder="General" className="form-input mt-2 w-full" /></label>
                <label className="text-sm font-semibold text-slate-700">{catalogType === "product" ? "SKU" : "Service code"}<input name={catalogType === "product" ? "sku" : "code"} value={catalogType === "product" ? catalogForm.sku : catalogForm.code} onChange={handleCatalogChange} placeholder="Optional" className="form-input mt-2 w-full" /></label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-semibold text-slate-700">Cost price<input type="number" min="0" name="costPrice" value={catalogForm.costPrice} onChange={handleCatalogChange} className="form-input mt-2 w-full" /></label>
                <label className="text-sm font-semibold text-slate-700">{catalogType === "product" ? "Selling price" : "Service price"}<input type="number" min="0" name="sellingPrice" value={catalogForm.sellingPrice} onChange={handleCatalogChange} className="form-input mt-2 w-full" /></label>
              </div>
              {catalogType === "product" ? (
                <label className="text-sm font-semibold text-slate-700">Opening stock<input type="number" min="0" name="stock" value={catalogForm.stock} onChange={handleCatalogChange} className="form-input mt-2 w-full" /></label>
              ) : (
                <>
                  <label className="text-sm font-semibold text-slate-700">Duration<input type="number" min="0" name="duration" value={catalogForm.duration} onChange={handleCatalogChange} placeholder="Minutes" className="form-input mt-2 w-full" /></label>
                  <label className="text-sm font-semibold text-slate-700">Description<textarea name="description" value={catalogForm.description} onChange={handleCatalogChange} rows="3" className="form-input mt-2 w-full" /></label>
                </>
              )}
              <button type="submit" disabled={catalogSaving} className="btn btn-primary mt-2 w-full">{catalogSaving ? "Saving..." : `Save ${catalogType}`}</button>
            </form>
          </aside>
        </div>
      )}
    </section>
  );
};

export default BranchInventory;
