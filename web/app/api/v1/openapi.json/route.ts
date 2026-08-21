import type { NextRequest } from "next/server";
import { publicJson, publicOptions } from "@/lib/api-response";

const filterParameters = [
  { name: "q", in: "query", schema: { type: "string" }, description: "Full-text match across DOI, authors, title, sample, and keywords." },
  { name: "property", in: "query", schema: { type: "string" }, description: "Require a property. Use canonical SI values with min_value/max_value." },
  { name: "min_value", in: "query", schema: { type: "number" }, description: "Minimum canonical SI value for property." },
  { name: "max_value", in: "query", schema: { type: "number" }, description: "Maximum canonical SI value for property." },
  {
    name: "measurement_filter",
    in: "query",
    schema: { type: "array", items: { type: "string" } },
    description: "Repeatable property:min:max filter in canonical SI; blank min or max is allowed. Example: density:1000:1500."
  },
  { name: "material_family", in: "query", schema: { type: "string" }, description: "Comma-separated or repeated material-family filter." },
  { name: "form_factor", in: "query", schema: { type: "string" }, description: "Comma-separated or repeated form-factor filter." },
  { name: "doi", in: "query", schema: { type: "string" }, description: "Exact DOI after DOI-URL normalization." },
  { name: "author", in: "query", schema: { type: "string" } },
  { name: "journal", in: "query", schema: { type: "string" } },
  { name: "year_min", in: "query", schema: { type: "integer" } },
  { name: "year_max", in: "query", schema: { type: "integer" } },
  { name: "gauge_length_min_mm", in: "query", schema: { type: "number" } },
  { name: "gauge_length_max_mm", in: "query", schema: { type: "number" } },
  { name: "temperature_min_c", in: "query", schema: { type: "number" } },
  { name: "temperature_max_c", in: "query", schema: { type: "number" } },
  { name: "provenance", in: "query", schema: { type: "string" }, description: "Comma-separated or repeated dataset-provenance filter." },
  { name: "verification", in: "query", schema: { type: "string" }, description: "Comma-separated or repeated primary-source verification status." },
  { name: "strict_ready", in: "query", schema: { type: "boolean" } },
  {
    name: "peer_reviewed",
    in: "query",
    schema: { type: "boolean" },
    description: "Filter by peer-reviewed public release tier; author-curated compilation records remain included when their original publications are peer reviewed."
  },
  { name: "after", in: "query", schema: { type: "string" }, description: "Opaque record cursor returned by the previous page." },
  { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 200, default: 50 } }
];

export function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;
  return publicJson({
    openapi: "3.1.0",
    info: {
      title: "Carbon Property Tables API",
      version: "1.0.0",
      description:
        "Read-only, citation-preserving access to the active CNT Property Atlas canonical release. Numerical values are returned in explicit canonical SI and display units."
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
      "/api/v1/records": {
        get: {
          summary: "Query canonical material records",
          parameters: filterParameters,
          responses: {
            "200": { description: "Cursor-paginated records with measurements, provenance, and citations." },
            "400": { description: "Invalid filter or unit-range request." }
          }
        }
      },
      "/api/v1/records/{record_id}": {
        get: {
          summary: "Retrieve one canonical record",
          parameters: [{ name: "record_id", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Canonical record." }, "404": { description: "Record not found in active release." } }
        }
      },
      "/api/v1/plot": {
        get: {
          summary: "Retrieve same-record paired property data and its complete citation set",
          parameters: [
            { name: "x", in: "query", required: true, schema: { type: "string" } },
            { name: "y", in: "query", required: true, schema: { type: "string" } },
            ...filterParameters.map((parameter) =>
              parameter.name === "limit"
                ? { ...parameter, schema: { type: "integer", minimum: 1, maximum: 2000, default: 1000 } }
                : parameter
            )
          ],
          responses: { "200": { description: "Paired points and deduplicated citation bundle." } }
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
