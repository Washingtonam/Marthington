import request from "./client.js";

export const REPORT_TYPES = Object.freeze({
  overview: "overview",
  dailyAnalysis: "daily-analysis",
  sales: "sales",
  staff: "staff",
  inventory: "inventory",
  financial: "financial",
});

const REPORT_ENDPOINTS = {
  [REPORT_TYPES.overview]: "/reports/overview",
  [REPORT_TYPES.dailyAnalysis]: "/reports/daily-analysis",
  [REPORT_TYPES.sales]: "/reports/sales",
  [REPORT_TYPES.staff]: "/reports/staff",
  [REPORT_TYPES.inventory]: "/reports/inventory",
  [REPORT_TYPES.financial]: "/reports/financial",
};

const normalizeOverviewReport = (payload = {}) => ({
  overview: payload.overview || {},
  sales: Array.isArray(payload.sales) ? payload.sales : Array.isArray(payload.recentSales) ? payload.recentSales : [],
  staffPerformance: Array.isArray(payload.staffPerformance) ? payload.staffPerformance : [],
  lowStockProducts: Array.isArray(payload.lowStockProducts) ? payload.lowStockProducts : [],
  recentSales: Array.isArray(payload.recentSales) ? payload.recentSales : Array.isArray(payload.sales) ? payload.sales : [],
  raw: payload,
});

const normalizeSalesReport = (payload = {}) => ({
  overview: payload.overview || {},
  sales: Array.isArray(payload.sales) ? payload.sales : Array.isArray(payload.recentSales) ? payload.recentSales : [],
  chartData: Array.isArray(payload.chartData) ? payload.chartData : [],
  recentSales: Array.isArray(payload.recentSales) ? payload.recentSales : Array.isArray(payload.sales) ? payload.sales : [],
  raw: payload,
});

const normalizeStaffReport = (payload = {}) => ({
  overview: payload.overview || {},
  staffPerformance: Array.isArray(payload.staffPerformance) ? payload.staffPerformance : [],
  period: payload.period || "30",
  raw: payload,
});

const normalizeInventoryReport = (payload = {}) => ({
  overview: payload.overview || {},
  lowStockProducts: Array.isArray(payload.lowStockProducts) ? payload.lowStockProducts : [],
  chartData: Array.isArray(payload.chartData) ? payload.chartData : [],
  period: payload.period || "30",
  raw: payload,
});

const normalizeFinancialReport = (payload = {}) => ({
  overview: payload.overview || {},
  sales: Array.isArray(payload.sales) ? payload.sales : Array.isArray(payload.recentSales) ? payload.recentSales : [],
  chartData: Array.isArray(payload.chartData) ? payload.chartData : [],
  recentSales: Array.isArray(payload.recentSales) ? payload.recentSales : Array.isArray(payload.sales) ? payload.sales : [],
  raw: payload,
});

export const normalizeReportPayload = (type, payload = {}) => {
  switch (type) {
    case REPORT_TYPES.overview:
      return normalizeOverviewReport(payload);
    case REPORT_TYPES.sales:
      return normalizeSalesReport(payload);
    case REPORT_TYPES.staff:
      return normalizeStaffReport(payload);
    case REPORT_TYPES.inventory:
      return normalizeInventoryReport(payload);
    case REPORT_TYPES.financial:
      return normalizeFinancialReport(payload);
    default:
      return payload;
  }
};

export const buildReportUrl = (type, params = {}) => {
  const endpoint = REPORT_ENDPOINTS[type] || REPORT_ENDPOINTS[REPORT_TYPES.overview];
  const query = new URLSearchParams();

  if (params.period !== undefined && params.period !== null && params.period !== "") {
    query.set("period", String(params.period));
  }

  const queryString = query.toString();
  return queryString ? `${endpoint}?${queryString}` : endpoint;
};

export const getReport = async (type, params = {}) => {
  const url = buildReportUrl(type, params);
  const data = await request(url);
  return normalizeReportPayload(type, data);
};

export default {
  REPORT_TYPES,
  getReport,
  buildReportUrl,
  normalizeReportPayload,
};
