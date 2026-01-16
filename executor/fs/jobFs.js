import fs from "fs";
import path from "path";
import crypto from "crypto";

const HOST_TMP = process.env.HOST_TMP;
if (!HOST_TMP) {
  throw new Error("HOST_TMP environment variable is not set.");
}

const CONTAINER_TMP = "/host-tmp";

export const createJobFS = (code, extension) => {
  const jobId = crypto.randomUUID();
  const fileName = `Main.${extension}`;

  const containerJobDir = path.join(CONTAINER_TMP, jobId);
  fs.mkdirSync(containerJobDir, { recursive: true });

  const containerFilePath = path.join(containerJobDir, fileName);
  fs.writeFileSync(containerFilePath, code);

  const hostJobDir = path.join(HOST_TMP, jobId);

  return {
    jobId,
    fileName,
    containerJobDir,
    hostJobDir,
  };
};

export const cleanupJobFS = (containerJobDir) => {
  fs.rmSync(containerJobDir, { recursive: true, force: true });
};
