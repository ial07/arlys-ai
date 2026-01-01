/**
 * Reviewer Agent
 *
 * Responsible for validating code quality, security, and correctness.
 */

import { BaseAgent } from "./base.agent.js";
import type { AgentContext } from "../types/agent.types.js";
import type {
  AgentMessage,
  ReviewArtifactPayload,
  ReviewResultPayload,
} from "../types/message.types.js";
import type { TaskError } from "../types/task.types.js";

interface ValidationRule {
  name: string;
  check: (content: string, filePath: string) => TaskError[];
}

// Security patterns to detect
const SECURITY_PATTERNS = [
  { pattern: /eval\s*\(/g, message: "Use of eval() is a security risk" },
  {
    pattern: /innerHTML\s*=/g,
    message: "Direct innerHTML assignment may cause XSS",
  },
  {
    pattern: /dangerouslySetInnerHTML/g,
    message: "dangerouslySetInnerHTML should be used carefully",
  },
  {
    pattern: /password\s*[=:]\s*["'][^"']+["']/gi,
    message: "Hardcoded password detected",
  },
  {
    pattern: /api[_-]?key\s*[=:]\s*["'][^"']+["']/gi,
    message: "Hardcoded API key detected",
  },
  {
    pattern: /process\.env\./g,
    message: "Environment variable access (verify it is necessary)",
    severity: "info" as const,
  },
];

// Style patterns to check
const STYLE_PATTERNS = [
  {
    pattern: /console\.log/g,
    message: "Remove console.log before production",
    severity: "warning" as const,
  },
  {
    pattern: /\/\/\s*TODO/gi,
    message: "TODO comment found",
    severity: "info" as const,
  },
  {
    pattern: /any\s*[;,)>]/g,
    message: 'Avoid using "any" type',
    severity: "warning" as const,
  },
  {
    pattern: /!important/g,
    message: "Avoid !important in CSS",
    severity: "warning" as const,
  },
];

// Code quality patterns (per Executor Agent specification)
const CODE_QUALITY_PATTERNS = [
  {
    pattern: /lorem\s*ipsum/gi,
    message: "Lorem ipsum placeholder text detected - use real content",
    severity: "error" as const,
  },
  {
    pattern: /style\s*=\s*["'][^"']+["']/gi,
    message: "Inline styles detected - move to style.css",
    severity: "warning" as const,
  },
  {
    pattern: /<script[^>]*>[^<]+<\/script>/gi,
    message: "Inline script detected - move to main.js",
    severity: "warning" as const,
  },
  {
    pattern: /placeholder\s*(text|content|image)/gi,
    message: "Placeholder content detected - use real content",
    severity: "warning" as const,
  },
  {
    pattern: /example\.com|test\.com/gi,
    message: "Example domain detected - use real or # for links",
    severity: "info" as const,
  },
];

// Design quality patterns (for landing pages)
const DESIGN_PATTERNS = {
  // Check for real images (Unsplash or similar)
  hasRealImages: (content: string) => {
    const imageMatches =
      content.match(/https:\/\/images\.unsplash\.com/gi) || [];
    return imageMatches.length >= 1;
  },
  // Check for minimum sections (6+)
  hasSufficientSections: (content: string) => {
    const sectionMatches = content.match(/<section/gi) || [];
    return sectionMatches.length >= 5;
  },
  // Check for hero with background image
  hasHeroWithImage: (content: string) => {
    return (
      /<(section|header)[^>]*class="[^"]*hero[^"]*"[^>]*>/i.test(content) &&
      (content.includes("background-image") || content.includes("unsplash"))
    );
  },
  // Check for navigation
  hasNavigation: (content: string) => {
    return (
      /<nav/i.test(content) || /<header[^>]*class="[^"]*nav/i.test(content)
    );
  },
  // Check for footer
  hasFooter: (content: string) => {
    return /<footer/i.test(content);
  },
  // Check for CTA buttons
  hasCTA: (content: string) => {
    return /class="[^"]*cta[^"]*"|class="[^"]*btn[^"]*"|<button/gi.test(
      content
    );
  },
};

export class ReviewerAgent extends BaseAgent {
  private validationRules: ValidationRule[];

  constructor(context: AgentContext) {
    super(
      {
        name: "reviewer",
        maxConcurrency: 2,
        retryAttempts: 2,
        timeoutMs: 60000,
      },
      context
    );

    this.validationRules = this.initializeRules();
  }

  protected registerHandlers(): void {
    this.handlers.set("review_artifact", {
      action: "review_artifact",
      handler: this.handleReviewArtifact.bind(this),
    });

    this.handlers.set("validate_syntax", {
      action: "validate_syntax",
      handler: this.handleValidateSyntax.bind(this),
    });

    this.handlers.set("security_scan", {
      action: "security_scan",
      handler: this.handleSecurityScan.bind(this),
    });
  }

