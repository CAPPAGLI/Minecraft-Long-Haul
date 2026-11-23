// Long Haul Legacy 2.0: expedition camps, route checkpoint trials, and tracked cargo manifests.
var LHCampPos = Java.loadClass('net.minecraft.core.BlockPos');
var LHRouteStringArg = Java.loadClass('com.mojang.brigadier.arguments.StringArgumentType');
var LHLogisticsState = null;

function lhLogRead(server) {
  if (LHLogisticsState !== null) return LHLogisticsState;
  var raw = server.persistentData.getString('longhaul_logistics_v1');
  LHLogisticsState = raw ? JSON.parse(String(raw)) : { camps: {}, routes: {}, drafts: {}, activeRuns: {}, manifests: {}, nextTx: 1 };
  if (!LHLogisticsState.camps) LHLogisticsState.camps = {};
  if (!LHLogisticsState.routes) LHLogisticsState.routes = {};
  if (!LHLogisticsState.drafts) LHLogisticsState.drafts = {};
  if (!LHLogisticsState.activeRuns) LHLogisticsState.activeRuns = {};
  if (!LHLogisticsState.manifests) LHLogisticsState.manifests = {};
  if (!LHLogisticsState.chunkAnchors) LHLogisticsState.chunkAnchors = {};
  if (!LHLogisticsState.nextTx) LHLogisticsState.nextTx = 1;
  return LHLogisticsState;
}
var LH_ROUTE_MAX_ANCHORS = 2;

function lhRouteQuotaSync(server, pid, gateCoords, dryRun) {
  var db = lhLogRead(server);
  var prev = db.chunkAnchors[pid] || [];
  var desired = [];
  var seen = {};
  (gateCoords || []).forEach(function (g) {
    if (!g || desired.length >= LH_ROUTE_MAX_ANCHORS) return;
    var cx = Math.floor(Number(g.x) / 16) * 16;
    var cz = Math.floor(Number(g.z) / 16) * 16;
    var key = cx + ',' + cz;
    if (!seen[key]) {
      seen[key] = true;
      desired.push({ x: cx, z: cz, key: key });
    }
  });
  if (!dryRun) {
    prev.forEach(function (old) {
      if (!seen[old.key]) {
        server.runCommandSilent('forceload remove ' + old.x + ' ' + old.z);
      }
    });
    var prevMap = {};
    prev.forEach(function (old) { prevMap[old.key] = true; });
    desired.forEach(function (cur) {
      if (!prevMap[cur.key]) {
        server.runCommandSilent('forceload add ' + cur.x + ' ' + cur.z);
      }
    });
  }
  if (desired.length) db.chunkAnchors[pid] = desired;
  else delete db.chunkAnchors[pid];
  lhLogSave(server);
  return desired;
}

function lhRouteQuotaStatus(server, pid) {
  var db = lhLogRead(server);
  var list = db.chunkAnchors[pid] || [];
  return { used: list.length, max: LH_ROUTE_MAX_ANCHORS, anchors: list };
}
function lhLogSave(server) {
  if (LHLogisticsState !== null) {
    server.persistentData.putString('longhaul_logistics_v1', JSON.stringify(LHLogisticsState));
  }
}

function lhHasCampEquipment(level, px, py, pz) {
  var hasFire = false, hasSleep = false;
  for (var dx = -6; dx <= 6; dx++) {
    for (var dy = -3; dy <= 3; dy++) {
      for (var dz = -6; dz <= 6; dz++) {
        var pos = new LHCampPos(px + dx, py + dy, pz + dz);
        if (!level.hasChunkAt(pos)) continue;
        var bid = String(level.getBlock(pos.x, pos.y, pos.z).id);
        if (bid === 'minecraft:campfire' || bid === 'minecraft:soul_campfire') hasFire = true;
        if (bid.indexOf('sleeping_bag') !== -1 || bid.indexOf('_bed') !== -1) hasSleep = true;
        if (hasFire && hasSleep) return true;
      }
    }
  }
  return false;
}

