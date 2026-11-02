// Reproducible GOAL 005 campaigns. Recruitment uses real actions, trust and capacity progression.
import { createServer } from "vite";
import { writeFileSync } from "node:fs";
const server = await createServer({ server: { middlewareMode: true } });
try {
  const { newGame } = await server.ssrLoadModule("/src/core/Simulation.ts");
  const { advanceDay } = await server.ssrLoadModule("/src/core/TimeSystem.ts");
  const { performAction } = await server.ssrLoadModule(
    "/src/core/ActionEngine.ts",
  );
  const {
    availability,
    requestActivity,
    acceptCrewOffer,
    attendCrewActivity,
    attendError,
  } = await server.ssrLoadModule("/src/systems/CrewAgency.ts");
  const { serialize, deserialize } = await server.ssrLoadModule(
    "/src/persistence/SaveSystem.ts",
  );
  const { syncEncounters } = await server.ssrLoadModule(
    "/src/systems/EncounterLifecycle.ts",
  );
  const results = [];
  for (const seed of [1, 7, 21, 83, 2026, 5099])
    for (const companion of [null, "resident-south", "mega"]) {
      let s = newGame("Test(5)", "south", seed);
      const act = (type, target) => {
        const r = performAction(s, { actor: "player", type, target });
        if (r.error) throw new Error(r.error);
        s = r.state;
      };
      if (companion) {
        while (
          s.crew.capacity < 2 ||
          (s.characters[companion].relationships.player?.trust ?? 0) < 42
        ) {
          if (!s.ap) s = advanceDay(s);
          act("socialize", companion);
        }
        if (!s.ap) s = advanceDay(s);
        act("recruit", companion);
      }
      const startDay = s.day,
        startSkills = structuredClone(s.characters.flacco.skills);
      let accepted = 0,
        declined = 0,
        attended = 0;
      while (s.day < startDay + 60) {
        for (const o of s.crewOffers.filter((o) => o.status === "pending")) {
          if (!accepted) {
            acceptCrewOffer(s, o.id);
            if (o.status === "accepted") accepted++;
          } else if (!declined) {
            o.status = "declined";
            declined++;
          }
        }
        for (const a of s.assignments.filter(
          (a) => a.status === "accepted" && a.dueDay === s.day,
        ))
          if (!attendError(s, a.id)) {
            attendCrewActivity(s, a.id);
            attended++;
          }
        for (const id of s.crew.members)
          if (s.ap && !availability(s, s.characters[id])) {
            const activity =
              id === "mega" && s.day % 6 === 0
                ? "partner-crime"
                : s.day % 3 === 0
                  ? "work"
                  : s.day % 5 === 0
                    ? "information"
                    : "social";
            requestActivity(s, id, activity);
          }
        const gig = performAction(s, { actor: "player", type: "gig" });
        if (!gig.error) s = gig.state;
        syncEncounters(s);
        s = deserialize(serialize(advanceDay(s)));
        if (s.end) throw new Error(`Ended: ${seed}/${companion}/${s.end}`);
        if (
          s.ap < 0 ||
          s.characters.player.wallet.clean < 0 ||
          s.characters.player.wallet.illicit < 0
        )
          throw new Error("Invalid economy");
        if (s.crewOffers.filter((o) => o.status === "pending").length > 1)
          throw new Error("Offer spam");
      }
      results.push({
        seed,
        composition: s.crew.members,
        startDay,
        endDay: s.day,
        accepted,
        declined,
        attended,
        offers: s.crewOffers.map((o) => ({
          member: o.member,
          activity: o.activity,
          day: o.createdDay,
          status: o.status,
        })),
        assignments: s.assignments.reduce(
          (m, a) => ((m[a.status] = (m[a.status] ?? 0) + 1), m),
          {},
        ),
        chains: s.incidents["the-chains"].status,
        playerWallet: s.characters.player.wallet,
        startSkills,
        finalSkills: s.characters.flacco.skills,
        members: s.crew.members.map((id) => ({
          id,
          status: s.characters[id].status,
          skills: s.characters[id].skills,
          trust: s.characters[id].relationships.player.trust,
          memories: s.characters[id].memories.length,
          lastIndependentAction: s.characters[id].lastActionDay,
        })),
      });
    }
  const path = "docs/validation/GOAL_005_CAMPAIGNS.json";
  writeFileSync(
    path,
    JSON.stringify(
      {
        campaigns: results.length,
        simulatedDays: results.length * 60,
        results,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    `${results.length} campaigns / ${results.length * 60} days passed; ${path}`,
  );
} finally {
  await server.close();
}
