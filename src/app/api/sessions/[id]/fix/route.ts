/**
 * Fix Session API - Trigger rebuild and validation
 *
 * POST /api/sessions/[id]/fix
 * Sets status to 'fixing' and re-runs build validation
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { buildValidator } from "@/services/build-validator";
import { fixProjectErrors } from "@/llm/openai";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: sessionId } = await params;

    // Get session
    const dbSession = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { generatedFiles: { select: { path: true, content: true } } },
    });

    if (!dbSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Verify ownership
    if (dbSession.userEmail !== session.user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Immediately set status to 'fixing'
    await prisma.session.update({
      where: { id: sessionId },
      data: { status: "fixing" } as any,
    });

    await prisma.message.create({
      data: {
        sessionId,
        role: "system",
        content: "🔧 Entering self-healing mode...",
      },
    });

    // START FIX LOOP (Non-blocking: return immediately, process in background)
    // For a truly non-blocking approach, we would use a queue or serverless function.
    // For MVP, we'll do it synchronously but return early with a status update.
    // The client polls for new status via useSession.

    // Trigger validation attempt
    const MAX_RETRIES = 3;
    let retries = 0;
    let result = await buildValidator.validate(sessionId);

    while (!result.success && retries < MAX_RETRIES) {
      retries++;

      await prisma.message.create({
        data: {
          sessionId,
          role: "assistant",
          content: `⚠️ Fix attempt ${retries}/${MAX_RETRIES}: ${result.message}`,
        },
      });

      // Get current files
      const files = await prisma.generatedFile.findMany({
        where: { sessionId },
        select: { path: true, content: true },
      });

      // Ask AI to fix
      const patches = await fixProjectErrors({
        errors: result.errors || [result.message],
        files,
        goal: dbSession.goal,
      });

      if (patches.length === 0) {
        await prisma.message.create({
          data: {
            sessionId,
            role: "system",
            content: "❌ Could not generate patches.",
          },
        });
        break;
      }

      // Apply patches
      for (const patch of patches) {
        try {
          await prisma.generatedFile.update({
            where: { sessionId_path: { sessionId, path: patch.path } },
            data: { content: patch.content, version: { increment: 1 } },
          });
        } catch (e) {
          console.warn(`Could not patch ${patch.path}:`, e);
        }
      }

      await prisma.message.create({
        data: {
          sessionId,
          role: "assistant",
          content: `✅ Applied ${patches.length} patches. Retrying validation...`,
        },
      });

      result = await buildValidator.validate(sessionId);
    }

    // Final status update
    const finalStatus = result.success ? "completed" : "failed";
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        status: finalStatus,
        ...(result.success && { completedAt: new Date() }),
      } as any,
    });

    const finalMessage = result.success
      ? "✅ Build fixed successfully!"
      : `❌ Build still failing after ${MAX_RETRIES} attempts: ${result.message}`;

    await prisma.message.create({
      data: { sessionId, role: "assistant", content: finalMessage },
    });

    return NextResponse.json({
      success: result.success,
      message: finalMessage,
    });
  } catch (error) {
    console.error("Fix session error:", error);
    return NextResponse.json({ error: "Fix failed" }, { status: 500 });
  }
}
