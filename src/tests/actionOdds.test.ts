import { acquire } from "../systems/StreetEconomy";
import { describe, expect, test } from "vitest";
import { newGame } from "../core/Simulation";
import {
  actionSuccessChance,
  performAction,
  type ActionType,
} from "../core/ActionEngine";
import { random } from "../core/Random";

describe("odds presented to the player", () => {
  for (const type of ["negotiate", "recover", "crime"] as ActionType[]) {
    test(`${type} predicts the actual seeded outcome without changing the world or RNG`, () => {
      for (let seed = 1; seed <= 80; seed++) {
        const s = newGame("Odds", "nawf", seed * 98713);
        s.characters.player.stress = seed % 2 ? 95 : 5;
        s.characters.player.neighborhoodStanding.nawf = 5;
        s.incidents["the-chains"].informed = true;
        if (type === "crime") acquire(s, "mega", "consignment");
        const a = { type, actor: "player", incidentId: "the-chains" };
        const before = structuredClone(s);
        const chance = actionSuccessChance(s, a)!;
        expect(chance).toBeGreaterThanOrEqual(0);
        expect(chance).toBeLessThanOrEqual(1);
        expect(s).toEqual(before);
        const succeeds = random(structuredClone(s)) < chance;
        const result = performAction(s, a);
        expect(result.error).toBeNull();
        if (type === "negotiate")
          expect(
            result.state.incidents["the-chains"].demand <
              s.incidents["the-chains"].demand,
          ).toBe(succeeds);
        if (type === "recover")
          expect(
            result.state.incidents["the-chains"].status === "resolved",
          ).toBe(succeeds);
        if (type === "crime")
          expect(result.state.street.transactions.at(-1)!.gross > 0).toBe(
            succeeds,
          );
      }
    });
  }
});
