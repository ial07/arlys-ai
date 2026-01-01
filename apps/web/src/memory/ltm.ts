/**
 * Long-Term Memory (LTM)
 * 
 * Persistent storage for architectural decisions, learned patterns, and project context.
 * Uses file-based JSON storage for simplicity (can be upgraded to SQLite later).
 */

import fs from 'fs-extra';
import path from 'path';
import { nanoid } from 'nanoid';

interface Decision {
  id: string;
  topic: string;
  decision: string;
  rationale: string;
  timestamp: Date;
}

interface Lesson {
  id: string;
  errorType: string;
  solution: string;
  frequency: number;
  lastOccurred: Date;
}

interface ProjectArchitecture {
  schemaDefinition?: string;
  routes: Array<{ path: string; method: string; handler: string }>;
  components: Array<{ name: string; path: string; type: string }>;
}

interface LTMData {
  projectId: string;
  createdAt: Date;
  updatedAt: Date;
  decisions: Decision[];
  lessons: Lesson[];
  architecture: ProjectArchitecture;
  metadata: Record<string, unknown>;
}

export class LongTermMemory {
  private storePath: string;
  private data: LTMData | null;
  private projectId: string;
  private dirty: boolean;
  private autoSaveInterval: NodeJS.Timeout | null;

  constructor(storagePath: string, projectId?: string) {
    this.storePath = storagePath;
    this.projectId = projectId || nanoid();
    this.data = null;
    this.dirty = false;
    this.autoSaveInterval = null;
  }

  /**
   * Initialize or load existing LTM data
   */
  async initialize(): Promise<void> {
    const filePath = this.getFilePath();

    if (await fs.pathExists(filePath)) {
      const raw = await fs.readJson(filePath);
      this.data = {
        ...raw,
        createdAt: new Date(raw.createdAt),
        updatedAt: new Date(raw.updatedAt),
        decisions: raw.decisions.map((d: Decision) => ({
          ...d,
          timestamp: new Date(d.timestamp),
        })),
        lessons: raw.lessons.map((l: Lesson) => ({
          ...l,
          lastOccurred: new Date(l.lastOccurred),
        })),
      };
    } else {
      this.data = {
        projectId: this.projectId,
        createdAt: new Date(),
        updatedAt: new Date(),
        decisions: [],
        lessons: [],
        architecture: { routes: [], components: [] },
        metadata: {},
      };
      await this.save();
    }

    this.startAutoSave();
  }

  /**
   * Record an architectural decision
   */
  addDecision(topic: string, decision: string, rationale: string): string {
    this.ensureInitialized();

    const id = nanoid();
    this.data!.decisions.push({
      id,
      topic,
      decision,
      rationale,
      timestamp: new Date(),
    });

    this.markDirty();
    return id;
  }

  /**
   * Get decisions by topic
   */
  getDecisions(topic?: string): Decision[] {
    this.ensureInitialized();

    if (!topic) return this.data!.decisions;

    return this.data!.decisions.filter((d) =>
      d.topic.toLowerCase().includes(topic.toLowerCase())
    );
  }

  /**
   * Record a learned solution for an error
   */
  addLesson(errorType: string, solution: string): string {
    this.ensureInitialized();

    // Check if similar lesson exists
    const existing = this.data!.lessons.find(
      (l) => l.errorType.toLowerCase() === errorType.toLowerCase()
    );

    if (existing) {
      existing.frequency++;
      existing.lastOccurred = new Date();
      existing.solution = solution; // Update with latest solution
      this.markDirty();
      return existing.id;
    }

    const id = nanoid();
    this.data!.lessons.push({
      id,
      errorType,
      solution,
      frequency: 1,
      lastOccurred: new Date(),
    });

    this.markDirty();
    return id;
  }

  /**
   * Find solution for an error type
   */
  findSolution(errorType: string): Lesson | null {
    this.ensureInitialized();

    // Simple fuzzy match
    const normalized = errorType.toLowerCase();
    return (
      this.data!.lessons.find((l) =>
        normalized.includes(l.errorType.toLowerCase()) ||
        l.errorType.toLowerCase().includes(normalized)
      ) || null
    );
  }

  /**
   * Get most frequent errors
   */
  getTopLessons(limit: number = 10): Lesson[] {
    this.ensureInitialized();

    return [...this.data!.lessons]
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, limit);
  }

  /**
   * Update architecture information
   */
  updateArchitecture(updates: Partial<ProjectArchitecture>): void {
    this.ensureInitialized();

    this.data!.architecture = {
      ...this.data!.architecture,
      ...updates,
    };

    this.markDirty();
  }

  /**
   * Get architecture
   */
  getArchitecture(): ProjectArchitecture {
    this.ensureInitialized();
    return this.data!.architecture;
  }

  /**
   * Store metadata
   */
  setMetadata(key: string, value: unknown): void {
    this.ensureInitialized();
    this.data!.metadata[key] = value;
    this.markDirty();
  }

  /**
   * Get metadata
   */
  getMetadata<T = unknown>(key: string): T | undefined {
    this.ensureInitialized();
    return this.data!.metadata[key] as T | undefined;
  }

  /**
   * Save to disk
   */
  async save(): Promise<void> {
    if (!this.data) return;

    this.data.updatedAt = new Date();
    await fs.ensureDir(this.storePath);
    await fs.writeJson(this.getFilePath(), this.data, { spaces: 2 });
    this.dirty = false;
  }

  /**
   * Get stats
   */
  getStats(): {
    decisions: number;
    lessons: number;
    routes: number;
    components: number;
  } {
    this.ensureInitialized();

    return {
      decisions: this.data!.decisions.length,
      lessons: this.data!.lessons.length,
      routes: this.data!.architecture.routes.length,
      components: this.data!.architecture.components.length,
    };
  }

  /**
   * Cleanup
   */
  async destroy(): Promise<void> {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }

    if (this.dirty) {
      await this.save();
    }
  }

  private getFilePath(): string {
    return path.join(this.storePath, `${this.projectId}.ltm.json`);
  }

  private ensureInitialized(): void {
    if (!this.data) {
      throw new Error('LTM not initialized. Call initialize() first.');
    }
  }

  private markDirty(): void {
    this.dirty = true;
  }

  private startAutoSave(): void {
    this.autoSaveInterval = setInterval(async () => {
      if (this.dirty) {
        await this.save();
      }
    }, 30000); // Auto-save every 30 seconds
  }
}
