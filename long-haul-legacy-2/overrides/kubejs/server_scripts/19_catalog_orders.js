// Long Haul Legacy 2.0: Server-side verification for all 240 campaign & regional catalog orders.
// Uses existing SavedData stores (sites, recoveries, logistics, field reports, contracts) + atomic barrel consumption.
var LHCatPos = Java.loadClass('net.minecraft.core.BlockPos');
var LHCatStrArg = Java.loadClass('com.mojang.brigadier.arguments.StringArgumentType');
var LHCatState = null;

function lhCatRead(server) {
  if (LHCatState !== null) return LHCatState;
  var raw = server.persistentData.getString('longhaul_catalog_v1');
  LHCatState = raw ? JSON.parse(String(raw)) : { completed: {} };
  if (!LHCatState.completed) LHCatState.completed = {};
  return LHCatState;
}

function lhCatSave(server) {
  if (LHCatState !== null) {
    server.persistentData.putString('longhaul_catalog_v1', JSON.stringify(LHCatState));
  }
}

function lhCatFind(qid) {
  var list = global.LHQuestCatalog || [];
  for (var i = 0; i < list.length; i++) {
    if (list[i].id === qid) return list[i];
  }
  return null;
}

function lhCatResolveTarget(server, player, cond) {
  var ref = cond.site || cond.route_destination || cond.unique_site_id || null;
  if (!ref) return null;
  if (ref === 'starter_workshop') {
    var prof = lhProfile(server, player);
    if (prof && prof.terminal) {
      return { id: 'starter_workshop', name: 'Стартовая мастерская', x: prof.terminal.x, z: prof.terminal.z, depot: prof.terminal };
    }
    return null;
  }
  if (ref === 'industrial_ruin') {
    var rdb = lhRecRead(server), best = null, bestD = 9999999;
    Object.keys(rdb.items).forEach(function (rid) {
      var item = rdb.items[rid];
      var d = global.LHWorldPlanner.dist2D(player.x, player.z, item.x, item.z);
      if (d < bestD) { bestD = d; best = item; }
    });
    return best;
  }
  var sdb = lhSitesRead(server);
  return sdb.sites[ref] || null;
}

function lhCatConsumeAnyFromBarrel(inv, requiredCount) {
  var total = 0;
  for (var s = 0; s < inv.slots; s++) {
    var st = inv.getStackInSlot(s);
    if (!st.empty) total += Number(st.count);
  }
  if (total < requiredCount) return { ok: false, have: total, need: requiredCount };
  var rem = requiredCount;
  for (var s2 = 0; s2 < inv.slots && rem > 0; s2++) {
    var st2 = inv.getStackInSlot(s2);
    if (!st2.empty) {
      var taken = inv.extractItem(s2, Math.min(rem, Number(st2.count)), false);
      rem -= Number(taken.count);
    }
  }
  return { ok: true };
}

