import { useEffect, useMemo, useState } from "react";

import {
  createService,
  deleteService,
  getServices,
  toggleServiceStatus,
  updateService
} from "../api/services.js";

import {
  formatCurrency
} from "../utils/formatters.js";

const defaultForm = {
  name: "",
  category: "",
  price: "",
  costPrice: "",
  duration: "",
  code: "",
  description: ""
};

const Services = () => {

  const [services, setServices] =
    useState([]);

  // Defensive wrapper: ensure services is always an array
  const servicesList = Array.isArray(services)
    ? services
    : (services?.data || []);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [selectedCategory, setSelectedCategory] =
    useState("All");

  const [editingId, setEditingId] =
    useState(null);

  const [form, setForm] =
    useState(defaultForm);

  const [isDrawerOpen, setIsDrawerOpen] =
    useState(false);

  const serviceSuggestions = useMemo(() =>
    [...new Set(servicesList.map((service) => service.name).filter(Boolean))],
    [servicesList]
  );

  const [openMenuId, setOpenMenuId] =
    useState(null);

  const formatDisplayText = (value = "") => {
    return String(value)
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .map((word) =>
        word.charAt(0).toUpperCase() + word.slice(1)
      )
      .join(" ");
  };

  // =====================================
  // LOAD SERVICES
  // =====================================

  const loadServices = async () => {

    try {

      setLoading(true);

      const data =
        await getServices();

      setServices(data || []);

    } catch (err) {

      setError(
        err.message ||
        "Failed to load services"
      );

    } finally {

      setLoading(false);

    }
  };

  useEffect(() => {

    loadServices();

  }, []);

  // =====================================
  // FILTERS
  // =====================================

  const categories = useMemo(() => {

    const all =
      servicesList.map(
        (s) => s.category
      );

    return [
      "All",
      ...new Set(all)
    ];

  }, [services]);

  const filteredServices = useMemo(() => {

    return servicesList.filter(
      (service) => {

        const matchSearch =
          service.name
            .toLowerCase()
            .includes(
              search.toLowerCase()
            );

        const matchCategory =
          selectedCategory ===
            "All" ||
          service.category ===
            selectedCategory;

        return (
          matchSearch &&
          matchCategory
        );
      }
    );

  }, [
    services,
    search,
    selectedCategory
  ]);

  // =====================================
  // FORM
  // =====================================

  const handleChange = (e) => {

    const {
      name,
      value
    } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCreateNew = () => {
    setEditingId(null);
    setForm(defaultForm);
    setIsDrawerOpen(true);
  };

  const closeDrawer = () => {
    setIsDrawerOpen(false);
    setEditingId(null);
    setForm(defaultForm);
  };

  // =====================================
  // SAVE
  // =====================================

  const handleSubmit = async (
    e
  ) => {

    e.preventDefault();

    try {

      setSaving(true);

      setError("");

      const payload = {

        name: form.name,

        category:
          form.category,

        price:
          Number(
            form.price
          ) || 0,

        costPrice:
          Number(
            form.costPrice
          ) || 0,

        duration:
          Number(
            form.duration
          ) || 0,

        code:
          form.code,

        description:
          form.description
      };

      if (editingId) {

        await updateService(
          editingId,
          payload
        );

      } else {

        await createService(
          payload
        );
      }

      // RESET
      setForm(defaultForm);

      setEditingId(null);
      setIsDrawerOpen(false);

      await loadServices();

    } catch (err) {

      setError(
        err.message ||
        "Failed to save service"
      );

    } finally {

      setSaving(false);

    }
  };

  // =====================================
  // EDIT
  // =====================================

  const handleEdit = (
    service
  ) => {

    setEditingId(
      service._id
    );

    setForm({

      name:
        service.name || "",

      category:
        service.category ||
        "General",

      price:
        service.price || "",

      costPrice:
        service.costPrice ||
        "",

      duration:
        service.duration ||
        "",

      code:
        service.code || "",

      description:
        service.description ||
        ""
    });

    setIsDrawerOpen(true);
  };

  // =====================================
  // DELETE
  // =====================================

  const handleDelete = async (
    id
  ) => {

    const confirmed =
      window.confirm(
        "Delete this service?"
      );

    if (!confirmed) return;

    try {

      await deleteService(id);

      await loadServices();

    } catch (err) {

      alert(
        err.message ||
        "Delete failed"
      );
    }
  };

  // =====================================
  // TOGGLE
  // =====================================

  const handleToggle =
    async (id) => {

      try {

        await toggleServiceStatus(
          id
        );

        await loadServices();

      } catch (err) {

        alert(
          err.message ||
          "Failed to update"
        );
      }
    };

  return (

    <section className="page-stack">

      {/* HEADER */}

      <div className="page-heading">

        <div>

          <span>
            Service Management
          </span>

          <h1>
            Services
          </h1>

        </div>

        <button
          type="button"
          className="primary-button"
          onClick={handleCreateNew}
        >
          <span className="text-lg leading-none">+</span>
          Create Service
        </button>

      </div>

      {/* ERROR */}

      {error && (

        <div className="form-error">

          {error}

        </div>

      )}

      <div className="tool-panel">

        <div className="panel-heading">

          <div>

            <h2>
              Service Catalog
            </h2>

            <p>
              Manage reusable business services
            </p>

          </div>

        </div>

        <div className="service-filter-bar">

          <div className="service-filter-pills">

            {categories.map(
              (category) => (

                <button
                  key={category}
                  type="button"
                  onClick={() =>
                    setSelectedCategory(
                      category
                    )
                  }
                  className={`service-filter-pill ${
                    selectedCategory ===
                    category
                      ? "active"
                      : ""
                  }`}
                >

                  {category}

                </button>
              )
            )}

          </div>

          <label className="service-search-field">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
              <circle cx="11" cy="11" r="6"></circle>
              <path d="M20 20L16.5 16.5"></path>
            </svg>
            <input
              type="text"
              placeholder="Search services"
              value={search}
              onChange={(e) =>
                setSearch(
                  e.target.value
                )
              }
            />
          </label>

        </div>

        <div className="product-table">

          <div className="product-row product-row-head">

            <span>
              Service
            </span>

            <span>
              Price
            </span>

            <span>
              Status
            </span>

            <span>
              Actions
            </span>

          </div>

          {loading && (

            <div className="empty-state">
              Loading services...
            </div>

          )}

          {!loading &&
            !filteredServices.length && (

            <div className="empty-state">
              No services found
            </div>

          )}

          {filteredServices.map(
            (service) => (

              <div
                key={service._id}
                className="product-row"
              >

                <div className="service-name-cell">

                  <strong>
                    {formatDisplayText(service.name)}
                  </strong>

                  <div className="service-meta">

                    {formatDisplayText(
                      service.category || "General"
                    )}

                  </div>

                </div>

                <span>

                  {
                    formatCurrency(
                      service.price
                    )
                  }

                </span>

                <span>

                  <span
                    className={`status-pill ${
                      service.isActive
                        ? "success"
                        : "danger"
                    }`}
                  >

                    {service.isActive
                      ? "Active"
                      : "Inactive"}

                  </span>

                </span>

                <div className="service-actions">
                  <div className="relative">
                    <button
                      type="button"
                      className="service-menu-button"
                      onClick={() =>
                        setOpenMenuId(
                          openMenuId === service._id
                            ? null
                            : service._id
                        )
                      }
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                        <circle cx="5" cy="12" r="1.5"></circle>
                        <circle cx="12" cy="12" r="1.5"></circle>
                        <circle cx="19" cy="12" r="1.5"></circle>
                      </svg>
                    </button>

                    {openMenuId === service._id && (
                      <div className="service-menu">
                        <button
                          type="button"
                          onClick={() => {
                            handleEdit(service);
                            setOpenMenuId(null);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            handleToggle(service._id);
                            setOpenMenuId(null);
                          }}
                        >
                          {service.isActive
                            ? "Disable"
                            : "Enable"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            handleDelete(service._id);
                            setOpenMenuId(null);
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            )
          )}

        </div>

      </div>

      <div
        className={`service-drawer-overlay ${isDrawerOpen ? "open" : ""}`}
        onClick={closeDrawer}
      />

      <aside className={`service-drawer ${isDrawerOpen ? "open" : ""}`}>
        <div className="service-drawer-header">
          <div>
            <p>Service Builder</p>
            <h3>
              {editingId ? "Edit Service" : "Create Service"}
            </h3>
          </div>
          <button
            type="button"
            className="service-drawer-close"
            onClick={closeDrawer}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="service-drawer-form">

          <label>

            Service Name

            <input
              name="name"
              list="service-name-suggestions"
              value={form.name}
              onChange={handleChange}
              placeholder="Enter service name..."
            />
            <datalist id="service-name-suggestions">
              {serviceSuggestions.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>

          </label>

          <div className="form-grid">

            <label>

              Category

              <input
                name="category"

                value={
                  form.category
                }

                onChange={
                  handleChange
                }

                placeholder="Select or type a category..."
              />

            </label>

            <label>

              Service Code

              <input
                name="code"

                value={form.code}

                onChange={
                  handleChange
                }

                placeholder="Leave blank to auto-generate"
              />

            </label>

          </div>

          <div className="form-grid">

            <label>

              Selling Price

              <div className="flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm">
                <span className="mr-2 text-slate-500">₦</span>
                <input
                  type="number"

                  name="price"

                  value={form.price}

                  onChange={
                    handleChange
                  }

                  placeholder="0.00"
                  className="w-full border-0 bg-transparent outline-none"
                />
              </div>

            </label>

            <label>

              Cost Price

              <div className="flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm">
                <span className="mr-2 text-slate-500">₦</span>
                <input
                  type="number"

                  name="costPrice"

                  value={
                    form.costPrice
                  }

                  onChange={
                    handleChange
                  }

                  placeholder="0.00"
                  className="w-full border-0 bg-transparent outline-none"
                />
              </div>

            </label>

          </div>

          <label>

            Duration (Minutes)

            <input
              type="number"

              name="duration"

              value={
                form.duration
              }

              onChange={
                handleChange
              }

              placeholder="Duration in minutes"
            />

          </label>

          <label>

            Description

            <input
              name="description"

              value={
                form.description
              }

              onChange={
                handleChange
              }

              placeholder="Add a short description..."
            />

          </label>

          <button
            type="submit"
            disabled={saving}
            className="primary-button"
          >

            {saving
              ? "Saving..."
              : editingId
              ? "Update Service"
              : "Create Service"}

          </button>

          {editingId && (

            <button
              type="button"
              onClick={closeDrawer}
              className="ghost-button"
            >
              Cancel Editing
            </button>

          )}

        </form>

      </aside>

    </section>
  );
};

export default Services;