import type { ReactNode } from "react";
import type { GameState, ZoneId } from "../../core/GameState";
import type { Action } from "../../core/ActionEngine";
import { businessAction, businessError } from "../../systems/Businesses";
import { BUSINESSES } from "../../content/strategy";
import { THEMES } from "../../ui/theme";
import { ZONE_ORDER, blockById } from "../../city3d/layout";
import { KIND_ICON, KIND_LABEL, LOCATIONS, locationById } from "../locations";
import { placeActions, placeFacts, placePeople } from "../interactions";
import type { BoardView } from "../viewModel";
import type { Focus, Lens, TimeOfDay } from "../BoardRenderer";

const band = (n: number, words: string[]) =>
  words[n < 20 ? 0 : n < 45 ? 1 : n < 70 ? 2 : 3];

export const blockLabel = (id: string) => {
  const b = blockById(id);
  return b ? `Block ${b.col + 1}·${b.row + 1}` : "Block";
};

/** Breadcrumb, lenses and time of day, floating over the city. */
export function BoardControls({
  s,
  focus,
  setFocus,
  lens,
  setLens,
  time,
  setTime,
}: {
  s: GameState;
  focus: Focus;
  setFocus: (f: Focus) => void;
  lens: Lens;
  setLens: (l: Lens) => void;
  time: TimeOfDay;
  setTime: (t: TimeOfDay) => void;
}) {
  const place = focus.place ? locationById(focus.place) : null;
  const crumbs: { label: string; to: Focus }[] = [
    { label: "Stixx City", to: { zone: null, block: null, place: null } },
  ];
  if (focus.zone)
    crumbs.push({
      label: s.zones[focus.zone].name,
      to: { zone: focus.zone, block: null, place: null },
    });
  if (focus.block)
    crumbs.push({
      label: blockLabel(focus.block),
      to: { zone: focus.zone, block: focus.block, place: null },
    });
  if (place) crumbs.push({ label: place.name, to: focus });
  const up = crumbs.length > 1 ? crumbs[crumbs.length - 2].to : null;
  const lenses: { id: Lens; label: string }[] = [
    { id: "streets", label: "Streets" },
    { id: "influence", label: "Influence" },
    { id: "police", label: "Police" },
    { id: "opportunity", label: "Moves" },
  ];
  const times: TimeOfDay[] = ["dusk", "night", "day"];
  return (
    <div className="board-controls">
      <nav className="board-crumbs" aria-label="Board location">
        {up && (
          <button
            className="board-up"
            aria-label="Zoom out"
            onClick={() => setFocus(up)}
          >
            ‹
          </button>
        )}
        <ol>
          {crumbs.map((c, i) => (
            <li key={c.label}>
              {i < crumbs.length - 1 ? (
                <button onClick={() => setFocus(c.to)}>{c.label}</button>
              ) : (
                <span aria-current="location">{c.label}</span>
              )}
            </li>
          ))}
        </ol>
      </nav>
      {!place && (
        <div className="board-toggles">
          <div className="board-lenses" role="group" aria-label="Map lens">
            {lenses.map((l) => (
              <button
                key={l.id}
                aria-pressed={lens === l.id}
                onClick={() => setLens(l.id)}
              >
                {l.label}
              </button>
            ))}
          </div>
          <button
            className="board-time"
            aria-label={`Time of day: ${time}. Change`}
            onClick={() =>
              setTime(times[(times.indexOf(time) + 1) % times.length])
            }
          >
            {time === "dusk" ? "🌆" : time === "night" ? "🌙" : "☀️"}
          </button>
        </div>
      )}
    </div>
  );
}

