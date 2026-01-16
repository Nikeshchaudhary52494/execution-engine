import docker from "./client.js";

export const createExecutionContainer = async (lang, hostJobDir, fileName) => {
  return docker.createContainer({
    Image: lang.image,
    Cmd: lang.command(`/job/${fileName}`),
    AttachStdout: true,
    AttachStderr: true,
    Tty: false,
    HostConfig: {
      Binds: [`${hostJobDir}:/job:ro`],
      AutoRemove: true,
      NetworkMode: "none",
      Memory: 128 * 1024 * 1024,
      PidsLimit: 32,
      Ulimits: [
        {
          Name: "cpu", // cpu time limit
          Soft: 2,
          Hard: 3,
        },
        {
          Name: "nproc", // number of processes limit
          Soft: 5,
          Hard: 5,
        },
      ],
      Tmpfs: {
        "/tmp": "size=50M,exec",
      },
    },
  });
};
