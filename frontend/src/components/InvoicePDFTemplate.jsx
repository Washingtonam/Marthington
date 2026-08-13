import React from "react";
import PropTypes from "prop-types";
import "./InvoicePDFTemplate.css";

/**
 * Invoice PDF Template Component
 * Renders a printable/downloadable invoice layout
 * This component is designed to look professional when printed or converted to PDF
 */
const InvoicePDFTemplate = React.forwardRef(({ invoice }, ref) => {
  if (!invoice) {
    return <div>No invoice data available</div>;
  }

  const {
    business = {},
    invoiceNumber,
    createdAt,
    customer = {},
    supplier = {},
    items = [],
    subtotal = 0,
    tax = 0,
    discount = 0,
    totalAmount = 0,
    amountPaid = 0,
    balanceDue = 0,
    dueDate,
    transactionType,
    notes,
  } = invoice;

  const isOutgoing = transactionType === "outgoing";
  const counterparty = isOutgoing ? customer : supplier;

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatDate = (date) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div ref={ref} className="invoice-pdf-template">
      {/* Header */}
      <div className="invoice-header">
        <div className="header-left">
          {business.logo && (
            <img src={business.logo} alt="Business Logo" className="business-logo" />
          )}
          <div className="business-info">
            <h1 className="business-name">{business.name || "Business Name"}</h1>
            {business.address && <p>{business.address}</p>}
            {business.phone && <p>Phone: {business.phone}</p>}
            {business.email && <p>Email: {business.email}</p>}
          </div>
        </div>
        <div className="header-right">
          <h2 className="invoice-title">INVOICE</h2>
          <div className="invoice-meta">
            <p>
              <strong>Invoice #:</strong> {invoiceNumber}
            </p>
            <p>
              <strong>Date:</strong> {formatDate(createdAt)}
            </p>
            <p>
              <strong>Type:</strong>{" "}
              {isOutgoing ? "Customer Invoice" : "Supplier Invoice"}
            </p>
            {dueDate && (
              <p>
                <strong>Due Date:</strong> {formatDate(dueDate)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Billing Section */}
      <div className="billing-section">
        <div className="bill-to">
          <h4>{isOutgoing ? "BILL TO:" : "FROM:"}</h4>
          <div className="counterparty-details">
            <p className="name">
              <strong>{counterparty.name || "N/A"}</strong>
            </p>
            {counterparty.address && <p>{counterparty.address}</p>}
            {counterparty.email && <p>Email: {counterparty.email}</p>}
            {counterparty.phone && <p>Phone: {counterparty.phone}</p>}
          </div>
        </div>
      </div>

      {/* Items Table */}
      <table className="invoice-items-table">
        <thead>
          <tr>
            <th className="desc-col">Description</th>
            <th className="qty-col">Quantity</th>
            <th className="price-col">Unit Price</th>
            <th className="amount-col">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.length > 0 ? (
            items.map((item, index) => (
              <tr key={index}>
                <td className="desc-col">
                  <div className="item-name">{item.name}</div>
                  {item.product && (
                    <div className="item-product">Product ID: {item.product}</div>
                  )}
                </td>
                <td className="qty-col">{item.quantity}</td>
                <td className="price-col">{formatCurrency(item.price)}</td>
                <td className="amount-col">{formatCurrency(item.total)}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="4" style={{ textAlign: "center", padding: "20px" }}>
                No items
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Summary Section */}
      <div className="invoice-summary">
        <div className="summary-left">
          {notes && (
            <div className="notes">
              <h4>Notes:</h4>
              <p>{notes}</p>
            </div>
          )}
        </div>
        <div className="summary-right">
          <div className="summary-row">
            <span className="label">Subtotal:</span>
            <span className="value">{formatCurrency(subtotal)}</span>
          </div>
          {tax > 0 && (
            <div className="summary-row">
              <span className="label">Tax:</span>
              <span className="value">{formatCurrency(tax)}</span>
            </div>
          )}
          {discount > 0 && (
            <div className="summary-row">
              <span className="label">Discount:</span>
              <span className="value">-{formatCurrency(discount)}</span>
            </div>
          )}
          <div className="summary-row total">
            <span className="label">Total Amount:</span>
            <span className="value">{formatCurrency(totalAmount)}</span>
          </div>
          <div className="summary-row paid">
            <span className="label">Amount Paid:</span>
            <span className="value">{formatCurrency(amountPaid)}</span>
          </div>
          <div className="summary-row balance">
            <span className="label">Balance Due:</span>
            <span className="value">{formatCurrency(balanceDue)}</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="invoice-footer">
        <p>Thank you for your business!</p>
        <p className="no-print">
          This document is digitally generated by {business.name || "Marthington BMS"}
        </p>
      </div>
    </div>
  );
});

InvoicePDFTemplate.displayName = "InvoicePDFTemplate";

InvoicePDFTemplate.propTypes = {
  invoice: PropTypes.shape({
    business: PropTypes.object,
    invoiceNumber: PropTypes.string,
    createdAt: PropTypes.string,
    customer: PropTypes.object,
    supplier: PropTypes.object,
    items: PropTypes.array,
    subtotal: PropTypes.number,
    tax: PropTypes.number,
    discount: PropTypes.number,
    totalAmount: PropTypes.number,
    amountPaid: PropTypes.number,
    balanceDue: PropTypes.number,
    dueDate: PropTypes.string,
    transactionType: PropTypes.string,
    notes: PropTypes.string,
  }),
};

export default InvoicePDFTemplate;
