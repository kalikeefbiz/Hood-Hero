import type { ZoneId } from "../core/GameState";

export const NEIGHBORHOODS: Record<
  ZoneId,
  { image: string; alt: string; flavor: string; position: string }
> = {
  downtown: {
    image: "downtown.webp",
    alt: "Downtown towers, rain-soaked commerce and docks under police watch",
    flavor: "Money. Influence. Opportunity.",
    position: "50% 52%",
  },
  rio: {
    image: "rio.webp",
    alt: "Lowriders along warm Eastside streets in Rio Gabriel",
    flavor: "Eastside roots. Lowrider streets.",
    position: "50% 60%",
  },
  south: {
    image: "south.webp",
    alt: "Southside project housing above worn neighborhood streets",
    flavor: "Old loyalty. New ambition.",
    position: "50% 48%",
  },
  reservoir: {
    image: "reservoir.webp",
    alt: "Boarded homes and vacant lots in The Reservoir at sunset",
    flavor: "Boarded houses. Deep roots.",
    position: "50% 55%",
  },
  nawf: {
    image: "nawf.webp",
    alt: "The Nawf’s bodega, elevated train and defaced Mudgang memorial",
    flavor: "Culture. Hustle. Conflict.",
    position: "50% 55%",
  },
};
export const neighborhoodImage = (zone: ZoneId) =>
  `${import.meta.env.BASE_URL}assets/neighborhoods/${NEIGHBORHOODS[zone].image}`;
