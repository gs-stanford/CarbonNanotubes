import { BoundedPropertyExplorer } from "@/components/BoundedPropertyExplorer";
import { getRuntimeExplorerBootstrap } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function Home() {
  const payload = await getRuntimeExplorerBootstrap();
  return <BoundedPropertyExplorer initialData={payload} />;
}
