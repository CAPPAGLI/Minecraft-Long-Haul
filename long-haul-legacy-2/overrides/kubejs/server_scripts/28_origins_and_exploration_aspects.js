// Long Haul Legacy 2.0: Exploration & Civic Gameplay Aspects
// Tracks Underwater Travel, Underground Travel, Nether Travel, Urbanist Construction, and Pathfinder Exploration.

var LHAspectsState = null;
var LHAspectsTick = 0;
var LHAspectsPrevPos = {};

var LH_ASPECT_GOALS = {
  underwater: { label: 'Подводные экспедиции', target: 400, unit: 'м', adv: 'longhaul:aspects/underwater', rewardCr: 180 },
  underground: { label: 'Подземные магистрали', target: 700, unit: 'м', adv: 'longhaul:aspects/underground', rewardCr: 200 },
  nether: { label: 'Трассы Незера', target: 500, unit: 'м', adv: 'longhaul:aspects/nether', rewardCr: 240 },
  urbanist: { label: 'Урбанист и застройка', target: 100, unit: 'бл.', adv: 'longhaul:aspects/urbanist', rewardCr: 210 },
  pathfinder: { label: 'Первооткрыватель секторов', target: 10, unit: 'сект.', adv: 'longhaul:aspects/pathfinder', rewardCr: 260 }
};

function lhAspectsRead(server) {
  if (LHAspectsState !== null) return LHAspectsState;
  var raw = server.persistentData.getString('longhaul_aspects_v1');
  LHAspectsState = raw ? JSON.parse(String(raw)) : { players: {} };
  if (!LHAspectsState.players) LHAspectsState.players = {};
  return LHAspectsState;
}

function lhAspectsSave(server) {
  if (LHAspectsState !== null) {
    server.persistentData.putString('longhaul_aspects_v1', JSON.stringify(LHAspectsState));
  }
}

function lhAspectsProfile(server, player) {
  var db = lhAspectsRead(server);
  var pid = typeof lhId === 'function' ? lhId(player) : String(player.uuid || player.username || 'p');
  if (!db.players[pid]) {
    db.players[pid] = {
      underwater: 0,
      underground: 0,
      nether: 0,
      urbanist: 0,
      pathfinder: 0,
      visitedSectors: {},
      completed: {}
    };
  }
  return db.players[pid];
}

function lhAspectsCheckComplete(server, player, prof, key) {
  var spec = LH_ASPECT_GOALS[key];
  if (!spec || prof.completed[key]) return false;
  if (Number(prof[key] || 0) < spec.target) return false;
  prof.completed[key] = true;
  lhAspectsSave(server);
  if (typeof lhUnlock === 'function') lhUnlock(player, spec.adv);
  if (typeof lhCompanyReward === 'function') {
    lhCompanyReward(server, player, spec.rewardCr, 'route', 'road');
  }
  if (typeof lhMsg === 'function') {
    lhMsg(player, '§a§l[Аспект освоен] §f' + spec.label + ' §7(' + spec.target + ' ' + spec.unit + ')! Награда: §e' + spec.rewardCr + ' Cr§7.');
  }
  return true;
}

BlockEvents.placed(function (event) {
  var server = event.server, player = event.player, block = event.block;
  if (!server || !player || !block) return;
  var creative = (typeof player.isCreative === 'function' && player.isCreative()) ||
    (typeof player.isSpectator === 'function' && player.isSpectator());
  if (creative) return;
  if (String(block.level.dimension) !== 'minecraft:overworld') return;

  var bid = String(block.id);
  var isCivicBlock = bid.indexOf('bricks') !== -1 || bid.indexOf('concrete') !== -1 ||
    bid.indexOf('rail') !== -1 || bid.indexOf('framed') !== -1 || bid.indexOf('glass') !== -1 ||
    bid.indexOf('lantern') !== -1 || bid.indexOf('stone_brick') !== -1 || bid.indexOf('create:') === 0 ||
    bid.indexOf('planks') !== -1 || bid.indexOf('asphalt') !== -1;
  if (!isCivicBlock) return;

  var st = typeof lhOttdRead === 'function' ? lhOttdRead(server) : null;
  var comp = typeof lhGetPlayerCompany === 'function' ? lhGetPlayerCompany(server, player) : null;
  if (!st || !comp || !global.LHOpenTTD) return;
  var sc = global.LHOpenTTD.sectorCoords(block.x, block.z);
  var sec = global.LHOpenTTD.resolveSectorOwner(st, sc.sx, sc.sz);
  if (sec.kind === 'claimed' && sec.owner === comp.id) {
    var prof = lhAspectsProfile(server, player);
    var uStep = (typeof lhOriginAspectBonus === 'function') ? Number(lhOriginAspectBonus(player, 'urbanist', bid) || 1) : 1;
    prof.urbanist = Number(prof.urbanist || 0) + uStep;
    if (prof.urbanist % 25 === 0) {
      comp.cash += 15;
      if (typeof lhOttdSave === 'function') lhOttdSave(server);
    }
    lhAspectsCheckComplete(server, player, prof, 'urbanist');
    lhAspectsSave(server);
  }
});

