// Long Haul Legacy 2.0: Death Stranding Voidout explosion on true death + seasonal rising toxic gas.
var LHVoidoutQueue = [];
var LHVoidoutState = null;
var LHGasState = null;
var LHGasTick = 0;

var LH_GAS_CYCLE_TICKS = 96000; // 4 MC days per full cycle (1 MC day per phase)
var LH_GAS_PHASES = [
  { id: 0, key: 'clear', label: 'Чистый сезон', minY: -64, maxY: -64 },
  { id: 1, key: 'rising', label: 'Подъём токсичного тумана', minY: 20, maxY: 84 },
  { id: 2, key: 'peak', label: 'Пик ядовитого прилива', minY: 114, maxY: 114 },
  { id: 3, key: 'receding', label: 'Спад прилива', minY: 114, maxY: 20 }
];

function lhVoidoutRead(server) {
  if (LHVoidoutState !== null) return LHVoidoutState;
  var raw = server.persistentData.getString('longhaul_voidout_v1');
  LHVoidoutState = raw ? JSON.parse(String(raw)) : { totalVoidouts: 0, deathCount: 0, lastPower: 0, lastVoidout: null };
  if (typeof LHVoidoutState.deathCount !== 'number') LHVoidoutState.deathCount = LHVoidoutState.totalVoidouts || 0;
  return LHVoidoutState;
}

function lhVoidoutSave(server) {
  if (LHVoidoutState !== null) {
    server.persistentData.putString('longhaul_voidout_v1', JSON.stringify(LHVoidoutState));
  }
}

function lhGasRead(server) {
  if (LHGasState !== null) return LHGasState;
  var raw = server.persistentData.getString('longhaul_gas_v1');
  LHGasState = raw ? JSON.parse(String(raw)) : { forcedPhase: -1, lastNotifiedPhase: -1, players: {} };
  if (!LHGasState.players) LHGasState.players = {};
  if (typeof LHGasState.forcedPhase !== 'number') LHGasState.forcedPhase = -1;
  if (typeof LHGasState.lastNotifiedPhase !== 'number') LHGasState.lastNotifiedPhase = -1;
  return LHGasState;
}

function lhGasSave(server) {
  if (LHGasState !== null) {
    server.persistentData.putString('longhaul_gas_v1', JSON.stringify(LHGasState));
  }
}

function lhQueueVoidout(server, dim, x, y, z, playerName) {
  var db = lhVoidoutRead(server);
  db.totalVoidouts = (db.totalVoidouts || 0) + 1;
  db.deathCount = (db.deathCount || 0) + 1;
  var pwr = global.LHVoidoutMath.computePower(db.deathCount);
  db.lastPower = pwr.raw;
  db.lastVoidout = { dim: String(dim), x: Math.round(x), y: Math.round(y), z: Math.round(z), player: String(playerName || 'Игрок'), power: pwr.raw };
  lhVoidoutSave(server);
  LHVoidoutQueue.push({
    dim: String(dim),
    x: Number(x),
    y: Number(y),
    z: Number(z),
    player: String(playerName || 'Игрок'),
    powerRaw: pwr.raw,
    powerPrimary: pwr.primary,
    shockwaves: pwr.shockwaves,
    deathNumber: db.deathCount,
    delay: 3
  });
  return db.totalVoidouts;
}

function lhProcessVoidoutQueue(server, dryRun) {
  if (!LHVoidoutQueue.length) return 0;
  var remaining = [];
  var detonated = 0;
  for (var i = 0; i < LHVoidoutQueue.length; i++) {
    var item = LHVoidoutQueue[i];
    item.delay -= 1;
    if (item.delay > 0) {
      remaining.push(item);
      continue;
    }
    detonated++;
    if (dryRun) continue;
    try {
      var level = server.getLevel(item.dim);
      if (level) {
        var primary = Number(item.powerPrimary || 12.0);
        level.createExplosion(item.x, item.y, item.z)
          .strength(primary)
          .causesFire(true)
          .explosionMode('block')
          .explode();
        var swCount = Number(item.shockwaves || 0);
        for (var sw = 0; sw < swCount; sw++) {
          var ang = (sw / swCount) * 6.2831853;
          var rOff = 14.0 + sw * 2.0;
          level.createExplosion(item.x + Math.cos(ang) * rOff, item.y, item.z + Math.sin(ang) * rOff)
            .strength(32.0)
            .causesFire(true)
            .explosionMode('block')
            .explode();
        }
        try {
          var bolt = level.createEntity('minecraft:lightning_bolt');
          if (bolt) {
            bolt.setPos(item.x, item.y, item.z);
            bolt.setVisualOnly(true);
            bolt.spawn();
          }
        } catch (eBolt) {}
      }
      var plist = server.players;
      if (plist) {
        for (var j = 0; j < plist.length; j++) {
          plist[j].tell('§4§l[VOIDOUT #' + (item.deathNumber || 1) + ' · Сила ' + (item.powerRaw || 12) + '] §cГибель ' + item.player + ' вызвала выброс на (' +
            Math.round(item.x) + ', ' + Math.round(item.y) + ', ' + Math.round(item.z) + ')! Следующая смерть удвоит силу взрыва. Тотем спасает.');
        }
      }
    } catch (eExp) {
      console.error('Voidout detonation error: ' + eExp);
    }
  }
  LHVoidoutQueue = remaining;
  return detonated;
}

