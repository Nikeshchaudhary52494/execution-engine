import { Queue } from "bullmq";
import connection from "./connection.js";

export const executionQueue = new Queue("execution", {
  connection,
});
