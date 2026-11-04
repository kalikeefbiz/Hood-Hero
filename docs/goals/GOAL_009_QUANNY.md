# GOAL 009 — Quanny

Branch: `feat/goal-009-quanny`  
Base: `feat/goal-008-living-danger` at `4024f35` (`Implement persistent danger and conflict on the strategy board`).

## Playing the feature

Quanny approaches automatically on the first actual arrival in the Reservoir, at any location, including residences and the player's home. A Reservoir start or an unintroduced Reservoir save triggers the approach when gameplay is entered/resumed. Raw world construction and map inspection do not trigger it. The introduction takes priority over generic danger and occurs once; his board figure stands at the actual arrival location. After a peaceful affiliation response he says, ‘If you need me again, pull up to Lil Jay’s Market. I’m usually outside.’ The saved `quanny.knownLocation` records that meeting place. Hostile introductions do not disclose it. Subsequent business and collection require a physical visit to `reservoir.lil-jays`; closing the peaceful introduction outside the market cannot leave a remote business conversation available.

Truthful membership and unaffiliated answers use the player's current affiliation. Only Blocc Boys and Gabriel's Angels can be falsely claimed. False BB is detected immediately and ends business; the visible dismissal does not expose his private retaliation decision. Both Angels claims cause a first-contact shooting with seeded escape, minor injury or serious hospitalization. Only that resolver excludes death. Future war/personal-conflict exposure remains lethal.

Other legitimate organizations get “Who put you on?” with truthful established membership/sponsorship information or a refusal to elaborate. Mudgang's alliance with the Angels is not converted into a direct Blocc Boys war.

Eligible players can offer existing night goods, review consignment terms, accept or negotiate. Practiced social skill earns a higher valuation; repeatedly weak proposals damage the relationship. Asking for Splash Gang violent work is visibly locked. There is no contract system.

After the introduction, meet Quanny outside **Lil Jay's Market** and use **Talk business with Quanny**, available on the location and character cards. The store is Mr. Lewis's existing retail location; its name, shopping, hiring and other business functionality remain. Mr. Lewis is a separate canonical resident; existing hiring contacts remain in their existing roles.

At collection, notoriety **35** is the exact threshold. It is read at collection, not agreement creation. At or above it Quanny pays the agreed sum; below it he denies receiving the goods. Refusal ends that conversation, records the disputed balance, lowers his trust/respect and blocks new business. There is no immediate attack response, and later notoriety does not repay the disputed agreement.

On later days, a disputed consignment permits separate location-based decisions: leave it unresolved, seek reconciliation, public disrespect, physical challenge, robbery or violent retaliation. Initiating conflict costs 1 AP. An inexperienced player has at most 1.5% chance to break through, and cannot kill or hospitalize Quanny even on that successful early roll. Established recovery skill, actual successful street transactions, recovered injuries, successful shared criminal activities, player support, NPC experience/backing and stress affect later outcomes. Capable opponents can hospitalize or kill him; witnessed violence and normal street transactions can cause arrests.

## Simulation integration

- `Quanny.ts` owns authored transitions, business eligibility, repair evidence and information-channel discovery of false Angels claims.
- `QuannyState.ts` keeps first-contact facts, claim/deception, shooting category, business status, repair baseline/history and a saved NPC random stream.
- `quannyEncounters.ts` is an ordinary encounter definition, using the existing response validation, priority queue, modal, event feedback and history.
- `Danger.expose` gives the introduction priority. Recognition uses `witnessIdentity`; persistent grievance, pursuit, escalation, association and later violence use GOAL 008's existing danger records.
- Private impostor recognition is an NPC-observed event. It is absent from player memories/feedback. His later actions or dialogue can reveal what he thinks through ordinary gameplay.
- Minor gunshot injuries extend the existing injury records with `severity: minor`: one AP is unavailable until their release day. Serious injuries use the existing shooting hospital admission, medical costs, arrears, status, recovery and full city-time advancement.
- Quanny participates in the existing NPC utility AI, street transactions, custody and conflict progression. Supplier-debt commitments do not freeze the NPC debtor. The added NPC stream avoids rerolling The Chains' established seeded decisions. Other NPCs can still socialize with the added characters.
- Splash Gang is described as Quanny's personal set within Blocc Boys. It is neither a major faction nor the player's personal Set. No additional Splash Gang members are invented. Organizational support uses existing Blocc Boys connections and conflict associates.
- Mega is known by reputation with modest trust and respect, not a close friendship or automatic player protection. Panic's reputation and incarceration are described without adding a Panic subsystem.

