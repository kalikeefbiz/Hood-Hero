import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
const commit = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
writeFileSync(
  "dist/build-info.json",
  JSON.stringify({ app: "Hood Hero", commit, saveSchema: 6, milestone: "GOAL 006" }) + "\n",
);
