// One-time migration evidence. Future creator rewrites need not match baseline wording.
// Usage: node scripts/verify-copy-parity.mjs /path/to/accepted-goal-007
import { createServer } from "vite";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const baseline = process.argv[2];
if (!baseline) throw Error("Provide an accepted GOAL 007 checkout");
const servers = await Promise.all(
  [baseline, process.cwd()].map((root) =>
    createServer({
      root,
      server: { middlewareMode: true, hmr: false },
      appType: "custom",
    }),
  ),
);
try {
  const modules = await Promise.all(
    servers.map(async (server) => {
      const load = (p) => server.ssrLoadModule("/src/" + p + ".ts");
      const [simulation, actions, time, encounters, lifecycle, saves] =
        await Promise.all([
          load("core/Simulation"),
          load("core/ActionEngine"),
          load("core/TimeSystem"),
          load("systems/Encounters"),
          load("systems/EncounterLifecycle"),
          load("persistence/SaveSystem"),
        ]);
      return {
        ...simulation,
        ...actions,
        ...time,
        ...encounters,
        ...lifecycle,
        ...saves,
      };
    }),
  );
  const [a, b] = modules;
  const plain = (x) => JSON.parse(JSON.stringify(x));
  let checkpoints = 0,
    responseBranches = 0;
  function equal(x, y, where) {
    if (
      typeof x === "string" &&
      typeof y === "string" &&
      where.includes("rendered HTML")
    ) {
      x = x.replace(/ data-response="[^"]*"/g, "");
      y = y.replace(/ data-response="[^"]*"/g, "");
    }
    assert.deepEqual(plain(x), plain(y), where);
    checkpoints++;
  }
  let renderedComponents = 0;
  for (const home of ["south", "rio", "nawf", "downtown", "resevoir"]) {
    const state = a.newGame("Creator", home, 42),
      noop = () => {};
    for (const [component, props] of [
      [
        "NewRun",
        {
          name: "Creator",
          home,
          setName: noop,
          setHome: noop,
          start: noop,
          load: noop,
          hasSave: true,
          feedback: null,
        },
      ],
      [
        "GameHUD",
        { s: state, selected: home, cinematic: true, save: noop, load: noop },
      ],
      [
        "EncounterScene",
        {
          s: state,
          encounter: state.encounters[0],
          respond: noop,
          dismiss: noop,
        },
      ],
      ...["Streets", "Honest", "Connects"].map((category) => [
        "ActionsHub",
        {
          s: state,
          category,
          setCategory: noop,
          focus: "mega",
          setFocus: noop,
          act: noop,
          openSupplier: noop,
        },
      ]),
      ["InventoryWallet", { s: state, open: noop }],
    ]) {
      const views = await Promise.all(
        servers.map((server) =>
          server.ssrLoadModule("/src/ui/" + component + ".tsx"),
        ),
      );
      equal(
        renderToStaticMarkup(createElement(views[0][component], props)),
        renderToStaticMarkup(createElement(views[1][component], props)),
        component + " rendered HTML parity",
      );
      renderedComponents++;
    }
  }
  for (const seed of [1, 7, 42, 2026, 9001, 123456])
    for (const home of ["south", "rio", "nawf", "downtown", "resevoir"]) {
      let x = a.newGame("Creator $& {player}", home, seed),
        y = b.newGame("Creator $& {player}", home, seed);
      for (let day = 1; day <= 30; day++) {
        equal(x, y, `full saved state seed ${seed} ${home} day ${day}`);
        // Every available scene choice branches into independent identical states.
        for (const e of x.encounters.filter((e) =>
          ["active", "pending"].includes(e.status),
        )) {
          const f = y.encounters.find((f) => f.id === e.id),
            da = a.encounterDefinition(e),
            db = b.encounterDefinition(f);
          equal(da.dialogue(x, e), db.dialogue(y, f), "dialogue parity");
          equal(
            da.responses(x, e),
            db.responses(y, f),
            "response label, detail, ID and effect parity",
          );
          for (const r of da.responses(x, e)) {
            equal(
              a.respondEncounter(x, e.id, r.id),
              b.respondEncounter(y, e.id, r.id),
              "choice outcome parity",
            );
            responseBranches++;
          }
        }
        for (let step = 0; step < 3; step++) {
          const available = a
            .availableActions(x)
            .filter((action) => !a.validateAction(x, action));
          equal(
            a.availableActions(x),
            b.availableActions(y),
            "available action parity",
          );
          if (!available.length) break;
          const chosen =
            available[(seed + day * 7 + step * 11) % available.length];
          const left = a.performAction(x, chosen),
            right = b.performAction(y, chosen);
          equal(left, right, "action state, authored events and errors parity");
          x = left.state;
          y = right.state;
        }
        const stores = [new Map(), new Map()].map((map) => ({
          getItem: (k) => map.get(k) ?? null,
          setItem: (k, v) => map.set(k, v),
          removeItem: (k) => map.delete(k),
        }));
        a.saveGame(stores[0], x);
        b.saveGame(stores[1], y);
        x = a.loadGame(stores[0]);
        y = b.loadGame(stores[1]);
        equal(x, y, "save/load parity");
        x = a.advanceDay(x);
        y = b.advanceDay(y);
      }
    }
  const report = {
    baseline: "2fced25c28875b976dd963c33a32dce7e09b7e29",
    renderedComponents,
    campaigns: 30,
    days: 900,
    checkpoints,
    responseBranches,
    exactStateAndTextParity: true,
  };
  writeFileSync(
    "docs/validation/CONTENT_PARITY.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(report);
} finally {
  await Promise.all(servers.map((s) => s.close()));
}
