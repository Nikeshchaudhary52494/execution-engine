const { Worker } = require("bullmq");
const connection = require("../queue/connection");
const { executeJob } = require("../executor/executeJob");

new Worker(
  "execution",
  async (job) => {
    const { language, code } = job.data;
    const result = await executeJob({ language, code });
    return result;
  },
  { connection }
);

console.log("⚙️ Worker started and listening for jobs");
