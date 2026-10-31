# M1 status — Core Simulation and First Playable

Implemented 2026-10-31 in `kalikeefbiz/Hood-Hero`, default branch `main`. This is a playable foundation with continuing systems after The Chains; it is not the full campaign.

## Completed

| Area          | Delivered                                                                                                                                                                                                   |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Foundation    | Strict TypeScript, React/Vite, deterministic PRNG, typed stable IDs, shared validated actions, immutable public transitions                                                                                 |
| Canon         | All five zones and five established gangs, unclaimed Downtown, shared Nawf, correct alliances/rivalries, all supplied canonical characters, contextual ordinary residents and member contacts               |
| Player        | Name/home creation, unaffiliated start, $125 clean cash, 2 AP, Flacco as a regular NPC in a capacity-one Set                                                                                                |
| Social        | Directed trust/respect/affection/grievance, introductions, knowledge, event-linked memories, personal values influencing trust                                                                              |
| Economy       | Repeatable work and gigs, abstract illicit trade, provenance-preserving transfers, daily expenses, optional purchases, free-cash stress relief                                                              |
| Living city   | Independent utility-based NPC decisions, separate scheduling and commitments, all five factions making resource/influence decisions, actual exposure-based NPC/player arrest and death                      |
| Set           | Persistent roster, capacity progression up to five, ordinary civilian recruitment, removal preserving history, available-member errands and skill growth, loyalty/conflict-sensitive support                |
| Politics      | Independent personal/zone/organization standing, legitimacy, notoriety, police and rival pressure; relationship-gated sponsored membership in an existing gang                                              |
| Incidents     | Reusable property-dispute state/resolution, owner separate from custody, group-held chains, information, negotiation, help, leadership settlement, buyback, abstract recovery, autonomous escalation/resale |
| Continuity    | Unrestricted day advancement; repeatable work, relationships, purchases, recruitment, errands and affiliation after resolved/abandoned incidents                                                            |
| Persistence   | Version 1 local manual checkpoint and autosave, full world/RNG preservation, schema and key-reference validation, storage error feedback                                                                    |
| End contracts | Data-driven Legitimate Exit, Underlord, arrest and death evaluators, with constructed test fixtures and no fixed campaign deadline                                                                          |
| Presentation  | New Game, City schematic, People, Actions, Set, Finances and Activity; portrait layout, readable state descriptions, AP/cost/risk feedback, safe-area navigation and keyboard controls                      |
| Delivery      | README, systems documentation, CI workflow, production build and manual Pages deployment workflow                                                                                                           |

## Executed validation

