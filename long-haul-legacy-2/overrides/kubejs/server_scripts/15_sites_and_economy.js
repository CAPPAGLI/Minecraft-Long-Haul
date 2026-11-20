// Long Haul Legacy 2.0: 8 specialized economic centers + unique archive + continental hub.
// Site coordinates are planned deterministically inside +/-84000 and persisted in SavedData.
// Production is strictly site-bound by site ID and physical proximity.
var LHSitePos = Java.loadClass('net.minecraft.core.BlockPos');
var LHSitesState = null;

function lhSiteSpec(siteId) {
  for (var i = 0; i < global.LHSiteCatalog.length; i++) {
    if (global.LHSiteCatalog[i].id === siteId) return global.LHSiteCatalog[i];
  }
  return null;
}

function lhSitesRead(server) {
  if (LHSitesState !== null) return LHSitesState;
  var raw = server.persistentData.getString('longhaul_sites_v1');
  if (raw) {
    LHSitesState = JSON.parse(String(raw));
  } else {
    var overworld = server.getLevel('minecraft:overworld');
    var seed = overworld ? String(overworld.seed) : '20261115';
    var planned = global.LHWorldPlanner.planSites(seed);
    var map = {};
    planned.forEach(function (s) { map[s.id] = s; });
    LHSitesState = { seed: seed, sites: map };
    server.persistentData.putString('longhaul_sites_v1', JSON.stringify(LHSitesState));
  }
  return LHSitesState;
}

function lhSitesSave(server) {
  if (LHSitesState !== null) {
    server.persistentData.putString('longhaul_sites_v1', JSON.stringify(LHSitesState));
  }
}

function lhBearing(dx, dz) {
  var deg = Math.atan2(dz, dx) * 180 / Math.PI;
  if (deg < 0) deg += 360;
  var dirs = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
  return dirs[Math.round(deg / 45) % 8];
}

function lhNearSite(player, site, radius) {
  if (String(player.level.dimension) !== 'minecraft:overworld') return false;
  return global.LHWorldPlanner.dist2D(player.x, player.z, site.x, site.z) <= radius;
}

function lhFindSurfaceY(overworld, cx, cz) {
  var probe = new LHSitePos(cx, 80, cz);
  if (!overworld.hasChunkAt(probe)) return null;
  for (var y = 185; y >= 48; y--) {
    var bid = String(overworld.getBlock(cx, y, cz).id);
    if (bid !== 'minecraft:air' && bid !== 'minecraft:cave_air' && bid !== 'minecraft:void_air' &&
        bid.indexOf('leaves') === -1 && bid.indexOf('grass') === -1 && bid.indexOf('flower') === -1 &&
        bid !== 'minecraft:snow' && bid !== 'minecraft:vine') {
      return y;
    }
  }
  return 79;
}

function lhPlaceStructureAt(server, kind, entry, forceRepair) {
  if (!entry || (entry.placed && !forceRepair)) return 0;
  var overworld = server.getLevel('minecraft:overworld');
  if (!overworld) return 0;
  var cx = Math.floor(entry.x), cz = Math.floor(entry.z);
  var probe = new LHSitePos(cx, 80, cz);
  if (!overworld.hasChunkAt(probe)) return 0;
  var padY = (forceRepair && typeof entry.placedY === 'number') ? entry.placedY : lhFindSurfaceY(overworld, cx, cz);
  if (padY === null) return 0;
  // Stabilize foundation skirt below padY so structure never floats on slopes
  for (var dx = -5; dx <= 5; dx++) {
    for (var dz = -5; dz <= 5; dz++) {
      for (var dy = 1; dy <= 2; dy++) {
        var under = overworld.getBlock(cx + dx, padY - dy, cz + dz);
        var uid = String(under.id);
        if (uid === 'minecraft:air' || uid === 'minecraft:cave_air' || uid === 'minecraft:water') {
          under.set('minecraft:cobblestone');
        }
      }
    }
  }
  var tpl = 'longhaul:' + kind + '/' + entry.id;
  server.runCommandSilent('place template ' + tpl + ' ' + (cx - 5) + ' ' + padY + ' ' + (cz - 5));
  var depotY = padY + 1;
  var depotBlock = overworld.getBlock(cx, depotY, cz);
  if (String(depotBlock.id) !== 'minecraft:barrel') {
    depotBlock.set('minecraft:barrel');
  }
  entry.placed = true;
  entry.placedY = padY;
  entry.depot = { dim: 'minecraft:overworld', x: cx, y: depotY, z: cz };
  return 1;
}

