/**
 * OpenAI LLM Service
 * 
 * Provides AI-powered code generation capabilities using OpenAI API.
 */

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface GenerateCodeRequest {
  taskType: string;
  taskDescription: string;
  context?: {
    projectStructure?: string[];
    existingFiles?: Array<{ path: string; content: string }>;
    schema?: string;
  };
}

export interface GenerateCodeResponse {
  code: string;
  language: string;
  path: string;
  explanation?: string;
}

export interface PlanGenerationRequest {
  goal: string;
  constraints?: string[];
}

export interface TaskPlanItem {
  epic: string;
  title: string;
  type: string;
  description: string;
  dependencies: string[];
  priority: number;
}

/**
 * Generate code for a specific task
 */
export async function generateCode(request: GenerateCodeRequest): Promise<GenerateCodeResponse> {
  const systemPrompt = `You are an expert fullstack JavaScript developer.
You generate production-ready code for Next.js applications.

Return a JSON object with this structure:
{
  "path": "file path (e.g., components/Button.tsx)",
  "code": "full code content",
  "explanation": "brief explanation of what this code does"
}

Rules:
- Use TypeScript and Tailwind CSS.
- Ensure the code is complete and runnable.
- Do not include markdown code fences in the "code" field.`;

  const userPrompt = `Generate code for the following task:

Task Type: ${request.taskType}
Description: ${request.taskDescription}

${request.context?.projectStructure ? `Project Structure:\n${request.context.projectStructure.join('\n')}` : ''}
${request.context?.schema ? `Database Schema:\n${request.context.schema}` : ''}

Generate the complete file.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.2,
    max_tokens: 4000,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content || '{}';
  
  try {
    const parsed = JSON.parse(content);
    return {
      code: parsed.code || '// No code generated',
      path: parsed.path || 'generated.ts',
      language: getLanguageFromPath(parsed.path || 'generated.ts'),
      explanation: parsed.explanation,
    };
  } catch (error) {
    console.error('Failed to parse code generation response:', content);
    return {
      code: '// Error generating code',
      path: 'error.ts',
      language: 'typescript',
    };
  }
}

/**
 * Generate a task plan from a goal description
 */
export async function generatePlan(request: PlanGenerationRequest): Promise<TaskPlanItem[]> {
  const systemPrompt = `You are an expert software architect.
Given a project goal, you create detailed task plans for building fullstack Next.js applications.

Break down the goal into epics (major components) and tasks (atomic work items).
Each task should be small enough to complete in one step.

Return a JSON array of tasks with this structure:
{
  "epic": "epic name (foundation, database, api, ui, auth, etc.)",
  "title": "task title",
  "type": "type (setup, schema, api, component, page, test, config)",
  "description": "detailed description",
  "dependencies": ["task titles this depends on"],
  "priority": 1-5 (1 is highest)
}`;

  const userPrompt = `Create a detailed task plan for:

Goal: ${request.goal}
${request.constraints?.length ? `Constraints:\n${request.constraints.map(c => `- ${c}`).join('\n')}` : ''}

Generate a comprehensive plan with all necessary tasks to build this application.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.5,
    max_tokens: 4000,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content || '{"tasks": []}';
  
  try {
    const parsed = JSON.parse(content);
    return parsed.tasks || parsed.plan || parsed;
  } catch {
    console.error('Failed to parse plan response:', content);
    return [];
  }
}

/**
 * Analyze an error and suggest a fix
 */
export async function analyzeError(error: string, code: string): Promise<{
  analysis: string;
  suggestedFix: string;
}> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You are an expert debugger. Analyze errors and provide fixes.',
      },
      {
        role: 'user',
        content: `Error:\n${error}\n\nCode:\n${code}\n\nProvide analysis and suggested fix.`,
      },
    ],
    temperature: 0.3,
    max_tokens: 1000,
  });

  const content = response.choices[0]?.message?.content || '';
  
  return {
    analysis: content,
    suggestedFix: content,
  };
}

/**
 * Chat with the agent about the project
 */
export async function chat(
  message: string,
  context?: { sessionGoal?: string; recentMessages?: Array<{ role: string; content: string }> }
): Promise<string> {
  const systemPrompt = `You are an AI Agent Builder assistant helping users create fullstack applications.

${context?.sessionGoal ? `Current project goal: ${context.sessionGoal}` : ''}

Be helpful, concise, and technical. Explain what the agent is doing and answer questions about the project.`;

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...(context?.recentMessages?.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })) || []),
    { role: 'user', content: message },
  ];

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
    temperature: 0.7,
    max_tokens: 1000,
  });

  return response.choices[0]?.message?.content || 'I apologize, I was unable to generate a response.';
}

function getLanguageFromPath(path: string): string {
  if (path.endsWith('.ts') || path.endsWith('.tsx')) return 'typescript';
  if (path.endsWith('.js') || path.endsWith('.jsx')) return 'javascript';
  if (path.endsWith('.json')) return 'json';
  if (path.endsWith('.css')) return 'css';
  if (path.endsWith('.prisma')) return 'prisma';
  if (path.endsWith('.md')) return 'markdown';
  return 'text';
}

/**
 * Analyze user's intent: Chat or Code Modification
 */
export async function analyzeIntent(
  message: string,
  context?: { sessionGoal?: string }
): Promise<{ intent: 'chat' | 'modification'; tasks?: any[] }> {
  const systemPrompt = `You are an AI project manager.
Determine if the user's message is just a question/chat OR a request to modify/add code to the project.

If it's a modification request, generate a list of tasks to implement it.
If it's a chat, return intent "chat".

Return JSON:
{
  "intent": "chat" | "modification",
  "tasks": [ { "title": "...", "description": "...", "type": "...", "epic": "..." } ] (optional, required if intent is modification)
}`;

  const userPrompt = `Project Goal: ${context?.sessionGoal || 'Unknown'}
User Message: "${message}"

Analyze intent and generate tasks if needed.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.2,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content || '{}';
  try {
    return JSON.parse(content);
  } catch {
    return { intent: 'chat' };
  }
}

export const llm = {
  generateCode,
  generatePlan,
  analyzeError,
  chat,
  analyzeIntent, // Export new function
};

export default llm;
