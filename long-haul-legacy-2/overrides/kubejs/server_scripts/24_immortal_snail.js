// Long Haul Legacy 2.0: Immortal Snail stalker + chunk ore prospecting (/lh snail, /lh prospect).
var LHSnailUUID = Java.loadClass('java.util.UUID');
var LHSnailState = null;
var LHSnailTick = 0;

function lhSnailSqrt(v) {
  if (!(v > 0)) return 0;
  var g = v > 1 ? v * 0.5 : 1;
  for (var i = 0; i < 24; i++) g = 0.5 * (g + v / g);
  return g;
}

function lhSnailRead(server) {
  if (LHSnailState !== null) return LHSnailState;
  var raw = server.persistentData.getString('longhaul_snail_v1');
  LHSnailState = raw ? JSON.parse(String(raw)) : { players: {} };
  if (!LHSnailState.players) LHSnailState.players = {};
  return LHSnailState;
}

function lhSnailSave(server) {
  if (LHSnailState !== null) {
    server.persistentData.putString('longhaul_snail_v1', JSON.stringify(LHSnailState));
  }
}

function lhSnailGetRecord(server, player) {
  var db = lhSnailRead(server), pid = lhId(player);
  if (!db.players[pid]) {
    db.players[pid] = {
      activeTicks: 0,
      awake: false,
      dim: String(player.level.dimension),
      x: Number(player.x) + 64,
      y: Number(player.y),
      z: Number(player.z),
      cooldownTicks: 0,
      entityUuid: null,
      lastBand: 999,
      kills: 0
    };
  }
  return db.players[pid];
}

function lhSnailWake(server, player, forceNow) {
  if (!forceNow && typeof lhHardIsActive === 'function' && !lhHardIsActive(server, 'immortal_snail')) {
    return 0;
  }
  var rec = lhSnailGetRecord(server, player);
  if (rec.awake) return 0;
  if (!forceNow) {
    var d0 = global.LHWorldPlanner.dist2D(0, 0, Number(player.x), Number(player.z));
    if (rec.activeTicks < 18000 && !(rec.activeTicks >= 3600 && d0 >= 150)) {
      return 0;
    }
  }
  var tickVal = Number(LHSnailTick);
  if (!(tickVal >= 0)) tickVal = 45;
  var angle = ((tickVal % 360) * 3.141592653589793) / 180.0;
  var cosA = global.LHWorldPlanner.cosRad(angle);
  var sinA = global.LHWorldPlanner.sinRad(angle);
  rec.awake = true;
  rec.dim = String(player.level.dimension);
  rec.x = Number(player.x) + cosA * 64.0;
  rec.y = Number(player.y);
  rec.z = Number(player.z) + sinA * 64.0;
  rec.cooldownTicks = 0;
  rec.lastBand = 4;
  lhSnailSave(server);
  if (typeof lhUnlock === 'function') lhUnlock(player, 'longhaul:story/04_snail_at_door');
  if (typeof player.tell === 'function') {
    player.tell('§c[Long Haul] Вдалеке послышался тихий скрип панциря... Бессмертная Улитка взяла ваш след! Не засиживайтесь на одном месте.');
  }
  return 1;
}

function lhSnailSyncEntity(level, rec, dist3) {
  var ent = null;
  if (rec.entityUuid) {
    try {
      ent = level.getEntity(LHSnailUUID.fromString(rec.entityUuid));
    } catch (e) {
      ent = null;
    }
  }
  if (dist3 > 76 || rec.cooldownTicks > 0) {
    if (ent && ent.isAlive()) ent.discard();
    rec.entityUuid = null;
    return null;
  }
  if (!ent || !ent.isAlive()) {
    try {
      ent = level.createEntity('minecraft:silverfish');
      if (ent) {
        ent.setPos(rec.x, rec.y, rec.z);
        ent.setNoGravity(true);
        ent.noPhysics = true;
        ent.setCustomName(Text.of('§c§lБессмертная Улитка'));
        ent.setCustomNameVisible(true);
        ent.tags.add('lh_immortal_snail');
        ent.mergeNbt({ NoAI: 1, Invulnerable: 1, Silent: 1, PersistenceRequired: 1 });
        ent.spawn();
        rec.entityUuid = String(ent.uuid);
      }
    } catch (e2) {
      rec.entityUuid = null;
      return null;
    }
  } else {
    try {
      ent.noPhysics = true;
      ent.setPos(rec.x, rec.y, rec.z);
    } catch (e3) {}
  }
  return ent;
}

