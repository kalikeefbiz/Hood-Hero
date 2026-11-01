// Regenerate the small procedural UI material, never the approved neighborhood art.
// Run after `npx playwright install chromium`: node scripts/rasterize-ui-texture.mjs
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
const source = new URL("../src/ui/patina.svg", import.meta.url);
const target = new URL("../src/ui/patina.png", import.meta.url);
const browser = await chromium.launch();
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  const dataUrl =
    "data:image/svg+xml;base64," + readFileSync(source).toString("base64");
  const png = await page.evaluate(async (url) => {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 240;
    canvas.height = 240;
    canvas.getContext("2d").drawImage(image, 0, 0);
    return canvas.toDataURL("image/png").split(",")[1];
  }, dataUrl);
  writeFileSync(target, Buffer.from(png, "base64"));
} finally {
  await browser.close();
}
