/**
 * Orchestrator Agent
 * 
 * Central coordinator managing the workflow between all agents.
 * Controls the state machine and routes tasks appropriately.
 */

import { nanoid } from 'nanoid';
import { BaseAgent } from './base.agent.js';
import { StateMachine } from '../core/state-machine.js';
import { LongTermMemory } from '../memory/ltm.js';
import type { AgentContext, Session, WorkflowState } from '../types/agent.types.js';
import type { AgentMessage } from '../types/message.types.js';
import type { Task, TaskPlan } from '../types/task.types.js';
import path from 'path';

interface StartSessionPayload {
  goal: string;
  projectName?: string;
}

interface SessionStatusPayload {
  sessionId: string;
}

export class OrchestratorAgent extends BaseAgent {
  private stateMachine: StateMachine;
  private ltm: LongTermMemory;
  private currentSession: Session | null;
  private workflowState: WorkflowState | null;

  constructor(context: AgentContext) {
    super(
      {
        name: 'orchestrator',
        maxConcurrency: 1,
        retryAttempts: 3,
        timeoutMs: 300000, // 5 minutes
      },
      context
    );

    this.stateMachine = new StateMachine();
    this.ltm = new LongTermMemory(
      path.join(context.workingDirectory, '.agent', 'memory')
    );
    this.currentSession = null;
    this.workflowState = null;
  }

  protected async onInitialize(): Promise<void> {
    await this.ltm.initialize();

    // Set up state transition callbacks
    this.stateMachine.onTransition((from, to) => {
      this.log(`State transition: ${from} -> ${to}`);
      if (this.currentSession) {
        this.currentSession.status = to;
      }
    });
  }

  protected async onShutdown(): Promise<void> {
    await this.ltm.destroy();
  }

  protected registerHandlers(): void {
    this.handlers.set('start_session', {
      action: 'start_session',
      handler: this.handleStartSession.bind(this),
    });

    this.handlers.set('get_status', {
      action: 'get_status',
      handler: this.handleGetStatus.bind(this),
    });

    this.handlers.set('cancel_session', {
      action: 'cancel_session',
      handler: this.handleCancelSession.bind(this),
    });

    // Internal handlers for agent coordination
    this.handlers.set('plan_ready:response', {
      action: 'plan_ready:response',
      handler: this.handlePlanReady.bind(this),
    });

    this.handlers.set('task_complete:response', {
      action: 'task_complete:response',
      handler: this.handleTaskComplete.bind(this),
    });

    this.handlers.set('review_complete:response', {
      action: 'review_complete:response',
      handler: this.handleReviewComplete.bind(this),
    });
  }

  /**
   * Start a new session
   */
  private async handleStartSession(
    message: AgentMessage<StartSessionPayload>
  ): Promise<void> {
    const { goal, projectName } = message.payload;

    if (this.currentSession) {
      await this.respond(message, {
        success: false,
        error: 'A session is already in progress',
        currentSessionId: this.currentSession.id,
      });
      return;
    }

    // Create new session
    const sessionId = nanoid();
    this.currentSession = {
      id: sessionId,
      goal,
      status: 'initializing',
      startedAt: new Date(),
      completedAt: null,
      workingDirectory: this.context.workingDirectory,
    };

    // Initialize workflow state
    this.workflowState = {
      session: this.currentSession,
      currentPhase: 'initializing',
      currentTaskId: null,
      pendingTasks: [],
      completedTasks: [],
      failedTasks: [],
    };

    // Update context
    this.context.sessionId = sessionId;

    // Store session start
    this.storeContext('session', this.currentSession, sessionId);
    this.ltm.addDecision('session', `Started session: ${goal}`, `Project: ${projectName || 'unnamed'}`);

    this.log(`Session started: ${sessionId}`);
    this.log(`Goal: ${goal}`);

    // Transition to planning
    await this.stateMachine.transition('planning', 'start_session');

    // Request plan from Planner agent
    await this.send('planner', 'generate_plan', {
      goal,
      constraints: [],
    }, sessionId);

    await this.respond(message, {
      success: true,
      sessionId,
      status: 'planning',
    });
  }

  /**
   * Handle plan completion from Planner
   */
  private async handlePlanReady(
    message: AgentMessage<{ planId: string; epicCount: number; taskCount: number }>
  ): Promise<void> {
    const { planId, epicCount, taskCount } = message.payload;
    this.log(`Plan ready: ${planId} (${epicCount} epics, ${taskCount} tasks)`);

    // Transition to executing
    await this.stateMachine.transition('executing', 'plan_ready');

    // Record decision
    this.ltm.addDecision(
      'planning',
      `Created execution plan with ${epicCount} epics and ${taskCount} tasks`,
      `Plan ID: ${planId}`
    );

    // Start executing tasks
    await this.executeNextTask();
  }

