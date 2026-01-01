/**
 * Task Types for AI Agent Builder
 */

export type TaskStatus = "todo" | "doing" | "done" | "failed" | "blocked";
export type TaskType =
  | "schema"
  | "api"
  | "component"
  | "page"
  | "test"
  | "config"
  | "setup"
  | "style";
export type TaskPriority = 1 | 2 | 3 | 4 | 5;

export interface Task {
  id: string;
  epic: string;
  title: string;
  description: string;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  dependencies: string[];
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  retryCount: number;
  maxRetries: number;
  errorLog: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Epic {
  id: string;
  title: string;
  description: string;
  tasks: Task[];
  status: TaskStatus;
  createdAt: Date;
}

export interface TaskPlan {
  projectId: string;
  goal: string;
  epics: Epic[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskResult {
  taskId: string;
  success: boolean;
  artifacts: Artifact[];
  errors: TaskError[];
  duration: number;
}

export interface TaskError {
  code: string;
  message: string;
  file?: string;
  line?: number;
  column?: number;
  severity: "error" | "warning" | "info";
}

export interface Artifact {
  type: "file" | "config" | "migration";
  path: string;
  content: string;
  action: "create" | "modify" | "delete";
}
