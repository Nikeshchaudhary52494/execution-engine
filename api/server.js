const express = require("express");
const { executionQueue } = require("../queue/queue");

const app = express();
app.use(express.json());

const IORedis = require("ioredis");

const redis = new IORedis({
  host: process.env.REDIS_HOST || "redis", // docker service name
  port: 6379,
  maxRetriesPerRequest: null,
});

/**
 * Submit a job
 */
app.post("/v1/jobs", async (req, res) => {
  const {
    code,
    language,
    priority = 10,
    stdin = "",
    timeoutMs = 3000,
    metadata = {},
  } = req.body;

  if (!code || !language) {
    return res.status(400).json({
      error: "code and language are required",
    });
  }

  const job = await executionQueue.add(
    "execute",
    {
      code,
      language,
      stdin,
      timeoutMs,
      metadata,
    },
    {
      priority,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 1000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    }
  );

  res.status(202).json({
    jobId: job.id,
    status: "queued",
  });
});

/**
 * Get job result
 */
app.get("/v1/jobs/:id", async (req, res) => {
  const jobId = req.params.id;

  // 1️⃣ CHECK FINAL RESULT (PRIMARY SOURCE)
  const result = await redis.get(`job:result:${jobId}`);
  if (result) {
    return res.json({
      status: "completed",
      ...JSON.parse(result),
    });
  }

  // 2️⃣ CHECK QUEUE (JOB STILL RUNNING)
  const job = await executionQueue.getJob(jobId);
  if (!job) {
    return res.status(404).json({
      error: "Job not found",
    });
  }

  const state = await job.getState();

  return res.json({
    status: state === "waiting" || state === "delayed" ? "queued" : "running",
  });
});

app.listen(3001, () => {
  console.log("🚀 API server running on port 3001");
});
