# GOAL 006 — Criminal Economy, Street Obligations & Consequences

## Baseline

Accepted GOAL 005 PR #4 was merged before implementation: `0eac10a5be28d27f69ff60209349b5d17ff05ffd`. All **111 baseline Vitest tests** and the production build passed. Work continues on `goal-006-criminal-economy`; GOAL 006 gameplay is not merged into main.

## Implementation

- `StreetTypes.ts` and `StreetEconomy.ts`: authoritative owned merchandise lots, local markets, actual transactions, supplier agreements and financial result accounting. One data-driven fictional category, **night goods**. Each lot retains received/held/lost quantities, owner, supplier, source neighborhood, cost, estimated gross, actual collected gross, supplier payments, debt, losses, crew shares, due day and status. Receiving goods creates no proceeds.
- `streetEncounters.ts`: actual existing character suppliers use the established City-only encounter modal. Accept cash/consignment, clarify, decline, make full/partial/affordable payments. Conversations conclude after their response. No new leaders or artwork. Justice and lawful residents are not converted into suppliers. Broken/fulfilled supplier promises generate character reactions through the existing encounter queue.
- Consignment creates an ordinary `supplier-debt` commitment, with financial detail linked by agreement and lot. Partial payments transfer real money and retain provenance. After the due day, the commitment breaks once, trust falls, grievance/rival pressure rises proportionally, and the debt remains. Late repayment repairs some trust while preserving the broken promise and memory. No additional inventory is available until existing goods and debt are cleared; supplier resources, trust, exposure, affiliations and a resupply cooldown also apply.
- Transactions use ActionEngine's existing `crime` identifier, now exclusively inventory-backed. Its former standalone card and automatic $72 payment are gone. Street Work in Actions presents available suppliers, exact eligibility reasons, terms, selectable markets, AP, quantity, price estimates and current success odds. Sale, partial sale, no buyer, lost money and lost goods update actual inventory and cash. The last AP works; duplicated/fabricated goods, nonexistent markets and unassigned partners are rejected.
- `CriminalExposure.ts`: bounded ten-day weighted history, investigation pressure, police/notoriety/neighborhood effects, gradual decay and threshold warnings. Rest or a lawful action cannot erase history. Success odds and daily arrest probability use testable state-based calculations, without a fixed crime-count punishment.
- `Incarceration.ts`: persistent arrest/prior/release records, bounded temporary sentences, residual scrutiny and daily progression. `serveSentence` calls the ordinary daily engine for **every** day: expenses, passive lawful income, attendance, missed jobs, obligations, NPCs, crew, factions and incidents continue. Uncovered living expenses accumulate as explicit arrears, never negative cash. Death still ends a run; ordinary arrest does not. Loco has an explicit **null release date** and remains canonically incarcerated.
- CrewAgency's existing partnership request, refusal, assignment, commitment, reliability and experience lifecycle now resolves actual inventory transactions. Existing willingness, stress, trust, skills, affiliations, employment and availability checks remain. Only participating members receive pay/exposure/stress and can later be arrested; no Set-wide punishment. Crew shares come from actual collected proceeds. An eligible member's genuine contacts can improve local access. Lawful work, offers and invitations remain intact.
- Neighborhood markets separately track demand, competition, pressure, daily capacity, actors and faction economic participation. Modest autonomous changes come from actual available local characters and organization resources. Known sources can reveal substantive changes. Independent player trade stays independent; no sixth faction or territory ownership change is created.
- Wallet contains inventory, supplier balances/deadlines, estimated gross, actual collected proceeds, full-cost result, losses, crew payments and transaction history. Existing clean/illicit ledgers remain authoritative. Heat retains its numeric reading and a qualitative description.

## Save policy

Schema **6** intentionally invalidates disposable earlier test saves. Zod validates current economy, exposure and custody state; cross-reference checks reject invalid lots, impossible inventory conservation, inconsistent collected proceeds/losses/shares/debt, missing characters/commitments/events, duplicate records and invalid release dates. Save/load does not resolve transactions, payments or arrests again. Late repayment leaves the original broken commitment intact.

## Balance

Numerical economy and exposure settings are in `src/content/street.ts`, alongside the existing lawful baseline in `balance.ts`.

