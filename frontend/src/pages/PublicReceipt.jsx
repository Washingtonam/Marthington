import { useEffect, useState, useMemo, useRef } from "react";
import { useParams } from "react-router-dom";
import request from "../api/client.js";
import { formatCurrency } from "../utils/formatters.js";

const PublicReceipt = () => {
  const { id } = useParams();
  const [sale, setSale] = useState(null);
  const receiptRef = useRef();

  useEffect(() => {
    const load = async () => {
      try {
        const data = await request(`/sales/public/${id}`);
        setSale(data);
      } catch (err) {
        console.error(err);
      }
    };
    load();
  }, [id]);

  const shareLink = useMemo(() => {
    return `${window.location.origin}/r/${id}`;
  }, [id]);

  const shareWhatsApp = () => {
    const message = `🧾 Receipt\n\nView your receipt here:\n${shareLink}`;
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      alert("Link copied");
    } catch {
      alert("Copy failed");
    }
  };

  // 🔥 PRINT ONLY RECEIPT
  const handlePrint = () => {
    window.print();
  };

  if (!sale) return <div className="p-6">Loading...</div>;

  const business = sale.business || {};

  return (
    <div className="flex flex-col items-center py-10 bg-gray-100 min-h-screen">

      {/* 🔥 RECEIPT */}
      <div ref={receiptRef} className="receipt modern print-area">

        {business.logo && (
          <div className="flex justify-center mb-3">
            <img
              src={business.logo}
              alt="logo"
              className="max-h-16 max-w-[140px] object-contain"
            />
          </div>
        )}

        <div className="text-center space-y-1">
          <h2 className="font-bold text-lg uppercase">
            {business.name}
          </h2>

          {sale.branch?.name && (
            <p className="text-xs opacity-70">Branch: {sale.branch.name}</p>
          )}

          {business.address && (
            <p className="text-xs opacity-70">{business.address}</p>
          )}

          {business.phone && (
            <p className="text-xs opacity-70">{business.phone}</p>
          )}
        </div>

        <div className="border-t border-dashed my-3" />

        {/* ITEMS */}
        <div className="space-y-2">
          {sale.items.map((item, i) => (
            <div key={i}>
              <div className="flex justify-between text-sm">
                <span>{item.product?.name}</span>
                <span className="font-medium">
                  {formatCurrency(item.quantity * item.sellingPrice)}
                </span>
              </div>

              <div className="text-xs opacity-60">
                {item.quantity} × {formatCurrency(item.sellingPrice)}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-dashed my-3" />

        {/* TOTAL */}
        <div className="flex justify-between font-bold text-lg">
          <span>TOTAL</span>
          <span>{formatCurrency(sale.totalAmount)}</span>
        </div>

        <div className="border-t border-dashed my-3" />

        {/* FOOTER */}
        <div className="text-center text-xs opacity-70 space-y-1">
          <p className="font-semibold">Thank you for your patronage</p>
          {business.receiptFooter && (
            <p>{business.receiptFooter}</p>
          )}
        </div>
      </div>

      {/* 🔥 ACTION BAR (HIDDEN IN PRINT) */}
      <div className="mt-6 w-[320px] space-y-2 no-print">

        <button
          onClick={handlePrint}
          className="w-full bg-black text-white py-2 rounded-md font-medium"
        >
          Print Receipt
        </button>

        <button
          onClick={shareWhatsApp}
          className="w-full bg-green-600 text-white py-2 rounded-md font-medium"
        >
          Share via WhatsApp
        </button>

        <button
          onClick={copyLink}
          className="w-full border py-2 rounded-md font-medium"
        >
          Copy Link
        </button>

        <button
          onClick={() =>
            window.print()
          }
        >
          Print
        </button>

        <button
          onClick={() =>
            downloadReceiptPdf(
              `receipt-${sale.receiptId}.pdf`
            )
          }
        >
          Download PDF
        </button>

      </div>

      {/* 🔥 BRAND FOOTER (HIDDEN IN PRINT) */}
      <div className="mt-6 text-xs text-gray-500 text-center no-print">
        Powered by <span className="font-semibold text-green-600">Marthington</span>
      </div>

    </div>
  );
};

export default PublicReceipt;