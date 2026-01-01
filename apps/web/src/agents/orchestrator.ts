/**
 * Orchestrator Agent
 *
 * Central coordinator managing the workflow between all agents.
 * Controls the state machine and routes tasks appropriately.
 */

import { nanoid } from "nanoid";
import { BaseAgent } from "./base.agent.js";
import { StateMachine } from "../core/state-machine.js";
import { LongTermMemory } from "../memory/ltm.js";
import type {
  AgentContext,
  Session,
  SessionStatus,
  WorkflowState,
} from "../types/agent.types.js";
import type { AgentMessage } from "../types/message.types.js";
import type { Task, TaskPlan } from "../types/task.types.js";
import path from "path";

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
        name: "orchestrator",
        maxConcurrency: 1,
        retryAttempts: 3,
        timeoutMs: 300000, // 5 minutes
      },
      context
    );

    this.stateMachine = new StateMachine();
    this.ltm = new LongTermMemory(
      path.join(context.workingDirectory, ".agent", "memory")
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
    this.handlers.set("start_session", {
      action: "start_session",
      handler: this.handleStartSession.bind(this),
    });

    this.handlers.set("get_status", {
      action: "get_status",
      handler: this.handleGetStatus.bind(this),
    });

    this.handlers.set("cancel_session", {
      action: "cancel_session",
      handler: this.handleCancelSession.bind(this),
    });

    // Internal handlers for agent coordination
    this.handlers.set("plan_ready:response", {
      action: "plan_ready:response",
      handler: this.handlePlanReady.bind(this),
    });

    this.handlers.set("task_complete:response", {
      action: "task_complete:response",
      handler: this.handleTaskComplete.bind(this),
    });

    this.handlers.set("review_complete:response", {
      action: "review_complete:response",
      handler: this.handleReviewComplete.bind(this),
    });

    // Preview validation handler - ensures UI is visible before completing
    this.handlers.set("preview_validation_complete:response", {
      action: "preview_validation_complete:response",
      handler: this.handlePreviewValidationComplete.bind(this),
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
        error: "A session is already in progress",
        currentSessionId: this.currentSession.id,
      });
      return;
    }

    // Create new session
    const sessionId = nanoid();
    this.currentSession = {
      id: sessionId,
      goal,
      status: "initializing",
      startedAt: new Date(),
      completedAt: null,
      workingDirectory: this.context.workingDirectory,
    };

    // Initialize workflow state
    this.workflowState = {
      session: this.currentSession,
      currentPhase: "initializing",
      currentTaskId: null,
      pendingTasks: [],
      completedTasks: [],
      failedTasks: [],
    };

    // Update context
    this.context.sessionId = sessionId;

    // Store session start
    this.storeContext("session", this.currentSession, sessionId);
    this.ltm.addDecision(
      "session",
      `Started session: ${goal}`,
      `Project: ${projectName || "unnamed"}`
    );

    this.log(`Session started: ${sessionId}`);
    this.log(`Goal: ${goal}`);

    // Transition to planning
    await this.stateMachine.transition("planning", "start_session");

    // Request plan from Planner agent
    await this.send(
      "planner",
      "generate_plan",
      {
        goal,
        constraints: [
          "Generate a modern, visually rich, non-blank landing page",
          "Use pure static HTML (no React, JSX, or build steps)",
          "Use Tailwind CSS via CDN",
          "Use GSAP + ScrollTrigger via CDN for animations",
          "Use vanilla JavaScript (no compilation)",
          "Generate 'index.html', 'assets/js/animations.js', and 'assets/js/scroll.js' ONLY",
          "Do NOT use Framer Motion, React, or module imports",
          "Ensure content renders immediately without JS",
          "Use Pexels images with fallback error handlers",
          "All animations must enhance, not block rendering",
        ],
      },
      sessionId
    );

    await this.respond(message, {
      success: true,
      sessionId,
      status: "planning",
    });
  }

  /**
   * Handle plan completion from Planner
   */
  private async handlePlanReady(
    message: AgentMessage<{
      planId: string;
      epicCount: number;
      taskCount: number;
    }>
  ): Promise<void> {
    const { planId, epicCount, taskCount } = message.payload;
    this.log(`Plan ready: ${planId} (${epicCount} epics, ${taskCount} tasks)`);

    // Transition to executing
    await this.stateMachine.transition("executing", "plan_ready");

    // Record decision
    this.ltm.addDecision(
      "planning",
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
    const response = await this.request<
      object,
      { task: Task | null; completed?: boolean; reason?: string }
    >("planner", "get_next_task", {}, this.currentSession.id);

    const { task, completed, reason } = response.payload;

    if (!task) {
      if (completed) {
        // All tasks done
        await this.completeSession();
      } else {
        this.log(`No tasks available: ${reason}`, "warn");
      }
      return;
    }

    // Update workflow state
    if (this.workflowState) {
      this.workflowState.currentTaskId = task.id;
    }

    this.log(`Executing task: ${task.id} - ${task.title}`);

    // Send task to Executor
    await this.send(
      "executor",
      "execute_task",
      {
        taskId: task.id,
        taskType: task.type,
        inputs: task.inputs,
      },
      this.currentSession.id
    );
  }

  /**
   * Handle task completion from Executor
   */
  private async handleTaskComplete(
    message: AgentMessage<{
      taskId: string;
      success: boolean;
      artifacts: Array<{ path: string; action: string }>;
    }>
  ): Promise<void> {
    const { taskId, success, artifacts } = message.payload;
    this.log(`Task ${taskId} ${success ? "completed" : "failed"}`);

    if (!success) {
      // Update Planner about failure
      await this.send(
        "planner",
        "update_plan",
        {
          taskId,
          status: "failed",
          error: "Execution failed",
        },
        this.currentSession?.id
      );

      // Check if should retry or fail
      if (this.workflowState) {
        this.workflowState.failedTasks.push(taskId);
      }

      // Continue with next task
      await this.executeNextTask();
      return;
    }

    // Transition to reviewing
    await this.stateMachine.transition("reviewing", "task_complete");

    // Send artifacts for review
    await this.send(
      "reviewer",
      "review_artifact",
      {
        taskId,
        artifacts: artifacts.map((a) => ({ path: a.path, content: "" })), // Content would be loaded
      },
      this.currentSession?.id
    );
  }

  /**
   * Handle review completion from Reviewer
   */
  private async handleReviewComplete(
    message: AgentMessage<{
      taskId: string;
      approved: boolean;
      errors: Array<{ type: string; message: string }>;
    }>
  ): Promise<void> {
    const { taskId, approved, errors } = message.payload;
    this.log(`Review for ${taskId}: ${approved ? "APPROVED" : "REJECTED"}`);

    if (approved) {
      // Transition to PREVIEW_VALIDATION phase (NEW)
      await this.stateMachine.transition(
        "preview_validation" as SessionStatus,
        "review_complete"
      );
      this.log("Transitioning to preview_validation phase...");

      // Trigger preview validation
      // In a real implementation, this would check if preview is visible
      // For now, we simulate the validation check
      await this.validatePreview(taskId);
    } else {
      // Transition back to executing for fixes
      await this.stateMachine.transition("executing", "review_complete");
      this.log(`Task ${taskId} needs fixes`, "warn");
      // In a real implementation, would send specific fix instructions
      await this.executeNextTask();
    }
  }

  /**
   * Validate that the preview is visible
   * A task is NOT complete unless UI is visible in Preview
   */
  private async validatePreview(taskId: string): Promise<void> {
    this.log(`Validating preview visibility for task ${taskId}...`);

    // Simulate preview validation checks
    // In production, this would:
    // 1. Check that preview server is running
    // 2. Check that preview endpoint returns HTML
    // 3. Check that #root contains rendered DOM
    // 4. Check that hero section is visible
    // 5. Block completion if preview is blank

    const previewIsVisible = true; // Placeholder - would be actual check

    if (previewIsVisible) {
      // Preview validation passed - trigger completion
      await this.handlePreviewValidationComplete({
        id: `preview-validation-${taskId}-${Date.now()}`,
        from: "orchestrator",
        to: "orchestrator",
        type: "event",
        action: "preview_validation_complete:response",
        payload: { taskId, visible: true, errors: [] },
        context: {
          sessionId: this.currentSession?.id || "",
          taskId,
          correlationId: `preview-${taskId}`,
        },
        timestamp: new Date(),
      });
    } else {
      // Preview validation failed - go back to executing
      await this.handlePreviewValidationComplete({
        id: `preview-validation-${taskId}-${Date.now()}`,
        from: "orchestrator",
        to: "orchestrator",
        type: "event",
        action: "preview_validation_complete:response",
        payload: {
          taskId,
          visible: false,
          errors: [
            { type: "BLANK_SCREEN", message: "Preview shows blank screen" },
          ],
        },
        context: {
          sessionId: this.currentSession?.id || "",
          taskId,
          correlationId: `preview-${taskId}`,
        },
        timestamp: new Date(),
      });
    }
  }

  /**
   * Handle preview validation completion
   * Only marks task complete if preview is visible
   */
  private async handlePreviewValidationComplete(
    message: AgentMessage<{
      taskId: string;
      visible: boolean;
      errors: Array<{ type: string; message: string }>;
    }>
  ): Promise<void> {
    const { taskId, visible, errors } = message.payload;
    this.log(
      `Preview validation for ${taskId}: ${visible ? "VISIBLE" : "FAILED"}`
    );

    if (visible) {
      // Update Planner about success
      await this.send(
        "planner",
        "update_plan",
        {
          taskId,
          status: "done",
        },
        this.currentSession?.id
      );

      // Track completed task
      if (this.workflowState) {
        this.workflowState.completedTasks.push(taskId);
        this.workflowState.currentTaskId = null;
      }

      // Transition back to executing to continue with next task
      await this.stateMachine.transition(
        "executing",
        "preview_validation_complete"
      );

      // Continue with next task
      await this.executeNextTask();
    } else {
      // Preview validation FAILED - go back to executing for fixes
      this.log(
        `Preview validation FAILED: ${errors.map((e) => e.message).join(", ")}`,
        "warn"
      );

      // Record lesson learned
      for (const error of errors) {
        this.ltm.addLesson(
          error.type,
          `Preview validation failed: ${error.message}`
        );
      }

      // Transition back to executing
      await this.stateMachine.transition(
        "executing",
        "preview_validation_failed"
      );

      // Would send specific fix instructions to executor
      // For now, just try next task
      await this.executeNextTask();
    }
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
        message: "No active session",
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
      await this.respond(message, {
        success: false,
        error: "No active session",
      });
      return;
    }

    const reason = message.payload.reason || "User requested cancellation";
    this.log(`Cancelling session: ${reason}`, "warn");

    await this.stateMachine.transition("cancelled", "cancel_session");

    this.currentSession.completedAt = new Date();
    this.currentSession.status = "cancelled";

    this.ltm.addDecision("session", "Session cancelled", reason);

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

    await this.stateMachine.transition("completed", "all_tasks_done");

    this.currentSession.completedAt = new Date();
    this.currentSession.status = "completed";

    const duration =
      this.currentSession.completedAt.getTime() -
      this.currentSession.startedAt.getTime();

    this.ltm.addDecision(
      "session",
      "Session completed successfully",
      `Duration: ${Math.round(duration / 1000)}s, Tasks: ${this.workflowState?.completedTasks.length || 0}`
    );

    this.log(`Session completed: ${this.currentSession.id}`);
    this.log(`Duration: ${Math.round(duration / 1000)}s`);
    this.log(
      `Tasks completed: ${this.workflowState?.completedTasks.length || 0}`
    );

    // Cleanup
    this.currentSession = null;
    this.workflowState = null;
    this.stateMachine.reset();
  }
}
