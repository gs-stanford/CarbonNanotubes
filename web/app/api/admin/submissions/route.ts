import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { listAdminSubmissions } from "@/lib/submission-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  const submissions = await listAdminSubmissions();
  return NextResponse.json({
    ok: true,
    submissions,
    summary: {
      total: submissions.length,
      visible: submissions.filter((submission) => submission.review.public_visible).length,
      official: submissions.filter((submission) => submission.review.status === "official").length,
      holds: submissions.filter((submission) => submission.review.status === "curator_hold").length,
      hidden: submissions.filter((submission) => submission.review.status === "hidden").length
    }
  });
}
