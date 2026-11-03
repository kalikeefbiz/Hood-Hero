import { copy } from "../content/copy";
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
          {copy("interface.newRun.blackhouse")}
          <small>{copy("interface.newRun.presents")}</small>
        </span>
        <span className="edition">
          {copy("interface.newRun.aLIFEINSTIXXCITY")}
        </span>
      </header>
      <main className="newgame" id="main-content">
        <section className="intro">
          <div className="intro-copy">
            <p className="eyebrow">
              {copy("interface.newRun.fiveNEIGHBORHOODSYOURSTORY")}
            </p>
            <h1>
              {copy("interface.newRun.hood")}
              <br />
              {copy("interface.newRun.hero")}
              <span>{copy("interface.newRun.stixxCITY")}</span>
            </h1>
            <p className="lede">
              {copy("interface.newRun.aLittleBreadAFewRealOnes")}
            </p>
            <p className="caption">
              {copy("interface.newRun.aPERSISTENTSTREETLIFESIMULATION")}
            </p>
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
            <p className="eyebrow">
              {copy("interface.newRun.newRUNSTIXXCITY")}
            </p>
          </div>
          <h2>{copy("interface.newRun.pickYourBlock")}</h2>
          <p className="creation-lede">
            {copy("interface.newRun.whereYouStartShapesYourStory")}
          </p>
          <fieldset>
            <legend>
              {copy("interface.newRun.chooseYourHome")}
              <span>{copy("interface.newRun.everyHomeStartsIndependent")}</span>
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
            <label htmlFor="player-name">
              {copy("interface.newRun.whatDoPeopleCallYou")}
            </label>
            <input
              id="player-name"
              maxLength={28}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={copy("interface.newRun.yourNameOrResident")}
              autoComplete="off"
            />
          </div>
          <div className="starting-kit">
            <span>
              <strong>
                {copy("interface.newRun.text")}
                {BALANCE.startingCash}
              </strong>
              {copy("interface.newRun.cleanCash")}
            </span>
            <span>
              <strong>
                {BALANCE.dailyAP}
                {copy("interface.newRun.ap")}
              </strong>
              {copy("interface.newRun.eachDay")}
            </span>
            <span>
              <strong>{copy("interface.newRun.flacco")}</strong>
              {copy("interface.newRun.inYourSet")}
            </span>
          </div>
          <button className="primary" type="submit">
            {copy("interface.newRun.enterStixxCity")}
            <Icon name="arrow" />
          </button>
          {hasSave && (
            <button type="button" className="secondary" onClick={load}>
              {copy("interface.newRun.resumeSavedGame")}
              <Icon name="arrow" />
            </button>
          )}
          {feedback}
        </form>
      </main>
      <footer className="landing-footer">
        {copy("interface.newRun.blackhouseHOODHERO")}
        <span>{copy("interface.newRun.aFICTIONALSTRATEGYGAME")}</span>
      </footer>
    </div>
  );
}
