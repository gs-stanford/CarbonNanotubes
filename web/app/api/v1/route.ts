import { apiMeta } from "@/lib/api-v1";
import { apiError, publicJson, publicOptions } from "@/lib/api-response";
import { getReleaseDescriptor } from "@/lib/query-store";

export async function GET() {
  try {
    const release = await getReleaseDescriptor();
    return publicJson({
      ...apiMeta(release),
      name: "Carbon Property Tables API",
      scope: "Read-only access to the active, immutable CNT Property Atlas canonical release.",
      units: "Canonical measurement values use the SI unit declared on each property.",
      endpoints: {
        release: "/api/v1/release",
        properties: "/api/v1/properties",
        records: "/api/v1/records",
        record: "/api/v1/records/{record_id}",
        plot: "/api/v1/plot?x=specific_strength&y=specific_electrical_conductivity",
        citations: "/api/v1/citations?record_id={record_id}",
        openapi: "/api/v1/openapi.json"
      }
    });
  } catch (error) {
    return apiError(error);
  }
}

export const OPTIONS = publicOptions;
