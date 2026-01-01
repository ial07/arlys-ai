/**
 * Message Types for Inter-Agent Communication
 */

export type MessageType = 'request' | 'response' | 'event' | 'error';

export type AgentName = 'orchestrator' | 'planner' | 'executor' | 'reviewer';

export interface MessageContext {
  sessionId: string;
  taskId?: string;
  correlationId: string;
}

export interface AgentMessage<T = unknown> {
  id: string;
  from: AgentName;
  to: AgentName;
  type: MessageType;
  action: string;
  payload: T;
  context: MessageContext;
  timestamp: Date;
}

// Specific message payloads

export interface GeneratePlanPayload {
  goal: string;
  constraints?: string[];
}

export interface PlanReadyPayload {
  planId: string;
  epicCount: number;
  taskCount: number;
}

export interface ExecuteTaskPayload {
  taskId: string;
  taskType: string;
  inputs: Record<string, unknown>;
}

export interface TaskCompletePayload {
  taskId: string;
  success: boolean;
  artifacts: Array<{
    path: string;
    action: string;
  }>;
}

export interface ReviewArtifactPayload {
  taskId: string;
  artifacts: Array<{
    path: string;
    content: string;
  }>;
}

export interface ReviewResultPayload {
  taskId: string;
  approved: boolean;
  errors: Array<{
    type: string;
    message: string;
    file?: string;
    line?: number;
  }>;
  suggestions: string[];
}

export interface ErrorPayload {
  code: string;
  message: string;
  recoverable: boolean;
  details?: Record<string, unknown>;
}
