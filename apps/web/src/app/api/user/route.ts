/**
 * User API - User settings and ToS acceptance
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";

// GET /api/user - Get current user info
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        tokens: user.tokens,
        tosAcceptedAt: (user as any).tosAcceptedAt,
        buildSuccessCount: (user as any).buildSuccessCount ?? 0,
        buildFailureCount: (user as any).buildFailureCount ?? 0,
      },
    });
  } catch (error) {
    console.error("[User API] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// POST /api/user - Accept ToS
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    if (body.action === "acceptToS") {
      await prisma.user.update({
        where: { email: session.user.email },
        data: { tosAcceptedAt: new Date() } as any,
      });

      return NextResponse.json({ success: true, message: "ToS accepted" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("[User API] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
