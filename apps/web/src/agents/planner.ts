/**
 * Planner Agent
 *
 * Responsible for converting high-level goals into structured, executable task plans.
 */

import { nanoid } from "nanoid";
import { BaseAgent } from "./base.agent.js";
import type { AgentContext } from "../types/agent.types.js";
import type {
  AgentMessage,
  GeneratePlanPayload,
  PlanReadyPayload,
} from "../types/message.types.js";
import type {
  Epic,
  Task,
  TaskPlan,
  TaskType,
  TaskPriority,
} from "../types/task.types.js";

interface TaskTemplate {
  type: TaskType;
  titlePattern: string;
  dependencies: string[];
  priority: TaskPriority;
}

// STATIC HTML MODE CONFIGURATION
// Tasks: index.html, style.css, and optionally main.js
const EPIC_TEMPLATES: Record<string, TaskTemplate[]> = {
  foundation: [
    {
      type: "page",
      titlePattern: "Create index.html",
      dependencies: [],
      priority: 1,
    },
    {
      type: "style",
      titlePattern: "Create style.css",
      dependencies: [],
      priority: 2,
    },
    {
      type: "javascript" as TaskType,
      titlePattern: "Create main.js (animations)",
      dependencies: [],
      priority: 3,
    },
  ],
  // ALL OTHER EPICS DISABLED FOR STATIC HTML MODE
};

export class PlannerAgent extends BaseAgent {
  constructor(context: AgentContext) {
    super(
      {
        name: "planner",
        maxConcurrency: 1,
        retryAttempts: 3,
        timeoutMs: 60000,
      },
      context
    );
  }

  protected registerHandlers(): void {
    this.handlers.set("generate_plan", {
      action: "generate_plan",
      handler: this.handleGeneratePlan.bind(this),
    });

    this.handlers.set("update_plan", {
      action: "update_plan",
      handler: this.handleUpdatePlan.bind(this),
    });

    this.handlers.set("get_next_task", {
      action: "get_next_task",
      handler: this.handleGetNextTask.bind(this),
    });
  }

  /**
   * Generate a plan from a goal description
   */
  private async handleGeneratePlan(
    message: AgentMessage<GeneratePlanPayload>
  ): Promise<void> {
    const { goal, constraints } = message.payload;
    this.log(`Generating plan for: ${goal.substring(0, 100)}...`);

    // Analyze goal to determine required epics
    const requiredEpics = this.analyzeGoal(goal);
    this.log(`Identified epics: ${requiredEpics.join(", ")}`);

    // Generate task plan
    const plan = this.createTaskPlan(goal, requiredEpics, constraints);

    // Store plan in memory
    this.storeContext("current_plan", plan);
    this.storeContext("task_queue", this.buildTaskQueue(plan));

    // Respond with plan summary
    const response: PlanReadyPayload = {
      planId: plan.projectId,
      epicCount: plan.epics.length,
      taskCount: plan.epics.reduce((sum, e) => sum + e.tasks.length, 0),
    };

    await this.respond(message, response);
    this.log(
      `Plan created: ${response.epicCount} epics, ${response.taskCount} tasks`
    );
  }

  /**
   * Update an existing plan
   */
  private async handleUpdatePlan(
    message: AgentMessage<{ taskId: string; status: string; error?: string }>
  ): Promise<void> {
    const { taskId, status, error } = message.payload;
    const plan = this.getContext<TaskPlan>("current_plan");

    if (!plan) {
      await this.respond(message, { success: false, error: "No active plan" });
      return;
    }

    // Find and update task
    for (const epic of plan.epics) {
      const task = epic.tasks.find((t) => t.id === taskId);
      if (task) {
        task.status = status as Task["status"];
        task.updatedAt = new Date();
        if (error) {
          task.errorLog.push(error);
          task.retryCount++;
        }
        break;
      }
    }

    // Update stored plan
    plan.updatedAt = new Date();
    this.storeContext("current_plan", plan);

    await this.respond(message, { success: true });
  }

  /**
   * Get the next task to execute
   */
  private async handleGetNextTask(message: AgentMessage): Promise<void> {
    const plan = this.getContext<TaskPlan>("current_plan");

    if (!plan) {
      await this.respond(message, { task: null, reason: "No active plan" });
      return;
    }

    // Find next executable task
    const nextTask = this.findNextTask(plan);

    if (!nextTask) {
      const allDone = this.areAllTasksDone(plan);
      await this.respond(message, {
        task: null,
        reason: allDone
          ? "All tasks completed"
          : "No tasks ready (dependencies pending)",
        completed: allDone,
      });
      return;
    }

    // Mark task as in progress
    nextTask.status = "doing";
    nextTask.updatedAt = new Date();
    this.storeContext("current_plan", plan);

    await this.respond(message, { task: nextTask });
  }

  /**
   * Analyze goal to determine required epics
   * STATIC HTML MODE: Always return only 'foundation' epic
   */
  private analyzeGoal(goal: string): string[] {
    // STATIC HTML MODE: Ignore all keywords
    // Only return 'foundation' which contains index.html and style.css
    return ["foundation"];
  }

  /**
   * Create task plan from epics
   */
  private createTaskPlan(
    goal: string,
    epicNames: string[],
    constraints?: string[]
  ): TaskPlan {
    const projectId = nanoid();
    const now = new Date();

    const epics: Epic[] = epicNames.map((epicName) => {
      const templates = EPIC_TEMPLATES[epicName] || [];
      const tasks: Task[] = templates.map((template, index) => ({
        id: `${epicName}-${index}-${nanoid(6)}`,
        epic: epicName,
        title: template.titlePattern,
        description: `Generated task for ${epicName}`,
        type: template.type,
        status: "todo",
        priority: template.priority,
        dependencies: template.dependencies,
        inputs: {},
        outputs: {},
        retryCount: 0,
        maxRetries: 3,
        errorLog: [],
        createdAt: now,
        updatedAt: now,
      }));

      return {
        id: `epic-${epicName}-${nanoid(6)}`,
        title: epicName.charAt(0).toUpperCase() + epicName.slice(1),
        description: `Epic for ${epicName} setup`,
        tasks,
        status: "todo",
        createdAt: now,
      };
    });

    return {
      projectId,
      goal,
      epics,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Build a flat task queue for execution
   */
  private buildTaskQueue(plan: TaskPlan): Task[] {
    const allTasks = plan.epics.flatMap((e) => e.tasks);

    // Sort by priority and dependencies
    return allTasks.sort((a, b) => {
      // First by priority
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      // Then by dependency count
      return a.dependencies.length - b.dependencies.length;
    });
  }

  /**
   * Find next task that can be executed
   */
  private findNextTask(plan: TaskPlan): Task | null {
    const allTasks = plan.epics.flatMap((e) => e.tasks);
    const completedTaskIds = new Set(
      allTasks.filter((t) => t.status === "done").map((t) => t.id)
    );

    // Find first todo task with all dependencies met
    for (const task of this.buildTaskQueue(plan)) {
      if (task.status !== "todo") continue;

      const depsCompleted = task.dependencies.every((dep) => {
        // Check if dependency is completed (by ID prefix match)
        return Array.from(completedTaskIds).some((id) => id.startsWith(dep));
      });

      if (depsCompleted) {
        return task;
      }
    }

    return null;
  }

  /**
   * Check if all tasks are done
   */
  private areAllTasksDone(plan: TaskPlan): boolean {
    return plan.epics.every((epic) =>
      epic.tasks.every((task) => task.status === "done")
    );
  }
}
