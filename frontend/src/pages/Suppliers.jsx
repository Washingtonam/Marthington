import { FiPackage, FiPlus, FiTruck } from "react-icons/fi";

const Suppliers = () => {
  return (
    <section className="mx-auto max-w-7xl space-y-6">
      <div className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-emerald-600">
              Procurement
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              Suppliers
            </h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Manage vendor relationships, contact details, and sourcing activity.
            </p>
          </div>

          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-emerald-700 active:scale-[0.99]"
          >
            <FiPlus />
            Add Supplier
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[
          { title: "Active vendors", value: "18", icon: FiTruck },
          { title: "Pending orders", value: "6", icon: FiPackage },
          { title: "Avg. lead time", value: "4.2 days", icon: FiPackage },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <Icon />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{card.title}</p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                    {card.value}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
          Supplier management views and vendor records will appear here once the procurement workflow is connected.
        </div>
      </div>
    </section>
  );
};

export default Suppliers;
