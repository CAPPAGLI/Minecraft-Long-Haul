// Long Haul Legacy 2.0: 4-stage industrial progression synced with GameStages + consortium milestones.
var LHStagesState = null;

var LH_STAGE_META = [
  { id: 'longhaul_stage_1', label: 'I. Мастерская и первая дорога' },
  { id: 'longhaul_stage_2', label: 'II. Региональное производство' },
  { id: 'longhaul_stage_3', label: 'III. Межрегиональная сеть' },
  { id: 'longhaul_stage_4', label: 'IV. Континентальный консорциум' },
  { id: 'longhaul_finale', label: 'Финал: Континентальный комплекс запущен' }
];

function lhStageRead(server) {
  if (LHStagesState !== null) return LHStagesState;
  var raw = server.persistentData.getString('longhaul_stages_v1');
  LHStagesState = raw ? JSON.parse(String(raw)) : { players: {} };
  if (!LHStagesState.players) LHStagesState.players = {};
  return LHStagesState;
}

function lhStageSave(server) {
  if (LHStagesState !== null) {
    server.persistentData.putString('longhaul_stages_v1', JSON.stringify(LHStagesState));
  }
}

function lhStageRecompute(server, player) {
  var stDb = lhStageRead(server), pid = lhId(player);
  var sitesDb = lhSitesRead(server), recDb = lhRecRead(server), fieldDb = lhFieldRead(server);
  var cDb = lhRead(server), prof = lhProfile(server, player);
  var receipts = lhAllTeamReceipts(cDb, prof);

  var commissioned = 0;
  Object.keys(sitesDb.sites || {}).forEach(function (sid) {
    if (sitesDb.sites[sid] && sitesDb.sites[sid].commissioned) commissioned++;
  });
  var restored = 0;
  Object.keys(recDb.items || {}).forEach(function (rid) {
    if (recDb.items[rid] && recDb.items[rid].restored) restored++;
  });
  var ccCount = Object.keys(fieldDb.ccVerified || {}).length;
  var timedCount = 0;
  ['plate_shift', 'food_shift', 'rail_shift'].forEach(function (k) {
    if (receipts[k]) timedCount++;
  });
  var machine = sitesDb.sites && sitesDb.sites.machine;
  var hub = sitesDb.sites && sitesDb.sites.continental_hub;
  var archive = sitesDb.sites && sitesDb.sites.continental_archive;
  var highTierReady = (machine && machine.commissioned) || (hub && hub.commissioned) || (archive && archive.commissioned);

  var hasTerminal = !!(prof && prof.terminal);
  var hasBread = false, hasMilk = false, hasPress = false, hasCompass = false;
  if (player && player.inventory) {
    var inv = player.inventory;
    for (var si = 0; si < inv.slots; si++) {
      var st = inv.getStackInSlot(si);
      if (!st || st.empty) continue;
      var sid = String(st.id);
      if (sid === 'minecraft:bread') hasBread = true;
      else if (sid === 'minecraft:milk_bucket') hasMilk = true;
      else if (sid === 'create:mechanical_press') hasPress = true;
      else if (sid === 'minecraft:compass') hasCompass = true;
    }
  }

  var unlocked = ['longhaul_stage_1'];
  if (commissioned >= 1 || restored >= 1) unlocked.push('longhaul_stage_2');
  if (commissioned >= 2 && (ccCount >= 1 || timedCount >= 1 || restored >= 2)) unlocked.push('longhaul_stage_3');
  if ((highTierReady && commissioned >= 3) || commissioned >= 4) unlocked.push('longhaul_stage_4');
  if (hub && (hub.producedTotal || 0) >= 1) unlocked.push('longhaul_finale');

  if (player && typeof lhUnlock === 'function') {
    lhUnlock(player, 'longhaul:story/01_left_for_bread');
    var s3Done = hasTerminal || commissioned >= 1;
    if (s3Done) lhUnlock(player, 'longhaul:story/03_dinner_telegram');
    if (unlocked.indexOf('longhaul_stage_2') !== -1) lhUnlock(player, 'longhaul:story/02_bakery_burned');
    if (unlocked.indexOf('longhaul_stage_3') !== -1) lhUnlock(player, 'longhaul:story/04_snail_at_door');
    if (unlocked.indexOf('longhaul_stage_4') !== -1) lhUnlock(player, 'longhaul:story/05_continental_bakery');
    if (unlocked.indexOf('longhaul_finale') !== -1) lhUnlock(player, 'longhaul:story/06_forgot_the_milk');
  }

  var prev = stDb.players[pid] || [];
  var added = [];
  unlocked.forEach(function (stg) {
    if (prev.indexOf(stg) === -1) added.push(stg);
    if (player && player.stages && typeof player.stages.has === 'function' && !player.stages.has(stg)) {
      player.stages.add(stg);
    }
  });
  stDb.players[pid] = unlocked;
  lhStageSave(server);

  if (added.length > 0 && player && typeof lhMsg === 'function') {
    added.forEach(function (stg) {
      var meta = LH_STAGE_META.filter(function (m) { return m.id === stg; })[0];
      if (meta && stg !== 'longhaul_stage_1') {
        lhMsg(player, 'Открыта стадия: ' + meta.label + ' [' + stg + ']');
      }
    });
  }
  return { unlocked: unlocked, commissioned: commissioned, restored: restored, ccCount: ccCount, timedCount: timedCount };
}

PlayerEvents.loggedIn(function (event) {
  var res = lhStageRecompute(event.server, event.player);
  if (res && res.unlocked) {
    var top = res.unlocked[res.unlocked.length - 1];
    var meta = LH_STAGE_META.filter(function (m) { return m.id === top; })[0];
    lhMsg(event.player, 'Текущий этап: ' + (meta ? meta.label : top) + ' (/lh stage)');
  }
});

ServerEvents.commandRegistry(function (event) {
  var C = event.commands, root = C.literal('lh');
  root.then(C.literal('stage').executes(function (ctx) {
    var p = ctx.source.playerOrException;
    var res = lhStageRecompute(ctx.source.server, p);
    if (typeof lhProgressionRecompute === 'function') lhProgressionRecompute(ctx.source.server, p, false);
    lhMsg(p, 'Открытые этапы (' + res.unlocked.length + '/5): ' + res.unlocked.join(', '));
    lhMsg(p, 'Сводка: узлы=' + res.commissioned + ', восстановлено=' + res.restored + ', CC=' + res.ccCount + ', ритм-контракты=' + res.timedCount);
    return 1;
  }));
  event.register(root);
});

ServerEvents.loaded(function (event) {
  lhStageRead(event.server);
});
