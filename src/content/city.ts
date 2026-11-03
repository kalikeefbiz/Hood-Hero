import type { Zone, ZoneId } from "../core/GameState";
export const ZONES: Record<ZoneId, Zone> = {
  downtown: {
    id: "downtown",
    name: "Downtown",
    subtitle: "The commercial heart",
    description:
      "Offices, politicians and the docks. High-value work; heavy police presence. No dominant organization.",
    police: 90,
    commerce: 95,
    support: 40,
    organizations: [],
    controller: null,
  },
  rio: {
    id: "rio",
    name: "Rio Gabriel",
    subtitle: "Eastside",
    description:
      "Lowriders and black-market trade. Gabriel’s Angels enjoy substantial community support.",
    police: 45,
    commerce: 55,
    support: 75,
    organizations: ["angels"],
    controller: "angels",
  },
  south: {
    id: "south",
    name: "Southside",
    subtitle: "Old loyalty. New ambition.",
    description:
      "Back Street is politically isolated. Younger members question Justice’s turn toward legitimate business.",
    police: 55,
    commerce: 45,
    support: 45,
    organizations: ["backstreet"],
    controller: "backstreet",
  },
  reservoir: {
    id: "reservoir",
    name: "The Reservoir",
    subtitle: "Westside",
    description:
      "Boarded houses, vacant lots and deep neighborhood roots. Block Boys have strong local support and a violent rivalry with the Angels.",
    police: 50,
    commerce: 75,
    support: 80,
    organizations: ["blocks"],
    controller: "blocks",
  },
  nawf: {
    id: "nawf",
    name: "The Nawf",
    subtitle: "Northside",
    description:
      "The Blips’ purple and Mudgang’s brown share the zone. Residents want their long feud to end.",
    police: 60,
    commerce: 40,
    support: 20,
    organizations: ["blips", "muds"],
    controller: null,
  },
};
