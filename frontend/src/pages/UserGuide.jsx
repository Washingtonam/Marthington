import { useMemo } from "react";

const sections = [
  {
    title: "Overview",
    content: [
      "Marthington BMS is a unified business operating system built for retail, schools, and hospitals.",
      "It helps teams manage sales, inventory, customers, staff, analytics, billing, and branch operations from one workspace.",
    ],
  },
  {
    title: "Access & Login",
    content: [
      "Visit the landing page at / to sign in or create a new workspace.",
      "Use the login page to sign in with your email and password.",
      "New businesses can register at /register, and affiliate partners can join at /affiliate-register.",
    ],
  },
  {
    title: "Dashboard",
    content: [
      "The dashboard displays your live business summary, trend metrics, and quick actions.",
      "Use the dashboard refresh button to resync analytics when sales or inventory changes occur.",
    ],
  },
  {
    title: "Sales & POS",
    content: [
      "Open the POS from /app/pos to search products, add items to cart, select a customer, and complete checkout.",
      "The POS supports both products and services, branch inventory selection, and customer receipts.",
      "Completed sales appear in /app/sales, where you can search by receipt, customer, staff, or item.",
    ],
  },
  {
    title: "Products & Inventory",
    content: [
      "Manage product stock, pricing, categories, and SKUs from /app/inventory.",
      "Add, edit, delete, and bulk-import products with the available import template.",
      "Filter products by category and use search to locate items quickly.",
    ],
  },
  {
    title: "Service Management",
    content: [
      "Create and update service offerings in /app/services.",
      "Services can be toggled active or inactive and filtered by category.",
    ],
  },
  {
    title: "Customer Relationship Management",
    content: [
      "Add and manage customer records in /app/customers.",
      "Search by name, phone, email, or address, and filter active accounts or owing balances.",
    ],
  },
  {
    title: "Branch Management",
    content: [
      "Create and manage branches from /app/branches.",
      "Each branch stores its own address, phone, and status information.",
    ],
  },
  {
    title: "Staff & Permissions",
    content: [
      "Use /app/staff to invite team members, assign roles, and set permissions.",
      "Permissions include dashboard access, product management, sales creation, reports, price override, and settings administration.",
    ],
  },
  {
    title: "Analytics & Reports",
    content: [
      "View business performance trends at /app/analytics.",
      "Track revenue, profit, average order value, top products, and customer retention.",
    ],
  },
  {
    title: "Billing & Subscription",
    content: [
      "Manage subscription status and upgrade your plan at /app/billing.",
      "Pay monthly or yearly, and complete payment verification through the portal.",
    ],
  },
  {
    title: "Settings",
    content: [
      "Update your business profile, receipt footer, receipt theme, and logo in /app/settings.",
      "Logo upload and custom themes are available on Pro plans.",
    ],
  },
  {
    title: "Affiliate & Super Admin Portals",
    content: [
      "Affiliate partners use /partners/dashboard, /partners/profile, and /partners/referrals.",
      "Super admins access /admin for tenant management, payout controls, operation logs, and affiliate settings.",
    ],
  },
];

const UserGuide = () => {
  const markdown = useMemo(() => {
    return sections
      .map((section) => {
        return `## ${section.title}\n\n${section.content.map((line) => `- ${line}`).join("\n")}`;
      })
      .join("\n\n");
  }, []);

  const handleDownload = () => {
    const blob = new Blob([`# Marthington BMS User Guide\n\n${markdown}`], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "marthington-bms-user-guide.md";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <section className="mx-auto max-w-6xl space-y-8 py-8">
      <div className="rounded-[32px] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-emerald-50 p-8 shadow-sm dark:border-slate-800 dark:from-slate-950 dark:via-slate-900 dark:to-emerald-950/20">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-600">User Guide</p>
            <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
              Marthington BMS Quick Start & Reference
            </h1>
            <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
              Explore workflows for sales, inventory, customers, staff, analytics, billing, and administration. Download a copy for offline reference.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
            >
              Download Guide
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6 rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          {sections.map((section) => (
            <div key={section.title} className="space-y-3">
              <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{section.title}</h2>
              <div className="space-y-2 text-slate-600 dark:text-slate-300">
                {section.content.map((line) => (
                  <p key={line} className="leading-7">{line}</p>
                ))}
              </div>
            </div>
          ))}
        </div>

        <aside className="space-y-6 rounded-[32px] border border-slate-200 bg-slate-50 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Guide highlights</p>
            <h3 className="mt-3 text-xl font-bold text-slate-900 dark:text-slate-100">What you can do here</h3>
            <ul className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <li>Navigate the app from the sidebar</li>
              <li>Open POS and complete sales</li>
              <li>Manage products, customers, and staff</li>
              <li>Track analytics and billing status</li>
              <li>Download this guide for offline use</li>
            </ul>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Quick links</p>
            <div className="mt-4 space-y-3 text-sm text-slate-700 dark:text-slate-200">
              <p><span className="font-semibold">Dashboard:</span> /app</p>
              <p><span className="font-semibold">POS:</span> /app/pos</p>
              <p><span className="font-semibold">Inventory:</span> /app/inventory</p>
              <p><span className="font-semibold">Settings:</span> /app/settings</p>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
};

export default UserGuide;
