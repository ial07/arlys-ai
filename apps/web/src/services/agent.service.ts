import prisma from "@/lib/prisma";
import { generateCode } from "@/llm/openai";
import {
  FileManifest,
  getPhaseForPath,
  createEmptyManifest,
  updateManifestFileStatus,
  getMissingRequiredFiles,
} from "@/lib/manifest";
import {
  FOUNDATION_FILES,
  getMissingFoundationFiles,
} from "@/lib/project-templates";
import { buildValidator } from "@/services/build-validator";

/**
 * Agent Service
 * Handles core agent logic: Planning, Task Creation, and Execution
 *
 * Key features:
 * - Context-aware code generation (passes existing files + goal to LLM)
 * - Iterative modifications (updates existing files instead of replacing)
 * - Session memory for consistent code generation
 */

export const agentService = {
  generatePlanAndTasks,
  createDefaultTasks,
  executeNextTask,
  addTasksAndExecute,
};

/**
 * BACKEND FILE BLOCKER
 * Returns true if the path is a backend file that should NOT be generated
 */
function isBackendPath(filePath: string): boolean {
  const forbidden = [
    "api/",
    "prisma/",
    "schema.prisma",
    ".env",
    "server.",
    "middleware.",
    "auth.",
    "/admin/",
  ];
  const lowerPath = filePath.toLowerCase();
  return forbidden.some((f) => lowerPath.includes(f));
}

/**
 * IMPORT SANITIZER
 * Removes forbidden imports to prevent dependency errors
 */
function sanitizeCode(code: string): string {
  if (!code) return code;

  // Forbidden patterns
  const forbidden = [
    /import.*from.*['"]lucide-react['"]/g,
    /import.*from.*['"]@heroicons\/.*['"]/g,
    /import.*from.*['"]@radix-ui\/.*['"]/g,
    /import.*from.*['"]framer-motion['"]/g,
    /import.*from.*['"]clsx['"]/g,
    /import.*from.*['"]tailwind-merge['"]/g,
    /import.*from.*['"]date-fns['"]/g,
  ];

  let sanitized = code;
  for (const pattern of forbidden) {
    if (pattern.test(sanitized)) {
      console.warn(`🧹 Sanitizing forbidden import matching: ${pattern}`);
      sanitized = sanitized.replace(pattern, "// Import removed by sanitizer");
    }
  }

  return sanitized;
}

interface ExistingFile {
  path: string;
  content: string;
}

/**
 * Add new tasks from user modification request and start execution
 */
async function addTasksAndExecute(
  sessionId: string,
  tasks: any[],
  existingFiles?: ExistingFile[]
) {
  try {
    // Get session goal for context
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { goal: true },
    });

    // Get current max priority to append new tasks
    const lastTask = await prisma.task.findFirst({
      where: { sessionId },
      orderBy: { priority: "desc" },
    });
    const startPriority = (lastTask?.priority || 0) + 1;

    // Create tasks with enriched descriptions
    const taskData = tasks.map((task, index) => ({
      sessionId,
      epic: task.epic || "modification",
      title: task.title,
      description: task.description || task.title,
      type: task.type || "component",
      priority: startPriority + index,
      dependencies: [],
    }));

    await prisma.task.createMany({
      data: taskData,
    });

    // Update session status and counts
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        status: "executing",
        totalTasks: { increment: tasks.length },
        failedTasks: 0,
      },
    });

    // Start execution with goal context
    executeNextTask(sessionId, session?.goal || "Modification request");
  } catch (error) {
    console.error("addTasksAndExecute error:", error);
  }
}

/**
 * Background function to generate manifest, plan and create tasks
 * NEW FLOW: Manifest first → Tasks from manifest → Execute with validation
 */
async function generatePlanAndTasks(sessionId: string, goal: string) {
  try {
    const { generateManifest } = await import("@/llm/openai");
    const { getPhaseForPath, createEmptyManifest } =
      await import("@/lib/manifest");

    // ========== STEP 1: Generate file manifest ==========
    await prisma.message.create({
      data: {
        sessionId,
        role: "system",
        content: "📋 Generating file manifest...",
      },
    });

    const manifestFiles = await generateManifest(goal);

    if (manifestFiles.length === 0) {
      // Fallback to default manifest
      await createDefaultTasks(sessionId, goal);
      return;
    }

    // Build manifest object with phase assignments
    const manifest = createEmptyManifest();
    manifest.files = manifestFiles.map((file) => ({
      path: file.path,
      phase: getPhaseForPath(file.path),
      status: "pending" as const,
      required: file.required,
      retryCount: 0,
    }));
    manifest.totalFiles = manifest.files.length;

    // Save manifest to session
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        manifest: manifest as any,
        currentPhase: 1,
      },
    });

    await prisma.message.create({
      data: {
        sessionId,
        role: "assistant",
        content: `📋 Generated manifest with ${manifest.totalFiles} files across 5 phases.`,
      },
    });

    // ========== STEP 2: Create tasks from manifest ==========
    // Sort files by phase for correct execution order
    const sortedFiles = [...manifest.files].sort((a, b) => a.phase - b.phase);

    const taskData = sortedFiles.map((file, index) => ({
      sessionId,
      epic: getEpicFromPhase(file.phase),
      title: `Generate ${file.path}`,
      description: `PROJECT GOAL: ${goal}\n\nFILE: ${file.path}\nPHASE: ${file.phase}\nREQUIRED: ${file.required}`,
      type: getTypeFromPath(file.path),
      priority: file.phase * 100 + index,
      dependencies: [],
    }));

    await prisma.task.createMany({
      data: taskData,
    });

    // Update session
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        status: "executing",
        totalTasks: taskData.length,
      },
    });

    // Start executing tasks
    await executeNextTask(sessionId, goal);
  } catch (error) {
    console.error("generatePlanAndTasks error:", error);
    await prisma.session.update({
      where: { id: sessionId },
      data: { status: "failed" },
    });
  }
}

