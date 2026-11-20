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

function lhCatConsumeAnyFromBarrel(inv, requiredCount, minDistinctIds, requireEdible) {
  var total = 0;
  var distinct = {};
  for (var s = 0; s < inv.slots; s++) {
    var st = inv.getStackInSlot(s);
    if (st.empty) continue;
    if (requireEdible && !(st.item && st.item.edible)) continue;
    total += Number(st.count);
    distinct[String(st.id)] = true;
  }
  var distinctCount = Object.keys(distinct).length;
  if (minDistinctIds && distinctCount < minDistinctIds) {
    return { ok: false, have: total, need: requiredCount, distinctHave: distinctCount, distinctNeed: minDistinctIds };
  }
  if (total < requiredCount) return { ok: false, have: total, need: requiredCount, distinctHave: distinctCount, distinctNeed: minDistinctIds || 0 };
  var rem = requiredCount;
  for (var s2 = 0; s2 < inv.slots && rem > 0; s2++) {
    var st2 = inv.getStackInSlot(s2);
    if (st2.empty) continue;
    if (requireEdible && !(st2.item && st2.item.edible)) continue;
    var taken = inv.extractItem(s2, Math.min(rem, Number(st2.count)), false);
    rem -= Number(taken.count);
  }
  return { ok: true };
}

function lhCatMapVehicleFamily(vf) {
  var s = String(vf || '').toLowerCase();
  if (s === 'train' || s === 'rail') return 'rail';
  if (s === 'ship' || s === 'boat' || s === 'watercraft') return 'watercraft';
  if (s === 'aircraft' || s === 'plane' || s === 'airship' || s === 'aircraft_vs') return 'aircraft_vs';
  if (s === 'cart') return 'cart';
  if (s === 'car' || s === 'truck' || s === 'road' || s === 'road_vehicle') return 'road_vehicle';
  if (s === 'horse' || s === 'mount') return 'mount';
  return null;
}

