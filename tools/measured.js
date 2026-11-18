// Checks the damage calculator against numbers measured in game (Sparring Grounds, Training Post, no relics unless listed).
// Every case is something someone hit in game; the calculator has to give the same number. Runs on the built page:
//   node tools/build.js && node tools/measured.js
// tol: how far off the game's own number may be (the game shows ±1 now and then on the same hit).
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const W = (char, level, weapon, o = {}) => ({ kind: 'wep', char, level, weapon, two: false, atk: 'r1', ...o });
const S = (char, level, mode, cat, spell, o = {}) => ({ kind: 'spell', char, level, mode, cat, spell, crar: 0, charged: false, ...o });
// Duchess' relic set from the tests: deep relics with three Improved Affinity +2 and Reduced Dexterity and Faith, plus Melee copies
const DEEP = ['d_ruin', 'daff2', 'vsfrost', 'daff2', 'daff2', 'c_dexfth'];
const CASES = [
  // weapon attack as the menu shows it, and the first hit
  ['Short Sword, Guardian 1', W('Guardian', 1, 'Short Sword'), { menu: 47, hit: 47 }],
  ['Short Sword, Guardian 15', W('Guardian', 15, 'Short Sword'), { menu: 96, hit: 96 }],
  ["Noble's Slender Sword, Guardian 15", W('Guardian', 15, "Noble's Slender Sword"), { menu: 100, hit: 100 }],
  ["Wylder's Greatsword, Wylder 1", W('Wylder', 1, "Wylder's Greatsword"), { menu: 56, hit: 56 }],
  ["Wylder's Greatsword, Wylder 15", W('Wylder', 15, "Wylder's Greatsword"), { menu: 122, hit: 122 }],
  ["Raider's Greataxe, Raider 6", W('Raider', 6, "Raider's Greataxe"), { menu: 126, hit: 126 }],
  ["Raider's Greataxe, Raider 15", W('Raider', 15, "Raider's Greataxe"), { menu: 158, hit: 158 }],
  ["Duchess' Dagger, Duchess 8", W('Duchess', 8, "Duchess' Dagger"), { hit: 60 }],
  ["Scholar's Thrusting Sword, Scholar 5", W('Scholar', 5, "Scholar's Thrusting Sword"), { hit: 48 }],
  ["Undertaker's Hammer, Undertaker 12", W('Undertaker', 12, "Undertaker's Hammer"), { hit: 85 }],
  // two-handed: the attack goes up by the moveset's rate, Strength isn't ×1.5
  ['Short Sword two-handed, Guardian 15', W('Guardian', 15, 'Short Sword', { two: true }), { menu: 99, hit: 99 }],
  ["Raider's Greataxe two-handed, Raider 15", W('Raider', 15, "Raider's Greataxe", { two: true }), { menu: 180, hit: 180 }],
  // R2 and charged R2
  ["Raider's Greataxe two-handed R2, Raider 15", W('Raider', 15, "Raider's Greataxe", { two: true, atk: 'r2' }), { hit: 222 }],
  ["Raider's Greataxe two-handed R2, Raider 1", W('Raider', 1, "Raider's Greataxe", { two: true, atk: 'r2' }), { hit: 108 }],
  ["Raider's Greataxe charged R2, Raider 15", W('Raider', 15, "Raider's Greataxe", { atk: 'ch' }), { hit: 275, tol: 1 }],
  ["Raider's Greataxe two-handed charged R2, Raider 15 (lands twice)", W('Raider', 15, "Raider's Greataxe", { two: true, atk: 'ch' }), { hit: 186, landed: 372 }],
  ["Raider's Greataxe two-handed charged R2, Raider 1 (lands twice)", W('Raider', 1, "Raider's Greataxe", { two: true, atk: 'ch' }), { hit: 91, landed: 182 }],
  ['Short Sword two-handed charged R2, Guardian 15', W('Guardian', 15, 'Short Sword', { two: true, atk: 'ch' }), { hit: 159 }],
  ["Executor's Blade charged R2, Executor 15", W('Executor', 15, "Executor's Blade", { atk: 'ch' }), { hit: 151 }],
  // spells: scaling as the menu shows it, and the hit
  ['Glintstone Pebble, Recluse 1, Academy Glintstone Staff', S('Recluse', 1, 's', 'Academy Glintstone Staff', 4000), { ss: 100, hit: 91 }],
  ['Glintstone Arc, Recluse 1, Academy Glintstone Staff', S('Recluse', 1, 's', 'Academy Glintstone Staff', 4070), { ss: 100, hit: 89 }],
  ['Glintstone Pebble, Recluse 15, Academy Glintstone Staff', S('Recluse', 15, 's', 'Academy Glintstone Staff', 4000), { ss: 165, hit: 151 }],
  ['Glintstone Arc, Recluse 15, Academy Glintstone Staff', S('Recluse', 15, 's', 'Academy Glintstone Staff', 4070), { ss: 165, hit: 147 }],
  ["Glintstone Arc, Guardian 11, Demi-Human Queen's Staff", S('Guardian', 11, 's', "Demi-Human Queen's Staff", 4070), { ss: 100, hit: 89 }],
  ["Glintstone Arc, Recluse 11, Recluse's Staff", S('Recluse', 11, 's', "Recluse's Staff", 4070), { ss: 125, hit: 111 }],
  ['Glintstone Arc, Recluse 11, Carian Regal Scepter', S('Recluse', 11, 's', 'Carian Regal Scepter', 4070, { crar: 3 }), { ss: 230, hit: 204, tol: 1 }],
  ["Glintstone Pebble, Recluse 8, Recluse's Staff", S('Recluse', 8, 's', "Recluse's Staff", 4000), { hit: 104 }],
  ['Flame Sling, Revenant 4', S('Revenant', 4, 'i', 'Finger Seal (Revenant)', null), { hit: 151 }],
  ['Flame Sling, Revenant 15', S('Revenant', 15, 'i', 'Finger Seal (Revenant)', null), { hit: 203 }],
  ['Flame Sling charged, Revenant 15', S('Revenant', 15, 'i', 'Finger Seal (Revenant)', null, { charged: true }), { hit: 255 }],
  // relics (Duchess 15, deep relics on): Improved Melee Attack Power gives ×1.05 for one, ×1.12 for two
  ...[["Noble's Slender Sword", 141, 148, 158], ['Rapier', 160, 168, 180], ['Claymore', 206, 216, 230]].flatMap(([w, m0, m1, m2]) => [
    [`${w} two-handed charged R2, Duchess 15, no Melee`, W('Duchess', 15, w, { two: true, atk: 'ch', fx: DEEP }), { hit: m0 }],
    [`${w} two-handed charged R2, Duchess 15, one Melee`, W('Duchess', 15, w, { two: true, atk: 'ch', fx: [...DEEP, 'melee'] }), { hit: m1 }],
    [`${w} two-handed charged R2, Duchess 15, two Melee`, W('Duchess', 15, w, { two: true, atk: 'ch', fx: [...DEEP, 'melee', 'melee'] }), { hit: m2 }],
  ]),
  // whole chains, hit by hit (chain: every hit in order; a shot of three arrows is three hits)
  ["Wylder's Greatsword R1 chain, Wylder 15", W('Wylder', 15, "Wylder's Greatsword"), { chain: [122, 123, 124, 134] }],
  ['Short Sword R2 chain, Guardian 15', W('Guardian', 15, 'Short Sword', { atk: 'r2' }), { chain: [121, 121] }],
  ["Ironeye's Bow R1 chain, Ironeye 15", W('Ironeye', 15, "Ironeye's Bow"), { chain: [66, 66, 67, 72] }],
  ["Ironeye's Bow charged shot, Ironeye 15 (three arrows)", W('Ironeye', 15, "Ironeye's Bow", { atk: 'ch' }), { chain: [49, 49, 49, 51, 51, 51], tol: 1 }],
  ['Longbow R1 chain, Ironeye 15', W('Ironeye', 15, 'Longbow'), { chain: [70, 71, 72, 77], tol: 1 }],
  // physical + magic: the game rounds the sum, not each type
  ['Crystal Sword (Uncommon) R1 chain, Guardian 15', W('Guardian', 15, 'Crystal Sword', { rar: 1 }), { menu: 110, chain: [110, 111, 113, 114, 121] }],
  ["Duchess' Dagger, Duchess 15, the whole set", W('Duchess', 15, "Duchess' Dagger", { fx: [...DEEP, 'melee', 'melee', 'skillap', 'skillap', 'addedaff'] }), { menu: 70, hit: 78, tol: 1 }],
  ['Glintstone Arc, Duchess 15, the whole set (only the affinity relics count)', S('Duchess', 15, 's', 'Academy Glintstone Staff', 4070, { fx: [...DEEP, 'melee', 'melee', 'skillap', 'skillap', 'addedaff'] }), { ss: 153, hit: 180, tol: 1 }],
];

