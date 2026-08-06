import importQueue from "./queues/importQueue.js";

const run = async () => {
  console.log("queue name:", importQueue.name);
  try {
    const result = await importQueue.add({ test: true });
    console.log("add result:", result);
  } catch (err) {
    console.error("queue add failed:", err.message || err);
  }
};

run().catch((err) => {
  console.error("unexpected error:", err.stack || err);
  process.exit(1);
});
