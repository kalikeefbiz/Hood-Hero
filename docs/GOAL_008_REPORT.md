# GOAL 008 — Living danger and conflict

BlackHouse · Hood Hero Lab · feature branch `feat/goal-008-living-danger`

This is an isolated gameplay vertical slice on the Lab strategy board. No production repository, renderer, camera, deployment configuration, or main branch was changed. The Lab deployment workflow runs only on `main`; publishing this feature branch does not deploy it.

## Playable behavior

The board's **Go here** and action tiles now participate in street life. An accepted arrival, activity, or day spent outside can produce an encounter with an existing named character. Most ordinary exposures produce nothing. Ordinary approaches have work, acquaintance, family, actual recent street transactions, or actual overdue supplier balances behind them. Personal history takes precedence; recognized direct faction enemies have a separate war motive.

The existing portrait conversation interface offers listening, respectful explanation, acknowledgment, departure, and disrespect. Affiliated players can explicitly disclose their set. Closing a street conversation means walking away, rather than shelving the encounter to bypass it. A respectful first conversation can create a connection without creating a conflict. Disrespect can leave an unresolved grievance even if the NPC walks away. Serious ongoing history can affect another encounter later; no retaliation due date exists.

The original directed faction enemy/alliance lists are preserved, including the Blips–Mudgang war. War can produce immediate assault or shooting without a conversation or personal grievance, **when that particular NPC has evidence of the player's membership**. A known face alone is insufficient. Sponsorship informs the sponsor; direct disclosure informs the listener; personal associates can pass information they actually have. A player can also talk through a recognized war encounter peacefully; that does not settle the organizations' war.

NPC risk-taking, lawfulness, loyalty, authority, trust, seriousness, private intentions, and police presence influence decisions. Outcomes include peaceful connection, departure, warnings, reconciliation, unresolved history, assault, shooting, hospital recovery, police intervention, and death. An argument alone cannot authorize a shooting or targeted fatality. Serious accumulated history can become lethal through private reconsideration; it need not follow a sequence of threats and fights.

## State and ownership

`GameState.danger` is fully serialized and validated by `DangerState.ts`:

| Record | Purpose |
| --- | --- |
| `rng` | Saved deterministic danger stream, seeded from the run seed; does not consume the existing economy/story RNG stream. |
| `exposure` | Current day, accepted exposure keys, last exceptional-fatality check day. |
| `recognition` | Observer, subject, evidence event, source, last reported place/day, separately known affiliation. |
| `conflicts` | Stable ID, two origin participants, cause/event, seriousness, lethal context, unresolved/worsening/cooling/settled state, intention, associates, personal/circle scope, dated outcome history. |
| `scenes` | Concrete NPC, place/day, motive, source context, optional conflict, observed response/outcome. Linked to an existing `EncounterInstance`. |
| `injuries` | Injury/event, admission/discharge dates, treatment bill, amount paid, discharge history. |

`Danger.ts` owns exposure, recognition, resolution, reconsideration and treatment. It mutates only owned snapshots, like the existing internal systems. `performAction`, `moveTo`, `advanceDay`, `respondEncounter` and recovery return new state. Existing `record`, `remember`, `change`, `connect`, `expense`, `arrest`, ending evaluation, and encounter lifecycle supply the underlying behavior.

A dispute changes the actual participants' relationships and memories. Involvement can extend to an individually selected trusted associate who knows the other party; associates can subsequently approach about that history. It never assigns personal hostility to a whole faction or copies an ally's enemies. A bounded daily NPC-only conflict process uses co-resident known rivals or existing grievances. Its private records can be reconsidered independently of the player.

Intent changes and one-sided associate discussions are visible only to their actual participants. They do not notify the player or enter their memories. The renderer's `BoardView` contains none of these intentions or probabilities. The dialogue and visible journal communicate observed facts; existing public turf-risk readings remain coarse.

## Board contract and exposure

- `moveTo` performs one built-in arrival exposure after recording physical presence and before optional `onArrival` extension hooks. Hook consumers do not need to change.
- `performActionAt` validates, moves, then revalidates and performs the intended action. A conversation, injury, or death on arrival interrupts the action before it spends AP or money. The UI retains that arrival state even when the intended action cannot proceed.
- Accepted `ActionEngine` activities expose the player's actual place. Explicit street-market transactions use the actual completed transaction's market and record the presence trail. Remote social interactions expose the player where they are standing, not at the recipient's distant location. Activity-triggered street conversations open City even when the action was taken from a ledger.
- `advanceDay` expires the previous day's open scene, privately processes conflicts, and provides a lingering exposure at the current place. Hospital days keep running existing NPC, faction, territory, market, incident, obligation and economic processing.
- Free travel gets at most **one arrival check per district per game day**. Activities use the pre-action AP position as a deduplication key. Lingering has one key per day. There are at most **four total exposure checks per day**. These are simulation budgets, not UI timers.
- Board selection, inspection, camera movement, appearance, opening a menu, serialization, and encounter presentation do not roll exposure. Returning to a district on the same day cannot reroll its arrival. An open street scene prevents movement/actions until answered or left.
- Home base is sheltered in this slice. The renderer remains unchanged; treatment is off-board and the token marks the last outdoor place while the recovery panel explains unavailability.

