import { describe, expect, it } from "vitest";
import { newGame, enterGameplay } from "../core/Simulation";
import {
  cash,
  player,
  type FactionId,
  type GameState,
} from "../core/GameState";
import { moveTo, presenceOf } from "../board/presence";
import { LOCATIONS } from "../board/locations";
import {
  QUANNY_HOME,
  QUANNY_LOCATION_REVEAL,
  quannyCollectionInstruction,
} from "../systems/QuannyState";
import { quannyError } from "../systems/Quanny";
import { boardPeople } from "../board/people";
import {
  currentEncounter,
  respondEncounter,
  encounterDefinition,
  syncEncounters,
  dismissEncounter,
} from "../systems/Encounters";
import { acquire, saleLot, transact } from "../systems/StreetEconomy";
import { consignmentTerms, receivable } from "../systems/Consignment";
import { advanceQuanny, openQuanny, repairError } from "../systems/Quanny";
import { connect } from "../systems/Relationships";
import {
  expose,
  hospitalStay,
  initiateConflict,
  warRecognized,
} from "../systems/Danger";
import { advanceDay, recoverInHospital } from "../core/TimeSystem";
import { performAction } from "../core/ActionEngine";
import { serialize, deserialize } from "../persistence/SaveSystem";
import { visibleEvents, record } from "../core/EventLog";
import { arrest } from "../systems/Incarceration";
import { STREET_BALANCE } from "../content/street";
function start(faction: FactionId | null = null, seed = 2026) {
  const s = newGame("Morgan", "south", seed);
  player(s).affiliation = faction;
  return moveTo(s, "reservoir.lil-jays");
}
function respond(s: GameState, choice: string) {
  const result = respondEncounter(s, currentEncounter(s)!.id, choice);
  expect(result.error).toBeNull();
  return result.state;
}
function choices(s: GameState) {
  const e = currentEncounter(s)!;
  return encounterDefinition(e).responses(s, e);
}
function stocked(seed = 2026, arrangement: "cash" | "consignment" = "cash") {
  const s = newGame("Morgan", "south", seed);
  connect(s, s.playerId, "contact-blocks");
  s.characters["contact-blocks"].relationships.player.trust = 45;
  acquire(s, "contact-blocks", arrangement);
  return s;
}
function agreement(notoriety = 0) {
  let s = moveTo(stocked(), "reservoir.lil-jays");
  s = respond(s, "claim:unaffiliated");
  s = respond(s, "terms");
  s = respond(s, "front");
  player(s).notoriety = notoriety;
  return s;
}
function collection(s: GameState) {
  const a = receivable(s, "quanny")!;
  s.day = a.dueDay;
  openQuanny(s);
  syncEncounters(s);
  return respond(s, "collect");
}
describe("Quanny first intentional contact", () => {
  it("enters the Reservoir home introduction only on gameplay entry, once, not during initialization or inspection", () => {
    const initial = newGame("Morgan", "reservoir");
    boardPeople(initial);
    presenceOf(initial);
    syncEncounters(initial);
    expect(initial.quanny.met).toBe(false);
    let s = enterGameplay(initial);
    expect(initial.quanny.met).toBe(false); // owns a new simulation snapshot
    expect(currentEncounter(s)?.definitionId).toBe("quanny");
    expect(s.quanny.location).toBe("reservoir.homes");
    expect(boardPeople(s).find((p) => p.id === "quanny")?.placeId).toBe(
      "reservoir.homes",
    );
    expect(s.danger.scenes).toHaveLength(0);
    expect(enterGameplay(s)).toBe(s);
    s = respond(s, "claim:unaffiliated");
    s = respond(s, "leave");
    expect(enterGameplay(deserialize(serialize(s))).quanny).toEqual(s.quanny);
    s = moveTo(s, "reservoir.lot-court");
    expect(
      s.encounters.filter((e) => e.definitionId === "quanny"),
    ).toHaveLength(1);
  });
  it.each(LOCATIONS.filter((l) => l.zone === "reservoir").map((l) => l.id))(
    "first entry introduces Quanny at any Reservoir arrival: %s",
    (location) => {
      const initial = enterGameplay(newGame("Morgan", "south"));
      expect(initial.quanny.met).toBe(false);
      const s = moveTo(initial, location);
      expect(s.quanny.met).toBe(true);
      expect(s.quanny.location).toBe(location);
      expect(currentEncounter(s)?.definitionId).toBe("quanny");
      expect(s.danger.scenes).toHaveLength(0);
    },
  );
  it("discloses and saves the meeting place after peaceful answers, never after hostile claims", () => {
    for (const faction of [
      null,
      "blocks",
      "backstreet",
      "muds",
      "blips",
    ] as const) {
      let s = respond(start(faction), `claim:${faction ?? "unaffiliated"}`);
      if (s.quanny.business === "new") s = respond(s, "decline-details");
      expect(s.quanny.knownLocation).toBe(QUANNY_HOME);
      const e = currentEncounter(s)!;
      expect(encounterDefinition(e).dialogue(s, e)).toContain(
        QUANNY_LOCATION_REVEAL,
      );
      expect(deserialize(serialize(s)).quanny.knownLocation).toBe(QUANNY_HOME);
    }
    for (const claim of ["blocks", "angels"]) {
      const s = respond(start(), `claim:${claim}`);
      expect(s.quanny.knownLocation).toBeUndefined();
      expect(
        visibleEvents(s).some((e) => e.text.includes(QUANNY_LOCATION_REVEAL)),
      ).toBe(false);
      expect(deserialize(serialize(s)).quanny.knownLocation).toBeUndefined();
    }
  });
  it("later business and collection require the market, including deferred introductions", () => {
    let s = respond(
      moveTo(newGame("Morgan", "south"), "reservoir.homes"),
      "claim:unaffiliated",
    );
    const intro = currentEncounter(s)!;
    s = dismissEncounter(s, intro.id);
    expect(s.encounters.find((e) => e.id === intro.id)?.status).toBe("closed");
    expect(quannyError(s)).toMatch(/Lil Jay/);
    openQuanny(s);
    syncEncounters(s);
    expect(
      respondEncounter(s, s.encounters.at(-1)!.id, "terms").error,
    ).toBeTruthy();
    s = moveTo(s, QUANNY_HOME);
    expect(quannyError(s)).toBeNull();
    openQuanny(s);
    syncEncounters(s);
    expect(currentEncounter(s)?.definitionId).toBe("quanny");
    expect(
      encounterDefinition(currentEncounter(s)!).dialogue(
        s,
        currentEncounter(s)!,
      ),
    ).not.toMatch(/where you from/);
  });
  it("records the actual agreement due date and collection address when goods are fronted away from the market", () => {
    let s = stocked();
    s.day = 10;
    s = moveTo(s, "reservoir.homes");
    s = respond(s, "claim:unaffiliated");
    s = respond(s, "terms");
    s = respond(s, "front");
    const a = receivable(s, "quanny")!;
    expect(a.createdDay).toBe(10);
    expect(a.dueDay).toBe(16);
    expect(
      visibleEvents(s).some((e) =>
        e.text.includes(quannyCollectionInstruction(s, 16)),
      ),
    ).toBe(true);
    s.day = 16;
    expect(quannyError(s)).toMatch(/Lil Jay/);
    openQuanny(s);
    syncEncounters(s);
    expect(
      respondEncounter(s, s.encounters.at(-1)!.id, "collect").error,
    ).toBeTruthy();
    expect(a.balance).toBe(a.original);
  });
  it("migrates established peaceful customers' known location without revealing it for hostile introductions", () => {
    const s = respond(start(), "claim:unaffiliated");
    const raw = JSON.parse(serialize(s));
    delete raw.state.quanny.knownLocation;
    expect(deserialize(JSON.stringify(raw)).quanny.knownLocation).toBe(
      QUANNY_HOME,
    );
    const hostile = JSON.parse(serialize(respond(start(), "claim:blocks")));
    delete hostile.state.quanny.knownLocation;
    expect(
      deserialize(JSON.stringify(hostile)).quanny.knownLocation,
    ).toBeUndefined();
  });
  it.each([null, "blocks", "angels", "backstreet", "muds", "blips"] as const)(
    "offers only true membership and two permitted false identities: %s",
    (faction) => {
      const s = start(faction),
        ids = choices(s).map((r) => r.id);
      expect(ids).toEqual([
        ...new Set([
          `claim:${faction ?? "unaffiliated"}`,
          "claim:blocks",
          "claim:angels",
        ]),
      ]);
      expect(
        respondEncounter(s, currentEncounter(s)!.id, "claim:muds").error ===
          null,
      ).toBe(faction === "muds");
    },
  );
  it("recognizes false BB immediately, keeps intent private, preserves lethal grievance without an initial attack", () => {
    let s = respond(start(), "claim:blocks");
    expect(s.quanny.deception).toBe("known");
    expect(s.quanny.business).toBe("blocked");
    expect(s.danger.conflicts[0]).toMatchObject({
      lethal: true,
      intent: "seek",
    });
    expect(
      visibleEvents(s)
        .map((e) => e.text)
        .join(" "),
    ).not.toMatch(/impersonation|knows his|retaliation/);
    expect(
      player(s)
        .memories.map((m) => m.meaning)
        .join(" "),
    ).not.toMatch(/impersonation/);
    expect(s.danger.injuries).toHaveLength(0);
    expect(s.end).toBeNull();
    s = deserialize(serialize(s));
    expect(s.quanny.deception).toBe("known");
  });
  it("accepts real BB and assesses other organizations by direct relationships", () => {
    let s = respond(start("blocks"), "claim:blocks");
    expect(s.quanny.deception).toBe("none");
    expect(s.quanny.business).toBe("open");
    expect(s.danger.conflicts).toHaveLength(0);
    for (const f of ["muds", "backstreet", "blips"] as const) {
      s = respond(start(f), `claim:${f}`);
      expect(
        encounterDefinition(currentEncounter(s)!).dialogue(
          s,
          currentEncounter(s)!,
        ),
      ).toMatch(/Who put you on/);
      expect(choices(s).map((r) => r.id)).toEqual([
        "explain",
        "decline-details",
      ]);
      s = respond(s, "explain");
      expect(s.quanny.business).toBe("open");
      expect(warRecognized(s, s.characters.quanny)).toBe(false);
    }
  });
  it("all three seeded introductory shooting categories are nonfatal for both real and false Angels", () => {
    for (const affiliation of [null, "angels"] as const) {
      const outcomes = new Set<string>();
      for (let seed = 1; seed <= 150; seed++) {
        const s = respond(start(affiliation, seed), "claim:angels");
        outcomes.add(s.quanny.shooting!);
        expect(s.end).toBeNull();
        expect(s.danger.conflicts[0].lethal).toBe(true);
        if (s.quanny.shooting === "escape")
          expect(s.danger.injuries).toHaveLength(0);
        if (s.quanny.shooting === "minor") {
          expect(s.ap).toBe(1);
          expect(hospitalStay(s)).toBeUndefined();
        }
        if (s.quanny.shooting === "hospital") {
          expect(hospitalStay(s)?.kind).toBe("shooting");
          expect(s.ap).toBe(0);
        }
      }
      expect([...outcomes].sort()).toEqual(["escape", "hospital", "minor"]);
    }
  });
  it("minor injuries recover with time and hospital recovery keeps the simulation running", () => {
    for (const category of ["minor", "hospital"]) {
      let s = Array.from({ length: 150 }, (_, i) =>
        respond(start(null, i + 1), "claim:angels"),
      ).find((s) => s.quanny.shooting === category)!;
      // Recover at sheltered home; future Quanny encounters retain ordinary lethal risk.
      s.presence = {
        ...presenceOf(s),
        location: "south.towers",
        zone: "south",
      };
      if (category === "minor") {
        s = advanceDay(s);
        expect(s.ap).toBe(1);
        s = advanceDay(s);
        expect(s.ap).toBe(2);
      } else {
        const due = hospitalStay(s)!.releaseDay;
        s = recoverInHospital(s);
        expect(s.day).toBe(due);
        expect(hospitalStay(s)).toBeUndefined();
      }
      expect(s.danger.injuries[0].discharged).toBe(true);
      expect(deserialize(serialize(s)).quanny).toEqual(s.quanny);
    }
  });
  it("later exposure can be fatal and never reuses introductory protection", () => {
    let fatal = false;
    for (let seed = 1; seed < 300 && !fatal; seed++) {
      let s = respond(start(null, seed), "claim:angels");
      if (s.quanny.shooting !== "escape") continue;
      s.day++;
      s.danger.exposure.keys = [];
      for (const n of Object.values(s.characters))
        if (n.id !== "quanny" && n.id !== s.playerId) n.availableDay = 999;
      expose(s, "reservoir.lil-jays", "arrival");
      fatal ||= s.end === "killed";
    }
    expect(fatal).toBe(true);
  });
  it("identity discovery needs a real information channel and does not erase hostility", () => {
    const s = respond(start(), "claim:angels");
    advanceQuanny(s);
    expect(s.quanny.deception).toBe("unknown");
    const e = record(s, "social", "A genuine sponsor confirms membership", [
      "contact-blocks",
    ]);
    s.danger.recognition.push({
      observer: "contact-blocks",
      subject: s.playerId,
      affiliation: "blocks",
      source: "sponsorship",
      eventId: e.id,
      day: s.day,
      location: "reservoir.lil-jays",
    });
    s.characters.quanny.status = "active";
    advanceQuanny(s);
    expect(s.quanny.deception).toBe("known");
    expect(s.danger.conflicts[0].lethal).toBe(true);
  });
});
describe("directional consignment, collection and persistent relationships", () => {
  it("requires real stock, offers locked Splash Gang work and no imaginary opportunity", () => {
    const s = respond(start(), "claim:unaffiliated");
    const rs = choices(s);
    expect(
      rs.find((r) => r.id === "terms")!.requirement!(s, currentEncounter(s)!),
    ).toMatch(/real night goods/);
    expect(
      rs.find((r) => r.id === "ask-work")!.requirement!(
        s,
        currentEncounter(s)!,
      ),
    ).toBeTruthy();
  });
  it.each(["cash", "consignment"] as const)(
    "fronts existing %s stock without duplicating goods or reversing supplier liability",
    (arrangement) => {
      let s = moveTo(stocked(2026, arrangement), "reservoir.lil-jays");
      const source = saleLot(s)!,
        originalOwed = source.owed;
      s = respond(s, "claim:unaffiliated");
      const before = cash(player(s)),
        amount = consignmentTerms(s)!.amount;
      s = respond(s, "terms");
      s = respond(s, "front");
      const a = receivable(s, "quanny")!;
      expect(a).toMatchObject({
        supplier: "player",
        debtor: "quanny",
        original: amount,
        balance: amount,
        quantity: 6,
        dueDay: s.day + STREET_BALANCE.deadline,
      });
      expect(cash(player(s))).toBe(before);
      expect(saleLot(s)).toBeUndefined();
      expect(s.street.lots.find((l) => l.id === source.id)).toMatchObject({
        remaining: 0,
        transferred: 6,
        owed: originalOwed,
      });
      expect(s.street.lots.find((l) => l.id === a.lotId)).toMatchObject({
        owner: "quanny",
        supplier: "player",
        received: 6,
        remaining: 6,
      });
      expect(deserialize(serialize(s)).street).toEqual(s.street);
    },
  );
  it("evaluates notoriety at collection, honors exact threshold and pays only once through the ledger", () => {
    let s = agreement(0),
      amount = receivable(s, "quanny")!.original;
    const before = cash(player(s));
    player(s).notoriety = 35;
    s = collection(s);
    expect(cash(player(s))).toBe(before + amount);
    expect(s.street.agreements[0].status).toBe("fulfilled");
    expect(s.ledger.at(-1)?.amount).toBe(amount);
    expect(s.street.agreements[0].collections![0].notoriety).toBe(35);
    expect(
      respondEncounter(
        s,
        s.encounters.find((e) => e.definitionId === "quanny")!.id,
        "collect",
      ).error,
    ).toBeTruthy();
    expect(deserialize(serialize(s)).street).toEqual(s.street);
  });
  it("refusal creates permanent disputed history, no immediate attacks or automatic repayment after notoriety grows", () => {
    let s = agreement(34);
    const before = cash(player(s));
    s = collection(s);
    expect(cash(player(s))).toBe(before);
    expect(s.quanny.business).toBe("blocked");
    expect(s.street.agreements[0].status).toBe("disputed");
    expect(saleLot(s)).toBeUndefined();
    openQuanny(s);
    syncEncounters(s);
    expect(
      choices(s).some((r) => ["rob", "retaliate", "fight"].includes(r.id)),
    ).toBe(false);
    s = respond(s, "leave");
    player(s).notoriety = 80;
    s.day++;
    openQuanny(s);
    syncEncounters(s);
    expect(choices(s).some((r) => r.id === "retaliate")).toBe(true);
    expect(s.street.agreements[0].balance).toBeGreaterThan(0);
    expect(deserialize(serialize(s)).danger.conflicts).toEqual(
      s.danger.conflicts,
    );
  });
  it("repair needs meaningful new evidence and preserves the unpaid debt and grievances", () => {
    let s = collection(agreement(0));
    expect(repairError(s)).toBeTruthy();
    s.day++;
    player(s).affiliation = "blocks";
    player(s).organizationStanding.blocks += 35;
    expect(repairError(s)).toBeNull();
    openQuanny(s);
    syncEncounters(s);
    s = respond(s, "repair");
    expect(s.quanny.business).toBe("open");
    expect(s.quanny.repairHistory).toHaveLength(1);
    expect(s.street.agreements[0].status).toBe("disputed");
    expect(s.danger.conflicts).toHaveLength(1);
  });
  it("Quanny uses autonomous NPC commerce and can be arrested without clearing his debt", () => {
    const s = agreement(35),
      a = receivable(s, "quanny")!;
    const before = s.street.transactions.length;
    transact(s, "quanny", "reservoir");
    expect(s.street.transactions.length).toBe(before + 1);
    expect(s.street.transactions.at(-1)?.actor).toBe("quanny");
    arrest(s, "quanny", "Witnessed street work", 1);
    expect(s.characters.quanny.status).toBe("arrested");
    expect(receivable(s, "quanny")!.balance).toBe(a.original);
    expect(
      deserialize(serialize(s)).street.agreements.find((x) => x.id === a.id)
        ?.balance,
    ).toBe(a.original);
  });
  it("early lucky conflict cannot kill Quanny; capable opponents can eventually defeat him", () => {
    let defeated = false;
    const base = collection(agreement());
    for (let seed = 1; seed <= 300; seed++) {
      const s = structuredClone(base);
      s.danger.rng = seed;
      initiateConflict(s, "quanny", "retaliate");
      expect(s.characters.quanny.status).not.toBe("dead");
      const experienced = structuredClone(base);
      experienced.danger.rng = seed;
      // A survivor can become capable through actual confrontation history without a new skill meter.
      expect(player(experienced).skills.recovery).toBe(35);
      player(experienced).notoriety = 100;
      for (let i = 0; i < 8; i++)
        experienced.danger.injuries.push({
          id: `past-${i}`,
          eventId: experienced.danger.conflicts[0].originEvent,
          kind: "assault",
          admittedDay: 0,
          releaseDay: 1,
          bill: 0,
          paid: 0,
          discharged: true,
        });
      initiateConflict(experienced, "quanny", "retaliate");
      defeated ||= experienced.characters.quanny.status === "dead";
    }
    expect(defeated).toBe(true);
  });
  it("damaged transfers and fabricated history are rejected; older v8 saves migrate additively", () => {
    const s = agreement();
    const raw = JSON.parse(serialize(s));
    raw.state.street.lots[0].remaining++;
    expect(() => deserialize(JSON.stringify(raw))).toThrow();
    const bad = structuredClone(s);
    bad.quanny.history.push("fabricated");
    expect(() => deserialize(serialize(bad))).toThrow();
    const old = JSON.parse(serialize(newGame("Old", "south")));
    delete old.state.quanny;
    delete old.state.characters.quanny;
    delete old.state.characters["mr-lewis"];
    for (const c of Object.values(
      old.state.characters,
    ) as GameState["characters"][string][]) {
      c.known = c.known.filter((id) => !["quanny", "mr-lewis"].includes(id));
      c.connections = c.connections.filter(
        (id) => !["quanny", "mr-lewis"].includes(id),
      );
    }
    const migrated = deserialize(JSON.stringify(old));
    expect(migrated.quanny.met).toBe(false);
    expect(migrated.characters.quanny.connections).toContain("contact-blocks");
    expect(migrated.characters.quanny.known).toContain("mega");
  });
  it("arrival blocks queued activity and deferring preserves a resumable introduction", () => {
    const s = start();
    expect(performAction(s, { actor: s.playerId, type: "rest" }).error).toMatch(
      /Finish/,
    );
    const d = dismissEncounter(s, currentEncounter(s)!.id);
    expect(d.quanny.claim).toBeNull();
    openQuanny(d);
    syncEncounters(d);
    expect(choices(d)[0].id).toBe("claim:unaffiliated");
  });
});

