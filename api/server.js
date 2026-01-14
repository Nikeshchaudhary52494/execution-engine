const express = require("express");
const { executionQueue } = require("../queue/queue");

const app = express();
app.use(express.json());

/**
 * Submit a job
 */
app.post("/run", async (req, res) => {
  const { code, language, priority } = req.body;

  if (!code || !language) {
    return res.status(400).json({
      error: "code and language are required",
    });
  }

  const job = await executionQueue.add(
    "execute",
    { code, language },
    {
      // 🔁 Retry + backoff
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 1000, // 1s → 2s → 4s
      },

      // ⚡ Priority (lower = higher priority)
      priority: Number.isInteger(priority) ? priority : 10,

      // 🧹 Cleanup policy
      removeOnComplete: true,
      removeOnFail: false, // keep failed jobs for DLQ
    }
  );

  res.json({
    jobId: job.id,
    status: "queued",
    priority: job.opts.priority,
  });
});

/**
 * Get job result
 */
app.get("/result/:id", async (req, res) => {
  const job = await executionQueue.getJob(req.params.id);

  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }

  const state = await job.getState();

  if (state === "completed") {
    const result = await job.returnvalue;
    return res.json(result);
  }

  if (state === "failed") {
    return res.json({
      error: job.failedReason,
      exitCode: 1,
    });
  }

  res.json({ status: state }); // waiting | active | delayed
});

app.listen(3001, () => {
  console.log("🚀 API server running on port 3001");
});
