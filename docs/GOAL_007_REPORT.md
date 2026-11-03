# GOAL 007 — Power, territory and a life of your own

Studio: BlackHouse. Development branch: `goal-007-power-territory`.

## Production baseline

PR #5 was merged into main at `15a2e426f98f170adc923852fa4988a1e5023a7e`, preserving required commit `2f4d3cbe4fc18ea48891676bdcddc71c743dfcf5`. Implementation started from that integrated baseline. Baseline Vitest: 137 passed; production build passed. Browser baseline and final results are recorded below and in `docs/validation/GOAL_007_*`.

GOAL 007 gameplay remains on its development branch for creator review. The Pages preview uses the established default-branch-triggered workflow to build an unmerged development commit; deploying the preview does not merge the gameplay into main.

## Implemented strategic systems

`GameState.strategic` stores per-neighborhood footholds, authoritative control, consolidation counters, control history, faction strategies, contribution records, membership timing, business operations, criminal recency, sustained lawful income and a persistent ending record. Schema 8 deliberately rejects disposable older saves. No migration or separate simulation engine was introduced.

Presence, territorial influence, economic presence, civilian support and territorial pressure are separate bounded values for every faction in every neighborhood. The public neighborhood `controller` and organizational lists, plus existing faction influence fields, are synchronized compatibility projections. Only the daily territory resolver writes recognized control; map components never calculate ownership.

Canon is retained: Downtown starts without a controller; Angels hold Rio Gabriel; Back Street holds Southside; Block Boys hold The Resevoir; Blips and Mudgang have simultaneous substantial presence in a contested, uncontrolled Nawf. All five organizations remain active entities regardless of how much territory they hold. Loco remains indefinitely incarcerated, Pablo retains day-to-day Angels authority, and Justice remains Back Street leadership.

### Territory and control model

Balance constants live in `src/content/strategy.ts`.

- Dominance score: 42% territorial influence, 20% presence, 18% economy, 20% civilian support, bounded resource backing, minus instability and opposing pressure.
- Recognition requires score **57**, advantage **12**, presence **40**, support **25**, and **7 consecutive daily resolutions** meeting those requirements.
- Repeated resolution within a day cannot advance stabilization.
- Established control persists through ordinary fluctuations. Score below **39**, support below **18**, resources below **20**, or instability above **85** creates weakness; **10 consecutive weak days** remove recognition.
- A stronger challenger can replace an incumbent after its own consolidation. A disrupted incumbent can recover before the loss period finishes. Strength and pressure decay; nonhome networks decay faster. Holdings beyond two impose added upkeep and local erosion.
- Underlord counts authoritative, nonweak holdings that have also remained recognized for at least seven days. Cosmetic map labels and market presence cannot qualify.

Control changes produce major attributed city events and persistent history. Routine influence effects remain routine events. Severe internal recovery can produce a separately titled leadership-conflict notice, limited to one per faction per twenty days.

Control affects rival market access (a rival member needs 25 local standing), local competition risk, organizational income/upkeep and economic disruption. Contested neighborhoods hurt business demand and condition. Clean businesses improve lawful economic activity and personal standing, without assigning faction territory.

### Autonomous faction decisions

`advanceFactions` extends the existing daily simulation. Each faction evaluates affordable, condition-driven choices:

| Decision | Inputs                                                                             | Consequence                                                                |
| -------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Maintain | Home/held position, declining dominance, rival pressure                            | Defense, continued presence and local relationships; resource cost         |
| Expand   | Commercial demand, policing, current foothold, holdings, alliance, agreed priority | Resource investment in presence and community ties                         |
| Contest  | Existing presence, actual rivalry, ambition, overstretch                           | Territorial pressure and economic disruption of a competing position       |
| Recover  | Depleted resources or internal instability                                         | Rebuild resources and loyalty; eligible allies may transfer real resources |
| Economy  | Existing interests, economic deficit, commercial personality, resource need        | Economic presence and bounded operating return                             |

