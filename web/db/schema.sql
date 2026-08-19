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
  measurement_warning text NOT NULL DEFAULT 'none',
  strict_plot_eligible boolean NOT NULL,
  normalized_plot_eligible boolean NOT NULL,
  exploratory_plot_eligible boolean NOT NULL,
  row_hash text NOT NULL,
  payload_json jsonb NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (record_id, property)
);

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
  public_visible boolean NOT NULL DEFAULT true,
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
  measurement_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

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

CREATE INDEX IF NOT EXISTS atlas_submissions_doi_idx ON atlas_submissions (doi_verified);
CREATE INDEX IF NOT EXISTS atlas_submissions_status_visible_idx ON atlas_submissions (status, public_visible);
CREATE INDEX IF NOT EXISTS atlas_submissions_record_id_idx ON atlas_submissions (record_id);
CREATE INDEX IF NOT EXISTS atlas_submissions_primary_verification_idx ON atlas_submissions (primary_source_verification_status);
CREATE INDEX IF NOT EXISTS atlas_measurements_record_property_idx ON atlas_measurements (record_id, property);
CREATE INDEX IF NOT EXISTS atlas_measurements_property_value_idx ON atlas_measurements (property, value_canonical);
