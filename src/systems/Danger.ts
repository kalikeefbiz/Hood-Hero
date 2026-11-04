/** Gameplay only. No camera, renderer, wall clock, or UI randomness. */
import { beginQuanny } from "./Quanny";
import { quannyConversation } from "./QuannyState";
import {
  cash,
  clamp,
  player,
  type Character,
  type GameState,
} from "../core/GameState";
import { random as seededRandom } from "../core/Random";
import { record } from "../core/EventLog";
import { locationById, LOCATIONS } from "../board/locations";
import { homeBase, presenceOf } from "../board/presence";
import { change, connect, remember } from "./Relationships";
import { expense, earn } from "./Economy";
import { arrest } from "./Incarceration";
import { finalizeEnding } from "./EndConditions";
import type { Conflict, StreetScene } from "./DangerState";

// Danger owns a saved stream so additional exposure does not reroll unrelated economics.
const random = (s: GameState) => seededRandom(s.danger);

export const EXCEPTIONAL_FATALITY_DENOMINATOR = 100_000;
/** Rejection sampling gives exactly one of 100,000 equally sized buckets.
 * A simple floating threshold over a uint32 PRNG would be slightly biased. */
export function exceptionalFatalityRoll(draw: () => number): boolean {
  const limit =
    Math.floor(2 ** 32 / EXCEPTIONAL_FATALITY_DENOMINATOR) *
    EXCEPTIONAL_FATALITY_DENOMINATOR;
  let n: number;
  do {
    n = Math.floor(draw() * 2 ** 32);
  } while (n >= limit);
  return n % EXCEPTIONAL_FATALITY_DENOMINATOR === 0;
}
export const hospitalStay = (s: GameState) =>
  s.danger.injuries.find((i) => !i.discharged && i.severity !== "minor");
export const streetConversation = (s: GameState) =>
  s.danger.scenes.find((e) => e.status === "open");
const active = (c: Conflict) => c.state !== "settled";
const between = (c: Conflict, a: string, b: string) =>
  c.participants.includes(a) && c.participants.includes(b);
const playerConflictFor = (s: GameState, npc: string) =>
  s.danger.conflicts.find(
    (c) =>
      active(c) &&
      c.participants.includes(s.playerId) &&
      (c.participants.includes(npc) || c.associates.includes(npc)),
  );
const name = (c: Character) => c.alias ?? c.name;

/** Identity and membership are different information. A known face alone cannot reveal a set. */
export function witnessIdentity(
  s: GameState,
  observer: string,
  subject: string,
  eventId: string,
  location: string,
  source: GameState["danger"]["recognition"][number]["source"],
  membership = false,
) {
  const c = s.characters[observer],
    p = s.characters[subject];
  if (!c || !p || observer === subject) return;
  if (!c.known.includes(subject)) c.known.push(subject);
  const previous = s.danger.recognition.find(
    (r) => r.observer === observer && r.subject === subject,
  );
  const evidence = {
    observer,
    subject,
    eventId,
    location,
    source,
    day: s.day,
    affiliation: membership ? p.affiliation : (previous?.affiliation ?? null),
  };
  if (previous) Object.assign(previous, evidence);
  else s.danger.recognition.push(evidence);
}
export function warRecognized(s: GameState, npc: Character) {
  const p = player(s);
  if (
    !npc.affiliation ||
    !p.affiliation ||
    !s.factions[npc.affiliation].enemies.includes(p.affiliation)
  )
    return false;
  return s.danger.recognition.some(
    (r) =>
      r.observer === npc.id &&
      r.subject === p.id &&
      r.affiliation === p.affiliation,
  );
}
export function lethalConflict(s: GameState) {
  return (
    s.danger.conflicts.some(
      (c) =>
        active(c) &&
        c.lethal &&
        c.participants.includes(s.playerId) &&
        c.participants.some(
          (id) => id !== s.playerId && s.characters[id]?.status === "active",
        ),
    ) ||
    // War is credible even when the particular passerby has not identified the player yet.
    !!(
      player(s).affiliation &&
      Object.values(s.factions).some(
        (f) =>
          f.enemies.includes(player(s).affiliation!) &&
          Object.values(s.characters).some(
            (n) => n.status === "active" && n.affiliation === f.id,
          ),
      )
    )
  );
}
export function addGrievance(
  s: GameState,
  a: string,
  b: string,
  cause: string,
  eventId: string,
  seriousness: number,
  lethal = false,
): Conflict {
  let c = s.danger.conflicts.find((c) => active(c) && between(c, a, b));
  if (!c) {
    c = {
      id: `conflict-${s.nextId++}`,
      participants: [a, b],
      cause,
      originEvent: eventId,
      seriousness,
      lethal,
      state: "unresolved",
      scope: "personal",
      associates: [],
      intent: "talk",
      createdDay: s.day,
      updatedDay: s.day,
      history: [],
    };
    s.danger.conflicts.push(c);
  } else {
    c.seriousness = clamp(c.seriousness + seriousness / 2);
    c.lethal ||= lethal;
    c.state = "unresolved";
  }
  c.history.push({ eventId, day: s.day, outcome: cause });
  c.updatedDay = s.day;
  change(s.characters[a], b, {
    grievance: seriousness / 2,
    trust: -seriousness / 5,
  });
  remember(s, a, b, eventId, cause, seriousness / 10);
  remember(s, b, a, eventId, cause, seriousness / 10);
  return c;
}
function conflictOutcome(
  s: GameState,
  c: Conflict,
  eventId: string,
  outcome: string,
) {
  c.history.push({ eventId, day: s.day, outcome });
  c.updatedDay = s.day;
}

