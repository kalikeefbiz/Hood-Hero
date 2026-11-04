export type ID = string;
export type ZoneId = "downtown" | "rio" | "south" | "reservoir" | "nawf";
export type FactionId = "angels" | "backstreet" | "blocks" | "blips" | "muds";
export type Status = "active" | "arrested" | "dead" | "laying-low";
export interface Wallet {
  clean: number;
  illicit: number;
}
export interface Relationship {
  trust: number;
  respect: number;
  affection: number;
  grievance: number;
  history: ID[];
}
export interface Memory {
  eventId: ID;
  day: number;
  about: ID;
  meaning: string;
  weight: number;
}
export interface Character {
  id: ID;
  name: string;
  alias?: string;
  description: string;
  home: ZoneId;
  affiliation: FactionId | null;
  status: Status;
  availableDay: number;
  lastActionDay: number;
  traits: { loyalty: number; ambition: number; risk: number; lawful: number };
  skills: { social: number; work: number; recovery: number };
  agency: {
    lastAssignmentDay: number;
    lastOfferDay: number;
    lastRequestDay: number;
    unreasonableRequests: number;
  };
  goals: ("income" | "status" | "stability" | "loyalty")[];
  wallet: Wallet;
  relationships: Record<ID, Relationship>;
  memories: Memory[];
  known: ID[];
  connections: ID[];
  stress: number;
  notoriety: number;
  police: number;
  influence: number;
  legitimacy: number;
  neighborhoodStanding: Record<ZoneId, number>;
  organizationStanding: Record<FactionId, number>;
  possessions: ID[];
  recurringLawfulIncome: number;
  authority: number;
  rivalThreat: number;
}
export interface Zone {
  id: ZoneId;
  name: string;
  subtitle: string;
  description: string;
  police: number;
  commerce: number;
  support: number;
  organizations: FactionId[];
  controller: FactionId | null;
}
export interface Faction {
  id: FactionId;
  name: string;
  color: string;
  home: ZoneId;
  leaders: ID[];
  allies: FactionId[];
  enemies: FactionId[];
  resources: number;
  instability: number;
  influence: Record<ZoneId, number>;
  priority: "commerce" | "stability" | "status";
}
export interface Property {
  id: ID;
  name: string;
  owner: ID;
  possession: { kind: "character" | "group" | "market"; id: ID };
  value: number;
  provenance: "clean" | "illicit";
}
export interface Incident {
  id: ID;
  kind: "property-dispute";
  title: string;
  victim: ID;
  participants: ID[];
  organization: FactionId;
  property: ID;
  startedDay: number;
  demand: number;
  minimumDemand: number;
  escalation: number;
  negotiated: boolean;
  informed: boolean;
  leadershipAware: boolean;
  helpRequested: boolean;
  deadline: number;
  status: "active" | "resolved" | "abandoned";
  resolution?: "buyback" | "recovered" | "settlement" | "sold";
  interventions: { actor: ID; type: string; eventId: ID; day: number }[];
  resolvedEventId?: ID;
  resolvedBy?: ID;
}
export interface GameEvent {
  id: ID;
  day: number;
  category:
    "social" | "money" | "city" | "incident" | "crew" | "risk" | "system";
  text: string;
  actors: ID[];
  observedBy: ID[];
  importance?: "routine" | "personal" | "major" | "critical";
  title?: string;
  incidentId?: ID;
  commitmentId?: ID;
  factionId?: FactionId;
  presentationKey?: string;
  expiresOnIncidentClose?: boolean;
}
export type CommitmentStatus =
  | "pending"
  | "fulfilled"
  | "broken"
  | "released"
  | "superseded"
  | "completed"
  | "failed";
