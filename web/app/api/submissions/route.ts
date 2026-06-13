import { NextRequest, NextResponse } from "next/server";
import { acceptSubmission, SubmissionError, type SubmissionPayload } from "@/lib/submissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
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
    const result = await acceptSubmission(body as SubmissionPayload);
    return NextResponse.json({
      ok: true,
      ...result
    });
  } catch (error) {
    if (error instanceof SubmissionError) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: error.code,
            message: error.message,
            details: error.details
          }
        },
        { status: error.status }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "submission_failed",
          message: "Submission could not be accepted."
        }
      },
      { status: 500 }
    );
  }
}
