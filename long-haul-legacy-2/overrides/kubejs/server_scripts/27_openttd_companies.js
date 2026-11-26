// Long Haul Legacy 2.0: OpenTTD Companies, Specializations, Full-Map Voronoi+Claim Partition,
// Inter-Company Trading & Consortium Market, and AI Bot Companies.
var LHOTTDStringArg = Java.loadClass('com.mojang.brigadier.arguments.StringArgumentType');
var LHOTTDState = null;
var LHOTTDTick = 0;
var LHOTTDLastSectorByPlayer = {};
var LHOTTDLastViolationByPlayer = {};
var LHOTTDLastBreakWarnByPlayer = {};
var LHOTTDTrespassWarn = {};
var LHOTTDMiningWarn = {};
var LHOTTDPatrolNotifyCooldown = {};
var LHOTTDPatrolGuardCooldown = {};
var LHOTTDLastGatherAlertByPlayer = {};

var LH_HEX_BY_COLOR = {
  gold: '#FFAA00',
  aqua: '#55FFFF',
  green: '#55FF55',
  light_purple: '#FF55FF',
  blue: '#5555FF',
  red: '#FF5555',
  yellow: '#FFFF55',
  dark_aqua: '#00AAAA',
  white: '#FFFFFF'
};

function lhCompanyHexColor(st, ownerId, isClaimed) {
  if (!ownerId || !st.companies[ownerId]) return '#30343C';
  var base = LH_HEX_BY_COLOR[st.companies[ownerId].color] || '#888888';
  return isClaimed ? base : (base + '55');
}

function lhOttdRead(server) {
  if (LHOTTDState !== null) return LHOTTDState;
  var raw = server.persistentData.getString('longhaul_openttd_v1');
  LHOTTDState = raw ? JSON.parse(String(raw)) : global.LHOpenTTD.createInitialState();
  global.LHOpenTTD.ensureBots(LHOTTDState);
  if (!LHOTTDState.minimapPrefs) LHOTTDState.minimapPrefs = {};
  if (!LHOTTDState.marketOrders || !LHOTTDState.marketOrders.length) {
    global.LHOpenTTD.refreshBotOrders(LHOTTDState);
  }
  return LHOTTDState;
}

var LHXaeroLastDigest = '';

function lhOttdSave(server) {
  if (LHOTTDState !== null) {
    server.persistentData.putString('longhaul_openttd_v1', JSON.stringify(LHOTTDState));
    try {
      var digest = Object.keys(LHOTTDState.claims || {}).length + ':' +
        Object.keys(LHOTTDState.buildings || {}).length + ':' +
        Object.keys(LHOTTDState.companies || {}).length + ':' +
        Object.keys(LHOTTDState.diplomacy || {}).length;
      if (LHXaeroLastDigest && digest !== LHXaeroLastDigest && server.players && server.players.length > 0) {
        LHXaeroLastDigest = digest;
        lhSyncXaeroTerritories(server, null);
      } else if (!LHXaeroLastDigest) {
        LHXaeroLastDigest = digest;
      }
    } catch (eDig) {}
  }
}

var LHEconState = null;

function lhEconRead(server) {
  if (LHEconState !== null) {
    if (global.LHEconomyEngine) global.LHEconomyEngine.ensureEconomyState(LHEconState);
    return LHEconState;
  }
  var raw = server.persistentData.getString('longhaul_economy_v1');
  LHEconState = raw
    ? JSON.parse(String(raw))
    : (global.LHEconomyEngine ? global.LHEconomyEngine.createInitialEconomyState() : { items: {}, adminOverrides: {}, recipePrices: {}, listings: [], pickupOrders: [] });
  if (global.LHEconomyEngine) global.LHEconomyEngine.ensureEconomyState(LHEconState);
  return LHEconState;
}

function lhEconSave(server) {
  if (LHEconState !== null) {
    var persist = {
      items: LHEconState.items || {},
      adminOverrides: LHEconState.adminOverrides || {},
      recipePrices: {},
      listings: LHEconState.listings || [],
      pickupOrders: LHEconState.pickupOrders || [],
      nextListingSeq: LHEconState.nextListingSeq || 1,
      nextPickupSeq: LHEconState.nextPickupSeq || 1,
      traderSeed: LHEconState.traderSeed || 1,
      totalCrashes: LHEconState.totalCrashes || 0
    };
    var encoded = JSON.stringify(persist);
    if (encoded.length > 52000) {
      var trimmedItems = {};
      Object.keys(persist.items).forEach(function (k) {
        var it = persist.items[k];
        if (it && (it.demand > 0 || it.supply > 0 || it.crashTicks > 0)) {
          trimmedItems[k] = it;
        }
      });
      persist.items = trimmedItems;
      encoded = JSON.stringify(persist);
    }
    server.persistentData.putString('longhaul_economy_v1', encoded);
  }
}

var LHLastRecipeGraphDebug = { seen: 0, hasOut: 0, hasIngs: 0, edges: 0, firstErr: '', sample: '' };

function lhRefreshRecipeEconomyGraph(server) {
  if (!server || !global.LHEconomyEngine) return 0;
  var econ = lhEconRead(server);
  var edges = [];
  var firstErr = '';
  var seen = 0, hasOut = 0, hasIngs = 0, sample = '';
  try {
    var rm = server.recipeManager;
    var regAccess = server.registryAccess();
    if (rm && regAccess) {
      var iter = rm.getRecipes().iterator();
      while (iter.hasNext() && seen < 25000) {
        seen++;
        try {
          var rec = iter.next();
          var resStack = rec.getResultItem(regAccess);
          if (!resStack) continue;
          var outId = String(resStack.id || '');
          if ((!outId || outId === 'undefined') && typeof Item !== 'undefined') {
            try { outId = String(Item.of(resStack).id || ''); } catch (eIt) {}
          }
          if (!outId || outId === 'undefined' || outId === 'minecraft:air') continue;
          hasOut++;
          var outCount = Math.max(1, Number(resStack.count || 1));
          var parsedIngs = [];
          var ings = rec.getIngredients();
          if (ings && ings.size() > 0) {
            hasIngs++;
            for (var ii = 0; ii < ings.size(); ii++) {
              var ing = ings.get(ii);
              if (!ing) continue;
              var ingId = '';
              try {
                var fst = ing.first;
                if (fst) ingId = String(fst.id || '');
              } catch (eFst) {}
              if (!ingId || ingId === 'undefined' || ingId === 'minecraft:air') {
                try {
                  var ids = ing.itemIds;
                  if (ids && ids.iterator) {
                    var idIt = ids.iterator();
                    if (idIt.hasNext()) ingId = String(idIt.next() || '');
                  }
                } catch (eIds) {}
              }
              if (!ingId || ingId === 'undefined' || ingId === 'minecraft:air') {
                try {
                  var items = typeof ing.getItems === 'function' ? ing.getItems() : ing.items;
                  if (items && items.length > 0 && items[0]) {
                    ingId = String(items[0].id || '');
                  }
                } catch (eArr) {}
              }
              if (!sample && seen <= 50) {
                try {
                  sample = 'out=' + outId + ',ingClass=' + ing.getClass().getSimpleName() + ',first=' + ing.first + ',ingId=' + ingId;
                } catch (eSmp) {}
              }
              if (ingId && ingId !== 'undefined' && ingId !== 'minecraft:air') {
                parsedIngs.push({ id: ingId, count: 1 });
              }
            }
          }
          if (parsedIngs.length > 0) {
            edges.push({ outId: outId, outCount: outCount, ingredients: parsedIngs });
          }
        } catch (eRecOne) {
          if (!firstErr) firstErr = String(eRecOne);
        }
      }
    } else {
      firstErr = 'missing rm=' + !!rm + ' regAccess=' + !!regAccess;
    }
  } catch (eRm) {
    if (!firstErr) firstErr = 'outer: ' + eRm;
    console.warn('[LH] Recipe economy graph error: ' + eRm);
  }
  LHLastRecipeGraphDebug = { seen: seen, hasOut: hasOut, hasIngs: hasIngs, edges: edges.length, firstErr: firstErr, sample: sample };
  global.LHEconomyEngine.propagateRecipePrices(econ, edges, 3);
  lhEconSave(server);
  console.info('[LH] Economy recipe graph propagated: seen=' + seen + ', hasOut=' + hasOut + ', hasIngs=' + hasIngs + ', edges=' + edges.length + ', priced=' + Object.keys(econ.recipePrices || {}).length + (firstErr ? (', firstErr=' + firstErr) : ''));
  return edges.length;
}

function lhSpawnBotOnBorderExpansion(server, borderInfo, announce) {
  if (!server || !global.LHOpenTTD || typeof global.LHOpenTTD.spawnDynamicBotCompany !== 'function') return null;
  var st = lhOttdRead(server);
  var maxSectorAbs = Math.max(3, Math.floor(((borderInfo ? borderInfo.size : 724) / 2 - 48) / 256));
  var res = global.LHOpenTTD.spawnDynamicBotCompany(st, maxSectorAbs);
  if (!res || !res.ok) return null;
  lhOttdSave(server);
  if (announce) {
    var msg = 'На новых землях вышла на рынок новая корпорация ' + res.bot.colorCode + res.bot.name +
      ' §f(штаб в секторе ' + res.sx + ',' + res.sz + ')!';
    if (typeof lhLogEvent === 'function') {
      lhLogEvent(server, 'company', msg, { chatMode: 'important' });
    } else if (server.players) {
      for (var i = 0; i < server.players.length; i++) {
        server.players[i].tell('§6§l[Новый конкурент] §f' + msg);
      }
    }
  }
  return res.bot;
}

function lhAutoCreateCompanyAtSpawn(server, player, wx, wz) {
  if (!server || !player || !global.LHOpenTTD) return null;
  var st = lhOttdRead(server);
  var pid = lhId(player);
  if (st.playerCompany && st.playerCompany[pid] && st.companies[st.playerCompany[pid]]) {
    return st.companies[st.playerCompany[pid]];
  }
  var uname = player.username || (typeof player.getName === 'function' ? player.getName().getString() : 'corp');
  var rawId = String(uname).toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 12) || 'corp';
  if (rawId.indexOf('bot_') === 0) rawId = 'p_' + rawId;
  var candId = rawId;
  var suffix = 1;
  while (st.companies[candId]) {
    suffix++;
    candId = rawId.slice(0, 9) + '_' + suffix;
  }
  var dispName = uname + ' Corp';
  var res = global.LHOpenTTD.companyCreate(st, pid, candId, dispName, wx, wz);
  if (res && res.ok) {
    lhOttdSave(server);
    lhUnlock(player, 'longhaul:openttd/company');
    if (typeof lhTeamJoin === 'function') lhTeamJoin(server, player, res.company.id);
    return res.company;
  }
  return null;
}

function lhBuildingContainsBlock(bldg, bx, by, bz) {
  if (!bldg) return false;
  var span = Number(bldg.halfSpan || 3);
  var x0 = Number(bldg.x || 0), y0 = Number(bldg.y || 64), z0 = Number(bldg.z || 0);
  return Math.abs(bx - x0) <= span && Math.abs(bz - z0) <= span && by >= (y0 - 1) && by <= (y0 + 5);
}

var LHLogiState = null;

function lhLogisticsRead(server) {
  if (LHLogiState !== null) {
    if (global.LHTradeLogistics) global.LHTradeLogistics.ensureState(LHLogiState);
    return LHLogiState;
  }
  var raw = server.persistentData.getString('longhaul_logistics_v1');
  LHLogiState = raw
    ? JSON.parse(String(raw))
    : (global.LHTradeLogistics ? global.LHTradeLogistics.createState() : { passes: {}, deliveries: [], haggles: {}, p2pSessions: {} });
  if (global.LHTradeLogistics) global.LHTradeLogistics.ensureState(LHLogiState);
  return LHLogiState;
}

function lhLogisticsSave(server) {
  if (LHLogiState !== null) {
    server.persistentData.putString('longhaul_logistics_v1', JSON.stringify(LHLogiState));
  }
}

function lhGetCompanyTerminalBlockPos(server, st, cid) {
  if (!st || !st.companies || !st.companies[cid]) return null;
  var comp = st.companies[cid];
  if (comp.terminalPos && typeof comp.terminalPos.x === 'number') {
    return { x: Math.round(comp.terminalPos.x), y: Math.round(comp.terminalPos.y), z: Math.round(comp.terminalPos.z) };
  }
  return global.LHOpenTTD.getCompanyTerminalCoords(st, cid);
}

function lhEnsureBarrelAt(level, x, y, z) {
  if (!level) return false;
  try {
    var pos = new LHPos(x, y, z);
    if (!level.hasChunkAt(pos)) return false;
    var blk = level.getBlock(x, y, z);
    if (!blk || String(blk.id) !== 'minecraft:barrel') {
      level.getBlock(x, y, z).set('minecraft:barrel');
    }
    return true;
  } catch (eB) {
    return false;
  }
}

function lhPlaceSpecializedStructure(ow, bx, by, bz, envType, category) {
  if (!ow) return false;
  var wallMat = category === 'extraction' ? 'minecraft:stone_bricks'
    : (category === 'logistics' ? 'minecraft:bricks' : 'minecraft:deepslate_bricks');
  var trimMat = category === 'production' ? 'minecraft:iron_block' : 'minecraft:oak_planks';

  if (envType === 'air') {
    for (var ax = -3; ax <= 3; ax++) {
      for (var az = -3; az <= 3; az++) {
        var aEdge = Math.abs(ax) === 3 || Math.abs(az) === 3;
        ow.getBlock(bx + ax, by - 1, bz + az).set(aEdge ? 'minecraft:iron_block' : 'minecraft:stone_bricks');
        for (var ay = 0; ay <= 3; ay++) {
          if (ay === 0 && ((ax === 0 && az === 0) || (ax === 1 && az === 0))) continue; // preserve existing barrels
          if (ay === 3 && Math.abs(ax) <= 2 && Math.abs(az) <= 2) {
            ow.getBlock(bx + ax, by + ay, bz + az).set((Math.abs(ax) === 2 || Math.abs(az) === 2) ? 'minecraft:iron_block' : 'minecraft:glass');
          } else if (aEdge && ay === 0 && !(ax === 0 || az === 0)) {
            ow.getBlock(bx + ax, by + ay, bz + az).set('minecraft:iron_bars');
          } else {
            ow.getBlock(bx + ax, by + ay, bz + az).set('minecraft:air');
          }
        }
      }
    }
    lhEnsureBarrelAt(ow, bx, by, bz);
    lhEnsureBarrelAt(ow, bx + 1, by, bz);
    ow.getBlock(bx + 2, by + 1, bz + 2).set('minecraft:lantern');
    ow.getBlock(bx - 2, by + 1, bz - 2).set('minecraft:lantern');
    return true;
  }

  if (envType === 'sea') {
    for (var sx = -3; sx <= 3; sx++) {
      for (var sz = -3; sz <= 3; sz++) {
        var isCorner = Math.abs(sx) === 3 && Math.abs(sz) === 3;
        if (isCorner) {
          for (var py = by - 14; py < by - 1; py++) {
            ow.getBlock(bx + sx, py, bz + sz).set('minecraft:deepslate_bricks');
          }
        }
        var sEdge = Math.abs(sx) === 3 || Math.abs(sz) === 3;
        ow.getBlock(bx + sx, by - 1, bz + sz).set(sEdge ? 'minecraft:iron_block' : 'minecraft:oak_planks');
        for (var sy = 0; sy <= 3; sy++) {
          if (sy === 0 && ((sx === 0 && sz === 0) || (sx === 1 && sz === 0))) continue;
          ow.getBlock(bx + sx, by + sy, bz + sz).set('minecraft:air');
        }
      }
    }
    for (var ty = 0; ty <= 4; ty++) {
      ow.getBlock(bx + 3, by + ty, bz + 3).set('minecraft:scaffolding');
    }
    lhEnsureBarrelAt(ow, bx, by, bz);
    lhEnsureBarrelAt(ow, bx + 1, by, bz);
    ow.getBlock(bx - 2, by + 1, bz - 2).set('minecraft:lantern');
    return true;
  }

  if (envType === 'underground') {
    for (var ux = -3; ux <= 3; ux++) {
      for (var uz = -3; uz <= 3; uz++) {
        var uEdge = Math.abs(ux) === 3 || Math.abs(uz) === 3;
        ow.getBlock(bx + ux, by - 1, bz + uz).set('minecraft:deepslate_bricks');
        ow.getBlock(bx + ux, by + 4, bz + uz).set('minecraft:deepslate_bricks');
        for (var uy = 0; uy <= 3; uy++) {
          if (uy === 0 && ((ux === 0 && uz === 0) || (ux === 1 && uz === 0))) continue;
          if (uEdge && !(ux === 0 && Math.abs(uz) === 3 && uy <= 1)) {
            ow.getBlock(bx + ux, by + uy, bz + uz).set((Math.abs(ux) === 3 && Math.abs(uz) === 3) ? 'minecraft:chiseled_deepslate' : 'minecraft:deepslate_bricks');
          } else {
            ow.getBlock(bx + ux, by + uy, bz + uz).set('minecraft:air');
          }
        }
      }
    }
    lhEnsureBarrelAt(ow, bx, by, bz);
    lhEnsureBarrelAt(ow, bx + 1, by, bz);
    ow.getBlock(bx + 2, by + 2, bz + 2).set('minecraft:lantern');
    ow.getBlock(bx - 2, by + 2, bz - 2).set('minecraft:lantern');
    return true;
  }

  // Standard surface pavilion (normal)
  for (var dx = -2; dx <= 2; dx++) {
    for (var dz = -2; dz <= 2; dz++) {
      ow.getBlock(bx + dx, by - 1, bz + dz).set(wallMat);
      for (var dy = 0; dy <= 3; dy++) {
        if (dy === 0 && ((dx === 0 && dz === 0) || (dx === 1 && dz === 0))) continue;
        var isCornerN = Math.abs(dx) === 2 && Math.abs(dz) === 2;
        var isEdgeN = Math.abs(dx) === 2 || Math.abs(dz) === 2;
        if (dy === 3) {
          ow.getBlock(bx + dx, by + dy, bz + dz).set(isEdgeN ? trimMat : 'minecraft:glass');
        } else if (isCornerN) {
          ow.getBlock(bx + dx, by + dy, bz + dz).set(wallMat);
        } else if (isEdgeN && dy === 0 && !(dx === 0 && Math.abs(dz) === 2)) {
          ow.getBlock(bx + dx, by + dy, bz + dz).set(wallMat);
        } else {
          ow.getBlock(bx + dx, by + dy, bz + dz).set('minecraft:air');
        }
      }
    }
  }
  lhEnsureBarrelAt(ow, bx, by, bz);
  lhEnsureBarrelAt(ow, bx + 1, by, bz);
  ow.getBlock(bx, by + 2, bz + 2).set('minecraft:lantern');
  return true;
}

function lhPlacePhysicalBuildingBlocks(server, bldg) {
  if (!server || !bldg) return false;
  try {
    var dim = bldg.dimension || 'minecraft:overworld';
    var ow = server.getLevel(dim) || server.getLevel('minecraft:overworld');
    if (!ow) return false;
    var st = lhOttdRead(server);
    var comp = (bldg.owner && st && st.companies) ? st.companies[bldg.owner] : null;
    var envType = bldg.envType || (comp ? global.LHOpenTTD.getCompanyEnvType(comp) : 'normal');
    var bx = Math.round(Number(bldg.x));
    var by = Math.round(Number(bldg.y));
    var bz = Math.round(Number(bldg.z));
    if (dim === 'minecraft:overworld' && !bldg.preserveWorldStructure && bldg.type !== 'structure_facility') {
      if (envType === 'air') by = Math.max(278, Math.min(300, by));
      else if (envType === 'sea') by = 64;
      else if (envType === 'underground') by = -44;
    }

    bldg.outputContainerPos = { x: bx, y: by, z: bz, dim: dim };
    bldg.inputContainerPos = { x: bx + 1, y: by, z: bz, dim: dim };

    // Preserve generated world structures! Only place the output & input barrels gently without clearing/replacing surrounding structure blocks.
    if (bldg.preserveWorldStructure || bldg.type === 'structure_facility') {
      lhEnsureBarrelAt(ow, bx, by, bz);
      lhEnsureBarrelAt(ow, bx + 1, by, bz);
      return true;
    }
    return lhPlaceSpecializedStructure(ow, bx, by, bz, envType, bldg.category || 'logistics');
  } catch (eBuild) {
    return false;
  }
}

function lhSyncBuildingPhysicalContainers(server, st) {
  if (!server || !st || !st.buildings) return 0;
  var synced = 0;
  var compStockVal = {};
  Object.keys(st.buildings).forEach(function (bk) {
    var b = st.buildings[bk];
    if (!b || !b.owner) return;
    var dim = b.dimension || 'minecraft:overworld';
    var lvl = server.getLevel(dim);
    if (!lvl) return;
    var outPos = b.outputContainerPos || { x: Math.round(b.x), y: Math.round(b.y), z: Math.round(b.z) };
    var inPos = b.inputContainerPos || { x: Math.round(b.x) + 1, y: Math.round(b.y), z: Math.round(b.z) };

    try {
      var oPos = new LHPos(outPos.x, outPos.y, outPos.z);
      if (lvl.hasChunkAt(oPos)) {
        lhEnsureBarrelAt(lvl, outPos.x, outPos.y, outPos.z);
        var oBlk = lvl.getBlock(outPos.x, outPos.y, outPos.z);
        var oInv = oBlk ? oBlk.inventory : null;
        if (oInv && b.outputContainerQueue && typeof Item !== 'undefined') {
          var qKeys = Object.keys(b.outputContainerQueue);
          for (var qi = 0; qi < qKeys.length; qi++) {
            var iid = qKeys[qi];
            var qQty = Math.max(0, Math.round(Number(b.outputContainerQueue[iid] || 0)));
            if (qQty <= 0) { delete b.outputContainerQueue[iid]; continue; }
            var ins = lhInsertIntoTerminalContainer(server, { x: outPos.x, y: outPos.y, z: outPos.z, dim: dim }, iid, qQty);
            if (ins > 0) {
              b.outputContainerQueue[iid] -= ins;
              if (b.outputContainerQueue[iid] <= 0) delete b.outputContainerQueue[iid];
              synced++;
            }
          }
          // Estimate physical barrel value for valuation
          if (typeof oInv.slots === 'number' && global.LHEconomyEngine) {
            var estVal = 0;
            for (var si = 0; si < oInv.slots; si++) {
              var stck = oInv.getStackInSlot(si);
              if (stck && !stck.empty) {
                estVal += global.LHEconomyEngine.getBasePrice(lhEconRead(server), String(stck.id)) * Number(stck.count || 1);
              }
            }
            compStockVal[b.owner] = (compStockVal[b.owner] || 0) + estVal;
          }
        }
      }

      // Pull required inputs from dedicated Input Barrel into b.inputBuffer
      var iPos = new LHPos(inPos.x, inPos.y, inPos.z);
      if (lvl.hasChunkAt(iPos)) {
        lhEnsureBarrelAt(lvl, inPos.x, inPos.y, inPos.z);
        var iBlk = lvl.getBlock(inPos.x, inPos.y, inPos.z);
        var iInv = iBlk ? iBlk.inventory : null;
        if (iInv && global.LHOpenTTD && global.LHOpenTTD.getBuildingRequiredInputs) {
          var req = global.LHOpenTTD.getBuildingRequiredInputs(b);
          var pulled = {};
          Object.keys(req).forEach(function (rk) {
            var curIn = Number((b.inputBuffer && b.inputBuffer[rk]) || 0);
            var targetCap = Math.max(4, Number(req[rk] || 1) * 4);
            if (curIn < targetCap) {
              var want = targetCap - curIn;
              var resPull = lhConsumeInvItem(iInv, rk, want);
              if (resPull && resPull.ok) {
                pulled[rk] = want;
              } else if (resPull && resPull.have > 0) {
                var partial = lhConsumeInvItem(iInv, rk, resPull.have);
                if (partial && partial.ok) pulled[rk] = resPull.have;
              }
            }
          });
          if (Object.keys(pulled).length > 0) {
            global.LHOpenTTD.supplyBuildingInputs(st, b.owner, b.sx, b.sz, pulled, dim);
            synced++;
          }
        }
      }
    } catch (eSyncB) {}
  });
  Object.keys(compStockVal).forEach(function (cid) {
    if (st.companies && st.companies[cid]) {
      st.companies[cid].physicalStockEstimate = Math.round(compStockVal[cid]);
    }
  });
  return synced;
}

function lhScanNearbyStructuresForSector(server, player, st) {
  if (!server || !player || !st || !global.LHOpenTTD) return [];
  var dim = player.level ? String(player.level.dimension) : 'minecraft:overworld';
  var sc = global.LHOpenTTD.sectorCoords(player.x, player.z);
  var foundIds = [];
  try {
    var lvl = player.level;
    if (lvl && typeof lvl.structureManager === 'function') {
      var sm = lvl.structureManager();
      var pos = new LHPos(Math.round(player.x), Math.round(player.y), Math.round(player.z));
      if (sm && typeof sm.getAllStructuresAt === 'function') {
        var map = sm.getAllStructuresAt(pos);
        if (map && typeof map.keySet === 'function') {
          var it = map.keySet().iterator();
          while (it.hasNext()) {
            var stObj = it.next();
            if (stObj && lvl.registryAccess) {
              try {
                var reg = lvl.registryAccess().registryOrThrow(Java.loadClass('net.minecraft.core.registries.Registries').STRUCTURE);
                var key = reg.getKey(stObj);
                if (key) foundIds.push(String(key));
              } catch (eReg) {}
            }
          }
        }
      }
    }
  } catch (eSm) {}

  if (foundIds.length > 0) {
    global.LHOpenTTD.recordSectorStructures(st, sc.sx, sc.sz, foundIds, dim);
    lhOttdSave(server);
  }
  return global.LHOpenTTD.getSectorStructures(st, sc.sx, sc.sz, dim);
}

function lhEnsureCompanyTerminalBuilt(server, st, cid) {
  if (!server || !st || !st.companies || !st.companies[cid]) return null;
  var comp = st.companies[cid];
  var term = lhGetCompanyTerminalBlockPos(server, st, cid);
  if (!term) return null;
  try {
    var ow = server.getLevel('minecraft:overworld');
    if (!ow) return term;
    var envType = global.LHOpenTTD.getCompanyEnvType(comp);
    if (envType === 'normal' && typeof lhFindSafeRespawnY === 'function' && !comp.terminalPos) {
      var surfY = lhFindSafeRespawnY(ow, term.x, term.z, true);
      if (surfY > 0) term.y = surfY;
    }
    var pos = new LHPos(term.x, term.y, term.z);
    if (ow.hasChunkAt(pos)) {
      var blk = ow.getBlock(term.x, term.y, term.z);
      if (!blk || (String(blk.id) !== 'minecraft:barrel' && String(blk.id) !== 'minecraft:chest')) {
        lhPlaceSpecializedStructure(ow, term.x, term.y, term.z, envType, 'logistics');
      }
      comp.terminalPos = { x: term.x, y: term.y, z: term.z };
      comp.hqX = term.x;
      comp.hqY = term.y;
      comp.hqZ = term.z;
    }
  } catch (eTerm) {}
  return term;
}

function lhRelocateCompanyEnv(server, player, envType) {
  var st = lhOttdRead(server);
  var comp = lhGetPlayerCompany(server, player);
  if (!comp) { lhMsg(player, 'Сначала создайте компанию.'); return { ok: false, reason: 'no_company' }; }
  var res = global.LHOpenTTD.setCompanyEnvType(st, comp.id, envType);
  if (!res.ok) { lhMsg(player, 'Неизвестный тип среды: ' + envType + ' (доступны: normal, air, sea, underground).'); return res; }

  var ow = server.getLevel('minecraft:overworld');
  var hx = Math.round(Number(comp.hqX || comp.hqSx * 256));
  var hz = Math.round(Number(comp.hqZ || comp.hqSz * 256));
  var hy = res.hqY;
  if (ow) {
    if (envType === 'normal' && typeof lhFindSafeRespawnY === 'function') {
      hy = lhFindSafeRespawnY(ow, hx, hz, true);
    } else if (envType === 'sea' && typeof lhFindWaterColumnForSeaSpawn === 'function') {
      var wy = lhFindWaterColumnForSeaSpawn(ow, hx, hz);
      hy = wy > 0 ? wy : 64;
    }
    lhPlaceSpecializedStructure(ow, hx, hy, hz, envType, 'logistics');
  }
  comp.hqX = hx;
  comp.hqY = hy;
  comp.hqZ = hz;
  comp.terminalPos = { x: hx, y: hy, z: hz };
  lhOttdSave(server);

  if (typeof lhProfile === 'function' && typeof lhSave === 'function') {
    var prof = lhProfile(server, player);
    if (prof) {
      prof.terminal = { dim: 'minecraft:overworld', x: hx, y: hy, z: hz };
      lhSave(server);
    }
  }
  lhMsg(player, '§a[Среда компании] §fШтаб и новые здания настроены на: ' + res.info.icon + ' §e' + res.info.name +
    ' §7(терминал на ' + hx + ', ' + hy + ', ' + hz + ').');
  return { ok: true, envType: envType, x: hx, y: hy, z: hz };
}

function lhGetPlayerCompany(server, player) {
  if (!server || !player) return null;
  var st = lhOttdRead(server);
  var cid = st.playerCompany[lhId(player)];
  return cid && st.companies[cid] ? st.companies[cid] : null;
}

function lhCompanyScarcityFactor(server, player, resourceSpecId) {
  var comp = lhGetPlayerCompany(server, player);
  if (!comp || comp.resourceSpec !== resourceSpecId) return 1.0;
  var spec = global.LHOpenTTD.RESOURCE_SPECS[resourceSpecId];
  return spec && typeof spec.scarcityReduction === 'number' ? (1.0 - spec.scarcityReduction) : 1.0;
}

function lhCompanyReward(server, player, baseCredits, category, transportHint) {
  var comp = lhGetPlayerCompany(server, player);
  if (!comp) return 0;
  var st = lhOttdRead(server);
  var mult = 1.0;

  var tSpec = comp.transportSpec ? global.LHOpenTTD.TRANSPORT_SPECS[comp.transportSpec] : null;
  if (tSpec) {
    var matched = false;
    if (transportHint && transportHint === tSpec.telemetryFamily) matched = true;
    else if (player && player.vehicle && typeof lhClassifyVehicle === 'function' && lhClassifyVehicle(player.vehicle) === tSpec.telemetryFamily) matched = true;
    else if (typeof lhTelemetryRead === 'function') {
      var tel = lhTelemetryRead(server).players[lhId(player)];
      if (tel && tel.meters && (tel.meters[tSpec.telemetryFamily] || 0) >= 200) matched = true;
    }
    if (matched) mult += Number(tSpec.payoutBonus || 0);
  }

  var rSpec = comp.resourceSpec ? global.LHOpenTTD.RESOURCE_SPECS[comp.resourceSpec] : null;
  if (rSpec) {
    if (category === 'food' && rSpec.id === 'agro') mult += Number(rSpec.contractBonus || 0.40);
    else if ((category === 'nuclear' || category === 'energy') && rSpec.id === 'energy') mult += Number(rSpec.yieldBonus || 0.40);
    else if (category === 'mining' && rSpec.id === 'mining') mult += Number(rSpec.yieldBonus || 0.35);
    else if (category === 'forestry' && rSpec.id === 'forestry') mult += Number(rSpec.yieldBonus || 0.35);
  }

  if (typeof lhHardIsActive === 'function' && lhHardIsActive(server, 'logistics_toll')) {
    mult *= 0.90;
  }
  if (typeof lhOriginRoutePayoutMult === 'function') {
    mult *= lhOriginRoutePayoutMult(player, transportHint, category);
  }

  var earned = Math.max(1, Math.round(Number(baseCredits || 0) * mult));
  comp.cash += earned;
  comp.stats.deliveries = (comp.stats.deliveries || 0) + 1;
  if (category === 'contract') comp.stats.contractsDone = (comp.stats.contractsDone || 0) + 1;
  if (category === 'route') comp.stats.routesDone = (comp.stats.routesDone || 0) + 1;
  lhOttdSave(server);

  if (typeof player.tell === 'function') {
    player.tell(comp.colorCode + '[' + comp.name + '] §a+' + earned + ' Cr §7(×' + (Math.round(mult * 100) / 100) + ', баланс: ' + comp.cash + ' Cr)');
  }
  return earned;
}

