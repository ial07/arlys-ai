/**
 * Secure Preview Proxy
 *
 * Proxies requests to internal dev servers for a specific session.
 * Enforces Read-Only compliance and token validation.
 */
import { NextRequest, NextResponse } from "next/server";
import { previewService } from "@/services/preview.service";
import prisma from "@/lib/prisma";

// Disable body parsing to handle streams
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string; path?: string[] }> }
) {
  const { sessionId, path: pathSegments } = await params;
  const path = pathSegments?.join("/") || "";

  // 1. Validate preview token (Query Param OR Cookie)
  const queryToken = request.nextUrl.searchParams.get("token");
  const cookieName = `preview_token_${sessionId}`;
  const cookieToken = request.cookies.get(cookieName)?.value;

  const token = queryToken || cookieToken;

  if (!token) {
    return new NextResponse("Unauthorized: Missing preview token", {
      status: 401,
    });
  }

  const session = (await prisma.session.findUnique({
    where: { id: sessionId },
  })) as { previewToken: string | null } | null;

  if (!session || session.previewToken !== token) {
    return new NextResponse("Unauthorized: Invalid preview token", {
      status: 401,
    });
  }

  // Set cookie if we have a valid query token (Session-based, generic path)
  const responseHeaders = new Headers();
  if (queryToken) {
    responseHeaders.append(
      "Set-Cookie",
      `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600`
    );
  }

  // 2. Validate Session exists and has preview
  const info = previewService.getPreviewInfo(sessionId);

  // STATIC MODE FALLBACK: If no info (no dev server) OR port is 0 (static mode), check for static files
  if (!info || info.port === 0) {
    // Determine file path
    const fs = await import("fs/promises");
    const nodePath = await import("path");

    // Default to index.html if path is empty
    const sanitizedPath = path || "index.html";

    // Security: Prevent directory traversal
    if (sanitizedPath.includes("..")) {
      return new NextResponse("Invalid path", { status: 400 });
    }

    const filePath = nodePath.join("/tmp", "arlys", sessionId, sanitizedPath);

    try {
      // Check if file exists
      await fs.access(filePath);

      const fileContent = await fs.readFile(filePath);

      // Determine content type
      let contentType = "text/plain";
      if (sanitizedPath.endsWith(".html")) contentType = "text/html";
      if (sanitizedPath.endsWith(".css")) contentType = "text/css";
      if (sanitizedPath.endsWith(".js")) contentType = "application/javascript";
      if (sanitizedPath.endsWith(".json")) contentType = "application/json";
      if (sanitizedPath.endsWith(".png")) contentType = "image/png";
      if (sanitizedPath.endsWith(".jpg")) contentType = "image/jpeg";
      if (sanitizedPath.endsWith(".svg")) contentType = "image/svg+xml";

      // Merge headers
      responseHeaders.set("Content-Type", contentType);
      responseHeaders.set(
        "Cache-Control",
        "no-cache, no-store, must-revalidate"
      );

      return new NextResponse(fileContent, {
        status: 200,
        headers: responseHeaders,
      });
    } catch (err) {
      // Only if file not found, then error
      return new NextResponse("Static file not found or preview inactive", {
        status: 404,
      });
    }
  }

  // 2. Security Check (Read Only)
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new NextResponse("Preview is Read-Only", { status: 405 });
  }

  // 3. Proxy Request
  const targetUrl = `http://localhost:${info.port}/${path}${request.nextUrl.search}`;

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: {
        ...Object.fromEntries(request.headers),
        host: `localhost:${info.port}`, // Override host header
      },
      // Do not pass body for GET/HEAD
    });

    // 4. Stream Response & Merge Headers
    const proxyHeaders = new Headers(response.headers);

    // Copy cookie headers if any
    responseHeaders.forEach((value, key) => {
      proxyHeaders.set(key, value);
    });

    return new NextResponse(response.body, {
      status: response.status,
      headers: proxyHeaders,
    });
  } catch (error) {
    console.error("[Preview Proxy] Error:", error);
    return new NextResponse("Preview server error", { status: 502 });
  }
}

// Block other methods
export async function POST() {
  return new NextResponse("Preview is Read-Only", { status: 405 });
}
export async function PUT() {
  return new NextResponse("Preview is Read-Only", { status: 405 });
}
export async function DELETE() {
  return new NextResponse("Preview is Read-Only", { status: 405 });
}
export async function PATCH() {
  return new NextResponse("Preview is Read-Only", { status: 405 });
}
