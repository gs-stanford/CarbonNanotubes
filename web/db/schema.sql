CREATE TABLE IF NOT EXISTS atlas_schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

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

CREATE INDEX IF NOT EXISTS atlas_submissions_doi_idx ON atlas_submissions (doi_verified);
CREATE INDEX IF NOT EXISTS atlas_submissions_status_visible_idx ON atlas_submissions (status, public_visible);
CREATE INDEX IF NOT EXISTS atlas_submissions_record_id_idx ON atlas_submissions (record_id);
CREATE INDEX IF NOT EXISTS atlas_measurements_record_property_idx ON atlas_measurements (record_id, property);
CREATE INDEX IF NOT EXISTS atlas_measurements_property_value_idx ON atlas_measurements (property, value_canonical);
