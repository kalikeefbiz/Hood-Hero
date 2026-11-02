# GOAL 005 — Your Set Has Agency

## Baseline and delivery

Accepted PR #3 was merged into `main` as `fc880ae889bffe5b3a721f52f4a15febda08e6d4`. Its 89 Vitest tests and production build passed before GOAL 005 began on `goal-005-crew-agency`. GOAL 005 gameplay remains on that development branch for creator review.

The public build remains https://kalikeefbiz.github.io/Hood-Hero/ . Deployment identifiers and public-browser verification are recorded below.

## Implementation

- Ordinary `Character` records now retain request, assignment and offer history. There is no crew-only NPC class. Existing personality, goals, directed relationships, memories, affiliations, wallets, skills, availability and autonomous actions remain authoritative.
- `CrewAgency.ts` provides shared cooperation, availability, assignment, scheduling, outcome, experience and offer resolvers. `crewEncounters.ts` supplies two reusable encounter definitions for every member: player-led conversation and NPC-led invitation.
- Work, information, spending time, lawful partnership and existing abstract black-market partnership all use these resolvers. The Set's **Interact** button opens the established City-only encounter modal. Existing social/information action entry points for Set members route through the same cooperation rules.
- Requests can be accepted, negotiated or refused. No random refusal roll: trust, affection, grievance, values, relevant ability, stress, goals, exposure, commitments, reward and real organizational hostility determine the answer. Geography is not a penalty. Refusal costs no AP, creates no obligation and does not automatically lower loyalty. Repeated pressure on separate days can cost trust; identical refused requests are blocked for the rest of that day.
- Every assignment records its participants, objective, lifecycle, AP, skill, compensation, expected benefit, initial reliability, risk, completion date, outcome, experience and event evidence. Accepted activities create ordinary commitments. Resolution is guarded by status and due day and produces persistent memories for both participants.
- Deferred paid work reserves compensation immediately, pays the member only on resolution and produces player income only on success. Immediate shared activities consume AP and resolve through the simulation. NPC invitations create accepted appointments: return on the scheduled day and spend 1 AP to participate. A missed appointment breaks the commitment and creates trust/grievance/memory consequences.
- The existing NPC decision engine considers offers before choosing ordinary daily actions. A pending offer does not reserve or freeze the character. Accepted assignments reserve participants; employed NPCs attend their own shifts through the existing employment resolver. Schedule changes are rechecked when attending.
- Removal retains identity, affiliations, skills, obligations, cooldowns, relationships and memories. Closeness and outstanding promises affect the separation response. Reconciliation uses existing trust/recruitment mechanics. No automatic rival conversion or affiliation change occurs.
- The Chains retains its participants, outcomes and deadline. Available, trusted members still contribute recovery support. Information can confirm only facts supported by a member's actual contacts; it never invents an individual holder of the chain.
- Schema **5** intentionally invalidates disposable earlier test saves. Current saves validate and preserve offers, appointments, completed/refused assignments, agency history, commitments and world references. Duplicate IDs and missing assignment/offer references are rejected.

## Capability differences and balance

Existing work, social and recovery skills supply overlapping capabilities rather than classes. Work experience affects delegated reliability, work proceeds and shared-gig bonuses. Social ability and actual known contacts affect information and introduction opportunities. Recovery experience affects a partner's contribution to the existing black-market success calculation and recovery support. Trust, stress and grievance affect reliability separately from willingness.

A poorly matched risky partner can reduce success odds. Both participants acquire police/rival exposure, stress and financial consequences. Existing ordinary status consequences apply to Flacco as to any NPC. Significant Set-member losses receive prominent notifications.

Known capability bands appear before recruitment and in conversations; exact hidden personality values are not exposed. Flacco starts inexperienced with stronger friendship. Robin begins with substantially stronger work skills. Mega supplies stronger street experience and social connections while retaining Back Street affiliation.

Economic settings:

