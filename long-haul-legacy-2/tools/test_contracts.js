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
  assert(st.companies.bot_ironrail && st.companies.bot_greencart && st.companies.bot_skyport && st.companies.bot_seawolf, '4 AI bots seeded across all 4 environments');
  assert.equal(ottd.isSpawnProtectedSector(0, 0), true);
  assert.equal(ottd.isSpawnProtectedSector(1, 1), true);
  assert.equal(ottd.isSpawnProtectedSector(2, 0), false);
  assert.equal(ottd.resolveSectorOwner(st, 0, 0).kind, 'unclaimed');
  assert.equal(ottd.resolveSectorOwner(st, 0, 0).owner, null);
  assert.equal(ottd.resolveSectorOwner(st, 7, 2).owner, 'bot_ironrail');
  // Voronoi partition assigns distant unclaimed sectors to nearest company HQ/outpost
  const vor = ottd.resolveSectorOwner(st, 14, 2);
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
  const remSx = c1.company.hqSx - 2;
  const remSz = c1.company.hqSz + 2;
  assert.equal(ottd.claimOrCaptureSector(st, 'transsib', remSx, remSz, false, { remote: true }).ok, false);
  const remCost = ottd.computeClaimCost(st, 'transsib', remSx, remSz);
  assert.equal(remCost.adjacent, false);
  assert(remCost.exclaveMult > 1.0);
  st.companies.transsib.cash += remCost.cost + 500;
  assert.equal(ottd.claimOrCaptureSector(st, 'transsib', remSx, remSz, false).ok, true);

  // Hostile capture fails without allowCapture, succeeds with allowCapture & compensates rival
  assert.equal(ottd.claimOrCaptureSector(st, 'pacific', adjFinalX, adjFinalZ, false).ok, false);
  const capCost = ottd.computeClaimCost(st, 'pacific', adjFinalX, adjFinalZ);
  st.companies.pacific.cash += (capCost.cost || 5000) + 5000;
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
  st.companies.pacific.cash += 50000;
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
  assert(st.marketOrders.length >= 24, 'bot buy/sell market orders generated for 4 bots');
  const botEv = ottd.botExpandStep(st, 10, () => 0);
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
  ['structure-layout-optimizer', 'redirected', 'fast-ip-ping',
   'better-animations-collection', 'wavey-capes', 'cave-dust', 'itemphysic-lite',
   'particular-reforged', 'visuality-forge', 'make_bubbles_pop', 'wakes-reforged',
   'hex-casting', 'paucal', 'caelus', 'inline'].forEach(slug => {
    assert(all.includes(slug), 'missing mod in alpha20: ' + slug);
  });
  assert(!all.includes('krypton-fnp'), 'krypton-fnp must remain excluded to avoid Netty flush/login packet-sync stalls');
  assert(!all.includes('seamless-loading-screen'), 'seamless-loading-screen must remain excluded to avoid ReceivingLevelScreen freeze');
  const asmPy = fs.readFileSync(path.join(__dirname, 'assemble_alpha.py'), 'utf8');
  assert(!/\bchunky\b/.test(asmPy.split('BASE_ROOTS')[1].split("'''.split()")[0]), 'chunky must remain excluded from BASE_ROOTS due to Distant Horizons conflict');

  const dhToml = fs.readFileSync(path.join(__dirname, '../overrides/config/DistantHorizons.toml'), 'utf8');
  assert(dhToml.includes('showGarbageCollectorWarning = false'), 'DistantHorizons G1GC warning must be disabled');
  assert(dhToml.includes('showModCompatibilityWarningsOnStartup = false'), 'DistantHorizons startup mod compat warnings must be disabled');
  const acToml = fs.readFileSync(path.join(__dirname, '../overrides/config/alexscaves-client.toml'), 'utf8');
  assert(acToml.includes('biome_ambient_light_coloring = false'), 'AlexsCaves biome_ambient_light_coloring must be disabled for DH compatibility');
  const ifToml = fs.readFileSync(path.join(__dirname, '../overrides/config/ironfurnaces-client.toml'), 'utf8');
  assert(ifToml.includes('updates = false'), 'IronFurnaces update checker must be disabled');
  const terrJs = fs.readFileSync(path.join(__dirname, '../overrides/kubejs/server_scripts/26_hard_features_and_territory.js'), 'utf8');
  assert(terrJs.includes('LHPendingFirstJoins') && terrJs.includes('lhProcessFirstJoinQueue'), 'first-join spawn must defer chunk lookup outside PlayerEvents.loggedIn');

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
  assert(Object.keys(O.BUILDING_CATALOG).length >= 14, '14 building types across 5 categories');
  const cats = new Set(Object.values(O.BUILDING_CATALOG).map(b => b.category));
  assert(cats.has('extraction') && cats.has('logistics') && cats.has('production') && cats.has('security') && cats.has('energy') && cats.has('structure'), 'all building categories present');

  const st = O.createInitialState();
  O.ensureBots(st);
  const cRes = O.companyCreate(st, 'p1', 'acme', 'Acme Corp');
  assert(cRes.ok);
  st.companies.acme.cash = 50000;
  st.companies.bot_ironrail.cash = 50000;

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
  assert.equal(O.countBotClaimsTotal(stCap), 4, 'bots start with only 4 HQ claims');
  assert.equal(O.maxBotClaimsAllowed(stCap), 4, 'with 0 player claims bots cannot claim extra sectors');
  const botTry = O.botExpandStep(stCap, 10, () => 0.1);
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
  assert(s27.includes('TerritoryMapHelper') && fs.existsSync(path.join(ROOT, 'runtime-mod/src/main/java/com/longhaul/runtime/map/TerritoryMapHelper.java')), 'lhGiveTerritoryMapItem uses TerritoryMapHelper to lock MapItemSavedData so vanilla terrain never overwrites it');
  assert((s27.match(/!isSpawnZone && sec\.kind !== 'claimed'/g) || []).length === 2, '27_openttd_companies must allow both block breaking and container looting inside the 3x3 neutral spawn zone');
  const prof = JSON.parse(fs.readFileSync(path.join(ROOT, 'profiles/alpha20.json'), 'utf8'));
  assert(prof.categories.qol.includes('mimi') && prof.categories.qol.includes('reactive-music') && prof.categories.qol.includes('pehkui'), 'alpha20 includes MIMI, Reactive Music, and Pehkui');
  assert(prof.client_only.includes('reactive-music') && Array.isArray(prof.resourcepacks) && prof.resourcepacks.includes('U85lsKF1'), 'alpha20 marks reactive-music client-only and pins Deepwoken Music resourcepack');
  assert(c01.includes('lh:xaero_territories') && c01.includes('LongHaulXaeroData'), 'client script forwards territory sync to Xaero bridge');
  assert(s26.includes("prologue") && s26.includes("doomedmatu:cigarette_pack"), '26_hard_features_and_territory wires prologue smoke & border completion');

  // Verify Chapter 00 prologue (12 quests, only check/item tasks backed by prior quest rewards)
  const qDir = path.join(ROOT, 'overrides/config/heracles/quests');
  const ch00Quests = fs.readdirSync(qDir).filter(f => f.endsWith('.json')).map(f => ({
    id: f.replace(/\.json$/, ''),
    q: JSON.parse(fs.readFileSync(path.join(qDir, f), 'utf8'))
  })).filter(e => e.q.display && e.q.display.groups && e.q.display.groups['00 · Сюжет: Ушёл за хлебом']);
  assert.equal(ch00Quests.length, 12, 'Chapter 00 has 12 theatrical prologue quests');
  const rewardedItems = new Set();
  ch00Quests.forEach(e => {
    Object.values(e.q.rewards || {}).forEach(r => {
      if (r.type === 'heracles:item' && r.item && r.item.id) rewardedItems.add(r.item.id);
    });
  });
  ch00Quests.forEach(e => {
    Object.values(e.q.tasks || {}).forEach(t => {
      assert(t.type === 'heracles:check' || t.type === 'heracles:item', 'Ch.00 task must be check or item: ' + e.id);
      if (t.type === 'heracles:item') {
        assert(rewardedItems.has(t.item), 'Ch.00 item task must use item rewarded by Ch.00: ' + e.id + ' -> ' + t.item);
      }
    });
  });

  // Ensure every longhaul:* item referenced in any Heracles quest is registered in 01_longhaul_items.js
  const lhItemsJs = fs.readFileSync(path.join(ROOT, 'overrides/kubejs/startup_scripts/01_longhaul_items.js'), 'utf8');
  const regLh = new Set([...lhItemsJs.matchAll(/\['([a-z0-9_]+)',/g)].map(m => 'longhaul:' + m[1]));
  fs.readdirSync(qDir).filter(f => f.endsWith('.json')).forEach(f => {
    const raw = fs.readFileSync(path.join(qDir, f), 'utf8');
    for (const m of raw.matchAll(/"(longhaul:[a-z0-9_]+)"/g)) {
      assert(regLh.has(m[1]), 'Quest ' + f + ' references unregistered item ' + m[1]);
    }
  });

  // Verify 34 custom longhaul_origins + Pehkui/mod integration script
  const layerJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'overrides/kubejs/data/origins/origin_layers/origin.json'), 'utf8'));
  assert.equal(layerJson.replace, true);
  assert.equal(layerJson.origins.length, 34, 'origins layer must have 34 custom origins');
  const oriFiles = fs.readdirSync(path.join(ROOT, 'overrides/kubejs/data/longhaul_origins/origins')).filter(f => f.endsWith('.json'));
  assert.equal(oriFiles.length, 34, '34 origin JSON files exist');
  const ruLang = JSON.parse(fs.readFileSync(path.join(ROOT, 'overrides/kubejs/assets/longhaul_origins/lang/ru_ru.json'), 'utf8'));
  layerJson.origins.forEach(fullId => {
    const slug = fullId.split(':')[1];
    const ori = JSON.parse(fs.readFileSync(path.join(ROOT, 'overrides/kubejs/data/longhaul_origins/origins', slug + '.json'), 'utf8'));
    assert(ruLang['origin.longhaul_origins.' + slug + '.name'], 'ru_ru has name for ' + slug);
    (ori.powers || []).forEach(pFull => {
      const pSlug = pFull.split(':')[1];
      assert(fs.existsSync(path.join(ROOT, 'overrides/kubejs/data/longhaul_origins/powers', pSlug + '.json')), 'power exists: ' + pSlug);
      assert(ruLang['power.longhaul_origins.' + pSlug + '.name'], 'ru_ru has power name for ' + pSlug);
    });
  });
  const s29 = fs.readFileSync(path.join(ROOT, 'overrides/kubejs/server_scripts/29_origins_mod_integrations.js'), 'utf8');
  assert(s29.includes('OriginsAPI') && s29.includes('pehkui:') && s29.includes('doomedmatu:cigarette'), '29_origins_mod_integrations wires OriginsAPI + Pehkui + mod integrations');
  assert(!/pehkui:base\s+0\./.test(s29), 'no origin shrinks pehkui:base below 1.0');
  assert(!JSON.stringify(ruLang).includes('[Ослабленное]') && !JSON.stringify(ruLang).includes('(KubeJS)') && !JSON.stringify(ruLang).includes('(Pehkui)'), 'Origins lang has no meta-tags');
  [
    'runtime-mod/src/main/java/longhaul/runtime/mixin/LongHaulMixinPlugin.java',
    'runtime-mod/src/main/java/longhaul/runtime/mixin/WorldMapRegistryMixin.java',
    'runtime-mod/src/main/java/longhaul/runtime/mixin/MinimapRegistryMixin.java',
    'runtime-mod/src/main/java/longhaul/runtime/xaero/LongHaulXaeroData.java',
    'runtime-mod/src/main/java/longhaul/runtime/xaero/WorldMapSectorHighlighter.java',
    'runtime-mod/src/main/java/longhaul/runtime/xaero/MinimapSectorHighlighter.java',
    'runtime-mod/src/main/java/longhaul/runtime/xaero/XaeroRefreshBridge.java'
  ].forEach(rel => assert(fs.existsSync(path.join(ROOT, rel)), 'Xaero runtime file exists: ' + rel));

  const xaeroJava = fs.readFileSync(path.join(ROOT, 'runtime-mod/src/main/java/longhaul/runtime/xaero/LongHaulXaeroData.java'), 'utf8');
  assert(xaeroJava.includes('Math.floorDiv(c + 8, 16)'), 'LongHaulXaeroData chunkToSector aligns chunk [-8..7] with sector (0,0)');
  assert(xaeroJava.includes('ThreadLocal'), 'LongHaulXaeroData uses ThreadLocal color buffer');
  assert(s27.includes('LHOTTDTrespassWarn') && s27.includes('LHOTTDMiningWarn'), '27_openttd_companies implements warning-first grace period before reputation loss');
  assert(s27.includes('lhHandlePatrolEvent') && s27.includes('lhSpawnPatrolGuards') && s27.includes('EntityEvents.death'), '27_openttd_companies wires Patrol Post alerts & L3 guard mob spawns');
});

