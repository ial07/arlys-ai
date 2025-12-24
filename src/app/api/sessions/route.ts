/**
 * Sessions API - Create and list sessions
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { generatePlan } from "@/llm/openai";
import { auth } from "@/auth";
import { agentService } from "@/services/agent.service";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit";

// GET /api/sessions - List all sessions
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit check
    const rateCheck = checkRateLimit(session.user.email);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please wait before trying again." },
        { status: 429, headers: getRateLimitHeaders(rateCheck) }
      );
    }

    const sessions = await prisma.session.findMany({
      where: { userEmail: session.user.email },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        goal: true,
        projectName: true,
        status: true,
        totalTasks: true,
        completedTasks: true,
        failedTasks: true,
        createdAt: true,
        completedAt: true,
      },
    });

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error("GET /api/sessions error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

// POST /api/sessions - Create new session
export async function POST(request: NextRequest) {
  try {
    const authSession = await auth();
    if (!authSession?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { goal } = await request.json();

    if (!goal || typeof goal !== "string") {
      return NextResponse.json({ error: "Goal is required" }, { status: 400 });
    }

    // Check for active build (Resource Protection)
    const activeSession = await prisma.session.findFirst({
      where: {
        userEmail: authSession.user.email,
        status: {
          in: ["initializing", "planning", "executing", "fixing"],
        },
      },
    });

    if (activeSession) {
      return NextResponse.json(
        {
          error:
            "You already have an active build running. Please wait for it to complete.",
        },
        { status: 429 }
      );
    }

    // Check token balance and ToS acceptance
    const user = (await prisma.user.findUnique({
      where: { email: authSession.user.email },
    })) as { id: string; tokens: number; tosAcceptedAt: Date | null } | null;

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.tokens < 100) {
      return NextResponse.json(
        {
          error: "Insufficient tokens",
          tokensRequired: 100,
          currentBalance: user?.tokens || 0,
        },
        { status: 403 }
      );
    }

    // Deduct tokens atomically
    await prisma.user.update({
      where: { email: authSession.user.email },
      data: { tokens: { decrement: 100 } },
    });

    // Log token transaction
    await prisma.tokenTransaction.create({
      data: {
        userId: user.id,
        amount: -100,
        type: "USAGE",
        description: `New project: ${goal.substring(0, 50)}`,
      },
    });

    const newSession = await prisma.session.create({
      data: {
        goal,
        projectName: "my-project", // Will be updated
        userEmail: authSession.user.email,
        userId: user.id,
        status: "planning",
      },
    });

    // Determine project name
    const projectName = goal
      .split(" ")
      .slice(0, 3)
      .join("-")
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "");
    if (projectName) {
      await prisma.session.update({
        where: { id: newSession.id },
        data: { projectName },
      });
    }

    // Create initial assistant message
    await prisma.message.create({
      data: {
        sessionId: newSession.id,
        role: "system",
        content: `Started new session with goal: ${goal}`,
      },
    });

    // Generate plan and tasks using agent service
    agentService.generatePlanAndTasks(newSession.id, goal);

    return NextResponse.json({ session: newSession }, { status: 201 });
  } catch (error) {
    console.error("Session creation error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
