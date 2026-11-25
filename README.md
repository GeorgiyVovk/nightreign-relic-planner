# Nightreign Relic Planner

Plan Elden Ring Nightreign relic loadouts from your own save: pick a Nightfarer and vessel, drop relics into the slots, and see the stats you end up with.

- **Website:** https://georgiyvovk.github.io/nightreign-relic-planner/
- **Windows app:** [Releases](https://github.com/GeorgiyVovk/nightreign-relic-planner/releases). The app finds your saves in `%APPDATA%\Nightreign` and updates your relics every time the game saves. Its window opens where and as big as you left it (maximized too), and never bigger than your screen's free area, so the taskbar stays visible.

## What it does

- Reads `NR0000.sl2` (normal game) and `NR0000.co2` (Seamless Co-op). The save is only read, never changed.
- Stats for every Nightfarer at levels 1–15: HP, FP, stamina, attributes, damage negation, resistances.
- Flags relics that can't come from the game (wrong effect count, order, curses, pools).
- Fades effects that do nothing (another Nightfarer's effect, a duplicate that doesn't stack, a second skill change).
- Presets per Nightfarer, including the ones you saved in the game (Relic Rites → Save as Preset), read from the save with their names and kept up to date; search by effect (`aff atk 2, vigor`).
- Your Result History: the last 100 expeditions with wins by Nightlord, Nightfarer and teammate, and each run's team and weapons.

Your relics, presets, builds and run history stay on your device.

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

- **Build**: a preset (any Nightfarer's; picking one switches to that Nightfarer), your Nightfarer and vessel, the six slots, the stats you end up with, and a Relic bonuses block listing every attack and defense bonus the slotted relics add (with the always-on attack total); tiers of one effect (Physical Attack Up +4, +3…) share a row with what they add together.
- **Relics** (`#relics`): your relic library: search, filters, new relics, import and export.
- **Damage calculator** (`#calculator`): pick a preset (or keep the relics slotted on the Relics page), talismans, a weapon (one- or two-handed) or a sorcery or incantation (charged or not), and an enemy. The weapon card shows what the game's menu shows (attack power, or a catalyst's scaling) and lets you pick the weapon's Ash of War from the skills that weapon and affinity can drop with. On the Nightfarer's own weapon, a slotted relic that changes the starting skill or gives the starting weapon an element shows up there too (shown only, not counted in the damage yet); under the talismans, six armament cards (right hand on top, left hand below, the left column in hand) take the passives on the weapons you carry: the Grief of a Nightfarer weapon from a Night invader's corpse (+3/6/9 to two stats, the best one counts), the weapon's passive, and with Deep of Night its extra passive and curse. Attack passives count in the damage like relics and stack with themselves, the in-hand-only ones from the weapon in your right hand only; the Damage panel shows one button press up top (every hit it lands) and works out the whole R1, R2 or charged R2 chain hit by hit under it, status buildup and hits to kill.
- **History** (`#history`): the game's Result History from the save, the last 100 expeditions, newest first, under a chart of your Deep of Night rating, filtered to Deep of Night or normal runs and to solo, duo or trio. Each run: the Nightlord (marked when it was the Everdark Sovereign), Victory or the day you fell, the date, your Nightfarer and the preset you took, who you played with, the run time, the rating change, the teammates' rating (the save keeps only the team's average, so with two teammates it's their average), enemies felled, great enemies, treasure and allies rescued, and the players; click a player for their gear: six weapons with skill, passives, rarity and a catalyst's spells, two talismans and six relics (from the save's per-run records). Weapons that aren't in the game data the planner has show as Unknown weapon.
- **Stats** (`#stats`): the same runs added up, with the same filters: runs, victories, best and current win streak, and wins by preset, by Nightlord (each with its Everdark Sovereign under it), by your Nightfarer, with your teammates, with your weapons and with the spells on your staffs and seals. Presets: the run keeps the six relics you took, so a preset of that Nightfarer (the game's or one saved here) with exactly the same relics is the one you played; History shows it on each run. The planner remembers it from the first time it sees the run (normally right after it, when the game saves), so after you change the preset the run still counts for it, shown "(old)"; a deleted preset stays in Stats as "(old)". One relic different counts only with Settings → History on (≈).

## How the damage is worked out

The numbers come from the game's regulation; the formulas that join them are measured in game on a Training Post in the Sparring Grounds, without relics, at levels 1 and 15:

- **Attack** is what the game's menu shows: weapon base × upgrade, plus the stat bonus along the regulation's scaling curves, × 60%. Every enemy has defense 100, and the Training Post takes exactly that attack.
- **Two-handing** doesn't count Strength ×1.5: the attack goes up by the moveset's two-handed rate (×1.03 for a straight sword, ×1.14 for a greataxe).
- **Spell scaling** is (100 + Intelligence or Faith along the curve) × 90% × the staff's or seal's rate for its rarity; a spell hits for its damage × scaling × 60%.
- **An attack** is the whole R1, R2 or charged R2 chain: each hit is the attack × its motion value, with its own physical type, both from the moveset's rows; a press that lands more than one hit (a twinblade's second blade, both fists or claws, a halberd's two-handed charged R2) shows each hit, and the big number is the whole press. First hits are checked in game; later hits come from the data. Where a Nightfarer's own weapon doesn't follow its rows, the measured values stand in: Raider's Greataxe (a fourth R1 swing, the plain greataxe's R2 and charged R2, the two-handed charged R2 landing twice), Executor's blade two-handed R2 (the second a thrust) and charged R2 (lands twice: slash then thrust, then thrust then slash), Revenant's claws (their own moveset: one-handed R1 is four swings, two-handed R1 four double hits) and Duchess' dagger. The claws land about 1% over the calculator's attack, and their menu number in game (75 one-handed, 58 two-handed at level 15) is lower than the calculator's (88 and 59), which isn't worked out yet. Bows, greatbows and crossbows hit with their ammo's moveset (arrow, greatarrow, bolt); Ironeye's Bow and the Longbow are checked in game, greatbows and crossbows not yet.
- **Scaling letters** follow Nightreign's menu, which grades lower than Elden Ring: E under 15, D from 15, C from 30, B from 45, A from 60, S from 71 (checked on the game's weapon screens and wiki pages).
- **Rounding**: a hit's damage types (physical, magic, ...) are added up and the sum is rounded down once, not each type on its own.
- **Bows** shoot the ammo's arrows; Ironeye's R2 and charged shot loose three arrows a press, each a hit.
- **Buffs** use the regulation's values. Deep relics' Improved Sorceries and Improved Incantations are two effects, each for its own school. Checked in game so far: Improved Melee Attack Power gives ×1.05 for one and ×1.12 for two (the data says ×1.06 each), Improved Affinity Attack Power +2 counts on spells (×1.1 each, multiplied), Melee and Added Affinity don't.

Other buffs, boss HP and negation, and status buildup come from the data and aren't checked in game yet. Every number measured in game is a case in `tools/measured.js`, and each build checks the calculator still gives it.

## Settings

The gear button in the header opens Settings, with its pages down the left (the website has only History):

- **Overlay**: a live preview of the card: the same card at the same size as the overlay shows right now, timer included (Ready until it runs; while you move the overlay, the example Nightlord and the timer mid safe zone, as the overlay shows them), showing it on top of the game and moving it, this run's Nightlord, and the Dreglord timer's hotkey, cycle, start point, zones and look (below).
- **Updates**: the installed version, "Check for updates when the app starts and every 30 minutes" (on by default, with a retry a minute later if GitHub can't be reached) and a Check for updates button, which also says when it last checked. The app asks the release's latest.json through its own updater and GitHub's API; when a newer version is out, an "Update to …" button stays at the top until it's installed, and the gear gets a dot. The installed app updates itself: Update now downloads the new installer, checks its signature against the key built into the app, installs it and opens the app again. The portable exe can't replace itself, so it opens the release page instead.
- **History**: "Count a run for a preset when one relic differs" (off by default): a run where one of your six relics wasn't the preset's still counts for it in Stats, marked ≈ in History.
  "Leave out defeats before 14:00" (off by default): Day 1's boss comes about 14 minutes in, so a run lost before that (a disconnect, a teammate quitting, an early wipe) leaves History and Stats and doesn't count against the win rate or streaks; both say how many were left out. The rating chart keeps every run.

## Overlay (desktop app)

The app can show a small card on top of the game (the gear button in the header opens Settings, page Overlay). A show/hide hotkey (F9 by default) turns the overlay on and off from inside the game while the planner is open. Both hotkeys can be any key, with Ctrl, Alt, Shift or Win if you like: press the button in Settings, then the key; Remove clears it (with no timer hotkey the timer starts only from Test). The game doesn't get a hotkey's key while the planner is open, so Settings warns about a plain key the game may use; mouse buttons can't be hotkeys. How much of the game shows through its dark background can be set from 0 to 100% (30% by default). While you move it, it shows the whole card as the preview does (your last run's Nightlord when no run is going on), so you place it at its real size. Each part can be turned on or off:

- **Nightlord**: this run's Nightlord, read from your save as soon as a run starts, so you know a hidden Nightlord from day one (with the timer off, before that the card says it shows when the run starts, so the overlay doesn't vanish), shown by the Nightlord's name, the expedition's (Fulghor or Darkdrift Knight) or both, as you pick in Settings, with what it's weak to in one row under it, as the game's own icons: the damage types it takes more of, then every status it isn't immune to, easiest first, with a bar under it: green if it builds up easily (resistance about 150), yellow if slower (about 250), red if very slowly (about 540). The card keeps one width for every Nightlord; the weaknesses come from the game data. It needs your save loaded in the planner.
- **Dreglord timer**: keeps your Dreglord stacks when you level up. Double-press your hotkey (F8 by default) as soon as the status shows: the timer starts at your start point (0.5 s by default), counted from the first of the two presses, counts up to the cycle length (20 s) and starts over until you stop it. You set one safe zone (1 to 17 s by default; it can wrap past the end): green is safe to touch grace, the rest of the cycle is red danger. Double-press again to resync, press three times quickly to stop; a single press does nothing, so a stray tap can't throw the timer off. The seconds, the zone's name (Safe / Danger) and the bar can each be shown or hidden (by default only the bar shows, 12 px tall), and the bar made taller (8 to 64 px) so it reads at a glance; without the seconds, the zone name takes their place. The card's frame turns thick green in a safe zone and thick red in a danger zone, the part of the cycle already passed is dimmed, and the playhead can be white or cyan. **Simple mode** fills the timer with the zone's colour and shows only its name: green Safe, red Danger,.

The overlay is a separate click-through window. It reads your save file and listens to your hotkey; it never touches the game. It shows over the game in borderless or windowed mode.

## Versions

The version lives in `package.json` (the app reads it from there). Each push to `main` publishes the release `v<version>` with the Windows installer and portable exe. New features raise the middle number (0.2.0 → 0.3.0), fixes raise the last one (0.2.0 → 0.2.1); 1.0.0 comes once the website is live and the planner is stable.

## Credits

Not affiliated with FromSoftware or Bandai Namco. Save reading is ported from [Relic Vault](https://github.com/tonydavis629/nightreign-relic-vault) and [RelicBrowser](https://github.com/metinc/nightreign-relic-browser) (both MIT). The damage type and status icons on the overlay are the game's, © FromSoftware / Bandai Namco. See [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md). Weapons (attack power, scaling, status buildup), spells (damage per hit, charged casts, staff and seal scaling; spell names from Elden Ring's rows with the same IDs), enemies (HP, negation, resistances, stance and how they scale), character stats, vessel colors and effect values come from or are checked against the game's 1.03.5 regulation, read with [Smithbox](https://github.com/vawser/Smithbox)'s param definitions.

MIT License.