The [GitHub Actions validation run](https://github.com/kalikeefbiz/Hood-Hero/actions/runs/41186543742) succeeded on implementation commit `5c20b940ce70ffd7d7719821c6e0e16d1a51d504`, independently repeating the simulation suite, production build and all six browser tests on a standard runner. Its `playable-build` and `playwright-report` artifacts were uploaded successfully. Subsequent handoff changes update documentation only.

- `npm test`: **44 simulation tests passed**. Covers initialization from all five homes, canon, no alliance-transitive hostility, directional relationships, cash/AP constraints, independent behavior, player and ordinary NPC crew rules, civilian recruitment, removing inactive/active Flacco, gang-count boundary, affiliation gates, end fixtures, save errors/round trips, pending commitments and exact seeded replay.
- Automated simulation playthroughs include immediate engagement, ignoring the incident, earning lawful money first, risky recovery across four seeds, recruitment, removal, post-incident work, and Downtown/Southside starts.
- A **160-day** lawful campaign completes without a campaign timer or arbitrary defeat. This is a bounded regression check, not a claim of unlimited performance.
- `npm run build`: strict TypeScript and Vite production bundle passed. Vite reports harmless third-party Zod pure-comment annotation warnings.
- `npm run test:e2e` against the production preview: **6 mobile browser tests passed**, 3 in Chromium and 3 in WebKit with iPhone 13 emulation. Includes creation, AP use, day advancement, save/load across reload, all six in-game navigation screens, buyback, continued paid work, crew errands, and 320px overflow checks.
- Mobile screenshots inspected. Font assets are bundled locally. No external runtime services are needed.
- **Physical iPhone / installed Safari verification remains outstanding.** Linux WebKit emulation is not physical-device verification.

### Local browser host setup

The workspace initially lacked GTK4, Graphene, HarfBuzz ICU, Manette, Hyphen, GLES and transitive libraries; `playwright install-deps` failed because root authentication was unavailable. Debian packages were downloaded and extracted into `/workspace/browser-runtime/`, with library links added to the downloaded WebKit runtime. These host-only files are outside the repository.

The executed local browser command used:

```sh
LD_LIBRARY_PATH=/workspace/browser-runtime/root/usr/lib/x86_64-linux-gnu \
PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1 npm run test:e2e
```

The validation override bypassed a system `ldconfig` cache check that cannot see the user-local GLES library. Both actual browser engines launched and executed all interaction assertions; no tests were skipped. Standard developer/CI hosts should use `npx playwright install --with-deps chromium webkit` and run `npm run test:e2e` normally after building.

## Deployment

Direct Pages setup attempt:

```text
GET /repos/kalikeefbiz/Hood-Hero/pages → 404 Not Found (no existing site)
POST /repos/kalikeefbiz/Hood-Hero/pages {"build_type":"workflow"}
→ 403 Resource not accessible by integration
```

The integration can push the repository, but its token lacks permission for this Pages API mutation. The [manual deployment run](https://github.com/kalikeefbiz/Hood-Hero/actions/runs/41186540597) also failed: `actions/configure-pages@v5` with `enablement: true` reported **Create Pages site failed: Resource not accessible by integration**. Declaring standard workflow `pages: write` and `id-token: write` permissions did not grant site-creation access. This is the confirmed deployment blocker; there is no live playable URL.

The production `/Hood-Hero/` subpath build was separately loaded with Chromium through local Vite preview (with `VITE_BASE_PATH` set for both build and preview): HTTP 200, game creation and a paid work action passed, with zero page errors. A repository administrator with Pages configuration access must enable the GitHub Actions source, then rerun **Publish playable preview**. The workflow is committed and ready; no deployment success is implied.

## Incomplete systems and limits

- No property market, business acquisition/management, laundering, territorial warfare, organizational rank progression, switching affiliation, successor-selection or formal-retirement interface. Their persisted contracts and end evaluators exist; both victory journeys are not yet reachable through normal M1 UI.
- One authored incident instance. Its resolver/state are reusable, but there is no procedural incident/content generator. No new city lore or additional major leaders were invented.
- NPC decisions are deliberately small and deterministic. No deception, prison communication, tactical violence, police cooperation or detailed job planning. No assassination/hitter subsystem or fake buttons for it.
- Faction actions are lightweight resource/influence changes; zone control does not change through warfare in M1. Justice’s internal tension is modeled as instability and values, not a complete leadership contest.
- All M1 characters receive full daily processing because the cast is small. Geographic attention budgeting, large populations and detailed travel/hourly scheduling are deferred.
- UI uses one default seed; the simulation API accepts explicit seeds. Information is coarse contact knowledge and incident flags; activity shows public city decisions and personally observed consequences.
- Local-only storage, one manual slot plus autosave, no export/import, cloud sync or previous-format migrations. History grows without compaction; large campaigns increase cloning/storage costs and can hit browser quota. Storage failures display a warning and preserve the in-memory game.
- No service worker, offline installation, audio, extensive art or animations. The downloaded application is self-contained but is not advertised as an installable offline PWA.
- Balance is initial M1 tuning. Lawful work is reliably accessible to preserve the continuing loop; income, risk and progression need longer human playtesting.

## Recommended M2

1. Add one small lawful business/asset loop with provenance, recurring costs/income and reachable formal retirement; retain meaningful work choices.
2. Add organizational contribution/authority progression and limited contested-zone politics within the existing five gangs; keep the Set separate.
3. Add two or three incidents using the existing dispute/action pipeline, with richer information, promises and memory-driven NPC responses.
4. Add a second nonviolent crew assignment, more meaningful cooperation/availability choices and recovery from incarceration; avoid expanding into an assassination system yet.
5. Split growing UI screens into dedicated modules, add accessible onboarding and save export/import, migrate larger histories to IndexedDB with tested compaction/migrations.
6. Complete physical-iPhone Safari testing, tune long-play economy/risk and make deployment permissions reproducible.
