import { NextResponse } from "next/server";
import { getRuntimeExplorerPayload } from "@/lib/data";

export async function GET() {
  const payload = await getRuntimeExplorerPayload();
  return NextResponse.json({
    records: payload.records,
    summary: payload.summary
  });
}
