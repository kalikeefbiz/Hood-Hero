import { readFileSync, readdirSync } from "node:fs";
import { resolve, relative } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { COPY_CONTRACT } from "../src/content/copy-contract.ts";
import { flattenCopy, validateTemplate } from "../src/content/copy-rules.ts";
export function parseCopyJSON(source: string, file: string): unknown {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch (e) {
    throw new Error(`${file}: invalid JSON: ${(e as Error).message}`);
  }
  // JSON.parse alone silently accepts duplicate object keys. Inspect every JSON object too.
  const ast = ts.parseJsonText(file, source);
  function visit(node: ts.Node) {
    if (ts.isObjectLiteralExpression(node)) {
      const keys = new Set<string>();
      for (const property of node.properties) {
        if (
          !ts.isPropertyAssignment(property) ||
          !ts.isStringLiteral(property.name)
        )
          throw new Error(`${file}: keys must be quoted`);
        const key = property.name.text;
        if (keys.has(key))
          throw new Error(`${file}: duplicate identifier "${key}"`);
        keys.add(key);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return value;
}
function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(resolve(dir, e.name)) : [resolve(dir, e.name)],
  );
}
export function validateCopy(root = process.cwd()): number {
  const copyDir = resolve(root, "src/content/copy");
  const all: Record<string, string> = {};
  for (const file of files(copyDir)) {
    if (!file.endsWith(".json"))
      throw new Error(`${file}: only JSON content is supported`);
    const prefix = relative(copyDir, file)
      .replace(/\.json$/, "")
      .split(/[\\/]/)
      .join(".");
    flattenCopy(parseCopyJSON(readFileSync(file, "utf8"), file), prefix, all);
  }
  for (const [key, required] of Object.entries(COPY_CONTRACT)) {
    if (!Object.hasOwn(all, key))
      throw new Error(`Missing required copy identifier: ${key}`);
    validateTemplate(key, all[key], required);
  }
  for (const key of Object.keys(all))
    if (!Object.hasOwn(COPY_CONTRACT, key))
      throw new Error(`Unexpected/obsolete copy identifier: ${key}`);
  const used = new Set<string>();
  for (const file of files(resolve(root, "src")).filter(
    (f) => /\.tsx?$/.test(f) && !f.includes("/tests/"),
  )) {
    const ast = ts.createSourceFile(
      file,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    function visit(node: ts.Node) {
      if (
        ts.isCallExpression(node) &&
        node.expression.getText(ast) === "copy"
      ) {
        const key = node.arguments[0];
        if (!key || !ts.isStringLiteral(key))
          throw new Error(`${file}: copy IDs must be explicit literals`);
        if (!Object.hasOwn(COPY_CONTRACT, key.text))
          throw new Error(`${file}: unknown copy ID ${key.text}`);
        used.add(key.text);
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
  for (const key of Object.keys(COPY_CONTRACT))
    if (!used.has(key)) throw new Error(`Unused copy identifier: ${key}`);
  return Object.keys(all).length;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    console.log(
      `Copy valid: ${validateCopy()} text entries; JSON, IDs, structure, placeholders and usage checked.`,
    );
  } catch (e) {
    console.error((e as Error).message);
    process.exitCode = 1;
  }
}
