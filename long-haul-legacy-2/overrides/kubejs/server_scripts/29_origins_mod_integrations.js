// Long Haul Legacy 2.0: Custom Origins (34 archetypes) mod-pack & Pehkui integrations.
// Connects OriginsAPI with Pehkui scaling, Create, OpenTTD, Farmer's Delight, Vinery/Brewin',
// MIMI, CC:Tweaked, TaCZ, DOOMED cigarettes, Hard Features, and Exploration Aspects.

var LHOriginsAPICls = null;
var LHOriginLayerKey = null;
var LHResourceLocationCls = null;
var LHResourceKeyCls = null;
try {
  LHOriginsAPICls = Java.loadClass('io.github.edwinmindcraft.origins.api.OriginsAPI');
  LHResourceLocationCls = Java.loadClass('net.minecraft.resources.ResourceLocation');
  LHResourceKeyCls = Java.loadClass('net.minecraft.resources.ResourceKey');
  var LHOriRegsCls = Java.loadClass('io.github.edwinmindcraft.origins.api.registry.OriginsDynamicRegistries');
  LHOriginLayerKey = LHResourceKeyCls.create(LHOriRegsCls.LAYERS_REGISTRY, new LHResourceLocationCls('origins', 'origin'));
} catch (eOriginsBoot) {
  LHOriginsAPICls = null;
}

var LHOriginScaleState = {};
var LHOriginTickCount = 0;

var LH_ORIGIN_PEHKUI_PROFILES = {
  dwarf: [
    'scale set pehkui:base 0.74',
    'scale set pehkui:block_reach 1.15',
    'scale persist set true'
  ],
  domovenok: [
    'scale set pehkui:base 0.65',
    'scale set pehkui:visibility 0.75',
    'scale persist set true'
  ],
  heavyweight: [
    'scale set pehkui:width 1.28',
    'scale set pehkui:height 1.03',
    'scale set pehkui:visibility 1.20',
    'scale persist set true'
  ],
  illegal_immigrant: [
    'scale set pehkui:visibility 0.72',
    'scale persist set true'
  ],
  lighthouse_keeper: [
    'scale set pehkui:block_reach 1.15',
    'scale persist set true'
  ],
  disabled_veteran: [
    'scale set pehkui:block_reach 1.25',
    'scale persist set true'
  ],
  artist: [
    'scale set pehkui:block_reach 1.25',
    'scale persist set true'
  ]
};

function lhGetPlayerOriginId(player) {
  if (!player || !LHOriginsAPICls || !LHOriginLayerKey) return '';
  try {
    var cap = player.getCapability(LHOriginsAPICls.ORIGIN_CONTAINER);
    if (!cap || !cap.isPresent()) return '';
    var container = cap.orElse(null);
    if (!container) return '';
    var key = container.getOrigin(LHOriginLayerKey);
    if (!key) return '';
    var loc = key.location();
    if (!loc) return '';
    var ns = String(loc.getNamespace());
    var path = String(loc.getPath());
    if (ns === 'origins' && path === 'empty') return '';
    return path;
  } catch (eOri) {
    return '';
  }
}

function lhPlayerHasOrigin(player, oid) {
  return lhGetPlayerOriginId(player) === oid;
}

function lhSyncOriginPehkuiScale(server, player, force) {
  if (!server || !player) return;
  if (typeof Platform !== 'undefined' && Platform.isLoaded && !Platform.isLoaded('pehkui')) return;
  var uname = player.username || (typeof player.getName === 'function' ? player.getName().getString() : '');
  if (!uname) return;
  var pid = typeof lhId === 'function' ? lhId(player) : String(player.uuid || uname);
  var oid = lhGetPlayerOriginId(player);
  if (!force && LHOriginScaleState[pid] === oid) return;

  var prev = LHOriginScaleState[pid];
  LHOriginScaleState[pid] = oid;

  if (prev && LH_ORIGIN_PEHKUI_PROFILES[prev]) {
    server.runCommandSilent('scale reset ' + uname);
  }
  var cmds = LH_ORIGIN_PEHKUI_PROFILES[oid];
  if (cmds && cmds.length) {
    if (!prev) server.runCommandSilent('scale reset ' + uname);
    for (var i = 0; i < cmds.length; i++) {
      server.runCommandSilent(cmds[i] + ' ' + uname);
    }
  }
}

function lhOriginRoutePayoutMult(player, transportHint, category) {
  var oid = lhGetPlayerOriginId(player);
  if (!oid) return 1.0;
  var mult = 1.0;
  if (oid === 'airline_pilot' && transportHint === 'air') mult += 0.30;
  else if (oid === 'sailor' && transportHint === 'water') mult += 0.30;
  else if (oid === 'biker' && transportHint === 'road') mult += 0.25;
  if ((oid === 'office_clerk' || oid === 'political_emigre') && (category === 'contract' || category === 'route')) {
    mult += 0.15;
  }
  if (oid === 'programmer' && category === 'cc') mult += 0.30;
  return mult;
}

