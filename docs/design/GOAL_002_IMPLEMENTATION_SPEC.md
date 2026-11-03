# GOAL 002 — HOOD HERO UI OVERHAUL

**Repository:** `kalikeefbiz/Hood-Hero`  
**Status:** Design APPROVED; production implementation GOAL  
**Working game:** M1 persistent Stixx City simulation on `main`  
**Target:** Mobile-first premium game interface, iPhone Safari priority; preserve desktop usability  
**Design authority:** `reference/APPROVED_UI_DIRECTION.png` in the supplied archive. This specific board was selected by the user. Do not substitute earlier boards, generate a replacement design, or default to a generic dashboard.

## Mission and autonomy

Replace the present plain Syndicate presentation with a polished, game-specific **Hood Hero** interface, faithfully inspired by the APPROVED reference. The goal is to make the **entire playable M1** feel like a cohesive commercial street-life RPG/strategy game. You are empowered to reorganize the React UI into reusable components, improve layout, transitions, information hierarchy, responsive behavior, copy, style tokens and asset delivery. This is **one substantial GOAL**, not a sequence of microscopic cosmetic tickets. Make coherent, thoughtful visual decisions without stopping for repeated design approvals.

Build what the existing game actually supports; this is an **interface/asset overhaul** and **not** a simulation, combat, business, or territory-expansion milestone. Keep M1 working throughout. Do not claim a feature works if only its visual card exists.

## Approved design — what is locked

1. **Reference:** Three tall columns on the selected master board: new-run/hood selection, independent player game HUD, affiliated game HUD. Footer is component/color guidance. Translate its layout rhythm, information hierarchy and illustration-first style—not its erroneous literal mechanics, fake character likeness, brush lettering, or crowns.
2. **Visual character:** grounded premium + restrained graphic-novel influence; muted black/charcoal surfaces, firm panel edges, carefully cropped illustrated environments, confident condensed headlines, readable body text, quiet texture and strong spacing.
3. **Identity:** no crown as universal logo or shorthand for gangs; no ubiquitous AI brush/graffiti title font; no illegible grunge layers, gratuitous neon, loot-box/mobile-casino look, generic corporate SaaS dashboard, fake street caricatures, or brightly colored full-screen themed backgrounds. Do not lock the player into an invented face. **Final wordmark/portraits/gang emblems are not approved** and are explicitly out of scope. Use a restrained, clean *HOOD HERO* typeset label, not a fabricated logo.
4. **Artwork:** use the five approved actual **environment images** under `assets/neighborhoods/` as canonical location illustrations. Copy/optimize them into the app; do not generate replacement neighborhoods. User approval has been given to these five scenes. Respect their environments:
   - `downtown`: downtown towers, commerce/politics, docks, elevated police presence.
   - `rio`: Rio Gabriel, warm Eastside streets, lowrider culture.
   - `south`: Southside, central Chicago-inspired project building, worn streets.
   - `reservoir`: **The Reservoir** (preserve this canonical spelling/key), Detroit-inspired boarded houses and vacant lots. NEVER substitute the old luxury-district concept.
   - `nawf`: The Nawf, Bronx-style bodegas, elevated train, Afro-Latino/Black culture; defaced fallen Mudgang memorial with purple 'Blip Gang' tag. No people wearing purple or brown gang-uniform clothing in the scene.
5. **Game naming:** visible product name HOOD HERO. Stixx City remains canonical. BLACKHOUSE is publisher. `Syndicate` may remain in internal technical identifiers if renaming risks disruption; don't sweep-rename schema or package names.
6. **Tone:** stronger authentic hood dialect for story, spoken situations and natural choices. Status labels, instructional microcopy, money, AP, risk, eligibility and consequences must remain immediately comprehensible. **Distinct voices, no repetitive 'AI tough-guy' slogans, no forced slang in every sentence.** No new canon or new gang leadership.
7. **Timeless setting:** blend of contemporary and established neighborhood history, not sci-fi, and no forced exact calendar year.

## Theme system — implementation contract

Define one central UI theme-token map keyed by `Character.affiliation` (`FactionId | null`), **not** the player's home neighborhood, the selected city-map zone, or a sample screenshot's faction. Starting in any hood is independent. Only successful sponsored affiliation changes the HUD theme. Use actual `player(s).affiliation` in live app state.

| `affiliation` | Name | Primary UI accent | Secondary | Notes |
| --- | --- | --- | --- | --- |
| `null` | Independent / Unaffiliated | `#A8ADB3` | `#D9D7D1` | **Graphite/stone, not yellow.** The approved artboard wrongly shows a yellow highlight in the independent column. Correct it. |
| `angels` | Gabriel’s Angels | `#E9BE39` | `#F5F1E6` | Yellow/white |
| `blips` | The Blips | `#8E51CB` | `#B08AD8` | Purple |
| `muds` | The Muds / Mudgang | `#CD7935` | `#80513C` | Orange/brown |
| `backstreet` | Back Street | `#C83D45` | `#EB7376` | Red |
| `blocks` | Block Boys | `#3678C6` | `#89B3E2` | Blue |

