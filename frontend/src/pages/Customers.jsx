import { useEffect, useMemo, useState } from "react";
import { FiMail, FiPhone, FiPlus, FiSearch, FiUsers, FiX } from "react-icons/fi";
import { getCustomers } from "../api/customers.js";
import { formatCurrency } from "../utils/formatters.js";

const createEmptyForm = () => ({
  name: "",
  phone: "",
  email: "",
  address: "",
  status: "active",
  outstandingBalance: "0",
  totalSpent: "0",
  totalOrders: "1",
});

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [previewCustomer, setPreviewCustomer] = useState(null);
  const [form, setForm] = useState(createEmptyForm());

  useEffect(() => {
    const load = async () => {
      const data = await getCustomers();
      setCustomers(data || []);
    };

    load();
  }, []);

  const filteredCustomers = useMemo(() => {
    const query = search.toLowerCase();

    return customers.filter((customer) => {
      const matchesQuery =
        !query ||
        [customer.name, customer.phone, customer.email, customer.address]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));

      if (!matchesQuery) return false;

      const totalOutstanding = Number(customer.outstandingBalance || customer.balance || 0);
      const isActive = customer.status === "active" || customer.isActive === true;
      const isOwing = totalOutstanding > 0;

      switch (filter) {
        case "active":
          return isActive;
        case "owing":
          return isOwing;
        case "vip":
          return Number(customer.totalSpent || 0) > 500000;
        default:
          return true;
      }
    });
  }, [customers, filter, search]);

  const summary = useMemo(() => {
    const totalCustomers = customers.length;
    const activeCustomers = customers.filter((customer) => customer.status === "active" || customer.isActive === true).length;
    const outstandingBalance = customers.reduce((sum, customer) => sum + Number(customer.outstandingBalance || customer.balance || 0), 0);
    const newThisMonth = customers.filter((customer) => {
      const createdAt = customer.createdAt || customer.created_at;
      if (!createdAt) return false;
      const date = new Date(createdAt);
      const now = new Date();
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }).length;

    return { totalCustomers, activeCustomers, outstandingBalance, newThisMonth };
  }, [customers]);

  const filterOptions = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "owing", label: "Owing Balance" },
    { key: "vip", label: "VIP / Frequent" },
  ];

  const openCreateDrawer = () => {
    setForm(createEmptyForm());
    setDrawerOpen(true);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const newCustomer = {
      _id: `local-${Date.now()}`,
      name: form.name.trim() || "Unnamed customer",
      phone: form.phone.trim(),
      email: form.email.trim(),
      address: form.address.trim(),
      totalSpent: Number(form.totalSpent || 0),
      totalOrders: Number(form.totalOrders || 1),
      status: form.status || "active",
      outstandingBalance: Number(form.outstandingBalance || 0),
      createdAt: new Date().toISOString(),
    };

    setCustomers((current) => [newCustomer, ...current]);
    setDrawerOpen(false);
    setPreviewCustomer(newCustomer);
  };

  return (
    <section className="mx-auto max-w-7xl space-y-6">
      <div className="rounded-[32px] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-emerald-50 p-5 shadow-sm sm:p-6 dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950/20">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-emerald-600 dark:text-emerald-400">
              CRM
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              Customer relationships
            </h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Manage contacts, balances, and customer growth in one place.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateDrawer}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-emerald-700 active:scale-[0.99]"
          >
            <FiPlus />
            Add Customer
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total Customers", value: summary.totalCustomers, tone: "emerald" },
          { label: "Active Accounts", value: summary.activeCustomers, tone: "sky" },
          { label: "Outstanding Balance", value: formatCurrency(summary.outstandingBalance), tone: "amber" },
          { label: "New This Month", value: summary.newThisMonth, tone: "slate" },
        ].map((card) => (
          <div
            key={card.label}
            className={`rounded-[24px] border p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
              card.tone === "emerald"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300"
                : card.tone === "sky"
                  ? "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-300"
                  : card.tone === "amber"
                    ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300"
                    : "border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
            }`}
          >
            <p className="text-sm font-medium">{card.label}</p>
            <p className="mt-4 text-2xl font-semibold tracking-tight">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1">
            <label className="sr-only" htmlFor="customer-search">
              Search customers
            </label>
            <div className="relative">
              <FiSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="customer-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name, phone, or email"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm outline-none ring-0 transition-all duration-150 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {filterOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setFilter(option.key)}
                className={`rounded-full px-3 py-2 text-sm font-medium transition-all duration-150 active:scale-[0.99] ${
                  filter === option.key
                    ? "bg-emerald-600 text-white"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 hidden lg:block overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                <th className="pb-3">Customer</th>
                <th className="pb-3">Contact</th>
                <th className="pb-3">Value</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                    No matching customers found.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => {
                  const totalOutstanding = Number(customer.outstandingBalance || customer.balance || 0);
                  const isActive = customer.status === "active" || customer.isActive === true;
                  const isOwing = totalOutstanding > 0;
                  const statusClasses = isOwing
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                    : isActive
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";

                  return (
                    <tr key={customer._id} className="text-sm text-slate-700 dark:text-slate-300">
                      <td className="py-3 pr-4">
                        <div>
                          <p className="font-semibold">{customer.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {customer.address || "No address on file"}
                          </p>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <div>
                          <p>{customer.phone || "—"}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{customer.email || "—"}</p>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <div>
                          <p>{formatCurrency(customer.totalSpent || 0)}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {customer.totalOrders || 0} orders
                          </p>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClasses}`}>
                          {isOwing ? "Owing" : isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setPreviewCustomer(customer)}
                            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            View
                          </button>
                          <button
                            type="button"
                            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            Invoice
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-5 space-y-3 lg:hidden">
          {filteredCustomers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              No matching customers found.
            </div>
          ) : (
            filteredCustomers.map((customer) => {
              const totalOutstanding = Number(customer.outstandingBalance || customer.balance || 0);
              const isActive = customer.status === "active" || customer.isActive === true;
              const isOwing = totalOutstanding > 0;

              return (
                <div key={customer._id} className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{customer.name}</p>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{customer.phone || customer.email || "No contact info"}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${isOwing ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" : isActive ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"}`}>
                      {isOwing ? "Owing" : isActive ? "Active" : "Inactive"}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
                    <span>{formatCurrency(customer.totalSpent || 0)}</span>
                    <span>{customer.totalOrders || 0} orders</span>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewCustomer(customer)}
                      className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-all duration-150 hover:bg-slate-100 active:scale-[0.99] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    >
                      View profile
                    </button>
                    <button
                      type="button"
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-all duration-150 hover:bg-slate-100 active:scale-[0.99] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    >
                      Invoice
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-sm">
          <div className="h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-2xl dark:bg-slate-900">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-emerald-600">CRM</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">New Customer</h2>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Create a new customer profile and start tracking their value immediately.</p>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="rounded-full border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
              >
                <FiX />
              </button>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  <span className="mb-2 block">Customer name</span>
                  <input
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    required
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none transition focus:border-emerald-400 focus:bg-white dark:border-slate-700 dark:bg-slate-950"
                    placeholder="Ava Stone"
                  />
                </label>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  <span className="mb-2 block">Status</span>
                  <select
                    name="status"
                    value={form.status}
                    onChange={handleChange}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none transition focus:border-emerald-400 focus:bg-white dark:border-slate-700 dark:bg-slate-950"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  <span className="mb-2 block">Phone</span>
                  <input
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none transition focus:border-emerald-400 focus:bg-white dark:border-slate-700 dark:bg-slate-950"
                    placeholder="555-0100"
                  />
                </label>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  <span className="mb-2 block">Email</span>
                  <input
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none transition focus:border-emerald-400 focus:bg-white dark:border-slate-700 dark:bg-slate-950"
                    placeholder="ava@example.com"
                  />
                </label>
              </div>

              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                <span className="mb-2 block">Address</span>
                <input
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none transition focus:border-emerald-400 focus:bg-white dark:border-slate-700 dark:bg-slate-950"
                  placeholder="123 Main Street"
                />
              </label>

              <div className="grid gap-4 md:grid-cols-3">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  <span className="mb-2 block">Total spent</span>
                  <input
                    name="totalSpent"
                    type="number"
                    value={form.totalSpent}
                    onChange={handleChange}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none transition focus:border-emerald-400 focus:bg-white dark:border-slate-700 dark:bg-slate-950"
                  />
                </label>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  <span className="mb-2 block">Orders</span>
                  <input
                    name="totalOrders"
                    type="number"
                    value={form.totalOrders}
                    onChange={handleChange}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none transition focus:border-emerald-400 focus:bg-white dark:border-slate-700 dark:bg-slate-950"
                  />
                </label>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  <span className="mb-2 block">Balance</span>
                  <input
                    name="outstandingBalance"
                    type="number"
                    value={form.outstandingBalance}
                    onChange={handleChange}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none transition focus:border-emerald-400 focus:bg-white dark:border-slate-700 dark:bg-slate-950"
                  />
                </label>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-all duration-150 hover:bg-slate-50 active:scale-[0.99] dark:border-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-emerald-700 active:scale-[0.99]"
                >
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {previewCustomer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-sm">
          <div className="h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-2xl dark:bg-slate-900">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-emerald-600">Customer profile</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">{previewCustomer.name}</h2>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{previewCustomer.address || "No address on file"}</p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewCustomer(null)}
                className="rounded-full border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
              >
                <FiX />
              </button>
            </div>

            <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <FiUsers />
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Relationship health</p>
                  <p className="text-xl font-semibold text-slate-900 dark:text-slate-100">High-value account</p>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[20px] border border-slate-200 p-4 dark:border-slate-800">
                <p className="text-sm text-slate-500 dark:text-slate-400">Lifetime spend</p>
                <p className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(previewCustomer.totalSpent || 0)}</p>
              </div>
              <div className="rounded-[20px] border border-slate-200 p-4 dark:border-slate-800">
                <p className="text-sm text-slate-500 dark:text-slate-400">Outstanding balance</p>
                <p className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(previewCustomer.outstandingBalance || 0)}</p>
              </div>
            </div>

            <div className="mt-5 rounded-[24px] border border-slate-200 p-4 dark:border-slate-800">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                <FiPhone />
                <span>{previewCustomer.phone || "No phone number"}</span>
              </div>
              <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                <FiMail />
                <span>{previewCustomer.email || "No email on record"}</span>
              </div>
            </div>

            <div className="mt-5 rounded-[24px] border border-slate-200 p-4 dark:border-slate-800">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Recent activity</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                <li>• Last invoice issued 2 days ago</li>
                <li>• 2 orders placed this year</li>
                <li>• Follow-up recommended for payment review</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default Customers;