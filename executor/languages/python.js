export default {
  name: "python",
  image: "python:3.9-alpine",
  extension: "py",

  command: (file) => {
    return ["python3", file];
  },

  forkBombSignatures: [
    "pthread_create",
    "Resource temporarily unavailable",
    "uv_thread_create",
  ],
};