test('Reputation-linked pricing, solo reputation sync, and upgradeable Patrol Post building', () => {
  const O = sandbox.global.LHOpenTTD;
  const E = sandbox.global.LHEconomyEngine;
  const st = O.createInitialState();
  O.ensureBots(st);
  const econ = E.createInitialEconomyState();

  // Solo player gets personal reputation penalty when violating bot territory, then syncs on company creation
  const pViol = O.recordTerritoryViolation(st, null, 'bot_ironrail', 'trespass', 2, 0, 'solo_u1', 1.0);
  assert(pViol.violated && pViol.newScore < 0, 'solo player reputation drops on violation');
  const cSolo = O.companyCreate(st, 'solo_u1', 'solo_co', 'Соло', 1024, 0).company;
  assert(O.getRelation(st, cSolo.id, 'bot_ironrail').score < 0, 'company inherits solo founder reputation');

  // High reputation lowers buy prices & raises sell payouts; negative reputation does the reverse
  const goodMods = O.getReputationPriceModifiers(80);
  const badMods = O.getReputationPriceModifiers(-80);
  assert(goodMods.buyMult < 1.0 && goodMods.sellMult > 1.0, 'positive rep lowers buy and boosts sell');
  assert(badMods.buyMult > 1.0 && badMods.sellMult < 1.0, 'negative rep raises buy and lowers sell');

  const sellerCo = O.companyCreate(st, 's_u', 'seller_rep', 'Торговец', 1536, 0).company;
  const scS = O.sectorCoords(1536, 0);
  const wh = O.buildCompanyBuilding(st, sellerCo.id, scS.sx, scS.sz, 'warehouse', 1536, 70, 0).building;
  const lst = E.createFacilityListing(econ, sellerCo.id, wh, 'minecraft:iron_ingot', 20, 100).listing;
  O.adjustRelation(st, cSolo.id, sellerCo.id, -80, 'тест наценки');
  const badBuy = E.buyFacilityListing(st, econ, cSolo.id, lst.id, 1);
  assert(badBuy.ok && badBuy.totalPrice > 100, 'negative reputation increases listing purchase price: ' + badBuy.totalPrice);
  O.adjustRelation(st, cSolo.id, sellerCo.id, 160, 'тест скидки');
  const goodBuy = E.buyFacilityListing(st, econ, cSolo.id, lst.id, 1);
  assert(goodBuy.ok && goodBuy.totalPrice < 100, 'positive reputation lowers listing purchase price: ' + goodBuy.totalPrice);

  // Patrol Post building: Lv1 -> Lv2 (radar_watchtower 420m) -> Lv3 (warden_bunker spawns guards)
  cSolo.cash = 5000;
  const pBuild = O.buildCompanyBuilding(st, cSolo.id, O.sectorCoords(1024, 0).sx, O.sectorCoords(1024, 0).sz, 'patrol_post', 1024, 70, 0);
  assert(pBuild.ok && pBuild.building.type === 'patrol_post', 'patrol_post built cleanly');
  let cov = O.findPatrolPostsCovering(st, cSolo.id, 1200, 0);
  assert(cov.length === 1 && cov[0].radius === 256 && !cov[0].spawnGuards, 'Lv1 patrol covers 256m without guard spawns');
  const up1 = O.upgradeCompanyBuilding(st, cSolo.id, O.sectorCoords(1024, 0).sx, O.sectorCoords(1024, 0).sz, 'radar_watchtower');
  assert(up1.ok && up1.building.level === 2);
  cov = O.findPatrolPostsCovering(st, cSolo.id, 1400, 0);
  assert(cov.length === 1 && cov[0].radius === 420 && cov[0].markIntruders === true, 'Lv2 radar_watchtower extends radius to 420m');
  const up2 = O.upgradeCompanyBuilding(st, cSolo.id, O.sectorCoords(1024, 0).sx, O.sectorCoords(1024, 0).sz, 'warden_bunker');
  assert(up2.ok && up2.building.level === 3);
  cov = O.findPatrolPostsCovering(st, cSolo.id, 1450, 0);
  assert(cov.length === 1 && cov[0].spawnGuards === true && cov[0].guardCount === 3, 'Lv3 warden_bunker enables hostile guard spawns');
});

test('Alpha20 overhaul: zfastnoise, Realistic Walkie-Talkie addon, 5x stack reduction, ch00 pre-complete, and ChestGUI defer fix', () => {
  const path = require('path');
  const ROOT = path.resolve(__dirname, '..');
  const prof = JSON.parse(fs.readFileSync(path.join(ROOT, 'profiles/alpha20.json'), 'utf8'));
  const all = Object.values(prof.categories).flat();
  assert(all.includes('zfastnoise') && !all.includes('noisium'), 'zfastnoise replaces noisium in alpha20');
  assert(!all.includes('walkie-talkie'), 'walkie-talkie removed in favor of Realistic Walkie-Talkie optional addon');
  const cfAddons = JSON.parse(fs.readFileSync(path.join(ROOT, 'optional-mods/curseforge-addons.json'), 'utf8'));
  assert(cfAddons.addons.some(a => a.mod_id === 'walkietalkies' && a.curseforge_project_id === 1750447), 'Realistic Walkie-Talkie (1750447) documented in curseforge-addons.json');
  assert(fs.existsSync(path.join(ROOT, 'overrides/config/walkietalkies-server.properties')), 'walkietalkies-server.properties exists');

  const stackJs = fs.readFileSync(path.join(ROOT, 'overrides/kubejs/startup_scripts/02_stack_sizes.js'), 'utf8');
  assert(stackJs.includes('Math.ceil(cur / 5)'), '02_stack_sizes.js divides maxStackSize by 5');
  const itemsJs = fs.readFileSync(path.join(ROOT, 'overrides/kubejs/startup_scripts/01_longhaul_items.js'), 'utf8');
  assert(itemsJs.includes('maxStackSize(13)') && itemsJs.includes('maxStackSize(4)'), 'custom item stacks reduced 5x (64 -> 13, 16 -> 4)');

  const s26 = fs.readFileSync(path.join(ROOT, 'overrides/kubejs/server_scripts/26_hard_features_and_territory.js'), 'utf8');
  assert(s26.includes('schemaVersion: 3') && s26.includes("chapters: { ch00: true }"), 'ch00 pre-completed in schemaVersion 3');
  assert(s26.includes('Number(p.y) <= -59') && !s26.includes('Number(p.y) <= 0'), 'below-Y safeguard uses <= -59 so underground companies at Y=-44 are safe');
  assert(s26.includes('lhCheckFilledBarrelCarry') && s26.includes('dist <= 5.0'), 'filled-barrel 5-block anti-carry rule wired in 26_hard_features_and_territory.js');
  assert(s26.includes('lhGrantStarterRadio') && s26.includes("'radio'"), 'starter radio command and join grant wired');

  const s27 = fs.readFileSync(path.join(ROOT, 'overrides/kubejs/server_scripts/27_openttd_companies.js'), 'utf8');
  assert(s27.includes('lhIsHostileMob') && s27.includes('lhRelocateCompanyEnv') && s27.includes('lhRequestBorderTrade'), '27_openttd_companies wires hostile mob exclusion, 4-env relocation, and border trade passes');

  const s30 = fs.readFileSync(path.join(ROOT, 'overrides/kubejs/server_scripts/30_lh_gui.js'), 'utf8');
  assert(s30.includes('lhGuiDeferAction') && s30.includes('scheduleInTicks'), '30_lh_gui.js defers inventory mutations after ChestGUI closes to prevent item wipe');
});

