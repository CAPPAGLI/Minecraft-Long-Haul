// Long Haul Legacy 2.0 server contract adapter (intake verification + consortium teams).
// A barrel accepts and CONSUMES contract goods. Verified intake, not full provenance proof.
var LHPos = Java.loadClass('net.minecraft.core.BlockPos');
var LHStringArg = Java.loadClass('com.mojang.brigadier.arguments.StringArgumentType');
var LHState = null;
var LHClock = 0;

function lhRead(server) {
  if (LHState !== null) return LHState;
  var raw = server.persistentData.getString('longhaul_contracts_v1');
  LHState = raw ? JSON.parse(String(raw)) : { players: {}, teams: {} };
  if (!LHState.players) LHState.players = {};
  if (!LHState.teams) LHState.teams = {};
  return LHState;
}
function lhSave(server) {
  if (LHState !== null) {
    server.persistentData.putString('longhaul_contracts_v1', JSON.stringify(LHState));
  }
}
function lhId(player) { return String(player.uuid); }
function lhMsg(player, text) { player.tell('[Long Haul] ' + text); }
function lhProfile(server, player) {
  var db = lhRead(server), id = lhId(player);
  if (!db.players[id]) db.players[id] = { terminal: null, job: null, receipts: {}, team: null };
  return db.players[id];
}
function lhKey(t) { return t.dim + ':' + t.x + ':' + t.y + ':' + t.z; }
function lhLoadedBlock(server, t) {
  var level = server.getLevel(t.dim);
  if (!level || !level.hasChunkAt(new LHPos(t.x, t.y, t.z))) return null;
  return level.getBlock(t.x, t.y, t.z);
}
function lhUnlock(player, adv) {
  if (player && !player.isAdvancementDone(adv)) player.unlockAdvancement(adv);
}
function lhAllTeamReceipts(db, profile) {
  var out = {};
  Object.keys(profile.receipts || {}).forEach(function (k) { out[k] = true; });
  if (profile.team && db.teams[profile.team]) {
    Object.keys(db.teams[profile.team].receipts || {}).forEach(function (k) { out[k] = true; });
  }
  return out;
}
function lhSync(player, profile, server) {
  var receipts = server ? lhAllTeamReceipts(lhRead(server), profile) : (profile.receipts || {});
  Object.keys(receipts).forEach(function (id) {
    lhUnlock(player, 'longhaul:contracts/' + id);
  });
}

function lhRegister(server, player) {
  var db = lhRead(server), p = lhProfile(server, player);
  if (p.job && p.job.status === 'active') { lhMsg(player, 'Сначала /lh abort.'); return 0; }
  if (!p.terminal && Object.keys(db.players).length > 64) { lhMsg(player, 'Лимит прототипа: 64 участника.'); return 0; }
  var t = { dim: String(player.level.dimension), x: Math.floor(player.x), y: Math.floor(player.y) - 1, z: Math.floor(player.z) };
  if (t.dim !== 'minecraft:overworld') { lhMsg(player, 'Терминал работает только в обычном мире.'); return 0; }
  var block = lhLoadedBlock(server, t);
  if (!block || block.id !== 'minecraft:barrel') { lhMsg(player, 'Встаньте НА обычную бочку и повторите /lh terminal.'); return 0; }
  var busy = Object.keys(db.players).some(function (id) {
    var x = db.players[id];
    return id !== lhId(player) && x.terminal && lhKey(x.terminal) === lhKey(t);
  });
  if (busy) { lhMsg(player, 'Эта бочка принадлежит другому участнику.'); return 0; }
  if (!block.inventory.isEmpty()) { lhMsg(player, 'Перед регистрацией опустошите бочку.'); return 0; }
  p.terminal = t;
  lhSave(server);
  lhUnlock(player, 'longhaul:story/03_dinner_telegram');
  if (typeof lhProgressionRecompute === 'function') lhProgressionRecompute(server, player, false);
  lhMsg(player, 'Терминал зарегистрирован. /lh help — список команд.');
  return 1;
}

