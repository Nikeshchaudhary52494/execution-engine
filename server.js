const express = require("express");
const Docker = require("dockerode");
const fs = require("fs");
const path = require("path");
const stream = require("stream");

const app = express();
const docker = new Docker();

app.use(express.json());

/**
 * Language configurations
 */
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

app.post("/run", async (req, res) => {
  const { code, language } = req.body;
  const config = languageConfigs[language];

  if (!config) {
    return res.status(400).json({ error: "Unsupported language" });
  }

  const jobId = Math.random().toString(36).substring(7);
  const fileName = `Main_${jobId}.${config.extension}`;
  const folderPath = path.join(__dirname, "temp");
  const filePath = path.join(folderPath, fileName);

  if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath);
  fs.writeFileSync(filePath, code);

  let container;
  let output = "";
  let killedByTimeout = false;
  let killedByOutputSpam = false;

  const TIME_LIMIT_MS = 3000;
  const MAX_RUNTIME_OUTPUT = 4096; // 4 KB

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

    /**
     * ⏱ TIME LIMIT (HIGHEST PRIORITY)
     */
    if (killedByTimeout) {
      return res.json({
        output: "",
        error: "Time Limit Exceeded (program ran too long)",
        exitCode: 124,
      });
    }

    /**
     * 💣 FORK BOMB — JS / PYTHON
     */
    const forkBombSignatures = [
      "pthread_create",
      "Resource temporarily unavailable",
      "uv_thread_create",
    ];

    if (forkBombSignatures.some((sig) => output.includes(sig))) {
      return res.json({
        output: "",
        error: "Process limit exceeded (possible fork bomb)",
        exitCode: 137,
      });
    }

    /**
     * 💣 FORK BOMB — C++
     */
    if (language === "cpp" && output.trim() === "Killed") {
      return res.json({
        output: "",
        error: "Process limit exceeded (possible fork bomb)",
        exitCode: 137,
      });
    }

    /**
     * 🧹 READ-ONLY FILE SYSTEM — Python / JS
     */
    if (
      output.includes("Read-only file system") ||
      output.includes("Errno 30")
    ) {
      return res.json({
        output: "",
        error: "Write access denied: file system is read-only",
        exitCode: 1,
      });
    }

    /**
     * 🧹 READ-ONLY FILE SYSTEM — C++ (silent failure)
     */
    if (language === "cpp" && output.trim() === "") {
      return res.json({
        output: "",
        error: "Write access denied: file system is read-only",
        exitCode: 1,
      });
    }

    const info = await container.inspect();

    res.json({
      output: output.trim(),
      exitCode: info.State.ExitCode,
    });
  } catch (err) {
    res.status(500).json({
      error: "Execution failed",
      details: err.message,
    });
  } finally {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    if (container) {
      try {
        await container.remove({ force: true });
      } catch (_) {}
    }
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`🚀 Secure Execution Engine running at http://localhost:${PORT}`);
});
