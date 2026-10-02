import { NextResponse } from "next/server";
import { version as nextVersion } from "next/package.json";
import { readCanonicalReleaseRows } from "@/lib/canonical-store";
import { getExplorerPayload } from "@/lib/data";
import { hasDatabaseUrl } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const build = {
    commit: process.env.RENDER_GIT_COMMIT ?? process.env.GIT_COMMIT ?? null,
    next_version: nextVersion
  };
  if (!hasDatabaseUrl()) {
    const payload = getExplorerPayload();
    return NextResponse.json({
      status: "ok",
      build,
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
      build,
      backend: "postgresql",
      parity: "release_counts_verified",
      release: canonical.release
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        build,
        backend: "postgresql",
        message: error instanceof Error ? error.message : "Canonical release check failed."
      },
      { status: 503 }
    );
  }
}