function lhCampContainsNonEmptyContainer(level, cx, cy, cz) {
  for (var dx = -6; dx <= 6; dx++) {
    for (var dy = -3; dy <= 3; dy++) {
      for (var dz = -6; dz <= 6; dz++) {
        var pos = new LHCampPos(cx + dx, cy + dy, cz + dz);
        if (!level.hasChunkAt(pos)) continue;
        var b = level.getBlock(pos.x, pos.y, pos.z);
        var bid = String(b.id);
        if (bid === 'minecraft:barrel' || bid === 'minecraft:chest' || bid === 'minecraft:trapped_chest') {
          if (b.inventory && !b.inventory.isEmpty()) return bid + ' [' + pos.x + ',' + pos.y + ',' + pos.z + ']';
        }
      }
    }
  }
  return null;
}

function lhCampDeploy(server, player) {
  if (String(player.level.dimension) !== 'minecraft:overworld') { lhMsg(player, 'Лагерь разворачивается только в обычном мире.'); return 0; }
  var px = Math.floor(player.x), py = Math.floor(player.y), pz = Math.floor(player.z);
  var d0 = global.LHWorldPlanner.dist2D(0, 0, px, pz);
  if (d0 < 750) { lhMsg(player, 'Экспедиционный лагерь должен быть минимум в 750 м от (0,0). Сейчас: ' + Math.round(d0) + ' м.'); return 0; }
  var db = lhLogRead(server), pid = lhId(player);
  var myCamps = db.camps[pid] || [];
  var tooClose = myCamps.some(function (c) {
    return c.active && global.LHWorldPlanner.dist2D(c.x, c.z, px, pz) < 500;
  });
  if (tooClose) { lhMsg(player, 'До ближайшего вашего активного лагеря меньше 500 м.'); return 0; }
  if (!lhHasCampEquipment(player.level, px, py, pz)) {
    lhMsg(player, 'Рядом (<= 6 м) должны быть костёр и спальник Comforts / кровать.');
    return 0;
  }
  var campId = 'camp_' + (myCamps.length + 1);
  myCamps.push({ id: campId, x: px, y: py, z: pz, active: true });
  db.camps[pid] = myCamps;
  lhLogSave(server);
  lhUnlock(player, 'longhaul:expedition/first_camp');
  if (typeof lhCompanyAutoClaimFromInfra === 'function') lhCompanyAutoClaimFromInfra(server, player, px, pz, campId);
  var activeCount = myCamps.filter(function (c) { return c.active; }).length;
  if (activeCount >= 3) lhUnlock(player, 'longhaul:expedition/three_camps');
  lhMsg(player, 'Лагерь ' + campId + ' развёрнут в [' + px + ', ' + py + ', ' + pz + ']. Активных лагерей: ' + activeCount);
  return 1;
}

function lhCampPack(server, player, campId) {
  var db = lhLogRead(server), pid = lhId(player), myCamps = db.camps[pid] || [];
  var camp = null;
  for (var i = 0; i < myCamps.length; i++) {
    if (myCamps[i].id === campId && myCamps[i].active) { camp = myCamps[i]; break; }
  }
  if (!camp) { lhMsg(player, 'Активный лагерь "' + campId + '" не найден.'); return 0; }
  if (global.LHWorldPlanner.dist2D(player.x, player.z, camp.x, camp.z) > 16) {
    lhMsg(player, 'Подойдите к лагерю ближе 16 м для сворачивания.');
    return 0;
  }
  var dirty = lhCampContainsNonEmptyContainer(player.level, camp.x, camp.y, camp.z);
  if (dirty) {
    lhMsg(player, 'Нельзя свернуть лагерь с полными контейнерами: освободите ' + dirty);
    return 0;
  }
  camp.active = false;
  lhLogSave(server);
  lhMsg(player, 'Лагерь ' + campId + ' безопасно свёрнут.');
  return 1;
}

function lhRouteBegin(server, player, name) {
  if (String(player.level.dimension) !== 'minecraft:overworld') { lhMsg(player, 'Маршруты создаются в обычном мире.'); return 0; }
  var clean = String(name).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24);
  if (!clean) { lhMsg(player, 'Некорректное имя маршрута.'); return 0; }
  var db = lhLogRead(server), pid = lhId(player);
  db.drafts[pid] = { id: clean, gates: [{ x: Math.floor(player.x), y: Math.floor(player.y), z: Math.floor(player.z) }] };
  lhLogSave(server);
  lhMsg(player, 'Ворота A маршрута "' + clean + '" поставлены. Добавьте контрольные точки (/lh route gate) и завершите (/lh route finish).');
  return 1;
}

