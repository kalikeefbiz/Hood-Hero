# GOAL 002 delivery — Hood Hero M1

> Visual acceptance for GOAL 002 was rejected by the user. Engineering validation below is historical. See [GOAL 002B visual correction and current screenshots](GOAL_002B_VISUAL_CORRECTION.md) for the focused correction and candid visual status.

Implemented on `goal-002-hood-hero-ui-overhaul`, based on main `caaa0cbe375f67da00f1111cf8d0bf9910c2be0e`.

The approved package and exact reference board were read and visually inspected before editing. The full production specification is preserved in [design/GOAL_002_IMPLEMENTATION_SPEC.md](design/GOAL_002_IMPLEMENTATION_SPEC.md). The master board is not shipped as runtime UI. No new art, character likenesses, emblems, factions or gameplay features were introduced.

## Delivered screens

- New Run / Resume: all five illustrated homes, native name/radio controls, neutral independent selection, actual starting cash/AP/Set, clean typeset HOOD HERO identity.
- City: real name/home/status/day/cash/AP/affiliation, selected-zone illustration, immediately actionable paid work at 390×844, current Chains demand, observed news, selectable five-zone map, current control/organizations and standing/status meters.
- Actions: Everyday / The Chains / People, contact context, real costs/AP, risks, outcomes, current-state success odds and visible validation reasons linked to disabled controls. Display labels are separate from stable action IDs.
- People: actual contacts and aliases, initials instead of invented portraits, home scenery, directional trust, shared memories and witnessed events, real interaction entry point.
- Set: roster, capacity/influence, directed trust, availability, paid errands/removal, recruitment requirements, persistent commitments. The personal Set remains separate from gangs.
- Wallet: clean/illicit provenance, current purchases/costs, living expenses and real transaction history.
- Activity: observed events only, All / Your circle filters, actual situation status/demand and day grouping.
- Shared shell: consistent charcoal panels, condensed headings, custom line navigation icons, safe-area dock, Save/Load, autosave, New Game, End Day, errors, ending inspection, keyboard focus and reduced motion.

## Preservation and engineering

`theme.ts` is the central UI palette, selected only by `player(s).affiliation`. New runs and map changes stay independent; valid sponsorship and reload immediately use the actual faction. All five themes are tested. Mudgang retains its approved brown secondary token and uses a lighter related text token for legibility. Risk/heat and money retain separate semantic colors. No `FACTIONS` simulation data was recolored.

`NewRun`, `Scene`, `ActionCard`, `Icon`, neighborhood mapping and theme configuration separate reusable presentation from the orchestration in `App`. Asset paths use Vite's base URL. Below-fold art loads lazily; missing images have a neutral textual fallback.

No save schema, storage key, random draw, AP balance, economic rule, NPC AI, incident progression or action ID changed. The only action-engine refactor extracts the existing negotiation/recovery/illicit-trade probability expressions into a shared pure function, so UI odds and resolution agree. Illicit-trade odds include its existing stress increase. A temporary comparison against the original engine verified every available action across 48 seeded daily snapshots (four seeds × twelve evolving days), with identical returned states/errors. The comparison copy was removed after verification. Three permanent tests predict actual outcomes from displayed odds across 80 seeds per action and assert no mutation/RNG consumption. Existing simulation tests remain intact.

The Resevoir's rejected luxury description is corrected to boarded homes/vacant lots. Old saves render the corrected description without migration or rewriting their zone statistics.

## Approved assets

All five supplied WebPs are copied byte-for-byte to `public/assets/neighborhoods/`. Their SHA-256 hashes match [the supplied manifest](design/NEIGHBORHOOD_ASSET_MANIFEST.json).

| Scene        |         Bytes |
| ------------ | ------------: |
| Downtown     |       524,408 |
| Rio Gabriel  |       436,476 |
| Southside    |       431,828 |
| The Resevoir |       488,912 |
| The Nawf     |       507,972 |
| **Total**    | **2,389,596** |

