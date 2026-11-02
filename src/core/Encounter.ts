import type { Action } from "./ActionEngine";
import type { EncounterInstance, GameState } from "./GameState";
export type EncounterEffect =
  | {
      type: "street";
      choice: string;
      supplier?: string;
      arrangement?: "cash" | "consignment";
      agreementId?: string;
      amount?: number;
    }
  | {
      type: "crew";
      choice: string;
      activity?: import("./GameState").CrewActivity;
      compensation?: number;
      assignmentId?: string;
    }
  | { type: "workplace"; choice: string }
  | { type: "clarify" | "promise" | "decline" | "delay" | "acknowledge" }
  | { type: "action"; action: Action };
export interface EncounterResponse {
  id: string;
  label: string;
  detail?: string;
  effect: EncounterEffect;
  requirement?: (s: GameState, encounter: EncounterInstance) => string | null;
}
export interface EncounterDefinition {
  id: string;
  type: "request" | "reaction";
  participants: string[];
  priority: number;
  trigger: (
    s: GameState,
  ) => { key: string; eventId?: string; incidentId?: string }[];
  eligible: (s: GameState, e: EncounterInstance) => boolean;
  expression?: (
    s: GameState,
    e: EncounterInstance,
  ) => "concerned" | "confident" | "proposing" | "strategizing";
  dialogue: (s: GameState, e: EncounterInstance) => string;
  responses: (s: GameState, e: EncounterInstance) => EncounterResponse[];
  rules: { replay: "contextual" | "read-only"; expiresWithIncident: boolean };
}