function lhSiteCommission(server, player, siteId) {
  var db = lhSitesRead(server), site = db.sites[siteId], spec = lhSiteSpec(siteId);
  if (!site || !spec) { lhMsg(player, 'Неизвестный узел: ' + siteId); return 0; }
  if (String(player.level.dimension) !== 'minecraft:overworld') { lhMsg(player, 'Узел регистрируется только в обычном мире.'); return 0; }
  if (!lhNearSite(player, site, 128)) {
    var d = Math.round(global.LHWorldPlanner.dist2D(player.x, player.z, site.x, site.z));
    lhMsg(player, 'Слишком далеко от "' + site.name + '". До точки ~' + d + ' м (' + lhBearing(site.x - player.x, site.z - player.z) + '), требуется <= 128 м.');
    return 0;
  }
  if (!site.placed && lhPlaceStructureAt(server, 'sites', site, false)) {
    lhSitesSave(server);
    lhMsg(player, 'На площадке "' + site.name + '" развёрнут базовый терминал из шаблона ' + site.id + '.');
  }
  var depotPos = { dim: 'minecraft:overworld', x: Math.floor(player.x), y: Math.floor(player.y) - 1, z: Math.floor(player.z) };
  var block = lhLoadedBlock(server, depotPos);
  if (!block || block.id !== 'minecraft:barrel') {
    if (site.depot) {
      var autoB = lhLoadedBlock(server, site.depot);
      if (autoB && String(autoB.id) === 'minecraft:barrel') {
        depotPos = site.depot;
        block = autoB;
      }
    }
  }
  if (!block || String(block.id) !== 'minecraft:barrel') {
    lhMsg(player, 'Встаньте НА бочку площадки узла и повторите /lh site commission ' + siteId);
    return 0;
  }
  site.discovered = true;
  site.commissioned = true;
  site.depot = depotPos;
  lhSitesSave(server);
  lhUnlock(player, 'longhaul:sites/' + siteId);
  lhMsg(player, 'Площадка "' + site.name + '" введена в строй на [' + site.x + ', ' + site.z + ']. Производство: /lh site produce ' + siteId + ' bootstrap');
  return 1;
}

function lhConsumeFromInventory(inv, inputs) {
  var keys = Object.keys(inputs);
  for (var k = 0; k < keys.length; k++) {
    var item = keys[k], need = inputs[item], have = 0;
    for (var s = 0; s < inv.slots; s++) {
      var st = inv.getStackInSlot(s);
      if (String(st.id) === item) have += Number(st.count);
    }
    if (have < need) return { ok: false, missing: item, need: need, have: have };
  }
  for (var k2 = 0; k2 < keys.length; k2++) {
    var item2 = keys[k2], rem = inputs[item2];
    for (var s2 = 0; s2 < inv.slots && rem > 0; s2++) {
      var st2 = inv.getStackInSlot(s2);
      if (String(st2.id) === item2) {
        var taken = inv.extractItem(s2, Math.min(rem, Number(st2.count)), false);
        rem -= Number(taken.count);
      }
    }
  }
  return { ok: true };
}

