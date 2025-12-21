import prisma from '@/lib/prisma';
import { generatePlan, generateCode } from '@/llm/openai';

/**
 * Agent Service
 * Handles core agent logic: Planning, Task Creation, and Execution
 */

export const agentService = {
  generatePlanAndTasks,
  createDefaultTasks,
  executeNextTask,
  addTasksAndExecute,
};

// Add new tasks and start execution
async function addTasksAndExecute(sessionId: string, tasks: any[]) {
  try {
    // Get current max priority to append new tasks
    const lastTask = await prisma.task.findFirst({
      where: { sessionId },
      orderBy: { priority: 'desc' },
    });
    const startPriority = (lastTask?.priority || 0) + 1;

    // Create tasks
    const taskData = tasks.map((task, index) => ({
      sessionId,
      epic: task.epic || 'modification',
      title: task.title,
      description: task.description,
      type: task.type || 'component',
      priority: startPriority + index,
      dependencies: [],
    }));

    await prisma.task.createMany({
      data: taskData,
    });

    // Update session status and counts
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        status: 'executing',
        totalTasks: { increment: tasks.length },
        failedTasks: 0, // Reset failures if any
      },
    });

    // Start execution
    executeNextTask(sessionId, 'Modification request');
  } catch (error) {
    console.error('addTasksAndExecute error:', error);
  }
}

// Background function to generate plan and create tasks
async function generatePlanAndTasks(sessionId: string, goal: string) {
  try {
    // Generate plan using OpenAI
    let tasks = await generatePlan({ goal });

    // Ensure foundation tasks exist (Runnable Project Requirement)
    const requiredFiles = ['package.json', 'README.md', '.env.example'];
    const lowerTasks = tasks.map(t => t.title.toLowerCase());
    
    const missingRequirements = requiredFiles.filter(req => 
      !lowerTasks.some(t => t.includes(req))
    );

    // Inject missing requirements as high priority tasks
    if (missingRequirements.length > 0) {
      const setupTasks = missingRequirements.map((req, idx) => ({
        epic: 'foundation',
        title: `Create ${req}`,
        description: `Generate a valid ${req} for the project. Ensure it allows running the app with 'npm install' and 'npm run dev'.`,
        type: 'setup',
        priority: 0, // Top priority
        dependencies: []
      }));
      tasks = [...setupTasks, ...tasks];
    }

    if (tasks.length === 0) {
      await createDefaultTasks(sessionId);
      return;
    }

    // Create tasks in database
    const taskData = tasks.map((task, index) => ({
      sessionId,
      epic: task.epic || 'general',
      title: task.title,
      description: task.description,
      type: task.type || 'setup',
      priority: task.priority || index + 1,
      dependencies: task.dependencies || [],
    }));

    await prisma.task.createMany({
      data: taskData,
    });

    // Update session
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        status: 'executing',
        totalTasks: tasks.length,
      },
    });

    // Start executing tasks
    await executeNextTask(sessionId, goal);
  } catch (error) {
    console.error('generatePlanAndTasks error:', error);
    await prisma.session.update({
      where: { id: sessionId },
      data: { status: 'failed' },
    });
  }
}

async function createDefaultTasks(sessionId: string) {
  const defaultTasks = [
    { epic: 'foundation', title: 'Create package.json', type: 'setup', priority: 1, description: 'Initialize project dependencies' },
    { epic: 'database', title: 'Define Prisma schema', type: 'schema', priority: 2, description: 'Database models' },
    { epic: 'api', title: 'Create API route', type: 'api', priority: 3, description: 'Example API endpoint' },
    { epic: 'ui', title: 'Create main page', type: 'page', priority: 4, description: 'Frontend landing page' },
  ];

  await prisma.task.createMany({
    data: defaultTasks.map((task) => ({
      sessionId,
      ...task,
      dependencies: [],
    })),
  });

  await prisma.session.update({
    where: { id: sessionId },
    data: {
      status: 'executing',
      totalTasks: defaultTasks.length,
    },
  });

  await executeNextTask(sessionId, 'Build a default web application');
}

async function executeNextTask(sessionId: string, goal: string) {
  // Find next task to execute
  const nextTask = await prisma.task.findFirst({
    where: {
      sessionId,
      status: 'todo',
    },
    orderBy: { priority: 'asc' },
  });

  if (!nextTask) {
    // All tasks done
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        status: 'completed',
        completedAt: new Date(),
      },
    });
    return;
  }

  // Mark task as in progress
  await prisma.task.update({
    where: { id: nextTask.id },
    data: {
      status: 'doing',
      startedAt: new Date(),
    },
  });

  try {
    // Generate code using LLM
    // 1. Generate code content
    const generation = await generateCode({
      taskType: nextTask.type,
      taskDescription: nextTask.description || nextTask.title,
      context: {
        projectStructure: [], // We could fetch existing files here
      }
    });

    // 2. Save generated file to database
    if (generation.code) {
      // Check if file exists to determine version
      const existingFile = await prisma.generatedFile.findFirst({
        where: {
          sessionId,
          path: generation.path,
        },
      });

      if (existingFile) {
        await prisma.generatedFile.update({
          where: { id: existingFile.id },
          data: {
            content: generation.code,
            version: { increment: 1 },
            updatedAt: new Date(),
          },
        });
      } else {
        await prisma.generatedFile.create({
          data: {
            sessionId,
            path: generation.path,
            content: generation.code,
            language: generation.language,
            action: 'create',
            version: 1,
          },
        });
      }
    }

    // 3. Mark task as done
    await prisma.task.update({
      where: { id: nextTask.id },
      data: {
        status: 'done',
        completedAt: new Date(),
      },
    });

    // 4. Update session progress
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        completedTasks: { increment: 1 },
      },
    });

    // 5. Execute next task (recurse)
    // Add small delay to avoid hitting rate limits too hard and to show progress animation
    setTimeout(() => {
      executeNextTask(sessionId, goal);
    }, 1000);

  } catch (error) {
    console.error('Task execution error:', error);
    await prisma.task.update({
      where: { id: nextTask.id },
      data: {
        status: 'failed',
        errorLog: [(error as Error).message],
      },
    });
    
    // Continue despite error
    await executeNextTask(sessionId, goal);
  }
}
