import type { ZoneId } from "../core/GameState";
import { BALANCE } from "./balance";
export interface JobDefinition {
  id: string;
  name: string;
  employer: string;
  location: ZoneId;
  workdays: number[];
  wage: number;
  minWork: number;
  minSocial: number;
  description: string;
}
// Weekday 0 = Monday. Commuting is included in the full shift's 2 AP.
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const JOBS: JobDefinition[] = [
  ...(["downtown", "rio", "south", "reservoir", "nawf"] as ZoneId[]).map(
    (location) => ({
      id: `retail-${location}`,
      name: "Neighborhood retail",
      employer: `resident-${location}`,
      location,
      workdays: [1, 3, 5],
      wage: BALANCE.workIncome,
      minWork: 30,
      minSocial: 30,
      description:
        "Stock shelves and serve customers. A local resident handles hiring. Open to local applicants or people with a local contact.",
    }),
  ),
  {
    id: "warehouse",
    name: "Warehouse assistant",
    employer: "resident-reservoir",
    location: "reservoir",
    workdays: [0, 2, 4],
    wage: BALANCE.workIncome,
    minWork: 40,
    minSocial: 0,
    description:
      "Sort deliveries and move stock. Applications open citywide; commute included in the shift.",
  },
];
export const jobDefinition = (id: string) => JOBS.find((j) => j.id === id)!;
export const weekday = (day: number) => (day - 1) % 7;
