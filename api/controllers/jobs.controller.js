import {
  submitExecutionJob,
  getJob,
} from "../services/queue.service.js";
import { getJobResult } from "../services/result.service.js";

export const submitJob = async (req, res) => {
  const {
    code,
    language,
    priority = 10,
    timeoutMs = 3000,
    metadata = {},
  } = req.body;

  if (!code || !language) {
    return res.status(400).json({
      error: "code and language are required",
    });
  }

  const job = await submitExecutionJob({
    code,
    language,
    timeoutMs,
    metadata,
    priority,
  });

  return res.status(202).json({
    jobId: job.id,
    status: "queued",
  });
}

export const getJobStatus = async (req, res) => {
  const jobId = req.params.id;

  // 1️⃣ FINAL RESULT (PRIMARY SOURCE)
  const result = await getJobResult(jobId);
  if (result) {
    return res.json({
      status: "completed",
      ...result,
    });
  }

  // 2️⃣ QUEUE STATE
  const job = await getJob(jobId);
  if (!job) {
    return res.status(404).json({
      error: "Job not found",
    });
  }

  const state = await job.getState();

  return res.json({
    status:
      state === "waiting" || state === "delayed" ? "queued" : "running",
  });
}
