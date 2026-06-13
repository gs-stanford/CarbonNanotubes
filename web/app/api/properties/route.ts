import { NextResponse } from "next/server";
import { getExplorerPayload } from "@/lib/data";

export function GET() {
  return NextResponse.json({
    properties: getExplorerPayload().properties,
    summary: getExplorerPayload().summary
  });
}
