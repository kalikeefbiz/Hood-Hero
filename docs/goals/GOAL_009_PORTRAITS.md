# Quanny portrait integration

Branch: `feat/goal-009-quanny`.

## Artwork

Five approved portraits were cropped directly from the supplied 1143 × 1280 JPEG. The source sheet remains outside the repository. Borders, dividers and label rows are excluded. The crops retain their native pixel dimensions and original artwork; no resizing, retouching or generation was performed. Only WebP encoding was applied (Pillow, quality 90, method 6, RGB, no source EXIF or embedded thumbnail).

| Approved expression | Runtime asset | Native size | Bytes |
| --- | --- | --- | ---: |
| Neutral | `public/assets/characters/quanny/quanny-neutral.webp` | 370 × 581 | 42,256 |
| Talking / Explaining | `public/assets/characters/quanny/quanny-talking.webp` | 374 × 581 | 41,368 |
| Disappointed | `public/assets/characters/quanny/quanny-disappointed.webp` | 372 × 581 | 43,990 |
| Confident / Pleased | `public/assets/characters/quanny/quanny-pleased.webp` | 374 × 580 | 40,374 |
| Thinking / Calculating | `public/assets/characters/quanny/quanny-thinking.webp` | 371 × 580 | 41,886 |

Total: **209,874 bytes**. The asset directory contains exactly these five files. [Preparation metadata](../design/QUANNY_PORTRAITS.json) records the crop rectangles, dimensions, byte sizes and SHA-256 checksums.

## Existing presentation integration

`characterArt.ts` registers the five images using the existing expression slots. Quanny's default is Neutral. His `concerned` slot maps exclusively to Disappointed, `proposing` to Talking, `confident` to Pleased, and `strategizing` to Thinking. Other characters keep their existing assets and default expressions. `CharacterPortrait` uses the native aspect ratio only for Quanny, preserving the complete crop in the existing image component.

`quannyExpression.ts` is a read-only selector over existing encounter choices, visible consequences, agreement evidence, collection history and conflict resolution. It performs no actions, random draws or state mutations:

- Neutral: the opening question and ordinary conversations.
- Talking: affiliation discussion, the location explanation and consignment terms.
- Disappointed: rejection, departure, disrespect, failed proposals, hostile claims, injury/risk outcomes, refused collections and unresolved negative conversations.
- Pleased: accepted agreements, successful negotiations, honored payments and favorable interactions.
- Thinking: evaluating real stock/proposals, pending collection and reconciliation/planning.

Terminal choices previously closed their dialogue immediately. Quanny now uses the existing read-only recorded-encounter view to show the reaction portrait and the existing player-visible outcome. Silent departures show the portrait without inventing a dialogue line. Closing this view only clears local presentation state; it cannot repeat the action or change cash, inventory, relationships, obligations, injury, time or RNG. Private NPC events remain filtered out. No rendering system, conversation choice, authored dialogue line, simulation rule or save-schema change was introduced.

## Validation

The portrait contract test checks the exact five-file allowlist, WebP headers, native dimensions, file-size budget and asset checksums. Selector tests cover the intro, ordinary talk, affiliations, terms, positive/negative negotiation, recorded payment/refusal, rejection, conflict resolution and reconciliation, including no mutation of saved state.

The iPhone 13 browser scenario loads and captures all five expressions in real gameplay, checks image decoding and bounds, verifies no horizontal overflow, and checks the exact set of requested Quanny assets. The existing Quanny browser cases also verify Disappointed after hostile introductions/refusal and Pleased after agreements/payment. Returning from a reaction view is checked against the complete saved state for equality. Mobile screenshots are retained in the ignored `test-results/quanny-portraits-*` directories; approved source-crop previews were inspected outside the repository.

- `npm test`: **255 passed, 14 test files**, 35.45 seconds. This includes all 39 existing Quanny system cases and 11 portrait cases.
- `npm run build`: **passed** (TypeScript and Vite; Vite build 3.60 seconds). Existing Zod annotation and bundle-size warnings remain.
- `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1 npm run test:e2e -- tests/quanny.spec.ts tests/quanny-portraits.spec.ts --workers=2`: **14 passed**, 3.4 minutes, across Chromium and WebKit. All five images decoded and displayed in both mobile engines; the browser scenarios reported no page errors. The five WebKit portrait captures were visually inspected.

Only the Quanny browser specifications were rerun for this portrait-only change. Browser validation uses iPhone 13 mobile emulation in Chromium and WebKit, not a physical iPhone. The existing local WebKit-library workaround is described in `GOAL_009_VALIDATION.md`.

No other character artwork, gameplay systems, renderer, camera or environmental assets changed. No merge or deployment was performed.
