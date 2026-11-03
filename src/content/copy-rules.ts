// Shared by the bundled text renderer and authoring validation. No executable content.
export type CopyValue = string | number;
export function placeholders(text: string): string[] {
  const names = [...text.matchAll(/\{([A-Za-z][A-Za-z0-9]*)\}/g)].map(
    (m) => m[1],
  );
  if (/[{}]/.test(text.replace(/\{[A-Za-z][A-Za-z0-9]*\}/g, "")))
    throw new Error("Malformed placeholder: use {name} with the existing name");
  return [...new Set(names)].sort();
}
export function validateTemplate(
  key: string,
  text: unknown,
  required: readonly string[],
): asserts text is string {
  if (typeof text !== "string" || !text.trim())
    throw new Error(`${key}: expected non-empty text`);
  const found = placeholders(text);
  if (JSON.stringify(found) !== JSON.stringify([...required].sort()))
    throw new Error(
      `${key}: expected placeholders [${required.join(", ")}], found [${found.join(", ")}]`,
    );
}
export function formatCopy(
  key: string,
  text: string,
  required: readonly string[],
  values: Record<string, CopyValue> = {},
): string {
  validateTemplate(key, text, required);
  const supplied = Object.keys(values).sort();
  if (JSON.stringify(supplied) !== JSON.stringify([...required].sort()))
    throw new Error(
      `${key}: expected variables [${required.join(", ")}], received [${supplied.join(", ")}]`,
    );
  for (const [name, value] of Object.entries(values))
    if (
      typeof value !== "string" &&
      (typeof value !== "number" || !Number.isFinite(value))
    )
      throw new Error(`${key}: ${name} must be text or a finite number`);
  // Callback replacement preserves literal $, braces and replacement metacharacters in names.
  // Values are inserted once; user text is never interpreted as another template or HTML.
  return text.replace(/\{([A-Za-z][A-Za-z0-9]*)\}/g, (_, name: string) =>
    String(values[name]),
  );
}
export function flattenCopy(
  value: unknown,
  prefix = "",
  result: Record<string, string> = {},
): Record<string, string> {
  if (typeof value === "string") {
    result[prefix] = value;
  } else {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      !Object.keys(value).length
    )
      throw new Error(`${prefix}: expected a text entry or non-empty object`);
    for (const [key, child] of Object.entries(value)) {
      if (!/^[A-Za-z0-9][A-Za-z0-9-]*$/.test(key))
        throw new Error(`${prefix}: invalid text identifier ${key}`);
      flattenCopy(child, prefix ? `${prefix}.${key}` : key, result);
    }
  }
  return result;
}
