import { describe, expect, it } from "vitest";
import { newGame } from "../core/Simulation";
import { performAction } from "../core/ActionEngine";
import { LOCATIONS } from "../board/locations";
import { deriveBlocks } from "../board/blocks";
import { placeActions, placeFacts, placePeople } from "../board/interactions";
import { deriveBoardView } from "../board/viewModel";
import {
  ALL_BLOCKS,
  distanceToPath,
  locationBlock,
  locationPosition,
  riverPath,
  RIVER_WIDTH,
  zoneAt,
} from "../city3d/layout";
import { BUSINESSES } from "../content/strategy";
import { JOBS } from "../content/jobs";
import { ITEMS } from "../content/economy";

const findPlace = (id: string) => LOCATIONS.find((l) => l.id === id)!;

describe("location registry", () => {
  it("gives every place a unique id, its own block, and real content links", () => {
    const ids = new Set<string>(),
      blocks = new Map<string, string>();
    const river = riverPath();
    for (const l of LOCATIONS) {
      expect(ids.has(l.id), l.id).toBe(false);
      ids.add(l.id);
      expect(l.id.startsWith(`${l.zone}.`), l.id).toBe(true);
      const [x, z] = locationPosition(l);
      expect(zoneAt(x, z), l.id).toBe(l.zone);
      const b = locationBlock(l);
      expect(b, l.id).not.toBeNull();
      expect(blocks.get(b!.id), `${l.id} shares ${b!.id}`).toBeUndefined();
      blocks.set(b!.id, l.id);
      if (l.archetype !== "docks")
        expect(distanceToPath(river, x, z), l.id).toBeGreaterThan(RIVER_WIDTH / 2 + 2);
      if (l.links.business)
        expect(BUSINESSES.find((d) => d.id === l.links.business)?.zone).toBe(l.zone);
      if (l.links.job) expect(JOBS.find((j) => j.id === l.links.job)?.location).toBe(l.zone);
      for (const item of l.links.items ?? []) expect(ITEMS[item]).toBeDefined();
      if (l.status === "live")
        expect(Object.values(l.links).some(Boolean), `${l.id} is live without links`).toBe(true);
    }
  });
  it("spells The Reservoir correctly everywhere the player sees it", () => {
    const s = newGame("Morgan", "reservoir");
    expect(s.zones.reservoir.name).toBe("The Reservoir");
    expect(LOCATIONS.some((l) => /Resevoir/.test(l.name + l.description))).toBe(false);
  });
});

describe("block influence (presentation of territory state)", () => {
  it("splits The Nawf between Blips in the west and Mudgang in the east", () => {
    const view = deriveBlocks(newGame("Morgan", "south"));
    const nawf = ALL_BLOCKS.filter((b) => b.zone === "nawf" && !b.waterfront);
    const west = nawf.filter((b) => b.col === 0).map((b) => view[b.id].faction);
    const east = nawf.filter((b) => b.col === 5).map((b) => view[b.id].faction);
    expect(west.every((f) => f === "blips")).toBe(true);
    expect(east.every((f) => f === "muds")).toBe(true);
  });
  it("leaves Downtown unmarked and follows presence", () => {
    const s = newGame("Morgan", "south");
    const before = Object.values(deriveBlocks(s)).filter((b) => b.zone === "south" && b.faction).length;
    expect(Object.values(deriveBlocks(s)).filter((b) => b.zone === "downtown" && b.faction)).toHaveLength(0);
    s.strategic.territories.south.factions.backstreet.presence = 20;
    const after = Object.values(deriveBlocks(s)).filter((b) => b.zone === "south" && b.faction).length;
    expect(after).toBeLessThan(before);
  });
});

describe("place interactions route into existing systems", () => {
  it("offers job, shopping and rest moves at the right places", () => {
    const s = newGame("Morgan", "south");
    const mart = placeActions(s, findPlace("south.food-mart")).map((a) => a.type);
    expect(mart).toContain("apply");
    expect(mart).toContain("buy");
    expect(placeActions(s, findPlace("south.towers")).map((a) => a.type)).toContain("rest");
    expect(placeActions(s, findPlace("nawf.projects")).map((a) => a.type)).not.toContain("rest");
    expect(placeActions(s, findPlace("downtown.docks")).map((a) => a.type)).toEqual(["gig"]);
    expect(placeActions(s, findPlace("rio.taqueria"))).toHaveLength(0);
  });
  it("performs a real action from a place and reflects the result", () => {
    const s = newGame("Morgan", "south");
    const apply = placeActions(s, findPlace("south.food-mart")).find((a) => a.type === "apply")!;
    const r = performAction(s, apply);
    expect(r.error).toBeNull();
    expect(placeFacts(r.state, findPlace("south.auto-repair"))[0]).toMatch(/Available/);
  });
  it("lists district residents at gathering places", () => {
    const s = newGame("Morgan", "south");
    const people = placePeople(s, findPlace("nawf.court"));
    expect(people.length).toBeGreaterThan(0);
    expect(people.every((p) => s.characters[p.id].home === "nawf")).toBe(true);
  });
  it("derives the board view without mutating the save", () => {
    const s = newGame("Morgan", "south");
    const raw = JSON.stringify(s);
    const view = deriveBoardView(s);
    expect(JSON.stringify(s)).toBe(raw);
    expect(view.places["south.towers"].home).toBe(true);
    expect(view.places["south.food-mart"].live).toBe(true);
  });
});
