import importQueue from "../queues/importQueue.js";
import { processBranchImportJob } from "../queues/branchImportProcessor.js";

// Processor for branch import jobs
importQueue.process(async (job) => {
  await processBranchImportJob(job.data);
});

export default importQueue;
