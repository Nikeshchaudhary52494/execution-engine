const Docker = require("dockerode");
const fs = require("fs");
const path = require("path");
const stream = require("stream");

const docker = new Docker();

const languageConfigs = {
  python: {
    image: "python:3.9-alpine",
    extension: "py",
    command: (file) => ["python3", `/app/${file}`],
  },
  javascript: {
    image: "node:18-alpine",
    extension: "js",
    command: (file) => ["node", `/app/${file}`],
  },
  cpp: {
    image: "gcc:latest",
    extension: "cpp",
    command: (file) => [
      "sh",
      "-c",
      `g++ /app/${file} -o /tmp/out && chmod +x /tmp/out && /tmp/out`,
    ],
  },
  java: {
    image: "bellsoft/liberica-openjdk-alpine:17",
    extension: "java",
    command: (file) => [
      "sh",
      "-c",
      `javac /app/${file} -d /tmp && java -cp /tmp ${file.replace(
        ".java",
        ""
      )}`,
    ],
  },
};

async function executeJob({ code, language }) {
  const config = languageConfigs[language];
  if (!config) {
    return { error: "Unsupported language", exitCode: 400 };
  }

  const jobId = Math.random().toString(36).substring(7);
  const fileName = `Main_${jobId}.${config.extension}`;

  const hostCwd = process.env.HOST_CWD;
  const folderPath = hostCwd ? path.join(hostCwd, "temp") : path.join(__dirname, "..", "temp");
  
  const tempPath = path.join(__dirname, "..", "temp");
  const filePath = path.join(tempPath, fileName);

  if (!fs.existsSync(tempPath)) fs.mkdirSync(tempPath);
  fs.writeFileSync(filePath, code);

  let container;
  let output = "";
  let killedByTimeout = false;
  let killedByOutputSpam = false;

  const TIME_LIMIT_MS = 3000;
  const MAX_RUNTIME_OUTPUT = 4096;

  try {
    container = await docker.createContainer({
      Image: config.image,
      Cmd: config.command(fileName),
      AttachStdout: true,
      AttachStderr: true,
      Tty: false,
      HostConfig: {
        Binds: [`${folderPath}:/app:ro`],
        NetworkMode: "none",
        Memory: 128 * 1024 * 1024,
        PidsLimit: 50,
        Tmpfs: {
          "/tmp": "size=50M,exec",
        },
      },
    });

    const attachStream = await container.attach({
      stream: true,
      stdout: true,
      stderr: true,
    });

    const stdout = new stream.PassThrough();
    const stderr = new stream.PassThrough();

    const handleChunk = async (chunk) => {
      if (output.length < MAX_RUNTIME_OUTPUT) {
        output += chunk.toString();
      } else if (!killedByOutputSpam) {
        killedByOutputSpam = true;
        killedByTimeout = true;
        try {
          await container.kill();
        } catch (_) {}
      }
    };

    stdout.on("data", handleChunk);
    stderr.on("data", handleChunk);
    docker.modem.demuxStream(attachStream, stdout, stderr);

    await container.start();

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(async () => {
        killedByTimeout = true;
        try {
          await container.kill();
        } catch (_) {}
        reject();
      }, TIME_LIMIT_MS);
    });

    try {
      await Promise.race([container.wait(), timeoutPromise]);
    } catch (_) {}

    // ⏱ TIME LIMIT
    if (killedByTimeout) {
      return {
        error: "Time Limit Exceeded (program ran too long)",
        exitCode: 124,
      };
    }

    // 💣 Fork bomb (JS / Python)
    const forkBombSignatures = [
      "pthread_create",
      "Resource temporarily unavailable",
      "uv_thread_create",
    ];
    if (forkBombSignatures.some((sig) => output.includes(sig))) {
      return {
        error: "Process limit exceeded (possible fork bomb)",
        exitCode: 137,
      };
    }

    // 💣 Fork bomb (C++)
    if (language === "cpp" && output.trim() === "Killed") {
      return {
        error: "Process limit exceeded (possible fork bomb)",
        exitCode: 137,
      };
    }

    // 🔒 Read-only FS
    if (
      output.includes("Read-only file system") ||
      output.includes("Errno 30") ||
      (language === "cpp" && output.trim() === "")
    ) {
      return {
        error: "Write access denied: file system is read-only",
        exitCode: 1,
      };
    }

    const info = await container.inspect();
    return { output: output.trim(), exitCode: info.State.ExitCode };
  } finally {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    if (container) {
      try {
        await container.remove({ force: true });
      } catch (_) {}
    }
  }
}

module.exports = { executeJob };
