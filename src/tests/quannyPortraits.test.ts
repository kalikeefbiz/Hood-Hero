import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import manifest from "../../docs/design/QUANNY_PORTRAITS.json";
import { newGame } from "../core/Simulation";
import { player, type GameState } from "../core/GameState";
import { moveTo } from "../board/presence";
import { connect } from "../systems/Relationships";
import { acquire } from "../systems/StreetEconomy";
import { openQuanny } from "../systems/Quanny";
import {
  currentEncounter,
  respondEncounter,
  syncEncounters,
} from "../systems/Encounters";
import { characterArt, CHARACTER_ART } from "../ui/characterArt";
import { addGrievance } from "../systems/Danger";
import { quannyExpression } from "../ui/quannyExpression";

function intro(stock = false) {
  const s = newGame("Morgan", "south", 9009);
  if (stock) {
    connect(s, s.playerId, "contact-blocks");
    s.characters["contact-blocks"].relationships.player.trust = 45;
    acquire(s, "contact-blocks", "cash");
  }
  return moveTo(s, "reservoir.lil-jays");
}
function reply(s: GameState, choice: string) {
  const result = respondEncounter(s, currentEncounter(s)!.id, choice);
  expect(result.error).toBeNull();
  return result.state;
}
const encounter = (s: GameState) =>
  s.encounters.filter((e) => e.definitionId === "quanny").at(-1)!;
const pose = (s: GameState) => {
  const before = JSON.stringify(s),
    expression = quannyExpression(s, encounter(s));
  expect(JSON.stringify(s)).toBe(before);
  return characterArt(s, "quanny", expression)!.path.split("/").at(-1);
};
function fronted() {
  let s = reply(intro(true), "claim:unaffiliated");
  s = reply(s, "terms");
  return reply(s, "front");
}
function collect(notoriety: number) {
  const s = fronted();
  s.day = s.street.agreements[0].dueDay;
  player(s).notoriety = notoriety;
  openQuanny(s);
  syncEncounters(s);
  return s;
}
describe("Quanny approved portrait integration", () => {
  it("ships exactly five approved native crops as mobile WebP assets", () => {
    const approved = [
      "neutral",
      "talking",
      "disappointed",
      "pleased",
      "thinking",
    ];
    const dir = new URL(
      "../../public/assets/characters/quanny/",
      import.meta.url,
    );
    expect(readdirSync(dir).sort()).toEqual(
      approved.map((name) => `quanny-${name}.webp`).sort(),
    );
    expect(
      Object.values(CHARACTER_ART.quanny)
        .map((art) => art.path.split("/").at(-1))
        .sort(),
    ).toEqual(readdirSync(dir).sort());
    expect(manifest.assets.map((a) => a.expression).sort()).toEqual(
      approved.sort(),
    );
    for (const asset of manifest.assets) {
      const data = readFileSync(
        new URL(`../../${asset.path}`, import.meta.url),
      );
      expect(data.toString("ascii", 0, 4)).toBe("RIFF");
      expect(data.toString("ascii", 8, 12)).toBe("WEBP");
      expect(data.length).toBe(asset.bytes);
      expect(data.length).toBeLessThan(50_000);
      expect(createHash("sha256").update(data).digest("hex")).toBe(
        asset.sha256,
      );
      const registered = Object.values(CHARACTER_ART.quanny).find(
        (art) => `public/${art.path}` === asset.path,
      )!;
      expect([registered.width, registered.height]).toEqual([
        asset.width,
        asset.height,
      ]);
      expect(asset.crop[2] - asset.crop[0]).toBe(asset.width);
      expect(asset.crop[3] - asset.crop[1]).toBe(asset.height);
    }
  });
  it("uses neutral for the first question and ordinary profile display", () => {
    const s = intro();
    expect(pose(s)).toBe("quanny-neutral.webp");
    expect(characterArt(s, "quanny")!.path).toContain("quanny-neutral.webp");
  });
  it("talks through affiliations and existing consignment terms", () => {
    let s = reply(intro(true), "claim:unaffiliated");
    expect(pose(s)).toBe("quanny-talking.webp");
    s = reply(s, "terms");
    expect(pose(s)).toBe("quanny-talking.webp");
    const other = intro();
    player(other).affiliation = "muds";
    expect(pose(reply(other, "claim:muds"))).toBe("quanny-talking.webp");
  });
  it.each(["claim:blocks", "claim:angels", "leave"])(
    "uses quiet disapproval for %s",
    (choice) => {
      const s =
        choice === "leave"
          ? reply(reply(intro(), "claim:unaffiliated"), choice)
          : reply(intro(), choice);
      expect(pose(s)).toBe("quanny-disappointed.webp");
    },
  );
  it("distinguishes successful and failed negotiation using actual agreement evidence", () => {
    let failed = reply(intro(true), "claim:unaffiliated");
    failed = reply(failed, "terms");
    failed = reply(failed, "negotiate");
    expect(failed.street.agreements).toHaveLength(0);
    expect(pose(failed)).toBe("quanny-disappointed.webp");
    let accepted = reply(intro(true), "claim:unaffiliated");
    player(accepted).skills.social = 65;
    accepted = reply(accepted, "terms");
    accepted = reply(accepted, "negotiate");
    expect(accepted.street.agreements).toHaveLength(1);
    expect(pose(accepted)).toBe("quanny-pleased.webp");
    expect(pose(fronted())).toBe("quanny-pleased.webp");
  });
  it("calculates while reviewing real proposals and pending collections", () => {
    const proposal = reply(reply(intro(true), "claim:unaffiliated"), "leave");
    openQuanny(proposal);
    syncEncounters(proposal);
    expect(pose(proposal)).toBe("quanny-thinking.webp");
    expect(pose(collect(35))).toBe("quanny-thinking.webp");
  });
  it("shows paid and refused collection outcomes without rerolling or changing the saved state", () => {
    const paid = reply(collect(35), "collect");
    expect(pose(paid)).toBe("quanny-pleased.webp");
    const refused = reply(collect(34), "collect");
    expect(pose(refused)).toBe("quanny-disappointed.webp");
    player(refused).notoriety = 100;
    expect(pose(refused)).toBe("quanny-disappointed.webp");
    expect(refused.street.agreements[0].status).toBe("disputed");
  });
  it("keeps an unresolved negative street conversation disappointed, and a settled one pleased", () => {
    const s = intro(),
      e = structuredClone(encounter(s));
    const conflict = addGrievance(
      s,
      "quanny",
      s.playerId,
      "An existing disagreement",
      e.sourceEventId!,
      40,
    );
    conflict.state = "cooling";
    const scene = {
      id: "portrait-scene",
      npc: "quanny",
      location: "reservoir.lil-jays",
      day: s.day,
      motive: "history" as const,
      conflictId: conflict.id,
      status: "resolved" as const,
      outcome: "Heard out; unresolved",
    };
    s.danger.scenes.push(scene);
    e.definitionId = "living-danger";
    e.dangerSceneId = scene.id;
    e.selectedResponses = [{ id: "explain", day: s.day, eventIds: [] }];
    expect(quannyExpression(s, e)).toBe("concerned");
    conflict.state = "settled";
    expect(quannyExpression(s, e)).toBe("confident");
  });
  it("uses a calculating reaction to a later reconciliation attempt", () => {
    let s = reply(collect(34), "collect");
    s.day++;
    openQuanny(s);
    syncEncounters(s);
    s = reply(s, "reconcile");
    expect(pose(s)).toBe("quanny-thinking.webp");
  });
});
