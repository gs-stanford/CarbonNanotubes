import { NextResponse } from "next/server";
import { getRuntimeExplorerPayload } from "@/lib/data";

export async function GET() {
  const payload = await getRuntimeExplorerPayload();
  return NextResponse.json({
    properties: payload.properties,
    summary: payload.summary
  });
}
