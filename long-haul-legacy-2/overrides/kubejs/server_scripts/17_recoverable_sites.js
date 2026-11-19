// Long Haul Legacy 2.0: 6 recoverable industrial facilities placed deterministically inside +/-84000.
// Restoration requires physical proximity, required installed machinery blocks, and barrel material consumption.
var LHRecPos = Java.loadClass('net.minecraft.core.BlockPos');
var LHRecState = null;

function lhRecSpec(recId) {
  for (var i = 0; i < global.LHRecoveryCatalog.length; i++) {
    if (global.LHRecoveryCatalog[i].id === recId) return global.LHRecoveryCatalog[i];
  }
  return null;
}

function lhRecRead(server) {
  if (LHRecState !== null) return LHRecState;
  var raw = server.persistentData.getString('longhaul_recovery_v1');
  if (raw) {
    LHRecState = JSON.parse(String(raw));
  } else {
    var sitesDb = lhSitesRead(server);
    var seed = sitesDb.seed || '20261115';
    LHRecState = { seed: seed, items: global.LHRecoveryPlanner.planRecoveries(seed, sitesDb.sites) };
    server.persistentData.putString('longhaul_recovery_v1', JSON.stringify(LHRecState));
  }
  return LHRecState;
}

function lhRecSave(server) {
  if (LHRecState !== null) {
    server.persistentData.putString('longhaul_recovery_v1', JSON.stringify(LHRecState));
  }
}

function lhRecHasMachinery(level, cx, cy, cz, allowedIds) {
  var found = null;
  for (var dx = -12; dx <= 12; dx++) {
    for (var dy = -5; dy <= 5; dy++) {
      for (var dz = -12; dz <= 12; dz++) {
        var pos = new LHRecPos(cx + dx, cy + dy, cz + dz);
        if (!level.hasChunkAt(pos)) continue;
        var bid = String(level.getBlock(pos.x, pos.y, pos.z).id);
        for (var k = 0; k < allowedIds.length; k++) {
          if (bid === allowedIds[k]) {
            found = bid + ' [' + pos.x + ',' + pos.y + ',' + pos.z + ']';
            return found;
          }
        }
      }
    }
  }
  return null;
}

function lhRecSurvey(server, player, recId) {
  var db = lhRecRead(server), rec = db.items[recId], spec = lhRecSpec(recId);
  if (!rec || !spec) { lhMsg(player, 'Неизвестный объект восстановления: ' + recId); return 0; }
  if (String(player.level.dimension) !== 'minecraft:overworld') { lhMsg(player, 'Обследование возможно только в обычном мире.'); return 0; }
  var d = Math.round(global.LHWorldPlanner.dist2D(player.x, player.z, rec.x, rec.z));
  if (d > 128) {
    lhMsg(player, 'До объекта "' + rec.name + '" ~' + d + ' м (' + lhBearing(rec.x - player.x, rec.z - player.z) + '), требуется <= 128 м.');
    return 0;
  }
  rec.surveyed = true;
  lhRecSave(server);
  lhMsg(player, 'Объект "' + rec.name + '" обследован на [' + rec.x + ', ' + rec.z + ']. ' + spec.summary);
  lhMsg(player, 'Материалы ремонта: ' + JSON.stringify(spec.repairInputs) + '; требуемые узлы (в радиусе 12 м): ' + spec.requiredMachinery.join(', '));
  return 1;
}