/** Immediate injury has no artificial ladder prerequisite. Only lethal contexts can kill. */
export function violence(
  s: GameState,
  npc: Character,
  c: Conflict | undefined,
  war: boolean,
) {
  const p = player(s),
    canKill = war || !!c?.lethal;
  const shooting = canKill && random(s) < 0.35 + npc.traits.risk / 250;
  const fatal = shooting && random(s) < 0.12;
  const e = record(
    s,
    "risk",
    fatal
      ? `${name(npc)} recognized you in an active conflict. You were fatally shot at ${locationById(presenceOf(s).location)?.name}.`
      : shooting
        ? `${name(npc)} opened fire. You survived a shooting and were taken to hospital.`
        : `${name(npc)} assaulted you. You were taken to hospital to recover.`,
    [npc.id, p.id],
    [p.id, npc.id],
    {
      importance: "critical",
      title: fatal ? "Fatal encounter" : "Hospitalized",
    },
  );
  const conflict =
    c ??
    addGrievance(
      s,
      npc.id,
      p.id,
      war ? "Direct encounter in an active faction war" : "Physical assault",
      e.id,
      shooting ? 85 : 45,
      shooting || war,
    );
  if (c) conflictOutcome(s, c, e.id, shooting ? "shooting" : "assault");
  conflict.lethal ||= shooting || war;
  conflict.seriousness = clamp(conflict.seriousness + 12);
  if (fatal) {
    p.status = "dead";
    s.ap = 0;
    finalizeEnding(s);
  } else {
    hospitalize(s, shooting ? "shooting" : "assault", e.id);
    // Police respond to witnessed violence; criminal exposure, not victimhood, permits arrest.
    const l = locationById(presenceOf(s).location)!;
    if (random(s) < s.zones[l.zone].police / 160) {
      record(
        s,
        "risk",
        "Police broke up the scene and took witness statements.",
        [p.id, npc.id],
      );
      if (random(s) < 0.25) arrest(s, npc.id, "witnessed assault", 1);
    }
  }
  return e.text;
}
export function hospitalize(
  s: GameState,
  kind: "assault" | "shooting",
  eventId: string,
) {
  if (s.end || hospitalStay(s)) return;
  const p = player(s),
    days = kind === "shooting" ? 5 : 2,
    bill = kind === "shooting" ? 480 : 180;
  const paid = Math.min(bill, cash(p));
  expense(s, p, paid, "Hospital treatment");
  s.street.arrears += bill - paid;
  s.danger.injuries.push({
    id: `injury-${s.nextId++}`,
    eventId,
    kind,
    admittedDay: s.day,
    releaseDay: s.day + days,
    bill,
    paid,
    discharged: false,
  });
  p.status = "laying-low";
  p.availableDay = Math.max(p.availableDay, s.day + days);
  p.stress = clamp(p.stress + 22);
  s.ap = 0;
  for (const scene of s.danger.scenes)
    if (scene.status === "open") scene.status = "left";
  for (const id of s.crew.members) {
    const n = s.characters[id];
    if (n.status === "active" && (n.relationships[p.id]?.trust ?? 0) >= 35) {
      change(n, p.id, { affection: 2 });
      remember(s, id, p.id, eventId, "Worried about their hospital stay.", 4);
    }
  }
  record(
    s,
    "money",
    `${days} days of inpatient recovery. Treatment $${bill}; $${paid} paid, $${bill - paid} added to arrears. Work and street activity are unavailable; the city continues.`,
    [p.id],
    [p.id],
    { importance: "major", title: "Recovery and treatment" },
  );
}
export function dischargePatient(s: GameState) {
  const stay = hospitalStay(s);
  if (stay && s.day >= stay.releaseDay && player(s).status !== "dead") {
    stay.discharged = true;
    if (player(s).status === "laying-low") player(s).status = "active";
    player(s).stress = clamp(player(s).stress - 10);
    record(
      s,
      "risk",
      "You were discharged from hospital. Treatment, missed obligations and city history remain.",
      [s.playerId],
    );
  }
}