function lhCompanyAutoClaimFromInfra(server, player, x, z, label) {
  var comp = lhGetPlayerCompany(server, player);
  if (!comp) return 0;
  var st = lhOttdRead(server);
  var sc = global.LHOpenTTD.sectorCoords(x, z);
  var cur = st.claims[sc.key];
  if (!cur) {
    st.claims[sc.key] = { sx: sc.sx, sz: sc.sz, owner: comp.id, strength: 1, isHq: false, infra: String(label || 'infra') };
    comp.stats.sectorsCaptured = (comp.stats.sectorsCaptured || 0) + 1;
    lhOttdSave(server);
    if (typeof player.tell === 'function') {
      player.tell(comp.colorCode + '[' + comp.name + '] §aСектор (' + sc.sx + ', ' + sc.sz + ') автоматически закреплён за вашей инфраструктурой!');
    }
    return 1;
  }
  return 0;
}

var LHOTTDActiveRaids = {};
var LHOTTD_COLOR_TO_MC = {
  '§6': 'gold', '§a': 'green', '§b': 'aqua', '§9': 'blue',
  '§d': 'light_purple', '§e': 'yellow', '§c': 'red',
  '§3': 'dark_aqua', '§5': 'dark_purple', '§f': 'white'
};
var LHOTTD_MAP_BASE_IDS = {
  bot_ironrail: 30,
  bot_greencart: 33,
  bot_skyport: 31
};
var LHOTTD_PLAYER_MAP_IDS = [25, 20, 15, 23, 28, 24, 16];

function lhCompanyMcColor(comp) {
  if (!comp) return 'dark_gray';
  return LHOTTD_COLOR_TO_MC[comp.colorCode] || comp.color || 'white';
}

function lhToSignedByte(n) {
  var v = Number(n || 0) & 255;
  return v > 127 ? v - 256 : v;
}

function lhCompanyMapColorByte(st, cid, isClaimed, isHq) {
  if (isHq) return lhToSignedByte(46); // Snow white HQ dot
  if (!cid || !isClaimed) return lhToSignedByte(85); // Neutral unclaimed land
  var baseId = LHOTTD_MAP_BASE_IDS[cid];
  if (!baseId) {
    var keys = Object.keys(st.companies || {}).filter(function (k) { return !st.companies[k].isBot; }).sort();
    var idx = Math.max(0, keys.indexOf(cid));
    baseId = LHOTTD_PLAYER_MAP_IDS[idx % LHOTTD_PLAYER_MAP_IDS.length];
  }
  return lhToSignedByte(baseId * 4 + 2);
}

function lhCompanyTerritoryMap(server, player, radiusArg) {
  var st = lhOttdRead(server);
  var myComp = lhGetPlayerCompany(server, player);
  var sc = global.LHOpenTTD.sectorCoords(player.x, player.z);
  var curInfo = global.LHOpenTTD.resolveSectorOwner(st, sc.sx, sc.sz);
  var curComp = (curInfo.kind === 'claimed' && curInfo.owner) ? st.companies[curInfo.owner] : null;
  var r = Math.max(3, Math.min(9, Number(radiusArg || 5)));

  lhMsg(player, '=== Карта территорий (' + (2 * r + 1) + '×' + (2 * r + 1) + ' секторов 256×256) вокруг (' + sc.sx + ', ' + sc.sz + ') ===');
  lhMsg(player, 'Вы в (' + sc.sx + ', ' + sc.sz + '): ' + (curComp ? (curComp.colorCode + curComp.name) : '§7Нейтральный (не запривачен)') +
    ' §7(' + (curInfo.kind === 'claimed' ? ('Захвачен, защита ' + curInfo.strength + (curInfo.isHq ? ' [Штаб]' : '')) : 'Свободен') + ')');

  var uname = player.username || (typeof player.getName === 'function' ? player.getName().getString() : '');
  var useTellraw = !!(uname && server && typeof server.runCommandSilent === 'function');

  for (var dz = -r; dz <= r; dz++) {
    var linePlain = '  ';
    var comps = [{ text: (dz < 0 ? ' ' + dz : (dz === 0 ? '  0' : ' +' + dz)) + ' ', color: 'dark_gray' }];
    for (var dx = -r; dx <= r; dx++) {
      var sx = sc.sx + dx;
      var sz = sc.sz + dz;
      var info = global.LHOpenTTD.resolveSectorOwner(st, sx, sz);
      var comp = (info.kind === 'claimed' && info.owner) ? st.companies[info.owner] : null;
      var sym = (dx === 0 && dz === 0) ? '◆' : (info.isHq ? '★' : (info.kind === 'claimed' ? '█' : '·'));
      var cc = comp ? (comp.colorCode || '§7') : '§8';
      linePlain += cc + sym + ' ';

      var hoverLines = [
        'Сектор (' + sx + ', ' + sz + ') [блоки ' + (sx * 256 - 128) + '..' + (sx * 256 + 127) + ', ' + (sz * 256 - 128) + '..' + (sz * 256 + 127) + ']',
        'Владелец: ' + (comp ? comp.name : 'Ничей (не запривачен)') + ' (' + (info.kind === 'claimed' ? ('Захвачен, ур.' + info.strength) : 'Свободный сектор') + ')'
      ];
      if (myComp) {
        var cInfo = global.LHOpenTTD.computeClaimCost(st, myComp.id, sx, sz);
        if (cInfo.ok) {
          hoverLines.push((cInfo.adjacent ? 'Примыкает к вашей территории' : 'ДАЛЬНИЙ сектор (дист. ' + cInfo.sectorDist + ', ×' + (Math.round(cInfo.exclaveMult * 10) / 10) + ')'));
          hoverLines.push((cInfo.mode === 'capture' ? 'Выкуп: ' : 'Покупка: ') + cInfo.cost + ' Cr');
        } else if (cInfo.reason === 'already_yours') {
          hoverLines.push('Ваш сектор (укрепление: ' + info.strength + '/4)');
        }
      }
      hoverLines.push('Клик: подробности и действия (/lh territory inspect ' + sx + ' ' + sz + ')');
      comps.push({
        text: sym + ' ',
        color: lhCompanyMcColor(comp),
        hoverEvent: { action: 'show_text', contents: hoverLines.join('\n') },
        clickEvent: { action: 'run_command', value: '/lh territory inspect ' + sx + ' ' + sz }
      });
    }
    if (useTellraw) {
      server.runCommandSilent('tellraw ' + uname + ' ' + JSON.stringify(comps));
    } else {
      player.tell(linePlain);
    }
  }

  var legend = Object.keys(st.companies).map(function (cid) {
    var c = st.companies[cid];
    return c.colorCode + '█ ' + c.name + (c.isBot ? ' [BOT]' : '') + '§7';
  });
  player.tell('§7Легенда: ◆=Вы, ★=Штаб, █=Захвачен, ·=Свободный | ' + legend.join(' | '));
  if (useTellraw) {
    var actions = [
      { text: 'Действия: ', color: 'gray' },
      { text: '[Карта-предмет] ', color: 'gold', clickEvent: { action: 'run_command', value: '/lh map item' }, hoverEvent: { action: 'show_text', contents: 'Выдать/обновить физическую карту территорий в руке' } },
      { text: '[Инфо сектора] ', color: 'aqua', clickEvent: { action: 'run_command', value: '/lh territory inspect ' + sc.sx + ' ' + sc.sz } },
      { text: '[Лог событий]', color: 'yellow', clickEvent: { action: 'run_command', value: '/lh events' } }
    ];
    server.runCommandSilent('tellraw ' + uname + ' ' + JSON.stringify(actions));
  }
  return 1;
}

function lhGiveTerritoryMapItem(server, player, dryRun, silent) {
  var st = lhOttdRead(server);
  var sc = global.LHOpenTTD.sectorCoords(player.x, player.z);
  var originSx = Math.max(-8, Math.min(8, sc.sx)) - 8;
  var originSz = Math.max(-8, Math.min(8, sc.sz)) - 8;
  if (Math.abs(sc.sx) > 8 || Math.abs(sc.sz) > 8) {
    originSx = sc.sx - 8;
    originSz = sc.sz - 8;
  } else {
    originSx = -8;
    originSz = -8;
  }

  if (dryRun) {
    return 1;
  }

  try {
    var MapItemCls = Java.loadClass('net.minecraft.world.item.MapItem');
    var TerritoryMapHelperCls = null;
    try { TerritoryMapHelperCls = Java.loadClass('com.longhaul.runtime.map.TerritoryMapHelper'); } catch (eHelper) {}
    var ow = server.getLevel('minecraft:overworld');
    if (!ow) return 0;

    var existingStack = null;
    if (player.inventory) {
      for (var si = 0; si < player.inventory.slots; si++) {
        var cand = player.inventory.getStackInSlot(si);
        if (cand && !cand.empty && String(cand.id) === 'minecraft:filled_map' && cand.nbt && cand.nbt.lhTerritoryMap) {
          existingStack = cand;
          break;
        }
      }
    }
    if (silent && !existingStack) return 0;

    // Build 128x128 pixel array (8x8 pixels per 256x256 sector -> 16x16 sectors)
    var pixelArr = TerritoryMapHelperCls ? TerritoryMapHelperCls.allocPixels() : [];
    for (var gy = 0; gy < 16; gy++) {
      for (var gx = 0; gx < 16; gx++) {
        var sx = originSx + gx;
        var sz = originSz + gy;
        var info = global.LHOpenTTD.resolveSectorOwner(st, sx, sz);
        var bldg = global.LHOpenTTD.getSectorBuilding(st, sx, sz);
        var isClaimed = (info.kind === 'claimed');
        var solidByte = lhCompanyMapColorByte(st, info.owner, isClaimed, false);
        var isPlayerCell = (sx === sc.sx && sz === sc.sz);

        for (var py = 0; py < 8; py++) {
          for (var px = 0; px < 8; px++) {
            var mx = gx * 8 + px;
            var mz = gy * 8 + py;
            var col = isClaimed ? solidByte : 85;
            if (px === 0 || py === 0) {
              col = 119; // Sector grid line
            }
            if (info.isHq && px >= 3 && px <= 5 && py >= 3 && py <= 5) {
              col = 46; // White HQ marker
            }
            if (bldg && px >= 2 && px <= 3 && py >= 5 && py <= 6) {
              col = 74; // Bright building marker
            }
            if (isPlayerCell && px >= 3 && px <= 4 && py >= 3 && py <= 4) {
              col = 114; // Crimson player sector dot
            }
            pixelArr[mz * 128 + mx] = col & 0xFF;
          }
        }
      }
    }

    var freshStack = null;
    if (TerritoryMapHelperCls) {
      // Java helper calls MapItemSavedData.locked() (SRG m_164775_), paints pixels onto lockedData,
      // and registers lockedData in ServerLevel (SRG m_142325_) so vanilla terrain never overwrites it.
      freshStack = TerritoryMapHelperCls.createLockedTerritoryMap(ow, originSx * 256, originSz * 256, 4, pixelArr);
    } else {
      freshStack = MapItemCls.create(ow, originSx * 256, originSz * 256, 4, false, false);
      var mapData = MapItemCls.getSavedData(freshStack, ow);
      if (!mapData || !mapData.colors) {
        if (!silent) lhMsg(player, 'Не удалось инициализировать данные карты. Попробуйте снова.');
        return 0;
      }
      for (var pz = 0; pz < 128; pz++) {
        for (var px2 = 0; px2 < 128; px2++) {
          mapData.setColor(px2, pz, lhToSignedByte(pixelArr[pz * 128 + px2]));
        }
      }
      if (typeof mapData.setDirty === 'function') mapData.setDirty();
    }
    var newMapId = MapItemCls.getMapId(freshStack);

    var titleComp = Text.of('§6Карта территорий компаний §7(сектора ' + originSx + '..' + (originSx + 15) + ')');
    if (!existingStack) {
      var nbt = freshStack.getOrCreateTag();
      nbt.putBoolean('lhTerritoryMap', true);
      nbt.putString('lhMapRange', originSx + ',' + originSz);
      freshStack.setHoverName(titleComp);
      player.give(freshStack);
      if (!silent) lhMsg(player, '§aВыдана заблокированная карта территорий (поверх неё не рисуется обычная карта). Обновление: /lh map item');
    } else {
      var exNbt = existingStack.getOrCreateTag();
      if (newMapId !== null) exNbt.putInt('map', Number(newMapId));
      exNbt.putBoolean('lhTerritoryMap', true);
      exNbt.putString('lhMapRange', originSx + ',' + originSz);
      existingStack.setHoverName(titleComp);
      if (!silent) lhMsg(player, '§aВаша карта территорий компаний обновлена в инвентаре!');
    }
    return 1;
  } catch (eMap) {
    console.error('[LH] lhGiveTerritoryMapItem error: ' + eMap);
    lhMsg(player, 'Ошибка генерации карты-предмета (' + eMap + '). Используйте интерактивную карту /lh map.');
    return 0;
  }
}

function lhCompanyInspectSector(server, player, sx, sz) {
  var st = lhOttdRead(server);
  var info = global.LHOpenTTD.resolveSectorOwner(st, sx, sz);
  var comp = info.owner ? st.companies[info.owner] : null;
  var myComp = lhGetPlayerCompany(server, player);
  var curSc = global.LHOpenTTD.sectorCoords(player.x, player.z);
  var standingHere = (curSc.sx === sx && curSc.sz === sz);

  lhMsg(player, 'Сектор (' + sx + ', ' + sz + ') [центр ' + (sx * 256) + ', ' + (sz * 256) + ']: владелец=' +
    (comp ? (comp.colorCode + comp.name + '§f') : 'нет') + ' (' + info.kind + ', защита=' + info.strength + (info.isHq ? ', ШТАБ' : '') + ')');

  if (myComp) {
    var cInfo = global.LHOpenTTD.computeClaimCost(st, myComp.id, sx, sz);
    if (cInfo.ok) {
      lhMsg(player, 'Доступность: ' + (cInfo.adjacent ? '§aПримыкает к вашей территории' : ('§cДальний сектор (дистанция ' + cInfo.sectorDist + ', наценка ×' + (Math.round(cInfo.exclaveMult * 10) / 10) + ')')) +
        ' §f| Цена ' + (cInfo.mode === 'capture' ? 'выкупа' : 'покупки') + ': §e' + cInfo.cost + ' Cr');
    }
    var uname = player.username || (typeof player.getName === 'function' ? player.getName().getString() : '');
    if (uname && server && typeof server.runCommandSilent === 'function') {
      var btns = [{ text: 'Действия: ', color: 'gray' }];
      if (cInfo.ok && cInfo.mode === 'claim') {
        if (cInfo.adjacent) {
          btns.push({ text: '[Купить (' + cInfo.cost + ' Cr)] ', color: 'green', clickEvent: { action: 'run_command', value: '/lh territory buy ' + sx + ' ' + sz } });
        } else {
          btns.push({ text: '[Только на месте (дальний)] ', color: 'red', hoverEvent: { action: 'show_text', contents: 'Непримыкающие сектора нельзя купить удалённо — придите в сектор и используйте /lh territory claim или /lh territory settle' } });
        }
      } else if (cInfo.ok && cInfo.mode === 'capture') {
        if (cInfo.adjacent) {
          btns.push({ text: '[Выкупить (' + cInfo.cost + ' Cr)] ', color: 'gold', clickEvent: { action: 'run_command', value: '/lh territory buyout ' + sx + ' ' + sz } });
        }
        if (standingHere) {
          btns.push({ text: '[Рейд (75 Cr, 60с)] ', color: 'red', clickEvent: { action: 'run_command', value: '/lh territory raid' } });
          btns.push({ text: '[Демпинг-выкуп (бочка)] ', color: 'yellow', clickEvent: { action: 'run_command', value: '/lh territory outbid' } });
          btns.push({ text: '[Антимонопольный захват] ', color: 'light_purple', clickEvent: { action: 'run_command', value: '/lh territory seize' } });
        }
      } else if (info.kind === 'claimed' && info.owner === myComp.id && standingHere) {
        btns.push({ text: '[Укрепить] ', color: 'aqua', clickEvent: { action: 'run_command', value: '/lh territory fortify' } });
      }
      if (btns.length > 1) server.runCommandSilent('tellraw ' + uname + ' ' + JSON.stringify(btns));
    }
  }
  return 1;
}

function lhCompanyClaimAt(server, player, sx, sz, allowCapture, isRemote) {
  var st = lhOttdRead(server);
  var comp = lhGetPlayerCompany(server, player);
  if (!comp) {
    lhMsg(player, 'Сначала создайте или вступите в компанию: /lh company create <id> <название>');
    return 0;
  }
  var costMult = (typeof lhHardIsActive === 'function' && lhHardIsActive(server, 'bot_cartel_surge')) ? 1.2 : 1.0;
  var res = global.LHOpenTTD.claimOrCaptureSector(st, comp.id, sx, sz, !!allowCapture, { remote: !!isRemote, costMultiplier: costMult });
  if (!res.ok) {
    if (res.reason === 'spawn_protected') lhMsg(player, '§eСектор (' + sx + ', ' + sz + ') входит в нейтральную зону спавна 3×3 (±384 м) и защищён от захвата.');
    else if (res.reason === 'already_yours') lhMsg(player, 'Сектор (' + sx + ', ' + sz + ') уже захвачен вашей компанией.');
    else if (res.reason === 'not_adjacent_remote') {
      lhMsg(player, '§cНепримыкающий сектор (' + sx + ', ' + sz + ', дист. ' + res.sectorDist + ') нельзя купить удалённо! Придите в сектор физически; стоимость: ' + res.cost + ' Cr.');
    } else if (res.reason === 'enemy_claimed') {
      var target = st.companies[res.targetOwner];
      lhMsg(player, 'Сектор (' + sx + ', ' + sz + ') удерживает ' + (target ? target.name : res.targetOwner) +
        '. Способы отбора: /lh territory capture (' + res.cost + ' Cr), /lh territory raid (75 Cr, 60с), /lh territory outbid (груз), /lh territory seize.');
    } else if (res.reason === 'no_cash') {
      lhMsg(player, 'Недостаточно средств для захвата сектора (' + sx + ', ' + sz + '): нужно ' + res.cost + ' Cr, у компании ' + res.cash + ' Cr.');
    }
    return 0;
  }
  lhOttdSave(server);
  lhUnlock(player, 'longhaul:openttd/claim');
  var action = res.mode === 'capture' ? 'перехвачен у соперника' : 'захвачен';
  if (typeof lhLogEvent === 'function') {
    lhLogEvent(server, 'territory', comp.name + ' — сектор (' + sx + ', ' + sz + ') ' + action + ' за ' + res.cost + ' Cr.', { chatMode: res.mode === 'capture' ? 'important' : 'never' });
  }
  lhMsg(player, comp.colorCode + '[' + comp.name + '] §aСектор (' + sx + ', ' + sz + ') ' + action + ' за ' + res.cost + ' Cr! Баланс: ' + comp.cash + ' Cr.');
  return 1;
}

function lhCompanyClaimHere(server, player, allowCapture) {
  var sc = global.LHOpenTTD.sectorCoords(player.x, player.z);
  return lhCompanyClaimAt(server, player, sc.sx, sc.sz, allowCapture, false);
}

function lhConsumeBarrelIndustrialGoods(server, player, minQty) {
  var t = { dim: String(player.level.dimension), x: Math.floor(player.x), y: Math.floor(player.y) - 1, z: Math.floor(player.z) };
  if (t.dim !== 'minecraft:overworld') return { ok: false, reason: 'dim' };
  var block = typeof lhLoadedBlock === 'function' ? lhLoadedBlock(server, t) : null;
  if (!block || String(block.id) !== 'minecraft:barrel') return { ok: false, reason: 'no_barrel' };
  var inv = block.inventory;
  var eligible = {
    'create:iron_sheet': true, 'create:brass_ingot': true, 'create:track': true,
    'create:precision_mechanism': true, 'create:andesite_alloy': true,
    'minecraft:iron_ingot': true, 'minecraft:copper_ingot': true, 'minecraft:bricks': true,
    'minecraft:cobblestone': true, 'minecraft:oak_planks': true, 'minecraft:oak_log': true,
    'longhaul:treated_timber': true, 'longhaul:ore_concentrate': true, 'longhaul:machine_parts': true,
    'longhaul:refractory_mix': true, 'longhaul:technical_glass': true, 'longhaul:technical_oil': true
  };
  var have = 0;
  for (var s = 0; s < inv.slots; s++) {
    var st = inv.getStackInSlot(s);
    if (st && !st.empty && eligible[String(st.id)]) have += Number(st.count);
  }
  if (have < minQty) return { ok: false, reason: 'low_goods', have: have, need: minQty };
  var rem = minQty;
  for (var s2 = 0; s2 < inv.slots && rem > 0; s2++) {
    var st2 = inv.getStackInSlot(s2);
    if (st2 && !st2.empty && eligible[String(st2.id)]) {
      var taken = inv.extractItem(s2, Math.min(rem, Number(st2.count)), false);
      rem -= Number(taken.count);
    }
  }
  return { ok: true, consumed: minQty };
}

function lhCompanySettleCargo(server, player, dryRun) {
  var st = lhOttdRead(server);
  var comp = lhGetPlayerCompany(server, player);
  if (!comp) { if (!dryRun) lhMsg(player, 'Сначала создайте/вступите в компанию.'); return 0; }
  var sc = global.LHOpenTTD.sectorCoords(player.x, player.z);
  var cur = global.LHOpenTTD.resolveSectorOwner(st, sc.sx, sc.sz);
  if (cur.kind === 'claimed') {
    if (!dryRun) lhMsg(player, 'Сектор (' + sc.sx + ', ' + sc.sz + ') уже занят; для отбирания используйте raid/outbid/capture/seize.');
    return 0;
  }
  if (!dryRun) {
    var cons = lhConsumeBarrelIndustrialGoods(server, player, 32);
    if (!cons.ok) {
      lhMsg(player, cons.reason === 'low_goods'
        ? ('В бочке под ногами мало строй-/пром-груза (' + cons.have + '/' + cons.need + ').')
        : 'Встаньте НА бочку с >= 32 ед. пром-товаров (пластины, рельсы, дерево, кирпичи, слитки).');
      return 0;
    }
  }
  var res = global.LHOpenTTD.claimOrCaptureSector(st, comp.id, sc.sx, sc.sz, false, { discountFactor: 0.40 });
  if (!res.ok) {
    if (!dryRun) lhMsg(player, 'Недостаточно средств (нужно ' + res.cost + ' Cr даже со скидкой за груз).');
    return 0;
  }
  lhOttdSave(server);
  if (!dryRun) {
    lhUnlock(player, 'longhaul:openttd/claim');
    if (typeof lhLogEvent === 'function') lhLogEvent(server, 'territory', comp.name + ' освоила сектор (' + sc.sx + ', ' + sc.sz + ') товарным тендером.', { chatMode: 'never' });
    lhMsg(player, '§a[Тендер] Сектор (' + sc.sx + ', ' + sc.sz + ') закреплён поставкой материалов всего за ' + res.cost + ' Cr!');
  }
  return 1;
}

function lhCompanyOutbidHere(server, player, dryRun) {
  var st = lhOttdRead(server);
  var comp = lhGetPlayerCompany(server, player);
  if (!comp) { if (!dryRun) lhMsg(player, 'Сначала вступите в компанию.'); return 0; }
  var sc = global.LHOpenTTD.sectorCoords(player.x, player.z);
  var info = global.LHOpenTTD.resolveSectorOwner(st, sc.sx, sc.sz);
  if (info.kind !== 'claimed' || info.owner === comp.id) {
    if (!dryRun) lhMsg(player, 'Демпинг-вытеснение применяется в секторе, захваченном соперником.');
    return 0;
  }
  if (!dryRun) {
    var cons = lhConsumeBarrelIndustrialGoods(server, player, 48);
    if (!cons.ok) {
      lhMsg(player, cons.reason === 'low_goods'
        ? ('В бочке недостаточно промышленного груза (' + cons.have + '/' + cons.need + ').')
        : 'Встаньте НА бочку с >= 48 ед. промышленных товаров в секторе соперника.');
      return 0;
    }
  }
  var res = global.LHOpenTTD.weakenOrCaptureSector(st, comp.id, sc.sx, sc.sz, 1, 90);
  if (!res.ok) {
    if (!dryRun) lhMsg(player, 'Ошибка демпинга: ' + res.reason + (res.cost ? (' (нужно ' + res.cost + ' Cr)') : ''));
    return 0;
  }
  lhOttdSave(server);
  if (!dryRun) {
    if (res.captured) lhUnlock(player, 'longhaul:openttd/claim');
    if (typeof lhLogEvent === 'function') {
      lhLogEvent(server, 'raid', comp.name + ' провела товарный демпинг в (' + sc.sx + ', ' + sc.sz + '): ' +
        (res.captured ? 'сектор перехвачен!' : ('укрепление снижено до ' + res.newStrength)), { chatMode: 'important' });
    }
    lhMsg(player, res.captured
      ? ('§a[Демпинг] Вы вытеснили соперника и захватили сектор (' + sc.sx + ', ' + sc.sz + ')!')
      : ('§e[Демпинг] Оборона сектора (' + sc.sx + ', ' + sc.sz + ') ослаблена до уровня ' + res.newStrength + '. Повторите для захвата!'));
  }
  return 1;
}

function lhCompanyStartRaid(server, player) {
  var st = lhOttdRead(server);
  var comp = lhGetPlayerCompany(server, player);
  if (!comp) { lhMsg(player, 'Сначала вступите в компанию.'); return 0; }
  var sc = global.LHOpenTTD.sectorCoords(player.x, player.z);
  var info = global.LHOpenTTD.resolveSectorOwner(st, sc.sx, sc.sz);
  if (info.kind !== 'claimed' || info.owner === comp.id) {
    lhMsg(player, 'Рейд можно начать только в секторе, занятом другой компанией.');
    return 0;
  }
  if (comp.cash < 75) { lhMsg(player, 'Для запуска рейда нужно 75 Cr.'); return 0; }
  var pid = lhId(player);
  if (LHOTTDActiveRaids[pid]) { lhMsg(player, 'У вас уже идёт активный рейд в секторе ' + LHOTTDActiveRaids[pid].key + '!'); return 0; }
  comp.cash -= 75;
  lhOttdSave(server);
  LHOTTDActiveRaids[pid] = {
    playerUuid: pid,
    companyId: comp.id,
    sx: sc.sx,
    sz: sc.sz,
    key: sc.key,
    ticksLeft: 1200 // 60 seconds
  };
  var rival = st.companies[info.owner];
  if (typeof lhLogEvent === 'function') {
    lhLogEvent(server, 'raid', comp.name + ' начала 60с рейд на сектор (' + sc.sx + ', ' + sc.sz + ') компании ' + (rival ? rival.name : info.owner) + '!', { chatMode: 'important' });
  }
  lhMsg(player, '§c[Рейд] Начат захват сектора (' + sc.sx + ', ' + sc.sz + ')! Удерживайте позиции внутри сектора 60 секунд.');
  return 1;
}

function lhCompanyAntitrustSeize(server, player, dryRun) {
  var st = lhOttdRead(server);
  var comp = lhGetPlayerCompany(server, player);
  if (!comp) { if (!dryRun) lhMsg(player, 'Сначала вступите в компанию.'); return 0; }
  var sc = global.LHOpenTTD.sectorCoords(player.x, player.z);
  var res = global.LHOpenTTD.antitrustSeize(st, comp.id, sc.sx, sc.sz);
  if (!res.ok) {
    if (!dryRun) {
      if (res.reason === 'not_adjacent') lhMsg(player, 'Антимонопольное отчуждение возможно только для примыкающих секторов.');
      else if (res.reason === 'fortified') lhMsg(player, 'Сектор укреплён (ур. ' + res.strength + ') — сначала ослабьте его через /lh territory raid или outbid.');
      else if (res.reason === 'antitrust_not_eligible') lhMsg(player, 'Нельзя изъять: у соперника достаточно средств (' + res.rivalCash + ' Cr) и ваш капитал (' + res.myVal + ') меньше ×1.8 от его (' + res.rivalVal + ').');
      else lhMsg(player, 'Отчуждение недоступно: ' + res.reason + (res.cost ? (' (нужно ' + res.cost + ' Cr)') : ''));
    }
    return 0;
  }
  lhOttdSave(server);
  if (!dryRun) {
    lhUnlock(player, 'longhaul:openttd/claim');
    if (typeof lhLogEvent === 'function') lhLogEvent(server, 'territory', comp.name + ' изъяла слабый приграничный сектор (' + sc.sx + ', ' + sc.sz + ') за ' + res.cost + ' Cr.', { chatMode: 'important' });
    lhMsg(player, '§a[Отчуждение] Приграничный сектор (' + sc.sx + ', ' + sc.sz + ') перешёл к вам за ' + res.cost + ' Cr!');
  }
  return 1;
}

function lhCompanyTransferHere(server, player, targetCid) {
  var st = lhOttdRead(server);
  var comp = lhGetPlayerCompany(server, player);
  if (!comp) { lhMsg(player, 'Вы не в компании.'); return 0; }
  var sc = global.LHOpenTTD.sectorCoords(player.x, player.z);
  var cleanTarget = global.LHOpenTTD.sanitizeId(targetCid);
  var res = global.LHOpenTTD.transferSector(st, comp.id, cleanTarget, sc.sx, sc.sz);
  if (!res.ok) {
    lhMsg(player, res.reason === 'last_hq' ? 'Нельзя передать последний штаб-сектор.' : ('Передача не удалась: ' + res.reason));
    return 0;
  }
  lhOttdSave(server);
  if (typeof lhLogEvent === 'function') lhLogEvent(server, 'territory', comp.name + ' передала сектор (' + sc.sx + ', ' + sc.sz + ') компании ' + cleanTarget + '.', { chatMode: 'never' });
  lhMsg(player, '§aСектор (' + sc.sx + ', ' + sc.sz + ') передан компании ' + cleanTarget + '.');
  return 1;
}

function lhCompanyFortifyHere(server, player) {
  var st = lhOttdRead(server);
  var comp = lhGetPlayerCompany(server, player);
  if (!comp) { lhMsg(player, 'Вы не состоите в компании.'); return 0; }
  var sc = global.LHOpenTTD.sectorCoords(player.x, player.z);
  var res = global.LHOpenTTD.fortifySector(st, comp.id, sc.sx, sc.sz);
  if (!res.ok) {
    if (res.reason === 'not_owned') lhMsg(player, 'Укреплять можно только захваченный вашей компанией сектор.');
    else if (res.reason === 'max_strength') lhMsg(player, 'Сектор уже укреплён до максимума (уровень 4).');
    else if (res.reason === 'no_cash') lhMsg(player, 'Не хватает средств: нужно ' + res.cost + ' Cr.');
    return 0;
  }
  lhOttdSave(server);
  lhMsg(player, 'Сектор (' + sc.sx + ', ' + sc.sz + ') укреплён до уровня ' + res.strength + ' за ' + res.cost + ' Cr.');
  return 1;
}

function lhCompanySectorInfo(server, player) {
  var sc = global.LHOpenTTD.sectorCoords(player.x, player.z);
  return lhCompanyInspectSector(server, player, sc.sx, sc.sz);
}

function lhConsumeInvItem(inv, itemId, qty) {
  var have = 0;
  for (var s = 0; s < inv.slots; s++) {
    var st = inv.getStackInSlot(s);
    if (st && !st.empty && String(st.id) === itemId) have += Number(st.count);
  }
  if (have < qty) return { ok: false, have: have };
  var rem = qty;
  for (var s2 = 0; s2 < inv.slots && rem > 0; s2++) {
    var st2 = inv.getStackInSlot(s2);
    if (st2 && !st2.empty && String(st2.id) === itemId) {
      var taken = inv.extractItem(s2, Math.min(rem, Number(st2.count)), false);
      rem -= Number(taken.count);
    }
  }
  return { ok: true };
}

function lhInsertIntoTerminalContainer(server, termPos, itemId, qty) {
  if (!server || !termPos || !(qty > 0)) return 0;
  try {
    var ow = server.getLevel('minecraft:overworld');
    if (!ow) return 0;
    var bp = new LHPos(Math.round(termPos.x), Math.round(termPos.y), Math.round(termPos.z));
    if (!ow.hasChunkAt(bp)) return 0;
    var blk = ow.getBlock(bp.x, bp.y, bp.z);
    if (!blk || !blk.inventory) return 0;
    var inv = blk.inventory;
    var stSample = Item.of(itemId, 1);
    var maxStack = Math.max(1, Number(stSample.maxStackSize || 13));
    var rem = Math.round(qty);
    var inserted = 0;
    // Top off existing matching stacks first, then empty slots
    for (var pass = 0; pass < 2 && rem > 0; pass++) {
      for (var s = 0; s < inv.slots && rem > 0; s++) {
        var cur = inv.getStackInSlot(s);
        if (pass === 0 && cur && !cur.empty && String(cur.id) === itemId && Number(cur.count) < maxStack) {
          var add0 = Math.min(rem, maxStack - Number(cur.count));
          inv.setStackInSlot(s, Item.of(itemId, Number(cur.count) + add0));
          rem -= add0;
          inserted += add0;
        } else if (pass === 1 && (!cur || cur.empty)) {
          var add1 = Math.min(rem, maxStack);
          inv.setStackInSlot(s, Item.of(itemId, add1));
          rem -= add1;
          inserted += add1;
        }
      }
    }
    return inserted;
  } catch (eIns) {
    return 0;
  }
}

