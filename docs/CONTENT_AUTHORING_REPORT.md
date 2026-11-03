# GOAL 007a — content authoring

BlackHouse / Hood Hero. This is a text relocation, with no intended gameplay or save-format changes. Creator rewrites are deliberately excluded.

## Accepted baseline and delivery

PR #6, accepted head `2fced25c28875b976dd963c33a32dce7e09b7e29`, was merged first into main as `343b52fb4d0603ae1b793ef84e12cb5d86c36ca3`. Implementation branch: `goal-007a-content-authoring`. The implementation is for creator review and must not be merged without approval.

The Pages environment only accepts main workflows. Adding a branch exception was denied with HTTP 403. Following the existing playtest pattern, main received **only** `.github/workflows/preview-content-authoring.yml` in `3ba5676d8d58e879e82e0acb535ea587f9b49696`. That manually dispatched workflow accepts a review commit in `ref` and checks it out for build/deploy. It does not integrate application changes into main. The editing guide explains both review deployment and ordinary approved main deployment.

## Created writing files

All 626 editable entries are bundled locally from `src/content/copy/`; no runtime fetching, CMS or external service is involved.

| File                         | Entries | Migrated writing                                                                                                        |
| ---------------------------- | ------: | ----------------------------------------------------------------------------------------------------------------------- |
| `actions.json`               |      88 | All 25 existing action labels, descriptions and outcome summaries; action-card labels and selected dynamic descriptions |
| `interface.json`             |     391 | Navigation, static JSX text, accessible labels, selected status messages; grouped by existing component                 |
| `neighborhoods.json`         |      25 | All five names, subtitles, descriptions, image descriptions and flavor lines                                            |
| `characters.json`            |      11 | Canonical/resident/player descriptions and selected presentation names                                                  |
| `crew-dialogue.json`         |      40 | Conversation, offers, response labels/details, activity labels, availability replies                                    |
| `workplace-dialogue.json`    |      17 | Dialogue, choices, existing scene outcome reactions and a memory description                                            |
| `supplier-dialogue.json`     |      24 | Opening tones, terms, debt reminders, choices/details, fallback reaction                                                |
| `city-events.json`           |       8 | Advancement, succession, a challenge reaction, and all three ending narratives                                          |
| `storylines/the-chains.json` |      22 | Opening, clarification, stable choice labels, pending-promise follow-ups, all Mega outcome reactions                    |

Chains entries are grouped by scene/purpose: `opening`, `clarification`, `choices`, `followUp`, `responses`, `reactions`. Future scenes can use the same structure. Developers register new IDs/variables and hook them into existing encounters; JSON never determines eligibility, branching, effects or scheduling.

## Supporting files

- `src/content/copy.ts`: typed lookup and text rendering, with explicit static JSON imports compatible with the browser bundle and Node-based test fixtures.
- `src/content/copy-contract.ts`: developer-owned stable IDs and the exact permitted named variables for each entry. It contains no narrative wording.
- `src/content/copy-rules.ts`: shared structure, placeholder and runtime-variable checks. Values are plain strings/finite numbers, inserted once by callback replacement. Dollar signs, Unicode, names containing braces and replacement metacharacters are preserved. React renders the result as text.
- `scripts/validate-copy.ts`: strict JSON parsing plus duplicate-object-key detection, required/unknown key checks, placeholder checks and AST-based unused-ID detection.
- `src/tests/copy.test.ts`, `scripts/copy-validation.test.mjs`, `tests/content-authoring.spec.ts`: authoring/runtime boundaries, changed wording independent of response effects, negative validation cases and phone wrapping/text escaping.
- `scripts/verify-copy-parity.mjs`: reproducible one-time comparison with a clean accepted baseline checkout. It is intentionally not a permanent wording lock: approved future rewrites must remain possible.
- `scripts/verify-content-live.mjs`: verifies the served commit, schema and exact bundled JavaScript hash, then exercises both public browser engines.
- `docs/CONTENT_EDITING.md`: iPhone/GitHub authoring and deployment guide.
- `docs/validation/CONTENT_PARITY.json` and validation logs: migration/regression evidence.

`npm run validate:copy` runs automatically before **both** `npm test` and `npm run build`, including the existing CI and Pages workflows. Invalid content fails before a build can ship. Tests that locate migrated labels or assert migrated static dialogue now read copy keys instead of freezing the previous sentences; their state/effect assertions remain. Dynamic response locators use the existing response IDs via a nonvisual `data-response` attribute. Node 22.6+ is declared for the validator’s native TypeScript support; the established workflows already use Node 22. Build metadata identifies GOAL 007a while retaining schema 8.

## Existing application files updated

- `src/core/ActionEngine.ts`: only action presentation fields; action IDs, AP, risk constants and resolvers stay in code.
- `src/core/Simulation.ts`: only the player’s initial description.
- `src/content/encounters.ts`, `crewEncounters.ts`, `streetEncounters.ts`, `workplaceEncounters.ts`: dialogue/response wording only. IDs, effects, triggers, priorities, expression conditions and eligibility remain in code.
- `src/content/characters.ts`, `city.ts`, `src/ui/neighborhoods.ts`: presentation fields only; no control, faction membership, statistics or image paths moved.
- `src/systems/CrewAgency.ts`, `Workplace.ts`, `Politics.ts`, `EndConditions.ts`: selected text expressions only, retaining the existing calculations and conditional selection.
- `src/ui/App.tsx`, `ActionCard.tsx`, `ActionsHub.tsx`, `ActivityFeed.tsx`, `CityMap.tsx`, `CommitmentSummary.tsx`, `EmploymentSummary.tsx`, `EncounterScene.tsx`, `GameHUD.tsx`, `InventoryWallet.tsx`, `NarrativeNotifications.tsx`, `NewRun.tsx`, `StrategyPanels.tsx`, `StreetWork.tsx`: text references. No CSS, layouts or artwork changed.

