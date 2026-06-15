import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { updateSubmissionReview, type AdminSubmissionPatch, type ReviewStatus } from "@/lib/submission-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REVIEW_STATUSES: ReviewStatus[] = ["accepted", "curator_hold", "official", "rejected", "hidden"];

function parsePatch(body: unknown): AdminSubmissionPatch {
  if (!body || typeof body !== "object") return {};
  const candidate = body as AdminSubmissionPatch;
  const out: AdminSubmissionPatch = {};

  if (candidate.status && REVIEW_STATUSES.includes(candidate.status)) {
    out.status = candidate.status;
  }
  if (typeof candidate.public_visible === "boolean") {
    out.public_visible = candidate.public_visible;
  }
  if (candidate.record_patch && typeof candidate.record_patch === "object") {
    out.record_patch = candidate.record_patch;
  }

  return out;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<unknown> }
) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  const params = (await context.params) as { submissionId?: string };
  const submissionId = params.submissionId ?? "";
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "invalid_json",
          message: "Request body must be valid JSON."
        }
      },
      { status: 400 }
    );
  }

  try {
    const submission = await updateSubmissionReview(submissionId, parsePatch(body));
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

    return NextResponse.json({
      ok: true,
      submission
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "admin_update_failed",
          message: error instanceof Error ? error.message : "Submission review update failed."
        }
      },
      { status: 500 }
    );
  }
}