function lhSnailStepPlayer(server, player, dtTicks, skipEntitySync) {
  if (!skipEntitySync && typeof lhHardIsActive === 'function' && !lhHardIsActive(server, 'immortal_snail')) {
    return 0;
  }
  var rec = lhSnailGetRecord(server, player);
  rec.activeTicks += dtTicks;
  if (!rec.awake) {
    lhSnailWake(server, player, !!skipEntitySync ? false : false);
    return 0;
  }
  if (rec.cooldownTicks > 0) {
    rec.cooldownTicks = Math.max(0, rec.cooldownTicks - dtTicks);
    if (!skipEntitySync) lhSnailSyncEntity(player.level, rec, 999);
    return 0;
  }

  var pDim = String(player.level.dimension);
  if (rec.dim !== pDim) {
    rec.dim = pDim;
    rec.x = Number(player.x) + 72.0;
    rec.y = Number(player.y);
    rec.z = Number(player.z);
    rec.entityUuid = null;
    rec.lastBand = 5;
    return 0;
  }

  var dx = Number(player.x) - rec.x;
  var dy = (Number(player.y) + 0.4) - rec.y;
  var dz = Number(player.z) - rec.z;
  var dist3 = lhSnailSqrt(dx * dx + dy * dy + dz * dz);

  // Speed scales gently with distance, phasing straight through solid blocks
  var speedBps = dist3 <= 64 ? 0.36 : (dist3 <= 256 ? 0.80 : 1.70);
  if (typeof lhHardIsActive === 'function' && lhHardIsActive(server, 'snail_sprint_surge')) {
    speedBps *= 1.35;
  }
  var stepDist = Math.min(dist3, speedBps * (dtTicks / 20.0));
  if (dist3 > 0.01) {
    rec.x += (dx / dist3) * stepDist;
    rec.y += (dy / dist3) * stepDist;
    rec.z += (dz / dist3) * stepDist;
    dist3 = Math.max(0, dist3 - stepDist);
  }

  if (!skipEntitySync) lhSnailSyncEntity(player.level, rec, dist3);

  var band = dist3 <= 10 ? 1 : (dist3 <= 24 ? 2 : (dist3 <= 48 ? 3 : 4));
  if (band < rec.lastBand) {
    rec.lastBand = band;
    if (typeof player.tell === 'function') {
      if (band === 3) player.tell('§e[Улитка] В ~3 чанках от вас слышно слабое скольжение по камню...');
      else if (band === 2) player.tell('§6[Улитка] Скрип панциря уже примерно в 1–2 чанках!');
      else if (band === 1) player.tell('§4§l[Улитка] ОНА СОВСЕМ РЯДОМ (' + Math.round(dist3) + ' м)! Двигайтесь!');
    }
  } else if (band > rec.lastBand + 1) {
    rec.lastBand = band;
  }

  if (dist3 <= 2.2) {
    var creative = (typeof player.isCreative === 'function' && player.isCreative()) || (typeof player.isSpectator === 'function' && player.isSpectator());
    if (!creative) {
      rec.kills = (rec.kills || 0) + 1;
      rec.cooldownTicks = (typeof lhHardIsActive === 'function' && lhHardIsActive(server, 'snail_short_grace')) ? 1200 : 2400; // 60s or 120s grace after a kill
      rec.x = Number(player.x) + 80.0;
      rec.y = Number(player.y);
      rec.z = Number(player.z);
      rec.lastBand = 5;
      if (!skipEntitySync) lhSnailSyncEntity(player.level, rec, 999);
      lhSnailSave(server);
      if (typeof player.tell === 'function') {
        player.tell('§4[Long Haul] Бессмертная Улитка настигла вас! Следующее преследование через 120 с на расстоянии 80 м.');
      }
      if (typeof player.kill === 'function') player.kill();
      return 2;
    }
  }
  return 1;
}

