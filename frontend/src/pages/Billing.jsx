import {
  useCallback,
  useEffect,
  useState
} from "react";

import request from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { formatCurrency } from "../utils/formatters.js";

const Billing = () => {
  const { refreshBusiness } = useAuth();

  const [billing, setBilling] =
    useState(null);

  const [pricing, setPricing] = useState({
    monthly: { ngn: 15000, usd: 10 },
    yearly: { ngn: 150000, usd: 100 }
  });

  const [loading, setLoading] = useState(true);

  const [processing, setProcessing] = useState("");
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState("");

  const [error, setError] = useState("");

  // =====================================
  // LOAD
  // =====================================

  useEffect(() => {
    const load = async () => {
      try {
        const [billingData, pricingData] = await Promise.all([
          request("/payments/status"),
          request("/billing/pricing")
        ]);

        setBilling(billingData);

        const pricingPayload = pricingData?.data;
        if (pricingPayload?.monthly && pricingPayload?.yearly) {
          setPricing((current) => ({
            monthly: {
              ngn: pricingPayload.monthly.ngn ?? current.monthly.ngn,
              usd: pricingPayload.monthly.usd ?? current.monthly.usd
            },
            yearly: {
              ngn: pricingPayload.yearly.ngn ?? current.yearly.ngn,
              usd: pricingPayload.yearly.usd ?? current.yearly.usd
            }
          }));
        }
      } catch (err) {
        setError(err?.message || "Failed to load billing details.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const handlePaymentCallback = useCallback(async (reference) => {
    if (!reference) return;

    setVerifyingPayment(true);
    setPaymentMessage("Finalizing your payment and updating your plan...");

    try {
      const result = await request("/payments/verify-redirect", {
        method: "POST",
        body: JSON.stringify({ reference })
      });

      await refreshBusiness();

      setBilling((current) => current ? {
        ...current,
        plan: result?.subscription?.plan || "pro",
        status: result?.subscription?.status || "active",
        billingCycle: result?.subscription?.billingCycle || current.billingCycle,
        expiresAt: result?.subscription?.expiresAt || current.expiresAt,
        isPro: true
      } : current);

      setPaymentMessage(result?.message || "Payment verified successfully. Your Pro features are now active.");
    } catch (err) {
      setPaymentMessage(err?.message || "Payment verification failed. Please try again.");
    } finally {
      setVerifyingPayment(false);
    }
  }, [refreshBusiness]);

  // =====================================
  // UPGRADE
  // =====================================

  const handlePayment = async (planType, currency = "NGN") => {
    try {
      setProcessing(planType);
      setError("");
      setPaymentMessage("");

      const amount = currency === "USD"
        ? (planType === "yearly" ? pricing.yearly.usd : pricing.monthly.usd) * 100
        : (planType === "yearly" ? pricing.yearly.ngn : pricing.monthly.ngn) * 100;

      const data = await request("/payments/initialize", {
        method: "POST",
        body: JSON.stringify({ billingCycle: planType, currency, amount })
      });

      const url = data?.authorizationUrl || data?.url || data?.link;
      if (!url) {
        throw new Error("Could not get the checkout URL from the server.");
      }

      const popup = window.open(url, "_blank", "width=720,height=760,top=80,left=80");
      if (!popup) {
        throw new Error("Please allow popups to complete your checkout.");
      }

      let popupTimer = window.setInterval(() => {
        try {
          const popupUrl = popup.location.href;
          const popupReference = new URL(popupUrl).searchParams.get("reference");

          if (popupUrl.startsWith(window.location.origin) && popupReference) {
            window.clearInterval(popupTimer);
            popup.close();
            void handlePaymentCallback(popupReference);
          }
        } catch {
          // Ignore cross-origin transitions until the redirect reaches the app.
        }

        if (popup.closed) {
          window.clearInterval(popupTimer);
        }
      }, 800);
    } catch (err) {
      setError(err?.message || "Payment initialization failed.");
    } finally {
      setProcessing("");
    }
  };

  if (loading) {

    return (
      <div className="p-6">
        Loading billing...
      </div>
    );
  }

  return (

    <section className="page-stack">

      {/* HEADER */}

      <div className="page-heading">

        <div>

          <span>
            Subscription
          </span>

          <h1>
            Billing Center
          </h1>

          <p className="mt-2 text-gray-500">
            Manage your subscription, unlock premium tools
            and scale your business faster.
          </p>

        </div>

      </div>

      {error && (
        <div className="form-error">
          {error}
        </div>
      )}

      {verifyingPayment && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-600 border-t-transparent" />
          <span>{paymentMessage || "Finalizing your payment..."}</span>
        </div>
      )}

      {!verifyingPayment && paymentMessage && (
        <div className={`rounded-2xl border p-4 text-sm ${paymentMessage.toLowerCase().includes("success") ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>
          {paymentMessage}
        </div>
      )}

      {/* CURRENT PLAN */}

      <div className="tool-panel rounded-3xl border border-gray-200">

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">

          <div>

            <p className="text-sm uppercase tracking-wider text-gray-500 font-semibold">
              Current Subscription
            </p>

            <h2 className="text-4xl font-extrabold mt-2 capitalize">
              {billing?.plan || "Free"}
            </h2>

            <p className="mt-2 text-gray-500 capitalize">
              {billing?.status || "inactive"}
            </p>

          </div>

          <div className="grid grid-cols-2 gap-4 w-full lg:w-auto">

            <div className="bg-gray-50 rounded-2xl p-4 min-w-[150px]">

              <p className="text-xs text-gray-500 uppercase">
                Billing Cycle
              </p>

              <h3 className="text-xl font-bold mt-2 capitalize">
                {
                  billing?.billingCycle ||
                  "N/A"
                }
              </h3>

            </div>

            <div className="bg-gray-50 rounded-2xl p-4 min-w-[150px]">

              <p className="text-xs text-gray-500 uppercase">
                Days Left
              </p>

              <h3 className="text-xl font-bold mt-2">
                {
                  billing?.daysLeft ||
                  0
                } days
              </h3>

            </div>

          </div>

        </div>

      </div>

      {/* PRICING */}

      <div className="grid gap-8 lg:grid-cols-2">

        <div className="rounded-[32px] border border-gray-200 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-8">
            <h2 className="text-3xl font-extrabold">Pro Monthly</h2>
            <div className="mt-6 flex items-end gap-2">
              <span className="text-6xl font-black">{formatCurrency(pricing.monthly.ngn)}</span>
              <span className="text-gray-500 mb-2">/ month</span>
            </div>
            <p className="text-gray-500 mt-4 leading-7">
              Perfect for growing businesses that want modern receipts, reports, staff controls and unlimited products.
            </p>
            <p className="text-sm text-slate-500 mt-3">Also available in USD: {formatCurrency(pricing.monthly.usd, "USD")}</p>
          </div>

          <div className="space-y-4 text-sm text-slate-600">
            <div className="flex items-center gap-3"><span>✅</span><span>Unlimited products</span></div>
            <div className="flex items-center gap-3"><span>✅</span><span>Unlimited staff accounts</span></div>
            <div className="flex items-center gap-3"><span>✅</span><span>WhatsApp receipts</span></div>
            <div className="flex items-center gap-3"><span>✅</span><span>Premium receipt templates</span></div>
            <div className="flex items-center gap-3"><span>✅</span><span>PDF exports</span></div>
            <div className="flex items-center gap-3"><span>✅</span><span>Analytics dashboard</span></div>
            <div className="flex items-center gap-3"><span>✅</span><span>Business reports</span></div>
          </div>

          <div className="mt-8 rounded-3xl border border-dashed border-gray-200 p-5 bg-gray-50">
            <p className="text-sm font-semibold text-gray-700">Payment methods supported</p>
            <div className="mt-4 grid gap-3 text-sm text-gray-600">
              <div className="flex items-center gap-3"><span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black text-white">C</span><span>Card</span></div>
              <div className="flex items-center gap-3"><span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black text-white">U</span><span>USSD</span></div>
              <div className="flex items-center gap-3"><span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black text-white">B</span><span>Bank Transfer</span></div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handlePayment("monthly", "NGN")}
            disabled={processing === "monthly"}
            className="mt-10 w-full bg-slate-900 text-white py-4 rounded-2xl font-bold transition hover:bg-slate-800 disabled:opacity-50"
          >
            {processing === "monthly" ? "Processing..." : "Upgrade Monthly"}
          </button>
        </div>

        <div className="bg-gradient-to-br from-emerald-700 to-emerald-600 text-white rounded-[32px] shadow-xl p-8 relative overflow-hidden">
          <div className="absolute -top-3 right-5 rounded-full bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-white">
            SAVE {formatCurrency(Math.max(0, pricing.monthly.ngn * 12 - pricing.yearly.ngn))}
          </div>
          <div className="mb-8">
            <h2 className="text-3xl font-extrabold">Pro Yearly</h2>
            <div className="mt-6 flex items-end gap-2">
              <span className="text-6xl font-black">{formatCurrency(pricing.yearly.ngn)}</span>
              <span className="text-emerald-100 mb-2">/ year</span>
            </div>
            <p className="text-emerald-100 mt-4 leading-7">
              Best for serious businesses that want long-term growth with maximum savings and future upgrades.
            </p>
            <p className="text-sm text-emerald-100 mt-3">Also available in USD: {formatCurrency(pricing.yearly.usd, "USD")}</p>
          </div>

          <div className="space-y-4 text-sm text-emerald-100">
            <div className="flex items-center gap-3"><span>✅</span><span>Everything in Monthly</span></div>
            <div className="flex items-center gap-3"><span>✅</span><span>Priority support</span></div>
            <div className="flex items-center gap-3"><span>✅</span><span>Early access to AI tools</span></div>
            <div className="flex items-center gap-3"><span>✅</span><span>Multi-location ready</span></div>
            <div className="flex items-center gap-3"><span>✅</span><span>Future enterprise features</span></div>
          </div>

          <button
            type="button"
            onClick={() => handlePayment("yearly", "NGN")}
            disabled={processing === "yearly"}
            className="mt-10 w-full bg-white text-emerald-700 py-4 rounded-2xl font-bold transition hover:bg-emerald-100 disabled:opacity-50"
          >
            {processing === "yearly" ? "Processing..." : "Upgrade Yearly"}
          </button>
        </div>
      </div>

      {/* TRUST */}

      <div className="grid gap-6 md:grid-cols-3">

        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">

          <h3 className="font-bold text-2xl">
            Smart Receipts
          </h3>

          <p className="mt-3 text-gray-500">
            Professional PDF and WhatsApp receipts
            that improve customer trust.
          </p>

        </div>

        <div className="bg-white border rounded-3xl p-6 shadow-sm">

          <h3 className="font-bold text-2xl">
            Cloud Sync
          </h3>

          <p className="mt-3 text-gray-500">
            Access your business securely from
            anywhere and any device.
          </p>

        </div>

        <div className="bg-white border rounded-3xl p-6 shadow-sm">

          <h3 className="font-bold text-2xl">
            Business Growth
          </h3>

          <p className="mt-3 text-gray-500">
            Scale your operations with analytics,
            inventory and team management.
          </p>

        </div>

      </div>

    </section>
  );
};

export default Billing;