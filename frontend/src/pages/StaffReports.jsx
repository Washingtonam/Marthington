import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getReport, REPORT_TYPES } from "../api/reportApi.js";
import { formatCurrency } from "../utils/formatters.js";

const StaffReports = () => {
  const navigate = useNavigate();
  const [reports, setReports] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  
  // 🔥 NEW: Timeframe Filter State
  const [timeframe, setTimeframe] = useState("all"); // options: all, today, weekly

  useEffect(() => {
    const load = async () => {
      try {
        const period = timeframe === "all" ? "all" : timeframe === "today" ? "7" : "30";
        const data = await getReport(REPORT_TYPES.staff, { period });
        setReports(data);
      } catch (err) {
        setError(err.message || "Failed to load staff reports");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [timeframe]);

  // =====================================
  // FILTER & SORT STAFF (Upgraded)
  // =====================================
  const filteredStaff = useMemo(() => {
    let staffList = reports?.staffPerformance || [];

    // Filter by Search Query
    if (search) {
      staffList = staffList.filter((s) =>
        s.name?.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Sort based on Timeframe Selection
    return [...staffList].sort((a, b) => {
      if (timeframe === "today") return b.todaySales - a.todaySales;
      if (timeframe === "weekly") return b.weeklySales - a.weeklySales;
      return b.totalRevenue - a.totalRevenue;
    });
  }, [reports, search, timeframe]);

  if (loading) return <div className="p-6 text-center">Syncing Staff Intelligence...</div>;

  return (
    <section className="page-stack">
      {/* HEADER */}
      <div className="page-heading">
        <div>
          <span className="text-green-600 font-bold uppercase text-xs tracking-widest">
            Staff Analytics
          </span>
          <h1 className="text-3xl font-black mt-1">Staff Performance</h1>
        </div>

        <button
          onClick={() => navigate("/app/reports")}
          className="border border-gray-300 px-6 py-2 rounded-xl hover:bg-gray-50 transition font-medium"
        >
          Back to Reports
        </button>
      </div>

      {error && <div className="form-error">{error}</div>}

      {/* 🔥 NEW: TIMEFRAME SELECTOR */}
      <div className="flex gap-2 bg-gray-100 p-1 rounded-2xl w-fit mb-6">
        {["all", "today", "weekly"].map((t) => (
          <button
            key={t}
            onClick={() => setTimeframe(t)}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition capitalize ${
              timeframe === t ? "bg-black text-white shadow-md" : "text-gray-500 hover:text-black"
            }`}
          >
            {t === "all" ? "All Time" : t}
          </button>
        ))}
      </div>

      {/* SEARCH & TABLE */}
      <div className="tool-panel shadow-sm">
        <div className="panel-heading">
          <div>
            <h2 className="text-xl font-bold">Team Rankings</h2>
            <p className="text-sm text-gray-500">Currently showing: <span className="text-black font-bold capitalize">{timeframe}</span> performance.</p>
          </div>
          <input
            type="text"
            placeholder="Search staff name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border rounded-xl px-4 py-2 focus:ring-2 focus:ring-green-500 outline-none"
          />
        </div>

        <div className="product-table border rounded-2xl overflow-hidden mt-4">
          <div className="product-row product-row-head bg-gray-50 border-b">
            <span>Staff Name</span>
            <span className="text-center">Transactions</span>
            <span className="text-center">Revenue (Total)</span>
            <span className="text-right">Action</span>
          </div>

          {!filteredStaff.length && (
            <div className="p-10 text-center text-gray-400 italic">No staff activity found for this period.</div>
          )}

          {filteredStaff.map((staff, index) => (
            <div key={index} className="product-row border-b last:border-0 hover:bg-gray-50 transition">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold text-xs">
                  {index + 1}
                </div>
                <span className="font-bold text-gray-800">{staff.name}</span>
              </div>

              <span className="text-center font-medium">
                {timeframe === "today" ? staff.todaySales : timeframe === "weekly" ? staff.weeklySales : staff.totalSales}
              </span>

              <span className="text-center font-black text-green-700">
                {formatCurrency(staff.totalRevenue)}
              </span>

              <button
                onClick={() => navigate(`/app/sales?staff=${staff.name}`)}
                className="text-blue-600 font-bold hover:underline text-right"
              >
                View Logs
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid lg:grid-cols-3 gap-6 pb-10">
        <div className="tool-panel border-b-4 border-b-black">
          <strong className="text-xs text-gray-400 uppercase">Active Staff</strong>
          <h2 className="text-3xl font-black mt-2">{filteredStaff.length}</h2>
        </div>

        <div className="tool-panel border-b-4 border-b-green-600">
          <strong className="text-xs text-gray-400 uppercase">Total Team Revenue</strong>
          <h2 className="text-3xl font-black mt-2 text-green-700">
            {formatCurrency(filteredStaff.reduce((sum, s) => sum + s.totalRevenue, 0))}
          </h2>
        </div>

        <div className="tool-panel border-b-4 border-b-blue-600">
          <strong className="text-xs text-gray-400 uppercase">Total Transactions</strong>
          <h2 className="text-3xl font-black mt-2 text-blue-700">
            {filteredStaff.reduce((sum, s) => sum + s.totalSales, 0)}
          </h2>
        </div>
      </div>
    </section>
  );
};

export default StaffReports;