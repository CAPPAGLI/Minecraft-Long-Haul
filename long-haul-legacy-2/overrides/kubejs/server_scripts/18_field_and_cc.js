// Long Haul Legacy 2.0: Exposure photo field reports & CC: Tweaked depot telemetry challenges.
// Photo reports require proximity + authentic Exposure item; CC challenges verify actual server depot state + real computer block.
var LHFieldPos = Java.loadClass('net.minecraft.core.BlockPos');
var LHFieldState = null;

var LH_EXPOSURE_ITEMS = {
  'exposure:photograph': true,
  'exposure:stacked_photographs': true,
  'exposure:developed_black_and_white_film': true,
  'exposure:developed_color_film': true,
  'exposure:album': true
};

var LH_CC_BLOCKS = {
  'computercraft:computer_normal': true,
  'computercraft:computer_advanced': true,
  'computercraft:turtle_normal': true,
  'computercraft:turtle_advanced': true
};

function lhFieldRead(server) {
  if (LHFieldState !== null) return LHFieldState;
  var raw = server.persistentData.getString('longhaul_field_v1');
  LHFieldState = raw ? JSON.parse(String(raw)) : { photoClaims: {}, usedPhotoTokens: {}, ccChallenges: {}, ccVerified: {} };
  if (!LHFieldState.photoClaims) LHFieldState.photoClaims = {};
  if (!LHFieldState.usedPhotoTokens) LHFieldState.usedPhotoTokens = {};
  if (!LHFieldState.ccChallenges) LHFieldState.ccChallenges = {};
  if (!LHFieldState.ccVerified) LHFieldState.ccVerified = {};
  return LHFieldState;
}

function lhFieldSave(server) {
  if (LHFieldState !== null) {
    server.persistentData.putString('longhaul_field_v1', JSON.stringify(LHFieldState));
  }
}

function lhPhotoToken(item) {
  var id = String(item.id);
  if (!LH_EXPOSURE_ITEMS[id]) return null;
  var nbtStr = item.nbt ? String(item.nbt) : '';
  // Require real Exposure NBT payload (empty creative paper/blank item is rejected)
  if (!nbtStr || nbtStr === '{}' || nbtStr.length < 4) return null;
  return id + '|' + nbtStr;
}

function lhPhotoReport(server, player, siteId) {
  var sitesDb = lhSitesRead(server), site = sitesDb.sites[siteId];
  if (!site) { lhMsg(player, 'Неизвестный узел для фотоотчёта: ' + siteId); return 0; }
  if (String(player.level.dimension) !== 'minecraft:overworld') { lhMsg(player, 'Фотоотчёт сдаётся в обычном мире.'); return 0; }
  if (!lhNearSite(player, site, 160)) {
    var d = Math.round(global.LHWorldPlanner.dist2D(player.x, player.z, site.x, site.z));
    lhMsg(player, 'Подойдите ближе к "' + site.name + '" (<= 160 м, сейчас ~' + d + ' м).');
    return 0;
  }
  var held = player.mainHandItem;
  if (!held || held.empty) { lhMsg(player, 'Возьмите в правую руку снимок/проявленную плёнку/альбом Exposure.'); return 0; }
  var token = lhPhotoToken(held);
  if (!token) {
    lhMsg(player, 'Требуется подлинный снимок, проявленная плёнка или альбом Exposure с данными съёмки.');
    return 0;
  }
  var db = lhFieldRead(server);
  if (db.photoClaims[siteId]) {
    lhMsg(player, 'Полевой фотоотчёт по "' + site.name + '" уже принят ранее.');
    return 1;
  }
  if (db.usedPhotoTokens[token]) {
    lhMsg(player, 'Этот снимок уже использован для отчёта по узлу ' + db.usedPhotoTokens[token] + '. Сделайте новый кадр.');
    return 0;
  }
  db.photoClaims[siteId] = { by: lhId(player), tick: Number(server.tickCount), item: String(held.id) };
  db.usedPhotoTokens[token] = siteId;
  lhFieldSave(server);
  lhUnlock(player, 'longhaul:photo/' + siteId);
  lhMsg(player, 'Полевой фотоотчёт по "' + site.name + '" зафиксирован сервером!');
  return 1;
}

function lhFindNearbyComputer(level, depotPos) {
  for (var dx = -12; dx <= 12; dx++) {
    for (var dy = -4; dy <= 4; dy++) {
      for (var dz = -12; dz <= 12; dz++) {
        var pos = new LHFieldPos(depotPos.x + dx, depotPos.y + dy, depotPos.z + dz);
        if (!level.hasChunkAt(pos)) continue;
        var bid = String(level.getBlock(pos.x, pos.y, pos.z).id);
        if (LH_CC_BLOCKS[bid]) return bid + ' [' + pos.x + ',' + pos.y + ',' + pos.z + ']';
      }
    }
  }
  return null;
}