- Starting cash $125, two daily AP, living expenses $18, scheduled shifts about $96 and once-daily gigs $38/AP remain.
- Six-unit lots: **$90 cash**, or **$102 consignment**, due by the end of the sixth following day. 1 AP to accept. One outstanding lot/debt and at least three days between acquisitions.
- Base unit price $50, adjusted by neighborhood demand, competition and pressure (floor $30). Transactions attempt 2–3 units and can be partial. Six units of local demand and two player attempts per day cap throughput. Higher Downtown demand can pay better but requires 15 local standing, a local contact and 50 social skill, with much higher police scrutiny. Local gigs now also build one point of home standing.
- Successful early Southside lots can outperform local gigs per AP, but estimates are gross, not promised earnings. Losing merchandise leaves the full supplier balance intact. Ongoing activity erodes reliability, raises exposure and may cost days in custody.
- Crew receives 15% of actual gross, with no extra generated income. Financial failure can also cost the participant up to $6. Skills can improve or worsen reliability within bounded limits; crew does not remove risk.
- Ordinary sentence starts at two days; prior history and severity increase it to a maximum of seven days. There is no automatic life sentence. Arrest probability is bounded at 32% on any daily check and requires meaningful accumulated exposure.

## Reproducible gameplay and validation

`tests/street.spec.ts` plays the ordinary Southside start through supplier clarification, consignment, multiple AP-bearing transactions, inventory, full repayment and save/reload using normal browser controls. It also renders seeded **real-action** campaigns for default, crew participation, accumulated attention, arrest and release; those checkpoints are created by the same newGame/actions/daily engine, with no injected money, inventory, trust or exposure. Custody fixtures search a bounded campaign for a natural probabilistic arrest.

`src/tests/street.test.ts` adds contact-to-repayment, cash purchase, financial loss/default/repair, all five starts, exploit guards, custody, employment termination, member release and autonomous markets. Old regression tests retain their assertions for supported systems; schema expectations, the intentionally replaced criminal payout/arrest rule and deterministic story seeds were updated. Removing the old NPC cash shortcut changes RNG timing: seeds 15 and 8 now supply the existing broken-promise and final-day-settlement fixtures. Old art tests continue checking approved action art; the removed criminal card is no longer expected to exist.

`node scripts/simulate-street.mjs` runs **25 × 60-day campaigns (1,500 days)** over five seeds and all five home neighborhoods, comparing lawful, occasional cash-purchase trade, mixed, sustained criminal and crew-assisted strategies. Every campaign is replayed with and without daily save/load checkpoints, and normalized states must match exactly. Reports include cash/provenance, profit, lost goods, debt, arrears, police, arrests, crew participation/availability, market activity and encounter/event counts.

The published Chromium and WebKit journeys on seed 2026 completed on **day 4**: six goods received, six attempts (three full sales, one partial sale, two no-buyer results), **$279 gross**, **$102 repaid**, **$177 merchandise result**, zero held/lost goods and zero supplier balance. Three $18 living charges left **$248 cash** from the original $125. No inventory or money was injected. The failed attempts awarded $0. The fulfilled commitment, lot, transaction history and wallet survived reload.

The 25 final 60-day runs all retained nonterminal campaigns and preserved Loco. Checkpoint and uninterrupted replay matched for every run. Lawful strategies ended with $2,985–$2,993 cash and no arrests/debt/arrears. Occasional cash-purchase trade ended with $1,547–$1,602 and $333–$356 merchandise result, with no arrests. Mixed consignment strategies produced −$6 to $632 merchandise result, $331–$969 ending cash and 2–3 arrests. Sustained criminal strategies produced $40–$376 merchandise result but only $0–$60 ending cash, 5–7 arrests and $144–$419 arrears. Crew-heavy strategies retained $0–$97, produced −$127 to $536 merchandise result, and completed 12–24 shared transactions; partner contribution did not cover the cost of reckless repetition. Some campaigns finish with a $102 unresolved supplier balance. These are bounded scripted strategy samples, not a claim of optimal play or universal rates.

Completed test results and deployment evidence are recorded below.

## Gameplay captures

Actual application views, generated by the reproducible browser suite in both engines, are under [screenshots/goal-006](screenshots/goal-006/). Supplier-to-repayment captures use ordinary UI play; default/custody/crew captures resume real-action seeded campaigns as described above.

1. [Supplier terms](screenshots/goal-006/chromium-mobile-01-supplier-terms.png)
2. [Inventory and obligation](screenshots/goal-006/chromium-mobile-02-inventory-and-obligation.png)
3. [Successful transaction](screenshots/goal-006/chromium-mobile-03-successful-transaction.png)
4. [Failed transaction](screenshots/goal-006/chromium-mobile-04-failed-transaction.png)
5. [Outstanding balance](screenshots/goal-006/chromium-mobile-05-outstanding-balance.png)
6. [Completed repayment](screenshots/goal-006/chromium-mobile-06-repaid.png), [default](screenshots/goal-006/chromium-mobile-07-default.png)
7. [Accumulated attention](screenshots/goal-006/chromium-mobile-07-accumulated-attention.png)
8. [Arrest and incarceration](screenshots/goal-006/chromium-mobile-08-arrest-and-incarceration.png)
9. [Release](screenshots/goal-006/chromium-mobile-09-release.png)
10. [Crew-assisted work](screenshots/goal-006/chromium-mobile-10-crew-assisted.png)

