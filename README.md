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

## Credits

Not affiliated with FromSoftware or Bandai Namco. Save reading is ported from [Relic Vault](https://github.com/tonydavis629/nightreign-relic-vault) and [RelicBrowser](https://github.com/metinc/nightreign-relic-browser) (both MIT). See [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

MIT License.
