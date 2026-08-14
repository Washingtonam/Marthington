import { useState, useEffect } from "react";
import { FiAlertCircle, FiCheckCircle, FiX } from "react-icons/fi";
import request from "../api/client.js";
import { formatCurrency } from "../utils/formatters.js";

/**
 * PHASE 1: Record Received Supply Modal
 * Allows users to:
 * - Select a pending/partial purchase order
 * - Record partial or full receipt quantities
 * - Choose payment status (paid/unpaid on credit)
 * - Select destination branch
 * 
 * Auto-syncs:
 * - Inventory incremented
 * - Expense record created
 * - Supplier ledger updated
 */
const RecordReceiptModal = ({ isOpen, onClose, supplierId, onSuccess }) => {
  const [step, setStep] = useState(1); // 1: Select PO, 2: Record Quantities, 3: Confirm
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [selectedPO, setSelectedPO] = useState(null);
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState("unpaid");
  const [receivedItems, setReceivedItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Load pending/partial POs
  useEffect(() => {
    if (!isOpen) return;
    loadPurchaseOrders();
    loadBranches();
  }, [isOpen, supplierId]);

  // When PO selected, populate received items form
  useEffect(() => {
    if (!selectedPO) {
      setReceivedItems([]);
      return;
    }

    const items = selectedPO.items.map((item, index) => ({
      itemIndex: index,
      productName: item.name,
      productId: item.product?._id,
      quantityOrdered: Number(item.quantity || 0),
      quantityReceived: Number(item.quantityReceived || 0),
      quantityRemaining: Number(item.quantity || 0) - Number(item.quantityReceived || 0),
      quantityToReceive: 0,
      costPrice: Number(item.costPrice || 0)
    }));
    setReceivedItems(items);
  }, [selectedPO]);

  const loadPurchaseOrders = async () => {
    try {
      setError("");
      const query = supplierId ? `?supplierId=${supplierId}` : "";
      const orders = await request(`/purchaseOrders${query}`);
      
      // Filter to show only pending/partial
      const openOrders = orders.filter(po => 
        (po.status === "pending" || po.status === "partial") && 
        po.receiptStatus !== "complete"
      );
      setPurchaseOrders(openOrders);
    } catch (err) {
      setError(err.message || "Failed to load purchase orders");
      setPurchaseOrders([]);
    }
  };

  const loadBranches = async () => {
    try {
      const data = await request("/branches");
      setBranches(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load branches:", err);
      setBranches([]);
    }
  };

  const handleQuantityChange = (itemIndex, newQty) => {
    const item = receivedItems[itemIndex];
    const maxAllowed = item.quantityRemaining;
    const qty = Math.min(Math.max(0, Number(newQty) || 0), maxAllowed);

    const updated = [...receivedItems];
    updated[itemIndex].quantityToReceive = qty;
    setReceivedItems(updated);
  };

  const handleRecordReceipt = async () => {
    try {
      setLoading(true);
      setError("");

      if (!selectedPO) {
        setError("Please select a purchase order");
        return;
      }

      // Build payload - only include items with quantity > 0
      const itemsToReceive = receivedItems
        .filter(item => item.quantityToReceive > 0)
        .map(item => ({
          itemIndex: item.itemIndex,
          quantityReceived: item.quantityToReceive
        }));

      if (itemsToReceive.length === 0) {
        setError("Please enter quantity to receive for at least one item");
        return;
      }

      const payload = {
        receivedItems: itemsToReceive,
        paymentStatus,
        branch: selectedBranch?._id || null
      };

      // Call the recordReceipt endpoint
      const response = await request(`/purchaseOrders/${selectedPO._id}/record-receipt`, {
        method: "POST",
        body: JSON.stringify(payload)
      });

      if (response.success) {
        setSuccess(response.message);
        setStep(3); // Show confirmation
        
        // Trigger success callback after 2 seconds
        setTimeout(() => {
          onSuccess?.();
          handleReset();
          onClose();
        }, 2000);
      }
    } catch (err) {
      setError(err.message || "Failed to record receipt");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setSelectedPO(null);
    setSelectedBranch(null);
    setPaymentStatus("unpaid");
    setReceivedItems([]);
    setError("");
    setSuccess("");
  };

  if (!isOpen) return null;

  // Total cost of items to be received
  const totalReceivedCost = receivedItems.reduce(
    (sum, item) => sum + (item.quantityToReceive * item.costPrice),
    0
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-2xl rounded-[28px] border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-emerald-50 to-cyan-50 px-6 py-5 dark:border-slate-800 dark:from-emerald-950/30 dark:to-cyan-950/30">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              Record Received Supply
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Step {step} of 3: {step === 1 ? "Select Order" : step === 2 ? "Confirm Quantities" : "Complete"}
            </p>
          </div>
          <button
            onClick={() => {
              handleReset();
              onClose();
            }}
            className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 flex gap-3 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900/30 dark:bg-red-950/30">
              <FiAlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400" />
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-4 flex gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/30 dark:bg-emerald-950/30">
              <FiCheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
              <p className="text-sm text-emerald-600 dark:text-emerald-400">{success}</p>
            </div>
          )}

          {/* Step 1: Select Purchase Order */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Select Purchase Order
                </label>
                {purchaseOrders.length === 0 ? (
                  <div className="rounded-lg bg-slate-50 p-4 text-center text-sm text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    No pending purchase orders found
                  </div>
                ) : (
                  <select
                    value={selectedPO?._id || ""}
                    onChange={(e) => {
                      const po = purchaseOrders.find(p => p._id === e.target.value);
                      setSelectedPO(po);
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:bg-white dark:border-slate-700 dark:bg-slate-950"
                  >
                    <option value="">-- Select a purchase order --</option>
                    {purchaseOrders.map(po => (
                      <option key={po._id} value={po._id}>
                        {po.supplier?.name} • {po.items?.length || 0} items • {formatCurrency(po.totalAmount)}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {selectedPO && (
                <div className="mt-6 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-slate-500 dark:text-slate-400">Supplier</p>
                      <p className="font-medium text-slate-900 dark:text-slate-100">{selectedPO.supplier?.name}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 dark:text-slate-400">Order Date</p>
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {new Date(selectedPO.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500 dark:text-slate-400">Total Amount</p>
                      <p className="font-medium text-slate-900 dark:text-slate-100">{formatCurrency(selectedPO.totalAmount)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 dark:text-slate-400">Payment Terms</p>
                      <p className="font-medium text-slate-900 dark:text-slate-100">{selectedPO.paymentTerms || "Immediate"}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => {
                    handleReset();
                    onClose();
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setStep(2)}
                  disabled={!selectedPO || loading}
                  className="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Record Quantities */}
          {step === 2 && selectedPO && (
            <div className="space-y-5">
              <div className="space-y-3">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Destination Branch
                  </label>
                  <select
                    value={selectedBranch?._id || ""}
                    onChange={(e) => {
                      const branch = branches.find(b => b._id === e.target.value);
                      setSelectedBranch(branch || null);
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:bg-white dark:border-slate-700 dark:bg-slate-950"
                  >
                    <option value="">-- Select branch (optional) --</option>
                    {branches.map(branch => (
                      <option key={branch._id} value={branch._id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Payment Status
                  </label>
                  <div className="flex gap-3">
                    {[
                      { value: "unpaid", label: "Unpaid (On Credit)" },
                      { value: "paid", label: "Paid (Immediate)" }
                    ].map(option => (
                      <label key={option.value} className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="paymentStatus"
                          value={option.value}
                          checked={paymentStatus === option.value}
                          onChange={(e) => setPaymentStatus(e.target.value)}
                        />
                        {option.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Items to receive */}
              <div className="space-y-3">
                <h3 className="font-medium text-slate-900 dark:text-slate-100">Items to Receive</h3>
                <div className="max-h-72 space-y-2 overflow-y-auto">
                  {receivedItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-end gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {item.productName}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Ordered: {item.quantityOrdered} • Already received: {item.quantityReceived} •  Can receive: {item.quantityRemaining}
                        </p>
                        <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                          Unit cost: {formatCurrency(item.costPrice)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max={item.quantityRemaining}
                          value={item.quantityToReceive}
                          onChange={(e) => handleQuantityChange(idx, e.target.value)}
                          placeholder="Qty"
                          className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-2 text-right text-sm outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900"
                        />
                        <span className="text-xs text-slate-500 dark:text-slate-400">units</span>
                      </div>

                      {item.quantityToReceive > 0 && (
                        <div className="text-right">
                          <p className="text-xs text-slate-500 dark:text-slate-400">Subtotal</p>
                          <p className="text-sm font-semibold text-emerald-600">
                            {formatCurrency(item.quantityToReceive * item.costPrice)}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Total received cost */}
              {totalReceivedCost > 0 && (
                <div className="rounded-lg bg-emerald-50 p-4 dark:bg-emerald-950/30">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-emerald-900 dark:text-emerald-300">Total receipt cost:</p>
                    <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(totalReceivedCost)}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setStep(1)}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                >
                  Back
                </button>
                <button
                  onClick={handleRecordReceipt}
                  disabled={totalReceivedCost === 0 || loading}
                  className="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {loading ? "Processing..." : "Record Receipt"}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Success */}
          {step === 3 && success && (
            <div className="space-y-4 text-center">
              <div className="flex justify-center">
                <div className="rounded-full bg-emerald-50 p-4 dark:bg-emerald-950/30">
                  <FiCheckCircle className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Receipt Recorded Successfully!
                </h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  {success}
                </p>
              </div>

              <div className="grid gap-2 rounded-lg bg-slate-50 p-4 dark:bg-slate-800/50">
                <div className="text-left text-sm">
                  <p className="text-slate-500 dark:text-slate-400">Inventory updated</p>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">✓ Stocks increased</p>
                </div>
                <div className="text-left text-sm">
                  <p className="text-slate-500 dark:text-slate-400">Expense recorded</p>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">✓ {formatCurrency(totalReceivedCost)} logged</p>
                </div>
                <div className="text-left text-sm">
                  <p className="text-slate-500 dark:text-slate-400">Supplier ledger</p>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">✓ Balance updated</p>
                </div>
              </div>

              <p className="text-xs text-slate-400 dark:text-slate-500">Closing in a moment...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecordReceiptModal;
