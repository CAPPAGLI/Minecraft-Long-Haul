const fs = require('fs'), vm = require('vm'), assert = require('assert');
const sandbox = { global: {} };
vm.runInNewContext(fs.readFileSync(__dirname + '/../overrides/kubejs/startup_scripts/00_contract_engine.js', 'utf8'), sandbox);
vm.runInNewContext(fs.readFileSync(__dirname + '/../overrides/kubejs/startup_scripts/02_quest_catalog.js', 'utf8'), sandbox);

const e = sandbox.global.LHContractEngine;
const planner = sandbox.global.LHWorldPlanner;
const routeVal = sandbox.global.LHRouteValidator;
const econ = sandbox.global.LHEconomyGraph;
let tests = 0;
function test(name, f) { f(); tests++; console.log('PASS ' + name); }
function clone(x) { return JSON.parse(JSON.stringify(x)); }

const single = { goods: { iron: 64 } }, timed = { goods: { iron: 4, copper: 2 }, windowSeconds: 60, windows: 3 };
test('inventory presence alone never completes', () => { let j = e.begin('a', single); for (let i = 0; i < 100; i++) e.step(j, single, {}, true); assert.equal(j.status, 'active'); });
test('wrong items do not count', () => { let j = e.begin('a', single); e.step(j, single, { gold: 64 }, true); assert.equal(j.totals.iron, 0); assert.equal(j.status, 'active'); });
test('one-off requires actual accepted full quantity', () => { let j = e.begin('a', single); e.step(j, single, { iron: 63 }, true); assert.equal(j.status, 'active'); e.step(j, single, { iron: 1 }, true); assert.equal(j.status, 'complete'); });
test('completed contract cannot consume twice', () => { let j = e.begin('a', single); e.step(j, single, { iron: 64 }, true); e.step(j, single, { iron: 64 }, true); assert.equal(j.totals.iron, 64); });
test('unloaded terminal pauses without consuming or ticking', () => { let j = e.begin('a', timed); for (let i = 0; i < 300; i++) e.step(j, timed, { iron: 4, copper: 2 }, false); assert.equal(j.seconds, 0); assert.equal(j.windows, 0); });
test('large stockpile cannot complete timed trial immediately', () => { let j = e.begin('a', timed); e.step(j, timed, { iron: 4, copper: 2 }, true); assert.equal(j.status, 'active'); assert.equal(j.windows, 0); assert.throws(() => e.step(j, timed, { iron: 1 }, true)); });
test('one empty window fails', () => { let j = e.begin('a', timed); for (let i = 0; i < 60; i++) e.step(j, timed, {}, true); assert.equal(j.status, 'failed'); });
test('every input must meet quota', () => { let j = e.begin('a', timed); e.step(j, timed, { iron: 4 }, true); for (let i = 1; i < 60; i++) e.step(j, timed, {}, true); assert.equal(j.status, 'failed'); });
test('three successful windows complete only after 180 active seconds', () => { let j = e.begin('a', timed); for (let s = 0; s < 180; s++) { e.step(j, timed, s % 60 === 0 ? { iron: 4, copper: 2 } : {}, true); if (s < 179) assert.equal(j.status, 'active'); } assert.equal(j.status, 'complete'); assert.equal(j.windows, 3); assert.equal(j.totals.iron, 12); });
test('JSON roundtrip preserves timer and totals', () => { let j = e.begin('a', timed); for (let i = 0; i < 31; i++) e.step(j, timed, i === 0 ? { iron: 4, copper: 2 } : {}, true); j = clone(j); for (let i = 31; i < 60; i++) e.step(j, timed, {}, true); assert.equal(j.windows, 1); });
test('negative and fractional consumption rejected', () => { let j = e.begin('a', single); assert.throws(() => e.step(j, single, { iron: -1 }, true)); assert.throws(() => e.step(j, single, { iron: .5 }, true)); });
test('failed trial never resumes accidentally', () => { let j = e.begin('a', timed); j.status = 'failed'; e.step(j, timed, { iron: 4, copper: 2 }, true); assert.equal(j.seconds, 0); });

test('world planner places all 10 sites deterministically inside +/-84000 with >= 2400 separation', () => {
  const s1 = planner.planSites('123456789');
  const s2 = planner.planSites('123456789');
  assert.deepEqual(s1, s2);
  assert.equal(s1.length, 10);
  for (let i = 0; i < s1.length; i++) {
    assert(Math.abs(s1[i].x) <= planner.BORDER_SAFE_LIMIT);
    assert(Math.abs(s1[i].z) <= planner.BORDER_SAFE_LIMIT);
    for (let j = i + 1; j < s1.length; j++) {
      assert(planner.dist2D(s1[i].x, s1[i].z, s1[j].x, s1[j].z) >= planner.MIN_SEPARATION);
    }
  }
});

