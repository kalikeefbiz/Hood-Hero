import { describe, expect, it } from "vitest";
import { readFileSync, statSync } from "node:fs";
import { ACTION_ART, actionArtUrl } from "../ui/actionArt";

describe("approved action artwork contract", () => {
  it("maps exactly the five approved existing action IDs", () => {
    expect(
      Object.fromEntries(
        Object.entries(ACTION_ART).map(([id, art]) => [id, art?.file]),
      ),
    ).toEqual({
      work: "clock-in",
      standing: "build-local-connection",
      rest: "quiet-afternoon",
      crime: "black-market-opportunity",
      inquire: "ask-around",
    });
    expect(ACTION_ART.gig).toBeUndefined();
    expect(ACTION_ART.contact).toBeUndefined();
    expect(ACTION_ART.socialize).toBeUndefined();
  });
  it("ships real WebP files under the mobile asset budget and uses the Vite base", () => {
    for (const art of Object.values(ACTION_ART)) {
      for (const width of [480, 960] as const) {
        const url = actionArtUrl(art.file, width);
        expect(url).toBe(
          `${import.meta.env.BASE_URL}assets/actions/${art.file}-${width}.webp`,
        );
        const path = new URL(
          `../../public/assets/actions/${art.file}-${width}.webp`,
          import.meta.url,
        );
        const bytes = readFileSync(path);
        expect(bytes.toString("ascii", 0, 4)).toBe("RIFF");
        expect(bytes.toString("ascii", 8, 12)).toBe("WEBP");
        expect(statSync(path).size).toBeLessThan(
          width === 480 ? 50_000 : 160_000,
        );
      }
    }
  });
});
