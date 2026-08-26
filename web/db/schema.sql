CREATE TABLE IF NOT EXISTS atlas_schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS atlas_dataset_releases (
  release_id text PRIMARY KEY,
  schema_version text NOT NULL,
  source_hash text NOT NULL UNIQUE,
  record_set_hash text NOT NULL,
  measurement_set_hash text NOT NULL,
  publication_set_hash text NOT NULL,
  record_count integer NOT NULL CHECK (record_count >= 0),
  measurement_count integer NOT NULL CHECK (measurement_count >= 0),
  publication_count integer NOT NULL CHECK (publication_count >= 0),
  source_commit text,
  active boolean NOT NULL DEFAULT false,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS atlas_dataset_releases_one_active_idx
  ON atlas_dataset_releases (active)
  WHERE active = true;

CREATE TABLE IF NOT EXISTS atlas_canonical_publications (
  publication_id text PRIMARY KEY,
  release_id text NOT NULL REFERENCES atlas_dataset_releases(release_id) ON DELETE RESTRICT,
  doi_verified text,
  title_verified text,
  authors_short_verified text,
  authors_full_verified text,
  journal_verified text,
  year_verified integer,
  issue_pages_verified text,
  validation_status text,
  public_source_type text,
  row_hash text NOT NULL,
  payload_json jsonb NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS atlas_canonical_publications_doi_idx
  ON atlas_canonical_publications (lower(doi_verified))
  WHERE doi_verified IS NOT NULL;

CREATE TABLE IF NOT EXISTS atlas_canonical_records (
  record_id text PRIMARY KEY,
  release_id text NOT NULL REFERENCES atlas_dataset_releases(release_id) ON DELETE RESTRICT,
  publication_id text REFERENCES atlas_canonical_publications(publication_id) ON DELETE SET NULL,
  doi_verified text,
  record_label text NOT NULL,
  sample_name text NOT NULL,
  material_family text NOT NULL,
  form_factor text NOT NULL,
  cnt_type text,
  public_release_tier text NOT NULL,
  source_citation_class text NOT NULL,
  dataset_provenance text NOT NULL,
  primary_source_verification_status text NOT NULL,
  publication_year integer,
  peer_reviewed_measurement boolean NOT NULL,
  contextual_benchmark boolean NOT NULL,
  commercial_specsheet_benchmark boolean NOT NULL,
  author_curated_compilation_record boolean NOT NULL,
  strict_comparison_ready boolean NOT NULL,
  specimen_id text,
  sample_batch_id text,
  specimen_linkage text NOT NULL DEFAULT 'unknown',
  density_basis text NOT NULL DEFAULT 'unknown',
  cross_section_method text,
  normalization_basis text NOT NULL DEFAULT 'unknown',
  value_bound_type text NOT NULL DEFAULT 'unspecified',
  comparability_model_version text NOT NULL DEFAULT 'cpt-property-pair-v1',
  row_hash text NOT NULL,
  payload_json jsonb NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS atlas_canonical_measurements (
  measurement_id text PRIMARY KEY,
  release_id text NOT NULL REFERENCES atlas_dataset_releases(release_id) ON DELETE RESTRICT,
  record_id text NOT NULL REFERENCES atlas_canonical_records(record_id) ON DELETE CASCADE,
  property text NOT NULL,
  value_canonical double precision NOT NULL,
  unit_canonical text NOT NULL,
  reported_value double precision,
  reported_unit text,
  statistic_type text NOT NULL DEFAULT 'unspecified',
  uncertainty_type text NOT NULL DEFAULT 'not_reported',
  uncertainty_value_reported double precision,
  uncertainty_value_canonical double precision,
  sample_size_n integer,
  test_standard text,
  specimen_id text,
  sample_batch_id text,
  specimen_linkage text NOT NULL DEFAULT 'unknown',
  measurement_set_id text,
  measurement_direction text,
  density_basis text NOT NULL DEFAULT 'unknown',
  density_value_kg_m3 double precision,
  density_source_locator text,
  cross_section_method text,
  normalization_basis text NOT NULL DEFAULT 'unknown',
  value_bound_type text NOT NULL DEFAULT 'unspecified',
  derivation_formula text,
  derivation_inputs_json jsonb,
  reported_or_derived text NOT NULL DEFAULT 'reported',
  source_locator text,
  extraction_method text,
  measurement_warning text NOT NULL DEFAULT 'none',
  strict_plot_eligible boolean NOT NULL,
  normalized_plot_eligible boolean NOT NULL,
  exploratory_plot_eligible boolean NOT NULL,
  row_hash text NOT NULL,
  payload_json jsonb NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (record_id, property)
);

ALTER TABLE atlas_canonical_records ADD COLUMN IF NOT EXISTS specimen_id text;
ALTER TABLE atlas_canonical_records ADD COLUMN IF NOT EXISTS sample_batch_id text;
ALTER TABLE atlas_canonical_records ADD COLUMN IF NOT EXISTS specimen_linkage text NOT NULL DEFAULT 'unknown';
ALTER TABLE atlas_canonical_records ADD COLUMN IF NOT EXISTS density_basis text NOT NULL DEFAULT 'unknown';
ALTER TABLE atlas_canonical_records ADD COLUMN IF NOT EXISTS cross_section_method text;
ALTER TABLE atlas_canonical_records ADD COLUMN IF NOT EXISTS normalization_basis text NOT NULL DEFAULT 'unknown';
ALTER TABLE atlas_canonical_records ADD COLUMN IF NOT EXISTS value_bound_type text NOT NULL DEFAULT 'unspecified';
ALTER TABLE atlas_canonical_records ADD COLUMN IF NOT EXISTS comparability_model_version text NOT NULL DEFAULT 'cpt-property-pair-v1';

ALTER TABLE atlas_canonical_measurements ADD COLUMN IF NOT EXISTS reported_value double precision;
ALTER TABLE atlas_canonical_measurements ADD COLUMN IF NOT EXISTS reported_unit text;
ALTER TABLE atlas_canonical_measurements ADD COLUMN IF NOT EXISTS statistic_type text NOT NULL DEFAULT 'unspecified';
ALTER TABLE atlas_canonical_measurements ADD COLUMN IF NOT EXISTS uncertainty_type text NOT NULL DEFAULT 'not_reported';
ALTER TABLE atlas_canonical_measurements ADD COLUMN IF NOT EXISTS uncertainty_value_reported double precision;
ALTER TABLE atlas_canonical_measurements ADD COLUMN IF NOT EXISTS uncertainty_value_canonical double precision;
ALTER TABLE atlas_canonical_measurements ADD COLUMN IF NOT EXISTS sample_size_n integer;
ALTER TABLE atlas_canonical_measurements ADD COLUMN IF NOT EXISTS test_standard text;
ALTER TABLE atlas_canonical_measurements ADD COLUMN IF NOT EXISTS specimen_id text;
ALTER TABLE atlas_canonical_measurements ADD COLUMN IF NOT EXISTS sample_batch_id text;
ALTER TABLE atlas_canonical_measurements ADD COLUMN IF NOT EXISTS specimen_linkage text NOT NULL DEFAULT 'unknown';
ALTER TABLE atlas_canonical_measurements ADD COLUMN IF NOT EXISTS measurement_set_id text;
ALTER TABLE atlas_canonical_measurements ADD COLUMN IF NOT EXISTS measurement_direction text;
ALTER TABLE atlas_canonical_measurements ADD COLUMN IF NOT EXISTS density_basis text NOT NULL DEFAULT 'unknown';
ALTER TABLE atlas_canonical_measurements ADD COLUMN IF NOT EXISTS density_value_kg_m3 double precision;
ALTER TABLE atlas_canonical_measurements ADD COLUMN IF NOT EXISTS density_source_locator text;
ALTER TABLE atlas_canonical_measurements ADD COLUMN IF NOT EXISTS cross_section_method text;
ALTER TABLE atlas_canonical_measurements ADD COLUMN IF NOT EXISTS normalization_basis text NOT NULL DEFAULT 'unknown';
ALTER TABLE atlas_canonical_measurements ADD COLUMN IF NOT EXISTS value_bound_type text NOT NULL DEFAULT 'unspecified';
ALTER TABLE atlas_canonical_measurements ADD COLUMN IF NOT EXISTS derivation_formula text;
ALTER TABLE atlas_canonical_measurements ADD COLUMN IF NOT EXISTS derivation_inputs_json jsonb;
ALTER TABLE atlas_canonical_measurements ADD COLUMN IF NOT EXISTS reported_or_derived text NOT NULL DEFAULT 'reported';
ALTER TABLE atlas_canonical_measurements ADD COLUMN IF NOT EXISTS source_locator text;
ALTER TABLE atlas_canonical_measurements ADD COLUMN IF NOT EXISTS extraction_method text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'atlas_canonical_measurements_scientific_domain_check') THEN
    ALTER TABLE atlas_canonical_measurements
      ADD CONSTRAINT atlas_canonical_measurements_scientific_domain_check CHECK (
        value_canonical > 0
        AND (uncertainty_value_canonical IS NULL OR uncertainty_value_canonical >= 0)
        AND (sample_size_n IS NULL OR sample_size_n > 0)
        AND statistic_type IN ('individual', 'mean', 'median', 'best_specimen', 'maximum', 'minimum', 'range_endpoint', 'unspecified')
        AND uncertainty_type IN ('standard_deviation', 'standard_error', 'confidence_interval', 'range', 'reported_unspecified', 'not_reported')
        AND value_bound_type IN ('point_estimate', 'upper_bound', 'lower_bound', 'range_midpoint', 'range_endpoint', 'unspecified')
        AND normalization_basis IN ('direct_mass_specific_linear_density', 'directly_reported_mass_specific', 'derived_from_density', 'derived_from_linear_density', 'not_applicable', 'unknown')
        AND reported_or_derived IN ('reported', 'reported_with_unit_inference', 'derived')
        AND specimen_linkage IN ('same_specimen_verified', 'same_sample_batch', 'mixed_specimens', 'aggregated_across_specimens', 'incompatible', 'single_source_row_unverified', 'not_applicable_single_property', 'unknown')
        AND (uncertainty_type = 'not_reported' OR uncertainty_value_canonical IS NOT NULL)
        AND (
          normalization_basis <> 'derived_from_density'
          OR (density_value_kg_m3 > 0 AND derivation_formula IS NOT NULL AND derivation_inputs_json IS NOT NULL)
        )
      );
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS atlas_canonical_records_release_idx
  ON atlas_canonical_records (release_id);
CREATE INDEX IF NOT EXISTS atlas_canonical_records_material_idx
  ON atlas_canonical_records (material_family, form_factor);
CREATE INDEX IF NOT EXISTS atlas_canonical_records_doi_idx
  ON atlas_canonical_records (lower(doi_verified));
CREATE INDEX IF NOT EXISTS atlas_canonical_records_year_idx
  ON atlas_canonical_records (publication_year);
CREATE INDEX IF NOT EXISTS atlas_canonical_records_provenance_idx
  ON atlas_canonical_records (dataset_provenance, primary_source_verification_status);
CREATE INDEX IF NOT EXISTS atlas_canonical_measurements_release_idx
  ON atlas_canonical_measurements (release_id);
CREATE INDEX IF NOT EXISTS atlas_canonical_measurements_record_property_idx
  ON atlas_canonical_measurements (record_id, property);
CREATE INDEX IF NOT EXISTS atlas_canonical_measurements_property_value_idx
  ON atlas_canonical_measurements (property, value_canonical);

CREATE TABLE IF NOT EXISTS atlas_publications (
  publication_id text PRIMARY KEY,
  doi_verified text NOT NULL UNIQUE,
  title_verified text NOT NULL,
  authors_short_verified text,
  authors_full_verified text,
  journal_verified text,
  year_verified integer,
  issue_pages_verified text,
  metadata_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS atlas_submissions (
  submission_id text PRIMARY KEY,
  record_id text NOT NULL UNIQUE,
  publication_id text NOT NULL REFERENCES atlas_publications(publication_id) ON DELETE RESTRICT,
  doi_verified text NOT NULL,
  dataset_provenance text NOT NULL DEFAULT 'community_submission',
  primary_source_verification_status text NOT NULL DEFAULT 'submitter_claimed_pending_curator_check',
  submitter_email text,
  submitter_name text,
  status text NOT NULL DEFAULT 'accepted'
    CHECK (status IN ('accepted', 'curator_hold', 'official', 'rejected', 'hidden')),
  public_visible boolean NOT NULL DEFAULT false,
  CONSTRAINT atlas_submissions_official_visibility_check
    CHECK (public_visible = false OR status = 'official'),
  ai_cleanup_status text NOT NULL DEFAULT 'not_requested'
    CHECK (ai_cleanup_status IN ('not_requested', 'queued', 'completed', 'failed', 'skipped')),
  duplicate_match_record_ids text[] NOT NULL DEFAULT '{}',
  issue_types text[] NOT NULL DEFAULT '{}',
  flags text[] NOT NULL DEFAULT '{}',
  raw_payload jsonb NOT NULL,
  canonical_record jsonb NOT NULL,
  canonical_publication jsonb NOT NULL,
  duplicate_check jsonb NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS atlas_measurements (
  measurement_id text PRIMARY KEY,
  submission_id text NOT NULL REFERENCES atlas_submissions(submission_id) ON DELETE CASCADE,
  record_id text NOT NULL,
  property text NOT NULL,
  value_canonical double precision NOT NULL,
  unit_canonical text NOT NULL,
  reported_value double precision,
  reported_unit text,
  statistic_type text NOT NULL DEFAULT 'unspecified',
  uncertainty_type text NOT NULL DEFAULT 'not_reported',
  uncertainty_value_reported double precision,
  uncertainty_value_canonical double precision,
  sample_size_n integer,
  test_standard text,
  specimen_id text,
  sample_batch_id text,
  specimen_linkage text NOT NULL DEFAULT 'unknown',
  measurement_direction text,
  density_basis text NOT NULL DEFAULT 'unknown',
  density_value_kg_m3 double precision,
  density_source_locator text,
  cross_section_method text,
  normalization_basis text NOT NULL DEFAULT 'unknown',
  value_bound_type text NOT NULL DEFAULT 'unspecified',
  derivation_formula text,
  derivation_inputs_json jsonb,
  reported_or_derived text NOT NULL DEFAULT 'reported',
  source_locator text,
  extraction_method text,
  measurement_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE atlas_measurements ADD COLUMN IF NOT EXISTS reported_value double precision;
ALTER TABLE atlas_measurements ADD COLUMN IF NOT EXISTS reported_unit text;
ALTER TABLE atlas_measurements ADD COLUMN IF NOT EXISTS statistic_type text NOT NULL DEFAULT 'unspecified';
ALTER TABLE atlas_measurements ADD COLUMN IF NOT EXISTS uncertainty_type text NOT NULL DEFAULT 'not_reported';
ALTER TABLE atlas_measurements ADD COLUMN IF NOT EXISTS uncertainty_value_reported double precision;
ALTER TABLE atlas_measurements ADD COLUMN IF NOT EXISTS uncertainty_value_canonical double precision;
ALTER TABLE atlas_measurements ADD COLUMN IF NOT EXISTS sample_size_n integer;
ALTER TABLE atlas_measurements ADD COLUMN IF NOT EXISTS test_standard text;
ALTER TABLE atlas_measurements ADD COLUMN IF NOT EXISTS specimen_id text;
ALTER TABLE atlas_measurements ADD COLUMN IF NOT EXISTS sample_batch_id text;
ALTER TABLE atlas_measurements ADD COLUMN IF NOT EXISTS specimen_linkage text NOT NULL DEFAULT 'unknown';
ALTER TABLE atlas_measurements ADD COLUMN IF NOT EXISTS measurement_direction text;
ALTER TABLE atlas_measurements ADD COLUMN IF NOT EXISTS density_basis text NOT NULL DEFAULT 'unknown';
ALTER TABLE atlas_measurements ADD COLUMN IF NOT EXISTS density_value_kg_m3 double precision;
ALTER TABLE atlas_measurements ADD COLUMN IF NOT EXISTS density_source_locator text;
ALTER TABLE atlas_measurements ADD COLUMN IF NOT EXISTS cross_section_method text;
ALTER TABLE atlas_measurements ADD COLUMN IF NOT EXISTS normalization_basis text NOT NULL DEFAULT 'unknown';
ALTER TABLE atlas_measurements ADD COLUMN IF NOT EXISTS value_bound_type text NOT NULL DEFAULT 'unspecified';
ALTER TABLE atlas_measurements ADD COLUMN IF NOT EXISTS derivation_formula text;
ALTER TABLE atlas_measurements ADD COLUMN IF NOT EXISTS derivation_inputs_json jsonb;
ALTER TABLE atlas_measurements ADD COLUMN IF NOT EXISTS reported_or_derived text NOT NULL DEFAULT 'reported';
ALTER TABLE atlas_measurements ADD COLUMN IF NOT EXISTS source_locator text;
ALTER TABLE atlas_measurements ADD COLUMN IF NOT EXISTS extraction_method text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'atlas_measurements_scientific_domain_check') THEN
    ALTER TABLE atlas_measurements
      ADD CONSTRAINT atlas_measurements_scientific_domain_check CHECK (
        value_canonical > 0
        AND (uncertainty_value_canonical IS NULL OR uncertainty_value_canonical >= 0)
        AND (sample_size_n IS NULL OR sample_size_n > 0)
        AND statistic_type IN ('individual', 'mean', 'median', 'best_specimen', 'maximum', 'minimum', 'range_endpoint', 'unspecified')
        AND uncertainty_type IN ('standard_deviation', 'standard_error', 'confidence_interval', 'range', 'reported_unspecified', 'not_reported')
        AND value_bound_type IN ('point_estimate', 'upper_bound', 'lower_bound', 'range_midpoint', 'range_endpoint', 'unspecified')
        AND normalization_basis IN ('direct_mass_specific_linear_density', 'directly_reported_mass_specific', 'derived_from_density', 'derived_from_linear_density', 'not_applicable', 'unknown')
        AND reported_or_derived IN ('reported', 'reported_with_unit_inference', 'derived')
        AND specimen_linkage IN ('same_specimen_submitter_claimed', 'same_sample_batch_submitter_claimed', 'mixed_specimens', 'unknown')
        AND (uncertainty_type = 'not_reported' OR uncertainty_value_canonical IS NOT NULL)
        AND (
          normalization_basis <> 'derived_from_density'
          OR (density_value_kg_m3 > 0 AND derivation_formula IS NOT NULL AND derivation_inputs_json IS NOT NULL)
        )
      );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS atlas_ai_cleanup_runs (
  cleanup_run_id text PRIMARY KEY,
  submission_id text NOT NULL REFERENCES atlas_submissions(submission_id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('completed', 'failed')),
  model text,
  request_json jsonb NOT NULL,
  response_json jsonb,
  proposed_patch_json jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE atlas_submissions
  ADD COLUMN IF NOT EXISTS dataset_provenance text NOT NULL DEFAULT 'community_submission';

ALTER TABLE atlas_submissions
  ADD COLUMN IF NOT EXISTS primary_source_verification_status text NOT NULL DEFAULT 'submitter_claimed_pending_curator_check';

ALTER TABLE atlas_submissions
  ALTER COLUMN public_visible SET DEFAULT false;

UPDATE atlas_submissions
SET public_visible = false
WHERE status <> 'official' AND public_visible = true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'atlas_submissions_official_visibility_check'
  ) THEN
    ALTER TABLE atlas_submissions
      ADD CONSTRAINT atlas_submissions_official_visibility_check
      CHECK (public_visible = false OR status = 'official');
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS atlas_submissions_doi_idx ON atlas_submissions (doi_verified);
CREATE INDEX IF NOT EXISTS atlas_submissions_status_visible_idx ON atlas_submissions (status, public_visible);
CREATE INDEX IF NOT EXISTS atlas_submissions_record_id_idx ON atlas_submissions (record_id);
CREATE INDEX IF NOT EXISTS atlas_submissions_primary_verification_idx ON atlas_submissions (primary_source_verification_status);
CREATE INDEX IF NOT EXISTS atlas_measurements_record_property_idx ON atlas_measurements (record_id, property);
CREATE INDEX IF NOT EXISTS atlas_measurements_property_value_idx ON atlas_measurements (property, value_canonical);
