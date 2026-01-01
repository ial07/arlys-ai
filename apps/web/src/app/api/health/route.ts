import { NextResponse } from "next/server";

export async function GET() {
  const checks: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    env: {
      AUTH_SECRET: process.env.AUTH_SECRET ? "✓ set" : "✗ missing",
      AUTH_URL: process.env.AUTH_URL || "✗ missing",
      AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST || "✗ missing",
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? "✓ set" : "✗ missing",
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET
        ? "✓ set"
        : "✗ missing",
      DATABASE_URL: process.env.DATABASE_URL ? "✓ set" : "✗ missing",
    },
  };

  // Test database connection
  try {
    const { prisma } = await import("@/lib/prisma");
    await prisma.$queryRaw`SELECT 1`;
    checks.database = "✓ connected";
  } catch (error) {
    checks.database = `✗ error: ${String(error)}`;
  }

  return NextResponse.json(checks, { status: 200 });
}
