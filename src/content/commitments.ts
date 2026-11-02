import type { CommitmentStatus } from "../core/GameState";
export function propertyPromiseOutcome(status: CommitmentStatus) {
  const fulfilled = status === "fulfilled",
    broken = status === "broken";
  const title = fulfilled
    ? "You kept your word"
    : broken
      ? "You left Cuzzo hanging"
      : status === "released"
        ? "Cuzzo released your promise"
        : "The Chains — settled without you";
  const text =
    status === "released"
      ? "Cuzzo released you from the promise. No betrayal penalty applies."
      : fulfilled
        ? "Your contribution helped return Mega’s chains. Cuzzo remembers that you kept your word. Trust +8 · Respect +5."
        : broken
          ? "The chains are beyond reach. You promised to help and did not deliver. Cuzzo’s trust fell by 18, respect by 8; grievance rose by 14."
          : "The situation ended outside your involvement. Your promise is superseded; no accomplishment credit or broken-promise penalty.";

  return {
    title,
    text,
    memory: fulfilled
      ? "Kept the promise to help recover my chains."
      : broken
        ? "Promised to help, then left me hanging."
        : status === "released"
          ? "Released the promise to help."
          : "The situation ended before the promise could be carried out.",
    weight: fulfilled ? 15 : broken ? -18 : 0,
  };
}