function lhProspectChunk(server, player) {
  if (String(player.level.dimension) !== 'minecraft:overworld') {
    lhMsg(player, 'Геологоразведка рудных жил доступна только в обычном мире.');
    return 0;
  }
  var level = player.level;
  var cx = Math.floor(Number(player.x) / 16) * 16;
  var cz = Math.floor(Number(player.z) / 16) * 16;
  var counts = {
    coal: 0, iron: 0, copper: 0, gold: 0, redstone: 0, diamond: 0,
    zinc: 0, bauxite: 0, lead: 0, silver: 0, nickel: 0, uranium: 0,
    thorium: 0, tin: 0, sulfur: 0, rock_salt: 0, quartz: 0
  };
  for (var x = cx; x < cx + 16; x++) {
    for (var z = cz; z < cz + 16; z++) {
      for (var y = -64; y <= 144; y += 2) {
        var bid = String(level.getBlock(x, y, z).id);
        if (bid.indexOf('coal_ore') !== -1) counts.coal++;
        else if (bid.indexOf('iron_ore') !== -1) counts.iron++;
        else if (bid.indexOf('copper_ore') !== -1) counts.copper++;
        else if (bid.indexOf('gold_ore') !== -1) counts.gold++;
        else if (bid.indexOf('redstone_ore') !== -1) counts.redstone++;
        else if (bid.indexOf('diamond_ore') !== -1) counts.diamond++;
        else if (bid.indexOf('zinc_ore') !== -1) counts.zinc++;
        else if (bid.indexOf('ore_aluminum') !== -1 || bid.indexOf('bauxite') !== -1) counts.bauxite++;
        else if (bid.indexOf('lead_ore') !== -1 || bid.indexOf('ore_lead') !== -1) counts.lead++;
        else if (bid.indexOf('silver_ore') !== -1 || bid.indexOf('ore_silver') !== -1) counts.silver++;
        else if (bid.indexOf('nickel_ore') !== -1 || bid.indexOf('ore_nickel') !== -1) counts.nickel++;
        else if (bid.indexOf('uranium_ore') !== -1 || bid.indexOf('ore_uranium') !== -1) counts.uranium++;
        else if (bid.indexOf('thorium_ore') !== -1) counts.thorium++;
        else if (bid.indexOf('tin_ore') !== -1) counts.tin++;
        else if (bid.indexOf('sulfur_ore') !== -1) counts.sulfur++;
        else if (bid.indexOf('rock_salt_ore') !== -1) counts.rock_salt++;
        else if (bid.indexOf('primalmagick:quartz_ore') !== -1) counts.quartz++;
      }
    }
  }
  var rich = [];
  if (counts.coal >= 25) rich.push('УГОЛЬНАЯ ЖИЛА');
  if (counts.iron >= 20) rich.push('ЖЕЛЕЗНАЯ ЖИЛА');
  if (counts.copper >= 20) rich.push('МЕДНАЯ ЖИЛА');
  if (counts.gold >= 12) rich.push('ЗОЛОТАЯ ЖИЛА');
  if (counts.redstone >= 12) rich.push('РЕДСТОУН-ЖИЛА');
  if (counts.diamond >= 8) rich.push('АЛМАЗНАЯ ЖИЛА');
  if (counts.zinc >= 16) rich.push('ЦИНКОВАЯ ЖИЛА');
  if (counts.bauxite >= 14) rich.push('БОКСИТОВАЯ ЖИЛА');
  if (counts.lead >= 12) rich.push('СВИНЦОВАЯ ЖИЛА');
  if (counts.silver >= 12) rich.push('СЕРЕБРЯНАЯ ЖИЛА');
  if (counts.nickel >= 10) rich.push('НИКЕЛЕВАЯ ЖИЛА');
  if (counts.uranium >= 8) rich.push('УРАНОВАЯ ЖИЛА');
  if (counts.thorium >= 8) rich.push('ТОРИЕВАЯ ЖИЛА');
  if (counts.tin >= 14) rich.push('ОЛОВЯННАЯ ЖИЛА');
  if (counts.sulfur >= 12) rich.push('СЕРНАЯ ЖИЛА');
  if (counts.rock_salt >= 12) rich.push('ЖИЛА КАМЕННОЙ СОЛИ');
  if (counts.quartz >= 12) rich.push('КВАРЦЕВАЯ ЖИЛА');
  var nonZero = {};
  Object.keys(counts).forEach(function (k) { if (counts[k] > 0) nonZero[k] = counts[k]; });
  lhMsg(player, 'Чанк [' + (cx >> 4) + ', ' + (cz >> 4) + '] (выборка 50% по Y): ' +
    JSON.stringify(nonZero) + (rich.length ? ' -> §aРЕДКИЙ ЧАНК: ' + rich.join(', ') : ' -> обычный бедный чанк.'));
  return 1;
}

