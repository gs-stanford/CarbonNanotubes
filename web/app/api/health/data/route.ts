import { NextResponse } from "next/server";
import { readCanonicalReleaseRows } from "@/lib/canonical-store";
import { getExplorerPayload } from "@/lib/data";
import { hasDatabaseUrl } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!hasDatabaseUrl()) {
    const payload = getExplorerPayload();
    return NextResponse.json({
      status: "ok",
      backend: "bundled_csv",
      counts: {
        records: payload.summary.recordCount,
        measurements: payload.summary.measurementCount,
        publications: payload.publications.length
      }
    });
  }

  try {
    const canonical = await readCanonicalReleaseRows();
    return NextResponse.json({
      status: "ok",
      backend: "postgresql",
      parity: "release_counts_verified",
      release: canonical.release
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        backend: "postgresql",
        message: error instanceof Error ? error.message : "Canonical release check failed."
      },
      { status: 503 }
    );
  }
}
