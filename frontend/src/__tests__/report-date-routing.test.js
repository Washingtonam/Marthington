import { describe, expect, it } from "vitest";
import { buildReportDetailRoute, parseReportDetailRoute } from "../utils/reportDateRouting.js";
import { buildLedgerEntries } from "../pages/ReportsDetailPage.jsx";

describe("report detail routing", () => {
  it("builds a route from a date range so preset dates open a dedicated detail page", () => {
    const route = buildReportDetailRoute({
      label: "Today",
      start: new Date("2026-09-01T00:00:00.000Z"),
      end: new Date("2026-09-01T23:59:59.000Z"),
    });

    expect(route).toContain("/app/reports/detail");
    expect(route).toContain("label=Today");
    expect(route).toContain("start=2026-09-01T00%3A00%3A00.000Z");
  });

  it("builds a ledger register with sales and expenses on opposite sides", () => {
    const rows = buildLedgerEntries({
      sales: [{
        _id: "s1",
        createdAt: "2026-09-01T12:00:00.000Z",
        totalAmount: 1200,
        receiptId: "R-100",
        items: [{ name: "Rice", quantity: 2, sellingPrice: 600 }],
      }],
      expenses: [{
        _id: "e1",
        createdAt: "2026-09-01T14:00:00.000Z",
        amount: 350,
        category: "Utilities",
        description: "Power bill",
      }],
    });

    expect(rows).toHaveLength(2);
    expect(rows[0].side).toBe("sale");
    expect(rows[1].side).toBe("expense");
    expect(rows[0].particulars).toContain("Rice");
    expect(rows[1].particulars).toContain("Power bill");
  });

  it("parses a detail route back into a date range for the report summary", () => {
    const parsed = parseReportDetailRoute(new URLSearchParams("label=Yesterday&start=2026-08-31T00%3A00%3A00.000Z&end=2026-08-31T23%3A59%3A59.000Z"));
    expect(parsed.label).toBe("Yesterday");
    expect(parsed.start?.toISOString()).toBe("2026-08-31T00:00:00.000Z");
    expect(parsed.end?.toISOString()).toBe("2026-08-31T23:59:59.000Z");
  });
});
