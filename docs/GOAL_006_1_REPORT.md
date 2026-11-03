# GOAL 006.1 — Gameplay structure, access and Heat

Correction of accepted working baseline `788849a0b908abdb2f89ba7852408b80e7cf47f9`, on `goal-006-criminal-economy`, in [PR #5](https://github.com/kalikeefbiz/Hood-Hero/pull/5). GOAL 006 gameplay remains unmerged.

## Corrections

- **Actions:** `ActionsHub.tsx` separates Streets (inventory-backed transactions, local conditions and quiet time), Honest (employment search/offers, shifts, attendance warnings, time off, gigs and resignation), and Connects (one selected contact, contextual Reach Out choices and supplier terms). Completed contact/supplier interactions return to Streets. Time off sits beside the scheduled shift; resignation is in employment options. Identical restrictions are shared rather than repeated, including supplier acceptance responses. Full illustrative social cards became compact rows; no artwork was created.
- **Access:** `Character.connections` distinguishes actual contact from the existing `known` awareness list. “Trusted” still derives from the NPC’s directional trust and grievance. Mega and Flacco are connected immediately; ordinary home-neighborhood contacts remain usable. Hearing suspects’ names or knowing Pablo’s reputation grants no direct access. Information reveals names; introductions use the sponsor’s actual connections. Leaders additionally require a sponsor from their own organization with sufficient trust. Employment applications establish an employer connection. Action validation, suppliers, market access and crew introductions enforce these rules, including NPC contact with the player. Known-of profiles do not expose private capability/relationship details.
- **The Chains:** the compact City Storylines entry reopens its existing narrative definition. Negotiation, buyback, recovery and Pablo’s contextual intervention remain available. Story access never gives Pablo a permanent connection. Concluded incidents leave the active list; completed history distinguishes fulfilled, broken, superseded, unpromised help and no involvement. Completed promises are absent from Actions. No mission progression was added.
- **Wallet:** cash/provenance, Inventory, Outstanding obligations and Transaction history have separate sections. Select a compact merchandise slot to see supplier, quantity, cost, paid/debt, actual proceeds, losses and full-cost result. Exhausted lots remain in records. Personal possessions retain their separate character list; slots use neutral placeholders. Supplier conversations and reaction links use the actual person’s identity.
- **Persistence:** schema **7** saves connections and validates references. Earlier disposable Test saves are intentionally invalidated; no migration was added. Merchandise, contracts, ownership, repayments, defaults, crew cooperation/refusal, custody, living costs, employment and faction market activity retain their existing simulation infrastructure.

## Heat comparison

The old routine transaction added **10 plus a neighborhood surcharge** to police, added the same activity to recent history, and increased investigation pressure every time. The correction uses centralized settings in `content/street.ts`:

- Routine sale: exposure weight **3**; no buyer **1.5**; cash loss **4**; goods loss **8**. Neighborhood policing scales the increase. Crew receives the corresponding participation exposure, not the old flat penalty.
- Investigation grows only on significant exposure (weight 8+), at 0.45 per weight. Routine success creates no investigation pressure. Recent history still spans ten days and decays gradually; a lawful action does not clear it.
- Scrutiny weights police/history at 0.45, investigation at 0.25, notoriety at 0.05 and neighborhood policing at 0.1. Police decays **2/day**, so sustained activity still accumulates danger despite smaller routine increases.
- Every transaction has a **0.4% base police-intervention chance**, plus a scrutiny-scaled component. Ongoing scrutiny adds a separate bounded daily arrest chance above the threshold. Low-Heat arrests are therefore possible without making quiet lawful days randomly criminal. Sentence and release rules are unchanged.

`scripts/simulate-street-balance.mjs` compares **three strategies × eight seeds × 30 days** against the actual baseline checkout and the correction: occasional trade every third day with lawful income, frequent trade with every fourth day quiet, and aggressive repeat trade. Each campaign is replayed with and without daily save/load checkpoints. Before/after source schemas are recorded as 6/7.

Means across eight seeds:

| Strategy | First-week peak Heat, before → after | Arrests / 30 days, before → after | Corrected month peak Heat | Corrected liquid net change |
| --- | --- | --- | --- | --- |
| Occasional + lawful | 24.6 → **6.8** | 1.00 → **0.00** | 13.3 | +$684.13 |
| Frequent + periodic quiet | 83.8 → **24.7** | 2.63 → **1.13** | 77.1 | +$205.88 |
| Aggressive | 91.1 → **33.0** | 3.50 → **1.88** | 95.4 | −$41.25 |

Liquid net change is final cash less supplier balances, arrears and starting cash, so it includes living costs and custody’s lost earning time. Merchandise profit is tracked separately. Street AP totals and a $38/AP lawful-income benchmark expose opportunity cost; the benchmark does not imply unlimited gigs, which remain once daily. Three aggressive samples ended cashless, with debts and/or arrears. Supplier quantities, prices, AP costs and six-day repayment terms were not loosened. Zero arrests in the eight occasional samples does not imply immunity: a separate 700-seed low-exposure test produces both arrests and continued play. No strategy is guaranteed profit or punishment.

Raw results and derived comparisons: [before](validation/GOAL_006_1_BALANCE_BEFORE.json), [after](validation/GOAL_006_1_BALANCE_AFTER.json), [comparison](validation/GOAL_006_1_BALANCE_COMPARISON.json). Every checkpoint replay matched.

## Validation and captures

- **137 Vitest tests passed**, including the existing 126 cases and eleven access/risk corrections. Existing story outcome assertions retain deterministic fixtures; seeds 13 and 1 now cover neglect and final-day intervention after NPC access changes.
- All **114 distinct Chromium/WebKit scenarios passed** across the complete matrix and final rerun. The initial matrix passed 112/114: both failures mistook a legitimate independent crew invitation for a reopened postponed storyline. The assertion now handles the real invitation while still checking storyline closure. The **20/20 final Pages-path checks** include both repaired cases, new categories/access/inventory/history, supplier default, and all four widths (320/375/390/430). Results are retained in `validation/GOAL_006_1_BROWSER*`. Existing desktop, faction, employment, crew, encounter, save/load and accessibility checks remain; the accessibility audit now visits all three Actions categories.
- A final inherited-style correction is covered by **16/16** compact-layout and accessibility cases in both engines (`validation/GOAL_006_1_LAYOUT.txt`), including a contact-row height assertion. TypeScript and the `/Hood-Hero/` production build pass. Local software-rendered WebKit uses logical iPhone viewports at scale 1; standard CI retains the iPhone preset’s scale 3. Browser execution and assertions are not skipped.

Actual application screenshots, with equivalent WebKit captures, are in [screenshots/goal-006-1](screenshots/goal-006-1/): [Streets](screenshots/goal-006-1/chromium-mobile-01-streets.png), [Honest](screenshots/goal-006-1/chromium-mobile-02-honest.png), [Connects](screenshots/goal-006-1/chromium-mobile-03-connects.png), [contact access](screenshots/goal-006-1/chromium-mobile-04-contact-access.png), [supplier terms](screenshots/goal-006-1/chromium-mobile-05-supplier-terms.png), [inventory](screenshots/goal-006-1/chromium-mobile-06-inventory.png), and [completed storyline](screenshots/goal-006-1/chromium-mobile-07-storyline-history.png).

## Deployment and limits

The existing main-triggered Pages preview checks out the unmerged feature branch. Playable URL: **https://kalikeefbiz.github.io/Hood-Hero/** . The final served SHA and completed public Chromium/WebKit checks are recorded in PR #5’s delivery section after publication; public checks assert commit, milestone **GOAL 006.1**, schema 7, actual controls and saved consequences.

The existing authored contact network remains the source of introductions; this correction adds no procedural diplomacy or confrontation engine. Merchandise remains one category with aggregate buyers. Living-cost arrears and unavailable repayment after a supplier’s death retain GOAL 006’s limits. Item illustrations await creator assets. Automated mobile WebKit is not physical-iPhone testing. No new storyline, criminal activity, territory mechanic, storage/loadout system or artwork was added.
