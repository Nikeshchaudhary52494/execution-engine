import { executionQueue } from "../../queue/queue.js";

export const submitExecutionJob = async ({
  code,
  language,
  timeoutMs,
  metadata,
  priority,
}) => {
  return executionQueue.add(
    "execute",
    { code, language, timeoutMs, metadata },
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
}

export const getJob = async (jobId) => {
  return executionQueue.getJob(jobId);
}
