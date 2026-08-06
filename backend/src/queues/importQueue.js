import Queue from "bull";
import { processBranchImportJob } from "./branchImportProcessor.js";

const REDIS_URL = process.env.REDIS_URL || null;

let importQueue;

const createFallbackQueue = () => {
  console.warn("No REDIS_URL configured or Redis unavailable; using inline fallback for branch import jobs.");

  const fallback = {
    name: "branch-import",
    add: async (data) => {
      setImmediate(async () => {
        try {
          await processBranchImportJob(data);
        } catch (err) {
          console.error("Inline branch import failed:", err.message || err);
        }
      });
      return { id: null, data };
    },
    process: () => {
      console.warn("Inline fallback queue does not register a queue processor.");
      return null;
    },
    on: () => {
      return null;
    }
  };

  fallback.addInline = fallback.add;
  return fallback;
};

if (!REDIS_URL) {
  importQueue = createFallbackQueue();
} else {
  try {
    importQueue = new Queue("branch-import", REDIS_URL);

    importQueue.on("error", (err) => {
      console.error("Import queue error:", err.message || err);
    });

    importQueue.on("failed", (job, err) => {
      console.error(`Import job ${job.id} failed:`, err.message || err);
    });

    const realAdd = importQueue.add.bind(importQueue);
    importQueue.add = async (data, opts) => {
      try {
        return await realAdd(data, opts);
      } catch (err) {
        console.error("Queue add failed; falling back to inline processing:", err.message || err);
        return importQueue.addInline(data);
      }
    };

    importQueue.addInline = async (data) => {
      return createFallbackQueue().add(data);
    };
  } catch (err) {
    console.error("Failed to initialize Redis queue; falling back to inline processor:", err.message || err);
    importQueue = createFallbackQueue();
  }
}

export default importQueue;
