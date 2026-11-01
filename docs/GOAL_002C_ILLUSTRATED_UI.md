# GOAL 002C — Illustrated UI integration

The five supplied action illustrations now replace generic neighborhood crops in the existing React action cards. City features an illustrated Clock In card above two neutral moves; Actions uses scene plates above readable action rules, outcomes, validation and native buttons. Action order and navigation are unchanged. The universal graphite HUD, neighborhood artwork and real membership theme logic remain shared across all affiliations.

## Source inspection and installed assets

All six original uploads were opened and visually inspected before implementation. The illustrations depict a grocery worker, a conversation at a stoop, a quiet neighborhood gathering, a street transaction, and an exchange of information on steps. These are atmospheric scenes, not a fixed player appearance or portraits of canonical NPCs. The social gathering remains the existing rest action. The street transaction remains the existing abstract crime action.

The HUD sheet was inspected for hierarchy and accent guidance only. No badges, crowns, buttons, text or icons were extracted, and the sheet is not shipped as a runtime UI image. Existing reusable CSS and inline SVG icons provide the neutral HUD. No additional faction HUD copies were introduced.

Paths below are relative to `public/assets/actions/`. Each filename stem has `-480.webp` and `-960.webp` variants, respectively 480 × 360 and 960 × 720. Values are exact bytes; decimal KB = bytes / 1,000.

| Existing action ID | Original attachment | Installed filename stem | 480px bytes | 960px bytes |
| --- | --- | --- | ---: | ---: |
| `work` | `Clock in .PNG` | `clock-in` | 40,964 | 136,694 |
| `standing` | `Build connection.PNG` | `build-local-connection` | 44,266 | 149,438 |
| `rest` | `Quiet afternoon.PNG` | `quiet-afternoon` | 40,988 | 142,306 |
| `crime` | `Move pack .PNG` | `black-market-opportunity` | 37,284 | 121,638 |
| `inquire` | `ask around.PNG` | `ask-around` | 35,514 | 121,698 |

Total installed action art: **870,790 bytes** across ten variants. The browser chooses a suitable variant; these files are not all preloaded. Conversion used Pillow 12.3.0, LANCZOS resizing, WebP quality 82 and method 6. Full original compositions remain in every optimized 4:3 asset; CSS controls display crops without stretching. Original uploads remain untouched. Source hashes, original dimensions and output hashes are recorded in [the asset manifest](design/ACTION_ASSET_MANIFEST.json).

## Components and loading

- [ActionCard](../src/ui/ActionCard.tsx): existing compact and expanded variants share the same action-ID mapping. Preserves costs, risk, descriptions, success chance, outcomes, disabled reasons and real action execution. A disabled compact action retains its description as well as its validation message.
- [ActionIllustration](../src/ui/ActionIllustration.tsx): a reserved frame, responsive `srcset`, async decoding, lazy loading, and an IntersectionObserver with a 120px margin. Distant cards don't receive image URLs until approached. Unsupported observers fall back to native lazy loading. Failed images show a neutral, accessible fallback without disabling the action.
- [actionArt](../src/ui/actionArt.ts): centralized mapping, descriptive alternative text, subject positions and Vite `BASE_URL` URLs. Only the five approved actions are mapped. Gigs, Reach out, other social actions, incident responses and purchases keep neutral treatments.
- [illustrated-actions.css](../src/ui/illustrated-actions.css), imported by `main.tsx`: scene gradients, shared material treatment, responsive featured City card, compact neutral moves and expanded card scene plates. The phone neighborhood header is shortened to preserve first-viewport decisions. Artwork text is native HTML; no game state is baked into images.
- Existing `GameHUD`, `Icon`, `theme`, `Scene` and `App` logic remain in place. Independent uses graphite/stone; Angels yellow/white; Blips purple; Mudgang orange/brown; Back Street red; Block Boys blue. Membership alone chooses the player theme, including restored saves. Neighborhood selection cannot affiliate the player.

No files under `core`, `content`, `systems` or `persistence` were changed. There are no simulation, odds, balance, save-format, NPC, relationship, incident or faction-rule changes.

## Visual review

The screenshots below are real production-build captures, not mockups. Both browser engines were reviewed at 390px and 320px. Full-page captures show the ordered card list; the fixed dock appears at the viewport boundary in full-page browser screenshots.