/**
 * Get epic name from phase number
 */
function getEpicFromPhase(phase: number): string {
  const epicMap: Record<number, string> = {
    1: "foundation",
    2: "types",
    3: "database",
    4: "api",
    5: "ui",
  };
  return epicMap[phase] || "general";
}

/**
 * Infer task type from file path
 */
function getTypeFromPath(path: string): string {
  if (path.includes("api/")) return "api";
  if (path.includes("components/")) return "component";
  if (path.includes("page.tsx")) return "page";
  if (path.includes("schema.prisma")) return "schema";
  if (path === "package.json" || path.includes("config")) return "setup";
  return "component";
}

/**
 * Create default tasks when plan generation fails
 * FRONTEND-ONLY: No database, no API, no backend
 */
async function createDefaultTasks(sessionId: string, goal: string) {
  // ========== SINGLE FILE MODE: index.html with inline GSAP ==========
  const defaultTasks: any[] = [
    {
      id: crypto.randomUUID(),
      title: "Create index.html",
      path: "index.html",
      type: "page",
      status: "pending",
      description: `PROJECT GOAL: ${goal}

Generate a SINGLE complete static HTML landing page with:
- Tailwind CSS via CDN
- GSAP + ScrollTrigger via CDN
- ALL animations embedded in inline <script> tags at bottom of body
- Sections: Navigation, Hero, Features (6 cards), About, Testimonials (3), Contact, Footer
- Pexels images with onerror fallbacks
- Dark modern theme with glassmorphism
- Content MUST be visible without JavaScript`,
      epic: "foundation",
    },
  ];

  await prisma.task.createMany({
    data: defaultTasks.map((task) => ({
      sessionId,
      ...task,
      dependencies: [],
    })),
  });

  await prisma.session.update({
    where: { id: sessionId },
    data: {
      status: "executing",
      totalTasks: defaultTasks.length,
    },
  });

  await executeNextTask(sessionId, goal);
}

/**
 * Execute the next pending task with full context
 */