Suggested neutral tokens: background `#101215`; surface `#191C20`; elevated surface `#202329`; border `#34383F`; text `#F2F1ED`; secondary text `#A9ADB4`; muted `#797F88`. Tokens are approved design direction; adjust exact CSS for readable contrast and proper states.

Use faction accents on the active navigation indicator, primary action emphasis, selective borders, faction markers, and progress accents; keep most panel surfaces dark. **Do not flood panels with gang color.** Keep semantic color independent of membership: money positive, risk/danger, disability, status, and police heat must remain distinguishable (especially for Back Street's red theme). Honor reduced motion and accessible contrast. Theme updates immediately on affiliation and after save/load without flashing or stale persisted UI state. Theme styling must not mutate `FACTIONS` simulation data.

## Presentation architecture and screen coverage

Inspect the current `src/ui/App.tsx`, `src/ui/CityMap.tsx`, `src/ui/style.css`, `src/core/GameState.ts`, `src/core/ActionEngine.ts`, `src/persistence/SaveSystem.ts`, `src/content/`, and existing test code before making architectural choices. Refactor reasonably; don't rewrite the simulation. In M1, `Screen = 'City' | 'People' | 'Actions' | 'Set' | 'Finances' | 'Activity'`. Maintain **all six destinations**, whether labels are localized to `City / People / Moves / Set / Wallet / Log` or not. Any renamed visible label should retain semantic accessibility and update tests intentionally.

- **New Run / Resume**: the first screen must feel like a game. Name field stays present and functional; five distinct illustrated neighborhood choices using actual art; selected state independent/neutral; all five homes selectable. Enter Stixx City, resume autosave/manual checkpoint and input validation stay intact. A starting zone never implies gang affiliation. Artwork is supporting scenery rather than image-embedded UI.
- **City as the home hub**: clear identity/top HUD with **current player name**, neighborhood/affiliation, **day**, **cash**, **AP**; a strong illustration of the current zone or selected view; a readable visual city map that still allows selection of all five locations and dynamically reflects true controller/organization state; timely observed city news; The Chains when active; access to real actionable events; a comprehensible standing/status summary. No fictional live 'quest generator' events.
- **Actions / Moves**: clean grouping (existing Everyday, The Chains, People), clear targets and context, real action buttons, AP/cash/skill prerequisites, risk/possible outcomes, disabled reasons; no decorative 'Handle Biz', 'Run Product', 'Claim Territory', 'Business', 'Expand', 'Move Weight' or similar buttons unless the actual implemented action exists. Respect `validateAction` and `performAction` everywhere.
- **People**: contact list, actual characters/aliases and affiliations, readable details and **directional** trust meters (their trust in you versus your trust in them), shared memories and event history, action entry points. Do not invent portraits for Cuzzo, Flacco, Pablo or a customizable player; use tasteful initials/silhouette treatments until later approved character art.
- **Set**: members (Flacco begins as one member), capacity and trust, recruit/remove, paid errand and commitment states. Personal Set remains separate from the five gangs; it never becomes a sixth faction. No invented extra crew contracts.
- **Wallet / Finances**: clean vs illicit cash provenance, real transaction history, purchases and actual current costs. Do not render fake assets or a business management feature.
- **Activity / Log**: visible observed events, situation statuses, filters, day grouping. Use the existing permission/visibility handling; do not leak NPC private events.
- **Ending, save, load, game information**: unchanged behavior, improved presentation. Keep in-game Save and Load, autosave, Resume, New Game, End Day, errors, confirmations and end-state messaging operable and easy to discover.

**Phone-first layout guidance:** at 390×844 CSS px, the core HUD + meaningful interaction must appear early, without sacrificing accessible scroll; at 320 CSS px there is no side-scrolling or clipped bottom navigation; at 375/390/430 and desktop responsive layouts are composed intentionally. At minimum 44×44 CSS px touch targets, iPhone safe-area insets, keyboard-friendly forms, sticky/fixed dock that does not obscure content, no iOS page-zoom traps from small inputs, no full-height poster that pushes all gameplay below the fold. Use native/accessible React controls for text and interaction. No flattening of UI into images.

## Asset integration

The supplied zip contains `assets/neighborhoods/{downtown,rio,south,reservoir,nawf}.webp`, each ~1448×1086 and 0.4–0.5 MB. On intake, copy into `public/assets/neighborhoods/` (or an equally appropriate app-owned path) and introduce a typed mapping from existing `ZoneId` to paths. With Vite/GitHub Pages, prefix asset URLs with `import.meta.env.BASE_URL` (do not hardcode `/assets` at the root; repo deploys under `/Hood-Hero/`). Use responsive CSS `object-fit`/`object-position`; lazy load below-the-fold images. Do not ship the huge approved UI reference image as a runtime asset.

Extract palette into CSS custom properties or typed theme config; style all shared primitives consistently. The reference's tiny illegible copy is not a CSS font-size target. Reuse installed Barlow Condensed and DM Sans initially; let expressive typography emerge from composition/weight rather than applying a stock paintbrush font. Custom wordmark is deferred.

## Engineering guardrails and quality criteria

1. Preserve the current typed action engine, NPC AI, incident progression, the five gangs and five neighborhoods, procedural world persistence, save key/schema, AP balance, money provenance, win/loss evaluators and all existing working flows. No gameplay economy changes disguised as design tweaks.
2. Separate **presentational copy** from action type IDs; do not rename canonical enum keys, `ZoneId='reservoir'`, `FactionId` values, stable saved IDs, or test seeding contracts.
3. Refactor `App.tsx` where meaningful into understandable components (`GameShell`, `Theme`, `HUD`, `BottomNav`, `ZonePreview`, `ActionCard`, `PersonCard`, `EventCard`, `Feedback`, `SaveControls`, etc.) but avoid architecture for architecture's sake. CODEx owns internal component cut decisions.
4. Buttons and menus must always trigger real existing actions or real navigation. No placeholder functionality, fake 'locked' teaser buttons that imply an implemented M2 feature, hardcoded world data, synthetic progress, static faction colors, or unreadable disabled actions.
5. Allow natural city/incident dialogue but make probability/requirements explicit. Example presentation-only labels: `Clock in` for `work` ($96 / 2 AP); `Pick up a gig` for `gig` ($38 / 1 AP); `Reach out` for `contact`; `Get put on` for `affiliate` subject to real 35 organization standing + 35 sponsor trust. Use actual costs from source definitions, not duplicated constants. 'The Chains' demand is stateful and may change; never hardcode $150 after negotiation.
6. Preserve and extend tests. Existing baseline in repo docs: 44 simulation tests, 6 mobile browser tests, production build. Verify against current HEAD rather than assuming those counts remain exact. Do not quietly weaken tests just to satisfy redesign. If labels change, adjust UI locators based on accessible names/roles while still testing behavior. Add focused coverage for all five zone images loading, unaffiliated starting themes across all homes, switching to at least two faction themes via valid game state, persistence reload, 320px no overflow, real action triggers, navigation, AP/cash display, and disabled reason discoverability.
7. Run `npm ci`, `npm test`, `npm run build`, and Playwright Chromium + WebKit if environment permits; run manual screenshot review at 320, 390, 430 and desktop, especially portrait iPhone dimensions. No browser/page/console errors; no broken image or missing alt text; UI isn't a screen-sized static image. Prefer a short GIF/screenshot comparison if helpful for human review; save 4–8 screenshots as review artifacts without requiring user to download them all.
8. Deploy to a preview if existing configured host allows. GitHub Pages site enablement was reported blocked at HEAD by integration 403. Do not claim deployment unless it is actually live and verified. If blocked, keep implementation ready and report the precise permission blocker.
9. Protect art provenance. Work with bundled reference and neighborhood art only; no new photo-search assets, no third-party brand marks, no stock person photos, and no unapproved gang insignia. If an environment file is missing on your runner, stop pretending it was embedded; report which assets could not be imported and keep the UI robust with neutral non-styled fallback.

## Execution and delivery — give the implementation room to cook

- Create a meaningful branch (e.g. `goal-002-hood-hero-ui-overhaul`) unless instructed by active repository conventions otherwise.
- Audit the current M1 UI and identify its pain points. Implement the **complete cohesive visual pass across the entire M1 UI**, not just New Game or one navigation screen. Iterate visual composition independently until screens plausibly match the selected approved board's quality and cohesion, after correcting board inaccuracies.
- Allow yourself to adjust layout, reorganize component hierarchy, establish responsive asset cropping, and rethink on-screen wording within the approved constraints. Don't spend cycles inventing new mechanics or extending unapproved canon.
- Commit your changes. Report branch/commit SHA, exact screens reworked, assets installed and bytes, tests and browser results, screenshots, preview status, remaining known issues. Clearly identify whether physical iPhone was actually tested.

### GOAL acceptance: what the user should see

A new player chooses a **home** from five authentic illustrated neighborhoods, enters Stixx City in a dark charcoal interface, understands cash/AP/day and what to do immediately, can follow The Chains or ignore it, see and interact with real people, work and manage their Set and wallet, and end days with events updating. They can earn enough standing/trust to affiliate with any eligible established gang; **the HUD accent then immediately shifts to their gang color** while the underlying information remains legible. Saves, reloads and other starting neighborhoods maintain the correct theme. The entire interface feels like Hood Hero, not a corporate website or a collage of AI images.
