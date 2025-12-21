/**
 * Short-Term Memory (STM)
 * 
 * Per-task context storage during active execution.
 * Automatically expires entries after TTL.
 */

import { nanoid } from 'nanoid';

interface STMEntry<T = unknown> {
  id: string;
  taskId: string;
  key: string;
  value: T;
  createdAt: Date;
  expiresAt: Date;
}

interface STMConfig {
  defaultTTL: number; // milliseconds
  maxEntries: number;
  cleanupInterval: number; // milliseconds
}

const DEFAULT_CONFIG: STMConfig = {
  defaultTTL: 5 * 60 * 1000, // 5 minutes
  maxEntries: 10000,
  cleanupInterval: 30 * 1000, // 30 seconds
};

export class ShortTermMemory {
  private store: Map<string, STMEntry>;
  private taskIndex: Map<string, Set<string>>; // taskId -> entryIds
  private config: STMConfig;
  private cleanupTimer: NodeJS.Timeout | null;

  constructor(config?: Partial<STMConfig>) {
    this.store = new Map();
    this.taskIndex = new Map();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cleanupTimer = null;
    this.startCleanup();
  }

  /**
   * Store a value in STM
   */
  set<T>(taskId: string, key: string, value: T, ttl?: number): string {
    const entryId = nanoid();
    const now = new Date();
    const effectiveTTL = ttl || this.config.defaultTTL;

    const entry: STMEntry<T> = {
      id: entryId,
      taskId,
      key,
      value,
      createdAt: now,
      expiresAt: new Date(now.getTime() + effectiveTTL),
    };

    // Store entry
    const storeKey = this.getStoreKey(taskId, key);
    this.store.set(storeKey, entry);

    // Update task index
    if (!this.taskIndex.has(taskId)) {
      this.taskIndex.set(taskId, new Set());
    }
    this.taskIndex.get(taskId)!.add(storeKey);

    // Enforce max entries
    this.enforceLimit();

    return entryId;
  }

  /**
   * Get a value from STM
   */
  get<T>(taskId: string, key: string): T | null {
    const storeKey = this.getStoreKey(taskId, key);
    const entry = this.store.get(storeKey) as STMEntry<T> | undefined;

    if (!entry) return null;

    // Check expiration
    if (new Date() > entry.expiresAt) {
      this.delete(taskId, key);
      return null;
    }

    return entry.value;
  }

  /**
   * Check if key exists
   */
  has(taskId: string, key: string): boolean {
    return this.get(taskId, key) !== null;
  }

  /**
   * Delete a specific entry
   */
  delete(taskId: string, key: string): boolean {
    const storeKey = this.getStoreKey(taskId, key);
    const deleted = this.store.delete(storeKey);

    if (deleted) {
      const taskKeys = this.taskIndex.get(taskId);
      if (taskKeys) {
        taskKeys.delete(storeKey);
        if (taskKeys.size === 0) {
          this.taskIndex.delete(taskId);
        }
      }
    }

    return deleted;
  }

  /**
   * Get all entries for a task
   */
  getTaskContext<T = unknown>(taskId: string): Record<string, T> {
    const taskKeys = this.taskIndex.get(taskId);
    if (!taskKeys) return {};

    const context: Record<string, T> = {};
    const now = new Date();

    for (const storeKey of taskKeys) {
      const entry = this.store.get(storeKey) as STMEntry<T>;
      if (entry && now <= entry.expiresAt) {
        context[entry.key] = entry.value;
      }
    }

    return context;
  }

  /**
   * Clear all entries for a task
   */
  clearTask(taskId: string): number {
    const taskKeys = this.taskIndex.get(taskId);
    if (!taskKeys) return 0;

    let count = 0;
    for (const storeKey of taskKeys) {
      if (this.store.delete(storeKey)) {
        count++;
      }
    }

    this.taskIndex.delete(taskId);
    return count;
  }

  /**
   * Extend TTL for an entry
   */
  touch(taskId: string, key: string, ttl?: number): boolean {
    const storeKey = this.getStoreKey(taskId, key);
    const entry = this.store.get(storeKey);

    if (!entry) return false;

    const effectiveTTL = ttl || this.config.defaultTTL;
    entry.expiresAt = new Date(Date.now() + effectiveTTL);
    return true;
  }

  /**
   * Get memory stats
   */
  getStats(): {
    totalEntries: number;
    totalTasks: number;
    oldestEntry: Date | null;
  } {
    let oldestEntry: Date | null = null;

    for (const entry of this.store.values()) {
      if (!oldestEntry || entry.createdAt < oldestEntry) {
        oldestEntry = entry.createdAt;
      }
    }

    return {
      totalEntries: this.store.size,
      totalTasks: this.taskIndex.size,
      oldestEntry,
    };
  }

  /**
   * Clear all memory
   */
  clear(): void {
    this.store.clear();
    this.taskIndex.clear();
  }

  /**
   * Stop cleanup timer
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  private getStoreKey(taskId: string, key: string): string {
    return `${taskId}:${key}`;
  }

  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired();
    }, this.config.cleanupInterval);
  }

  private cleanupExpired(): void {
    const now = new Date();
    const toDelete: Array<{ taskId: string; key: string }> = [];

    for (const entry of this.store.values()) {
      if (now > entry.expiresAt) {
        toDelete.push({ taskId: entry.taskId, key: entry.key });
      }
    }

    for (const { taskId, key } of toDelete) {
      this.delete(taskId, key);
    }
  }

  private enforceLimit(): void {
    if (this.store.size <= this.config.maxEntries) return;

    // Remove oldest entries
    const entries = Array.from(this.store.values())
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    const toRemove = this.store.size - this.config.maxEntries;
    for (let i = 0; i < toRemove; i++) {
      this.delete(entries[i].taskId, entries[i].key);
    }
  }
}

// Singleton instance
let stmInstance: ShortTermMemory | null = null;

export function getSTM(): ShortTermMemory {
  if (!stmInstance) {
    stmInstance = new ShortTermMemory();
  }
  return stmInstance;
}

export function resetSTM(): void {
  if (stmInstance) {
    stmInstance.destroy();
    stmInstance = null;
  }
}
