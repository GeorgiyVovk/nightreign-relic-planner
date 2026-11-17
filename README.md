# Nightreign Relic Planner

Plan Elden Ring Nightreign relic loadouts from your own save: pick a Nightfarer and vessel, drop relics into the slots, and see the stats you end up with.

- **Website:** https://georgiyvovk.github.io/nightreign-relic-planner/
- **Windows app:** [Releases](https://github.com/GeorgiyVovk/nightreign-relic-planner/releases). The app finds your saves in `%APPDATA%\Nightreign` and updates your relics every time the game saves.

## What it does

- Reads `NR0000.sl2` (normal game) and `NR0000.co2` (Seamless Co-op). The save is only read, never changed.
- Stats for every Nightfarer at levels 1–15: HP, FP, stamina, attributes, damage negation, resistances.
- Flags relics that can't come from the game (wrong effect count, order, curses, pools).
- Fades effects that do nothing (another Nightfarer's effect, a duplicate that doesn't stack, a second skill change).
- Presets per Nightfarer, search by effect (`aff atk 2, vigor`).

Your relics, presets and builds stay on your device.

## Develop

```
npm install
npm run build        # dist/web (website) and dist/app (desktop page)
npm run app:dev      # run the desktop app (needs Rust)
npm run app:build    # build the Windows installer
```

`src/planner.html` is the whole planner. `src-tauri/` is the desktop shell: it lists, reads and watches save files and nothing else.

## Pages

- **Relics**: your Nightfarer, vessel, slots, stats and relic library.
- **Damage calculator** (`#calculator`): pick a preset (or keep the relics slotted on the Relics page), a weapon and an enemy, and see attack power, status buildup, damage per hit and hits to kill.

## Overlay (desktop app)

The app can show a small timer on top of the game (Overlay button in the header). Press your hotkey (F8 by default) when the Dreglord relic's stacks icon disappears: it counts down 25 seconds and tells you when to sit. The overlay is a separate click-through window that only listens to the hotkey; it never reads or touches the game. It shows over the game in borderless or windowed mode.

## Versions

The version lives in `package.json` (the app reads it from there). Each push to `main` publishes the release `v<version>` with the Windows installer and portable exe. New features raise the middle number (0.2.0 → 0.3.0), fixes raise the last one (0.2.0 → 0.2.1); 1.0.0 comes once the website is live and the planner is stable.

## Credits

Not affiliated with FromSoftware or Bandai Namco. Save reading is ported from [Relic Vault](https://github.com/tonydavis629/nightreign-relic-vault) and [RelicBrowser](https://github.com/metinc/nightreign-relic-browser) (both MIT). See [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md). Weapons (attack power, scaling, status buildup), enemies (HP, negation, resistances, stance and how they scale), character stats, vessel colors and effect values come from or are checked against the game's 1.03.5 regulation, read with [Smithbox](https://github.com/vawser/Smithbox)'s param definitions.

MIT License.