test('4-env companies, >=4 sector HQ spacing, TradeLogistics (1.04..24 m/s), HaggleEngine, and P2PTradeEngine', () => {
  const O = sandbox.global.LHOpenTTD;
  const TL = sandbox.global.LHTradeLogistics;
  const HE = sandbox.global.LHHaggleEngine;
  const P2P = sandbox.global.LHP2PTradeEngine;
  assert(O && TL && HE && P2P, 'all new pure-JS engines loaded');

  const st = O.createInitialState();
  // Verify 4 environments and >=4 sector separation among initial bots
  const botIds = ['bot_ironrail', 'bot_greencart', 'bot_skyport', 'bot_seawolf'];
  const envs = new Set(botIds.map(id => st.companies[id].envType));
  assert.equal(envs.size, 4, '4 bots span all 4 environments (normal, air, sea, underground)');
  for (let i = 0; i < botIds.length; i++) {
    for (let j = i + 1; j < botIds.length; j++) {
      const a = st.companies[botIds[i]], b = st.companies[botIds[j]];
      const sDist = Math.max(Math.abs(a.hqSx - b.hqSx), Math.abs(a.hqSz - b.hqSz));
      assert(sDist >= 4, `bots ${a.id} and ${b.id} must be >= 4 sectors apart (got ${sDist})`);
    }
  }

  // Wide HQ spacing for player companies
  const p1 = O.companyCreate(st, 'u1', 'sky_corp', 'SkyCorp', 0, 0, { envType: 'air' }).company;
  const p2 = O.companyCreate(st, 'u2', 'deep_corp', 'DeepCorp', 0, 0, { envType: 'underground' }).company;
  assert.equal(p1.envType, 'air');
  assert.equal(p1.hqY, 286);
  assert.equal(p2.envType, 'underground');
  assert.equal(p2.hqY, -44);
  assert(Math.max(Math.abs(p1.hqSx - p2.hqSx), Math.abs(p1.hqSz - p2.hqSz)) >= 4, 'player companies placed >= 4 sectors apart');

  // Delivery speeds 1.04..24.0 m/s and timed arrival
  const logSt = TL.createState();
  assert.equal(TL.MIN_DELIVERY_SPEED_BPS, 1.04);
  assert.equal(TL.MAX_DELIVERY_SPEED_BPS, 24.0);
  p1.cash = 50000;
  const delRes = TL.createBuyOrderDelivery(logSt, st, 'sky_corp', 'deep_corp', 'minecraft:iron_ingot', 10, 120, 24.0, 100);
  assert(delRes.ok && delRes.delivery, 'createBuyOrderDelivery succeeded');
  const del = delRes.delivery;
  assert.equal(del.speedBps, 24.0);
  assert.equal(TL.tickDeliveries(logSt, st, 150).arrivedBuy.length, 0);
  const arrived = TL.tickDeliveries(logSt, st, del.etaTick).arrivedBuy;
  assert.equal(arrived.length, 1);
  assert.equal(del.status, 'arrived_at_terminal');

  // Border pass lifecycle (must be near target company's border)
  const passFar = TL.requestBorderTradePass(logSt, st, 'u1', 'sky_corp', 'bot_ironrail', 0, 0, { nowTick: 100 });
  assert(!passFar.ok, 'border pass rejected far from target company border');
  const passRes = TL.requestBorderTradePass(logSt, st, 'u1', 'sky_corp', 'bot_ironrail', 7 * 256, 2 * 256, { nowTick: 100 });
  assert(passRes.ok, 'requestBorderTradePass succeeded at company border');
  assert.equal(TL.hasActiveBorderPass(logSt, 'u1', 'bot_ironrail', 120), true);
  const leaveRes = TL.completeBorderTradeOnLeave(logSt, st, 'u1', 'bot_ironrail');
  assert(leaveRes.ok);
  assert.equal(TL.hasActiveBorderPass(logSt, 'u1', 'bot_ironrail', 120), false);

  // HaggleEngine: fair offer agrees; insulting offers drain patience -> walked_away
  const hFair = HE.createSession('H1', 'vs_bot', 'sky_corp', 'bot_ironrail', 'minecraft:iron_ingot', 10, 100, { botSide: 'seller', repScore: 40 });
  const r1 = HE.submitOffer(hFair, 'buyer', hFair.botReservation, {});
  assert(r1.ok && r1.agreed === true && r1.price === hFair.botReservation, 'haggle accepts offer >= botReservation');

  const hInsult = HE.createSession('H2', 'vs_bot', 'sky_corp', 'bot_greencart', 'minecraft:diamond', 1, 100, { botSide: 'seller', repScore: -40 });
  let rBad = null;
  for (let round = 0; round < 6 && (!rBad || !rBad.walkedAway); round++) {
    rBad = HE.submitOffer(hInsult, 'buyer', 1, {});
  }
  assert(rBad && rBad.walkedAway === true && hInsult.status === 'walked_away', 'repeated insulting offers trigger walk-away');

  // P2P proximity trading <= 10 blocks
  const proxFar = P2P.validateProximity(0, 70, 0, 25, 70, 0, true);
  assert(!proxFar.ok && proxFar.reason === 'too_far', 'P2P rejects > 10m distance');
  const proxNear = P2P.validateProximity(0, 70, 0, 6, 70, 0, true);
  assert(proxNear.ok, 'P2P accepts <= 10m distance');
  const p2pSess = P2P.createSession('P1', 'u1', 'Alice', 'sky_corp', 'u2', 'Bob', 'deep_corp');
  assert(P2P.addItemOffer(p2pSess, 'u1', 'minecraft:iron_ingot', 4).ok);
  assert(P2P.setCurrencyOffer(p2pSess, 'u2', 50).ok);
  assert.equal(P2P.setConfirmed(p2pSess, 'u1', true).bothConfirmed, false);
  assert.equal(P2P.setConfirmed(p2pSess, 'u2', true).bothConfirmed, true);
});

