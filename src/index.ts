/**
 * AI Agent Builder - Entry Point
 * 
 * Main entry point for the AI Agent Builder system.
 */

import { program } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { nanoid } from 'nanoid';
import path from 'path';

import { getMessageBus } from './core/index.js';
import { OrchestratorAgent, PlannerAgent, ExecutorAgent, ReviewerAgent } from './agents/index.js';
import type { AgentContext } from './types/index.js';

// ASCII Art Banner
const BANNER = `
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║     █████╗ ██╗    █████╗  ██████╗ ███████╗███╗   ██╗████████╗
║    ██╔══██╗██║   ██╔══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝
║    ███████║██║   ███████║██║  ███╗█████╗  ██╔██╗ ██║   ██║   
║    ██╔══██║██║   ██╔══██║██║   ██║██╔══╝  ██║╚██╗██║   ██║   
║    ██║  ██║██║   ██║  ██║╚██████╔╝███████╗██║ ╚████║   ██║   
║    ╚═╝  ╚═╝╚═╝   ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝   
║                                                           ║
║              Autonomous AI Agent Builder                  ║
║           Fullstack JavaScript Generation                 ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`;

async function main() {
  console.log(chalk.cyan(BANNER));

  program
    .name('ai-agent')
    .description('Autonomous AI Agent for generating fullstack JavaScript applications')
    .version('1.0.0');

  program
    .command('generate')
    .description('Generate a new fullstack application')
    .argument('<goal>', 'Description of the application to build')
    .option('-n, --name <name>', 'Project name', 'my-app')
    .option('-o, --output <path>', 'Output directory', '.')
    .action(async (goal: string, options: { name: string; output: string }) => {
      await runGeneration(goal, options.name, options.output);
    });

  program
    .command('status')
    .description('Check agent status')
    .action(async () => {
      console.log(chalk.yellow('\n📊 Agent Status\n'));
      console.log(chalk.gray('No active sessions.'));
    });

  program
    .command('demo')
    .description('Run a demonstration')
    .action(async () => {
      await runDemo();
    });

  await program.parseAsync();
}

async function runGeneration(goal: string, projectName: string, outputPath: string) {
  const spinner = ora('Initializing agents...').start();

  try {
    // Create context
    const sessionId = nanoid();
    const workingDirectory = path.resolve(outputPath, projectName);
    
    const context: AgentContext = {
      sessionId,
      workingDirectory,
      environment: {},
    };

    // Initialize agents
    const orchestrator = new OrchestratorAgent(context);
    const planner = new PlannerAgent(context);
    const executor = new ExecutorAgent(context);
    const reviewer = new ReviewerAgent(context);

    spinner.text = 'Starting agents...';

    await orchestrator.initialize();
    await planner.initialize();
    await executor.initialize();
    await reviewer.initialize();

    spinner.succeed('Agents initialized');

    // Log the goal
    console.log(chalk.blue('\n📝 Goal:'), goal);
    console.log(chalk.blue('📁 Output:'), workingDirectory);
    console.log(chalk.blue('🏷️  Project:'), projectName);

    // Start session
    const messageBus = getMessageBus();
    
    spinner.start('Starting generation session...');

    await messageBus.send(
      'orchestrator',
      'orchestrator',
      'start_session',
      { goal, projectName },
      { sessionId }
    );

    // Wait a bit for demonstration
    await new Promise((resolve) => setTimeout(resolve, 2000));

    spinner.succeed('Session started');

    console.log(chalk.green('\n✅ Agent system initialized successfully!'));
    console.log(chalk.gray('   In a full implementation, the agents would now:'));
    console.log(chalk.gray('   1. Generate a task plan'));
    console.log(chalk.gray('   2. Execute each task to generate code'));
    console.log(chalk.gray('   3. Review and validate the generated code'));
    console.log(chalk.gray('   4. Iterate until all tasks are complete'));

    // Cleanup
    await orchestrator.shutdown();
    await planner.shutdown();
    await executor.shutdown();
    await reviewer.shutdown();

  } catch (error) {
    spinner.fail('Error during generation');
    console.error(chalk.red('\n❌ Error:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

async function runDemo() {
  console.log(chalk.yellow('\n🎬 Running Demo\n'));

  const spinner = ora('Setting up demonstration...').start();

  // Simulate agent workflow
  const steps = [
    { message: 'Initializing Orchestrator Agent', delay: 500 },
    { message: 'Initializing Planner Agent', delay: 300 },
    { message: 'Initializing Executor Agent', delay: 300 },
    { message: 'Initializing Reviewer Agent', delay: 300 },
    { message: 'Analyzing goal: "Create a todo app"', delay: 800 },
    { message: 'Generating task plan...', delay: 600 },
    { message: 'Created 4 epics with 15 tasks', delay: 400 },
    { message: 'Executing: Initialize Next.js project', delay: 500 },
    { message: 'Executing: Configure Prisma schema', delay: 500 },
    { message: 'Executing: Create API routes', delay: 500 },
    { message: 'Executing: Generate UI components', delay: 500 },
    { message: 'Reviewing generated code...', delay: 600 },
    { message: 'Running validation checks...', delay: 400 },
  ];

  for (const step of steps) {
    spinner.text = step.message;
    await new Promise((resolve) => setTimeout(resolve, step.delay));
  }

  spinner.succeed('Demo completed');

  console.log(chalk.green('\n✅ Demo finished successfully!'));
  console.log(chalk.gray('\nThe AI Agent Builder system includes:'));
  console.log(chalk.gray('  • Orchestrator - Central workflow coordinator'));
  console.log(chalk.gray('  • Planner - Goal → Epic → Task decomposition'));
  console.log(chalk.gray('  • Executor - Template-based code generation'));
  console.log(chalk.gray('  • Reviewer - Validation and security checks'));
  console.log(chalk.gray('\nMemory systems:'));
  console.log(chalk.gray('  • STM - Short-term task context'));
  console.log(chalk.gray('  • LTM - Persistent decisions and lessons'));
  console.log(chalk.gray('  • Patterns - Reusable code templates'));
}

main().catch((error) => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});
