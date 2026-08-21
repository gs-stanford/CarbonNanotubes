import { apiMeta } from "@/lib/api-v1";
import { apiError, publicJson, publicOptions } from "@/lib/api-response";
import { getPropertyCatalog, getReleaseDescriptor } from "@/lib/query-store";

export async function GET() {
  try {
    const [release, properties] = await Promise.all([getReleaseDescriptor(), getPropertyCatalog()]);
    return publicJson({
      ...apiMeta(release),
      properties: properties.map((property) => ({
        key: property.key,
        label: property.label,
        canonical_unit: property.canonicalUnit,
        display_unit: property.displayUnit,
        display_factor: property.displayFactor,
        default_scale: property.defaultScale,
        precision: property.precision,
        records_with_value: property.recordsWithValue
      }))
    });
  } catch (error) {
    return apiError(error);
  }
}

export const OPTIONS = publicOptions;
