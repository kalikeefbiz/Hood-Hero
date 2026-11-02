import type { GameState } from "../core/GameState";
import { BALANCE } from "./balance";
import { record } from "../core/EventLog";
import { change, remember } from "../systems/Relationships";
export function openingIncident(s: GameState) {
  const participants = ["dizzy", "babycanon", "joker"];
  s.properties.chains = {
    id: "chains",
    name: "Mega’s chains",
    owner: "mega",
    possession: { kind: "group", id: "the-chains" },
    value: 400,
    provenance: "clean",
  };
  s.incidents["the-chains"] = {
    id: "the-chains",
    kind: "property-dispute",
    title: "The Chains",
    victim: "mega",
    participants,
    organization: "angels",
    property: "chains",
    startedDay: 1,
    demand: BALANCE.buyback,
    minimumDemand: BALANCE.minimumBuyback,
    escalation: 15,
    negotiated: false,
    informed: false,
    leadershipAware: false,
    helpRequested: false,
    deadline: BALANCE.incidentDeadline,
    status: "active",
    interventions: [],
  };
  const e = record(
    s,
    "incident",
    "Cuzzo: “Three young Angels took my chains. Dizzy, Baby Canon, Joker. They’re asking $150 to give them back. Call me.”",
    ["mega", ...participants],
    ["player", "mega", ...participants],
    { incidentId: "the-chains" },
  );
  remember(s, "mega", "player", e.id, "Asked my cousin for support.", 20);
  for (const a of participants)
    for (const b of participants)
      if (a !== b) {
        change(s.characters[a], b, {
          trust: 8 + s.characters[a].traits.risk / 15,
          respect: 6,
        });
        remember(s, a, b, e.id, "We took part in the robbery together.", 12);
      }
  s.characters.player.known = [
    ...new Set([
      ...s.characters.player.known,
      ...participants,
      "pablo",
      "justice",
    ]),
  ];
}