function lhCatCommissionedRegionCount(server) {
  var sdb = lhSitesRead(server), cnt = 0;
  Object.keys(sdb.sites).forEach(function (sid) {
    if (sid === 'continental_archive' || sid === 'continental_hub') return;
    if (sdb.sites[sid] && sdb.sites[sid].commissioned) cnt++;
  });
  return cnt;
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
    var reqFam = lhCatMapVehicleFamily(cond.vehicle_family);
    var hasRoute = Object.keys(rldb.routes).some(function (rid) {
      var r = rldb.routes[rid];
      if (r.length < minLen || (r.completedCount || 0) < reqTrips) return false;
      if (reqFam && !(r.verifiedFamilies && r.verifiedFamilies[reqFam])) return false;
      return true;
    });
    if (!hasRoute) {
      lhMsg(player, 'Требуется завершённый рейс по маршруту длиной >= ' + minLen + ' м (рейсов >= ' + reqTrips + (reqFam ? ', транспорт: ' + reqFam : '') + ': /lh route begin|gate|finish|start).');
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
    // Delivery / production / multi-input / vehicle / train / network / ration verification:
    // Enforces vehicle telemetry, multi-region commissioning, photo proofs, distinct input diversity, or edible rations + atomic barrel consumption.
    if (vt === 'vehicle_delivery' || vt === 'vehicle_trial') {
      var fam = lhCatMapVehicleFamily(cond.vehicle_family);
      var tel = (typeof lhTelemetryRead === 'function') ? (lhTelemetryRead(server).players[pid] || null) : null;
      var minMeters = (vt === 'vehicle_trial') ? 100 : 50;
      var obsMeters = 0;
      if (tel && tel.meters) {
        if (fam) {
          obsMeters = Math.round(tel.meters[fam] || 0);
        } else {
          Object.keys(tel.meters).forEach(function (fk) {
            if (fk !== 'foot') obsMeters += Math.round(tel.meters[fk] || 0);
          });
        }
      }
      if (obsMeters < minMeters) {
        lhMsg(player, 'Требуется зафиксированный пробег транспорта' + (fam ? ' (' + fam + ')' : '') + ' >= ' + minMeters + ' м (сейчас ' + obsMeters + ' м; /lh vehicle status).');
        return 0;
      }
    } else if (vt === 'scheduled_train') {
      var telTr = (typeof lhTelemetryRead === 'function') ? (lhTelemetryRead(server).players[pid] || null) : null;
      var railMeters = (telTr && telTr.meters) ? Math.round(telTr.meters.rail || 0) : 0;
      var rldbTr = lhLogRead(server);
      var hasRailRoute = Object.keys(rldbTr.routes).some(function (rid) {
        var r = rldbTr.routes[rid];
        return (r.completedCount || 0) >= 1 && r.verifiedFamilies && r.verifiedFamilies.rail;
      });
      if (railMeters < 100 && !hasRailRoute) {
        lhMsg(player, 'Для заказа расписания поездов требуется пробег по ЖД >= 100 м или завершённый ЖД-рейс (/lh vehicle status).');
        return 0;
      }
    } else if (vt === 'network_supply') {
      var reqReg = Math.min(4, Math.max(2, Number(cond.distinct_regions || 2)));
      var commCount = lhCatCommissionedRegionCount(server);
      if (commCount < reqReg) {
        lhMsg(player, 'Для сетевой поставки нужно минимум ' + reqReg + ' введённых в строй региональных узлов (сейчас ' + commCount + ').');
        return 0;
      }
    } else if (vt === 'sample_return') {
      var reqPhotos = Math.min(6, Math.max(1, Number(cond.photos || 3)));
      var reqSites = Math.min(6, Math.max(1, Number(cond.distinct_source_sites || 3)));
      var fdbSr = lhFieldRead(server);
      var photoCnt = Object.keys(fdbSr.photoClaims).length;
      var siteCnt = lhCatCommissionedRegionCount(server);
      if (photoCnt < reqPhotos || siteCnt < reqSites) {
        lhMsg(player, 'Для возврата образцов нужно >= ' + reqPhotos + ' фотоотчётов узлов (сейчас ' + photoCnt + ') и >= ' + reqSites + ' запущенных узлов (сейчас ' + siteCnt + ').');
        return 0;
      }
    }

    if (vt === 'vehicle_trial') {
      // Pure vehicle expedition trial verified by telemetry above; no cargo barrel consumption required unless batch_items set
      if (!cond.batch_items) {
        catDb.completed[key] = { by: pid, tick: Number(server.tickCount), type: vt };
        lhCatSave(server);
        lhUnlock(player, 'longhaul:catalog/' + qid);
        if (typeof lhStageRecompute === 'function') lhStageRecompute(server, player);
        lhMsg(player, 'Заказ каталога "' + q.title + '" [' + q.id + '] подтверждён сервером!');
        return 1;
      }
    }

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
    var minDistinct = (cond.distinct_inputs && Number(cond.distinct_inputs) > 1) ? Math.min(4, Number(cond.distinct_inputs)) : 0;
    var needEdible = (vt === 'ration_delivery');
    var cons = lhCatConsumeAnyFromBarrel(blk.inventory, reqAmt, minDistinct, needEdible);
    if (!cons.ok) {
      if (minDistinct && cons.distinctHave < cons.distinctNeed) {
        lhMsg(player, 'Для комплексной поставки нужно >= ' + cons.distinctNeed + ' разных видов груза в бочке (сейчас ' + cons.distinctHave + ').');
      } else if (needEdible) {
        lhMsg(player, 'В бочке-терминале недостаточно съедобных рационов (требуется >= ' + cons.need + ' ед., сейчас ' + cons.have + ').');
      } else {
        lhMsg(player, 'В бочке-терминале недостаточно груза для приёмки (требуется >= ' + cons.need + ' ед., сейчас ' + cons.have + ').');
      }
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