test('route validator measures length and rejects teleportation speed', () => {
  const gates = [{ x: 0, z: 0 }, { x: 400, z: 0 }, { x: 800, z: 300 }];
  assert.equal(routeVal.pathLength(gates), 900);
  assert.equal(routeVal.validateSegmentSpeed(gates[0], gates[1], 20).ok, true);
  assert.equal(routeVal.validateSegmentSpeed(gates[0], gates[1], 1).ok, false);
});

test('site economy reachability graph passes with zero circular deadlocks', () => {
  const res = econ.checkReachability();
  assert.equal(res.ok, true, 'Missing: ' + JSON.stringify(res.missing));
});

test('recovery planner places all 6 industrial facilities near parent sites within +/-84000', () => {
  const sites = planner.planSites('123456789');
  const map = {};
  sites.forEach(s => { map[s.id] = s; });
  const r1 = sandbox.global.LHRecoveryPlanner.planRecoveries('123456789', map);
  const r2 = sandbox.global.LHRecoveryPlanner.planRecoveries('123456789', map);
  assert.deepEqual(r1, r2);
  assert.equal(Object.keys(r1).length, 6);
  sandbox.global.LHRecoveryCatalog.forEach(spec => {
    const rec = r1[spec.id];
    assert(rec, 'Missing recovery ' + spec.id);
    assert(Math.abs(rec.x) <= planner.BORDER_SAFE_LIMIT);
    assert(Math.abs(rec.z) <= planner.BORDER_SAFE_LIMIT);
    assert(Object.keys(spec.repairInputs).length >= 2);
    assert(spec.requiredMachinery.length >= 2);
  });
});

test('quest catalog startup index exposes all 240 unique campaign/regional specs', () => {
  const cat = sandbox.global.LHQuestCatalog;
  assert(Array.isArray(cat) && cat.length === 240, 'expected 240 catalog entries, got ' + (cat && cat.length));
  const ids = new Set();
  const vtypes = new Set();
  cat.forEach(q => {
    assert(q.id && q.title && q.chapter && q.verification_type && q.stage >= 1 && q.stage <= 4);
    assert(!ids.has(q.id), 'duplicate id ' + q.id);
    ids.add(q.id);
    vtypes.add(q.verification_type);
  });
  assert(vtypes.size >= 15, 'expected diverse verification types, got ' + vtypes.size);
});

test('all Heracles quest display titles and subtitles use Component objects (not double-encoded strings)', () => {
  const path = require('path');
  const qDir = path.join(__dirname, '../overrides/config/heracles/quests');
  const qFiles = fs.readdirSync(qDir).filter(f => f.endsWith('.json'));
  assert(qFiles.length >= 320, 'expected >= 320 quests, got ' + qFiles.length);
  qFiles.forEach(f => {
    const q = JSON.parse(fs.readFileSync(path.join(qDir, f), 'utf8'));
    assert(q.display && typeof q.display.title === 'object' && typeof q.display.title.text === 'string', f + ' invalid display.title');
    assert(q.display && typeof q.display.subtitle === 'object' && typeof q.display.subtitle.text === 'string', f + ' invalid display.subtitle');
  });
});

test('longhaul-runtime includes valid pack.mcmeta for Minecraft 1.20.1 (pack_format 15)', () => {
  const path = require('path');
  const meta = JSON.parse(fs.readFileSync(path.join(__dirname, '../runtime-mod/src/main/resources/pack.mcmeta'), 'utf8'));
  assert.equal(meta.pack && meta.pack.pack_format, 15);
  assert(typeof meta.pack.description === 'string' && meta.pack.description.length > 0);
});

test('all KubeJS startup/server/client scripts parse cleanly in ES5/Node', () => {
  const path = require('path');
  const dirs = [
    path.join(__dirname, '../overrides/kubejs/startup_scripts'),
    path.join(__dirname, '../overrides/kubejs/server_scripts'),
    path.join(__dirname, '../overrides/kubejs/client_scripts'),
    path.join(__dirname, 'fixtures')
  ];
  let count = 0;
  dirs.forEach(d => {
    fs.readdirSync(d).filter(f => f.endsWith('.js')).forEach(f => {
      new vm.Script(fs.readFileSync(path.join(d, f), 'utf8'), { filename: f });
      count++;
    });
  });
  assert(count >= 15, 'expected at least 15 KubeJS/fixture scripts, got ' + count);
});

