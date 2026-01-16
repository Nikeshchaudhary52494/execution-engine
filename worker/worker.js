import { Worker } from "bullmq";
import connection from "../queue/connection.js";
import { executeJob } from "../executor/index.js";
import redis from "../api/config/redis.js";

const isUserError = (err) => {
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
};

new Worker(
  "execution",
  async (job) => {
    try {
      const result = await executeJob(job.data);
      console.log(`Storing result for job ${job.id}`, result);

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
