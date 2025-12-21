/**
 * Chat API - Send messages to agent
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { chat, analyzeIntent } from '@/llm/openai';
import { auth } from '@/auth';
import { agentService } from '@/services/agent.service';

// POST /api/chat - Send a message
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { sessionId, message } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Get session context if provided
    let context: { sessionGoal?: string; recentMessages?: Array<{ role: string; content: string }> } = {};

    if (sessionId) {
      const dbSession = await prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
      });

      if (!dbSession) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }

      // Verify ownership
      if (dbSession.userEmail && dbSession.userEmail !== session.user.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      context = {
        sessionGoal: dbSession.goal,
        recentMessages: dbSession.messages
          .reverse()
          .map((m: any) => ({ role: m.role, content: m.content })),
      };

      // Save user message
      await prisma.message.create({
        data: {
          sessionId,
          role: 'user',
          content: message,
        },
      });
    }

    // Analyze intent
    const { intent, tasks } = await analyzeIntent(message, { sessionGoal: context.sessionGoal });

    if (intent === 'modification' && tasks && tasks.length > 0) {
      // Check tokens for modification requests  
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
      });

      if (!user || user.tokens < 100) {
        return NextResponse.json(
          { error: 'Insufficient tokens', tokensRequired: 100, currentBalance: user?.tokens || 0 },
          { status: 403 }
        );
      }

      // Deduct tokens
      await prisma.user.update({
        where: { email: session.user.email },
        data: { tokens: { decrement: 100 } },
      });

      // Add tasks and start execution
      agentService.addTasksAndExecute(sessionId, tasks);

      // Respond immediately
      const response = `I understand. I've added ${tasks.length} new tasks to implement your request:\n${tasks.map((t: any) => `- ${t.title}`).join('\n')}\n\nI'm starting on them now. Check the "Files" tab or terminal to see progress.`;
      
      await prisma.message.create({
        data: {
          sessionId,
          role: 'assistant',
          content: response,
        },
      });

      return NextResponse.json({ response });
    }

    // Normal Chat Flow
    if (sessionId) {
      // Save user message
      await prisma.message.create({
        data: {
          sessionId,
          role: 'user',
          content: message,
        },
      });
    }

    // Get response from LLM
    const response = await chat(message, context);

    // Save assistant message if session exists
    if (sessionId) {
      await prisma.message.create({
        data: {
          sessionId,
          role: 'assistant',
          content: response,
        },
      });
    }

    return NextResponse.json({ response });
  } catch (error) {
    console.error('POST /api/chat error:', error);
    return NextResponse.json(
      { error: 'Failed to process message' },
      { status: 500 }
    );
  }
}
