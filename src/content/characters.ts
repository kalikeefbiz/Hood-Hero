import type { Character, FactionId, ZoneId } from "../core/GameState";
export function character(
  id: string,
  name: string,
  home: ZoneId,
  affiliation: FactionId | null,
  description: string,
  overrides: Partial<Character> = {},
): Character {
  return {
    id,
    name,
    home,
    affiliation,
    description,
    status: "active",
    availableDay: 1,
    lastActionDay: 0,
    traits: { loyalty: 60, ambition: 50, risk: 35, lawful: 50 },
    skills: { social: 40, work: 45, recovery: 30 },
    agency: {
      lastAssignmentDay: 0,
      lastOfferDay: 0,
      lastRequestDay: 0,
      unreasonableRequests: 0,
    },
    goals: ["income"],
    wallet: { clean: 80, illicit: 0 },
    relationships: {},
    memories: [],
    known: [],
    connections: [],
    stress: 10,
    notoriety: 0,
    police: 0,
    influence: 5,
    legitimacy: 10,
    neighborhoodStanding: {
      downtown: 0,
      rio: 0,
      south: 0,
      reservoir: 0,
      nawf: 0,
    },
    organizationStanding: {
      angels: 0,
      backstreet: 0,
      blocks: 0,
      blips: 0,
      muds: 0,
    },
    possessions: [],
    recurringLawfulIncome: 0,
    authority: 0,
    rivalThreat: 0,
    ...overrides,
  };
}
export function canonicalCharacters(): Character[] {
  return [
    character(
      "loco",
      "Cristian Santiago",
      "rio",
      "angels",
      "Recognized leader. Incarcerated, but his influence remains.",
      {
        alias: "Loco",
        status: "arrested",
        influence: 90,
        authority: 95,
        goals: ["loyalty", "stability"],
      },
    ),
    character(
      "pablo",
      "Pablo",
      "rio",
      "angels",
      "Active leadership. Cold, vindictive; loyalty and respect come first.",
      {
        authority: 80,
        influence: 80,
        traits: { loyalty: 95, ambition: 60, risk: 45, lawful: 15 },
        goals: ["loyalty", "stability"],
      },
    ),
    ...["Dizzy", "Baby Canon", "Joker"].map((name, i) =>
      character(
        ["dizzy", "babycanon", "joker"][i],
        name,
        "rio",
        "angels",
        "Young Angels member. Participated in the unauthorized robbery of Mega.",
        {
          traits: {
            loyalty: 50 + i * 7,
            ambition: 85 - i * 6,
            risk: 75 - i * 8,
            lawful: 15,
          },
          goals: ["status", "income"],
          skills: { social: 25 + i * 5, work: 30, recovery: 45 + i * 5 },
          notoriety: 20,
        },
      ),
    ),
    character(
      "justice",
      "Justice",
      "south",
      "backstreet",
      "Respected older leader, former high-level dealer and owner of legitimate local nightclubs.",
      {
        authority: 90,
        influence: 85,
        legitimacy: 65,
        goals: ["stability", "loyalty"],
        traits: { loyalty: 85, ambition: 45, risk: 25, lawful: 75 },
      },
    ),
    character(
      "mega",
      "Mega",
      "south",
      "backstreet",
      "Your cousin, Cuzzo. Formidable reputation; his chains were taken while out with his girlfriend.",
      {
        alias: "Cuzzo",
        notoriety: 65,
        influence: 55,
        skills: { social: 55, work: 40, recovery: 80 },
        traits: { loyalty: 85, ambition: 50, risk: 70, lawful: 25 },
        goals: ["loyalty", "status"],
      },
    ),
    character(
      "flacco",
      "Flacco",
      "south",
      null,
      "Your childhood best friend. Inexperienced, with room to grow.",
      {
        skills: { social: 35, work: 30, recovery: 20 },
        goals: ["loyalty", "income"],
        traits: { loyalty: 85, ambition: 45, risk: 35, lawful: 55 },
      },
    ),
  ];
}
// Ordinary residents and membership contacts, never additional major leaders.
export function residents(): Character[] {
  return (["downtown", "rio", "south", "reservoir", "nawf"] as ZoneId[]).flatMap(
    (zone, i) => [
      character(
        `resident-${zone}`,
        ["Alex", "Sam", "Robin", "Drew", "Taylor"][i],
        zone,
        null,
        "Local resident looking for steady work and reliable people.",
        {
          skills: { social: 45, work: 60, recovery: 15 },
          traits: { loyalty: 65, ambition: 35, risk: 20, lawful: 80 },
        },
      ),
      ...(zone === "reservoir" || zone === "nawf"
        ? [
            (zone === "nawf" ? "blips" : "blocks") as FactionId,
            ...(zone === "nawf" ? ["muds" as FactionId] : []),
          ].map((f) =>
            character(
              `contact-${f}`,
              `${f === "blocks" ? "Block Boys" : f === "blips" ? "Blips" : "Mudgang"} contact`,
              zone,
              f,
              "An ordinary member who can sponsor a membership request.",
              { goals: ["loyalty", "income"] },
            ),
          )
        : []),
    ],
  );
}
