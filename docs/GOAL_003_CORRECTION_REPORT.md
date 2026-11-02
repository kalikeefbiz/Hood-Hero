# GOAL 003 — correction pass

BlackHouse · Hood Hero · 1 November 2026 (Pacific)

This pass corrects the presentation and lifecycle issues from physical playtesting on the existing `goal-003-living-encounters` branch and PR #2. It supersedes the original report's inline encounter presentation, daily postponed-request reminder, and save-schema details. The simulation, finances, AP, success calculations, characters, and approved illustrations are retained.

## Conversations now conclude

`Modal.tsx` uses the browser's native modal dialog above City: backdrop dimming, background inertness, keyboard focus containment/restoration, Escape/backdrop dismissal, and body-scroll locking. `EncounterScene` has an independently scrollable, keyboard-accessible dialogue region and accessible response controls. Compact phone layouts keep the portrait beside the dialogue; larger surfaces expand the composition. All response controls remain inside the safe-area-aware dialog.

The initial scene supports successive exchanges: clarification changes the dialogue and concerned portrait to the approved confident/no-chain expression. Accepting, refusing, or postponing concludes the interaction and closes the modal automatically. A short result confirms the choice. A commitment and storyline can remain active without an active conversation.

Only City renders narrative modals. Actions, People, Set and Wallet retain their own interfaces. An action elsewhere can queue a reaction, but does not display it on that screen. Returning to City presents it. Ordinary contact with Mega does not automatically reopen his last failed or completed storyline.

## Lifecycle, queue and deduplication

- Encounter state remains in the existing simulation. There is at most one `active` encounter; simultaneous relevant instances stay `pending` in priority/FIFO order.
- Closing or postponing an unfinished scene sets `deferred`. Day advancement does not clear deferral. City offers an explicit resume control. No daily replay/reminder is scheduled for postponement.
- Promise acceptance and refusal mark their conversation acknowledged. The obligation and incident progress independently through their existing systems.
- Incident closure and its personal commitment consequence share a structured `presentationKey`. The event ledger keeps both factual records, but one representative notice/reaction presents the outcome. Acknowledgment covers that outcome's visible event family.
- Deadline/leadership notices that become obsolete when an incident closes expire from the active queue, while their dated history remains.
- Acknowledged/closed scenes do not reactivate during synchronization, reload, or ordinary contact. Historical replay is an explicit, read-only view; it does not put the old scene back in the simulation queue, rerun actions, or award relationship changes.
- Memories, trust, respect, grievance, contributions, incident custody and commitment outcomes persist after the modal closes. Automated simulation and browser sequences each advance **40 more days** after both fulfillment and failure, verifying no renewed Chains interruption.

## Immediate action results and day changes

`resolveAction` returns its own recorded result event through `performAction`. The interface displays that event in a five-second, viewport-fixed result toast above the dock as well as the normal feedback area. It remains visible when the action card was far down the page, and a later routine Set-capacity/progression update cannot hide the action's actual result. This fixes a real regression found during testing: a successful buyback could previously report only “Your influence supports a Set of 2.”

End Day retains the existing simulation advancement and costs, then returns to City, resets scroll, restores AP normally, and briefly shows the new day without a confirmation screen. Only genuine new world events create new encounters. Starting/resuming a run also resets scroll before opening a modal, preventing its scroll lock from restoring an old menu position.

## Activity hierarchy

`ActivityFeed.tsx` preserves reverse chronological event/day order. Severity controls prominence rather than reordering old major events above newer developments. Critical events, including the significant broken-promise consequence, receive a strong severity treatment; major events have a separate frame and label.

Faction operations carry an explicit, validated `factionId`; no name parsing or filename inference is used. The established theme registry supplies Angels yellow/white, Back Street red, Block Boys blue, Blips purple, and Mudgang orange/brown. Routine daily faction operations collapse into a concise day summary with all individual reports available inside it. The first observed transition into the existing internal-tensions condition is marked major; continuing maintenance is routine. This changes event classification, not faction calculations.

All feed, notice, queue, and history selectors preserve `observedBy`. Private events remain private. The feed retains both factual incident and interpersonal records even when their foreground presentation is consolidated.

## Persistence and deployment identity

Disposable development saves use schema **3**, with no migration. An incompatible save receives a clear new-run recovery message. New saves retain queue/deferred/acknowledgment state, meaningful choices, presentation grouping, faction metadata and the existing full simulation/RNG state. Resume uses the latest autosave; Load retains manual-checkpoint behavior.

The build writes `build-info.json` containing the actual checked-out commit and save schema. Live verification compares this commit to the intended deployment, then plays the actual public application through both Chromium and WebKit. `scripts/verify-live.mjs` checks the modal, clarification, automatic closure, action feedback, End Day → City, save/resume without reopening, a real buyback, correct returned-chain art, acknowledgment, and another reload. It also checks for asset errors and uncaught page errors.

## Verification