function makeScene(
  s: GameState,
  npc: Character,
  location: string,
  motive: StreetScene["motive"],
  c?: Conflict,
  contextEvent?: string,
) {
  const e = record(
    s,
    "social",
    `${name(npc)} approaches you at ${locationById(location)!.name}.`,
    [npc.id, s.playerId],
    undefined,
    { title: "A familiar city, individual lives" },
  );
  witnessIdentity(s, npc.id, s.playerId, e.id, location, "witness");
  witnessIdentity(s, s.playerId, npc.id, e.id, location, "witness", true);
  const scene: StreetScene = {
    id: `street-scene-${s.nextId++}`,
    npc: npc.id,
    location,
    day: s.day,
    motive,
    conflictId: c?.id,
    contextEvent,
    status: "open",
  };
  s.danger.scenes.push(scene);
  s.encounters.push({
    id: `danger:${scene.id}`,
    definitionId: "living-danger",
    dangerSceneId: scene.id,
    participants: [npc.id, s.playerId],
    sourceEventId: e.id,
    createdDay: s.day,
    status: "pending",
    selectedResponses: [],
    followUpPending: false,
    deferred: false,
  });
  return scene;
}
export function sceneDialogue(s: GameState, scene: StreetScene) {
  const c = scene.conflictId
    ? s.danger.conflicts.find((c) => c.id === scene.conflictId)
    : undefined;
  if (scene.npc === "quanny" && scene.motive === "introduction")
    return s.quanny.business === "blocked"
      ? "I know your face. What are you coming around for?"
      : "I remember you. Got any business to discuss?";
  switch (scene.motive) {
    case "history":
      return `Last time between us — ${c?.cause.toLowerCase()}. We never really talked that through. What are you saying now?`;
    case "war":
      return `I've heard who you're running with. You know our sets are at war. Why are you here?`;
    case "debt":
      return `That balance you owe me is still outstanding. I need to know you're taking our arrangement seriously.`;
    case "corner":
      return `I saw you working this neighborhood. People live here too. Are you going to keep things quiet around here?`;
    case "family":
      return `You're Mega's cousin, right? I know him. How's he holding up with everything going on?`;
    default:
      if (s.characters[scene.npc].connections.includes(s.playerId))
        return "Good seeing you again. How’s work treating you? We could catch up while things are quiet.";
      return s.characters[scene.npc].traits.lawful >= 65
        ? `You looking for steady work around here? I live nearby. Could always use another reliable neighbor.`
        : `I see you around. Where are you from? Just getting to know who's in the neighborhood.`;
  }
}
export type StreetResponse =
  "listen" | "explain" | "apologize" | "identify" | "leave" | "disrespect";