## Text intentionally left in TypeScript

This is a bounded authoring foundation, not complete extraction. The following require future targeted passes:

| Location                                                                                                          | Remaining writing and reason                                                                                                                                                                                                                                                                           |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/content/workplaceEncounters.ts`, `src/systems/Workplace.ts`, `Employment.ts`                                 | **Difficult shift**, **Coworker request**, **Extra work offer** are stored event-title branch selectors. Moving editable versions would change scene selection and break old saves. Hiring, attendance and employer messages remain with those resolvers.                                              |
| `src/core/ActionEngine.ts`                                                                                        | Validation errors, resolved-action event text, ledger reasons and memory summaries. Some errors are compared by the UI. Extract separately after identifying every consumer. Risk enum values stay fixed because presentation also compares them.                                                      |
| `src/systems/Incidents.ts`, `Commitments.ts`, `src/content/openingIncident.ts`                                    | Incident resolution/event headlines, promise notifications and historical memory writing. All **spoken Mega dialogue** is external, but this separate saved-event layer remains intact.                                                                                                                |
| `src/systems/CrewAgency.ts`                                                                                       | Cooperation/refusal reasoning, capability bands, assignment results and autonomous-offer event records beyond the extracted availability/activity labels. Keep their conditions and recorded history intact in a targeted follow-up.                                                                   |
| `src/systems/StreetEconomy.ts`, `CriminalExposure.ts`, `Incarceration.ts`                                         | Transaction, debt, enforcement and custody events/errors; supplier reaction scenes continue displaying the already stored event text.                                                                                                                                                                  |
| `src/systems/Territory.ts`, `Factions.ts`, `NPCDecisionAI.ts`, `Businesses.ts`, `Politics.ts`, `EndConditions.ts` | Other faction/territory/business events, requirements, ledger reasons and diagnostic bands. Only the selected city/ending narratives above moved.                                                                                                                                                      |
| `src/ui/*.tsx`, `theme.ts`, `src/content/jobs.ts`, `economy.ts`, `street.ts`, `strategy.ts`, `factions.ts`        | Remaining conditional/template fragments, dynamic aria descriptions, band/status words, action-category/context headings, job/item/business/faction labels and descriptions. These were not included in static JSX extraction. No developer-facing IDs/asset references were moved into editable text. |

## Validation

The accepted baseline’s 173 Vitest tests passed before extraction. Final authoring and regression results are recorded in the accompanying validation logs.

Exact baseline comparison passed **30 seeded campaigns / 900 days / 11,187 comparisons / 2,384 independent response branches**. Complete GameState, event text, actions, encounter dialogue/response labels/details/effects, save/load and continuation matched. **35 rendered HTML comparisons** cover NewRun, HUD, Chains dialogue, all three Actions categories and inventory across all five homes, including inline whitespace (excluding only the new nonvisual `data-response` test selector). See `CONTENT_PARITY.json`. Reproduce with `node scripts/verify-copy-parity.mjs /path/to/accepted-checkout` after installing dependencies there.

The regression suite covers new games, Chains buyback/recovery/leadership and promise outcomes, crew agency, employment, supplier acquisition/repayment/default, police consequences/incarceration/release, dynamic faction control, organizational advancement/succession, business ownership, both victory routes, save/load and deterministic replay. Phone checks cover **320, 375, 390 and 430px**, long names/descriptions, scene scrolling and button bounds.

The first browser run passed all 69 Chromium scenarios; WebKit could not launch because workspace libraries were absent. Debian library packages were installed in the user-owned browser runtime and WebKit was rerun. No product workaround was introduced. An initial Node-based browser-fixture load also exposed the need for JSON import attributes; the final imports work in both Node and Vite.

Public deployment uses the review workflow at **https://kalikeefbiz.github.io/Hood-Hero/**. Final commit/deployment run and public Chromium/WebKit evidence are recorded in the PR delivery note; `build-info.json` is the served-commit authority. The live verification also compares public JavaScript bytes against the locally validated Pages bundle.

## Compatibility and limits

`GameState.ts`, save parsing/migrations, persistence keys and schema **8** are unchanged. No historical event, commitment, relationship memory or existing stored description is rewritten. Current dialogue uses bundled copy; new campaigns initialize descriptions from it. This preserves existing saves instead of retroactively altering their record.

No gameplay actions/NPCs/storylines, economy values, territory balance, progression, simulation rules, UI layouts or artwork were added or changed. The existing Vite bundle-size advisory remains; no unrelated build optimization was attempted. Automated WebKit phone tests do not replace physical iPhone review. The public preview replaces the existing URL, as with earlier milestones; creator approval is still required to merge this implementation.