const file = process.argv[2] || [path.join(__dirname, '..', 'dist', 'web', 'index.html'), path.join(__dirname, '..', 'src', 'planner.html')].find(f => fs.existsSync(f));
const dom = new JSDOM(fs.readFileSync(file, 'utf8'), {
  runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://localhost/#calculator',
  beforeParse(w) {
    w.matchMedia = w.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
    w.scrollTo = () => {};
    for (const k of ['ResizeObserver', 'IntersectionObserver', 'MutationObserver']) if (!w[k]) w[k] = class { observe() {} unobserve() {} disconnect() {} };
  },
});
const win = dom.window;
win.eval(`window.__measure = function(c){
  const mk = ids => { const m = new Map(); ids.forEach(id => { const e = EBY[id]; if (!e) throw new Error('no effect ' + id); const a = m.get(id) || { eff: e, count: 0 }; a.count++; m.set(id, a); });
    return [...m.values()].map(a => Object.assign(a, { ok: true, apply: a.eff.st ? a.count : 1, why: '' })); };
  build.char = c.char; const cs = calcState(); cs.preset = null; cs.level = c.level; cs.don = true; enemyState().id = DUMMY.id;
  const ws = weaponState();
  if (c.kind === 'wep') { const w = WEAPONS.find(x => x[0] === c.weapon); if (!w) throw new Error('no weapon ' + c.weapon);
    ws.mode = 'wep'; ws.name = w[0]; ws.aff = w[5][0][0]; ws.rar = Math.max(w[2], c.rar || 0); ws.two = c.two; ws.atk = c.atk; }
  else { ws.mode = c.mode; ws.cat[c.mode] = c.cat; ws.crar[c.mode] = c.crar; ws.ch = c.charged;
    const cat = CATBY[c.cat]; if (!cat) throw new Error('no catalyst ' + c.cat); ws.sp[c.mode] = c.spell || [cat[4], cat[5]].find(spDmg); }
  return withCalcBuild(() => { const list = mk(c.fx || []), a = calcStats(list).a;
    const kind = c.kind === 'wep' && c.atk === 'ch' ? 'charged' : 'normal', ch = chainOn(list, bossOf(DUMMY), kind), h = ch.hs[0];
    const out = { hit: Math.round(h.r.dmg), landed: Math.round(h.dmg), chain: ch.hs.flatMap(x => Array(x.h ? x.h.hits : 1).fill(Math.round(x.r.dmg))) };
    if (c.kind === 'wep') out.menu = weaponAR(curWeapon(), a).total;
    else { const cs2 = curSpell(), sc = spellScaling(cs2.k, a, cs2.rate); out.ss = Math.floor(Math.max(...sc) + 1e-9); }
    return JSON.stringify(out); });
};`);
let bad = 0;
for (const [name, c, want] of CASES) {
  let got;
  try { got = JSON.parse(win.__measure(JSON.parse(JSON.stringify(c)))); }
  catch (e) { bad++; console.log(`FAIL ${name}: ${e.message}`); continue; }
  const tol = want.tol || 0, off = (a, b) => Array.isArray(b) ? !Array.isArray(a) || a.length !== b.length || a.some((x, i) => Math.abs(x - b[i]) > tol) : Math.abs(a - b) > tol;
  const show = v => Array.isArray(v) ? v.join('/') : v, miss = Object.keys(want).filter(k => k !== 'tol' && off(got[k], want[k]));
  if (miss.length) { bad++; console.log(`FAIL ${name}: ${miss.map(k => `${k} ${show(got[k])}, game ${show(want[k])}`).join('; ')}`); }
  else console.log(`ok   ${name}: ${Object.keys(want).filter(k => k !== 'tol').map(k => `${k} ${show(got[k])}`).join(', ')}`);
}
console.log(`\n${CASES.length - bad} of ${CASES.length} match the game`);
process.exit(bad ? 1 : 0);
