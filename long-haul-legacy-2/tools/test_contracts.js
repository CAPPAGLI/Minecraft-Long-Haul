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
  assert(qFiles.length >= 4600 && qFiles.length <= 4800, 'expected 4600..4800 quests, got ' + qFiles.length);
  const bannedSubstrs = ['shulker', 'ender_chest', 'ender_drawer', 'jetpack', 'dislocator', 'supplementaries:sack', 'supplementaries:safe', 'quark:backpack', 'allthemodium', 'vibranium', 'unobtainium', 'spawn_egg'];
  const checkNotBanned = (id, ctx) => {
    const low = String(id || '').toLowerCase();
    bannedSubstrs.forEach(b => assert(!low.includes(b), `banned item ${id} in ${ctx}`));
  };
  qFiles.forEach(f => {
    const q = JSON.parse(fs.readFileSync(path.join(qDir, f), 'utf8'));
    assert(q.display && typeof q.display.title === 'object' && typeof q.display.title.text === 'string', f + ' invalid display.title');
    assert(q.display && typeof q.display.subtitle === 'object' && typeof q.display.subtitle.text === 'string', f + ' invalid display.subtitle');
    if (q.display.icon && q.display.icon.item && q.display.icon.item.id) checkNotBanned(q.display.icon.item.id, f + ' icon');
    Object.values(q.tasks || {}).forEach(t => {
      if (t.type === 'heracles:item' && t.item) checkNotBanned(t.item, f + ' task');
    });
    const rews = Object.values(q.rewards || {});
    assert(rews.length > 0, f + ' must have at least one reward');
    rews.forEach(r => {
      if (r.type === 'heracles:xp') {
        assert(r.xptype === 'LEVEL' || r.xptype === 'POINTS', f + ' invalid heracles:xp xptype: ' + r.xptype);
        assert(r.amount > 0, f + ' invalid heracles:xp amount');
      } else if (r.type === 'heracles:item') {
        assert(r.item && r.item.id && r.item.count > 0, f + ' invalid heracles:item reward');
        checkNotBanned(r.item.id, f + ' reward');
      } else if (r.type === 'heracles:selectable') {
        assert(r.amount > 0 && r.rewards && Object.keys(r.rewards).length > 0, f + ' invalid heracles:selectable reward');
        Object.values(r.rewards).forEach(sr => {
          assert(sr.type === 'heracles:item' && sr.item && sr.item.id, f + ' invalid selectable sub-reward');
          checkNotBanned(sr.item.id, f + ' selectable reward');
        });
      }
    });
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

test('territory border uses 61-stage (60-step) diminishing-returns concave area curve (more territory early, less late) up to 175000 at locked <= 1', () => {
  const tm = sandbox.global.LHTerritoryMath;
  assert.equal(tm.TOTAL_GATES, 61);
  const sizes = Array.from({ length: 62 }, (_, u) => tm.computeBorder(61, u).size);
  assert.equal(sizes[0], 724);
  assert.equal(sizes[1], 31825);
  assert.equal(sizes[59], 174976);
  assert.equal(sizes[60], 175000);
  assert.equal(sizes[61], 175000);
  for (let i = 1; i <= 59; i++) {
    const prevDSize = sizes[i] - sizes[i - 1];
    const nextDSize = sizes[i + 1] - sizes[i];
    assert(prevDSize > nextDSize, `expected decreasing border width increment at step ${i}: ${prevDSize} vs ${nextDSize}`);
    const prevDArea = sizes[i] * sizes[i] - sizes[i - 1] * sizes[i - 1];
    const nextDArea = sizes[i + 1] * sizes[i + 1] - sizes[i] * sizes[i];
    assert(prevDArea > nextDArea, `expected decreasing area increment at step ${i}: ${prevDArea} vs ${nextDArea}`);
  }
});

test('difficulty coefficient scales with online deaths / online players (target 275.15 -> 96 for 61 chapters) with no cap and drives random respawn radius 20203', () => {
  const dm = sandbox.global.LHDifficultyMath;
  assert.equal(dm.TARGET_AVG_DEATHS, 275.15);
  assert.equal(dm.compute(0, 5), 1.0);
  assert.equal(dm.compute(10, 0), 1.0);
  assert(Math.abs(dm.compute(275.15 * 3, 3) - 96.0) < 1e-9);
  assert(dm.compute(200, 2) > dm.compute(200, 4));
  assert(Math.abs(dm.compute(550.3 * 2, 2) - 191.0) < 1e-9);
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

test('hard-feature catalog contains exactly 100 unique complications with always-active base ore_scarcity', () => {
  const catalog = sandbox.global.LHHardFeatureCatalog || [];
  assert.equal(catalog.length, 100, 'expected exactly 100 hard features, got ' + catalog.length);
  const ids = new Set(catalog.map(f => f.id));
  assert.equal(ids.size, 100, 'all 100 hard feature IDs must be unique');
  const oreBase = catalog.find(f => f.id === 'ore_scarcity');
  assert(oreBase && oreBase.isBase === true, 'ore_scarcity must be marked isBase: true (always active)');
  const baseCount = catalog.filter(f => f.isBase).length;
  assert.equal(baseCount, 1, 'expected 1 always-active base complication + 99 casino unlockables');
  [
    'ore_scarcity', 'wood_scarcity', 'smarter_mobs', 'immortal_snail',
    'voidout_explosion', 'toxic_gas', 'random_respawn', 'death_item_loss',
    'overload_encumbrance', 'cold_altitude_frost', 'machine_sabotage_lightning',
    'abyssal_pressure', 'toxic_rain_corrosion', 'spore_spoilage', 'insomnia_ambush',
    'solar_heatstroke', 'brittle_stone', 'armored_undead', 'snail_sprint_surge',
    'doomed_final_protocol'
  ].forEach(k => {
    assert(ids.has(k), 'missing hard feature ' + k);
  });
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
  assert.deepEqual(Object.keys(map.story_03_dinner_telegram.display.groups || {}), ['01 · Начало и правила'], 'Глава III moved to Chapter 01');
  assert(map.arcane_04_hex_casting && map.arcane_05_hex_automation, 'Chapter 02 Hex Casting quests present');
  assert(map.nuclear_01_geiger && map.nuclear_06_fusion_core, 'Chapter 11 Nuclear/Draconic quests present');
  assert(map.openttd_01_found_company && map.openttd_06_empire_verify, 'Chapter 12 OpenTTD quests present');
  assert(map.alpha_photo && map.tutorial_camera && map.photo_forest, 'Chapter 13 Photo quests present');
  assert(map.doomed_01_intro && map.doomed_06_safe_toggle, 'Chapter 14 DOOMED quests present');
  assert.deepEqual(Object.keys(map.doomed_01_intro.display.groups || {}), ['14 · DOOMED: Хардкор-выживание'], 'Chapter 14 DOOMED is a mandatory main chapter (not optional)');

  // Verify every single photo/camera quest lives exclusively in Chapter 13 and no chapter has overlapping node positions
  const seenCoordsByGroup = {};
  Object.keys(map).forEach(qid => {
    const grpsObj = map[qid].display.groups || {};
    const grps = Object.keys(grpsObj);
    const iconItem = map[qid].display && map[qid].display.icon && map[qid].display.icon.item && map[qid].display.icon.item.id;
    const isPhoto = qid.indexOf('photo') !== -1 || qid === 'tutorial_camera' || qid === 'tutorial_film' || qid === 'tutorial_album' || iconItem === 'exposure:photograph';
    if (isPhoto) {
      assert.deepEqual(grps, ['13 · Фотодокументация (Опционально)'], qid + ' must be in Ch.13');
    } else {
      assert(!grps.includes('13 · Фотодокументация (Опционально)'), qid + ' should not be in Ch.13');
    }
    grps.forEach(g => {
      const pos = grpsObj[g].position;
      const key = `${pos[0]},${pos[1]}`;
      seenCoordsByGroup[g] = seenCoordsByGroup[g] || new Set();
      assert(!seenCoordsByGroup[g].has(key), `duplicate position ${key} in ${g} (${qid})`);
      seenCoordsByGroup[g].add(key);
    });
  });

  const groupsTxt = fs.readFileSync(path.join(__dirname, '../overrides/config/heracles/groups.txt'), 'utf8');
  const groupLines = groupsTxt.trim().split('\n').filter(Boolean);
  assert(groupLines.length >= 60, 'expected >= 60 Heracles groups, got ' + groupLines.length);
  assert(groupsTxt.includes('14 · DOOMED: Хардкор-выживание\n') || groupsTxt.trim().endsWith('14 · DOOMED: Хардкор-выживание'));
  assert(!groupsTxt.includes('14 · DOOMED: Хардкор-выживание (Опционально)'));
  const terrJs = fs.readFileSync(path.join(__dirname, '../overrides/kubejs/server_scripts/26_hard_features_and_territory.js'), 'utf8');
  assert(terrJs.includes("'ch14'") && terrJs.includes("'ch61'") && terrJs.includes("computeBorder(totalMain, effectiveUnlocked)"));
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

test('terrain config and worldgen datapack provide Tectonic max_y>=448, sky_refuges, and boosted canyon carver', () => {
  const path = require('path');
  const tect = JSON.parse(fs.readFileSync(path.join(__dirname, '../overrides/config/tectonic.json'), 'utf8'));
  assert(tect.global_terrain && tect.global_terrain.max_y >= 448, 'tectonic max_y >= 448');
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

test('alpha20 profile adds safe optimization/animation/graphics mods and wires /lh GUI + control_tablet', () => {
  const path = require('path');
  const prof = JSON.parse(fs.readFileSync(path.join(__dirname, '../profiles/alpha20.json'), 'utf8'));
  const all = Object.values(prof.categories).flat();
  const cli = new Set(prof.client_only);
  ['structure-layout-optimizer', 'redirected', 'fast-ip-ping', 'krypton-fnp',
   'better-animations-collection', 'wavey-capes', 'cave-dust', 'itemphysic-lite',
   'particular-reforged', 'visuality-forge', 'make_bubbles_pop', 'wakes-reforged',
   'hex-casting', 'paucal', 'caelus', 'inline'].forEach(slug => {
    assert(all.includes(slug), 'missing mod in alpha20: ' + slug);
  });
  const hexCfg = fs.readFileSync(path.join(__dirname, '../overrides/defaultconfigs/hexcasting-server.toml'), 'utf8');
  assert(hexCfg.includes('hexcasting:teleport/great'), 'hexcasting-server.toml must block Greater Teleport');
  ['fast-ip-ping', 'better-animations-collection', 'wavey-capes',
   'cave-dust', 'itemphysic-lite', 'visuality-forge', 'make_bubbles_pop'].forEach(slug => {
    assert(cli.has(slug), 'client-only mod must be in client_only: ' + slug);
  });
  assert(!cli.has('particular-reforged'), 'particular-reforged 1.20.1 is required on server and must not be client_only');
  assert(!all.includes('servercore'), 'servercore must remain excluded due to Valkyrien Skies conflict');

  const guiJs = fs.readFileSync(path.join(__dirname, '../overrides/kubejs/server_scripts/30_lh_gui.js'), 'utf8');
  assert(guiJs.includes('lhOpenGui') && guiJs.includes('LH_GUI_TABS') && guiJs.includes('longhaul:control_tablet'));
  assert(guiJs.includes('resetClickHandlers') && guiJs.includes('gui.anyClicked') && guiJs.includes('closeContainer'),
         '30_lh_gui.js must reset click handlers, use gui.anyClicked for background, and call closeContainer()');
  const itemsJs = fs.readFileSync(path.join(__dirname, '../overrides/kubejs/startup_scripts/01_longhaul_items.js'), 'utf8');
  assert(itemsJs.includes("'control_tablet'"));
  assert(fs.existsSync(path.join(__dirname, '../overrides/kubejs/assets/longhaul/textures/item/control_tablet.png')));
});

test('OpenTTD buildings (2-way fork), territory violations, diplomacy, and supply contracts work cleanly', () => {
  const path = require('path');
  const O = sandbox.global.LHOpenTTD;
  assert(O && O.BUILDING_CATALOG, 'BUILDING_CATALOG present');
  assert.equal(Object.keys(O.BUILDING_CATALOG).length, 6, '6 building types across 3 categories');
  const cats = new Set(Object.values(O.BUILDING_CATALOG).map(b => b.category));
  assert(cats.has('extraction') && cats.has('logistics') && cats.has('production'), 'all 3 building categories present');

  const st = O.createInitialState();
  O.ensureBots(st);
  const cRes = O.companyCreate(st, 'p1', 'acme', 'Acme Corp');
  assert(cRes.ok);
  st.companies.acme.cash = 5000;
  st.companies.bot_ironrail.cash = 5000;

  // Claim sector (0,3) adjacent to HQ (0,2) and build + upgrade with 2-way branching lockout
  const clm = O.claimOrCaptureSector(st, 'acme', 0, 3, false);
  assert(clm.ok, 'claimed (0,3)');
  const bld = O.buildCompanyBuilding(st, 'acme', 0, 3, 'mine_shaft');
  assert(bld.ok && bld.building.level === 1);

  // Tier 1 fork: pick option A, then option B must be rejected / locked out
  const forkA = O.BUILDING_CATALOG.mine_shaft.tier1Fork[0].id;
  const forkB = O.BUILDING_CATALOG.mine_shaft.tier1Fork[1].id;
  const up1 = O.upgradeCompanyBuilding(st, 'acme', 0, 3, forkA);
  assert(up1.ok && up1.building.level === 2 && up1.building.branch1 === forkA && up1.building.locked1 === forkB);
  const up1b = O.upgradeCompanyBuilding(st, 'acme', 0, 3, forkB);
  assert(!up1b.ok, 'second Tier 1 branch locked out after choosing first branch');

  // Tier 2 fork
  const t2A = O.BUILDING_CATALOG.mine_shaft.tier2Fork[0].id;
  const t2B = O.BUILDING_CATALOG.mine_shaft.tier2Fork[1].id;
  const up2 = O.upgradeCompanyBuilding(st, 'acme', 0, 3, t2A);
  assert(up2.ok && up2.building.level === 3 && up2.building.branch2 === t2A && up2.building.locked2 === t2B);
  const up3 = O.upgradeCompanyBuilding(st, 'acme', 0, 3, t2B);
  assert(!up3.ok && up3.reason === 'max_level', 'cannot pick second Tier 2 branch');

  // Production tick + collect
  const ticks = O.tickCompanyBuildings(st);
  assert(ticks >= 1 && st.buildings['0,3'].cashBuffer > 0);
  const col = O.collectBuildingOutput(st, 'acme', 0, 3);
  assert(col.ok && col.cash > 0);

  // Territory violation penalties on trespass & block breaking without license
  assert(!O.canTransit(st, 'acme', 'bot_ironrail'), 'no initial transit license');
  const v1 = O.recordTerritoryViolation(st, 'acme', 'bot_ironrail', 'trespass', 2, 0);
  assert(v1.violated && v1.delta < 0 && v1.newScore < 0 && v1.fine > 0);
  const v2 = O.recordTerritoryViolation(st, 'acme', 'bot_ironrail', 'break_ore', 2, 0);
  assert(v2.violated && v2.newScore < v1.newScore);

  // Diplomacy: gift improves score, buy transit & mining licenses, alliance, peaceful buyout, supply contract
  const g1 = O.formOrBreakAlliance(st, 'acme', 'bot_ironrail', 'gift');
  assert(g1.ok && g1.score > v2.newScore);
  const licT = O.buyLicense(st, 'acme', 'bot_ironrail', 'transit');
  assert(licT.ok && O.canTransit(st, 'acme', 'bot_ironrail'));
  const licM = O.buyLicense(st, 'acme', 'bot_ironrail', 'mining');
  assert(licM.ok && O.canMine(st, 'acme', 'bot_ironrail'));

  // Push score >= 25 to allow alliance
  O.adjustRelation(st, 'acme', 'bot_ironrail', 40);
  const ally = O.formOrBreakAlliance(st, 'acme', 'bot_ironrail', 'ally');
  assert(ally.ok && ally.allied && O.hasPact(st, 'acme', 'bot_ironrail'));

  // Peaceful sector buyout on a claimed rival sector
  st.claims['3,0'] = { owner: 'bot_ironrail', strength: 1, since: 1 };
  const buySec = O.diplomaticBuySector(st, 'acme', 3, 0);
  assert(buySec.ok && st.claims['3,0'].owner === 'acme');

  // Supply contract creation & fulfillment
  const scCreate = O.createSupplyContract(st, 'acme', 'bot_ironrail', 'minecraft:iron_ingot', 16, 200, 2);
  assert(scCreate.ok);
  const scFulfill = O.fulfillSupplyContract(st, 'acme', scCreate.contract.id);
  assert(scFulfill.ok && scFulfill.payout === 200);

  // Realistic Walkie-Talkie optional addon + config
  const cfAddons = JSON.parse(fs.readFileSync(path.join(__dirname, '../optional-mods/curseforge-addons.json'), 'utf8'));
  assert(cfAddons.addons.some(a => a.curseforge_project_id === 1750447 && a.mod_id === 'walkietalkies'),
         'Realistic Walkie-Talkie registered in curseforge-addons.json');
  assert(fs.existsSync(path.join(__dirname, '../overrides/config/walkietalkies-server.properties')),
         'walkietalkies-server.properties present');
});

test('LHChapterFork enforces mandatory start -> early (5) -> mid (6) -> late 3-choice random forks across 61 chapters', () => {
  const F = sandbox.global.LHChapterFork;
  assert(F, 'LHChapterFork loaded');
  assert.equal(F.MANDATORY_CHAPTERS.length, 3);
  assert.equal(F.EARLY_CHAPTERS.length, 18);
  assert.equal(F.MID_CHAPTERS.length, 23);
  assert.equal(F.LATE_CHAPTERS.length, 17);
  assert.equal(3 + 18 + 23 + 17, 61, 'all 61 main chapters partitioned cleanly');

  const completed = {};
  const ps = F.ensurePlayerState(null);
  assert(!F.isMandatoryDone(completed));
  assert.equal(F.currentEligibleTier(ps, completed), 'mandatory');
  const blockedRoll = F.rollThreeChoices(ps, completed);
  assert(!blockedRoll.ok && blockedRoll.reason === 'mandatory_incomplete');

  // Complete mandatory ch00..ch02 -> unlocks early tier + rolls 3 random choices
  completed.ch00 = true; completed.ch01 = true; completed.ch02 = true;
  assert(F.isMandatoryDone(completed));
  assert.equal(F.currentEligibleTier(ps, completed), 'early');
  const rollEarly = F.rollThreeChoices(ps, completed);
  assert(rollEarly.ok && rollEarly.offers.length === 3);
  rollEarly.offers.forEach(c => assert(F.EARLY_CHAPTERS.includes(c), 'offer is from EARLY tier: ' + c));

  // Pick 1 from offer -> cannot pick another until active is completed
  const picked1 = rollEarly.offers[0];
  const pk1 = F.pickChapterFromOffer(ps, picked1, completed);
  assert(pk1.ok && ps.activePick === picked1 && ps.unlocked.includes(picked1));
  const pkDup = F.pickChapterFromOffer(ps, rollEarly.offers[1], completed);
  assert(!pkDup.ok && pkDup.reason === 'active_chapter_pending');

  // Complete 5 early chapters -> transitions strictly to MID tier!
  completed[picked1] = true;
  F.onChapterCompleted(ps, picked1, completed);
  for (let i = 0; i < 4; i++) {
    const r = F.rollThreeChoices(ps, completed);
    assert(r.ok && r.tier === 'early');
    const c = r.offers[0];
    assert(F.pickChapterFromOffer(ps, c, completed).ok);
    completed[c] = true;
    F.onChapterCompleted(ps, c, completed);
  }
  assert.equal(F.currentEligibleTier(ps, completed), 'mid', '5 completed early chapters unlock mid tier');
  const rollMid = F.rollThreeChoices(ps, completed);
  assert(rollMid.ok && rollMid.offers.length === 3);
  rollMid.offers.forEach(c => assert(F.MID_CHAPTERS.includes(c), 'offer is from MID tier: ' + c));
});

test('LHEconomyEngine covers items/fluids/gas/energy, recipe graph, market crash, admin overrides, physical facility pickup, and balanced trader', () => {
  const E = sandbox.global.LHEconomyEngine;
  const O = sandbox.global.LHOpenTTD;
  assert(E, 'LHEconomyEngine loaded');

  const econ = E.createInitialEconomyState();
  // 1. Recipe graph propagates ingredient prices into crafted items
  E.propagateRecipePrices(econ, [
    { outId: 'test:steel_gear', outCount: 2, ingredients: [{ id: 'minecraft:iron_ingot', count: 4 }, { id: 'minecraft:coal', count: 2 }] }
  ]);
  const gearQ = E.getMarketQuote(econ, 'test:steel_gear');
  assert(gearQ.basePrice >= 35, 'crafted item inherits ingredient value: ' + gearQ.basePrice);
  assert(E.getMarketQuote(econ, 'fluid:immersivepetroleum:crudeoil').price > 0, 'fluid priced');
  assert(E.getMarketQuote(econ, 'gas:mekanism:hydrogen').price > 0, 'gas priced');
  assert(E.getMarketQuote(econ, 'energy:fe_10k').price > 0, 'energy FE priced');

  // 2. Oversupply triggers Market Crash (обвал рынка) and drops multiplier sharply
  const dump = E.recordTradePressure(econ, 'minecraft:iron_ingot', 'sell', E.CRASH_NET_SUPPLY_THRESHOLD + 10);
  assert.equal(dump.crashedJustNow, true, 'oversupply triggers market crash');
  assert(dump.quote.crashed && dump.quote.multiplier <= 0.35, 'crashed multiplier drops sharply: ' + dump.quote.multiplier);
  for (let i = 0; i < E.CRASH_DURATION_TICKS; i++) E.decayMarketTick(econ);
  assert.equal(E.getMarketQuote(econ, 'minecraft:iron_ingot').crashed, false, 'market recovers after crash ticks');

  // 3. Admin price overrides & bounds
  assert.equal(E.setAdminPrice(econ, 'minecraft:diamond', 500).price, 500);
  assert.equal(E.clearAdminPrice(econ, 'minecraft:diamond').adminLocked, false);
  const bnd = E.setAdminBounds(econ, 'minecraft:diamond', 120, 140);
  assert(bnd.price >= 120 && bnd.price <= 140);

  // 4. Physical facility trading requires physical pickup at building coords
  const st = O.createInitialState();
  const c1 = O.companyCreate(st, 'u1', 'seller_co', 'Продавец', 768, 0).company;
  const c2 = O.companyCreate(st, 'u2', 'buyer_co', 'Покупатель', 0, 768).company;
  const sc = O.sectorCoords(768, 0);
  const bRes = O.buildCompanyBuilding(st, c1.id, sc.sx, sc.sz, 'warehouse', 768, 70, 0);
  assert(bRes.ok);
  const listRes = E.createFacilityListing(econ, c1.id, bRes.building, 'minecraft:iron_ingot', 16, 18);
  assert(listRes.ok && listRes.marketQuote.price > 0);
  const buyRes = E.buyFacilityListing(st, econ, c2.id, listRes.listing.id, 8);
  assert(buyRes.ok && buyRes.order.status === 'ready');
  // Remote pickup rejected; physical proximity accepted
  const farPick = E.pickupLogisticsOrder(econ, c2.id, buyRes.order.id, 0, 70, 768, 24);
  assert(!farPick.ok && farPick.reason === 'too_far');
  const nearPick = E.pickupLogisticsOrder(econ, c2.id, buyRes.order.id, 771, 70, 3, 24);
  assert(nearPick.ok && nearPick.order.status === 'collected');

  // 5. Wandering Trader offers span -60% to +200% with balanced total value
  const wt = E.generateWanderingTraderOffers(econ, () => 0.42);
  assert.equal(wt.offers.length, 8);
  assert(wt.offers.some(o => o.offsetPct === -60), 'has -60% offer');
  assert(wt.offers.some(o => o.offsetPct === 200), 'has +200% offer');
  assert(wt.imbalancePct <= 25, 'discount and markup value roughly balanced: ' + wt.imbalancePct + '%');

  // 6. Bot claim cap tied to player claims + dynamic bot on border expansion + physical building destruction
  const stCap = O.createInitialState();
  assert.equal(O.countBotClaimsTotal(stCap), 3, 'bots start with only 3 HQ claims');
  assert.equal(O.maxBotClaimsAllowed(stCap), 3, 'with 0 player claims bots cannot claim extra sectors');
  const botTry = O.botExpandStep(stCap, 6, () => 0.1);
  assert.equal(botTry.length, 0, 'bots blocked from claiming extra sectors when players have 0 claims');
  O.companyCreate(stCap, 'pu1', 'alpha', 'Альфа', 512, 512);
  assert(O.maxBotClaimsAllowed(stCap) > 3, 'player HQ claim expands bot claim allowance');
  const dyn = O.spawnDynamicBotCompany(stCap, 8, () => 0.35);
  assert(dyn.ok && dyn.bot.isBot && stCap.claims[O.sectorKey(dyn.sx, dyn.sz)].owner === dyn.bot.id);

  // Building damage & repair
  const pSc = O.sectorCoords(512, 512);
  const pb = O.buildCompanyBuilding(stCap, 'alpha', pSc.sx, pSc.sz, 'mine_shaft', 512, 70, 512);
  assert(pb.ok);
  const dmg1 = O.damageBuildingIntegrity(stCap, pSc.sx, pSc.sz, 14, false);
  assert(dmg1.ok && dmg1.integrityPct === 30 && dmg1.operational === false);
  const rep1 = O.repairBuildingIntegrity(stCap, 'alpha', pSc.sx, pSc.sz);
  assert(rep1.ok && rep1.integrityPct === 100);
  const dmgCore = O.damageBuildingIntegrity(stCap, pSc.sx, pSc.sz, 1, true);
  assert(dmgCore.ok && dmgCore.destroyed === true && !O.getSectorBuilding(stCap, pSc.sx, pSc.sz));
});

test('Spawn/border safety guards and native Xaero territory integration are wired cleanly', () => {
  const path = require('path');
  const ROOT = path.resolve(__dirname, '..');
  const s26 = fs.readFileSync(path.join(ROOT, 'overrides/kubejs/server_scripts/26_hard_features_and_territory.js'), 'utf8');
  const s27 = fs.readFileSync(path.join(ROOT, 'overrides/kubejs/server_scripts/27_openttd_companies.js'), 'utf8');
  const c01 = fs.readFileSync(path.join(ROOT, 'overrides/kubejs/client_scripts/01_xaero_integration.js'), 'utf8');
  assert(s26.includes('lhActiveBorderHalf') && s26.includes('lhClampToSafeBorder'), '26_hard_features_and_territory clamps spawns to active border');
  assert(!s26.includes('lhCompanyRead'), 'no undefined lhCompanyRead call in first-join spawn');
  assert(s27.includes('lhSyncXaeroTerritories') && !s27.includes("type: 'rectangle'") && !s27.includes("draw: 'ingame'"), '27_openttd_companies uses Xaero sync instead of custom HUD paint minimap');
  assert(s27.includes('mapData.locked()') && s27.includes('setMapData'), 'lhGiveTerritoryMapItem locks MapItemSavedData so vanilla terrain never overwrites it');
  const prof = JSON.parse(fs.readFileSync(path.join(ROOT, 'profiles/alpha20.json'), 'utf8'));
  assert(prof.categories.qol.includes('mimi') && prof.categories.qol.includes('reactive-music'), 'alpha20 includes MIMI and Reactive Music');
  assert(prof.client_only.includes('reactive-music') && Array.isArray(prof.resourcepacks) && prof.resourcepacks.includes('U85lsKF1'), 'alpha20 marks reactive-music client-only and pins Deepwoken Music resourcepack');
  assert(c01.includes('lh:xaero_territories') && c01.includes('LongHaulXaeroData'), 'client script forwards territory sync to Xaero bridge');
  [
    'runtime-mod/src/main/java/longhaul/runtime/mixin/LongHaulMixinPlugin.java',
    'runtime-mod/src/main/java/longhaul/runtime/mixin/WorldMapRegistryMixin.java',
    'runtime-mod/src/main/java/longhaul/runtime/mixin/MinimapRegistryMixin.java',
    'runtime-mod/src/main/java/longhaul/runtime/xaero/LongHaulXaeroData.java',
    'runtime-mod/src/main/java/longhaul/runtime/xaero/WorldMapSectorHighlighter.java',
    'runtime-mod/src/main/java/longhaul/runtime/xaero/MinimapSectorHighlighter.java',
    'runtime-mod/src/main/java/longhaul/runtime/xaero/XaeroRefreshBridge.java'
  ].forEach(rel => assert(fs.existsSync(path.join(ROOT, rel)), 'Xaero runtime file exists: ' + rel));
});

console.log(tests + ' model tests passed; Minecraft integration is a separate test.');
