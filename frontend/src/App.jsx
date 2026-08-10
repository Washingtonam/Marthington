import React, { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.jsx";

// ====================================
// CORE COMPONENTS
// ====================================
import AppShell from "./components/layout/AppShell.jsx";
import AdminLayout from "./components/AdminLayout.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";

// ====================================
// LAZY LOADED PAGES (Fixes Initialization Race)
// ====================================
const Landing = lazy(() => import("./pages/Landing.jsx"));
const Login = lazy(() => import("./pages/Login.jsx"));
const Register = lazy(() => import("./pages/Register.jsx"));
const AffiliateRegister = lazy(() => import("./pages/AffiliateRegister.jsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));
const Products = lazy(() => import("./pages/Products.jsx"));
const POS = lazy(() => import("./pages/POS.jsx"));
const Sales = lazy(() => import("./pages/Sales.jsx"));
const SaleDetails = lazy(() => import("./pages/SaleDetails.jsx"));
const Staff = lazy(() => import("./pages/Staff.jsx"));
const Settings = lazy(() => import("./pages/Settings.jsx"));
const Reports = lazy(() => import("./pages/Reports.jsx"));
const Analytics = lazy(() => import("./pages/Analytics.jsx"));
const DeletedSales = lazy(() => import("./pages/DeletedSales.jsx"));
const Billing = lazy(() => import("./pages/Billing.jsx"));
const Invoices = lazy(() => import("./pages/Invoices.jsx"));
const VerifyPayment = lazy(() => import("./pages/VerifyPayment.jsx"));
const Customers = lazy(() => import("./pages/Customers.jsx"));
const Services = lazy(() => import("./pages/Services.jsx"));
const Branches = lazy(() => import("./pages/Branches.jsx"));
const BranchInventory = lazy(() => import("./pages/BranchInventory.jsx"));
const StaffReports = lazy(() => import("./pages/StaffReports.jsx"));
const InventoryReports = lazy(() => import("./pages/InventoryReports.jsx"));
const CustomerView = lazy(() => import("./pages/CustomerView.jsx"));
const PublicReceipt = lazy(() => import("./pages/PublicReceipt.jsx"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard.jsx"));
const AdminBusinessView = lazy(() => import("./pages/AdminBusinessView.jsx"));
const AdminBillingSettings = lazy(() => import("./pages/AdminBillingSettings.jsx"));
const AdminOperationLogs = lazy(() => import("./pages/AdminOperationLogs.jsx"));
const Expenses = lazy(() => import("./pages/Expenses.jsx"));
const SchoolDashboard = lazy(() => import("./pages/SchoolDashboard.jsx"));
const HospitalDashboard = lazy(() => import("./pages/HospitalDashboard.jsx"));
const PartnersDashboard = lazy(() => import("./pages/PartnersDashboard.jsx"));
const PartnerProfile = lazy(() => import("./pages/PartnerProfile.jsx"));
const PartnersReferrals = lazy(() => import("./pages/PartnersReferrals.jsx"));
const AdminPayouts = lazy(() => import("./pages/AdminPayouts.jsx"));
const AdminPartnersLedger = lazy(() => import("./pages/AdminPartnersLedger.jsx"));
const UserGuide = lazy(() => import("./pages/UserGuide.jsx"));

const Students = () => (
  <div className="page-shell">
    <h1 className="text-3xl font-bold">Students List</h1>
    <p className="mt-3 text-sm text-gray-600">
      Track student enrollment, profiles, and class assignments.
    </p>
  </div>
);

const Tuition = () => (
  <div className="page-shell">
    <h1 className="text-3xl font-bold">Tuition Tracker</h1>
    <p className="mt-3 text-sm text-gray-600">
      Monitor tuition payments and billing for your school.
    </p>
  </div>
);

const Classes = () => (
  <div className="page-shell">
    <h1 className="text-3xl font-bold">Class Schedules</h1>
    <p className="mt-3 text-sm text-gray-600">
      Manage class timetables and session schedules.
    </p>
  </div>
);

const Patients = () => (
  <div className="page-shell">
    <h1 className="text-3xl font-bold">Patient Records</h1>
    <p className="mt-3 text-sm text-gray-600">
      Access patient history, charts, and care notes.
    </p>
  </div>
);

const Appointments = () => (
  <div className="page-shell">
    <h1 className="text-3xl font-bold">Appointment Book</h1>
    <p className="mt-3 text-sm text-gray-600">
      Schedule and track appointments for your clinic.
    </p>
  </div>
);

const MedicalInventory = () => (
  <div className="page-shell">
    <h1 className="text-3xl font-bold">Medical Inventory</h1>
    <p className="mt-3 text-sm text-gray-600">
      Manage medical stock and supplies for your hospital.
    </p>
  </div>
);

const AdminBusinesses = AdminDashboard;
const AdminRevenue = () => (
  <section className="page-stack">
    <div className="page-heading">
      <div>
        <span className="text-sm uppercase tracking-[0.3em] text-slate-500">Super Admin</span>
        <h1 className="mt-2 text-4xl font-semibold text-slate-900">Revenue</h1>
      </div>
      <p className="max-w-2xl text-sm text-slate-500">
        Review global revenue and high-level income trends.
      </p>
    </div>
  </section>
);

const AdminSubscriptions = () => (
  <section className="page-stack">
    <div className="page-heading">
      <div>
        <span className="text-sm uppercase tracking-[0.3em] text-slate-500">Super Admin</span>
        <h1 className="mt-2 text-4xl font-semibold text-slate-900">Subscriptions</h1>
      </div>
      <p className="max-w-2xl text-sm text-slate-500">
        Manage tenant subscriptions, billing cycles, and plan states.
      </p>
    </div>
  </section>
);

const AdminUsers = () => (
  <section className="page-stack">
    <div className="page-heading">
      <div>
        <span className="text-sm uppercase tracking-[0.3em] text-slate-500">Super Admin</span>
        <h1 className="mt-2 text-4xl font-semibold text-slate-900">Users</h1>
      </div>
      <p className="max-w-2xl text-sm text-slate-500">
        Manage platform users, roles, and access across all tenants.
      </p>
    </div>
  </section>
);

const AdminAnalytics = Reports;
const AdminSettings = Settings;

// Simple loading fallback
const PageLoader = () => (
  <div className="h-screen w-screen flex items-center justify-center bg-gray-50">
    <div className="flex flex-col items-center gap-2">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Marthington</p>
    </div>
  </div>
);

const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        {/* Suspense handles the waiting period while a page is being downloaded */}
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* LANDING */}
            <Route path="/" element={<Landing />} />

            {/* AUTH */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/affiliate-register" element={<AffiliateRegister />} />

            {/* PUBLIC RECEIPT */}
            <Route path="/r/:id" element={<PublicReceipt />} />

            {/* PARTNER DASHBOARD (STANDALONE) */}
            <Route path="/partners" element={<Navigate to="/partners/dashboard" replace />} />
            <Route
              path="/partners/dashboard"
              element={
                <ProtectedRoute requiredRole="affiliate">
                  <PartnersDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/partners/profile"
              element={
                <ProtectedRoute requiredRole="affiliate">
                  <PartnerProfile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/partners/referrals"
              element={
                <ProtectedRoute requiredRole="affiliate">
                  <PartnersReferrals />
                </ProtectedRoute>
              }
            />

            {/* ADMIN PAYOUTS */}
            <Route
              path="/admin/payouts"
              element={
                <ProtectedRoute requiredRole="super_admin">
                  <AdminPayouts />
                </ProtectedRoute>
              }
            />

            {/* ADMIN PARTNERS LEDGER */}
            <Route
              path="/admin/affiliates"
              element={
                <ProtectedRoute requiredRole="super_admin">
                  <AdminPartnersLedger />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/partners-ledger"
              element={
                <ProtectedRoute requiredRole="super_admin">
                  <AdminPartnersLedger />
                </ProtectedRoute>
              }
            />

            {/* CUSTOMER VIEW (STANDALONE) */}
            <Route 
              path="/app/customer-view" 
              element={
                <ProtectedRoute>
                  <CustomerView />
                </ProtectedRoute>
              } 
            />

            {/* ================= NORMAL APP ================= */}
            <Route
              path="/app"
              element={
                <ProtectedRoute>
                  <AppShell />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="products" element={<Products />} />
              <Route path="branches" element={<Branches />} />
              <Route path="branches/inventory" element={<BranchInventory />} />
              <Route path="pos" element={<POS />} />
              <Route path="sales" element={<Sales />} />
              <Route path="sales/:id" element={<SaleDetails />} />
              <Route path="staff" element={<Staff />} />
              <Route path="settings" element={<Settings />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="reports" element={<Reports />} />
              <Route path="inventory" element={<BranchInventory />} />
              <Route path="deleted-sales" element={<DeletedSales />} />
              <Route path="staff-reports" element={<StaffReports />} />
              <Route path="inventory-reports" element={<InventoryReports />} />
              <Route path="billing" element={<Billing />} />
              <Route path="user-guide" element={<UserGuide />} />
              <Route path="verify-payment" element={<VerifyPayment />} />
              <Route path="invoices" element={<Invoices />} />
              <Route path="customers" element={<Customers />} />
              <Route path="services" element={<Services />} />
              <Route path="expenses" element={<Expenses />} />
              <Route
                path="school-dashboard"
                element={
                  <ProtectedRoute requiredIndustry="school">
                    <SchoolDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="hospital-dashboard"
                element={
                  <ProtectedRoute requiredIndustry="hospital">
                    <HospitalDashboard />
                  </ProtectedRoute>
                }
              />
              <Route path="students" element={<Students />} />
              <Route path="tuition" element={<Tuition />} />
              <Route path="classes" element={<Classes />} />
              <Route path="patients" element={<Patients />} />
              <Route path="appointments" element={<Appointments />} />
              <Route path="medical-inventory" element={<MedicalInventory />} />
            </Route>

            {/* ================= ADMIN ================= */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute requiredRole="super_admin">
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<AdminDashboard />} />
              <Route path="businesses" element={<AdminBusinesses />} />
              <Route path="revenue" element={<AdminRevenue />} />
              <Route path="subscriptions" element={<AdminSubscriptions />} />
              <Route path="billing-settings" element={<AdminBillingSettings />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="analytics" element={<AdminAnalytics />} />
              <Route path="settings" element={<AdminSettings />} />
              <Route path="operation-logs" element={<AdminOperationLogs />} />
              <Route path="business/:id" element={<AdminBusinessView />} />
            </Route>

            {/* FALLBACK */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;