export function resolveStreetScene(
  s: GameState,
  scene: StreetScene,
  response: StreetResponse,
) {
  if (scene.status !== "open") return;
  const npc = s.characters[scene.npc],
    p = player(s);
  let c = s.danger.conflicts.find((c) => c.id === scene.conflictId);
  if (response === "identify" && p.affiliation) {
    const disclosure = record(
      s,
      "social",
      `You told ${name(npc)} you run with ${s.factions[p.affiliation].name}.`,
      [p.id, npc.id],
    );
    witnessIdentity(
      s,
      npc.id,
      p.id,
      disclosure.id,
      scene.location,
      "witness",
      true,
    );
  }
  const war = warRecognized(s, npc);
  let text: string;
  if (response === "disrespect") {
    text = `You dismissed ${name(npc)} disrespectfully. No agreement was made.`;
    const e = record(s, "social", text, [p.id, npc.id]);
    c = addGrievance(
      s,
      npc.id,
      p.id,
      `Disrespect during a conversation about ${scene.motive}`,
      e.id,
      28,
    );
    scene.conflictId = c.id;
    // Some people walk off; some react now. An argument alone is never a lethal license.
    if (random(s) < npc.traits.risk / 350) text = violence(s, npc, c, war);
    else {
      text +=
        npc.authority >= 40
          ? ` ${name(npc)} warned you to leave it alone, then walked away.`
          : " They walked away without settling the disagreement.";
      record(s, "social", text, [p.id, npc.id]);
    }
  } else if (response === "leave") {
    text = `You left the conversation with ${name(npc)}. No agreement was made.`;
    const e = record(s, "social", text, [p.id, npc.id]);
    if (c) conflictOutcome(s, c, e.id, "Left without agreement");
    if ((war || c?.lethal) && random(s) < npc.traits.risk / 400)
      text = violence(s, npc, c, war);
  } else if (
    response === "identify" &&
    war &&
    random(s) < npc.traits.risk / 170
  ) {
    text = violence(s, npc, c, true);
  } else {
    const resolved =
      !c ||
      random(s) <
        clamp(
          65 +
            npc.traits.lawful / 4 +
            p.skills.social / 5 +
            (npc.relationships[p.id]?.trust ?? 0) / 5 -
            c.seriousness / 2,
          12,
          95,
        ) /
          100;
    text = resolved
      ? `${name(npc)} heard you out. The conversation ended peacefully.`
      : `${name(npc)} heard you out but made no promises. You parted without resolving the disagreement.`;
    const e = record(s, "social", text, [p.id, npc.id]);
    connect(s, p.id, npc.id);
    change(npc, p.id, { trust: 4, respect: 2, grievance: -5 });
    remember(s, npc.id, p.id, e.id, "Tried to talk things through.", 3);
    if (c) {
      c.state = resolved ? "settled" : "cooling";
      c.seriousness = clamp(c.seriousness - (resolved ? 35 : 10));
      c.intent = resolved ? "avoid" : "talk";
      conflictOutcome(
        s,
        c,
        e.id,
        resolved ? "Reconciled" : "Heard out; unresolved",
      );
    }
    // A peaceful exchange does not end a faction war or erase knowledge of membership.
  }
  scene.status = "resolved";
  scene.outcome = text;
}

/** Called only by accepted simulation commands, never board inspection. Mutates an owned snapshot.
 * Travel is free: once per district/day; activities once per AP position; at most four checks/day. */