EntityEvents.hurt(function (event) {
  if (event.entity && event.entity.tags && event.entity.tags.contains('lh_immortal_snail')) {
    event.cancel();
    if (event.source && event.source.player) {
      event.source.player.tell('§cБессмертную Улитку нельзя убить. Единственный выход — не останавливаться.');
    }
  }
});

ServerEvents.tick(function (event) {
  LHSnailTick++;
  if (LHSnailTick % 10 !== 0) return;
  var server = event.server;
  var plist = server.players;
  if (!plist) return;
  for (var i = 0; i < plist.length; i++) {
    lhSnailStepPlayer(server, plist[i], 10, false);
  }
  if (LHSnailTick % 200 === 0) {
    lhSnailSave(server);
  }
});

ServerEvents.commandRegistry(function (event) {
  var C = event.commands, root = C.literal('lh');

  var snail = C.literal('snail');
  snail.then(C.literal('status').executes(function (ctx) {
    var server = ctx.source.server, p = ctx.source.playerOrException;
    if (typeof lhHardIsActive === 'function' && !lhHardIsActive(server, 'immortal_snail')) {
      lhMsg(p, 'Бессмертная Улитка ещё заперта (откроется через Колесо Угроз при прохождении глав).');
      return 1;
    }
    var rec = lhSnailGetRecord(server, p);
    if (!rec.awake) {
      var secLeft = Math.max(0, Math.round((18000 - rec.activeTicks) / 20));
      lhMsg(p, 'Бессмертная Улитка ещё не пробудилась (осталось <= ' + secLeft + ' с или выход за 150 м от спауна).');
    } else {
      var d = Math.round(global.LHWorldPlanner.dist2D(p.x, p.z, rec.x, rec.z));
      lhMsg(p, 'Бессмертная Улитка АКТИВНА: ~' + d + ' м (~' + Math.max(1, Math.round(d / 16)) + ' чанк.), кд=' + Math.round(rec.cooldownTicks / 20) + ' с, смертей=' + (rec.kills || 0) + '.');
    }
    return 1;
  }));
  snail.then(C.literal('wake').requires(function (s) { return s.hasPermission(2); }).executes(function (ctx) {
    return lhSnailWake(ctx.source.server, ctx.source.playerOrException, true);
  }));
  root.then(snail);

  root.then(C.literal('prospect').executes(function (ctx) {
    return lhProspectChunk(ctx.source.server, ctx.source.playerOrException);
  }));

  event.register(root);
});

ServerEvents.loaded(function (event) {
  lhSnailRead(event.server);
});
