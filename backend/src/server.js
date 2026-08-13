import "dotenv/config";

import app from "./app.js";
import connectDB from "./config/db.js";

import runBusinessIndustryMigration from "./jobs/migrateBusinessIndustryType.job.js";
import cron from "node-cron";
import runSubscriptionCheck from "./jobs/subscription.job.js";
import startOverdueEmailCron from "./jobs/overduEmailReminder.job.js";
// workers are now run in a separate process via src/worker.js

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // ✅ CONNECT DB
    await connectDB();
    console.log("✅ Database connected");

    // 🔥 RUN MIGRATION IF ENABLED
    if (process.env.RUN_BUSINESS_MIGRATION === "true") {
      console.log("🔄 Business industryType migration enabled");
      await runBusinessIndustryMigration();
    }

    // 🔥 SAFE JOB WRAPPER
    const safeRunSubscriptionCheck = async (source = "manual") => {
      try {
        console.log(`🔄 Subscription job started (${source})`);
        await runSubscriptionCheck();
        console.log(`✅ Subscription job completed (${source})`);
      } catch (err) {
        console.error(`❌ Subscription job failed (${source}):`, err.message);
      }
    };

    // 🔥 RUN ON START
    await safeRunSubscriptionCheck("startup");

    // 🔥 CRON (MIDNIGHT DAILY)
    cron.schedule("0 0 * * *", async () => {
      await safeRunSubscriptionCheck("cron");
    });

    // � START OVERDUE EMAIL CRON JOB (DAILY AT 6 PM)
    startOverdueEmailCron();

    // �🔥 HEALTH CHECK (IMPORTANT FOR DEPLOYMENT)
    app.get("/health", (req, res) => {
      res.status(200).json({ status: "ok" });
    });

    // ✅ START SERVER
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

  } catch (err) {
    console.error("❌ Server failed to start:", err.message);
    process.exit(1);
  }
};

startServer();