export function expose(
  s: GameState,
  location: string,
  kind: "arrival" | "activity" | "linger",
  activityKey = "",
) {
  const l = locationById(location),
    p = player(s);
  if (
    !l ||
    s.end ||
    p.status !== "active" ||
    hospitalStay(s) ||
    streetConversation(s) ||
    quannyConversation(s)
  )
    return;
  if (beginQuanny(s, location, kind)) return;
  const ex = s.danger.exposure;
  if (ex.day !== s.day) {
    ex.day = s.day;
    ex.keys = [];
  }
  const key =
    kind === "arrival"
      ? `arrival:${l.zone}`
      : kind === "linger"
        ? "linger"
        : `activity:${activityKey}`;
  if (ex.keys.includes(key) || ex.keys.length >= 4) return;
  ex.keys.push(key);
  // Resting in one's home is sheltered, even on a contested block.
  const sheltered = location === homeBase(s);
  const environmental =
    !sheltered &&
    (s.zones[l.zone].police >= 70 ||
      s.zones[l.zone].organizations.some((f) =>
        s.factions[f].enemies.some((enemy) =>
          s.zones[l.zone].organizations.includes(enemy),
        ),
      ));
  if (environmental && !lethalConflict(s) && ex.exceptionalDay !== s.day) {
    ex.exceptionalDay = s.day;
    if (exceptionalFatalityRoll(() => random(s))) {
      record(
        s,
        "risk",
        `An exceptional stray shot at ${l.name} ended your life. You were not a target.`,
        [p.id],
        [p.id],
        { importance: "critical", title: "Wrong place, wrong time" },
      );
      p.status = "dead";
      s.ap = 0;
      finalizeEnding(s);
      return;
    }
  }
  if (sheltered) return;
  const candidates = Object.values(s.characters).filter((npc) => {
    if (
      (npc.id === "quanny" && (!s.quanny.met || !s.quanny.claim)) ||
      npc.id === p.id ||
      npc.status !== "active" ||
      npc.availableDay > s.day
    )
      return false;
    const c = playerConflictFor(s, npc.id);
    if (npc.home === l.zone)
      return !l.faction || !npc.affiliation || npc.affiliation === l.faction;
    // Pursuit needs a sighting, not omniscient access to the player's position.
    const sighting = s.danger.recognition.find(
      (r) => r.observer === npc.id && r.subject === p.id,
    );
    return (
      !!c &&
      ["seek", "involve"].includes(c.intent) &&
      sighting?.location === location &&
      s.day - sighting.day <= 4
    );
  });
  if (!candidates.length) return;
  const weighted = candidates.map((npc) => ({
    npc,
    c: playerConflictFor(s, npc.id),
    war: warRecognized(s, npc),
  }));
  weighted.sort(
    (a, b) =>
      Number(b.war) - Number(a.war) ||
      (b.c?.seriousness ?? 0) - (a.c?.seriousness ?? 0),
  );
  const first = weighted[0];
  const chosen =
    first.war || first.c
      ? first
      : weighted[Math.floor(random(s) * weighted.length)];
  const { npc, c, war } = chosen;
  if (random(s) >= (war ? 0.78 : c ? (c.intent === "avoid" ? 0.08 : 0.5) : 0.1))
    return;
  const trust = npc.relationships[p.id]?.trust ?? 0;
  const force =
    clamp(
      (war ? 38 : c?.lethal ? 30 : 0) +
        npc.traits.risk / 3 +
        (c?.seriousness ?? 0) / 3 -
        npc.traits.lawful / 4 -
        trust / 4 -
        s.zones[l.zone].police / 8,
      0,
      85,
    ) / 100;
  if ((war || c) && random(s) < force) {
    violence(s, npc, c, war);
    return;
  }
  const debt = s.street.agreements.find(
    (a) =>
      a.debtor === p.id &&
      a.supplier === npc.id &&
      a.balance > 0 &&
      a.dueDay <= s.day,
  );
  const sale = [...s.street.transactions]
    .reverse()
    .find((t) => t.actor === p.id && t.market === l.zone && s.day - t.day <= 3);
  const family =
    npc.id !== "mega" &&
    npc.connections.includes("mega") &&
    npc.known.includes(p.id);
  makeScene(
    s,
    npc,
    location,
    war
      ? "war"
      : c
        ? "history"
        : debt
          ? "debt"
          : sale
            ? "corner"
            : family
              ? "family"
              : "introduction",
    c,
    sale?.eventId,
  );
}