test('territory border follows 175000^(1/x) where x = 2 - 1/locked and opens 175000 at locked <= 1', () => {
  const tm = sandbox.global.LHTerritoryMath;
  assert.equal(tm.computeBorder(6, 0).size, 724);
  assert.equal(tm.computeBorder(6, 1).size, 818);
  assert.equal(tm.computeBorder(6, 2).size, 991);
  assert.equal(tm.computeBorder(6, 3).size, 1399);
  assert.equal(tm.computeBorder(6, 4).size, 3129);
  assert.equal(tm.computeBorder(6, 5).size, 175000);
  assert.equal(tm.computeBorder(6, 6).size, 175000);
});

test('difficulty coefficient scales with online deaths / online players (target 63.15 -> 96) with no cap and drives random respawn radius 20203', () => {
  const dm = sandbox.global.LHDifficultyMath;
  assert.equal(dm.compute(0, 5), 1.0);
  assert.equal(dm.compute(10, 0), 1.0);
  assert(Math.abs(dm.compute(63.15 * 3, 3) - 96.0) < 1e-9);
  assert(dm.compute(200, 2) > dm.compute(200, 4));
  assert(Math.abs(dm.compute(126.3 * 2, 2) - 191.0) < 1e-9);
  assert.equal(dm.randomRespawnRadius(96.0), 20203);
  assert.equal(dm.randomRespawnRadius(1.0), 210);
  assert(dm.randomRespawnRadius(191.0) > 20203);
});

test('voidout power equals 1.0 * difficulty coefficient with no safe cap', () => {
  const vm2 = sandbox.global.LHVoidoutMath;
  assert.equal(vm2.BASE_STRENGTH, 1.0);
  assert.equal(vm2.computePower(1.0).primary, 1.0);
  assert.equal(vm2.computePower(12.5).primary, 12.5);
  assert.equal(vm2.computePower(96.0).primary, 96.0);
  assert.equal(vm2.computePower(250.0).primary, 250.0);
  assert.equal(vm2.computePower(250.0).raw, 250.0);
});

test('hard-feature catalog covers all core + new casino threats (random_respawn, death_item_loss, overload, etc.)', () => {
  const ids = new Set((sandbox.global.LHHardFeatureCatalog || []).map(f => f.id));
  [
    'ore_scarcity', 'wood_scarcity', 'smarter_mobs', 'immortal_snail',
    'voidout_explosion', 'toxic_gas', 'random_respawn', 'death_item_loss',
    'overload_encumbrance', 'cold_altitude_frost', 'machine_sabotage_lightning',
    'abyssal_pressure', 'toxic_rain_corrosion', 'spore_spoilage', 'insomnia_ambush'
  ].forEach(k => {
    assert(ids.has(k), 'missing hard feature ' + k);
  });
  assert(ids.size >= 20, 'expected >= 20 hard features, got ' + ids.size);
});

test('all Heracles quests form an acyclic DAG with zero dangling dependencies and include Nuclear, OpenTTD, optional Photo (Ch.13) and DOOMED (Ch.14)', () => {
  const path = require('path');
  const qDir = path.join(__dirname, '../overrides/config/heracles/quests');
  const map = {};
  fs.readdirSync(qDir).filter(f => f.endsWith('.json')).forEach(f => {
    map[f.replace(/\.json$/, '')] = JSON.parse(fs.readFileSync(path.join(qDir, f), 'utf8'));
  });
  const state = {};
  function dfs(u) {
    state[u] = 1;
    (map[u].dependencies || []).forEach(v => {
      assert(map[v], 'dangling dep ' + u + ' -> ' + v);
      assert.notEqual(state[v], 1, 'cycle at ' + u + ' -> ' + v);
      if (!state[v]) dfs(v);
    });
    state[u] = 2;
  }
  Object.keys(map).forEach(k => { if (!state[k]) dfs(k); });
  assert(map.story_01_left_for_bread && map.story_06_forgot_the_milk, 'Chapter 00 quests present');
  assert(map.nuclear_01_geiger && map.nuclear_06_fusion_core, 'Chapter 11 Nuclear/Draconic quests present');
  assert(map.openttd_01_found_company && map.openttd_06_empire_verify, 'Chapter 12 OpenTTD quests present');
  assert(map.alpha_photo && map.tutorial_camera && map.photo_forest, 'Chapter 13 Photo quests present');
  assert(map.doomed_01_intro && map.doomed_06_safe_toggle, 'Chapter 14 DOOMED quests present');

  // Verify every single photo/camera quest lives exclusively in Chapter 13
  Object.keys(map).forEach(qid => {
    const grps = Object.keys(map[qid].display.groups || {});
    const iconItem = map[qid].display && map[qid].display.icon && map[qid].display.icon.item && map[qid].display.icon.item.id;
    const isPhoto = qid.indexOf('photo') !== -1 || qid === 'tutorial_camera' || qid === 'tutorial_film' || qid === 'tutorial_album' || iconItem === 'exposure:photograph';
    if (isPhoto) {
      assert.deepEqual(grps, ['13 · Фотодокументация (Опционально)'], qid + ' must be in Ch.13');
    } else {
      assert(!grps.includes('13 · Фотодокументация (Опционально)'), qid + ' should not be in Ch.13');
    }
  });
});