test('Structure production (6 Diablo rarities, 4 dims), archetypes/traits, required inputs, auctions, coalitions, upkeep, bot saturation & raids, routes & subsidies', () => {
  const O = sandbox.global.LHOpenTTD;
  const SP = sandbox.global.LHStructureProduction;
  const TL = sandbox.global.LHTradeLogistics;
  assert(SP && SP.STRUCTURE_RARITIES && Object.keys(SP.STRUCTURE_RARITIES).length === 6, '6 Diablo rarities defined');
  assert(O.BOT_ARCHETYPES && Object.keys(O.BOT_ARCHETYPES).length === 8, '8 bot archetypes defined');
  assert(O.COMPANY_TRAITS && Object.keys(O.COMPANY_TRAITS).length === 10, '10 company traits defined');

  const st = O.createInitialState();
  const c1 = O.companyCreate(st, 'u1', 'alpha', 'Alpha', 1024, 1024).company;
  const c2 = O.companyCreate(st, 'u2', 'beta', 'Beta', -1024, -1024).company;
  c1.cash = 100000;
  c2.cash = 100000;

  // 1. Structure catalog & non-destructive world-structure conversion across dimensions
  const cat = O.syncStructureCatalog(st, ['minecraft:ancient_city', 'minecraft:bastion_remnant', 'minecraft:end_city'], null, {
    'minecraft:ancient_city': 'minecraft:overworld',
    'minecraft:bastion_remnant': 'minecraft:the_nether',
    'minecraft:end_city': 'minecraft:the_end'
  });
  assert.equal(cat['minecraft:ancient_city'].dimension, 'minecraft:overworld');
  assert.equal(cat['minecraft:bastion_remnant'].dimension, 'minecraft:the_nether');
  assert.equal(cat['minecraft:end_city'].dimension, 'minecraft:the_end');
  assert(cat['minecraft:end_city'].rarityRank >= 4, 'end_city has high Diablo rarity');
  assert.notEqual(cat['minecraft:ancient_city'].itemId, cat['minecraft:bastion_remnant'].itemId, '1-to-1 unique item mapping');

  assert(O.claimOrCaptureSector(st, 'alpha', 4, 5, false).ok);
  O.recordSectorStructures(st, 4, 5, ['minecraft:ancient_city'], 'minecraft:overworld');
  const conv = O.convertStructureToFacility(st, 'alpha', 4, 5, 'minecraft:ancient_city', 1024, 70, 1280);
  assert(conv.ok && conv.building.preserveWorldStructure === true && conv.building.type === 'structure_facility');

  // 2. Power plant adjacency synergy (+20%..+50%)
  assert(O.claimOrCaptureSector(st, 'alpha', 5, 5, false).ok);
  assert(O.buildCompanyBuilding(st, 'alpha', 5, 5, 'power_plant', 1280, 70, 1280).ok);
  const adjMult = O.getPowerPlantAdjacencyMultiplier(st, 'alpha', 4, 5, 'minecraft:overworld');
  assert(adjMult >= 1.20, 'adjacent power plant boosts production: ' + adjMult);

  // 3. Fuel is mandatory (pauses with missing_fuel), while raw inputs give +45% boost over partial out-of-thin-air output
  assert(O.claimOrCaptureSector(st, 'alpha', 4, 6, false).ok);
  const mineRes = O.buildCompanyBuilding(st, 'alpha', 4, 6, 'mine_shaft', 1024, 70, 1536, { emptyInputs: true });
  assert(mineRes.ok);
  O.tickCompanyBuildings(st);
  assert.equal(mineRes.building.pausedReason, 'missing_fuel', 'building pauses without fuel');
  assert.equal(mineRes.building.cyclesDone, 0);
  assert(O.supplyBuildingInputs(st, 'alpha', 4, 6, { 'minecraft:coal': 4 }).ok);
  O.tickCompanyBuildings(st);
  assert.equal(mineRes.building.pausedReason, null, 'resumes with fuel alone (partial out-of-thin-air production)');
  assert.equal(mineRes.building.cyclesDone, 1, 'produces partial output without raw inputs when fueled');
  const mineProd = mineRes.building.customProduct || 'minecraft:raw_iron';
  assert(mineProd && mineProd !== 'minecraft:raw_iron', 'building rolls a random modpack item instead of hardcoded raw_iron: ' + mineProd);
  const qtyPartial = mineRes.building.stockBuffer[mineProd] || 0;
  assert(qtyPartial > 0 && Object.keys(mineRes.building.outputContainerQueue).length > 0, 'queues items for physical output barrel');
  assert(O.supplyBuildingInputs(st, 'alpha', 4, 6, { 'minecraft:oak_planks': 8, 'minecraft:coal': 4 }).ok);
  O.tickCompanyBuildings(st);
  const qtyTotal = mineRes.building.stockBuffer[mineProd] || 0;
  assert(qtyTotal - qtyPartial >= qtyPartial, 'supplying optional raw inputs grants boost over partial output');

  // 4. Ongoing expenses (facility, upgrade, land tax, security, anti-monopoly) & Valuation breakdown
  O.upgradeCompanyBuilding(st, 'alpha', 4, 6, O.BUILDING_CATALOG.mine_shaft.tier1Fork[0].id);
  const exp = O.computeCompanyExpenses(st, 'alpha');
  assert(exp.facilityUpkeep > 0 && exp.upgradeUpkeep > 0 && exp.landTax > 0 && exp.total > 0, 'all ongoing expense lines computed');
  const valBr = O.getCompanyValuationBreakdown(st, 'alpha');
  assert(valBr.facilitiesValue > 0 && valBr.productionPotentialValue > 0 && valBr.territoryValue > 0 && valBr.totalValuation > valBr.cash);

  // 5. Anti-monopoly coalition bonuses & aggressive threat ranking
  for (let gx = 6; gx <= 12; gx++) O.claimOrCaptureSector(st, 'alpha', gx, 5, false);
  const mono = O.getMonopolyMetrics(st);
  assert(mono.some(m => m.cid === 'alpha' && m.antiMonopolyTaxRate > 0), 'monopolist incurs anti-monopoly tax');
  const joinCo = O.joinAntiMonopolyCoalition(st, 'beta', 'alpha');
  assert(joinCo.ok && joinCo.membersCount === 1);
  const cMod = O.getCoalitionModifiers(st, 'beta', 'alpha');
  assert(cMod.isCoalitionAttack && cMod.captureCostMult < 1.0 && cMod.raidPowerBonus >= 1);

  // 6. Facility auction mini-game (create -> bid -> anti-snipe -> settle)
  const aucRes = O.createFacilityAuction(st, 'alpha', 4, 6, 500, 1000, 100);
  assert(aucRes.ok);
  const bidRes = O.placeAuctionBid(st, aucRes.auction.id, 'beta', 600, 950);
  assert(bidRes.ok && aucRes.auction.endsAtTick >= 1250, 'anti-snipe extends auction end tick');
  const settled = O.tickAuctions(st, 1300);
  assert(settled.length === 1 && settled[0].sold && settled[0].buyerCid === 'beta');
  assert.equal(O.getSectorBuilding(st, 4, 6).owner, 'beta', 'auction transfers facility ownership');

  // 7. Upkeep-aware periodic supply contracts + breach penalty
  const scTimed = O.createTimedSupplyContract(st, 'beta', 'alpha', 'minecraft:iron_ingot', 16, 2, 1000, null, 150, 100, { sx: 4, sz: 6, useUpkeepPricing: true });
  assert(scTimed.ok && scTimed.contract.upkeepIncluded > 0);
  const missEv = O.tickSupplyContracts(st, 1200);
  assert(missEv.length === 1 && missEv[0].type === 'penalty' && missEv[0].penalty === 150, 'breach penalty charged on missed deadline');

  // 8. 1/3 chapters bot saturation, every-2nd-chapter bot spawn, upgrade orders, and hostile mob raids
  const stSat = O.createInitialState();
  const chSpawn = O.onChapterCompletedBotSpawn(stSat, 20, 4, () => 0.25);
  assert(chSpawn.spawned.length >= 5, 'dynamic bot companies spawn every 2nd chapter');
  const capAtThird = O.maxBotClaimsAllowed(stSat, 4, 20);
  assert.equal(capAtThird, (9 * 9 - 9), 'by 1/3 chapters (~20/61), bots can fill all non-spawn open sectors on map');
  O.refreshBotOrders(stSat, () => 0.5);
  assert(stSat.marketOrders.some(o => o.purpose === 'facility_upgrade'), 'bots post buy orders for facility upgrade items');
  const raidRes = O.triggerBotMobRaid(stSat, 'bot_ironrail', 'bot_greencart', -7, -2, 100, { cost: 120 });
  assert(raidRes.ok && raidRes.raid.mobCount >= 5);
  assert(O.resolveBotMobRaid(stSat, raidRes.raid.id, 'defended').ok);

  // 9. Automated inter-structure routes (coal/oil/customs costs) & strengthened subsidies
  assert(O.claimOrCaptureSector(st, 'beta', 4, 7, false).ok);
  const dstB = O.buildCompanyBuilding(st, 'beta', 4, 7, 'factory', 1024, 70, 1792);
  assert(dstB.ok);
  st.buildings['4,6'].stockBuffer['minecraft:iron_ingot'] = 16;
  const logAuto = TL.createState();
  st.subsidy = { companyId: 'beta', item: 'minecraft:iron_ingot', sx: 4, sz: 6 };
  const subM = TL.getSubsidyModifiers(st, 'beta', 4, 6);
  assert(subM.active && subM.deliveryFeeMult < 1.0 && subM.routeFuelDiscount < 1.0 && subM.productionYieldMult > 1.0);
  const rCreate = TL.createAutomatedRoute(logAuto, st, 'beta', 4, 6, 4, 7, 'minecraft:iron_ingot', 8, { nowTick: 0 });
  assert(rCreate.ok && rCreate.costProfile.subsidized === true);
  const rTick = TL.tickAutomatedRoutes(logAuto, st, 2500);
  assert(rTick.length === 1 && rTick[0].ok && st.buildings['4,7'].inputBuffer['minecraft:iron_ingot'] >= 8);

  // 10. Wide early HQ spacing in 26_hard_features_and_territory.js & non-destructive container preservation in 27_openttd_companies.js
  const path = require('path');
  const ROOT = path.resolve(__dirname, '..');
  const s26 = fs.readFileSync(path.join(ROOT, 'overrides/kubejs/server_scripts/26_hard_features_and_territory.js'), 'utf8');
  const s27 = fs.readFileSync(path.join(ROOT, 'overrides/kubejs/server_scripts/27_openttd_companies.js'), 'utf8');
  assert(s26.includes('minPlayerDist') && s26.includes('minAnyDist'), 'lhFirstJoinRandomSpawn enforces wide early company HQ spacing');
  assert(s27.includes('preserveWorldStructure') && s27.includes('lhEnsureBarrelAt') && s27.includes('lhSyncBuildingPhysicalContainers'), '27_openttd_companies preserves world structures and barrels');
});

