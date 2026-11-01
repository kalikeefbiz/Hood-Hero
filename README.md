# Hood Hero · BLACKHOUSE

M1 — Core Simulation and First Playable. An iPhone-first, persistent, turn-based street-politics strategy game in fictional Stixx City. Built with TypeScript, Vite, React, Vitest and Playwright. No backend, accounts, multiplayer, external AI, or runtime network services. Fonts ship with the build.

## Run

Use Node 22.12+ (Node 24 also supported).

```sh
npm ci
npm run dev
```

Open the localhost URL displayed by Vite. Choose a name and any of the five neighborhoods. You begin unaffiliated with $125, 2 AP and Flacco in your personal Set.

```sh
npm test                    # simulation fixtures and automated playthroughs
npm run build               # strict TypeScript check and production build
npm run preview             # serve dist locally
npx playwright install --with-deps chromium webkit
npm run test:e2e             # iPhone 13 emulation, Chromium + WebKit, narrow widths
```

On systems without browser dependencies or install privileges, Chromium may work while WebKit needs additional system libraries. See the exact validation environment in [M1 status](docs/M1_STATUS.md). Tests never silently skip a browser.

## First moves

The City screen contains Cuzzo’s message about The Chains. Open **Actions → The Chains** and reach out to him or ask around. Then work toward payment, negotiate, contact Pablo about a settlement, request Mega’s support, or attempt abstract recovery. A shift earns $96 for 2 AP; a gig earns $38 for 1 AP. Day advancement charges $18 in living expenses, so one gig followed by a night does **not** quite cover the original $150 demand. Another gig, a full shift, or a successful negotiation can bridge the gap.

There is no obligation to help. End Day runs NPC decisions and the incident’s own rules. Once the dispute concludes, the same work, purchases, relationships, membership requests, recruitment, crew errands and city activity remain available. There is no campaign day limit.

**People** shows both directions of trust. **Actions → People** provides social and organizational interactions. **Set** lets you assign lawful errands, remove members and recruit trusted contacts when capacity allows. Influence expands capacity at 5, 15, 30 and 50, to a maximum of five members. Your Set never becomes a sixth gang.

## Save and resume

Every successful action and day advancement autosaves to this browser’s local storage. **Save** creates a manual checkpoint. **Load** and **Resume** prefer the manual checkpoint, falling back to autosave if no manual checkpoint exists. This permits trying an approach and restoring a checkpoint deliberately. A new game replaces autosave but leaves the manual checkpoint until you Save again.

There is one manual slot and one autosave slot, versioned and schema validated. No cloud sync. Clearing site data loses saves. Storage failures display a warning; play can continue in memory. Saves are tied to the browser origin, so localhost and a deployed preview have separate saves.

## Architecture and milestone scope

- [Implemented rules and architecture](docs/SYNDICATE_SYSTEMS.md)
- [Validation, limitations, deployment blocker and M2 priorities](docs/M1_STATUS.md)

React renders state; rules live in `core/` and `systems/`. The late-game wealth, authority, control and successor contracts have tested evaluators. M1 intentionally does not expose property acquisition, territorial warfare, rank advancement, formal retirement or succession controls, so full victory routes cannot yet be completed through normal UI play.

## Deployment

Current visual correction: [GOAL 002B screenshots and assessment](docs/GOAL_002B_VISUAL_CORRECTION.md).

GOAL 002 redesign details, verified artwork and historical screenshot review: [UI overhaul delivery](docs/GOAL_002_DELIVERY.md).

The repository includes CI and a manual GitHub Pages workflow that builds with `VITE_BASE_PATH=/Hood-Hero/`. The original M1 setup was blocked by an integration 403; on November 1, 2026, the Pages site is configured and serves the prior playable build. The `github-pages` environment allows deployments from **main only**. A feature-branch preview cannot pass that environment rule. The GOAL 002 handoff reports the actual workflow result; an existing live M1 site is not evidence that the overhaul deployed.

After the implementation is merged to main, run **Publish playable preview** from Actions. Verify its deployment output and the actual live bundle before claiming success. CI also publishes `playable-build` and `playwright-report` artifacts, including review screenshots. For another static host, upload `dist/`; set `VITE_BASE_PATH` at build time when hosting under a subpath.
