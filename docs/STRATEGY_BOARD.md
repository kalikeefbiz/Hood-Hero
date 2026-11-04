# Hood Hero Lab: the Stixx City strategy board

This branch (`strategy-board`, forked from `stixx-3d-city`) makes the city the game's main screen. It's an isolated experiment:

- **Code** lives on `strategy-board` in Hood-Hero and is mirrored to `main` in **Hood-Hero-Lab**. The production `main` is untouched.
- **Playtest URL:** `https://kalikeefbiz.github.io/Hood-Hero-Lab/`, deployed by Hood-Hero-Lab's own `deploy-lab.yml`. Production's site and workflows are untouched.
- **Saves** use `blackhouse.hoodhero-lab.v1` keys, so the lab can never read or overwrite production saves, even on the shared `github.io` origin.

## How it plays

The 3D city is the game screen. The player is a **physical character on the board**, not an observer above it.

- **You start at home.** The camera flies into your home district, and your character stands at your home base (for example, Southside Towers).
- **Explore:** drag to pan, pinch to zoom, twist to turn. The breadcrumb (Stixx City › district › block › place) and ‹ zoom back out. District chips jump between neighborhoods.
- **Select** a district, block, place or person. A compact **inspector** shows what it is and what you can do *there*.
  - **Place:** a risk reading, facts from saved state, the place's real moves as action tiles, business controls, street work, and who's around.
  - **Person:** figures stand outside gathering places. Tap one for relationship and social moves.
  - **District:** the existing politics panel plus every place in the district.
- **Acting is being there.** Tapping a move makes your character **walk** to the place first. The existing action then runs, a result pops over the building, and your **location is saved**. "Go here" travels without acting. Movement has no AP or travel cost yet.
- **Risk** comes from data the game already tracks: whose marks are on the block versus your affiliation, contested ground, police presence against your heat, notoriety, and home turf. It remains a coarse public reading; GOAL 008 adds private contextual danger behind it.
- **Your look:** tap your name in the HUD to change skin, hair, top, colors, build and chain. The figure on the board updates and the look is saved with your character.
- **Lenses** (Streets · Influence · Police · Moves) and **time of day** (🌆/🌙/☀️). **End day** sits beside the breadcrumb (and in the ledger header); the city dims through night as the day passes.
- **Storylines** appear as a "!" marker over their place and as a pill under the breadcrumb.
- **The ledger:** People, Actions, Set, Wallet and Journal (history, position, activity) open as a ledger over the city from the dock. They're for detail, not the main way to play.

## Architecture

```
src/board/
  locations.ts      LOCATION REGISTRY: ids, archetypes, links, status (the integration contract)
  interactions.ts   place → existing actions / people / facts (pure, tested)
  blocks.ts         block influence derived from saved territory (pure, tested)
  viewModel.ts      BoardView: read-only projection of GameState for the renderer
  BoardRenderer.ts  three.js scene, camera levels, input, lenses, dynamic layers
  archetypes.ts     how each place type and each district's ordinary blocks are built
  geo.ts            merged-geometry kit (one draw call per material per district)
  textures.ts       facade textures + SignAtlas (every sign/tag/mural in one texture)
  ui/Board.tsx      lazy stage + WebGL/2D fallback   ui/BoardStage.tsx  labels & pins
  ui/BoardPanels.tsx breadcrumb, lenses, chips, Block/Place/District sheets
  presence.ts       PLAYER PRESENCE: saved location, trail, appearance, risk, arrival hooks
  character.ts      the player's figure from parts; GLB slot for the future character creator
  people.ts         where characters stand on the board (presentation)
  bus.ts            lets the UI ask the lazy board to walk / pulse without importing three.js
  ui/BoardHUD.tsx   slim HUD (tap your name for your look)   ui/board.css  board shell
src/city3d/layout.ts  district rectangles (mirror the 2D map), river, block grid, block ids
src/ui/App.tsx        board shell, focus, inspector, walking actions, ledger
```

The data flow only goes one way: `GameState → deriveBoardView → BoardRenderer / panels`. The renderer never writes game state. Taps come back as `Focus { zone, block, place }`.

## Integration points for Vesper and Codex

### 1. Location registry (`src/board/locations.ts`)

Every selectable place has a stable id, `"<zone>.<slug>"`, e.g. `south.towers` or `nawf.deli`. That's 40 places across five districts (9 of them planned), taken from the environment references.

```ts
links: {
  job?: "retail-south"        // existing JOBS id → apply / accept / work / time off here
  business?: "repair"         // existing BUSINESSES id → buy / maintain / sell here
  items?: ["booze"]           // existing ITEMS sold here
  gig?: true                  // existing `gig` action
  street?: true               // existing StreetWork for this district's market
  people?: true               // district residents gather here
  rest?: true                 // `rest` when this is the player's home district
  incident?: "the-chains"     // incident moves + storyline button while active
  politics?: true             // opens the district politics panel
}
status: "live" | "planned"   // planned places show the `planned` teaser
```

