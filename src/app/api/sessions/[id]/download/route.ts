/**
 * Download API - Download session files as ZIP
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import JSZip from "jszip";
import { auth } from "@/auth";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // Auth and rate limit
    const authSession = await auth();
    if (!authSession?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateCheck = checkRateLimit(authSession.user.email);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: getRateLimitHeaders(rateCheck) }
      );
    }

    const { id } = await params;

    // Fetch all generated files for the session
    const files = await prisma.generatedFile.findMany({
      where: { sessionId: id },
    });

    if (files.length === 0) {
      return NextResponse.json(
        { error: "No files found for this session" },
        { status: 404 }
      );
    }

    const session = await prisma.session.findUnique({
      where: { id },
      select: {
        projectName: true,
        status: true,
      },
    });

    if (!session || session.status !== "completed") {
      return NextResponse.json(
        { error: "Project build not completed. Download unavailable." },
        { status: 403 }
      );
    }

    const projectName = session.projectName || "project";
    const zip = new JSZip();

    // Add files to ZIP
    files.forEach((file) => {
      // Security: Strictly exclude any node_modules or hidden files that shouldn't be there
      if (file.path.includes("node_modules") || file.path.includes(".git"))
        return;

      // Remove leading slash if present to ensure proper folder structure in zip
      const filePath = file.path.startsWith("/")
        ? file.path.slice(1)
        : file.path;
      zip.file(filePath, file.content);
    });

    // Generate ZIP file
    const zipContent = await zip.generateAsync({ type: "nodebuffer" });

    // Return ZIP response
    return new NextResponse(zipContent as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${projectName}.zip"`,
      },
    });
  } catch (error) {
    console.error("Download error:", error);
    return NextResponse.json(
      { error: "Failed to download project" },
      { status: 500 }
    );
  }
}
