import type { GameState } from "../core/GameState";
export function CommitmentSummary({ s }: { s: GameState }) {
  const promises = s.commitments.filter(
    (c) => c.kind === "recover-property" && c.status === "pending",
  );
  if (!promises.length) return null;
  return (
    <section className="commitment-summary panel" aria-label="Your promises">
      <h3>Your word</h3>
      {promises.map((c) => (
        <div key={c.id}>
          <strong>Help Cuzzo recover his chains · {c.status}</strong>
          <p>
            {c.status === "pending"
              ? `${Math.max(0, c.dueDay - s.day)} days remaining · Before day ${c.dueDay} begins. The situation may end sooner.`
              : c.status === "fulfilled"
                ? "Your contribution is recorded. Cuzzo remembers."
                : c.status === "broken"
                  ? "Cuzzo remembers the promise you broke."
                  : "Events overtook your promise. No accomplishment credit or betrayal penalty."}
          </p>
        </div>
      ))}
    </section>
  );
}