function lhCCIssue(server, player, siteId) {
  var site = lhSitesRead(server).sites[siteId], spec = lhSiteSpec(siteId);
  if (!site || !spec || !spec.product) { lhMsg(player, 'CC-задание доступно только для производственного узла.'); return 0; }
  if (!site.commissioned || !site.depot) { lhMsg(player, 'Сначала введите узел "' + site.name + '" в строй: /lh site commission ' + siteId); return 0; }
  var db = lhFieldRead(server);
  var targetCount = 4 + (Number(server.tickCount) % 5); // 4..8 units of site product verified in depot barrel
  db.ccChallenges[siteId] = { item: spec.product, count: targetCount, issuedBy: lhId(player), tick: Number(server.tickCount) };
  lhFieldSave(server);
  lhMsg(player, 'CC-задание для "' + site.name + '": разместите компьютер CC: Tweaked в 12 м от бочки склада и держите в бочке ровно >= ' + targetCount + 'x ' + spec.product + ', затем выполните /lh cc verify ' + siteId);
  return 1;
}

function lhCCVerify(server, player, siteId) {
  var site = lhSitesRead(server).sites[siteId];
  if (!site || !site.commissioned || !site.depot) { lhMsg(player, 'Узел "' + siteId + '" не введён в строй.'); return 0; }
  var db = lhFieldRead(server), ch = db.ccChallenges[siteId];
  if (!ch) { lhMsg(player, 'Сначала получите CC-задание: /lh cc challenge ' + siteId); return 0; }
  if (!lhNearSite(player, site, 160)) { lhMsg(player, 'Подойдите к складу узла "' + site.name + '" (<= 160 м).'); return 0; }
  var block = lhLoadedBlock(server, site.depot);
  if (!block || block.id !== 'minecraft:barrel') { lhMsg(player, 'Бочка склада узла недоступна или не загружена.'); return 0; }
  var comp = lhFindNearbyComputer(player.level, site.depot);
  if (!comp) { lhMsg(player, 'В радиусе 12 м от бочки узла не найден компьютер/черепаха CC: Tweaked.'); return 0; }
  var have = 0;
  var inv = block.inventory;
  for (var s = 0; s < inv.slots; s++) {
    var st = inv.getStackInSlot(s);
    if (String(st.id) === ch.item) have += Number(st.count);
  }
  if (have < ch.count) {
    lhMsg(player, 'Фактический запас в бочке (' + have + ') меньше контрольной цели (' + ch.count + 'x ' + ch.item + '). Показания монитора без товара не принимаются.');
    return 0;
  }
  db.ccVerified[siteId] = { computer: comp, item: ch.item, observed: have, tick: Number(server.tickCount) };
  lhFieldSave(server);
  lhUnlock(player, 'longhaul:cc/' + siteId);
  if (typeof lhCompanyReward === 'function') {
    lhCompanyReward(server, player, 180, 'cc', 'rail');
  }
  if (typeof lhStageRecompute === 'function') lhStageRecompute(server, player);
  lhMsg(player, 'Телеметрия "' + site.name + '" подтверждена сервером: компьютер ' + comp + ', фактический запас ' + have + 'x ' + ch.item + '.');
  return 1;
}

ServerEvents.commandRegistry(function (event) {
  var C = event.commands, root = C.literal('lh');

  var photo = C.literal('photo');
  var report = C.literal('report');
  global.LHSiteCatalog.forEach(function (spec) {
    if (spec.id === 'continental_hub') return;
    report.then(C.literal(spec.id).executes(function (ctx) {
      return lhPhotoReport(ctx.source.server, ctx.source.playerOrException, spec.id);
    }));
  });
  photo.then(report);
  photo.then(C.literal('status').executes(function (ctx) {
    var db = lhFieldRead(ctx.source.server), p = ctx.source.playerOrException;
    lhMsg(p, 'Принятые фотоотчёты: ' + (Object.keys(db.photoClaims).join(', ') || 'нет'));
    return 1;
  }));
  root.then(photo);

  var cc = C.literal('cc');
  var chal = C.literal('challenge'), ver = C.literal('verify');
  global.LHSiteCatalog.forEach(function (spec) {
    if (!spec.product || spec.id === 'continental_hub') return;
    chal.then(C.literal(spec.id).executes(function (ctx) {
      return lhCCIssue(ctx.source.server, ctx.source.playerOrException, spec.id);
    }));
    ver.then(C.literal(spec.id).executes(function (ctx) {
      return lhCCVerify(ctx.source.server, ctx.source.playerOrException, spec.id);
    }));
  });
  cc.then(chal);
  cc.then(ver);
  cc.then(C.literal('status').executes(function (ctx) {
    var db = lhFieldRead(ctx.source.server), p = ctx.source.playerOrException;
    lhMsg(p, 'CC-задания: ' + Object.keys(db.ccChallenges).join(', ') + ' | Подтверждено: ' + Object.keys(db.ccVerified).join(', '));
    return 1;
  }));
  root.then(cc);

  event.register(root);
});