/** Private reconsideration is probabilistic, with no due-day or retaliation countdown. */
export function advanceConflicts(s: GameState) {
  for (const scene of s.danger.scenes)
    if (scene.status === "open" && scene.day < s.day) {
      scene.status = "left";
      scene.outcome = "The moment passed. No agreement was made.";
    }
  for (const c of s.danger.conflicts.filter(active)) {
    const npc =
      s.characters[
        c.participants.find((id) => id !== s.playerId) ?? c.participants[0]
      ];
    if (
      !npc ||
      npc.status !== "active" ||
      c.updatedDay >= s.day ||
      random(s) >= 0.32
    )
      continue;
    const other = c.participants.find((id) => id !== npc.id)!;
    const roll = random(s);
    if (roll < (npc.traits.lawful + 25) / 210) {
      c.seriousness = clamp(c.seriousness - 12);
      c.state = c.seriousness < 10 ? "settled" : "cooling";
      c.intent = "avoid";
      change(npc, other, { grievance: -4 });
    } else {
      c.seriousness = clamp(c.seriousness + npc.traits.risk / 8);
      c.state = "worsening";
      c.intent = random(s) < npc.traits.loyalty / 200 ? "involve" : "seek";
      // Serious repeated history can become lethal, never a single mild slight alone.
      if (c.seriousness >= 65 && npc.traits.risk >= 55 && random(s) < 0.25)
        c.lethal = true;
    }
    const e = record(
      s,
      "social",
      `${name(npc)} reconsidered a dispute: ${c.state}.`,
      [npc.id],
      [npc.id],
    );
    conflictOutcome(s, c, e.id, c.state);
    remember(
      s,
      npc.id,
      other,
      e.id,
      c.state === "cooling"
        ? "Less inclined to pursue the dispute."
        : "Reconsidered unfinished business.",
      3,
    );
    if (c.intent === "involve") {
      const associate = npc.connections
        .map((id) => s.characters[id])
        .find(
          (n) =>
            n &&
            n.id !== other &&
            n.status === "active" &&
            !c.associates.includes(n.id) &&
            (npc.relationships[n.id]?.trust ?? 0) >= 30 &&
            n.known.includes(other),
        );
      if (associate) {
        c.associates.push(associate.id);
        c.scope = "circle";
        const word = record(
          s,
          "social",
          `${name(npc)} told ${name(associate)} about ${c.cause.toLowerCase()}.`,
          [npc.id, associate.id],
          [npc.id, associate.id],
        );
        remember(
          s,
          associate.id,
          other,
          word.id,
          "Heard one side of a personal dispute.",
          3,
        );
        conflictOutcome(s, c, word.id, "Discussed with an associate");
        // Hearsay carries only existing membership evidence, never alliance-wide telepathy.
        const evidence = s.danger.recognition.find(
          (r) => r.observer === npc.id && r.subject === other,
        );
        if (evidence)
          witnessIdentity(
            s,
            associate.id,
            other,
            word.id,
            evidence.location,
            "associate",
            evidence.affiliation === s.characters[other].affiliation,
          );
      }
    }
  }
  // Bounded NPC-only foundation: use actual co-residence, known rivals or a personal grievance.
  if (random(s) < 0.14) {
    const pair = Object.values(s.characters).flatMap((a) =>
      a.id === s.playerId || a.status !== "active"
        ? []
        : a.known.flatMap((id) => {
            const b = s.characters[id];
            return b &&
              b.id !== s.playerId &&
              a.id < b.id &&
              b.status === "active" &&
              a.home === b.home &&
              ((a.relationships[b.id]?.grievance ?? 0) >= 15 ||
                (a.affiliation &&
                  b.affiliation &&
                  s.factions[a.affiliation].enemies.includes(b.affiliation))) &&
              !s.danger.conflicts.some(
                (c) => active(c) && between(c, a.id, b.id),
              )
              ? [{ a, b }]
              : [];
          }),
    );
    if (pair.length) {
      const { a, b } = pair[Math.floor(random(s) * pair.length)];
      const war = !!(
        a.affiliation &&
        b.affiliation &&
        s.factions[a.affiliation].enemies.includes(b.affiliation)
      );
      const e = record(
        s,
        "social",
        `${name(a)} and ${name(b)} clashed over ${war ? "their organizations' ongoing war" : "an existing personal grievance"}.`,
        [a.id, b.id],
        [a.id, b.id],
      );
      addGrievance(
        s,
        a.id,
        b.id,
        war ? "Local faction confrontation" : "Existing personal grievance",
        e.id,
        war ? 65 : 25,
        war,
      );
    }
  }
}

