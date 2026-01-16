export const requiredEnv = (name, defaultValue) => {
  if (process.env[name]) return process.env[name];
  if (defaultValue !== undefined) return defaultValue;
  throw new Error(`${name} environment variable is not set.`);
}

export const REDIS_HOST = requiredEnv("REDIS_HOST", "redis");
export const API_PORT = requiredEnv("API_PORT", 3001);
