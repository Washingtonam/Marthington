import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import Icon from "./Icon.jsx";

const navItemsByIndustry = {
  retail: [
    {
      label: "Dashboard",
      href: "/app",
      icon: "chart",
      permission: "canViewDashboard",
      isPremium: false
    },
    {
      label: "Products",
      href: "/app/products",
      icon: "boxes",
      permission: "canViewProducts",
      isPremium: false
    },
    {
      label: "Branches",
      href: "/app/branches",
      icon: "building",
      permission: "canManageStaff",
      isPremium: false
    },
    {
      label: "Inventory",
      href: "/app/branches/inventory",
      icon: "layers",
      permission: "canViewProducts",
      isPremium: false
    },
    {
      label: "Services",
      href: "/app/services",
      icon: "package",
      permission: "canViewProducts",
      isPremium: false
    },
    {
      label: "Sales",
      href: "/app/pos",
      icon: "cart",
      permission: "canMakeSale",
      isPremium: false
    },
    {
      label: "Reports",
      href: "/app/reports",
      icon: "chart",
      permission: "canViewReports",
      isPremium: true
    },
    {
      label: "Staff",
      href: "/app/staff",
      icon: "team",
      permission: "canManageStaff",
      isPremium: true
    },
    {
      label: "Customers",
      href: "/app/customers",
      icon: "team",
      permission: "canViewSales",
      isPremium: false
    }
  ],
  school: [
    {
      label: "School Overview",
      href: "/app",
      icon: "chart",
      permission: "canViewDashboard",
      isPremium: false
    },
    {
      label: "Academic Classes",
      href: "/app/classes",
      icon: "package",
      permission: "canViewProducts",
      isPremium: false
    },
    {
      label: "Students & Staff",
      href: "/app/students",
      icon: "team",
      permission: "canViewSales",
      isPremium: false
    },
    {
      label: "Tuition & Fees",
      href: "/app/tuition",
      icon: "wallet",
      permission: "canViewSales",
      isPremium: false
    }
  ],
  hospital: [
    {
      label: "Clinic Overview",
      href: "/app",
      icon: "chart",
      permission: "canViewDashboard",
      isPremium: false
    },
    {
      label: "Patient Records",
      href: "/app/patients",
      icon: "team",
      permission: "canViewSales",
      isPremium: false
    },
    {
      label: "Appointment Book",
      href: "/app/appointments",
      icon: "calendar",
      permission: "canViewSales",
      isPremium: false
    },
    {
      label: "Medical Inventory",
      href: "/app/medical-inventory",
      icon: "boxes",
      permission: "canViewProducts",
      isPremium: false
    }
  ]
};

const sharedNavItems = [
  {
    label: "Invoices",
    href: "/app/invoices",
    icon: "receipt",
    permission: "canViewSales",
    isPremium: false
  },
  {
    label: "Expenses",
    href: "/app/expenses",
    icon: "wallet",
    permission: "canViewReports",
    isPremium: true
  },
  {
    label: "Billing",
    href: "/app/billing",
    icon: "wallet",
    permission: "canManageSettings",
    isPremium: false
  },
  {
    label: "Settings",
    href: "/app/settings",
    icon: "settings",
    permission: "canManageSettings",
    isPremium: false
  },
  {
    label: "User Guide",
    href: "/app/user-guide",
    icon: "book",
    permission: "canManageSettings",
    isPremium: false
  }
];

const AppLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const {
    logout,
    user,
    industryType = "retail",
    isPro, // 🔥 Now using the boolean from your AuthContext
    impersonatedBusiness,
    stopImpersonation
  } = useAuth();

  const navigate = useNavigate();

  // =====================================
  // ACCESS CHECK (Upgraded for Freemium)
  // =====================================
  const hasAccess = (item) => {
    // 1. SUPER ADMIN ALWAYS HAS ACCESS
    if (user?.role === "super_admin") return true;

    // 2. CHECK PREMIUM LOCK
    // If the item is premium and the business is NOT Pro, hide it.
    if (item.isPremium && !isPro) {
      return false;
    }

    // 3. OWNER ALWAYS HAS ACCESS TO REMAINING NON-PRO ITEMS
    if (user?.role === "owner") return true;

    // 4. CHECK SPECIFIC STAFF PERMISSIONS
    if (item.permission) {
      return user?.permissions?.[item.permission] || false;
    }

    return true;
  };

  const selectedNavItems = navItemsByIndustry[industryType] || navItemsByIndustry.retail;
  const filteredNavItems = [...selectedNavItems, ...sharedNavItems].filter(
    (item) => hasAccess(item)
  );

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div 
      className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""} ${sidebarOpen ? "sidebar-open" : ""}`}
      onClick={(e) => {
        // Close sidebar when clicking backdrop on mobile
        if (e.target === e.currentTarget && sidebarOpen) {
          setSidebarOpen(false);
        }
      }}
    >
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""} ${sidebarCollapsed ? "is-collapsed" : ""}`}>
        
        {/* BRAND + CLOSE BUTTON (MOBILE) */}
        <div className="flex items-center justify-between gap-3 px-2">
          <div className="brand-block flex-1">
            <div className="brand-mark">M</div>
            <div>
              <strong className="text-white">Marthington</strong>
              <span>Business OS</span>
            </div>
          </div>
          <button
            className="icon-button-mobile mobile-close"
            type="button"
            onClick={() => setSidebarOpen(false)}
            title="Close sidebar"
          >
            <Icon name="x" />
          </button>
        </div>

        {/* NAVIGATION */}
        <nav className="sidebar-nav mt-6">
          {filteredNavItems.map((item) => (
            <NavLink
                key={item.label}
                to={item.href}
                end={item.href === "/app"}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `nav-item ${isActive ? "active" : ""}`
                }
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
                {item.isPremium && !isPro && (
                   <span className="ml-auto text-[10px] bg-yellow-500 text-black px-1 rounded font-bold">PRO</span>
                )}
              </NavLink>
            ))}
        </nav>

        {/* QUICK ACTIONS */}
        <div className="flex flex-col gap-2 px-4 mt-4">
          <button
            className="quick-create"
            type="button"
            onClick={() => navigate("/app/products")}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span>New Product</span>
          </button>

          {industryType === "retail" && (
            <button
              className="quick-create bg-blue-600 text-white hover:bg-blue-700"
              type="button"
              onClick={() => navigate("/app/pos")}
            >
              <Icon name="cart" />
              <span>New Sale</span>
            </button>
          )}
        </div>
      </aside>

      {/* MAIN PANEL */}
      <div className="main-panel">
        <header className="topbar">
          <button
            className="icon-button mobile-only"
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
          >
            <Icon name="menu" />
          </button>

          <button
            className="icon-button desktop-toggle"
            type="button"
            onClick={() => setSidebarCollapsed((v) => !v)}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Icon name={sidebarCollapsed ? "chevron-right" : "chevron-left"} />
          </button>

          <div className="global-search">
            <Icon name="search" />
            <input placeholder="Search products, sales..." />
            <span className="search-hint">⌘K</span>
          </div>

          {/* IMPERSONATION */}
          {impersonatedBusiness && (
            <div className="flex items-center gap-2 bg-yellow-100 px-3 py-1 rounded-md">
              <span className="text-sm font-medium text-yellow-800">
                Viewing Business
              </span>
              <button
                className="bg-red-500 text-white px-2 py-1 rounded text-xs"
                onClick={stopImpersonation}
              >
                Exit
              </button>
            </div>
          )}

          {/* USER CHIP */}
          <div className="user-chip">
            {!isPro && (
              <button 
                onClick={() => navigate("/app/billing")}
                className="mr-4 text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded border border-yellow-200 font-bold hover:bg-yellow-200 transition-colors"
              >
                UPGRADE TO PRO
              </button>
            )}
            <div>
              <strong className="capitalize">{user?.name}</strong>
              <span className="capitalize">{user?.role?.replace("_", " ")}</span>
            </div>
            <button
              className="icon-button"
              type="button"
              onClick={handleLogout}
            >
              <Icon name="logout" />
            </button>
          </div>
        </header>

        <main className="content-area">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;