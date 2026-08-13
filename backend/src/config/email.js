import nodemailer from "nodemailer";

/**
 * Email Configuration
 * Supports SMTP and Mailgun providers
 * Configure via environment variables:
 * - SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
 * - Or MAILGUN_API_KEY, MAILGUN_DOMAIN
 */

let transporter;

// Initialize email transporter based on provider
const initializeEmailTransporter = () => {
  if (process.env.SMTP_HOST) {
    // Use SMTP (Nodemailer)
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    console.log("✉️ Email configured with SMTP");
  } else if (process.env.MAILGUN_API_KEY) {
    // Mailgun support (future)
    console.log("⚠️ Mailgun support pending");
  } else {
    console.warn("⚠️ Email service not configured (SMTP or Mailgun credentials missing)");
  }
};

// Initialize on import
initializeEmailTransporter();

/**
 * Get email transporter
 */
export const getEmailTransporter = () => {
  if (!transporter) {
    console.warn("Email transporter not initialized. Configure SMTP_* environment variables.");
  }
  return transporter;
};

/**
 * Verify email configuration
 */
export const verifyEmailConfig = async () => {
  try {
    if (transporter) {
      await transporter.verify();
      console.log("✅ Email transporter verified successfully");
      return true;
    }
    return false;
  } catch (error) {
    console.error("❌ Email transporter verification failed:", error.message);
    return false;
  }
};

export default {
  getEmailTransporter,
  verifyEmailConfig,
};
