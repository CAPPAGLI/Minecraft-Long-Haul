// Long Haul Legacy 2.0: OpenTTD Companies, Specializations, Full-Map Voronoi+Claim Partition,
// Inter-Company Trading & Consortium Market, and AI Bot Companies.
var LHOTTDStringArg = Java.loadClass('com.mojang.brigadier.arguments.StringArgumentType');
var LHOTTDState = null;
var LHOTTDTick = 0;
var LHOTTDLastSectorByPlayer = {};

function lhOttdRead(server) {
  if (LHOTTDState !== null) return LHOTTDState;
  var raw = server.persistentData.getString('longhaul_openttd_v1');
  LHOTTDState = raw ? JSON.parse(String(raw)) : global.LHOpenTTD.createInitialState();
  global.LHOpenTTD.ensureBots(LHOTTDState);
  if (!LHOTTDState.marketOrders || !LHOTTDState.marketOrders.length) {
    global.LHOpenTTD.refreshBotOrders(LHOTTDState);
  }
  return LHOTTDState;
}

function lhOttdSave(server) {
  if (LHOTTDState !== null) {
    server.persistentData.putString('longhaul_openttd_v1', JSON.stringify(LHOTTDState));
  }
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

function lhCompanyTerritoryMap(server, player) {
  var st = lhOttdRead(server);
  var sc = global.LHOpenTTD.sectorCoords(player.x, player.z);
  var curInfo = global.LHOpenTTD.resolveSectorOwner(st, sc.sx, sc.sz);
  var curComp = curInfo.owner ? st.companies[curInfo.owner] : null;
  lhMsg(player, '=== Карта секторов 256×256 вокруг (' + sc.sx + ', ' + sc.sz + ') ===');
  lhMsg(player, 'Текущий сектор: ' + (curComp ? (curComp.colorCode + curComp.name) : 'Ничей') +
    ' §7(' + (curInfo.kind === 'claimed' ? 'Захвачен, защита ' + curInfo.strength : 'Зона влияния Вороного') + ')');
  var rows = global.LHOpenTTD.renderAsciiMap(st, sc.sx, sc.sz, 3);
  for (var i = 0; i < rows.length; i++) {
    player.tell('  ' + rows[i]);
  }
  var legend = Object.keys(st.companies).map(function (cid) {
    var c = st.companies[cid];
    return c.colorCode + '█ ' + c.name + (c.isBot ? ' [BOT]' : '') + '§7';
  });
  player.tell('§7Легенда: ◆=Вы, █=Захвачен, ▒=Влияние | ' + legend.join(' | '));
  return 1;
}

function lhCompanyClaimHere(server, player, allowCapture) {
  var st = lhOttdRead(server);
  var comp = lhGetPlayerCompany(server, player);
  if (!comp) {
    lhMsg(player, 'Сначала создайте или вступите в компанию: /lh company create <id> <название>');
    return 0;
  }
  var sc = global.LHOpenTTD.sectorCoords(player.x, player.z);
  var res = global.LHOpenTTD.claimOrCaptureSector(st, comp.id, sc.sx, sc.sz, !!allowCapture);
  if (!res.ok) {
    if (res.reason === 'already_yours') lhMsg(player, 'Сектор (' + sc.sx + ', ' + sc.sz + ') уже захвачен вашей компанией.');
    else if (res.reason === 'enemy_claimed') {
      var target = st.companies[res.targetOwner];
      lhMsg(player, 'Сектор (' + sc.sx + ', ' + sc.sz + ') уже удерживает ' + (target ? target.name : res.targetOwner) +
        '. Для перехвата используйте /lh territory capture (цена: ' + res.cost + ' Cr).');
    } else if (res.reason === 'no_cash') {
      lhMsg(player, 'Недостаточно средств для захвата сектора (' + sc.sx + ', ' + sc.sz + '): нужно ' + res.cost + ' Cr, у компании ' + res.cash + ' Cr.');
    }
    return 0;
  }
  lhOttdSave(server);
  lhUnlock(player, 'longhaul:openttd/claim');
  var action = res.mode === 'capture' ? 'перехвачен у соперника' : 'захвачен';
  lhMsg(player, comp.colorCode + '[' + comp.name + '] §aСектор (' + sc.sx + ', ' + sc.sz + ') ' + action + ' за ' + res.cost + ' Cr! Баланс: ' + comp.cash + ' Cr.');
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
  var st = lhOttdRead(server);
  var sc = global.LHOpenTTD.sectorCoords(player.x, player.z);
  var info = global.LHOpenTTD.resolveSectorOwner(st, sc.sx, sc.sz);
  var comp = info.owner ? st.companies[info.owner] : null;
  var myComp = lhGetPlayerCompany(server, player);
  var costMsg = '';
  if (myComp) {
    var costInfo = global.LHOpenTTD.computeClaimCost(st, myComp.id, sc.sx, sc.sz);
    if (costInfo.ok) costMsg = ' | Цена ' + (costInfo.mode === 'capture' ? 'перехвата' : 'захвата') + ': ' + costInfo.cost + ' Cr';
  }
  lhMsg(player, 'Сектор (' + sc.sx + ', ' + sc.sz + ') [центр ' + sc.centerX + ', ' + sc.centerZ + ']: владелец=' +
    (comp ? (comp.colorCode + comp.name + '§f') : 'нет') + ' (' + info.kind + ', защита=' + info.strength + ')' + costMsg);
  return 1;
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
  var cons = lhConsumeInvItem(player.inventory, order.item, order.qty);
  if (!cons.ok) {
    if (!dryRun) lhMsg(player, 'Недостаточно ' + order.item + ': нужно ' + order.qty + ', у вас ' + cons.have + '.');
    return 0;
  }
  var isSubsidy = st.subsidy && st.subsidy.item === order.item && st.subsidy.companyId === order.companyId;
  var bonusMult = isSubsidy ? 1.75 : 1.20;
  var payout = Math.round(order.price * bonusMult);
  buyer.cash -= order.price;
  myComp.cash += payout;
  myComp.stats.tradeVolume = (myComp.stats.tradeVolume || 0) + payout;
  buyer.stats.tradeVolume = (buyer.stats.tradeVolume || 0) + order.price;
  order.remainingBatches -= 1;
  lhOttdSave(server);
  if (!dryRun) {
    lhUnlock(player, 'longhaul:openttd/trade');
    lhMsg(player, '§a[Рынок] Продано ' + order.qty + '× ' + order.item + ' компании ' + buyer.name +
      ' за §f' + payout + ' Cr' + (isSubsidy ? ' §e(СУБСИДИЯ ×1.75!)' : ' §7(+20% межкорпоративный бонус)') + '. Баланс: ' + myComp.cash + ' Cr.');
  }
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
  var taxFree = global.LHOpenTTD.hasPact(st, myComp.id, order.companyId);
  var totalCost = taxFree ? order.price : Math.round(order.price * 1.10);
  if (myComp.cash < totalCost) {
    if (!dryRun) lhMsg(player, 'Недостаточно средств: нужно ' + totalCost + ' Cr, у вас ' + myComp.cash + ' Cr.');
    return 0;
  }
  myComp.cash -= totalCost;
  if (seller) {
    seller.cash += order.price;
    seller.stats.tradeVolume = (seller.stats.tradeVolume || 0) + order.price;
  }
  myComp.stats.tradeVolume = (myComp.stats.tradeVolume || 0) + totalCost;
  order.remainingBatches -= 1;
  if (!dryRun && typeof Item !== 'undefined' && typeof player.give === 'function') {
    player.give(Item.of(order.item, order.qty));
  }
  lhOttdSave(server);
  if (!dryRun) {
    lhUnlock(player, 'longhaul:openttd/trade');
    lhMsg(player, '§a[Рынок] Куплено ' + order.qty + '× ' + order.item + ' у ' + (seller ? seller.name : order.companyId) +
      ' за ' + totalCost + ' Cr' + (taxFree ? ' §a(по торговому пакту без пошлины)' : ' §7(вкл. 10% пошлины)') + '.');
  }
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
  if (myComp.cash < offer.price) {
    if (!dryRun) lhMsg(player, 'Не хватает средств: нужно ' + offer.price + ' Cr.');
    return 0;
  }
  var seller = st.companies[offer.sellerCompany];
  myComp.cash -= offer.price;
  if (seller) {
    seller.cash += offer.price;
    seller.stats.tradeVolume = (seller.stats.tradeVolume || 0) + offer.price;
  }
  myComp.stats.tradeVolume = (myComp.stats.tradeVolume || 0) + offer.price;
  offer.status = 'completed';
  if (!dryRun && typeof Item !== 'undefined' && typeof player.give === 'function') {
    player.give(Item.of(offer.item, offer.qty));
  }
  lhOttdSave(server);
  if (!dryRun) {
    lhUnlock(player, 'longhaul:openttd/trade');
    lhMsg(player, '§a[Сделка ' + offer.id + '] Получено ' + offer.qty + '× ' + offer.item + ' за ' + offer.price + ' Cr!');
  }
  return 1;
}

function lhBotTick(server, dryRun) {
  var st = lhOttdRead(server);
  var ow = server ? server.getLevel('minecraft:overworld') : null;
  var borderSize = (ow && ow.worldBorder && Number(ow.worldBorder.size) > 0) ? Number(ow.worldBorder.size) : 724;
  var maxSectorAbs = Math.max(1, Math.floor((borderSize / 2) / global.LHOpenTTD.SECTOR_SIZE));
  var expansions = global.LHOpenTTD.botExpandStep(st, maxSectorAbs);

  if (st.botCycle % 4 === 0) {
    global.LHOpenTTD.refreshBotOrders(st);
    var buyOrders = st.marketOrders.filter(function (o) { return o.isBot && o.side === 'buy'; });
    if (buyOrders.length > 0) {
      var pick = buyOrders[Math.floor(Math.random() * buyOrders.length)];
      st.subsidy = { companyId: pick.companyId, item: pick.item, orderId: pick.id };
      if (!dryRun && server && server.players) {
        var bName = st.companies[pick.companyId] ? st.companies[pick.companyId].name : pick.companyId;
        server.players.forEach(function (p) {
          p.tell('§e💰 [Субсидия Консорциума] ' + bName + ' платит ×1.75 за продажу ' + pick.item + ' (/lh market sell ' + pick.id + ')!');
        });
      }
    }
  }
  if (!dryRun && expansions.length > 0 && server && server.players) {
    expansions.forEach(function (ev) {
      server.players.forEach(function (p) {
        p.tell('§7🤖 [Конкуренты] Компания «' + ev.botName + '» захватила сектор (' + ev.sx + ', ' + ev.sz + ')!');
      });
    });
  }
  lhOttdSave(server);
  return expansions;
}

BlockEvents.broken(function (event) {
  var server = event.server, player = event.player, block = event.block;
  if (!server || !player || !block) return;
  var creative = (typeof player.isCreative === 'function' && player.isCreative()) ||
    (typeof player.isSpectator === 'function' && player.isSpectator());
  if (creative) return;

  var comp = lhGetPlayerCompany(server, player);
  var st = lhOttdRead(server);
  var sc = global.LHOpenTTD.sectorCoords(block.x, block.z);
  var sec = global.LHOpenTTD.resolveSectorOwner(st, sc.sx, sc.sz);

  var isOre = block.hasTag('forge:ores');
  var isLog = block.hasTag('minecraft:logs');
  if (!isOre && !isLog) return;

  if (comp) {
    comp.stats.blocksMined = (comp.stats.blocksMined || 0) + 1;
    // Rival claimed-territory toll
    if (sec.kind === 'claimed' && sec.owner && sec.owner !== comp.id && !global.LHOpenTTD.hasPact(st, comp.id, sec.owner)) {
      var landlord = st.companies[sec.owner];
      if (comp.cash >= 5) {
        comp.cash -= 5;
        if (landlord) landlord.cash += 5;
      }
    }
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

ServerEvents.tick(function (event) {
  LHOTTDTick++;
  var server = event.server;
  if (LHOTTDTick % 600 === 0) {
    lhBotTick(server, false);
  }
  if (LHOTTDTick % 20 !== 0) return;

  var st = lhOttdRead(server);
  var plist = server.players || [];
  for (var i = 0; i < plist.length; i++) {
    var p = plist[i];
    if (String(p.level.dimension) !== 'minecraft:overworld') continue;
    var pid = lhId(p);
    var sc = global.LHOpenTTD.sectorCoords(p.x, p.z);
    var sec = global.LHOpenTTD.resolveSectorOwner(st, sc.sx, sc.sz);
    var prevKey = LHOTTDLastSectorByPlayer[pid];
    var nowTag = (sec.owner || 'none') + ':' + sec.kind;
    if (prevKey && prevKey !== nowTag) {
      var oComp = sec.owner ? st.companies[sec.owner] : null;
      var uname = p.username || (typeof p.getName === 'function' ? p.getName().getString() : '');
      if (oComp && uname) {
        var msgJson = JSON.stringify({
          text: '🏴 Территория: ' + oComp.name + (sec.kind === 'claimed' ? ' [Захвачен]' : ' [Влияние]'),
          color: oComp.color || 'yellow'
        });
        server.runCommandSilent('title ' + uname + ' actionbar ' + msgJson);
      }
    }
    LHOTTDLastSectorByPlayer[pid] = nowTag;

    // Transport specialization active perks
    var comp = lhGetPlayerCompany(server, p);
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
  var comp = lhGetPlayerCompany(server, player);
  if (comp) {
    lhMsg(player, 'Компания: ' + comp.colorCode + comp.name + ' §f(баланс: ' + comp.cash + ' Cr, транспорт: ' +
      (comp.transportSpec || 'не выбран') + ', ресурс: ' + (comp.resourceSpec || 'не выбран') + '). Карта: /lh map');
  } else {
    lhMsg(player, 'OpenTTD-режим: создайте компанию (/lh company create <id> <название>) или посмотрите конкурентов (/lh company list, /lh map).');
  }
});

ServerEvents.commandRegistry(function (event) {
  var C = event.commands, root = C.literal('lh');

  root.then(C.literal('map').executes(function (ctx) {
    return lhCompanyTerritoryMap(ctx.source.server, ctx.source.playerOrException);
  }));

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
  root.then(trade);

  var bot = C.literal('bot');
  bot.then(C.literal('status').executes(function (ctx) {
    var server = ctx.source.server, p = ctx.source.playerOrException, st = lhOttdRead(server);
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

  event.register(root);
});

ServerEvents.loaded(function (event) {
  lhOttdRead(event.server);
  console.info('[LH] OpenTTD Companies, Specializations, Voronoi+Claim Sectors, Market & AI Bots loaded.');
});
