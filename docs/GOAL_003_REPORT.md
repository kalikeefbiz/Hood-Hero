# GOAL 003 — Living encounters, commitments & narrative presentation

**Correction pass:** The [correction report](GOAL_003_CORRECTION_REPORT.md) supersedes the inline presentation, lifecycle, and save-schema descriptions below.

BlackHouse · Hood Hero · 1 November 2026

Base audited: `main` at `c897fff92419bec48bcf0a9d0fa39bf977abf6a9`.
Development branch: `goal-003-living-encounters`. This implementation is for review; it does not merge or deploy over main.

## What a player can do

A new resident still starts unaffiliated with $125, Flacco in their Set, and two AP. Mega now approaches through an illustrated scene. The player can ask what happened, give their word, refuse, postpone, or simply close the scene. Closing creates no response or obligation. Normal work, relationships, finances, recruitment, affiliation, and day advancement remain available throughout.

After promising, the scene exposes negotiation, buyback, a request to Pablo for leadership intervention, and recovery. Each runs the existing action validator, costs, success calculations, and resolver. The ordinary Actions cards remain available even without a promise. A promise is a relationship expectation, not a mandatory quest gate.

Successful buyback or recovery fulfills the promise. A settlement the player actually brought to leadership also fulfills it when the leadership decision succeeds. A sale breaks the unfulfilled promise. An independent settlement supersedes it without betrayal punishment or accomplishment credit. The city remains playable after every outcome.

## Architecture

| Module | Responsibility |
| --- | --- |
| `src/core/GameState.ts` | Shared persisted encounter instances, generalized commitments, intervention evidence, structured event importance, acknowledgment IDs. |
| `src/core/Encounter.ts` | Typed definitions, eligibility predicates, contextual response factories, requirements, structured effects, and replay/expiration rules. |
| `src/content/encounters.ts` | Authored opening, clarification, refusal, pending-promise, leadership-aware, fulfillment, broken-promise, and independent-resolution dialogue. |
| `src/content/commitments.ts` | Authored promise outcome titles, explanations, and memory meanings. |
| `src/systems/EncounterLifecycle.ts` | Deterministic trigger evaluation, stable instance deduplication, priority selection, opening, dismissal, reminder and incident expiration. It does not depend on the action resolver. |
| `src/systems/Encounters.ts` | Transactional response boundary. Revalidates currently applicable choices; conversations cost no AP; gameplay responses call `performAction`. |
| `src/systems/Commitments.ts` | Promise creation, universal guarded status transition, evidence collection, consequence application, warnings, deadline and contribution evaluation. |
| `src/systems/Incidents.ts` | Existing custody and autonomous outcome mechanics, now with idempotent closure, resolution event/actor, and factual player settlement attribution. |
| `src/core/ActionEngine.ts` | Existing gameplay resolution plus intervention records and commitment evaluation. Closed incidents no longer contribute recovery, negotiation, buyback, favor, or settlement choices to `availableActions`. |
| `src/core/TimeSystem.ts` | Existing daily loop; evaluates deadline consequences **after** NPC and incident progression. |
| `src/core/EventLog.ts` | Routine/personal/major/critical importance, visibility-filtered unseen outcomes, persistent acknowledgment. |
| `src/persistence/SaveSystem.ts` | Schema 2 validation and reference checks for current saves. |

Definitions contain authored predicates and effects; instances store stable IDs, participants, source events, incident links, creation/deadline days, lifecycle status, selected response IDs and resulting event IDs, and follow-up/reminder state. Dialogue and imagery are derived from current `GameState`, not a parallel UI plot. No dialogue display, screen change, or acknowledgment draws simulation randomness.

Triggers cover new runs, returning to Mega through People or story links, a postponed request's reminder, approaching deadlines, leadership news, and incident/commitment outcomes. Reopening an outcome uses its recorded day/event plus Mega's **current** reaction and current property possession. It is not a historical portrait reconstruction and never reapplies action or relationship effects.