function lhOriginFeeMult(player) {
  var oid = lhGetPlayerOriginId(player);
  if (oid === 'ex_convict' || oid === 'turbo_patriot') return 1.25;
  if (oid === 'skinhead') return 1.20;
  return 1.0;
}

function lhOriginRaidLootMult(player) {
  var oid = lhGetPlayerOriginId(player);
  return oid === 'bandit' ? 1.25 : 1.0;
}

function lhOriginAspectBonus(player, aspectKey, blockId) {
  var oid = lhGetPlayerOriginId(player);
  if (aspectKey === 'urbanist' && oid === 'artist') {
    var s = String(blockId || '');
    if (s.indexOf('framedblocks:') === 0 || s.indexOf('chipped:') === 0 ||
        s.indexOf('supplementaries:') === 0 || s.indexOf('concrete') !== -1 ||
        s.indexOf('terracotta') !== -1 || s.indexOf('bricks') !== -1) {
      return 2;
    }
  }
  if (aspectKey === 'pathfinder' && oid === 'vagabond') return 1.25;
  return 1;
}

function lhHasCreateNearby(level, px, py, pz) {
  if (!level) return false;
  try {
    for (var dx = -2; dx <= 2; dx += 2) {
      for (var dy = -1; dy <= 1; dy++) {
        for (var dz = -2; dz <= 2; dz += 2) {
          var b = level.getBlock(px + dx, py + dy, pz + dz);
          if (b && String(b.id).indexOf('create:') === 0) return true;
        }
      }
    }
  } catch (eCr) {}
  return false;
}

if (typeof PlayerEvents !== 'undefined') {
  PlayerEvents.loggedIn(function (event) {
    lhSyncOriginPehkuiScale(event.server, event.player, true);
  });
  if (PlayerEvents.respawned) {
    PlayerEvents.respawned(function (event) {
      lhSyncOriginPehkuiScale(event.server, event.player, true);
    });
  }
}

if (typeof ItemEvents !== 'undefined' && ItemEvents.foodEaten) {
  ItemEvents.foodEaten(function (event) {
    var player = event.player;
    var item = event.item;
    if (!player || !item) return;
    var oid = lhGetPlayerOriginId(player);
    var sid = String(item.id || '');
    var uname = player.username || (typeof player.getName === 'function' ? player.getName().getString() : '');

    if (oid === 'cook' && sid.indexOf('farmersdelight:') === 0) {
      try { player.heal(2.0); } catch (eHeal) {}
    } else if (oid === 'alcoholic' && (sid.indexOf('vinery:') === 0 || sid.indexOf('brewinandchewin:') === 0)) {
      if (uname && player.server) {
        player.server.runCommandSilent('effect give ' + uname + ' minecraft:strength 20 0 true');
        player.server.runCommandSilent('effect give ' + uname + ' minecraft:resistance 20 0 true');
        player.server.runCommandSilent('effect clear ' + uname + ' minecraft:mining_fatigue');
      }
    } else if (oid === 'addict' && (sid === 'minecraft:sugar' || sid.indexOf('herbalbrews:') === 0 || sid.indexOf('potion') !== -1)) {
      if (uname && player.server) {
        player.server.runCommandSilent('effect give ' + uname + ' minecraft:speed 8 1 true');
        player.server.runCommandSilent('effect give ' + uname + ' minecraft:absorption 10 0 true');
      }
    }
  });
}

if (typeof ItemEvents !== 'undefined' && ItemEvents.rightClicked) {
  ItemEvents.rightClicked(function (event) {
    var player = event.player;
    var item = event.item;
    if (!player || !item || !player.server) return;
    var oid = lhGetPlayerOriginId(player);
    var sid = String(item.id || '');
    var uname = player.username || (typeof player.getName === 'function' ? player.getName().getString() : '');
    if (!uname) return;

    if (oid === 'addict' && (sid === 'doomedmatu:cigarette' || sid === 'doomedmatu:cigarette_pack' || sid === 'minecraft:sugar')) {
      player.server.runCommandSilent('effect give ' + uname + ' minecraft:speed 8 1 true');
      player.server.runCommandSilent('effect give ' + uname + ' minecraft:absorption 10 0 true');
    } else if (oid === 'alcoholic' && (sid.indexOf('vinery:') === 0 || sid.indexOf('brewinandchewin:') === 0)) {
      player.server.runCommandSilent('effect give ' + uname + ' minecraft:strength 20 0 true');
      player.server.runCommandSilent('effect give ' + uname + ' minecraft:resistance 20 0 true');
    }
  });
}