ServerEvents.tick(function (event) {
  LHAspectsTick++;
  if (LHAspectsTick % 20 !== 0) return;
  var server = event.server;
  var plist = server.players || [];
  if (!plist.length) return;

  var dirty = false;
  for (var i = 0; i < plist.length; i++) {
    var p = plist[i];
    var pid = typeof lhId === 'function' ? lhId(p) : String(p.uuid || '');
    var dim = String(p.level.dimension);
    var px = Number(p.x), py = Number(p.y), pz = Number(p.z);
    var prev = LHAspectsPrevPos[pid];
    LHAspectsPrevPos[pid] = { dim: dim, x: px, y: py, z: pz };
    if (!prev || prev.dim !== dim) continue;

    var dx = px - prev.x, dz = pz - prev.z;
    var stepM = Math.sqrt(dx * dx + dz * dz);
    if (stepM <= 0.4 || stepM > 64) continue;

    var prof = lhAspectsProfile(server, p);
    var mInt = Math.round(stepM);

    if (dim === 'minecraft:overworld') {
      var inWater = (typeof p.isUnderWater === 'function' && p.isUnderWater()) || (typeof p.isInWater === 'function' && p.isInWater());
      if (inWater) {
        prof.underwater = Number(prof.underwater || 0) + mInt;
        lhAspectsCheckComplete(server, p, prof, 'underwater');
        dirty = true;
      }
      if (py < 32) {
        prof.underground = Number(prof.underground || 0) + mInt;
        lhAspectsCheckComplete(server, p, prof, 'underground');
        dirty = true;
      }
      if (global.LHOpenTTD) {
        var sc = global.LHOpenTTD.sectorCoords(px, pz);
        if (!prof.visitedSectors[sc.key]) {
          prof.visitedSectors[sc.key] = true;
          var pathMult = (typeof lhOriginAspectBonus === 'function') ? Number(lhOriginAspectBonus(p, 'pathfinder', '') || 1) : 1;
          prof.pathfinder = Math.round(Object.keys(prof.visitedSectors).length * pathMult);
          lhAspectsCheckComplete(server, p, prof, 'pathfinder');
          dirty = true;
        }
      }
    } else if (dim === 'minecraft:the_nether') {
      prof.nether = Number(prof.nether || 0) + mInt;
      lhAspectsCheckComplete(server, p, prof, 'nether');
      dirty = true;
    }
  }
  if (dirty && LHAspectsTick % 100 === 0) {
    lhAspectsSave(server);
  }
});

ServerEvents.commandRegistry(function (event) {
  var C = event.commands, root = C.literal('lh');
  root.then(C.literal('aspects').executes(function (ctx) {
    var server = ctx.source.server, p = ctx.source.playerOrException;
    var prof = lhAspectsProfile(server, p);
    lhMsg(p, '=== Аспекты экспедиции и урбанистики ===');
    Object.keys(LH_ASPECT_GOALS).forEach(function (k) {
      var g = LH_ASPECT_GOALS[k];
      var val = Math.min(g.target, Math.round(Number(prof[k] || 0)));
      var done = !!prof.completed[k];
      lhMsg(p, (done ? '§a✔ ' : '§e• ') + g.label + ': §f' + val + '/' + g.target + ' ' + g.unit + (done ? ' §a[ЗАВЕРШЕНО]' : ''));
    });
    return 1;
  }));
  event.register(root);
});
