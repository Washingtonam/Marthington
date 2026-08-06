import "dotenv/config";
import connectDB from "./config/db.js";

// Connect to DB first
const startWorker = async () => {
  try {
    await connectDB();
    console.log("✅ Worker connected to DB");

    // Import the worker module which registers processors
    await import("./workers/branchImport.worker.js");

    console.log("✅ Branch import worker started");
  } catch (err) {
    console.error("Worker failed to start:", err.message || err);
    process.exit(1);
  }
};

startWorker();

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("Worker shutting down (SIGINT)");
  process.exit(0);
});
process.on("SIGTERM", () => {
  console.log("Worker shutting down (SIGTERM)");
  process.exit(0);
});
