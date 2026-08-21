function normalizeDoi(value) {
  return value
    .trim()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "")
    .toLowerCase();
}

function queryTokens(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .slice(0, 12);
}

export function buildCanonicalRecordQuery(query) {
  const values = [];
  const parameter = (value) => {
    values.push(value);
    return `$${values.length}`;
  };
  const where = ["rel.active = true"];

  if (query.after) where.push(`r.record_id > ${parameter(query.after)}`);
  if (query.recordIds?.length) where.push(`r.record_id = ANY(${parameter(query.recordIds)}::text[])`);
  if (query.materialFamilies?.length) where.push(`r.material_family = ANY(${parameter(query.materialFamilies)}::text[])`);
  if (query.formFactors?.length) where.push(`r.form_factor = ANY(${parameter(query.formFactors)}::text[])`);
  if (query.provenance?.length) where.push(`r.dataset_provenance = ANY(${parameter(query.provenance)}::text[])`);
  if (query.verification?.length) {
    where.push(`r.primary_source_verification_status = ANY(${parameter(query.verification)}::text[])`);
  }
  if (query.doi) where.push(`lower(r.doi_verified) = ${parameter(normalizeDoi(query.doi))}`);
  if (query.author) {
    where.push(
      `position(lower(${parameter(query.author.trim())}) in lower(concat_ws(' ', ` +
        `p.authors_short_verified, p.authors_full_verified, r.payload_json->>'publication_authors_short_verified', ` +
        `r.payload_json->>'publication_authors_full_verified'))) > 0`
    );
  }
  if (query.journal) {
    where.push(
      `position(lower(${parameter(query.journal.trim())}) in lower(concat_ws(' ', ` +
        `p.journal_verified, r.payload_json->>'publication_journal_verified'))) > 0`
    );
  }
  if (query.yearMin !== undefined) where.push(`r.publication_year >= ${parameter(query.yearMin)}`);
  if (query.yearMax !== undefined) where.push(`r.publication_year <= ${parameter(query.yearMax)}`);
  const numericPayload = (field) =>
    `(CASE WHEN (r.payload_json->>'${field}') ~ '^[+-]?[0-9]*\\.?[0-9]+([eE][+-]?[0-9]+)?$' ` +
    `THEN (r.payload_json->>'${field}')::double precision ELSE NULL END)`;
  const gaugeLengthSql = numericPayload("gauge_length_mm");
  const temperatureSql = numericPayload("condition_temperature_C");
  if (query.gaugeLengthMinMm !== undefined) where.push(`${gaugeLengthSql} >= ${parameter(query.gaugeLengthMinMm)}`);
  if (query.gaugeLengthMaxMm !== undefined) where.push(`${gaugeLengthSql} <= ${parameter(query.gaugeLengthMaxMm)}`);
  if (query.temperatureMinC !== undefined) where.push(`${temperatureSql} >= ${parameter(query.temperatureMinC)}`);
  if (query.temperatureMaxC !== undefined) where.push(`${temperatureSql} <= ${parameter(query.temperatureMaxC)}`);
  if (query.strictReady !== undefined) where.push(`r.strict_comparison_ready = ${parameter(query.strictReady)}`);
  if (query.peerReviewed !== undefined) {
    const peerReviewedSql = `r.public_release_tier IN ('peer_reviewed_research', 'peer_reviewed_contextual_comparator')`;
    where.push(query.peerReviewed ? peerReviewedSql : `NOT (${peerReviewedSql})`);
  }

  const searchDocument = `concat_ws(' ',
    r.doi_verified,
    r.record_label,
    r.sample_name,
    r.material_family,
    r.form_factor,
    r.cnt_type,
    p.title_verified,
    p.authors_short_verified,
    p.authors_full_verified,
    p.journal_verified,
    r.payload_json->>'public_sample_label',
    r.payload_json->>'synthesis_method',
    r.payload_json->>'postprocessing',
    r.payload_json->>'citation_raw'
  )`;
  queryTokens(query.q ?? "").forEach((token) => {
    where.push(`position(${parameter(token)} in lower(${searchDocument})) > 0`);
  });

  const ranges = new Map();
  (query.requiredProperties ?? []).forEach((property) => ranges.set(property, {}));
  (query.measurementRanges ?? []).forEach((range) => ranges.set(range.property, range));
  if (query.property) ranges.set(query.property, { minValue: query.minValue, maxValue: query.maxValue });
  ranges.forEach((range, property) => {
    const clauses = [
      "fm.release_id = r.release_id",
      "fm.record_id = r.record_id",
      `fm.property = ${parameter(property)}`
    ];
    if (range.minValue !== undefined) clauses.push(`fm.value_canonical >= ${parameter(range.minValue)}`);
    if (range.maxValue !== undefined) clauses.push(`fm.value_canonical <= ${parameter(range.maxValue)}`);
    where.push(`EXISTS (SELECT 1 FROM atlas_canonical_measurements fm WHERE ${clauses.join(" AND ")})`);
  });

  const limitParameter = parameter(query.limit + 1);
  return {
    text: `
      SELECT
        r.payload_json AS record_payload,
        p.payload_json AS publication_payload,
        COALESCE(
          (
            SELECT jsonb_agg(m.payload_json ORDER BY m.property)
            FROM atlas_canonical_measurements m
            WHERE m.release_id = r.release_id AND m.record_id = r.record_id
          ),
          '[]'::jsonb
        ) AS measurement_payloads
      FROM atlas_dataset_releases rel
      JOIN atlas_canonical_records r ON r.release_id = rel.release_id
      LEFT JOIN atlas_canonical_publications p ON p.publication_id = r.publication_id
      WHERE ${where.join(" AND ")}
      ORDER BY r.record_id ASC
      LIMIT ${limitParameter}
    `,
    values
  };
}
