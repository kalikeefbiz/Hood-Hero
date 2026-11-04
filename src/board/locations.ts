import type { FactionId, ZoneId } from "../core/GameState";
import type { ItemId } from "../content/economy";

// ---------------------------------------------------------------------------
// LOCATION REGISTRY — the integration contract for the strategy board.
//
// Every place a player can select has a stable `id`. The 3D city draws it,
// the board UI opens it, and gameplay systems attach to it through `links`.
// Places whose systems don't exist yet are `status: "planned"`; Vesper and
// Codex can make them live by adding links (and, where needed, new systems)
// without touching rendering code. See docs/STRATEGY_BOARD.md.
// ---------------------------------------------------------------------------

export type LocationKind =
  | "store"
  | "liquor"
  | "food"
  | "retail"
  | "auto"
  | "hangout"
  | "residence"
  | "apartment"
  | "police"
  | "civic"
  | "warehouse"
  | "docks"
  | "transit"
  | "community"
  | "church"
  | "gym"
  | "barber"
  | "club"
  | "pawn"
  | "street"
  | "landmark";

/** How the 3D city builds the place. Swap for a GLB via `model`. */
export type Archetype =
  | "storefront"
  | "garage"
  | "towers"
  | "projects"
  | "rowhouses"
  | "lot"
  | "court"
  | "church"
  | "mission"
  | "cityhall"
  | "precinct"
  | "docks"
  | "warehouse"
  | "station"
  | "mural"
  | "hall"
  | "market"
  | "courtyard"
  | "memorial"
  | "house"
  | "watertower";

export interface LocationLinks {
  /** Existing JOBS id: apply / accept / work / time off happen here. */
  job?: string;
  /** Existing BUSINESSES id: buy / maintain / sell / close happen here. */
  business?: string;
  /** Existing ITEMS sold here. */
  items?: ItemId[];
  /** Local gigs (existing `gig` action). */
  gig?: boolean;
  /** Street work for this district's market (existing StreetWork system). */
  street?: boolean;
  /** Residents of the district gather here (existing characters). */
  people?: boolean;
  /** Rest at home (existing `rest` action) when this is in your home district. */
  rest?: boolean;
  /** Existing incident surfaced here while active. */
  incident?: string;
  /** Read-only district politics (existing NeighborhoodStrategy). */
  politics?: boolean;
}

export interface LocationDef {
  id: string;
  zone: ZoneId;
  name: string;
  kind: LocationKind;
  archetype: Archetype;
  /** Painted sign text; omit for unsigned places. */
  sign?: string;
  description: string;
  /** Normalised position inside the district (0..1, 0..1). */
  at: [number, number];
  /** Facade colours: wall, accent (awning/trim), sign background, sign text. */
  palette: [string, string, string, string];
  floors?: number;
  /** Organization most associated with the place, for tags and crowds. */
  faction?: FactionId;
  links: LocationLinks;
  status: "live" | "planned";
  /** What a future integration would add — shown to players as a teaser. */
  planned?: string;
  /** Optional GLB that replaces the procedural building (public/ path). */
  model?: string;
  /**
   * How the GLB sits in the procedural footprint. By default it is scaled to
   * fit the footprint; `height` scales to a world height instead (e.g. to line
   * a station up with the elevated track). Offsets are in world units.
   */
  modelFit?: {
    height?: number;
    scale?: number;
    yaw?: number;
    y?: number;
    /** Station only: width of elevated track the model replaces. */
    trackGap?: number;
    offset?: [number, number];
  };
}

const L = (d: LocationDef) => d;

