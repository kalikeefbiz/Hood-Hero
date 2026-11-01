# City menu restructure

The City screen now centers the existing five-neighborhood Stixx City map. Everyday work, gigs and social actions remain in Actions; City no longer renders Today’s Moves or any action cards. The GOAL 002C HUD, scenes, affiliation themes and other destinations retain their existing behavior.

The compact Word on the Block alert reads the active Chains incident’s title, demand and leadership status, and opens Actions → The Chains. This is the only storyline currently routed by the game. Resolved, abandoned or absent incidents produce no alert. Full incident status information remains available under Situation history with Activity.

Map highlights use the saved zone controller and organizations with the established UI faction palette. The Nawf shows split Blips/Mudgang presence without choosing an owner; Downtown remains unclaimed. Selection, descriptions, police presence, local standing and Meet local people are preserved. Map inspection does not mutate the saved world.

City retains Your position and the existing two-item Word on the Block news summary. Activity follows these city details with the original observer visibility check, All activity / Your circle filters, latest-80-event window, reverse chronology and day headings. Filtering does not erase older events from saves. The dock is now City | People | Actions | Set | Wallet.

## Reference

[Updated City screenshot — 1440 × 2400, Chromium production build](review/city-menu/city-1440.png). A normal new run with Southside roots, Independent affiliation and The Nawf selected; the tall viewport shows the map, retained information, integrated Activity and navigation together.

## Validation

- `npm test`: 49 passed.
- `npm run build`: root production TypeScript/Vite build passed.
- Full existing Playwright suite, with updated navigation and three new City tests: 21 Chromium + 21 WebKit tests passed (42 total), including WCAG checks, 320/375/390/430/1440px layouts, real actions, End Day, saves, membership themes and incident resolution.
- `VITE_BASE_PATH=/Hood-Hero/ npm run build`: production-base build passed.
- `PLAYWRIGHT_BASE_PATH=/Hood-Hero/ npm run test:e2e -- tests/illustrated.spec.ts tests/city-menu.spec.ts --timeout=90000 --workers=2`: 12 passed across Chromium/WebKit against the production-base build. CI now includes the City tests in this check.
- Prettier checks and `git diff --check`: passed.

The local WebKit runner uses Debian libraries extracted to temporary directories and linked into the browser cache because system package installation requires unavailable root access. `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1` bypasses the system-library cache probe after supplying the actual runtime libraries; every browser test and assertion still runs. CI retains the standard `playwright install --with-deps` setup. Physical devices were not tested.

No simulation, content, ownership data, save schema or gameplay rules changed. No merge or deployment was performed.
