/**
 * Pattern Store
 * 
 * Storage for reusable code patterns with search capability.
 * MVP uses simple text matching; can be upgraded to vector search later.
 */

import fs from 'fs-extra';
import path from 'path';
import { nanoid } from 'nanoid';

export type PatternCategory = 
  | 'auth'
  | 'crud'
  | 'pagination'
  | 'search'
  | 'validation'
  | 'error-handling'
  | 'api'
  | 'component'
  | 'hook'
  | 'utility';

interface Pattern {
  id: string;
  name: string;
  category: PatternCategory;
  description: string;
  tags: string[];
  code: string;
  language: string;
  usageCount: number;
  successRate: number;
  createdAt: Date;
  lastUsed: Date | null;
}

interface PatternStoreData {
  version: string;
  patterns: Pattern[];
}

export class PatternStore {
  private storePath: string;
  private data: PatternStoreData | null;

  constructor(storagePath: string) {
    this.storePath = storagePath;
    this.data = null;
  }

  /**
   * Initialize or load pattern store
   */
  async initialize(): Promise<void> {
    const filePath = this.getFilePath();

    if (await fs.pathExists(filePath)) {
      const raw = await fs.readJson(filePath);
      this.data = {
        ...raw,
        patterns: raw.patterns.map((p: Pattern) => ({
          ...p,
          createdAt: new Date(p.createdAt),
          lastUsed: p.lastUsed ? new Date(p.lastUsed) : null,
        })),
      };
    } else {
      this.data = {
        version: '1.0.0',
        patterns: [],
      };
      await this.loadDefaultPatterns();
      await this.save();
    }
  }

  /**
   * Add a new pattern
   */
  async addPattern(
    name: string,
    category: PatternCategory,
    description: string,
    code: string,
    options?: {
      tags?: string[];
      language?: string;
    }
  ): Promise<string> {
    this.ensureInitialized();

    const id = nanoid();
    const pattern: Pattern = {
      id,
      name,
      category,
      description,
      tags: options?.tags || [],
      code,
      language: options?.language || 'typescript',
      usageCount: 0,
      successRate: 1.0,
      createdAt: new Date(),
      lastUsed: null,
    };

    this.data!.patterns.push(pattern);
    await this.save();

    return id;
  }

  /**
   * Search patterns by query
   */
  search(query: string, category?: PatternCategory): Pattern[] {
    this.ensureInitialized();

    const normalizedQuery = query.toLowerCase();
    const words = normalizedQuery.split(/\s+/);

    return this.data!.patterns
      .filter((p) => {
        // Filter by category if specified
        if (category && p.category !== category) return false;

        // Match against name, description, and tags
        const searchText = [
          p.name,
          p.description,
          ...p.tags,
          p.category,
        ].join(' ').toLowerCase();

        return words.every((word) => searchText.includes(word));
      })
      .sort((a, b) => {
        // Sort by success rate and usage
        const scoreA = a.successRate * Math.log(a.usageCount + 1);
        const scoreB = b.successRate * Math.log(b.usageCount + 1);
        return scoreB - scoreA;
      });
  }

  /**
   * Get pattern by ID
   */
  getById(id: string): Pattern | null {
    this.ensureInitialized();
    return this.data!.patterns.find((p) => p.id === id) || null;
  }

  /**
   * Get patterns by category
   */
  getByCategory(category: PatternCategory): Pattern[] {
    this.ensureInitialized();
    return this.data!.patterns.filter((p) => p.category === category);
  }

  /**
   * Record pattern usage
   */
  async recordUsage(id: string, success: boolean): Promise<void> {
    this.ensureInitialized();

    const pattern = this.data!.patterns.find((p) => p.id === id);
    if (!pattern) return;

    pattern.usageCount++;
    pattern.lastUsed = new Date();

    // Update success rate (exponential moving average)
    const alpha = 0.3;
    pattern.successRate = alpha * (success ? 1 : 0) + (1 - alpha) * pattern.successRate;

    await this.save();
  }

  /**
   * Get most used patterns
   */
  getPopular(limit: number = 10): Pattern[] {
    this.ensureInitialized();

    return [...this.data!.patterns]
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, limit);
  }

  /**
   * Save to disk
   */
  async save(): Promise<void> {
    if (!this.data) return;

    await fs.ensureDir(this.storePath);
    await fs.writeJson(this.getFilePath(), this.data, { spaces: 2 });
  }

  /**
   * Load default patterns
   */
  private async loadDefaultPatterns(): Promise<void> {
    const defaults: Array<Omit<Pattern, 'id' | 'usageCount' | 'successRate' | 'createdAt' | 'lastUsed'>> = [
      {
        name: 'API Route Handler',
        category: 'api',
        description: 'Next.js API route with error handling',
        tags: ['nextjs', 'api', 'route'],
        language: 'typescript',
        code: `import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Handler logic
    return NextResponse.json({ data: [] });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}`,
      },
      {
        name: 'Prisma CRUD Service',
        category: 'crud',
        description: 'Basic CRUD operations with Prisma',
        tags: ['prisma', 'database', 'service'],
        language: 'typescript',
        code: `import { prisma } from '@/lib/prisma';

export const entityService = {
  async findAll() {
    return prisma.entity.findMany();
  },

  async findById(id: string) {
    return prisma.entity.findUnique({ where: { id } });
  },

  async create(data: CreateEntityInput) {
    return prisma.entity.create({ data });
  },

  async update(id: string, data: UpdateEntityInput) {
    return prisma.entity.update({ where: { id }, data });
  },

  async delete(id: string) {
    return prisma.entity.delete({ where: { id } });
  },
};`,
      },
      {
        name: 'React Hook Form',
        category: 'hook',
        description: 'Custom form hook with validation',
        tags: ['react', 'hook', 'form', 'validation'],
        language: 'typescript',
        code: `import { useState, useCallback } from 'react';

interface UseFormOptions<T> {
  initialValues: T;
  validate?: (values: T) => Partial<Record<keyof T, string>>;
  onSubmit: (values: T) => Promise<void>;
}

export function useForm<T extends Record<string, unknown>>({
  initialValues,
  validate,
  onSubmit,
}: UseFormOptions<T>) {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = useCallback((name: keyof T, value: unknown) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (validate) {
      const validationErrors = validate(values);
      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await onSubmit(values);
    } finally {
      setIsSubmitting(false);
    }
  }, [values, validate, onSubmit]);

  return { values, errors, isSubmitting, handleChange, handleSubmit };
}`,
      },
    ];

    for (const pattern of defaults) {
      await this.addPattern(
        pattern.name,
        pattern.category,
        pattern.description,
        pattern.code,
        { tags: pattern.tags, language: pattern.language }
      );
    }
  }

  private getFilePath(): string {
    return path.join(this.storePath, 'patterns.json');
  }

  private ensureInitialized(): void {
    if (!this.data) {
      throw new Error('PatternStore not initialized. Call initialize() first.');
    }
  }
}
