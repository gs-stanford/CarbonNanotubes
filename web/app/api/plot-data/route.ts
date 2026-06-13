import { NextRequest, NextResponse } from "next/server";
import { getExplorerPayload, getPlotPoints, isPropertyKey } from "@/lib/data";

export function GET(request: NextRequest) {
  const xParam = request.nextUrl.searchParams.get("x");
  const yParam = request.nextUrl.searchParams.get("y");
  const x = isPropertyKey(xParam) ? xParam : "specific_strength";
  const y = isPropertyKey(yParam) ? yParam : "specific_electrical_conductivity";

  const payload = getExplorerPayload();

  return NextResponse.json({
    x,
    y,
    properties: payload.properties,
    points: getPlotPoints(x, y)
  });
}
