/**
 * Field mapping: replaces `{{field.key}}` placeholders with values from the
 * trigger. Unknown placeholders are left as-is so a typo is visible in the
 * posted comment instead of silently disappearing.
 */
const PLACEHOLDER = /\{\{\s*([\w.]+)\s*\}\}/g;

export function renderTemplate(template: string, values: Readonly<Record<string, string>>): string {
  // A replacer function (not a string) so `$&`-style patterns in PR titles are taken literally.
  return template.replace(PLACEHOLDER, (placeholder, key: string) =>
    Object.hasOwn(values, key) ? (values[key] ?? '') : placeholder,
  );
}