Decisions have four/five-day cooldowns and meaningful costs. Daily upkeep, overextension and a **$1,600** organizational resource ceiling prevent endless accumulation. Recovery remains available at zero resources. Block Boys favor commerce, Back Street has recurring generational tension, Angels retain active and incarcerated leadership backing, and Blips/Mudgang prioritize their competition. Allies penalize expansion against one another and can provide limited resource assistance. Enemy lists are preserved independently; alliance does not propagate every enemy.

### Player influence and authority

Existing employment, gigs, relationship support, neighborhood connections, successful relevant commitments, completed crew activities and inventory-backed commerce feed the shared influence interface. Low-level sales produce small economic effects, not territorial victories. Organizational contributions retain separate credit for advancement.

City neighborhood details provide six reusable interactions: community support ($25), local organizational support ($40), neighborhood operation ($100), rival challenge ($80), cooperation ($30), and a proposed strategic priority ($60). Each costs one AP. Investments share a three-day cooldown. Organizational actions require membership and an actually connected, willing representative with 35 trust; early ranks work through a local contact. Challenges require existing rival presence. Cooperation repairs instability and reduces pressure. Priorities last twenty days and influence the organization's utility scores, without granting total command.

Unaffiliated players can build community ties and pursue work/businesses. Territorial control always belongs to an established faction. Existing affiliation validation still requires sponsor trust, organizational standing and actual contact access. Knowing a leader's identity does not grant a phone number.

| Authority | Stage              | Additional requirements                                                               | Permissions                               |
| --------- | ------------------ | ------------------------------------------------------------------------------------- | ----------------------------------------- |
| 10        | Member             | Existing sponsorship                                                                  | Local support and community work          |
| 25        | Contributor        | 50 standing, $100 credited contributions, 10 membership days, 40 sponsor/leader trust | Operations and cooperation                |
| 45        | Organizer          | 65 standing, $300 contributions, 30 days, 50 leadership/sponsor trust                 | Rival challenges and strategic priorities |
| 70        | Succession council | 80 standing, $700 contributions, 60 days, 60 leadership/sponsor trust                 | Succession planning                       |

Advancement is requested and costs one AP. It requires seven days between promotions, tolerable internal opposition, recent reliability and limited notoriety. Upper ranks additionally require a fulfilled commitment and 15 influence. Active named leaders must be accessible and supportive when present; other organizations use their existing member authority structure. Promotion never removes canonical leadership.

### Business economy and provenance

Three data-driven opportunities exercise the system: Southside repair counter ($1,800), Downtown courier route ($4,200), and Resevoir laundry lease ($8,500). They have distinct legitimacy requirements, revenue, expenses and locations. No new business storyline or management simulator was added.

Acquisition subtracts actual cash and creates exactly one existing-model asset. Clean-first spending determines funding. **Any illicit acquisition funding makes the entire asset, operating proceeds and sale proceeds illicit.** This conservative rule avoids laundering and prevents partly dirty investments from qualifying for clean retirement. Upkeep uses funds matching the asset's provenance.

Daily operations generate separate gross-revenue and expense ledger entries. Demand, local economy/support, conflict, condition, custody and seeded variation affect revenue. Expenses continue in poor conditions; unpaid expenses become arrears. Condition declines, maintenance costs $120, and low-condition businesses can lose money. Acquisition → operating → profitable/struggling → sold/closed is persistent. Sale pays the current condition-adjusted value and sets asset value/income to zero; closure pays nothing and also stops operations. Neither can keep earning.

A business's trailing fourteen-day net (including maintenance) establishes its recurring-income estimate. The daily income loop excludes business assets because their revenue/expenses already settled; this prevents double-paying recurring income. Asset value replaces the purchase cash and is never counted alongside that spent cash. Arrears can be cleared with a real provenance-preserving payment from Wallet.

The $100,000 clean net-wealth and $24/day recurring-income targets remain. Net wealth subtracts arrears and supplier balances. Employment supports saving and acquisition, but wages do not masquerade as independent passive income.

## Victory validation