function lhGasComputeStatus(server) {
  var db = lhGasRead(server);
  if (db.forcedPhase < 0 && typeof lhHardIsActive === 'function' && !lhHardIsActive(server, 'toxic_gas')) {
    return { phase: 0, key: 'locked', label: 'Токсичный газ ещё не пробудился', ceilingY: -64, ticksLeft: -1 };
  }
  var ow = server.getLevel('minecraft:overworld');
  var dayTime = ow && typeof ow.dayTime === 'function' ? Number(ow.dayTime()) : LHGasTick;
  if (!(dayTime >= 0)) dayTime = LHGasTick;
  var phaseLen = LH_GAS_CYCLE_TICKS / 4; // 24000 ticks
  var posInCycle = dayTime % LH_GAS_CYCLE_TICKS;
  var phaseIdx = db.forcedPhase >= 0 && db.forcedPhase <= 3 ? db.forcedPhase : Math.floor(posInCycle / phaseLen);
  var frac = db.forcedPhase >= 0 ? 0.5 : (posInCycle - phaseIdx * phaseLen) / phaseLen;
  var spec = LH_GAS_PHASES[phaseIdx] || LH_GAS_PHASES[0];
  var ceilingY = Math.round(spec.minY + (spec.maxY - spec.minY) * frac);
  var ticksLeft = db.forcedPhase >= 0 ? -1 : Math.max(0, Math.round((phaseIdx + 1) * phaseLen - posInCycle));
  return {
    phase: phaseIdx,
    key: spec.key,
    label: spec.label,
    ceilingY: ceilingY,
    ticksLeft: ticksLeft
  };
}

function lhGasStepPlayer(server, player, dtTicks, skipEffects) {
  var db = lhGasRead(server);
  var pid = lhId(player);
  if (!db.players[pid]) db.players[pid] = { exposureTicks: 0, warnedTick: -9999 };
  var rec = db.players[pid];

  if (String(player.level.dimension) !== 'minecraft:overworld') {
    rec.exposureTicks = 0;
    return { inGas: false, ceilingY: -64, exposureTicks: 0 };
  }
  var creative = (typeof player.isCreative === 'function' && player.isCreative()) ||
    (typeof player.isSpectator === 'function' && player.isSpectator());
  if (creative) {
    rec.exposureTicks = 0;
    return { inGas: false, ceilingY: -64, exposureTicks: 0 };
  }

  var st = lhGasComputeStatus(server);
  var py = Number(player.y);
  if (st.ceilingY > -60 && py < st.ceilingY) {
    rec.exposureTicks += dtTicks;
    if (!skipEffects) {
      var uname = player.username || (typeof player.getName === 'function' ? player.getName().getString() : '');
      if (uname) {
        server.runCommandSilent('execute at ' + uname + ' run particle minecraft:spore_blossom_air ~ ~1 ~ 3 1.2 3 0.01 16');
      }
      if (LHGasTick - rec.warnedTick >= 300) {
        rec.warnedTick = LHGasTick;
        player.tell('§2[Токсичный газ] Вы ниже границы газа (Y=' + Math.round(py) + ' < Y=' + st.ceilingY +
          '). Поднимайтесь на горы или летающие острова!');
      }
      if (rec.exposureTicks >= 160 && rec.exposureTicks % 40 < dtTicks) {
        var deep = st.ceilingY - py >= 20;
        if (uname) {
          server.runCommandSilent('effect give ' + uname + ' minecraft:poison 5 ' + (deep ? 1 : 0) + ' true');
          server.runCommandSilent('effect give ' + uname + ' minecraft:hunger 6 0 true');
        }
        if (deep && rec.exposureTicks % 100 < dtTicks && typeof player.attack === 'function') {
          player.attack(1.0);
        }
      }
    }
    return { inGas: true, ceilingY: st.ceilingY, exposureTicks: rec.exposureTicks };
  }

  rec.exposureTicks = Math.max(0, rec.exposureTicks - dtTicks * 2);
  return { inGas: false, ceilingY: st.ceilingY, exposureTicks: rec.exposureTicks };
}

