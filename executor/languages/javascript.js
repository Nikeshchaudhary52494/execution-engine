module.exports = {
  name: "javascript",
  image: "node:18-alpine",
  extension: "js",

  command(file) {
    return ["node", file];
  },

  forkBombSignatures: [
    "uv_thread_create",
    "Resource temporarily unavailable",
  ],
};