function lhRouteGate(server, player) {
  var db = lhLogRead(server), pid = lhId(player), draft = db.drafts[pid];
  if (!draft) { lhMsg(player, 'Сначала начните маршрут: /lh route begin <имя>'); return 0; }
  var last = draft.gates[draft.gates.length - 1];
  var gx = Math.floor(player.x), gy = Math.floor(player.y), gz = Math.floor(player.z);
  var d = Math.round(global.LHWorldPlanner.dist2D(last.x, last.z, gx, gz));
  if (d < 150) { lhMsg(player, 'Контрольная точка должна быть минимум в 150 м от предыдущей (сейчас ' + d + ' м).'); return 0; }
  draft.gates.push({ x: gx, y: gy, z: gz });
  lhLogSave(server);
  lhMsg(player, 'Добавлена точка #' + draft.gates.length + ' (+' + d + ' м).');
  return 1;
}

function lhRouteFinish(server, player) {
  var db = lhLogRead(server), pid = lhId(player), draft = db.drafts[pid];
  if (!draft) { lhMsg(player, 'Нет черновика маршрута.'); return 0; }
  var last = draft.gates[draft.gates.length - 1];
  var gx = Math.floor(player.x), gy = Math.floor(player.y), gz = Math.floor(player.z);
  if (global.LHWorldPlanner.dist2D(last.x, last.z, gx, gz) >= 150) {
    draft.gates.push({ x: gx, y: gy, z: gz });
  }
  var total = global.LHRouteValidator.pathLength(draft.gates);
  if (draft.gates.length < 2 || total < 750) {
    lhMsg(player, 'Длина маршрута должна быть >= 750 м (сейчас ' + total + ' м, точек: ' + draft.gates.length + ').');
    return 0;
  }
  db.routes[draft.id] = { id: draft.id, owner: pid, gates: draft.gates, length: total };
  delete db.drafts[pid];
  lhLogSave(server);
  lhMsg(player, 'Маршрут "' + draft.id + '" сохранён (' + draft.gates.length + ' точек, ' + total + ' м). Запуск испытания: /lh route start ' + draft.id);
  return 1;
}

function lhRouteStart(server, player, routeId) {
  var db = lhLogRead(server), route = db.routes[routeId], pid = lhId(player);
  if (!route) { lhMsg(player, 'Маршрут "' + routeId + '" не найден.'); return 0; }
  var g0 = route.gates[0];
  if (global.LHWorldPlanner.dist2D(player.x, player.z, g0.x, g0.z) > 20) {
    lhMsg(player, 'Встаньте у стартовых ворот A [' + g0.x + ', ' + g0.z + '] (<= 20 м).');
    return 0;
  }
  var startFam = (typeof lhClassifyVehicle === 'function') ? lhClassifyVehicle(player.vehicle) : 'foot';
  var fams = {};
  fams[startFam] = true;
  db.activeRuns[pid] = { routeId: routeId, nextIndex: 1, lastGateTick: Math.floor(server.tickCount), lastGate: g0, families: fams, failed: false };
  lhRouteQuotaSync(server, pid, [g0, route.gates[1]], false);
  lhLogSave(server);
  lhMsg(player, 'Испытание маршрута "' + routeId + '" начато! Выделена квота чанков маршрута (<= 2).');
  return 1;
}

