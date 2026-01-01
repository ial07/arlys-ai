import { execa } from 'execa';
import { Sandbox } from '../core/sandbox.js';

export interface CommandResult {
  success: boolean;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
  error?: string;
}

export interface CommandOptions {
  cwd?: string;
  timeout?: number;
  env?: Record<string, string>;
}

export class CommandTool {
  private sandbox: Sandbox;
  private workingDirectory: string;
  private defaultTimeout: number;

  constructor(workingDirectory: string, defaultTimeout: number = 120000) {
    this.workingDirectory = workingDirectory;
    this.sandbox = new Sandbox(workingDirectory);
    this.defaultTimeout = defaultTimeout;
  }

  /**
   * Execute a command
   */
  async execute(command: string, options?: CommandOptions): Promise<CommandResult> {
    const startTime = Date.now();

    // Validate command
    const validation = this.sandbox.validateCommand(command);
    if (!validation.valid) {
      return {
        success: false,
        command,
        stdout: '',
        stderr: '',
        exitCode: -1,
        duration: 0,
        error: validation.reason,
      };
    }


    try {
      const result = await execa(command, {
        cwd: options?.cwd || this.workingDirectory,
        timeout: options?.timeout || this.defaultTimeout,
        env: {
          ...process.env,
          ...options?.env,
          CI: 'true',
          FORCE_COLOR: '0',
        },
        shell: true,
        reject: false,
      });
      const duration = Date.now() - startTime;

      return {
        success: result.exitCode === 0,
        command,
        stdout: String(result.stdout || ''),
        stderr: String(result.stderr || ''),
        exitCode: result.exitCode ?? -1,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        success: false,
        command,
        stdout: '',
        stderr: error instanceof Error ? error.message : 'Unknown error',
        exitCode: -1,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Run npm install
   */
  async npmInstall(packageName?: string): Promise<CommandResult> {
    const command = packageName
      ? `npm install ${packageName}`
      : 'npm install';
    return this.execute(command);
  }

  /**
   * Run npm build
   */
  async npmBuild(): Promise<CommandResult> {
    return this.execute('npm run build');
  }

  /**
   * Run npm test
   */
  async npmTest(): Promise<CommandResult> {
    return this.execute('npm run test');
  }

  /**
   * Run npm lint
   */
  async npmLint(): Promise<CommandResult> {
    return this.execute('npm run lint');
  }

  /**
   * Run Prisma commands
   */
  async prismaGenerate(): Promise<CommandResult> {
    return this.execute('npx prisma generate');
  }

  async prismaMigrate(name?: string): Promise<CommandResult> {
    const migrateName = name || 'init';
    return this.execute(`npx prisma migrate dev --name ${migrateName}`);
  }

  /**
   * Parse build errors
   */
  parseBuildErrors(stderr: string): Array<{ file?: string; line?: number; message: string }> {
    const errors: Array<{ file?: string; line?: number; message: string }> = [];

    // TypeScript error pattern
    const tsPattern = /(.+?)\((\d+),(\d+)\):\s*error\s*TS\d+:\s*(.+)/g;
    let match;

    while ((match = tsPattern.exec(stderr)) !== null) {
      errors.push({
        file: match[1],
        line: parseInt(match[2], 10),
        message: match[4],
      });
    }

    // Next.js error pattern
    const nextPattern = /Error:\s*(.+)/g;
    while ((match = nextPattern.exec(stderr)) !== null) {
      if (!errors.some((e) => e.message.includes(match![1]))) {
        errors.push({ message: match[1] });
      }
    }

    return errors;
  }

  /**
   * Parse test results
   */
  parseTestResults(stdout: string): { passed: number; failed: number; skipped: number } {
    const results = { passed: 0, failed: 0, skipped: 0 };

    // Jest/Vitest pattern
    const passMatch = stdout.match(/(\d+)\s*pass(ed)?/i);
    const failMatch = stdout.match(/(\d+)\s*fail(ed)?/i);
    const skipMatch = stdout.match(/(\d+)\s*skip(ped)?/i);

    if (passMatch) results.passed = parseInt(passMatch[1], 10);
    if (failMatch) results.failed = parseInt(failMatch[1], 10);
    if (skipMatch) results.skipped = parseInt(skipMatch[1], 10);

    return results;
  }
}
