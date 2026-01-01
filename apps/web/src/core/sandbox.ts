/**
 * Execution Sandbox - Security Layer
 * 
 * Provides safe execution environment with command and file restrictions.
 */

import path from 'path';

export interface SandboxConfig {
  workingDirectory: string;
  allowedCommands: RegExp[];
  blockedPatterns: RegExp[];
  allowedExtensions: string[];
  blockedPaths: string[];
  maxFileSize: number; // bytes
}

const DEFAULT_CONFIG: Partial<SandboxConfig> = {
  allowedCommands: [
    /^npm\s+(install|run|test|build|ci)(\s|$)/,
    /^npx\s+(prisma|eslint|prettier|vitest|jest)(\s|$)/,
    /^node\s+/,
    /^tsc(\s|$)/,
  ],
  blockedPatterns: [
    /rm\s+-rf\s+[\/~]/,
    /sudo\s+/,
    /chmod\s+777/,
    /curl.*\|.*sh/,
    /wget.*\|.*sh/,
    /eval\s*\(/,
    /exec\s*\(/,
    />>\s*\/etc\//,
    /\|\s*bash/,
    /\|\s*sh/,
  ],
  allowedExtensions: [
    '.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.scss',
    '.prisma', '.md', '.html', '.yaml', '.yml', '.env.example',
  ],
  blockedPaths: [
    '~/.ssh',
    '~/.aws',
    '~/.config',
    '/etc',
    '/var',
    '/usr',
    '/bin',
    '/sbin',
  ],
  maxFileSize: 10 * 1024 * 1024, // 10MB
};

export class Sandbox {
  private config: SandboxConfig;

  constructor(workingDirectory: string, customConfig?: Partial<SandboxConfig>) {
    this.config = {
      workingDirectory: path.resolve(workingDirectory),
      allowedCommands: customConfig?.allowedCommands || DEFAULT_CONFIG.allowedCommands!,
      blockedPatterns: customConfig?.blockedPatterns || DEFAULT_CONFIG.blockedPatterns!,
      allowedExtensions: customConfig?.allowedExtensions || DEFAULT_CONFIG.allowedExtensions!,
      blockedPaths: customConfig?.blockedPaths || DEFAULT_CONFIG.blockedPaths!,
      maxFileSize: customConfig?.maxFileSize || DEFAULT_CONFIG.maxFileSize!,
    };
  }

  /**
   * Validate a command before execution
   */
  validateCommand(command: string): { valid: boolean; reason?: string } {
    // Check for blocked patterns
    for (const pattern of this.config.blockedPatterns) {
      if (pattern.test(command)) {
        return {
          valid: false,
          reason: `Command contains blocked pattern: ${pattern}`,
        };
      }
    }

    // Check against allowed commands
    const isAllowed = this.config.allowedCommands.some((pattern) =>
      pattern.test(command)
    );

    if (!isAllowed) {
      return {
        valid: false,
        reason: `Command not in allowed list: ${command}`,
      };
    }

    return { valid: true };
  }

  /**
   * Validate a file path before access
   */
  validateFilePath(filePath: string): { valid: boolean; reason?: string } {
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(this.config.workingDirectory, filePath);

    // Check if within working directory
    if (!absolutePath.startsWith(this.config.workingDirectory)) {
      return {
        valid: false,
        reason: `Path outside working directory: ${absolutePath}`,
      };
    }

    // Check for blocked paths
    for (const blocked of this.config.blockedPaths) {
      const expandedBlocked = blocked.replace('~', process.env.HOME || '');
      if (absolutePath.startsWith(expandedBlocked)) {
        return {
          valid: false,
          reason: `Path is blocked: ${blocked}`,
        };
      }
    }

    return { valid: true };
  }

  /**
   * Validate file extension
   */
  validateExtension(filePath: string): { valid: boolean; reason?: string } {
    const ext = path.extname(filePath).toLowerCase();
    
    if (!ext) {
      // Allow files without extensions (e.g., Dockerfile, Makefile)
      return { valid: true };
    }

    if (!this.config.allowedExtensions.includes(ext)) {
      return {
        valid: false,
        reason: `File extension not allowed: ${ext}`,
      };
    }

    return { valid: true };
  }

  /**
   * Validate file size
   */
  validateFileSize(size: number): { valid: boolean; reason?: string } {
    if (size > this.config.maxFileSize) {
      return {
        valid: false,
        reason: `File size ${size} exceeds limit ${this.config.maxFileSize}`,
      };
    }

    return { valid: true };
  }

  /**
   * Validate content for sensitive data
   */
  validateContent(content: string): { valid: boolean; warnings: string[] } {
    const warnings: string[] = [];

    // Check for potential secrets
    const secretPatterns = [
      { pattern: /password\s*[=:]\s*["'][^"']+["']/gi, name: 'password' },
      { pattern: /api[_-]?key\s*[=:]\s*["'][^"']+["']/gi, name: 'API key' },
      { pattern: /secret[_-]?key\s*[=:]\s*["'][^"']+["']/gi, name: 'secret key' },
      { pattern: /private[_-]?key\s*[=:]/gi, name: 'private key' },
      { pattern: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/g, name: 'private key file' },
    ];

    for (const { pattern, name } of secretPatterns) {
      if (pattern.test(content)) {
        warnings.push(`Content may contain ${name}`);
      }
    }

    return { valid: true, warnings };
  }

  /**
   * Sanitize environment variables
   */
  sanitizeEnv(env: Record<string, string>): Record<string, string> {
    const sensitiveKeys = ['PASSWORD', 'SECRET', 'KEY', 'TOKEN', 'CREDENTIAL'];
    const sanitized: Record<string, string> = {};

    for (const [key, value] of Object.entries(env)) {
      const isSensitive = sensitiveKeys.some((s) => key.toUpperCase().includes(s));
      sanitized[key] = isSensitive ? '[REDACTED]' : value;
    }

    return sanitized;
  }

  /**
   * Get working directory
   */
  getWorkingDirectory(): string {
    return this.config.workingDirectory;
  }
}
