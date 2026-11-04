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
- **Risk** comes from data the game already tracks: whose marks are on the block versus your affiliation, contested ground, police presence against your heat, notoriety, and home turf. It's informational for now.
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
- `onArrival((state, placeId, risk) => nextState)`: **the integration point for location-based events** (run-ins in hostile turf, police stops, ambushes). Register a hook and the board doesn't change. None are registered yet.
- `assessRisk(s, placeId)` → `{ level: safe|watchful|tense|hostile, score, reasons[], turf }`. Tune the weights, or feed it real block control later.
- **Travel costs:** add them in `moveTo`/`actAt` when the design is settled. Today moving is free and instant in game time.
- **Character creator:** extend `Appearance` (and `presenceSchema` in `SaveSystem.ts`). `character.ts` builds the figure from parts. Set `appearance.model` to a GLB (e.g. from Meshy) and the board loads it at the same height.

### 3. Block influence (`src/board/blocks.ts`)

There's no block-level control in the simulation yet. `deriveBlocks` *presents* each district's saved faction presence as a number of blocks that radiate from each organization's anchor place. In The Nawf, Blips hold the west side of the avenue and Mudgang the east, with contested blocks where they meet. When real block control exists, replace `deriveBlocks` and keep the `BlockView` shape (`faction`, `strength`, `contested`, `police`, `locations`). Tags, banners, crowds and the lenses all follow it automatically. Block ids are `"<zone>.b<col>-<row>"`.

### 4. Board API (`BoardRenderer`)

`acquire(host)`, `setView(BoardView)`, `setFocus(Focus, fly)`, `setLens`, `setTimeOfDay`, `setInsets(top, bottom)`, `onPick`, `walkTo(placeId)`, `placeToken`, `setAppearance`, `setFigures`, `passDay`, plus overlay anchors for HTML labels. The UI reaches walking through `bus.ts` (`walkTo`, `pulseDay`). `window.__stixxBoard.debugState` exposes the camera and focus for automated checks.

### 5. Custom models (GLB slots)

Set `model: "assets/models/<file>.glb"` on a location. The board measures the footprint the procedural building would use, places the GLB there (the rest of the block still fills in), and loads it lazily; until it arrives, or if it fails, nothing breaks. `modelFit` tunes the fit: `height` (scale to a world height instead of the footprint), `scale`, `yaw`, `y`, `offset`, and `trackGap` for a station that brings its own stretch of El track. Vehicles live in `src/board/models.ts` (`MODEL_FILES`) and are swapped into the instanced traffic and police layers.

**In the game now** (Meshy image-to-3D, Smart Topology, 2.5–5k triangles, one 1024px WebP texture each, 160–370 KB):

| File | Used for |
| --- | --- |
| `southside-towers.glb` | Southside Towers (`modelFit.height` 17) |
| `el-station.glb` | Nawf Ave station; replaces its stretch of the El |
| `corner-bodega.glb` | Rio Gabriel Bodega, Southside Food Mart, Lil Jay's Market, Nawf Bodega |
| `lowrider.glb` | Three lowriders cruising Rio Gabriel's inner streets |
| `police-cruiser.glb` | Every patrol car (count still follows district police pressure) |

Recipe that kept the cost to 18 credits a model: a `nano-banana-2-lite` concept image (3 credits, single object, three-quarter view, white background), then `image-to-3d --model-type smart-topology --ai-model meshy-t2.5 --target-polycount 2500–5000 --texture-resolution 2k --enable-pbr false` (15), then `gltf-transform optimize --texture-compress webp --texture-size 1024`. Meshy cars face −X; `asVehicle` turns them to the board's +X.

**Still procedural**, in priority order:

1. **Stixx City Hall** (dome) and **Central Precinct**
2. **Rowhouse** and **Reservoir house** modules (porch, boarded variants)
3. **Port crane** and container stack
4. **San Gabriel Mission** bell tower
5. **Player character** (rig + walk cycle; confirm rigging works before spending on variants)

Keep each GLB under about 1–2 MB for iPhone Safari.

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
