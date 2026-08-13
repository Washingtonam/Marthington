import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import request from "../api/client.js";
import { formatCurrency } from "../utils/formatters.js";
import { subscribeToSalesUpdates } from "../utils/salesEvents.js";

const Reports = () => {
  const navigate = useNavigate();
  const [reports, setReports] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadReports = async () => {
    try {
      const data = await request("/reports");
      setReports(data);
    } catch (err) {
      setError(err.message || "Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();

    const unsubscribe = subscribeToSalesUpdates(() => {
      loadReports();
    });

    return unsubscribe;
  }, []);

  if (loading) return <div className="p-6">Loading reports...</div>;

  const overview = reports?.overview || {};

  const renderMetricValue = (value) => {
    const numericValue = Number(value || 0);
    const formattedValue = formatCurrency(value);
    const currencySymbol = formattedValue.startsWith("₦") ? "₦" : "";
    const numericPortion = formattedValue.replace(/^₦/, "");

    return (
      <div className="metric-value-row">
        <h2 className="metric-value">
          <span className="metric-currency">{currencySymbol}</span>
          <span className="metric-number">{numericPortion}</span>
        </h2>
        {numericValue === 0 && <span className="metric-badge">0.0%</span>}
      </div>
    );
  };

  return (
    <section className="page-stack">
      <div className="page-heading">
        <div>
          <span className="section-eyebrow">
            <span className="status-dot" />
            Business Intelligence
          </span>
          <h1>Reports Hub</h1>
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}

      <div className="metrics-grid">
        <div className="tool-panel metric-card revenue">
          <div className="metric-icon">↗</div>
          <div>
            <span className="metric-label">Today's Revenue</span>
            {renderMetricValue(overview.todayRevenue)}
            <span className="metric-caption">Live performance snapshot</span>
          </div>
        </div>
        <div className="tool-panel metric-card success">
          <div className="metric-icon">◔</div>
          <div>
            <span className="metric-label">Monthly Revenue</span>
            {renderMetricValue(overview.monthlyRevenue)}
            <span className="metric-caption">Rolling monthly trend</span>
          </div>
        </div>
        <div className="tool-panel metric-card success">
          <div className="metric-icon">◔</div>
          <div>
            <span className="metric-label">Gross Profit</span>
            {renderMetricValue(overview.monthlyGrossProfit)}
            <span className="metric-caption">Revenue minus COGS</span>
          </div>
        </div>
        <div className="tool-panel metric-card warning">
          <div className="metric-icon">⚠</div>
          <div>
            <span className="metric-label">Operating Expenses</span>
            {renderMetricValue(overview.monthlyOperatingExpenses)}
            <span className="metric-caption">Total business costs</span>
          </div>
        </div>
        <div className="tool-panel metric-card warning">
          <div className="metric-icon">◎</div>
          <div>
            <span className="metric-label">Monthly Profit</span>
            {renderMetricValue(overview.monthlyProfit)}
            <span className="metric-caption">Net profit (Gross - Expenses)</span>
          </div>
        </div>
        <div className="tool-panel metric-card">
          <div className="metric-icon">▣</div>
          <div>
            <span className="metric-label">Inventory Value</span>
            {renderMetricValue(overview.inventoryValue)}
            <span className="metric-caption">Current stock position</span>
          </div>
        </div>
      </div>

      <div className="analytics-ghost-card">
        <div className="panel-heading">
          <div>
            <h2>Growth snapshot</h2>
            <p>Charts and trend views will appear here as your business starts tracking sales.</p>
          </div>
        </div>
        <div className="ghost-bars">
          {Array.from({ length: 6 }).map((_, index) => (
            <span key={index} style={{ height: `${34 + index * 8}%` }} />
          ))}
        </div>
        <div className="ghost-line" />
        <div className="ghost-line short" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* STAFF PERFORMANCE */}
        <div className="tool-panel">
          <div className="panel-heading">
            <div>
              <h2>Staff Performance</h2>
              <p>View staff revenue and analytics.</p>
            </div>
          </div>
          <div className="compact-list">
            {(reports?.staffPerformance || []).slice(0, 3).map((staff, index) => (
              <div key={index} className="compact-row">
                <div>
                  <strong>{staff.name}</strong>
                  <span>{staff.sales} sales</span>
                </div>
                <strong>{formatCurrency(staff.revenue)}</strong>
              </div>
            ))}
          </div>
          {/* 🔥 FIXED PATH */}
          <button onClick={() => navigate("/app/staff-reports")} className="ghost-button mt-4 w-full">
            View Staff Analytics
          </button>
        </div>

        {/* LOW STOCK */}
        <div className="tool-panel">
          <div className="panel-heading">
            <div>
              <h2>Low Stock Alerts</h2>
              <p>Monitor items running low.</p>
            </div>
          </div>
          <div className="compact-list">
            {(reports?.lowStockProducts || []).slice(0, 3).map((product) => (
              <div key={product._id} className="compact-row">
                <div>
                  <strong>{product.name}</strong>
                  <span>SKU: {product.sku || "N/A"}</span>
                </div>
                <strong className="text-red-500">{product.stock}</strong>
              </div>
            ))}
          </div>
          {/* 🔥 FIXED PATH */}
          <button onClick={() => navigate("/app/inventory-reports")} className="ghost-button mt-4 w-full">
            Open Inventory Alerts
          </button>
        </div>

        {/* SALES CENTER */}
        <div className="tool-panel">
          <div className="panel-heading">
            <div>
              <h2>Sales Center</h2>
              <p>Access receipts and transactions.</p>
            </div>
          </div>
          <div className="compact-list">
            {(reports?.recentSales || []).slice(0, 3).map((sale) => (
              <div key={sale._id} className="compact-row">
                <div>
                  <strong>#{sale.receiptId}</strong>
                  <span>{sale.createdBy?.name || "Unknown"}</span>
                </div>
                <strong>{formatCurrency(sale.totalAmount)}</strong>
              </div>
            ))}
          </div>
          <button onClick={() => navigate("/app/sales")} className="ghost-button mt-4 w-full">
            Open Sales Center
          </button>
          {(JSON.parse(localStorage.getItem("bms_user") || "null")?.role === "owner" || JSON.parse(localStorage.getItem("bms_user") || "null")?.role === "super_admin") && (
            <button onClick={() => navigate("/app/deleted-sales")} className="ghost-button mt-2 w-full">
              View Archived Sales
            </button>
          )}
        </div>
      </div>
    </section>
  );
};

export default Reports;