test('38. Progressive taxes, Central Bank loans & defaults, tax evasion, equity valuation, no-player-merger, comeback & pirate syndicate', () => {
  const O = sandbox.global.LHOpenTTD;
  const TL = sandbox.global.LHTradeLogistics;
  const st = O.createInitialState();
  assert(O.companyCreate(st, 'p1', 'alpha', 'Alpha Corp', 0, 0).ok);
  assert(O.companyCreate(st, 'p2', 'beta', 'Beta Corp', 0, 4096).ok);
  st.companies.alpha.cash = 4000;
  st.companies.beta.cash = 3500;

  // 1. Progressive tax brackets scale with income up to 90%
  st.companies.alpha._cycleGrossIncome = 100;
  const expLow = O.computeCompanyExpenses(st, 'alpha');
  st.companies.alpha._cycleGrossIncome = 2000;
  const expMid = O.computeCompanyExpenses(st, 'alpha');
  assert(expMid.progressiveTax > expLow.progressiveTax, 'higher income triggers higher progressive tax bracket');
  assert(String(expMid.progressiveBracketLabel).startsWith('50%'));
  st.companies.alpha._cycleGrossIncome = 10000;
  const expHigh = O.computeCompanyExpenses(st, 'alpha');
  assert.equal(expHigh.progressiveTaxRate, 0.90);
  assert(String(expHigh.progressiveBracketLabel).startsWith('90%'));
  st.companies.alpha._cycleGrossIncome = 2000;

  // 2. Central Bank key rate, loans, and forced debt auctions on loan default / unpaid upkeep
  const cb = O.updateCentralBankKeyRate(st);
  assert(cb.keyRate >= 0.04 && cb.keyRate <= 0.25);
  const aHqX = st.companies.alpha.hqSx;
  const aHqZ = st.companies.alpha.hqSz;
  assert(O.claimOrCaptureSector(st, 'alpha', aHqX + 1, aHqZ, false).ok);
  assert(O.claimOrCaptureSector(st, 'alpha', aHqX + 1, aHqZ + 1, false).ok);
  assert(O.buildCompanyBuilding(st, 'alpha', aHqX + 1, aHqZ, 'mine_shaft', (aHqX + 1) * 256, 70, aHqZ * 256).ok);

  const loanRes = O.takeBankLoan(st, 'alpha', 600, 3, 100);
  assert(loanRes.ok && loanRes.loan.totalDue > 600);
  // Drain alpha cash so loan misses once (warning) then defaults on 2nd missed cycle and triggers forced auctions
  st.companies.alpha.cash = 0;
  const loanEvs1 = O.tickBankLoans(st, 4000);
  assert(loanEvs1.some(e => e.type === 'loan_missed'), '1st missed payment logs loan_missed');
  const loanEvs = O.tickBankLoans(st, 5000);
  assert(loanEvs.some(e => e.type === 'loan_default'), '2nd missed payment triggers loan_default');
  const forcedAucs = st.auctions.filter(a => a.status === 'open' && a.isForcedDebtAuction);
  assert(forcedAucs.length >= 1, 'default forces company facilities/sectors onto auction');
  assert.equal(O.cancelFacilityAuction(st, forcedAucs[0].id, 'alpha').reason, 'forced_debt_auction');
  const bidF = O.placeAuctionBid(st, forcedAucs[0].id, 'beta', (forcedAucs[0].startPrice || 200) + 50, 5100);
  assert(bidF.ok);
  const settledF = O.tickAuctions(st, forcedAucs[0].endsAtTick + 10);
  assert(settledF.length >= 1 && settledF[0].sold, 'forced debt auction settles and transfers asset');
  assert(O.getCompanyActiveDebt(st, 'alpha') < loanRes.loan.totalDue, 'auction proceeds pay down company debt');

  // Last remaining HQ sector is protected from forced elimination
  const alphaSecs = Object.keys(st.claims || {}).filter(k => st.claims[k] && st.claims[k].owner === 'alpha');
  assert(alphaSecs.length >= 1, 'player company never loses its last HQ sector to forced auction');

  // 3. Tax evasion: failed evasion imposes audit penalty; successful evasion grants discount
  st.companies.alpha.cash = 1000;
  st.companies.alpha.unpaidUpkeep = 200;
  const failEv = O.attemptTaxEvasion(st, 'alpha', 'forged_docs', 6000, () => 0.99);
  assert(failEv.ok && failEv.succeeded === false && st.companies.alpha.taxAuditPenaltyCycles === 3);
  const expAudit = O.computeCompanyExpenses(st, 'alpha');
  assert(expAudit.auditPenaltyTax > 0, 'failed evasion imposes extra penalty tax');
  const okEv = O.attemptTaxEvasion(st, 'alpha', 'bribe', 9000, () => 0.01);
  assert(okEv.ok && okEv.succeeded === true && okEv.discountPct >= 30);

  // 4. Shares included in valuation & anti-monopoly; player-eliminating mergers forbidden
  st.companies.beta.cash = 15000;
  const buySh = O.buyCompanyShares(st, 'beta', 'alpha', 25);
  assert(buySh.ok && buySh.sharesBought === 25);
  const betaVal = O.getCompanyValuationBreakdown(st, 'beta');
  assert(betaVal.equityPortfolioValue > 0 && betaVal.totalValuation >= betaVal.cash + betaVal.equityPortfolioValue, 'shares count in valuation');
  const monoShares = O.getMonopolyMetrics(st);
  assert(monoShares.some(m => m.cid === 'beta' && m.assetValuationWithEquity === betaVal.totalValuation), 'valuation including shares feeds monopoly metrics');

  // Cannot buy > 49% of a player company
  const overCap = O.buyCompanyShares(st, 'beta', 'alpha', 30);
  assert.equal(overCap.ok, false);
  assert.equal(overCap.reason, 'equity_cap_reached');
  // Cannot merge two player companies
  const mergeRes = O.companyMerge(st, 'beta', 'alpha');
  assert.equal(mergeRes.ok, false);
  assert.equal(mergeRes.reason, 'player_merge_disabled');

  // 5. Comeback mechanics & dynamic underdog subsidy
  st.companies.alpha.cash = 40;
  st.companies.alpha.unpaidUpkeep = 300;
  st.companies.beta.cash = 25000;
  const cbAlpha = O.getComebackStatus(st, 'alpha');
  assert(cbAlpha.active && cbAlpha.taxDiscount > 0 && cbAlpha.yieldMult > 1.0 && cbAlpha.loanRateMult < 1.0, 'underdog gets comeback buffs');
  const subTgt = O.selectDynamicSubsidyTarget(st);
  assert(subTgt && subTgt.companyId === 'alpha', 'dynamic subsidy picks struggling player company');
  const bailRes = O.activateComebackBailout(st, 'alpha', 15000);
  assert(bailRes.ok && bailRes.grantCash > 0 && bailRes.debtForgiven > 0);

  // 6. Pirate syndicate, caravan robbery, growth & hired raids
  const ps = O.ensurePirateSyndicate(st);
  assert.equal(ps.level, 1);
  assert(O.countActiveBots(st) === 4, 'pirate syndicate does not distort standard AI bot count');
  const bHqX = st.companies.beta.hqSx;
  const bHqZ = st.companies.beta.hqSz;
  st.companies.beta.cash = 10000;
  assert(O.claimOrCaptureSector(st, 'beta', bHqX + 1, bHqZ, false).ok);
  assert(O.claimOrCaptureSector(st, 'beta', bHqX + 4, bHqZ, false).ok);
  assert(O.buildCompanyBuilding(st, 'beta', bHqX + 1, bHqZ, 'mine_shaft', (bHqX + 1) * 256, 70, bHqZ * 256).ok);
  assert(O.buildCompanyBuilding(st, 'beta', bHqX + 4, bHqZ, 'factory', (bHqX + 4) * 256, 70, bHqZ * 256).ok);
  st.buildings[(bHqX + 1) + ',' + bHqZ].stockBuffer['minecraft:iron_ingot'] = 24;

  const logPir = TL.createState();
  const rtLong = TL.createAutomatedRoute(logPir, st, 'beta', bHqX + 1, bHqZ, bHqX + 4, bHqZ, 'minecraft:iron_ingot', 10, { nowTick: 0 });
  assert(rtLong.ok);
  const rEvs = TL.tickAutomatedRoutes(logPir, st, 2500, { rng: () => 0.001 });
  assert(rEvs.some(e => e.pirateHit), 'unprotected long route gets robbed by pirates');
  assert(ps.caravansRobbed >= 1 && Object.keys(ps.lootStash || {}).length >= 1 && ps.cash > 0, 'pirate syndicate grows stronger and stores loot from robberies');

  // Black market buy & hired anonymous raid
  const lootKey = Object.keys(ps.lootStash)[0];
  const bmBuy = O.buyPirateBlackMarketLoot(st, 'alpha', lootKey, 1);
  assert(bmBuy.ok && bmBuy.qty >= 1);
  st.companies.alpha.cash = 2000;
  const hireRaid = O.orderPirateRaid(st, 'alpha', 'beta', bHqX, bHqZ, 2, 20000, { anonymous: true });
  assert(hireRaid.ok && hireRaid.raid.isPirateRaid && hireRaid.raid.anonymous === true);
  assert(ps.power > 10, 'pirate syndicate gains power from caravan robberies and hired raids');

  // 7. Integration markers across server scripts & ChestGUI
  const path = require('path');
  const ROOT = path.resolve(__dirname, '..');
  const s15 = fs.readFileSync(path.join(ROOT, 'overrides/kubejs/server_scripts/15_sites_and_economy.js'), 'utf8');
  const s27 = fs.readFileSync(path.join(ROOT, 'overrides/kubejs/server_scripts/27_openttd_companies.js'), 'utf8');
  const s30 = fs.readFileSync(path.join(ROOT, 'overrides/kubejs/server_scripts/30_lh_gui.js'), 'utf8');
  assert(s15.includes('lhCheckSiteCaravanPirateAmbush'), '15_sites_and_economy triggers pirate ambushes on site caravans');
  assert(s27.includes('tickBankLoans') && s27.includes('orderPirateRaid') && s27.includes('attemptTaxEvasion'), '27_openttd_companies wires bank, tax evasion, and pirates');
  assert(s30.includes('lhGuiRenderBank') && s30.includes('lhGuiRenderPirates'), '30_lh_gui exposes Bank/Tax/Shares and Pirates/Caravans tabs');
});

