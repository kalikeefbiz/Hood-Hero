# Syndicate M1 systems

## Ownership and boundaries

`GameState` is the complete serializable world. Stable string IDs connect characters, relationships, properties, commitments and events. Simulation entry points return a new snapshot. React never changes cash, AP, trust, incidents or progression directly.

| Layer                           | Responsibility                                                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `core/GameState.ts`             | Entity and save contracts; distinct reputation fields                                                                     |
| `core/Simulation.ts`            | Canonical world initialization, home selection, seeded state                                                              |
| `core/ActionEngine.ts`          | Action catalog, eligibility, costs, shared resolution, transactional player API                                           |
| `core/TimeSystem.ts`            | Day processing pipeline, expenses and AP restoration                                                                      |
| `core/Random.ts`, `EventLog.ts` | Serializable deterministic PRNG; observable event records                                                                 |
| `systems/`                      | Relationships, economy, crew commitments, NPC decisions, faction behavior, incidents, pressure, progression and endings   |
| `content/`                      | Canonical zones, five gangs, characters, ordinary resident templates, incident configuration, items and balance constants |
| `persistence/SaveSystem.ts`     | Version 1 envelope, Zod validation, reference checks, manual and automatic slots                                          |
| `ui/`                           | Portrait-first React presentation and schematic city map                                                                  |

Neighborhoods and ordinary characters are defined by deterministic templates. All homes retain exactly the same canonical incident participants. All characters share one model; affiliation and traits distinguish members, civilians and the player. Loco remains incarcerated and influential; Justice’s legitimacy and Back Street’s instability are explicit data. Factions with no supplied leader use ordinary membership contacts without inventing additional major leaders.

## Actions and time

`performAction(state, action)` validates before cloning and resolving. Invalid actions leave the state, RNG and AP untouched. `resolveAction` is the internal mutating primitive used on owned snapshots by both the player and NPC AI after validation.

An action carries actor, optional character target, optional incident ID and optional item ID. The centrally typed catalog specifies AP, description, risk and outcomes. Validation supplies cash, status, known-contact, skill-context, standing, trust, availability, capacity and incident requirements. Skills, stress, escalation and crew ties modify uncertain outcomes. There are no arbitrary client-supplied money amounts or success flags.

| Family     | Executable M1 actions                                                                              |
| ---------- | -------------------------------------------------------------------------------------------------- |
| Social     | Contact, inquire, introduce, spend time together                                                   |
| Diplomatic | Negotiate a property demand, request trusted support, discuss leadership settlement, offer support |
| Economic   | Full shift, local gig, personal purchase, fixed money transfer                                     |
| Crew       | Recruit, remove, reserve a member for a paid nonviolent errand                                     |
| Political  | Build standing through a member, request sponsored affiliation                                     |
| Risky      | Abstract property recovery and small black-market opportunity                                      |
| Relief     | Rest without buying a consumable                                                                   |

Inspection is free. Most actions cost 1 AP; shifts and recovery cost 2. The daily allowance is 2. A 2-AP action cannot follow a 1-AP action on the same day. End Day can be used with AP remaining and without engaging the incident.

NPC `lastActionDay` limits daily action use independently of player AP. `availableDay` reserves time for commitments; it does not mark every autonomously acting NPC perpetually unavailable. Contacts are asynchronous across neighborhoods. Travel and detailed hourly schedules are deferred.

Day advancement:

1. Increment the calendar and resolve due commitments.
2. Choose and resolve one eligible action per available active NPC using shared rules.
3. Process each established organization’s resource and influence decision.
4. Advance active property disputes and leadership responses.
5. Evaluate police and rival risks, then ease pressure and stress.
6. Credit qualifying recurring lawful income and charge basic living costs.
7. Expand Set capacity if earned, evaluate permanent end conditions, restore 2 AP and log the new day.

No maximum day, mandatory incident completion, energy meter or consumable gate exists.

## Relationships, memories and information

Relationships are directed records of trust, respect, affection, grievance and event history. Family, childhood cooperation, shared home, common affiliation and direct organizational rivalry initialize them contextually. Shared robbery participation adds trust and memories according to each participant’s personality. It does not script complete friendships.

