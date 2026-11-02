import {
  type GameState,
  type Incident,
  player,
  clamp,
} from "../core/GameState";
import { record } from "../core/EventLog";
import { change, remember } from "./Relationships";
import { random } from "../core/Random";
export function resolveIncident(
  s: GameState,
  i: Incident,
  resolution: NonNullable<Incident["resolution"]>,
  actor: string,
) {
  if (i.status !== "active") return;
  i.status = resolution === "sold" ? "abandoned" : "resolved";
  i.resolution = resolution;
  const property = s.properties[i.property];
  property.possession =
    resolution === "sold"
      ? { kind: "market", id: "resale-market" }
      : { kind: "character", id: i.victim };
  const e = record(
    s,
    "incident",
    resolution === "sold"
      ? `${i.title}: the group sold the property. The dispute has faded; the city moves on.`
      : `${i.title}: ${resolution === "buyback" ? "payment accepted" : resolution === "settlement" ? "leadership arranged a settlement" : "the property was recovered"}. ${s.characters[i.victim].name} has it back.`,
    [actor, i.victim, ...i.participants],
    ["player", actor, i.victim, ...i.participants],
    {
      importance: "major",
      factionId: i.organization,
      presentationKey: `incident:${i.id}:outcome`,
      title:
        resolution === "sold" ? "The Chains — lost" : "The Chains — resolved",
      incidentId: i.id,
    },
  );
  i.resolvedBy = actor;
  i.resolvedEventId = e.id;
  change(s.characters[i.victim], actor, {
    trust: resolution === "sold" ? -4 : 18,
    respect: resolution === "sold" ? 0 : 8,
  });
  remember(
    s,
    i.victim,
    actor,
    e.id,
    resolution === "sold"
      ? "My property was lost."
      : "Helped settle my property dispute.",
    20,
  );
  const contributor =
    actor === s.playerId ||
    (resolution === "settlement" &&
      i.interventions.some(
        (x) => x.actor === s.playerId && x.type === "settlement",
      ));
  if (contributor && actor !== s.playerId) {
    change(s.characters[i.victim], s.playerId, { trust: 18, respect: 8 });
    remember(
      s,
      i.victim,
      s.playerId,
      e.id,
      "Brought the dispute to leadership and helped get my property back.",
      20,
    );
  }
  if (contributor && resolution !== "sold") {
    player(s).influence += 5;
    player(s).neighborhoodStanding[s.characters[i.victim].home] += 5;
  }
  for (const id of i.participants) {
    remember(
      s,
      id,
      actor,
      e.id,
      resolution === "recovered"
        ? "Challenged our group."
        : "The property dispute ended.",
      12,
    );
    change(s.characters[id], actor, {
      grievance: resolution === "recovered" ? 20 : 0,
      trust: resolution === "buyback" ? 4 : 0,
    });
  }
}
export function advanceIncidents(s: GameState) {
  for (const i of Object.values(s.incidents)) {
    if (i.status !== "active") continue;
    const age = s.day - i.startedDay;
    if (i.leadershipAware && (i.helpRequested || age >= 3)) {
      const leader =
        s.characters[
          s.factions[i.organization].leaders.find(
            (id) => s.characters[id].status === "active",
          ) ?? ""
        ];
      // Leaders with loyalty/stability priorities may discipline an unauthorized act.
      if (leader && leader.traits.loyalty >= 70 && random(s) < 0.65) {
        resolveIncident(s, i, "settlement", leader.id);
        s.factions[i.organization].instability = clamp(
          s.factions[i.organization].instability - 8,
        );
        continue;
      }
    }
    if (age >= i.deadline) {
      resolveIncident(s, i, "sold", i.participants[0]);
      continue;
    }
    if (age >= 2 && !i.leadershipAware) {
      i.escalation = clamp(i.escalation + 6);
      if (age === 3) {
        i.demand += 15;
        record(
          s,
          "incident",
          `${i.title}: the group raised its demand to $${i.demand}. Mega’s patience is wearing thin.`,
          i.participants,
          ["player", i.victim, ...i.participants],
        );
      }
      if (age >= 5) {
        i.leadershipAware = true;
        s.factions[i.organization].instability += 5;
        record(
          s,
          "incident",
          "Word of the unauthorized robbery reached Pablo. He is weighing loyalty against neighborhood stability.",
          ["pablo", ...i.participants],
          ["player", "pablo", i.victim],
          {
            importance: "major",
            title: "Pablo heard about the robbery",
            factionId: i.organization,
            expiresOnIncidentClose: true,
            incidentId: i.id,
          },
        );
      }
    }
  }
}