## Exceptional fatalities and terminal death

For players without active lethal personal or organizational conflict, the exceptional check is eligible only outdoors in a district with directly opposing resident factions or police presence at least 70. It cannot run at home, in custody, during treatment, while another street conversation is open, or after an ending. It has a persisted **maximum of one eligible check per game day**, independent of targeted-conflict resolution.

Its probability is exactly **0.001% (1 / 100,000)** over the uniform seeded uint32 draw. Rejection sampling discards the incomplete uint32 tail, then selects one of 100,000 equal integer buckets. It is not a frame, input, visit, or menu probability. Targeted shootings require recognized direct war or an explicitly lethal ongoing conflict; their resolution is a separate path.

Death immediately sets `dead`, zero AP and the existing `killed` ending, and prevents subsequent actions, travel and day advancement. The old abstract daily `rivalThreat` player-death roll has been removed; accumulated criminal exposure can still cause arrest under existing rules. NPC legacy rival-pressure processing remains.

**Manual saves are unchanged.** The Lab still uses `blackhouse.hoodhero-lab.v1` and its `.auto` slot. Automatic progress records death; Resume therefore resumes that terminal run. Manual Load prefers the manual checkpoint, so an earlier pre-death manual save can restore the living run. Saving manually after death overwrites that manual checkpoint as before. This is not an ironman or save-deletion system.

The format remains version 8 with an additive validated danger field. Previous version-8 Lab saves without that field receive empty danger records and a deterministic default danger seed. Old undocumented/future save versions remain rejected. Cross-reference checks reject missing participants, events, scenes, conflicts and invalid dates/duplicates.

## Hospitalization

Assault treatment takes two game days and costs $180; shooting treatment takes five days and costs $480. These are initial balance values. Admission spends available cash using the existing clean-first ledger and adds unpaid treatment to existing arrears. Status becomes `laying-low`, AP is zero, and normal actions, travel, supplier/crew/workplace conversation responses are unavailable until discharge. Stress rises; trusted active Set members retain memories and concern.

**Complete hospital recovery** advances each intervening day through the ordinary pipeline. The player can also advance days individually. Living expenses, supplier due dates, missed shifts and employment consequences, crew commitments, NPC behavior, markets and faction activity continue. Discharge restores normal availability and eases stress. Recovery never erases obligations, conflict history or treatment records. Existing arrears repayment and retirement debt accounting include unpaid treatment.

## Validation

See `docs/validation/GOAL_008_RESULTS.md` for final commands and outcomes. The new unit suite covers peaceful civilian life, identity and membership evidence, remembered personal beef and later reconciliation, immediate war violence, nonlethal-only disputes, bounded associate involvement, hidden reconsideration, independent NPC conflict, exact exceptional probability and eligibility, input deduplication, hospital expenses/time/relationships/missed shifts, terminal death, arrival interruption and save/load determinism. Existing economy playthroughs explicitly answer incidental street conversations before continuing their operations.

Browser scenarios use seeded simulation states, not UI-specific outcome flags. They exercise an encounter triggered through the actual board's Go here control, multiple responses and persisted personal history, menu/reload stability, a direct war shooting with treatment and a living city, and terminal death followed by a real manual checkpoint load. Existing board regressions cover location/trail, action economy, looks, lenses, contacts, ledger and save-key isolation.

## Deliberate limits and next integration steps

1. **Population and whereabouts:** NPC presence is home-district/faction-anchor based. Pursuit away from home requires a recent exact-location sighting held by that character; there is no omniscient tracking or full street routing. Claude can later supply NPC occupancy/schedule data without changing the encounter UI or conflict records.
2. **Information:** membership spreading is deliberately narrow. There is no citywide rumor network, undercover deception, witness credibility scoring, or generic public-notoriety membership inference. `witnessIdentity` is the extension point for future witnessed faction activities.
3. **Scope:** a small circle can become involved, but personal disputes do not yet formally become organization-wide policies. Organizational war comes from the existing direct enemy lists. Add an explicit leadership authorization process before broadening personal conflicts.
4. **Content:** six contextual motive families establish the slice. Relative-specific allegations require actual family/customer data; they are not fabricated. Listening/explanation/acknowledgment currently share a respectful resolution family; authored dialogue and additional economic responses can deepen them.
5. **Independent NPC conflicts:** NPCs initiate and reconsider disputes and share information. There is no new autonomous NPC injury/death cascade, detailed chase, or combat simulation. Player knowledge of these developments is limited to becoming directly involved; a fuller rumor/listening system is future work.
6. **Other action APIs:** ActionEngine activities and board travel/day exposure are connected. Remote business/political management and supplier paperwork are not independently treated as outdoor exposures. Paid partnered crew street work remains subject to the exposure attached to its invoking player command; a generalized physical-activity API would make these boundaries more uniform.
7. **Balance and shelter:** encounter frequency, war response weights, treatment costs and sanctuary behavior need sustained playtesting. The exceptional unprovoked-fatality probability is a fixed requirement, not a balancing knob.
8. **Presentation and scale:** add a hospital location and token visualization with Claude; no rendering/environment changes were made here. Existing history and saves remain unbounded; compaction and large-population budgeting remain future work. Physical iPhone performance still needs device testing.