test('OpenTTD engine supports spawn sanctuary, companies, specializations, Voronoi+claim, remote exclave, raid/seize/transfer, pacts, and AI bots', () => {
  const ottd = sandbox.global.LHOpenTTD;
  const st = ottd.createInitialState();
  assert(st.companies.bot_ironrail && st.companies.bot_greencart && st.companies.bot_skyport, '3 AI bots seeded');
  assert.equal(ottd.isSpawnProtectedSector(0, 0), true);
  assert.equal(ottd.isSpawnProtectedSector(1, 1), true);
  assert.equal(ottd.isSpawnProtectedSector(2, 0), false);
  assert.equal(ottd.resolveSectorOwner(st, 0, 0).kind, 'unclaimed');
  assert.equal(ottd.resolveSectorOwner(st, 0, 0).owner, null);
  assert.equal(ottd.resolveSectorOwner(st, 2, 0).owner, 'bot_ironrail');
  // Voronoi partition assigns distant unclaimed sectors to nearest company HQ/outpost
  const vor = ottd.resolveSectorOwner(st, 10, 0);
  assert.equal(vor.kind, 'voronoi');
  assert.equal(vor.owner, 'bot_ironrail');

  // Player founding at spawn (0,0) places HQ on safe outer ring outside 3x3 sanctuary
  const c1 = ottd.companyCreate(st, 'u1', 'transsib', 'Транссиб', 0, 0);
  assert.equal(c1.ok, true);
  assert.equal(c1.company.cash, ottd.STARTING_CASH);
  assert.equal(ottd.isSpawnProtectedSector(c1.company.hqSx, c1.company.hqSz), false);
  const c2 = ottd.companyCreate(st, 'u2', 'pacific', 'Пасифик', 0, 512);
  assert.equal(c2.ok, true);

  assert.equal(ottd.setSpecialization(st, 'transsib', 'transport', 'rail').ok, true);
  assert.equal(ottd.setSpecialization(st, 'transsib', 'resource', 'mining').ok, true);

  // Spawn sanctuary cannot be claimed
  assert.equal(ottd.claimOrCaptureSector(st, 'transsib', 0, 0, false).ok, false);

  // Claim adjacent to transsib HQ
  const adjX = c1.company.hqSx;
  const adjZ = c1.company.hqSz + 1;
  const adjFinalX = ottd.isSpawnProtectedSector(adjX, adjZ) ? c1.company.hqSx + 1 : adjX;
  const adjFinalZ = ottd.isSpawnProtectedSector(adjX, adjZ) ? c1.company.hqSz : adjZ;
  const claimCost = ottd.computeClaimCost(st, 'transsib', adjFinalX, adjFinalZ);
  assert.equal(claimCost.mode, 'claim');
  assert(claimCost.cost < ottd.BASE_CLAIM_COST, 'rail + adjacency discount reduces claim cost');
  const cl = ottd.claimOrCaptureSector(st, 'transsib', adjFinalX, adjFinalZ, false);
  assert.equal(cl.ok, true);
  assert.equal(ottd.fortifySector(st, 'transsib', adjFinalX, adjFinalZ).strength, 2);

  // Non-adjacent sector rejected remotely, allowed physically with exclave surcharge
  assert.equal(ottd.claimOrCaptureSector(st, 'transsib', 5, 5, false, { remote: true }).ok, false);
  const remCost = ottd.computeClaimCost(st, 'transsib', 5, 5);
  assert.equal(remCost.adjacent, false);
  assert(remCost.exclaveMult > 1.0);
  st.companies.transsib.cash += 5000;
  assert.equal(ottd.claimOrCaptureSector(st, 'transsib', 5, 5, false).ok, true);

  // Hostile capture fails without allowCapture, succeeds with allowCapture & compensates rival
  assert.equal(ottd.claimOrCaptureSector(st, 'pacific', adjFinalX, adjFinalZ, false).ok, false);
  st.companies.pacific.cash += 5000;
  const prevCash = st.companies.transsib.cash;
  const cap = ottd.claimOrCaptureSector(st, 'pacific', adjFinalX, adjFinalZ, true);
  assert.equal(cap.ok, true);
  assert.equal(ottd.resolveSectorOwner(st, adjFinalX, adjFinalZ).owner, 'pacific');
  assert(st.companies.transsib.cash > prevCash, 'rival compensated on buyout');

  // Raid siege lowers strength before capture; antitrustSeize & transferSector work cleanly
  const fort = ottd.fortifySector(st, 'pacific', adjFinalX, adjFinalZ);
  assert.equal(fort.ok, true);
  const w1 = ottd.weakenOrCaptureSector(st, 'transsib', adjFinalX, adjFinalZ);
  assert.equal(w1.ok, true);
  assert.equal(w1.captured, false);
  const w2 = ottd.weakenOrCaptureSector(st, 'transsib', adjFinalX, adjFinalZ);
  assert.equal(w2.ok, true);
  assert.equal(w2.captured, true);
  assert.equal(ottd.resolveSectorOwner(st, adjFinalX, adjFinalZ).owner, 'transsib');

  // Position pacific adjacent to (adjFinalX, adjFinalZ) for antitrustSeize test
  ottd.claimOrCaptureSector(st, 'pacific', adjFinalX + 1, adjFinalZ, false);
  const sz = ottd.antitrustSeize(st, 'pacific', adjFinalX, adjFinalZ);
  assert.equal(sz.ok, true);
  assert.equal(ottd.resolveSectorOwner(st, adjFinalX, adjFinalZ).owner, 'pacific');

  const tr = ottd.transferSector(st, 'pacific', 'transsib', adjFinalX, adjFinalZ);
  assert.equal(tr.ok, true);
  assert.equal(ottd.resolveSectorOwner(st, adjFinalX, adjFinalZ).owner, 'transsib');

  // Bilateral trade pact toggle
  assert.equal(ottd.hasPact(st, 'transsib', 'pacific'), false);
  assert.equal(ottd.togglePact(st, 'transsib', 'pacific'), true);
  assert.equal(ottd.hasPact(st, 'transsib', 'pacific'), true);

  // Bot expansion & dynamic orders
  ottd.refreshBotOrders(st, () => 0.5);
  assert(st.marketOrders.length >= 18, 'bot buy/sell market orders generated');
  const botEv = ottd.botExpandStep(st, 3, () => 0);
  assert(botEv.length >= 1, 'bots expand into adjacent sectors within border');
  assert.equal(ottd.isSpawnProtectedSector(botEv[0].sx, botEv[0].sz), false);
  assert.equal(ottd.renderAsciiMap(st, 0, 0, 2).length, 5, 'ASCII territory map renders 5x5 grid');
});

