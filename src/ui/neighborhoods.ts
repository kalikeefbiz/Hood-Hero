import { copy } from "../content/copy";
import type { ZoneId } from "../core/GameState";

export const NEIGHBORHOODS: Record<
  ZoneId,
  { image: string; alt: string; flavor: string; position: string }
> = {
  downtown: {
    image: "downtown.webp",
    alt: copy("neighborhoods.downtown.alt"),
    flavor: copy("neighborhoods.downtown.flavor"),
    position: "50% 52%",
  },
  rio: {
    image: "rio.webp",
    alt: copy("neighborhoods.rio.alt"),
    flavor: copy("neighborhoods.rio.flavor"),
    position: "50% 60%",
  },
  south: {
    image: "south.webp",
    alt: copy("neighborhoods.south.alt"),
    flavor: copy("neighborhoods.south.flavor"),
    position: "50% 48%",
  },
  resevoir: {
    image: "resevoir.webp",
    alt: copy("neighborhoods.resevoir.alt"),
    flavor: copy("neighborhoods.resevoir.flavor"),
    position: "50% 55%",
  },
  nawf: {
    image: "nawf.webp",
    alt: copy("neighborhoods.nawf.alt"),
    flavor: copy("neighborhoods.nawf.flavor"),
    position: "50% 55%",
  },
};
export const neighborhoodImage = (zone: ZoneId) =>
  `${import.meta.env.BASE_URL}assets/neighborhoods/${NEIGHBORHOODS[zone].image}`;