function lhCountAndExtractFromTerminal(server, termPos, itemId, maxQty, extractNow) {
  if (!server || !termPos) return { loaded: false, count: 0, extracted: 0 };
  try {
    var ow = server.getLevel('minecraft:overworld');
    if (!ow) return { loaded: false, count: 0, extracted: 0 };
    var bp = new LHPos(Math.round(termPos.x), Math.round(termPos.y), Math.round(termPos.z));
    if (!ow.hasChunkAt(bp)) return { loaded: false, count: 0, extracted: 0 };
    var blk = ow.getBlock(bp.x, bp.y, bp.z);
    if (!blk || !blk.inventory) return { loaded: true, count: 0, extracted: 0 };
    var inv = blk.inventory;
    var have = 0;
    for (var s = 0; s < inv.slots; s++) {
      var st = inv.getStackInSlot(s);
      if (st && !st.empty && String(st.id) === itemId) have += Number(st.count);
    }
    if (!extractNow) return { loaded: true, count: have, extracted: 0 };
    var rem = Math.min(have, Math.max(0, Math.round(maxQty || have)));
    var takenTotal = 0;
    for (var s2 = 0; s2 < inv.slots && rem > 0; s2++) {
      var st2 = inv.getStackInSlot(s2);
      if (st2 && !st2.empty && String(st2.id) === itemId) {
        var tk = inv.extractItem(s2, Math.min(rem, Number(st2.count)), false);
        var c = Number(tk.count || 0);
        rem -= c;
        takenTotal += c;
      }
    }
    return { loaded: true, count: have, extracted: takenTotal };
  } catch (eExt) {
    return { loaded: false, count: 0, extracted: 0 };
  }
}

function lhRequestBorderTrade(server, player, opts, dryRun) {
  var st = lhOttdRead(server);
  var lState = lhLogisticsRead(server);
  var myComp = lhGetPlayerCompany(server, player);
  if (!myComp) { if (!dryRun) lhMsg(player, 'Сначала создайте или вступите в компанию.'); return { ok: false, reason: 'no_company' }; }
  var targetCid = opts && opts.targetCid;
  var itemId = opts && opts.itemId;
  var qty = Math.max(1, Math.round(Number((opts && opts.qty) || 1)));
  var side = (opts && opts.side) || 'buy';
  var totalPrice = Math.max(0, Math.round(Number((opts && opts.totalPrice) || 0)));
  var deliveryBonus = Math.max(0, Math.round(Number((opts && opts.deliveryBonus) || 0)));

  if (!targetCid || !st.companies[targetCid]) return { ok: false, reason: 'bad_target' };
  if (side === 'buy' && totalPrice > 0 && myComp.cash < totalPrice) {
    if (!dryRun) lhMsg(player, '§cНедостаточно средств: нужно ' + totalPrice + ' Cr, у компании ' + myComp.cash + ' Cr.');
    return { ok: false, reason: 'no_cash', cost: totalPrice };
  }
  var res = global.LHTradeLogistics.requestBorderTradePass(lState, st, lhId(player), myComp.id, targetCid, player.x, player.z, {
    side: side,
    orderId: opts.orderId || null,
    deliveryId: opts.deliveryId || null,
    itemId: itemId,
    qty: qty,
    totalPrice: totalPrice,
    deliveryBonus: deliveryBonus
  }, LHOTTDTick);
  if (!res.ok) {
    if (!dryRun && res.reason === 'not_at_border') {
      var tTerm = lhGetCompanyTerminalBlockPos(server, st, targetCid);
      var tComp = st.companies[targetCid];
      lhMsg(player, '§c[Нужна граница] §fЧтобы запросить пропуск к «' + (tComp ? tComp.name : targetCid) +
        '», подойдите к границе их территории (сектор рядом с ' + (tComp ? (tComp.hqSx + ',' + tComp.hqSz) : '?') +
        ', терминал на ' + (tTerm ? (tTerm.x + ', ' + tTerm.y + ', ' + tTerm.z) : '?') + ').');
    }
    return res;
  }
  if (side === 'buy' && totalPrice > 0 && !opts.alreadyPaid) {
    myComp.cash -= totalPrice;
    st.companies[targetCid].cash += totalPrice;
    myComp.stats.tradeVolume = (myComp.stats.tradeVolume || 0) + totalPrice;
    st.companies[targetCid].stats.tradeVolume = (st.companies[targetCid].stats.tradeVolume || 0) + totalPrice;
    if (opts.orderObj && opts.orderObj.remainingBatches > 0) opts.orderObj.remainingBatches -= 1;
  }
  lhEnsureCompanyTerminalBuilt(server, st, targetCid);
  lhOttdSave(server);
  lhLogisticsSave(server);
  if (!dryRun) {
    var tp = res.pass;
    var tgtName = st.companies[targetCid].name;
    lhMsg(player, '§a[Торговый пропуск ' + tp.id + '] §fВыдан временный пропуск на 10 мин по территории «' + tgtName +
      '»! Дойдите до терминала §e(' + tp.terminal.x + ', ' + tp.terminal.y + ', ' + tp.terminal.z + ')§f, ' +
      (side === 'buy' ? ('заберите ' + qty + '× ' + itemId) : ('положите ' + qty + '× ' + itemId)) +
      ' в бочку-терминал и покиньте территорию! §c(Добыча/сбор/убийство мирных мобов всё ещё штрафуются!)');
  }
  return res;
}

function lhFinalizeTradePassOnLeave(server, player, targetCid) {
  var st = lhOttdRead(server);
  var lState = lhLogisticsRead(server);
  var pid = lhId(player);
  var active = global.LHTradeLogistics.getActiveBorderPass(lState, pid, targetCid, LHOTTDTick);
  if (!active) return null;

  if (active.side === 'sell') {
    // Check live container if loaded right now and drain sold goods
    var ext = lhCountAndExtractFromTerminal(server, active.terminal, active.itemId, active.qty, true);
    if (ext.loaded && ext.extracted > 0) {
      active.depositedQty = ext.extracted;
    } else if (!ext.loaded && active.depositedQty > 0) {
      // Queue deferred drain if container chunk unloaded while walking away
      if (!lState.pendingTerminalDrains) lState.pendingTerminalDrains = [];
      lState.pendingTerminalDrains.push({
        terminal: active.terminal,
        itemId: active.itemId,
        qty: active.depositedQty
      });
    }
  }
  var compRes = global.LHTradeLogistics.completeBorderTradeOnLeave(lState, st, pid, targetCid);
  lhOttdSave(server);
  lhLogisticsSave(server);
  if (compRes && compRes.ok && compRes.finalized) {
    if (compRes.side === 'sell') {
      lhUnlock(player, 'longhaul:openttd/trade');
      lhMsg(player, '§a§l[Сделка завершена] §fВы покинули территорию «' + st.companies[targetCid].name +
        '»: ' + compRes.qty + '× ' + active.itemId + ' изъяты из терминала, на баланс зачислено §e+' + compRes.payout + ' Cr' +
        (compRes.bonusCredit > 0 ? (' §7(в т.ч. +' + compRes.bonusCredit + ' Cr за самодоставку)') : '') + '!');
    } else {
      lhUnlock(player, 'longhaul:openttd/trade');
      lhMsg(player, '§a§l[Покупка завершена] §fВы благополучно покинули территорию «' + st.companies[targetCid].name + '» с грузом.');
    }
  } else if (compRes && compRes.ok) {
    lhMsg(player, '§e[Пропуск закрыт] §fВы покинули территорию «' + st.companies[targetCid].name + '» без завершения загрузки.');
  }
  return compRes;
}

function lhMarketSell(server, player, orderId, dryRun) {
  var st = lhOttdRead(server);
  var myComp = lhGetPlayerCompany(server, player);
  if (!myComp) { if (!dryRun) lhMsg(player, 'Сначала создайте или вступите в компанию.'); return 0; }
  var order = null;
  for (var i = 0; i < st.marketOrders.length; i++) {
    if (st.marketOrders[i].id === orderId) { order = st.marketOrders[i]; break; }
  }
  if (!order || order.side !== 'buy' || order.remainingBatches <= 0) {
    if (!dryRun) lhMsg(player, 'Заказ на скупку ' + orderId + ' не найден или исчерпан.');
    return 0;
  }
  if (order.companyId === myComp.id) {
    if (!dryRun) lhMsg(player, 'Нельзя торговать со своим же заказом.');
    return 0;
  }
  var buyer = st.companies[order.companyId];
  if (!buyer || buyer.cash < order.price) {
    if (!dryRun) lhMsg(player, 'У компании-покупателя недостаточно средств.');
    return 0;
  }
  var isSubsidy = st.subsidy && st.subsidy.item === order.item && st.subsidy.companyId === order.companyId;
  var bonusMult = isSubsidy ? 1.75 : 1.20;
  var econ = lhEconRead(server);
  var marketInfo = global.LHEconomyEngine
    ? global.LHEconomyEngine.getMarketQuote(econ, order.item)
    : null;
  var marketMult = marketInfo ? Math.max(0.18, Math.min(2.40, marketInfo.multiplier)) : 1.0;
  var repScore = global.LHOpenTTD.getEffectiveRelationScore(st, myComp.id, lhId(player), order.companyId);
  var repPricing = global.LHOpenTTD.getReputationPriceModifiers(repScore);
  var payout = Math.max(1, Math.round(order.price * bonusMult * marketMult * repPricing.sellMult));
  if (typeof lhOriginFeeMult === 'function') {
    var feeMult = lhOriginFeeMult(player);
    if (feeMult > 1.0) payout = Math.max(1, Math.round(payout / feeMult));
  }

  if (!dryRun) {
    // Live mode: no instant remote item teleport! Require border visit pass OR Delivery Desk at own terminal
    var sTerm = lhGetCompanyTerminalBlockPos(server, st, myComp.id);
    var bTerm = lhGetCompanyTerminalBlockPos(server, st, order.companyId);
    var dist = global.LHTradeLogistics.computeDistance(sTerm.x, sTerm.z, bTerm.x, bTerm.z);
    var vol = global.LHTradeLogistics.computeCargoVolume(order.qty, 13);
    var delivBonus = global.LHTradeLogistics.computeSelfDeliveryReward(dist, vol);
    var passRes = lhRequestBorderTrade(server, player, {
      targetCid: order.companyId,
      side: 'sell',
      orderId: order.id,
      itemId: order.item,
      qty: order.qty,
      totalPrice: payout,
      deliveryBonus: delivBonus
    }, false);
    if (passRes.ok) {
      order.remainingBatches -= 1;
      lhOttdSave(server);
      return payout;
    }
    lhMsg(player, '§e[Доставка / Граница] §fПодойдите к границе «' + buyer.name + '» для прохода к их терминалу, либо выберите «Поручить доставку покупателю» во вкладке §6Доставка§f своего терминала!');
    return 0;
  }

  var cons = lhConsumeInvItem(player.inventory, order.item, order.qty);
  if (!cons.ok) return 0;
  if (global.LHEconomyEngine) global.LHEconomyEngine.recordTradePressure(econ, order.item, 'sell', order.qty);
  buyer.cash -= order.price;
  myComp.cash += payout;
  myComp.stats.tradeVolume = (myComp.stats.tradeVolume || 0) + payout;
  buyer.stats.tradeVolume = (buyer.stats.tradeVolume || 0) + order.price;
  order.remainingBatches -= 1;
  lhOttdSave(server);
  lhEconSave(server);
  return payout;
}

function lhMarketBuy(server, player, orderId, dryRun) {
  var st = lhOttdRead(server);
  var myComp = lhGetPlayerCompany(server, player);
  if (!myComp) { if (!dryRun) lhMsg(player, 'Сначала создайте или вступите в компанию.'); return 0; }
  var order = null;
  for (var i = 0; i < st.marketOrders.length; i++) {
    if (st.marketOrders[i].id === orderId) { order = st.marketOrders[i]; break; }
  }
  if (!order || order.side !== 'sell' || order.remainingBatches <= 0) {
    if (!dryRun) lhMsg(player, 'Товар ' + orderId + ' не найден или раскуплен.');
    return 0;
  }
  if (order.companyId === myComp.id) {
    if (!dryRun) lhMsg(player, 'Это ваш собственный лот.');
    return 0;
  }
  var seller = st.companies[order.companyId];
  var econ = lhEconRead(server);
  var marketInfo = global.LHEconomyEngine
    ? global.LHEconomyEngine.getMarketQuote(econ, order.item)
    : null;
  var marketMult = marketInfo ? Math.max(0.24, Math.min(2.40, marketInfo.multiplier)) : 1.0;
  var taxFree = global.LHOpenTTD.hasPact(st, myComp.id, order.companyId);
  var repScore = global.LHOpenTTD.getEffectiveRelationScore(st, myComp.id, lhId(player), order.companyId);
  var repPricing = global.LHOpenTTD.getReputationPriceModifiers(repScore);
  var baseBuy = Math.max(1, Math.round(order.price * marketMult * repPricing.buyMult));
  var totalCost = taxFree ? baseBuy : Math.round(baseBuy * 1.10);
  if (myComp.cash < totalCost) {
    if (!dryRun) lhMsg(player, 'Недостаточно средств: нужно ' + totalCost + ' Cr, у вас ' + myComp.cash + ' Cr (цена с учётом реп. ×' + repPricing.buyMult + ').');
    return 0;
  }

  if (!dryRun) {
    // Live mode: NEVER teleport items directly into inventory! Require border pass to seller's terminal OR Delivery Desk at own terminal
    var passRes = lhRequestBorderTrade(server, player, {
      targetCid: order.companyId,
      side: 'buy',
      orderId: order.id,
      orderObj: order,
      itemId: order.item,
      qty: order.qty,
      totalPrice: totalCost
    }, false);
    if (passRes.ok) {
      if (global.LHEconomyEngine) global.LHEconomyEngine.recordTradePressure(econ, order.item, 'buy', order.qty);
      lhEconSave(server);
      return totalCost;
    }
    lhMsg(player, '§e[Способ покупки] §fПодойдите к границе «' + (seller ? seller.name : order.companyId) +
      '» и подайте запрос через Планшет, ИЛИ закажите доставку / удержание через вкладку §6Доставка §fу своего терминала!');
    return 0;
  }

  if (global.LHEconomyEngine) global.LHEconomyEngine.recordTradePressure(econ, order.item, 'buy', order.qty);
  myComp.cash -= totalCost;
  if (seller) {
    seller.cash += baseBuy;
    seller.stats.tradeVolume = (seller.stats.tradeVolume || 0) + baseBuy;
  }
  myComp.stats.tradeVolume = (myComp.stats.tradeVolume || 0) + totalCost;
  order.remainingBatches -= 1;
  lhOttdSave(server);
  lhEconSave(server);
  return totalCost;
}

function lhCreateTradeOffer(server, player, targetCid, qty, priceCr, dryRun) {
  var st = lhOttdRead(server);
  var myComp = lhGetPlayerCompany(server, player);
  if (!myComp) { if (!dryRun) lhMsg(player, 'Сначала создайте или вступите в компанию.'); return null; }
  if (!(qty > 0) || !(priceCr > 0)) { if (!dryRun) lhMsg(player, 'Количество и цена должны быть > 0.'); return null; }
  var held = player.mainHandItem;
  if (!held || held.empty) { if (!dryRun) lhMsg(player, 'Возьмите в главную руку предмет, который выставляете на сделку.'); return null; }
  var itemId = String(held.id);
  var cons = lhConsumeInvItem(player.inventory, itemId, qty);
  if (!cons.ok) { if (!dryRun) lhMsg(player, 'В инвентаре недостаточно ' + itemId + ' (нужно ' + qty + ', есть ' + cons.have + ').'); return null; }

  var oid = 't' + (st.nextOrderSeq++);
  var cleanTarget = targetCid === 'any' ? 'any' : global.LHOpenTTD.sanitizeId(targetCid);
  var offer = {
    id: oid,
    sellerCompany: myComp.id,
    targetCompany: cleanTarget,
    item: itemId,
    qty: qty,
    price: priceCr,
    status: 'open'
  };
  st.tradeOffers.push(offer);
  lhOttdSave(server);
  if (!dryRun) {
    var plist = server.players || [];
    for (var i = 0; i < plist.length; i++) {
      plist[i].tell('§e[Сделка ' + oid + '] §f' + myComp.name + ' предлагает ' + qty + '× ' + itemId + ' за ' + priceCr + ' Cr (' +
        (cleanTarget === 'any' ? 'для любой компании' : 'для ' + cleanTarget) + '). Принять: /lh trade accept ' + oid);
    }
  }
  return offer;
}

function lhCompanySpeedBps(comp) {
  var sp = comp && comp.transportSpec ? String(comp.transportSpec) : 'road';
  if (sp === 'air') return 24.0;
  if (sp === 'rail') return 12.0;
  if (sp === 'underground') return 8.0;
  if (sp === 'sea') return 5.5;
  return 1.04;
}

function lhAcceptTradeOffer(server, player, offerId, dryRun) {
  var st = lhOttdRead(server);
  var myComp = lhGetPlayerCompany(server, player);
  if (!myComp) { if (!dryRun) lhMsg(player, 'Сначала вступите в компанию.'); return 0; }
  var offer = null;
  for (var i = 0; i < st.tradeOffers.length; i++) {
    if (st.tradeOffers[i].id === offerId && st.tradeOffers[i].status === 'open') { offer = st.tradeOffers[i]; break; }
  }
  if (!offer) { if (!dryRun) lhMsg(player, 'Сделка ' + offerId + ' не найдена или уже закрыта.'); return 0; }
  if (offer.sellerCompany === myComp.id) { if (!dryRun) lhMsg(player, 'Нельзя принять собственное предложение.'); return 0; }
  if (offer.targetCompany !== 'any' && offer.targetCompany !== myComp.id) {
    if (!dryRun) lhMsg(player, 'Эта сделка адресована компании ' + offer.targetCompany + '.');
    return 0;
  }
  var repScoreT = global.LHOpenTTD.getEffectiveRelationScore(st, myComp.id, lhId(player), offer.sellerCompany);
  var repPricingT = global.LHOpenTTD.getReputationPriceModifiers(repScoreT);
  var finalOfferPrice = Math.max(1, Math.round(offer.price * repPricingT.buyMult));
  var seller = st.companies[offer.sellerCompany];
  if (dryRun) {
    if (myComp.cash < finalOfferPrice) return 0;
    myComp.cash -= finalOfferPrice;
    if (seller) {
      seller.cash += finalOfferPrice;
      seller.stats.tradeVolume = (seller.stats.tradeVolume || 0) + finalOfferPrice;
    }
    myComp.stats.tradeVolume = (myComp.stats.tradeVolume || 0) + finalOfferPrice;
    offer.status = 'completed';
    lhOttdSave(server);
    return 1;
  }
  var logSt = lhLogisticsRead(server);
  var buyerTerm = lhEnsureCompanyTerminalBuilt(server, st, myComp);
  if (seller) lhEnsureCompanyTerminalBuilt(server, st, seller);
  var delivRes = global.LHTradeLogistics
    ? global.LHTradeLogistics.createBuyOrderDelivery(logSt, st, myComp.id, offer.sellerCompany, offer.item, offer.qty, finalOfferPrice, lhCompanySpeedBps(seller || myComp), LHOTTDTick)
    : { ok: false, reason: 'no_logistics' };
  if (!delivRes.ok) {
    lhMsg(player, '§cНе хватает средств для сделки с доставкой: нужно ' + (delivRes.cost || finalOfferPrice) + ' Cr (вкл. доставку ' + (delivRes.fee || 0) + ' Cr).');
    return 0;
  }
  offer.status = 'completed';
  lhLogisticsSave(server);
  lhOttdSave(server);
  lhUnlock(player, 'longhaul:openttd/trade');
  var del = delivRes.delivery;
  var etaSec = Math.max(1, Math.round((delivRes.durationTicks || 200) / 20));
  lhMsg(player, '§a[Сделка ' + offer.id + '] Куплено ' + offer.qty + '× ' + offer.item + ' за ' + finalOfferPrice +
    ' Cr + доставка ' + delivRes.deliveryFee + ' Cr. §eДоставка ' + del.id + ' (' + etaSec + 'с @ ' + del.speedBps +
    ' м/с) в терминал (' + Math.round(buyerTerm.x) + ',' + Math.round(buyerTerm.y) + ',' + Math.round(buyerTerm.z) + ')!');
  return 1;
}

function lhSpawnBotMobRaids(server, st) {
  if (!server || !st || !Array.isArray(st.activeMobRaids)) return 0;
  var spawnedRaids = 0;
  for (var i = 0; i < st.activeMobRaids.length; i++) {
    var raid = st.activeMobRaids[i];
    if (!raid || raid.status !== 'active' || raid.spawnedInWorld) continue;
    var dim = raid.dimension || 'minecraft:overworld';
    var lvl = server.getLevel(dim);
    if (!lvl) continue;
    var rx = Math.round(Number(raid.x || raid.sx * 256));
    var rz = Math.round(Number(raid.z || raid.sz * 256));
    var ry = 72;
    if (typeof lhFindSafeRespawnY === 'function' && dim === 'minecraft:overworld') {
      var sy = lhFindSafeRespawnY(lvl, rx, rz, true);
      if (sy > 50) ry = sy;
    }
    var pos = new LHPos(rx, ry, rz);
    if (!lvl.hasChunkAt(pos)) continue;

    var count = Math.max(2, Math.min(8, Number(raid.mobCount || 4)));
    var roster = raid.mobRoster || ['minecraft:pillager', 'minecraft:vindicator'];
    for (var m = 0; m < count; m++) {
      var mobId = roster[m % roster.length];
      var ang = (Math.PI * 2 * m) / count;
      var sx = Math.round(rx + Math.cos(ang) * 6);
      var sz = Math.round(rz + Math.sin(ang) * 6);
      var nbtStr = JSON.stringify({
        Tags: ['lh_bot_raid_mob', 'lh_raid_' + raid.id],
        PersistenceRequired: 0,
        CustomName: JSON.stringify({ text: (raid.isPirateRaid ? 'Корсар «' : 'Рейдер «') + (raid.attackerName || raid.attackerCid) + '»', color: raid.isPirateRaid ? 'gold' : 'dark_red' }),
        CustomNameVisible: 1
      });
      server.runCommandSilent('execute in ' + dim + ' run summon ' + mobId + ' ' + sx + ' ' + ry + ' ' + sz + ' ' + nbtStr);
    }
    raid.spawnedInWorld = true;
    spawnedRaids++;
    var plist = server.players || [];
    for (var pi = 0; pi < plist.length; pi++) {
      var pl = plist[pi];
      var pc = lhGetPlayerCompany(server, pl);
      if (pc && pc.id === raid.targetCid) {
        lhMsg(pl, (raid.isPirateRaid ? '§6§l[ПИРАТСКИЙ НАБЕГ · ' : '§c§l[БОТ-РЕЙД · ') + raid.id + '] §f' +
          (raid.attackerName || raid.attackerCid) + ' высадил отряд (' + count + '×) на ваш сектор (' + raid.sx + ', ' + raid.sz + ')!');
      }
    }
  }
  return spawnedRaids;
}

function lhBotTick(server, dryRun) {
  var st = lhOttdRead(server);
  var ow = server ? server.getLevel('minecraft:overworld') : null;
  var borderSize = (ow && ow.worldBorder && Number(ow.worldBorder.size) > 0) ? Number(ow.worldBorder.size) : 724;
  var maxSectorAbs = Math.max(1, Math.floor((borderSize / 2) / global.LHOpenTTD.SECTOR_SIZE));

  // Sync completed chapters from territory progression and spawn new bot companies every 2nd chapter
  try {
    if (typeof lhTerritoryCounts === 'function') {
      var tCounts = lhTerritoryCounts(server);
      if (tCounts && typeof tCounts.unlocked === 'number' && global.LHOpenTTD.onChapterCompletedBotSpawn) {
        var chDone = Math.max(0, tCounts.unlocked - 1);
        var spRes = global.LHOpenTTD.onChapterCompletedBotSpawn(st, chDone, maxSectorAbs);
        if (!dryRun && spRes && spRes.spawned && spRes.spawned.length > 0 && typeof lhLogEvent === 'function') {
          spRes.spawned.forEach(function (nb) {
            lhLogEvent(server, 'bot', 'Новая бот-компания «' + nb.name + '» [' + (nb.archetypeName || nb.archetype) + '] вышла на рынок!', { chatMode: 'important' });
          });
        }
      }
    }
  } catch (eCh) {}

  var expansions = global.LHOpenTTD.botExpandStep(st, maxSectorAbs);

  // Process Central Bank loans & key rate updates
  if (global.LHOpenTTD.tickBankLoans) {
    var loanEvs = global.LHOpenTTD.tickBankLoans(st, LHOTTDTick);
    if (!dryRun && loanEvs && loanEvs.length > 0 && typeof lhLogEvent === 'function') {
      loanEvs.forEach(function (le) {
        if (le.type === 'loan_default') {
          lhLogEvent(server, 'market', 'Дефолт по кредиту ' + le.companyId + ' (' + le.debt + ' Cr)! Активы выставлены на аукцион (' + le.auctionsCreated + ').', { chatMode: 'important' });
        }
      });
    }
  }

  if (st.botCycle % 4 === 0) {
    global.LHOpenTTD.refreshBotOrders(st);
    global.LHOpenTTD.refreshBotSupplyContracts(st);
    var underdogSub = global.LHOpenTTD.selectDynamicSubsidyTarget ? global.LHOpenTTD.selectDynamicSubsidyTarget(st) : null;
    if (underdogSub) {
      if (!dryRun && typeof lhLogEvent === 'function') {
        var uName = st.companies[underdogSub.companyId] ? st.companies[underdogSub.companyId].name : underdogSub.companyId;
        lhLogEvent(server, 'market', 'Антикризисная субсидия отстающей компании: ' + uName + ' (+35% выпуск, −40% доставка, −50% топливо)', { chatMode: 'never' });
      }
    } else {
      var buyOrders = st.marketOrders.filter(function (o) { return o.isBot && o.side === 'buy'; });
      if (buyOrders.length > 0) {
        var pick = buyOrders[Math.floor(Math.random() * buyOrders.length)];
        st.subsidy = { companyId: pick.companyId, item: pick.item, orderId: pick.id, sx: st.companies[pick.companyId] ? st.companies[pick.companyId].hqSx : 0, sz: st.companies[pick.companyId] ? st.companies[pick.companyId].hqSz : 0 };
        if (!dryRun && typeof lhLogEvent === 'function') {
          var bName = st.companies[pick.companyId] ? st.companies[pick.companyId].name : pick.companyId;
          lhLogEvent(server, 'market', 'Субсидия Консорциума: ' + bName + ' (+35% выпуск, −40% доставка, ×1.75 за ' + pick.item + ')', { chatMode: 'never' });
        }
      }
    }
  }
  if (!dryRun) {
    lhSyncBuildingPhysicalContainers(server, st);
    lhSpawnBotMobRaids(server, st);
    if (expansions.length > 0 && typeof lhLogEvent === 'function') {
      expansions.forEach(function (ev) {
        if (ev.type === 'bot_mob_raid') {
          lhLogEvent(server, 'raid', '«' + ev.botName + '» начала враждебный рейд на сектор (' + ev.sx + ', ' + ev.sz + ')!', { chatMode: 'important' });
        } else if (ev.type === 'bot_build') {
          lhLogEvent(server, 'bot', '«' + ev.botName + '» построила объект ' + ev.buildingType + ' в (' + ev.sx + ', ' + ev.sz + ').', { chatMode: 'never' });
        } else {
          lhLogEvent(server, 'bot', 'Компания «' + ev.botName + '» расширилась в сектор (' + ev.sx + ', ' + ev.sz + ').', { chatMode: 'never' });
        }
      });
    }
  }
  lhOttdSave(server);
  return expansions;
}

function lhClearLegacyMinimapHud(player) {
  if (!player || typeof player.paint !== 'function') return;
  try {
    player.paint({ '*': { remove: true } });
  } catch (eClr) {}
}

var LH_XAERO_COLOR_RGB = {
  red: 0xEF4444,
  blue: 0x3B82F6,
  green: 0x22C55E,
  yellow: 0xEAB308,
  aqua: 0x06B6D4,
  light_purple: 0xD946EF,
  gold: 0xF59E0B,
  white: 0xE5E7EB
};

function lhSyncXaeroTerritories(server, targetPlayer) {
  if (!server || !global.LHOpenTTD) return false;
  var st = lhOttdRead(server);
  var borderHalf = 362;
  try {
    if (typeof lhTerritoryCounts === 'function') {
      borderHalf = Math.max(32, Math.floor(Number(lhTerritoryCounts(server).size || 724) / 2));
    } else {
      var ow = server.getLevel('minecraft:overworld');
      if (ow && ow.worldBorder && Number(ow.worldBorder.size) > 0) {
        borderHalf = Math.max(32, Math.floor(Number(ow.worldBorder.size) / 2));
      }
    }
  } catch (eB) {}

  var plist = targetPlayer ? [targetPlayer] : (server.players || []);
  for (var pi = 0; pi < plist.length; pi++) {
    var p = plist[pi];
    if (!p || typeof p.sendData !== 'function') continue;
    var pid = lhId(p);
    var pref = (st.minimapPrefs && st.minimapPrefs[pid]) ? st.minimapPrefs[pid] : { enabled: true };
    var myComp = lhGetPlayerCompany(server, p);
    var myCid = myComp ? myComp.id : '';
    var claimsOut = [];

    if (pref.enabled !== false) {
      var claimKeys = Object.keys(st.claims || {});
      for (var ci = 0; ci < claimKeys.length; ci++) {
        var cl = st.claims[claimKeys[ci]];
        if (!cl || !cl.owner) continue;
        var comp = st.companies ? st.companies[cl.owner] : null;
        var cColor = (comp && comp.color && LH_XAERO_COLOR_RGB[comp.color]) ? LH_XAERO_COLOR_RGB[comp.color] : 0xFACC15;
        var rel = 'neutral';
        if (myCid && myCid === cl.owner) {
          rel = 'self';
        } else if (myCid) {
          var dip = global.LHOpenTTD.getDiplomacy ? global.LHOpenTTD.getDiplomacy(st, myCid, cl.owner) : null;
          if (dip && dip.allied) rel = 'ally';
          else if (!global.LHOpenTTD.canTransit(st, myCid, cl.owner)) rel = 'hostile';
        } else {
          rel = 'hostile';
        }
        var bldg = global.LHOpenTTD.getSectorBuilding(st, cl.sx, cl.sz, cl.dimension || 'minecraft:overworld');
        var bName = '';
        if (bldg) {
          if (bldg.variantName) bName = bldg.variantName;
          else if (bldg.structureName) bName = bldg.structureName;
          else if (global.LHOpenTTD.BUILDING_CATALOG && global.LHOpenTTD.BUILDING_CATALOG[bldg.type]) {
            bName = global.LHOpenTTD.BUILDING_CATALOG[bldg.type].name;
          }
        }
        claimsOut.push({
          sx: Number(cl.sx),
          sz: Number(cl.sz),
          dim: String(cl.dimension || 'minecraft:overworld'),
          owner: String(cl.owner),
          name: comp ? String(comp.name) : String(cl.owner),
          color: cColor,
          rel: rel,
          bldg: bName
        });
      }
    }

    try {
      p.sendData('lh:xaero_territories', {
        json: JSON.stringify({
          enabled: pref.enabled !== false,
          borderHalf: borderHalf,
          myCid: myCid,
          claims: claimsOut
        })
      });
    } catch (eSend) {}
  }
  return true;
}

function lhSyncMinimapHud(server, player, forceClear) {
  if (!server || !player) return false;
  if (forceClear) lhClearLegacyMinimapHud(player);
  return lhSyncXaeroTerritories(server, player);
}

var LHLastPlayerSector = {};

function lhGetChapterProgress(server, st) {
  var total = 61;
  var done = (st && st.completedChapters) ? Number(st.completedChapters) : 0;
  try {
    if (typeof lhTerritoryCounts === 'function') {
      var info = lhTerritoryCounts(server);
      total = Number(info.total || 61);
      done = Math.max(done, Number(info.unlocked || 0));
    }
  } catch (eCp) {}
  return { completed: done, total: total };
}

