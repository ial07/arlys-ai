/**
 * Agent Types for AI Agent Builder
 */

import type { AgentMessage, AgentName } from "./message.types.js";

export type AgentState = "idle" | "busy" | "waiting" | "error";

export interface AgentConfig {
  name: AgentName;
  maxConcurrency: number;
  retryAttempts: number;
  timeoutMs: number;
}

export interface AgentMetrics {
  tasksProcessed: number;
  tasksSucceeded: number;
  tasksFailed: number;
  averageProcessingTime: number;
  lastActivity: Date | null;
}

export interface AgentContext {
  sessionId: string;
  workingDirectory: string;
  environment: Record<string, string>;
}

export interface MessageHandler {
  action: string;
  handler: (message: AgentMessage<any>) => Promise<void>;
}

export interface AgentCapabilities {
  canPlan: boolean;
  canExecute: boolean;
  canReview: boolean;
  canLearn: boolean;
}

// Session types
export interface Session {
  id: string;
  goal: string;
  status: SessionStatus;
  startedAt: Date;
  completedAt: Date | null;
  workingDirectory: string;
}

export type SessionStatus =
  | "initializing"
  | "planning"
  | "executing"
  | "reviewing"
  | "preview_validation"
  | "completed"
  | "failed"
  | "cancelled";

// Orchestrator specific
export interface WorkflowState {
  session: Session;
  currentPhase: SessionStatus;
  currentTaskId: string | null;
  pendingTasks: string[];
  completedTasks: string[];
  failedTasks: string[];
}