  /**
   * Execute the next available task
   */
  private async executeNextTask(): Promise<void> {
    if (!this.currentSession) return;

    // Request next task from Planner
    const response = await this.request<object, { task: Task | null; completed?: boolean; reason?: string }>(
      'planner',
      'get_next_task',
      {},
      this.currentSession.id
    );

    const { task, completed, reason } = response.payload;

    if (!task) {
      if (completed) {
        // All tasks done
        await this.completeSession();
      } else {
        this.log(`No tasks available: ${reason}`, 'warn');
      }
      return;
    }

    // Update workflow state
    if (this.workflowState) {
      this.workflowState.currentTaskId = task.id;
    }

    this.log(`Executing task: ${task.id} - ${task.title}`);

    // Send task to Executor
    await this.send('executor', 'execute_task', {
      taskId: task.id,
      taskType: task.type,
      inputs: task.inputs,
    }, this.currentSession.id);
  }

  /**
   * Handle task completion from Executor
   */
  private async handleTaskComplete(
    message: AgentMessage<{ taskId: string; success: boolean; artifacts: Array<{ path: string; action: string }> }>
  ): Promise<void> {
    const { taskId, success, artifacts } = message.payload;
    this.log(`Task ${taskId} ${success ? 'completed' : 'failed'}`);

    if (!success) {
      // Update Planner about failure
      await this.send('planner', 'update_plan', {
        taskId,
        status: 'failed',
        error: 'Execution failed',
      }, this.currentSession?.id);

      // Check if should retry or fail
      if (this.workflowState) {
        this.workflowState.failedTasks.push(taskId);
      }

      // Continue with next task
      await this.executeNextTask();
      return;
    }

    // Transition to reviewing
    await this.stateMachine.transition('reviewing', 'task_complete');

    // Send artifacts for review
    await this.send('reviewer', 'review_artifact', {
      taskId,
      artifacts: artifacts.map((a) => ({ path: a.path, content: '' })), // Content would be loaded
    }, this.currentSession?.id);
  }

  /**
   * Handle review completion from Reviewer
   */
  private async handleReviewComplete(
    message: AgentMessage<{ taskId: string; approved: boolean; errors: Array<{ type: string; message: string }> }>
  ): Promise<void> {
    const { taskId, approved, errors } = message.payload;
    this.log(`Review for ${taskId}: ${approved ? 'APPROVED' : 'REJECTED'}`);

    // Transition back to executing
    await this.stateMachine.transition('executing', 'review_complete');

    if (approved) {
      // Update Planner about success
      await this.send('planner', 'update_plan', {
        taskId,
        status: 'done',
      }, this.currentSession?.id);

      // Track completed task
      if (this.workflowState) {
        this.workflowState.completedTasks.push(taskId);
        this.workflowState.currentTaskId = null;
      }

      // Record lesson learned (if any issues were found)
      if (errors.length > 0) {
        for (const error of errors) {
          this.ltm.addLesson(error.type, `Review warning: ${error.message}`);
        }
      }
    } else {
      // Send back to executor for fixes
      this.log(`Task ${taskId} needs fixes`, 'warn');
      // In a real implementation, would send specific fix instructions
    }

    // Continue with next task
    await this.executeNextTask();
  }

  /**
   * Get current session status
   */
  private async handleGetStatus(
    message: AgentMessage<SessionStatusPayload>
  ): Promise<void> {
    if (!this.currentSession) {
      await this.respond(message, {
        active: false,
        message: 'No active session',
      });
      return;
    }

    await this.respond(message, {
      active: true,
      session: this.currentSession,
      state: this.stateMachine.getState(),
      workflow: this.workflowState,
      metrics: this.getMetrics(),
    });
  }

  /**
   * Cancel current session
   */
  private async handleCancelSession(
    message: AgentMessage<{ reason?: string }>
  ): Promise<void> {
    if (!this.currentSession) {
      await this.respond(message, { success: false, error: 'No active session' });
      return;
    }

    const reason = message.payload.reason || 'User requested cancellation';
    this.log(`Cancelling session: ${reason}`, 'warn');

    await this.stateMachine.transition('cancelled', 'cancel_session');

    this.currentSession.completedAt = new Date();
    this.currentSession.status = 'cancelled';

    this.ltm.addDecision('session', 'Session cancelled', reason);

    await this.respond(message, { success: true, reason });

    // Cleanup
    this.currentSession = null;
    this.workflowState = null;
    this.stateMachine.reset();
  }

  /**
   * Complete the session successfully
   */
  private async completeSession(): Promise<void> {
    if (!this.currentSession) return;

    await this.stateMachine.transition('completed', 'all_tasks_done');

    this.currentSession.completedAt = new Date();
    this.currentSession.status = 'completed';

    const duration = this.currentSession.completedAt.getTime() - this.currentSession.startedAt.getTime();

    this.ltm.addDecision(
      'session',
      'Session completed successfully',
      `Duration: ${Math.round(duration / 1000)}s, Tasks: ${this.workflowState?.completedTasks.length || 0}`
    );

    this.log(`Session completed: ${this.currentSession.id}`);
    this.log(`Duration: ${Math.round(duration / 1000)}s`);
    this.log(`Tasks completed: ${this.workflowState?.completedTasks.length || 0}`);

    // Cleanup
    this.currentSession = null;
    this.workflowState = null;
    this.stateMachine.reset();
  }
}
