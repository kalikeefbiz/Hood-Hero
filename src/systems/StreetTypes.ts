import type { ZoneId, FactionId } from "../core/GameState";
export interface MerchandiseLot {
  id: string;
  category: string;
  owner: string;
  supplier: string;
  zone: ZoneId;
  received: number;
  remaining: number;
  lost: number;
  cost: number;
  expectedGross: number;
  collected: number;
  owed: number;
  paid: number;
  losses: number;
  crewPaid: number;
  dueDay: number;
  acquiredDay: number;
  arrangement: "cash" | "consignment";
  status: "held" | "distributed" | "lost" | "settled";
  agreementId?: string;
}
export interface SupplierAgreement {
  id: string;
  lotId: string;
  supplier: string;
  debtor: string;
  original: number;
  repaid: number;
  balance: number;
  dueDay: number;
  status: "pending" | "overdue" | "fulfilled";
  commitmentId: string;
  history: string[];
}
export interface StreetTransaction {
  id: string;
  day: number;
  lotId: string;
  market: ZoneId;
  actor: string;
  partner?: string;
  sold: number;
  lost: number;
  gross: number;
  loss: number;
  crewPaid: number;
  crewLoss: number;
  outcome: "sale" | "partial" | "none" | "money-loss" | "goods-loss";
  eventId: string;
}
export interface CriminalMarket {
  zone: ZoneId;
  demand: number;
  pressure: number;
  competition: number;
  activity: number;
  actors: Record<string, number>;
  factions: Partial<Record<FactionId, number>>;
  usedDay: number;
  used: number;
  lastDevelopmentDay: number;
}
export interface CustodyRecord {
  id: string;
  character: string;
  arrestDay: number;
  cause: string;
  severity: number;
  prior: number;
  releaseDay: number | null;
  status: "held" | "released";
  conditions: string;
  eventId: string;
}
export interface Exposure {
  recent: { day: number; zone: ZoneId; weight: number }[];
  investigation: number;
  warningBand: number;
}
export interface StreetState {
  lots: MerchandiseLot[];
  agreements: SupplierAgreement[];
  transactions: StreetTransaction[];
  markets: Record<ZoneId, CriminalMarket>;
  exposure: Record<string, Exposure>;
  custody: CustodyRecord[];
  arrears: number;
}
