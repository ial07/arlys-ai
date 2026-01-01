/**
 * Arlys AI Worker Executor
 *
 * Executes preview builds:
 * 1. Copy preview template
 * 2. npm install (cached if lockfile unchanged)
 * 3. npm run dev
 * 4. Expose preview URL
 */

import fs from "fs-extra";
import path from "path";
import { execa } from "execa";
import { PREVIEW_STATUS } from "@arlys/shared/preview-status.js";

const TEMPLATE_PATH = path.resolve("../preview");
const BUILDS_PATH = path.resolve("/tmp/arlys-builds");

/**
 * Execute preview build for a session
 */
export async function executePreview(sessionId, files, onStatusChange) {
  const buildPath = path.join(BUILDS_PATH, sessionId);

  try {
    // INIT
    onStatusChange(PREVIEW_STATUS.INIT);

    // PREPARING_TEMPLATE
    onStatusChange(PREVIEW_STATUS.PREPARING_TEMPLATE);
    await fs.ensureDir(buildPath);
    await fs.copy(TEMPLATE_PATH, buildPath, { overwrite: true });

    // Write generated files
    for (const file of files) {
      const filePath = path.join(buildPath, file.path);
      await fs.ensureDir(path.dirname(filePath));
      await fs.writeFile(filePath, file.content, "utf-8");
    }

    // INSTALLING_DEPENDENCIES
    onStatusChange(PREVIEW_STATUS.INSTALLING_DEPENDENCIES);

    // Check if we can skip install (lockfile unchanged)
    const lockfilePath = path.join(buildPath, "package-lock.json");
    const cachedLockfile = path.join(
      BUILDS_PATH,
      ".cache",
      `${sessionId}-lock.json`
    );

    let skipInstall = false;
    if (
      (await fs.pathExists(lockfilePath)) &&
      (await fs.pathExists(cachedLockfile))
    ) {
      const current = await fs.readFile(lockfilePath, "utf-8");
      const cached = await fs.readFile(cachedLockfile, "utf-8");
      skipInstall = current === cached;
    }

    if (!skipInstall) {
      await execa("npm", ["install"], { cwd: buildPath, stdio: "inherit" });

      // Cache lockfile
      if (await fs.pathExists(lockfilePath)) {
        await fs.ensureDir(path.dirname(cachedLockfile));
        await fs.copy(lockfilePath, cachedLockfile);
      }
    }

    // STARTING_PREVIEW_SERVER
    onStatusChange(PREVIEW_STATUS.STARTING_PREVIEW_SERVER);

    const port = 3000 + Math.floor(Math.random() * 1000);
    const devProcess = execa("npm", ["run", "dev", "--", "-p", String(port)], {
      cwd: buildPath,
      stdio: "pipe",
    });

    // Wait for server to be ready
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("Server start timeout")),
        60000
      );

      devProcess.stdout?.on("data", (data) => {
        if (data.toString().includes("Ready")) {
          clearTimeout(timeout);
          resolve();
        }
      });

      devProcess.stderr?.on("data", (data) => {
        console.error(data.toString());
      });
    });

    // PREVIEW_READY
    onStatusChange(PREVIEW_STATUS.PREVIEW_READY);

    return {
      success: true,
      url: `http://localhost:${port}`,
      port,
      process: devProcess,
    };
  } catch (error) {
    console.error("Preview execution failed:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// CLI execution
if (process.argv[1]?.endsWith("index.js")) {
  const sessionId = process.argv[2] || "test";
  console.log(`Starting preview for session: ${sessionId}`);

  executePreview(sessionId, [], (status) => {
    console.log(`Status: ${status}`);
  });
}
