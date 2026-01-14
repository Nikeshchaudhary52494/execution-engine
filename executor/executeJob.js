const Docker = require("dockerode");
const fs = require("fs");
const path = require("path");
const stream = require("stream");
const crypto = require("crypto");
const { getLanguage } = require("./languages");

const docker = new Docker();

const HOST_TMP = process.env.HOST_TMP;
if (!HOST_TMP) {
  throw new Error("HOST_TMP environment variable is not set.");
}
const CONTAINER_TMP = "/host-tmp";

async function executeJob({ code, language, timeoutMs = 3000 }) {
  console.log(`[executor] Starting job for language: ${language}`);
  const lang = getLanguage(language);
  if (!lang) {
    return { error: "Unsupported language", exitCode: 400 };
  }

  // 🔒 Job directory on HOST
  const jobId = crypto.randomUUID();
  const containerJobDir = path.join(CONTAINER_TMP, jobId);
  fs.mkdirSync(containerJobDir, { recursive: true });

  const fileName = `Main.${lang.extension}`;
  const containerFilePath = path.join(containerJobDir, fileName);
  fs.writeFileSync(containerFilePath, code);

  const hostJobDir = path.join(HOST_TMP, jobId);

  let output = "";
  let killed = false;
  const MAX_OUTPUT = 4096;

  let container;

  try {
    container = await docker.createContainer({
      Image: lang.image,
      Cmd: lang.command(`/job/${fileName}`),
      AttachStdout: true,
      AttachStderr: true,
      Tty: false,
      HostConfig: {
        // ✅ HOST → SANDBOX
        Binds: [`${hostJobDir}:/job:ro`],
        NetworkMode: "none",
        Memory: 128 * 1024 * 1024,
        PidsLimit: 50,
        Tmpfs: {
          "/tmp": "size=50M,exec",
        },
      },
    });

    const attach = await container.attach({
      stream: true,
      stdout: true,
      stderr: true,
    });

    const stdout = new stream.PassThrough();
    const stderr = new stream.PassThrough();

    const onData = async (chunk) => {
      if (output.length < MAX_OUTPUT) {
        output += chunk.toString();
      } else if (!killed) {
        killed = true;
        await container.kill().catch(() => {});
      }
    };

    stdout.on("data", onData);
    stderr.on("data", onData);
    docker.modem.demuxStream(attach, stdout, stderr);

    await container.start();

    console.log("[executor] Before Promise.race");
    await Promise.race([
      container.wait(),
      new Promise((_, reject) =>
        setTimeout(async () => {
          killed = true;
          await container.kill().catch(() => {});
          reject(new Error("TIMEOUT"));
        }, timeoutMs)
      ),
    ]);
    console.log("[executor] After Promise.race");

    if (killed) {
      console.log("[executor] Job timed out");
      return {
        error: "Time Limit Exceeded (program ran too long)",
        exitCode: 124,
      };
    }

    // 💣 Fork bomb detection
    if (
      lang.forkBombSignatures &&
      lang.forkBombSignatures.some((sig) => output.includes(sig))
    ) {
      return {
        error: "Process limit exceeded (possible fork bomb)",
        exitCode: 137,
      };
    }

    if (lang.detectForkBomb && lang.detectForkBomb(output)) {
      return {
        error: "Process limit exceeded (possible fork bomb)",
        exitCode: 137,
      };
    }

    if (
      output.includes("Read-only file system") ||
      output.includes("Errno 30")
    ) {
      return {
        error: "Write access denied: file system is read-only",
        exitCode: 1,
      };
    }

    const info = await container.inspect();
    console.log("[executor] Job finished, returning result");
    return {
      output: output.trim(),
      exitCode: info.State.ExitCode,
    };
  } finally {
    console.log("[executor] Entering finally block");
    if (container) {
      await container.remove({ force: true }).catch(() => {});
    }
    fs.rmSync(containerJobDir, { recursive: true, force: true });
  }
}

module.exports = { executeJob };
