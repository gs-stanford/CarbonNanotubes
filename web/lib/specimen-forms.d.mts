export const FORM_LABELS: Readonly<Record<string, string>>;
export const DEFAULT_FIGURE_FORMS: readonly string[];
export function referenceForm(sample: unknown, doi?: unknown): string | null;
export function validateSpecimenForms(records: Record<string, string>[], measurements: Record<string, string>[]): void;