  /**
   * Review code artifacts
   */
  private async handleReviewArtifact(
    message: AgentMessage<ReviewArtifactPayload>
  ): Promise<void> {
    const { taskId, artifacts } = message.payload;
    this.log(`Reviewing ${artifacts.length} artifacts for task: ${taskId}`);

    const allErrors: TaskError[] = [];
    const suggestions: string[] = [];

    for (const artifact of artifacts) {
      // Run all validation rules
      for (const rule of this.validationRules) {
        const errors = rule.check(artifact.content, artifact.path);
        allErrors.push(...errors);
      }

      // Generate suggestions based on content
      suggestions.push(
        ...this.generateSuggestions(artifact.content, artifact.path)
      );
    }

    // Determine if approved (no errors)
    const hasBlockingErrors = allErrors.some((e) => e.severity === "error");

    const response: ReviewResultPayload = {
      taskId,
      approved: !hasBlockingErrors,
      errors: allErrors.map((e) => ({
        type: e.code,
        message: e.message,
        file: e.file,
        line: e.line,
      })),
      suggestions,
    };

    await this.respond(message, response);
    this.log(
      `Review complete: ${hasBlockingErrors ? "REJECTED" : "APPROVED"}, ${allErrors.length} issues found`
    );
  }

  /**
   * Validate syntax of code
   */
  private async handleValidateSyntax(
    message: AgentMessage<{ content: string; language: string }>
  ): Promise<void> {
    const { content, language } = message.payload;
    const errors: TaskError[] = [];

    // Basic syntax checks based on language
    if (language === "typescript" || language === "javascript") {
      errors.push(...this.checkJavaScriptSyntax(content));
    } else if (language === "json") {
      errors.push(...this.checkJsonSyntax(content));
    }

    await this.respond(message, {
      valid: errors.length === 0,
      errors,
    });
  }

  /**
   * Security scan
   */
  private async handleSecurityScan(
    message: AgentMessage<{ content: string; filePath: string }>
  ): Promise<void> {
    const { content, filePath } = message.payload;
    const vulnerabilities = this.checkSecurityPatterns(content, filePath);

    await this.respond(message, {
      secure: vulnerabilities.length === 0,
      vulnerabilities,
    });
  }

  /**
   * Initialize validation rules
   */
  private initializeRules(): ValidationRule[] {
    return [
      {
        name: "security",
        check: (content, path) => this.checkSecurityPatterns(content, path),
      },
      {
        name: "style",
        check: (content, path) => this.checkStylePatterns(content, path),
      },
      {
        name: "structure",
        check: (content, path) => this.checkStructure(content, path),
      },
      {
        name: "design",
        check: (content, path) => this.checkDesignPatterns(content, path),
      },
      {
        name: "code_quality",
        check: (content, path) => this.checkCodeQualityPatterns(content, path),
      },
    ];
  }

  /**
   * Check for security issues
   */
  private checkSecurityPatterns(
    content: string,
    filePath: string
  ): TaskError[] {
    const errors: TaskError[] = [];

    for (const { pattern, message, severity } of SECURITY_PATTERNS) {
      const matches = content.match(pattern);
      if (matches) {
        errors.push({
          code: "SECURITY",
          message,
          file: filePath,
          severity: severity || "error",
        });
      }
    }

    return errors;
  }

  /**
   * Check for style issues
   */
  private checkStylePatterns(content: string, filePath: string): TaskError[] {
    const errors: TaskError[] = [];

    for (const { pattern, message, severity } of STYLE_PATTERNS) {
      const matches = content.match(pattern);
      if (matches) {
        errors.push({
          code: "STYLE",
          message: `${message} (${matches.length} occurrence${matches.length > 1 ? "s" : ""})`,
          file: filePath,
          severity: severity || "warning",
        });
      }
    }

    return errors;
  }

  /**
   * Check code quality patterns (per Executor Agent specification)
   */
  private checkCodeQualityPatterns(
    content: string,
    filePath: string
  ): TaskError[] {
    const errors: TaskError[] = [];

    for (const { pattern, message, severity } of CODE_QUALITY_PATTERNS) {
      const matches = content.match(pattern);
      if (matches) {
        errors.push({
          code: "CODE_QUALITY",
          message: `${message} (${matches.length} occurrence${matches.length > 1 ? "s" : ""})`,
          file: filePath,
          severity: severity || "warning",
        });
      }
    }

    return errors;
  }

