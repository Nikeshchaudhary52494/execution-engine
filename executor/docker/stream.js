import stream from "stream";
import docker from "./client.js";

export const attachAndStream = (container, onData) => {
  return container.attach({
    stream: true,
    stdout: true,
    stderr: true,
  }).then((attach) => {
    const stdout = new stream.PassThrough();
    const stderr = new stream.PassThrough();

    stdout.on("data", onData);
    stderr.on("data", onData);

    docker.modem.demuxStream(attach, stdout, stderr);
  });
}
