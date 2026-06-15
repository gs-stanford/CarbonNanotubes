import { NextRequest, NextResponse } from "next/server";
import { getPlotPointsFromPayload, getRuntimeExplorerPayload, isPropertyKey } from "@/lib/data";

export async function GET(request: NextRequest) {
  const xParam = request.nextUrl.searchParams.get("x");
  const yParam = request.nextUrl.searchParams.get("y");
  const x = isPropertyKey(xParam) ? xParam : "specific_strength";
  const y = isPropertyKey(yParam) ? yParam : "specific_electrical_conductivity";

  const payload = await getRuntimeExplorerPayload();

  return NextResponse.json({
    x,
    y,
    properties: payload.properties,
    points: getPlotPointsFromPayload(payload, x, y)
  });
}
