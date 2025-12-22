/**
 * Chat API - Send messages to agent
 * Enhanced with file-aware modifications and context passing
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { chat, analyzeIntent } from "@/llm/openai";
import { auth } from "@/auth";
import { agentService } from "@/services/agent.service";

// POST /api/chat - Send a message
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { sessionId, message } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // Get session context including existing files
    let context: {
      sessionGoal?: string;
      recentMessages?: Array<{ role: string; content: string }>;
      existingFiles?: string[];
    } = {};

    let existingFilesData: Array<{ path: string; content: string }> = [];

    if (sessionId) {
      const dbSession = await prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          messages: {
            orderBy: { createdAt: "desc" },
            take: 10,
          },
          generatedFiles: {
            select: { path: true, content: true },
          },
        },
      });

      if (!dbSession) {
        return NextResponse.json(
          { error: "Session not found" },
          { status: 404 }
        );
      }

      // Verify ownership
      if (dbSession.userEmail && dbSession.userEmail !== session.user.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      // Store existing files for modifications
      existingFilesData = dbSession.generatedFiles;

      context = {
        sessionGoal: dbSession.goal,
        recentMessages: dbSession.messages
          .reverse()
          .map((m: any) => ({ role: m.role, content: m.content })),
        existingFiles: dbSession.generatedFiles.map((f) => f.path),
      };

      // Save user message
      await prisma.message.create({
        data: {
          sessionId,
          role: "user",
          content: message,
        },
      });
    }

    // Analyze intent with file awareness
    const { intent, tasks, targetFiles } = await analyzeIntent(message, {
      sessionGoal: context.sessionGoal,
      existingFiles: context.existingFiles,
    });

    if (intent === "modification" && tasks && tasks.length > 0) {
      // Check tokens for modification requests
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
      });

      if (!user || user.tokens < 100) {
        return NextResponse.json(
          {
            error: "Insufficient tokens",
            tokensRequired: 100,
            currentBalance: user?.tokens || 0,
          },
          { status: 403 }
        );
      }

      // Deduct tokens
      await prisma.user.update({
        where: { email: session.user.email },
        data: { tokens: { decrement: 100 } },
      });

      // Log token transaction
      await prisma.tokenTransaction.create({
        data: {
          userId: user.id,
          amount: -100,
          type: "USAGE",
          description: `Modification: ${message.substring(0, 50)}`,
        },
      });

      // Enrich tasks with existing file context
      const enrichedTasks = tasks.map((t) => ({
        ...t,
        description: `MODIFICATION REQUEST: ${message}\n\nTASK: ${t.description || t.title}\n\nTARGET FILES: ${targetFiles?.join(", ") || "New files"}`,
      }));

      // Add tasks and start execution
      agentService.addTasksAndExecute(
        sessionId,
        enrichedTasks,
        existingFilesData
      );

      // Respond immediately
      const response = `🔧 I understand. I'm making the following changes:\n\n${tasks.map((t: any) => `• ${t.title}`).join("\n")}\n\n${targetFiles?.length ? `📁 Updating: ${targetFiles.join(", ")}` : "📄 Creating new files"}\n\nWatch the progress below...`;

      await prisma.message.create({
        data: {
          sessionId,
          role: "assistant",
          content: response,
        },
      });

      return NextResponse.json({ response });
    }

    // Normal Chat Flow - get response from LLM
    const response = await chat(message, context);

    // Save assistant message if session exists
    if (sessionId) {
      await prisma.message.create({
        data: {
          sessionId,
          role: "assistant",
          content: response,
        },
      });
    }

    return NextResponse.json({ response });
  } catch (error) {
    console.error("POST /api/chat error:", error);
    return NextResponse.json(
      { error: "Failed to process message" },
      { status: 500 }
    );
  }
}
