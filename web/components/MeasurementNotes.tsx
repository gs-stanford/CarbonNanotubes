import type { PlotRecord, PropertyKey, PropertyMeta } from "@/lib/data";

export default function MeasurementNotes({ record, properties, axes }: {
  record: PlotRecord;
  properties: PropertyMeta[];
  axes: PropertyKey[];
}) {
  const keys = [...new Set<PropertyKey>([...axes, "density"])];
  const entries = keys.flatMap((key) => {
    const measurement = record.measurementMetadata[key];
    if (!measurement?.source_qualification && !measurement?.derivation_formula) return [];
    return [{ key, measurement, label: properties.find((p) => p.key === key)?.label ?? key }];
  });
  if (!entries.length) return null;
  return <details className="detail-section" style={{ overflowWrap: "anywhere" }}>
    <summary className="rail-heading" style={{ cursor: "pointer" }}>Measurement notes</summary>
    {entries.map(({ key, measurement, label }) => <div key={key}>
      <p className="source-title">{label}{measurement.reported_or_derived === "derived" ? " (calculated)" : ""}</p>
      {measurement.source_qualification ? <p className="detail-meta">{measurement.source_qualification}</p> : null}
      {measurement.derivation_formula ? <p className="detail-meta">{measurement.derivation_formula}</p> : null}
      {measurement.source_locator ? <p className="detail-meta">Source: {measurement.source_locator}</p> : null}
    </div>)}
  </details>;
}