export function validateDangerReferences(s: GameState) {
  const d = s.danger,
    hasEvent = (id: string) => s.events.some((e) => e.id === id),
    hasChar = (id: string) => !!s.characters[id];
  const ids = [...d.scenes, ...d.conflicts, ...d.injuries].map((x) => x.id);
  if (
    new Set(d.recognition.map((r) => `${r.observer}:${r.subject}`)).size !==
      d.recognition.length ||
    d.scenes.filter((e) => e.status === "open").length > 1 ||
    new Set(ids).size !== ids.length ||
    d.exposure.day > s.day ||
    d.exposure.exceptionalDay > s.day ||
    d.exposure.keys.length > 4 ||
    new Set(d.exposure.keys).size !== d.exposure.keys.length ||
    d.recognition.some(
      (r) =>
        !hasChar(r.observer) ||
        !hasChar(r.subject) ||
        r.observer === r.subject ||
        !hasEvent(r.eventId) ||
        !locationById(r.location) ||
        r.day > s.day,
    ) ||
    d.conflicts.some(
      (c) =>
        !c.participants.every(hasChar) ||
        c.participants[0] === c.participants[1] ||
        !c.associates.every(hasChar) ||
        !hasEvent(c.originEvent) ||
        !c.history.every((h) => hasEvent(h.eventId) && h.day <= s.day) ||
        c.updatedDay > s.day,
    ) ||
    d.scenes.some(
      (e) =>
        !hasChar(e.npc) ||
        !locationById(e.location) ||
        e.day > s.day ||
        (e.contextEvent && !hasEvent(e.contextEvent)) ||
        (e.conflictId && !d.conflicts.some((c) => c.id === e.conflictId)) ||
        !s.encounters.some((x) => x.dangerSceneId === e.id),
    ) ||
    s.encounters.some(
      (e) =>
        e.definitionId === "living-danger" &&
        !d.scenes.some((x) => x.id === e.dangerSceneId),
    ) ||
    d.injuries.filter((i) => !i.discharged && i.severity !== "minor").length >
      1 ||
    d.injuries.some(
      (i) =>
        !hasEvent(i.eventId) ||
        i.releaseDay <= i.admittedDay ||
        i.admittedDay > s.day ||
        i.paid > i.bill,
    )
  )
    throw new Error(
      "Save contains invalid danger, conflict or recognition references.",
    );
}
/** Registry anchor for remote activities whose location is explicit in existing action data. */
export const streetLocation = (zone: string) =>
  LOCATIONS.find((l) => l.zone === zone && l.links.street)?.id;

/** Authored first contact only. Later violence still uses the ordinary lethal resolver. */
export function introductoryShooting(
  s: GameState,
  npc: Character,
  eventId: string,
): "escape" | "minor" | "hospital" {
  const roll = random(s),
    p = player(s);
  if (roll < 1 / 3) {
    record(
      s,
      "risk",
      `${name(npc)} fired. You escaped without injury.`,
      [npc.id, p.id],
      undefined,
      { title: "Escaped gunfire", importance: "major" },
    );
    return "escape";
  }
  if (roll < 2 / 3) {
    s.danger.injuries.push({
      id: `injury-${s.nextId++}`,
      eventId,
      kind: "shooting",
      severity: "minor",
      admittedDay: s.day,
      releaseDay: s.day + 2,
      bill: 0,
      paid: 0,
      discharged: false,
    });
    s.ap = Math.max(0, s.ap - 1);
    record(
      s,
      "risk",
      "You escaped with a minor gunshot injury. One fewer AP per day until day " +
        (s.day + 2) +
        ".",
      [p.id],
      undefined,
      { title: "Minor shooting injury", importance: "major" },
    );
    return "minor";
  }
  hospitalize(s, "shooting", eventId);
  return "hospital";
}