async function executeNextTask(sessionId: string, goal: string) {
  // Find next task to execute
  const nextTask = await prisma.task.findFirst({
    where: {
      sessionId,
      status: "todo",
    },
    orderBy: { priority: "asc" },
  });

  if (!nextTask) {
    // ========== MANIFEST VALIDATION: Check if all required files exist ==========
    // Using static imports from top of file

    // Get session with manifest
    const session = (await prisma.session.findUnique({
      where: { id: sessionId },
    })) as any; // Cast to any to avoid Prisma type caching issues

    // Get all generated files
    const existingFilesWithContent = await prisma.generatedFile.findMany({
      where: { sessionId },
      select: { path: true, content: true },
    });

    const existingPaths = existingFilesWithContent.map((f) => f.path);
    let manifest = session?.manifest as FileManifest | null;

    // ========== STEP 1: Update manifest with generated files ==========
    if (manifest) {
      for (const file of manifest.files) {
        if (existingPaths.includes(file.path) && file.status !== "generated") {
          manifest = updateManifestFileStatus(manifest, file.path, "generated");
        }
      }

      // Save updated manifest
      await prisma.session.update({
        where: { id: sessionId },
        data: { manifest: manifest as any },
      });
    }

    // ========== STATIC HTML MODE: STOP RECOVERY IF index.html EXISTS ==========
    const hasIndexHtml = existingPaths.includes("index.html");

    if (hasIndexHtml) {
      // STATIC HTML MODE: Core file exists. STOP ALL RECOVERY. Proceed to completion.
      await prisma.message.create({
        data: {
          sessionId,
          role: "system",
          content: `✅ Static HTML Mode: index.html detected. Skipping recovery. Proceeding to completion.`,
        },
      });
      // DO NOT create recovery tasks
      // DO NOT inject foundation files
      // Proceed directly to completion logic below
    } else {
      // STATIC HTML MODE: No index.html - this is an error state
      await prisma.message.create({
        data: {
          sessionId,
          role: "system",
          content: `⚠️ Static HTML Mode: index.html missing. Creating generation task.`,
        },
      });

      // Create ONLY the index.html task
      await prisma.task.create({
        data: {
          sessionId,
          epic: "foundation",
          title: "Generate index.html",
          description: `PROJECT GOAL: ${goal}\n\nGenerate a static HTML page.`,
          type: "page",
          priority: 1,
          dependencies: [],
        },
      });

      await prisma.session.update({
        where: { id: sessionId },
        data: { totalTasks: { increment: 1 } },
      });

      setTimeout(() => executeNextTask(sessionId, goal), 500);
      return;
    }

    // STATIC HTML MODE: NO FOUNDATION FILE INJECTION
    // If we reach here, index.html exists. Do NOT inject any files.

    // ========== COMPLETION: Mark session as complete ==========
    // STATIC HTML MODE: No minimum file requirement.
    // If index.html exists, session is complete.
    const finalFileCount = await prisma.generatedFile.count({
      where: { sessionId },
    });

    await prisma.message.create({
      data: {
        sessionId,
        role: "system",
        content: `✅ Static HTML Mode: ${finalFileCount} file(s) generated. Proceeding to validation.`,
      },
    });

    // STATIC HTML MODE: No MAX_FILES or MIN_FILES checks needed.

    // ========== FILE CLEANUP: Remove conflicting structures ==========
    // Delete any files in src/ folder if app/ equivalents exist
    // Delete any .tsx/.ts files if .js equivalents exist
    const allFiles = await prisma.generatedFile.findMany({
      where: { sessionId },
      select: { id: true, path: true },
    });

    const filesToDelete: string[] = [];
    const rootPaths = allFiles
      .filter((f) => !f.path.startsWith("src/"))
      .map((f) => f.path);

    for (const file of allFiles) {
      // Delete src/ versions if root version exists
      if (file.path.startsWith("src/")) {
        const rootEquivalent = file.path.replace("src/", "");
        if (rootPaths.includes(rootEquivalent)) {
          filesToDelete.push(file.id);
        }
      }

      // Delete .tsx/.ts if .js equivalent exists
      if (file.path.endsWith(".tsx") || file.path.endsWith(".ts")) {
        const jsEquivalent = file.path.replace(/\.tsx?$/, ".js");
        if (rootPaths.includes(jsEquivalent)) {
          filesToDelete.push(file.id);
        }
      }
    }

    if (filesToDelete.length > 0) {
      await prisma.generatedFile.deleteMany({
        where: { id: { in: filesToDelete } },
      });

      await prisma.message.create({
        data: {
          sessionId,
          role: "system",
          content: `🧹 Cleaned up ${filesToDelete.length} conflicting files (src/ or .tsx duplicates).`,
        },
      });
    }

    // ========== BUILD VALIDATION: Validate before marking complete ==========
    // FRONTEND-ONLY MODE: Disable self-healing to prevent retry loops
    // If build fails, just mark as failed and stop

    const MAX_BUILD_RETRIES = 0; // DISABLED - no self-healing in frontend mode
    let buildRetries = 0;
    let validationResult = await buildValidator.validate(sessionId);

    // Self-healing loop DISABLED - skip directly to result handling
    while (
      false &&
      !validationResult.success &&
      buildRetries < MAX_BUILD_RETRIES
    ) {
      buildRetries++;

      // Update status to 'fixing' to show UI feedback
      await prisma.session.update({
        where: { id: sessionId },
        data: { status: "fixing" } as any,
      });

      await prisma.message.create({
        data: {
          sessionId,
          role: "assistant",
          content: `⚠️ Build/Runtime check failed (Attempt ${buildRetries}/${MAX_BUILD_RETRIES}):\n\n${validationResult.message}\n\nRunning self-healing mechanics...`,
        },
      });

      try {
        // 1. Fetch current project state
        const projectFiles = await prisma.generatedFile.findMany({
          where: { sessionId },
          select: { path: true, content: true },
        });

        // 2. Ask LLM to fix the errors
        const { fixProjectErrors } = await import("@/llm/openai");
        const patches = await fixProjectErrors({
          errors: validationResult.errors || [validationResult.message],
          files: projectFiles,
          goal,
        });

        if (patches.length === 0) {
          await prisma.message.create({
            data: {
              sessionId,
              role: "system",
              content: `❌ Self-healing failed: No patches generated.`,
            },
          });
          break; // Exit loop if AI cannot fix
        }

        // 3. Apply patches to database
        for (const patch of patches) {
          // Check if file exists to decide update vs create logic,
          // generally files should exist, but patch might be new file
          // For MVP assuming update to existing files or we catch error
          try {
            await prisma.generatedFile.update({
              where: {
                sessionId_path: {
                  sessionId,
                  path: patch.path,
                },
              },
              data: {
                content: patch.content,
                version: { increment: 1 },
                action: "modify",
              },
            });
          } catch (e) {
            // Handle new file case if needed, but usually fixes are edits
            console.warn(
              `Could not update file ${patch.path}, it might be missing.`
            );
          }
        }

        await prisma.message.create({
          data: {
            sessionId,
            role: "assistant",
            content: `✅ Applied fixes to ${patches.length} files. Retrying validation...`,
          },
        });

        // 4. Retry Validation
        validationResult = await buildValidator.validate(sessionId);
      } catch (fixError) {
        console.error("Self-healing error:", fixError);
        break; // Stop retrying if system error
      }
    }

    // Check final result after loop
    // const validationResult ... (used below)

    if (!validationResult.success) {
      await prisma.session.update({
        where: { id: sessionId },
        data: {
          status: "failed",
        },
      });

      // Analytics: Increment build failure count
      const failedSessionData = await prisma.session.findUnique({
        where: { id: sessionId },
        select: { userEmail: true },
      });
      if (failedSessionData?.userEmail) {
        await prisma.user.update({
          where: { email: failedSessionData.userEmail },
          data: { buildFailureCount: { increment: 1 } } as any,
        });
      }

      await prisma.message.create({
        data: {
          sessionId,
          role: "assistant",
          content: `❌ Build validation failed: ${validationResult.message}\n\nPlease check the generated files and try again.`,
        },
      });
      return;
    }

    // Mark session as completed after validation passes
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        status: "completed",
        completedAt: new Date(),
        currentPhase: 6,
      } as any, // Cast to any for Prisma type caching
    });

    // Analytics: Increment build success count
    const sessionData = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { userEmail: true },
    });
    if (sessionData?.userEmail) {
      await prisma.user.update({
        where: { email: sessionData.userEmail },
        data: { buildSuccessCount: { increment: 1 } } as any,
      });
    }

    await prisma.message.create({
      data: {
        sessionId,
        role: "assistant",
        content: `✅ Static HTML build complete! Created ${finalFileCount} file(s).\n\n📦 Your static website is ready. Preview it in the Preview tab.`,
      },
    });

    return;
  }

  // Mark task as in progress
  await prisma.task.update({
    where: { id: nextTask.id },
    data: {
      status: "doing",
      startedAt: new Date(),
    },
  });

  // Add progress message
  await prisma.message.create({
    data: {
      sessionId,
      role: "system",
      content: `🔨 Working on: ${nextTask.title}`,
    },
  });

  try {
    // ========== KEY CHANGE: Fetch existing files for context ==========
    const existingFiles = await prisma.generatedFile.findMany({
      where: { sessionId },
      select: { path: true, content: true },
    });

    // Find schema for database context
    const schemaFile = existingFiles.find((f) =>
      f.path.includes("schema.prisma")
    );

    // Build rich context for LLM
    const projectStructure = existingFiles.map((f) => f.path);

    // Get last 5 files for detailed context (to stay within token limits)
    const recentFiles = existingFiles.slice(-5).map((f) => ({
      path: f.path,
      content: f.content.substring(0, 2000), // Truncate for token limits
    }));

    // ========== Generate code with full context ==========
    let generation = await generateCode({
      taskType: nextTask.type,
      taskDescription: nextTask.description || nextTask.title,
      context: {
        goal,
        projectStructure,
        existingFiles: recentFiles,
        schema: schemaFile?.content,
      },
    });

    // ========== INTERCEPTOR: Force-override package.json ==========
    // The LLM tends to hallucinate bad versions (e.g. lucide-react@^0.1.0)
    // We strictly enforce our pinned template for package.json
    if (generation.path === "package.json") {
      console.log("🔒 Forcing pinned package.json template");

      const sessionData = await prisma.session.findUnique({
        where: { id: sessionId },
        select: { projectName: true },
      });

      generation.code = FOUNDATION_FILES["package.json"](
        sessionData?.projectName || "my-project"
      );
    }

    // ========== VALIDATION STEP: Check and fix generated code ==========
    if (generation.code && generation.code.trim() !== "// No code generated") {
      const { validateCode, formatErrorsForFix } =
        await import("@/lib/code-validator");
      const { fixCode } = await import("@/llm/openai");

      let validationResult = validateCode(generation.code, generation.path);
      let retryCount = 0;
      const maxRetries = 2;

      // Retry loop for fixing validation errors
      while (!validationResult.isValid && retryCount < maxRetries) {
        retryCount++;
        const errorMessage = formatErrorsForFix(validationResult);

        await prisma.message.create({
          data: {
            sessionId,
            role: "system",
            content: `⚠️ Validation error in \`${generation.path}\`. Fixing (attempt ${retryCount}/${maxRetries})...`,
          },
        });

        // Ask LLM to fix the code
        const fixResult = await fixCode({
          code: generation.code,
          filePath: generation.path,
          errors: errorMessage,
          context: { goal },
        });

        if (fixResult.fixed) {
          generation.code = fixResult.code;
          validationResult = validateCode(generation.code, generation.path);
        } else {
          break; // Could not fix, exit loop
        }
      }

      // Log if we still have warnings (but code is valid)
      if (validationResult.isValid && validationResult.warnings.length > 0) {
        console.log(
          `Warnings for ${generation.path}:`,
          validationResult.warnings
        );
      }
    }

    // ========== Save generated file to database ==========
    if (generation.code && generation.code.trim() !== "// No code generated") {
      // 1. BLOCKER: Skip backend files
      if (isBackendPath(generation.path)) {
        // ... (existing blocker code) ...
        console.warn(`🚫 BLOCKED backend file: ${generation.path}`);
        await prisma.message.create({
          data: {
            sessionId,
            role: "system",
            content: `🚫 Blocked backend file: \`${generation.path}\` (frontend-only mode)`,
          },
        });
        // Skip this file but continue
        await prisma.task.update({
          where: { id: nextTask.id },
          data: { status: "done", completedAt: new Date() },
        });
        await prisma.session.update({
          where: { id: sessionId },
          data: { completedTasks: { increment: 1 } },
        });
        setTimeout(() => executeNextTask(sessionId, goal), 500);
        return;
      }

      // 2. SANITIZER: Clean forbidden imports
      generation.code = sanitizeCode(generation.code);

      // Check if file exists ...
      const existingFile = await prisma.generatedFile.findFirst({
        where: {
          sessionId,
          path: generation.path,
        },
      });

      if (existingFile) {
        // Update existing file (increment version)
        await prisma.generatedFile.update({
          where: { id: existingFile.id },
          data: {
            content: generation.code,
            version: { increment: 1 },
            action: "modify",
            updatedAt: new Date(),
          },
        });

        await prisma.message.create({
          data: {
            sessionId,
            role: "assistant",
            content: `📝 Updated: \`${generation.path}\` (v${existingFile.version + 1})`,
          },
        });
      } else {
        // Create new file
        await prisma.generatedFile.create({
          data: {
            sessionId,
            path: generation.path,
            content: generation.code,
            language: generation.language,
            action: "create",
            version: 1,
          },
        });

        await prisma.message.create({
          data: {
            sessionId,
            role: "assistant",
            content: `📄 Created: \`${generation.path}\``,
          },
        });
      }
    }

    // Mark task as done
    await prisma.task.update({
      where: { id: nextTask.id },
      data: {
        status: "done",
        completedAt: new Date(),
      },
    });

    // Update session progress
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        completedTasks: { increment: 1 },
      },
    });

    // Execute next task with delay to avoid rate limits
    setTimeout(() => {
      executeNextTask(sessionId, goal);
    }, 1500);
  } catch (error) {
    console.error("Task execution error:", error);

    await prisma.task.update({
      where: { id: nextTask.id },
      data: {
        status: "failed",
        errorLog: [(error as Error).message],
      },
    });

    await prisma.message.create({
      data: {
        sessionId,
        role: "system",
        content: `❌ Task failed: ${nextTask.title} - ${(error as Error).message}`,
      },
    });

    // Update failed count
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        failedTasks: { increment: 1 },
      },
    });

    // Continue with next task despite error
    setTimeout(() => {
      executeNextTask(sessionId, goal);
    }, 1000);
  }
}