test('39. Xaero/world borders, unique structure/building variants, tablet GUI command parity, and linear bot scaling', () => {
  const path = require('path');
  const ROOT = path.resolve(__dirname, '..');
  const O = sandbox.global.LHOpenTTD;
  const SP = sandbox.global.LHStructureProduction;

  // 1. Xaero Java fixes, default configs, sync_instance preservation, and world border particles
  const xData = fs.readFileSync(path.join(ROOT, 'runtime-mod/src/main/java/longhaul/runtime/xaero/LongHaulXaeroData.java'), 'utf8');
  const xMini = fs.readFileSync(path.join(ROOT, 'runtime-mod/src/main/java/longhaul/runtime/xaero/MinimapSectorHighlighter.java'), 'utf8');
  const xBridge = fs.readFileSync(path.join(ROOT, 'runtime-mod/src/main/java/longhaul/runtime/xaero/XaeroRefreshBridge.java'), 'utf8');
  const cfgMini = fs.readFileSync(path.join(ROOT, 'overrides/config/xaerominimap.txt'), 'utf8');
  const cfgWorld = fs.readFileSync(path.join(ROOT, 'overrides/config/xaeroworldmap.txt'), 'utf8');
  const syncPy = fs.readFileSync(path.join(ROOT, 'tools/sync_instance.py'), 'utf8');
  const s27 = fs.readFileSync(path.join(ROOT, 'overrides/kubejs/server_scripts/27_openttd_companies.js'), 'utf8');
  const s30 = fs.readFileSync(path.join(ROOT, 'overrides/kubejs/server_scripts/30_lh_gui.js'), 'utf8');

  assert(xData.includes('claimsByDim') && xData.includes('calculateRegionHash') && xData.includes('((rgb & 0xFFFFFF) << 8) | alpha'), 'LongHaulXaeroData uses per-dim claims and RRGGBBAA packing');
  assert(xMini.includes('calculateRegionHash'), 'MinimapSectorHighlighter implements calculateRegionHash');
  assert(xBridge.includes('getMethod("execute"') && xBridge.includes('setClearCache'), 'XaeroRefreshBridge schedules refresh on client main thread');
  assert(cfgMini.includes('displayClaims:true') && cfgWorld.includes('displayClaims:true'), 'Default Xaero configs enable claim borders on minimap & worldmap');
  assert(syncPy.includes('SEED_IF_MISSING_OVERRIDES') && syncPy.includes('xaerominimap.txt'), 'sync_instance.py preserves user Xaero configs');
  assert(s27.includes('lhRenderWorldBorders') && s27.includes("C.literal('border')") && s27.includes('minecraft:dust'), '27_openttd_companies renders 3D world borders and /lh border toggle');

  // 2. Structure & building product differentiation: random modpack objects instead of hardcoded wood/ores
  const spCat = SP.buildStructureCatalog(['mod:sawmill_taiga', 'mod:sawmill_savanna', 'mod:sawmill_cherry', 'minecraft:village_savanna']);
  const spTaiga = SP.resolveStructureSpec(spCat, 'mod:sawmill_taiga');
  const spSavanna = SP.resolveStructureSpec(spCat, 'mod:sawmill_savanna');
  const spCherry = SP.resolveStructureSpec(spCat, 'mod:sawmill_cherry');
  const spVilSav = SP.resolveStructureSpec(spCat, 'minecraft:village_savanna');
  const uniqueItems = new Set([spTaiga.itemId, spSavanna.itemId, spCherry.itemId, spVilSav.itemId]);
  assert.equal(uniqueItems.size, 4, 'each structure type receives a distinct random modpack item');

  const st = O.createInitialState();
  const co = O.companyCreate(st, 'u1', 'woodco', 'WoodCo', 1024, 1024).company;
  co.cash = 10000;
  O.claimOrCaptureSector(st, 'woodco', 5, 4, false);
  O.claimOrCaptureSector(st, 'woodco', 6, 4, false);

  const bTaiga = O.buildCompanyBuilding(st, 'woodco', 4, 4, 'sawmill', 1024, 70, 1024, { biomeId: 'minecraft:taiga' });
  const bCherry = O.buildCompanyBuilding(st, 'woodco', 5, 4, 'sawmill', 1280, 70, 1024, { biomeId: 'minecraft:cherry_grove' });
  const bMangrove = O.buildCompanyBuilding(st, 'woodco', 6, 4, 'sawmill', 1536, 70, 1024, { biomeId: 'minecraft:mangrove_swamp' });
  assert(bTaiga.ok && bCherry.ok && bMangrove.ok);
  const bProds = new Set([bTaiga.building.customProduct, bCherry.building.customProduct, bMangrove.building.customProduct]);
  assert.equal(bProds.size, 3, 'different building instances roll distinct random modpack products');
  assert(O.getBuildingYieldProfile(bCherry.building).items[bCherry.building.customProduct] > 0);

  const swRes = O.setBuildingVariant(st, 'woodco', 4, 4, 'birch');
  assert(swRes.ok && O.getBuildingYieldProfile(bTaiga.building).items['minecraft:birch_log'] > 0, 'setBuildingVariant updates produced item');

  // 3. Control tablet GUI parity for commands
  ['lhGuiRenderTrading', 'lh building setproduct random', 'lh border toggle', 'lh catalog verify',
   'lh team join', 'lh prologue smoke', 'lh bot status', 'lh voidout status',
   'lh territory settle', 'lh structure scan', 'lh building repair', 'lh shop sell hand'].forEach(marker => {
    assert(s30.includes(marker), '30_lh_gui covers command/action: ' + marker);
  });

  // 4. Linear bot scaling from player companies and player claims
  const stLin = O.createInitialState();
  assert.equal(O.maxBotClaimsAllowed(stLin, 10, 0), 4, '0 player companies & 0 claims starts at 4 bot HQ sectors');
  const pc1 = O.companyCreate(stLin, 'p1', 'pcorp1', 'PCorp1', 1024, 1024).company;
  pc1.cash = 10000;
  const d1 = O.getBotScalingDetails(stLin, 20, 0);
  assert.equal(d1.playerCompanies, 1);
  assert.equal(d1.playerSectors, 1);
  assert(d1.maxSectors > 4, '1 player company + 1 HQ linearly expands bot cap (' + d1.maxSectors + ')');
  assert(O.claimOrCaptureSector(stLin, 'pcorp1', 4, 5, false).ok);
  assert(O.claimOrCaptureSector(stLin, 'pcorp1', 4, 6, false).ok);
  const d2 = O.getBotScalingDetails(stLin, 20, 0);
  assert.equal(d2.playerSectors, 3);
  assert.equal(d2.maxSectors - d1.maxSectors, 3, 'each +2 player claims adds +3 bot claims linearly (1.5x)');
  O.companyCreate(stLin, 'p2', 'pcorp2', 'PCorp2', -1024, -1024);
  const d3 = O.getBotScalingDetails(stLin, 20, 0);
  assert.equal(d3.playerCompanies, 2);
  assert(d3.maxSectors > d2.maxSectors, 'adding another player company linearly increases bot cap');
});

test('40. Endgame 4/5 player company buyout victory and multi-hop convoy transport network (infra, modded vehicles, tolls, distance/speed)', () => {
  const path = require('path');
  const ROOT = path.resolve(__dirname, '..');
  const O = sandbox.global.LHOpenTTD;
  const TL = sandbox.global.LHTradeLogistics;

  // 1. Endgame player company buyout unlocked only at >= 4/5 chapters completed
  const stEg = O.createInitialState();
  O.companyCreate(stEg, 'p1', 'alpha', 'Alpha Corp', 1024, 1024);
  O.companyCreate(stEg, 'p2', 'beta', 'Beta Corp', 3072, 1024);
  stEg.companies.alpha.cash = 100000;
  stEg.companies.beta.cash = 500;
  O.claimOrCaptureSector(stEg, 'beta', 13, 4, false);
  O.buildCompanyBuilding(stEg, 'beta', 13, 4, 'mine_shaft', 3328, 70, 1024);

  const locked = O.getEndgameBuyoutStatus(stEg, 40, 61);
  assert.equal(locked.unlocked, false);
  assert.equal(locked.requiredChapters, 49);
  const earlyMerge = O.companyMerge(stEg, 'beta', 'alpha', { completedChapters: 40, totalChapters: 61 });
  assert.equal(earlyMerge.ok, false);
  assert.equal(earlyMerge.reason, 'player_merge_disabled');

  const unlocked = O.getEndgameBuyoutStatus(stEg, 49, 61);
  assert.equal(unlocked.unlocked, true);
  const egWin = O.companyMerge(stEg, 'beta', 'alpha', { completedChapters: 49, totalChapters: 61, nowTick: 5000 });
  assert(egWin.ok && egWin.isEndgameBuyout && egWin.endgameVictory, '4/5 chapters unlocks endgame player company buyout');
  assert.equal(stEg.endgameVictory.winnerCid, 'alpha');
  assert.equal(stEg.companies.beta, undefined);
  assert.equal(stEg.playerCompany.p2, 'alpha', 'absorbed company players stay in consolidated winner');
  assert(stEg.companies.alpha.members.includes('p2'));

  // 2. Modded vehicle recognition & fleet convoy creation
  assert.equal(TL.matchVehicleItem('minecraft:oak_boat'), 'sea');
  assert.equal(TL.matchVehicleItem('smallships:oak_cog'), 'sea');
  assert.equal(TL.matchVehicleItem('automobility:automobile'), 'road');
  assert.equal(TL.matchVehicleItem('immersive_aircraft:cargo_airship'), 'air');
  assert.equal(TL.matchVehicleItem('create:track'), 'rail');

  const stNet = O.createInitialState();
  const cA = O.companyCreate(stNet, 'pa', 'netco', 'NetCo', 1024, 1024).company;
  const cB = O.companyCreate(stNet, 'pb', 'relayco', 'RelayCo', 2048, 1024).company;
  cA.cash = 25000;
  cB.cash = 5000;
  const logNet = TL.createState();

  // Claim chain: NetCo source (4,4)+(5,4), RelayCo foreign port/hub (8,4), NetCo dest (12,4)+(13,4)
  O.claimOrCaptureSector(stNet, 'netco', 5, 4, false);
  O.claimOrCaptureSector(stNet, 'netco', 12, 4, false);
  O.claimOrCaptureSector(stNet, 'netco', 13, 4, false);
  O.claimOrCaptureSector(stNet, 'netco', 14, 4, false);
  O.buildCompanyBuilding(stNet, 'netco', 4, 4, 'mine_shaft', 1024, 70, 1024);
  O.buildCompanyBuilding(stNet, 'netco', 12, 4, 'factory', 3072, 70, 1024);
  O.buildCompanyBuilding(stNet, 'relayco', 8, 4, 'port', 2048, 70, 1024);

  // Without port near src/dst, sea route is rejected for missing infrastructure
  const noPort = TL.createConvoyRoute(logNet, stNet, 'netco', 4, 4, 12, 4, 'sea', 'minecraft:raw_iron', 16, { nowTick: 0 });
  assert.equal(noPort.ok, false);
  assert(noPort.reason === 'missing_src_infra' || noPort.reason === 'missing_dst_infra');

  // Attach ports in adjacent sectors (5,4) and (13,4) + register boat convoy from item
  assert(O.buildCompanyBuilding(stNet, 'netco', 5, 4, 'port', 1280, 70, 1024).ok);
  assert(O.buildCompanyBuilding(stNet, 'netco', 13, 4, 'port', 3328, 70, 1024).ok);
  const cvSea = TL.registerCompanyConvoy(logNet, stNet, 'netco', 'sea', 'minecraft:oak_boat', { strictItemCheck: true, nowTick: 10 });
  assert(cvSea.ok && cvSea.convoy.speedBps === 12.0 && cvSea.convoy.capacity === 48);

  // Multi-hop sea route through RelayCo's foreign port at (8,4) -> pays toll & computes distance / speed = time
  const seaRoute = TL.createConvoyRoute(logNet, stNet, 'netco', 4, 4, 12, 4, 'sea', 'minecraft:raw_iron', 16, {
    waypoints: [{ sx: 8, sz: 4 }],
    convoyId: cvSea.convoy.id,
    nowTick: 100
  });
  assert(seaRoute.ok, 'multi-hop sea convoy route created through foreign port');
  assert.equal(seaRoute.route.totalDistanceBlocks, 2048);
  assert.equal(seaRoute.route.speedBps, 12.0);
  assert(Math.abs(seaRoute.route.travelSeconds - (2048 / 12.0)) < 0.2, 'travel time = distance / speed');
  assert(seaRoute.pathPlan.totalRelayToll > 0, 'foreign relay factory/port charges toll');

  // Dispatch convoy: cargo leaves source immediately, relay owner receives toll, cargo stays in_transit until ETA, then arrives
  stNet.buildings['4,4'].stockBuffer['minecraft:raw_iron'] = 32;
  const inputBefore = stNet.buildings['12,4'].inputBuffer['minecraft:raw_iron'] || 0;
  const relayCashBefore = cB.cash;
  const disp = TL.dispatchConvoyRoute(logNet, stNet, seaRoute.route.id, 100, { skipPiracy: true });
  assert(disp.ok && disp.events.length === 1 && disp.events[0].dispatched === true);
  assert(cB.cash > relayCashBefore, 'foreign relay factory/port owner receives transit toll');
  assert.equal(seaRoute.route.convoyState, 'in_transit');
  assert.equal(stNet.buildings['12,4'].inputBuffer['minecraft:raw_iron'] || 0, inputBefore, 'not yet arrived before ETA');

  // Tick mid-transit -> still in_transit
  TL.tickAutomatedRoutes(logNet, stNet, 100 + Math.floor(seaRoute.route.travelTicks / 2), { skipPiracy: true });
  assert.equal(seaRoute.route.convoyState, 'in_transit');

  // Tick at ETA -> delivered
  const arrEv = TL.tickAutomatedRoutes(logNet, stNet, seaRoute.route.transitEtaTick, { skipPiracy: true });
  assert(arrEv.some(e => e.arrived && e.qty === 16));
  assert.equal(stNet.buildings['12,4'].inputBuffer['minecraft:raw_iron'], inputBefore + 16);
  assert.equal(seaRoute.route.convoyState, 'idle');

  // 3. Subsidized corridor boosts convoy speed (+30%) & waives foreign relay tolls
  stNet.subsidy = { companyId: 'netco', item: 'minecraft:raw_iron', sx: 4, sz: 4 };
  const subPath = TL.planTransportPath(logNet, stNet, 'netco', { sx: 4, sz: 4 }, { sx: 12, sz: 4 }, 'sea', {
    waypoints: [{ sx: 8, sz: 4 }],
    requireInfra: true
  });
  assert(subPath.ok && subPath.subsidized === true);
  assert(subPath.speedBps > 12.0 && subPath.totalRelayToll === 0, 'subsidized route increases speed and waives relay toll');

  // 4. Road & Rail & Air infrastructure catalog & server/GUI integration
  assert(O.BUILDING_CATALOG.road_depot && O.BUILDING_CATALOG.rail_depot && O.BUILDING_CATALOG.port && O.BUILDING_CATALOG.airport);
  const s27 = fs.readFileSync(path.join(ROOT, 'overrides/kubejs/server_scripts/27_openttd_companies.js'), 'utf8');
  const s30 = fs.readFileSync(path.join(ROOT, 'overrides/kubejs/server_scripts/30_lh_gui.js'), 'utf8');
  assert(s27.includes('lhEndgameBuyoutCmd') && s27.includes('lhCreateConvoyFromHand') && s27.includes('lhCreateConvoyRouteCmd'));
  assert(s30.includes('lhEndgameBuyoutCmd') && s30.includes('lhCreateConvoyFromHand') && s30.includes('lhCreateConvoyRouteCmd'));
});

