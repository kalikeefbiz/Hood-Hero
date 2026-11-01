# GOAL 002B — visual fidelity correction

**Visual determination: PARTIAL.** The scene/HUD composition, density and shared game treatment have been corrected and inspected against the approved board. Full art fidelity is not claimed: the move tiles use approved environmental crops and new line symbols, not the board's bespoke object illustrations. The three actual 390px screenshots below are submitted for the user's visual approval. This is a completed focused correction pass, not a claim that engineering tests establish visual acceptance.

**Branch:** `goal-002-hood-hero-ui-overhaul` / existing PR #1. **No merge or deployment was performed or requested.**

## Reference inspection and specific differences

The attached board was visually inspected, along with the exact master board retained from the approved package at `/workspace/goal002-package/reference/APPROVED_UI_DIRECTION.png`, and the actual GOAL 002 New Run, independent City and Blips captures in `docs/review/goal-002/`. The React components, existing CSS, theme map, supplied artwork and browser tests were read before edits.

| Reference                                                      | GOAL 002 problem                                                                          | GOAL 002B correction                                                                                                                                                                                 |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scene immediately below a compact day/AP header                | Detached player header, table-like resources, heading and notice consumed the upper third | One compact HUD; day/AP/Save/Load at the top; actual player identity and affiliation layered into the scene                                                                                          |
| Environment, location identity and stats form one composition  | Shallow 155px image in an ordinary bordered rectangle                                     | 264px mobile scene with layered vignette, location/faction headline, atmosphere and stat plates overlapping its lower edge                                                                           |
| Three illustrated moves, then a situation strip above the dock | Two plain text cards; Chains below the first viewport                                     | Three illustrated **real** actions: Clock in, Pick up a gig, Reach out to Cuzzo; compact current-demand Chains strip; all action controls and the full situation strip fit above the dock at 390×844 |
| Angled, weathered game panels and assertive condensed headings | Similar clean rectangles on every surface                                                 | Asymmetric panel corners, restrained material grain/scratches, edge accents, inset light and cast shadows, bundled condensed italic headings, AP corner tags and a framed control rail               |
| New Run artwork surrounds and supports selection               | Separate image banner, branding and long form pushed the choices apart                    | Full environmental stage, overlaid neighborhood folio, five illustrated choices, active HOME tab, name and start controls grouped beneath the choices                                                |
| Affiliation changes the visual emphasis                        | Mostly thin accent lines                                                                  | Actual saved membership changes the scene headline, badge symbols, AP tags, tile borders, situation markers and dock; neutral charcoal surfaces stay intact                                          |

## Exactly what changed

- `GameHUD.tsx` composes the day/AP header (with the iPhone top safe-area inset), genuine player identity, selected neighborhood scene, saved affiliation and overlapping cash/influence/stress/heat plates. "Heat" displays the real player's police-attention value; no aggregate reputation/trust stat was invented.
- `App.tsx` uses the shared HUD, removes redundant City headings above the scene, places three existing validated actions in the home hub, and presents The Chains as an actionable compact situation strip with the current demand/status. Feedback remains an actual live status region, placed below the City's primary moves/situation rather than pushing them below the fold.
- `ActionCard.tsx` adds a compact illustrated variant using approved scene crops, a line symbol and real AP badge. The same `validateAction` and `performAction` paths apply. Disabled reasons remain visible and linked; native outcome disclosures open and close. Full Actions cards use illustration plates. Wallet purchases use folded purchase tickets with price/AP labels, rather than repeating unrelated street art for groceries or clothing.
- `NewRun.tsx` combines the chosen environment with a layered selection folio. All five homes remain native radio choices; the player name and start/resume remain real controls. There is no player portrait.
- `art-direction.css` supplies the shared scene, material, plate, folio, typography and dock treatment. `style.css` retains the existing base controls, accessibility and responsive foundations. The installed Barlow Condensed bold italic face is bundled locally.
- `Icon.tsx` adds functional Save/Load, message and stress symbols. No crown, fictional gang emblem or new wordmark art was introduced.
- `patina.svg` is a small procedural UI material, pre-rasterized into `patina.png` so WebKit does not repeatedly evaluate SVG turbulence. Its reproducible utility is `scripts/rasterize-ui-texture.mjs`. This is interface texture, not a sixth environment or a new gameplay illustration.
- `visual-correction.spec.ts` captures all three mandatory states, verifies that all three move controls and The Chains fit above the dock at 390×844, checks 44px action controls, and exercises the outcome disclosure. It creates the Blips fixture via a successful sponsored action, never a shipped demo mode.

No simulation/content/economy/incident/relationship/faction/save code or theme palette was changed in this pass. The original five WebPs remain byte-for-byte unchanged. Starting or viewing a neighborhood never selects a gang theme.

## Before / after — actual screenshots

