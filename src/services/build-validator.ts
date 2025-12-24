/**
 * Build Validator Service
 *
 * Validates generated applications before download with step-by-step progress reporting.
 * Follows 7-step validation flow with retry logic.
 */

import prisma from "@/lib/prisma";

interface ValidationResult {
  success: boolean;
  step: string;
  message: string;
  errors?: string[];
}

interface BuildValidationContext {
  sessionId: string;
  files: Array<{ path: string; content: string }>;
}

const MAX_RETRIES = 3;

/**
 * Emit progress message to UI
 */
async function emitStatus(sessionId: string, status: string): Promise<void> {
  await prisma.message.create({
    data: {
      sessionId,
      role: "system",
      content: `🔨 STATUS: ${status}`,
    },
  });
}

import * as fs from "fs/promises";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * Step 1: Initialize Build - Verify project structure and WRITE TO DISK
 */
async function step1_initializeBuild(
  ctx: BuildValidationContext
): Promise<ValidationResult> {
  await emitStatus(ctx.sessionId, "Preparing project");

  const hasPackageJson = ctx.files.some((f) => f.path === "package.json");
  const hasLayout = ctx.files.some(
    (f) => f.path.includes("layout.js") || f.path.includes("layout.tsx")
  );
  const hasPage = ctx.files.some(
    (f) => f.path.includes("page.js") || f.path.includes("page.tsx")
  );

  const errors: string[] = [];
  if (!hasPackageJson) errors.push("Missing package.json");
  if (!hasLayout) errors.push("Missing layout file");
  if (!hasPage) errors.push("Missing page file");

  if (errors.length > 0) {
    return {
      success: false,
      step: "initialize",
      message: "Missing required files",
      errors,
    };
  }

  // WRITE FILES TO DISK for Preview
  try {
    // Determine strict project path
    const projectPath = path.join("/tmp", "arlys", ctx.sessionId);

    // Clean existing
    await fs.rm(projectPath, { recursive: true, force: true });
    await fs.mkdir(projectPath, { recursive: true });

    // Write all files
    for (const file of ctx.files) {
      const filePath = path.join(projectPath, file.path);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, file.content, "utf-8");
    }
  } catch (error: any) {
    return {
      success: false,
      step: "initialize",
      message: `Failed to write files: ${error.message}`,
      errors: [error.message],
    };
  }

  return {
    success: true,
    step: "initialize",
    message: "Project structure valid & written to disk",
    errors: [],
  };
}

/**
 * Step 2: Dependency Install - Validate package.json AND RUN NPM INSTALL
 */
async function step2_dependencyInstall(
  ctx: BuildValidationContext
): Promise<ValidationResult> {
  await emitStatus(ctx.sessionId, "Installing dependencies");

  const packageJson = ctx.files.find((f) => f.path === "package.json");
  if (!packageJson) {
    return {
      success: false,
      step: "dependencies",
      message: "package.json not found",
      errors: ["Missing package.json"],
    };
  }

  try {
    // 1. Validate JSON
    const pkg = JSON.parse(packageJson.content);
    const errors: string[] = [];

    if (!pkg.dependencies?.next) errors.push("Missing next dependency");
    if (!pkg.dependencies?.react) errors.push("Missing react dependency");
    if (!pkg.scripts?.dev) errors.push("Missing dev script");

    if (errors.length > 0) {
      return {
        success: false,
        step: "dependencies",
        message: "Package.json has issues",
        errors,
      };
    }

    // 2. RUN NPM INSTALL
    const projectPath = path.join("/tmp", "arlys", ctx.sessionId);
    // Use shell execution for install
    // This might take time, so we increase timeout or simple await
    // Note: In production you might want to cache node_modules or use pnpm
    await execAsync("npm install", { cwd: projectPath });

    // 4. Capture package-lock.json
    try {
      const lockFileContent = await fs.readFile(
        path.join(projectPath, "package-lock.json"),
        "utf-8"
      );

      // Save to DB so it's included in download
      await prisma.generatedFile.upsert({
        where: {
          sessionId_path: {
            sessionId: ctx.sessionId,
            path: "package-lock.json",
          },
        },
        create: {
          sessionId: ctx.sessionId,
          path: "package-lock.json",
          content: lockFileContent,
          language: "json",
          action: "create",
        },
        update: {
          content: lockFileContent,
          action: "modify",
          version: { increment: 1 },
        },
      });
    } catch (err) {
      console.warn("Could not capture package-lock.json:", err);
      // Warning only, don't fail build
    }

    return {
      success: true,
      step: "dependencies",
      message: "Dependencies installed successfully",
      errors: [],
    };
  } catch (e: any) {
    return {
      success: false,
      step: "dependencies",
      message: `Install failed: ${e.message}`,
      errors: [e.message],
    };
  }
}

/**
 * Step 3: Environment Check - Validate .env.example
 */
async function step3_environmentCheck(
  ctx: BuildValidationContext
): Promise<ValidationResult> {
  await emitStatus(ctx.sessionId, "Checking environment variables");

  const envFile = ctx.files.find(
    (f) => f.path === ".env.example" || f.path === ".env"
  );

  // .env is optional for some projects
  return {
    success: true,
    step: "environment",
    message: envFile ? "Environment file found" : "No .env file (optional)",
  };
}

