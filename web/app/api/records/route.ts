import { NextResponse, type NextRequest } from "next/server";
import { getRuntimeExplorerPayload } from "@/lib/data";
import { requireInternalDataAccess } from "@/lib/internal-api";

export async function GET(request: NextRequest) {
  const denied = requireInternalDataAccess(request);
  if (denied) return denied;
  const payload = await getRuntimeExplorerPayload();
  return NextResponse.json({
    records: payload.records,
    summary: payload.summary
  });
}