  /**
   * Check code structure
   */
  private checkStructure(content: string, filePath: string): TaskError[] {
    const errors: TaskError[] = [];
    const lines = content.split("\n");

    // Check for excessively long lines
    lines.forEach((line, index) => {
      if (line.length > 120) {
        errors.push({
          code: "STRUCTURE",
          message: `Line exceeds 120 characters (${line.length})`,
          file: filePath,
          line: index + 1,
          severity: "warning",
        });
      }
    });

    // Check for excessive file size
    if (lines.length > 500) {
      errors.push({
        code: "STRUCTURE",
        message: `File has ${lines.length} lines. Consider splitting into smaller modules.`,
        file: filePath,
        severity: "warning",
      });
    }

    return errors;
  }

  /**
   * Check design quality for landing pages
   */
  private checkDesignPatterns(content: string, filePath: string): TaskError[] {
    const errors: TaskError[] = [];

    // Only check HTML files
    if (!filePath.endsWith(".html")) {
      return errors;
    }

    // Check for real images
    if (!DESIGN_PATTERNS.hasRealImages(content)) {
      errors.push({
        code: "DESIGN",
        message:
          "No Unsplash images found. Use real image URLs for professional look.",
        file: filePath,
        severity: "warning",
      });
    }

    // Check for sufficient sections
    if (!DESIGN_PATTERNS.hasSufficientSections(content)) {
      errors.push({
        code: "DESIGN",
        message:
          "Less than 5 sections detected. Landing pages should have 6+ sections.",
        file: filePath,
        severity: "warning",
      });
    }

    // Check for hero with image
    if (!DESIGN_PATTERNS.hasHeroWithImage(content)) {
      errors.push({
        code: "DESIGN",
        message: "Hero section missing or lacks background image.",
        file: filePath,
        severity: "warning",
      });
    }

    // Check for navigation
    if (!DESIGN_PATTERNS.hasNavigation(content)) {
      errors.push({
        code: "DESIGN",
        message: "Navigation element not found.",
        file: filePath,
        severity: "info",
      });
    }

    // Check for footer
    if (!DESIGN_PATTERNS.hasFooter(content)) {
      errors.push({
        code: "DESIGN",
        message: "Footer element not found.",
        file: filePath,
        severity: "info",
      });
    }

    // Check for CTA buttons
    if (!DESIGN_PATTERNS.hasCTA(content)) {
      errors.push({
        code: "DESIGN",
        message:
          "No CTA buttons detected. Add prominent call-to-action elements.",
        file: filePath,
        severity: "warning",
      });
    }

    return errors;
  }

  /**
   * Basic JavaScript/TypeScript syntax check
   */
  private checkJavaScriptSyntax(content: string): TaskError[] {
    const errors: TaskError[] = [];

    // Check for unbalanced braces
    const braces = { "{": 0, "(": 0, "[": 0 };
    const closingMap: Record<string, keyof typeof braces> = {
      "}": "{",
      ")": "(",
      "]": "[",
    };

    for (const char of content) {
      if (char in braces) {
        braces[char as keyof typeof braces]++;
      } else if (char in closingMap) {
        braces[closingMap[char]]--;
      }
    }

    for (const [brace, count] of Object.entries(braces)) {
      if (count !== 0) {
        errors.push({
          code: "SYNTAX",
          message: `Unbalanced ${brace}: ${count > 0 ? "missing closing" : "extra closing"} brace`,
          severity: "error",
        });
      }
    }

    return errors;
  }

  /**
   * JSON syntax check
   */
  private checkJsonSyntax(content: string): TaskError[] {
    try {
      JSON.parse(content);
      return [];
    } catch (error) {
      return [
        {
          code: "SYNTAX",
          message: `Invalid JSON: ${error instanceof Error ? error.message : "Unknown error"}`,
          severity: "error",
        },
      ];
    }
  }

  /**
   * Generate improvement suggestions
   */
  private generateSuggestions(content: string, filePath: string): string[] {
    const suggestions: string[] = [];

    // Check if file might benefit from tests
    if (filePath.includes("/components/") || filePath.includes("/hooks/")) {
      if (!filePath.includes(".test.") && !filePath.includes(".spec.")) {
        suggestions.push(`Consider adding tests for ${filePath}`);
      }
    }

    // Check for missing error handling
    if (
      content.includes("async") &&
      !content.includes("catch") &&
      !content.includes("try")
    ) {
      suggestions.push("Consider adding error handling for async operations");
    }

    // Check for missing TypeScript types
    if (filePath.endsWith(".ts") || filePath.endsWith(".tsx")) {
      if (content.includes(": any") || content.includes("<any>")) {
        suggestions.push(
          'Replace "any" types with specific types for better type safety'
        );
      }
    }

    return suggestions;
  }
}