- Delegated work costs **1 AP** and **$12** reserved compensation, or **$18** when a member negotiates. Gross proceeds are `24 + floor(work / 6)` with state-based reliability. Starting Flacco: $29 gross/$17 net on success; a work-60 resident: $34 gross/$22 net. Failure produces no player pay but still pays agreed compensation. Even two successful maximum-skill jobs yield less than a $96 scheduled shift.
- Shared local work reuses the existing once-per-day $38 gig. Work experience can add up to $9; the participating NPC earns $16. It does not create another gig category or let the player collect the ordinary gig twice.
- Shared black-market work reuses the existing activity and risk calculation. Partner success contribution is bounded from −18 to +20 percentage points. The member receives $20 illicit proceeds on success or loses up to $12 on failure; both retain exposure.
- Assignment experience grows the relevant existing skill by at most **1**, capped at **85** for this new source. Existing autonomous skills retain their established progression rules.
- Offers begin no earlier than day **3**; eligibility is centrally configured with a **10-day member cooldown**, **6-day global cooldown**, one pending offer maximum, availability checks and a deterministic 32% decision tie-breaker among eligible days. Offers expire after their scheduled date (normally tomorrow). An offer's member, contact, activity and date identify a new occasion. Expired/declined invitations never reopen themselves.
- Offer decisions do not consume the established incident/AI random stream. Identical seeds and action sequences reproduce assignments and offers, including after save/load.

## Validation

Final logs are in `docs/validation/GOAL_005_*`. Coverage includes real encounter acceptance/refusal, compensation negotiation, information boundaries, skill/personality differences, alternate action entry points, both risky outcomes, attendance conflicts, no-shows, duplicate resolution, unavailable funds/AP, fabricated partners, removal/recruitment, persistence, deterministic replay, and natural capacity/trust progression.

`scripts/simulate-crew.mjs` runs **18 campaigns of 60 additional days (1,080 days)** across seeds 1, 7, 21, 83, 2026 and 5099 with Flacco alone, Flacco + Robin, and Flacco + Mega. Recruitment uses real AP-bearing actions; no capacity, influence or trust fixture grants the second slot. JSON evidence records offers, assignments, member skills, memories, independent actions, money and incident outcomes. All campaigns remain playable beyond The Chains; wallets and AP remain valid, and offers stay bounded.

Examples from seed 1: Flacco alone offered a shared gig on day 3, an accepted appointment; his day-14 gig was declined and later introductions expired. With naturally recruited Robin, Robin offered work on day 4 and later introductions as social experience grew. With Mega, Mega independently offered an introduction on day 4. Both invitation types resolve through the same assignment and commitment systems.

Browser tests use normal controls for paid work, refusal, natural second recruitment, inspect/accept/attend/decline/expire invitation paths and checkpoint reload. Layout checks cover 320, 375, 390 and 430 pixels in Chromium and WebKit; the existing suite also exercises desktop layouts and accessibility. No state injection supplies recruitment capacity in the new crew browser journeys.

Local WebKit required Debian shared libraries in a task-local directory because this environment has no root installer. Those dependencies were extracted into the browser bundle's search path; only Playwright's system-cache prerequisite check was skipped. Real WebKit browser processes ran the tests. GitHub CI uses the standard root-enabled `playwright install --with-deps` workflow.

## Gameplay screenshots

Captured from real browser play, with approved artwork or established placeholders. Both engines have the seven required scenes under [screenshots/goal-005](screenshots/goal-005/):