## Limits

One abstract category and fixed small supplier lots are intentional. Repayment offers full, $25 partial, or all currently affordable cash; there is no arbitrary amount editor or courtroom negotiation. Supplier death leaves a collectible but unavailable balance (no inheritance/probate model). Unpaid living costs are tracked as arrears, with no separate creditor collection interface. Autonomous market flows are modest organizational activity; ordinary NPCs do not run the complete player consignment UI. The market is an aggregate, without individual buyer identities. No territory conquest, new major characters, violent assignments, laundering, businesses, prison storyline or new art is added. Physical iPhone playtesting remains distinct from automated iPhone-size Chromium/WebKit checks.

## Final validation and deployment

Review PR: https://github.com/kalikeefbiz/Hood-Hero/pull/5 . Final gameplay commit: **`2dff9a0b3bc6878088b2382531e4f7752dec3e29`** on `goal-006-criminal-economy`. Subsequent evidence changes contain documentation, captures and test instrumentation, not gameplay changes.

Main commit `6431875b81e6bf5fb632a5f78c6b860b092ecd1c` adds only the authorized GOAL 006 publishing workflow. [Deployment 41487618573](https://github.com/kalikeefbiz/Hood-Hero/actions/runs/41487618573) checks out the unmerged feature branch and successfully published that gameplay commit. GOAL 006 gameplay remains unmerged pending creator approval.

The playable URL is **https://kalikeefbiz.github.io/Hood-Hero/** . Public `build-info.json` identifies GOAL 006, schema 6 and the gameplay SHA above. The public index references **`index-DWQ77WeQ.js`** and **`index-B0FfIewm.css`**, matching the final local Pages build. The updated deployment initially remained behind GitHub Pages' cache; verification waited until the actual public metadata and index changed, rather than accepting a successful workflow as proof.

| Check | Result / evidence |
| --- | --- |
| Vitest | **126 passed**, seven files; `validation/GOAL_006_VITEST.txt` |
| Complete browser matrix | All **100 distinct** Chromium/WebKit scenarios passed across initial matrix and targeted final rerun |
| Final `/Hood-Hero/` browser checks | **22 passed**, including all 16 economy/custody/crew/layout cases and six legacy regressions; `validation/GOAL_006_BROWSER_FINAL.txt` |
| Narrow and desktop coverage | Both engines at 320/375/390/430 pixels; existing desktop, faction-theme and accessibility checks retained |
| Seeded campaigns | **25 × 60 days / 1,500 simulated days**, with identical checkpoint/uninterrupted replay; `validation/GOAL_006_CAMPAIGNS.json` |
| Production build | TypeScript and Vite pass using `/Hood-Hero/`; `validation/GOAL_006_BUILD.txt` |
| Public browser checks | Normal supplier-to-repayment, seeded arrest/release with resumed lawful work, and earned crew partnership in Chromium and WebKit; `validation/GOAL_006_LIVE_FINAL.txt` |
| Public deployment | Metadata, served JS/CSS and actual browser gameplay checked; `validation/GOAL_006_LIVE_BUILD.json`, `GOAL_006_LIVE_ASSETS.txt`, `GOAL_006_DEPLOYMENT.json` |

The initial local matrix passed **94/100**. Its complete log is retained in `GOAL_006_BROWSER_INITIAL.txt`: two tests assumed one queued conversation, two art tests expected an offscreen lazy image to have loaded, one software-rendered WebKit crew journey exhausted its earlier time allowance, and the custody test picked up the new history assertion while that initial matrix still served the older local build. The helpers now close the real encounter queue, scroll the lazy card before asserting, and allow the long WebKit journey 180 seconds. A rebuilt final Pages-path run passes every one of those cases and all new gameplay cases. No failing local scenario remains unresolved.

Local WebKit ran real browser processes after Debian libraries were downloaded and extracted into its task-local bundle (no system/root installation was available). Only Playwright's prerequisite probe was skipped; browser execution, assertions and screenshots were not skipped. Public browsers use the configured network proxy with TLS verification retained.

Public seeded custody illustrates the actual time cost: arrest on **day 8**, release on **day 11**, cash **$213 → $159**, then a real lawful gig after release. Campaign end stays null, Loco remains arrested, supplier history remains, and the updated custody record is visible in Wallet. Separate tests verify debt becoming overdue in custody, employment termination for absence, explicit arrears and ordinary crew-member release.

GitHub Actions validates PR heads as well. Its live checks are linked on PR #5; the results above are completed local and public verification, not a claim that a still-running remote matrix has finished. All required screenshot subjects have both local-engine captures; additional `live-*` captures document the actual public application. Public normal-control journeys also assert no uncaught game errors or failed game asset responses.
