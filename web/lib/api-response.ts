import { NextResponse } from "next/server";
import { API_VERSION, ApiInputError, PUBLIC_API_CACHE_HEADERS } from "@/lib/api-v1";

export function publicJson(body: unknown, init: { status?: number } = {}) {
  const status = init.status ?? 200;
  return NextResponse.json(body, {
    status,
    headers: {
      ...PUBLIC_API_CACHE_HEADERS,
      ...(status >= 400 ? { "Cache-Control": "no-store" } : {})
    }
  });
}

export function publicOptions() {
  return new NextResponse(null, { status: 204, headers: PUBLIC_API_CACHE_HEADERS });
}

export function apiError(error: unknown) {
  if (error instanceof ApiInputError) {
    return publicJson(
      { api_version: API_VERSION, error: { code: "invalid_request", message: error.message } },
      { status: 400 }
    );
  }
  console.error("CPT API error", error);
  return publicJson(
    { api_version: API_VERSION, error: { code: "internal_error", message: "The request could not be completed." } },
    { status: 500 }
  );
}
