# GOAL 004 — Employment, Survival & Economic Commitments

Branch: `goal-004-employment-survival`.
Playable URL: https://kalikeefbiz.github.io/Hood-Hero/

## Integration

Accepted GOAL 003, through `116aa27`, was merged into main as `05eec0e40049cd18272cc63a99c79fbff0f70afa` before employment implementation began. No conflicts or integration blocker. Main's full validation workflow passed: https://github.com/kalikeefbiz/Hood-Hero/actions/runs/41393090050 . GOAL 004 remains a separate review branch for creator playtesting.

## Employment loop

Players start unemployed with $125 and two daily AP. Apply (1 AP), review an offer, and accept (0 AP). Applying never earns wages. Hiring creates an actor-addressed employment record and directional employer relationship, using ordinary existing neighborhood residents as hiring contacts. Retail needs work/social 30; warehouse needs work 40. Location and known contacts govern retail access; warehouse is available citywide. Commute is included in the full shift.

| Starting work | Schedule (day 1 = Monday) | AP | Lawful pay |
| --- | --- | --- | --- |
| Neighborhood retail | Tue / Thu / Sat | 2 / shift | $96 |
| Warehouse assistant | Mon / Wed / Fri | 2 / shift | $96 |
| Local gig | One opportunity per day in the home neighborhood | 1 | $38 |

Retail exists in each of the five starting neighborhoods. A job's first shift is after the hiring day. Three upcoming dates are calculated for display; only today's actual obligation is materialized. Existing commitments gain an `employment-shift` kind and employment reference. Historical obligations are retained; future shifts are not preallocated.

Each attended shift records one attendance entry, pays once, grants work skill and legitimacy, improves employer trust and reliability, and adds 8 stress. Six worked shifts at reliability 75+ with no formal warnings yield a single $8 raise, to $104. Performance also records resolving workplace pressure. Ordinary lawful work never requires consumables or a minigame.

A missed shift forfeits pay, loses 18 reliability, and damages the employer's opinion. Two absences in the latest five scheduled shifts bring a formal warning; three bring termination. End day warns before the choice, and can be cancelled or confirmed. Critical termination notices take precedence over ordinary major notices; routine wages stay in the lower event tier. Thresholds live in balance configuration.

Time off excuses today's scheduled shift without pay, at most once per seven days. Resignation releases pending obligations, retains employment history, reduces trust, and pauses applications for three days. The same workplace has a seven-day rehire restriction. Firing blocks all formal applications for seven days; offers are cleared and no future wages or shifts are generated. Reliability carries forward, capped at 60, when rehired. Gigs remain available throughout. Application limits, offer validation, leave limits, shift evidence, and persistent history prevent repeat-click and quit/reapply resets.

## Roleplaying and wider simulation

Most shifts resolve through a concise result. Seeded occasional workplace scenes use the existing City character modal: a delivery-count problem (extra stress/performance versus reduced reliability), helping Flacco with a local delivery (directional trust and stress), or a reliable employee's extra task (+$18 / +10 stress). No new character histories or artwork. Clock In keeps its approved illustration. Scenes close after response, can be deferred and resumed from City, and offer an explicit skip with a disclosed default consequence. End day applies that same default once. Base wages and attendance are committed independently of presentation; reopening or skipping cannot duplicate them.

Scheduled work consumes the same AP needed for The Chains. Tests compare working first and funding the buyback the next day against pursuing the buyback on a workday and recording an absence. Promise fulfillment, Mega's memories, group custody, criminal exposure, purchases, Set errands, and faction progression retain their existing resolvers. Crime does not automatically fire the employee.

Three $96 shifts provide $288 each seven-day cycle against $126 living costs, or $162 before other spending. Seven gigs provide $266, or $140 after living costs. Employment leaves four non-shift days for other activity, including one gig on each; after the raise, regular wages total $312 weekly. Insufficient money uses the existing stress/shortfall behavior; wallets cannot go negative.

Wallet, Actions, and City show employment status, dates, wages, reliability, warnings, employer trust, lawful income, and recent job endings. Activity records offers, hiring, wages, absences, discipline, raises, leave, resignation, and termination. Employment data is actor-addressed for later NPC support; no NPC labor market is introduced.

