/**
 * OpenAI LLM Service
 *
 * Provides AI-powered code generation capabilities using OpenAI API.
 * Enhanced with context-aware prompts for better fullstack application generation.
 */

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface GenerateCodeRequest {
  taskType: string;
  taskDescription: string;
  context?: {
    goal?: string;
    projectStructure?: string[];
    existingFiles?: Array<{ path: string; content: string }>;
    schema?: string;
  };
}

export interface GenerateCodeResponse {
  code: string;
  language: string;
  path: string;
  explanation?: string;
}

export interface PlanGenerationRequest {
  goal: string;
  constraints?: string[];
}

export interface TaskPlanItem {
  epic: string;
  title: string;
  type: string;
  description: string;
  dependencies: string[];
  priority: number;
}

/**
 * Generate code for a specific task with full project context
 */
export async function generateCode(
  request: GenerateCodeRequest
): Promise<GenerateCodeResponse> {
  const { taskType, taskDescription, context } = request;

  // Build context-aware system prompt
  const systemPrompt = `You are an expert fullstack JavaScript/TypeScript developer specializing in Next.js 14+ applications.

PROJECT GOAL: ${context?.goal || "Build a web application"}

EXISTING PROJECT FILES: ${context?.projectStructure?.length ? context.projectStructure.join(", ") : "None yet (this is a new project)"}

${context?.schema ? `DATABASE SCHEMA:\n${context.schema}\n` : ""}

CRITICAL RULES - FOLLOW EXACTLY:

1. **package.json MUST be complete**:
   - Include ALL dependencies needed (react, next, typescript, tailwindcss, etc.)
   - Include proper scripts: "dev", "build", "start", "lint"
   - Example dependencies to include: "next": "^14.0.0", "react": "^18.2.0", "react-dom": "^18.2.0", "typescript": "^5.0.0", "@types/react": "^18.2.0", "@types/node": "^20.0.0", "tailwindcss": "^3.4.0", "autoprefixer": "^10.4.0", "postcss": "^8.4.0"
   - If prisma is used, include: "@prisma/client": "^5.0.0" and devDependency "prisma": "^5.0.0"

2. **"use client" directive is REQUIRED** for components that:
   - Use useState, useEffect, useRef, or any React hooks
   - Have onClick, onChange, onSubmit, or any event handlers
   - Use browser-only APIs (localStorage, window, etc.)
   - The directive MUST be the FIRST LINE of the file: 'use client';

3. **app/page.tsx is the ENTRY POINT**:
   - Always create src/app/page.tsx as the main landing page
   - This file should import and render other components
   - Can be a server component if no client-side interactivity

4. **Import paths**:
   - Use @/ alias for src/ imports (e.g., @/components/Button)
   - Use relative paths only for nearby files

5. **File structure for Next.js App Router**:
   - Pages: src/app/[route]/page.tsx
   - API Routes: src/app/api/[route]/route.ts
   - Components: src/components/[name].tsx
   - Libs: src/lib/[name].ts

6. **Code quality**:
   - Complete, production-ready code (NO placeholders, NO TODOs, NO comments like "// Add your code here")
   - Include ALL necessary imports at the top
   - Use TypeScript with proper types
   - Use Tailwind CSS for all styling

RESPONSE FORMAT (JSON only, no markdown):
{
  "path": "relative/path/to/file.tsx",
  "code": "complete file content starting with imports or 'use client'",
  "explanation": "what this file does"
}`;

  // Build user prompt with context from existing files
  let userPrompt = `Generate code for the following task:

TASK TYPE: ${taskType}
DESCRIPTION: ${taskDescription}
`;

  // Add relevant existing files for context
  if (context?.existingFiles && context.existingFiles.length > 0) {
    userPrompt += `\nEXISTING FILES FOR REFERENCE:\n`;
    context.existingFiles.forEach((file) => {
      userPrompt += `\n--- ${file.path} ---\n${file.content}\n`;
    });
  }

  userPrompt += `\nGenerate the complete file. Ensure it integrates properly with existing files.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 4000,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content || "{}";

    const parsed = JSON.parse(content);
    return {
      code: parsed.code || "// No code generated",
      path: parsed.path || inferPathFromTask(taskType, taskDescription),
      language: getLanguageFromPath(parsed.path || "generated.ts"),
      explanation: parsed.explanation,
    };
  } catch (error) {
    console.error("Failed to generate code:", error);
    return {
      code: `// Error generating code: ${(error as Error).message}`,
      path: "error.ts",
      language: "typescript",
    };
  }
}

/**
 * Modify existing code based on user request
 */
