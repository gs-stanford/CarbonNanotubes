import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

function constantTimeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function requireAdmin(request: NextRequest): NextResponse | null {
  const configuredToken = process.env.ADMIN_TOKEN;
  if (!configuredToken) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "admin_token_not_configured",
          message: "ADMIN_TOKEN must be configured before admin routes are available."
        }
      },
      { status: 503 }
    );
  }

  const auth = request.headers.get("authorization") ?? "";
  const bearerToken = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const headerToken = request.headers.get("x-admin-token")?.trim() ?? "";
  const submittedToken = bearerToken || headerToken;

  if (!submittedToken || !constantTimeEqual(submittedToken, configuredToken)) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "admin_unauthorized",
          message: "A valid admin token is required."
        }
      },
      { status: 401 }
    );
  }

  return null;
}