function lhEndgameBuyoutCmd(server, player, targetCid) {
  var st = lhOttdRead(server);
  var myComp = lhGetPlayerCompany(server, player);
  if (!myComp) { lhMsg(player, 'Сначала создайте компанию.'); return { ok: false, reason: 'no_company' }; }
  var prog = lhGetChapterProgress(server, st);
  var res = global.LHOpenTTD.companyMerge(st, targetCid, myComp.id, {
    completedChapters: prog.completed,
    totalChapters: prog.total,
    nowTick: LHOTTDTick
  });
  if (!res.ok) {
    if (res.reason === 'player_merge_disabled') {
      lhMsg(player, '§e[Эндгейм-выкуп] Закрыто глав: §c' + res.completedChapters + '/' + res.requiredChapters +
        ' §7(нужно 4/5 от ' + res.totalChapters + '). Пока выкуп игроков запрещён — можно покупать до 49% акций.');
    } else if (res.reason === 'no_cash_for_buyout') {
      lhMsg(player, '§c[Эндгейм-выкуп] Не хватает средств: нужно ' + res.cost + ' Cr (у компании ' + res.cash + ' Cr).');
    } else {
      lhMsg(player, '§cВыкуп не удался: ' + res.reason);
    }
    return res;
  }
  lhOttdSave(server);
  lhSyncXaeroTerritories(server, player);
  if (res.endgameVictory) {
    lhUnlock(player, 'longhaul:openttd/empire');
    var v = res.endgameVictory;
    var winTxt = '§6★ [ФИНАЛ ПРОХОЖДЕНИЯ] Компания ' + myComp.colorCode + v.winnerName +
      ' §6выкупила корпорацию «' + v.absorbedName + '» за §e' + v.buyoutPrice +
      ' Cr §6(' + v.completedChapters + '/' + v.totalChapters + ' глав закрыто) и объединила экономику мира!';
    if (typeof lhLogEvent === 'function') lhLogEvent(server, 'chapter', winTxt, { chatMode: 'important' });
    (server.players || []).forEach(function (pl) { lhMsg(pl, winTxt); });
  } else {
    lhMsg(player, '§aПоглощена компания ' + targetCid + '!');
  }
  return res;
}

function lhConsumeOneVehicleItemFromPlayer(player, preferredType) {
  if (!player || !global.LHTradeLogistics) return null;
  var hand = player.mainHandItem;
  if (hand && !hand.empty) {
    var hId = String(hand.id);
    var vtH = global.LHTradeLogistics.matchVehicleItem(hId, preferredType);
    if (vtH && (!preferredType || vtH === preferredType)) {
      hand.count -= 1;
      return { itemId: hId, vehicleType: vtH };
    }
  }
  var inv = player.inventory;
  if (inv && typeof inv.getContainerSize === 'function') {
    var sz = inv.getContainerSize();
    for (var i = 0; i < sz; i++) {
      var st = inv.getItem(i);
      if (!st || st.empty) continue;
      var sId = String(st.id);
      var vtS = global.LHTradeLogistics.matchVehicleItem(sId, preferredType);
      if (vtS && (!preferredType || vtS === preferredType)) {
        st.count -= 1;
        return { itemId: sId, vehicleType: vtS };
      }
    }
  }
  return null;
}

function lhCreateConvoyFromHand(server, player, preferredType) {
  var st = lhOttdRead(server);
  var logSt = lhLogisticsRead(server);
  var myComp = lhGetPlayerCompany(server, player);
  if (!myComp) { lhMsg(player, 'Сначала создайте компанию.'); return { ok: false, reason: 'no_company' }; }
  var spec = preferredType ? global.LHTradeLogistics.VEHICLE_FLEET_SPECS[preferredType] : null;
  var taken = lhConsumeOneVehicleItemFromPlayer(player, preferredType);
  if (!taken) {
    var hint = spec ? spec.acceptedItems.slice(0, 3).join(', ') : 'automobility:automobile, smallships:oak_cog, minecraft:oak_boat, create:track, immersive_aircraft:airship';
    lhMsg(player, '§eВозьмите транспортный предмет в руку или инвентарь! Подходит: §f' + hint);
    return { ok: false, reason: 'no_vehicle_item' };
  }
  var res = global.LHTradeLogistics.registerCompanyConvoy(logSt, st, myComp.id, taken.vehicleType, taken.itemId, { nowTick: LHOTTDTick });
  if (!res.ok) { lhMsg(player, '§cОшибка регистрации конвоя: ' + res.reason); return res; }
  lhLogisticsSave(server);
  var c = res.convoy;
  lhMsg(player, '§a[Конвой ' + c.id + '] Зарегистрирован: §f' + c.name + ' §7(из ' + c.itemId + ') §e| Скорость: ' +
    c.speedBps + ' м/с | Вместимость: ' + c.capacity + ' шт.');
  return res;
}

function lhCreateConvoyRouteCmd(server, player, vehicleType, srcSx, srcSz, dstSx, dstSz, waypoints, qty, opts) {
  var st = lhOttdRead(server);
  var logSt = lhLogisticsRead(server);
  var myComp = lhGetPlayerCompany(server, player);
  if (!myComp) { lhMsg(player, 'Сначала создайте компанию.'); return { ok: false, reason: 'no_company' }; }
  var dim = (player.level && player.level.dimension) ? String(player.level.dimension) : 'minecraft:overworld';
  var res = global.LHTradeLogistics.createConvoyRoute(logSt, st, myComp.id, srcSx, srcSz, dstSx, dstSz, vehicleType, 'auto', qty || 16, {
    srcDim: (opts && opts.srcDim) || dim,
    dstDim: (opts && opts.dstDim) || dim,
    waypoints: waypoints || [],
    autoRelay: !!(opts && opts.autoRelay),
    convoyId: opts && opts.convoyId,
    requireInfra: true,
    nowTick: LHOTTDTick
  });
  if (!res.ok) {
    if (res.reason === 'missing_src_infra' || res.reason === 'missing_dst_infra' || res.reason === 'missing_waypoint_infra') {
      lhMsg(player, '§c[Нет инфраструктуры в (' + res.sx + ',' + res.sz + ')] Для транспорта §f' + vehicleType +
        ' §cнужно построить рядом: §e' + (res.required || []).join(' или '));
    } else if (res.reason === 'relay_embargo') {
      lhMsg(player, '§cТранзит через завод компании ' + res.owner + ' в (' + res.sx + ',' + res.sz + ') заблокирован (низкие отношения)!');
    } else {
      lhMsg(player, '§cОшибка маршрута конвоя: ' + res.reason);
    }
    return res;
  }
  lhLogisticsSave(server);
  var r = res.route;
  var pathStr = (r.pathNodes || []).map(function (n) { return '(' + n.sx + ',' + n.sz + ')'; }).join(' → ');
  lhMsg(player, '§a[Маршрут ' + r.id + ' · ' + r.vehicleType + '] Путь: §f' + pathStr +
    ' §7| Дистанция: §e' + r.totalDistanceBlocks + ' м §7/ §b' + r.speedBps + ' м/с §7= §a' + r.travelSeconds + ' сек.');
  return res;
}

function lhDetectBiomeId(player) {
  try {
    if (!player || !player.level || typeof player.blockPosition !== 'function') return null;
    var holder = player.level.getBiome(player.blockPosition());
    if (holder && typeof holder.unwrapKey === 'function') {
      var opt = holder.unwrapKey();
      if (opt && typeof opt.isPresent === 'function' && opt.isPresent()) {
        return String(opt.get().location());
      }
    }
  } catch (eBio) {}
  return null;
}

function lhRgbFloatTriple(hexColor) {
  var r = ((hexColor >> 16) & 0xFF) / 255;
  var g = ((hexColor >> 8) & 0xFF) / 255;
  var b = (hexColor & 0xFF) / 255;
  return (Math.round(r * 100) / 100) + ' ' + (Math.round(g * 100) / 100) + ' ' + (Math.round(b * 100) / 100);
}

function lhRenderWorldBorders(server) {
  if (!server || !global.LHOpenTTD) return;
  var st = lhOttdRead(server);
  var plist = server.players || [];
  if (!plist.length) return;
  var borderHalf = 362;
  try {
    if (typeof lhTerritoryCounts === 'function') {
      borderHalf = Math.max(32, Math.floor(Number(lhTerritoryCounts(server).size || 724) / 2));
    }
  } catch (eB) {}

  for (var pi = 0; pi < plist.length; pi++) {
    var p = plist[pi];
    if (!p || (typeof p.isSpectator === 'function' && p.isSpectator())) continue;
    var pid = lhId(p);
    var uname = String(p.username || '');
    if (!uname) continue;
    var dim = (p.level && p.level.dimension) ? String(p.level.dimension) : 'minecraft:overworld';
    var px = Number(p.x || 0), py = Number(p.y || 70), pz = Number(p.z || 0);
    var sc = global.LHOpenTTD.sectorCoords(px, pz);
    var myComp = lhGetPlayerCompany(server, p);
    var myCid = myComp ? myComp.id : null;

    // ActionBar notification when crossing a sector boundary
    var curKey = dim + ':' + sc.sx + ',' + sc.sz;
    if (LHLastPlayerSector[pid] && LHLastPlayerSector[pid] !== curKey) {
      var curInfo = global.LHOpenTTD.resolveSectorOwner(st, sc.sx, sc.sz, dim);
      if (curInfo.kind === 'claimed' && curInfo.owner) {
        var oComp = st.companies[curInfo.owner];
        var passOk = !myCid || myCid === curInfo.owner || global.LHOpenTTD.canTransit(st, myCid, curInfo.owner);
        var bMsg = (oComp ? (oComp.colorCode + oComp.name) : curInfo.owner) + ' §7(' + sc.sx + ', ' + sc.sz + ') ' +
          (curInfo.owner === myCid ? '§a[Ваш сектор]' : (passOk ? '§e[Проход открыт]' : '§c[НЕТ ПРОПУСКА!]'));
        try { if (typeof p.setStatusMessage === 'function') p.setStatusMessage(Text.of(bMsg)); } catch (eSm) {}
      } else if (dim === 'minecraft:overworld' && global.LHOpenTTD.isSpawnSanctuarySector && global.LHOpenTTD.isSpawnSanctuarySector(sc.sx, sc.sz)) {
        try { if (typeof p.setStatusMessage === 'function') p.setStatusMessage(Text.of('§bЗаповедник спауна 3×3 §7(' + sc.sx + ', ' + sc.sz + ')')); } catch (eSm2) {}
      } else {
        try { if (typeof p.setStatusMessage === 'function') p.setStatusMessage(Text.of('§7Свободный сектор (' + sc.sx + ', ' + sc.sz + ')')); } catch (eSm3) {}
      }
    }
    LHLastPlayerSector[pid] = curKey;

    var pref = (st.minimapPrefs && st.minimapPrefs[pid]) ? st.minimapPrefs[pid] : { enabled: true, worldBorders: true };
    if (pref.worldBorders === false) continue;

    var half = global.LHOpenTTD.SECTOR_SIZE / 2;
    var minX = sc.sx * global.LHOpenTTD.SECTOR_SIZE - half;
    var maxX = minX + global.LHOpenTTD.SECTOR_SIZE;
    var minZ = sc.sz * global.LHOpenTTD.SECTOR_SIZE - half;
    var maxZ = minZ + global.LHOpenTTD.SECTOR_SIZE;

    var edges = [
      { axis: 'x', coord: minX, nsx: sc.sx - 1, nsz: sc.sz },
      { axis: 'x', coord: maxX, nsx: sc.sx + 1, nsz: sc.sz },
      { axis: 'z', coord: minZ, nsx: sc.sx, nsz: sc.sz - 1 },
      { axis: 'z', coord: maxZ, nsx: sc.sx, nsz: sc.sz + 1 }
    ];
    if (dim === 'minecraft:overworld') {
      if (Math.abs(px - (-borderHalf)) <= 44) edges.push({ axis: 'x', coord: -borderHalf, worldBorder: true });
      if (Math.abs(px - borderHalf) <= 44) edges.push({ axis: 'x', coord: borderHalf, worldBorder: true });
      if (Math.abs(pz - (-borderHalf)) <= 44) edges.push({ axis: 'z', coord: -borderHalf, worldBorder: true });
      if (Math.abs(pz - borderHalf) <= 44) edges.push({ axis: 'z', coord: borderHalf, worldBorder: true });
    }

    var infoSelf = global.LHOpenTTD.resolveSectorOwner(st, sc.sx, sc.sz, dim);
    for (var ei = 0; ei < edges.length; ei++) {
      var ed = edges[ei];
      var distToEdge = ed.axis === 'x' ? Math.abs(px - ed.coord) : Math.abs(pz - ed.coord);
      if (distToEdge > 42) continue;

      var hexCol = null;
      if (ed.worldBorder) {
        hexCol = 0xEF4444;
      } else {
        var infoOther = global.LHOpenTTD.resolveSectorOwner(st, ed.nsx, ed.nsz, dim);
        var ownerA = infoSelf.kind === 'claimed' ? infoSelf.owner : null;
        var ownerB = infoOther.kind === 'claimed' ? infoOther.owner : null;
        if (!ownerA && !ownerB) continue;
        if (ownerA === ownerB) continue;
        var chosenOwner = ownerA || ownerB;
        if (ownerA && ownerB && myCid && ownerA !== myCid && ownerB === myCid) chosenOwner = ownerB;
        var cObj = st.companies[chosenOwner];
        hexCol = (cObj && cObj.color && LH_XAERO_COLOR_RGB[cObj.color]) ? LH_XAERO_COLOR_RGB[cObj.color] : 0xFACC15;
      }
      var rgbTxt = lhRgbFloatTriple(hexCol);
      var spanCenter = ed.axis === 'x' ? Math.round(pz) : Math.round(px);
      for (var off = -20; off <= 20; off += 5) {
        var cxP = ed.axis === 'x' ? ed.coord : (spanCenter + off);
        var czP = ed.axis === 'z' ? ed.coord : (spanCenter + off);
        for (var dy = 0; dy <= 6; dy += 2) {
          var cyP = Math.round(py + dy);
          server.runCommandSilent('execute in ' + dim + ' run particle minecraft:dust ' + rgbTxt + ' 1.7 ' + cxP + ' ' + cyP + ' ' + czP + ' 0 0 0 0 1 force ' + uname);
        }
      }
    }
  }
}

function lhCycleBuildingVariant(server, player, dryRun) {
  var st = lhOttdRead(server);
  var comp = lhGetPlayerCompany(server, player);
  if (!comp) { if (!dryRun) lhMsg(player, 'Сначала создайте компанию.'); return { ok: false, reason: 'no_company' }; }
  var dim = (player.level && player.level.dimension) ? String(player.level.dimension) : 'minecraft:overworld';
  var sc = global.LHOpenTTD.sectorCoords(player.x, player.z);
  var b = global.LHOpenTTD.getSectorBuilding(st, sc.sx, sc.sz, dim);
  if (!b || b.owner !== comp.id) { if (!dryRun) lhMsg(player, '§cВ этом секторе нет вашего объекта.'); return { ok: false, reason: 'not_found' }; }
  var pool = global.LHOpenTTD.BUILDING_VARIANTS && global.LHOpenTTD.BUILDING_VARIANTS[b.type];
  if (!pool) { if (!dryRun) lhMsg(player, '§7У этого типа здания нет вариантов продукции.'); return { ok: false, reason: 'no_variants' }; }
  var keys = Object.keys(pool);
  var idx = keys.indexOf(b.variant);
  var nextKey = keys[(idx + 1) % keys.length];
  var res = global.LHOpenTTD.setBuildingVariant(st, comp.id, sc.sx, sc.sz, nextKey, dim);
  if (res.ok && !dryRun) {
    lhOttdSave(server);
    lhSyncXaeroTerritories(server, player);
    lhMsg(player, '§a[Специализация] §f«' + res.variant.name + '» теперь производит §e' + res.variant.product + '§f!');
  }
  return res;
}

function lhBuildFacilityCmd(server, player, bType, sx, sz, dryRun) {
  var st = lhOttdRead(server);
  var comp = lhGetPlayerCompany(server, player);
  if (!comp) { if (!dryRun) lhMsg(player, 'Сначала создайте или вступите в компанию.'); return { ok: false, reason: 'no_company' }; }
  var dim = (player.level && player.level.dimension) ? String(player.level.dimension) : 'minecraft:overworld';
  var sc = (sx !== undefined && sz !== undefined) ? { sx: sx, sz: sz } : global.LHOpenTTD.sectorCoords(player.x, player.z);
  var biomeId = lhDetectBiomeId(player);
  var res = global.LHOpenTTD.buildCompanyBuilding(st, comp.id, sc.sx, sc.sz, bType, player.x, player.y, player.z, { dimension: dim, biomeId: biomeId });
  if (!res.ok) {
    if (!dryRun) {
      if (res.reason === 'not_your_sector') lhMsg(player, '§cСначала захватите сектор (' + sc.sx + ', ' + sc.sz + ') своей компанией!');
      else if (res.reason === 'already_built') lhMsg(player, '§eВ этом секторе уже есть постройка: ' + res.existing.type + '.');
      else if (res.reason === 'requires_world_structure') lhMsg(player, '§eДля конвертации структуры используйте §f/lh structure convert §eили вкладку Здания.');
      else if (res.reason === 'no_cash') lhMsg(player, '§cНедостаточно средств: нужно ' + res.cost + ' Cr (у вас ' + res.cash + ' Cr).');
      else lhMsg(player, '§cНе удалось построить объект (' + res.reason + ').');
    }
    return res;
  }
  lhOttdSave(server);
  if (!dryRun) {
    lhPlacePhysicalBuildingBlocks(server, res.building);
    lhGiveTerritoryMapItem(server, player, false, true);
    if (typeof lhLogEvent === 'function') {
      lhLogEvent(server, 'building', comp.name + ' построила «' + res.spec.name + '» в (' + sc.sx + ', ' + sc.sz + ')', { chatMode: 'never' });
    }
    lhClearLegacyMinimapHud(player);
    lhSyncXaeroTerritories(server, player);
    var builtTitle = res.building.variantName ? (res.building.variantName + ' -> ' + res.building.customProduct) : res.spec.name;
    lhMsg(player, '§a[Инфраструктура] Построено физическое здание: ' + res.spec.icon + ' §f' + builtTitle +
      ' §7в (' + res.building.x + ', ' + res.building.y + ', ' + res.building.z + ') за ' + res.cost +
      ' Cr. Бочка выхода: §e(' + res.building.x + ',' + res.building.y + ',' + res.building.z + ')§7, бочка сырья: §b(' +
      (res.building.x + 1) + ',' + res.building.y + ',' + res.building.z + ')§7.');
  }
  return res;
}

function lhConvertStructureCmd(server, player, structureId, sx, sz, dryRun) {
  var st = lhOttdRead(server);
  var comp = lhGetPlayerCompany(server, player);
  if (!comp) { if (!dryRun) lhMsg(player, 'Сначала создайте компанию.'); return { ok: false, reason: 'no_company' }; }
  var dim = (player.level && player.level.dimension) ? String(player.level.dimension) : 'minecraft:overworld';
  var sc = (sx !== undefined && sz !== undefined) ? { sx: sx, sz: sz } : global.LHOpenTTD.sectorCoords(player.x, player.z);
  if (!structureId) {
    var list = lhScanNearbyStructuresForSector(server, player, st);
    if (!list.length) {
      if (!dryRun) lhMsg(player, '§eВ секторе (' + sc.sx + ',' + sc.sz + ') не обнаружено зарегистрированных структур мира.');
      return { ok: false, reason: 'no_structure' };
    }
    structureId = list[0].structureId;
  }
  var res = global.LHOpenTTD.convertStructureToFacility(st, comp.id, sc.sx, sc.sz, structureId, player.x, player.y, player.z, { dimension: dim });
  if (!res.ok) {
    if (!dryRun) lhMsg(player, '§cНе удалось освоить структуру: ' + res.reason + (res.cost ? (' (нужно ' + res.cost + ' Cr)') : ''));
    return res;
  }
  lhOttdSave(server);
  if (!dryRun) {
    lhPlacePhysicalBuildingBlocks(server, res.building); // preserveWorldStructure=true: does NOT overwrite world structure!
    lhSyncXaeroTerritories(server, player);
    var sp = res.structureSpec || {};
    lhMsg(player, '§a[Структура освоена] ' + (sp.rarityColor || '§f') + '[' + (sp.rarityName || 'Редкая') + '] ' +
      (sp.displayName || structureId) + ' §f-> добыча §e' + res.building.productItem +
      ' §7(структура сохранена нетронутой, бочки рядом на ' + res.building.x + ',' + res.building.y + ',' + res.building.z + ').');
  }
  return res;
}

function lhSupplyBuildingCmd(server, player, sx, sz, dryRun) {
  var st = lhOttdRead(server);
  var comp = lhGetPlayerCompany(server, player);
  if (!comp) { if (!dryRun) lhMsg(player, 'Сначала создайте компанию.'); return { ok: false, reason: 'no_company' }; }
  var dim = (player.level && player.level.dimension) ? String(player.level.dimension) : 'minecraft:overworld';
  var sc = (sx !== undefined && sz !== undefined) ? { sx: sx, sz: sz } : global.LHOpenTTD.sectorCoords(player.x, player.z);
  var b = global.LHOpenTTD.getSectorBuilding(st, sc.sx, sc.sz, dim);
  if (!b || b.owner !== comp.id) { if (!dryRun) lhMsg(player, '§cВ этом секторе нет вашего объекта.'); return { ok: false, reason: 'not_found' }; }
  var req = global.LHOpenTTD.getBuildingRequiredInputs(b);
  var supplied = {};
  Object.keys(req).forEach(function (iid) {
    var batchQty = Math.max(1, Number(req[iid] || 1)) * 2;
    var cons = lhConsumeInvItem(player.inventory, iid, batchQty);
    if (cons.ok) supplied[iid] = batchQty;
    else if (cons.have > 0) {
      var part = lhConsumeInvItem(player.inventory, iid, cons.have);
      if (part.ok) supplied[iid] = cons.have;
    }
  });
  if (Object.keys(supplied).length === 0) {
    if (!dryRun) lhMsg(player, '§eУ вас нет требуемого сырья: ' + Object.keys(req).map(function (k) { return req[k] + '× ' + k; }).join(', '));
    return { ok: false, reason: 'missing_items', required: req };
  }
  var res = global.LHOpenTTD.supplyBuildingInputs(st, comp.id, sc.sx, sc.sz, supplied, dim);
  lhOttdSave(server);
  if (!dryRun) lhMsg(player, '§a[Сырьё загружено] §fВ объект (' + sc.sx + ',' + sc.sz + ') передано ' + res.added + ' ед. ресурсов.');
  return res;
}

function lhUpgradeFacilityCmd(server, player, sx, sz, choiceId, dryRun) {
  var st = lhOttdRead(server);
  var comp = lhGetPlayerCompany(server, player);
  if (!comp) { if (!dryRun) lhMsg(player, 'Сначала создайте компанию.'); return { ok: false, reason: 'no_company' }; }
  var sc = (sx !== undefined && sz !== undefined) ? { sx: sx, sz: sz } : global.LHOpenTTD.sectorCoords(player.x, player.z);
  var res = global.LHOpenTTD.upgradeCompanyBuilding(st, comp.id, sc.sx, sc.sz, choiceId);
  if (!res.ok) {
    if (!dryRun) {
      if (res.reason === 'not_found') lhMsg(player, '§cВ секторе (' + sc.sx + ', ' + sc.sz + ') нет вашего здания.');
      else if (res.reason === 'max_level') lhMsg(player, '§eЗдание уже улучшено до максимума (Ур. 3).');
      else if (res.reason === 'no_cash') lhMsg(player, '§cНедостаточно средств: нужно ' + res.cost + ' Cr.');
      else lhMsg(player, '§cНеверный выбор ветки прокачки (' + choiceId + ').');
    }
    return res;
  }
  lhOttdSave(server);
  if (!dryRun) {
    lhMsg(player, '§6[Вилка прокачки Ур.' + res.building.level + '] §fВыбрана ветка «' + res.chosen.name + '» §7(' + res.chosen.summary + '). §eВетка «' + res.lockedOut + '» заблокирована.');
  }
  return res;
}

function lhCollectFacilityCmd(server, player, dryRun) {
  var st = lhOttdRead(server);
  var comp = lhGetPlayerCompany(server, player);
  if (!comp) { if (!dryRun) lhMsg(player, 'Сначала создайте компанию.'); return { ok: false, reason: 'no_company' }; }
  var list = global.LHOpenTTD.listCompanyBuildings(st, comp.id);
  var totalCr = 0, totalItems = {}, collectedCount = 0;
  for (var i = 0; i < list.length; i++) {
    var col = global.LHOpenTTD.collectBuildingOutput(st, comp.id, list[i].sx, list[i].sz);
    if (col.ok) {
      collectedCount++;
      totalCr += col.cash || 0;
      Object.keys(col.items || {}).forEach(function (iid) {
        totalItems[iid] = (totalItems[iid] || 0) + col.items[iid];
      });
    }
  }
  lhOttdSave(server);
  if (!dryRun) {
    if (Object.keys(totalItems).length > 0 && typeof player.give === 'function' && typeof Item !== 'undefined') {
      Object.keys(totalItems).forEach(function (itemId) {
        var qty = totalItems[itemId];
        if (qty > 0) player.give(Item.of(itemId, Math.min(256, qty)));
      });
    }
    lhMsg(player, '§a[Сбор с объектов] Получено §f' + totalCr + ' Cr §7и ресурсы с ' + collectedCount + ' построек.');
  }
  return { ok: true, totalCr: totalCr, items: totalItems, buildings: collectedCount };
}

function lhDiplomacyAction(server, player, action, targetCid, extra, dryRun) {
  var st = lhOttdRead(server);
  var myComp = lhGetPlayerCompany(server, player);
  if (!myComp) { if (!dryRun) lhMsg(player, 'Сначала создайте компанию.'); return { ok: false, reason: 'no_company' }; }
  var cleanTarget = global.LHOpenTTD.sanitizeId(targetCid);
  var res = { ok: false, reason: 'unknown' };
  if (action === 'ally') {
    var relCur = global.LHOpenTTD.getRelation(st, myComp.id, cleanTarget);
    res = global.LHOpenTTD.formOrBreakAlliance(st, myComp.id, cleanTarget, relCur.alliance ? 'break' : 'ally');
  } else if (action === 'transit') {
    res = global.LHOpenTTD.buyLicense(st, myComp.id, cleanTarget, 'transit');
  } else if (action === 'mining') {
    res = global.LHOpenTTD.buyLicense(st, myComp.id, cleanTarget, 'mining');
  } else if (action === 'gift') {
    res = global.LHOpenTTD.formOrBreakAlliance(st, myComp.id, cleanTarget, 'gift');
  } else if (action === 'buysector') {
    res = global.LHOpenTTD.diplomaticBuySector(st, myComp.id, extra.sx, extra.sz);
  }
  lhOttdSave(server);
  if (!dryRun) {
    if (!res.ok) {
      lhMsg(player, '§c[Дипломатия] Отказ: ' + res.reason + (res.cost ? (' (нужно ' + res.cost + ' Cr)') : '') + (res.score !== undefined ? (' (отношение: ' + res.score + ')') : ''));
    } else if (action === 'ally') {
      lhMsg(player, res.allied ? ('§a[Альянс] Заключён союз с ' + cleanTarget + '!') : ('§e[Альянс] Союз с ' + cleanTarget + ' расторгнут.'));
    } else if (action === 'transit' || action === 'mining') {
      lhMsg(player, '§a[Лицензия] Оформлено право (' + action + ') у ' + cleanTarget + ' за ' + res.cost + ' Cr.');
    } else if (action === 'gift') {
      lhMsg(player, '§a[Дипломатия] Подарок отправлен ' + cleanTarget + ': отношения теперь ' + res.score + '.');
    } else if (action === 'buysector') {
      lhMsg(player, '§a[Сделка с землёй] Сектор (' + extra.sx + ', ' + extra.sz + ') мирно выкуплен за ' + res.price + ' Cr!');
    }
  }
  return res;
}

function lhIsFragilePassableBreak(bid) {
  return bid === 'minecraft:tall_grass' || bid === 'minecraft:grass' || bid === 'minecraft:fern' ||
    bid === 'minecraft:large_fern' || bid === 'minecraft:vine' || bid === 'minecraft:snow' ||
    bid === 'minecraft:cobweb' || bid === 'minecraft:torch' || bid === 'minecraft:wall_torch' ||
    bid === 'minecraft:ladder' || bid === 'minecraft:scaffolding' ||
    bid.indexOf('flower') !== -1 || bid.indexOf('leaves') !== -1 || bid.indexOf('sapling') !== -1;
}

function lhIsLootContainerBlock(bid) {
  return bid.indexOf('chest') !== -1 || bid.indexOf('barrel') !== -1 || bid.indexOf('shulker_box') !== -1 ||
    bid.indexOf('lootr') !== -1 || bid.indexOf('crate') !== -1 || bid.indexOf('drawer') !== -1 ||
    bid.indexOf('hopper') !== -1 || bid.indexOf('dispenser') !== -1 || bid.indexOf('dropper') !== -1 ||
    bid.indexOf('furnace') !== -1 || bid.indexOf('cabinet') !== -1;
}

function lhNotifyPatrolOwner(server, st, ownerCid, intruderId, eventKey, msg) {
  if (!server || !ownerCid || !st || !st.companies) return;
  var cdKey = ownerCid + '|' + intruderId + '|' + eventKey;
  var cdTicks = eventKey === 'trespass' ? 200 : 100;
  if (LHOTTDPatrolNotifyCooldown[cdKey] && (LHOTTDTick - LHOTTDPatrolNotifyCooldown[cdKey]) < cdTicks) {
    return;
  }
  LHOTTDPatrolNotifyCooldown[cdKey] = LHOTTDTick;
  var plist = server.players || [];
  for (var i = 0; i < plist.length; i++) {
    var op = plist[i];
    var oComp = lhGetPlayerCompany(server, op);
    if (oComp && oComp.id === ownerCid) {
      lhMsg(op, msg);
    }
  }
  if (typeof lhLogEvent === 'function') {
    lhLogEvent(server, 'patrol', msg.replace(/§[0-9a-fk-or]/gi, ''), { chatMode: 'never' });
  }
}

function lhSpawnPatrolGuards(server, st, patrolProf, ownerComp, intruder) {
  if (!server || !patrolProf || !patrolProf.spawnGuards || !intruder) return 0;
  var pid = lhId(intruder);
  var ownerCid = patrolProf.owner;
  var gKey = ownerCid + '|' + pid;
  if (LHOTTDPatrolGuardCooldown[gKey] && (LHOTTDTick - LHOTTDPatrolGuardCooldown[gKey]) < 400) {
    return 0;
  }
  var ow = server.getLevel('minecraft:overworld');
  if (!ow) return 0;
  var uname = intruder.username || (typeof intruder.getName === 'function' ? intruder.getName().getString() : '');
  if (!uname) return 0;

  // Limit active nearby guards to prevent mob spam
  var nearbyGuards = 0;
  try {
    var ents = ow.getEntities();
    for (var ei = 0; ei < ents.length; ei++) {
      var e = ents[ei];
      if (!e || !e.tags || !e.tags.contains('lh_patrol_guard')) continue;
      var dxE = Number(e.x) - Number(intruder.x);
      var dzE = Number(e.z) - Number(intruder.z);
      if ((dxE * dxE + dzE * dzE) <= 32 * 32) nearbyGuards++;
    }
  } catch (eCnt) {}
  if (nearbyGuards >= 4) return 0;

  LHOTTDPatrolGuardCooldown[gKey] = LHOTTDTick;
  var count = Math.max(1, Math.min(3, Number(patrolProf.guardCount || 2)));
  var mobType = String(patrolProf.guardMob || 'minecraft:pillager');
  var tagLabel = ownerComp ? ownerComp.name : ownerCid;
  var spawned = 0;

  for (var gi = 0; gi < count; gi++) {
    var angle = (Math.PI * 2 * gi) / count + Math.random() * 0.6;
    var dist = 6 + Math.random() * 4;
    var sx = Math.round(Number(intruder.x) + Math.cos(angle) * dist);
    var sz = Math.round(Number(intruder.z) + Math.sin(angle) * dist);
    var sy = Math.round(Number(intruder.y));
    for (var dy = 4; dy >= -4; dy--) {
      try {
        var bBelow = ow.getBlock(sx, sy + dy - 1, sz);
        var bAt = ow.getBlock(sx, sy + dy, sz);
        var bAbove = ow.getBlock(sx, sy + dy + 1, sz);
        if (bBelow && String(bBelow.id) !== 'minecraft:air' &&
            bAt && String(bAt.id) === 'minecraft:air' &&
            bAbove && String(bAbove.id) === 'minecraft:air') {
          sy = sy + dy;
          break;
        }
      } catch (eScan) {}
    }
    try {
      var nbtStr = JSON.stringify({
        Tags: ['lh_patrol_guard'],
        PersistenceRequired: 0,
        CustomName: JSON.stringify({ text: 'Охрана «' + tagLabel + '»', color: 'red' }),
        CustomNameVisible: 1
      });
      server.runCommandSilent('execute in minecraft:overworld run summon ' + mobType + ' ' + sx + ' ' + sy + ' ' + sz + ' ' + nbtStr);
      spawned++;
    } catch (eSum) {}
  }

  if (spawned > 0) {
    lhMsg(intruder, '§c§l[Пост патруля · Тревога 3 ур.] §fОхрана компании «' + tagLabel + '» (' + spawned + '×) перехватывает вас!');
    lhNotifyPatrolOwner(server, st, ownerCid, pid, 'guards_spawned',
      '§6§l[Патруль Ур.3] §fПост в (' + patrolProf.sx + ', ' + patrolProf.sz + ') выслал ' + spawned +
      ' охранников против нарушителя §c' + uname + ' §fв (' + Math.round(intruder.x) + ', ' + Math.round(intruder.z) + ')!');
  }
  return spawned;
}

