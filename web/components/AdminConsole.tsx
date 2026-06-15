"use client";

import { CheckCircle2, Eye, EyeOff, Lock, RefreshCcw, Save, Sparkles } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import type { AdminSubmission, ReviewStatus } from "@/lib/submission-store";

type AdminResponse = {
  ok: boolean;
  submissions?: AdminSubmission[];
  summary?: {
    total: number;
    visible: number;
    official: number;
    holds: number;
    hidden: number;
  };
  error?: {
    code: string;
    message: string;
  };
};

type EditableRecord = {
  public_sample_label: string;
  material_family: string;
  form_factor: string;
  cnt_type: string;
  public_plot_badge: string;
  value_extraction_type: string;
  source_disclosure: string;
  citation_requirement: string;
  issue_types: string;
  missing_conditions: boolean;
  unit_inference_review_needed: boolean;
  strict_comparison_ready: boolean;
};

const REVIEW_STATUSES: Array<{ value: ReviewStatus; label: string }> = [
  { value: "accepted", label: "Accepted" },
  { value: "curator_hold", label: "Curator hold" },
  { value: "official", label: "Official" },
  { value: "rejected", label: "Rejected" },
  { value: "hidden", label: "Hidden" }
];

const MATERIAL_OPTIONS = [
  ["CNT_or_CNT_hybrid", "CNT"],
  ["CNT_metal_composite", "CNT-metal composite"],
  ["graphene_or_GO_fiber", "Graphene / graphite"],
  ["carbon_fiber_comparator", "Carbon fiber"],
  ["other_carbon_comparator", "Other carbon"],
  ["polymer_fiber_comparator", "Polymer"],
  ["metal_comparator", "Metal"],
  ["ceramic_or_glass_comparator", "Ceramic / glass"]
];

const FORM_OPTIONS = [
  ["fiber_yarn", "Fiber / yarn"],
  ["sheet_mat_film", "Sheet / mat / film"],
  ["buckypaper", "Buckypaper"],
  ["foam_aerogel", "Foam / aerogel"],
  ["forest_array", "Forest / array"],
  ["individual_nanotube_or_bundle", "Individual tube / bundle"],
  ["bulk", "Bulk"],
  ["unknown", "Unknown"]
];

function editableFromSubmission(submission: AdminSubmission | null): EditableRecord {
  const record = submission?.record;
  return {
    public_sample_label: record?.public_sample_label ?? "",
    material_family: record?.material_family ?? "CNT_or_CNT_hybrid",
    form_factor: record?.form_factor ?? "fiber_yarn",
    cnt_type: record?.cnt_type ?? "",
    public_plot_badge: record?.public_plot_badge ?? "DOI-verified research",
    value_extraction_type: record?.value_extraction_type ?? "direct_or_source_table",
    source_disclosure: record?.source_disclosure ?? "",
    citation_requirement: record?.citation_requirement ?? "Cite original publication and CNT Property Atlas.",
    issue_types: record?.issue_types ?? "",
    missing_conditions: Boolean(record?.missing_conditions),
    unit_inference_review_needed: Boolean(record?.unit_inference_review_needed),
    strict_comparison_ready: Boolean(record?.strict_comparison_ready)
  };
}