/**
 * Step 4: Prisma Validation - Check schema if exists
 */
async function step4_prismaValidation(
  ctx: BuildValidationContext
): Promise<ValidationResult> {
  await emitStatus(ctx.sessionId, "Validating database schema");

  const prismaSchema = ctx.files.find(
    (f) => f.path.includes("schema.prisma") || f.path.includes("prisma/schema")
  );

  if (!prismaSchema) {
    return {
      success: true,
      step: "prisma",
      message: "No Prisma schema (skipped)",
    };
  }

  // Basic schema validation
  const content = prismaSchema.content;
  const errors: string[] = [];

  if (!content.includes("datasource")) errors.push("Missing datasource block");
  if (!content.includes("generator")) errors.push("Missing generator block");

  return {
    success: errors.length === 0,
    step: "prisma",
    message: errors.length === 0 ? "Prisma schema valid" : "Schema has issues",
    errors,
  };
}

import { previewService } from "./preview.service";

/**
 * Step 5: Application Run - Basic syntax validation and START PREVIEW
 */
/**
 * Step 5: Application Run - Build & Runtime Validation
 * 1. npm run build (catch compilation errors)
 * 2. Start preview server
 * 3. Verify runtime responsiveness
 */
async function step5_applicationRun(
  ctx: BuildValidationContext
): Promise<ValidationResult> {
  const projectPath = path.join("/tmp", "arlys", ctx.sessionId);
  const errors: string[] = [];

  // 1. RUN NPM BUILD (Production Build Check)
  await emitStatus(
    ctx.sessionId,
    "Running production build (npm run build)..."
  );

  try {
    // Increase maxBuffer for large build output
    // This catches type errors, lint errors, and import errors
    await execAsync("npm run build", {
      cwd: projectPath,
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (buildError: any) {
    console.error("Build failed:", buildError.message);
    // Try to extract relevant error lines from stdout/stderr
    const output = buildError.stdout || buildError.stderr || buildError.message;
    errors.push(`Build Failed: ${output.slice(-2000)}`); // Last 2000 chars

    return {
      success: false,
      step: "application",
      message: "Build failed (compilation error)",
      errors,
    };
  }

  // 2. START PREVIEW SERVER (Runtime Check)
  await emitStatus(ctx.sessionId, "Starting runtime preview...");

  // This uses preview service which handles spawning 'npm run dev' and waiting for port
  const preview = await previewService.startPreview(ctx.sessionId, projectPath);

  if (!preview.success) {
    errors.push(`Runtime Failed: ${preview.message}`);
    return {
      success: false,
      step: "application",
      message: "Runtime validation failed",
      errors,
    };
  }

  await emitStatus(
    ctx.sessionId,
    `Preview server running on port ${preview.url}`
  );

  return {
    success: true,
    step: "application",
    message: "Application running successfully",
    errors: [],
  };
}

/**
 * Step 6: Cleanup - Prepare for download
 */
async function step6_cleanup(
  ctx: BuildValidationContext
): Promise<ValidationResult> {
  await emitStatus(ctx.sessionId, "Cleaning build artifacts");

  // Filter out node_modules if somehow included
  const cleanFiles = ctx.files.filter((f) => !f.path.includes("node_modules"));

  return {
    success: true,
    step: "cleanup",
    message: `Prepared ${cleanFiles.length} files for download`,
  };
}

/**
 * Step 7: Final State - Mark ready
 */
async function step7_finalState(
  ctx: BuildValidationContext
): Promise<ValidationResult> {
  await emitStatus(ctx.sessionId, "Ready to download");

  return {
    success: true,
    step: "final",
    message: "Build validation complete",
  };
}

/**
 * Main validation function with retry logic
 */
export async function validateBuild(
  sessionId: string
): Promise<{ success: boolean; message: string; errors?: string[] }> {
  // Get all generated files
  const files = await prisma.generatedFile.findMany({
    where: { sessionId },
    select: { path: true, content: true },
  });

  const ctx: BuildValidationContext = { sessionId, files };

  const steps = [
    step1_initializeBuild,
    step2_dependencyInstall,
    step3_environmentCheck,
    step4_prismaValidation,
    step5_applicationRun,
    step6_cleanup,
    step7_finalState,
  ];

  for (const step of steps) {
    let retries = 0;
    let result: ValidationResult;

    do {
      result = await step(ctx);

      if (!result.success && retries < MAX_RETRIES) {
        await emitStatus(
          sessionId,
          `Retrying ${result.step} (${retries + 1}/${MAX_RETRIES})`
        );
        retries++;
      }
    } while (!result.success && retries < MAX_RETRIES);

    if (!result.success) {
      await emitStatus(sessionId, `Build failed at ${result.step}`);
      return { success: false, message: result.message, errors: result.errors };
    }
  }

  return { success: true, message: "Build validation passed", errors: [] };
}

export const buildValidator = {
  validate: validateBuild,
  emitStatus,
};