Underlord requires established-faction membership, 70 authority, four stabilized recognized holdings, and an appointed real Set successor. Eligibility requires shared organization, active/available status, an established willing connection, 60 trust, 60 loyalty and no serious grievance. Dead, arrested, busy, hostile, incompatible and non-Set candidates are rejected. The controlled fixture recruits **Joker**, an existing Angels member, through the actual recruitment action; it does not invent or reassign a character.

Legitimate Exit requires qualifying clean net wealth, sufficient net recurring lawful income sustained for fourteen days, no current illicit cash/operating illicit-funded business or distribution inventory, no outstanding supplier balance/arrears, thirty days since criminal activity or illicit earnings, and an active player. Failed criminal attempts also reset criminal recency. **Retire voluntarily** is an explicit decision; reaching the threshold never ends a campaign automatically.

Both endings record a single critical narrative event and a persistent day/kind/event reference. The ended campaign remains inspectable. Tests exercise each missing condition independently and verify once-only presentation and save/load preservation. A controlled funded business runs daily operations to establish real sustainable income before the retirement browser test. The control fixture submits sustained structured effects to the resolver; it never assigns four UI labels.

## Future activity integration contract

Activities continue to validate AP, money, commitments, eligibility and NPC willingness in their own gameplay resolver. After paying their actual cost, they call:

```ts
const result = applyInfluence(state, {
  actor: participant.id, // persistent character ID, or an established faction ID
  participants: [contact.id], // optional persistent character IDs
  faction: participant.affiliation, // null for lawful/community work
  zone: location.id,
  kind: "economic", // economic/community/support/challenge/defense/reputation-loss/disruption
  magnitude: 2,
  cause: "A completed activity supported local trade.",
});
```

1. Actor, participants and zone identify the activity's actual people and location.
2. The effect describes one economic, social or territorial contribution. An activity can submit multiple small effects when distinct consequences are warranted.
3. The centralized boundary validates references, effect kind, magnitude and cause; applies bounded changes; and returns an attributed event.
4. Foothold changes, a rolling detailed effect journal and campaign event history persist. The daily resolver alone handles control and stabilization.
5. Routine effects use routine severity; actual recognition changes and serious political crises produce meaningful major events.
6. Market access/risk, faction utility, resource upkeep, authority contributions, business demand, victory checks and the map observe the same saved state. Consumers can correlate the returned event ID with their existing commitment/relationship evidence.

Faction identity is optional only for lawful economic/community effects. Future storylines, NPC decisions or community incidents can use this boundary without changing map ownership code. No future content catalog was implemented merely to demonstrate the interface.

## Presentation and creator playtest

The existing artwork, SVG map, navigation and dark visual language remain. The map shows saved control, multiple footholds, relative presence strips, changing intensity and dashed contested borders. Selected details expose control, visible faction presence, support, economy, pressure, stabilization and recent developments. Hidden NPC intentions are not exposed. Optional influence actions and recent decisions live in expandable sections.

Set contains authority and succession progress. Wallet contains acquisition/maintenance/sale and retirement progress with unmet conditions. Affiliation remains attributed in the HUD, contacts and events; it no longer recolors the entire interface or unrelated feed entries.

For creator review: start in Southside, try community support in City, advance days and inspect autonomous decisions, pursue sponsorship via Connects, inspect advancement in Set, and save toward a business shown in Wallet. New games retain ordinary pacing. There is no public debug button, instant victory or shortened campaign target.

Screenshots in `docs/screenshots/goal-007` come from actual browser-rendered state. `01`, `02`, `05`, `06`, `08`, `09` exercise gameplay investment, day advancement, acquisition and operations. `03`, `04`, `07` use clearly controlled distant-progression/eligibility saves with production resolvers/actions. They are mechanical acceptance fixtures, not evidence of a completed natural campaign.