function lhRecRestore(server, player, recId) {
  var db = lhRecRead(server), rec = db.items[recId], spec = lhRecSpec(recId);
  if (!rec || !spec) { lhMsg(player, 'Неизвестный объект восстановления: ' + recId); return 0; }
  if (String(player.level.dimension) !== 'minecraft:overworld') { lhMsg(player, 'Восстановление возможно только в обычном мире.'); return 0; }
  var d = global.LHWorldPlanner.dist2D(player.x, player.z, rec.x, rec.z);
  if (d > 144) {
    lhMsg(player, 'Слишком далеко от "' + rec.name + '" (~' + Math.round(d) + ' м), требуется <= 144 м.');
    return 0;
  }
  if (rec.restored) {
    lhMsg(player, 'Объект "' + rec.name + '" уже восстановлен (повторная награда не выдаётся).');
    return 1;
  }
  var depotPos = { dim: 'minecraft:overworld', x: Math.floor(player.x), y: Math.floor(player.y) - 1, z: Math.floor(player.z) };
  var block = lhLoadedBlock(server, depotPos);
  if (!block || block.id !== 'minecraft:barrel') {
    lhMsg(player, 'Встаньте НА ремонтную бочку объекта и повторите /lh recovery restore ' + recId);
    return 0;
  }
  var mach = lhRecHasMachinery(player.level, depotPos.x, depotPos.y, depotPos.z, spec.requiredMachinery);
  if (!mach) {
    lhMsg(player, 'В радиусе 12 м от бочки не найден ни один требуемый узел: ' + spec.requiredMachinery.join(', '));
    return 0;
  }
  var res = lhConsumeFromInventory(block.inventory, spec.repairInputs);
  if (!res.ok) {
    lhMsg(player, 'В ремонтной бочке не хватает ' + res.missing + ' (нужно ' + res.need + ', есть ' + res.have + ').');
    return 0;
  }
  rec.surveyed = true;
  rec.restored = true;
  rec.depot = depotPos;
  rec.machineryFound = mach;
  lhRecSave(server);
  lhUnlock(player, 'longhaul:recovery/' + recId);
  lhMsg(player, 'Объект "' + rec.name + '" восстановлен! Зафиксирован узел: ' + mach);
  return 1;
}

ServerEvents.commandRegistry(function (event) {
  var C = event.commands, root = C.literal('lh');
  var recCmd = C.literal('recovery');
  recCmd.then(C.literal('list').executes(function (ctx) {
    var server = ctx.source.server, player = ctx.source.playerOrException, db = lhRecRead(server);
    lhMsg(player, '=== Восстанавливаемые промышленные объекты (6) ===');
    global.LHRecoveryCatalog.forEach(function (spec) {
      var r = db.items[spec.id];
      var d = Math.round(global.LHWorldPlanner.dist2D(player.x, player.z, r.x, r.z));
      var st = r.restored ? 'ВОССТАНОВЛЕН' : (r.surveyed ? 'ОБСЛЕДОВАН' : 'ПОВРЕЖДЁН');
      var loc = (r.surveyed || r.restored) ? ('[' + r.x + ', ' + r.z + ']') : ('направление ' + lhBearing(r.x - player.x, r.z - player.z));
      lhMsg(player, '- ' + spec.id + ' (' + spec.name + '): ' + st + ', ~' + d + ' м, ' + loc);
    });
    return 1;
  }));

  var info = C.literal('info'), survey = C.literal('survey'), restore = C.literal('restore');
  global.LHRecoveryCatalog.forEach(function (spec) {
    info.then(C.literal(spec.id).executes(function (ctx) {
      var r = lhRecRead(ctx.source.server).items[spec.id], p = ctx.source.playerOrException;
      var d = Math.round(global.LHWorldPlanner.dist2D(p.x, p.z, r.x, r.z));
      lhMsg(p, spec.name + ' (' + spec.id + ', узел ' + spec.parentSite + '): ~' + d + ' м. ' + spec.summary);
      lhMsg(p, 'Материалы: ' + JSON.stringify(spec.repairInputs) + '; механизмы: ' + spec.requiredMachinery.join(', '));
      return 1;
    }));
    survey.then(C.literal(spec.id).executes(function (ctx) {
      return lhRecSurvey(ctx.source.server, ctx.source.playerOrException, spec.id);
    }));
    restore.then(C.literal(spec.id).executes(function (ctx) {
      return lhRecRestore(ctx.source.server, ctx.source.playerOrException, spec.id);
    }));
  });
  recCmd.then(info);
  recCmd.then(survey);
  recCmd.then(restore);
  root.then(recCmd);
  event.register(root);
});

ServerEvents.loaded(function (event) {
  var db = lhRecRead(event.server);
  console.info('[LH] Planned ' + Object.keys(db.items).length + ' recoverable industrial sites inside +/-84000.');
});
