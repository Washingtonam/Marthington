import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar.jsx";
import Topbar from "./Topbar.jsx";

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

export default function AppShell({ children, navigationGroups = defaultNavGroups }) {
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") return "light";
    return localStorage.getItem("theme") || "light";
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", theme === "dark");
      document.documentElement.classList.toggle("light", theme === "light");
    }

    if (typeof window !== "undefined") {
      localStorage.setItem("theme", theme);
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  return (
    <div className="min-h-screen bg-slate-50/90 text-slate-900 transition-colors duration-200 dark:bg-slate-950 dark:text-slate-100">
      <Sidebar
        navigationGroups={navigationGroups}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        theme={theme}
        toggleTheme={toggleTheme}
      />

      <div className="lg:pl-72">
        <Topbar
          onMenuClick={() => setMobileOpen(true)}
          theme={theme}
          toggleTheme={toggleTheme}
        />

        <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  );
}