| Capture                       | Demonstrates                                                         |
| ----------------------------- | -------------------------------------------------------------------- |
| `01-dynamic-map`              | Authoritative five-neighborhood map after gameplay/daily advancement |
| `02-contested-neighborhood`   | Simultaneous Nawf rivals, separate support/economy/pressure          |
| `03-control-change`           | Resolver-recognized takeover and persistent control history          |
| `04-organization-progression` | Actual advancement from eligible member to contributor               |
| `05-strategic-action`         | Paid local support and resulting neighborhood state                  |
| `06-business-income`          | Actual acquisition, gross/expense/net history and asset value        |
| `07-underlord-successor`      | Four stabilized holdings and real eligible recruited successor       |
| `08-legitimate-progress`      | Qualifying clean finances and explicit unmet retirement requirements |
| `09-faction-development`      | Independent Back Street decisions during ordinary day advancement    |

## Validation and balance observations

Completed counts, campaign metrics and public build provenance follow below. Initial failures are retained alongside final logs. Browser host libraries were installed into the user-owned Playwright bundle because system package installation requires unavailable root access; both actual engines execute. WebKit uses software scale 1 locally. Browser coverage does not substitute for a physical-iPhone creator playtest.

## Remaining content limitations

This milestone provides the strategic foundation. The limited existing activity and narrative catalog is still limited. There are no new major factions/neighborhoods, large mission catalogs, violence/combat system, authored leadership chains, new portraits, full diplomacy, laundering, multiplayer or cinematic endings.

Business revenue and faction scoring are intentionally compact abstractions, not finished campaign balance. The long wealth target and succession requirements are aspirational. Automated controlled outcomes establish mechanical correctness; they do not establish that a full-length Underlord or retirement campaign is already content-rich or enjoyable. More authored organizational opportunities, community incidents and legitimate growth opportunities can now contribute through the shared interface.

### Completed local verification

- **173/173 Vitest tests passed**, including 36 strategic tests and all existing unit regressions. The final local run used a 20-second per-test ceiling while browser campaigns were also running; the initial default-ceiling run exposed two overloaded long-campaign timeouts. Remote CI runs independently.
- The integrated baseline's **114 distinct Chromium/WebKit scenarios passed** across the completed baseline matrix and reruns. Four WebKit scenarios exceeded the original 30-second ceiling under concurrent load; all four passed with the established 90-second browser ceiling.
- The GOAL 007 full matrix completed **130 distinct scenarios**: 127 passed initially; the three failures passed on the fixed-build rerun. One exposed nested neighborhood headings and was corrected. Two failed at page startup/resume while the served build was being replaced. Final artifact checks run against a fixed build.
- All four iPhone widths (320, 375, 390, 430) and existing desktop flows are covered. Existing employment, contact introductions, crew willingness, merchandise inventory, supplier repayment, story history, custody and release all remain exercised.

### Long-running results

`node scripts/simulate-strategy.mjs` completed **18 seeded 180-day campaigns**, each replayed with daily serialization/deserialization: **36 runs / 6,480 simulated days**, all deterministic. Seeds: 1, 21, 2026. Six policies: passive, employment/business, organizational, mixed economy, incarceration, and controlled sustained political/economic disruption. Every daily step checks bounded foothold values, wallet/resource integrity and agreement between recognized ownership and city projections.

| Policy           | Results after 180 days                                                                                                                                                                                                                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Passive          | Independent expansion, contest, maintenance, commercial and recovery decisions; canon controllers retained while footholds/economies/pressures changed. No automatic city conquest. No earnings leads to $3,115 living arrears, rather than free survival.                                                               |
| Work/business    | First repair business acquired with earned wages; maintenance paid twice; final clean cash $6,627–$6,864, plus the condition-adjusted asset. No artificial progress to $100,000.                                                                                                                                         |
| Organizational   | Existing Mega sponsorship, introduction to Justice, reliable work, five local-support actions, 46 neighborhood operations and three earned promotions reached **authority 70** in all seeds. The player still held only the organization's established neighborhood; seniority alone did not award territory or victory. |
| Mixed economy    | 28 transactions in the seed-1 run; supplier obligations handled through actual repayment. Final illicit cash $1,338–$1,580 remained separate from $6,177–$6,679 clean cash.                                                                                                                                              |
| Custody          | Controlled player arrest, ongoing daily costs and business operations, release and continued work. Final clean cash $6,245–$6,614; canonical Loco custody preserved.                                                                                                                                                     |
| Changing control | The shared effect interface applied a bounded sustained disruption in Rio on days 60–84. Angels lost recognized Rio control on **day 73**. Autonomous Blips subsequently established Nawf control on **day 148**. No controller labels were assigned by the harness. Both transitions remained stable through day 181.   |

