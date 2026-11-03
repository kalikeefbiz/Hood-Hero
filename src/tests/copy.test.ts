import { describe, expect, it, vi } from "vitest";
import * as text from "../content/copy";
import {
  formatCopy,
  placeholders,
  validateTemplate,
} from "../content/copy-rules";
import { COPY_CONTRACT } from "../content/copy-contract";
import { newGame } from "../core/Simulation";
import { ENCOUNTERS } from "../content/encounters";
import { openCrewConversation } from "../systems/EncounterLifecycle";
import { openSupplier } from "../content/streetEncounters";

describe("editable copy", () => {
  it("validates every bundled entry and supplies every declared variable", () => {
    for (const [key, names] of Object.entries(COPY_CONTRACT)) {
      const values = Object.fromEntries(names.map((n) => [n, "VALUE"]));
      // Exercise the runtime boundary too, independently of compile-time key checking.
      const render = text.copy as (
        key: string,
        values?: Record<string, string>,
      ) => string;
      expect(() =>
        render(key, ...(names.length ? [values] : [])),
      ).not.toThrow();
    }
  });
  it("inserts names, numbers, currency, quantities and deadlines without interpreting inserted text", () => {
    expect(
      formatCopy(
        "test",
        "{player}: {character} owes ${amount} for {quantity} units before day {deadline}, to {faction}.",
        ["player", "character", "amount", "quantity", "deadline", "faction"],
        {
          player: "Kai $& {amount}",
          character: "Mega",
          amount: 102,
          quantity: 6,
          deadline: 8,
          faction: "Back Street",
        },
      ),
    ).toBe(
      "Kai $& {amount}: Mega owes $102 for 6 units before day 8, to Back Street.",
    );
    expect(
      formatCopy("html", "{player}", ["player"], {
        player: '<img src=x onerror="alert(1)">',
      }),
    ).toBe('<img src=x onerror="alert(1)">');
  });
  it("rejects missing or unknown variables, invalid numbers, unknown IDs and malformed placeholders", () => {
    expect(() => formatCopy("x", "{amount}", ["amount"], {})).toThrow(
      "expected variables",
    );
    expect(() =>
      formatCopy("x", "{amount}", ["amount"], { amount: 2, extra: 3 }),
    ).toThrow("expected variables");
    expect(() =>
      formatCopy("x", "{amount}", ["amount"], { amount: NaN }),
    ).toThrow("finite number");
    expect(() => validateTemplate("x", "{unknown}", ["amount"])).toThrow(
      "expected placeholders",
    );
    expect(() => placeholders("{broken")).toThrow("Malformed placeholder");
    expect(() => (text.copy as (key: string) => string)("absent")).toThrow(
      "Missing copy identifier",
    );
  });
  it("keeps response IDs, effects and eligibility independent of displayed wording", () => {
    let s = newGame("Creator", "south");
    s = openCrewConversation(s, "flacco");
    s.characters.player.connections.push("mega");
    s = openSupplier(s, "mega");
    const snapshots = () =>
      s.encounters.map((e) => {
        const d = ENCOUNTERS.find((d) => d.id === e.definitionId)!;
        return {
          id: e.id,
          eligible: d.eligible(s, e),
          responses: d
            .responses(s, e)
            .map((r) => ({
              id: r.id,
              effect: r.effect,
              error: r.requirement?.(s, e),
            })),
        };
      });
    const before = snapshots();
    const mock = vi
      .spyOn(text, "copy")
      .mockReturnValue("Creator changed this sentence.");
    try {
      expect(snapshots()).toEqual(before);
    } finally {
      mock.mockRestore();
    }
  });
});
