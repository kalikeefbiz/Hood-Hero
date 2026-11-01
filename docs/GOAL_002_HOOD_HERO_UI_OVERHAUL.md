# GOAL 002 — HOOD HERO UI OVERHAUL

**Status:** Implemented on `goal-002-hood-hero-ui-overhaul`; see [delivery and validation](GOAL_002_DELIVERY.md). Original approved handoff follows.
**Reference package:** `hood-hero-GOAL-002-ui-overhaul.zip` supplied in the ChatGPT conversation. It includes the **exact user-approved UI image** at `reference/APPROVED_UI_DIRECTION.png`, five approved neighborhood illustrations at `assets/neighborhoods/*.webp`, an asset manifest, and the **full production GOAL** at `docs/GOAL_002_HOOD_HERO_UI_OVERHAUL.md` inside the archive. **Read that full GOAL and inspect the exact image and artwork before editing.** This file is the in-repository bootstrap.

## Mission

Overhaul the complete playable M1 React/TypeScript UI for HOOD HERO. The user approved the reference's **layout and aesthetic**, not its inaccurate literal mechanics or branding. The intended result is grounded premium, restrained graphic-novel detailing, charcoal surfaces, bold condensed headings, clear body type, illustrated Stixx City environment images, readable phone-first game information, and natural street/hood dialect for situations and dialogue. It must not become generic fintech/SaaS, a gang-poster collage, or a static image masquerading as a UI.

Implement all current M1 screens, not just the landing page: New Run/Resume, City, People, Actions, Set, Wallet (Finances), Activity, Save/Load and ending states. Preserve underlying data, action validation, current campaign, event visibility, local saves and all user flows. You have freedom to reorganize React components, CSS, layout and copy for professional game presentation. Keep real action costs, AP, restrictions, outcomes, relationships and status visible. Existing navigation destinations may be relabeled but cannot disappear.

## Exact reference and artwork

`reference/APPROVED_UI_DIRECTION.png` in the supplied zip is the **master art direction**. The five approved environment paintings also live in the zip: `downtown.webp`, `rio.webp`, `south.webp`, `resevoir.webp`, `nawf.webp`. Copy into `public/assets/neighborhoods/` (or an equally suitable app-owned directory), map to existing `ZoneId`, and ensure Vite base-path-safe URLs with `import.meta.env.BASE_URL`. These are real illustrated neighborhoods, not design mockups. Use them in location preview cards and city scenes.

- Downtown: dense commercial/political heart, docks.
- Rio Gabriel: Eastside lowrider street culture.
- Southside: Chicago-inspired housing projects/old loyalty.
- The **Resevoir**: Detroit-inspired boarded homes, vacant lots. Preserve this established spelling and `resevoir` key. Do not use the prior rejected luxury interpretation.
- The Nawf: Bronx-inspired bodegas, Afro-Latino and Black neighborhood culture, elevated train, fallen Mudgang member memorial defaced with purple `Blip Gang` graffiti.

No new character likenesses, universal crown logos, generic brush-script/graffiti brand fonts, unapproved faction emblems or generic stock graphics. The proposed player portrait and imaginary gangs/mission tiles in the reference are artboard fiction, not canon. Use clean typography for the visible HOOD HERO name; final custom wordmark is a later milestone.

## Faction theme rules

Select theme **only** from `player(s).affiliation`, never `player.home` or map selection. Starting in any of five neighborhoods is always unaffiliated.

| Actual `FactionId` | UI accent |
| --- | --- |
| `null` (Independent) | graphite/neutral stone `#A8ADB3` / `#D9D7D1` — **NO YELLOW** |
| `angels` | Gabriel’s Angels yellow/white `#E9BE39` / `#F5F1E6` |
| `blips` | The Blips purple `#8E51CB` / `#B08AD8` |
| `muds` | Mudgang orange/brown `#CD7935` / `#80513C` |
| `backstreet` | Back Street red `#C83D45` / `#EB7376` |
| `blocks` | Block Boys blue `#3678C6` / `#89B3E2` |

Keep neutral charcoal surfaces and high-contrast readable text for **every** gang. Apply accents selectively to active nav, progress, borders, focal buttons and affiliation markers; don't color flood. Risk warnings, police heat and error styles must stay distinct from gang identity. Theme changes immediately after real membership and after reloading a save; no hardcoded demo state. The base `FACTIONS` gameplay colors and save schema are not part of this UI refactor.

## No fictional playable functionality

The app's current actions are defined in `src/core/ActionEngine.ts`. Keep the real work/gig, contact/relationships, The Chains, Set errands/recruitment, affiliate, purchase and time advancement flows. Do not add fake business management, territory capture, rank-up, product running, property market or other M2 button just because the approved image includes an illustrative tile. The Chains demand is mutable, not a fixed `$150` after negotiation. Use true state-driven content; observed city log must respect `observedBy`.

Use hood-appropriate labels like `Clock in`, `Reach out`, `Get put on`, `Your Set`, `Word on the block` when natural; keep cash, AP, risk and requirements explicit and comprehensible. No forced slang in system messages or invented canonical dialogue.

## UX engineering and acceptance

Preserve existing M1 game logic, stable keys (`ZoneId='resevoir'`), no backend and browser-only saves. Refactor `src/ui/App.tsx`, `src/ui/CityMap.tsx`, `src/ui/style.css` as needed to create reusable app shell, HUD, theme, navigation, panel/card and image components. Use text/HTML/SVG/CSS for all controls; do **not** ship the reference board as the UI. You may retain existing bundled Barlow Condensed + DM Sans but give them intentional hierarchy; custom logotype art is deferred.

Prioritize 390×844 iPhone CSS px; test 320px, 375px, 430px and desktop; no horizontal scrolling, clipped labels or dock overlapping actions; safe-area aware, readable body copy, >=44px interactive targets, keyboard and accessible labels, contrast and reduced motion. No huge always-visible banner that hides all interactions below the first fold.

At minimum run `npm ci`, `npm test`, `npm run build`, `npm run test:e2e` with Chromium and WebKit where supported. Do not weaken action tests to hide behavior regressions; adapt label selectors intentionally and add tests for independent/theme transitions, all five scenes, save/load and 320px overflow. Review screenshots for an actual quality pass. Preserve the old live game if deployment remains blocked; baseline documentation notes GitHub Pages setup returned 403 to the integration.

## Execution mode

**One substantial Codex GOAL.** Audit current repo first; make the broad cohesive UI overhaul end to end, iterate internally on visual quality, and commit a meaningful branch. No repeated style approvals or baby-step task splitting. Report changed components, assets, before/after captures, test results, commit SHA, deployment status and any genuine blocker. Physical iPhone playtesting requires a real device; never claim it from emulation.

**Important:** The approved board is a layout/visual-system reference. The master rules in the attached zip's full GOAL are authoritative if this bootstrap omits detail. Do not begin artwork substitution if the art package is missing; report missing assets instead of silently using placeholders.