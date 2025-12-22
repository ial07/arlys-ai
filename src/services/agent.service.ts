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
 */
async function createDefaultTasks(sessionId: string, goal: string) {
  const defaultTasks = [
    {
      epic: "foundation",
      title: "Create package.json",
      type: "setup",
      priority: 1,
      description: `Initialize project dependencies for: ${goal}`,
    },
    {
      epic: "foundation",
      title: "Create README.md",
      type: "setup",
      priority: 2,
      description: `Create project README for: ${goal}`,
    },
    {
      epic: "database",
      title: "Define Prisma schema",
      type: "schema",
      priority: 3,
      description: `Create database models for: ${goal}`,
    },
    {
      epic: "api",
      title: "Create API routes",
      type: "api",
      priority: 4,
      description: `Create API endpoints for: ${goal}`,
    },
    {
      epic: "ui",
      title: "Create main page",
      type: "page",
      priority: 5,
      description: `Create frontend landing page for: ${goal}`,
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

    // ========== STEP 2: Check for missing files and create recovery tasks ==========
    const missingFromManifest = manifest
      ? getMissingRequiredFiles(manifest)
      : [];
    const missingFoundation = getMissingFoundationFiles(existingPaths);

    const allMissing = [
      ...missingFromManifest.filter((f) => f.retryCount < 3).map((f) => f.path),
      ...missingFoundation,
    ];

    // Remove duplicates
    const uniqueMissing = [...new Set(allMissing)];

    if (uniqueMissing.length > 0 && manifest) {
      // ========== RECOVERY: Create tasks for missing files ==========
      await prisma.message.create({
        data: {
          sessionId,
          role: "system",
          content: `🔄 Recovery: ${uniqueMissing.length} files still missing. Creating recovery tasks...`,
        },
      });

      // Update retry counts in manifest
      for (const path of uniqueMissing) {
        manifest = updateManifestFileStatus(manifest, path, "pending");
      }
      await prisma.session.update({
        where: { id: sessionId },
        data: { manifest: manifest as any },
      });

      // Create recovery tasks (only for files that came from manifest and have retries left)
      const recoveryTasks = missingFromManifest
        .filter((f) => f.retryCount < 3)
        .map((file, index) => ({
          sessionId,
          epic: "recovery",
          title: `[RETRY] Generate ${file.path}`,
          description: `PROJECT GOAL: ${goal}\n\nRECOVERY: Generate missing file ${file.path}\nATTEMPT: ${file.retryCount + 1}/3`,
          type: getTypeFromPath(file.path),
          priority: 9000 + index, // High priority for recovery
          dependencies: [],
        }));

      if (recoveryTasks.length > 0) {
        await prisma.task.createMany({ data: recoveryTasks });
        await prisma.session.update({
          where: { id: sessionId },
          data: { totalTasks: { increment: recoveryTasks.length } },
        });

        // Continue execution
        setTimeout(() => executeNextTask(sessionId, goal), 1000);
        return;
      }
    }

    // ========== STEP 3: Inject missing foundation files using templates ==========
    const projectName = session?.projectName || "my-project";

    for (const fileName of missingFoundation) {
      let content = "";

      if (fileName === "package.json") {
        content = FOUNDATION_FILES["package.json"](
          projectName,
          existingFilesWithContent
        );
      } else if (fileName === "tsconfig.json") {
        content = FOUNDATION_FILES["tsconfig.json"]();
      } else if (fileName === "next.config.js") {
        content = FOUNDATION_FILES["next.config.js"]();
      } else if (fileName === "tailwind.config.ts") {
        content = FOUNDATION_FILES["tailwind.config.ts"]();
      } else if (fileName === "postcss.config.js") {
        content = FOUNDATION_FILES["postcss.config.js"]();
      } else if (fileName === "src/app/globals.css") {
        content = FOUNDATION_FILES["src/app/globals.css"]();
      } else if (fileName === "src/app/layout.tsx") {
        content = FOUNDATION_FILES["src/app/layout.tsx"](projectName);
      } else if (fileName === "src/app/page.tsx") {
        content = FOUNDATION_FILES["src/app/page.tsx"](projectName);
      } else if (fileName === ".env.example") {
        content = FOUNDATION_FILES[".env.example"]();
      } else if (fileName === "README.md") {
        content = FOUNDATION_FILES["README.md"](
          projectName,
          session?.goal || ""
        );
      }

      if (content) {
        await prisma.generatedFile.create({
          data: {
            sessionId,
            path: fileName,
            content,
            language: fileName.endsWith(".json")
              ? "json"
              : fileName.endsWith(".ts") || fileName.endsWith(".tsx")
                ? "typescript"
                : fileName.endsWith(".css")
                  ? "css"
                  : "text",
            action: "create",
            version: 1,
          },
        });
      }
    }

    // ========== COMPLETION: Mark session as complete ==========
    const finalFileCount = await prisma.generatedFile.count({
      where: { sessionId },
    });

    await prisma.session.update({
      where: { id: sessionId },
      data: {
        status: "completed",
        completedAt: new Date(),
        currentPhase: 6,
      },
    });

    await prisma.message.create({
      data: {
        sessionId,
        role: "assistant",
        content: `✅ All tasks completed! Generated ${finalFileCount} files.\n\n📦 Run these commands:\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\``,
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
      // Check if file exists to determine update vs create
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
