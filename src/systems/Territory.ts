import {
  clamp,
  type GameState,
  type FactionId,
  type ZoneId,
} from "../core/GameState";
import { record } from "../core/EventLog";
import { STRATEGY_BALANCE as B } from "../content/strategy";
import { EFFECT_KINDS } from "./StrategicTypes";
import type {
  InfluenceEffect,
  StrategicState,
  Territory,
} from "./StrategicTypes";
export function newStrategy(
  s: Pick<GameState, "zones" | "factions">,
): StrategicState {
  const ids = Object.keys(s.factions) as FactionId[];
  return {
    territories: Object.fromEntries(
      Object.values(s.zones).map((z) => [
        z.id,
        {
          factions: Object.fromEntries(
            ids.map((id) => {
              const home = s.factions[id].home === z.id;
              return [
                id,
                {
                  presence: home ? 75 : 4,
                  influence: home ? 72 : 5,
                  economy: home ? 62 : 5,
                  support: home ? Math.max(35, z.support) : 12,
                  pressure: home && z.id === "nawf" ? 36 : 0,
                },
              ];
            }),
          ),
          controller: z.controller,
          contested: z.id === "nawf",
          candidate: null,
          candidateDays: 0,
          weakDays: 0,
          lastResolvedDay: 1,
          controlSince: 1,
          lawfulEconomy: z.commerce,
          changes: [],
        },
      ]),
    ) as unknown as Record<ZoneId, Territory>,
    strategies: Object.fromEntries(
      ids.map((id, i) => [
        id,
        {
          nextDecisionDay: id === "backstreet" ? 2 : 2 + (i % 3),
          lastDecision: null,
          target: s.factions[id].home,
          priority: null,
          priorityUntil: 0,
          history: [],
        },
      ]),
    ) as unknown as StrategicState["strategies"],
    effects: [],
    contributions: Object.fromEntries(ids.map((id) => [id, 0])) as Record<
      FactionId,
      number
    >,
    membershipDay: null,
    lastActionDay: 0,
    lastPromotionDay: 0,
    businesses: [],
    lawfulStreak: 0,
    lastCrimeDay: null,
    ending: null,
  };
}
// The small integration boundary: validates first, applies bounded deltas, and records evidence.
// Controller writes are deliberately excluded; only resolveTerritories can recognize control.
export function applyInfluence(s: GameState, effect: InfluenceEffect) {
  if (!s.characters[effect.actor] && !s.factions[effect.actor as FactionId])
    throw new Error("Unknown strategic actor");
  if (
    !EFFECT_KINDS.includes(effect.kind) ||
    (!effect.faction && !["economic", "community"].includes(effect.kind)) ||
    !s.zones[effect.zone] ||
    (effect.faction && !s.factions[effect.faction]) ||
    !Number.isFinite(effect.magnitude) ||
    effect.magnitude <= 0 ||
    !effect.cause.trim() ||
    effect.participants?.some((id) => !s.characters[id])
  )
    throw new Error("Invalid influence effect");
  const magnitude = clamp(effect.magnitude, 0, B.effectCap),
    t = s.strategic.territories[effect.zone];
  const q = effect.faction ? t.factions[effect.faction] : null;
  if (q) {
    const add = (key: keyof typeof q, n: number) => {
      q[key] = clamp(q[key] + n);
    };
    switch (effect.kind) {
      case "economic":
        add("presence", magnitude * 0.3);
        add("economy", magnitude);
        break;
      case "community":
        add("support", magnitude);
        add("presence", magnitude * 0.2);
        break;
      case "support":
        add("presence", magnitude);
        add("influence", magnitude * 0.7);
        break;
      case "defense":
        add("influence", magnitude);
        add("support", magnitude * 0.3);
        break;
      case "challenge":
        add("pressure", magnitude);
        add("presence", magnitude * 0.4);
        add("influence", magnitude * 0.8);
        break;
      case "reputation-loss":
        add("support", -magnitude);
        add("influence", -magnitude * 0.4);
        break;
      case "disruption":
        add("economy", -magnitude);
        add("influence", -magnitude * 0.5);
        break;
      default:
        throw new Error("Unknown influence kind");
    }
  } else if (effect.kind === "economic")
    t.lawfulEconomy = clamp(t.lawfulEconomy + magnitude * 0.2);
  else if (effect.kind === "community")
    s.zones[effect.zone].support = clamp(
      s.zones[effect.zone].support + magnitude * 0.3,
    );
  const e = record(
    s,
    "city",
    effect.cause,
    [effect.actor, ...(effect.participants ?? [])],
    [s.playerId],
    {
      factionId: effect.faction ?? undefined,
      title: "Neighborhood influence",
      importance: "routine",
    },
  );
  s.strategic.effects.push({ ...effect, magnitude, day: s.day, eventId: e.id });
  // Detailed effects are a rolling integration journal; the attributed events remain campaign history.
  s.strategic.effects = s.strategic.effects.slice(-200);
  syncTerritory(s, effect.zone);
  return e;
}
export function dominanceScore(s: GameState, zone: ZoneId, id: FactionId) {
  const q = s.strategic.territories[zone].factions[id],
    f = s.factions[id];
  const opposing = Math.max(
    0,
    ...Object.entries(s.strategic.territories[zone].factions)
      .filter(([other]) => other !== id)
      .map(([, v]) => v.pressure),
  );
  return clamp(
    q.influence * 0.42 +
      q.presence * 0.2 +
      q.economy * 0.18 +
      q.support * 0.2 +
      Math.min(f.resources / 200, 4) -
      f.instability * 0.07 -
      opposing * 0.08,
  );
}
export function syncTerritory(s: GameState, zone: ZoneId) {
  const t = s.strategic.territories[zone],
    z = s.zones[zone];
  const ranked = (Object.keys(t.factions) as FactionId[]).sort(
    (a, b) => dominanceScore(s, zone, b) - dominanceScore(s, zone, a),
  );
  t.contested =
    ranked.filter((id) => t.factions[id].presence >= 25).length > 1 &&
    (dominanceScore(s, zone, ranked[0]) - dominanceScore(s, zone, ranked[1]) <
      B.controlMargin ||
      ranked.some(
        (id) => id !== t.controller && t.factions[id].pressure >= 20,
      ));
  z.controller = t.controller;
  z.organizations = ranked.filter((id) => t.factions[id].presence >= 20);
  for (const id of ranked)
    s.factions[id].influence[zone] = t.factions[id].influence;
}
function changeControl(s: GameState, zone: ZoneId, to: FactionId | null) {
  const t = s.strategic.territories[zone],
    from = t.controller;
  const e = record(
    s,
    "city",
    `${s.zones[zone].name}: ${to ? s.factions[to].name + " established sustained neighborhood control" : (from ? s.factions[from].name : "The former controller") + " lost recognized dominance"}. Commercial access and local pressure have shifted.`,
    [],
    [s.playerId],
    {
      title: to ? "Control changed" : "Control lost",
      importance: "major",
      factionId: to ?? from ?? undefined,
    },
  );
  t.controller = to;
  t.controlSince = s.day;
  t.candidate = null;
  t.candidateDays = 0;
  t.weakDays = 0;
  t.changes.push({ day: s.day, from, to, eventId: e.id });
}
export function resolveTerritories(s: GameState) {
  for (const z of Object.values(s.zones)) {
    const t = s.strategic.territories[z.id];
    if (t.lastResolvedDay >= s.day) continue;
    t.lastResolvedDay = s.day;
    for (const [id, q] of Object.entries(t.factions) as [
      FactionId,
      Territory["factions"][FactionId],
    ][]) {
      const home = s.factions[id].home === z.id,
        f = s.factions[id];
      const overstretch = Object.values(s.strategic.territories).filter(
        (x) => x.controller === id,
      ).length;
      q.presence = clamp(
        q.presence - (home ? 0.12 : 0.3) - Math.max(0, overstretch - 2) * 0.15,
      );
      q.influence = clamp(
        q.influence - (home ? 0.1 : 0.24) - (f.resources < 100 ? 0.35 : 0),
      );
      q.economy = clamp(q.economy - 0.2);
      q.pressure = clamp(q.pressure - 0.8);
      q.support = clamp(
        q.support + (35 - q.support) * 0.003 - (q.pressure > 35 ? 0.08 : 0),
      );
    }
    const ranked = (Object.keys(t.factions) as FactionId[]).sort(
      (a, b) => dominanceScore(s, z.id, b) - dominanceScore(s, z.id, a),
    );
    const top = ranked[0],
      q = t.factions[top],
      score = dominanceScore(s, z.id, top);
    const qualifies =
      score >= B.controlThreshold &&
      score - dominanceScore(s, z.id, ranked[1]) >= B.controlMargin &&
      q.presence >= B.minimumPresence &&
      q.support >= B.minimumSupport;
    if (qualifies && top !== t.controller) {
      t.candidateDays = t.candidate === top ? t.candidateDays + 1 : 1;
      t.candidate = top;
      if (t.candidateDays >= B.stabilizationDays) changeControl(s, z.id, top);
    } else {
      t.candidate = null;
      t.candidateDays = 0;
    }
    if (t.controller) {
      const f = s.factions[t.controller];
      const weak =
        dominanceScore(s, z.id, t.controller) < B.retentionScore ||
        t.factions[t.controller].support < 18 ||
        f.instability > 85 ||
        f.resources < 20;
      t.weakDays = weak ? t.weakDays + 1 : 0;
      if (t.weakDays >= B.lossDays) changeControl(s, z.id, null);
    }
    t.lawfulEconomy = clamp(
      t.lawfulEconomy +
        (z.commerce - t.lawfulEconomy) * 0.03 -
        (t.contested ? 0.08 : 0),
    );
    syncTerritory(s, z.id);
  }
}
export function stabilizedControl(s: GameState, id: FactionId) {
  return Object.entries(s.strategic.territories).filter(
    ([zone, t]) =>
      t.controller === id &&
      s.zones[zone as ZoneId].controller === id &&
      s.day - t.controlSince >= B.stabilizationDays &&
      !t.weakDays,
  ).length;
}
