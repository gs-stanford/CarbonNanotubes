import { BoundedPropertyExplorer } from "@/components/BoundedPropertyExplorer";
import { getExplorerBootstrap } from "@/lib/query-store";

export const dynamic = "force-dynamic";

export default async function Home() {
  const payload = await getExplorerBootstrap();
  return <BoundedPropertyExplorer initialData={payload} />;
}
