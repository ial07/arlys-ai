/**
 * Admin Cleanup API
 *
 * Removes old sessions and their related data.
 * Should be triggered periodically (cron or manual).
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";

// Number of days after which sessions are considered stale
const SESSION_RETENTION_DAYS = 30;

export async function POST(request: NextRequest) {
  try {
    // Auth check - admin only
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { role: true },
    });

    if (user?.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - SESSION_RETENTION_DAYS);

    // Delete old sessions (Prisma cascade will handle related records)
    const result = await prisma.session.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
        status: { in: ["completed", "failed", "cancelled"] },
      },
    });

    return NextResponse.json({
      success: true,
      deletedCount: result.count,
      cutoffDate: cutoffDate.toISOString(),
    });
  } catch (error) {
    console.error("[Cleanup] Error:", error);
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
  }
}

// GET for health check / info
export async function GET() {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - SESSION_RETENTION_DAYS);

  const staleCount = await prisma.session.count({
    where: {
      createdAt: { lt: cutoffDate },
      status: { in: ["completed", "failed", "cancelled"] },
    },
  });

  return NextResponse.json({
    retentionDays: SESSION_RETENTION_DAYS,
    staleSessionCount: staleCount,
    nextCutoffDate: cutoffDate.toISOString(),
  });
}
