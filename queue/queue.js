const { Queue } = require("bullmq");
const connection = require("./connection");

const executionQueue = new Queue("execution", {
  connection,
});

module.exports = { executionQueue };