ServerEvents.tick(function (event) {
  LHOriginTickCount++;
  if (LHOriginTickCount % 40 !== 0) return;
  var server = event.server;
  var plist = server ? server.players : null;
  if (!plist || !plist.length) return;

  for (var i = 0; i < plist.length; i++) {
    var p = plist[i];
    if (!p) continue;
    lhSyncOriginPehkuiScale(server, p, false);

    var creative = (typeof p.isCreative === 'function' && p.isCreative()) ||
      (typeof p.isSpectator === 'function' && p.isSpectator());
    if (creative) continue;

    var oid = lhGetPlayerOriginId(p);
    if (!oid) continue;
    var uname = p.username || (typeof p.getName === 'function' ? p.getName().getString() : '');
    if (!uname) continue;

    var px = Math.floor(Number(p.x));
    var py = Math.floor(Number(p.y));
    var pz = Math.floor(Number(p.z));
    var heldId = p.mainHandItem && !p.mainHandItem.empty ? String(p.mainHandItem.id) : '';
    var offId = p.offHandItem && !p.offHandItem.empty ? String(p.offHandItem.id) : '';

    if (oid === 'factory_worker') {
      if (heldId === 'create:wrench' || offId === 'create:wrench' || lhHasCreateNearby(p.level, px, py, pz)) {
        server.runCommandSilent('effect give ' + uname + ' minecraft:haste 4 0 true');
      }
    } else if (oid === 'musician') {
      var playingInstrument = heldId.indexOf('mimi:') === 0 || offId.indexOf('mimi:') === 0 || heldId === 'minecraft:note_block';
      if (playingInstrument) {
        for (var j = 0; j < plist.length; j++) {
          var ally = plist[j];
          if (!ally || String(ally.level.dimension) !== String(p.level.dimension)) continue;
          var dSq = Math.pow(Number(ally.x) - px, 2) + Math.pow(Number(ally.y) - py, 2) + Math.pow(Number(ally.z) - pz, 2);
          if (dSq <= 144) {
            var aName = ally.username || (typeof ally.getName === 'function' ? ally.getName().getString() : '');
            if (aName) {
              server.runCommandSilent('effect give ' + aName + ' minecraft:regeneration 4 0 true');
              server.runCommandSilent('effect give ' + aName + ' minecraft:speed 4 0 true');
            }
          }
        }
      }
    } else if (oid === 'bandit') {
      if (heldId.indexOf('tacz:') === 0 || heldId === 'minecraft:crossbow') {
        server.runCommandSilent('effect give ' + uname + ' minecraft:speed 4 0 true');
      }
    } else if (oid === 'gamekeeper') {
      try {
        var bName = String(p.level.getBiome(p.blockPosition()).unwrapKey().get().location());
        if (bName.indexOf('forest') !== -1 || bName.indexOf('taiga') !== -1 || bName.indexOf('grove') !== -1) {
          server.runCommandSilent('effect give ' + uname + ' minecraft:speed 4 0 true');
        }
      } catch (eBio) {}
    } else if (oid === 'hermit') {
      var nearestDistSq = 999999;
      for (var k = 0; k < plist.length; k++) {
        if (k === i) continue;
        var other = plist[k];
        if (!other || String(other.level.dimension) !== String(p.level.dimension)) continue;
        var dist2 = Math.pow(Number(other.x) - px, 2) + Math.pow(Number(other.z) - pz, 2);
        if (dist2 < nearestDistSq) nearestDistSq = dist2;
      }
      if (nearestDistSq > 48 * 48) {
        server.runCommandSilent('effect give ' + uname + ' minecraft:regeneration 4 0 true');
      } else if (nearestDistSq <= 16 * 16) {
        server.runCommandSilent('effect give ' + uname + ' minecraft:weakness 4 0 true');
      }
    } else if (oid === 'hikikomori_nerd') {
      try {
        var tod = Number(p.level.dayTime()) % 24000;
        var posN = new (Java.loadClass('net.minecraft.core.BlockPos'))(px, py + 1, pz);
        if (tod < 12500 && p.level.canSeeSky(posN)) {
          server.runCommandSilent('effect give ' + uname + ' minecraft:weakness 4 0 true');
        }
      } catch (eNerd) {}
    } else if (oid === 'war_veteran') {
      try {
        if (p.level.isThundering() && LHOriginTickCount % 160 === 0 && Math.random() < 0.35) {
          server.runCommandSilent('effect give ' + uname + ' minecraft:darkness 3 0 true');
        }
      } catch (eVet) {}
    }
  }
});
