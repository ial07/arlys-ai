/**
 * Preview Service
 *
 * Manages build previews by spawning ephemeral dev servers on allocated ports.
 * Maps session IDs to running processes.
 */

import { spawn, ChildProcess } from "child_process";
import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

// In-memory store for running processes (resets on main server restart)
const runningPreviews = new Map<
  string,
  {
    process: ChildProcess;
    port: number;
    startTime: number;
    timeoutId: NodeJS.Timeout;
  }
>();

// Port allocation range
const START_PORT = 3100;
const END_PORT = 3200;
const PREVIEW_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

export const previewService = {
  /**
   * Start a preview server for a session
   */
  async startPreview(
    sessionId: string,
    projectPath: string
  ): Promise<{ success: boolean; url?: string; message?: string }> {
    try {
      // 1. Check if already running
      if (runningPreviews.has(sessionId)) {
        const info = runningPreviews.get(sessionId)!;
        // Reset timeout on access if desired? No, simpler to stick to strict limit for now.
        return {
          success: true,
          url: `http://localhost:${info.port}`,
          message: "Preview already running",
        };
      }

      // 2. Allocate port
      const port = await allocatePort();
      if (!port) {
        return { success: false, message: "No available ports for preview" };
      }

      // STATIC MODE CHECK:
      // If no package.json but index.html exists, do NOT start server.
      // Just mark session as "active" in DB so the proxy knows to serve files.
      const fs = await import("fs/promises");
      const path = await import("path");

      const hasPackageJson = await fs
        .access(path.join(projectPath, "package.json"))
        .then(() => true)
        .catch(() => false);
      const hasIndexHtml = await fs
        .access(path.join(projectPath, "index.html"))
        .then(() => true)
        .catch(() => false);

      if (!hasPackageJson && hasIndexHtml) {
        console.log(
          `[Preview] Static mode detected for ${sessionId}. Skipping dev server.`
        );

        // Generate secure token and update DB
        // We set port to 0 to indicate static mode (or just keep it allocated but unused?
        // The proxy checks for 'info', but we won't have 'info' in memory if we don't store it.
        // Wait, the Proxy checks 'previewService.getPreviewInfo(sessionId)'.
        // So we MUST store something in runningPreviews.

        const previewToken = crypto.randomUUID().replace(/-/g, "").slice(0, 16);

        // Fake process mock
        const mockChild = {
          kill: () => {},
          stdout: { on: () => {} },
          stderr: { on: () => {} },
          on: () => {},
        } as any;

        const timeoutId = setTimeout(() => {
          console.log(`[Preview] Auto-stopping static session ${sessionId}`);
          this.stopPreview(sessionId);
        }, PREVIEW_TIMEOUT_MS);

        runningPreviews.set(sessionId, {
          process: mockChild,
          port: 0, // 0 = Static Mode
          startTime: Date.now(),
          timeoutId,
        });

        await prisma.session.update({
          where: { id: sessionId },
          data: {
            previewUrl: `/api/preview/${sessionId}/index.html?token=${previewToken}`,
            previewPort: 0,
            previewToken,
          } as any,
        });

        return {
          success: true,
          url: `/api/preview/${sessionId}/index.html`,
          message: "Static preview ready",
        };
      }

      // 3. Spawn process
      console.log(
        `[Preview] Starting dev server for ${sessionId} on port ${port}...`
      );

      const child = spawn("npm", ["run", "dev", "--", "-p", port.toString()], {
        cwd: projectPath,
        stdio: "pipe",
        env: { ...process.env, PORT: port.toString() },
        detached: false,
      });

      // Capture logs
      child.stdout?.on("data", (data) =>
        console.log(`[Preview:${port}] ${data}`)
      );
      child.stderr?.on("data", (data) =>
        console.error(`[Preview:${port} ERR] ${data}`)
      );

      child.on("error", (err) => {
        console.error(`[Preview:${port}] Failed to start:`, err);
      });

      child.on("close", (code) => {
        if (code !== 0 && code !== null) {
          console.error(`[Preview:${port}] Process exited with code ${code}`);
          const current = runningPreviews.get(sessionId);
          if (current) clearTimeout(current.timeoutId);
          runningPreviews.delete(sessionId);
        }
      });

      // 4. Setup Auto-Cleanup
      const timeoutId = setTimeout(() => {
        console.log(
          `[Preview] Auto-stopping session ${sessionId} due to timeout`
        );
        this.stopPreview(sessionId);
      }, PREVIEW_TIMEOUT_MS);

      // 5. Store process info
      runningPreviews.set(sessionId, {
        process: child,
        port,
        startTime: Date.now(),
        timeoutId,
      });

      // 6. Generate secure token and update DB
      const previewToken = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
      await prisma.session.update({
        where: { id: sessionId },
        data: {
          previewUrl: `/api/preview/${sessionId}?token=${previewToken}`,
          previewPort: port,
          previewToken,
        } as any,
      });

      // 6. Wait for port to be ready (max 30s)
      let attempts = 0;
      while (attempts < 30) {
        if (await isPortListening(port)) {
          return {
            success: true,
            url: `/api/preview/${sessionId}`,
            message: `Preview started on port ${port}`,
          };
        }
        await new Promise((r) => setTimeout(r, 1000));
        attempts++;
      }

      // If timeout, kill and fail
      child.kill();
      runningPreviews.delete(sessionId);
      return { success: false, message: "Preview server timed out starting" };
    } catch (error: any) {
      console.error("[Preview] Start failed:", error);
      return { success: false, message: error.message };
    }
  },

  /**
   * Stop a preview server
   */
  async stopPreview(sessionId: string): Promise<void> {
    const info = runningPreviews.get(sessionId);
    if (info) {
      console.log(
        `[Preview] Stopping server for ${sessionId} on port ${info.port}`
      );
      clearTimeout(info.timeoutId);
      info.process.kill();
      runningPreviews.delete(sessionId);

      // Cleanup DB
      await prisma.session
        .update({
          where: { id: sessionId },
          data: {
            previewUrl: null,
            previewPort: null,
          } as any,
        })
        .catch(() => {}); // Ignore if session deleted
    }
  },

  /**
   * Get active preview info
   */
  getPreviewInfo(sessionId: string) {
    return runningPreviews.get(sessionId);
  },
};

/**
 * Helper: Find available port
 */
async function allocatePort(): Promise<number | null> {
  const net = await import("net");

  for (let port = START_PORT; port <= END_PORT; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  return null;
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const net = require("net");
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

function isPortListening(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const net = require("net");
    const client = new net.Socket();
    client.connect(port, "127.0.0.1", () => {
      client.destroy();
      resolve(true);
    });
    client.on("error", () => {
      client.destroy();
      resolve(false);
    });
  });
}