- Unit and simulation tests: **69 passed** across four files.
- Full root browser suite: **64 passed** — 32 Chromium and 32 WebKit, including both 40-day continuation paths on each engine.
- Production `/Hood-Hero/` browser suite: **34 passed** — 17 Chromium and 17 WebKit.
- Final viewport-feedback adjustment: **28 additional browser checks passed** — 14 per engine under `/Hood-Hero/`, including scrolled-card result visibility, mobile regressions, and both 40-day paths.
- TypeScript/Vite build, formatting checks, and `git diff --check`: passed.
- [GitHub CI for the exact deployed implementation](https://github.com/kalikeefbiz/Hood-Hero/actions/runs/41378065840): **passed**, including the full root and production-path browser suites after the visible-feedback adjustment.

[Recorded root browser output](validation/GOAL_003_CORRECTION_ROOT.txt) · [Production-base browser output](validation/GOAL_003_CORRECTION_PAGES.txt) · [Final viewport-feedback checks](validation/GOAL_003_CORRECTION_FEEDBACK.txt). Required browser checks cover the opening modal, blocked background clicks, focus containment, clarification/portrait change, acceptance, refusal, postponement, dismissal, queue sequencing, history without effects, City-only routing, action feedback, day transitions, 40-day non-repetition, chronological severity/faction rendering, all starting homes/affiliation themes, and 320/375/390/430px layouts with axe accessibility checks.

The broader existing browser suite explicitly dismisses the opening scene before testing ordinary gameplay. Its day-loop tests now navigate from City back to the intended destination, reflecting the corrected End Day behavior. Existing simulation/economy/relationship/progression tests remain intact, apart from expected schema-version assertions.

Local WebKit uses the managed environment's previously installed browser dependencies; host-library validation is bypassed only because those libraries reside in the browser bundle rather than the OS ldconfig cache. Browser/application tests themselves run normally. This remains browser emulation, not a claim of physical iPhone testing.

## Actual application captures

- [Foreground modal over City](screenshots/goal-003-correction/01-modal-over-city.png)
- [Sequential clarification and changed expression](screenshots/goal-003-correction/02-contextual-exchange.png)
- [Concluded conversation and unobstructed City with persistent promise](screenshots/goal-003-correction/03-conversation-concluded-city.png)
- [Actions feedback with no narrative scene](screenshots/goal-003-correction/04-actions-feedback-no-scene.png)
- [One fulfilled-outcome modal with returned-chain art](screenshots/goal-003-correction/05-single-fulfilled-outcome.png)
- [One broken-promise reaction](screenshots/goal-003-correction/06-broken-promise-once.png)
- [Playable City after the consequence and 40 more days](screenshots/goal-003-correction/07-city-after-consequences.png)
- [Chronological faction/severity feed with expanded routine details](screenshots/goal-003-correction/08-chronological-faction-activity.png)

The activity screenshot is a running application capture of a deterministic presentation fixture containing observed critical/major/personal events and real daily faction operations. It is not additional authored game content.

## Scope and limits

No new jobs, storylines, character likenesses, faction systems, combat, or gameplay balancing were added. No save migration is provided for disposable Test saves. Native dialog support requires modern Safari (15.4+) or another current browser. Physical iPhone Safari confirmation remains with the creator.

Publication uses the repository's existing public GitHub Pages playtest infrastructure, serving the unmerged feature branch. The live URL, deployment run, exact deployed commit, and live browser verification are recorded below. Main gameplay code is not merged as part of this pass.


## Verified public deployment

- **Play:** https://kalikeefbiz.github.io/Hood-Hero/
- **Deployed implementation commit:** `147ef9c750ba6294848f9360db3c07c61f522ad6`.
- **Deployment:** [existing playtest workflow, successful attempt 3](https://github.com/kalikeefbiz/Hood-Hero/actions/runs/41362061215/attempts/3). That workflow runs from its previously approved main configuration and checks out `goal-003-living-encounters`; no new main commit, workflow permission, environment rule, or merge was needed.
- **Fingerprint:** [public build metadata](https://kalikeefbiz.github.io/Hood-Hero/build-info.json) returned the exact implementation commit and schema 3.
- **Live gameplay verification:** Chromium and WebKit both passed the complete public-site check: opening modal/art, clarification, accepted promise auto-close, gig feedback, End Day returning to City, reload without reopening, actual gameplay buyback, returned-chain portrait, acknowledgment, and another reload remaining closed. Neither engine reported asset failures or uncaught page errors.
- **Evidence:** [machine-readable live verification](validation/GOAL_003_CORRECTION_LIVE.json), [live Chromium modal](screenshots/goal-003-correction/live-chromium-modal.png), [live Chromium City](screenshots/goal-003-correction/live-chromium-city.png), [live WebKit modal](screenshots/goal-003-correction/live-webkit-modal.png), [live WebKit City](screenshots/goal-003-correction/live-webkit-city.png).

Live checks completed at 7:04 PM Pacific on 1 November 2026. The follow-up evidence commit adds this deployment record and live captures only; runtime code remains the deployed implementation commit above. The public URL is the existing shared playtest site serving the unmerged feature build, not a separate production merge.

Current Test saves from schema 2 require a new test run. Physical iPhone Safari validation remains with the creator; all browser results above are real automated browser executions, not physical-device claims.
