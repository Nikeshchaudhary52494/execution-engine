const { Worker } = require("bullmq");
const connection = require("../queue/connection");
const { executeJob } = require("../executor/executeJob");

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
      const { language, code } = job.data;

      // Execute sandboxed job
      const result = await executeJob({ language, code });

      // ✅ SUCCESS → no retry
      return {
        ...result,
        attemptsMade: job.attemptsMade,
      };
    } catch (err) {
      // ❌ USER ERROR → DO NOT RETRY
      if (isUserError(err)) {
        return {
          output: "",
          exitCode: 1,
          error: err.message,
          attemptsMade: job.attemptsMade,
        };
      }

      // 🔁 INFRA ERROR → RETRY (BullMQ handles backoff)
      throw err;
    }
  },
  { connection }
);

console.log("⚙️ Worker started and listening for jobs");