A passive seed illustrates distinct behavior: Angels made 10 contests/17 economic decisions; Back Street made 7 expansions/23 economic decisions; Block Boys made 7 contests/29 economic decisions; Blips made 16 contests/24 recovery decisions; Mudgang made 14 maintenance/19 recovery decisions. All organizations remained active. No organization automatically held the whole city, and footholds did not saturate every neighborhood.

Observed final organizational resources ranged from $8 to $1,596, within the $1,600 cap; weak organizations continued recovering rather than being deleted. Detailed attribution, controller histories, action counts and balances are in `docs/validation/GOAL_007_CAMPAIGNS.json`. Average full day/policy processing was **19–71 ms**, with a **325 ms** maximum under concurrent browser/test load. Serialized 180-day campaigns were about **1.47–1.65 MB**. Retained campaign history grows with campaign length; storage behavior beyond the tested horizon remains a future optimization concern.

The default passive city deliberately retained its canonical controllers over these 180 days, although faction conditions and footholds changed. Controlled disruption and sustained organized-effect tests separately prove loss, recognition, recovery and four-zone victory. This evidence distinguishes inertia from permanent ownership, without introducing random daily map flipping or a new incident catalog.

The final fixed Pages-path build (`/Hood-Hero/`) passed **52/52 additional Chromium/WebKit checks**, including all strategic scenarios, contact/navigation corrections, current-save continuation, inventory-backed sales, repayment, arrest/release, crew assistance and the four phone widths. Final screenshots were refreshed from that build. Full root, rerun, Pages-path and unit logs are retained separately.

### Public deployment and actual play

The established main-triggered preview workflow successfully deployed the unmerged GOAL 007 revision **`c475562706a8603b49ac8c1b61aa7c83b0e669f5`**: [deployment 41564351271](https://github.com/kalikeefbiz/Hood-Hero/actions/runs/41564351271). Main received only `.github/workflows/preview-goal-007.yml`; gameplay remained in PR #6. The public `build-info.json` reported GOAL 007 / schema 8 / that exact commit. The public index served `index-vApagxnn.js` and `index-CBYdM6DY.css`, matching the tested Pages build.

**46/46 real public Chromium/WebKit checks passed**. Every test checked the deployed commit before playing. Coverage includes local investment, autonomous faction decisions, controlled resolver-driven takeover, advancement, actual successor recruitment/appointment and Underlord, business acquisition/income/sale and voluntary Legitimate Exit, Streets/Honest/Connects, introductions, storyline completion, supplier transactions and repayment, earned crew help, arrest/release and 320/375/390/430 layouts. Public live captures are prefixed `live-` in `docs/screenshots/goal-007`; additional regression captures are in its `regression` directory.

The ordinary public merchandise journey finished on day 5, with $275 collected, $36 losses, $102 repaid and $190 cash remaining. Public custody checks arrested on day 24, released on day 26, charged $36 living costs, retained Loco's indefinite incarceration and continued the campaign. Both engines exercised these actual outcomes.

Playable URL: **https://kalikeefbiz.github.io/Hood-Hero/**. Full public results and build/deployment metadata are retained in `docs/validation/GOAL_007_PUBLIC_FINAL.txt`, `GOAL_007_LIVE_BUILD.json` and `GOAL_007_DEPLOYMENT.json`. The preview is repinned to the final review revision after adding this verification evidence; those later changes contain documentation and captures only. Its current provenance is independently readable at the public `build-info.json` endpoint. GitHub CI runs independently; completed local and public results above are not claims about an unfinished remote CI run.
