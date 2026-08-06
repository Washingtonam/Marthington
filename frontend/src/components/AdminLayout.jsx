import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const AdminLayout = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const navItem = ({ isActive }) =>
    `block px-3 py-2 rounded-md text-sm transition ${
      isActive ? "bg-white text-black font-semibold" : "hover:bg-gray-800"
    }`;

  return (
    <div className="min-h-screen flex bg-gray-100">

      {/* SIDEBAR */}
      <aside className="w-64 bg-black text-white p-5 flex flex-col justify-between">

        <div>
          <h1 className="text-xl font-bold mb-6">Super Admin</h1>

          <nav className="space-y-2">

            <NavLink to="/admin" end className={navItem}>
              Dashboard
            </NavLink>

            <NavLink to="/admin/businesses" className={navItem}>
              Businesses
            </NavLink>

            {/* 🔥 FUTURE READY LINKS */}
            <NavLink to="/admin/revenue" className={navItem}>
              Revenue 💰
            </NavLink>

            <NavLink to="/admin/subscriptions" className={navItem}>
              Subscriptions
            </NavLink>

            <NavLink to="/admin/billing-settings" className={navItem}>
              Billing Settings 💳
            </NavLink>

            <NavLink to="/admin/affiliates" className={navItem}>
              Affiliate Ledger 💰
            </NavLink>

            <NavLink to="/admin/users" className={navItem}>
              Users
            </NavLink>

            <NavLink to="/admin/analytics" className={navItem}>
              Analytics
            </NavLink>

            <NavLink to="/admin/settings" className={navItem}>
              Settings ⚙️
            </NavLink>

            <NavLink to="/admin/operation-logs" className={navItem}>
              Operation Logs
            </NavLink>

          </nav>
        </div>

        {/* LOGOUT */}
        <button
          onClick={() => {
            logout();
            navigate("/login");
          }}
          className="bg-red-500 px-3 py-2 rounded-md text-sm"
        >
          Logout
        </button>

      </aside>

      {/* MAIN AREA */}
      <div className="flex-1 flex flex-col">

        {/* 🔥 TOP BAR (CRITICAL) */}
        <header className="bg-white border-b px-6 py-3 flex justify-between items-center">

          <div>
            <h2 className="font-semibold text-lg">Admin Panel</h2>
            <p className="text-xs text-gray-500">
              Full system control
            </p>
          </div>

          <div className="flex items-center gap-4">

            {/* 🔔 FUTURE NOTIFICATIONS */}
            <div className="text-sm text-gray-500 hidden md:block">
              {user?.email}
            </div>

            <button
              onClick={() => {
                logout();
                navigate("/login");
              }}
              className="text-sm bg-black text-white px-3 py-2 rounded-md"
            >
              Logout
            </button>

          </div>

        </header>

        {/* 🔥 PAGE CONTENT */}
        <main className="flex-1 p-6">
          <Outlet />
        </main>

      </div>

    </div>
  );
};

export default AdminLayout;