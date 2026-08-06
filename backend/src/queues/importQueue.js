import Queue from "bull";

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

const importQueue = new Queue("branch-import", REDIS_URL);

export default importQueue;
