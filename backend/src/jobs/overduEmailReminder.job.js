import cron from "node-cron";
import Invoice from "../modules/invoices/invoice.model.js";
import Business from "../modules/businesses/business.model.js";
import Customer from "../modules/customers/customer.model.js";
import EmailHistory from "../models/emailHistory.model.js";
import { sendInvoiceOverdueEmail } from "../utils/emailService.js";

/**
 * Cron Job: Send Overdue Invoice Reminders
 * Runs daily at 6 PM (18:00)
 * Checks for invoices that are overdue and sends reminder emails
 */

export const startOverdueEmailCron = () => {
  // Schedule: "0 18 * * *" = Every day at 6 PM (18:00)
  cron.schedule("0 18 * * *", async () => {
    console.log("\n🔔 Running overdue invoice email cron job...");
    
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Find all overdue outgoing invoices that haven't been paid
      const overdueInvoices = await Invoice.find({
        transactionType: "outgoing",
        dueDate: { $lt: today },
        balanceDue: { $gt: 0 },
        status: { $in: ["pending", "overdue", "partial"] }
      })
        .populate("business", "name email")
        .populate("customer", "name email phone")
        .lean();

      console.log(`📊 Found ${overdueInvoices.length} overdue invoices`);

      let successCount = 0;
      let failureCount = 0;

      for (const invoice of overdueInvoices) {
        try {
          // Calculate days overdue
          const daysOverdue = Math.floor(
            (today - new Date(invoice.dueDate)) / (1000 * 60 * 60 * 24)
          );

          // Only send if at least 1 day overdue
          if (daysOverdue < 1) continue;

          const customerEmail = invoice.customer?.email || invoice.customerEmail;
          const customerName = invoice.customer?.name || invoice.customerName;

          if (!customerEmail) {
            console.warn(
              `⚠️ No email for invoice ${invoice.invoiceNumber}, skipping`
            );
            continue;
          }

          // Check if we already sent an overdue email for this invoice today
          const emailSentToday = await EmailHistory.findOne({
            invoice: invoice._id,
            emailType: "invoice_overdue",
            createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
          });

          if (emailSentToday) {
            console.log(
              `📧 Already sent overdue email for ${invoice.invoiceNumber} today, skipping`
            );
            continue;
          }

          // Send overdue email
          const sent = await sendInvoiceOverdueEmail({
            recipientEmail: customerEmail,
            recipientName: customerName,
            businessName: invoice.business?.name || "Our Business",
            businessId: invoice.business._id,
            invoiceId: invoice._id,
            invoiceNumber: invoice.invoiceNumber,
            daysOverdue,
            amountDue: `$${invoice.balanceDue.toFixed(2)}`,
            invoiceUrl: `${process.env.FRONTEND_URL}/invoices/${invoice._id}`,
            createdBy: null // System-generated
          });

          if (sent) {
            successCount++;
            console.log(
              `✅ Sent overdue email for invoice ${invoice.invoiceNumber} to ${customerEmail}`
            );
          } else {
            failureCount++;
            console.log(
              `❌ Failed to send overdue email for invoice ${invoice.invoiceNumber}`
            );
          }
        } catch (error) {
          failureCount++;
          console.error(
            `❌ Error processing invoice ${invoice.invoiceNumber}:`,
            error.message
          );
        }
      }

      console.log(
        `\n✨ Cron job completed: ${successCount} sent, ${failureCount} failed\n`
      );
    } catch (error) {
      console.error("❌ Error in overdue email cron job:", error.message);
    }
  });

  console.log("✅ Overdue email cron job scheduled (Daily at 6 PM)");
};

export default startOverdueEmailCron;