All primary captures are **390×844 CSS pixels**, not cropped sections of the concept board. Save/Load, AP, cash, three real moves and navigation are usable HTML/SVG controls. Blips has 1/2 AP because the prepared eligible world actually executed the one-AP affiliation action; the work move is correctly unavailable.

| Screen           | GOAL 002 before                              | GOAL 002B after                                                                                               |
| ---------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| New Run          | [Before](review/goal-002/01-new-run-390.png) | [First viewport](review/goal-002b/01-new-run-390.png) · [Full page](review/goal-002b/01-new-run-full-390.png) |
| Independent City | [Before](review/goal-002/02-city-390.png)    | [After](review/goal-002b/02-independent-city-390.png)                                                         |
| Blips City       | [Before](review/goal-002/07-blips-390.png)   | [After](review/goal-002b/03-blips-city-390.png)                                                               |

[Illustrations-hidden diagnostic](review/goal-002b/04-illustrations-hidden-390.png) checks the material/shape/typography treatment without relying on the paintings. People, Actions, Set, Wallet and Activity were also visually inspected, and the general review suite captures narrower/desktop views and checks each screen and every faction palette.

### Visual assessment

- **Reproduced:** top HUD / scene / identity / overlapping stats / three move tiles / situation strip / dock hierarchy; substantial scene integration; condensed italic headings; restrained worn materials and irregular edges; tactile control surfaces; a distinct independent vs affiliated composition. The image-hidden check retains recognizable game plates and controls.
- **Adapted:** New Run uses environment scenery in place of the unapproved character portrait; the affiliated hero uses environment art and clean condensed faction type in place of the board's unapproved face, brush lettering and crown. These exclusions are required by the approved constraints, not missing gameplay features.
- **Art-dependent gap:** the board's purpose-painted money, people and bag scenes have more object-level storytelling than environmental crops with line symbols. Current tiles are explicitly scene-backed adaptations, not equivalents of those bespoke paintings. Additional illustration approval is required before claiming the same richness in action art.
- **Overall: PARTIAL**, with the actual corrected composition ready for user review. No automatic or engineering-only visual PASS is claimed.

## Concrete additional art list

These would improve the three existing M1 move tiles. They are not requests for new mechanics, a default player likeness, gang emblems, or art for the board's unsupported "Handle Biz / Run Work / Hold Territory / Expand" actions.

| Asset                      | Subject / composition                                                                                                                                                                     | Placement / ratio                                                | Transparent? | Why existing art is insufficient                                                                     |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------- |
| Lawful pay / Clock in      | Grounded graphic-novel close-up of an unbranded pay envelope and folded cash on a worn work counter; focal object low/center, dark negative space at top-right for the AP badge; no faces | Upper half of Clock in tile; **3:2**, safe central **1:1** crop  | No           | Downtown depicts commerce and docks, but has no close-up pay/work object at the reference's scale    |
| Local work / Pick up a gig | Worn tools or work gloves beside an unbranded neighborhood shop counter, warm practical light; no people or implied owned business                                                        | Upper half of gig tile; **3:2**, safe central **1:1** crop       | No           | The existing neighborhood image supplies place, not a clear small-format paid-work subject           |
| Reach out / Cuzzo contact  | Quiet neighborhood stoop or bodega meeting corner with a phone and two empty seats; no named character likeness, crowd, gang uniform or new canon                                         | Upper half of Reach out tile; **3:2**, safe central **1:1** crop | No           | A housing-facade crop cannot communicate a conversation as directly as a dedicated close composition |

Opaque standalone illustrations are sufficient; CSS handles the lower fade. No transparent cutout or character portrait is essential to the implemented layout.

## Validation

- Production TypeScript/Vite build passed. A local `/Hood-Hero/` subpath build also loaded the new texture/fonts and exercised paid work with HTTP 200, the correct $221 balance, and no browser/console errors. Existing harmless third-party Zod annotation warnings remain.
- **47 Vitest tests passed**; no simulation test was weakened or edited.
- **30 browser tests passed** across Chromium and WebKit (the original 28 plus the mandatory visual/layout review in each engine).
- Existing accessibility audits cover New Run, all six destinations and all five membership palettes. Existing 320/375/390/430/desktop, save/load, real action, directional trust, event privacy, mutable demand and ending checks remain in place.
- Screenshot review is separate from those engineering checks. The three mandatory captures were opened visually and directly compared with the approved board. No physical iPhone was tested.

The initial live SVG-material version caused a WebKit timeout in the multi-viewport navigation test. The texture was pre-rasterized rather than loosening the test or its assertions. On the final build, all 30 tests passed; the same WebKit multi-viewport test completed in 23.1 seconds.

The managed runner uses the same user-local WebKit runtime setup documented in GOAL 002. The final browser log is retained at `/workspace/goal002b-final-e2e.log`; standard CI installs browser dependencies normally.

## Delivery boundary

Changes remain on the existing PR branch. **No merge, Pages workflow dispatch, deployment-policy change or deployment** was performed. The user's approval of the actual screenshots is the next visual acceptance step.