The typed definition registry and shared lifecycle can accept more authored encounters. Additional objective evaluators/content can use the existing commitment collection and guarded transition function. No employment, debts, distribution, new factions, combat, or revenge storyline was added.

## Commitment rules

Every commitment has an allocated unique ID, origin encounter/event, requester, responsible actor, beneficiary, objective kind, creation and due days, status, evidence event IDs, warning state, and fulfillment/failure/release relationship consequences.

| Status | Meaning in this milestone |
| --- | --- |
| `pending` | An accepted obligation that is still open. |
| `fulfilled` | Player buyback/recovery or an actual player-prompted leadership settlement returned the property. |
| `broken` | The property became irrecoverable through the existing sale/expiration outcome, or the still-open objective reached its due day. |
| `superseded` | Someone else returned the property without a qualifying player contribution. No player credit or betrayal penalty. |
| `released` | Supported by the common transition/consequence architecture; no additional authored cancellation branch is exposed in The Chains. |
| `completed` / `failed` | Existing crew errand outcomes retained to preserve their established behavior. Errands share the collection, origin/evidence fields, and pending-availability checks. |

The incident's `deadline` is an age, not a calendar day. Promise due day is `startedDay + deadline`: day 1 + 8 = day 9. The player must act before day 9 begins; a warning is issued once when an active obligation has two days remaining. Delays do not move either clock. The existing final-day leadership decision is processed before expiration. A regression test specifically covers a day-9 independent settlement.

Accepting does not increase influence, trust, or respect. Refusing creates no obligation and applies no betrayal penalty. Fulfilling adds Mega → player trust +8 and respect +5, on top of the established incident reward. Breaking applies trust −18, respect −8 and grievance +14, clamped through the existing relationship helper. The character remains a normal simulation NPC. Settlements prompted by the player receive the established incident contribution reward; independent NPC settlements do not.

Failed recovery, information gathering and negotiation are recorded as actual interventions but do not themselves fulfill the property-return objective. Successful actions and final closure events are linked as evidence. Guards prevent duplicate resolution, repeated promises, repeated relationship rewards, and repeated notification creation.

## Presentation and exact approved art

New components: `EncounterScene`, `CharacterPortrait`, `CommitmentSummary`, and `NarrativeNotifications`. `App` integrates them into the accepted HUD, navigation, People, Actions, City, and Set screens. `encounters.css` supplies the restrained scene composition. The original neighborhood and action artwork, affiliation palette, and gameplay cards remain in place.

The explicit typed registry is `src/ui/characterArt.ts`. It reconciles the manifest's `baby-canon` label with the existing canonical simulation ID `babycanon` without renaming that character.

| Approved runtime asset | Integration |
| --- | --- |
| `public/assets/characters/mega/mega-concerned-no-chain.webp` | Initial concerned scene and broken/lost-chain reactions. |
| `public/assets/characters/mega/mega-confident-no-chain.webp` | Assertive pending-promise conversation and current People portrait while missing. |
| `public/assets/characters/mega/mega-confident-with-chain.webp` | Returned-property reaction and current People portrait only when Mega actually possesses the chains. |
| `public/assets/characters/mega/mega-proposing-with-chain.webp` | Registered proposing expression; possession-gated. No extra idea storyline authored. |
| `public/assets/characters/mega/mega-strategizing-with-chain.webp` | Registered strategic expression; possession-gated. No extra storyline authored. |
| `public/assets/characters/angels/baby-canon-portrait.webp` | Baby Canon's People profile. |
| `public/assets/characters/angels/joker-portrait.webp` | Joker's People profile. |
| `public/assets/characters/angels/dizzy-portrait.webp` | Dizzy's People profile. |
| `public/assets/characters/angels/gabriels-angels-trio.webp` | Known participants in The Chains; caption preserves Baby Canon, Joker, Dizzy from left to right. |
| `public/assets/incidents/the-chains/mega-stolen-chain-evidence.webp` | Informed incident item reference, explicitly not a statement of present location or individual custody. |

