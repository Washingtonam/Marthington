import { describe, expect, it } from "vitest";
import { buildReportDetailRoute, parseReportDetailRoute } from "../utils/reportDateRouting.js";

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

  it("parses a detail route back into a date range for the report summary", () => {
    const parsed = parseReportDetailRoute(new URLSearchParams("label=Yesterday&start=2026-08-31T00%3A00%3A00.000Z&end=2026-08-31T23%3A59%3A59.000Z"));
    expect(parsed.label).toBe("Yesterday");
    expect(parsed.start?.toISOString()).toBe("2026-08-31T00:00:00.000Z");
    expect(parsed.end?.toISOString()).toBe("2026-08-31T23:59:59.000Z");
  });
});