EntityEvents.death(function (event) {
  var ent = event.entity;
  if (!ent || typeof ent.isPlayer !== 'function' || !ent.isPlayer()) return;
  if (typeof lhHardIsActive === 'function' && !lhHardIsActive(ent.server, 'voidout_explosion')) return;
  var creative = (typeof ent.isCreative === 'function' && ent.isCreative()) ||
    (typeof ent.isSpectator === 'function' && ent.isSpectator());
  if (creative) return;
  var pname = ent.username || (typeof ent.getName === 'function' ? ent.getName().getString() : 'Игрок');
  lhQueueVoidout(ent.server, ent.level.dimension, ent.x, ent.y, ent.z, pname);
});

if (typeof ExplosionEvents !== 'undefined' && ExplosionEvents.detonate) {
  ExplosionEvents.detonate(function (event) {
    if (!event.affectedEntities) return;
    try {
      var list = event.affectedEntities;
      for (var i = list.size() - 1; i >= 0; i--) {
        var e = list.get(i);
        if (e && String(e.type) === 'corpse:corpse') list.remove(i);
      }
    } catch (err) {}
  });
}

ServerEvents.tick(function (event) {
  LHGasTick++;
  var server = event.server;
  lhProcessVoidoutQueue(server, false);
  if (LHGasTick % 20 !== 0) return;

  var db = lhGasRead(server);
  var st = lhGasComputeStatus(server);
  if (st.phase !== db.lastNotifiedPhase) {
    db.lastNotifiedPhase = st.phase;
    lhGasSave(server);
    var plist0 = server.players;
    if (plist0) {
      var msg = st.phase === 0
        ? '§a[Токсичный газ] Наступил чистый сезон: воздух в низинах безопасен.'
        : '§2[Токсичный газ] Фаза: ' + st.label + ' (граница ~Y=' + st.ceilingY + '). Укрывайтесь на горах и летающих островах!';
      for (var k = 0; k < plist0.length; k++) {
        plist0[k].tell(msg);
      }
    }
  }

  var plist = server.players;
  if (!plist) return;
  for (var i = 0; i < plist.length; i++) {
    lhGasStepPlayer(server, plist[i], 20, false);
  }
  if (LHGasTick % 200 === 0) lhGasSave(server);
});

ServerEvents.commandRegistry(function (event) {
  var C = event.commands, root = C.literal('lh');
  var gas = C.literal('gas');
  gas.then(C.literal('status').executes(function (ctx) {
    var server = ctx.source.server, p = ctx.source.playerOrException;
    var st = lhGasComputeStatus(server);
    var safe = st.ceilingY <= -60 || Number(p.y) >= st.ceilingY || String(p.level.dimension) !== 'minecraft:overworld';
    var nextStr = st.ticksLeft >= 0 ? (Math.round(st.ticksLeft / 20) + ' с до смены') : 'зафиксировано оператором';
    lhMsg(p, 'Сезонный газ: ' + st.label + ' (фаза ' + st.phase + '/3), уровень Y=' + st.ceilingY +
      ', ваша высота Y=' + Math.round(p.y) + ' -> ' + (safe ? '§aБЕЗОПАСНО' : '§cОПАСНАЯ ЗОНА') + ' (' + nextStr + ').');
    return 1;
  }));
  var setPhase = C.literal('phase').requires(function (s) { return s.hasPermission(2); });
  ['0', '1', '2', '3', 'auto'].forEach(function (opt) {
    setPhase.then(C.literal(opt).executes(function (ctx) {
      var server = ctx.source.server, p = ctx.source.playerOrException;
      var db = lhGasRead(server);
      db.forcedPhase = opt === 'auto' ? -1 : parseInt(opt, 10);
      db.lastNotifiedPhase = -1;
      lhGasSave(server);
      var st = lhGasComputeStatus(server);
      lhMsg(p, 'Режим токсичного газа обновлён: ' + st.label + ' (Y=' + st.ceilingY + ').');
      return 1;
    }));
  });
  gas.then(setPhase);
  root.then(gas);

  var vo = C.literal('voidout');
  vo.then(C.literal('status').executes(function (ctx) {
    var server = ctx.source.server, p = ctx.source.playerOrException;
    var db = lhVoidoutRead(server);
    var unlocked = typeof lhHardIsActive !== 'function' || lhHardIsActive(server, 'voidout_explosion');
    var nextPwr = global.LHVoidoutMath.computePower((db.deathCount || 0) + 1);
    lhMsg(p, 'Сингулярный выброс (Voidout): ' + (unlocked ? '§cАКТИВЕН' : '§7заблокирован в Колесе Угроз') +
      ', прошлых выбросов=' + (db.deathCount || 0) + ', сила следующего взрыва=' + nextPwr.raw + ' (удваивается после каждой смерти).');
    return 1;
  }));
  root.then(vo);

  event.register(root);
});

ServerEvents.loaded(function (event) {
  lhVoidoutRead(event.server);
  lhGasRead(event.server);
});