/** Reusable player initiation for a later, physically present dispute. No early instant kills. */
export function initiateConflict(
  s: GameState,
  target: string,
  approach: "rob" | "retaliate" | "fight" | "disrespect",
) {
  const p = player(s),
    npc = s.characters[target];
  if (!npc || npc.status !== "active" || s.end || hospitalStay(s) || s.ap < 1)
    return;
  s.ap--;
  const e = record(
    s,
    "risk",
    `${p.name} chose to ${approach === "retaliate" ? "attempt violent retaliation against" : approach === "disrespect" ? "publicly disrespect" : approach === "fight" ? "challenge" : "attempt to rob"} ${name(npc)}.`,
    [p.id, npc.id],
  );
  const c = addGrievance(
    s,
    npc.id,
    p.id,
    `Player-initiated ${approach}`,
    e.id,
    approach === "disrespect" ? 35 : 80,
    approach === "rob" || approach === "retaliate",
  );
  c.intent = "seek";
  p.police = clamp(p.police + (approach === "disrespect" ? 0 : 20));
  p.rivalThreat = clamp(p.rivalThreat + 20);
  if (approach === "disrespect") return;
  const supporters = s.crew.members
    .map((id) => s.characters[id])
    .filter(
      (n) =>
        n.id !== target &&
        n.status === "active" &&
        (n.relationships[p.id]?.trust ?? 0) >= 45,
    );
  const backing = npc.connections.filter(
    (id) =>
      id !== p.id &&
      s.characters[id]?.status === "active" &&
      s.characters[id].affiliation === npc.affiliation,
  ).length;
  // A reachable mid-game route: real trading experience and recovered confrontations,
  // alongside the existing skill, improve capability. Conversation spam is not training.
  const experience =
    s.street.transactions.filter((t) => t.actor === p.id && t.sold > 0).length +
    s.danger.injuries.filter((i) => i.discharged).length * 3 +
    s.assignments.filter(
      (a) =>
        a.activity === "partner-crime" && a.status === "resolved" && a.success,
    ).length;
  const practicedSkill = clamp(
    p.skills.recovery + Math.min(40, experience * 1.5),
  );
  const capable = practicedSkill >= 70 && p.notoriety >= 35 && experience >= 6;
  const chance = clamp(
    0.02 +
      (practicedSkill - npc.skills.recovery) / 120 +
      p.notoriety / 300 +
      supporters.length * 0.08 -
      backing * 0.025 -
      p.stress / 600,
    0.005,
    capable ? 0.8 : 0.015,
  );
  if (random(s) >= chance) {
    violence(s, npc, c, approach === "retaliate" || approach === "rob");
    return;
  }
  if (approach === "rob") {
    const amount = Math.min(60, cash(npc));
    expense(s, npc, amount, "Robbery loss");
    earn(s, p, amount, "illicit", `Robbery of ${name(npc)}`);
    record(
      s,
      "risk",
      `${name(npc)} lost $${amount} in the robbery. The debt and retaliation risk remain.`,
      [p.id, npc.id],
    );
  } else if (capable) {
    npc.status =
      approach === "retaliate" && random(s) < 0.2 ? "dead" : "laying-low";
    npc.availableDay = s.day + (approach === "retaliate" ? 5 : 2);
    record(
      s,
      "risk",
      `${name(npc)} was ${npc.status === "dead" ? "killed" : "hospitalized"} during the confrontation.`,
      [p.id, npc.id],
      undefined,
      { importance: "critical" },
    );
  } else
    record(s, "risk", `You broke free of ${name(npc)}. He is still standing.`, [
      p.id,
      npc.id,
    ]);
  if (random(s) < s.zones[npc.home].police / 160)
    arrest(s, p.id, "witnessed violence", approach === "retaliate" ? 3 : 1);
}
