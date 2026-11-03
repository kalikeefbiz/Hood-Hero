import { describe, expect, it } from "vitest";
import { newGame } from "../core/Simulation";
import {
  assessRisk,
  moveTo,
  onArrival,
  presenceOf,
  setAppearance,
} from "../board/presence";
import { deserialize, serialize } from "../persistence/SaveSystem";

describe("player presence", () => {
  it("starts at home, moves, keeps a trail and survives a save", () => {
    let s = newGame("Morgan", "south");
    expect(presenceOf(s).location).toBe("south.towers");
    s = moveTo(s, "south.food-mart");
    s = moveTo(s, "nawf.bodega");
    const p = presenceOf(s);
    expect(p.location).toBe("nawf.bodega");
    expect(p.zone).toBe("nawf");
    expect(p.trail.map((t) => t.location)).toEqual([
      "south.towers",
      "south.food-mart",
    ]);
    s = setAppearance(s, { ...p.appearance, hair: "locs", chain: true });
    const back = deserialize(serialize(s));
    expect(back.presence?.location).toBe("nawf.bodega");
    expect(back.presence?.appearance.hair).toBe("locs");
  });
  it("reads risk from turf, contest, police and affiliation", () => {
    const s = newGame("Morgan", "south");
    expect(assessRisk(s, "south.towers").level).toBe("safe");
    s.strategic.territories.nawf.contested = true;
    expect(["watchful", "tense", "hostile"]).toContain(
      assessRisk(s, "nawf.deli").level,
    );
    s.characters.player.affiliation = "blips";
    const muds = assessRisk(s, "nawf.deli");
    expect(muds.level).toBe("hostile");
    expect(muds.reasons[0]).toMatch(/at war/);
    expect(assessRisk(s, "nawf.bodega").score).toBeLessThan(muds.score);
  });
  it("lets future systems react to arrivals without touching the board", () => {
    const seen: string[] = [];
    const off = onArrival((state, location, risk) => {
      seen.push(`${location}:${risk.level}`);
      return state;
    });
    moveTo(newGame("Morgan", "south"), "downtown.precinct");
    off();
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatch(/^downtown.precinct:/);
  });
});