Social interactions create different actor and target memories. Dispute resolutions generate victim and participant interpretations. Every memory references a stable event. Removed crew members retain their character, memories and social history. `known` IDs control contact access; inquiries and introductions reveal existing people rather than spawning arbitrary story characters.

Events record actors and observers. UI activity filters by player visibility; public organization updates represent observable city activity. Private NPC earnings and interactions remain hidden unless the player is involved. M1 information is a coarse known-contact list and incident flags, not a detailed rumor or deception model.

## Independent standing and pressure

Characters separately track wallet provenance, stress, notoriety, police attention, neighborhood standing, organization standing, influence, legitimacy, affiliation and rival pressure. Directed personal respect remains separate. UI bands explain these values.

Lawfully inclined NPCs value demonstrated legitimacy in social interactions. Justice has high lawful values and legitimacy, while his organization begins internally unstable. Improving legitimacy never automatically destroys street standing. Alliances influence faction support but never copy one organization’s hostility into another’s personal or organizational standing.

Risky actions accumulate police and rival exposure. Police above 65 or rival threat above 70 can produce arrest or death during daily processing, with seeded probabilities that rise with exposure. Quiet days reduce attention by 4 and rival threat by 2. Campaign age does not contribute to defeat risk. NPCs and crew members use the same status and risk rules.

## Economy

Balance values are in `content/balance.ts`; item prices and relief are in `content/economy.ts`.

- Starting cash: $125, clean. Full shift: $96, 2 AP. Gig: $38, 1 AP.
- Abstract illicit opportunity: $72 on success; up to $20 lost on failure, plus exposure. Trusted street contacts or local standing gate access, making Downtown criminal progression initially harder.
- Living expenses: $18/day. If cash is short, available funds are spent and stress rises. No implicit debt or action lock is introduced.
- Fixed support/transfer amounts are $20/$25. Spending consumes clean funds first, then illicit funds. Transfers preserve the source proportions in the receiver’s wallet.
- Items: necessities $16, smokes $12, booze $18, pocket music player $65, clothing $48. Relief varies by item; music and clothing are persistent, once-owned purchases. Rest costs 1 AP and no cash.
- Stress modestly affects relationship gains and risky outcomes. It never blocks work or day advancement.
- A crew errand pays $24 clean to the player and $12 to the member. It costs 1 player AP, reserves the member and resolves next day. Status or broken trust can cause failure. Completed work develops the member’s work skill.

Wallets, property ownership and an `Asset` contract retain provenance. The ledger tracks player earnings and expenditures. Group buyback payments go to organizational resources without assigning an unsupported individual holder. Asset acquisition and businesses are M2 work.

## Personal Set and affiliation

Flacco begins as a regular NPC in a capacity-one Set. Capacity thresholds in personal influence are 0, 5, 15, 30 and 50; the maximum is five. Influence can come from lawful work, social contact, local connection-building and helping resolve disputes.

Recruitment requires an active, available known person, open capacity, at least 42 directed trust, sufficient loyalty and no direct conflict with the player’s affiliation. Civilians are eligible. Removing a member costs 1 AP, reduces their trust by 18, adds grievance and preserves identity/history. Inactive members can be removed too.

Available trusted members provide modest recovery support. Conflicting personal grievances or direct faction rivalries reduce cooperation. Loyal members do not assist recovery against their own organization. Home neighborhood itself never penalizes cooperation.

A sponsorship request requires 35 organization standing and 35 trust from a member. Acceptance sets affiliation to one of the existing five organizations and entry authority to 10. It does not confer control, create a gang, or absorb the Set. Rank advancement and switching affiliations are not exposed in M1.

## Autonomous decisions

NPC utility scores consider financial need, income/status/loyalty goals, traits, skill, stress, exposure, relationships, recent significant memories, contact influence and current obligations. They choose eligible lawful gigs, rest, social cooperation or abstract illicit income. A seeded jitter breaks close utility scores. No language model or external service participates.