function lhAccept(server, player, id) {
  var db = lhRead(server), p = lhProfile(server, player), spec = global.LHContracts[id];
  if (!spec) { lhMsg(player, 'Неизвестный контракт: ' + id); return 0; }
  if (!p.terminal) { lhMsg(player, 'Сначала зарегистрируйте пустую бочку: /lh terminal.'); return 0; }
  if (p.job && p.job.status === 'active') { lhMsg(player, 'Уже есть активный заказ. /lh status или /lh abort.'); return 0; }
  if (p.receipts[id]) { lhMsg(player, 'Этот разовый заказ уже выполнен.'); return 0; }
  var b = lhLoadedBlock(server, p.terminal);
  if (!b || b.id !== 'minecraft:barrel' || !b.inventory.isEmpty()) { lhMsg(player, 'Терминал должен быть загружен и пуст.'); return 0; }
  p.job = global.LHContractEngine.begin(id, spec);
  lhSave(server);
  lhMsg(player, spec.title + '. Приёмка РАСХОДУЕТ товары без возврата. Подавайте их в бочку воронками/транспортёрами. Условия: ' + JSON.stringify(spec.goods) + (spec.windows ? ' за каждое из ' + spec.windows + ' окон по ' + spec.windowSeconds + ' секунд.' : '.'));
  return 1;
}

function lhStatus(server, player) {
  var db = lhRead(server), p = lhProfile(server, player);
  lhMsg(player, JSON.stringify({ terminal: p.terminal, team: p.team, job: p.job, completed: Object.keys(lhAllTeamReceipts(db, p)) }));
  return 1;
}

function lhTeamJoin(server, player, teamName) {
  var db = lhRead(server), p = lhProfile(server, player);
  var clean = String(teamName).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24);
  if (!clean) { lhMsg(player, 'Некорректное имя консорциума.'); return 0; }
  if (!db.teams[clean]) db.teams[clean] = { members: [], receipts: {} };
  var team = db.teams[clean];
  var id = lhId(player);
  if (team.members.indexOf(id) === -1) team.members.push(id);
  Object.keys(p.receipts || {}).forEach(function (k) { team.receipts[k] = true; });
  p.team = clean;
  lhSave(server);
  lhSync(player, p, server);
  lhMsg(player, 'Вы присоединились к консорциуму "' + clean + '".');
  return 1;
}

function lhTeamLeave(server, player) {
  var db = lhRead(server), p = lhProfile(server, player);
  if (!p.team) { lhMsg(player, 'Вы не состоите в консорциуме.'); return 0; }
  var old = p.team;
  if (db.teams[old]) {
    db.teams[old].members = db.teams[old].members.filter(function (m) { return m !== lhId(player); });
  }
  p.team = null;
  lhSave(server);
  lhMsg(player, 'Вы вышли из консорциума "' + old + '".');
  return 1;
}

ServerEvents.commandRegistry(function (event) {
  var C = event.commands, root = C.literal('lh');
  root.then(C.literal('help').executes(function (ctx) {
    var p = ctx.source.playerOrException;
    lhMsg(p, 'Контракты: /lh terminal, /lh accept <заказ>, /lh status, /lh abort, /lh team <join|leave> [имя]. Заказы: ' + Object.keys(global.LHContracts).join(', '));
    lhMsg(p, 'Регионы и объекты: /lh sites, /lh site <info|commission|produce|archive|repair_archive>, /lh recovery <list|info|survey|restore>, /lh photo <report|status>, /lh cc <challenge|verify|status>.');
    lhMsg(p, 'Логистика: /lh camp <deploy|pack|list>, /lh route <begin|gate|finish|start|abort|quota|list>, /lh cargo <issue|deliver>, /lh catalog <list|stage|info|verify>, /lh stage, /lh vehicle status.');
    lhMsg(p, 'Мир и угрозы: /lh prospect (редкие рудные чанки), /lh snail status (Улитка), /lh gas status (сезонный токсичный газ).');
    lhMsg(p, 'OpenTTD: /lh company <create|join|list|info|spec|pact>, /lh map, /lh territory <map|claim|capture|fortify|info>, /lh market <list|sell|buy>, /lh trade <list|offer|accept>, /lh bot status.');
    return 1;
  }));
  root.then(C.literal('terminal').executes(function (ctx) { return lhRegister(ctx.source.server, ctx.source.playerOrException); }));
  root.then(C.literal('status').executes(function (ctx) { return lhStatus(ctx.source.server, ctx.source.playerOrException); }));
  root.then(C.literal('abort').executes(function (ctx) {
    var p = lhProfile(ctx.source.server, ctx.source.playerOrException);
    if (p.job && p.job.status === 'active') p.job.status = 'aborted';
    lhSave(ctx.source.server);
    lhMsg(ctx.source.playerOrException, 'Заказ остановлен. Уже принятые товары израсходованы, оставшиеся в бочке можно забрать.');
    return 1;
  }));

  var accept = C.literal('accept');
  Object.keys(global.LHContracts).forEach(function (id) {
    accept.then(C.literal(id).executes(function (ctx) { return lhAccept(ctx.source.server, ctx.source.playerOrException, id); }));
  });
  root.then(accept);

  var team = C.literal('team');
  team.then(C.literal('join').then(C.argument('name', LHStringArg.word()).executes(function (ctx) {
    return lhTeamJoin(ctx.source.server, ctx.source.playerOrException, LHStringArg.getString(ctx, 'name'));
  })));
  team.then(C.literal('leave').executes(function (ctx) { return lhTeamLeave(ctx.source.server, ctx.source.playerOrException); }));
  root.then(team);

  event.register(root);
});