export async function modifyCode(request: {
  existingCode: string;
  modification: string;
  filePath: string;
  projectContext?: {
    goal?: string;
    otherFiles?: Array<{ path: string; content: string }>;
  };
}): Promise<{ code: string; explanation: string }> {
  const systemPrompt = `You are an expert code reviewer and modifier.
Your task is to modify existing code based on the user's request while:
1. Preserving existing functionality unless explicitly asked to change it
2. Maintaining code style consistency
3. Ensuring imports and dependencies remain correct

PROJECT CONTEXT: ${request.projectContext?.goal || "Web application"}

Return JSON:
{
  "code": "complete modified file content",
  "explanation": "what was changed and why"
}`;

  const userPrompt = `Modify this file: ${request.filePath}

CURRENT CODE:
${request.existingCode}

MODIFICATION REQUEST:
${request.modification}

${request.projectContext?.otherFiles?.length ? `RELATED FILES:\n${request.projectContext.otherFiles.map((f) => `${f.path}: ${f.content.substring(0, 500)}...`).join("\n")}` : ""}

Return the complete modified file.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 4000,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);

    return {
      code: parsed.code || request.existingCode,
      explanation: parsed.explanation || "Code modified",
    };
  } catch (error) {
    console.error("Failed to modify code:", error);
    return {
      code: request.existingCode,
      explanation: `Error: ${(error as Error).message}`,
    };
  }
}

/**
 * Fix code with validation errors
 * Used when generated code has syntax or structural issues
 */
export async function fixCode(request: {
  code: string;
  filePath: string;
  errors: string;
  context?: {
    goal?: string;
  };
}): Promise<{ code: string; fixed: boolean }> {
  const systemPrompt = `You are an expert code fixer. Fix the following code errors while preserving the original intent.

PROJECT GOAL: ${request.context?.goal || "Web application"}

CRITICAL RULES:
1. Fix ALL reported errors
2. If error mentions "use client" - add 'use client'; as the FIRST LINE of the file
3. If error mentions syntax - fix the syntax error
4. Keep the same functionality
5. Return complete, working code

Return JSON:
{
  "code": "complete fixed file content",
  "explanation": "what was fixed"
}`;

  const userPrompt = `Fix this code:

FILE: ${request.filePath}

ERRORS:
${request.errors}

ORIGINAL CODE:
${request.code}

Return the complete fixed code.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1, // Low temperature for precise fixes
      max_tokens: 4000,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);

    return {
      code: parsed.code || request.code,
      fixed: !!parsed.code && parsed.code !== request.code,
    };
  } catch (error) {
    console.error("Failed to fix code:", error);
    return {
      code: request.code,
      fixed: false,
    };
  }
}

/**
 * Generate a detailed task plan from a goal description
 */
export async function generatePlan(
  request: PlanGenerationRequest
): Promise<TaskPlanItem[]> {
  const systemPrompt = `You are an expert software architect specializing in Next.js fullstack applications.

Given a project goal, create a detailed, executable task plan. Each task should:
1. Be atomic and completeable in one code generation step
2. Have clear dependencies on other tasks
3. Include specific implementation details

REQUIRED STRUCTURE (always include these):
- Foundation: package.json, tsconfig.json, tailwind.config.ts, README.md
- Database: Prisma schema with all required models
- API: Next.js API routes in app/api/
- UI: React components and pages with Tailwind styling
- Types: TypeScript interfaces and types

Return a JSON object with a "tasks" array:
{
  "tasks": [
    {
      "epic": "foundation|database|api|ui|auth|types",
      "title": "specific task title",
      "type": "setup|schema|api|component|page|config",
      "description": "detailed description of what to create, including specific features",
      "dependencies": ["titles of tasks this depends on"],
      "priority": 1-10 (1 is highest)
    }
  ]
}`;

  const userPrompt = `Create a comprehensive task plan for:

GOAL: ${request.goal}
${request.constraints?.length ? `CONSTRAINTS:\n${request.constraints.map((c) => `- ${c}`).join("\n")}` : ""}

Generate all necessary tasks to build a complete, working application. Be specific about what each file should contain.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.5,
      max_tokens: 4000,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content || '{"tasks": []}';
    const parsed = JSON.parse(content);
    return parsed.tasks || parsed.plan || [];
  } catch (error) {
    console.error("Failed to parse plan response:", error);
    return [];
  }
}

/**
 * Generate a file manifest - complete list of files needed for the project
 * This is called BEFORE any code generation to define scope
 */
export async function generateManifest(
  goal: string
): Promise<Array<{ path: string; description: string; required: boolean }>> {
  const systemPrompt = `You are an expert Next.js architect. Given a project goal, generate a COMPLETE file manifest.

The manifest must include ALL files needed for a runnable Next.js application.

REQUIRED FILES (always include):
- package.json
- tsconfig.json
- next.config.js
- tailwind.config.ts
- postcss.config.js
- src/app/layout.tsx
- src/app/page.tsx
- src/app/globals.css

COMMON PATTERNS:
- API routes: src/app/api/[resource]/route.ts
- Components: src/components/[Name].tsx
- Pages: src/app/[route]/page.tsx
- Types: src/types/[name].ts
- Lib: src/lib/[name].ts
- Hooks: src/hooks/[name].ts

Return JSON:
{
  "files": [
    { "path": "package.json", "description": "Project dependencies", "required": true },
    { "path": "src/app/page.tsx", "description": "Home page with hero section", "required": true },
    ...
  ]
}

Generate 15-40 files depending on project complexity.
Be EXHAUSTIVE - include every file the project needs.`;

  const userPrompt = `Generate a complete file manifest for:

GOAL: ${goal}

List EVERY file needed to build this as a complete, runnable application.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 4000,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content || '{"files": []}';
    const parsed = JSON.parse(content);
    return parsed.files || [];
  } catch (error) {
    console.error("Failed to generate manifest:", error);
    return [];
  }
}

