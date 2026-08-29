const StatusToast = ({ message, type = "success", visible = false, onClose }) => {
  if (!visible || !message) return null;

  const styles = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-300",
    error: "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/20 dark:text-red-300",
    info: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/20 dark:text-blue-300",
  };

  return (
    <div className={`fixed right-4 top-4 z-50 max-w-sm rounded-xl border px-4 py-3 shadow-lg backdrop-blur-sm ${styles[type] || styles.success}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-sm font-bold">{type === "error" ? "!" : type === "info" ? "i" : "✓"}</div>
        <div className="flex-1 text-sm font-medium">{message}</div>
        <button
          type="button"
          onClick={onClose}
          className="ml-2 text-xs opacity-70 transition hover:opacity-100"
          aria-label="Dismiss notification"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

export default StatusToast;