All five organizations process lightweight priorities: reinforce ties, finance trade, defend a contested foothold or spend resources stabilizing internal loyalty. Decisions use resources, local commerce, support, influence, direct enemies, allies and instability. Incident news changes relevant organizational instability. Alliances do not transitively assign enemies. Incarcerated leaders retain 35% of their organizing influence in neighborhood reinforcement and loyalty stabilization; active leaders handle dispute interventions. Detailed prison communications and strategic territorial warfare are deferred.

The small M1 cast is simulated uniformly rather than using zone-based activation/hibernation. This is bounded, deterministic and gives the player’s circle and incident participants full character processing while other zones receive lightweight faction updates. Larger populations will need attention budgeting.

## The Chains: property-dispute instance

The opening communication immediately enters normal play. Mega is the owner and victim. Dizzy, Baby Canon and Joker are the participants; the robbery was unauthorized. Property custody is initially `{ kind: 'group', id: 'the-chains' }`, never an invented permanent individual holder.

A dispute stores owner/property references, participants, responsible organization, demand, negotiation state, escalation, information and leadership flags, deadline and resolution. Recovery, payment, leadership settlement and resale use shared dispute resolution functions and update property, relationships, influence and memories.

- Initial demand $150; minimum configured demand $95.
- Contacting Mega or inquiring about the situation unlocks informed approaches.
- One negotiation attempt may lower demand by $30, using social skill, stress and seeded chance.
- Trusted help supports a peaceful appeal. Informing Pablo gives active leadership a chance to intervene after 3 days, or earlier with requested help. Loyalty drives the intervention rule.
- An uninformed leadership allows tension to rise. The group raises its demand by $15 on age 3. Word reaches Pablo at age 5.
- If still active at age 8, the group sells the chains and the incident becomes abandoned; possession moves to an abstract resale market. Ownership remains Mega’s.
- Recovery consumes a full day’s AP. It may return the property or fail and increase escalation. Both outcomes retain police exposure, notoriety, stress and rival pressure.

Settlement may occur without the player; resale is another autonomous outcome. The deadline is specific to the dispute, not a campaign timer. Resolved/abandoned disputes stay in history and never gate ordinary actions. M1 has one authored dispute instance; the reusable data contract and resolver are ready for subsequent content, but no procedural incident generator is claimed.

## End-condition contracts

`evaluateEnd` is pure and configuration-driven. Tests construct late-game worlds; no fixed-day victory exists.

- **Legitimate Exit:** at least $100,000 qualifying clean cash/assets, at least $24/day recurring lawful income, no positive illicit income in the last 30 days, no illicit wallet balance, and formal retirement. Past crime does not permanently disqualify an eventual lawful exit.
- **Underlord:** affiliation in an established gang, authority at least 70, that gang controlling at least four zones, and a designated active, affiliated, trusted Set successor. Independent players and unaffiliated personal Sets cannot qualify.
- **Defeat:** player arrested or dead. These take precedence over victory.

The `Asset`, controller, authority, retirement and successor fields are real save contracts. Acquiring late-game assets, earning authority, changing territory, formally retiring and designating successors have no M1 UI. Victory evaluation is implemented and tested; the complete victory journeys are intentionally deferred.

## Persistence and determinism

Save format version 1 includes RNG state, ID counter, all entities, private and observed events, memories, pending commitments/incidents, ledger and progression. Zod checks the shape and money bounds; cross-reference checks reject missing key entities. Unknown versions and damaged saves produce readable errors without replacing current state. No migration from hypothetical future formats is attempted.

The PRNG advances only in simulation decisions/outcomes. UI reads and storage do not consume randomness. Identical initial seeds and action sequences reproduce equal worlds, including after save/load. Canonical seeds are passed to `newGame`; the UI uses the default seed for reproducible first-playable balancing.

History is not compacted in M1. There is no fixed campaign cap, but sufficiently long saves may reach browser quota and snapshot cloning costs increase. Storage warnings are explicit. An IndexedDB/history-compaction migration is a next engineering priority.