/**
 * Analyze an error and suggest a fix
 */
export async function analyzeError(
  error: string,
  code: string
): Promise<{
  analysis: string;
  suggestedFix: string;
}> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You are an expert debugger. Analyze errors and provide fixes.",
      },
      {
        role: "user",
        content: `Error:\n${error}\n\nCode:\n${code}\n\nProvide analysis and suggested fix.`,
      },
    ],
    temperature: 0.3,
    max_tokens: 1000,
  });

  const content = response.choices[0]?.message?.content || "";

  return {
    analysis: content,
    suggestedFix: content,
  };
}

/**
 * Chat with the agent about the project
 */
export async function chat(
  message: string,
  context?: {
    sessionGoal?: string;
    recentMessages?: Array<{ role: string; content: string }>;
    existingFiles?: string[];
  }
): Promise<string> {
  const systemPrompt = `You are an AI Agent Builder assistant helping users create fullstack applications.

${context?.sessionGoal ? `Current project goal: ${context.sessionGoal}` : ""}
${context?.existingFiles?.length ? `Project files: ${context.existingFiles.join(", ")}` : ""}

You can:
1. Answer questions about the project
2. Explain what the agent has built
3. Suggest improvements
4. Help debug issues

When users want code changes, tell them to be specific about what they want modified.
Be helpful, concise, and technical.`;

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...(context?.recentMessages?.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })) || []),
    { role: "user", content: message },
  ];

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    temperature: 0.7,
    max_tokens: 1000,
  });

  return (
    response.choices[0]?.message?.content ||
    "I apologize, I was unable to generate a response."
  );
}

/**
 * Analyze user's intent: Chat or Code Modification
 * Enhanced with file awareness for targeted modifications
 */
export async function analyzeIntent(
  message: string,
  context?: {
    sessionGoal?: string;
    existingFiles?: string[];
  }
): Promise<{
  intent: "chat" | "modification";
  tasks?: TaskPlanItem[];
  targetFiles?: string[];
}> {
  const systemPrompt = `You are an AI project manager analyzing user requests.

PROJECT GOAL: ${context?.sessionGoal || "Unknown"}
EXISTING FILES: ${context?.existingFiles?.join(", ") || "None"}

Determine if the user's message is:
1. CHAT: A question, comment, or general discussion
2. MODIFICATION: A request to add, change, or fix code

For MODIFICATION requests, generate specific tasks and identify which existing files to modify.

Return JSON:
{
  "intent": "chat" | "modification",
  "tasks": [
    {
      "epic": "modification",
      "title": "specific task title",
      "type": "component|api|page|config",
      "description": "detailed description including the user's exact requirements",
      "dependencies": [],
      "priority": 1
    }
  ],
  "targetFiles": ["paths of existing files to modify"]
}`;

  const userPrompt = `User message: "${message}"

Analyze the intent and generate tasks if it's a modification request.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content || "{}";
    return JSON.parse(content);
  } catch {
    return { intent: "chat" };
  }
}

/**
 * Infer file path from task type and description
 */
function inferPathFromTask(taskType: string, description: string): string {
  const descLower = description.toLowerCase();

  switch (taskType) {
    case "setup":
      if (descLower.includes("package")) return "package.json";
      if (descLower.includes("readme")) return "README.md";
      if (descLower.includes("env")) return ".env.example";
      if (descLower.includes("tsconfig")) return "tsconfig.json";
      return "package.json";
    case "schema":
      return "prisma/schema.prisma";
    case "api":
      return "src/app/api/route.ts";
    case "page":
      return "src/app/page.tsx";
    case "component":
      return "src/components/Component.tsx";
    case "config":
      if (descLower.includes("tailwind")) return "tailwind.config.ts";
      return "next.config.js";
    default:
      return "src/generated.ts";
  }
}

function getLanguageFromPath(path: string): string {
  if (path.endsWith(".ts") || path.endsWith(".tsx")) return "typescript";
  if (path.endsWith(".js") || path.endsWith(".jsx")) return "javascript";
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".prisma")) return "prisma";
  if (path.endsWith(".md")) return "markdown";
  return "text";
}

export const llm = {
  generateCode,
  generatePlan,
  analyzeError,
  chat,
  analyzeIntent,
  modifyCode,
  fixCode,
};

export default llm;
