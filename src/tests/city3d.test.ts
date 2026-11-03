import { describe, expect, it } from "vitest";
import { newGame } from "../core/Simulation";
import { deriveCityView, zoneDescription } from "../city3d/viewModel";
import {
  DISTRICTS,
  LANDMARKS,
  ZONE_ORDER,
  landmarkPosition,
  zoneAt,
} from "../city3d/layout";
import { BUSINESSES } from "../content/strategy";
import { JOBS } from "../content/jobs";
import { THEMES } from "../ui/theme";

describe("3D city view model", () => {
  it("projects saved state without mutating it", () => {
    const s = newGame("Morgan", "south");
    const before = JSON.stringify(s);
    const view = deriveCityView(s);
    expect(JSON.stringify(s)).toBe(before);
    expect(Object.keys(view.zones).sort()).toEqual([...ZONE_ORDER].sort());
    for (const id of ZONE_ORDER) {
      expect(view.zones[id].police).toBe(s.zones[id].police);
      expect(view.zones[id].standing).toBe(
        s.characters.player.neighborhoodStanding[id],
      );
    }
    expect(view.zones.south.isHome).toBe(true);
  });

  it("shows shared Nawf presence and an unclaimed Downtown", () => {
    const view = deriveCityView(newGame("Morgan", "south"));
    const nawf = view.zones.nawf.presence.map((p) => p.faction).sort();
    expect(nawf).toEqual(["blips", "muds"]);
    expect(view.zones.nawf.controller).toBeNull();
    const shares = view.zones.nawf.presence.reduce((n, p) => n + p.share, 0);
    expect(shares).toBeCloseTo(1);
    expect(view.zones.downtown.controller).toBeNull();
    expect(view.zones.rio.controllerColor).toBe(THEMES.angels.accent);
  });

  it("marks owned businesses and the player's job", () => {
    const s = newGame("Morgan", "south");
    s.strategic.businesses.push({
      id: "business-repair",
      definition: "repair",
      acquiredDay: 1,
      lastOperatingDay: 1,
      status: "profitable",
      provenance: "clean",
      condition: 85,
      lastNet: 23,
      totalNet: 23,
      profitableDays: 1,
      history: [],
    });
    s.employment.push({
      id: "emp-1",
      actor: s.playerId,
      jobId: "warehouse",
      employer: "resident-resevoir",
      location: "resevoir",
      status: "employed",
      hiredDay: 1,
      wage: 96,
      workdays: [0, 2, 4],
      attendance: [],
      reliability: 50,
      performance: 50,
      warnings: 0,
      rehireDay: 0,
      timeOffDays: [],
      raised: false,
      eventIds: [],
    });
    const view = deriveCityView(s);
    expect(view.landmarks["repair-counter"].owned).toBe(true);
    expect(view.landmarks["repair-counter"].status).toContain("+$23");
    expect(view.landmarks.laundry.owned).toBe(false);
    expect(view.landmarks.warehouse.employed).toBe(true);
  });

  it("places every landmark inside its own district and on real content", () => {
    for (const l of LANDMARKS) {
      const [x, z] = landmarkPosition(l);
      expect(zoneAt(x, z)).toBe(l.zone);
      if (l.business)
        expect(BUSINESSES.find((b) => b.id === l.business)?.zone).toBe(l.zone);
      if (l.job)
        expect(JOBS.find((j) => j.id === l.job)?.location).toBe(l.zone);
    }
    for (const id of ZONE_ORDER) {
      const d = DISTRICTS[id];
      expect(d.maxX).toBeGreaterThan(d.minX);
      expect(d.maxZ).toBeGreaterThan(d.minZ);
    }
  });

  it("shares the 2D map's accessible descriptions", () => {
    const s = newGame("Morgan", "south");
    expect(zoneDescription(s, "nawf")).toMatch(
      /No single controller.*The Blips.*Mudgang/,
    );
    expect(zoneDescription(s, "downtown")).toMatch(/Unclaimed/);
  });
});