function lhSiteProduce(server, player, siteId, mode) {
  var db = lhSitesRead(server), site = db.sites[siteId], spec = lhSiteSpec(siteId);
  if (!site || !spec || !spec.product) { lhMsg(player, 'Этот узел не выпускает товарную продукцию.'); return 0; }
  if (!site.commissioned || !site.depot) { lhMsg(player, 'Сначала введите узел в строй на месте: /lh site commission ' + siteId); return 0; }
  if (!lhNearSite(player, site, 160)) {
    lhMsg(player, 'Местная переработка возможна только на территории "' + site.name + '" (<= 160 м от узла). Переносить выпуск на домашнюю базу нельзя.');
    return 0;
  }
  var inputs = mode === 'industrial' ? spec.industrialInputs : spec.bootstrapInputs;
  var outCount = mode === 'industrial' ? 8 : 1;
  if (!inputs) { lhMsg(player, 'Режим "' + mode + '" недоступен для узла ' + siteId + '.'); return 0; }
  var b = lhLoadedBlock(server, site.depot);
  if (!b || b.id !== 'minecraft:barrel') {
    lhMsg(player, 'Бочка-терминал площадки отсутствует. Поставьте бочку и выполните /lh site commission ' + siteId);
    return 0;
  }
  var inv = b.inventory;
  var res = lhConsumeFromInventory(inv, inputs);
  if (!res.ok) {
    lhMsg(player, 'В бочке площадки не хватает ' + res.missing + ' (нужно ' + res.need + ', есть ' + res.have + ').');
    return 0;
  }
  var outStack = Item.of(spec.product, outCount);
  var leftover = outStack;
  for (var s = 0; s < inv.slots && !leftover.empty; s++) {
    leftover = inv.insertItem(s, leftover, false);
  }
  if (!leftover.empty) player.give(leftover);
  site.producedTotal = (site.producedTotal || 0) + outCount;
  lhSitesSave(server);
  lhUnlock(player, 'longhaul:production/' + siteId);
  lhMsg(player, 'Выпущено ' + outCount + 'x ' + spec.product + ' на площадке "' + site.name + '". Всего выпущено: ' + site.producedTotal);
  return 1;
}

function lhSiteArchive(server, player) {
  var db = lhSitesRead(server), site = db.sites.continental_archive;
  if (!site) return 0;
  if (!lhNearSite(player, site, 96)) {
    var d = Math.round(global.LHWorldPlanner.dist2D(player.x, player.z, site.x, site.z));
    lhMsg(player, 'Архив магистралей не рядом (~' + d + ' м, направление ' + lhBearing(site.x - player.x, site.z - player.z) + ').');
    return 0;
  }
  if (!site.placed && lhPlaceStructureAt(server, 'sites', site, false)) {
    lhSitesSave(server);
  }
  var firstTime = !site.commissioned;
  site.discovered = true;
  site.commissioned = true;
  lhSitesSave(server);
  lhUnlock(player, 'longhaul:sites/continental_archive');
  lhMsg(player, firstTime ? 'Уникальный Центральный архив магистралей зафиксирован однократно по ID мира!' : 'Архив уже зафиксирован (повторные награды не выдаются).');
  return 1;
}

function lhSiteRepairArchive(server, player) {
  var db = lhSitesRead(server), site = db.sites.continental_archive;
  if (!site) return 0;
  if (!lhNearSite(player, site, 128)) {
    lhMsg(player, 'Для восстановления архива подойдите ближе 128 м к сохранённым координатам [' + site.x + ', ' + site.z + '].');
    return 0;
  }
  if (!lhPlaceStructureAt(server, 'sites', site, true)) {
    lhMsg(player, 'Не удалось разместить шаблон архива (чанк не загружен).');
    return 0;
  }
  lhSitesSave(server);
  lhMsg(player, 'Конструкция Центрального архива восстановлена на прежних координатах [' + site.x + ', ' + site.z + '] без повторной выдачи наград.');
  return 1;
}

