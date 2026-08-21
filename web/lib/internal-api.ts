import { timingSafeEqual } from "node:crypto";
import { publicJson } from "@/lib/api-response";

function secureEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function requireInternalDataAccess(request: Request) {
  const configured = process.env.CPT_INTERNAL_API_TOKEN?.trim();
  const authorization = request.headers.get("authorization") ?? "";
  const supplied = authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : request.headers.get("x-cpt-internal-token")?.trim() ?? "";
  if (configured && supplied && secureEqual(supplied, configured)) return null;
  return publicJson(
    { api_version: "v1", error: { code: "not_found", message: "Endpoint not found." } },
    { status: 404 }
  );
}
