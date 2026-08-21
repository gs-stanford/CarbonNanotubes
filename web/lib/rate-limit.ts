import { publicJson } from "@/lib/api-response";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const WINDOW_MS = 60 * 60 * 1000;

export function enforceFigureRateLimit(request: Request, includesTopRows: boolean) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const client = forwarded || request.headers.get("x-real-ip") || "local";
  const tier = includesTopRows ? "top" : "figure";
  const limit = includesTopRows ? 60 : 300;
  const key = `${tier}:${client}`;
  const now = Date.now();
  const current = buckets.get(key);
  const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + WINDOW_MS } : current;
  bucket.count += 1;
  buckets.set(key, bucket);
  if (bucket.count <= limit) return null;
  return publicJson(
    { api_version: "v1", error: { code: "rate_limited", message: "Figure request limit reached. Retry after the current hourly window." } },
    { status: 429 }
  );
}