## Validation and review

- `npm ci` passed using the committed lockfile.
- `npm test`: **47 passed** (44 unchanged simulation tests + three odds/resolution tests).
- `npm run build`: strict TypeScript and production build passed. Existing third-party Zod annotation warnings remain harmless.
- `npm run test:e2e`: **28 tests**, 14 each in Chromium and WebKit, with no skipped browsers. Covers the existing contact/work/day/checkpoint/buyback/errand loop plus all art loading, all-home independence, all five sponsored theme transitions, reload, mutable demand, ended/damaged saves, directional trust, event privacy, filters and 320/375/390/430/1440 layouts. Dock targets are at least 44×44 and the last control remains reachable above the dock.
- Axe WCAG 2 A/AA and 2.1 AA checks run on New Run, all six destinations and every faction palette. No violations or browser/console errors in the review flow. Automated checks do not replace physical-device or human accessibility testing.
- Human screenshot review covered 320, 390, 430 and desktop, with 375 additionally checked by browser assertions. Name wrapping, art crops, neutral/faction accents, disabled reasons, directional trust and dock spacing were inspected. Set and Activity were additionally inspected during the visual pass.
- The `/Hood-Hero/` production subpath is checked separately for all five image responses, run creation, work and absence of browser/console errors.

This managed Debian runner needs user-local WebKit libraries under `/workspace/browser-runtime/`; no host workarounds are shipped in the repository. Local browser command:

```sh
LD_LIBRARY_PATH=/workspace/browser-runtime/root/usr/lib/x86_64-linux-gnu \
PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1 npm run test:e2e
```

Required shared libraries were extracted from Debian packages and linked into the local Playwright browser bundle. Standard CI uses `playwright install --with-deps chromium webkit`. The validation override only bypasses the host library-cache probe; both engines actually launch and execute all tests.

**Physical iPhone Safari was not tested.** Browser emulation and Linux WebKit are the available verification.

## Screenshot artifacts

Eight curated after captures are committed; browser reports attach captures from both engines. Two baseline captures are included for comparison.

| Review           | Capture                                                                        |
| ---------------- | ------------------------------------------------------------------------------ |
| Original New Run | [Before, 390](review/goal-002/before-new-run-390.png)                          |
| Original City    | [Before, 390](review/goal-002/before-city-390.png)                             |
| New Run          | [390, all five scenes](review/goal-002/01-new-run-390.png)                     |
| Independent City | [390×844](review/goal-002/02-city-390.png)                                     |
| Narrow City      | [320×700](review/goal-002/03-city-320.png)                                     |
| People           | [390](review/goal-002/04-people-390.png)                                       |
| Actions          | [430](review/goal-002/05-actions-430.png)                                      |
| Wallet           | [430](review/goal-002/06-wallet-430.png)                                       |
| Sponsored Blips  | [390, actual engine-produced membership](review/goal-002/07-blips-390.png)     |
| Desktop          | [1440, Block Boys membership / Nawf home](review/goal-002/08-city-desktop.png) |

Long captures show the fixed dock at the viewport's initial lower edge, rather than the end of the entire document. Interactive checks separately verify that scrolling exposes lower controls with clearance above the dock.

## Deployment status

The historical 403 blocker is no longer the current configuration: Pages is enabled and the existing M1 site responds at `https://kalikeefbiz.github.io/Hood-Hero/`. However, the `github-pages` environment's sole deployment branch policy is `main`. GOAL 002 lives on a feature branch, so a Pages deployment from that branch cannot satisfy the existing rule. No environment restriction was changed and no deployment of this overhaul is claimed here. The delivery message links the actual attempted workflow result and implementation commit/PR.

After merge, the existing **Publish playable preview** workflow can deploy main with the correct subpath. Existing live content must not be mistaken for this overhaul. Physical iPhone verification remains outstanding; no other known functional failures remain after validation.
