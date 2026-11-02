import { clamp, type GameState } from "../core/GameState";
import { record } from "../core/EventLog";
export function advanceFactions(s: GameState) {
  for (const f of Object.values(s.factions)) {
    const allies = f.allies.filter(
      (id) => s.factions[id].resources > 200,
    ).length;
    // Recognized leaders retain a reduced organizing influence while incarcerated.
    const leadership = f.leaders.reduce((total, id) => {
      const c = s.characters[id];
      return (
        total +
        (c.status === "dead"
          ? 0
          : c.influence * (c.status === "arrested" ? 0.35 : 1))
      );
    }, 0);
    const leadershipSupport = leadership / 500;
    const contested = f.enemies.some((id) => s.factions[id].home === f.home);
    if (f.instability >= 40) {
      const ongoing = s.events.some(
        (e) =>
          e.day === s.day - 1 &&
          e.factionId === f.id &&
          e.title === "Internal tensions",
      );
      f.resources = Math.max(0, f.resources - 12);
      f.instability = clamp(f.instability - 2 - leadershipSupport);
      record(
        s,
        "city",
        `${f.name} spent resources maintaining loyalty amid internal tensions.`,
        f.leaders,
        ["player", ...f.leaders],
        {
          factionId: f.id,
          title: "Internal tensions",
          importance: ongoing ? "routine" : "major",
        },
      );
    } else if (f.priority === "commerce" || f.resources < 300) {
      const gain = 12 + Math.floor(s.zones[f.home].commerce / 10);
      f.resources += gain;
      f.influence[f.home] = clamp(f.influence[f.home] + 1);
      record(
        s,
        "city",
        `${f.name} backed local trade in ${s.zones[f.home].name}, improving its finances.`,
        f.leaders,
        ["player", ...f.leaders],
        { factionId: f.id },
      );
    } else if (contested) {
      f.resources = Math.max(0, f.resources - 8);
      f.influence[f.home] = clamp(f.influence[f.home] + 0.5);
      s.zones[f.home].support = clamp(s.zones[f.home].support - 0.2);
      record(
        s,
        "city",
        `${f.name} committed resources to its contested foothold in ${s.zones[f.home].name}. Residents remain opposed to the feud.`,
        [],
        ["player"],
        { factionId: f.id },
      );
    } else {
      f.resources = Math.max(0, f.resources - 5);
      f.influence[f.home] = clamp(
        f.influence[f.home] + 0.5 + allies * 0.1 + leadershipSupport,
      );
      record(
        s,
        "city",
        `${f.name} reinforced neighborhood ties in ${s.zones[f.home].name}.`,
        f.leaders,
        ["player", ...f.leaders],
        { factionId: f.id },
      );
    }
  }
}
