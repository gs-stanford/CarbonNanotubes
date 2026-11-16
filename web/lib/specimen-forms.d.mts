export const FORM_LABELS: Readonly<Record<string, string>>;
export const REFERENCE_FORM_GROUP: Readonly<{ key: string; label: string; forms: readonly string[] }>;
export const FIGURE_FORM_LABELS: Readonly<Record<string, string>>;
export function figureFormGroup(form: string): string;
export const DEFAULT_FIGURE_FORMS: readonly string[];
export function referenceForm(sample: unknown, doi?: unknown): string | null;
export function validateSpecimenForms(records: Record<string, string>[], measurements: Record<string, string>[]): void;
