# Complete GOAL 009 browser run

Historical broad-suite run before the first-arrival/known-location correction. Case line numbers refer to that implementation build. Current correction checks are recorded in [validation](GOAL_009_VALIDATION.md).

`PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1 npm run test:e2e -- --workers=2`

Both projects use the configured iPhone 13 profile against local Vite preview. No tests are excluded.

| Browser | Passed | Failed |
| --- | ---: | ---: |
| chromium-mobile | 53 | 23 |
| webkit-mobile | 52 | 24 |

## Failing cases

Baseline confirmation below means the exact case was independently reproduced in Chromium on untouched GOAL 008 commit `4024f35`. A corresponding WebKit failure is listed independently; its baseline engine was not rerun. Cases marked unverified are not claimed to be pre-existing.

| Browser | Case | Result | GOAL 008 comparison |
| --- | --- | --- | --- |
| chromium-mobile | `city-menu.spec.ts:31` | City centers the five state-backed neighborhoods and keeps actions in Actions (34.0s) | Confirmed on Chromium |
| chromium-mobile | `city-menu.spec.ts:160` | storyline uses the active demand and opens its existing City conversation (32.5s) | Confirmed on Chromium |
| chromium-mobile | `city-menu.spec.ts:202` | City activity preserves visible history, reverse chronology, day groups, limits and filters (33.0s) | Confirmed on Chromium |
| chromium-mobile | `corrections.spec.ts:163` | active Chains lives in City; fulfillment leaves only completed history (1.9m) | Confirmed on Chromium |
| chromium-mobile | `crew.spec.ts:133` | independent offer: inspect, accept, attend, decline and expire while the NPC keeps acting (2.2m) | Confirmed on Chromium |
| chromium-mobile | `employment.spec.ts:154` | absence warning can be cancelled; repeated absences fire and gigs survive cooldown (34.3s) | Confirmed on Chromium |
| chromium-mobile | `employment.spec.ts:203` | workplace scene consequence, skip, close and no replay across tabs or reload (33.6s) | Confirmed on Chromium |
| chromium-mobile | `employment.spec.ts:90` | hire, scheduled wages, save and a thirty-day employment playthrough (3.3m) | Unverified |
| chromium-mobile | `encounters.spec.ts:74` | true City modal, sequential questions, promise closure, queued fulfillment, history and Resume (33.2s) | Unverified |
| chromium-mobile | `employment.spec.ts:258` | employment competes with The Chains through actual AP, wages, attendance and promises (2.5m) | Unverified |
| chromium-mobile | `encounters.spec.ts:176` | refusing, postponing, Escape and backdrop leave no accidental obligation or daily reopening (34.8s) | Unverified |
| chromium-mobile | `encounters.spec.ts:211` | 40 days after fulfilled: one storyline reaction while independent offers continue (3.7m) | Unverified |
| chromium-mobile | `encounters.spec.ts:426` | all homes and affiliation themes retain the City-only modal and normal navigation (34.5s) | Unverified |
| chromium-mobile | `mobile.spec.ts:42` | phone gameplay: contact, lawful income, days, save and load (36.3s) | Unverified |
| chromium-mobile | `mobile.spec.ts:84` | buyback resolves the incident and the ordinary loop remains playable (34.7s) | Unverified |
| chromium-mobile | `overhaul.spec.ts:58` | all approved scenes load; every home starts independent and map selection cannot change affiliation (34.3s) | Unverified |
| chromium-mobile | `overhaul.spec.ts:172` | all destinations fit 320/375/390/430 and desktop, including long names and every dock target (31.0s) | Unverified |
| chromium-mobile | `strategy.spec.ts:49` | actual local investment, contested map, autonomous decisions and persisted continuation (33.3s) | Unverified |
| chromium-mobile | `strategy.spec.ts:145` | business acquisition, real operating income, sale, and voluntary retirement (32.8s) | Unverified |
| chromium-mobile | `street.spec.ts:240` | seeded real-play arrest serves every day and releases into continued gameplay (203ms) | Confirmed on Chromium |
| chromium-mobile | `street.spec.ts:293` | default reaction and accumulated heat are rendered from real simulated consequences (12.8s) | Confirmed on Chromium |
| chromium-mobile | `street.spec.ts:143` | supplier to inventory to multiple real sales and repayment through normal mobile controls (1.7m) | Unverified |
| chromium-mobile | `visual-correction.spec.ts:9` | GOAL 002B mandatory visual review: new run, independent and Blips at 390 (39.6s) | Unverified |
| webkit-mobile | `city-menu.spec.ts:160` | storyline uses the active demand and opens its existing City conversation (31.0s) | Confirmed on Chromium |
| webkit-mobile | `corrections.spec.ts:163` | active Chains lives in City; fulfillment leaves only completed history (1.6m) | Confirmed on Chromium |
| webkit-mobile | `crew.spec.ts:133` | independent offer: inspect, accept, attend, decline and expire while the NPC keeps acting (2.0m) | Confirmed on Chromium |
| webkit-mobile | `employment.spec.ts:154` | absence warning can be cancelled; repeated absences fire and gigs survive cooldown (30.9s) | Confirmed on Chromium |
| webkit-mobile | `employment.spec.ts:203` | workplace scene consequence, skip, close and no replay across tabs or reload (31.0s) | Confirmed on Chromium |
| webkit-mobile | `employment.spec.ts:90` | hire, scheduled wages, save and a thirty-day employment playthrough (3.1m) | Unverified |
| webkit-mobile | `employment.spec.ts:258` | employment competes with The Chains through actual AP, wages, attendance and promises (2.1m) | Unverified |
| webkit-mobile | `encounters.spec.ts:74` | true City modal, sequential questions, promise closure, queued fulfillment, history and Resume (31.2s) | Unverified |
| webkit-mobile | `encounters.spec.ts:176` | refusing, postponing, Escape and backdrop leave no accidental obligation or daily reopening (30.9s) | Unverified |
| webkit-mobile | `encounters.spec.ts:211` | 40 days after fulfilled: one storyline reaction while independent offers continue (3.0m) | Unverified |
| webkit-mobile | `encounters.spec.ts:211` | 40 days after broken: one storyline reaction while independent offers continue (3.0m) | Unverified |
| webkit-mobile | `encounters.spec.ts:426` | all homes and affiliation themes retain the City-only modal and normal navigation (31.1s) | Unverified |
| webkit-mobile | `illustrated.spec.ts:131` | action art loads near the viewport, and failed art preserves layout and gameplay (32.5s) | Unverified |
| webkit-mobile | `mobile.spec.ts:42` | phone gameplay: contact, lawful income, days, save and load (30.8s) | Unverified |
| webkit-mobile | `mobile.spec.ts:84` | buyback resolves the incident and the ordinary loop remains playable (31.2s) | Unverified |
| webkit-mobile | `overhaul.spec.ts:58` | all approved scenes load; every home starts independent and map selection cannot change affiliation (31.2s) | Unverified |
| webkit-mobile | `overhaul.spec.ts:172` | all destinations fit 320/375/390/430 and desktop, including long names and every dock target (31.3s) | Unverified |
| webkit-mobile | `overhaul.spec.ts:284` | negotiated demand comes from state; ended and damaged saves remain inspectable and safe (30.7s) | Unverified |
| webkit-mobile | `strategy.spec.ts:49` | actual local investment, contested map, autonomous decisions and persisted continuation (31.2s) | Unverified |
| webkit-mobile | `strategy.spec.ts:145` | business acquisition, real operating income, sale, and voluntary retirement (32.9s) | Unverified |
| webkit-mobile | `review.spec.ts:9` | review captures and WCAG checks cover every M1 screen and faction palette (2.1m) | Unverified |
| webkit-mobile | `street.spec.ts:240` | seeded real-play arrest serves every day and releases into continued gameplay (927ms) | Confirmed on Chromium |
| webkit-mobile | `street.spec.ts:293` | default reaction and accumulated heat are rendered from real simulated consequences (16.8s) | Confirmed on Chromium |
| webkit-mobile | `visual-correction.spec.ts:9` | GOAL 002B mandatory visual review: new run, independent and Blips at 390 (31.1s) | Unverified |

