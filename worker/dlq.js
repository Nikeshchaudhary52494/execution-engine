import { QueueEvents } from "bullmq";
import connection from "../queue/connection.js";

const queueEvents = new QueueEvents("execution", { connection });

queueEvents.on("failed", async ({ jobId, failedReason }) => {
  console.log("💀 DLQ JOB:", jobId);
  console.log("Reason:", failedReason);

  // Here you can:
  // 1. Save to DB
  // 2. Send alert
  // 3. Push to another queue
});

export default queueEvents;
