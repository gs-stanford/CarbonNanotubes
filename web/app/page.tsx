import { BoundedPropertyExplorer } from "@/components/BoundedPropertyExplorer";
import { getExplorerBootstrap, getReleaseDescriptor } from "@/lib/query-store";

export const dynamic = "force-dynamic";

export default async function Home() {
  const payload = await getExplorerBootstrap();
  const release = await getReleaseDescriptor();
  return <BoundedPropertyExplorer initialData={payload} databaseTotals={{ records: release.record_count, publications: release.publication_count }} />;
}