## Every completed case

- PASS · chromium-mobile · `board.spec.ts:130` · lab saves never touch production keys and The Reservoir is spelled right (17.9s)
- FAIL · chromium-mobile · `city-menu.spec.ts:31` · City centers the five state-backed neighborhoods and keeps actions in Actions (34.0s)
- FAIL · chromium-mobile · `city-menu.spec.ts:160` · storyline uses the active demand and opens its existing City conversation (32.5s)
- PASS · chromium-mobile · `board.spec.ts:40` · the player lives on the board: walks to places, acts there, and their location is saved (1.6m)
- FAIL · chromium-mobile · `city-menu.spec.ts:202` · City activity preserves visible history, reverse chronology, day groups, limits and filters (33.0s)
- PASS · chromium-mobile · `corrections.spec.ts:55` · Actions separate Streets, Honest and Connects; completed reach-out returns to Streets (45.5s)
- PASS · chromium-mobile · `corrections.spec.ts:105` · known suspects and leaders need real introductions; access and inventory survive reload (58.8s)
- PASS · chromium-mobile · `corrections.spec.ts:191` · all three categories and inventory fit 320px (17.6s)
- PASS · chromium-mobile · `corrections.spec.ts:191` · all three categories and inventory fit 375px (15.5s)
- PASS · chromium-mobile · `corrections.spec.ts:191` · all three categories and inventory fit 390px (17.5s)
- PASS · chromium-mobile · `corrections.spec.ts:191` · all three categories and inventory fit 430px (18.3s)
- FAIL · chromium-mobile · `corrections.spec.ts:163` · active Chains lives in City; fulfillment leaves only completed history (1.9m)
- PASS · chromium-mobile · `crew.spec.ts:46` · Flacco cooperation, paid work, refusal, natural second recruitment and saved consequences (1.4m)
- PASS · chromium-mobile · `crew.spec.ts:198` · crew dialogue and Set fit 320px (14.7s)
- PASS · chromium-mobile · `crew.spec.ts:198` · crew dialogue and Set fit 375px (14.1s)
- PASS · chromium-mobile · `crew.spec.ts:198` · crew dialogue and Set fit 390px (14.5s)
- PASS · chromium-mobile · `crew.spec.ts:198` · crew dialogue and Set fit 430px (17.3s)
- FAIL · chromium-mobile · `crew.spec.ts:133` · independent offer: inspect, accept, attend, decline and expire while the NPC keeps acting (2.2m)
- PASS · chromium-mobile · `danger.spec.ts:101` · a recognized war member can be injured directly; recovery advances city time and preserves consequences (13.9s)
- PASS · chromium-mobile · `danger.spec.ts:49` · board street conversation: choices, persistent grievance, menus cannot reroll, reload (39.4s)
- PASS · chromium-mobile · `danger.spec.ts:153` · terminal conflict death ends activity and manual load can restore the earlier checkpoint (11.5s)
- PASS · chromium-mobile · `danger.spec.ts:198` · a meaningful Wallet activity opens a contextual street conversation on the City board (12.2s)
- FAIL · chromium-mobile · `employment.spec.ts:154` · absence warning can be cancelled; repeated absences fire and gigs survive cooldown (34.3s)
- FAIL · chromium-mobile · `employment.spec.ts:203` · workplace scene consequence, skip, close and no replay across tabs or reload (33.6s)
- FAIL · chromium-mobile · `employment.spec.ts:90` · hire, scheduled wages, save and a thirty-day employment playthrough (3.3m)
- FAIL · chromium-mobile · `encounters.spec.ts:74` · true City modal, sequential questions, promise closure, queued fulfillment, history and Resume (33.2s)
- FAIL · chromium-mobile · `employment.spec.ts:258` · employment competes with The Chains through actual AP, wages, attendance and promises (2.5m)
- FAIL · chromium-mobile · `encounters.spec.ts:176` · refusing, postponing, Escape and backdrop leave no accidental obligation or daily reopening (34.8s)
- PASS · chromium-mobile · `encounters.spec.ts:211` · 40 days after broken: one storyline reaction while independent offers continue (2.8m)
- PASS · chromium-mobile · `encounters.spec.ts:280` · modal touch controls, focus and scrolling at 320px (11.3s)
- PASS · chromium-mobile · `encounters.spec.ts:280` · modal touch controls, focus and scrolling at 375px (11.2s)
- PASS · chromium-mobile · `encounters.spec.ts:280` · modal touch controls, focus and scrolling at 390px (9.5s)
- PASS · chromium-mobile · `encounters.spec.ts:280` · modal touch controls, focus and scrolling at 430px (10.9s)
- FAIL · chromium-mobile · `encounters.spec.ts:211` · 40 days after fulfilled: one storyline reaction while independent offers continue (3.7m)
- PASS · chromium-mobile · `encounters.spec.ts:314` · activity preserves chronology, true faction IDs, severity, private knowledge and routine detail (5.6s)
- PASS · chromium-mobile · `encounters.spec.ts:384` · queued simultaneous encounters are acknowledged in sequence without duplicate outcome banners (11.3s)
- PASS · chromium-mobile · `illustrated.spec.ts:82` · approved art maps to real actions and resolves under the production base (23.4s)
- FAIL · chromium-mobile · `encounters.spec.ts:426` · all homes and affiliation themes retain the City-only modal and normal navigation (34.5s)
- PASS · chromium-mobile · `illustrated.spec.ts:131` · action art loads near the viewport, and failed art preserves layout and gameplay (29.5s)
- PASS · chromium-mobile · `illustrated.spec.ts:189` · GOAL 002C mobile visual review and usable narrow controls (53.6s)
- FAIL · chromium-mobile · `mobile.spec.ts:42` · phone gameplay: contact, lawful income, days, save and load (36.3s)
- PASS · chromium-mobile · `mobile.spec.ts:126` · mobile city and new game remain readable at narrow widths (12.6s)
- FAIL · chromium-mobile · `mobile.spec.ts:84` · buyback resolves the incident and the ordinary loop remains playable (34.7s)
- PASS · chromium-mobile · `overhaul.spec.ts:111` · valid sponsored angels membership keeps the shell neutral and survives checkpoint reload (23.0s)
- FAIL · chromium-mobile · `overhaul.spec.ts:58` · all approved scenes load; every home starts independent and map selection cannot change affiliation (34.3s)
- PASS · chromium-mobile · `overhaul.spec.ts:111` · valid sponsored blips membership keeps the shell neutral and survives checkpoint reload (19.8s)
- PASS · chromium-mobile · `overhaul.spec.ts:111` · valid sponsored muds membership keeps the shell neutral and survives checkpoint reload (19.8s)
- PASS · chromium-mobile · `overhaul.spec.ts:111` · valid sponsored backstreet membership keeps the shell neutral and survives checkpoint reload (19.8s)
- PASS · chromium-mobile · `overhaul.spec.ts:111` · valid sponsored blocks membership keeps the shell neutral and survives checkpoint reload (17.4s)
- PASS · chromium-mobile · `overhaul.spec.ts:203` · Actions update cash/AP, explain disabled prerequisites, and autosave (12.4s)
- PASS · chromium-mobile · `overhaul.spec.ts:237` · directional trust, witnessed events, activity filters and day grouping preserve visibility (15.7s)
- FAIL · chromium-mobile · `overhaul.spec.ts:172` · all destinations fit 320/375/390/430 and desktop, including long names and every dock target (31.0s)
- PASS · chromium-mobile · `overhaul.spec.ts:284` · negotiated demand comes from state; ended and damaged saves remain inspectable and safe (28.5s)
- PASS · chromium-mobile · `quanny.spec.ts:68` · intentional board visit introduces Quanny once, fronts physical stock and persists on reload (25.9s)
- PASS · chromium-mobile · `quanny.spec.ts:117` · board collection at notoriety 34 records the correct permanent outcome (8.3s)
- PASS · chromium-mobile · `quanny.spec.ts:117` · board collection at notoriety 35 records the correct permanent outcome (12.4s)
- PASS · chromium-mobile · `quanny.spec.ts:147` · false BB dismissal reveals no private intention and cannot be rerolled by reloading (8.6s)
- PASS · chromium-mobile · `quanny.spec.ts:172` · Angels first-contact shooting uses hospital presentation and persists its nonfatal outcome (5.5s)
- FAIL · chromium-mobile · `strategy.spec.ts:49` · actual local investment, contested map, autonomous decisions and persisted continuation (33.3s)
- PASS · chromium-mobile · `strategy.spec.ts:97` · simulation-resolved control change and council succession progression (17.5s)
- PASS · chromium-mobile · `strategy.spec.ts:119` · earned affiliation authority restriction and advancement use existing sponsorship (12.9s)
- PASS · chromium-mobile · `review.spec.ts:9` · review captures and WCAG checks cover every M1 screen and faction palette (1.5m)
- PASS · chromium-mobile · `strategy.spec.ts:179` · strategy, organization and businesses fit 320px (10.3s)
- FAIL · chromium-mobile · `strategy.spec.ts:145` · business acquisition, real operating income, sale, and voluntary retirement (32.8s)
- PASS · chromium-mobile · `strategy.spec.ts:179` · strategy, organization and businesses fit 375px (10.7s)
- PASS · chromium-mobile · `strategy.spec.ts:179` · strategy, organization and businesses fit 390px (11.0s)
- PASS · chromium-mobile · `strategy.spec.ts:179` · strategy, organization and businesses fit 430px (11.7s)
- FAIL · chromium-mobile · `street.spec.ts:240` · seeded real-play arrest serves every day and releases into continued gameplay (203ms)
- FAIL · chromium-mobile · `street.spec.ts:293` · default reaction and accumulated heat are rendered from real simulated consequences (12.8s)
- PASS · chromium-mobile · `street.spec.ts:313` · crew-assisted street work uses an earned willing partner and actual inventory (16.7s)
- PASS · chromium-mobile · `street.spec.ts:330` · street inventory and supplier modal fit 320px (12.7s)
- PASS · chromium-mobile · `street.spec.ts:330` · street inventory and supplier modal fit 375px (12.9s)
- PASS · chromium-mobile · `street.spec.ts:330` · street inventory and supplier modal fit 390px (12.8s)
- PASS · chromium-mobile · `street.spec.ts:330` · street inventory and supplier modal fit 430px (12.7s)
- FAIL · chromium-mobile · `street.spec.ts:143` · supplier to inventory to multiple real sales and repayment through normal mobile controls (1.7m)
- FAIL · chromium-mobile · `visual-correction.spec.ts:9` · GOAL 002B mandatory visual review: new run, independent and Blips at 390 (39.6s)
- PASS · webkit-mobile · `board.spec.ts:130` · lab saves never touch production keys and The Reservoir is spelled right (10.7s)
- PASS · webkit-mobile · `board.spec.ts:40` · the player lives on the board: walks to places, acts there, and their location is saved (52.4s)
- PASS · webkit-mobile · `city-menu.spec.ts:31` · City centers the five state-backed neighborhoods and keeps actions in Actions (28.5s)
- FAIL · webkit-mobile · `city-menu.spec.ts:160` · storyline uses the active demand and opens its existing City conversation (31.0s)
- PASS · webkit-mobile · `city-menu.spec.ts:202` · City activity preserves visible history, reverse chronology, day groups, limits and filters (16.8s)
- PASS · webkit-mobile · `corrections.spec.ts:55` · Actions separate Streets, Honest and Connects; completed reach-out returns to Streets (32.0s)
- PASS · webkit-mobile · `corrections.spec.ts:105` · known suspects and leaders need real introductions; access and inventory survive reload (1.1m)
- PASS · webkit-mobile · `corrections.spec.ts:191` · all three categories and inventory fit 320px (26.8s)
- PASS · webkit-mobile · `corrections.spec.ts:191` · all three categories and inventory fit 375px (30.0s)
- FAIL · webkit-mobile · `corrections.spec.ts:163` · active Chains lives in City; fulfillment leaves only completed history (1.6m)
- PASS · webkit-mobile · `corrections.spec.ts:191` · all three categories and inventory fit 390px (25.6s)
- PASS · webkit-mobile · `corrections.spec.ts:191` · all three categories and inventory fit 430px (31.0s)
- PASS · webkit-mobile · `crew.spec.ts:46` · Flacco cooperation, paid work, refusal, natural second recruitment and saved consequences (1.6m)
- PASS · webkit-mobile · `crew.spec.ts:198` · crew dialogue and Set fit 320px (21.8s)
- FAIL · webkit-mobile · `crew.spec.ts:133` · independent offer: inspect, accept, attend, decline and expire while the NPC keeps acting (2.0m)
- PASS · webkit-mobile · `crew.spec.ts:198` · crew dialogue and Set fit 375px (19.6s)
- PASS · webkit-mobile · `crew.spec.ts:198` · crew dialogue and Set fit 390px (19.9s)
- PASS · webkit-mobile · `crew.spec.ts:198` · crew dialogue and Set fit 430px (21.7s)
- PASS · webkit-mobile · `danger.spec.ts:101` · a recognized war member can be injured directly; recovery advances city time and preserves consequences (13.0s)
- PASS · webkit-mobile · `danger.spec.ts:153` · terminal conflict death ends activity and manual load can restore the earlier checkpoint (11.9s)
- PASS · webkit-mobile · `danger.spec.ts:49` · board street conversation: choices, persistent grievance, menus cannot reroll, reload (31.8s)
- PASS · webkit-mobile · `danger.spec.ts:198` · a meaningful Wallet activity opens a contextual street conversation on the City board (12.9s)
- FAIL · webkit-mobile · `employment.spec.ts:154` · absence warning can be cancelled; repeated absences fire and gigs survive cooldown (30.9s)
- FAIL · webkit-mobile · `employment.spec.ts:203` · workplace scene consequence, skip, close and no replay across tabs or reload (31.0s)
- FAIL · webkit-mobile · `employment.spec.ts:90` · hire, scheduled wages, save and a thirty-day employment playthrough (3.1m)
- FAIL · webkit-mobile · `employment.spec.ts:258` · employment competes with The Chains through actual AP, wages, attendance and promises (2.1m)
- FAIL · webkit-mobile · `encounters.spec.ts:74` · true City modal, sequential questions, promise closure, queued fulfillment, history and Resume (31.2s)
- FAIL · webkit-mobile · `encounters.spec.ts:176` · refusing, postponing, Escape and backdrop leave no accidental obligation or daily reopening (30.9s)
- FAIL · webkit-mobile · `encounters.spec.ts:211` · 40 days after fulfilled: one storyline reaction while independent offers continue (3.0m)
- FAIL · webkit-mobile · `encounters.spec.ts:211` · 40 days after broken: one storyline reaction while independent offers continue (3.0m)
- PASS · webkit-mobile · `encounters.spec.ts:280` · modal touch controls, focus and scrolling at 320px (14.6s)
- PASS · webkit-mobile · `encounters.spec.ts:280` · modal touch controls, focus and scrolling at 375px (17.1s)
- PASS · webkit-mobile · `encounters.spec.ts:280` · modal touch controls, focus and scrolling at 390px (16.8s)
- PASS · webkit-mobile · `encounters.spec.ts:314` · activity preserves chronology, true faction IDs, severity, private knowledge and routine detail (10.5s)
- PASS · webkit-mobile · `encounters.spec.ts:280` · modal touch controls, focus and scrolling at 430px (14.6s)
- PASS · webkit-mobile · `encounters.spec.ts:384` · queued simultaneous encounters are acknowledged in sequence without duplicate outcome banners (12.4s)
- FAIL · webkit-mobile · `encounters.spec.ts:426` · all homes and affiliation themes retain the City-only modal and normal navigation (31.1s)
- PASS · webkit-mobile · `illustrated.spec.ts:82` · approved art maps to real actions and resolves under the production base (26.8s)
- FAIL · webkit-mobile · `illustrated.spec.ts:131` · action art loads near the viewport, and failed art preserves layout and gameplay (32.5s)
- PASS · webkit-mobile · `illustrated.spec.ts:189` · GOAL 002C mobile visual review and usable narrow controls (49.2s)
- FAIL · webkit-mobile · `mobile.spec.ts:42` · phone gameplay: contact, lawful income, days, save and load (30.8s)
- PASS · webkit-mobile · `mobile.spec.ts:126` · mobile city and new game remain readable at narrow widths (13.3s)
- FAIL · webkit-mobile · `mobile.spec.ts:84` · buyback resolves the incident and the ordinary loop remains playable (31.2s)
- PASS · webkit-mobile · `overhaul.spec.ts:111` · valid sponsored angels membership keeps the shell neutral and survives checkpoint reload (21.9s)
- FAIL · webkit-mobile · `overhaul.spec.ts:58` · all approved scenes load; every home starts independent and map selection cannot change affiliation (31.2s)
- PASS · webkit-mobile · `overhaul.spec.ts:111` · valid sponsored blips membership keeps the shell neutral and survives checkpoint reload (20.7s)
- PASS · webkit-mobile · `overhaul.spec.ts:111` · valid sponsored muds membership keeps the shell neutral and survives checkpoint reload (22.5s)
- PASS · webkit-mobile · `overhaul.spec.ts:111` · valid sponsored backstreet membership keeps the shell neutral and survives checkpoint reload (22.3s)
- PASS · webkit-mobile · `overhaul.spec.ts:111` · valid sponsored blocks membership keeps the shell neutral and survives checkpoint reload (21.9s)
- PASS · webkit-mobile · `overhaul.spec.ts:203` · Actions update cash/AP, explain disabled prerequisites, and autosave (17.2s)
- FAIL · webkit-mobile · `overhaul.spec.ts:172` · all destinations fit 320/375/390/430 and desktop, including long names and every dock target (31.3s)
- PASS · webkit-mobile · `overhaul.spec.ts:237` · directional trust, witnessed events, activity filters and day grouping preserve visibility (13.6s)
- FAIL · webkit-mobile · `overhaul.spec.ts:284` · negotiated demand comes from state; ended and damaged saves remain inspectable and safe (30.7s)
- PASS · webkit-mobile · `quanny.spec.ts:68` · intentional board visit introduces Quanny once, fronts physical stock and persists on reload (26.1s)
- PASS · webkit-mobile · `quanny.spec.ts:117` · board collection at notoriety 35 records the correct permanent outcome (13.2s)
- PASS · webkit-mobile · `quanny.spec.ts:117` · board collection at notoriety 34 records the correct permanent outcome (14.5s)
- PASS · webkit-mobile · `quanny.spec.ts:147` · false BB dismissal reveals no private intention and cannot be rerolled by reloading (13.7s)
- PASS · webkit-mobile · `quanny.spec.ts:172` · Angels first-contact shooting uses hospital presentation and persists its nonfatal outcome (14.1s)
- FAIL · webkit-mobile · `strategy.spec.ts:49` · actual local investment, contested map, autonomous decisions and persisted continuation (31.2s)
- PASS · webkit-mobile · `strategy.spec.ts:97` · simulation-resolved control change and council succession progression (23.0s)
- PASS · webkit-mobile · `strategy.spec.ts:119` · earned affiliation authority restriction and advancement use existing sponsorship (15.2s)
- FAIL · webkit-mobile · `strategy.spec.ts:145` · business acquisition, real operating income, sale, and voluntary retirement (32.9s)
- PASS · webkit-mobile · `strategy.spec.ts:179` · strategy, organization and businesses fit 320px (17.4s)
- FAIL · webkit-mobile · `review.spec.ts:9` · review captures and WCAG checks cover every M1 screen and faction palette (2.1m)
- PASS · webkit-mobile · `strategy.spec.ts:179` · strategy, organization and businesses fit 375px (12.9s)
- PASS · webkit-mobile · `strategy.spec.ts:179` · strategy, organization and businesses fit 390px (15.7s)
- PASS · webkit-mobile · `strategy.spec.ts:179` · strategy, organization and businesses fit 430px (15.4s)
- FAIL · webkit-mobile · `street.spec.ts:240` · seeded real-play arrest serves every day and releases into continued gameplay (927ms)
- FAIL · webkit-mobile · `street.spec.ts:293` · default reaction and accumulated heat are rendered from real simulated consequences (16.8s)
- PASS · webkit-mobile · `street.spec.ts:313` · crew-assisted street work uses an earned willing partner and actual inventory (25.7s)
- PASS · webkit-mobile · `street.spec.ts:330` · street inventory and supplier modal fit 320px (16.0s)
- PASS · webkit-mobile · `street.spec.ts:330` · street inventory and supplier modal fit 375px (18.5s)
- PASS · webkit-mobile · `street.spec.ts:330` · street inventory and supplier modal fit 390px (17.4s)
- PASS · webkit-mobile · `street.spec.ts:143` · supplier to inventory to multiple real sales and repayment through normal mobile controls (1.8m)
- PASS · webkit-mobile · `street.spec.ts:330` · street inventory and supplier modal fit 430px (16.9s)
- FAIL · webkit-mobile · `visual-correction.spec.ts:9` · GOAL 002B mandatory visual review: new run, independent and Blips at 390 (31.1s)

## Runner summary

```text
  47 failed
  105 passed (48.5m)
```
