const { Worker } = require("bullmq");
const IORedis = require("ioredis");
const connection = require("../queue/connection");
const { executeJob } = require("../executor/executeJob");

const redis = new IORedis({
  host: process.env.REDIS_HOST || "redis",
  port: 6379,
  maxRetriesPerRequest: null,
});

function isUserError(err) {
  if (!err) return false;
  const msg = err.message || "";
  return (
    msg.includes("Time Limit Exceeded") ||
    msg.includes("fork") ||
    msg.includes("Process limit exceeded") ||
    msg.includes("Read-only file system") ||
    msg.includes("SyntaxError") ||
    msg.includes("ReferenceError")
  );
}

new Worker(
  "execution",
  async (job) => {
    try {
      const result = await executeJob(job.data);

      // ✅ STORE RESULT (CRITICAL)
      await redis.set(
        `job:result:${job.id}`,
        JSON.stringify(result),
        "EX",
        300 // TTL 5 minutes
      );

      return result;
    } catch (err) {
      if (isUserError(err)) {
        const result = {
          output: "",
          exitCode: 1,
          error: err.message,
        };

        await redis.set(
          `job:result:${job.id}`,
          JSON.stringify(result),
          "EX",
          300
        );

        return result;
      }

      // 🔁 infra error → retry
      throw err;
    }
  },
  { connection }
);

console.log("⚙️ Worker started and listening for jobs");