| Capture | Screenshot |
| --- | --- |
| Independent City, 390 × 844 | [WebKit](review/goal-002c/webkit-01-independent-city-390.png) · [Chromium](review/goal-002c/chromium-01-independent-city-390.png) |
| Everyday Actions, 390px | [WebKit, full page](review/goal-002c/webkit-02-everyday-actions-390.png) |
| Affiliated Blips City, 390 × 844 | [WebKit](review/goal-002c/webkit-03-blips-city-390.png) |
| Narrow City, 320 × 700 | [WebKit, initial viewport](review/goal-002c/webkit-04-city-320.png) · [scrolled controls](review/goal-002c/webkit-04b-city-controls-320.png) |
| Narrow Everyday Actions, 320px | [WebKit, full page](review/goal-002c/webkit-04-everyday-actions-320.png) |
| People action cards, including Ask Around and Build a Local Connection | [WebKit, full page](review/goal-002c/webkit-05-people-actions-390.png) |
| 47px top / 34px bottom safe-area override, 390px | [Chromium](review/goal-002c/chromium-06-city-safe-area-390.png) |

Review findings: Clock In shows the shop worker and boxes rather than an unrelated environment. The full cards retain the major scene subjects, with Ask Around positioned higher to preserve faces. Descriptions, AP, risk and outcomes remain outside the art; small scene captions and AP plates use opaque dark backing. Neutral actions no longer repeat unrelated neighborhood artwork. Affiliated panels stay graphite while selected navigation, labels, fine borders, icons and progress elements take membership accents.

The initial WebKit City capture raced the IntersectionObserver update and showed the reserved frame before the image mounted. The capture helper now waits for near-viewport artwork explicitly, then verifies image decoding before taking the screenshot.

The first implementation placed the bottom of the Chains strip behind the dock at 390px. Review caught this; the neutral tiles and neighborhood header were tightened. The first-viewport control/incident fit assertion remains enforced. At 320px, the page scrolls normally; the additional scrolled capture and bounds checks demonstrate the full controls above the dock. Safe-area padding protects the top controls and bottom navigation; gameplay remains usable while scrolled with those insets.

## Validation

- `npm test`: **49 passed**, including the original 47 simulation/odds tests and two asset-contract tests.
- `npm run build`: production TypeScript/Vite build passed.
- `npm run test:e2e -- --workers=2 --timeout=90000`: **36 passed** across mobile Chromium and WebKit, including all existing functional and WCAG checks.
- `VITE_BASE_PATH=/Hood-Hero/ npm run build`: production GitHub Pages base build passed.
- `PLAYWRIGHT_BASE_PATH=/Hood-Hero/ npm run test:e2e -- tests/illustrated.spec.ts --workers=2 --timeout=90000`: **6 passed** across both engines against that build. Verifies all five real action mappings, image responses/current sources, lazy fetches, failed-image layout and functionality, narrow controls, saved membership and review captures.
- `git diff --check`: passed.

CI uses the same 90-second browser-flow limit, with the existing per-action expectations intact. It now runs the production-base build and illustrated browser checks after the full root-base suite. Pages remains a manually dispatched workflow; this change does not trigger deployment.

Local runner note: WebKit libraries were downloaded from Debian into temporary local directories and linked into the Playwright browser cache because system package installation required unavailable root access. The local browser command used `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1` to bypass the system ldconfig-cache probe after verifying actual WebKit launch. This does not skip browser tests or assertions. CI uses normal `playwright install --with-deps`. The slow local WebKit runner also required a 90-second CLI test limit for broad multi-screen flows; all assertions remain enabled. CI uses the same flow limit; no test body or assertion timeout was relaxed. Initial runs at the default 30-second browser limit timed out during those flows. One initial unit run concurrent with browser tests exceeded the pre-existing five-second timeout on the 160-day simulation test; the standalone full unit suite passed without timeout changes.

## Limits and release status

Visual completion is limited to the supplied starter pack. Unillustrated actions intentionally remain neutral. The compact Clock In crop prioritizes the worker/shop; expanded landscape cards trim peripheral ground/sky while retaining the full source composition in the asset. The art does not identify the player or NPCs.

Playwright WebKit is a Safari-engine check, not a physical iPhone Safari test. Real-device browser chrome, cutout behavior and device-specific color rendering still merit acceptance review. The explicit safe-area override was exercised in Chromium; both engines exercise the production CSS and phone layouts.

Committed to `goal-002-hood-hero-ui-overhaul` and delivered through PR #1. **Not merged or deployed.** The commit SHA is provided in the delivery response and PR metadata; screenshots remain available in this commit's report directory.
