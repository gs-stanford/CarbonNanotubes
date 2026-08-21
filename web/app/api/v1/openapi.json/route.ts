import type { NextRequest } from "next/server";
import { publicJson, publicOptions } from "@/lib/api-response";

export function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;
  return publicJson({
    openapi: "3.1.0",
    info: {
      title: "Carbon Property Tables API",
      version: "1.0.0",
      description:
        "Citation-preserving figure artifacts, temporary-point benchmarking, publication search, and capped top-point extraction. The public API does not expose the canonical record or coordinate tables."
    },
    servers: [{ url: origin }],
    paths: {
      "/api/v1": {
        get: { summary: "API discovery document", responses: { "200": { description: "API links and active release." } } }
      },
      "/api/v1/release": {
        get: { summary: "Active immutable dataset release", responses: { "200": { description: "Release identity, hashes, and counts." } } }
      },
      "/api/v1/properties": {
        get: { summary: "Property catalog and canonical units", responses: { "200": { description: "Supported property definitions." } } }
      },
      "/api/v1/doi-status": {
        get: {
          summary: "Check whether an exact DOI is represented",
          description: "Returns presence and bibliographic identity only. It never returns record IDs, properties, measurements, or coordinates.",
          parameters: [{ name: "doi", in: "query", required: true, schema: { type: "string", maxLength: 300 } }],
          responses: {
            "200": { description: "DOI presence and, when present, citation metadata." },
            "400": { description: "Malformed DOI." },
            "429": { description: "Lookup rate limit reached." }
          }
        }
      },
      "/api/v1/search": {
        get: {
          summary: "Search publications represented in the active release",
          description:
            "Deterministic DOI, title, author, journal, year, and keyword search. Results are deduplicated to publication identity and never include record IDs, samples, properties, measurements, or coordinates.",
          parameters: [
            { name: "q", in: "query", required: true, schema: { type: "string", minLength: 2, maxLength: 300 } },
            { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 25, default: 10 } }
          ],
          responses: {
            "200": { description: "Ranked, publication-level bibliographic matches." },
            "400": { description: "Missing or invalid search query." },
            "429": { description: "Search rate limit reached." }
          }
        }
      },
      "/api/v1/figures": {
        post: {
          summary: "Render a bounded scientific figure package",
          description: "Returns SVG and optional PNG/PDF artifacts, citations, one selected record, temporary-point ranking, and at most ten exact top rows.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["kind", "x", "y"],
                  properties: {
                    kind: { type: "string", enum: ["scatter", "ranked", "trend", "ashby"] },
                    x: { type: "string" },
                    y: { type: "string" },
                    x_scale: { type: "string", enum: ["linear", "log"] },
                    y_scale: { type: "string", enum: ["linear", "log"] },
                    top: { type: "integer", minimum: 0, maximum: 10 },
                    top_by: { type: "string", enum: ["auto", "x", "y"] },
                    formats: { type: "array", items: { type: "string", enum: ["svg", "png", "pdf"] } },
                    filters: { type: "object", additionalProperties: true }
                  }
                }
              }
            }
          },
          responses: {
            "200": { description: "Rendered artifacts and bounded metadata; no complete coordinate table." },
            "400": { description: "Invalid property, filter, format, or top-point request." }
          }
        }
      },
      "/api/v1/citations": {
        get: {
          summary: "Build a citation bundle for record IDs",
          parameters: [{ name: "record_id", in: "query", required: true, schema: { type: "array", items: { type: "string" } } }],
          responses: { "200": { description: "Nature-style text and BibTeX citations." } }
        },
        post: {
          summary: "Build a citation bundle for a larger record set",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["record_ids"],
                  properties: { record_ids: { type: "array", maxItems: 500, items: { type: "string" } } }
                }
              }
            }
          },
          responses: { "200": { description: "Nature-style text and BibTeX citations." } }
        }
      }
    }
  });
}

export const OPTIONS = publicOptions;
