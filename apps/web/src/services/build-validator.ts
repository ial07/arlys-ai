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

const MAX_RETRIES = 0; // MVP STRICT MODE: NO retries allowed

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
 * STATIC HTML MODE: Only checks for index.html
 */
async function step1_initializeBuild(
  ctx: BuildValidationContext
): Promise<ValidationResult> {
  await emitStatus(ctx.sessionId, "Preparing project");

  // STATIC HTML MODE: Only check for index.html
  const hasIndexHtml = ctx.files.some((f) => f.path === "index.html");

  if (!hasIndexHtml) {
    return {
      success: false,
      step: "initialize",
      message: "Missing index.html",
      errors: ["Missing index.html - Static HTML mode requires this file"],
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
 * Step 2: Dependency Install - SKIPPED FOR STATIC HTML MODE
 * No npm install needed for pure static HTML files.
 */
async function step2_dependencyInstall(
  ctx: BuildValidationContext
): Promise<ValidationResult> {
  // STATIC HTML MODE: Only check for index.html
  const indexHtml = ctx.files.find((f) => f.path === "index.html");
  if (!indexHtml) {
    return {
      success: false,
      step: "dependencies",
      message: "index.html not found",
      errors: ["Missing index.html"],
    };
  }

  // SINGLE FILE MODE: Only index.html with inline animations
  // All animations embedded in <script> tags within HTML
  const ALLOWED_PATTERNS = [
    /^index\.html$/,
    /^style\.css$/, // Optional legacy support
    /^main\.js$/, // Optional legacy support
  ];

  const isAllowed = (filePath: string) => {
    return ALLOWED_PATTERNS.some((pattern) => pattern.test(filePath));
  };

  const forbiddenFiles = ctx.files.filter((f) => !isAllowed(f.path));

  if (forbiddenFiles.length > 0) {
    const forbiddenList = forbiddenFiles.map((f) => f.path).join(", ");
    return {
      success: false,
      step: "dependencies",
      message: `HTML ONLY CONTRACT VIOLATED. Forbidden files detected: ${forbiddenList}`,
      errors: [`Forbidden files: ${forbiddenList}`],
    };
  }

  return {
    success: true,
    step: "dependencies",
    message: "Static files valid (Tailwind CSS CDN + GSAP mode)",
    errors: [],
  };
}

/**
 * Step 2b: Content Validation - Reject React/JSX/Babel patterns
 * FAIL if any forbidden framework code is detected
 */
const FORBIDDEN_CONTENT_PATTERNS = [
  { pattern: /\bReact\b/, name: "React" },
  { pattern: /\bReactDOM\b/, name: "ReactDOM" },
  { pattern: /\bJSX\b/i, name: "JSX" },
  { pattern: /\bbabel\b/i, name: "Babel" },
  { pattern: /\bframer-motion\b/i, name: "Framer Motion" },
  { pattern: /\buseState\b/, name: "useState hook" },
  { pattern: /\buseEffect\b/, name: "useEffect hook" },
  { pattern: /import\s+.*\s+from\s+['"]react['"]/, name: "React import" },
  { pattern: /createRoot\s*\(/, name: "React createRoot" },
  { pattern: /\.jsx\b/, name: "JSX file reference" },
];

async function step2b_contentValidation(
  ctx: BuildValidationContext
): Promise<ValidationResult> {
  await emitStatus(ctx.sessionId, "Validating content (no React/JSX)");

  const errors: string[] = [];

  for (const file of ctx.files) {
    for (const { pattern, name } of FORBIDDEN_CONTENT_PATTERNS) {
      if (pattern.test(file.content)) {
        errors.push(`${file.path}: Contains forbidden ${name}`);
      }
    }
  }

  if (errors.length > 0) {
    return {
      success: false,
      step: "content_validation",
      message: `React/JSX detected! Static HTML only.`,
      errors,
    };
  }

  // Check index.html has visible content
  const indexHtml = ctx.files.find((f) => f.path === "index.html");
  if (indexHtml) {
    const bodyMatch = indexHtml.content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) {
      const bodyContent = bodyMatch[1]
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<!--[\s\S]*?-->/g, "")
        .trim();

      if (bodyContent.length < 500) {
        return {
          success: false,
          step: "content_validation",
          message: `index.html has insufficient visible content (${bodyContent.length} chars). Content must exist in HTML, not generated by JS.`,
          errors: ["Visible HTML content too short - may render blank"],
        };
      }
    }
  }

  return {
    success: true,
    step: "content_validation",
    message: "Content validation passed (pure static HTML)",
    errors: [],
  };
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

// step5_applicationRun removed for static html mode

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
 * Step 5: Static Preview Initialization
 * Explicitly registers the static preview URL without running npm.
 */
import { previewService } from "@/services/preview.service";

async function step5_staticPreview(
  ctx: BuildValidationContext
): Promise<ValidationResult> {
  await emitStatus(ctx.sessionId, "Initializing static preview");

  // Define project path
  const projectPath = path.join("/tmp", "arlys", ctx.sessionId);

  // Call preview service - it handles static detection automatically
  // This will set previewUrl in DB if index.html exists
  const result = await previewService.startPreview(ctx.sessionId, projectPath);

  if (!result.success) {
    return {
      success: false,
      step: "preview",
      message: "Failed to start static preview: " + result.message,
    };
  }

  return {
    success: true,
    step: "preview",
    message: "Static preview ready",
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

  // STATIC HTML MODE: Validate structure, content, and preview
  // Skip all npm/build/server steps
  const steps = [
    step1_initializeBuild,
    step2_dependencyInstall,
    step2b_contentValidation, // NEW: Reject React/JSX content
    step5_staticPreview, // STATIC HTML PREVIEW INITIALIZATION
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