function lhRouteStepPlayer(server, player) {
  var db = lhLogRead(server), pid = lhId(player), run = db.activeRuns[pid];
  if (!run || run.failed) return 0;
  var route = db.routes[run.routeId];
  if (!route || String(player.level.dimension) !== 'minecraft:overworld') return 0;
  var fam = (typeof lhClassifyVehicle === 'function') ? lhClassifyVehicle(player.vehicle) : 'foot';
  if (!run.families) run.families = {};
  run.families[fam] = true;
  var gate = route.gates[run.nextIndex];
  if (!gate) return 0;
  if (global.LHWorldPlanner.dist2D(player.x, player.z, gate.x, gate.z) > 18) return 0;
  var elapsed = Math.max(1, Math.round((Number(server.tickCount) - run.lastGateTick) / 20));
  var check = global.LHRouteValidator.validateSegmentSpeed(run.lastGate, gate, elapsed);
  if (!check.ok) {
    delete db.activeRuns[pid];
    lhRouteQuotaSync(server, pid, [], false);
    lhLogSave(server);
    lhMsg(player, 'Испытание маршрута отменено: аномальная скорость перемещения (' + check.speedBps + ' м/с). Телепортация запрещена.');
    return -1;
  }
  run.lastGateTick = Number(server.tickCount);
  run.lastGate = gate;
  run.nextIndex++;
  if (run.nextIndex >= route.gates.length) {
    delete db.activeRuns[pid];
    lhRouteQuotaSync(server, pid, [], false);
    route.completedCount = (route.completedCount || 0) + 1;
    if (!route.verifiedFamilies) route.verifiedFamilies = {};
    Object.keys(run.families).forEach(function (fk) { route.verifiedFamilies[fk] = true; });
    route.lastCompletedTick = Number(server.tickCount);
    lhLogSave(server);
    lhUnlock(player, 'longhaul:routes/first_route');
    if (typeof lhCompanyReward === 'function') {
      var rfam = Object.keys(run.families)[0] || null;
      lhCompanyReward(server, player, 250 + Math.round(route.length / 20), 'route', rfam);
    }
    if (typeof lhStageRecompute === 'function') lhStageRecompute(server, player);
    lhMsg(player, 'Маршрут "' + route.id + '" пройден (' + route.length + ' м, рейсов: ' + route.completedCount + ')! Квота чанков освобождена.');
    return 2;
  }
  lhRouteQuotaSync(server, pid, [gate, route.gates[run.nextIndex]], false);
  lhLogSave(server);
  lhMsg(player, 'Контрольная точка ' + run.nextIndex + '/' + route.gates.length + ' пройдена (' + check.speedBps + ' м/с).');
  return 1;
}

function lhCargoIssue(server, player, originId, destId) {
  var sites = lhSitesRead(server).sites, origin = sites[originId], dest = sites[destId];
  if (!origin || !dest || originId === destId) { lhMsg(player, 'Укажите два разных узла.'); return 0; }
  if (!lhNearSite(player, origin, 128)) { lhMsg(player, 'Накладная выдаётся только в точке отправления "' + origin.name + '" (<= 128 м).'); return 0; }
  var db = lhLogRead(server);
  var txId = 'LH-' + (db.nextTx++);
  db.manifests[txId] = { origin: originId, dest: destId, owner: lhId(player), status: 'active', issuedTick: Number(server.tickCount) };
  lhLogSave(server);
  var item = Item.of('longhaul:cargo_manifest', 1, {
    lhTxId: txId, lhOrigin: originId, lhDest: destId,
    display: { Name: JSON.stringify({ text: 'Накладная ' + txId + ': ' + originId + ' -> ' + destId }) }
  });
  player.give(item);
  lhMsg(player, 'Выдана серверная накладная ' + txId + ' (' + origin.name + ' -> ' + dest.name + ').');
  return 1;
}

function lhCargoDeliver(server, player) {
  var held = player.mainHandItem;
  if (!held || String(held.id) !== 'longhaul:cargo_manifest' || !held.nbt || !held.nbt.lhTxId) {
    lhMsg(player, 'Возьмите в правую руку действующую грузовую накладную.');
    return 0;
  }
  var txId = String(held.nbt.lhTxId);
  var db = lhLogRead(server), rec = db.manifests[txId];
  if (!rec || rec.status !== 'active') { lhMsg(player, 'Накладная ' + txId + ' недействительна или уже использована.'); return 0; }
  var dest = lhSitesRead(server).sites[rec.dest];
  if (!dest || !lhNearSite(player, dest, 128)) {
    lhMsg(player, 'Доставьте накладную физически в узел "' + (dest ? dest.name : rec.dest) + '" (<= 128 м).');
    return 0;
  }
  rec.status = 'delivered';
  rec.deliveredTick = Number(server.tickCount);
  held.count = held.count - 1;
  lhLogSave(server);
  lhUnlock(player, 'longhaul:routes/cargo_delivery');
  if (typeof lhCompanyReward === 'function') lhCompanyReward(server, player, 280, 'route', null);
  if (typeof lhStageRecompute === 'function') lhStageRecompute(server, player);
  lhMsg(player, 'Партия ' + txId + ' принята в "' + dest.name + '"!');
  return 1;
}