## Directional consignment

`Consignment.ts` extends the existing street model rather than treating NPC debt as player liability:

1. The player's source lot loses the transferred quantity from `remaining`, retaining its own acquisition cost and any original supplier debt.
2. Its `transferred` count links to a new debtor-owned lot through `sourceLotId`. The NPC owns inventory custody and can distribute it through normal street transactions.
3. The new supplier agreement names the **player as supplier**, **Quanny as debtor**, and records lot, quantity, original amount, balance, created day, due day, payment status, collection result/notoriety and event history.
4. Prices derive from current existing market valuation with a distributor margin and existing wholesale floor. `STREET_BALANCE.deadline` supplies the six-day due date.
5. Quanny reserves his own existing operating cash internally when accepting the front. The player receives nothing up front. This bounds agreement size by real NPC resources and guarantees that an honored collection uses reserved funds rather than manufacturing a payout. Refusal returns his reserved operating money to him; his disputed liability remains recorded.
6. Collection credits the existing player wallet, illicit-income progression and ledger exactly once. The debt commitment and merchandise debt fields settle together. Quanny's later sales are his own transaction history, not duplicate player income.
7. NPC-debtor collection does not run the player-debtor default/refund path. Existing suppliers and repayments retain their behavior. The generic supplier-reaction modal is restricted to player-debtor agreements so Quanny's authored conversation does not produce a duplicate conversation.

The Wallet separately lists merchandise fronted to others, its receivables, status and collection history. Each Quanny receivable explicitly says `Collect from Quanny — Lil Jay's Market, The Reservoir. Due Day N.`, with N read from the agreement's actual `dueDay`. The agreement event, board facts and collection dialogue use the same instruction; character profiles show his disclosed location. It never labels Quanny's balance as money the player owes. Collection itself remains a physical board interaction.

## Repair and rivalry

Business repair requires at least 30 new evidence points beyond the baseline at blocking, on a later day. Existing organizational standing, legitimate Blocc Boys membership, faction contributions and improved relationships with respected contacts provide evidence. Active direct faction rivalry blocks reopening. Reopening improves the relationship but does not erase disputed debt or automatically settle personal conflict. Credible mediation can cool a conflict; generic danger conversations retain normal reconciliation mechanics. There is no repeatable apology-to-business button.

## Saves

The existing Lab v8 envelope and isolated storage keys remain. Additive schemas default missing Quanny state and add the two canonical characters to pre-feature v8 saves. Existing records are preserved. New optional lot/agreement fields, injury severity and the disclosed `knownLocation` are validated. Pre-correction peaceful customers and existing Quanny receivables retain the market hint on load; hostile introductions alone do not gain it. Transfer conservation includes remaining, lost, sold and transferred inventory; child lots must match source custody. Agreements, commitments, events, collection chronology, threshold outcome, reserve/balance and participant references are checked. Save/load retains private intent, recognition, debt, relationship, repair and conflict state.

## Scope and remaining integration

No deployment, merge, original-game change, renderer, camera, mesh, animation or environmental asset change. Quanny and Mr. Lewis use existing board figures and portrait fallbacks. Claude can later supply their dedicated models/portraits and storefront visuals through the existing character/location integration. `reservoir.lil-jays` and character IDs `quanny` / `mr-lewis` are stable anchors.

This is a bounded simulation foundation, not a full combat or contract system. NPC placement follows the board's existing location architecture rather than adding a city-wide schedule/pathfinding system. Reconciliation does not promise a complete settlement, and overdue collection remains unavailable while Quanny is dead, arrested or recovering. No future authored missions are scheduled.

## Validation

See the accompanying validation results recorded after the final runs. Unit tests cover all affiliation branches and shooting categories with deterministic seeds, directional inventory/finance, collection thresholds, irreversibility of refusal, repair, later lethal risk, actual NPC commerce, reachable veteran capability, save integrity and continued Chains behavior. Browser tests exercise the existing strategy board on Chromium and WebKit.
