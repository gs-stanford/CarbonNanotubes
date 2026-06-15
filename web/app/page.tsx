import { PropertyExplorer } from "@/components/PropertyExplorer";
import { getRuntimeExplorerPayload } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function Home() {
  const payload = await getRuntimeExplorerPayload();
  return <PropertyExplorer initialData={payload} />;
}