ServerEvents.loaded(function (event) {
  lhRead(event.server);
  if (typeof lhApplyTerritoryBorder === 'function') {
    lhApplyTerritoryBorder(event.server, false);
  }
  console.info('[LH] 8 intake contracts + consortium sharing loaded.');
});

PlayerEvents.loggedIn(function (event) {
  lhSync(event.player, lhProfile(event.server, event.player), event.server);
});

ServerEvents.tick(function (event) {
  LHClock++;
  if (LHClock % 20 !== 0) return;
  var server = event.server, db = lhRead(server), changed = false;
  Object.keys(db.players).forEach(function (id) {
    var p = db.players[id], job = p.job;
    if (!job || job.status !== 'active') return;
    var b = lhLoadedBlock(server, p.terminal);
    if (!b) return; // no force-loading; unloaded seconds do not count
    if (b.id !== 'minecraft:barrel') {
      job.status = 'failed_terminal_missing';
      changed = true;
      return;
    }
    var inv = b.inventory, spec = global.LHContracts[job.id], need = global.LHContractEngine.remaining(job, spec), accepted = {};
    for (var slot = 0; slot < inv.slots; slot++) {
      var stack = inv.getStackInSlot(slot), item = String(stack.id), n = need[item] || 0;
      if (n > 0) {
        var extracted = inv.extractItem(slot, Math.min(n, stack.count), false);
        var count = Number(extracted.count);
        accepted[item] = (accepted[item] || 0) + count;
        need[item] -= count;
      }
    }
    global.LHContractEngine.step(job, spec, accepted, true);
    changed = true;
    if (job.status === 'complete') {
      p.receipts[job.id] = { totals: job.totals, windows: job.windows };
      if (p.team && db.teams[p.team]) {
        db.teams[p.team].receipts[job.id] = true;
        db.teams[p.team].members.forEach(function (mid) {
          var mp = server.getPlayer(mid);
          if (mp) lhSync(mp, lhProfile(server, mp), server);
        });
      }
      var player = server.getPlayer(id);
      if (player) {
        lhSync(player, p, server);
        if (typeof lhStageRecompute === 'function') lhStageRecompute(server, player);
        if (typeof lhProgressionRecompute === 'function') lhProgressionRecompute(server, player, false);
        if (typeof lhCompanyReward === 'function') {
          var cCat = (job.id === 'frontier_rations') ? 'food' : ((job.id === 'nuclear_power' || job.id === 'steam_era') ? 'energy' : 'contract');
          lhCompanyReward(server, player, 220, cCat, null);
        }
        lhMsg(player, 'Заказ выполнен: ' + spec.title);
      }
    } else if (job.status === 'failed') {
      var player2 = server.getPlayer(id);
      if (player2) lhMsg(player2, 'Заказ не выполнен: пропущена норма окна. Можно начать заново; расходованные товары не возвращаются.');
    }
  });
  if (changed) lhSave(server);
});

function lhActiveAt(server, block) {
  var db = lhRead(server), key = String(block.dimension) + ':' + block.x + ':' + block.y + ':' + block.z;
  return Object.keys(db.players).some(function (id) {
    var p = db.players[id];
    return p.job && p.job.status === 'active' && p.terminal && lhKey(p.terminal) === key;
  });
}
BlockEvents.rightClicked('minecraft:barrel', function (event) { if (lhActiveAt(event.server, event.block)) event.cancel(); });
BlockEvents.broken('minecraft:barrel', function (event) { if (lhActiveAt(event.server, event.block)) event.cancel(); });
