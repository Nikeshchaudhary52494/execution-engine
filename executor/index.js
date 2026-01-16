import { getLanguage } from "./languages/index.js";
import { createJobFS, cleanupJobFS } from "./fs/jobFs.js";
import { createExecutionContainer } from "./docker/container.js";
import { attachAndStream } from "./docker/stream.js";
import { createOutputLimiter } from "./limits/output.js";
import { timeoutPromise } from "./utils/timeout.js";

export const executeJob = async ({ code, language, timeoutMs = 3000 }) => {
  console.log(`[executor] Starting job for language: ${language}`);

  const lang = getLanguage(language);
  if (!lang) {
    return { error: "Unsupported language", exitCode: 400 };
  }

  const { fileName, containerJobDir, hostJobDir } = createJobFS(
    code,
    lang.extension,
  );

  let container;

  try {
    container = await createExecutionContainer(lang, hostJobDir, fileName);

    const limiter = createOutputLimiter(container, 4096);
    await attachAndStream(container, limiter.onData);

    await container.start();

    await Promise.race([
      container.wait(),
      timeoutPromise(timeoutMs, async () => {
        limiter.markKilled();
        await container.kill().catch(() => {});
      }),
    ]);

    if (limiter.wasKilled()) {
      return {
        error: "Time Limit Exceeded (program ran too long)",
        exitCode: 124,
      };
    }

    const output = limiter.getOutput();

    // Fork bomb detection
    if (
      lang.forkBombSignatures?.some((sig) => output.includes(sig)) ||
      (lang.detectForkBomb && lang.detectForkBomb(output))
    ) {
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
    return {
      output: output.trim(),
      exitCode: info.State.ExitCode,
    };
  } finally {
    if (container) {
      await container.remove({ force: true }).catch(() => {});
    }
    cleanupJobFS(containerJobDir);
  }
};
