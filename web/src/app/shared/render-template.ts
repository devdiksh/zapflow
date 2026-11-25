/**
 * Same rules as the server's renderTemplate (server/src/services/template.ts),
 * used for the builder's live preview with sample values.
 */
const PLACEHOLDER = /\{\{\s*([\w.]+)\s*\}\}/g;

export function renderTemplate(template: string, values: Readonly<Record<string, string>>): string {
  return template.replace(PLACEHOLDER, (placeholder, key: string) =>
    Object.hasOwn(values, key) ? (values[key] ?? '') : placeholder,
  );
}

/** Placeholders in the template that the trigger doesn't provide (likely typos). */
export function unknownPlaceholders(template: string, knownKeys: readonly string[]): string[] {
  const unknown = new Set<string>();
  for (const [, key] of template.matchAll(PLACEHOLDER)) {
    if (key && !knownKeys.includes(key)) {
      unknown.add(key);
    }
  }
  return [...unknown];
}
