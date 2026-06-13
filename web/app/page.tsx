import { PropertyExplorer } from "@/components/PropertyExplorer";
import { getExplorerPayload } from "@/lib/data";

export const dynamic = "force-dynamic";

export default function Home() {
  const payload = getExplorerPayload();
  return <PropertyExplorer initialData={payload} />;
}
