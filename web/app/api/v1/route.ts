import { apiMeta } from "@/lib/api-v1";
import { apiError, publicJson, publicOptions } from "@/lib/api-response";
import { getReleaseDescriptor } from "@/lib/query-store";

export async function GET() {
  try {
    const release = await getReleaseDescriptor();
    return publicJson({
      ...apiMeta(release),
      name: "Carbon Property Tables API",
      scope: "Publication discovery, citation-backed figure artifacts, and bounded top-point extraction from the active canonical release.",
      units: "Figure axes use the display units declared by the property catalog; filters use canonical SI units.",
      endpoints: {
        release: "/api/v1/release",
        properties: "/api/v1/properties",
        figures: "/api/v1/figures",
        doi_status: "/api/v1/doi-status?doi={doi}",
        search: "/api/v1/search?q={query}",
        citations: "/api/v1/citations?record_id={record_id}",
        openapi: "/api/v1/openapi.json"
      }
    });
  } catch (error) {
    return apiError(error);
  }
}

export const OPTIONS = publicOptions;