describe("Quanny business boundaries", () => {
  it("higher negotiated terms follow practiced social skill, and repeated weak proposals damage business", () => {
    let s = moveTo(stocked(), "reservoir.lil-jays");
    s = respond(s, "claim:unaffiliated");
    const standard = consignmentTerms(s)!.amount;
    player(s).skills.social = 65;
    s = respond(s, "terms");
    s = respond(s, "negotiate");
    expect(receivable(s, "quanny")!.original).toBeGreaterThan(standard);
    let weak = moveTo(stocked(), "reservoir.lil-jays");
    weak = respond(weak, "claim:unaffiliated");
    const trust = weak.characters.quanny.relationships.player.trust;
    for (let i = 0; i < 3; i++) {
      if (i) {
        weak.day++;
        openQuanny(weak);
        syncEncounters(weak);
      }
      weak = respond(weak, "terms");
      weak = respond(weak, "negotiate");
    }
    expect(weak.characters.quanny.relationships.player.trust).toBeLessThan(
      trust,
    );
    expect(weak.quanny.business).toBe("blocked");
    expect(weak.street.agreements).toHaveLength(0);
  });
  it("collection cannot occur early and counterfeit collection results cannot load", () => {
    let s = agreement(35);
    openQuanny(s);
    syncEncounters(s);
    expect(
      respondEncounter(s, currentEncounter(s)!.id, "collect").error,
    ).toMatch(/Return on day/);
    s = respond(s, "leave");
    s = collection(s);
    const raw = structuredClone(s);
    raw.street.agreements[0].collections![0].notoriety = 34;
    expect(() => deserialize(serialize(raw))).toThrow(/consignment/);
  });
  it("Quanny’s NPC life continues while a front is pending without freezing his commitments", () => {
    let s = agreement(35);
    const before = s.characters.quanny.lastActionDay;
    s.presence = { ...presenceOf(s), location: "south.towers", zone: "south" };
    for (let day = 0; day < 4; day++) s = advanceDay(s);
    expect(s.characters.quanny.lastActionDay).toBeGreaterThan(before);
    expect(s.street.transactions.some((t) => t.actor === "quanny")).toBe(true);
    expect(deserialize(serialize(s)).street).toEqual(s.street);
  });
});

it("pending Quanny collection cannot be used from custody or while he is committed elsewhere", () => {
  const base = agreement(35);
  base.day = receivable(base, "quanny")!.dueDay;
  openQuanny(base);
  syncEncounters(base);
  const id = currentEncounter(base)!.id;
  for (const unavailable of ["player", "quanny"]) {
    const s = structuredClone(base);
    if (unavailable === "player") player(s).status = "arrested";
    else s.characters.quanny.availableDay = s.day + 1;
    const before = serialize(s);
    expect(respondEncounter(s, id, "collect").error).toBeTruthy();
    expect(serialize(s)).toBe(before);
  }
});