test('terrain config and worldgen datapack provide Tectonic max_y=512, sky_refuges, and boosted canyon carver', () => {
  const path = require('path');
  const tect = JSON.parse(fs.readFileSync(path.join(__dirname, '../overrides/config/tectonic.json'), 'utf8'));
  assert(tect.global_terrain && tect.global_terrain.max_y >= 512, 'tectonic max_y >= 512');
  assert(tect.global_terrain && tect.global_terrain.vertical_scale >= 1.3, 'dramatic vertical scale');
  const canyon = JSON.parse(fs.readFileSync(path.join(__dirname, '../overrides/kubejs/data/minecraft/worldgen/configured_carver/canyon.json'), 'utf8'));
  assert(canyon.config && canyon.config.probability >= 0.03, 'canyon carver probability boosted');
  const sky = JSON.parse(fs.readFileSync(path.join(__dirname, '../overrides/kubejs/data/longhaul/worldgen/structure/sky_refuges.json'), 'utf8'));
  assert(sky.start_height && sky.start_height.min_inclusive && sky.start_height.min_inclusive.absolute >= 200, 'sky_refuges placed at Y>=200');
});

test('subtle-effects is pinned to 1.13.2 (avoids Forge 47.4.14 Entity$FluidCalcs crash on 47.4.10)', () => {
  const path = require('path');
  const pin = JSON.parse(fs.readFileSync(path.join(__dirname, '../audit/subtle-effects-1.13.2.json'), 'utf8'));
  assert.equal(pin.version_number, '1.13.2');
  assert.equal(pin.files[0].filename, 'SubtleEffects-forge-1.20.1-1.13.2.jar');
});

console.log(tests + ' model tests passed; Minecraft integration is a separate test.');
