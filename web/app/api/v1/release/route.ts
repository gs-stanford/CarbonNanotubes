import { apiMeta } from "@/lib/api-v1";
import { apiError, publicJson, publicOptions } from "@/lib/api-response";
import { getReleaseDescriptor } from "@/lib/query-store";

export async function GET() {
  try {
    const release = await getReleaseDescriptor();
    return publicJson(apiMeta(release));
  } catch (error) {
    return apiError(error);
  }
}

export const OPTIONS = publicOptions;
