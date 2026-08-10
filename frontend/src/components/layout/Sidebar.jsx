import { NavLink } from "react-router-dom";

const defaultNavGroups = [
  {
    label: "Main",
    items: [{ to: "/app", label: "Dashboard", icon: "◉" }],
  },
  {
    label: "Operations",
    items: [
      { to: "/app/sales", label: "Sales & POS", icon: "▣" },
      { to: "/app/invoices", label: "Invoices", icon: "◫" },
      { to: "/app/inventory", label: "Inventory", icon: "◧" },
    ],
  },
  {
    label: "Relationships",
    items: [
      { to: "/app/customers", label: "Customers / CRM", icon: "◌" },
      { to: "/app/staff", label: "Staff", icon: "◎" },
    ],
  },
  {
    label: "Insights & Admin",
    items: [
      { to: "/app/analytics", label: "Analytics", icon: "⬢" },
      { to: "/app/billing", label: "Billing", icon: "⬡" },
      { to: "/app/settings", label: "Settings", icon: "⚙" },
    ],
  },
];

export default function Sidebar({
  navigationGroups = defaultNavGroups,
  mobileOpen,
  setMobileOpen,
  theme,
  toggleTheme,
}) {
  return (
    <>
      <div
        className={`fixed inset-0 z-30 bg-slate-900/30 backdrop-blur-[2px] transition-opacity duration-200 lg:hidden ${
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setMobileOpen(false)}
      />

      <aside
        className={`fixed left-0 top-0 z-40 flex h-screen w-72 flex-col border-r border-slate-200 bg-white/95 backdrop-blur transition-transform duration-300 dark:border-slate-800 dark:bg-slate-950/95 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-400">
              Marthington
            </p>
            <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Business Hub
            </p>
          </div>

          <button
            className="rounded-lg border border-slate-200 p-2 text-slate-600 transition-all duration-150 hover:bg-slate-100 active:scale-[0.98] dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden"
            onClick={() => setMobileOpen(false)}
            type="button"
          >
            ✕
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {navigationGroups.map((group) => (
            <div key={group.label} className="mb-5">
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
                {group.label}
              </p>

              <div className="space-y-1">
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === "/app"}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 active:scale-[0.99] ${
                        isActive
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                      }`
                    }
                  >
                    <span className="text-base">{item.icon}</span>
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-slate-200 p-3 dark:border-slate-800">
          <button
            onClick={toggleTheme}
            className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-all duration-150 hover:bg-slate-50 active:scale-[0.99] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            type="button"
          >
            <span>{theme === "dark" ? "☀️ Light Mode" : "🌙 Dark Mode"}</span>
            <span className="text-xs text-slate-400">Toggle</span>
          </button>
        </div>
      </aside>
    </>
  );
}