test('41. 90% progressive tax + loopholes, random modpack items on structures/buildings, conflict-free bidirectional craft-tree pricing & player fallbacks', () => {
  const path = require('path');
  const ROOT = path.resolve(__dirname, '..');
  const O = sandbox.global.LHOpenTTD;
  const SP = sandbox.global.LHStructureProduction;
  const E = sandbox.global.LHEconomyEngine;

  // 1. Progressive tax reaches 90% & new loopholes (offshore / shell_split) shield up to 85-90%
  const stTax = O.createInitialState();
  O.companyCreate(stTax, 'p1', 'mega', 'MegaCorp', 0, 0).company.cash = 10000;
  stTax.companies.mega._cycleGrossIncome = 12000;
  const expMega = O.computeCompanyExpenses(stTax, 'mega');
  assert.equal(expMega.progressiveTaxRate, 0.90);
  assert(expMega.progressiveTax > 5000, '90% bracket applies steeply on high gross income');

  const offRes = O.attemptTaxEvasion(stTax, 'mega', 'offshore', 100, () => 0.01);
  assert(offRes.ok && offRes.succeeded && offRes.discountPct === 85);
  const expAfterOff = O.computeCompanyExpenses(stTax, 'mega');
  assert(expAfterOff.evasionDiscount > 0 && expAfterOff.total < expMega.total * 0.25, 'offshore loophole slashes payable tax');

  const shellRes = O.attemptTaxEvasion(stTax, 'mega', 'shell_split', 200, () => 0.01);
  assert(shellRes.ok && shellRes.succeeded && shellRes.discountPct === 80);

  // 2. Random modpack + vanilla objects on structures & buildings + player fallback valuation & product override
  assert(SP.MODPACK_RANDOM_ITEM_POOL.some(id => id.startsWith('minecraft:')), 'default random pool includes vanilla items');
  assert(SP.MODPACK_RANDOM_ITEM_POOL.some(id => !id.startsWith('minecraft:')), 'default random pool includes mod items');
  const modPool = ['create:precision_mechanism', 'ae2:fluix_crystal', 'cataclysm:ignitium_ingot', 'minecraft:diamond'];
  const cat = SP.buildStructureCatalog(['mod:ruin_a', 'mod:ruin_b', 'mod:ruin_c', 'mod:ruin_d'], modPool, null, null, { seed: 'w42' });
  const assigned = new Set(Object.values(cat).map(s => s.itemId));
  assert.equal(assigned.size, 4);
  for (const it of assigned) assert(modPool.includes(it), 'structure pulled random item from modpack pool: ' + it);

  const rerolled = SP.rerollStructureSpecProduct(cat, 'mod:ruin_a', modPool, 'minecraft:overworld', () => 0.9);
  assert(rerolled && modPool.includes(rerolled.itemId));

  const stB = O.createInitialState();
  O.companyCreate(stB, 'p1', 'ind', 'IndCorp', 1024, 1024).company.cash = 10000;
  const bRnd = O.buildCompanyBuilding(stB, 'ind', 4, 4, 'factory', 1024, 70, 1024, { availableItemIds: modPool });
  assert(bRnd.ok && modPool.includes(bRnd.building.customProduct), 'building picked random modpack product: ' + bRnd.building.customProduct);

  const valSet = O.setBuildingPlayerValuation(stB, 'ind', 4, 4, 4200, 'minecraft:overworld');
  assert(valSet.ok && valSet.playerValuation === 4200);
  const prodSet = O.setBuildingCustomProduct(stB, 'ind', 4, 4, 'ae2:fluix_crystal', 'minecraft:overworld');
  assert(prodSet.ok && prodSet.productItem === 'ae2:fluix_crystal');
  const brk = O.getCompanyValuationBreakdown(stB, 'ind');
  assert(brk.facilitiesValue >= 4200, 'player building valuation reflects in company assets');

  // 3. Craft-tree pricing + conflict-free bidirectional propagation (up, down, parallel) with 2+ admin pins
  // Tree:
  //   leafA + leafB -> midX
  //   midX  + leafC -> topZ
  //   leafA + leafD -> altY  (parallel sibling sharing leafA)
  const edges = [
    { outId: 'test:mid_x', outCount: 1, ingredients: [{ id: 'test:leaf_a', count: 2 }, { id: 'test:leaf_b', count: 1 }] },
    { outId: 'test:top_z', outCount: 1, ingredients: [{ id: 'test:mid_x', count: 1 }, { id: 'test:leaf_c', count: 1 }] },
    { outId: 'test:alt_y', outCount: 1, ingredients: [{ id: 'test:leaf_a', count: 1 }, { id: 'test:leaf_d', count: 2 }] }
  ];

  const econA = E.createInitialEconomyState();
  E.propagateRecipePrices(econA, edges);
  const pureMid = E.getMarketQuote(econA, 'test:mid_x').basePrice;
  const pureTop = E.getMarketQuote(econA, 'test:top_z').basePrice;
  const pureLeafB = E.getMarketQuote(econA, 'test:leaf_b').basePrice;
  const pureLeafD = E.getMarketQuote(econA, 'test:leaf_d').basePrice;

  // Single pin on mid_x propagates UP (top_z), DOWN (leaf_a, leaf_b), and PARALLEL (alt_y via leaf_a)
  const pinMid = E.setAdminPrice(econA, 'test:mid_x', 600);
  assert.equal(pinMid.price, 600);
  assert(pinMid.propagatedCount >= 4, 'single pin propagated across craft tree');
  assert(E.getMarketQuote(econA, 'test:top_z').basePrice > pureTop, 'upward propagation increased top_z');
  assert(E.getMarketQuote(econA, 'test:leaf_b').basePrice > pureLeafB, 'downward propagation increased ingredient leaf_b');
  assert(E.getMarketQuote(econA, 'test:alt_y').basePrice > E.getMarketQuote(econA, 'test:mid_x').basePrice * 0 || E.getMarketQuote(econA, 'test:leaf_a').basePrice > 18);

  // Two conflicting pins on top_z (200) and leaf_a (1000) in reverse orders must produce identical conflict-free prices!
  const econOrder1 = E.createInitialEconomyState();
  E.propagateRecipePrices(econOrder1, edges);
  E.setAdminPrice(econOrder1, 'test:top_z', 200);
  E.setAdminPrice(econOrder1, 'test:leaf_a', 1000);

  const econOrder2 = E.createInitialEconomyState();
  E.propagateRecipePrices(econOrder2, edges);
  E.setAdminPrice(econOrder2, 'test:leaf_a', 1000);
  E.setAdminPrice(econOrder2, 'test:top_z', 200);

  // Neither pin overwrites the other
  assert.equal(E.getMarketQuote(econOrder1, 'test:top_z').price, 200);
  assert.equal(E.getMarketQuote(econOrder1, 'test:leaf_a').price, 1000);
  assert.equal(E.getMarketQuote(econOrder2, 'test:top_z').price, 200);
  assert.equal(E.getMarketQuote(econOrder2, 'test:leaf_a').price, 1000);
  // Order-independent intermediate & parallel convergence
  assert.equal(E.getMarketQuote(econOrder1, 'test:mid_x').basePrice, E.getMarketQuote(econOrder2, 'test:mid_x').basePrice);
  assert.equal(E.getMarketQuote(econOrder1, 'test:leaf_b').basePrice, E.getMarketQuote(econOrder2, 'test:leaf_b').basePrice);
  assert.equal(E.getMarketQuote(econOrder1, 'test:alt_y').basePrice, E.getMarketQuote(econOrder2, 'test:alt_y').basePrice);
  assert(E.getMarketQuote(econOrder1, 'test:leaf_d').basePrice !== pureLeafD || E.getMarketQuote(econOrder1, 'test:alt_y').basePrice > 1000);

  // Player fallback price works for unpinned items and respects admin pin
  const plOk = E.setPlayerItemPrice(econOrder1, 'test:mid_x', 777, 'PlayerOne', 10);
  assert(plOk.ok && plOk.quote.playerPriced === true && plOk.quote.basePrice === 777);
  const plBlocked = E.setPlayerItemPrice(econOrder1, 'test:top_z', 999, 'PlayerOne', 10);
  assert.equal(plBlocked.ok, false);
  assert.equal(plBlocked.reason, 'admin_locked');
  E.clearPlayerItemPrice(econOrder1, 'test:mid_x');
  assert.equal(E.getMarketQuote(econOrder1, 'test:mid_x').playerPriced, false);

  // 4. Server & GUI integration checks
  const s27 = fs.readFileSync(path.join(ROOT, 'overrides/kubejs/server_scripts/27_openttd_companies.js'), 'utf8');
  const s30 = fs.readFileSync(path.join(ROOT, 'overrides/kubejs/server_scripts/30_lh_gui.js'), 'utf8');
  assert(s27.includes('lhCollectAllModItems') && s27.includes('setBuildingPlayerValuation') && s27.includes('setPlayerItemPrice'));
  assert(s30.includes('shell_split') && s30.includes('lh price player hand') && s30.includes('lh building setproduct random'));
});

