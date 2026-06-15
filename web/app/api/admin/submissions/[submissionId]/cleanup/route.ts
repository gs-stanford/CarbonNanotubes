import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { maybeCleanupSubmissionWithOpenAI } from "@/lib/openai-cleanup";
import { readStoredSubmission } from "@/lib/submission-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<unknown> }
) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  const params = (await context.params) as { submissionId?: string };
  const submissionId = params.submissionId ?? "";
  const submission = await readStoredSubmission(submissionId);
  if (!submission) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "submission_not_found",
          message: "No stored submission matched that id."
        }
      },
      { status: 404 }
    );
  }

  const cleanup = await maybeCleanupSubmissionWithOpenAI(submission);
  return NextResponse.json({
    ok: cleanup.status === "completed",
    submission_id: submission.submission_id ?? submission.record.record_id,
    cleanup
  });
}
