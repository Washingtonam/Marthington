import { getEmailTransporter } from "../config/email.js";
import EmailHistory from "../models/emailHistory.model.js";

/**
 * Email Service
 * Handles sending all invoice-related emails with history tracking
 */

/**
 * Log email to EmailHistory collection
 */
export const logEmailHistory = async ({
  business,
  invoice,
  recipientEmail,
  recipientName,
  subject,
  emailType,
  status = "sent",
  errorMessage = null,
  sharedMessage = null,
  metadata = {},
  createdBy = null
}) => {
  try {
    await EmailHistory.create({
      business,
      invoice,
      recipientEmail,
      recipientName,
      subject,
      emailType,
      status,
      errorMessage,
      sharedMessage,
      metadata,
      sentAt: status === "sent" ? new Date() : null,
      createdBy
    });
  } catch (error) {
    console.error("Failed to log email history:", error.message);
  }
};

/**
 * Send Invoice Created notification
 */
export const sendInvoiceCreatedEmail = async ({
  recipientEmail,
  recipientName,
  businessName,
  businessId,
  invoiceId,
  invoiceNumber,
  customerName,
  amount,
  dueDate,
  invoiceUrl,
  createdBy = null
}) => {
  const transporter = getEmailTransporter();
  if (!transporter) return false;

  const subject = `Invoice ${invoiceNumber} from ${businessName}`;
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Invoice Created</h2>
      <p>Hello ${recipientName},</p>
      <p><strong>${businessName}</strong> has created an invoice for you:</p>
      
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Invoice Number:</strong> ${invoiceNumber}</p>
        <p><strong>Customer:</strong> ${customerName}</p>
        <p><strong>Amount:</strong> ${amount}</p>
        <p><strong>Due Date:</strong> ${dueDate}</p>
      </div>
      
      <p>
        <a href="${invoiceUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
          View Invoice
        </a>
      </p>
      
      <p style="color: #666; font-size: 12px; margin-top: 30px;">
        This is an automated email. Please do not reply to this message.
      </p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: recipientEmail,
      subject,
      html: htmlContent,
    });

    console.log(`✅ Invoice created email sent to ${recipientEmail}`);
    
    // Log to email history
    await logEmailHistory({
      business: businessId,
      invoice: invoiceId,
      recipientEmail,
      recipientName,
      subject,
      emailType: "invoice_created",
      status: "sent",
      createdBy
    });

    return true;
  } catch (error) {
    console.error(`❌ Failed to send invoice created email: ${error.message}`);
    
    // Log failure to email history
    await logEmailHistory({
      business: businessId,
      invoice: invoiceId,
      recipientEmail,
      recipientName,
      subject,
      emailType: "invoice_created",
      status: "failed",
      errorMessage: error.message,
      createdBy
    });

    return false;
  }
};

/**
 * Send Payment Received notification
 */
export const sendPaymentReceivedEmail = async ({
  recipientEmail,
  recipientName,
  businessName,
  businessId,
  invoiceId,
  invoiceNumber,
  paymentAmount,
  paymentDate,
  remainingBalance,
  invoiceUrl,
  createdBy = null
}) => {
  const transporter = getEmailTransporter();
  if (!transporter) return false;

  const subject = `Payment Received for Invoice ${invoiceNumber}`;
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Payment Received</h2>
      <p>Hello ${recipientName},</p>
      <p>We have received your payment for <strong>Invoice ${invoiceNumber}</strong>:</p>
      
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Amount Received:</strong> ${paymentAmount}</p>
        <p><strong>Payment Date:</strong> ${paymentDate}</p>
        <p><strong>Remaining Balance:</strong> ${remainingBalance}</p>
      </div>
      
      <p>
        <a href="${invoiceUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
          View Invoice
        </a>
      </p>
      
      <p style="color: #666; font-size: 12px; margin-top: 30px;">
        Thank you for your business!
      </p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: recipientEmail,
      subject,
      html: htmlContent,
    });

    console.log(`✅ Payment received email sent to ${recipientEmail}`);
    
    // Log to email history
    await logEmailHistory({
      business: businessId,
      invoice: invoiceId,
      recipientEmail,
      recipientName,
      subject,
      emailType: "payment_received",
      status: "sent",
      createdBy
    });

    return true;
  } catch (error) {
    console.error(`❌ Failed to send payment received email: ${error.message}`);
    
    // Log failure to email history
    await logEmailHistory({
      business: businessId,
      invoice: invoiceId,
      recipientEmail,
      recipientName,
      subject,
      emailType: "payment_received",
      status: "failed",
      errorMessage: error.message,
      createdBy
    });

    return false;
  }
};

