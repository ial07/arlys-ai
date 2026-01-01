/**
 * Executor Agent
 *
 * Responsible for generating STATIC HTML code based on task specifications.
 *
 * STRICT RULES:
 * - Do NOT use React, JSX, Babel, or Framer Motion
 * - Generate ONLY static HTML with Tailwind CDN
 * - Use GSAP + ScrollTrigger for animations
 * - Content MUST be visible without JavaScript
 */

import { BaseAgent } from "./base.agent.js";
import type { AgentContext } from "../types/agent.types.js";
import type {
  AgentMessage,
  ExecuteTaskPayload,
  TaskCompletePayload,
} from "../types/message.types.js";
import type { Task, Artifact, TaskError } from "../types/task.types.js";
import { Sandbox } from "../core/sandbox.js";
import { PatternStore } from "../memory/patterns.js";
import path from "path";

import { generateCode } from "../llm/openai.js";

/**
 * FORBIDDEN PATTERNS - Reject if found in generated code
 */
const FORBIDDEN_PATTERNS = [
  /\bReact\b/,
  /\bReactDOM\b/,
  /\bJSX\b/i,
  /\bbabel\b/i,
  /\bframer-motion\b/i,
  /\buseState\b/,
  /\buseEffect\b/,
  /\bimport\s+.*\s+from\s+['"]react['"]/,
  /\brequire\s*\(\s*['"]react['"]\s*\)/,
  /createRoot\s*\(/,
  /\.jsx\b/,
  /export\s+default\s+function\s+\w+\s*\(/, // React component pattern
];

/**
 * Validate that code does not contain React/JSX patterns
 */
function validateStaticHTML(
  code: string,
  filePath: string
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(code)) {
      errors.push(
        `Forbidden pattern found in ${filePath}: ${pattern.toString()}`
      );
    }
  }

  // For HTML files, ensure content exists outside of script tags
  if (filePath.endsWith(".html")) {
    // Check if there's visible content in body (not just script tags)
    const bodyMatch = code.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) {
      const bodyContent = bodyMatch[1]
        .replace(/<script[\s\S]*?<\/script>/gi, "") // Remove scripts
        .replace(/<style[\s\S]*?<\/style>/gi, "") // Remove styles
        .replace(/<!--[\s\S]*?-->/g, "") // Remove comments
        .trim();

      if (bodyContent.length < 100) {
        errors.push(
          `${filePath} has insufficient visible content (${bodyContent.length} chars). Content must exist in HTML.`
        );
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Static HTML System Prompt for LLM
 */
const STATIC_HTML_SYSTEM_PROMPT = `
You are a STATIC HTML generator. You MUST follow these rules STRICTLY:

FORBIDDEN (will cause build failure):
- React, ReactDOM, JSX, Babel
- Framer Motion
- Any framework that requires compilation
- Content that only exists inside JavaScript
- Empty body tags or placeholder divs

REQUIRED:
- Pure static HTML with full content in the markup
- Tailwind CSS via CDN: <script src="https://cdn.tailwindcss.com"></script>
- GSAP via CDN: <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
- GSAP ScrollTrigger: <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"></script>
- Images from Pexels with onerror fallback
- All text content directly in HTML
- Sections: Hero, Features, About, Testimonials, Contact, Footer

IMAGE FORMAT:
<img src="https://images.pexels.com/photos/[ID]/pexels-photo-[ID].jpeg?auto=compress&cs=tinysrgb&w=800" 
     onerror="this.src='https://images.pexels.com/photos/3184338/pexels-photo-3184338.jpeg'"
     alt="description" class="..." />

ANIMATION RULES:
- Use GSAP only (no CSS animations for complex effects)
- Content opacity MUST be 1 by default in HTML
- Animations enhance content, don't create it
- Initialize on DOMContentLoaded with element safety checks
`;

export class ExecutorAgent extends BaseAgent {
  private sandbox: Sandbox;
  private patternStore: PatternStore;

  constructor(context: AgentContext) {
    super(
      {
        name: "executor",
        maxConcurrency: 1,
        retryAttempts: 3,
        timeoutMs: 120000,
      },
      context
    );

    this.sandbox = new Sandbox(context.workingDirectory);
    this.patternStore = new PatternStore(
      path.join(context.workingDirectory, ".agent", "patterns")
    );
  }

  protected async onInitialize(): Promise<void> {
    await this.patternStore.initialize();
  }

  protected registerHandlers(): void {
    this.handlers.set("execute_task", {
      action: "execute_task",
      handler: this.handleExecuteTask.bind(this),
    });
  }

  /**
   * Execute a task
   */
  private async handleExecuteTask(
    message: AgentMessage<ExecuteTaskPayload>
  ): Promise<void> {
    const { taskId, taskType, inputs } = message.payload;
    this.log(`Executing task: ${taskId} (type: ${taskType})`);

    const artifacts: Artifact[] = [];
    const errors: TaskError[] = [];

    try {
      // Generate artifacts based on task type
      const generated = await this.generateArtifacts(taskType, inputs);

      // Validate ALL generated code for React/JSX contamination
      for (const artifact of generated) {
        const validation = validateStaticHTML(artifact.content, artifact.path);

        if (!validation.valid) {
          this.log(
            `REJECTED: ${artifact.path} contains forbidden patterns`,
            "error"
          );
          for (const err of validation.errors) {
            this.log(err, "error");
          }
          throw new Error(
            `Static HTML validation failed: ${validation.errors.join("; ")}`
          );
        }

        // Also run sandbox validation
        const sandboxValidation = this.sandbox.validateContent(
          artifact.content
        );
        if (sandboxValidation.warnings.length > 0) {
          this.log(
            `Warnings for ${artifact.path}: ${sandboxValidation.warnings.join(", ")}`,
            "warn"
          );
        }

        artifacts.push(artifact);
      }

      const response: TaskCompletePayload = {
        taskId,
        success: true,
        artifacts: artifacts.map((a) => ({ path: a.path, action: a.action })),
      };

      await this.respond(message, response);
      this.log(
        `Task completed: ${taskId}, generated ${artifacts.length} artifacts`
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      errors.push({
        code: "EXECUTION_ERROR",
        message: errorMsg,
        severity: "error",
      });

      await this.respond(message, {
        taskId,
        success: false,
        artifacts: [],
        errors,
      });
    }
  }

  /**
   * Generate STATIC HTML artifact with INLINE animations
   * STRICT: No React, No JSX, No Frameworks, Single File Output
   */
  private async generateArtifacts(
    taskType: string,
    inputs: Record<string, unknown>
  ): Promise<Artifact[]> {
    const artifacts: Artifact[] = [];
    const taskDescription = (inputs.description as string) || "Build a website";
    const goal = (inputs.goal as string) || "Build a high quality landing page";

    // Generate SINGLE index.html with ALL animations inline
    this.log("Generating STATIC index.html with INLINE GSAP animations...");
    const htmlResponse = await generateCode({
      taskType: "html",
      taskDescription: `${STATIC_HTML_SYSTEM_PROMPT}

GENERATE: A complete static HTML landing page for: ${taskDescription}

GOAL: ${goal}

OUTPUT: A SINGLE index.html file with ALL animations embedded inline.

STRUCTURE:
1. <!DOCTYPE html> and <html> with lang
2. <head> with:
   - Meta tags (charset, viewport, description)
   - Title
   - Tailwind CSS CDN: <script src="https://cdn.tailwindcss.com"></script>
   - Tailwind config inline (dark theme colors)
   - Google Fonts (Inter)
   - GSAP CDN: <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
   - ScrollTrigger CDN: <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"></script>
   - <style> block for custom CSS (gradients, glassmorphism, hover effects)
3. <body> with FULL VISIBLE CONTENT:
   - <nav> fixed navigation
   - <section id="hero"> with gradient background, Pexels image, heading, subheading, CTA buttons
   - <section id="features"> with 6 feature cards in grid
   - <section id="about"> with image and text
   - <section id="testimonials"> with 3 testimonial cards
   - <section id="contact"> with contact form
   - <footer> with links and social icons
4. <script> block at bottom with GSAP animations:
   - DOMContentLoaded wrapper
   - GSAP safety check: if (typeof gsap === 'undefined') return;
   - ScrollTrigger registration: gsap.registerPlugin(ScrollTrigger);
   - Hero animation: fade-in + move-up on load
   - Section reveals: ScrollTrigger for each section
   - Card stagger animations
   - Hover effects using gsap

ANIMATION SCRIPT TEMPLATE (embed at bottom of body):
<script>
document.addEventListener('DOMContentLoaded', function() {
  if (typeof gsap === 'undefined') return;
  if (typeof ScrollTrigger !== 'undefined') gsap.registerPlugin(ScrollTrigger);

  // Hero animation - fade in and move up
  const heroContent = document.querySelector('#hero-content');
  if (heroContent) {
    gsap.from(heroContent.children, {
      opacity: 0,
      y: 30,
      duration: 0.8,
      stagger: 0.15,
      ease: 'power3.out'
    });
  }

  // Section reveals on scroll
  document.querySelectorAll('section').forEach(section => {
    if (section.id === 'hero') return;
    gsap.from(section, {
      scrollTrigger: { trigger: section, start: 'top 80%' },
      opacity: 0,
      y: 50,
      duration: 0.8,
      ease: 'power3.out'
    });
  });

  // Card stagger animations
  const cards = document.querySelectorAll('.card');
  if (cards.length) {
    gsap.from(cards, {
      scrollTrigger: { trigger: cards[0].parentElement, start: 'top 75%' },
      opacity: 0,
      y: 40,
      scale: 0.95,
      duration: 0.6,
      stagger: 0.1,
      ease: 'power3.out'
    });
  }
});
</script>

REQUIRED SECTIONS:
- Navigation, Hero, Features (6 cards), About, Testimonials (3), Contact, Footer

IMAGE RULES:
- Use Pexels URLs with onerror fallback
- Example: <img src="https://images.pexels.com/photos/3184338/pexels-photo-3184338.jpeg" onerror="this.style.background='#1f2937'" />

STYLING:
- Dark theme (#0a0a0a background)
- Glassmorphism cards with backdrop-blur
- Gradient text for headings
- Smooth hover transitions`,
      context: { goal },
    });

    artifacts.push({
      type: "file",
      path: "index.html",
      content: htmlResponse.code,
      action: "create",
    });

    return artifacts;
  }
}
