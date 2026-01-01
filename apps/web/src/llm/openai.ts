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
 * Sanitize generated HTML to remove any React/Babel/Framer Motion contamination
 * This acts as a safety net in case the LLM ignores instructions
 */
function sanitizeReactContent(code: string): string {
  if (!code) return code;

  let sanitized = code;

  // Remove React/ReactDOM CDN scripts
  sanitized = sanitized.replace(
    /<script[^>]*unpkg\.com\/react[^>]*><\/script>/gi,
    "<!-- React removed -->"
  );
  sanitized = sanitized.replace(
    /<script[^>]*unpkg\.com\/react-dom[^>]*><\/script>/gi,
    "<!-- ReactDOM removed -->"
  );

  // Remove Babel
  sanitized = sanitized.replace(
    /<script[^>]*babel[^>]*><\/script>/gi,
    "<!-- Babel removed -->"
  );
  sanitized = sanitized.replace(
    /<script[^>]*type\s*=\s*["']text\/babel["'][^>]*>[\s\S]*?<\/script>/gi,
    "<!-- Babel script removed -->"
  );

  // Remove Framer Motion
  sanitized = sanitized.replace(
    /<script[^>]*framer-motion[^>]*><\/script>/gi,
    "<!-- Framer Motion removed -->"
  );

  // Remove empty root divs that indicate React mounting
  sanitized = sanitized.replace(
    /<div\s+id\s*=\s*["']root["']\s*><\/div>/gi,
    "<!-- React root removed - add content here -->"
  );

  // Remove React-specific script blocks (createRoot, render)
  sanitized = sanitized.replace(
    /<script[^>]*>[\s\S]*?ReactDOM\.createRoot[\s\S]*?<\/script>/gi,
    "<!-- React mount script removed -->"
  );
  sanitized = sanitized.replace(
    /<script[^>]*>[\s\S]*?ReactDOM\.render[\s\S]*?<\/script>/gi,
    "<!-- React render script removed -->"
  );

  // Remove framerMotion references in scripts
  sanitized = sanitized.replace(
    /const\s*{\s*motion[\s\S]*?}\s*=\s*window\.framerMotion;?/gi,
    "// Framer Motion removed"
  );

  // Log if sanitization was needed
  if (sanitized !== code) {
    console.warn(
      "⚠️ sanitizeReactContent: Removed React/Babel/Framer content from generated code"
    );
  }

  return sanitized;
}

/**
 * Generate code for a specific task with full project context
 */
export async function generateCode(
  request: GenerateCodeRequest
): Promise<GenerateCodeResponse> {
  const { taskType, taskDescription, context } = request;

  // Build context-aware system prompt with STRICT STATIC HTML CONTRACT
  const systemPrompt = `You are a STATIC HTML Generator. You generate PURE static HTML only.

PRIMARY GOAL:
Generate a fully visible landing page that MUST render correctly without any JavaScript runtime.

INPUT CONTEXT:
Brand/Goal: "${context?.goal || "Build a landing page"}"
Task: "${taskDescription}"

=== ABSOLUTE RULES - READ CAREFULLY ===

🚫 FORBIDDEN (WILL CAUSE BUILD FAILURE):
• React, ReactDOM, JSX - BANNED
• Babel, babel.min.js - BANNED  
• Framer Motion - BANNED
• Vue, Angular, Svelte - BANNED
• Any framework that requires compilation
• Any import/require statements
• useState, useEffect, hooks - BANNED
• createRoot, render() - BANNED
• Component functions - BANNED

✅ REQUIRED:
• Pure static HTML5
• Tailwind CSS via CDN
• GSAP + ScrollTrigger via CDN for animations
• All content directly in HTML markup
• Content MUST be visible before JS loads

=== REQUIRED CDN SCRIPTS (in this order in <head>) ===
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"></script>

=== TAILWIND CONFIG (inline in <head>) ===
<script>
tailwind.config = {
  theme: {
    extend: {
      colors: {
        primary: { 500: '#0ea5e9', 600: '#0284c7' },
        dark: { 900: '#0a0a0a', 800: '#121212' }
      }
    }
  }
}
</script>

=== HTML STRUCTURE ===
1. <!DOCTYPE html>
2. <head> with meta, title, CDN scripts, inline <style>
3. <body> with FULL VISIBLE CONTENT:
   - <nav> fixed navigation
   - <section id="hero"> with heading, subheading, CTA buttons
   - <section id="features"> with 6 feature cards
   - <section id="about"> with image and text
   - <section id="testimonials"> with 3 testimonial cards
   - <section id="contact"> with form
   - <footer>
4. <script> block at bottom with GSAP animations (vanilla JS only)

=== IMAGE RULES (MANDATORY) ===
• Use ONLY Pexels image URLs: https://images.pexels.com/photos/[ID]/pexels-photo-[ID].jpeg
• NEVER use Unsplash
• Always include onerror fallback:
  onerror="this.style.background='#1f2937'"

=== ANIMATION SCRIPT (at bottom of body) ===
<script>
document.addEventListener('DOMContentLoaded', function() {
  if (typeof gsap === 'undefined') return;
  if (typeof ScrollTrigger !== 'undefined') gsap.registerPlugin(ScrollTrigger);
  
  // Hero fade-in
  const hero = document.querySelector('#hero-content');
  if (hero) gsap.from(hero.children, { opacity: 0, y: 30, stagger: 0.15, duration: 0.8 });
  
  // Section reveals
  document.querySelectorAll('section').forEach(function(section) {
    if (section.id === 'hero') return;
    gsap.from(section, {
      scrollTrigger: { trigger: section, start: 'top 80%' },
      opacity: 0, y: 50, duration: 0.8
    });
  });
  
  // Card stagger
  const cards = document.querySelectorAll('.card');
  if (cards.length) {
    gsap.from(cards, {
      scrollTrigger: { trigger: cards[0].parentElement, start: 'top 75%' },
      opacity: 0, y: 40, scale: 0.95, stagger: 0.1, duration: 0.6
    });
  }
});
</script>

=== STYLING ===
• Dark theme (#0a0a0a background, white text)
• Glassmorphism cards (backdrop-blur, border-white/10)
• Gradient text for headings
• Smooth hover transitions

=== FAIL CONDITIONS (will reject output) ===
• React/ReactDOM anywhere in code
• JSX syntax (<Component />)
• Babel script tag
• Framer Motion reference
• Blank body or empty sections
• Content only inside JavaScript

=== RESPONSE FORMAT (JSON) ===
{
  "path": "index.html",
  "code": "<!DOCTYPE html>...",
  "explanation": "Brief design rationale"
}
`;

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

    // Post-process: Strip any React/Babel content that slipped through
    let sanitizedCode = sanitizeReactContent(
      parsed.code || "// No code generated"
    );

    return {
      code: sanitizedCode,
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
  const systemPrompt = `You are a static website expert.
Your task is to modify existing HTML/CSS/JS code while enforcing strict static rules:
1. Vanilla JavaScript ALLOWED (main.js)
2. NO Frameworks
3. NO npm dependencies
4. GSAP CDN Allowed
5. Pure HTML5/CSS3/JS

PROJECT CONTEXT: ${request.projectContext?.goal || "Static HTML Page"}

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
  const systemPrompt = `You are an expert static website fixer. Fix the following code errors while preserving the strict static contract.

PROJECT GOAL: ${request.context?.goal || "Static Page"}

CRITICAL RULES:
1. Fix ALL reported errors
2. JavaScript (main.js) IS ALLOWED
3. REMOVE framework-specific syntax (React/Vue/Next)
4. Maintain pure HTML/CSS/JS validity
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
 * FRONTEND-ONLY: No backend, no API, no database
 */
export async function generatePlan(
  request: PlanGenerationRequest
): Promise<TaskPlanItem[]> {
  const systemPrompt = `You are a web designer creating STATIC HTML/CSS/JS pages.

STRICT RULES - STATIC MODE:
• Vanilla JavaScript ALLOWED (main.js)
• NO frameworks (React, Vue, Next.js, Vite)
• NO npm packages
• NO build steps
• ONLY: index.html, style.css, main.js

🚫 FORBIDDEN:
• external imports (except GSAP CDN)
• package.json
• Any framework files

ALLOWED FILES:
- index.html
- style.css
- main.js

Return JSON:
{
  "tasks": [
    {
      "epic": "foundation",
      "title": "task title",
      "type": "page|style|javascript",
      "description": "what to create",
      "dependencies": [],
      "priority": 1-3
    }
  ]
}

MAXIMUM 3 TASKS: index.html, style.css, main.js.`;

  const userPrompt = `Create a minimal task plan for a static landing page:

GOAL: ${request.goal}

Requirements:
- Static HTML and CSS only
- Hardcoded content
- MAXIMUM 2 TASKS: index.html and style.css`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content || '{"tasks": []}';
    const parsed = JSON.parse(content);
    return parsed.tasks || [];
  } catch (error) {
    console.error("Failed to parse plan response:", error);
    return [];
  }
}

/**
 * Generate a file manifest - complete list of files needed for the project
 * FRONTEND-ONLY: Static landing page with hardcoded data
 */
export async function generateManifest(
  goal: string
): Promise<Array<{ path: string; description: string; required: boolean }>> {
  const systemPrompt = `You are a file manifest generator for High-Quality Static Landing Pages.

STRICT RULES - STATIC MODE:
• Pure HTML5, CSS3, and Optional Vanilla JS
• NO Frameworks (Next.js, React, Vue)
• NO package.json or npm
• REQUIRED: index.html
• OPTIONAL: style.css, main.js

🚫 FORBIDDEN:
• .jsx, .ts, .tsx files
• package.json
• node_modules
• Any framework folders (app/, components/, lib/)

✅ ALLOWED FILES:
- index.html (Main entry point)
- style.css (Styling)
- main.js (Animation/Logic - ONLY if needed)

Return JSON:
{
  "files": [
    { "path": "index.html", "description": "Main landing page", "required": true },
    { "path": "style.css", "description": "Global styles", "required": false },
    { "path": "main.js", "description": "GSAP Animations", "required": false }
  ]
}`;

  const userPrompt = `Generate a file manifest for:

GOAL: ${goal}

Requirements:
- Static HTML only (index.html)
- Inline CSS or external style.css
- MAXIMUM 2 FILES
- NO JAVASCRIPT

Return the minimal files needed.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 2000,
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

/**
 * Fix project-wide errors based on build/runtime failure log
 */
export async function fixProjectErrors(request: {
  errors: string[];
  files: Array<{ path: string; content: string }>;
  goal: string;
}): Promise<Array<{ path: string; content: string; explanation: string }>> {
  const { errors, files, goal } = request;

  const systemPrompt = `You are a static website debug expert.
Your goal is to fix errors in a pure HTML/CSS project.

STRICT RULES:
1. Analyze the ERROR LOG provided by the user.
2. Review the EXISTING FILES to identify the root cause.
3. FIXES MUST BE PURE HTML/CSS ONLY.
4. NO JavaScript, NO frameworks, NO npm.
5. Return a JSON object containing a list of files to patch.
6. Provide the COMPLETE content for each changed file.

RESPONSE FORMAT:
{
  "patches": [
    {
      "path": "index.html",
      "content": "complete file content",
      "explanation": "Fixed broken tag..."
    }
  ]
}
`;

  let userPrompt = `PROJECT GOAL: ${goal}

ERROR LOG:
${errors.join("\n")}

EXISTING FILES:
`;

  // Context strategy: If too many files, we might clip.
  // For MVP, we assume moderate size or that build error points to specific files.
  // We'll prioritize files mentioned in the error log if needed, otherwise include all provided.
  files.forEach((f) => {
    userPrompt += `\n--- ${f.path} ---\n${f.content}\n`;
  });

  userPrompt += `\nIdentify the root cause and generate patches to fix the build/runtime errors.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // Use powerful model for debugging
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);

    return parsed.patches || [];
  } catch (error) {
    console.error("Failed to fix project errors:", error);
    return [];
  }
}
