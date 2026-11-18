# Nightreign Relic Planner

Plan Elden Ring Nightreign relic loadouts from your own save: pick a Nightfarer and vessel, drop relics into the slots, and see the stats you end up with.

- **Website:** https://georgiyvovk.github.io/nightreign-relic-planner/
- **Windows app:** [Releases](https://github.com/GeorgiyVovk/nightreign-relic-planner/releases). The app finds your saves in `%APPDATA%\Nightreign` and updates your relics every time the game saves.

## What it does

- Reads `NR0000.sl2` (normal game) and `NR0000.co2` (Seamless Co-op). The save is only read, never changed.
- Stats for every Nightfarer at levels 1–15: HP, FP, stamina, attributes, damage negation, resistances.
- Flags relics that can't come from the game (wrong effect count, order, curses, pools).
- Fades effects that do nothing (another Nightfarer's effect, a duplicate that doesn't stack, a second skill change).
- Presets per Nightfarer, including the ones you saved in the game (Relic Rites → Save as Preset), read from the save with their names and kept up to date; search by effect (`aff atk 2, vigor`).

Your relics, presets and builds stay on your device.

## Develop

```
npm install
npm run build        # dist/web (website) and dist/app (desktop page)
npm test             # the calculator against every number measured in game (tools/measured.js)
npm run app:dev      # run the desktop app (needs Rust)
npm run app:build    # build the Windows installer
```

`src/planner.html` is the whole planner. `src-tauri/` is the desktop shell: it lists, reads and watches save files and nothing else.

## Pages

- **Relics**: your Nightfarer, vessel, slots, stats and relic library.
- **Damage calculator** (`#calculator`): pick a preset (or keep the relics slotted on the Relics page), talismans, a weapon (one- or two-handed) or a sorcery or incantation (charged or not), and an enemy. The weapon card shows what the game's menu shows (attack power, or a catalyst's scaling) and lets you pick the weapon's Ash of War from the skills that weapon and affinity can drop with. On the Nightfarer's own weapon, a slotted relic that changes the starting skill or gives the starting weapon an element shows up there too (shown only, not counted in the damage yet); under the talismans, six armament cards (right hand on top, left hand below, the left column in hand) take the passives on the weapons you carry: the Grief of a Nightfarer weapon from a Night invader's corpse (+3/6/9 to two stats, the best one counts), the weapon's passive, and with Deep of Night its extra passive and curse. Attack passives count in the damage like relics and stack with themselves, the in-hand-only ones from the weapon in your right hand only; the Damage panel shows one button press up top (every hit it lands) and works out the whole R1, R2 or charged R2 chain hit by hit under it, status buildup and hits to kill.

## How the damage is worked out

The numbers come from the game's regulation; the formulas that join them are measured in game on a Training Post in the Sparring Grounds, without relics, at levels 1 and 15:

- **Attack** is what the game's menu shows: weapon base × upgrade, plus the stat bonus along the regulation's scaling curves, × 60%. Every enemy has defense 100, and the Training Post takes exactly that attack.
- **Two-handing** doesn't count Strength ×1.5: the attack goes up by the moveset's two-handed rate (×1.03 for a straight sword, ×1.14 for a greataxe).
- **Spell scaling** is (100 + Intelligence or Faith along the curve) × 90% × the staff's or seal's rate for its rarity; a spell hits for its damage × scaling × 60%.
- **An attack** is the whole R1, R2 or charged R2 chain: each hit is the attack × its motion value, with its own physical type, both from the moveset's rows; a press that lands more than one hit (a twinblade's second blade, both fists or claws, a halberd's two-handed charged R2) shows each hit, and the big number is the whole press. First hits are checked in game; later hits come from the data. Raider's Greataxe two-handed is measured where its animation differs from its rows. Bows, greatbows and crossbows hit with their ammo's moveset (arrow, greatarrow, bolt), not checked in game yet.
- **Rounding**: a hit's damage types (physical, magic, ...) are added up and the sum is rounded down once, not each type on its own.
- **Bows** shoot the ammo's arrows; Ironeye's R2 and charged shot loose three arrows a press, each a hit.
- **Buffs** use the regulation's values. Checked in game so far: Improved Melee Attack Power gives ×1.05 for one and ×1.12 for two (the data says ×1.06 each), Improved Affinity Attack Power +2 counts on spells (×1.1 each, multiplied), Melee and Added Affinity don't.

Other buffs, boss HP and negation, and status buildup come from the data and aren't checked in game yet. Every number measured in game is a case in `tools/measured.js`, and each build checks the calculator still gives it.

## Overlay (desktop app)

The app can show a small timer on top of the game (Overlay button in the header). Press your hotkey (F8 by default) when the Dreglord relic's stacks icon disappears: it counts down 25 seconds and tells you when to sit. The overlay is a separate click-through window that only listens to the hotkey; it never reads or touches the game. It shows over the game in borderless or windowed mode.

## Versions

The version lives in `package.json` (the app reads it from there). Each push to `main` publishes the release `v<version>` with the Windows installer and portable exe. New features raise the middle number (0.2.0 → 0.3.0), fixes raise the last one (0.2.0 → 0.2.1); 1.0.0 comes once the website is live and the planner is stable.

## Credits

Not affiliated with FromSoftware or Bandai Namco. Save reading is ported from [Relic Vault](https://github.com/tonydavis629/nightreign-relic-vault) and [RelicBrowser](https://github.com/metinc/nightreign-relic-browser) (both MIT). See [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md). Weapons (attack power, scaling, status buildup), spells (damage per hit, charged casts, staff and seal scaling; spell names from Elden Ring's rows with the same IDs), enemies (HP, negation, resistances, stance and how they scale), character stats, vessel colors and effect values come from or are checked against the game's 1.03.5 regulation, read with [Smithbox](https://github.com/vawser/Smithbox)'s param definitions.

MIT License.
