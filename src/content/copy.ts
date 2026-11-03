import actions from "./copy/actions.json" with { type: "json" };
import ui from "./copy/interface.json" with { type: "json" };
import neighborhoods from "./copy/neighborhoods.json" with { type: "json" };
import characters from "./copy/characters.json" with { type: "json" };
import crew from "./copy/crew-dialogue.json" with { type: "json" };
import workplace from "./copy/workplace-dialogue.json" with { type: "json" };
import supplier from "./copy/supplier-dialogue.json" with { type: "json" };
import events from "./copy/city-events.json" with { type: "json" };
import chains from "./copy/storylines/the-chains.json" with { type: "json" };
import { COPY_CONTRACT } from "./copy-contract";
import { flattenCopy, formatCopy, type CopyValue } from "./copy-rules";
const entries = flattenCopy({
  actions,
  interface: ui,
  neighborhoods,
  characters,
  "crew-dialogue": crew,
  "workplace-dialogue": workplace,
  "supplier-dialogue": supplier,
  "city-events": events,
  storylines: { "the-chains": chains },
});
export type CopyKey = keyof typeof COPY_CONTRACT;
type Variables<K extends CopyKey> = Record<
  (typeof COPY_CONTRACT)[K][number],
  CopyValue
>;
export function copy<K extends CopyKey>(
  key: K,
  ...args: (typeof COPY_CONTRACT)[K] extends readonly [] ? [] : [Variables<K>]
): string {
  if (!Object.hasOwn(COPY_CONTRACT, key) || !Object.hasOwn(entries, key))
    throw new Error(`Missing copy identifier: ${key}`);
  return formatCopy(key, entries[key], COPY_CONTRACT[key], args[0]);
}