function lhHandlePatrolEvent(server, st, ownerCid, intruder, eventType, detailText, wx, wy, wz, allowGuardSpawn) {
  if (!server || !st || !ownerCid || !intruder || !global.LHOpenTTD || !global.LHOpenTTD.findPatrolPostsCovering) {
    return null;
  }
  var intrComp = lhGetPlayerCompany(server, intruder);
  if (intrComp && (intrComp.id === ownerCid || global.LHOpenTTD.isAllied(st, intrComp.id, ownerCid))) {
    return null;
  }
  var posts = global.LHOpenTTD.findPatrolPostsCovering(st, ownerCid, wx, wz);
  if (!posts || !posts.length) return null;
  var top = posts[0];
  var ownerComp = st.companies ? st.companies[ownerCid] : null;
  var uname = intruder.username || (typeof intruder.getName === 'function' ? intruder.getName().getString() : 'Игрок');
  var pid = lhId(intruder);

  var labels = {
    trespass: 'Пересечение границы',
    break_block: 'Добыча/ломка блока',
    break_ore: 'Добыча руды',
    break_log: 'Рубка леса',
    mob_kill: 'Убийство моба',
    resource_gather: 'Сбор ресурсов',
    container_loot: 'Открытие контейнера'
  };
  var evTitle = labels[eventType] || eventType;
  lhNotifyPatrolOwner(server, st, ownerCid, pid, eventType,
    '§6§l[Патруль · Ур.' + top.level + '] §e' + evTitle + ': §c' + uname +
    (detailText ? (' §7(' + detailText + ')') : '') + ' §fна (' + Math.round(wx) + ', ' + Math.round(wy) + ', ' + Math.round(wz) + ')!');

  if (top.markIntruders && uname) {
    server.runCommandSilent('effect give ' + uname + ' minecraft:glowing 6 0 true');
  }
  if (allowGuardSpawn && top.spawnGuards) {
    lhSpawnPatrolGuards(server, st, top, ownerComp, intruder);
  }
  return top;
}

BlockEvents.broken(function (event) {
  var server = event.server, player = event.player, block = event.block;
  if (!server || !player || !block) return;
  var creative = (typeof player.isCreative === 'function' && player.isCreative()) ||
    (typeof player.isSpectator === 'function' && player.isSpectator());
  if (creative) return;
  if (String(block.level.dimension) !== 'minecraft:overworld') return;

  var comp = lhGetPlayerCompany(server, player);
  var st = lhOttdRead(server);
  var sc = global.LHOpenTTD.sectorCoords(block.x, block.z);
  var sec = global.LHOpenTTD.resolveSectorOwner(st, sc.sx, sc.sz);
  var isSpawnZone = !!(global.LHOpenTTD.isSpawnProtectedSector && global.LHOpenTTD.isSpawnProtectedSector(sc.sx, sc.sz));
  var bidStr = String(block.id);

  var isOre = block.hasTag('forge:ores');
  var isLog = block.hasTag('minecraft:logs');

  // Prohibit resource extraction and looting in unclaimed territories (3x3 neutral spawn zone is open to all players)
  if (!isSpawnZone && sec.kind !== 'claimed' && !lhIsFragilePassableBreak(bidStr)) {
    var pidUncl = lhId(player);
    if (!LHOTTDLastBreakWarnByPlayer[pidUncl] || (LHOTTDTick - LHOTTDLastBreakWarnByPlayer[pidUncl]) >= 60) {
      LHOTTDLastBreakWarnByPlayer[pidUncl] = LHOTTDTick;
      lhMsg(player, '§c[Незаприваченный сектор (' + sc.sx + ',' + sc.sz + ')] §fДобыча ресурсов и разбор блоков запрещены на ничьей земле! Сначала заприватьте сектор (/lh territory claim).');
    }
    event.cancel();
    return;
  }

  // Physical company building integrity: owners can remodel freely; enemies breaking blocks damage/destroy the facility!
  var sectorBldg = global.LHOpenTTD.getSectorBuilding(st, sc.sx, sc.sz);
  if (sectorBldg && lhBuildingContainsBlock(sectorBldg, block.x, block.y, block.z)) {
    if (!comp || sectorBldg.owner !== comp.id) {
      var isCore = (Math.floor(block.x) === Math.floor(sectorBldg.x) &&
        Math.floor(block.y) === Math.floor(sectorBldg.y) &&
        Math.floor(block.z) === Math.floor(sectorBldg.z));
      var dmg = global.LHOpenTTD.damageBuildingIntegrity(st, sc.sx, sc.sz, 1, isCore);
      lhOttdSave(server);
      if (dmg.ok) {
        if (dmg.destroyed) {
          lhMsg(player, '§c§l[Разрушение объекта] §fЗдание компании в (' + sc.sx + ',' + sc.sz + ') полностью разрушено!');
          if (typeof lhLogEvent === 'function') {
            lhLogEvent(server, 'raid', 'Здание ' + sectorBldg.type + ' в (' + sc.sx + ',' + sc.sz + ') уничтожено при атаке!', { chatMode: 'important' });
          }
        } else {
          lhMsg(player, '§e[Повреждение объекта] §fПрочность здания: ' + dmg.integrityPct + '%' +
            (dmg.operational ? '' : ' §c[ВЫВЕДЕНО ИЗ СТРОЯ]'));
        }
      }
    }
  }

  // Strict Territory Control with Warning-First Grace Strike:
  // First broken block issues a stern warning from bots/owner; continuing within 20s drops reputation & escalates prices!
  if (sec.kind === 'claimed' && sec.owner && (!comp || sec.owner !== comp.id)) {
    var canMineHere = comp ? global.LHOpenTTD.canMine(st, comp.id, sec.owner) : false;
    var pidWarn = lhId(player);
    var kind = isOre ? 'break_ore' : (isLog ? 'break_log' : 'break_block');
    var patrolHit = lhHandlePatrolEvent(server, st, sec.owner, player, kind, bidStr, block.x, block.y, block.z, !canMineHere);
    if (!canMineHere) {
      var ownerObj = st.companies[sec.owner];
      var mKey = pidWarn + '|' + sec.owner;
      var mWarn = LHOTTDMiningWarn[mKey];
      var nowTick = LHOTTDTick;
      if (!mWarn || (nowTick - mWarn.tick) > 400) {
        LHOTTDMiningWarn[mKey] = { tick: nowTick, count: 1 };
        lhMsg(player, '§e§l[Предупреждение · ' + (ownerObj && ownerObj.isBot ? 'Бот-компания' : 'Территория') + '] §fВы сломали блок (' + bidStr +
          ') на земле «' + (ownerObj ? ownerObj.name : sec.owner) + '»! Прекратите добычу, иначе потеряете репутацию и цены вырастут! (/lh diplomacy license ' + sec.owner + ' mining)');
      } else {
        mWarn.tick = nowTick;
        mWarn.count++;
        var pMult = patrolHit ? patrolHit.penaltyMult : 1.0;
        var viol = global.LHOpenTTD.recordTerritoryViolation(st, comp ? comp.id : null, sec.owner, kind, sc.sx, sc.sz, pidWarn, pMult);
        lhOttdSave(server);
        if (!LHOTTDLastBreakWarnByPlayer[pidWarn] || (nowTick - LHOTTDLastBreakWarnByPlayer[pidWarn]) >= 60) {
          LHOTTDLastBreakWarnByPlayer[pidWarn] = nowTick;
          lhMsg(player, '§c§l[Репутация снижена] §f' + (ownerObj ? ownerObj.name : sec.owner) +
            ': репутация ' + (viol.delta || -6) + ' (итого ' + viol.newScore + ', ' + viol.standing + '), штраф ' + viol.fine +
            ' Cr. §7Цены: покупка ×' + viol.pricing.buyMult + ', сбыт ×' + viol.pricing.sellMult + '!');
        }
        if (viol.hostile || !comp) {
          var unameWarn = player.username || (typeof player.getName === 'function' ? player.getName().getString() : '');
          if (unameWarn) server.runCommandSilent('effect give ' + unameWarn + ' minecraft:mining_fatigue 4 1 true');
        }
      }
    }
  }

  if (!isOre && !isLog) return;

  if (comp) {
    comp.stats.blocksMined = (comp.stats.blocksMined || 0) + 1;
    if (isOre && comp.resourceSpec === 'mining' && Math.random() < 0.35) {
      block.popItem('minecraft:raw_iron');
      comp.cash += 4;
    } else if (isOre && sec.owner === comp.id && Math.random() < 0.25) {
      comp.cash += 3;
    }
    if (isLog && comp.resourceSpec === 'forestry' && Math.random() < 0.35) {
      block.popItem('minecraft:charcoal');
      comp.cash += 2;
    }
  }
});

function lhIsHostileMob(ent) {
  if (!ent) return false;
  try {
    if (typeof ent.isMonster === 'function' && ent.isMonster()) return true;
  } catch (e1) {}
  try {
    if (typeof ent.getType === 'function') {
      var tp = ent.getType();
      if (tp && typeof tp.getCategory === 'function') {
        var cat = tp.getCategory();
        if (cat && String(cat.getName ? cat.getName() : cat).toLowerCase() === 'monster') return true;
      }
    }
  } catch (e2) {}
  var s = String(ent.type || '').toLowerCase();
  return s === 'minecraft:zombie' || s === 'minecraft:skeleton' || s === 'minecraft:creeper' ||
    s === 'minecraft:spider' || s === 'minecraft:cave_spider' || s === 'minecraft:enderman' ||
    s === 'minecraft:witch' || s === 'minecraft:pillager' || s === 'minecraft:vindicator' ||
    s === 'minecraft:drowned' || s === 'minecraft:husk' || s === 'minecraft:stray' ||
    s === 'minecraft:phantom' || s === 'minecraft:slime' || s === 'minecraft:warden';
}

function lhFindTerminalAtBlock(server, bx, by, bz) {
  var logSt = lhLogisticsRead(server);
  var terms = logSt.terminals || {};
  var keys = Object.keys(terms);
  for (var i = 0; i < keys.length; i++) {
    var cid = keys[i];
    var t = terms[cid];
    if (!t) continue;
    if (Math.round(t.x) === Math.round(bx) && Math.round(t.y) === Math.round(by) && Math.round(t.z) === Math.round(bz)) {
      return { companyId: cid, terminal: t };
    }
  }
  return null;
}

function lhClaimArrivedDeliveriesAtTerminal(server, player, deliveryIdOpt) {
  var st = lhOttdRead(server);
  var comp = lhGetPlayerCompany(server, player);
  if (!comp) { lhMsg(player, 'Сначала создайте или вступите в компанию.'); return 0; }
  var logSt = lhLogisticsRead(server);
  var term = lhEnsureCompanyTerminalBuilt(server, st, comp);
  var dist = Math.sqrt(
    Math.pow(Number(player.x) - Number(term.x), 2) +
    Math.pow(Number(player.y) - Number(term.y), 2) +
    Math.pow(Number(player.z) - Number(term.z), 2)
  );
  if (dist > 14.0) {
    lhMsg(player, '§cПодойдите к терминалу вашей компании (' + Math.round(term.x) + ',' + Math.round(term.y) + ',' + Math.round(term.z) + ', сейчас ' + Math.round(dist) + ' м).');
    return 0;
  }
  var claimed = 0;
  var dels = logSt.deliveries || [];
  for (var i = 0; i < dels.length; i++) {
    var d = dels[i];
    if (d.buyerCid !== comp.id || (d.status !== 'arrived_at_terminal' && d.status !== 'arrived')) continue;
    if (deliveryIdOpt && d.id !== deliveryIdOpt) continue;
    var rem = Number(d.unclaimedQty != null ? d.unclaimedQty : d.qty);
    if (rem <= 0) { d.status = 'completed'; continue; }
    var ins = lhInsertIntoTerminalContainer(server, term, d.itemId, rem);
    var left = rem - ins;
    if (left > 0 && typeof Item !== 'undefined' && typeof player.give === 'function') {
      player.give(Item.of(d.itemId, left));
      left = 0;
    }
    d.unclaimedQty = left;
    if (left <= 0) d.status = 'completed';
    claimed++;
    lhMsg(player, '§a[Доставка ' + d.id + '] Получено ' + rem + '× ' + d.itemId + (ins > 0 ? (' (в бочку терминала: ' + ins + ')') : '') + '!');
  }
  lhLogisticsSave(server);
  if (!claimed) lhMsg(player, 'Нет ожидающих прибывших доставок для вашей компании.');
  return claimed ? 1 : 0;
}

function lhHaggleStart(server, player, targetCid, side, itemId, qty, dryRun) {
  if (!global.LHHaggleEngine || !global.LHEconomyEngine) return null;
  var st = lhOttdRead(server);
  var econ = lhEconRead(server);
  var myComp = lhGetPlayerCompany(server, player);
  if (!myComp) { if (!dryRun) lhMsg(player, 'Сначала создайте или вступите в компанию.'); return null; }
  var cleanTarget = global.LHOpenTTD.sanitizeId(targetCid);
  var targetComp = st.companies[cleanTarget];
  if (!targetComp) { if (!dryRun) lhMsg(player, 'Компания "' + targetCid + '" не найдена.'); return null; }
  var q = global.LHEconomyEngine.getMarketQuote(econ, itemId);
  var unitPrice = Math.max(1, Number(q.price || 10));
  var repScore = global.LHOpenTTD.getEffectiveRelationScore(st, myComp.id, lhId(player), cleanTarget);
  var logSt = lhLogisticsRead(server);
  logSt.haggles = logSt.haggles || {};
  logSt.nextHaggleSeq = (logSt.nextHaggleSeq || 0) + 1;
  var hid = 'H' + logSt.nextHaggleSeq;
  var cleanQty = Math.max(1, Math.round(qty || 1));
  var isSell = (side === 'sell');
  var sess = global.LHHaggleEngine.createSession(
    hid, 'vs_bot',
    isSell ? cleanTarget : myComp.id,
    isSell ? myComp.id : cleanTarget,
    q.itemId, cleanQty, unitPrice * cleanQty,
    { botSide: isSell ? 'buyer' : 'seller', repScore: repScore }
  );
  sess.playerId = lhId(player);
  sess.playerCid = myComp.id;
  sess.targetCid = cleanTarget;
  logSt.haggles[hid] = sess;
  lhLogisticsSave(server);
  if (!dryRun) {
    var curAsk = sess.botSide === 'seller' ? sess.sellerAsk : sess.buyerBid;
    lhMsg(player, '§e[Торг ' + sess.id + '] §f' + targetComp.name + ' (' + (isSell ? 'продажа им' : 'покупка у них') +
      ' ' + sess.qty + '× ' + sess.itemId + '): стартовая цена §e' + curAsk + ' Cr §7(мин ' + sess.minPrice + ' / макс ' + sess.maxPrice + ', реп. ' + repScore + '). ' +
      'Команды: /lh haggle offer ' + sess.id + ' <цена> | /lh haggle accept ' + sess.id);
  }
  return sess;
}

function lhHaggleOffer(server, player, sessionId, offeredPrice, dryRun) {
  if (!global.LHHaggleEngine) return null;
  var logSt = lhLogisticsRead(server);
  var sess = (logSt.haggles || {})[sessionId];
  if (!sess || sess.playerId !== lhId(player)) {
    if (!dryRun) lhMsg(player, '§cСессия торга ' + sessionId + ' не найдена.');
    return { ok: false, reason: 'not_found' };
  }
  var role = sess.botSide === 'seller' ? 'buyer' : 'seller';
  var res = global.LHHaggleEngine.submitOffer(sess, role, offeredPrice, {});
  lhLogisticsSave(server);
  if (!dryRun) {
    if (!res.ok) {
      lhMsg(player, '§c[Торг] Ошибка: ' + res.reason);
    } else if (res.walkedAway) {
      lhMsg(player, '§c[Торг ' + sessionId + '] ' + sess.lastMsg);
    } else if (res.agreed) {
      lhMsg(player, '§a[Торг ' + sessionId + '] ' + sess.lastMsg + ' Завершите: /lh haggle accept ' + sessionId);
    } else {
      lhMsg(player, '§e[Торг ' + sessionId + '] ' + sess.lastMsg + ' §7(раунд ' + sess.round + '/' + sess.maxRounds + ').');
    }
  }
  return res;
}

function lhHaggleAccept(server, player, sessionId, dryRun) {
  if (!global.LHHaggleEngine) return 0;
  var st = lhOttdRead(server);
  var logSt = lhLogisticsRead(server);
  var sess = (logSt.haggles || {})[sessionId];
  if (!sess || sess.playerId !== lhId(player)) {
    if (!dryRun) lhMsg(player, '§cСессия торга ' + sessionId + ' не найдена.');
    return 0;
  }
  if (sess.status === 'active') {
    var role = sess.botSide === 'seller' ? 'buyer' : 'seller';
    var acc = global.LHHaggleEngine.acceptCurrentOffer(sess, role);
    if (!acc.ok) {
      if (!dryRun) lhMsg(player, '§cНе удалось принять торг: ' + acc.reason);
      return 0;
    }
  }
  if (sess.status !== 'agreed') {
    if (!dryRun) lhMsg(player, '§cСессия торга уже закрыта (' + sess.status + ').');
    return 0;
  }
  var myComp = st.companies[sess.playerCid];
  var targetComp = st.companies[sess.targetCid];
  if (!myComp || !targetComp) return 0;
  var finalPrice = Math.max(1, Math.round(sess.agreedPrice || sess.marketTotal));
  if (sess.botSide === 'seller') {
    if (dryRun) {
      if (myComp.cash < finalPrice) return 0;
      myComp.cash -= finalPrice;
      targetComp.cash += finalPrice;
      sess.status = 'completed';
      lhOttdSave(server);
      lhLogisticsSave(server);
      return 1;
    }
    var bTerm = lhEnsureCompanyTerminalBuilt(server, st, myComp);
    lhEnsureCompanyTerminalBuilt(server, st, targetComp);
    var dRes = global.LHTradeLogistics
      ? global.LHTradeLogistics.createBuyOrderDelivery(logSt, st, myComp.id, targetComp.id, sess.itemId, sess.qty, finalPrice, lhCompanySpeedBps(targetComp), LHOTTDTick)
      : { ok: false, reason: 'no_logistics' };
    if (!dRes.ok) {
      lhMsg(player, '§cНе хватает средств: нужно ' + (dRes.cost || finalPrice) + ' Cr.');
      return 0;
    }
    sess.status = 'completed';
    var etaSec = Math.max(1, Math.round((dRes.durationTicks || 200) / 20));
    lhMsg(player, '§a[Торг завершён] Куплено ' + sess.qty + '× ' + sess.itemId + ' за ' + finalPrice +
      ' Cr + доставка ' + dRes.deliveryFee + ' Cr! Доставка ' + dRes.delivery.id + ' (' + etaSec + 'с @ ' + dRes.delivery.speedBps +
      ' м/с) в терминал (' + Math.round(bTerm.x) + ',' + Math.round(bTerm.y) + ',' + Math.round(bTerm.z) + ').');
  } else {
    if (!dryRun) {
      var cons = lhConsumeInvItem(player.inventory, sess.itemId, sess.qty);
      if (!cons.ok) {
        lhMsg(player, '§cНедостаточно ' + sess.itemId + ' (есть ' + cons.have + '/' + sess.qty + ').');
        return 0;
      }
    }
    if (targetComp.cash < finalPrice) targetComp.cash += finalPrice;
    targetComp.cash -= finalPrice;
    myComp.cash += finalPrice;
    myComp.stats.tradeVolume = (myComp.stats.tradeVolume || 0) + finalPrice;
    targetComp.stats.tradeVolume = (targetComp.stats.tradeVolume || 0) + finalPrice;
    sess.status = 'completed';
    if (!dryRun) lhMsg(player, '§a[Торг завершён] Продано ' + sess.qty + '× ' + sess.itemId + ' за ' + finalPrice + ' Cr!');
  }
  lhOttdSave(server);
  lhLogisticsSave(server);
  lhUnlock(player, 'longhaul:openttd/trade');
  return 1;
}

function lhP2PPropose(server, sellerPlayer, targetName, offerItem, offerQty, reqItem, reqQty, cashDelta, dryRun) {
  if (!global.LHP2PTradeEngine) return null;
  var plist = server.players || [];
  var buyerPlayer = null;
  var tLow = String(targetName || '').toLowerCase();
  for (var i = 0; i < plist.length; i++) {
    var pl = plist[i];
    var un = String(pl.username || (typeof pl.getName === 'function' ? pl.getName().getString() : '')).toLowerCase();
    if (un === tLow || lhId(pl).toLowerCase() === tLow) { buyerPlayer = pl; break; }
  }
  if (!buyerPlayer) { if (!dryRun) lhMsg(sellerPlayer, '§cИгрок "' + targetName + '" не в сети.'); return null; }
  var sameDim = (!sellerPlayer.level || !buyerPlayer.level) ? true : (String(sellerPlayer.level.dimension) === String(buyerPlayer.level.dimension));
  var prox = global.LHP2PTradeEngine.validateProximity(sellerPlayer.x, sellerPlayer.y, sellerPlayer.z, buyerPlayer.x, buyerPlayer.y, buyerPlayer.z, sameDim);
  if (!prox.ok) {
    if (!dryRun) lhMsg(sellerPlayer, '§c[P2P] Игрок слишком далеко (' + prox.dist + ' м > ' + prox.maxDist + ' м)! Подойдите ближе.');
    return prox;
  }
  var st = lhOttdRead(server);
  var sComp = lhGetPlayerCompany(server, sellerPlayer);
  var bComp = lhGetPlayerCompany(server, buyerPlayer);
  var logSt = lhLogisticsRead(server);
  logSt.p2pSessions = logSt.p2pSessions || {};
  logSt.nextP2pSeq = (logSt.nextP2pSeq || 0) + 1;
  var tid = 'P2P' + logSt.nextP2pSeq;
  var sess = global.LHP2PTradeEngine.createSession(
    tid,
    lhId(sellerPlayer), sellerPlayer.username || lhId(sellerPlayer), sComp ? sComp.id : null,
    lhId(buyerPlayer), buyerPlayer.username || lhId(buyerPlayer), bComp ? bComp.id : null
  );
  if (offerQty > 0 && offerItem && offerItem !== 'none' && offerItem !== 'minecraft:air') {
    global.LHP2PTradeEngine.addItemOffer(sess, lhId(sellerPlayer), offerItem, offerQty);
  }
  if (reqQty > 0 && reqItem && reqItem !== 'none' && reqItem !== 'minecraft:air') {
    global.LHP2PTradeEngine.addItemOffer(sess, lhId(buyerPlayer), reqItem, reqQty);
  }
  if (cashDelta > 0) global.LHP2PTradeEngine.setCurrencyOffer(sess, lhId(buyerPlayer), cashDelta);
  else if (cashDelta < 0) global.LHP2PTradeEngine.setCurrencyOffer(sess, lhId(sellerPlayer), Math.abs(cashDelta));
  global.LHP2PTradeEngine.setConfirmed(sess, lhId(sellerPlayer), true);
  logSt.p2pSessions[tid] = sess;
  lhLogisticsSave(server);
  if (!dryRun) {
    lhMsg(sellerPlayer, '§a[P2P ' + tid + '] Предложение отправлено игроку ' + sess.sideB.name + '.');
    lhMsg(buyerPlayer, '§e[P2P ' + tid + '] ' + sess.sideA.name + ' предлагает: ' +
      (offerQty > 0 ? (offerQty + '× ' + offerItem) : 'без предметов') + ' в обмен на ' +
      (reqQty > 0 ? (reqQty + '× ' + reqItem) : 'без предметов') +
      (cashDelta ? (' + ' + cashDelta + ' Cr') : '') + '. Принять (рядом <= 10м): /lh p2p accept ' + tid);
  }
  return { ok: true, trade: sess };
}

function lhP2PAccept(server, buyerPlayer, tradeId, dryRun) {
  if (!global.LHP2PTradeEngine) return 0;
  var logSt = lhLogisticsRead(server);
  var sess = (logSt.p2pSessions || {})[tradeId];
  if (!sess || sess.status !== 'open') { if (!dryRun) lhMsg(buyerPlayer, '§cP2P-сделка ' + tradeId + ' не найдена.'); return 0; }
  if (sess.sideB.uuid !== lhId(buyerPlayer)) { if (!dryRun) lhMsg(buyerPlayer, '§cЭта сделка адресована другому игроку.'); return 0; }
  var plist = server.players || [];
  var sellerPlayer = null;
  for (var i = 0; i < plist.length; i++) {
    if (lhId(plist[i]) === sess.sideA.uuid) { sellerPlayer = plist[i]; break; }
  }
  if (!sellerPlayer) { if (!dryRun) lhMsg(buyerPlayer, '§cИгрок-инициатор не в сети.'); return 0; }
  var sameDim = (!sellerPlayer.level || !buyerPlayer.level) ? true : (String(sellerPlayer.level.dimension) === String(buyerPlayer.level.dimension));
  var check = global.LHP2PTradeEngine.validateProximity(sellerPlayer.x, sellerPlayer.y, sellerPlayer.z, buyerPlayer.x, buyerPlayer.y, buyerPlayer.z, sameDim);
  if (!check.ok) {
    if (!dryRun) lhMsg(buyerPlayer, '§c[P2P] Подойдите ближе (' + check.dist + ' м > ' + check.maxDist + ' м)!');
    return 0;
  }
  var st = lhOttdRead(server);
  var sComp = lhGetPlayerCompany(server, sellerPlayer);
  var bComp = lhGetPlayerCompany(server, buyerPlayer);
  var payBtoA = Number(sess.sideB.currency || 0);
  var payAtoB = Number(sess.sideA.currency || 0);
  if (payBtoA > 0 && (!bComp || bComp.cash < payBtoA)) {
    if (!dryRun) lhMsg(buyerPlayer, '§cУ вашей компании недостаточно средств (' + payBtoA + ' Cr).');
    return 0;
  }
  if (payAtoB > 0 && (!sComp || sComp.cash < payAtoB)) {
    if (!dryRun) lhMsg(buyerPlayer, '§cУ компании отправителя недостаточно средств (' + payAtoB + ' Cr).');
    return 0;
  }
  if (!dryRun) {
    var takenA = [];
    for (var ia = 0; ia < sess.sideA.items.length; ia++) {
      var itA = sess.sideA.items[ia];
      var c1 = lhConsumeInvItem(sellerPlayer.inventory, itA.itemId, itA.count);
      if (!c1.ok) {
        takenA.forEach(function (t) { sellerPlayer.give(Item.of(t.itemId, t.count)); });
        lhMsg(buyerPlayer, '§cУ отправителя больше нет ' + itA.count + '× ' + itA.itemId + '.');
        return 0;
      }
      takenA.push(itA);
    }
    var takenB = [];
    for (var ib = 0; ib < sess.sideB.items.length; ib++) {
      var itB = sess.sideB.items[ib];
      var c2 = lhConsumeInvItem(buyerPlayer.inventory, itB.itemId, itB.count);
      if (!c2.ok) {
        takenA.forEach(function (t) { sellerPlayer.give(Item.of(t.itemId, t.count)); });
        takenB.forEach(function (t) { buyerPlayer.give(Item.of(t.itemId, t.count)); });
        lhMsg(buyerPlayer, '§cУ вас недостаточно ' + itB.count + '× ' + itB.itemId + '.');
        return 0;
      }
      takenB.push(itB);
    }
    if (typeof Item !== 'undefined') {
      takenA.forEach(function (t) { buyerPlayer.give(Item.of(t.itemId, t.count)); });
      takenB.forEach(function (t) { sellerPlayer.give(Item.of(t.itemId, t.count)); });
    }
  }
  if (payBtoA > 0 && bComp && sComp) { bComp.cash -= payBtoA; sComp.cash += payBtoA; }
  if (payAtoB > 0 && sComp && bComp) { sComp.cash -= payAtoB; bComp.cash += payAtoB; }
  global.LHP2PTradeEngine.setConfirmed(sess, lhId(buyerPlayer), true);
  sess.status = 'completed';
  lhOttdSave(server);
  lhLogisticsSave(server);
  if (!dryRun) {
    lhMsg(buyerPlayer, '§a[P2P ' + sess.id + '] Обмен из рук в руки завершён!');
    lhMsg(sellerPlayer, '§a[P2P ' + sess.id + '] Обмен с ' + sess.sideB.name + ' завершён!');
  }
  return 1;
}

BlockEvents.rightClicked(function (event) {
  var server = event.server, player = event.player, block = event.block;
  if (!server || !player || !block) return;
  var creative = (typeof player.isCreative === 'function' && player.isCreative()) ||
    (typeof player.isSpectator === 'function' && player.isSpectator());
  if (creative) return;
  if (String(block.level.dimension) !== 'minecraft:overworld') return;

  var bidStr = String(block.id);
  if (!lhIsLootContainerBlock(bidStr)) return;
  var st = lhOttdRead(server);
  var sc = global.LHOpenTTD.sectorCoords(block.x, block.z);
  var sec = global.LHOpenTTD.resolveSectorOwner(st, sc.sx, sc.sz);
  var compRc = lhGetPlayerCompany(server, player);
  var termHit = lhFindTerminalAtBlock(server, block.x, block.y, block.z);
  if (termHit) {
    if (compRc && termHit.companyId === compRc.id) {
      return; // Own company terminal barrel is always usable
    }
    if (global.LHTradeLogistics && global.LHTradeLogistics.hasActiveBorderPass(lhLogisticsRead(server), lhId(player), termHit.companyId)) {
      return; // Allowed during active border trade pass
    }
  }
  var isSpawnZone = !!(global.LHOpenTTD.isSpawnProtectedSector && global.LHOpenTTD.isSpawnProtectedSector(sc.sx, sc.sz));
  if (!isSpawnZone && sec.kind !== 'claimed') {
    lhMsg(player, '§c[Незаприваченный сектор (' + sc.sx + ',' + sc.sz + ')] §fЛутинг контейнеров запрещён на незаприваченной территории! Заприватьте сектор (/lh territory claim).');
    event.cancel();
    return;
  }
  if (sec.kind === 'claimed' && sec.owner) {
    if (!compRc || compRc.id !== sec.owner) {
      var canMineRc = compRc ? global.LHOpenTTD.canMine(st, compRc.id, sec.owner) : false;
      lhHandlePatrolEvent(server, st, sec.owner, player, 'container_loot', bidStr, block.x, block.y, block.z, !canMineRc);
    }
  }
});

EntityEvents.death(function (event) {
  var ent = event.entity;
  var src = event.source;
  if (!ent || !src) return;
  var killer = src.player || src.actual || src.entity;
  if (!killer || typeof killer.isPlayer !== 'function' || !killer.isPlayer()) return;
  var creative = (typeof killer.isCreative === 'function' && killer.isCreative()) ||
    (typeof killer.isSpectator === 'function' && killer.isSpectator());
  if (creative) return;
  if (String(ent.level.dimension) !== 'minecraft:overworld') return;
  if (typeof ent.isPlayer === 'function' && ent.isPlayer()) return;
  // Track bot-launched hostile mob raid defense kills
  try {
    if (ent.tags && ent.tags.contains('lh_site_corsair')) {
      var srvC = ent.server || killer.server;
      if (srvC && typeof lhCompanyReward === 'function') {
        lhCompanyReward(srvC, killer, 65, 'contract', null);
        lhMsg(killer, '§a[Корсар повержен!] §e+65 Cr §fна счёт вашей компании за защиту каравана!');
      }
    }
    if (ent.tags && ent.tags.contains('lh_bot_raid_mob')) {
      var srvR = ent.server || killer.server;
      if (srvR && global.LHOpenTTD && global.LHOpenTTD.resolveBotMobRaid) {
        var stR = lhOttdRead(srvR);
        for (var ri = 0; ri < (stR.activeMobRaids || []).length; ri++) {
          var ar = stR.activeMobRaids[ri];
          if (ar && ar.status === 'active' && ent.tags.contains('lh_raid_' + ar.id)) {
            ar.killsCount = (ar.killsCount || 0) + 1;
            if (ar.killsCount >= Math.max(1, Number(ar.mobCount || 3))) {
              global.LHOpenTTD.resolveBotMobRaid(stR, ar.id, 'defended');
              lhOttdSave(srvR);
              lhMsg(killer, '§a[Рейд отбит!] §fВы уничтожили отряд «' + (ar.attackerName || ar.attackerCid) + '» — получена награда за оборону!');
            } else {
              lhOttdSave(srvR);
            }
            break;
          }
        }
      }
    }
  } catch (eRaidKill) {}
  // Killing hostile monsters (zombies, skeletons, creepers, etc.) never penalizes territory reputation
  if (lhIsHostileMob(ent)) return;
  var server = ent.server || killer.server;
  if (!server) return;
  var st = lhOttdRead(server);
  var sc = global.LHOpenTTD.sectorCoords(ent.x, ent.z);
  var sec = global.LHOpenTTD.resolveSectorOwner(st, sc.sx, sc.sz);
  var kComp = lhGetPlayerCompany(server, killer);
  if (sec.kind === 'claimed' && sec.owner && (!kComp || kComp.id !== sec.owner)) {
    var canMineK = kComp ? global.LHOpenTTD.canMine(st, kComp.id, sec.owner) : false;
    var mobName = String(ent.type || 'mob');
    lhHandlePatrolEvent(server, st, sec.owner, killer, 'mob_kill', mobName, ent.x, ent.y, ent.z, !canMineK);
  }
});

