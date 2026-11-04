# GOAL 008 validation — 2026-11-04

## Completed core checks

- Baseline before changes: `npm test` — 184/184 passed.
- Final `npm test` — **205/205 passed, 12/12 files**, including 21 danger tests. See [unit log](GOAL_008_UNIT.txt).
- Final `npm run build` — **passed** (TypeScript + Vite). See [build log](GOAL_008_BUILD.txt). Rollup reports dependency comment-annotation warnings in Zod and the existing >500 kB bundle warning.
- `git diff --check` — passed.

## Final focused browser result

**16/16 passed (2.4 minutes): eight Chromium-mobile and eight WebKit-mobile.** See [focused log](GOAL_008_BROWSER_FOCUSED.txt). This ran against the final build, including the activity-to-City UI correction. Coverage includes actual Go here travel; saved location, trail, appearance and Lab key isolation; remembered disrespect; camera/menu/reload stability; recognized war shooting and recovery; death and manual checkpoint restoration; a peaceful activity-triggered Wallet encounter; workplace consequences; and territory/council progression.

The archived [temporary config](GOAL_008_PLAYWRIGHT_CONFIG.txt) extends the repository config with reduced motion. The final command, from `/workspace/Hood-Hero-Lab`, was:

```sh
PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1 \
LD_LIBRARY_PATH=/tmp/hood-browser-libs/root/usr/lib/x86_64-linux-gnu \
npx playwright test --config=/tmp/hood-playwright.config.ts \
  tests/danger.spec.ts tests/board.spec.ts tests/employment.spec.ts tests/strategy.spec.ts \
  --grep 'board street|recognized war|terminal conflict|meaningful Wallet|player lives|lab saves|workplace scene|simulation-resolved control' \
  --workers=1
```

## Broader regression attempt: not fully green

The two-worker reduced-motion sweep attempted 84 cases across board, danger, street, employment, encounters, crew and strategy. It was stopped after **13 passed, 4 failed, 2 interrupted, 65 not run**. See [broad log](GOAL_008_BROWSER_BROAD.txt). The failures were:

- 40-day independent crew offer playthrough: 120-second test timeout (the second attempt reached day 25).
- Thirty-day employment playthrough: 180-second test timeout.
- Absence/repeated-missed-shift flow: 30-second test timeout.
- Chains modal/history flow: expected the transient `.action-feedback` toast after further Journal navigation; it had already disappeared before the assertion.

These records do not establish that the entire legacy browser suite passes. Long-playthrough browser performance and the toast assertion need follow-up in a faster/GPU-backed runner or a separate test-harness task. The complete unit suite covers their underlying gameplay logic and passes. No legacy renderer, game timing or test timeout values were changed to force those cases green.

## Browser environment

Software-rendered Playwright Chromium 156 and WebKit 27.2, iPhone 13 viewport. Dependencies came from the repository lockfile. Chromium and WebKit were downloaded with `npx playwright install chromium webkit`.

The host lacked GTK4/Graphene/Harfbuzz ICU/manette/hyphen/GLES and a few transitive WebKit libraries. `npx playwright install-deps` could not elevate (`su: Authentication failure`). Debian packages were instead downloaded and extracted to `/tmp/hood-browser-libs/root`, with links in the temporary Playwright browser cache. `ctypes.CDLL` confirmed GTK4, GLES, Cairo script and HID libraries loaded successfully. No project dependencies, renderer code, system libraries, network policy, or deployment settings were changed for this workaround.

Playwright's `ldconfig -p` check cannot see the user-local GLES library. Browser runs therefore used:

```sh
PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1 \
LD_LIBRARY_PATH=/tmp/hood-browser-libs/root/usr/lib/x86_64-linux-gnu \
npx playwright test ...
```

This bypasses only the inaccurate system-cache validation; the actual browsers still require and load the extracted libraries. The first attempts before that workaround failed at browser launch, not at game assertions.

The three new danger scenarios passed in Chromium and WebKit with default motion in focused runs. An early terminal-load browser test used the wrong accessible button name (`Load` instead of `Load game`); correcting that test selector made it pass. The final matrix uses the finished tests, including actual Go here travel to trigger the encounter.

An initial broad default-motion run was stopped after software-rendering delays: 10 passed, 2 legacy timeouts (40-day crew offers at day 21; absence/employment flow), 1 interrupted, 71 not run. These were timeout reports, not failed gameplay-value assertions. Rather than change application rendering or inflate existing test timeouts, the second broad attempt exercised the board's existing supported reduced-motion mode. The temporary config imports the unchanged project config, sets `use.reducedMotion = 'reduce'`, gives `webServer.cwd` the repository path, and preserves both browser projects. The original long-run timeout evidence is retained in [initial browser log](GOAL_008_BROWSER_INITIAL.txt).