All ten files are reused unchanged. Older Mega portraits are not used in the new character surfaces. Missing approved portraits (including Flacco, Pablo, Justice, Loco and the protagonist) use typographic placeholders. An image-load failure also falls back to a typographic portrait. Evidence/group illustrations appear only after the incident is informed. Individual profile art is selected by real character ID.

URLs use Vite's `BASE_URL`, dimensions reserve image space, compositions use `object-fit: contain`, and illustrations load lazily. Only the requested Mega illustration loads on the opening; the whole character library is not preloaded. No third-party imagery, JPEG archive delivery, new likenesses, animation system, voice, or external dialogue service was introduced.

## Event visibility and persistence

Major incident closure, commitment outcomes/warnings and important leadership involvement get prominent dismissible notices and character follow-ups. Arrest/death/campaign-end events have critical importance. Ordinary faction operations and day/living-cost bookkeeping remain routine. Current notices appear across screens, show the unseen count, and remain until explicitly acknowledged. Closing a scene alone does not lose its pending notice.

City prioritizes important activity and provides an Important outcomes archive plus a per-incident event record. Routine reports are summarized by day behind expandable reports; underlying event detail is retained. All notification, archive and encounter event selectors honor `observedBy`. Significance cannot reveal a private NPC event.

## Save policy

State and envelope schema are now **2**. The existing storage keys are retained so incompatible disposable M1 saves are detected and explained instead of silently disappearing. The recovery message directs the player to start a new test run. There is no migration layer for disposable schema-1 playtests.

Current saves round-trip relationships, memories, incidents, intervention evidence, commitments, encounter choices/status, pending and acknowledged events, RNG and progression. Autosave still runs after state changes. **Resume now prefers the latest autosave**, including acknowledgment state; **Load** retains explicit manual-checkpoint behavior, with autosave fallback. This prevents an older pre-resolution checkpoint from automatically reopening a completed story on every browser restart. Explicitly loading an older manual checkpoint intentionally restores that earlier world.

## Validation

| Verification | Chromium | WebKit | Result |
| --- | --- | --- | --- |
| Vitest simulation/asset suite | — | — | **65 passed**, 4 files |
| Full browser suite at `/` | **34 passed** | **34 passed** | **68 passed** |
| Production `/Hood-Hero/` browser suite | **19 passed** | **19 passed** | **38 passed** |
| TypeScript + Vite builds, root and production base | — | — | Passed |
| Whitespace/error check (`git diff --check`) | — | — | Passed |

[Full root browser output](validation/GOAL_003_BROWSER_ROOT.txt) · [Production-base browser output](validation/GOAL_003_BROWSER_PAGES.txt). New encounter surfaces pass axe checks at all four mobile widths. The existing comprehensive M1 accessibility/visual review also passes on both engines.

Commands for reproduction on a host with Playwright dependencies installed:

```sh
npm ci
npm test
npm run build
npx playwright install --with-deps chromium webkit
npx playwright test --workers=2 --timeout=90000
VITE_BASE_PATH=/Hood-Hero/ npm run build
PLAYWRIGHT_BASE_PATH=/Hood-Hero/ npx playwright test tests/encounters.spec.ts tests/illustrated.spec.ts tests/city-menu.spec.ts --workers=2 --timeout=90000
```

This managed environment lacks root package installation. Browser dependencies were downloaded from its configured Debian snapshot, extracted locally, and installed in the local WebKit bundle. `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1` was used because the host's ldconfig cache cannot see these locally installed libraries; the actual browsers and all application assertions still run. No test is skipped to hide a browser failure. Early setup failures and intermediate regressions were repaired before the final runs.

