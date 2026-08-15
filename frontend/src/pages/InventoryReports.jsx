import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getReport, REPORT_TYPES } from "../api/reportApi.js";
import { formatCurrency } from "../utils/formatters.js";

const InventoryReports = () => {
  const navigate = useNavigate();
  const [reports, setReports] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  // =====================================
  // LOAD REPORTS
  // =====================================
  useEffect(() => {
    const load = async () => {
      try {
        const data = await getReport(REPORT_TYPES.inventory, { period: "30" });
        setReports(data);
      } catch (err) {
        setError(err.message || "Failed to load inventory reports");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // =====================================
  // FILTER PRODUCTS
  // =====================================
  const filteredProducts = useMemo(() => {
    return (
      reports?.lowStockProducts?.filter((product) => {
        const query = search.toLowerCase();
        return (
          product.name?.toLowerCase().includes(query) ||
          product.sku?.toLowerCase().includes(query)
        );
      }) || []
    );
  }, [reports, search]);

  if (loading) {
    return (
      <div className="p-6 text-center font-semibold text-green-600">
        Analyzing Inventory Levels...
      </div>
    );
  }

  const inventoryValue = reports?.overview?.inventoryValue || 0;
  const lowStockCount = filteredProducts.length;

  return (
    <section className="page-stack">
      {/* HEADER */}
      <div className="page-heading">
        <div>
          <span className="text-sm uppercase tracking-wider text-green-600 font-bold">
            Inventory Intelligence
          </span>
          <h1 className="text-3xl font-black mt-1">Inventory Reports</h1>
        </div>

        <button
          onClick={() => navigate("/app/reports")}
          className="border border-gray-300 px-6 py-2 rounded-xl hover:bg-gray-50 transition font-medium"
        >
          Back to Reports
        </button>
      </div>

      {error && <div className="form-error">{error}</div>}

      {/* OVERVIEW METRICS */}
      <div className="metrics-grid">
        <div className="tool-panel border-l-4 border-l-green-600">
          <strong className="text-gray-500 uppercase text-xs">Total Stock Value</strong>
          <h2 className="mt-2 text-2xl font-black">
            {formatCurrency(inventoryValue)}
          </h2>
        </div>

        <div className="tool-panel border-l-4 border-l-red-500">
          <strong className="text-gray-500 uppercase text-xs">Critical Stock Alerts</strong>
          <h2 className="mt-2 text-2xl font-black text-red-500">
            {lowStockCount} Items
          </h2>
        </div>
      </div>

      {/* LOW STOCK TABLE */}
      <div className="tool-panel shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold">Low Stock Alerts</h2>
            <p className="text-sm text-gray-500">
              Items at or below critical threshold (5 units).
            </p>
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="Search by name or SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border rounded-xl px-4 py-2 w-full md:w-64 focus:ring-2 focus:ring-green-500 outline-none"
            />
          </div>
        </div>

        {/* TABLE */}
        <div className="product-table border rounded-2xl overflow-hidden">
          <div className="product-row product-row-head bg-gray-50 border-b">
            <span className="font-bold text-gray-700">Product Name</span>
            <span className="font-bold text-gray-700">SKU Number</span>
            <span className="font-bold text-gray-700 text-center">Stock Level</span>
            <span className="font-bold text-gray-700 text-right">Action</span>
          </div>

          {!filteredProducts.length && (
            <div className="p-10 text-center text-gray-400 italic">
              All inventory levels are healthy. No alerts found.
            </div>
          )}

          {filteredProducts.map((product) => (
            <div key={product._id} className="product-row hover:bg-gray-50 transition border-b last:border-0">
              <span className="font-semibold text-gray-800">
                {product.name}
              </span>
              <span className="text-gray-500">
                {product.sku || "—"}
              </span>
              <span className="text-red-600 font-black text-center bg-red-50 py-1 px-3 rounded-full w-fit mx-auto">
                {product.stock}
              </span>
              <button
                onClick={() => navigate(`/app/products`)}
                className="text-blue-600 font-bold hover:underline text-right"
              >
                Restock Item
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <div className="grid lg:grid-cols-2 gap-6 pb-10">
        <div className="tool-panel hover:shadow-md transition cursor-default">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">📦</span>
            <h2 className="font-bold text-lg">Product Center</h2>
          </div>
          <p className="text-sm text-gray-500 leading-relaxed">
            Quickly update pricing, categories, and inventory descriptions.
            Bulk edit stock levels to clear critical alerts.
          </p>
          <button
            onClick={() => navigate("/app/products")}
            className="primary-button mt-6 w-full md:w-auto"
          >
            Open Products
          </button>
        </div>

        <div className="tool-panel hover:shadow-md transition cursor-default">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">📜</span>
            <h2 className="font-bold text-lg">Audit Logs</h2>
          </div>
          <p className="text-sm text-gray-500 leading-relaxed">
            Review every stock deduction, addition, and adjustment. 
            Track who changed what in your inventory history.
          </p>
          <button
            onClick={() => navigate("/app/inventory-history")}
            className="primary-button mt-6 w-full md:w-auto"
          >
            View History
          </button>
        </div>
      </div>
    </section>
  );
};

export default InventoryReports;