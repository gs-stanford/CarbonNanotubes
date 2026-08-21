import { publicJson } from "@/lib/api-response";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const WINDOW_MS = 60 * 60 * 1000;

function clientIdentity(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "local";
}

function enforceRateLimit(request: Request, tier: string, limit: number, message: string) {
  const key = `${tier}:${clientIdentity(request)}`;
  const now = Date.now();
  const current = buckets.get(key);
  const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + WINDOW_MS } : current;
  bucket.count += 1;
  buckets.set(key, bucket);
  if (bucket.count <= limit) return null;
  return publicJson(
    { api_version: "v1", error: { code: "rate_limited", message } },
    { status: 429 }
  );
}

export function enforceFigureRateLimit(request: Request, includesTopRows: boolean) {
  const tier = includesTopRows ? "top" : "figure";
  const limit = includesTopRows ? 60 : 300;
  return enforceRateLimit(
    request,
    tier,
    limit,
    "Figure request limit reached. Retry after the current hourly window."
  );
}

export function enforceDoiStatusRateLimit(request: Request) {
  return enforceRateLimit(
    request,
    "doi-status",
    300,
    "DOI lookup limit reached. Retry after the current hourly window."
  );
}