ServerEvents.commandRegistry(function (event) {
  var C = event.commands, root = C.literal('lh');
  var camp = C.literal('camp');
  camp.then(C.literal('deploy').executes(function (ctx) { return lhCampDeploy(ctx.source.server, ctx.source.playerOrException); }));
  camp.then(C.literal('pack').then(C.argument('campId', LHRouteStringArg.word()).executes(function (ctx) {
    return lhCampPack(ctx.source.server, ctx.source.playerOrException, LHRouteStringArg.getString(ctx, 'campId'));
  })));
  camp.then(C.literal('list').executes(function (ctx) {
    var db = lhLogRead(ctx.source.server), p = ctx.source.playerOrException;
    var list = db.camps[lhId(p)] || [];
    lhMsg(p, 'Лагеря (' + list.length + '): ' + JSON.stringify(list));
    return 1;
  }));
  root.then(camp);

  var route = C.literal('route');
  route.then(C.literal('begin').then(C.argument('routeId', LHRouteStringArg.word()).executes(function (ctx) {
    return lhRouteBegin(ctx.source.server, ctx.source.playerOrException, LHRouteStringArg.getString(ctx, 'routeId'));
  })));
  route.then(C.literal('gate').executes(function (ctx) { return lhRouteGate(ctx.source.server, ctx.source.playerOrException); }));
  route.then(C.literal('finish').executes(function (ctx) { return lhRouteFinish(ctx.source.server, ctx.source.playerOrException); }));
  route.then(C.literal('start').then(C.argument('routeId', LHRouteStringArg.word()).executes(function (ctx) {
    return lhRouteStart(ctx.source.server, ctx.source.playerOrException, LHRouteStringArg.getString(ctx, 'routeId'));
  })));
  route.then(C.literal('list').executes(function (ctx) {
    var db = lhLogRead(ctx.source.server), p = ctx.source.playerOrException;
    lhMsg(p, 'Маршруты: ' + Object.keys(db.routes).join(', '));
    return 1;
  }));
  route.then(C.literal('quota').executes(function (ctx) {
    var p = ctx.source.playerOrException;
    var q = lhRouteQuotaStatus(ctx.source.server, lhId(p));
    lhMsg(p, 'Квота чанков активного маршрута: ' + q.used + '/' + q.max + ' -> ' + JSON.stringify(q.anchors));
    return 1;
  }));
  route.then(C.literal('abort').executes(function (ctx) {
    var server = ctx.source.server, p = ctx.source.playerOrException, pid = lhId(p), db = lhLogRead(server);
    delete db.activeRuns[pid];
    lhRouteQuotaSync(server, pid, [], false);
    lhMsg(p, 'Активный рейс по маршруту прерван, квота чанков освобождена.');
    return 1;
  }));
  root.then(route);

  var cargo = C.literal('cargo');
  var issue = C.literal('issue');
  global.LHSiteCatalog.forEach(function (orig) {
    var oNode = C.literal(orig.id);
    global.LHSiteCatalog.forEach(function (dst) {
      if (orig.id !== dst.id) {
        oNode.then(C.literal(dst.id).executes(function (ctx) {
          return lhCargoIssue(ctx.source.server, ctx.source.playerOrException, orig.id, dst.id);
        }));
      }
    });
    issue.then(oNode);
  });
  cargo.then(issue);
  cargo.then(C.literal('deliver').executes(function (ctx) { return lhCargoDeliver(ctx.source.server, ctx.source.playerOrException); }));
  root.then(cargo);

  event.register(root);
});

ServerEvents.tick(function (event) {
  if (LHClock % 20 !== 0) return;
  var server = event.server, db = lhLogRead(server);
  Object.keys(db.activeRuns).forEach(function (pid) {
    var player = server.getPlayer(pid);
    if (player) lhRouteStepPlayer(server, player);
  });
});
