export const buildReportDetailRoute = ({ label = "Custom range", start, end }) => {
  if (!start || !end) {
    return "/app/reports";
  }

  const params = new URLSearchParams({
    label: String(label),
    start: new Date(start).toISOString(),
    end: new Date(end).toISOString(),
  });

  return `/app/reports/detail?${params.toString()}`;
};

export const parseReportDetailRoute = (searchParams) => {
  const label = searchParams.get("label") || "Custom range";
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  return {
    label,
    start: start ? new Date(start) : null,
    end: end ? new Date(end) : null,
  };
};
