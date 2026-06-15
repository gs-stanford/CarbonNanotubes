import { hasDatabaseUrl } from "@/lib/db";
import type { CommunityAcceptedSubmission } from "@/lib/data";
import { saveCleanupRun } from "@/lib/submission-store";

type CleanupStatus = "completed" | "failed" | "skipped" | "not_configured";

type CleanupResult = {
  status: CleanupStatus;
  proposedPatch?: unknown;
  error?: string;
};

type ResponseOutputText = {
  type?: string;
  text?: string;
};

type ResponseOutputItem = {
  type?: string;
  content?: ResponseOutputText[];
};

type OpenAIResponse = {
  id?: string;
  output_text?: string;
  output?: ResponseOutputItem[];
  error?: {
    message?: string;
  };
};

function stableId(prefix: string, parts: string[]): string {
  const text = parts.join("|");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function extractResponseText(response: OpenAIResponse): string {
  if (response.output_text) return response.output_text;
  const text = response.output
    ?.flatMap((item) => item.content ?? [])
    .filter((content) => content.type === "output_text" || typeof content.text === "string")
    .map((content) => content.text ?? "")
    .join("\n")
    .trim();
  return text ?? "";
}

function cleanupSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "display_title",
      "sample_summary",
      "recommended_badges",
      "recommended_flags",
      "missing_metadata",
      "citation_notes",
      "unit_warnings",
      "curator_notes",
      "confidence"
    ],
    properties: {
      display_title: {
        type: "string",
        description: "Concise public point title derived from publication/sample context. Do not invent paper titles."
      },
      sample_summary: {
        type: "string",
        description: "Short public sample line such as material/process / material family / form factor / CNT type."
      },
      recommended_badges: {
        type: "array",
        items: {
          type: "string",
          enum: [
            "peer-reviewed research",
            "direct/source-table values",
            "secondary extraction",
            "canonicalized",
            "missing conditions",
            "low-density basis",
            "unit review"
          ]
        }
      },
      recommended_flags: {
        type: "array",
        items: {
          type: "string"
        }
      },
      missing_metadata: {
        type: "array",
        items: {
          type: "string"
        }
      },
      citation_notes: {
        type: "string",
        description: "Human-readable note about original and secondary citations. No fabricated citation fields."
      },
      unit_warnings: {
        type: "array",
        items: {
          type: "string"
        }
      },
      curator_notes: {
        type: "string"
      },
      confidence: {
        type: "number",
        minimum: 0,
        maximum: 1
      }
    }
  };
}

function buildCleanupRequest(submission: CommunityAcceptedSubmission) {
  return {
    model: process.env.OPENAI_CLEANUP_MODEL || "gpt-4.1-mini",
    input: [
      {
        role: "developer",
        content: [
          {
            type: "input_text",
            text:
              "You are a conservative scientific data-curation assistant for a CNT property database. " +
              "Only clean public display labels, badges, warning suggestions, and curator notes. " +
              "Do not change numerical values, DOI metadata, canonical units, or citation facts. " +
              "If information is missing, flag it instead of inventing it."
          }
        ]
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify(
              {
                record: submission.record,
                measurements: submission.measurements,
                publication: submission.publication,
                duplicate_check: submission.duplicate_check
              },
              null,
              2
            )
          }
        ]
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "cnt_submission_cleanup",
        strict: true,
        schema: cleanupSchema()
      }
    },
    max_output_tokens: 1200,
    store: false
  };
}

export async function maybeCleanupSubmissionWithOpenAI(submission: CommunityAcceptedSubmission): Promise<CleanupResult> {
  if (process.env.OPENAI_CLEANUP_ENABLED !== "true") return { status: "skipped" };
  if (!hasDatabaseUrl()) return { status: "skipped", error: "DATABASE_URL is required before running paid cleanup calls." };
  if (!process.env.OPENAI_API_KEY) return { status: "not_configured" };

  const requestJson = buildCleanupRequest(submission);
  const cleanupRunId = stableId("cleanup", [submission.submission_id ?? submission.record.record_id, new Date().toISOString()]);
  const model = requestJson.model;

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestJson)
    });
    const responseJson = (await response.json()) as OpenAIResponse;
    if (!response.ok) {
      const message = responseJson.error?.message ?? `OpenAI cleanup failed with status ${response.status}.`;
      await saveCleanupRun({
        cleanupRunId,
        submissionId: submission.submission_id ?? submission.record.record_id,
        status: "failed",
        model,
        requestJson,
        responseJson,
        proposedPatchJson: null,
        errorMessage: message
      });
      return { status: "failed", error: message };
    }

    const outputText = extractResponseText(responseJson);
    const proposedPatch = outputText ? JSON.parse(outputText) : null;
    await saveCleanupRun({
      cleanupRunId,
      submissionId: submission.submission_id ?? submission.record.record_id,
      status: "completed",
      model,
      requestJson,
      responseJson,
      proposedPatchJson: proposedPatch,
      errorMessage: null
    });
    return { status: "completed", proposedPatch };
  } catch (error) {
    const message = error instanceof Error ? error.message : "OpenAI cleanup failed.";
    await saveCleanupRun({
      cleanupRunId,
      submissionId: submission.submission_id ?? submission.record.record_id,
      status: "failed",
      model,
      requestJson,
      responseJson: null,
      proposedPatchJson: null,
      errorMessage: message
    });
    return { status: "failed", error: message };
  }
}