function lhCatVerify(server, player, qid) {
  var q = lhCatFind(qid);
  if (!q) { lhMsg(player, 'Заказ каталога "' + qid + '" не найден.'); return 0; }
  var catDb = lhCatRead(server), pid = lhId(player);
  var key = pid + ':' + qid;
  if (catDb.completed[key]) {
    lhUnlock(player, 'longhaul:catalog/' + qid);
    lhMsg(player, 'Заказ "' + q.title + '" уже подтверждён ранее (повторная награда не выдаётся).');
    return 1;
  }
  var cond = q.conditions || {}, vt = q.verification_type;
  var target = lhCatResolveTarget(server, player, cond);

  if (vt === 'site_visit' || vt === 'unique_site_visit' || vt === 'site_commission' || vt === 'depot_commission') {
    if (!target) {
      lhMsg(player, 'Требуемая площадка или терминал ещё не зарегистрированы (/lh terminal или /lh sites).');
      return 0;
    }
    if (String(player.level.dimension) !== 'minecraft:overworld' ||
        global.LHWorldPlanner.dist2D(player.x, player.z, target.x, target.z) > 160) {
      lhMsg(player, 'Подойдите к площадке "' + target.name + '" (<= 160 м) в обычном мире.');
      return 0;
    }
    if (vt === 'site_commission' && target.id !== 'starter_workshop' && !target.commissioned && !target.restored) {
      lhMsg(player, 'Сначала введите площадку в строй (/lh site commission ' + target.id + ' или /lh recovery restore).');
      return 0;
    }
    if (vt === 'depot_commission' && (target.producedTotal || 0) < 1 && !target.commissioned) {
      lhMsg(player, 'Для узла "' + target.name + '" требуется запущенное депо и выпуск продукции.');
      return 0;
    }
  } else if (vt === 'photo_evidence') {
    if (target && (String(player.level.dimension) !== 'minecraft:overworld' ||
        global.LHWorldPlanner.dist2D(player.x, player.z, target.x, target.z) > 192)) {
      lhMsg(player, 'Для фотоотчёта подойдите к "' + target.name + '" (<= 192 м).');
      return 0;
    }
    var token = lhPhotoToken(player.mainHandItem);
    if (!token) {
      lhMsg(player, 'Возьмите в правую руку проявленную фотографию Exposure (exposure:photograph).');
      return 0;
    }
    var fdb = lhFieldRead(server);
    if (fdb.usedPhotoTokens[token]) {
      lhMsg(player, 'Этот снимок уже использован в другом отчёте.');
      return 0;
    }
    fdb.usedPhotoTokens[token] = 'catalog:' + qid;
    lhFieldSave(server);
  } else if (vt === 'camp_visit') {
    var ldb = lhLogRead(server), camps = ldb.camps[pid] || [];
    var minDist = Number(cond.distance_from_home_blocks || 750);
    var okCamp = camps.some(function (c) {
      return c.active && global.LHWorldPlanner.dist2D(0, 0, c.x, c.z) >= minDist;
    });
    if (!okCamp) {
      lhMsg(player, 'Требуется активный лагерь (/lh camp deploy) минимум в ' + minDist + ' м от (0,0).');
      return 0;
    }
  } else if (vt === 'computer_challenge') {
    var compFound = lhFindNearbyComputer(player.level, { x: Math.floor(player.x), y: Math.floor(player.y), z: Math.floor(player.z) });
    if (!compFound) {
      lhMsg(player, 'Рядом (<= 12 м) должен быть установлен компьютер CC: Tweaked.');
      return 0;
    }
  } else if (vt === 'route_trial') {
    var rldb = lhLogRead(server);
    var minLen = Number(cond.minimum_distance_blocks || 750);
    var reqTrips = Math.min(3, Math.max(1, Number(cond.successful_round_trips || 1)));
    var hasRoute = Object.keys(rldb.routes).some(function (rid) {
      var r = rldb.routes[rid];
      return r.length >= minLen && (r.completedCount || 0) >= reqTrips;
    });
    if (!hasRoute) {
      lhMsg(player, 'Требуется завершённый рейс по маршруту длиной >= ' + minLen + ' м (рейсов >= ' + reqTrips + ': /lh route begin|gate|finish|start).');
      return 0;
    }
  } else if (vt === 'kit_check') {
    var inv = player.inventory;
    if (!inv) { lhMsg(player, 'Инвентарь недоступен.'); return 0; }
    var hasCam = false, hasLight = false, hasFood = false;
    for (var i = 0; i < inv.slots; i++) {
      var st = inv.getStackInSlot(i);
      if (st.empty) continue;
      var sid = String(st.id);
      if (sid === 'exposure:camera') hasCam = true;
      if (sid.indexOf('torch') !== -1 || sid.indexOf('lantern') !== -1) hasLight = true;
      if (sid.indexOf('bread') !== -1 || sid.indexOf('rations') !== -1 || sid.indexOf('cooked') !== -1 || sid.indexOf('stew') !== -1) hasFood = true;
    }
    if (!hasCam || !hasLight || !hasFood) {
      lhMsg(player, 'Соберите экспедиционный набор в инвентарь: камера Exposure, свет (факел/фонарь) и провизия.');
      return 0;
    }
  } else {
    // Delivery / production / multi-input / vehicle fallback: requires real barrel depot + physical item consumption
    var depotPos = (target && target.depot) ? target.depot : { dim: 'minecraft:overworld', x: Math.floor(player.x), y: Math.floor(player.y) - 1, z: Math.floor(player.z) };
    if (target && (String(player.level.dimension) !== 'minecraft:overworld' ||
        global.LHWorldPlanner.dist2D(player.x, player.z, target.x, target.z) > 192)) {
      lhMsg(player, 'Подойдите к площадке "' + target.name + '" (<= 192 м) для сдачи партии.');
      return 0;
    }
    var blk = lhLoadedBlock(server, depotPos);
    if (!blk || String(blk.id) !== 'minecraft:barrel') {
      lhMsg(player, 'Встаньте НА бочку-терминал (или подойдите к бочке узла) с партией поставки.');
      return 0;
    }
    var reqAmt = Math.min(256, Math.max(16, Number(cond.batch_items || cond.minimum_output || cond.output_portions || cond.food_portions || 32)));
    var cons = lhCatConsumeAnyFromBarrel(blk.inventory, reqAmt);
    if (!cons.ok) {
      lhMsg(player, 'В бочке-терминале недостаточно груза для приёмки (требуется >= ' + cons.need + ' ед., сейчас ' + cons.have + ').');
      return 0;
    }
  }

  catDb.completed[key] = { tick: Number(server.tickCount), type: vt };
  lhCatSave(server);
  lhUnlock(player, 'longhaul:catalog/' + qid);
  lhMsg(player, 'Заказ каталога подтверждён: ' + q.title + ' [' + qid + ']!');
  return 1;
}