1. [Flacco's interaction](screenshots/goal-005/chromium-mobile-01-flacco-interaction.png)
2. [Cooperation options](screenshots/goal-005/chromium-mobile-02-cooperation-options.png)
3. [Accepted assignment](screenshots/goal-005/chromium-mobile-03-accepted-assignment.png)
4. [Refused request](screenshots/goal-005/chromium-mobile-04-refused-request.png)
5. [Autonomous offer](screenshots/goal-005/chromium-mobile-05-npc-initiated-offer.png)
6. [Naturally recruited second member](screenshots/goal-005/chromium-mobile-06-second-member.png)
7. [Completion and consequences](screenshots/goal-005/chromium-mobile-07-completed-assignment.png)

## Limits

This milestone deliberately keeps the existing three broad skills, abstract criminal activity and simple appointments. It adds no new crime catalog, faction, territory control, artwork, skill tree, labor-market simulation or passive-income business. Offers cover paid gigs, introductions and social invitations rather than authored personal quest chains. Independent actions remain concise simulation events; they do not each generate an interruption. Physical iPhone creator playtesting remains distinct from automated WebKit device emulation.

## Deployment evidence

The initial feature-branch dispatch built and tested successfully, but GitHub rejected its deployment: `Branch "goal-005-crew-agency" is not allowed to deploy to github-pages due to environment protection rules.`

As authorized, default-branch commit `464f0e3` adds only `.github/workflows/preview-goal-005.yml`. That workflow checks out the unmerged development branch, tests it, builds `/Hood-Hero/` and publishes through the existing Pages actions. GOAL 005 gameplay was not merged into main. [Deployment run 41407832912](https://github.com/kalikeefbiz/Hood-Hero/actions/runs/41407832912) succeeded on November 2, 2026.

Public Chromium and WebKit checks verified build metadata identifying **GOAL 005 / schema 5 / `2406f29dea0125d559a92f36763967d792993199`**, then played work, refusal, natural recruitment, an autonomous invitation and a real appointment. In both engines, Flacco offered a shared gig on day 7; the player attended on day 8. Robin occupied the naturally earned second slot. Saved assignments and membership survived reload; there were no script errors or failed game assets. See `GOAL_005_LIVE.json`, the live verification script, and `live-*` screenshots.

Validation at this stage: **110 Vitest tests passed**, including the new conflict and no-show cases, and **18 × 60-day campaigns passed**. The initial complete 84-case browser matrix passed 79 cases; four legacy cases still assumed that no independent character could initiate a conversation after The Chains, and one WebKit all-home tour hit its local timeout during concurrent validation. The four cases now decline legitimate crew offers while continuing to assert no repeated Chains scenes. Focused reruns and final production-path results are recorded with the final evidence below. The local unit run used a 20-second per-test allowance during simultaneous browser validation; the standard default test command also passed in both deployment builds.

The follow-up deployment encountered a 5-second Vitest timeout in the existing 160-day simulation (5.17 seconds on that runner). Its assertions and 160-day coverage are unchanged; that long campaign now receives the same 20-second allowance used for the heavier simulation checks. All six focused browser reruns passed, covering the corrected 40-day scenarios in both engines and both all-home tours. No gameplay change was needed for those browser failures.


## Final validation and handoff

Review PR: https://github.com/kalikeefbiz/Hood-Hero/pull/4 . Gameplay commit `4e4fc6fe72340d6301ab03faad3b4c8f11e15bf0` was published by [successful run 41409020871](https://github.com/kalikeefbiz/Hood-Hero/actions/runs/41409020871). The final evidence commit republishes this same implementation; `build-info.json` identifies the served commit. The PR checks link to the complete CI runs.

| Check | Result |
| --- | --- |
| Vitest | 111 passed; six files |
| Complete browser coverage | All 84 distinct Chromium/WebKit scenarios passed across the initial matrix and focused reruns; initial failure details are retained |
| Focused regression reruns | 6 passed, including both 40-day outcome paths and both all-home tours |
| Final `/Hood-Hero/` browser suite | 20 passed: crew and employment in Chromium and WebKit, all four mobile widths, real offers, natural recruitment and 30-day employment |
| Seeded composition campaigns | 18 passed / 1,080 additional days; plus the unit suite's six seeded 60-day campaigns |
| Production build | TypeScript and Vite passed with the Pages base path |
| Public site | Chromium and WebKit both passed actual work, refusal, recruitment, an autonomous day-7 offer, day-8 attendance and saved consequences; no game-script or asset failures |

`GOAL_005_LIVE.json` records the final gameplay commit's public verification; `GOAL_005_BROWSER_PAGES.txt`, `GOAL_005_BROWSER_REGRESSION.txt`, `GOAL_005_VITEST.txt`, `GOAL_005_CAMPAIGNS.json` and `GOAL_005_DEPLOYMENT.json` contain reproducible evidence. The seven required screenshot subjects are available for each engine, with six additional public-site captures. GOAL 005 remains unmerged for creator playtesting.


Final lifecycle review added immediate invitation expiration during encounter synchronization. Removal, incapacitation, a newly conflicting obligation or an ended run now withdraws an ineligible pending invitation immediately, so the Set cannot show an unusable invitation until the next day. A real seeded removal/re-recruitment regression verifies that the offer stays expired and its cooldown and memories persist. The resulting **111-test default Vitest run** and all **18 campaigns** passed again; the crew browser journeys were rerun against the Pages build.
