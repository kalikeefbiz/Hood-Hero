import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseCopyJSON, validateCopy } from "./validate-copy.ts";
test("strict JSON rejects duplicate identifiers at every depth, malformed JSON and non-JSON syntax", () => {
  for (const source of [
    '{"a":"x","a":"y"}',
    '{"a":{"b":"x","b":"y"}}',
    '{"a":"x",}',
    '{"a":“x”}',
    '{/*comment*/"a":"x"}',
  ])
    assert.throws(() => parseCopyJSON(source, "test.json"));
});
test("author edits pass; broken contracts, placeholders, structures and unused entries fail", () => {
  const root = mkdtempSync(join(tmpdir(), "hood-copy-"));
  try {
    cpSync("src", join(root, "src"), { recursive: true });
    assert.ok(validateCopy(root) > 600);
    const file = join(root, "src/content/copy/actions.json");
    const original = readFileSync(file, "utf8");
    const edit = (fn) => {
      const json = JSON.parse(original);
      fn(json);
      writeFileSync(file, JSON.stringify(json));
    };
    edit(
      (j) => (j.reachOut.description = "The creator can revise this sentence."),
    );
    assert.doesNotThrow(() => validateCopy(root));
    for (const mutate of [
      (j) => delete j.reachOut.description,
      (j) => (j.reachOut.description = "Missing {player}"),
      (j) => (j.reachOut.description = ["wrong shape"]),
      (j) => (j.obsolete = "Unused text"),
      (j) => (j.reachOut.description = ""),
      (j) => (j.cards.clean = "Removed its required variables."),
    ]) {
      edit(mutate);
      assert.throws(() => validateCopy(root));
    }
    writeFileSync(file, original);
    const source = join(root, "src/core/ActionEngine.ts");
    writeFileSync(
      source,
      readFileSync(source, "utf8").replace(
        'copy("actions.reachOut.description")',
        '"obsolete literal"',
      ),
    );
    assert.throws(() => validateCopy(root), /Unused copy identifier/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
