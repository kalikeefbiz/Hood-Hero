import type { ReactNode } from "react";
import type { ZoneId } from "../core/GameState";
import { ZONES } from "../content/city";
import { BALANCE } from "../content/balance";
import { Scene } from "./Scene";
import { NEIGHBORHOODS } from "./neighborhoods";
import { themeStyle } from "./theme";
import { Icon } from "./Icon";
export function NewRun({
  name,
  home,
  setName,
  setHome,
  start,
  load,
  hasSave,
  feedback,
}: {
  name: string;
  home: ZoneId;
  setName: (name: string) => void;
  setHome: (home: ZoneId) => void;
  start: () => void;
  load: () => void;
  hasSave: boolean;
  feedback: ReactNode;
}) {
  return (
    <div className="landing" style={themeStyle(null)} data-theme="independent">
      <div className="new-run-backdrop" aria-hidden="true">
        <Scene key={home} zone={home} eager />
      </div>
      <header className="brand">
        <span>
          BLACKHOUSE <small>PRESENTS</small>
        </span>
        <span className="edition">A LIFE IN STIXX CITY</span>
      </header>
      <main className="newgame" id="main-content">
        <section className="intro">
          <div className="intro-copy">
            <p className="eyebrow">FIVE NEIGHBORHOODS. YOUR STORY.</p>
            <h1>
              HOOD <br />
              HERO<span>STIXX CITY</span>
            </h1>
            <p className="lede">
              A little bread. A few real ones. What you do next is on you.
            </p>
            <p className="caption">A PERSISTENT STREET-LIFE SIMULATION</p>
          </div>
        </section>
        <form
          className="creation"
          onSubmit={(e) => {
            e.preventDefault();
            start();
          }}
        >
          <div className="chapter">
            <p className="eyebrow">NEW RUN / STIXX CITY</p>
          </div>
          <h2>Pick your block.</h2>
          <p className="creation-lede">Where you start shapes your story.</p>
          <fieldset>
            <legend>
              Choose your home <span>Every home starts independent.</span>
            </legend>
            <div className="zone-choices">
              {Object.values(ZONES).map((z, i) => (
                <label key={z.id} className={home === z.id ? "chosen" : ""}>
                  <input
                    type="radio"
                    name="home"
                    value={z.id}
                    checked={home === z.id}
                    onChange={() => setHome(z.id)}
                  />
                  <Scene zone={z.id} eager={i < 2} />
                  <span className="zone-choice-copy">
                    <strong>{z.name}</strong>
                    <small>{NEIGHBORHOODS[z.id].flavor}</small>
                  </span>
                  <span className="radio-dot" aria-hidden="true">
                    {home === z.id ? "✓" : ""}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="name-entry">
            <label htmlFor="player-name">What do people call you?</label>
            <input
              id="player-name"
              maxLength={28}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name (or Resident)"
              autoComplete="off"
            />
          </div>
          <div className="starting-kit">
            <span>
              <strong>${BALANCE.startingCash}</strong> clean cash
            </span>
            <span>
              <strong>{BALANCE.dailyAP} AP</strong> each day
            </span>
            <span>
              <strong>Flacco</strong> in your Set
            </span>
          </div>
          <button className="primary" type="submit">
            Enter Stixx City <Icon name="arrow" />
          </button>
          {hasSave && (
            <button type="button" className="secondary" onClick={load}>
              Resume saved game <Icon name="arrow" />
            </button>
          )}
          {feedback}
        </form>
      </main>
      <footer className="landing-footer">
        BLACKHOUSE / HOOD HERO <span>A FICTIONAL STRATEGY GAME</span>
      </footer>
    </div>
  );
}
