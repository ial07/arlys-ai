/**
 * Secure Preview Proxy
 *
 * Proxies requests to internal dev servers for a specific session.
 * Enforces Read-Only compliance.
 */
import { NextRequest, NextResponse } from "next/server";
import { previewService } from "@/services/preview.service";

// Disable body parsing to handle streams
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string; path?: string[] }> }
) {
  const { sessionId, path: pathSegments } = await params;
  const path = pathSegments?.join("/") || "";

  // 1. Validate Session exists and has preview
  const info = previewService.getPreviewInfo(sessionId);
  if (!info) {
    return new NextResponse("Preview not active or session expired", {
      status: 404,
    });
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

    // 4. Stream Response
    return new NextResponse(response.body, {
      status: response.status,
      headers: response.headers,
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
