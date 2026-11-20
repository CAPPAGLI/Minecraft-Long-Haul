// Long Haul Legacy 2.0: 1-Hz server-side transport & odometer telemetry (anti-teleport capped).
var LHTelemetryState = null;

function lhTelemetryRead(server) {
  if (LHTelemetryState !== null) return LHTelemetryState;
  var raw = server.persistentData.getString('longhaul_telemetry_v1');
  LHTelemetryState = raw ? JSON.parse(String(raw)) : { players: {} };
  if (!LHTelemetryState.players) LHTelemetryState.players = {};
  return LHTelemetryState;
}

function lhTelemetrySave(server) {
  if (LHTelemetryState !== null) {
    server.persistentData.putString('longhaul_telemetry_v1', JSON.stringify(LHTelemetryState));
  }
}

function lhClassifyVehicle(vehicle) {
  if (!vehicle) return 'foot';
  var id = String(vehicle.type || vehicle.id || '');
  if (id.indexOf('contraption') !== -1 || id.indexOf('minecart') !== -1 || id.indexOf('railways:') !== -1 || id.indexOf('railcraft') !== -1) {
    return 'rail';
  }
  if (id.indexOf('automobility:') !== -1 || id.indexOf('car:') !== -1) {
    return 'road_vehicle';
  }
  if (id.indexOf('astikorcarts:') !== -1) {
    return 'cart';
  }
  if (id.indexOf('boat') !== -1 || id.indexOf('littlelogistics:') !== -1 || id.indexOf('smallships:') !== -1) {
    return 'watercraft';
  }
  if (id.indexOf('clockwork:') !== -1 || id.indexOf('vs_eureka:') !== -1 || id.indexOf('valkyrienskies:') !== -1 ||
      id.indexOf('immersive_aircraft:') !== -1 || id.indexOf('man_of_many_planes:') !== -1) {
    return 'aircraft_vs';
  }
  if (id.indexOf('horse') !== -1 || id.indexOf('donkey') !== -1 || id.indexOf('mule') !== -1 || id.indexOf('camel') !== -1) {
    return 'mount';
  }
  return 'other_vehicle';
}

function lhTelemetrySample(server, player) {
  var db = lhTelemetryRead(server), pid = lhId(player);
  if (!db.players[pid]) {
    db.players[pid] = { last: null, meters: {}, seconds: {}, rejectedJumps: 0 };
  }
  var rec = db.players[pid];
  var dim = String(player.level.dimension);
  var nowTick = Number(server.tickCount);
  var px = Number(player.x), pz = Number(player.z);
  var fam = lhClassifyVehicle(player.vehicle);

  if (rec.last && rec.last.dim === dim && nowTick >= rec.last.tick) {
    var elapsedSec = (nowTick - rec.last.tick) / 20.0;
    var dtSec = Math.round(elapsedSec);
    var dist = global.LHWorldPlanner.dist2D(rec.last.x, rec.last.z, px, pz);
    var maxAllowed = Math.max(96, elapsedSec * 96);
    // Reject teleportation / warp jumps (> 96 m/s or > 180 m in single sample)
    if (dist > 180 || dist > maxAllowed) {
      rec.rejectedJumps = (rec.rejectedJumps || 0) + 1;
    } else {
      var rounded = Math.round(dist);
      rec.meters[fam] = (rec.meters[fam] || 0) + rounded;
      if (dtSec > 0) rec.seconds[fam] = (rec.seconds[fam] || 0) + dtSec;
    }
  }
  rec.last = { dim: dim, x: px, z: pz, tick: nowTick };
  return rec;
}

ServerEvents.tick(function (event) {
  var server = event.server;
  if (Number(server.tickCount) % 20 !== 0) return;
  var plist = server.players;
  if (!plist) return;
  for (var i = 0; i < plist.length; i++) {
    lhTelemetrySample(server, plist[i]);
  }
  if (Number(server.tickCount) % 200 === 0) {
    lhTelemetrySave(server);
  }
});

ServerEvents.commandRegistry(function (event) {
  var C = event.commands, root = C.literal('lh');
  var veh = C.literal('vehicle');
  veh.then(C.literal('status').executes(function (ctx) {
    var server = ctx.source.server, p = ctx.source.playerOrException;
    var rec = lhTelemetrySample(server, p);
    lhTelemetrySave(server);
    lhMsg(p, 'Телеметрия транспорта (метры): ' + JSON.stringify(rec.meters) + ' | сек: ' + JSON.stringify(rec.seconds) + ' | отклонённые скачки: ' + (rec.rejectedJumps || 0));
    return 1;
  }));
  root.then(veh);
  event.register(root);
});

ServerEvents.loaded(function (event) {
  lhTelemetryRead(event.server);
});