/**
 * Send Invoice Overdue notification
 */
export const sendInvoiceOverdueEmail = async ({
  recipientEmail,
  recipientName,
  businessName,
  businessId,
  invoiceId,
  invoiceNumber,
  daysOverdue,
  amountDue,
  invoiceUrl,
  createdBy = null
}) => {
  const transporter = getEmailTransporter();
  if (!transporter) return false;

  const subject = `URGENT: Invoice ${invoiceNumber} is ${daysOverdue} days overdue`;
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #d32f2f;">Invoice Overdue</h2>
      <p>Hello ${recipientName},</p>
      <p style="color: #d32f2f;">
        <strong>Invoice ${invoiceNumber} from ${businessName} is now ${daysOverdue} days overdue.</strong>
      </p>
      
      <div style="background-color: #ffebee; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #d32f2f;">
        <p><strong>Invoice Number:</strong> ${invoiceNumber}</p>
        <p><strong>Amount Due:</strong> ${amountDue}</p>
        <p><strong>Days Overdue:</strong> ${daysOverdue}</p>
      </div>
      
      <p>Please settle this invoice at your earliest convenience to avoid any further action.</p>
      
      <p>
        <a href="${invoiceUrl}" style="background-color: #d32f2f; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
          Pay Now
        </a>
      </p>
      
      <p style="color: #666; font-size: 12px; margin-top: 30px;">
        If you have already made this payment, please disregard this email.
      </p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: recipientEmail,
      subject,
      html: htmlContent,
    });

    console.log(`✅ Overdue invoice email sent to ${recipientEmail}`);
    
    // Log to email history
    await logEmailHistory({
      business: businessId,
      invoice: invoiceId,
      recipientEmail,
      recipientName,
      subject,
      emailType: "invoice_overdue",
      status: "sent",
      metadata: { daysOverdue, amountDue },
      createdBy
    });

    return true;
  } catch (error) {
    console.error(`❌ Failed to send overdue email: ${error.message}`);
    
    // Log failure to email history
    await logEmailHistory({
      business: businessId,
      invoice: invoiceId,
      recipientEmail,
      recipientName,
      subject,
      emailType: "invoice_overdue",
      status: "failed",
      errorMessage: error.message,
      createdBy
    });

    return false;
  }
};

/**
 * Send Invoice Shared notification
 */
export const sendInvoiceSharedEmail = async ({
  recipientEmail,
  recipientName,
  senderName,
  businessName,
  businessId,
  invoiceId,
  invoiceNumber,
  message,
  invoiceUrl,
  createdBy = null
}) => {
  const transporter = getEmailTransporter();
  if (!transporter) return false;

  const subject = `${senderName} shared Invoice ${invoiceNumber} with you`;
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Invoice Shared</h2>
      <p>Hello ${recipientName},</p>
      <p><strong>${senderName}</strong> from <strong>${businessName}</strong> has shared an invoice with you:</p>
      
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Invoice Number:</strong> ${invoiceNumber}</p>
        ${message ? `<p><strong>Message:</strong> ${message}</p>` : ""}
      </div>
      
      <p>
        <a href="${invoiceUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
          View Invoice
        </a>
      </p>
      
      <p style="color: #666; font-size: 12px; margin-top: 30px;">
        This is an automated email. Please do not reply to this message.
      </p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: recipientEmail,
      subject,
      html: htmlContent,
    });

    console.log(`✅ Invoice shared email sent to ${recipientEmail}`);
    
    // Log to email history
    await logEmailHistory({
      business: businessId,
      invoice: invoiceId,
      recipientEmail,
      recipientName,
      subject,
      emailType: "invoice_shared",
      status: "sent",
      sharedMessage: message,
      createdBy
    });

    return true;
  } catch (error) {
    console.error(`❌ Failed to send invoice shared email: ${error.message}`);
    
    // Log failure to email history
    await logEmailHistory({
      business: businessId,
      invoice: invoiceId,
      recipientEmail,
      recipientName,
      subject,
      emailType: "invoice_shared",
      status: "failed",
      errorMessage: error.message,
      sharedMessage: message,
      createdBy
    });

    return false;
  }
};