**To make a planned place live** (gym, church, taqueria, community centers, The Spot, pawn shop, mission), add links in the registry. If you need a new system, add a new link key and one branch in `interactions.ts` (`placeActions` / `placeFacts`). The renderer doesn't need to change.

**To add a place:** add an entry with a free block position. `src/tests/board.test.ts` checks unique ids, one place per block, distance from the river, and that links point to real content.

**Ownership and NPCs:** `placeFacts` currently reports only what the game tracks: player businesses, jobs and incidents. When per-location ownership exists, return it from `placeFacts`, and add `owner` to `PlaceStatus` in `viewModel.ts` so the board can mark it.

### 2. Player presence (`src/board/presence.ts`)

`GameState.presence` (optional, saved in the lab's save format) is:

```ts
{ location: "nawf.bodega", zone: "nawf", arrivedDay: 4,
  trail: [{ location: "south.food-mart", day: 3 }, …],   // last 12 stops
  appearance: { skin, hair, hairColor, top, topColor, bottomColor, shoeColor, chain, build, model? } }
```

- `presenceOf(s)`: where the player is (old saves start at home base).
- `moveTo(s, placeId)`: pure move. Records the trail, then runs **arrival hooks**.
- `onArrival((state, placeId, risk) => nextState)`: **the integration point for location-based events** (run-ins in hostile turf, police stops, ambushes). Register a hook and the board doesn't change. GOAL 008 runs built-in bounded danger exposure before optional extension hooks.
- `assessRisk(s, placeId)` → `{ level: safe|watchful|tense|hostile, score, reasons[], turf }`. Tune the weights, or feed it real block control later.
- **Travel costs:** add them in `moveTo`/`actAt` when the design is settled. Today moving is free and instant in game time.
- **Character creator:** extend `Appearance` (and `presenceSchema` in `SaveSystem.ts`). `character.ts` builds the figure from parts. Set `appearance.model` to a GLB (e.g. from Meshy) and the board loads it at the same height.

### 3. Block influence (`src/board/blocks.ts`)

There's no block-level control in the simulation yet. `deriveBlocks` *presents* each district's saved faction presence as a number of blocks that radiate from each organization's anchor place. In The Nawf, Blips hold the west side of the avenue and Mudgang the east, with contested blocks where they meet. When real block control exists, replace `deriveBlocks` and keep the `BlockView` shape (`faction`, `strength`, `contested`, `police`, `locations`). Tags, banners, crowds and the lenses all follow it automatically. Block ids are `"<zone>.b<col>-<row>"`.

### 4. Board API (`BoardRenderer`)

`acquire(host)`, `setView(BoardView)`, `setFocus(Focus, fly)`, `setLens`, `setTimeOfDay`, `setInsets(top, bottom)`, `onPick`, `walkTo(placeId)`, `placeToken`, `setAppearance`, `setFigures`, `passDay`, plus overlay anchors for HTML labels. The UI reaches walking through `bus.ts` (`walkTo`, `pulseDay`). `window.__stixxBoard.debugState` exposes the camera and focus for automated checks.

### 5. Custom models (GLB slots)

Set `model: "assets/models/<file>.glb"` on a location. The board measures the footprint the procedural building would use, places the GLB there (the rest of the block still fills in), and loads it lazily; until it arrives, or if it fails, nothing breaks. `modelFit` tunes the fit: `height` (scale to a world height instead of the footprint), `scale`, `yaw`, `y`, `offset`, and `trackGap` for a station that brings its own stretch of El track. Vehicles live in `src/board/models.ts` (`MODEL_FILES`) and are swapped into the instanced traffic and police layers.

**Formats.** Every GLB is meshopt-compressed geometry plus one KTX2 (Basis ETC1S) base-color texture: 1024px for landmarks, 512px for everything else, 256px for cars. iPhones keep KTX2 compressed on the GPU (ASTC), about 1.4 MB for a 1024 texture and 0.35 MB for a 512, so all 40 models need roughly 25 MB of texture memory. The loader (`models.ts`) reads both formats through the transcoder in `public/basis/`. Download for the full set is about 7 MB.

**Pipeline** (tools in a scratch folder, not the repo): Meshy `image-to-3d --model-type smart-topology --ai-model meshy-t2.5 --target-polycount 2500–5000 --texture-resolution 2k --enable-pbr false` (15 credits), then a glTF Transform script using `ktx2-encoder` (resize, ETC1S quality 200, mipmaps), then `gltf-transform meshopt`. Studio art sheets are cropped one structure per image first. Chain-link fences come back from Meshy as solid walls; for courts and lots, the vertical triangles near the edges are stripped.

**Places with a model** (`LocationDef.model`, fitted to the procedural footprint; `modelFit` tunes height, scale, yaw, offset and `trackGap`; `companions` adds more GLBs in the same footprint):

| File | Used for |
| --- | --- |
| `southside-towers.glb` | Southside Towers |
| `el-station.glb` | Nawf Ave station (replaces its stretch of the El) |
| `corner-bodega.glb` | Rio Gabriel Bodega, Southside Food Mart, Lil Jay's Market, Nawf Bodega |
| `brick-corner.glb` | Designer Drop, The Spot, Reservoir Laundry |
| `bungalow.glb` | Reservoir homes |
| `boarded-house.glb` | Boarded house |
| `el-deli.glb` | Nawf Deli & Grocery |
| `nawf-projects.glb` | Nawf Projects |
| `auto-garage.glb` | Both auto repair shops |
| `city-hall.glb`, `precinct.glb` | Stixx City Hall, Central Precinct |
| `rowhouses.glb`, `church.glb` | Southside Rowhouses, The Church |
| `mission.glb`, `courtyard.glb` | San Gabriel Mission, Courtyard apartments |
| `community-center.glb` | Both community centers |
| `warehouse.glb` | Westside warehouse, Courier route depot |
| `small-storefront.glb` | Barbershop, both liquor stores, taqueria, pawn shop |
| `basketball-court.glb` | The Court (Southside, Nawf), The lot court |
| `vacant-lot.glb` | The Lot |
| `tower-lot.glb` | The water tower |
| `containers.glb` + `port-crane.glb` | Port of Stixx |

Vehicles (`MODEL_FILES`): `lowrider.glb` (three cruise Rio), `police-cruiser.glb` (every patrol car).

**Set pieces** (`setPieces.ts`): generic lots that dress the blocks no named place uses, drawn as one instanced mesh per piece, so repeats cost no extra memory. Each district has its own weighted pool and guaranteed signature pieces (Rio: taco lot, palm park; Southside: liquor corner; Reservoir: storefront church; Downtown: transit plaza and a parking garage), and the Nawf's El gets an underpass stretch. Placement is seeded per district, so the city is the same every session; houses and walk-ups are tinted per instance. Pieces: gas station, basketball court, pocket park, vacant lot, strip mall, fast food, car wash, walk-up, shotgun house, parking lot, taco lot, palm park, liquor corner, storefront church, parking garage, transit plaza, El underpass. The software-GL fallback skips set pieces and keeps box cars; `?fullgl` forces the full board there for screenshots.

**Characters** (`characterModels.ts`): a named character listed in `CHARACTER_MODELS` stands at their spot as a rigged GLB in place of the crowd capsule (main characters stand; they do not wander). Mega is first: Meshy image-to-image A-pose sheet from studio art (6 credits) → image-to-3D Smart Topology 10k triangles, `--pose-mode a-pose` (15) → auto-rig at 1.85 m (5); 268 KB after KTX2 + meshopt, with Meshy's walk and run clips (~85 KB each). There is no bundled idle, so standing holds the walk cycle's passing pose. `board.characterMotion(id, "walk" | "run" | "stand")` plays a clip; new clips (cup, cigar, aiming) are added by name under `clips`. Person pins now sit at 2.3 so they clear a full-height model. Quanny is modeled and rigged from the studio's own A-pose (15 + 5 credits) and registered under id `quanny`; he appears as soon as a character with that id is added to the game data.

**Next art**: player character (rig + walk cycle), Reservoir house variants for the residential lots, and Downtown signature towers.

## Rendering notes (iPhone)

- One city per session. Leaving the board detaches it rather than rebuilding, so shaders compile once.
- Static geometry is merged per district. Cars, people, lamps and flags are instanced. All signage is one atlas (2 draw calls).
- The shadow map is baked per lighting change. The pixel ratio is capped at 1.5. Ambient animation runs at about 30 fps and pauses when hidden.
- Software renderers (no GPU) automatically use a lite mode: Lambert shading, no shadows, animation only while touched.
- `prefers-reduced-motion` gives a still city.
- No WebGL means the 2D map stands in as the board.

## Other changes on this branch

- **The Reservoir** is the canonical spelling everywhere, including zone ids (`reservoir`) and art filenames. Old test saves won't load, as agreed.
- **Tests:** `src/tests/board.test.ts` covers the registry, influence derivation and place interactions. `tests/board.spec.ts` plays the board on an iPhone-size screen: walk, act, saved location and trail, risk, people, look, and the ledger. Legacy specs reach History, Your position and Activity through the Journal.

## Known limits / next steps

- Validated with software-rendered Chromium at iPhone 13 size. Physical-device performance is the open question.
- Planned places have no systems behind them yet.
- Block influence is a presentation of district presence, not true block control.
- Camera framing at the place level is tight in portrait. A "street view" angle per archetype would help.
- Walking uses simple street-aligned paths, not full street routing. Characters other than you stand at gathering places rather than following schedules.
- Next art steps: the GLB slots above, bespoke Downtown towers, Rio side-street power lines and palms, and interior lights by time.


## GOAL 008 gameplay integration

See [GOAL_008_REPORT.md](GOAL_008_REPORT.md) for the living danger slice, state contracts, exposure budgets, recognition rules, treatment and manual-save/death behavior. `moveTo` now performs bounded arrival exposure; `performActionAt` lets an arrival encounter interrupt the intended action; accepted activities and day advancement also expose physical presence. `GameState.danger` holds private conflict/recognition/history state and a saved seeded RNG. Renderer and camera code remain unchanged. Menu/camera reads never roll danger.