/** District quick-select; doubles as the accessible district list. */
export function DistrictChips({
  s,
  focus,
  setFocus,
}: {
  s: GameState;
  focus: Focus;
  setFocus: (f: Focus) => void;
}) {
  return (
    <div
      className="district-chips"
      role="group"
      aria-label="Five neighborhoods of Stixx City"
    >
      {ZONE_ORDER.map((id) => {
        const z = s.zones[id],
          t = s.strategic.territories[id];
        const presence = z.organizations
          .map((f) => s.factions[f].name)
          .join(" / ");
        const colors = z.organizations.length
          ? z.organizations.map((f) => THEMES[f].accent)
          : ["#A8ADB3"];
        return (
          <button
            key={id}
            aria-label={`Select ${z.name}`}
            aria-pressed={focus.zone === id}
            aria-describedby={`chip-desc-${id}`}
            onClick={() => setFocus({ zone: id, block: null, place: null })}
          >
            <span id={`chip-desc-${id}`} hidden>
              {`${z.controller ? `Controlled by ${s.factions[z.controller].name}.` : "No single controller."}${presence ? ` Faction presence: ${presence}.` : " Unclaimed."}`}
            </span>
            <span className="chip-colors" aria-hidden="true">
              {colors.map((c) => (
                <i key={c} style={{ background: c }} />
              ))}
            </span>
            <span>{z.name}</span>
            {t.contested && (
              <small className="chip-contested" aria-hidden="true">
                !
              </small>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** A block: who shows their colors here, and what's on it. */
export function BlockSheet({
  s,
  view,
  blockId,
  setFocus,
}: {
  s: GameState;
  view: BoardView;
  blockId: string;
  setFocus: (f: Focus) => void;
}) {
  const b = view.blocks[blockId];
  if (!b) return null;
  const z = s.zones[b.zone];
  const holder = b.faction ? s.factions[b.faction].name : null;
  return (
    <section
      className="panel board-card"
      aria-label={`${z.name} ${blockLabel(blockId)}`}
      style={{ borderTopColor: b.color }}
    >
      <p className="eyebrow">
        {z.name} · {blockLabel(blockId)}
      </p>
      <h3>{holder ? `${holder} block` : "Neutral block"}</h3>
      <p>
        {holder
          ? b.contested
            ? `${holder} marks are here, but rivals are pushing in. Expect friction.`
            : `${holder} colors are on the walls ${b.strength > 0.6 ? "and on the corners" : "but the hold is light"}.`
          : "No organization has put its name on these walls."}
      </p>
      <p className="board-facts">
        Police {band(b.police, ["minimal", "light", "elevated", "heavy"])} ·
        Street activity{" "}
        {band(view.zones[b.zone].streetActivity, [
          "quiet",
          "steady",
          "busy",
          "crowded",
        ])}
      </p>
      {b.locations.length > 0 ? (
        <ul className="board-place-list" aria-label="Places on this block">
          {b.locations.map((id) => {
            const l = locationById(id)!;
            const st = view.places[id];
            return (
              <li key={id}>
                <button
                  onClick={() =>
                    setFocus({ zone: l.zone, block: blockId, place: id })
                  }
                >
                  <span aria-hidden="true">{KIND_ICON[l.kind]}</span>
                  <strong>{l.name}</strong>
                  <small>
                    {st?.live
                      ? st.actions
                        ? `${st.actions} moves`
                        : KIND_LABEL[l.kind]
                      : "Coming soon"}
                  </small>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="muted">
          Homes and storefronts. Nothing here needs you today.
        </p>
      )}
    </section>
  );
}

/** A place: what it is, what you can do there now, who's around. */
export function PlaceSheet({
  s,
  view,
  placeId,
  renderAction,
  renderStreet,
  openPerson,
  showPolitics,
  setState,
  openStoryline,
}: {
  s: GameState;
  view: BoardView;
  placeId: string;
  renderAction: (a: Action) => ReactNode;
  renderStreet: (zone: ZoneId) => ReactNode;
  openPerson: (id: string) => void;
  showPolitics: (zone: ZoneId) => void;
  setState: (s: GameState) => void;
  openStoryline?: () => void;
}) {
  const l = locationById(placeId);
  if (!l) return null;
  const z = view.zones[l.zone];
  const st = view.places[l.id];
  const actions = placeActions(s, l);
  const people = placePeople(s, l);
  const facts = placeFacts(s, l);
  const business = l.links.business
    ? BUSINESSES.find((b) => b.id === l.links.business)
    : null;
  const owned =
    business &&
    s.strategic.businesses.find(
      (b) =>
        b.definition === business.id && !["sold", "closed"].includes(b.status),
    );
  const block =
    view.blocks[
      Object.keys(view.blocks).find((id) =>
        view.blocks[id].locations.includes(l.id),
      ) ?? ""
    ];
  const holder =
    (l.faction ?? block?.faction)
      ? s.factions[(l.faction ?? block?.faction)!].name
      : null;
  return (
    <section
      className="panel board-card place-card"
      aria-label={l.name}
      style={{
        borderTopColor: block?.faction ? block.color : z.controllerColor,
      }}
    >
      <p className="eyebrow">
        <span aria-hidden="true">{KIND_ICON[l.kind]}</span> {z.name} ·{" "}
        {KIND_LABEL[l.kind]}
        {holder ? ` · ${holder} turf` : ""}
      </p>
      <h3>{l.name}</h3>
      <p>{l.description}</p>
      {facts.map((f) => (
        <p className="board-facts" key={f}>
          {f}
        </p>
      ))}
      {l.links.incident &&
        s.incidents[l.links.incident]?.status === "active" &&
        openStoryline && (
          <button className="secondary" onClick={openStoryline}>
            Open {s.incidents[l.links.incident].title} storyline →
          </button>
        )}
      {actions.length > 0 && (
        <div
          className="board-actions"
          aria-label={`Moves at ${l.name}`}
          role="group"
        >
          {actions.map((a) => renderAction(a))}
        </div>
      )}
      {business && (
        <div className="board-business">
          <h4>{business.name}</h4>
          <p className="muted">{business.description}</p>
          <div className="board-business-actions">
            {(owned ? (["maintain", "sell"] as const) : (["buy"] as const)).map(
              (kind) => {
                const error = businessError(s, business.id, kind);
                return (
                  <button
                    key={kind}
                    disabled={!!error}
                    title={error ?? undefined}
                    onClick={() => {
                      const r = businessAction(s, business.id, kind);
                      if (!r.error) setState(r.state);
                    }}
                  >
                    {kind === "buy"
                      ? `Buy · $${business.cost.toLocaleString()}`
                      : kind === "maintain"
                        ? "Maintain · $120"
                        : "Sell"}
                    {error && <small>{error}</small>}
                  </button>
                );
              },
            )}
          </div>
        </div>
      )}
      {l.links.street && (
        <div className="board-street">{renderStreet(l.zone)}</div>
      )}
      {people.length > 0 && (
        <div className="board-people">
          <h4>Around here</h4>
          <ul>
            {people.map((p) => (
              <li key={p.id}>
                <button onClick={() => openPerson(p.id)}>
                  <i
                    style={{
                      background: p.affiliation
                        ? THEMES[p.affiliation].accent
                        : "#A8ADB3",
                    }}
                    aria-hidden="true"
                  />
                  <strong>{p.name}</strong>
                  <small>
                    {p.known ? `Trust ${Math.round(p.trust)}` : "Not met yet"}
                  </small>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {l.links.politics && (
        <button className="text-button" onClick={() => showPolitics(l.zone)}>
          Read {z.name} politics →
        </button>
      )}
      {(l.status === "planned" ||
        (!actions.length &&
          !business &&
          !l.links.street &&
          !people.length &&
          !l.links.politics)) && (
        <p className="board-planned">
          <strong>Coming to Stixx City</strong>
          {l.planned ?? "Nothing to do here yet."}
        </p>
      )}
      {!st?.live && l.status === "live" && (
        <p className="muted">Nothing needs you here right now.</p>
      )}
    </section>
  );
}

export const PLACES_IN = (zone: ZoneId) =>
  LOCATIONS.filter((l) => l.zone === zone);

/** Every place in a district, live ones first: the list view of the board. */
export function DistrictPlaces({
  s,
  view,
  zone,
  setFocus,
}: {
  s: GameState;
  view: BoardView;
  zone: ZoneId;
  setFocus: (f: Focus) => void;
}) {
  const places = LOCATIONS.filter((l) => l.zone === zone).sort(
    (a, b) =>
      Number(view.places[b.id]?.live) - Number(view.places[a.id]?.live) ||
      (view.places[b.id]?.actions ?? 0) - (view.places[a.id]?.actions ?? 0),
  );
  const z = view.zones[zone];
  return (
    <section
      className="panel board-card board-district-places"
      aria-label={`Places in ${s.zones[zone].name}`}
      style={{ borderTopColor: z.controllerColor }}
    >
      <p className="eyebrow">{s.zones[zone].subtitle}</p>
      <h3>Places in {s.zones[zone].name}</h3>
      <ul className="board-place-list">
        {places.map((l) => {
          const st = view.places[l.id];
          return (
            <li key={l.id}>
              <button
                onClick={() => setFocus({ zone, block: null, place: l.id })}
              >
                <span aria-hidden="true">{KIND_ICON[l.kind]}</span>
                <strong>{l.name}</strong>
                <small>
                  {st?.owned
                    ? "Yours"
                    : st?.employed
                      ? "Your job"
                      : st?.live
                        ? st.actions
                          ? `${st.actions} move${st.actions > 1 ? "s" : ""}`
                          : KIND_LABEL[l.kind]
                        : "Coming soon"}
                </small>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
