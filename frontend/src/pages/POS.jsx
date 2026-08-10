import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import request from "../api/client.js";
import { getServices } from "../api/services.js";
import { getBranches, getBranchInventory } from "../api/branches.js";
import { formatCurrency } from "../utils/formatters.js";
import { useAuth } from "../context/AuthContext.jsx";

const formatDisplayText = (value = "") => {
  const raw = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!raw) return "";

  const normalized = raw.toLowerCase();
  if (normalized === "b luethoot") return "Bluetooth Mouse";

  return raw
    .split(" ")
    .map((word) => {
      const lowered = word.toLowerCase();
      if (["of", "and", "for", "the", "in", "to", "a", "an", "on", "at", "by"].includes(lowered)) {
        return lowered;
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
};

const POS = () => {
  const navigate = useNavigate();
  const { user, business } = useAuth();
  const userBranchId = user?.branch?._id || user?.branch || "";
  
  // ====================================
  // REFS
  // ====================================
  const debounceTimer = useRef(null);
  const bc = useRef(null);
  const isInitialMount = useRef(true);

  // ====================================
  // STATE MANAGEMENT
  // ====================================
  const [products, setProducts] = useState([]);
  const [services, setServices] = useState([]);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [upgradeMsg, setUpgradeMsg] = useState("");
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("products");
  const [pulseId, setPulseId] = useState(null);
  const [pulseType, setPulseType] = useState("product");
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(userBranchId);
  const [branchInventory, setBranchInventory] = useState([]);

  const [customer, setCustomer] = useState({ name: "", phone: "", notes: "" });
  const [autoSend, setAutoSend] = useState(false);

  const isPro = business?.subscription?.status === "active";
  const canOverride = user?.role === "owner" || user?.role === "super_admin" || user?.permissions?.canOverridePrice;

  // ====================================
  // COMPUTED
  // ====================================
  const total = useMemo(() => 
    cart.reduce((sum, item) => sum + (item.quantity * item.sellingPrice), 0)
  , [cart]);

  // ====================================
  // SYNC LOGIC (BroadcastChannel)
  // ====================================
  const syncToCustomerDisplay = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(() => {
      if (bc.current) {
        bc.current.postMessage({
          type: "UPDATE_CART",
          businessName: business?.name,
          items: cart.map(i => ({
            name: i.name,
            quantity: i.quantity,
            price: i.sellingPrice,
            subtotal: i.quantity * i.sellingPrice
          })),
          total: total,
          customerName: customer.name,
          customerNotes: customer.notes
        });
      }
    }, 400); 
  }, [cart, total, customer.name, customer.notes, business?.name]);

  // Handle Initial Channel Setup
  useEffect(() => {
    bc.current = new BroadcastChannel('marthington_customer_display');

    const handleSyncRequest = (event) => {
      if (event.data.type === "REQUEST_SYNC") {
        syncToCustomerDisplay();
      }
    };

    bc.current.addEventListener("message", handleSyncRequest);

    return () => {
      if (bc.current) {
        bc.current.removeEventListener("message", handleSyncRequest);
        bc.current.close();
      }
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [syncToCustomerDisplay]);

  // Trigger sync when cart/customer changes
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
    } else {
      syncToCustomerDisplay();
    }
  }, [cart, total, customer.name, customer.notes, syncToCustomerDisplay]);

  // ====================================
  // DATA LOADING
  // ====================================
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const limit = 5000;
        const [prodRes, servRes, branchRes] = await Promise.all([
          request(`/products?limit=${limit}`),
          getServices(),
          getBranches()
        ]);

        const branchList = Array.isArray(branchRes) ? branchRes : [];
        setBranches(branchList);

        if (!userBranchId) {
          setSelectedBranch("");
        } else if (!branchList.some((branch) => branch._id === userBranchId)) {
          setSelectedBranch("");
        }

        // Ensure we are setting arrays.
        // If the API returns { products: [...] }, use prodRes.products.
        const cleanProducts = Array.isArray(prodRes)
          ? prodRes
          : (prodRes?.products || prodRes?.data?.products || []);
        const cleanServices = Array.isArray(servRes) ? servRes : (servRes?.services || []);

        setProducts(cleanProducts);
        setServices(cleanServices);
      } catch (err) {
        console.error("POS Load Error:", err);
        setUpgradeMsg("Failed to load inventory.");
        setProducts([]); // Fallback to empty array to prevent .filter crash
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [isPro]);

