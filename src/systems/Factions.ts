import { clamp, type GameState, type ZoneId } from "../core/GameState";
import { applyInfluence, dominanceScore } from "./Territory";
import { STRATEGY_BALANCE as B } from "../content/strategy";
import type { DecisionKind, EffectKind } from "./StrategicTypes";
export function advanceFactions(s: GameState) {
  for (const f of Object.values(s.factions)) {
    const strategy = s.strategic.strategies[f.id];
    const held = Object.values(s.strategic.territories).filter(
      (t) => t.controller === f.id,
    ).length;
    const economies = Object.values(s.strategic.territories).reduce(
      (n, t) => n + t.factions[f.id].economy * 0.025,
      0,
    );
    // Upkeep and diminishing returns constrain resource growth and overextension.
    f.resources = clamp(
      f.resources +
        economies +
        held * 1.5 -
        5 -
        held * 2 -
        f.instability * 0.025,
      0,
      B.resourceCap,
    );
    if (f.id === "backstreet") f.instability = clamp(f.instability + 0.12);
    const leadership = f.leaders.reduce((n, id) => {
      const c = s.characters[id];
      return (
        n +
        (c.status === "dead"
          ? 0
          : c.influence * (c.status === "arrested" ? 0.35 : 1))
      );
    }, 0);
    s.strategic.territories[f.home].factions[f.id].influence = clamp(
      s.strategic.territories[f.home].factions[f.id].influence +
        leadership / 3000,
    );
    if (s.day < strategy.nextDecisionDay) continue;
    const home = s.strategic.territories[f.home];
    const options: {
      kind: DecisionKind;
      zone: ZoneId;
      score: number;
      cost: number;
    }[] = [];
    const add = (
      kind: DecisionKind,
      zone: ZoneId,
      score: number,
      cost: number,
    ) => {
      if (f.resources >= cost) options.push({ kind, zone, score, cost });
    };
    add(
      "recover",
      f.home,
      f.instability * 0.9 + (f.resources < 120 ? 70 : 0),
      0,
    );
    for (const z of Object.values(s.zones)) {
      const t = s.strategic.territories[z.id],
        q = t.factions[f.id],
        own = t.controller === f.id;
      const score = dominanceScore(s, z.id, f.id);
      const enemy = f.enemies.some((id) => t.factions[id].presence > 30);
      const rivalPressure = Math.max(
        0,
        ...f.enemies.map((id) => t.factions[id].pressure),
      );
      const priority =
        strategy.priority === z.id && strategy.priorityUntil >= s.day ? 25 : 0;
      if (own || z.id === f.home)
        add(
          "maintain",
          z.id,
          18 +
            (70 - score) * 0.8 +
            rivalPressure * 0.4 +
            (z.id === f.home ? 8 : 0) +
            priority,
          18,
        );
      if (q.presence > 20)
        add(
          "economy",
          z.id,
          17 +
            (70 - q.economy) * 0.6 +
            (f.priority === "commerce" ? 18 : 0) +
            (f.resources < 300 ? 22 : 0),
          12,
        );
      if (!own && q.presence >= 25)
        add(
          "contest",
          z.id,
          15 +
            (enemy ? 18 : 0) +
            (f.priority === "status" ? 12 : 0) +
            (65 - score) * 0.25 +
            priority -
            (held >= 3 ? 25 : 0),
          32 + held * 8,
        );
      if (!own)
        add(
          "expand",
          z.id,
          12 +
            z.commerce * 0.18 +
            (q.presence < 35 ? 15 : 0) +
            (f.priority === "commerce" ? 8 : 0) +
            priority -
            (t.controller && f.allies.includes(t.controller) ? 35 : 0) -
            held * 9 -
            z.police * 0.1,
          40 + held * 10,
        );
    }
    // Deterministic tie-break; priorities and deficits drive the decision, not a random rotation.
    options.sort((a, b) => b.score - a.score);
    const choice = options[0];
    if (!choice) continue;
    f.resources -= choice.cost;
    const politicalCrisis = f.instability >= 60;
    let kind: EffectKind = "support",
      magnitude = 10;
    if (choice.kind === "recover") {
      f.instability = clamp(f.instability - 12);
      f.resources = clamp(f.resources + 22, 0, B.resourceCap);
      kind = "community";
      magnitude = 4;
      const ally = f.allies
        .map((id) => s.factions[id])
        .find((a) => a.resources > 500 && f.resources < 180);
      if (ally) {
        ally.resources -= 20;
        f.resources += 20;
      }
    } else if (choice.kind === "economy") {
      kind = "economic";
      magnitude = 13;
      f.resources = clamp(f.resources + 20, 0, B.resourceCap);
    } else if (choice.kind === "maintain") {
      kind = "defense";
      magnitude = 9;
      f.instability = clamp(f.instability - 1);
    } else if (choice.kind === "contest") {
      kind = "challenge";
      magnitude = 12;
      f.instability = clamp(f.instability + 2);
      const target =
        s.strategic.territories[choice.zone].controller ??
        f.enemies.find(
          (id) =>
            s.strategic.territories[choice.zone].factions[id].presence > 30,
        );
      if (target && target !== f.id && !f.allies.includes(target))
        applyInfluence(s, {
          actor: f.id,
          faction: target,
          zone: choice.zone,
          kind: "disruption",
          magnitude: 7,
          cause: `${f.name} disrupted competing interests in ${s.zones[choice.zone].name}.`,
        });
    } else {
      kind = "support";
      magnitude = 13;
    }
    const labels = {
      maintain: "reinforced its position",
      expand: "invested in a wider foothold",
      contest: "challenged competing influence",
      recover: "repaired internal loyalty and resources",
      economy: "backed commercial interests",
    };
    const e = applyInfluence(s, {
      actor: f.id,
      faction: f.id,
      zone: choice.zone,
      kind,
      magnitude,
      cause: `${f.name} ${labels[choice.kind]} in ${s.zones[choice.zone].name}.`,
    });
    if (
      politicalCrisis &&
      choice.kind === "recover" &&
      !s.events.some(
        (x) =>
          x.id !== e.id &&
          x.factionId === f.id &&
          x.title === "Leadership conflict" &&
          s.day - x.day < 20,
      )
    ) {
      e.importance = "major";
      e.title = "Leadership conflict";
      e.text +=
        f.id === "backstreet"
          ? " Generational tensions continue under the established leadership."
          : " Leadership had to prioritize internal loyalty over expansion.";
    }
    strategy.lastDecision = choice.kind;
    strategy.target = choice.zone;
    strategy.nextDecisionDay =
      s.day + B.decisionInterval + (f.priority === "stability" ? 1 : 0);
    strategy.history.push({
      day: s.day,
      kind: choice.kind,
      zone: choice.zone,
      cost: choice.cost,
      eventId: e.id,
    });
    // Presence needs local social investment as well as economic spending.
    if (choice.kind === "maintain" || choice.kind === "expand")
      applyInfluence(s, {
        actor: f.id,
        faction: f.id,
        zone: choice.zone,
        kind: "community",
        magnitude: 4,
        cause: `${f.name} maintained local relationships in ${s.zones[choice.zone].name}.`,
      });
    if (choice.kind === "maintain")
      applyInfluence(s, {
        actor: f.id,
        faction: f.id,
        zone: choice.zone,
        kind: "support",
        magnitude: 4,
        cause: `${f.name} kept its neighborhood network active.`,
      });
  }
}