/**
 * Send Budget Exceeded Alert
 */
export const sendBudgetExceededEmail = async ({
  recipientEmail,
  recipientName,
  businessName,
  businessId,
  month,
  year,
  categories,
  totalVariance,
  expensesUrl,
  createdBy = null
}) => {
  const transporter = getEmailTransporter();
  if (!transporter) return false;

  const subject = `Budget Alert: Expenses exceeding budget for ${month}/${year}`;
  
  // Format categories into HTML rows
  const categoryRows = categories.map(cat => `
    <tr style="border-bottom: 1px solid #e0e0e0;">
      <td style="padding: 10px; text-align: left;">${cat.label}</td>
      <td style="padding: 10px; text-align: right;">₦${cat.budget.toLocaleString()}</td>
      <td style="padding: 10px; text-align: right;">₦${cat.actual.toLocaleString()}</td>
      <td style="padding: 10px; text-align: right; color: #d32f2f; font-weight: bold;">+₦${cat.variance.toLocaleString()} (${cat.variancePercent.toFixed(1)}%)</td>
    </tr>
  `).join('');

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
      <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; border-left: 4px solid #ffc107; margin-bottom: 20px;">
        <h2 style="margin: 0; color: #856404;">⚠️ Budget Alert - ${month}/${year}</h2>
        <p style="margin: 5px 0; color: #856404;">Hello ${recipientName},</p>
      </div>

      <p style="color: #333; margin: 15px 0;">
        <strong>${businessName}</strong> has exceeded its budget for <strong>${month}/${year}</strong>.
      </p>

      <p style="color: #d32f2f; font-weight: bold; margin: 15px 0;">
        Total Overspend: ₦${Math.abs(totalVariance).toLocaleString()}
      </p>

      <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background-color: #f9f9f9;">
        <thead>
          <tr style="background-color: #f0f0f0; border-bottom: 2px solid #d0d0d0;">
            <th style="padding: 12px; text-align: left; font-weight: bold;">Category</th>
            <th style="padding: 12px; text-align: right; font-weight: bold;">Budget</th>
            <th style="padding: 12px; text-align: right; font-weight: bold;">Actual</th>
            <th style="padding: 12px; text-align: right; font-weight: bold;">Variance</th>
          </tr>
        </thead>
        <tbody>
          ${categoryRows}
        </tbody>
      </table>

      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p style="margin: 5px 0; font-size: 13px; color: #666;">
          <strong>Recommended Actions:</strong>
        </p>
        <ul style="margin: 10px 0; padding-left: 20px; color: #666; font-size: 13px;">
          <li>Review expense approvals for the month</li>
          <li>Identify cost-saving opportunities</li>
          <li>Adjust budget for upcoming months if needed</li>
          <li>Prioritize essential expenses only</li>
        </ul>
      </div>

      <p>
        <a href="${expensesUrl}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
          Review Expenses Dashboard
        </a>
      </p>

      <p style="color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #e0e0e0; padding-top: 20px;">
        This is an automated budget alert. You are receiving this because you have finance/admin permissions for ${businessName}. 
        To modify alert preferences, contact your business administrator.
      </p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: recipientEmail,
      subject,
      html: htmlContent,
    });

    console.log(`✅ Budget exceeded alert sent to ${recipientEmail}`);
    
    // Log to email history
    await logEmailHistory({
      business: businessId,
      recipientEmail,
      recipientName,
      subject,
      emailType: "budget_exceeded",
      status: "sent",
      metadata: { 
        month, 
        year, 
        categoriesCount: categories.length,
        totalVariance,
        overBudgetCategories: categories.map(c => c.label)
      },
      createdBy
    });

    return true;
  } catch (error) {
    console.error(`❌ Failed to send budget alert email: ${error.message}`);
    
    // Log failure to email history
    await logEmailHistory({
      business: businessId,
      recipientEmail,
      recipientName,
      subject,
      emailType: "budget_exceeded",
      status: "failed",
      errorMessage: error.message,
      metadata: { month, year, categoriesCount: categories.length },
      createdBy
    });

    return false;
  }
};

export default {
  sendInvoiceCreatedEmail,
  sendPaymentReceivedEmail,
  sendInvoiceOverdueEmail,
  sendInvoiceSharedEmail,
  sendBudgetExceededEmail,
  logEmailHistory
};