export interface Commitment {
  id: ID;
  origin: ID;
  requester: ID;
  actor: ID;
  beneficiary: ID;
  createdDay: number;
  dueDay: number;
  kind:
    | "errand"
    | "recover-property"
    | "employment-shift"
    | "crew-activity"
    | "supplier-debt";
  employmentId?: ID;
  incidentId?: ID;
  status: CommitmentStatus;
  evidence: ID[];
  warned: boolean;
  consequences: {
    fulfilled: { trust: number; respect: number; grievance: number };
    broken: { trust: number; respect: number; grievance: number };
    released: { trust: number; respect: number; grievance: number };
  };
}
export interface EncounterInstance {
  id: ID;
  definitionId: string;
  dangerSceneId?: ID;
  crewOfferId?: ID;
  sourceEventId?: ID;
  incidentId?: ID;
  participants: ID[];
  createdDay: number;
  dueDay?: number;
  status: "pending" | "active" | "acknowledged" | "closed";
  selectedResponses: { id: string; day: number; eventIds: ID[] }[];
  followUpPending: boolean;
  deferred: boolean;
}
export interface Employment {
  id: ID;
  actor: ID;
  jobId: ID;
  employer: ID;
  location: ZoneId;
  status: "employed" | "resigned" | "terminated";
  hiredDay: number;
  endedDay?: number;
  wage: number;
  workdays: number[];
  attendance: {
    day: number;
    status: "worked" | "missed" | "excused";
    eventId: ID;
  }[];
  reliability: number;
  performance: number;
  warnings: number;
  rehireDay: number;
  timeOffDays: number[];
  raised: boolean;
  eventIds: ID[];
}
export interface EmploymentSearch {
  eligibleDay: number;
  offeredJob?: ID;
  lastApplicationDay?: number;
  lastGigDay?: number;
}
export interface Asset {
  id: ID;
  owner: ID;
  value: number;
  provenance: "clean" | "illicit";
  recurringIncome: number;
}
export interface GameState {
  /** Strategy-board lab: the player's physical presence in the city. */
  quanny: import("../systems/QuannyState").QuannyState;
  danger: import("../systems/DangerState").DangerState;
  presence?: import("../board/presence").Presence;
  version: 8;
  strategic: import("../systems/StrategicTypes").StrategicState;
  street: import("../systems/StreetTypes").StreetState;
  assignments: CrewAssignment[];
  crewOffers: CrewOffer[];
  day: number;
  ap: number;
  rng: number;
  nextId: number;
  playerId: ID;
  characters: Record<ID, Character>;
  zones: Record<ZoneId, Zone>;
  factions: Record<FactionId, Faction>;
  properties: Record<ID, Property>;
  incidents: Record<ID, Incident>;
  events: GameEvent[];
  commitments: Commitment[];
  encounters: EncounterInstance[];
  acknowledgedEvents: ID[];
  crew: { members: ID[]; capacity: number; successor: ID | null };
  employment: Employment[];
  employmentSearch: Record<ID, EmploymentSearch>;
  assets: Asset[];
  ledger: {
    day: number;
    amount: number;
    provenance: "clean" | "illicit";
    reason: string;
  }[];
  progression: {
    cleanEarned: number;
    illicitEarned: number;
    jobs: number;
    retired: boolean;
  };
  end: null | "legitimate-exit" | "underlord" | "arrested" | "killed";
}
export const player = (s: GameState) => s.characters[s.playerId];
export const cash = (c: Character) => c.wallet.clean + c.wallet.illicit;
export const clamp = (v: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, v));

export type CrewActivity =
  "work" | "information" | "social" | "partner-gig" | "partner-crime";
export interface CrewAssignment {
  id: ID;
  participants: ID[];
  member: ID;
  activity: CrewActivity;
  objective: string;
  conditions: string[];
  relationshipEffect: string;
  status: "proposed" | "refused" | "accepted" | "active" | "resolved";
  createdDay: number;
  dueDay: number;
  apCost: number;
  compensation: number;
  expectedBenefit: number;
  skill: "work" | "social" | "recovery";
  chance: number;
  risk: string;
  experience: number;
  commitmentId?: ID;
  offerId?: ID;
  success?: boolean;
  outcome?: string;
  eventIds: ID[];
}
export interface CrewOffer {
  id: ID;
  member: ID;
  contact: ID;
  activity: "partner-gig" | "social" | "information";
  createdDay: number;
  expiresDay: number;
  activityDay: number;
  status: "pending" | "accepted" | "declined" | "expired";
  assignmentId?: ID;
}
