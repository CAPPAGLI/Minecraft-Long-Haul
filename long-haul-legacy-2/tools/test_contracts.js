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

console.log(tests + ' model tests passed; Minecraft integration is a separate test.');
