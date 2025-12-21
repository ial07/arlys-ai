/**
 * File System Tool
 * 
 * Safe file operations with sandbox validation.
 */

import fs from 'fs-extra';
import path from 'path';
import { Sandbox } from '../core/sandbox.js';

export interface FileOperation {
  action: 'create' | 'read' | 'update' | 'delete';
  path: string;
  content?: string;
}

export interface FileOperationResult {
  success: boolean;
  path: string;
  error?: string;
  content?: string;
}

export class FileSystemTool {
  private sandbox: Sandbox;
  private baseDir: string;

  constructor(workingDirectory: string) {
    this.baseDir = path.resolve(workingDirectory);
    this.sandbox = new Sandbox(this.baseDir);
  }

  /**
   * Create a file with content
   */
  async createFile(filePath: string, content: string): Promise<FileOperationResult> {
    const absolutePath = this.resolvePath(filePath);

    // Validate
    const pathCheck = this.sandbox.validateFilePath(absolutePath);
    if (!pathCheck.valid) {
      return { success: false, path: filePath, error: pathCheck.reason };
    }

    const extCheck = this.sandbox.validateExtension(absolutePath);
    if (!extCheck.valid) {
      return { success: false, path: filePath, error: extCheck.reason };
    }

    const sizeCheck = this.sandbox.validateFileSize(Buffer.byteLength(content, 'utf8'));
    if (!sizeCheck.valid) {
      return { success: false, path: filePath, error: sizeCheck.reason };
    }

    try {
      await fs.ensureDir(path.dirname(absolutePath));
      await fs.writeFile(absolutePath, content, 'utf8');
      return { success: true, path: filePath };
    } catch (error) {
      return {
        success: false,
        path: filePath,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Read a file
   */
  async readFile(filePath: string): Promise<FileOperationResult> {
    const absolutePath = this.resolvePath(filePath);

    const pathCheck = this.sandbox.validateFilePath(absolutePath);
    if (!pathCheck.valid) {
      return { success: false, path: filePath, error: pathCheck.reason };
    }

    try {
      const content = await fs.readFile(absolutePath, 'utf8');
      return { success: true, path: filePath, content };
    } catch (error) {
      return {
        success: false,
        path: filePath,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Update a file
   */
  async updateFile(filePath: string, content: string): Promise<FileOperationResult> {
    const absolutePath = this.resolvePath(filePath);

    const pathCheck = this.sandbox.validateFilePath(absolutePath);
    if (!pathCheck.valid) {
      return { success: false, path: filePath, error: pathCheck.reason };
    }

    // Check if file exists
    if (!await fs.pathExists(absolutePath)) {
      return { success: false, path: filePath, error: 'File does not exist' };
    }

    try {
      await fs.writeFile(absolutePath, content, 'utf8');
      return { success: true, path: filePath };
    } catch (error) {
      return {
        success: false,
        path: filePath,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Delete a file
   */
  async deleteFile(filePath: string): Promise<FileOperationResult> {
    const absolutePath = this.resolvePath(filePath);

    const pathCheck = this.sandbox.validateFilePath(absolutePath);
    if (!pathCheck.valid) {
      return { success: false, path: filePath, error: pathCheck.reason };
    }

    try {
      await fs.remove(absolutePath);
      return { success: true, path: filePath };
    } catch (error) {
      return {
        success: false,
        path: filePath,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check if path exists
   */
  async exists(filePath: string): Promise<boolean> {
    const absolutePath = this.resolvePath(filePath);
    return fs.pathExists(absolutePath);
  }

  /**
   * List directory contents
   */
  async listDir(dirPath: string): Promise<string[]> {
    const absolutePath = this.resolvePath(dirPath);

    const pathCheck = this.sandbox.validateFilePath(absolutePath);
    if (!pathCheck.valid) {
      throw new Error(pathCheck.reason);
    }

    try {
      return await fs.readdir(absolutePath);
    } catch {
      return [];
    }
  }

  /**
   * Ensure directory exists
   */
  async ensureDir(dirPath: string): Promise<FileOperationResult> {
    const absolutePath = this.resolvePath(dirPath);

    const pathCheck = this.sandbox.validateFilePath(absolutePath);
    if (!pathCheck.valid) {
      return { success: false, path: dirPath, error: pathCheck.reason };
    }

    try {
      await fs.ensureDir(absolutePath);
      return { success: true, path: dirPath };
    } catch (error) {
      return {
        success: false,
        path: dirPath,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Execute batch operations
   */
  async batchExecute(operations: FileOperation[]): Promise<FileOperationResult[]> {
    const results: FileOperationResult[] = [];

    for (const op of operations) {
      let result: FileOperationResult;

      switch (op.action) {
        case 'create':
          result = await this.createFile(op.path, op.content || '');
          break;
        case 'read':
          result = await this.readFile(op.path);
          break;
        case 'update':
          result = await this.updateFile(op.path, op.content || '');
          break;
        case 'delete':
          result = await this.deleteFile(op.path);
          break;
        default:
          result = { success: false, path: op.path, error: 'Unknown action' };
      }

      results.push(result);
    }

    return results;
  }

  private resolvePath(filePath: string): string {
    if (path.isAbsolute(filePath)) {
      return filePath;
    }
    return path.join(this.baseDir, filePath);
  }
}