useEffect(() => {
  const loadBranchInventory = async () => {
    if (!selectedBranch) {
      setBranchInventory([]);
      return;
    }

    try {
      const data = await getBranchInventory(selectedBranch);
      setBranchInventory(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Branch inventory load failed", err);
      setBranchInventory([]);
    }
  };

  loadBranchInventory();
}, [selectedBranch]);
  const filteredProducts = useMemo(() => {
    if (!Array.isArray(products)) return [];

    const keyword = search.toLowerCase();

    // When a branch is selected, only show products that have been
    // imported into that branch. If none exist, show an empty list.
    let source = products;
    if (selectedBranch) {
      const allowed = new Set((branchInventory || []).map((it) => it?.product?._id).filter(Boolean));
      if (allowed.size > 0) {
        source = products.filter((p) => allowed.has(p._id));
      } else {
        source = [];
      }
    }

    return source.filter((p) =>
      p?.name?.toLowerCase().includes(keyword) ||
      p?.sku?.toLowerCase().includes(keyword) ||
      p?.category?.toLowerCase().includes(keyword)
    );
  }, [products, search, selectedBranch, branchInventory]);

  const filteredServices = useMemo(() => {
    const keyword = search.toLowerCase();
    return services.filter((s) =>
      s.name?.toLowerCase().includes(keyword) ||
      s.category?.toLowerCase().includes(keyword)
    );
  }, [services, search]);

  // ====================================
  // ACTIONS
  // ====================================
  const addToCart = useCallback((item, type) => {
    const branchInventoryMap = branchInventory.reduce((map, inventoryItem) => {
      if (inventoryItem?.product?._id) {
        map[inventoryItem.product._id] = inventoryItem;
      }
      return map;
    }, {});

    const selectedStock = type === "product"
      ? branchInventoryMap[item._id]?.quantity ?? item.stock
      : null;

    setCart((prev) => {
      const isProduct = type === "product";
      const existingIndex = prev.findIndex(i => 
        isProduct ? i._id === item._id : i.serviceId === item._id
      );

      if (existingIndex > -1) {
        const newCart = [...prev];
        if (isProduct && selectedStock !== null && newCart[existingIndex].quantity >= selectedStock) {
          setUpgradeMsg(`Limited Stock: Only ${selectedStock} available.`);
          return prev;
        }
        newCart[existingIndex].quantity += 1;
        return newCart;
      }

      return [...prev, {
        _id: isProduct ? item._id : `service-${item._id}-${Date.now()}`,
        itemType: type,
        name: item.name,
        quantity: 1,
        sellingPrice: Number(item.sellingPrice || item.price || 0),
        ...(type === "service" && { serviceId: item._id }),
        ...(isProduct && { maxStock: selectedStock ?? item.stock })
      }];
    });

    const pulseKey = type === "product" ? item._id : `service-${item._id}`;
    setPulseType(type);
    setPulseId(pulseKey);
    window.setTimeout(() => setPulseId(null), 220);
  }, [branchInventory]);

  const openCustomerDisplay = useCallback(() => {
    if (typeof window === "undefined") return;
    const displayUrl = `${window.location.origin}/app/customer-view`;
    window.open(displayUrl, "_blank", "noopener,noreferrer");
  }, []);

  const updateQty = (id, newQty) => {
    if (newQty <= 0) {
      setCart(curr => curr.filter(i => i._id !== id));
      return;
    }
    setCart(curr => curr.map(i => i._id === id ? { ...i, quantity: newQty } : i));
  };

  const checkout = async () => {
    if (!cart.length || processing) return;
    try {
      setProcessing(true);
      const payload = {
        customerName: customer.name,
        customerPhone: customer.phone,
        notes: customer.notes,
        branch: selectedBranch || undefined,
        items: cart.map(i => ({
          itemType: i.itemType,
          product: i.itemType === "product" ? i._id : undefined,
          name: i.name,
          quantity: i.quantity,
          sellingPrice: i.sellingPrice
        }))
      };

      const res = await request("/sales", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      if (res?.sale) {
        if (bc.current) bc.current.postMessage({ type: "SALE_COMPLETE", receiptId: res.sale.receiptId });

        if (autoSend && customer.phone && isPro) {
          const cleanPhone = customer.phone.replace(/\D/g, "").replace(/^0/, "234");
          const receiptLink = `${window.location.origin}/r/${res.sale.receiptId}`;
          const msg = `🧾 *${business?.name}*\n\nHello ${customer.name || "Customer"},\n\nTotal: ${formatCurrency(total)}\nView Receipt: ${receiptLink}`;
          window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, "_blank");
        }
        
        setCart([]);
        setCustomer({ name: "", phone: "", notes: "" });
        navigate(`/app/sales/${res.sale._id}`);
      }
    } catch (err) {
      setUpgradeMsg(err.message || "Transaction failed.");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <div className="p-10 text-center font-bold text-blue-600 animate-pulse">Initializing POS System...</div>;

  return (
    <div className="flex flex-col xl:flex-row gap-6 p-2 lg:p-4 bg-gray-50 min-h-screen">
      {/* LEFT COLUMN: INVENTORY */}
      <div className="flex-1 space-y-4">
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <label className="relative flex-1 min-w-[220px]">
            <input
              type="text"
              placeholder="Search products or services..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl border-none bg-slate-50 py-3 pl-4 pr-16 text-sm text-slate-700 focus:ring-2 focus:ring-slate-900"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              /
            </span>
          </label>
          <button 
            onClick={openCustomerDisplay}
            className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm"
            aria-label="Open external display"
            title="External Display"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
              <rect x="3" y="5" width="18" height="12" rx="2"></rect>
              <path d="M9 19h6"></path>
              <path d="M12 17v2"></path>
            </svg>
          </button>
        </div>

        <div className="relative flex w-fit rounded-2xl bg-slate-100 p-1">
          <span
            className="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-xl bg-white shadow-sm transition-transform duration-200"
            style={{ transform: activeTab === "products" ? "translateX(0%)" : "translateX(100%)" }}
          />
          {['products', 'services'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`relative z-10 rounded-xl px-8 py-2 text-sm font-semibold capitalize transition-colors ${
                activeTab === tab ? "text-slate-900" : "text-slate-500"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 overflow-y-auto pr-2 custom-scrollbar md:grid-cols-2 2xl:grid-cols-3 max-h-[70vh]">
          {activeTab === "products" ? (
            filteredProducts.map(p => {
              const pulseActive = pulseId === p._id && pulseType === "product";
              return (
                <div 
                  key={p._id} 
                  onClick={() => addToCart(p, "product")}
                  className={`pos-card ${pulseActive ? "card-pulse" : ""}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-sm font-semibold text-slate-800">{formatDisplayText(p.name)}</h3>
                      <span className={`stock-badge ${Number(p.stock) < 5 ? "stock-warning" : ""}`}>
                        {Number(p.stock) < 5 ? `${p.stock} left` : `${p.stock} left`}
                      </span>
                    </div>
                    <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                      {formatDisplayText(p.category || "General")}
                    </p>
                    {selectedBranch && (
                      <p className="mt-2 text-[11px] text-slate-500">
                        Branch stock: {branchInventory.find(item => item.product?._id === p._id)?.quantity ?? "Not imported"}
                      </p>
                    )}
                  </div>
                  <span className="rounded-2xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-sm">
                    {formatCurrency(p.sellingPrice || p.price)}
                  </span>
                </div>
              );
            })
          ) : (
            filteredServices.map(s => {
              const pulseActive = pulseId === `service-${s._id}` && pulseType === "service";
              return (
                <div 
                  key={s._id} 
                  onClick={() => addToCart(s, "service")}
                  className={`pos-card pos-card-service ${pulseActive ? "card-pulse" : ""}`}
                >
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-slate-800">{formatDisplayText(s.name)}</h3>
                    <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                      {formatDisplayText(s.category || "General")}
                    </p>
                  </div>
                  <span className="rounded-2xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm">
                    {formatCurrency(s.price)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: CART */}
      <div className="xl:w-[400px]">
        <div className="sticky top-4 rounded-[28px] border border-slate-100 bg-white p-5 shadow-[0_22px_60px_rgba(15,23,42,0.08)]">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-black text-slate-900">Cart</h2>
            <button onClick={() => setCart([])} className="rounded-full bg-rose-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-rose-500">Clear</button>
          </div>

          <div className="mb-6 max-h-[35vh] space-y-3 overflow-y-auto pr-2 custom-scrollbar">
            {cart.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-slate-100 py-10 text-center">
                <p className="text-xs font-black uppercase tracking-[0.35em] text-slate-300">Cart is empty</p>
              </div>
            ) : (
              cart.map(item => (
                <div key={item._id} className="cart-item rounded-2xl border border-slate-100 bg-slate-50 p-3">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <span className="flex-1 text-xs font-semibold text-slate-700">{formatDisplayText(item.name)}</span>
                    <span className="ml-2 text-sm font-black text-slate-900">{formatCurrency(item.quantity * item.sellingPrice)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="cart-stepper flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-2 py-1 shadow-sm">
                      <button onClick={() => updateQty(item._id, item.quantity - 1)} className="flex h-7 w-7 items-center justify-center rounded-xl font-black text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-900">-</button>
                      <span className="w-4 text-center text-xs font-black text-slate-700">{item.quantity}</span>
                      <button onClick={() => updateQty(item._id, item.quantity + 1)} className="flex h-7 w-7 items-center justify-center rounded-xl font-black text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-900">+</button>
                    </div>
                    
                    {canOverride && (
                      <input 
                        type="number" 
                        value={item.sellingPrice}
                        onChange={(e) => {
                          const newPrice = Number(e.target.value);
                          setCart(c => c.map(i => i._id === item._id ? {...i, sellingPrice: newPrice} : i));
                        }}
                        className="w-20 rounded-xl border border-slate-200 bg-white p-1 text-right text-xs font-black text-slate-700"
                      />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="space-y-3 border-t border-dashed border-slate-200 pt-4">
            <div className="grid grid-cols-2 gap-2">
              <input 
                placeholder="Client Name"
                value={customer.name}
                onChange={e => setCustomer({...customer, name: e.target.value})}
                className="rounded-2xl border border-slate-100 bg-slate-50 p-3 text-xs font-semibold text-slate-700 focus:border-slate-300 focus:ring-0"
              />
              <input 
                placeholder="WhatsApp"
                value={customer.phone}
                onChange={e => setCustomer({...customer, phone: e.target.value})}
                className="rounded-2xl border border-slate-100 bg-slate-50 p-3 text-xs font-semibold text-slate-700 focus:border-slate-300 focus:ring-0"
              />
            </div>
            {branches && branches.length > 0 ? (
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Branch</label>
                <select
                  value={selectedBranch}
                  onChange={e => setSelectedBranch(e.target.value)}
                  className="w-full rounded-2xl border border-slate-100 bg-slate-50 p-3 text-xs font-semibold text-slate-700 focus:border-slate-300 focus:ring-0"
                >
                  <option value="">Head office</option>
                  {branches.map(branch => (
                    <option key={branch._id} value={branch._id}>{branch.name}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="text-sm text-slate-500">
                No branches yet. <button onClick={() => navigate('/app/branches')} className="underline">Create one</button>
              </div>
            )}

            <textarea
              placeholder="Add notes (optional - will appear on receipt)"
              value={customer.notes}
              onChange={e => setCustomer({...customer, notes: e.target.value})}
              className="h-20 w-full resize-none rounded-2xl border border-slate-100 bg-slate-50 p-3 text-xs font-semibold text-slate-700 focus:border-slate-300 focus:ring-0"
            />
            
            <div className="flex flex-col items-center justify-center gap-2 py-3 text-center">
                <span className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-400">Total Amount</span>
                <span className="text-3xl font-black tracking-tight text-slate-900">{formatCurrency(total)}</span>
            </div>

            <div className="flex items-center justify-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2">
                <button
                  type="button"
                  onClick={() => setAutoSend(prev => !prev)}
                  className={`flex h-6 w-12 items-center rounded-full border border-slate-200 p-1 transition-all ${autoSend ? "justify-end bg-slate-900" : "justify-start bg-slate-200"}`}
                  aria-label="Toggle WhatsApp receipt"
                >
                  <span className="h-4 w-4 rounded-full bg-white shadow-sm"></span>
                </button>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">WhatsApp</span>
            </div>

            {upgradeMsg && <p className="rounded-2xl bg-rose-50 p-2 text-center text-[10px] font-black uppercase tracking-[0.2em] text-rose-500">{upgradeMsg}</p>}

            <button
              onClick={checkout}
              disabled={!cart.length || processing}
              className={`w-full rounded-2xl py-4 text-sm font-black uppercase tracking-[0.2em] text-white transition-all active:translate-y-[1px] ${
                processing ? "bg-slate-300" : "bg-slate-900 shadow-[0_14px_28px_rgba(15,23,42,0.16)] hover:bg-slate-800"
              }`}
            >
              {processing ? "PROCESSING..." : "CONFIRM & PRINT"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default POS;