if (typeof ItemEvents !== 'undefined' && ItemEvents.pickedUp) {
  ItemEvents.pickedUp(function (event) {
    var player = event.player;
    var item = event.item;
    if (!player || !item) return;
    var server = player.server;
    if (!server) return;
    var creative = (typeof player.isCreative === 'function' && player.isCreative()) ||
      (typeof player.isSpectator === 'function' && player.isSpectator());
    if (creative) return;
    if (String(player.level.dimension) !== 'minecraft:overworld') return;
    var pid = lhId(player);
    if (LHOTTDLastGatherAlertByPlayer[pid] && (LHOTTDTick - LHOTTDLastGatherAlertByPlayer[pid]) < 80) return;
    var st = lhOttdRead(server);
    var sc = global.LHOpenTTD.sectorCoords(player.x, player.z);
    var sec = global.LHOpenTTD.resolveSectorOwner(st, sc.sx, sc.sz);
    var comp = lhGetPlayerCompany(server, player);
    if (sec.kind === 'claimed' && sec.owner && (!comp || comp.id !== sec.owner)) {
      LHOTTDLastGatherAlertByPlayer[pid] = LHOTTDTick;
      var canMineG = comp ? global.LHOpenTTD.canMine(st, comp.id, sec.owner) : false;
      var itemStr = item.id ? String(item.id) : (item.item && item.item.id ? String(item.item.id) : 'ресурс');
      lhHandlePatrolEvent(server, st, sec.owner, player, 'resource_gather', itemStr, player.x, player.y, player.z, !canMineG);
    }
  });
}

EntityEvents.spawned(function (event) {
  var ent = event.entity;
  var level = event.level;
  if (!ent || !level || !level.server) return;
  if (String(ent.type) !== 'minecraft:wandering_trader') return;
  if (!global.LHEconomyEngine) return;
  try {
    var econ = lhEconRead(level.server);
    var stWt = lhOttdRead(level.server);
    var repBuyMult = 1.0;
    var repSellMult = 1.0;
    var repLabel = '';
    try {
      var nearP = null;
      var bestD2 = 1e12;
      var pls = level.server.players || [];
      for (var pi = 0; pi < pls.length; pi++) {
        var pl = pls[pi];
        if (!pl || String(pl.level.dimension) !== String(level.dimension)) continue;
        var dx = Number(pl.x) - Number(ent.x);
        var dz = Number(pl.z) - Number(ent.z);
        var d2 = dx * dx + dz * dz;
        if (d2 < bestD2) { bestD2 = d2; nearP = pl; }
      }
      if (nearP && global.LHOpenTTD && global.LHOpenTTD.getAverageBotReputationScore) {
        var nearComp = lhGetPlayerCompany(level.server, nearP);
        var avgScore = global.LHOpenTTD.getAverageBotReputationScore(stWt, nearComp ? nearComp.id : null, lhId(nearP));
        var rMods = global.LHOpenTTD.getReputationPriceModifiers(avgScore);
        repBuyMult = rMods.buyMult;
        repSellMult = rMods.sellMult;
        if (avgScore !== 0) repLabel = ' [реп. ' + avgScore + ']';
      }
    } catch (eRepWt) {}
    var gen = global.LHEconomyEngine.generateWanderingTraderOffers(econ, null, repBuyMult, repSellMult);
    var MerchantOffersCls = Java.loadClass('net.minecraft.world.item.trading.MerchantOffers');
    var MerchantOfferCls = Java.loadClass('net.minecraft.world.item.trading.MerchantOffer');
    var mOffers = new MerchantOffersCls();

    for (var i = 0; i < gen.offers.length; i++) {
      var o = gen.offers[i];
      var emeraldCount = Math.max(1, Math.min(64, Math.round(o.offerPrice / 15)));
      var emeraldStack = Item.of('minecraft:emerald', emeraldCount);
      var itemStack = Item.of(o.itemId, Math.max(1, Math.min(64, o.qty)));
      if (!emeraldStack || emeraldStack.empty || !itemStack || itemStack.empty) continue;
      if (o.side === 'sell_to_player') {
        mOffers.add(new MerchantOfferCls(emeraldStack, Item.empty, itemStack, 0, 8, 5, 0.0));
      } else {
        mOffers.add(new MerchantOfferCls(itemStack, Item.empty, emeraldStack, 0, 8, 5, 0.0));
      }
    }
    if (mOffers.size() > 0 && typeof ent.setOffers === 'function') {
      ent.setOffers(mOffers);
    } else if (mOffers.size() > 0 && ent.offers) {
      ent.offers.clear();
      ent.offers.addAll(mOffers);
    }
    ent.setCustomName(Text.of('§6Бродячий Биржевик §7(-60%..+200%)' + repLabel));
  } catch (eWt) {}
});

ServerEvents.tick(function (event) {
  LHOTTDTick++;
  var server = event.server;
  if (LHOTTDTick % 20 === 0) {
    lhRenderWorldBorders(server);
  }
  if (LHOTTDTick % 1200 === 0) {
    var stProd = lhOttdRead(server);
    global.LHOpenTTD.tickCompanyBuildings(stProd);
    // Apply world comeback buffs (Speed / Haste) for lagging player companies
    if (global.LHOpenTTD.getComebackStatus) {
      var cPlayers = server.players || [];
      for (var cpi = 0; cpi < cPlayers.length; cpi++) {
        var cp = cPlayers[cpi];
        var pComp = lhGetPlayerCompany(server, cp);
        if (!pComp) continue;
        var cb = global.LHOpenTTD.getComebackStatus(stProd, pComp.id);
        if (cb && cb.active) {
          try {
            cp.potionEffects.add('minecraft:speed', 1200, cb.tier >= 3 ? 1 : 0, false, false);
            cp.potionEffects.add('minecraft:haste', 1200, cb.tier >= 2 ? 1 : 0, false, false);
          } catch (eCbEff) {}
        }
      }
    }
    lhOttdSave(server);
  }
  if (LHOTTDTick % 2400 === 0) {
    var botExps = lhBotTick(server, false);
    if (botExps && botExps.length > 0) lhSyncXaeroTerritories(server, null);
    if (global.LHEconomyEngine) {
      var econDecay = lhEconRead(server);
      if (Object.keys(econDecay.items || {}).length > 0) {
        global.LHEconomyEngine.decayMarketTick(econDecay);
        lhEconSave(server);
      }
    }
  }
  if (LHOTTDTick % 200 === 0) {
    var stPeriod = lhOttdRead(server);
    var changedPeriod = false;
    if (global.LHOpenTTD.tickAuctions) {
      var settledAucs = global.LHOpenTTD.tickAuctions(stPeriod, LHOTTDTick);
      if (settledAucs && settledAucs.length > 0) {
        changedPeriod = true;
        settledAucs.forEach(function (sa) {
          if (sa && sa.sold && typeof lhLogEvent === 'function') {
            lhLogEvent(server, 'market', 'Аукцион ' + sa.auction.id + ': «' + sa.auction.buildingName + '» продан ' + sa.buyerCid + ' за ' + sa.finalPrice + ' Cr!', { chatMode: 'important' });
          }
        });
      }
    }
    if (global.LHOpenTTD.tickSupplyContracts) {
      var scEvs = global.LHOpenTTD.tickSupplyContracts(stPeriod, LHOTTDTick);
      if (scEvs && scEvs.length > 0) changedPeriod = true;
    }
    if (global.LHOpenTTD.tickBotMobRaids) {
      var rEvs = global.LHOpenTTD.tickBotMobRaids(stPeriod, LHOTTDTick);
      if (rEvs && rEvs.length > 0) changedPeriod = true;
    }
    if (lhSyncBuildingPhysicalContainers(server, stPeriod) > 0) {
      changedPeriod = true;
    }
    if (global.LHTradeLogistics && global.LHTradeLogistics.tickAutomatedRoutes) {
      var logAuto = lhLogisticsRead(server);
      var routeEvs = global.LHTradeLogistics.tickAutomatedRoutes(logAuto, stPeriod, LHOTTDTick);
      if (routeEvs && routeEvs.length > 0) {
        routeEvs.forEach(function (rev) {
          if (rev && rev.pirateHit && typeof lhLogEvent === 'function') {
            lhLogEvent(server, 'raid', 'Корсары ограбили караван ' + rev.routeId + ': похищено ' + rev.pirateHit.stolenQty + '× ' + rev.pirateHit.stolenItem + '!', { chatMode: 'important' });
          }
        });
        lhLogisticsSave(server);
        changedPeriod = true;
      }
    }
    if (changedPeriod) lhOttdSave(server);
  }
  if (LHOTTDTick % 20 !== 0) return;

  var st = lhOttdRead(server);
  var logSt = lhLogisticsRead(server);
  if (global.LHTradeLogistics) {
    if (global.LHTradeLogistics.tickAutomatedRoutes && LHOTTDTick % 1200 !== 0) {
      var hasTransit = (logSt.automatedRoutes || []).some(function (rt) { return rt && rt.enabled && rt.useTransitTimer; });
      if (hasTransit) {
        var rEvFast = global.LHTradeLogistics.tickAutomatedRoutes(logSt, st, LHOTTDTick);
        if (rEvFast && rEvFast.length > 0) {
          rEvFast.forEach(function (rev) {
            if (rev && rev.pirateHit && typeof lhLogEvent === 'function') {
              lhLogEvent(server, 'raid', 'Корсары ограбили конвой ' + rev.routeId + ': похищено ' + rev.pirateHit.stolenQty + '× ' + rev.pirateHit.stolenItem + '!', { chatMode: 'important' });
            }
          });
          lhLogisticsSave(server);
          lhOttdSave(server);
        }
      }
    }
    var tickRes = global.LHTradeLogistics.tickDeliveries(logSt, st, LHOTTDTick);
    var arrivedList = (tickRes && tickRes.arrivedBuy) ? tickRes.arrivedBuy : [];
    var changedLog = arrivedList.length > 0 || (tickRes && ((tickRes.dueDelegatedSell && tickRes.dueDelegatedSell.length > 0) || (tickRes.holdEvents && tickRes.holdEvents.length > 0)));
    if (arrivedList.length > 0) {
      for (var ai = 0; ai < arrivedList.length; ai++) {
        var del = arrivedList[ai];
        var bCompDel = st.companies[del.buyerCid];
        var bTerm = bCompDel ? lhEnsureCompanyTerminalBuilt(server, st, bCompDel) : null;
        var insCnt = bTerm ? lhInsertIntoTerminalContainer(server, bTerm, del.itemId, del.qty) : 0;
        var leftCnt = Math.max(0, Number(del.qty) - insCnt);
        del.unclaimedQty = leftCnt;
        if (leftCnt === 0) del.status = 'completed';
        if (bCompDel && bCompDel.members) {
          var plsDel = server.players || [];
          for (var pdi = 0; pdi < plsDel.length; pdi++) {
            var pd = plsDel[pdi];
            if (bCompDel.members.indexOf(lhId(pd)) !== -1) {
              lhMsg(pd, '§a[Доставка ' + del.id + ' прибыла] §f' + del.qty + '× ' + del.itemId +
                (leftCnt === 0 ? ' загружено в бочку терминала!' : (' — заберите в терминале: /lh delivery claim ' + del.id)));
            }
          }
        }
      }
    }
    if (changedLog) {
      lhLogisticsSave(server);
      lhOttdSave(server);
    }
  }
  var plist = server.players || [];

  // Progress active physical sector raids (60s hold inside target sector)
  Object.keys(LHOTTDActiveRaids).forEach(function (rPid) {
    var raid = LHOTTDActiveRaids[rPid];
    if (!raid) return;
    var rPlayer = null;
    for (var pi = 0; pi < plist.length; pi++) {
      if (lhId(plist[pi]) === rPid) { rPlayer = plist[pi]; break; }
    }
    if (!rPlayer || String(rPlayer.level.dimension) !== 'minecraft:overworld' ||
        (typeof rPlayer.isAlive === 'function' && !rPlayer.isAlive())) {
      delete LHOTTDActiveRaids[rPid];
      return;
    }
    var curSc = global.LHOpenTTD.sectorCoords(rPlayer.x, rPlayer.z);
    if (curSc.sx !== raid.sx || curSc.sz !== raid.sz) {
      delete LHOTTDActiveRaids[rPid];
      if (typeof rPlayer.tell === 'function') rPlayer.tell('§c[Рейд] Вы покинули сектор (' + raid.sx + ', ' + raid.sz + ') — рейд сорван!');
      return;
    }
    raid.ticksLeft -= 20;
    if (raid.ticksLeft <= 0) {
      delete LHOTTDActiveRaids[rPid];
      var res = global.LHOpenTTD.weakenOrCaptureSector(st, raid.companyId, raid.sx, raid.sz, 1, 0);
      if (res.ok && typeof lhPlayerHasOrigin === 'function' && lhPlayerHasOrigin(rPlayer, 'bandit')) {
        var bComp = st.companies[raid.companyId];
        if (bComp) {
          bComp.cash += 35;
          if (typeof rPlayer.tell === 'function') {
            rPlayer.tell('§6[Бандит] §aТрофеи с рейда: +35 Cr в казну компании!');
          }
        }
      }
      lhOttdSave(server);
      if (res.ok) {
        if (res.captured) {
          lhUnlock(rPlayer, 'longhaul:openttd/claim');
          lhSyncXaeroTerritories(server, null);
        }
        if (typeof lhLogEvent === 'function') {
          lhLogEvent(server, 'raid', 'Рейд в секторе (' + raid.sx + ', ' + raid.sz + ') завершён: ' +
            (res.captured ? ('сектор захвачен ' + raid.companyId + '!') : ('укрепление снижено до ' + res.newStrength)), { chatMode: 'important' });
        }
        rPlayer.tell(res.captured
          ? ('§a[Рейд успешен] Сектор (' + raid.sx + ', ' + raid.sz + ') перешёл под контроль вашей компании!')
          : ('§e[Рейд] Оборона сектора (' + raid.sx + ', ' + raid.sz + ') пробита до уровня ' + res.newStrength + '. Проведите ещё один рейд для полного захвата!'));
      }
    } else if (raid.ticksLeft % 300 === 0) {
      var unameR = rPlayer.username || (typeof rPlayer.getName === 'function' ? rPlayer.getName().getString() : '');
      if (unameR) {
        server.runCommandSilent('title ' + unameR + ' actionbar ' + JSON.stringify({
          text: '⚔ Рейд (' + raid.sx + ',' + raid.sz + '): осталось ' + Math.round(raid.ticksLeft / 20) + 'с',
          color: 'red'
        }));
      }
    }
  });

  for (var i = 0; i < plist.length; i++) {
    var p = plist[i];
    if (String(p.level.dimension) !== 'minecraft:overworld') {
      continue;
    }
    var pid = lhId(p);
    var sc = global.LHOpenTTD.sectorCoords(p.x, p.z);
    var sec = global.LHOpenTTD.resolveSectorOwner(st, sc.sx, sc.sz);
    var comp = lhGetPlayerCompany(server, p);
    var prevKey = LHOTTDLastSectorByPlayer[pid];
    var prevOwner = prevKey ? String(prevKey).split(':')[0] : null;
    if (prevOwner && prevOwner !== 'none' && prevOwner !== sec.owner && global.LHTradeLogistics) {
      if (global.LHTradeLogistics.hasActiveBorderPass(logSt, pid, prevOwner)) {
        lhFinalizeTradePassOnLeave(server, p, prevOwner);
      }
    }
    var nowTag = (sec.owner || 'none') + ':' + sec.kind;
    var hasBorderPass = !!(sec.owner && global.LHTradeLogistics && global.LHTradeLogistics.hasActiveBorderPass(logSt, pid, sec.owner));
    var unauthorized = sec.kind === 'claimed' && sec.owner && !hasBorderPass &&
      (!comp || (comp.id !== sec.owner && !global.LHOpenTTD.canTransit(st, comp.id, sec.owner)));
    var uname = p.username || (typeof p.getName === 'function' ? p.getName().getString() : '');
    var oComp = sec.owner ? st.companies[sec.owner] : null;
    var activeWarn = LHOTTDTrespassWarn[pid];

    // If player left the warned company's unauthorized territory in time, clear warning safely
    if (activeWarn && (!unauthorized || sec.owner !== activeWarn.ownerId)) {
      if (activeWarn.strikes === 0) {
        lhMsg(p, '§a[Граница] Вы покинули территорию «' + activeWarn.ownerName + '» вовремя — репутация не снижена.');
      }
      delete LHOTTDTrespassWarn[pid];
      activeWarn = null;
    }

    if (prevKey && prevKey !== nowTag && oComp && uname) {
      var msgJson = JSON.stringify({
        text: (unauthorized ? '⚠ ЧУЖАЯ ГРАНИЦА: ' : '🏴 Территория: ') + oComp.name +
          (sec.kind === 'claimed' ? (unauthorized ? ' [НЕТ ПРОПУСКА]' : ' [Захвачен]') : ' [Влияние]'),
        color: unauthorized ? 'red' : (oComp.color || 'yellow')
      });
      server.runCommandSilent('title ' + uname + ' actionbar ' + msgJson);
      if (sec.kind === 'claimed' && sec.owner && (!comp || comp.id !== sec.owner)) {
        lhHandlePatrolEvent(server, st, sec.owner, p, 'trespass', 'сектор (' + sc.sx + ',' + sc.sz + ')', p.x, p.y, p.z, false);
      }
      if (unauthorized && !activeWarn) {
        LHOTTDTrespassWarn[pid] = {
          ownerId: oComp.id,
          ownerName: oComp.name,
          sx: sc.sx,
          sz: sc.sz,
          warnedTick: LHOTTDTick,
          nextPenaltyTick: LHOTTDTick + 200,
          strikes: 0
        };
        activeWarn = LHOTTDTrespassWarn[pid];
        lhMsg(p, '§e§l[Предупреждение · ' + (oComp.isBot ? 'Бот-компания' : 'Граница') + '] §fВы пересекли границу «' +
          oComp.name + '» в секторе (' + sc.sx + ', ' + sc.sz + ')! Покиньте территорию в течение §c10 сек§f, иначе потеряете репутацию и цены вырастут! (/lh diplomacy license ' + sec.owner + ' transit)');
      }
    }

    // Enforce grace period -> reputation loss + patrol guards if player stays on unauthorized territory
    if (unauthorized && oComp && activeWarn && activeWarn.ownerId === sec.owner) {
      var ticksRem = activeWarn.nextPenaltyTick - LHOTTDTick;
      if (ticksRem > 0 && activeWarn.strikes === 0 && uname) {
        var secsLeft = Math.max(1, Math.ceil(ticksRem / 20));
        server.runCommandSilent('title ' + uname + ' actionbar ' + JSON.stringify({
          text: '⚠ ПОКИНЬТЕ ТЕРРИТОРИЮ «' + oComp.name + '»: ' + secsLeft + 'с до штрафа репутации!',
          color: 'gold'
        }));
      } else if (ticksRem <= 0) {
        activeWarn.strikes += 1;
        activeWarn.nextPenaltyTick = LHOTTDTick + 300;
        LHOTTDLastViolationByPlayer[pid] = LHOTTDTick;
        var patrolBorder = lhHandlePatrolEvent(server, st, sec.owner, p, 'trespass', 'вторжение в (' + sc.sx + ',' + sc.sz + ')', p.x, p.y, p.z, true);
        var pMultT = patrolBorder ? patrolBorder.penaltyMult : 1.0;
        var tViol = global.LHOpenTTD.recordTerritoryViolation(st, comp ? comp.id : null, sec.owner, 'trespass', sc.sx, sc.sz, pid, pMultT);
        lhOttdSave(server);
        lhMsg(p, '§c§l[Репутация снижена] §fВы не покинули территорию «' + oComp.name +
          '»! Отношения ' + tViol.delta + ' (итого ' + tViol.newScore + ', ' + tViol.standing + '), пошлина ' + tViol.fine +
          ' Cr. §7Цены: покупка ×' + tViol.pricing.buyMult + ', сбыт ×' + tViol.pricing.sellMult + ' (/lh diplomacy license ' + sec.owner + ' transit)');
        if (tViol.hostile && uname) {
          server.runCommandSilent('effect give ' + uname + ' minecraft:glowing 8 0 true');
          server.runCommandSilent('effect give ' + uname + ' minecraft:slowness 4 0 true');
        }
      }
    }
    LHOTTDLastSectorByPlayer[pid] = nowTag;

    // Transport specialization active perks
    if (comp && comp.transportSpec && LHOTTDTick % 60 === 0) {
      var uname2 = p.username || (typeof p.getName === 'function' ? p.getName().getString() : '');
      if (!uname2) continue;
      if (comp.transportSpec === 'rail' && p.vehicle && typeof lhClassifyVehicle === 'function' && lhClassifyVehicle(p.vehicle) === 'rail') {
        server.runCommandSilent('effect give ' + uname2 + ' minecraft:speed 4 0 true');
      } else if (comp.transportSpec === 'sea' && (p.isInWater && p.isInWater())) {
        server.runCommandSilent('effect give ' + uname2 + ' minecraft:water_breathing 5 0 true');
        server.runCommandSilent('effect give ' + uname2 + ' minecraft:dolphins_grace 5 0 true');
      } else if (comp.transportSpec === 'air' && Number(p.y) >= 120) {
        server.runCommandSilent('effect give ' + uname2 + ' minecraft:slow_falling 4 0 true');
      }
    }
  }
});

PlayerEvents.loggedIn(function (event) {
  var server = event.server, player = event.player;
  lhOttdRead(server);
  lhClearLegacyMinimapHud(player);
  lhSyncXaeroTerritories(server, player);
  if (server && typeof server.scheduleInTicks === 'function') {
    server.scheduleInTicks(40, function () { lhSyncXaeroTerritories(server, player); });
    server.scheduleInTicks(100, function () { lhSyncXaeroTerritories(server, player); });
  }
  var comp = lhGetPlayerCompany(server, player);
  if (comp) {
    lhMsg(player, 'Компания: ' + comp.colorCode + comp.name + ' §f(баланс: ' + comp.cash + ' Cr, транспорт: ' +
      (comp.transportSpec || 'не выбран') + ', ресурс: ' + (comp.resourceSpec || 'не выбран') + '). Карта: Xaero [M] / /lh map · Лог: /lh events');
  } else {
    lhMsg(player, 'OpenTTD-режим: создайте компанию (/lh company create <id> <название>) | Карта границ: Xaero [M] / /lh map | Лог: /lh events.');
  }
});