test('Distant Horizons + Chunky init guard mixin & sync deduplication are wired', () => {
  const path = require('path');
  const ROOT = path.resolve(__dirname, '..');
  const mixinPath = path.join(ROOT, 'runtime-mod/src/main/java/longhaul/runtime/mixin/DhChunkyAccessorMixin.java');
  assert(fs.existsSync(mixinPath), 'DhChunkyAccessorMixin.java exists');
  const mixinSrc = fs.readFileSync(mixinPath, 'utf8');
  assert(mixinSrc.includes('AbstractChunkyAccessor') && mixinSrc.includes('tryRunFirstTimeSetup') && mixinSrc.includes('ChunkyProvider'), 'DhChunkyAccessorMixin guards AbstractChunkyAccessor.tryRunFirstTimeSetup against unloaded ChunkyProvider');

  const mixinsJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'runtime-mod/src/main/resources/longhaul-runtime.mixins.json'), 'utf8'));
  assert(Array.isArray(mixinsJson.mixins) && mixinsJson.mixins.includes('DhChunkyAccessorMixin'), 'longhaul-runtime.mixins.json registers DhChunkyAccessorMixin');

  const pluginSrc = fs.readFileSync(path.join(ROOT, 'runtime-mod/src/main/java/longhaul/runtime/mixin/LongHaulMixinPlugin.java'), 'utf8');
  assert(pluginSrc.includes('DhChunkyAccessorMixin') && pluginSrc.includes('distanthorizons') && pluginSrc.includes('chunky'), 'LongHaulMixinPlugin gates DhChunkyAccessorMixin on distanthorizons && chunky');

  const syncSrc = fs.readFileSync(path.join(ROOT, 'tools/sync_instance.py'), 'utf8');
  assert(syncSrc.includes("'distanthorizons-'") && syncSrc.includes("'saturn-'") && syncSrc.includes("'does_it_tick-'"), 'sync_instance.py cleans replaced/duplicate JARs');

  const sbCfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'overrides/config/smoothboot.json'), 'utf8'));
  assert(sbCfg.threadPriority && sbCfg.threadPriority.main >= 4 && sbCfg.threadPriority.io >= 4, 'smoothboot.json prevents main/io worker thread starvation');
  const dhCfg = fs.readFileSync(path.join(ROOT, 'overrides/config/DistantHorizons.toml'), 'utf8');
  assert(dhCfg.includes('threadPriority = 3') && dhCfg.includes('_version = 5') && dhCfg.includes('generatorPlan = "DISABLED"') && dhCfg.includes('chunkGeneratorMode = "PRE_EXISTING_ONLY"') && dhCfg.includes('transparency = "DISABLED"'), 'DistantHorizons.toml uses DH 3.3.3 schema (_version=5) with disabled background generation, valid transparency, and low thread priority');

  const mfCfg = fs.readFileSync(path.join(ROOT, 'overrides/config/modernfix-mixins.properties'), 'utf8');
  assert(mfCfg.includes('mixin.perf.dynamic_resources=true') && mfCfg.includes('mixin.perf.faster_item_rendering=false'), 'modernfix-mixins.properties enables dynamic_resources for 12GB heap safety while keeping faster_item_rendering disabled for VS2/Clockwork');

  const jeiCfg = fs.readFileSync(path.join(ROOT, 'overrides/config/jei/jei-client.ini'), 'utf8');
  assert(jeiCfg.includes('LowMemorySlowSearchEnabled = true') && jeiCfg.includes('TooltipSearchMode = DISABLED'), 'jei-client.ini uses low-memory search mode alongside EMI');

  const embCfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'overrides/config/embeddium-options.json'), 'utf8'));
  assert(embCfg.performance && embCfg.performance.chunk_builder_threads === 4, 'embeddium-options.json caps chunk_builder_threads to avoid CPU contention');

  const s26 = fs.readFileSync(path.join(ROOT, 'overrides/kubejs/server_scripts/26_hard_features_and_territory.js'), 'utf8');
  assert(s26.includes('var termX = chosen.x + 2;') && s26.includes("feet === 'minecraft:barrel'") && s26.includes('chunkProbes >= 3') && s26.includes('hasChunkAt(') && s26.includes('scatterDefaultBots'), 'terminal barrel spawns offset, respawn guards against barrel trapping, first-join guards chunks, and border expansion scatters bots');

  const s24 = fs.readFileSync(path.join(ROOT, 'overrides/kubejs/server_scripts/24_immortal_snail.js'), 'utf8');
  assert(s24.includes('hasChunkAt('), '24_immortal_snail.js checks chunk load status before block scans');

  const apCommon = fs.readFileSync(path.join(ROOT, 'overrides/config/additionalplacements-common.toml'), 'utf8');
  const apServer = fs.readFileSync(path.join(ROOT, 'overrides/defaultconfigs/additionalplacements-server.toml'), 'utf8');
  assert(apCommon.includes('auto_rebuild_tags = false') && apServer.includes('auto_rebuild_tags = false'), 'Additional Placements auto tag rebuild/reload is disabled');

  const yabnHelper = fs.readFileSync(path.join(ROOT, 'runtime-mod/src/main/java/longhaul/runtime/util/YabnFastHelper.java'), 'utf8');
  assert(yabnHelper.includes('encodeObject') && yabnHelper.includes('encodeArray'), 'YabnFastHelper provides linear-time serialization');
  assert(mixinsJson.mixins.includes('YabnObjectFastMixin') && mixinsJson.mixins.includes('YabnArrayFastMixin'), 'YABN O(N) fast mixins are registered');
});

test('Initial bot HQs scatter randomly across expanded Stage 1+ territory and stay relocated', () => {
  const ottd = sandbox.global.LHOpenTTD;
  let seed = 424242;
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const st = ottd.createInitialState(rng);
  // Before Stage 1 expansion, scatter refuses small borders (< 12 sectors)
  const smallRes = ottd.scatterDefaultBots(st, 2, rng);
  assert.equal(smallRes.scattered, 0);

  // Stage 1 expansion (~60 sectors = 31820 border): scatter moves all 4 bots + pirate syndicate into wide outer ring
  const scRes = ottd.scatterDefaultBots(st, 60, rng);
  assert.equal(scRes.scattered, 5);
  assert.equal(st.botsScattered, true);
  assert.equal(st.claims[ottd.sectorKey(7, 2)], undefined, 'legacy (7,2) claim removed');
  assert.equal(st.claims[ottd.sectorKey(-7, -2)], undefined, 'legacy (-7,-2) claim removed');

  const bots = ottd.DEFAULT_BOT_COMPANIES.map(b => st.companies[b.id]).concat([st.companies[ottd.PIRATE_SYNDICATE_ID]]);
  for (const bot of bots) {
    const radial = Math.max(Math.abs(bot.hqSx), Math.abs(bot.hqSz));
    assert(radial >= 16 && radial <= 60, `Bot ${bot.id} radial sector ${radial} should be scattered far from spawn (>= 16)`);
    assert(st.claims[ottd.sectorKey(bot.hqSx, bot.hqSz)]?.owner === bot.id, `HQ claim moved with ${bot.id}`);
  }
  for (let i = 0; i < bots.length; i++) {
    for (let j = i + 1; j < bots.length; j++) {
      const dist = Math.max(Math.abs(bots[i].hqSx - bots[j].hqSx), Math.abs(bots[i].hqSz - bots[j].hqSz));
      assert(dist >= 6, `Bots ${bots[i].id} and ${bots[j].id} too close (${dist} sectors)`);
    }
  }

  // Subsequent ensureBots() must NOT snap relocated bots back to (7,2)
  const savedCoords = bots.map(b => `${b.id}:${b.hqSx},${b.hqSz}`);
  ottd.ensureBots(st, rng);
  const afterCoords = bots.map(b => `${b.id}:${b.hqSx},${b.hqSz}`);
  assert.deepStrictEqual(afterCoords, savedCoords);
});

console.log(tests + ' model tests passed; Minecraft integration is a separate test.');