ServerEvents.commandRegistry(function (event) {
  var C = event.commands, root = C.literal('lh');
  var cat = C.literal('catalog');
  cat.then(C.literal('list').executes(function (ctx) {
    var p = ctx.source.playerOrException, list = global.LHQuestCatalog || [];
    lhMsg(p, 'Всего заказов каталога: ' + list.length + '. Фильтр по этапу: /lh catalog stage <1|2|3|4>, детали: /lh catalog info <id>.');
    return 1;
  }));
  cat.then(C.literal('stage').then(C.argument('st', LHCatStrArg.word()).executes(function (ctx) {
    var p = ctx.source.playerOrException, stNum = parseInt(LHCatStrArg.getString(ctx, 'st'), 10);
    var list = (global.LHQuestCatalog || []).filter(function (q) { return q.stage === stNum; });
    lhMsg(p, 'Этап ' + stNum + ' (' + list.length + ' шт.): ' + list.slice(0, 12).map(function (q) { return q.id; }).join(', ') + (list.length > 12 ? ' ...' : ''));
    return 1;
  })));
  cat.then(C.literal('info').then(C.argument('qid', LHCatStrArg.word()).executes(function (ctx) {
    var p = ctx.source.playerOrException, qid = LHCatStrArg.getString(ctx, 'qid'), q = lhCatFind(qid);
    if (!q) { lhMsg(p, 'Заказ "' + qid + '" не найден.'); return 0; }
    lhMsg(p, '[' + q.id + '] ' + q.title + ' (Этап ' + q.stage + ', ' + q.chapter + ', тип: ' + q.verification_type + ')');
    lhMsg(p, 'Условия: ' + JSON.stringify(q.conditions) + ' | Проверка: /lh catalog verify ' + q.id);
    return 1;
  })));
  cat.then(C.literal('verify').then(C.argument('qid', LHCatStrArg.word()).executes(function (ctx) {
    return lhCatVerify(ctx.source.server, ctx.source.playerOrException, LHCatStrArg.getString(ctx, 'qid'));
  })));
  root.then(cat);
  event.register(root);
});

ServerEvents.loaded(function (event) {
  lhCatRead(event.server);
  console.info('[LH] Catalog orders ready: ' + (global.LHQuestCatalog ? global.LHQuestCatalog.length : 0) + ' entries.');
});