function formatDate(value: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function statusClass(status: ReviewStatus) {
  return `admin-status admin-status-${status.replace("_", "-")}`;
}

export function AdminConsole() {
  const [token, setToken] = useState("");
  const [submissions, setSubmissions] = useState<AdminSubmission[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [status, setStatus] = useState<ReviewStatus>("accepted");
  const [publicVisible, setPublicVisible] = useState(true);
  const [edit, setEdit] = useState<EditableRecord>(() => editableFromSubmission(null));
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<unknown>(null);

  const selected = useMemo(
    () => submissions.find((submission) => (submission.submission_id ?? submission.record.record_id) === selectedId) ?? null,
    [submissions, selectedId]
  );

  const summary = useMemo(
    () => ({
      total: submissions.length,
      visible: submissions.filter((submission) => submission.review.public_visible).length,
      official: submissions.filter((submission) => submission.review.status === "official").length,
      holds: submissions.filter((submission) => submission.review.status === "curator_hold").length,
      hidden: submissions.filter((submission) => submission.review.status === "hidden").length
    }),
    [submissions]
  );

  useEffect(() => {
    const stored = window.localStorage.getItem("cnt-atlas-admin-token") ?? "";
    if (stored) setToken(stored);
  }, []);

  useEffect(() => {
    if (!selected) return;
    setStatus(selected.review.status);
    setPublicVisible(selected.review.public_visible);
    setEdit(editableFromSubmission(selected));
    setCleanupResult(null);
  }, [selected]);

  function authHeaders() {
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    };
  }

  async function loadSubmissions(event?: FormEvent) {
    event?.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    setCleanupResult(null);
    window.localStorage.setItem("cnt-atlas-admin-token", token);

    try {
      const response = await fetch("/api/admin/submissions", {
        headers: authHeaders()
      });
      const json = (await response.json()) as AdminResponse;
      if (!response.ok || !json.ok) {
        throw new Error(json.error?.message ?? "Admin submissions could not be loaded.");
      }
      const next = json.submissions ?? [];
      setSubmissions(next);
      if (!selectedId || !next.some((submission) => (submission.submission_id ?? submission.record.record_id) === selectedId)) {
        setSelectedId(next[0]?.submission_id ?? next[0]?.record.record_id ?? "");
      }
      setMessage(`Loaded ${next.length} submissions.`);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Admin submissions could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  function updateSelectedSubmission(next: AdminSubmission) {
    setSubmissions((current) =>
      current.map((submission) =>
        (submission.submission_id ?? submission.record.record_id) === (next.submission_id ?? next.record.record_id) ? next : submission
      )
    );
    setSelectedId(next.submission_id ?? next.record.record_id);
  }

  async function saveReview(overrides: Partial<{ status: ReviewStatus; public_visible: boolean }> = {}) {
    if (!selected) return;
    setSaving(true);
    setError("");
    setMessage("");
    setCleanupResult(null);

    try {
      const response = await fetch(`/api/admin/submissions/${encodeURIComponent(selected.submission_id ?? selected.record.record_id)}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({
          status: overrides.status ?? status,
          public_visible: overrides.public_visible ?? publicVisible,
          record_patch: {
            ...edit,
            record_label: edit.public_sample_label,
            sample_name: edit.public_sample_label
          }
        })
      });
      const json = (await response.json()) as { ok: boolean; submission?: AdminSubmission; error?: { message: string } };
      if (!response.ok || !json.ok || !json.submission) {
        throw new Error(json.error?.message ?? "Submission review update failed.");
      }
      updateSelectedSubmission(json.submission);
      setMessage("Review changes saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Submission review update failed.");
    } finally {
      setSaving(false);
    }
  }

  async function runCleanup() {
    if (!selected) return;
    setSaving(true);
    setError("");
    setMessage("");
    setCleanupResult(null);

    try {
      const response = await fetch(`/api/admin/submissions/${encodeURIComponent(selected.submission_id ?? selected.record.record_id)}/cleanup`, {
        method: "POST",
        headers: authHeaders()
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error?.message ?? "OpenAI cleanup request failed.");
      }
      setCleanupResult(json.cleanup ?? json);
      setMessage("Cleanup request completed.");
      await loadSubmissions();
    } catch (cleanupError) {
      setError(cleanupError instanceof Error ? cleanupError.message : "OpenAI cleanup request failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="admin-shell">
      <header className="admin-topbar">
        <div>
          <p className="admin-kicker">CNT Property Atlas</p>
          <h1>Submission curation</h1>
        </div>
        <form className="admin-token-form" onSubmit={loadSubmissions}>
          <label>
            <span>Admin token</span>
            <input
              type="password"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="ADMIN_TOKEN"
              autoComplete="off"
            />
          </label>
          <button type="submit" disabled={loading || !token.trim()}>
            <Lock size={16} />
            {loading ? "Loading" : "Load"}
          </button>
        </form>
      </header>

      <section className="admin-stats" aria-label="Admin summary">
        <div>
          <span>Total</span>
          <strong>{summary.total}</strong>
        </div>
        <div>
          <span>Visible</span>
          <strong>{summary.visible}</strong>
        </div>
        <div>
          <span>Official</span>
          <strong>{summary.official}</strong>
        </div>
        <div>
          <span>Holds</span>
          <strong>{summary.holds}</strong>
        </div>
        <div>
          <span>Hidden</span>
          <strong>{summary.hidden}</strong>
        </div>
      </section>

      {(message || error) && (
        <div className={`admin-notice ${error ? "is-error" : ""}`} role="status">
          {error || message}
        </div>
      )}

      <section className="admin-grid">
        <aside className="admin-list" aria-label="Stored submissions">
          <div className="admin-list-header">
            <h2>Submissions</h2>
            <button type="button" onClick={() => loadSubmissions()} disabled={loading || !token.trim()} aria-label="Refresh submissions">
              <RefreshCcw size={15} />
            </button>
          </div>
          {submissions.length === 0 ? (
            <p className="admin-empty">Enter the admin token and load submissions.</p>
          ) : (
            submissions.map((submission) => {
              const id = submission.submission_id ?? submission.record.record_id;
              return (
                <button
                  className={`admin-row ${selectedId === id ? "is-selected" : ""}`}
                  type="button"
                  key={id}
                  onClick={() => setSelectedId(id)}
                >
                  <span className={statusClass(submission.review.status)}>{submission.review.status.replace("_", " ")}</span>
                  <strong>{submission.record.public_sample_label || submission.publication.title_verified || id}</strong>
                  <span>{submission.publication.doi_verified}</span>
                  <small>{formatDate(submission.review.updated_at || submission.accepted_at)}</small>
                </button>
              );
            })
          )}
        </aside>

        <section className="admin-detail" aria-label="Submission detail">
          {!selected ? (
            <div className="admin-detail-empty">
              <h2>No submission selected</h2>
              <p>Load submissions to inspect canonical records and curator controls.</p>
            </div>
          ) : (
            <>
              <div className="admin-detail-heading">
                <div>
                  <p className="admin-kicker">Selected record</p>
                  <h2>{selected.record.public_sample_label}</h2>
                  <p>
                    {selected.publication.authors_short_verified} / {selected.publication.journal_verified} / {selected.publication.year_verified}
                  </p>
                </div>
                <div className="admin-quick-actions">
                  <button type="button" onClick={() => saveReview({ status: "official", public_visible: true })} disabled={saving}>
                    <CheckCircle2 size={16} />
                    Official
                  </button>
                  <button type="button" onClick={() => saveReview({ status: "curator_hold", public_visible: false })} disabled={saving}>
                    <EyeOff size={16} />
                    Hold
                  </button>
                  <button type="button" onClick={() => saveReview({ status: "hidden", public_visible: false })} disabled={saving}>
                    <EyeOff size={16} />
                    Hide
                  </button>
                </div>
              </div>

              <div className="admin-source-panel">
                <div>
                  <span>Publication</span>
                  <strong>{selected.publication.title_verified}</strong>
                </div>
                <div>
                  <span>DOI</span>
                  <strong>{selected.publication.doi_verified}</strong>
                </div>
                <div>
                  <span>Submission id</span>
                  <strong>{selected.submission_id ?? selected.record.record_id}</strong>
                </div>
              </div>

              <form className="admin-edit-form" onSubmit={(event) => {
                event.preventDefault();
                void saveReview();
              }}>
                <label className="admin-field admin-field-wide">
                  <span>Public point title</span>
                  <input
                    value={edit.public_sample_label}
                    onChange={(event) => setEdit((current) => ({ ...current, public_sample_label: event.target.value }))}
                  />
                </label>

                <label className="admin-field">
                  <span>Status</span>
                  <select value={status} onChange={(event) => setStatus(event.target.value as ReviewStatus)}>
                    {REVIEW_STATUSES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="admin-field admin-check-field">
                  <span>Public visibility</span>
                  <button
                    type="button"
                    className={publicVisible ? "admin-toggle is-on" : "admin-toggle"}
                    onClick={() => setPublicVisible((current) => !current)}
                  >
                    {publicVisible ? <Eye size={15} /> : <EyeOff size={15} />}
                    {publicVisible ? "Visible" : "Hidden"}
                  </button>
                </label>

                <label className="admin-field">
                  <span>Material family</span>
                  <select
                    value={edit.material_family}
                    onChange={(event) => setEdit((current) => ({ ...current, material_family: event.target.value }))}
                  >
                    {MATERIAL_OPTIONS.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="admin-field">
                  <span>Form factor</span>
                  <select
                    value={edit.form_factor}
                    onChange={(event) => setEdit((current) => ({ ...current, form_factor: event.target.value }))}
                  >
                    {FORM_OPTIONS.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="admin-field">
                  <span>CNT type</span>
                  <input value={edit.cnt_type} onChange={(event) => setEdit((current) => ({ ...current, cnt_type: event.target.value }))} />
                </label>

                <label className="admin-field">
                  <span>Public badge</span>
                  <input
                    value={edit.public_plot_badge}
                    onChange={(event) => setEdit((current) => ({ ...current, public_plot_badge: event.target.value }))}
                  />
                </label>

                <label className="admin-field">
                  <span>Extraction type</span>
                  <select
                    value={edit.value_extraction_type}
                    onChange={(event) => setEdit((current) => ({ ...current, value_extraction_type: event.target.value }))}
                  >
                    <option value="direct_or_source_table">Direct/source table</option>
                    <option value="secondary_meta_analysis">Secondary/meta-analysis</option>
                    <option value="digitized_from_figure">Digitized from figure</option>
                  </select>
                </label>

                <label className="admin-field admin-field-wide">
                  <span>Issue tags</span>
                  <input
                    value={edit.issue_types}
                    onChange={(event) => setEdit((current) => ({ ...current, issue_types: event.target.value }))}
                    placeholder="semicolon-separated tags"
                  />
                </label>

                <label className="admin-field admin-field-wide">
                  <span>Source disclosure</span>
                  <textarea
                    value={edit.source_disclosure}
                    onChange={(event) => setEdit((current) => ({ ...current, source_disclosure: event.target.value }))}
                    rows={3}
                  />
                </label>

                <label className="admin-field admin-field-wide">
                  <span>Citation requirement</span>
                  <textarea
                    value={edit.citation_requirement}
                    onChange={(event) => setEdit((current) => ({ ...current, citation_requirement: event.target.value }))}
                    rows={2}
                  />
                </label>

                <div className="admin-checkboxes">
                  <label>
                    <input
                      type="checkbox"
                      checked={edit.missing_conditions}
                      onChange={(event) => setEdit((current) => ({ ...current, missing_conditions: event.target.checked }))}
                    />
                    Missing conditions
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={edit.unit_inference_review_needed}
                      onChange={(event) => setEdit((current) => ({ ...current, unit_inference_review_needed: event.target.checked }))}
                    />
                    Unit review
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={edit.strict_comparison_ready}
                      onChange={(event) => setEdit((current) => ({ ...current, strict_comparison_ready: event.target.checked }))}
                    />
                    Strict-ready
                  </label>
                </div>

                <div className="admin-form-actions">
                  <button type="submit" disabled={saving}>
                    <Save size={16} />
                    {saving ? "Saving" : "Save review"}
                  </button>
                  <button type="button" onClick={runCleanup} disabled={saving}>
                    <Sparkles size={16} />
                    Run AI cleanup
                  </button>
                </div>
              </form>

              <section className="admin-measurements">
                <h3>Measurements</h3>
                <div>
                  {selected.measurements.map((measurement) => (
                    <p key={measurement.measurement_id}>
                      <span>{measurement.property.replace(/_/g, " ")}</span>
                      <strong>
                        {measurement.value_canonical.toPrecision(5)} {measurement.unit_canonical}
                      </strong>
                    </p>
                  ))}
                </div>
              </section>

              {(cleanupResult || selected.cleanup_runs.length > 0) && (
                <section className="admin-cleanup">
                  <h3>Cleanup output</h3>
                  <pre>{JSON.stringify(cleanupResult ?? selected.cleanup_runs[0], null, 2)}</pre>
                </section>
              )}
            </>
          )}
        </section>
      </section>
    </main>
  );
}
