import IORedis from "ioredis";
import { REDIS_HOST } from "./env.js";

const redis = new IORedis({
  host: REDIS_HOST,
  port: 6379,
  maxRetriesPerRequest: null,
});

export default redis;
