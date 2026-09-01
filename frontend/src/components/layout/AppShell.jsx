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
    label: "Sales & Operations",
    items: [
      { to: "/app/pos", label: "POS", icon: "🛒" },
      { to: "/app/sales", label: "Sales", icon: "▣" },
      { to: "/app/invoices", label: "Invoices", icon: "◫" },
      { to: "/app/payments", label: "Payments", icon: "💳" },
      { to: "/app/customers", label: "Customers / CRM", icon: "◌" },
    ],
  },
  {
    label: "Catalog & Inventory",
    items: [
      { to: "/app/products", label: "Products", icon: "📦" },
      { to: "/app/services", label: "Services", icon: "🛠️" },
      { to: "/app/inventory", label: "Inventory", icon: "◧" },
      { to: "/app/suppliers", label: "Suppliers", icon: "🏭" },
      { to: "/app/purchase-orders", label: "Purchase Orders", icon: "🧾" },
    ],
  },
  {
    label: "Finance & Control",
    items: [
      { to: "/app/expenses", label: "Expenses", icon: "💸" },
      { to: "/app/billing", label: "Billing", icon: "⬡" },
      { to: "/app/reports", label: "Reports", icon: "📊" },
      { to: "/app/analytics", label: "Analytics", icon: "⬢" },
    ],
  },
  {
    label: "Team & Access",
    items: [
      { to: "/app/staff", label: "Staff", icon: "◎" },
      { to: "/app/settings?tab=access", label: "Roles & Permissions", icon: "🛡️" },
    ],
  },
  {
    label: "People & Locations",
    items: [
      { to: "/app/branches", label: "Branches", icon: "🏢" },
    ],
  },
  {
    label: "System",
    items: [
      { to: "/app/settings", label: "Settings", icon: "⚙" },
      { to: "/app/user-guide", label: "User Guide", icon: "📘" },
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