The suite covers actual UI-driven conversations, clarification, promise acceptance, costs, buyback, settlement, failure, independent resolution, warning/acknowledgment persistence, history replay, normal play afterward, all homes/themes, mobile widths 320/375/390/430, desktop composition, artwork loading/fallback, and accessibility checks. Simulation coverage additionally exercises recovery success and failure, exact deadline ordering, action eligibility, duplicate prevention, hidden events, crew errands, money/provenance and long-running progression.

Production bundle is approximately 409 kB JS / 127 kB gzip and 67 kB CSS / 14 kB gzip, with the existing local fonts and illustrations loaded separately. Opening Mega art is the approved 163,362-byte WebP; returned-chain art is 246,324 bytes. The tests verify selective loading, not a physical-device network benchmark.

## Screenshot evidence

These are actual running application captures, generated by Playwright from gameplay sequences, not mockups. Primary review captures are Chromium at 390px (plus desktop); corresponding WebKit captures and traces are in Playwright's report/output artifacts.

1. [Initial concerned Mega and contextual responses](screenshots/goal-003/01-opening-and-responses.png)
2. [Accepted promise, deadline and normal action costs](screenshots/goal-003/02-accepted-deadline-and-actions.png)
3. [Follow-up actions after earning money](screenshots/goal-003/03-follow-up-actions.png)
4. [Fulfilled promise with returned-chain artwork](screenshots/goal-003/04-resolved-correct-art.png)
5. [Major fulfillment notification](screenshots/goal-003/05-fulfilled-notification.png)
6. [Broken-promise reaction without the chain](screenshots/goal-003/06-broken-promise-reaction.png)
7. [Major broken-promise notification](screenshots/goal-003/07-broken-promise-notification.png)
8. [Normal playable city after resolution and another work shift](screenshots/goal-003/08-playable-city.png)
9. [Desktop scene composition](screenshots/goal-003/09-desktop-encounter.png)
10. [Informed item reference and correctly identified trio](screenshots/goal-003/10-incident-art-and-known-participants.png)

Screenshot review checks: no-chain initial/pending/broken scenes; with-chain resolution; readable response costs and disabled reasons; restrained faction accent; preserved neighborhood presentation; normal city/dock after resolution. A fixed offscreen skip-link capture artifact was corrected using standard clipped-until-focused styling, preserving keyboard access.

## Reproducible paths and limits

- Fulfillment: new game → promise → local gig → pay the $150 demand → acknowledge reaction → continue work. This costs the ordinary two AP and requires no money fixture.
- Leadership: seed 20 → promise → bring the dispute to Pablo (1 AP) → advance until his existing decision resolves it. The resolving actor remains Pablo and the player's factual intervention is recorded.
- Broken promise: automated seed 83 → promise → advance to day 9 without intervening. Existing autonomous settlement rolls fail, sale occurs, warning and broken-promise consequences remain visible. This is a deterministic test start, not a forced production sale.
- No commitment: decline and keep advancing; the city resolves the situation without a broken-promise penalty.
- Autonomous settlement: default seed, no player intervention; property returns with no player accomplishment credit. An accepted promise is superseded in the equivalent independent-resolution simulation path.
- Recovery: automated seeded attempts use existing success odds and exposure; both success/fulfillment and failed-attempt/no-credit branches are covered.
- Resume: promise/deadline survive reload, meaningful choices cannot reward replay, and acknowledgment autosaves survive Resume even when the manual checkpoint is older.

Physical iPhone Safari testing remains the creator's responsibility. Linux WebKit emulation is not a physical-device validation. No separately deployed feature preview was published: the repository's existing Pages workflow targets the shared site, not an isolated feature-branch preview. Deployment permissions and main are unchanged.

Only The Chains has authored encounter content. Released obligations, new jobs/debts/favors, combat, employment schedules, inventories, additional gangs/characters, and other future systems remain intentionally unimplemented. Proposed/strategizing expressions are available in the registry without adding unrelated scenes. Outcome replay intentionally uses current-world portraits and current reactions alongside the dated recorded outcome.
