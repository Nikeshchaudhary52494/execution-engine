import redis from "../config/redis.js";

export const getJobResult = async (jobId) => {
  const result = await redis.get(`job:result:${jobId}`);
  return result ? JSON.parse(result) : null;
}