ServerEvents.commandRegistry(function (event) {
  var C = event.commands, root = C.literal('lh');

  var mapCmd = C.literal('map');
  mapCmd.executes(function (ctx) {
    return lhCompanyTerritoryMap(ctx.source.server, ctx.source.playerOrException, 5);
  });
  mapCmd.then(C.literal('item').executes(function (ctx) {
    return lhGiveTerritoryMapItem(ctx.source.server, ctx.source.playerOrException, false);
  }));
  mapCmd.then(C.argument('radius', LHOTTDStringArg.word()).executes(function (ctx) {
    var rad = parseInt(LHOTTDStringArg.getString(ctx, 'radius'), 10);
    return lhCompanyTerritoryMap(ctx.source.server, ctx.source.playerOrException, isNaN(rad) ? 5 : rad);
  }));
  root.then(mapCmd);

  var compCmd = C.literal('company');
  compCmd.then(C.literal('list').executes(function (ctx) {
    var server = ctx.source.server, p = ctx.source.playerOrException, st = lhOttdRead(server);
    var list = Object.keys(st.companies).map(function (cid) {
      return { c: st.companies[cid], val: global.LHOpenTTD.computeValuation(st, cid), claims: global.LHOpenTTD.countClaims(st, cid) };
    });
    list.sort(function (a, b) { return b.val - a.val; });
    lhMsg(p, '=== Рейтинг компаний (OpenTTD) ===');
    list.forEach(function (row, idx) {
      var c = row.c;
      lhMsg(p, (idx + 1) + '. ' + c.colorCode + c.name + ' §7[' + c.id + (c.isBot ? ' · BOT' : '') + '] §f| Капитал: ' +
        row.val + ' Cr (нал: ' + c.cash + ') | Секторов: ' + row.claims + ' | ' +
        (c.transportSpec || '-') + '/' + (c.resourceSpec || '-'));
    });
    return 1;
  }));

  compCmd.then(C.literal('create')
    .then(C.argument('id', LHOTTDStringArg.word())
      .then(C.argument('name', LHOTTDStringArg.greedyString()).executes(function (ctx) {
        var server = ctx.source.server, p = ctx.source.playerOrException, st = lhOttdRead(server);
        var id = LHOTTDStringArg.getString(ctx, 'id');
        var name = LHOTTDStringArg.getString(ctx, 'name');
        var res = global.LHOpenTTD.companyCreate(st, lhId(p), id, name, p.x, p.z);
        if (!res.ok) {
          lhMsg(p, res.reason === 'exists' ? 'Компания с таким ID уже существует.' : 'Некорректный ID (латиница/цифры, не bot_*).');
          return 0;
        }
        if (typeof lhOriginFeeMult === 'function' && lhOriginFeeMult(p) > 1.0) {
          res.company.cash = Math.max(100, Math.round(res.company.cash / lhOriginFeeMult(p)));
        }
        lhOttdSave(server);
        lhUnlock(p, 'longhaul:openttd/company');
        if (typeof lhTeamJoin === 'function') lhTeamJoin(server, p, res.company.id);
        lhMsg(p, res.company.colorCode + 'Основана компания «' + res.company.name + '» [' + res.company.id + ']! Стартовый капитал: ' +
          res.company.cash + ' Cr. Выберите специализации: /lh company spec <transport|resource> <id>');
        return 1;
      }))));

  compCmd.then(C.literal('join')
    .then(C.argument('id', LHOTTDStringArg.word()).executes(function (ctx) {
      var server = ctx.source.server, p = ctx.source.playerOrException, st = lhOttdRead(server);
      var id = LHOTTDStringArg.getString(ctx, 'id');
      var res = global.LHOpenTTD.companyJoin(st, lhId(p), id);
      if (!res.ok) { lhMsg(p, 'Компания игроков "' + id + '" не найдена.'); return 0; }
      lhOttdSave(server);
      lhUnlock(p, 'longhaul:openttd/company');
      if (typeof lhTeamJoin === 'function') lhTeamJoin(server, p, res.company.id);
      lhMsg(p, 'Вы вступили в компанию ' + res.company.colorCode + res.company.name + '!');
      return 1;
    })));

  compCmd.then(C.literal('leave').executes(function (ctx) {
    var server = ctx.source.server, p = ctx.source.playerOrException, st = lhOttdRead(server);
    if (!global.LHOpenTTD.companyLeave(st, lhId(p))) { lhMsg(p, 'Вы не состоите в компании.'); return 0; }
    lhOttdSave(server);
    lhMsg(p, 'Вы покинули компанию.');
    return 1;
  }));

  compCmd.then(C.literal('info').executes(function (ctx) {
    var server = ctx.source.server, p = ctx.source.playerOrException, st = lhOttdRead(server);
    var c = lhGetPlayerCompany(server, p);
    if (!c) { lhMsg(p, 'Вы не в компании. /lh company create <id> <название>'); return 0; }
    lhMsg(p, c.colorCode + c.name + ' [' + c.id + '] §f| Нал: ' + c.cash + ' Cr | Оценка: ' + global.LHOpenTTD.computeValuation(st, c.id) +
      ' Cr | Секторов: ' + global.LHOpenTTD.countClaims(st, c.id) + ' | Транспорт: ' + (c.transportSpec || 'нет') +
      ' | Ресурсы: ' + (c.resourceSpec || 'нет') + ' | Торговля: ' + (c.stats.tradeVolume || 0) + ' Cr');
    return 1;
  }));

  var specNode = C.literal('spec');
  var tSpecNode = C.literal('transport');
  Object.keys(global.LHOpenTTD.TRANSPORT_SPECS).forEach(function (sid) {
    tSpecNode.then(C.literal(sid).executes(function (ctx) {
      var server = ctx.source.server, p = ctx.source.playerOrException, st = lhOttdRead(server);
      var c = lhGetPlayerCompany(server, p);
      if (!c) { lhMsg(p, 'Сначала создайте/вступите в компанию.'); return 0; }
      var res = global.LHOpenTTD.setSpecialization(st, c.id, 'transport', sid);
      if (!res.ok) { lhMsg(p, 'Для смены специализации нужно ' + res.cost + ' Cr.'); return 0; }
      lhOttdSave(server);
      if (c.transportSpec && c.resourceSpec) lhUnlock(p, 'longhaul:openttd/specs');
      lhMsg(p, 'Транспортная специализация: ' + res.spec.icon + ' ' + res.spec.name + ' — ' + res.spec.summary);
      return 1;
    }));
  });
  var rSpecNode = C.literal('resource');
  Object.keys(global.LHOpenTTD.RESOURCE_SPECS).forEach(function (sid) {
    rSpecNode.then(C.literal(sid).executes(function (ctx) {
      var server = ctx.source.server, p = ctx.source.playerOrException, st = lhOttdRead(server);
      var c = lhGetPlayerCompany(server, p);
      if (!c) { lhMsg(p, 'Сначала создайте/вступите в компанию.'); return 0; }
      var res = global.LHOpenTTD.setSpecialization(st, c.id, 'resource', sid);
      if (!res.ok) { lhMsg(p, 'Для смены специализации нужно ' + res.cost + ' Cr.'); return 0; }
      lhOttdSave(server);
      if (c.transportSpec && c.resourceSpec) lhUnlock(p, 'longhaul:openttd/specs');
      lhMsg(p, 'Ресурсная специализация: ' + res.spec.icon + ' ' + res.spec.name + ' — ' + res.spec.summary);
      return 1;
    }));
  });
  specNode.then(tSpecNode);
  specNode.then(rSpecNode);
  compCmd.then(specNode);

  compCmd.then(C.literal('pact').then(C.argument('other', LHOTTDStringArg.word()).executes(function (ctx) {
    var server = ctx.source.server, p = ctx.source.playerOrException, st = lhOttdRead(server);
    var c = lhGetPlayerCompany(server, p);
    var otherId = global.LHOpenTTD.sanitizeId(LHOTTDStringArg.getString(ctx, 'other'));
    if (!c || !st.companies[otherId] || otherId === c.id) {
      lhMsg(p, 'Укажите корректный ID другой компании.');
      return 0;
    }
    var active = global.LHOpenTTD.togglePact(st, c.id, otherId);
    lhOttdSave(server);
    lhMsg(p, active
      ? ('Подписан торговый пакт (0% пошлины и свободный транзит) с компанией ' + st.companies[otherId].name + '!')
      : ('Торговый пакт с ' + st.companies[otherId].name + ' расторгнут.'));
    return 1;
  })));
  var envNode = C.literal('env');
  ['normal', 'air', 'sea', 'underground'].forEach(function (ek) {
    envNode.then(C.literal(ek).executes(function (ctx) {
      return lhRelocateCompanyEnv(ctx.source.server, ctx.source.playerOrException, ek, false);
    }));
  });
  compCmd.then(envNode);
  compCmd.then(C.literal('buyout').then(C.argument('target', LHOTTDStringArg.word()).executes(function (ctx) {
    var tid = global.LHOpenTTD.sanitizeId(LHOTTDStringArg.getString(ctx, 'target'));
    var r = lhEndgameBuyoutCmd(ctx.source.server, ctx.source.playerOrException, tid);
    return r && r.ok ? 1 : 0;
  })));
  compCmd.then(C.literal('merge').then(C.argument('target', LHOTTDStringArg.word()).executes(function (ctx) {
    var tid = global.LHOpenTTD.sanitizeId(LHOTTDStringArg.getString(ctx, 'target'));
    var r = lhEndgameBuyoutCmd(ctx.source.server, ctx.source.playerOrException, tid);
    return r && r.ok ? 1 : 0;
  })));
  root.then(compCmd);

  var mkt = C.literal('market');
  mkt.then(C.literal('list').executes(function (ctx) {
    var server = ctx.source.server, p = ctx.source.playerOrException, st = lhOttdRead(server);
    lhMsg(p, '=== Биржа Консорциума (/lh market sell|buy <id>) ===');
    st.marketOrders.filter(function (o) { return o.remainingBatches > 0; }).slice(0, 14).forEach(function (o) {
      var c = st.companies[o.companyId];
      var sub = st.subsidy && st.subsidy.orderId === o.id ? ' §e[СУБСИДИЯ ×1.75]' : '';
      lhMsg(p, o.id + ' | ' + (o.side === 'buy' ? '§aСКУПКА' : '§bПРОДАЖА') + ' §f' + o.qty + '× ' + o.item +
        ' за ' + o.price + ' Cr (ост. ' + o.remainingBatches + ') — ' + (c ? c.name : o.companyId) + sub);
    });
    return 1;
  }));
  mkt.then(C.literal('sell').then(C.argument('orderId', LHOTTDStringArg.word()).executes(function (ctx) {
    return lhMarketSell(ctx.source.server, ctx.source.playerOrException, LHOTTDStringArg.getString(ctx, 'orderId'), false);
  })));
  mkt.then(C.literal('buy').then(C.argument('orderId', LHOTTDStringArg.word()).executes(function (ctx) {
    return lhMarketBuy(ctx.source.server, ctx.source.playerOrException, LHOTTDStringArg.getString(ctx, 'orderId'), false);
  })));
  root.then(mkt);

  var trade = C.literal('trade');
  trade.then(C.literal('list').executes(function (ctx) {
    var server = ctx.source.server, p = ctx.source.playerOrException, st = lhOttdRead(server);
    var open = st.tradeOffers.filter(function (o) { return o.status === 'open'; });
    lhMsg(p, 'Открытые сделки между компаниями (' + open.length + '):');
    open.slice(0, 10).forEach(function (o) {
      lhMsg(p, o.id + ': ' + o.sellerCompany + ' -> ' + o.targetCompany + ' | ' + o.qty + '× ' + o.item + ' за ' + o.price + ' Cr');
    });
    return 1;
  }));
  trade.then(C.literal('offer')
    .then(C.argument('target', LHOTTDStringArg.word())
      .then(C.argument('qty', LHOTTDStringArg.word())
        .then(C.argument('price', LHOTTDStringArg.word()).executes(function (ctx) {
          var qty = parseInt(LHOTTDStringArg.getString(ctx, 'qty'), 10);
          var price = parseInt(LHOTTDStringArg.getString(ctx, 'price'), 10);
          return lhCreateTradeOffer(ctx.source.server, ctx.source.playerOrException, LHOTTDStringArg.getString(ctx, 'target'), qty, price, false) ? 1 : 0;
        })))));
  trade.then(C.literal('accept').then(C.argument('id', LHOTTDStringArg.word()).executes(function (ctx) {
    return lhAcceptTradeOffer(ctx.source.server, ctx.source.playerOrException, LHOTTDStringArg.getString(ctx, 'id'), false);
  })));
  trade.then(C.literal('visit').then(C.argument('company', LHOTTDStringArg.word()).executes(function (ctx) {
    return lhRequestBorderTrade(ctx.source.server, ctx.source.playerOrException, LHOTTDStringArg.getString(ctx, 'company'), false);
  })));
  root.then(trade);

  var bot = C.literal('bot');
  bot.then(C.literal('status').executes(function (ctx) {
    var server = ctx.source.server, p = ctx.source.playerOrException, st = lhOttdRead(server);
    var maxSecAbs = 5;
    try { if (typeof lhTerritoryCounts === 'function') maxSecAbs = Math.max(2, Math.floor((lhTerritoryCounts(server).size || 724) / 2 / global.LHOpenTTD.SECTOR_SIZE)); } catch (eBs) {}
    var scale = global.LHOpenTTD.getBotScalingDetails ? global.LHOpenTTD.getBotScalingDetails(st, maxSecAbs, st.completedChapters || 0) : null;
    if (scale) {
      lhMsg(p, '§e[Масштаб ботов] Лимит: §a' + scale.maxSectors + ' сект. (' + scale.maxChunks + ' чанков) §7| Игроков: ' +
        scale.playerCompanies + ' комп., ' + scale.playerSectors + ' сект. (' + scale.playerChunks + ' чанков), глав: ' + scale.completedChapters);
    }
    Object.keys(st.companies).forEach(function (cid) {
      var c = st.companies[cid];
      if (!c.isBot) return;
      lhMsg(p, c.colorCode + c.name + ' §7(' + c.transportSpec + '/' + c.resourceSpec + ') §f— нал: ' + c.cash +
        ' Cr, секторов: ' + global.LHOpenTTD.countClaims(st, cid) + ', капитал: ' + global.LHOpenTTD.computeValuation(st, cid) + ' Cr.');
    });
    return 1;
  }));
  bot.then(C.literal('step').requires(function (s) { return s.hasPermission(2); }).executes(function (ctx) {
    var ev = lhBotTick(ctx.source.server, false);
    lhMsg(ctx.source.playerOrException, 'Шаг ИИ-компаний выполнен (новых захватов: ' + ev.length + ').');
    return 1;
  }));
  root.then(bot);

  var ottd = C.literal('openttd');
  ottd.then(C.literal('verify').executes(function (ctx) {
    var server = ctx.source.server, p = ctx.source.playerOrException, st = lhOttdRead(server);
    var c = lhGetPlayerCompany(server, p);
    if (!c) { lhMsg(p, 'Сначала создайте компанию: /lh company create <id> <название>'); return 0; }
    lhUnlock(p, 'longhaul:openttd/company');
    if (c.transportSpec && c.resourceSpec) lhUnlock(p, 'longhaul:openttd/specs');
    if (global.LHOpenTTD.countClaims(st, c.id) >= 2) lhUnlock(p, 'longhaul:openttd/claim');
    if ((c.stats.tradeVolume || 0) > 0) lhUnlock(p, 'longhaul:openttd/trade');
    lhUnlock(p, 'longhaul:openttd/empire');
    lhMsg(p, 'Статус OpenTTD-империи обновлён для компании ' + c.colorCode + c.name + '!');
    return 1;
  }));
  root.then(ottd);

  var bldgCmd = C.literal('building');
  bldgCmd.then(C.literal('list').executes(function (ctx) {
    var server = ctx.source.server, p = ctx.source.playerOrException, st = lhOttdRead(server);
    var comp = lhGetPlayerCompany(server, p);
    lhMsg(p, '=== Здания компаний (/lh building build <type> | upgrade <choice> | collect) ===');
    Object.keys(global.LHOpenTTD.BUILDING_CATALOG).forEach(function (bt) {
      var spec = global.LHOpenTTD.BUILDING_CATALOG[bt];
      lhMsg(p, spec.icon + ' §e' + bt + ' §f— ' + spec.name + ' [' + spec.category + '] (' + spec.cost + ' Cr)');
    });
    if (comp) {
      var own = Object.keys(st.buildings || {}).filter(function (k) { return st.buildings[k] && st.buildings[k].owner === comp.id; });
      lhMsg(p, 'Постройки компании (' + own.length + '): ' + (own.length ? own.join(', ') : 'пока нет'));
    }
    return 1;
  }));
  bldgCmd.then(C.literal('build').then(C.argument('type', LHOTTDStringArg.word()).executes(function (ctx) {
    var res = lhBuildFacilityCmd(ctx.source.server, ctx.source.playerOrException, LHOTTDStringArg.getString(ctx, 'type'), undefined, undefined, false);
    return res && res.ok ? 1 : 0;
  })));
  bldgCmd.then(C.literal('upgrade').then(C.argument('choice', LHOTTDStringArg.word()).executes(function (ctx) {
    var res = lhUpgradeFacilityCmd(ctx.source.server, ctx.source.playerOrException, undefined, undefined, LHOTTDStringArg.getString(ctx, 'choice'), false);
    return res && res.ok ? 1 : 0;
  })));
  bldgCmd.then(C.literal('collect').executes(function (ctx) {
    var res = lhCollectFacilityCmd(ctx.source.server, ctx.source.playerOrException, false);
    return res && res.ok ? 1 : 0;
  }));
  bldgCmd.then(C.literal('supply').executes(function (ctx) {
    var res = lhSupplyBuildingCmd(ctx.source.server, ctx.source.playerOrException, undefined, undefined, false);
    return res && res.ok ? 1 : 0;
  }));
  bldgCmd.then(C.literal('repair').executes(function (ctx) {
    var server = ctx.source.server, p = ctx.source.playerOrException, st = lhOttdRead(server);
    var comp = lhGetPlayerCompany(server, p);
    if (!comp) { lhMsg(p, 'Сначала создайте компанию.'); return 0; }
    var dim = (p.level && p.level.dimension) ? String(p.level.dimension) : 'minecraft:overworld';
    var sc = global.LHOpenTTD.sectorCoords(p.x, p.z);
    var res = global.LHOpenTTD.repairBuildingIntegrity(st, comp.id, sc.sx, sc.sz, dim);
    if (!res.ok) { lhMsg(p, 'Не удалось починить здание (' + res.reason + (res.cost ? (', нужно ' + res.cost + ' Cr') : '') + ').'); return 0; }
    lhOttdSave(server);
    lhPlacePhysicalBuildingBlocks(server, res.building);
    lhMsg(p, '§a[Ремонт] Здание восстановлено до 100% за ' + res.cost + ' Cr!');
    return 1;
  }));
  bldgCmd.then(C.literal('variant').then(C.argument('variantId', LHOTTDStringArg.word()).executes(function (ctx) {
    var server = ctx.source.server, p = ctx.source.playerOrException, st = lhOttdRead(server);
    var comp = lhGetPlayerCompany(server, p);
    if (!comp) { lhMsg(p, 'Сначала создайте компанию.'); return 0; }
    var dim = (p.level && p.level.dimension) ? String(p.level.dimension) : 'minecraft:overworld';
    var sc = global.LHOpenTTD.sectorCoords(p.x, p.z);
    var res = global.LHOpenTTD.setBuildingVariant(st, comp.id, sc.sx, sc.sz, LHOTTDStringArg.getString(ctx, 'variantId'), dim);
    if (!res.ok) { lhMsg(p, '§cОшибка смены варианта: ' + res.reason); return 0; }
    lhOttdSave(server);
    lhSyncXaeroTerritories(server, p);
    lhMsg(p, '§a[Специализация] «' + res.variant.name + '» теперь производит §e' + res.variant.product + '§f!');
    return 1;
  })));
  root.then(bldgCmd);

  var borderCmd = C.literal('border');
  borderCmd.then(C.literal('toggle').executes(function (ctx) {
    var server = ctx.source.server, p = ctx.source.playerOrException, st = lhOttdRead(server), pid = lhId(p);
    if (!st.minimapPrefs) st.minimapPrefs = {};
    var cur = st.minimapPrefs[pid] || { enabled: true, size: 'medium', worldBorders: true };
    cur.worldBorders = cur.worldBorders === false;
    st.minimapPrefs[pid] = cur;
    lhOttdSave(server);
    lhMsg(p, 'Видимая 3D-граница в мире (частицы): ' + (cur.worldBorders ? '§aВКЛ' : '§cВЫКЛ') + '§f.');
    return 1;
  }));
  root.then(borderCmd);

  var dipCmd = C.literal('diplomacy');
  dipCmd.then(C.literal('status').executes(function (ctx) {
    var server = ctx.source.server, p = ctx.source.playerOrException, st = lhOttdRead(server);
    var c = lhGetPlayerCompany(server, p);
    var pid = lhId(p);
    lhMsg(p, '=== Дипломатия и цены по репутации (' + (c ? c.name : 'Личная репутация') + ') ===');
    Object.keys(st.companies).forEach(function (otherId) {
      if (c && otherId === c.id) return;
      var scNow = global.LHOpenTTD.getEffectiveRelationScore(st, c ? c.id : null, pid, otherId);
      var pm = global.LHOpenTTD.getReputationPriceModifiers(scNow);
      var rel = c ? global.LHOpenTTD.getRelation(st, c.id, otherId) : null;
      var licT = c ? global.LHOpenTTD.canTransit(st, c.id, otherId) : false;
      var licM = c ? global.LHOpenTTD.canMine(st, c.id, otherId) : false;
      lhMsg(p, '• ' + st.companies[otherId].name + ' [' + otherId + ']: §e' + scNow + ' (' + pm.standing + ') §7| покупка ×' +
        pm.buyMult + ', сбыт ×' + pm.sellMult +
        (rel && rel.alliance ? ' §a[АЛЬЯНС]' : '') + (licT ? ' §b[Проход]' : '') + (licM ? ' §6[Добыча]' : ''));
    });
    return 1;
  }));
  dipCmd.then(C.literal('ally').then(C.argument('other', LHOTTDStringArg.word()).executes(function (ctx) {
    var res = lhDiplomacyAction(ctx.source.server, ctx.source.playerOrException, 'ally', LHOTTDStringArg.getString(ctx, 'other'), null, false);
    return res && res.ok ? 1 : 0;
  })));
  dipCmd.then(C.literal('gift').then(C.argument('other', LHOTTDStringArg.word()).executes(function (ctx) {
    var res = lhDiplomacyAction(ctx.source.server, ctx.source.playerOrException, 'gift', LHOTTDStringArg.getString(ctx, 'other'), 150, false);
    return res && res.ok ? 1 : 0;
  })));
  dipCmd.then(C.literal('license').then(C.argument('other', LHOTTDStringArg.word()).then(C.argument('kind', LHOTTDStringArg.word()).executes(function (ctx) {
    var res = lhDiplomacyAction(ctx.source.server, ctx.source.playerOrException, LHOTTDStringArg.getString(ctx, 'kind'), LHOTTDStringArg.getString(ctx, 'other'), null, false);
    return res && res.ok ? 1 : 0;
  }))));
  dipCmd.then(C.literal('supply').then(C.literal('list').executes(function (ctx) {
    var server = ctx.source.server, p = ctx.source.playerOrException, st = lhOttdRead(server);
    var open = (st.supplyContracts || []).filter(function (sc) { return sc.status === 'open'; });
    lhMsg(p, '=== Контракты на поставку (' + open.length + ') ===');
    open.slice(0, 12).forEach(function (sc) {
      lhMsg(p, sc.id + ': ' + sc.buyerCid + ' ищет ' + sc.qty + '× ' + sc.item + ' за ' + sc.price + ' Cr (ост. ' + sc.remainingBatches + ')');
    });
    return 1;
  })).then(C.literal('fulfill').then(C.argument('id', LHOTTDStringArg.word()).executes(function (ctx) {
    var server = ctx.source.server, p = ctx.source.playerOrException, st = lhOttdRead(server);
    var c = lhGetPlayerCompany(server, p);
    var sid = LHOTTDStringArg.getString(ctx, 'id');
    if (!c) { lhMsg(p, 'Сначала создайте компанию.'); return 0; }
    var target = null;
    for (var i = 0; i < (st.supplyContracts || []).length; i++) {
      if (st.supplyContracts[i].id === sid) { target = st.supplyContracts[i]; break; }
    }
    if (!target || target.status !== 'open') { lhMsg(p, 'Контракт ' + sid + ' не найден.'); return 0; }
    var cons = lhConsumeInvItem(p.inventory, target.item, target.qty);
    if (!cons.ok) { lhMsg(p, 'Нужно ' + target.qty + '× ' + target.item + ' (у вас ' + cons.have + ').'); return 0; }
    var res = global.LHOpenTTD.fulfillSupplyContract(st, c.id, sid);
    lhOttdSave(server);
    if (!res.ok) { lhMsg(p, 'Ошибка контракта: ' + res.reason); return 0; }
    lhMsg(p, '§a[Поставка] Выполнено! Получено ' + res.payout + ' Cr и отношения с ' + res.buyerName + ' теперь ' + res.newScore + '.');
    return 1;
  }))));
  root.then(dipCmd);

  var mmCmd = C.literal('minimap');
  mmCmd.executes(function (ctx) {
    var server = ctx.source.server, p = ctx.source.playerOrException;
    lhSyncXaeroTerritories(server, p);
    lhMsg(p, 'Границы секторов и граница мира отображаются прямо в §bXaero\'s World Map (клавиша M) §fи §bXaero\'s Minimap§f. Переключить слой: /lh minimap toggle.');
    return 1;
  });
  mmCmd.then(C.literal('toggle').executes(function (ctx) {
    var server = ctx.source.server, p = ctx.source.playerOrException, st = lhOttdRead(server);
    var pid = lhId(p);
    var cur = st.minimapPrefs[pid] || { enabled: true, size: 'medium' };
    cur.enabled = !cur.enabled;
    st.minimapPrefs[pid] = cur;
    lhOttdSave(server);
    lhClearLegacyMinimapHud(p);
    lhSyncXaeroTerritories(server, p);
    lhMsg(p, 'Слой границ секторов на карте Xaero: ' + (cur.enabled ? '§aвключён' : '§cвыключен') + '§f.');
    return 1;
  }));
  mmCmd.then(C.literal('size').then(C.argument('sz', LHOTTDStringArg.word()).executes(function (ctx) {
    var server = ctx.source.server, p = ctx.source.playerOrException;
    lhSyncXaeroTerritories(server, p);
    lhMsg(p, 'Размер миникарты настраивается в стандартном меню §bXaero\'s Minimap §f(клавиша Y), границы секторов синхронизируются автоматически.');
    return 1;
  })));
  root.then(mmCmd);

  var Args = event.arguments;
  function lhCmdItemArg(ctx, p) {
    var raw = String(Args.RESOURCE_LOCATION.getResult(ctx, 'item'));
    if ((raw === 'hand' || raw === 'minecraft:hand') && p && p.mainHandItem && !p.mainHandItem.empty) {
      return String(p.mainHandItem.id);
    }
    return raw;
  }

  var priceCmd = C.literal('price');
  priceCmd.then(C.literal('check').then(C.argument('item', Args.RESOURCE_LOCATION.create(event)).executes(function (ctx) {
    var server = ctx.source.server, p = ctx.source.playerOrException;
    if (!global.LHEconomyEngine) return 0;
    var econ = lhEconRead(server);
    var itemArg = lhCmdItemArg(ctx, p);
    var q = global.LHEconomyEngine.getMarketQuote(econ, itemArg);
    lhMsg(p, '§6[Биржа] §f' + q.itemId + ' [' + q.kind + '] | База: ' + q.basePrice + ' Cr | Рынок: §e' + q.price +
      ' Cr §7(×' + q.multiplier + ', спрос=' + q.demand + ', предл=' + q.supply +
      (q.crashed ? (' §c[ОБВАЛ ' + q.crashTicks + ' цикл.]') : '') +
      (q.adminLocked ? ' §b[ADMIN FIX]' : '') + ')');
    return 1;
  })));
  priceCmd.then(C.literal('set').requires(function (s) { return s.hasPermission(2); })
    .then(C.argument('item', Args.RESOURCE_LOCATION.create(event))
      .then(C.argument('value', LHOTTDStringArg.word()).executes(function (ctx) {
        var server = ctx.source.server, p = ctx.source.playerOrException;
        if (!global.LHEconomyEngine) return 0;
        var val = parseInt(LHOTTDStringArg.getString(ctx, 'value'), 10);
        if (!(val > 0)) return 0;
        var econ = lhEconRead(server);
        var q = global.LHEconomyEngine.setAdminPrice(econ, lhCmdItemArg(ctx, p), val);
        lhEconSave(server);
        lhMsg(p, '§b[Admin Price] §fЦена ' + q.itemId + ' зафиксирована на §e' + q.price + ' Cr.');
        return 1;
      }))));
  priceCmd.then(C.literal('bounds').requires(function (s) { return s.hasPermission(2); })
    .then(C.argument('item', Args.RESOURCE_LOCATION.create(event))
      .then(C.argument('min', LHOTTDStringArg.word())
        .then(C.argument('max', LHOTTDStringArg.word()).executes(function (ctx) {
          var server = ctx.source.server, p = ctx.source.playerOrException;
          if (!global.LHEconomyEngine) return 0;
          var mn = parseInt(LHOTTDStringArg.getString(ctx, 'min'), 10);
          var mx = parseInt(LHOTTDStringArg.getString(ctx, 'max'), 10);
          if (!(mn > 0) || mx < mn) return 0;
          var econ = lhEconRead(server);
          var q = global.LHEconomyEngine.setAdminBounds(econ, lhCmdItemArg(ctx, p), mn, mx);
          lhEconSave(server);
          lhMsg(p, '§b[Admin Price] §fКоридор для ' + q.itemId + ': ' + mn + '..' + mx + ' Cr (тек: ' + q.price + ').');
          return 1;
        })))));
  priceCmd.then(C.literal('clear').requires(function (s) { return s.hasPermission(2); })
    .then(C.argument('item', Args.RESOURCE_LOCATION.create(event)).executes(function (ctx) {
      var server = ctx.source.server, p = ctx.source.playerOrException;
      if (!global.LHEconomyEngine) return 0;
      var econ = lhEconRead(server);
      var q = global.LHEconomyEngine.clearAdminPrice(econ, lhCmdItemArg(ctx, p));
      lhEconSave(server);
      lhMsg(p, '§b[Admin Price] §fСброшено для ' + q.itemId + ', текущая рыночная: ' + q.price + ' Cr.');
      return 1;
    })));
  priceCmd.then(C.literal('crash').requires(function (s) { return s.hasPermission(2); })
    .then(C.argument('item', Args.RESOURCE_LOCATION.create(event)).executes(function (ctx) {
      var server = ctx.source.server, p = ctx.source.playerOrException;
      if (!global.LHEconomyEngine) return 0;
      var econ = lhEconRead(server);
      var q = global.LHEconomyEngine.forceCrash(econ, lhCmdItemArg(ctx, p), 12);
      lhEconSave(server);
      lhMsg(p, '§c[Обвал рынка] §fДля ' + q.itemId + ' принудительно включён обвал: цена ' + q.price + ' Cr (×' + q.multiplier + ').');
      return 1;
    })));
  root.then(priceCmd);

  var shopCmd = C.literal('shop');
  shopCmd.then(C.literal('list').executes(function (ctx) {
    var server = ctx.source.server, p = ctx.source.playerOrException;
    if (!global.LHEconomyEngine) return 0;
    var econ = lhEconRead(server);
    var st = lhOttdRead(server);
    var open = (econ.listings || []).filter(function (l) { return l.status === 'open' && l.qtyAvailable > 0; });
    lhMsg(p, '=== Физические витрины компаний (' + open.length + ') ===');
    open.slice(0, 12).forEach(function (l) {
      var q = global.LHEconomyEngine.getMarketQuote(econ, l.itemId);
      var seller = st.companies[l.sellerCid];
      lhMsg(p, l.id + ' | ' + (seller ? seller.name : l.sellerCid) + ' @ (' + l.x + ',' + l.y + ',' + l.z + '): §f' +
        l.qtyAvailable + '× ' + l.itemId + ' за §e' + l.unitPrice + ' Cr/шт §7(рынок: ' + q.price + ' Cr)');
    });
    return 1;
  }));
  shopCmd.then(C.literal('sell')
    .then(C.argument('item', Args.RESOURCE_LOCATION.create(event))
      .then(C.argument('qty', LHOTTDStringArg.word())
        .then(C.argument('unitPrice', LHOTTDStringArg.word()).executes(function (ctx) {
          var server = ctx.source.server, p = ctx.source.playerOrException;
          if (!global.LHEconomyEngine) return 0;
          var st = lhOttdRead(server);
          var econ = lhEconRead(server);
          var comp = lhGetPlayerCompany(server, p);
          if (!comp) { lhMsg(p, 'Сначала создайте компанию.'); return 0; }
          var sc = global.LHOpenTTD.sectorCoords(p.x, p.z);
          var bldg = global.LHOpenTTD.getSectorBuilding(st, sc.sx, sc.sz);
          if (!bldg || bldg.owner !== comp.id) {
            lhMsg(p, 'Вы должны находиться в секторе со своим зданием компании (/lh building build).');
            return 0;
          }
          var itemArg = lhCmdItemArg(ctx, p);
          if (itemArg === 'hand' || itemArg === 'minecraft:hand') {
            lhMsg(p, 'Возьмите предмет в руку или укажите ID.'); return 0;
          }
          var qty = parseInt(LHOTTDStringArg.getString(ctx, 'qty'), 10);
          var unitP = parseInt(LHOTTDStringArg.getString(ctx, 'unitPrice'), 10);
          if (!(qty > 0) || !(unitP > 0)) return 0;
          if (global.LHEconomyEngine.inferCommodityKind(itemArg) === 'item') {
            var cons = lhConsumeInvItem(p.inventory, itemArg, qty);
            if (!cons.ok) { lhMsg(p, 'Недостаточно ' + itemArg + ' (есть ' + cons.have + '/' + qty + ').'); return 0; }
          }
          var res = global.LHEconomyEngine.createFacilityListing(econ, comp.id, bldg, itemArg, qty, unitP);
          lhEconSave(server);
          lhMsg(p, '§a[Витрина ' + res.listing.id + '] Выставлено ' + qty + '× ' + itemArg + ' по §e' + unitP +
            ' Cr §7(рыночная справка: ' + res.marketQuote.price + ' Cr). Точка выдачи: (' + bldg.x + ',' + bldg.y + ',' + bldg.z + ').');
          return 1;
        })))));
  shopCmd.then(C.literal('buy')
    .then(C.argument('listingId', LHOTTDStringArg.word())
      .then(C.argument('qty', LHOTTDStringArg.word()).executes(function (ctx) {
        var server = ctx.source.server, p = ctx.source.playerOrException;
        if (!global.LHEconomyEngine) return 0;
        var st = lhOttdRead(server);
        var econ = lhEconRead(server);
        var comp = lhGetPlayerCompany(server, p);
        if (!comp) { lhMsg(p, 'Сначала создайте компанию.'); return 0; }
        var lid = LHOTTDStringArg.getString(ctx, 'listingId');
        var qty = parseInt(LHOTTDStringArg.getString(ctx, 'qty'), 10);
        if (!(qty > 0)) return 0;
        var res = global.LHEconomyEngine.buyFacilityListing(st, econ, comp.id, lid, qty);
        if (!res.ok) { lhMsg(p, '§cПокупка не удалась: ' + res.reason); return 0; }
        lhOttdSave(server);
        lhEconSave(server);
        lhMsg(p, '§a[Заказ ' + res.order.id + '] Оплачено ' + res.totalPrice + ' Cr! §eГруз НЕ телепортируется — заберите его лично на объекте (' +
          res.order.x + ', ' + res.order.y + ', ' + res.order.z + ') командой /lh shop pickup ' + res.order.id + '.');
        return 1;
      }))));
  shopCmd.then(C.literal('pickup')
    .executes(function (ctx) {
      var server = ctx.source.server, p = ctx.source.playerOrException;
      if (!global.LHEconomyEngine) return 0;
      var econ = lhEconRead(server);
      var comp = lhGetPlayerCompany(server, p);
      if (!comp) return 0;
      var ready = global.LHEconomyEngine.listReadyPickups(econ, comp.id);
      if (!ready.length) { lhMsg(p, 'У вашей компании нет готовых заказов к самовывозу.'); return 0; }
      ready.forEach(function (o) {
        lhMsg(p, o.id + ': ' + o.qty + '× ' + o.itemId + ' ждёт на (' + o.x + ',' + o.y + ',' + o.z + ') -> /lh shop pickup ' + o.id);
      });
      return 1;
    })
    .then(C.argument('orderId', LHOTTDStringArg.word()).executes(function (ctx) {
      var server = ctx.source.server, p = ctx.source.playerOrException;
      if (!global.LHEconomyEngine) return 0;
      var econ = lhEconRead(server);
      var comp = lhGetPlayerCompany(server, p);
      if (!comp) return 0;
      var oid = LHOTTDStringArg.getString(ctx, 'orderId');
      var res = global.LHEconomyEngine.pickupLogisticsOrder(econ, comp.id, oid, p.x, p.y, p.z, 24);
      if (!res.ok) {
        if (res.reason === 'too_far') {
          lhMsg(p, '§cВы слишком далеко (' + res.distance + ' м > ' + res.maxDist + ' м)! Подойдите к складу (' +
            res.target.x + ', ' + res.target.y + ', ' + res.target.z + ').');
        } else {
          lhMsg(p, '§cЗаказ ' + oid + ' не найден.');
        }
        return 0;
      }
      lhEconSave(server);
      var o = res.order;
      if (o.kind === 'item' && typeof Item !== 'undefined' && typeof p.give === 'function') {
        p.give(Item.of(o.itemId, Math.min(256, o.qty)));
      } else if (o.kind === 'fluid' && o.itemId === 'fluid:minecraft:lava' && typeof Item !== 'undefined' && typeof p.give === 'function') {
        p.give(Item.of('minecraft:lava_bucket', Math.min(16, o.qty)));
      } else if (o.kind === 'fluid' && o.itemId === 'fluid:minecraft:water' && typeof Item !== 'undefined' && typeof p.give === 'function') {
        p.give(Item.of('minecraft:water_bucket', Math.min(16, o.qty)));
      }
      lhMsg(p, '§a[Самовывоз ' + o.id + '] Получено со склада (' + o.x + ',' + o.y + ',' + o.z + '): ' + o.qty + '× ' + o.itemId + '!');
      return 1;
    })));
  root.then(shopCmd);

  var delivCmd = C.literal('delivery');
  delivCmd.then(C.literal('list').executes(function (ctx) {
    var server = ctx.source.server, p = ctx.source.playerOrException;
    var comp = lhGetPlayerCompany(server, p);
    var logSt = lhLogisticsRead(server);
    var dels = (logSt.deliveries || []).filter(function (d) {
      return d.status !== 'completed' && (!comp || d.buyerCid === comp.id || d.sellerCid === comp.id);
    });
    lhMsg(p, '=== Активные доставки (' + dels.length + ') ===');
    dels.slice(0, 14).forEach(function (d) {
      var remSec = Math.max(0, Math.round(((d.etaTick || LHOTTDTick) - LHOTTDTick) / 20));
      var spdLbl = d.speedBps || d.speedMps || 1.04;
      var arrivedFlag = (d.status === 'arrived_at_terminal' || d.status === 'arrived');
      lhMsg(p, d.id + ' | ' + d.sellerCid + ' -> ' + d.buyerCid + ': §f' + d.qty + '× ' + d.itemId +
        ' §7[' + (d.mode || 'delivery') + ' @ ' + spdLbl + ' м/с | ' +
        (arrivedFlag ? '§aПРИБЫЛ' : ('§e' + (d.status === 'in_transit' ? ('в пути: ' + remSec + 'с') : d.status))) + '§7]');
    });
    return 1;
  }));
  delivCmd.then(C.literal('claim')
    .executes(function (ctx) {
      return lhClaimArrivedDeliveriesAtTerminal(ctx.source.server, ctx.source.playerOrException, null);
    })
    .then(C.argument('id', LHOTTDStringArg.word()).executes(function (ctx) {
      return lhClaimArrivedDeliveriesAtTerminal(ctx.source.server, ctx.source.playerOrException, LHOTTDStringArg.getString(ctx, 'id'));
    })));
  root.then(delivCmd);

  var hagCmd = C.literal('haggle');
  hagCmd.then(C.literal('status').executes(function (ctx) {
    var server = ctx.source.server, p = ctx.source.playerOrException;
    var pid = lhId(p);
    var logSt = lhLogisticsRead(server);
    var list = Object.keys(logSt.haggles || {}).map(function (k) { return logSt.haggles[k]; })
      .filter(function (s) { return s.playerId === pid && (s.status === 'active' || s.status === 'agreed'); });
    lhMsg(p, 'Активные сессии торга (' + list.length + '):');
    list.forEach(function (s) {
      var curP = s.agreedPrice || (s.botSide === 'seller' ? s.sellerAsk : s.buyerBid);
      lhMsg(p, s.id + ': ' + s.targetCid + ' (' + s.qty + '× ' + s.itemId + ') — текущ: ' + curP + ' Cr [' + s.status + ']');
    });
    return 1;
  }));
  hagCmd.then(C.literal('start')
    .then(C.argument('company', LHOTTDStringArg.word())
      .then(C.argument('side', LHOTTDStringArg.word())
        .then(C.argument('item', Args.RESOURCE_LOCATION.create(event))
          .then(C.argument('qty', LHOTTDStringArg.word()).executes(function (ctx) {
            var p = ctx.source.playerOrException;
            var qty = parseInt(LHOTTDStringArg.getString(ctx, 'qty'), 10);
            var s = lhHaggleStart(ctx.source.server, p, LHOTTDStringArg.getString(ctx, 'company'),
              LHOTTDStringArg.getString(ctx, 'side'), lhCmdItemArg(ctx, p), isNaN(qty) ? 1 : qty, false);
            return s ? 1 : 0;
          }))))));
  hagCmd.then(C.literal('offer')
    .then(C.argument('id', LHOTTDStringArg.word())
      .then(C.argument('price', LHOTTDStringArg.word()).executes(function (ctx) {
        var price = parseInt(LHOTTDStringArg.getString(ctx, 'price'), 10);
        var res = lhHaggleOffer(ctx.source.server, ctx.source.playerOrException, LHOTTDStringArg.getString(ctx, 'id'), price, false);
        return res && res.ok ? 1 : 0;
      }))));
  hagCmd.then(C.literal('accept').then(C.argument('id', LHOTTDStringArg.word()).executes(function (ctx) {
    return lhHaggleAccept(ctx.source.server, ctx.source.playerOrException, LHOTTDStringArg.getString(ctx, 'id'), false);
  })));
  root.then(hagCmd);

  var p2pCmd = C.literal('p2p');
  p2pCmd.then(C.literal('list').executes(function (ctx) {
    var server = ctx.source.server, p = ctx.source.playerOrException;
    var pid = lhId(p);
    var logSt = lhLogisticsRead(server);
    var open = Object.keys(logSt.p2pSessions || {}).map(function (k) { return logSt.p2pSessions[k]; })
      .filter(function (t) { return t.status === 'open' && (t.sideB.uuid === pid || t.sideA.uuid === pid); });
    lhMsg(p, 'Активные P2P-сделки рядом (' + open.length + '):');
    open.forEach(function (t) {
      var aItems = (t.sideA.items || []).map(function (it) { return it.count + '×' + it.itemId; }).join(', ') || 'нет';
      var bItems = (t.sideB.items || []).map(function (it) { return it.count + '×' + it.itemId; }).join(', ') || 'нет';
      lhMsg(p, t.id + ': ' + t.sideA.name + ' -> ' + t.sideB.name + ' | [' + aItems + '] за [' + bItems + '] + ' + (t.sideB.currency || 0) + ' Cr');
    });
    return 1;
  }));
  p2pCmd.then(C.literal('propose')
    .then(C.argument('player', LHOTTDStringArg.word())
      .then(C.argument('offerItem', Args.RESOURCE_LOCATION.create(event))
        .then(C.argument('offerQty', LHOTTDStringArg.word())
          .then(C.argument('reqItem', Args.RESOURCE_LOCATION.create(event))
            .then(C.argument('reqQty', LHOTTDStringArg.word())
              .then(C.argument('cashDelta', LHOTTDStringArg.word()).executes(function (ctx) {
                var p = ctx.source.playerOrException;
                var oq = parseInt(LHOTTDStringArg.getString(ctx, 'offerQty'), 10);
                var rq = parseInt(LHOTTDStringArg.getString(ctx, 'reqQty'), 10);
                var cd = parseInt(LHOTTDStringArg.getString(ctx, 'cashDelta'), 10);
                var res = lhP2PPropose(ctx.source.server, p,
                  LHOTTDStringArg.getString(ctx, 'player'),
                  String(Args.RESOURCE_LOCATION.getResult(ctx, 'offerItem')), isNaN(oq) ? 0 : oq,
                  String(Args.RESOURCE_LOCATION.getResult(ctx, 'reqItem')), isNaN(rq) ? 0 : rq,
                  isNaN(cd) ? 0 : cd, false);
                return res && res.ok ? 1 : 0;
              }))))))));
  p2pCmd.then(C.literal('accept').then(C.argument('id', LHOTTDStringArg.word()).executes(function (ctx) {
    return lhP2PAccept(ctx.source.server, ctx.source.playerOrException, LHOTTDStringArg.getString(ctx, 'id'), false);
  })));
  root.then(p2pCmd);

  var aucCmd = C.literal('auction');
  aucCmd.then(C.literal('list').executes(function (ctx) {
    var server = ctx.source.server, p = ctx.source.playerOrException, st = lhOttdRead(server);
    var open = (st.auctions || []).filter(function (a) { return a && a.status === 'open'; });
    lhMsg(p, '=== Аукционы предприятий (' + open.length + ') ===');
    open.forEach(function (a) {
      lhMsg(p, a.id + ': «' + a.buildingName + '» (ур.' + a.buildingLevel + ') @ (' + a.sx + ',' + a.sz + ') | Ставка: ' +
        (a.currentBid > 0 ? (a.currentBid + ' Cr [' + a.highestBidderCid + ']') : ('старт ' + a.startPrice + ' Cr')) +
        ' | Мин.след: ' + (a.highestBidderCid ? (a.currentBid + a.minIncrement) : a.startPrice));
    });
    return 1;
  }));
  aucCmd.then(C.literal('create').then(C.argument('startPrice', LHOTTDStringArg.word()).executes(function (ctx) {
    var server = ctx.source.server, p = ctx.source.playerOrException, st = lhOttdRead(server);
    var comp = lhGetPlayerCompany(server, p);
    if (!comp) { lhMsg(p, 'Сначала создайте компанию.'); return 0; }
    var dim = (p.level && p.level.dimension) ? String(p.level.dimension) : 'minecraft:overworld';
    var sc = global.LHOpenTTD.sectorCoords(p.x, p.z);
    var sp = parseInt(LHOTTDStringArg.getString(ctx, 'startPrice'), 10);
    var res = global.LHOpenTTD.createFacilityAuction(st, comp.id, sc.sx, sc.sz, isNaN(sp) ? 0 : sp, 3600, LHOTTDTick, { dimension: dim });
    if (!res.ok) { lhMsg(p, '§cНе удалось выставить на аукцион: ' + res.reason); return 0; }
    lhOttdSave(server);
    lhMsg(p, '§a[Аукцион ' + res.auction.id + '] Предприятие «' + res.auction.buildingName + '» выставлено от ' + res.auction.startPrice + ' Cr!');
    return 1;
  })));
  aucCmd.then(C.literal('bid').then(C.argument('id', LHOTTDStringArg.word()).then(C.argument('amount', LHOTTDStringArg.word()).executes(function (ctx) {
    var server = ctx.source.server, p = ctx.source.playerOrException, st = lhOttdRead(server);
    var comp = lhGetPlayerCompany(server, p);
    if (!comp) { lhMsg(p, 'Сначала создайте компанию.'); return 0; }
    var aid = LHOTTDStringArg.getString(ctx, 'id');
    var amt = parseInt(LHOTTDStringArg.getString(ctx, 'amount'), 10);
    var res = global.LHOpenTTD.placeAuctionBid(st, aid, comp.id, amt, LHOTTDTick);
    if (!res.ok) { lhMsg(p, '§cСтавка не принята: ' + res.reason + (res.minRequired ? (' (мин. ' + res.minRequired + ' Cr)') : '')); return 0; }
    lhOttdSave(server);
    lhMsg(p, res.sold ? ('§a[Аукцион выигран!] Вы выкупили предприятие за ' + res.finalPrice + ' Cr!') : ('§a[Ставка принята] Ваша ставка ' + amt + ' Cr лидирует!'));
    return 1;
  }))));
  aucCmd.then(C.literal('cancel').then(C.argument('id', LHOTTDStringArg.word()).executes(function (ctx) {
    var server = ctx.source.server, p = ctx.source.playerOrException, st = lhOttdRead(server);
    var comp = lhGetPlayerCompany(server, p);
    if (!comp) return 0;
    var res = global.LHOpenTTD.cancelFacilityAuction(st, LHOTTDStringArg.getString(ctx, 'id'), comp.id);
    if (!res.ok) { lhMsg(p, '§cОтмена не удалась: ' + res.reason); return 0; }
    lhOttdSave(server);
    lhMsg(p, '§eАукцион отменён, ставки возвращены.');
    return 1;
  })));
  root.then(aucCmd);

  var coalCmd = C.literal('coalition');
  coalCmd.then(C.literal('list').executes(function (ctx) {
    var server = ctx.source.server, p = ctx.source.playerOrException, st = lhOttdRead(server);
    var metrics = global.LHOpenTTD.getMonopolyMetrics(st);
    lhMsg(p, '=== Антимонопольный монитор и коалиции ===');
    metrics.slice(0, 8).forEach(function (m) {
      var co = st.coalitions && st.coalitions[m.cid];
      var mCnt = (co && co.members) ? co.members.length : 0;
      lhMsg(p, m.name + ' [' + m.cid + '] | Доля: ' + Math.round(m.territoryShare * 100) + '% | Угроза: ' + m.monopolyThreat +
        (m.isMonopolyTarget ? ' §c[МОНОПОЛИСТ]' : '') + ' §7| Коалиция против: ' + mCnt + ' комп.');
    });
    return 1;
  }));
  coalCmd.then(C.literal('join').then(C.argument('target', LHOTTDStringArg.word()).executes(function (ctx) {
    var server = ctx.source.server, p = ctx.source.playerOrException, st = lhOttdRead(server);
    var comp = lhGetPlayerCompany(server, p);
    if (!comp) { lhMsg(p, 'Сначала создайте компанию.'); return 0; }
    var tgt = LHOTTDStringArg.getString(ctx, 'target');
    var res = global.LHOpenTTD.joinAntiMonopolyCoalition(st, comp.id, tgt);
    if (!res.ok) { lhMsg(p, '§cНе удалось вступить в коалицию: ' + res.reason); return 0; }
    lhOttdSave(server);
    lhMsg(p, '§a[Коалиция] Вы вступили в пакт против «' + tgt + '» (−30% цена захвата, +1 сила рейда, +100 Cr премия).');
    return 1;
  })));
  coalCmd.then(C.literal('leave').then(C.argument('target', LHOTTDStringArg.word()).executes(function (ctx) {
    var server = ctx.source.server, p = ctx.source.playerOrException, st = lhOttdRead(server);
    var comp = lhGetPlayerCompany(server, p);
    if (!comp) return 0;
    global.LHOpenTTD.leaveAntiMonopolyCoalition(st, comp.id, LHOTTDStringArg.getString(ctx, 'target'));
    lhOttdSave(server);
    lhMsg(p, '§eВы вышли из коалиции.');
    return 1;
  })));
  root.then(coalCmd);

  var routeCmd = C.literal('route');
  routeCmd.then(C.literal('list').executes(function (ctx) {
    var server = ctx.source.server, p = ctx.source.playerOrException;
    var comp = lhGetPlayerCompany(server, p);
    var logSt = lhLogisticsRead(server);
    var list = (logSt.automatedRoutes || []).filter(function (r) { return !comp || r.companyId === comp.id; });
    lhMsg(p, '=== Авто-маршруты между объектами (' + list.length + ') ===');
    list.forEach(function (r) {
      var cp = r.costProfile || {};
      lhMsg(p, r.id + ' [' + (r.enabled ? '§aВКЛ' : '§cВЫКЛ') + '§f]: (' + r.srcSx + ',' + r.srcSz + ') -> (' +
        r.dstSx + ',' + r.dstSz + ') | ' + r.qtyPerRun + '× ' + r.itemId +
        ' | Расход: ' + (cp.coalQty || 1) + ' уголь, ' + (cp.totalCashCost || 10) + ' Cr (таможня ' + (cp.customsTax || 0) + ')');
    });
    return 1;
  }));
  routeCmd.then(C.literal('create')
    .then(C.argument('srcSx', LHOTTDStringArg.word())
      .then(C.argument('srcSz', LHOTTDStringArg.word())
        .then(C.argument('dstSx', LHOTTDStringArg.word())
          .then(C.argument('dstSz', LHOTTDStringArg.word())
            .then(C.argument('qty', LHOTTDStringArg.word()).executes(function (ctx) {
              var server = ctx.source.server, p = ctx.source.playerOrException;
              var comp = lhGetPlayerCompany(server, p);
              if (!comp || !global.LHTradeLogistics) { lhMsg(p, 'Сначала создайте компанию.'); return 0; }
              var st = lhOttdRead(server), logSt = lhLogisticsRead(server);
              var sSx = parseInt(LHOTTDStringArg.getString(ctx, 'srcSx'), 10);
              var sSz = parseInt(LHOTTDStringArg.getString(ctx, 'srcSz'), 10);
              var dSx = parseInt(LHOTTDStringArg.getString(ctx, 'dstSx'), 10);
              var dSz = parseInt(LHOTTDStringArg.getString(ctx, 'dstSz'), 10);
              var qty = parseInt(LHOTTDStringArg.getString(ctx, 'qty'), 10);
              var res = global.LHTradeLogistics.createAutomatedRoute(logSt, st, comp.id, sSx, sSz, dSx, dSz, 'auto', isNaN(qty) ? 8 : qty, { nowTick: LHOTTDTick });
              if (!res.ok) { lhMsg(p, '§cОшибка маршрута: ' + res.reason); return 0; }
              lhLogisticsSave(server);
              lhMsg(p, '§a[Маршрут ' + res.route.id + '] Авто-обмен (' + sSx + ',' + sSz + ') -> (' + dSx + ',' + dSz + ') запущен!');
              return 1;
            })))))));
  routeCmd.then(C.literal('toggle').then(C.argument('id', LHOTTDStringArg.word()).executes(function (ctx) {
    var server = ctx.source.server, p = ctx.source.playerOrException, comp = lhGetPlayerCompany(server, p);
    var logSt = lhLogisticsRead(server);
    var res = global.LHTradeLogistics.toggleAutomatedRoute(logSt, LHOTTDStringArg.getString(ctx, 'id'), comp ? comp.id : null);
    lhLogisticsSave(server);
    lhMsg(p, res.ok ? ('Маршрут ' + (res.enabled ? 'включён' : 'остановлен')) : 'Маршрут не найден');
    return res.ok ? 1 : 0;
  })));
  routeCmd.then(C.literal('escort').then(C.argument('id', LHOTTDStringArg.word()).executes(function (ctx) {
    var server = ctx.source.server, p = ctx.source.playerOrException, comp = lhGetPlayerCompany(server, p);
    var logSt = lhLogisticsRead(server);
    var rid = LHOTTDStringArg.getString(ctx, 'id');
    var found = null;
    (logSt.automatedRoutes || []).forEach(function (r) {
      if (r && r.id === rid && (!comp || r.companyId === comp.id)) found = r;
    });
    if (!found) { lhMsg(p, 'Маршрут не найден.'); return 0; }
    found.escortEnabled = !found.escortEnabled;
    lhLogisticsSave(server);
    lhMsg(p, '§e[Маршрут ' + rid + '] Охрана каравана: ' + (found.escortEnabled ? '§aВКЛ (−82% риска пиратов)' : '§cВЫКЛ'));
    return 1;
  })));
  routeCmd.then(C.literal('dispatch').then(C.argument('id', LHOTTDStringArg.word()).executes(function (ctx) {
    var server = ctx.source.server, p = ctx.source.playerOrException, st = lhOttdRead(server), logSt = lhLogisticsRead(server);
    var dr = global.LHTradeLogistics.dispatchConvoyRoute(logSt, st, LHOTTDStringArg.getString(ctx, 'id'), LHOTTDTick);
    if (!dr.ok) { lhMsg(p, '§cНе удалось отправить конвой: ' + dr.reason); return 0; }
    lhLogisticsSave(server);
    lhOttdSave(server);
    lhMsg(p, '§a[Конвой] Рейс запущен (время в пути = дистанция / скорость)!');
    return 1;
  })));
  routeCmd.then(C.literal('convoy')
    .then(C.argument('type', LHOTTDStringArg.word())
      .then(C.argument('srcSx', LHOTTDStringArg.word())
        .then(C.argument('srcSz', LHOTTDStringArg.word())
          .then(C.argument('dstSx', LHOTTDStringArg.word())
            .then(C.argument('dstSz', LHOTTDStringArg.word())
              .then(C.argument('qty', LHOTTDStringArg.word()).executes(function (ctx) {
                var sSx = parseInt(LHOTTDStringArg.getString(ctx, 'srcSx'), 10);
                var sSz = parseInt(LHOTTDStringArg.getString(ctx, 'srcSz'), 10);
                var dSx = parseInt(LHOTTDStringArg.getString(ctx, 'dstSx'), 10);
                var dSz = parseInt(LHOTTDStringArg.getString(ctx, 'dstSz'), 10);
                var qty = parseInt(LHOTTDStringArg.getString(ctx, 'qty'), 10);
                var res = lhCreateConvoyRouteCmd(ctx.source.server, ctx.source.playerOrException,
                  LHOTTDStringArg.getString(ctx, 'type'), sSx, sSz, dSx, dSz, [], isNaN(qty) ? 16 : qty, { autoRelay: true });
                return res && res.ok ? 1 : 0;
              }))))))));
  root.then(routeCmd);

  var convoyCmd = C.literal('convoy');
  convoyCmd.then(C.literal('list').executes(function (ctx) {
    var server = ctx.source.server, p = ctx.source.playerOrException;
    var comp = lhGetPlayerCompany(server, p);
    var logSt = lhLogisticsRead(server);
    var list = global.LHTradeLogistics.listCompanyConvoys(logSt, comp ? comp.id : null);
    lhMsg(p, '=== Транспортный парк конвоев (' + list.length + ') ===');
    list.forEach(function (c) {
      lhMsg(p, c.id + ' [' + c.vehicleType + '] §f' + c.name + ' §7(' + c.itemId + ') | ' + c.speedBps + ' м/с, груз ' +
        c.capacity + ' | Маршрут: ' + (c.assignedRouteId || 'свободен') + ' [' + c.status + ']');
    });
    return 1;
  }));
  convoyCmd.then(C.literal('create').executes(function (ctx) {
    var r = lhCreateConvoyFromHand(ctx.source.server, ctx.source.playerOrException, null);
    return r && r.ok ? 1 : 0;
  }).then(C.argument('type', LHOTTDStringArg.word()).executes(function (ctx) {
    var r = lhCreateConvoyFromHand(ctx.source.server, ctx.source.playerOrException, LHOTTDStringArg.getString(ctx, 'type'));
    return r && r.ok ? 1 : 0;
  })));
  root.then(convoyCmd);

  var strCmd = C.literal('structure');
  strCmd.then(C.literal('scan').executes(function (ctx) {
    var server = ctx.source.server, p = ctx.source.playerOrException, st = lhOttdRead(server);
    var list = lhScanNearbyStructuresForSector(server, p, st);
    lhMsg(p, '=== Обнаруженные структуры в секторе (' + list.length + ') ===');
    list.forEach(function (sp) {
      lhMsg(p, sp.rarityColor + '[' + sp.rarityName + '] §f' + sp.displayName + ' §7(' + sp.structureId + ') -> §e' + sp.itemId + ' §7(' + sp.cost + ' Cr)');
    });
    return 1;
  }));
  strCmd.then(C.literal('convert').executes(function (ctx) {
    var res = lhConvertStructureCmd(ctx.source.server, ctx.source.playerOrException, null, undefined, undefined, false);
    return res && res.ok ? 1 : 0;
  }));
  root.then(strCmd);

  var valCmd = C.literal('valuation');
  valCmd.executes(function (ctx) {
    var server = ctx.source.server, p = ctx.source.playerOrException, st = lhOttdRead(server);
    var comp = lhGetPlayerCompany(server, p);
    if (!comp) { lhMsg(p, 'Сначала создайте компанию.'); return 0; }
    var v = global.LHOpenTTD.getCompanyValuationBreakdown(st, comp.id);
    var ex = global.LHOpenTTD.computeCompanyExpenses(st, comp.id);
    lhMsg(p, '=== Оценка компании ' + comp.colorCode + comp.name + ' §f: §e' + v.totalValuation + ' Cr ===');
    lhMsg(p, 'Нал: ' + v.cash + ' | Склад/запасы: ' + v.inventoryValue + ' | Объекты: ' + v.facilitiesValue +
      ' | Акции: ' + (v.equityPortfolioValue || 0) + ' | Потенциал: ' + v.productionPotentialValue + ' | Земля: ' + v.territoryValue);
    lhMsg(p, 'Расходы/цикл: ' + ex.total + ' Cr (объекты ' + ex.facilityUpkeep + ', апгрейды ' + ex.upgradeUpkeep +
      ', земля ' + ex.landTax + ', прогрессивный налог ' + (ex.progressiveTax || 0) + ' [' + (ex.progressiveBracketLabel || '5%') + ']' +
      (ex.antiMonopolyTax > 0 ? (', §cантимонополия ' + ex.antiMonopolyTax) : '') +
      (ex.auditPenaltyTax > 0 ? (', §4штраф аудита ' + ex.auditPenaltyTax) : '') +
      (ex.comebackDiscount > 0 ? (', §aкамбэк −' + ex.comebackDiscount) : '') + ')');
    return 1;
  });
  root.then(valCmd);

  var bankCmd = C.literal('bank');
  bankCmd.then(C.literal('status').executes(function (ctx) {
    var server = ctx.source.server, p = ctx.source.playerOrException, st = lhOttdRead(server);
    var comp = lhGetPlayerCompany(server, p);
    var cb = global.LHOpenTTD.updateCentralBankKeyRate(st);
    lhMsg(p, '=== Центральный Банк ===');
    lhMsg(p, 'Ключевая ставка: §e' + Math.round(cb.keyRate * 1000) / 10 + '% §7(индекс инфляции: ' + cb.inflationIndex + ')');
    if (comp) {
      var lim = global.LHOpenTTD.getMaxLoanLimit(st, comp.id);
      var eff = global.LHOpenTTD.getEffectiveLoanRate(st, comp.id);
      var debt = global.LHOpenTTD.getCompanyActiveDebt(st, comp.id);
      lhMsg(p, 'Ваш лимит кредита: §a' + lim + ' Cr §7| Ваша ставка: §e' + Math.round(eff * 1000) / 10 + '% §7| Текущий долг: §c' + debt + ' Cr');
    }
    return 1;
  }));
  bankCmd.then(C.literal('loan').then(C.argument('amount', LHOTTDStringArg.word()).executes(function (ctx) {
    var server = ctx.source.server, p = ctx.source.playerOrException, st = lhOttdRead(server);
    var comp = lhGetPlayerCompany(server, p);
    if (!comp) { lhMsg(p, 'Сначала создайте компанию.'); return 0; }
    var amt = parseInt(LHOTTDStringArg.getString(ctx, 'amount'), 10);
    var res = global.LHOpenTTD.takeBankLoan(st, comp.id, isNaN(amt) ? 500 : amt, 5, LHOTTDTick);
    if (!res.ok) { lhMsg(p, '§cОтказ банка: ' + res.reason + (res.limit !== undefined ? (' (лимит ' + res.limit + ' Cr)') : '')); return 0; }
    lhOttdSave(server);
    lhMsg(p, '§a[Банк · ' + res.loan.id + '] Выдан заём ' + res.loan.principal + ' Cr под ' + Math.round(res.effectiveRate * 1000) / 10 + '%/цикл. К возврату: ' + res.loan.totalDue + ' Cr.');
    return 1;
  })));
  bankCmd.then(C.literal('repay').executes(function (ctx) {
    var server = ctx.source.server, p = ctx.source.playerOrException, st = lhOttdRead(server);
    var comp = lhGetPlayerCompany(server, p);
    if (!comp) return 0;
    var res = global.LHOpenTTD.repayBankLoan(st, comp.id);
    if (!res.ok) { lhMsg(p, '§cНе удалось погасить: ' + res.reason); return 0; }
    lhOttdSave(server);
    lhMsg(p, '§a[Банк] Погашено ' + res.paid + ' Cr. Остаток долга: ' + res.remainingDebt + ' Cr.');
    return 1;
  }));
  root.then(bankCmd);

  var taxCmd = C.literal('tax');
  taxCmd.then(C.literal('status').executes(function (ctx) {
    var server = ctx.source.server, p = ctx.source.playerOrException, st = lhOttdRead(server);
    var comp = lhGetPlayerCompany(server, p);
    if (!comp) { lhMsg(p, 'Сначала создайте компанию.'); return 0; }
    var ex = global.LHOpenTTD.computeCompanyExpenses(st, comp.id);
    lhMsg(p, '=== Налоги и содержание ===');
    lhMsg(p, 'Итого/цикл: §e' + ex.total + ' Cr §7| Скобка: §b' + ex.progressiveBracketLabel + ' §7| Долг: §c' + (comp.unpaidUpkeep || 0) + ' Cr');
    if (comp.taxAuditPenaltyCycles > 0) lhMsg(p, '§4Активен штраф аудита (+35% на ' + comp.taxAuditPenaltyCycles + ' цикл.)');
    return 1;
  }));
  taxCmd.then(C.literal('evade').then(C.argument('method', LHOTTDStringArg.word()).executes(function (ctx) {
    var server = ctx.source.server, p = ctx.source.playerOrException, st = lhOttdRead(server);
    var comp = lhGetPlayerCompany(server, p);
    if (!comp) { lhMsg(p, 'Сначала создайте компанию.'); return 0; }
    var m = LHOTTDStringArg.getString(ctx, 'method');
    var res = global.LHOpenTTD.attemptTaxEvasion(st, comp.id, m, LHOTTDTick);
    if (!res.ok) { lhMsg(p, '§cНевозможно: ' + res.reason); return 0; }
    lhOttdSave(server);
    if (res.succeeded) {
      lhMsg(p, '§a[Схема удалась] Скидка на налог в этом цикле −' + res.discountPct + '%, списано ' + res.debtForgiven + ' Cr долга!');
    } else {
      lhMsg(p, '§c[АУДИТ ПРОВАЛЕН!] Штраф +' + res.fine + ' Cr к долгу и доп.налог +35% на 3 цикла!');
    }
    return 1;
  })));
  root.then(taxCmd);

  var eqCmd = C.literal('equity');
  eqCmd.then(C.literal('list').executes(function (ctx) {
    var server = ctx.source.server, p = ctx.source.playerOrException, st = lhOttdRead(server);
    lhMsg(p, '=== Рынок акций компаний ===');
    Object.keys(st.companies || {}).forEach(function (cid) {
      var c = st.companies[cid];
      if (!c || c.isPirate) return;
      var sp = global.LHOpenTTD.getSharePrice(st, cid);
      lhMsg(p, c.colorCode + c.name + ' [' + cid + '] §f| 1% = §e' + sp + ' Cr §7| Свободно: ' + (c.shareHoldings ? (c.shareHoldings[cid] || 0) : 100) + '%');
    });
    return 1;
  }));
  eqCmd.then(C.literal('buy').then(C.argument('target', LHOTTDStringArg.word()).then(C.argument('shares', LHOTTDStringArg.word()).executes(function (ctx) {
    var server = ctx.source.server, p = ctx.source.playerOrException, st = lhOttdRead(server);
    var comp = lhGetPlayerCompany(server, p);
    if (!comp) return 0;
    var cnt = parseInt(LHOTTDStringArg.getString(ctx, 'shares'), 10);
    var res = global.LHOpenTTD.buyCompanyShares(st, comp.id, LHOTTDStringArg.getString(ctx, 'target'), isNaN(cnt) ? 10 : cnt);
    if (!res.ok) { lhMsg(p, '§cОшибка покупки акций: ' + res.reason); return 0; }
    lhOttdSave(server);
    lhMsg(p, '§aКуплено ' + res.sharesBought + '% акций ' + res.targetCid + ' за ' + res.cost + ' Cr!');
    return 1;
  }))));
  eqCmd.then(C.literal('sell').then(C.argument('target', LHOTTDStringArg.word()).then(C.argument('shares', LHOTTDStringArg.word()).executes(function (ctx) {
    var server = ctx.source.server, p = ctx.source.playerOrException, st = lhOttdRead(server);
    var comp = lhGetPlayerCompany(server, p);
    if (!comp) return 0;
    var cnt = parseInt(LHOTTDStringArg.getString(ctx, 'shares'), 10);
    var res = global.LHOpenTTD.sellCompanyShares(st, comp.id, LHOTTDStringArg.getString(ctx, 'target'), isNaN(cnt) ? 10 : cnt);
    if (!res.ok) { lhMsg(p, '§cОшибка продажи акций: ' + res.reason); return 0; }
    lhOttdSave(server);
    lhMsg(p, '§aПродано ' + res.sharesSold + '% акций ' + res.targetCid + ' за ' + res.proceeds + ' Cr!');
    return 1;
  }))));
  root.then(eqCmd);

  var cbCmd = C.literal('comeback');
  cbCmd.then(C.literal('status').executes(function (ctx) {
    var server = ctx.source.server, p = ctx.source.playerOrException, st = lhOttdRead(server);
    var comp = lhGetPlayerCompany(server, p);
    if (!comp) return 0;
    var cb = global.LHOpenTTD.getComebackStatus(st, comp.id);
    lhMsg(p, cb.active
      ? ('§a[Камбэк Ур.' + cb.tier + '] §fСкидка на налоги −' + Math.round(cb.taxDiscount * 100) + '%, выпуск ×' + cb.yieldMult + ', скидка на захват −' + Math.round(cb.claimDiscount * 100) + '%, ставка ЦБ ×0.5!')
      : '§7Ваша компания не нуждается в антикризисном камбэке.');
    return 1;
  }));
  cbCmd.then(C.literal('bailout').executes(function (ctx) {
    var server = ctx.source.server, p = ctx.source.playerOrException, st = lhOttdRead(server);
    var comp = lhGetPlayerCompany(server, p);
    if (!comp) return 0;
    var res = global.LHOpenTTD.activateComebackBailout(st, comp.id, LHOTTDTick);
    if (!res.ok) { lhMsg(p, '§cГрант недоступен: ' + res.reason); return 0; }
    lhOttdSave(server);
    lhMsg(p, '§a[Антикризисная помощь] Получено +' + res.grantCash + ' Cr, +' + res.grantCoal + '× угля на склад и списано ' + res.debtForgiven + ' Cr долга!');
    return 1;
  }));
  root.then(cbCmd);

  var pirCmd = C.literal('pirate');
  pirCmd.then(C.literal('status').executes(function (ctx) {
    var server = ctx.source.server, p = ctx.source.playerOrException, st = lhOttdRead(server);
    var ps = global.LHOpenTTD.ensurePirateSyndicate(st);
    lhMsg(p, '=== Синдикат Корсаров (Ур.' + ps.level + ', мощь ' + ps.power + ') ===');
    lhMsg(p, 'Казна: §e' + ps.cash + ' Cr §7| Ограблено караванов: §c' + ps.caravansRobbed + ' §7| Набегов: §c' + ps.raidsCompleted);
    return 1;
  }));
  pirCmd.then(C.literal('order')
    .then(C.argument('target', LHOTTDStringArg.word())
      .then(C.argument('tier', LHOTTDStringArg.word()).executes(function (ctx) {
        var server = ctx.source.server, p = ctx.source.playerOrException, st = lhOttdRead(server);
        var comp = lhGetPlayerCompany(server, p);
        if (!comp) return 0;
        var tgtId = LHOTTDStringArg.getString(ctx, 'target');
        var tgt = st.companies[tgtId];
        if (!tgt) { lhMsg(p, 'Цель не найдена.'); return 0; }
        var tier = parseInt(LHOTTDStringArg.getString(ctx, 'tier'), 10);
        var res = global.LHOpenTTD.orderPirateRaid(st, comp.id, tgtId, tgt.hqSx, tgt.hqSz, isNaN(tier) ? 1 : tier, LHOTTDTick, { anonymous: true });
        if (!res.ok) { lhMsg(p, '§cЗаказ отклонён: ' + res.reason); return 0; }
        lhSpawnBotMobRaids(server, st);
        lhOttdSave(server);
        lhMsg(p, '§6[Синдикат Корсаров] Заказан анонимный набег тира ' + res.raid.tier + ' на «' + tgt.name + '» за ' + res.cost + ' Cr!');
        return 1;
      }))));
  pirCmd.then(C.literal('immunity').executes(function (ctx) {
    var server = ctx.source.server, p = ctx.source.playerOrException, st = lhOttdRead(server);
    var comp = lhGetPlayerCompany(server, p);
    if (!comp) return 0;
    var res = global.LHOpenTTD.buyPirateImmunity(st, comp.id, 12000, LHOTTDTick);
    if (!res.ok) { lhMsg(p, '§cНе хватает средств: нужно ' + res.cost + ' Cr.'); return 0; }
    lhOttdSave(server);
    lhMsg(p, '§a[Корсары] Куплен чёрный пакт неприкосновенности на 10 мин за ' + res.cost + ' Cr!');
    return 1;
  }));
  root.then(pirCmd);

  event.register(root);
});

ServerEvents.loaded(function (event) {
  lhOttdRead(event.server);
  lhRefreshRecipeEconomyGraph(event.server);
  console.info('[LH] OpenTTD Companies, Dynamic Economy, Physical Buildings, Facility Shops & AI Bots loaded.');
});