## Save policy

Schema 4 intentionally rejects disposable older Test saves with an explanatory message. Current saves validate and preserve employment records, attendance evidence, employer relationships/memories, obligations, scenes, offered jobs, daily gig use, warnings, and cooldowns. No migrations were added.

## Validation

Validation logs and browser screenshots are in `docs/validation/GOAL_004_*` and `docs/screenshots/goal-004/`. The suite includes 35-day simulations across four seeds and five strategies (700 simulated days): steady work, gig-only survival, repeated unemployment, firing/reapplication, and occasional criminal activity mixed with lawful work. Every transition is compared with a save/load deterministic replay. Additional tests cover all neighborhoods, warehouse eligibility, AP, duplicate wages, expenses, progression, leave, resignation, rolling attendance, cooldown persistence, directional coworker trust, scene skip/default/choice idempotency, and The Chains tradeoffs.

Browser tests perform real UI hiring and 30-day reliable work, plus firing, cooldown, gig survival, reapplication, scene choices, dismissal, resume, save/load, and no repeated scenes. Existing regression coverage includes Chains dialogue/promise outcomes/portraits, 40-day non-repetition, faction activity, Set management, accessibility, narrow phones and desktop. Root and `/Hood-Hero/` builds are validated in Chromium and WebKit.

Live verification checks `build-info.json` against the deployed commit and schema 4, then drives public-site hiring, saved $96 wages, three absences, firing, cooldown, and $38 gig survival in both browser engines. A successful Pages deployment and actual public browser run are required; build success alone does not establish live completion.

## Scope and remaining limitations

No debt, new crime mechanics, incarceration mechanics, new factions, art, mandatory minigames, business ownership, or career hierarchy. NPC labor-market scheduling remains future work as requested. Workplace content is deliberately small and reusable; ordinary gigs are a predictable once-daily local opportunity. Approved leave is requested on the scheduled day in this first implementation. Physical iPhone creator testing remains the next human review step; automated WebKit emulation does not claim physical-device testing.

## Delivery evidence

- Vitest: **89/89 passed**, including the 700-day strategy/replay matrix.
- Final local production-path browser run: **20/20 passed**, Chromium and WebKit, using `/Hood-Hero/`. Each engine completed day 31 with no absences and the $104 wage. Firing/cooldown/reapplication, resume/skip/scene closure, actual Chains/AP tradeoffs, artwork, City, save/load and controls also passed.
- The preliminary full root run passed 69 cases; its WebKit long playthrough hit a 120-second fixture limit at day 28. The fixture now allows 180 seconds and the complete final WebKit playthrough passed in 2.3 minutes. The timeout was not a gameplay failure. Long simulation fixtures likewise allow CPU contention without reducing days or assertions.
- Implementation CI: https://github.com/kalikeefbiz/Hood-Hero/actions/runs/41394765521 . This runs the full root suite and the production-path regression/encounter/employment suite on standard Chromium and WebKit installations. The PR shows checks for the final evidence commit as well.
- Initial deployment: https://github.com/kalikeefbiz/Hood-Hero/actions/runs/41394778193 . The public build identified implementation `398615df2e3f12628867001e3ad2a21c86b33783`, schema 4. Both engines then drove public hiring, saved wages, three missed shifts, termination, a persisted hiring restriction, and gig income with zero script or asset errors; see `GOAL_004_LIVE.json`. The final evidence commit is republished through the same workflow, with the exact served commit independently checked again at handoff.
- Twenty-four screenshots include job search, acceptance/schedule, first wages, reliable progression, scheduled attendance choices, firing, hiring restrictions, workplace dialogue/conclusion, Chains tradeoffs, and public-site hiring/termination in both engines. Original accepted GOAL 003 screenshot files are preserved.

The live build identity can always be checked at https://kalikeefbiz.github.io/Hood-Hero/build-info.json . No outstanding gameplay blockers are known. Creator testing on a physical iPhone is still required before merging GOAL 004.
