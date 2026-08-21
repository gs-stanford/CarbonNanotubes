import type { RecordQuery } from "./query-store";

export type CanonicalRecordQueryPlan = {
  text: string;
  values: unknown[];
};

export function buildCanonicalRecordQuery(query: RecordQuery): CanonicalRecordQueryPlan;
