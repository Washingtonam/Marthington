import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { updateBusiness } from "../api/business.js";
import { useAuth } from "../context/AuthContext.jsx";
import request from "../api/client.js";
import { getOfflineSnapshotMeta, saveOfflineSnapshot } from "../api/offlineDb.js";

const Settings = () => {
  const location = useLocation();
  const navigate = useNavigate(); // 🔥 Added to help clear the URL after success

  const {
    business,
    isPro,
    refreshBusiness,
    loadingBusiness
  } = useAuth();

  const [activeTab, setActiveTab] = useState("business");

  const [form, setForm] = useState({
    name: "",
    address: "",
    phone: "",
    email: "",
    businessType: "general_services",
    receiptFooter: "",
    receiptTheme: "modern",
    logo: ""
  });

  const [loading, setLoading] = useState(false);
  const [upgradeMsg, setUpgradeMsg] = useState("");
  const [processingPayment, setProcessingPayment] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [downloadingOfflineData, setDownloadingOfflineData] = useState(false);
  const [offlineDataSummary, setOfflineDataSummary] = useState(null);
  const [pricing, setPricing] = useState({
    monthly: { ngn: 15000, usd: 10 },
    yearly: { ngn: 150000, usd: 100 }
  });

  // 🔥 SYNC FORM (Preserved)
  useEffect(() => {
    if (!business) return;

    setForm({
      name: business.name || "",
      address: business.address || "",
      phone: business.phone || "",
      email: business.email || "",
      businessType: business.businessType || "general_services",
      receiptFooter: business.receiptFooter || "",
      receiptTheme: business.receiptTheme || "modern",
      logo: ""
    });
  }, [business]);

  // 🔥 FETCH DYNAMIC PRICING (NEW)
  useEffect(() => {
    const loadPricing = async () => {
      try {
        const data = await request("/billing/pricing");
        if (data?.data) {
          setPricing(data.data);
        }
      } catch (err) {
        console.error("Failed to load pricing:", err);
      }
    };
    loadPricing();
  }, []);

  useEffect(() => {
    getOfflineSnapshotMeta().then((syncedAt) => {
      if (syncedAt) setOfflineDataSummary({ syncedAt });
    });
  }, []);

  const downloadOfflineData = async () => {
    setDownloadingOfflineData(true);
    setUpgradeMsg("");

    try {
      const snapshot = await request("/sync/bootstrap");
      const syncedAt = await saveOfflineSnapshot(snapshot);
      const recordCount = [
        snapshot.products,
        snapshot.services,
        snapshot.customers,
        snapshot.suppliers,
        snapshot.branches,
        snapshot.branchInventory,
        snapshot.sales,
        snapshot.expenses,
        snapshot.invoices,
        snapshot.budgets
      ].reduce((total, records) => total + (Array.isArray(records) ? records.length : 0), 0);

      setOfflineDataSummary({ syncedAt, recordCount });
      setUpgradeMsg(`Offline data downloaded successfully (${recordCount.toLocaleString()} records).`);
    } catch (error) {
      setUpgradeMsg(error.message || "Could not download offline data.");
    } finally {
      setDownloadingOfflineData(false);
    }
  };

  const verifyPaystackRedirect = useCallback(async (reference) => {
    if (!reference) return;

    setVerifying(true);
    setUpgradeMsg("Verifying your transaction with Paystack...");

    try {
      const result = await request("/payments/verify-redirect", {
        method: "POST",
        body: JSON.stringify({ reference })
      });

      await refreshBusiness();

      setUpgradeMsg(result?.message || "🎉 Upgrade successful! Your Pro features are now active.");
      setVerifying(false);

      navigate("/settings", { replace: true });
    } catch (err) {
      setUpgradeMsg(err.message || "Payment verification failed. Please contact support.");
      setVerifying(false);
    }
  }, [navigate, refreshBusiness]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const reference = params.get("reference");

    if (reference) {
      verifyPaystackRedirect(reference);
    }
  }, [location.search, verifyPaystackRedirect]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "receiptTheme" && !isPro && value !== "modern") {
      setUpgradeMsg("Custom themes are available on Pro plan.");
      return;
    }

    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleLogo = async (e) => {
    if (!isPro) {
      setUpgradeMsg("Logo upload is a Pro feature.");
      return;
    }

    const file = e.target.files?.[0];
    if (!file) return;

    const img = new Image();
    const reader = new FileReader();

    reader.onload = (event) => {
      img.src = event.target.result;
    };

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const MAX_WIDTH = 300;
      const scale = Math.min(1, MAX_WIDTH / img.width);

      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        (blob) => {
          const compressedFile = new File([blob], file.name, {
            type: "image/jpeg"
          });

          setForm((prev) => ({
            ...prev,
            logo: compressedFile
          }));
        },
        "image/jpeg",
        0.7
      );
    };

    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await updateBusiness(form);
      setUpgradeMsg("Settings updated successfully");
      await refreshBusiness();
    } catch (err) {
      setUpgradeMsg(err.message);
    }

    setLoading(false);
  };

  const handleSubscribe = async (planType, currency) => {
    try {
      setIsSubscribing(true);
      setUpgradeMsg("");

      const amount = currency === "USD"
        ? (planType === "yearly" ? 100 : 10) * 100
        : (planType === "yearly" ? 150000 : 15000) * 100;

      const response = await request("/payments/initialize", {
        method: "POST",
        body: JSON.stringify({
          billingCycle: planType,
          currency,
          amount
        })
      });

      const url = response?.authorizationUrl || response?.url || response?.link;

      if (!url) {
        throw new Error("Could not get the checkout url from the server.");
      }

      window.location.href = url;
    } catch (err) {
      setUpgradeMsg(err.message || "Payment failed. Try again.");
    } finally {
      setIsSubscribing(false);
    }
  };

  if (loadingBusiness) {
    return <div className="p-6 text-center font-semibold text-green-600">Syncing with Marthington Cloud...</div>;
  }

  return (
    <section className="grid grid-cols-1 gap-6 md:grid-cols-[240px_1fr] dark:text-slate-100">

      {/* SIDEBAR (Preserved) */}
      <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-slate-100">Settings</h2>

        {[
          { key: "business", label: "Business" },
          { key: "receipt", label: "Receipts" },
          { key: "billing", label: "Plan & Billing 💰" }
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`block w-full rounded-md px-3 py-2 text-left text-sm transition ${
              activeTab === tab.key
                ? "bg-black text-white shadow-md dark:bg-slate-100 dark:text-slate-900"
                : "text-gray-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </aside>

      {/* MAIN FORM (Preserved) */}
      <form onSubmit={handleSubmit} className="space-y-6">

        {upgradeMsg && (
          <div className="bg-blue-50 text-blue-700 px-4 py-3 rounded-xl text-sm border border-blue-100 animate-pulse">
            {upgradeMsg}
          </div>
        )}

        {verifying && (
          <div className="bg-yellow-50 text-yellow-700 px-4 py-3 rounded-xl text-sm border border-yellow-100">
            Verifying payment with Paystack...
          </div>
        )}

        {/* BUSINESS TAB (Preserved) */}
        {activeTab === "business" && (
          <div className="tool-panel space-y-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <h2 className="mb-2 text-lg font-bold text-slate-900 dark:text-slate-100">Business Profile</h2>
              <button
                type="button"
                onClick={downloadOfflineData}
                disabled={downloadingOfflineData}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {downloadingOfflineData ? "Downloading..." : "Download for offline use"}
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Save your catalog, stock, customers, branches, and recent records on this computer for offline access.
            </p>
            {offlineDataSummary?.syncedAt && (
              <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                Last offline download: {new Date(offlineDataSummary.syncedAt).toLocaleString()}
                {offlineDataSummary.recordCount ? ` (${offlineDataSummary.recordCount.toLocaleString()} records)` : ""}
              </p>
            )}
            <div className="grid gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-500 uppercase">Business Name</label>
                <input className="input-field" name="name" value={form.name} onChange={handleChange} placeholder="Enter Business Name" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-500 uppercase">Phone Number</label>
                <input className="input-field" name="phone" value={form.phone} onChange={handleChange} placeholder="+234..." />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-500 uppercase">Address</label>
                <input className="input-field" name="address" value={form.address} onChange={handleChange} placeholder="Physical Location" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-500 uppercase">Official Email</label>
                <input className="input-field" name="email" value={form.email} onChange={handleChange} placeholder="biz@example.com" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-500 uppercase">Business Type</label>
                <select className="input-field" name="businessType" value={form.businessType} onChange={handleChange}>
                  <option value="general_services">General Services</option>
                  <option value="retail_hardware">Retail & Hardware</option>
                  <option value="restaurant_hospitality">Restaurant & Hospitality</option>
                  <option value="hotel_lodging">Hotel & Lodging</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* RECEIPTS TAB (Preserved) */}
        {activeTab === "receipt" && (
          <div className="tool-panel space-y-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="mb-2 text-lg font-bold text-slate-900 dark:text-slate-100">Receipt Customization</h2>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Receipt Theme</label>
                <select className="input-field mt-1" name="receiptTheme" value={form.receiptTheme} onChange={handleChange}>
                  <option value="modern">Modern (Default)</option>
                  <option value="classic">Classic 🔒</option>
                  <option value="minimal">Minimal 🔒</option>
                  <option value="premium">Premium 🔒</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Footer Message</label>
                <textarea
                  className="input-field mt-1"
                  name="receiptFooter"
                  placeholder="Thank you for your patronage!"
                  value={form.receiptFooter}
                  onChange={handleChange}
                  rows={3}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Business Logo (Pro Only)</label>
                <input className="mt-2 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-black file:text-white hover:file:bg-gray-800" type="file" onChange={handleLogo} />
              </div>
            </div>
          </div>
        )}

        {/* BILLING TAB (Preserved + Fixed Logic) */}
        {activeTab === "billing" && (
          <div className="space-y-6">
            <div className="bg-black text-white rounded-2xl p-6 shadow-lg">
              <p className="text-sm opacity-70">Current Active Plan</p>
              <h2 className="text-2xl font-bold capitalize mt-1">
                {business?.subscription?.plan || "Free"} 
              </h2>

              {business?.subscription?.expiresAt && business?.subscription?.plan === "pro" && (
                <p className="text-sm mt-3 bg-white/10 w-fit px-3 py-1 rounded-full border border-white/20">
                  Renewal Date: {new Date(business.subscription.expiresAt).toLocaleDateString()}
                </p>
              )}
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              {/* FREE PLAN */}
              <div className="border rounded-2xl p-5 bg-gray-50/50">
                <h3 className="font-bold text-lg">Free</h3>
                <p className="text-2xl font-bold mt-2">₦0</p>
                <ul className="mt-4 text-xs space-y-2 text-gray-600">
                  <li>✔ 20 Products</li>
                  <li>✔ Basic POS</li>
                  <li>✔ Manual Receipts</li>
                </ul>
                {(!business?.subscription?.plan || business?.subscription?.plan === "free") && (
                  <div className="mt-5 text-center text-xs font-bold text-gray-400 border border-dashed p-2 rounded-lg">ACTIVE</div>
                )}
              </div>

              {/* MONTHLY PRO */}
              <div className={`border-2 rounded-2xl p-5 transition ${isPro ? 'border-gray-200 opacity-60' : 'border-black shadow-md'}`}>
                <h3 className="font-bold text-lg">Pro Monthly</h3>
                <p className="text-2xl font-bold mt-2">₦{pricing.monthly?.ngn?.toLocaleString()}</p>
                <ul className="mt-4 text-xs space-y-2">
                  <li>✔ Unlimited Products</li>
                  <li>✔ WhatsApp Receipts</li>
                  <li>✔ Custom Branding</li>
                </ul>
                {!isPro && (
                  <button
                    type="button"
                    onClick={() => handleSubscribe("monthly", "NGN")}
                    disabled={isSubscribing}
                    className="mt-5 w-full bg-black text-white py-2.5 rounded-xl font-bold hover:scale-[1.02] transition active:scale-[0.98] disabled:opacity-50"
                  >
                    {isSubscribing ? "Redirecting..." : "Upgrade Monthly"}
                  </button>
                )}
              </div>

              {/* YEARLY PRO */}
              <div className={`border-2 rounded-2xl p-5 relative transition ${isPro ? 'border-gray-200 opacity-60' : 'border-green-600 shadow-lg'}`}>
                <span className="absolute -top-3 right-4 bg-green-600 text-white text-[10px] px-3 py-1 rounded-full font-black">
                  SAVE ₦{Math.max(0, pricing.monthly?.ngn * 12 - pricing.yearly?.ngn).toLocaleString()}
                </span>
                <h3 className="font-bold text-lg">Pro Yearly</h3>
                <p className="text-2xl font-bold mt-2 text-green-700">₦{pricing.yearly?.ngn?.toLocaleString()}</p>
                <p className="text-[10px] text-gray-500 font-medium">Equiv. to ₦{(pricing.yearly?.ngn / 12).toLocaleString(undefined, { maximumFractionDigits: 0 })} / month</p>
                <ul className="mt-4 text-xs space-y-2">
                  <li>✔ Everything in Monthly</li>
                  <li>✔ 2 Months FREE</li>
                  <li>✔ Priority Support</li>
                </ul>
                {!isPro && (
                  <button
                    type="button"
                    onClick={() => handleSubscribe("yearly", "NGN")}
                    disabled={isSubscribing}
                    className="mt-5 w-full bg-green-600 text-white py-2.5 rounded-xl font-bold hover:bg-green-700 hover:scale-[1.02] transition active:scale-[0.98] disabled:opacity-50"
                  >
                    {isSubscribing ? "Redirecting..." : "Upgrade Yearly 🚀"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-4">
          <button type="submit" disabled={loading} className="bg-black text-white px-8 py-3 rounded-2xl font-bold shadow-lg hover:bg-gray-800 transition disabled:bg-gray-400">
            {loading ? "Saving Changes..." : "Save Settings"}
          </button>
        </div>

      </form>
    </section>
  );
};

export default Settings;