ServerEvents.commandRegistry(function (event) {
  var C = event.commands, root = C.literal('lh');
  root.then(C.literal('sites').executes(function (ctx) {
    var server = ctx.source.server, player = ctx.source.playerOrException, db = lhSitesRead(server);
    lhMsg(player, '=== Стратегические узлы (внутри границы +/-87500) ===');
    global.LHSiteCatalog.forEach(function (spec) {
      var s = db.sites[spec.id];
      var d = Math.round(global.LHWorldPlanner.dist2D(player.x, player.z, s.x, s.z));
      var dir = lhBearing(s.x - player.x, s.z - player.z);
      var status = s.commissioned ? 'РАБОТАЕТ' : (s.discovered ? 'РАЗВЕДАН' : 'НЕ РАЗВЕДАН');
      var coordStr = (s.discovered || s.commissioned) ? ('[' + s.x + ', ' + s.z + ']') : ('направление ' + dir);
      lhMsg(player, '- ' + spec.id + ' (' + spec.name + ', T' + spec.tier + '): ' + status + ', ~' + d + ' м, ' + coordStr);
    });
    return 1;
  }));

  var siteCmd = C.literal('site');
  var info = C.literal('info'), comm = C.literal('commission'), prod = C.literal('produce');
  global.LHSiteCatalog.forEach(function (spec) {
    info.then(C.literal(spec.id).executes(function (ctx) {
      var s = lhSitesRead(ctx.source.server).sites[spec.id], p = ctx.source.playerOrException;
      var d = Math.round(global.LHWorldPlanner.dist2D(p.x, p.z, s.x, s.z));
      var loc = (s.discovered || s.commissioned) ? ('[' + s.x + ', ' + s.z + ']') : ('направление ' + lhBearing(s.x - p.x, s.z - p.z));
      lhMsg(p, spec.name + ' (' + spec.id + '): ' + loc + ', ~' + d + ' м. Продукт: ' + (spec.product || 'уникальный архив') + '. Спрос: ' + spec.demand);
      if (spec.bootstrapInputs) lhMsg(p, 'Ручной запуск (x1): ' + JSON.stringify(spec.bootstrapInputs));
      if (spec.industrialInputs) lhMsg(p, 'Промышленный выпуск (x8): ' + JSON.stringify(spec.industrialInputs));
      return 1;
    }));
    comm.then(C.literal(spec.id).executes(function (ctx) {
      return lhSiteCommission(ctx.source.server, ctx.source.playerOrException, spec.id);
    }));
    if (spec.product) {
      var pNode = C.literal(spec.id);
      if (spec.bootstrapInputs) pNode.then(C.literal('bootstrap').executes(function (ctx) { return lhSiteProduce(ctx.source.server, ctx.source.playerOrException, spec.id, 'bootstrap'); }));
      if (spec.industrialInputs) pNode.then(C.literal('industrial').executes(function (ctx) { return lhSiteProduce(ctx.source.server, ctx.source.playerOrException, spec.id, 'industrial'); }));
      prod.then(pNode);
    }
  });
  siteCmd.then(info);
  siteCmd.then(comm);
  siteCmd.then(prod);
  siteCmd.then(C.literal('archive').executes(function (ctx) { return lhSiteArchive(ctx.source.server, ctx.source.playerOrException); }));
  siteCmd.then(C.literal('repair_archive').executes(function (ctx) { return lhSiteRepairArchive(ctx.source.server, ctx.source.playerOrException); }));
  root.then(siteCmd);
  event.register(root);
});

ServerEvents.tick(function (event) {
  if (LHClock % 40 !== 0) return;
  var server = event.server, db = lhSitesRead(server), changed = false;
  server.players.forEach(function (player) {
    if (String(player.level.dimension) !== 'minecraft:overworld') return;
    Object.keys(db.sites).forEach(function (sid) {
      var s = db.sites[sid];
      if (!s.placed && global.LHWorldPlanner.dist2D(player.x, player.z, s.x, s.z) <= 144) {
        if (lhPlaceStructureAt(server, 'sites', s, false)) {
          s.discovered = true;
          changed = true;
          lhMsg(player, 'Обнаружен и размещён узел "' + s.name + '" [' + s.x + ', ' + s.z + '].');
        }
      }
    });
  });
  if (changed) lhSitesSave(server);
});

ServerEvents.loaded(function (event) {
  var db = lhSitesRead(event.server);
  console.info('[LH] Planned ' + Object.keys(db.sites).length + ' deterministic sites inside +/-84000.');
});
