/**
 * Code Validator
 *
 * Validates generated code for common issues before saving.
 * Uses basic TypeScript parsing and pattern matching.
 */

import ts from "typescript";

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  line?: number;
  message: string;
  code: string;
}

export interface ValidationWarning {
  message: string;
  suggestion?: string;
}

/**
 * Validate TypeScript/JavaScript code
 */
export function validateCode(code: string, filePath: string): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Skip validation for non-code files
  if (
    filePath.endsWith(".json") ||
    filePath.endsWith(".md") ||
    filePath.endsWith(".css") ||
    filePath.endsWith(".prisma") ||
    filePath.endsWith(".env") ||
    filePath.endsWith(".env.example")
  ) {
    return { isValid: true, errors: [], warnings: [] };
  }

  // 1. Check for TypeScript syntax errors
  const syntaxErrors = checkTypescriptSyntax(code, filePath);
  errors.push(...syntaxErrors);

  // 2. Check for common React/Next.js issues
  const reactErrors = checkReactIssues(code, filePath);
  errors.push(...reactErrors);

  // 3. Check for common warnings
  const commonWarnings = checkCommonWarnings(code, filePath);
  warnings.push(...commonWarnings);

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Check TypeScript syntax using the TypeScript compiler
 */
function checkTypescriptSyntax(
  code: string,
  filePath: string
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Only check .ts and .tsx files
  if (!filePath.endsWith(".ts") && !filePath.endsWith(".tsx")) {
    return errors;
  }

  try {
    // Create a source file
    const sourceFile = ts.createSourceFile(
      filePath,
      code,
      ts.ScriptTarget.Latest,
      true,
      filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    );

    // Get parse diagnostics (syntax errors only)
    const diagnostics = (sourceFile as any).parseDiagnostics as ts.Diagnostic[];

    if (diagnostics && diagnostics.length > 0) {
      for (const diag of diagnostics) {
        const message = ts.flattenDiagnosticMessageText(diag.messageText, "\n");
        const line = diag.start
          ? sourceFile.getLineAndCharacterOfPosition(diag.start).line + 1
          : undefined;

        errors.push({
          line,
          message,
          code: "TS_SYNTAX_ERROR",
        });
      }
    }
  } catch (e) {
    errors.push({
      message: `Failed to parse TypeScript: ${(e as Error).message}`,
      code: "TS_PARSE_ERROR",
    });
  }

  return errors;
}

/**
 * Check for common React/Next.js issues
 */
function checkReactIssues(code: string, filePath: string): ValidationError[] {
  const errors: ValidationError[] = [];

  // Only check .tsx files
  if (!filePath.endsWith(".tsx")) {
    return errors;
  }

  // Check for hooks without 'use client'
  const hasClientHooks =
    /\b(useState|useEffect|useRef|useCallback|useMemo|useContext|useReducer)\s*\(/.test(
      code
    );
  const hasEventHandlers =
    /\b(onClick|onChange|onSubmit|onBlur|onFocus|onKeyDown|onKeyUp)\s*[=:{]/.test(
      code
    );
  const hasUseClient = /^['"]use client['"];?/m.test(code);

  if ((hasClientHooks || hasEventHandlers) && !hasUseClient) {
    errors.push({
      message: `Component uses client-side features (hooks/event handlers) but missing 'use client' directive at the top of the file`,
      code: "MISSING_USE_CLIENT",
    });
  }

  // Check for missing React import in older style (not needed in React 17+ but still common)
  const hasJSX = /<[A-Z]/.test(code) || /<[a-z]+[^>]*>/.test(code);
  const hasReactImport = /import\s+.*React.*from\s+['"]react['"]/.test(code);

  // This is just a warning now since React 17+ doesn't require it
  // but some setups might still need it

  return errors;
}

/**
 * Check for common warnings
 */
function checkCommonWarnings(
  code: string,
  filePath: string
): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  // Check for placeholder code
  if (/\/\/\s*(TODO|FIXME|XXX|PLACEHOLDER)/i.test(code)) {
    warnings.push({
      message: "Code contains TODO/FIXME comments",
      suggestion: "Ensure all placeholder code is completed",
    });
  }

  // Check for console.log in production code
  if (/console\.(log|debug)\(/.test(code) && !filePath.includes("test")) {
    warnings.push({
      message: "Code contains console.log statements",
      suggestion: "Consider removing debug logs for production",
    });
  }

  // Check for empty functions/components
  if (/\{\s*\}/.test(code) && filePath.endsWith(".tsx")) {
    warnings.push({
      message: "Code may contain empty function bodies",
      suggestion: "Ensure all functions have proper implementations",
    });
  }

  // Check for 'any' type usage
  const anyCount = (code.match(/:\s*any\b/g) || []).length;
  if (anyCount > 3) {
    warnings.push({
      message: `Code uses 'any' type ${anyCount} times`,
      suggestion: "Consider adding proper TypeScript types",
    });
  }

  return warnings;
}

/**
 * Format validation errors for LLM to fix
 */
export function formatErrorsForFix(result: ValidationResult): string {
  const parts: string[] = [];

  if (result.errors.length > 0) {
    parts.push("ERRORS TO FIX:");
    result.errors.forEach((err, i) => {
      const lineInfo = err.line ? ` (line ${err.line})` : "";
      parts.push(`${i + 1}. [${err.code}]${lineInfo}: ${err.message}`);
    });
  }

  if (result.warnings.length > 0) {
    parts.push("\nWARNINGS:");
    result.warnings.forEach((warn, i) => {
      parts.push(
        `${i + 1}. ${warn.message}${warn.suggestion ? ` - ${warn.suggestion}` : ""}`
      );
    });
  }

  return parts.join("\n");
}