export const LOCATIONS: LocationDef[] = [
  // ---------------- Downtown: business · government · docks ----------------
  L({
    id: "downtown.city-hall",
    zone: "downtown",
    name: "Stixx City Hall",
    kind: "civic",
    archetype: "cityhall",
    sign: "STIXX CITY HALL",
    description:
      "Politicians, permits and the people who decide which blocks get attention.",
    at: [0.3, 0.6],
    palette: ["#d8cfbd", "#4f8a7a", "#1d2a3a", "#f1e6c8"],
    links: { politics: true },
    status: "live",
    planned: "Petitions, permits and political favors.",
  }),
  L({
    id: "downtown.precinct",
    zone: "downtown",
    name: "Central Precinct",
    kind: "police",
    archetype: "precinct",
    sign: "STIXX CITY POLICE",
    description:
      "The heaviest police presence in the city works out of this building.",
    at: [0.72, 0.8],
    palette: ["#5e6b78", "#2a4f9a", "#14213d", "#e8eefc"],
    links: { politics: true },
    status: "live",
    planned: "Bail, custody visits and heat management.",
  }),
  L({
    id: "downtown.docks",
    zone: "downtown",
    name: "Port of Stixx",
    kind: "docks",
    archetype: "docks",
    sign: "PORT OF STIXX",
    description: "Containers, cranes and day labor along the river.",
    at: [0.5, 0.1],
    palette: ["#7d7a72", "#c4772e", "#2b3036", "#f0d29a"],
    links: { gig: true },
    status: "live",
  }),
  L({
    id: "downtown.courier",
    zone: "downtown",
    name: "Courier route depot",
    kind: "warehouse",
    archetype: "warehouse",
    sign: "STIXX COURIER",
    description: "A licensed delivery route exposed to commercial demand.",
    at: [0.76, 0.4],
    palette: ["#9c9a92", "#3d6b8a", "#1e2b38", "#f5f0e0"],
    links: { business: "courier" },
    status: "live",
  }),
  L({
    id: "downtown.designer-drop",
    zone: "downtown",
    name: "Designer Drop",
    kind: "retail",
    archetype: "storefront",
    sign: "DESIGNER DROP",
    description:
      "Apparel and footwear on the commercial strip. They hire locals.",
    at: [0.3, 0.86],
    palette: ["#c9c2b4", "#1b1b1b", "#141414", "#e8c873"],
    floors: 6,
    links: { job: "retail-downtown", items: ["clothing", "music"] },
    status: "live",
    model: "assets/models/brick-corner.glb",
  }),
  L({
    id: "downtown.the-spot",
    zone: "downtown",
    name: "The Spot",
    kind: "club",
    archetype: "storefront",
    sign: "THE SPOT",
    description:
      "Velvet rope, purple light, a line around the corner on weekends.",
    at: [0.3, 0.32],
    palette: ["#3a3440", "#7a3ac4", "#140f1c", "#d9a6ff"],
    floors: 4,
    links: {},
    status: "planned",
    model: "assets/models/brick-corner.glb",
    planned: "Nightlife, networking and high-stakes meets.",
  }),

  // ---------------- Rio Gabriel: Gabriel's Angels ----------------
  L({
    id: "rio.bodega",
    zone: "rio",
    name: "Rio Gabriel Bodega",
    kind: "store",
    archetype: "storefront",
    sign: "RIO GABRIEL BODEGA",
    description:
      "Abarrotes, cold drinks, lotto and the latest word on the street.",
    at: [0.24, 0.52],
    palette: ["#e3c9a0", "#e9be39", "#e9be39", "#2a1d0e"],
    faction: "angels",
    links: { job: "retail-rio", items: ["necessities", "smokes"] },
    status: "live",
    model: "assets/models/corner-bodega.glb",
  }),
  L({
    id: "rio.liquor",
    zone: "rio",
    name: "Rio Gabriel Liquor",
    kind: "liquor",
    archetype: "storefront",
    sign: "RIO GABRIEL LIQUOR",
    description: "Beer, wine, spirits, ice. Neon in the window until two.",
    at: [0.44, 0.52],
    palette: ["#e0c8a0", "#c9a23a", "#f2e2a0", "#7a1f1f"],
    faction: "angels",
    links: { items: ["booze", "smokes"] },
    status: "live",
  }),
  L({
    id: "rio.auto",
    zone: "rio",
    name: "Rio Gabriel Auto Repair",
    kind: "auto",
    archetype: "garage",
    sign: "RIO GABRIEL AUTO",
    description: "Tune-ups, brakes, hydraulics. Lowriders are rebuilt here.",
    at: [0.66, 0.52],
    palette: ["#d6cbb8", "#e9be39", "#f5f1e6", "#2a2a2a"],
    faction: "angels",
    links: { people: true },
    status: "live",
    planned: "Vehicles, upgrades and parts.",
  }),
  L({
    id: "rio.taqueria",
    zone: "rio",
    name: "La Esquina Taqueria",
    kind: "food",
    archetype: "storefront",
    sign: "LA ESQUINA TAQUERIA",
    description:
      "Picnic tables, string lights, the best al pastor east of the river.",
    at: [0.82, 0.74],
    palette: ["#e9c9a0", "#b8342e", "#f4e3c0", "#b8342e"],
    links: {},
    status: "planned",
    planned: "Meals, meetups and Angels gossip.",
  }),
  L({
    id: "rio.angels-mural",
    zone: "rio",
    name: "Gabriel's Angels mural",
    kind: "street",
    archetype: "mural",
    description:
      "Wings across a whole wall. The Eastside's black market runs quieter than it looks.",
    at: [0.4, 0.78],
    palette: ["#d9a185", "#e9be39", "#f5f1e6", "#2a2a2a"],
    faction: "angels",
    links: { street: true },
    status: "live",
  }),
  L({
    id: "rio.courtyard",
    zone: "rio",
    name: "Courtyard apartments",
    kind: "apartment",
    archetype: "courtyard",
    description:
      "Two floors around a courtyard shrine. Everyone knows everyone.",
    at: [0.2, 0.82],
    palette: ["#e3b98f", "#7a5a3a", "#f5f1e6", "#2a2a2a"],
    links: { people: true, rest: true },
    status: "live",
  }),
  L({
    id: "rio.mission",
    zone: "rio",
    name: "San Gabriel Mission",
    kind: "church",
    archetype: "mission",
    description: "The bell tower you can see from the river.",
    at: [0.8, 0.34],
    palette: ["#ead7b4", "#9a4a2e", "#f5f1e6", "#2a2a2a"],
    links: {},
    status: "planned",
    planned: "Community standing and sanctuary.",
  }),

  // ---------------- Southside: Back Street ----------------
  L({
    id: "south.towers",
    zone: "south",
    name: "Southside Towers",
    kind: "residence",
    archetype: "towers",
    sign: "SOUTHSIDE TOWERS",
    description:
      "Housing projects and Back Street's stronghold. Old loyalties live on every floor.",
    at: [0.5, 0.38],
    palette: ["#7a4635", "#c83d45", "#f0e6d8", "#7a4635"],
    faction: "backstreet",
    links: { people: true, rest: true, incident: "the-chains" },
    status: "live",
    model: "assets/models/southside-towers.glb",
    modelFit: { height: 17 },
  }),
  L({
    id: "south.rowhouses",
    zone: "south",
    name: "Rowhouses",
    kind: "residence",
    archetype: "rowhouses",
    description: "Family homes, boarded windows and stoops full of neighbors.",
    at: [0.18, 0.4],
    palette: ["#8c5442", "#3a2a24", "#f0e6d8", "#2a2a2a"],
    faction: "backstreet",
    links: { people: true, rest: true },
    status: "live",
  }),
  L({
    id: "south.the-lot",
    zone: "south",
    name: "The Lot",
    kind: "street",
    archetype: "lot",
    description:
      "Vacant property behind a chain-link fence. Deals, meetups, operations.",
    at: [0.84, 0.36],
    palette: ["#5a5240", "#c83d45", "#f0e6d8", "#2a2a2a"],
    faction: "backstreet",
    links: { street: true },
    status: "live",
  }),
  L({
    id: "south.food-mart",
    zone: "south",
    name: "Southside Food Mart",
    kind: "store",
    archetype: "storefront",
    sign: "SOUTHSIDE FOOD MART",
    description:
      "Daily supplies, a hiring sign in the window, and contacts at the counter.",
    at: [0.18, 0.82],
    palette: ["#8c5442", "#c83d45", "#f5efe3", "#b0202a"],
    links: { job: "retail-south", items: ["necessities", "smokes"] },
    status: "live",
    model: "assets/models/corner-bodega.glb",
  }),
  L({
    id: "south.liquor",
    zone: "south",
    name: "Back Street Liquor",
    kind: "liquor",
    archetype: "storefront",
    sign: "BACK STREET LIQUOR",
    description: "Drinks, stress relief, information.",
    at: [0.38, 0.82],
    palette: ["#6a3c32", "#c83d45", "#efe4d0", "#1c1c1c"],
    faction: "backstreet",
    links: { items: ["booze"] },
    status: "live",
  }),
  L({
    id: "south.auto-repair",
    zone: "south",
    name: "Southside Auto Repair",
    kind: "auto",
    archetype: "garage",
    sign: "SOUTHSIDE AUTO REPAIR",
    description: "A modest repair concession with steady overhead.",
    at: [0.6, 0.82],
    palette: ["#9a8e80", "#c83d45", "#f2f2f2", "#b0202a"],
    links: { business: "repair" },
    status: "live",
  }),
  L({
    id: "south.court",
    zone: "south",
    name: "The Court",
    kind: "hangout",
    archetype: "court",
    description:
      "Hangout, rep and conflicts. Whoever runs the court runs the evening.",
    at: [0.82, 0.82],
    palette: ["#7a3a3a", "#c83d45", "#f0e6d8", "#2a2a2a"],
    faction: "backstreet",
    links: { people: true },
    status: "live",
  }),
  L({
    id: "south.community-center",
    zone: "south",
    name: "Southside Community Center",
    kind: "community",
    archetype: "hall",
    sign: "SOUTHSIDE COMMUNITY CENTER",
    description: "Jobs boards, training, events. Back Street recruits outside.",
    at: [0.58, 0.5],
    palette: ["#b9b2a2", "#3a3a3a", "#e8e2d4", "#2a2a2a"],
    links: {},
    status: "planned",
    planned: "Training, programs and community events.",
  }),
  L({
    id: "south.gym",
    zone: "south",
    name: "Southside Gym",
    kind: "gym",
    archetype: "storefront",
    sign: "SOUTHSIDE GYM",
    description: "A ring, heavy bags, and OGs who still train every morning.",
    at: [0.16, 0.62],
    palette: ["#5e3a31", "#1c1c1c", "#141414", "#e33a3a"],
    links: {},
    status: "planned",
    planned: "Training and recruitment.",
  }),
  L({
    id: "south.church",
    zone: "south",
    name: "The Church",
    kind: "church",
    archetype: "church",
    description:
      "Stone, stained glass and a pastor who knows every family on the block.",
    at: [0.75, 0.16],
    palette: ["#8c8577", "#5a4030", "#f5f1e6", "#2a2a2a"],
    links: {},
    status: "planned",
    planned: "Community guidance, standing and cover.",
  }),

  // ---------------- The Reservoir: Block Boys ----------------
  L({
    id: "reservoir.laundry",
    zone: "reservoir",
    name: "Reservoir Laundry",
    kind: "store",
    archetype: "storefront",
    sign: "RESERVOIR LAUNDRY",
    description: "A neighborhood laundry lease with real local demand.",
    at: [0.66, 0.66],
    palette: ["#a69683", "#3a9a8a", "#e8f5f2", "#1e5a52"],
    links: { business: "laundry" },
    status: "live",
    model: "assets/models/brick-corner.glb",
  }),
  L({
    id: "reservoir.warehouse",
    zone: "reservoir",
    name: "Westside warehouse",
    kind: "warehouse",
    archetype: "warehouse",
    sign: "WESTSIDE SUPPLY",
    description: "Deliveries sorted and moved. Applications open citywide.",
    at: [0.88, 0.12],
    palette: ["#8a8578", "#3678c6", "#1e2b38", "#e8eefc"],
    links: { job: "warehouse" },
    status: "live",
  }),
  L({
    id: "reservoir.lil-jays",
    zone: "reservoir",
    name: "Lil Jay's Market",
    kind: "store",
    archetype: "storefront",
    sign: "LIL JAY'S MARKET",
    description:
      "Groceries, cold beer, lotto. Shelves to stock and customers who know your face.",
    at: [0.82, 0.86],
    palette: ["#9e8a7c", "#e3c23a", "#e3c23a", "#b0202a"],
    links: {
      job: "retail-reservoir",
      items: ["necessities", "smokes", "booze"],
    },
    status: "live",
    model: "assets/models/corner-bodega.glb",
  }),
  L({
    id: "reservoir.lot-court",
    zone: "reservoir",
    name: "The lot court",
    kind: "hangout",
    archetype: "court",
    description: "A hoop on a vacant lot. Block Boys' roots run through here.",
    at: [0.63, 0.37],
    palette: ["#4d6b5a", "#3678c6", "#f0e6d8", "#2a2a2a"],
    faction: "blocks",
    links: { people: true },
    status: "live",
  }),
  L({
    id: "reservoir.boarded-house",
    zone: "reservoir",
    name: "Boarded house",
    kind: "street",
    archetype: "house",
    description:
      "Plywood windows, a working back door. Block Boys hustle runs quietly.",
    at: [0.88, 0.63],
    palette: ["#7f8b84", "#3678c6", "#f0e6d8", "#2a2a2a"],
    faction: "blocks",
    links: { street: true },
    status: "live",
    model: "assets/models/boarded-house.glb",
  }),
  L({
    id: "reservoir.homes",
    zone: "reservoir",
    name: "Reservoir homes",
    kind: "residence",
    archetype: "house",
    description: "Weathered porches and deep neighborhood roots.",
    at: [0.84, 0.46],
    palette: ["#b9b2a2", "#3678c6", "#f0e6d8", "#2a2a2a"],
    links: { people: true, rest: true },
    status: "live",
    model: "assets/models/bungalow.glb",
    modelFit: { scale: 0.62 },
  }),
  L({
    id: "reservoir.pawn",
    zone: "reservoir",
    name: "Pawn Shop",
    kind: "pawn",
    archetype: "storefront",
    sign: "$ PAWN SHOP $",
    description: "Resale, no questions, bars on every window.",
    at: [0.63, 0.88],
    palette: ["#8d9a9a", "#e3c23a", "#1c1c1c", "#e3c23a"],
    links: {},
    status: "planned",
    planned: "Resale and recovered goods.",
  }),
  L({
    id: "reservoir.water-tower",
    zone: "reservoir",
    name: "The water tower",
    kind: "landmark",
    archetype: "watertower",
    description:
      "The Reservoir's skyline. Tagged so many times the paint is three colors deep.",
    at: [0.14, 0.3],
    palette: ["#6a6a60", "#3678c6", "#f0e6d8", "#2a2a2a"],
    faction: "blocks",
    links: { politics: true },
    status: "live",
  }),

  // ---------------- The Nawf: Blips vs Mudgang ----------------
  L({
    id: "nawf.el-station",
    zone: "nawf",
    name: "Nawf Ave station",
    kind: "transit",
    archetype: "station",
    sign: "NAWF AVE",
    description: "Under the tracks, the Nawf's street economy moves.",
    at: [0.5, 0.3],
    palette: ["#6c5a48", "#3a3f45", "#1f6a3a", "#f5f5f5"],
    links: { street: true },
    status: "live",
    model: "assets/models/el-station.glb",
    // Deck top sits at ~60% of the model height: 9.5 lines it up with the El.
    modelFit: { height: 9.5, offset: [0, -2.6], trackGap: 9.6 },
  }),
  L({
    id: "nawf.bodega",
    zone: "nawf",
    name: "Nawf Bodega",
    kind: "store",
    archetype: "storefront",
    sign: "NAWF BODEGA",
    description:
      "Yellow awning, groceries, cold drinks, open late. Blips side of the avenue.",
    at: [0.24, 0.62],
    palette: ["#8a4a36", "#e3c23a", "#e3c23a", "#7a1f1f"],
    faction: "blips",
    links: { job: "retail-nawf", items: ["necessities", "smokes"] },
    status: "live",
    model: "assets/models/corner-bodega.glb",
  }),
  L({
    id: "nawf.deli",
    zone: "nawf",
    name: "Nawf Deli & Grocery",
    kind: "store",
    archetype: "storefront",
    sign: "NAWF DELI & GROCERY",
    description: "Snacks, lotto, EBT, ATM. Mudgang holds this corner.",
    at: [0.78, 0.62],
    palette: ["#9b5a3e", "#cd7935", "#e8b84a", "#7a2a10"],
    faction: "muds",
    links: { items: ["necessities", "smokes", "booze"] },
    status: "live",
    model: "assets/models/el-deli.glb",
  }),
  L({
    id: "nawf.projects",
    zone: "nawf",
    name: "Nawf Projects",
    kind: "residence",
    archetype: "projects",
    description:
      "Housing, influence and recruitment. Both sets grew up in these halls.",
    at: [0.5, 0.8],
    palette: ["#8a4a36", "#3a3a3a", "#f0e6d8", "#2a2a2a"],
    links: { people: true, rest: true },
    status: "live",
    model: "assets/models/nawf-projects.glb",
  }),
  L({
    id: "nawf.court",
    zone: "nawf",
    name: "The Court",
    kind: "hangout",
    archetype: "court",
    description: "Pickup games under the El. Purple on the bench.",
    at: [0.14, 0.82],
    palette: ["#5a3a6a", "#8e51cb", "#f0e6d8", "#2a2a2a"],
    faction: "blips",
    links: { people: true },
    status: "live",
  }),
  L({
    id: "nawf.barbershop",
    zone: "nawf",
    name: "Nawf Barbershop",
    kind: "barber",
    archetype: "storefront",
    sign: "NAWF BARBERSHOP",
    description: "Cuts, style, and the best network on the block.",
    at: [0.66, 0.84],
    palette: ["#6e3b2f", "#2a4f9a", "#1c1c1c", "#f2f2f2"],
    links: { people: true },
    status: "live",
    planned: "Grooming, style and introductions.",
  }),
  L({
    id: "nawf.street-market",
    zone: "nawf",
    name: "Street market",
    kind: "retail",
    archetype: "market",
    description: "Tents under the El: gear, tees and side income.",
    at: [0.86, 0.84],
    palette: ["#3a3f45", "#cd7935", "#f0e6d8", "#2a2a2a"],
    faction: "muds",
    links: { gig: true, items: ["clothing"] },
    status: "live",
  }),
  L({
    id: "nawf.memorial",
    zone: "nawf",
    name: "The memorial wall",
    kind: "community",
    archetype: "memorial",
    description:
      "A Mudgang memorial, defaced in Blips purple. Residents want the feud to end.",
    at: [0.25, 0.84],
    palette: ["#8a4a36", "#8e51cb", "#f0e6d8", "#2a2a2a"],
    links: { people: true, politics: true },
    status: "live",
  }),
  L({
    id: "nawf.community-center",
    zone: "nawf",
    name: "Nawf Community Center",
    kind: "community",
    archetype: "hall",
    sign: "NAWF COMMUNITY CENTER",
    description: "Programs, events, a front for whoever pays the light bill.",
    at: [0.12, 0.62],
    palette: ["#9b5a3e", "#8e51cb", "#e8e2d4", "#5a2a8a"],
    links: {},
    status: "planned",
    planned: "Programs, events and peace talks.",
  }),
];

export const locationById = (id: string) => LOCATIONS.find((l) => l.id === id);
export const KIND_ICON: Record<LocationKind, string> = {
  store: "🛒",
  liquor: "🍾",
  food: "🌮",
  retail: "👕",
  auto: "🔧",
  hangout: "🏀",
  residence: "🏠",
  apartment: "🏢",
  police: "🚓",
  civic: "🏛",
  warehouse: "📦",
  docks: "⚓",
  transit: "🚇",
  community: "🤝",
  church: "⛪",
  gym: "🥊",
  barber: "💈",
  club: "🎶",
  pawn: "💰",
  street: "◎",
  landmark: "★",
};
export const KIND_LABEL: Record<LocationKind, string> = {
  store: "Corner store",
  liquor: "Liquor store",
  food: "Food",
  retail: "Retail",
  auto: "Auto shop",
  hangout: "Hangout",
  residence: "Housing",
  apartment: "Apartments",
  police: "Police",
  civic: "Government",
  warehouse: "Warehouse",
  docks: "Docks",
  transit: "Transit",
  community: "Community",
  church: "Church",
  gym: "Gym",
  barber: "Barbershop",
  club: "Bar / club",
  pawn: "Pawn shop",
  street: "Street spot",
  landmark: "Landmark",
};
