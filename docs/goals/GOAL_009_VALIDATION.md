# GOAL 009 validation

## First-arrival and meeting-location correction — current revision

This correction supersedes the original non-residential first-contact restriction. The introduction now starts once on any actual Reservoir arrival, including a residence or the player's home. Reservoir starts/resumes trigger it on explicit gameplay entry; raw world initialization and map inspection remain inert. Peaceful affiliation paths disclose and save `reservoir.lil-jays`; hostile branches do not disclose it. Character information and receivables show the saved meeting place. Later business and collection require physical presence at Lil Jay's Market, including after dismissing a peaceful introduction elsewhere.

Collection instructions read `Collect from Quanny — Lil Jay's Market, The Reservoir. Due Day N.` N comes from the existing agreement `dueDay`. A deterministic day-10 agreement test verifies day 16; no deadline, inventory, price, payment, retaliation or combat calculation changed.

Correction checks:

- `npm test`: **244 passed**, **13 files**, **45.10 seconds**, exit **0**; includes **39 Quanny cases**.
- `npm run build`: **passed**, exit **0**; Vite build phase **5.39 seconds**, with existing dependency/chunk warnings.
- `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1 npm run test:e2e -- tests/quanny.spec.ts --workers=2`: **12 passed**, **2.3 minutes**, exit **0**, Chromium and WebKit.
- Browser cases verify a first arrival at Reservoir homes from outside the neighborhood, an actual Reservoir new-game start before travel, no map-inspection trigger, the spoken reveal, saved character location, explicit Wallet collection instructions, travel back to the market for collection at notoriety 34/35, and unchanged hostile introductions.
- The earlier broad **152-case** browser suite was **not repeated** for this bounded correction. Its historical **105 passed / 47 failed** result and baseline comparisons below remain recorded; these targeted passes do not mean the whole browser suite is green.

The sections below document the original GOAL 009 delivery and its historical runs.

## Environment

Managed Debian cloud workspace, Node v24.22.1. Local Vite preview only. No public URL, deployment or production repository was used.

Playwright downloaded Chromium 156.0.8078.4 (revision 1248) and WebKit 27.2 (revision 2370). The host lacked WebKit libraries. `npx playwright install-deps chromium webkit` failed because root authentication was unavailable; this was an environment limitation, not an application failure.

To run both browsers, Debian packages were downloaded and extracted outside the repository under `/workspace/browser-libs`, then their shared libraries were linked into the local Playwright browser bundle. WebKit's bundled launcher overwrites `LD_LIBRARY_PATH`. `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1` bypassed Playwright's system `ldconfig` check, which cannot see locally installed libraries. Actual WebKit launch, DOM operation and full Quanny browser tests succeeded. No validation setting or browser-library workaround was committed into the application.

## Results

- Final `npm test`: **232 passed**, **13 files**, **32.70 seconds**, exit **0**. Includes **27 Quanny unit cases**, including final availability and NPC-arrest boundaries.
- Final `npm run build`: **passed**, exit **0** (Vite build phase **3.55 seconds**). Existing warnings: third-party Zod pure annotations and Vite bundle sizes above 500 kB. No TypeScript error.
- `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1 npm run test:e2e -- tests/quanny.spec.ts --workers=2`: **10 passed**, Chromium mobile and WebKit mobile, 1.3 minutes. Tests exercise first intentional Reservoir travel, physical merchandise consignment, collection at 34/35 notoriety, private impostor recognition, serious shooting presentation and save/load.
- Full `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1 npm run test:e2e -- --workers=2`: **105 passed, 47 failed**, all **152 cases completed**, **48.5 minutes**, exit **1**. Chromium: **53 passed / 23 failed**. WebKit: **52 passed / 24 failed**. All **10 Quanny cases passed** within this full run. The suite is **not green**. See [every case and failure](GOAL_009_E2E_RESULTS.md).

## Regression diagnosis

The complete browser suite contains UI-navigation and fixture failures that require baseline comparison. All three `tests/city-menu.spec.ts` Chromium cases failed on the feature branch. An independent detached worktree of the untouched GOAL 008 commit `4024f35` was built and tested on another local port:

`PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1 PLAYWRIGHT_PORT=4174 npm run test:e2e -- tests/city-menu.spec.ts --project=chromium-mobile --workers=1`

All **three failed on GOAL 008 as well**. Examples include timing out while waiting for the `Honest` control after navigation and City/storyline routing. Those tests were retained unchanged. The `Honest` control exists; the timeout concerns the navigation leading to it, not removal of that control. Other full-suite failures, if any, are listed with the completed run below; only independently reproduced failures are described as confirmed baseline failures.

The board's movement/presence/save test and Lab-storage isolation test passed during the full feature run. The Chains content, opening incident, renderer, character mesh builder and environmental assets have no feature diff.

Earlier development runs caught and corrected a duplicate generic supplier reaction after authored Quanny consignment, an unrelated historical notification overlay in the isolated browser fixtures, and seeded NPC RNG drift. An exhaustive conflict fixture was optimized to clone one deterministic base state, avoiding a CPU-contention timeout without weakening its 300-seed coverage.

A second GOAL 008 baseline comparison also reproduced `tests/corrections.spec.ts:163` (active Chains / completed history), using `--grep 'active Chains lives' --project=chromium-mobile --workers=1`. Thus that Chains browser routing failure is also independently confirmed before this feature. The unit Chains branches, commitments and seeded outcomes continue to pass.

Three further GOAL 008 baseline cases were independently reproduced with `tests/crew.spec.ts tests/employment.spec.ts --grep 'independent offer|absence warning|workplace scene consequence' --project=chromium-mobile --workers=1`: `crew.spec.ts:133`, `employment.spec.ts:154`, and `employment.spec.ts:203`. All three failed on the untouched starting commit as on the feature branch.


Both `tests/street.spec.ts:240` (seeded custody) and `:293` (default/heat fixture) also fail on untouched GOAL 008 with “Finish the street encounter before taking another action.” Their scripted campaign does not resolve the generic danger conversation before the next action. The full mobile supplier journey reaches actual sales and a fulfilled repayment agreement but later fails a UI assertion; it is counted as a failed test, not a passing journey.


## Delivery boundaries and evidence

Nine distinct Chromium cases were independently reproduced on GOAL 008, as detailed above. The remaining failures have not all been independently reproduced; they must not be assumed to be pre-existing. A corresponding WebKit failure is not counted as a separate baseline reproduction unless that engine was rerun.

Full-run HTML report and traces were preserved outside Git at `/workspace/goal009-browser-evidence/full-playwright-report` and `/workspace/goal009-browser-evidence/full-test-results` before the final targeted rerun. The raw runner log is `/tmp/goal009-e2e.log`; the portable per-case record is committed alongside this document. Baseline comparison logs are `/tmp/goal008-baseline-e2e.log`, `/tmp/goal008-chains-browser.log`, `/tmp/goal008-other-browser.log`, and `/tmp/goal008-street-browser.log`.

Final review added availability validation (no pending collection from player custody or when Quanny is committed elsewhere), explicitly tested NPC arrest without clearing the receivable, and excluded the opponent from attacking support / the player from the defender's backing. These use existing status, custody, relationship and conflict records.

Generated screenshots from the broad suite are restored to the starting branch versions; no renderer, camera or environment assets are delivered as feature changes. Feature-branch pushes do not trigger the repository's deployment workflow, which only runs automatically on `main`. No merge or deployment was performed.


## Final targeted confirmation

After the availability and conflict-support boundary fixes, the rebuilt application was tested again with `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1 npm run test:e2e -- tests/quanny.spec.ts --workers=2`: **10 passed**, exit **0**, across Chromium and WebKit. This final focused run and the complete **232-test** unit run cover the delivery changes. The 152-case broad run was not repeated after these final boundary fixes; its exact earlier result is retained above, including all failures. Final focused artifacts remain in the repository's ignored `playwright-report/` and `test-results/` directories; the broad-run evidence was preserved separately.
