// Long Haul Legacy 2.0: Chapter-gated territory expansion (175000^(1/x), x = 2 - 1/locked),
// randomized hard-feature unlocking with animated Casino Wheel visual, and chapter completion sync.
var LHProgState = null;
var LHProgTick = 0;
var LHActiveSpin = null;
var LHSpinQueue = [];
var LHBossbarTimer = 0;

var LH_WORKSHOP_ITEMS = [
  'create:water_wheel', 'create:mechanical_press', 'create:mechanical_mixer',
  'create:brass_ingot', 'create:precision_mechanism', 'create:track',
  'create:track_station', 'computercraft:computer_normal', 'exposure:camera',
  'exposure:black_and_white_film', 'exposure:album', 'farmersdelight:cooking_pot'
];

var LH_GATE_ORDER = ['ch00', 'ch01', 'ch02', 'ch03', 'ch05', 'ch04'];

var LH_CHAPTER_LABELS = {
  ch00: '00 · Сюжет: Ушёл за хлебом',
  ch01: '01 · Начало и правила',
  ch02: '02 · Мастерская и экспедиция',
  ch03: '03 · Контрольные поставки',
  ch04: '04 · Экономические центры',
  ch05: '05 · Маршруты и лагеря',
  ch06: '06 · Восстановление и полевые отчёты',
  ch07: '07 · Кампания: Основная прогрессия',
  ch08: '08 · Кампания: Региональные контракты',
  ch09: '09 · Кампания: Инженерные испытания',
  ch10: '10 · Кампания: Фотодокументация',
  ch11: '11 · Кампания: Лагеря и экспедиции',
  ch12: '12 · Ядерная энергетика и Драконик'
};

function lhProgRead(server) {
  if (LHProgState !== null) return LHProgState;
  var raw = server.persistentData.getString('longhaul_progression_v1');
  LHProgState = raw ? JSON.parse(String(raw)) : {
    chapters: {},
    hardFeatures: {},
    featureOrder: [],
    workshopItems: {},
    rulesConfirmed: false,
    nuclearVerified: false,
    doomedVerified: false,
    lastBorderSize: 0
  };
  if (!LHProgState.chapters) LHProgState.chapters = {};
  if (!LHProgState.hardFeatures) LHProgState.hardFeatures = {};
  if (!LHProgState.featureOrder) LHProgState.featureOrder = [];
  if (!LHProgState.workshopItems) LHProgState.workshopItems = {};
  return LHProgState;
}

function lhProgSave(server) {
  if (LHProgState !== null) {
    server.persistentData.putString('longhaul_progression_v1', JSON.stringify(LHProgState));
  }
}

function lhHardIsActive(server, featureId) {
  if (!server) return false;
  var db = lhProgRead(server);
  return !!(db.hardFeatures && db.hardFeatures[featureId]);
}

function lhHardFeatureMeta(featureId) {
  var list = global.LHHardFeatureCatalog || [];
  for (var i = 0; i < list.length; i++) {
    if (list[i].id === featureId) return list[i];
  }
  return null;
}

function lhTerritoryCounts(server) {
  var db = lhProgRead(server);
  var gateUnlocked = 0;
  LH_GATE_ORDER.forEach(function (cid) {
    if (db.chapters[cid]) gateUnlocked++;
  });
  var bonusUnlocked = 0;
  ['ch06', 'ch07', 'ch08', 'ch09', 'ch10', 'ch11', 'ch12'].forEach(function (cid) {
    if (db.chapters[cid]) bonusUnlocked++;
  });
  var effectiveUnlocked = db.chapters.ch04
    ? Math.min(6, gateUnlocked + bonusUnlocked)
    : Math.min(5, gateUnlocked + bonusUnlocked);
  return global.LHTerritoryMath.computeBorder(6, effectiveUnlocked);
}

function lhApplyTerritoryBorder(server, announce) {
  var info = lhTerritoryCounts(server);
  var db = lhProgRead(server);
  var prev = Number(db.lastBorderSize || 0);
  var ow = server.overworld();
  if (ow && ow.worldBorder) {
    ow.worldBorder.setCenter(0, 0);
    ow.worldBorder.setSize(info.size);
  }
  db.lastBorderSize = info.size;
  lhProgSave(server);

  if (announce && prev > 0 && info.size > prev) {
    var half = Math.round(info.size / 2);
    var plist = server.players;
    if (plist) {
      for (var i = 0; i < plist.length; i++) {
        plist[i].tell('§b§l[Граница мира] §aТерритория расширена: §f' + info.size + '×' + info.size +
          ' §7(±' + half + ' м, закрыто глав: ' + info.locked + ', x=' + (Math.round(info.x * 1000) / 1000) + ')');
      }
    }
  }
  return info;
}

function lhLockedHardFeatures(server) {
  var db = lhProgRead(server);
  var pool = global.LHHardFeatureCatalog || [];
  var out = [];
  for (var i = 0; i < pool.length; i++) {
    if (!db.hardFeatures[pool[i].id]) out.push(pool[i]);
  }
  return out;
}

function lhCasinoBuildStrip(pool, centerIdx) {
  var n = pool.length;
  var prev2 = pool[(centerIdx - 2 + n * 4) % n];
  var prev1 = pool[(centerIdx - 1 + n * 4) % n];
  var cur = pool[centerIdx % n];
  var next1 = pool[(centerIdx + 1) % n];
  var next2 = pool[(centerIdx + 2) % n];
  return {
    titleJson: JSON.stringify({
      text: '🎰 ' + cur.icon + ' ' + cur.name + ' 🎰',
      color: cur.color || 'gold',
      bold: true
    }),
    subtitleJson: JSON.stringify({
      text: '‹ ' + prev1.icon + ' ' + prev1.name + '  |  ▶ ' + cur.name + ' ◀  |  ' + next1.name + ' ' + next1.icon + ' ›',
      color: 'yellow'
    }),
    actionJson: JSON.stringify({
      text: '[ ' + prev2.icon + ' ] [ ' + prev1.icon + ' ] ▶ [ ' + cur.icon + ' ' + cur.name + ' ] ◀ [ ' + next1.icon + ' ] [ ' + next2.icon + ' ]',
      color: 'gold'
    })
  };
}

function lhCasinoBroadcastFrame(server, pool, centerIdx, isFinal, reasonLabel) {
  var strip = lhCasinoBuildStrip(pool, centerIdx);
  var winner = pool[centerIdx % pool.length];
  if (isFinal) {
    strip.titleJson = JSON.stringify({
      text: '🎰 ВЫПАЛО: ' + winner.icon + ' ' + winner.name,
      color: 'red',
      bold: true
    });
    strip.subtitleJson = JSON.stringify({
      text: winner.summary,
      color: 'gold'
    });
  }
  server.runCommandSilent('bossbar add minecraft:lh_casino ' + JSON.stringify({ text: '🎰 Колесо Угроз: ' + (reasonLabel || 'Новая глава') }));
  server.runCommandSilent('bossbar set minecraft:lh_casino color ' + (isFinal ? 'red' : 'yellow'));
  server.runCommandSilent('bossbar set minecraft:lh_casino style notched_10');
  server.runCommandSilent('bossbar set minecraft:lh_casino players @a');
  var pct = isFinal ? 100 : Math.min(95, Math.max(5, Math.round((centerIdx % 10) * 10)));
  server.runCommandSilent('bossbar set minecraft:lh_casino value ' + pct);
  server.runCommandSilent('bossbar set minecraft:lh_casino name ' + JSON.stringify({
    text: isFinal ? ('🎰 АКТИВИРОВАНО: ' + winner.icon + ' ' + winner.name) : ('🎰 Колесо Угроз ▶ ' + winner.icon + ' ' + winner.name),
    color: isFinal ? 'red' : 'gold',
    bold: true
  }));

  var plist = server.players;
  if (plist) {
    for (var i = 0; i < plist.length; i++) {
      var uname = plist[i].username || (typeof plist[i].getName === 'function' ? plist[i].getName().getString() : '');
      if (!uname) continue;
      server.runCommandSilent('title ' + uname + ' times 0 25 10');
      server.runCommandSilent('title ' + uname + ' subtitle ' + strip.subtitleJson);
      server.runCommandSilent('title ' + uname + ' title ' + strip.titleJson);
      server.runCommandSilent('title ' + uname + ' actionbar ' + strip.actionJson);
      if (isFinal) {
        server.runCommandSilent('execute at ' + uname + ' run playsound minecraft:ui.toast.challenge_complete master ' + uname + ' ~ ~ ~ 1.0 1.0');
        server.runCommandSilent('execute at ' + uname + ' run playsound minecraft:entity.wither.spawn master ' + uname + ' ~ ~ ~ 0.6 1.2');
      } else {
        var pitch = 0.8 + ((centerIdx % 8) * 0.08);
        server.runCommandSilent('execute at ' + uname + ' run playsound minecraft:block.note_block.bit master ' + uname + ' ~ ~ ~ 0.8 ' + pitch.toFixed(2));
      }
    }
  }
}

function lhCasinoPickRandomLocked(server, forcedId) {
  var locked = lhLockedHardFeatures(server);
  if (!locked.length) return null;
  if (forcedId) {
    for (var i = 0; i < locked.length; i++) {
      if (locked[i].id === forcedId) return locked[i];
    }
  }
  var idx = Math.floor(Math.random() * locked.length);
  return locked[idx];
}

function lhCasinoQueueSpin(server, reasonLabel, forcedFeatureId) {
  var db = lhProgRead(server);
  var winner = lhCasinoPickRandomLocked(server, forcedFeatureId);
  if (!winner) return null;

  var pool = global.LHHardFeatureCatalog || [];
  var winnerIdx = 0;
  for (var i = 0; i < pool.length; i++) {
    if (pool[i].id === winner.id) { winnerIdx = i; break; }
  }
  var delays = [2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 5, 5, 6, 7, 9, 11, 14];
  var startIdx = ((winnerIdx - (delays.length - 1)) % pool.length + pool.length * 10) % pool.length;
  LHSpinQueue.push({
    reason: reasonLabel || 'Новая глава',
    winnerId: winner.id,
    winnerIdx: winnerIdx,
    delays: delays,
    step: 0,
    ticksLeft: 1,
    currentIdx: startIdx
  });
  return winner.id;
}

function lhCasinoFinalizeWinner(server, winnerId, reasonLabel, skipVisual) {
  var db = lhProgRead(server);
  var winner = lhHardFeatureMeta(winnerId);
  if (!winner) return null;
  if (!db.hardFeatures[winnerId]) {
    db.hardFeatures[winnerId] = true;
    db.featureOrder.push(winnerId);
    lhProgSave(server);
  }
  if (!skipVisual) {
    var pool = global.LHHardFeatureCatalog || [];
    var wIdx = 0;
    for (var i = 0; i < pool.length; i++) {
      if (pool[i].id === winnerId) { wIdx = i; break; }
    }
    lhCasinoBroadcastFrame(server, pool, wIdx, true, reasonLabel);
    LHBossbarTimer = 100;
    var plist = server.players;
    if (plist) {
      for (var j = 0; j < plist.length; j++) {
        plist[j].tell('§6§l[Колесо Угроз · ' + (reasonLabel || 'Глава') + '] §cВыпало усложнение: §f' +
          winner.icon + ' ' + winner.name + ' §7— ' + winner.summary);
        if (winner.id === 'immortal_snail' && typeof lhSnailWake === 'function') {
          lhSnailWake(server, plist[j], false);
        }
      }
    }
  }
  return winner;
}

function lhCasinoStep(server, dryRun) {
  if (!LHActiveSpin && LHSpinQueue.length > 0) {
    LHActiveSpin = LHSpinQueue.shift();
  }
  if (LHActiveSpin) {
    LHActiveSpin.ticksLeft -= 1;
    if (LHActiveSpin.ticksLeft <= 0) {
      var pool = global.LHHardFeatureCatalog || [];
      var isFinal = LHActiveSpin.step >= LHActiveSpin.delays.length - 1;
      if (isFinal) {
        var fin = LHActiveSpin;
        LHActiveSpin = null;
        lhCasinoFinalizeWinner(server, fin.winnerId, fin.reason, !!dryRun);
        return 2;
      } else {
        if (!dryRun) lhCasinoBroadcastFrame(server, pool, LHActiveSpin.currentIdx, false, LHActiveSpin.reason);
        LHActiveSpin.currentIdx = (LHActiveSpin.currentIdx + 1) % pool.length;
        LHActiveSpin.step += 1;
        LHActiveSpin.ticksLeft = LHActiveSpin.delays[LHActiveSpin.step];
        return 1;
      }
    }
    return 0;
  }
  if (LHBossbarTimer > 0) {
    LHBossbarTimer--;
    if (LHBossbarTimer === 0 && !dryRun) {
      server.runCommandSilent('bossbar remove minecraft:lh_casino');
    }
  }
  return 0;
}

function lhCasinoResolveImmediate(server, dryRun) {
  var resolved = [];
  if (LHActiveSpin) {
    resolved.push(LHActiveSpin.winnerId);
    lhCasinoFinalizeWinner(server, LHActiveSpin.winnerId, LHActiveSpin.reason, !!dryRun);
    LHActiveSpin = null;
  }
  while (LHSpinQueue.length > 0) {
    var next = LHSpinQueue.shift();
    resolved.push(next.winnerId);
    lhCasinoFinalizeWinner(server, next.winnerId, next.reason, !!dryRun);
  }
  return resolved;
}

function lhUnlockChapter(server, chapterId, triggerSpin, dryRun) {
  var db = lhProgRead(server);
  if (db.chapters[chapterId]) return false;
  db.chapters[chapterId] = true;
  lhProgSave(server);

  var label = LH_CHAPTER_LABELS[chapterId] || chapterId;
  var plist = server.players;
  if (!dryRun && plist) {
    for (var i = 0; i < plist.length; i++) {
      plist[i].tell('§a§l[Глава завершена] §f' + label + ' §7-> расширяем территорию и крутим Колесо Угроз!');
    }
  }
  lhApplyTerritoryBorder(server, !dryRun);
  if (triggerSpin !== false) {
    lhCasinoQueueSpin(server, label, null);
  }
  return true;
}

function lhScanWorkshopItems(server, player) {
  if (!player || !player.inventory) return 0;
  var db = lhProgRead(server);
  var inv = player.inventory;
  var changed = false;
  for (var s = 0; s < inv.slots; s++) {
    var st = inv.getStackInSlot(s);
    if (!st || st.empty) continue;
    var sid = String(st.id);
    if (LH_WORKSHOP_ITEMS.indexOf(sid) !== -1 && !db.workshopItems[sid]) {
      db.workshopItems[sid] = true;
      changed = true;
    }
    if (sid.indexOf('draconicevolution:') === 0 || sid.indexOf('nuclearcraft:') === 0 ||
        sid.indexOf('electrodynamics:') === 0 || sid.indexOf('nuclearscience:') === 0 ||
        sid.indexOf('ballistix:') === 0 || sid.indexOf('hbmsntm:') === 0 || sid.indexOf('bigreactors:') === 0) {
      if (!db.nuclearVerified) {
        db.nuclearVerified = true;
        changed = true;
      }
    }
  }
  if (changed) lhProgSave(server);
  return Object.keys(db.workshopItems).length;
}

function lhProgressionRecompute(server, player, dryRun) {
  var db = lhProgRead(server);
  var cDb = lhRead(server);
  var sitesDb = lhSitesRead(server);
  var recDb = lhRecRead(server);
  var fieldDb = lhFieldRead(server);
  var logDb = lhLogRead(server);
  var catDb = lhCatRead(server);

  if (player) lhScanWorkshopItems(server, player);

  // Merge all team/player contract receipts
  var allReceipts = {};
  Object.keys(cDb.players || {}).forEach(function (pid) {
    var pr = cDb.players[pid];
    if (pr && pr.receipts) {
      Object.keys(pr.receipts).forEach(function (k) { allReceipts[k] = true; });
    }
  });
  Object.keys(cDb.teams || {}).forEach(function (tn) {
    var tm = cDb.teams[tn];
    if (tm && tm.receipts) {
      Object.keys(tm.receipts).forEach(function (k) { allReceipts[k] = true; });
    }
  });

  var hasTerminal = Object.keys(cDb.players || {}).some(function (pid) {
    return !!(cDb.players[pid] && cDb.players[pid].terminal);
  });

  // ch00: Chapter 00 (Story prologue)
  if (!db.chapters.ch00 && player && typeof player.isAdvancementDone === 'function') {
    var storyOk = [
      'longhaul:story/01_left_for_bread',
      'longhaul:story/02_bakery_burned',
      'longhaul:story/03_dinner_telegram',
      'longhaul:story/04_snail_at_door',
      'longhaul:story/05_continental_bakery',
      'longhaul:story/06_forgot_the_milk'
    ].every(function (a) { return player.isAdvancementDone(a); });
    if (storyOk) lhUnlockChapter(server, 'ch00', true, dryRun);
  }

  // ch01: Rules & Start (auto-completes once rules confirmed OR ch00 done + terminal placed)
  if (!db.chapters.ch01 && (db.rulesConfirmed || (db.chapters.ch00 && hasTerminal))) {
    lhUnlockChapter(server, 'ch01', true, dryRun);
  }

  // ch02: Workshop & Expedition (>= 8 of 12 milestone items obtained)
  if (!db.chapters.ch02 && Object.keys(db.workshopItems || {}).length >= 8) {
    lhUnlockChapter(server, 'ch02', true, dryRun);
  }

  // ch03: Home Contracts (all 5 core + 3 shift contracts, or >= 6 contracts completed)
  var receiptCount = Object.keys(allReceipts).length;
  if (!db.chapters.ch03 && receiptCount >= 6) {
    lhUnlockChapter(server, 'ch03', true, dryRun);
  }

  // ch05: Routes & Camps (deploy >= 3 active camps or camp + completed route)
  if (!db.chapters.ch05) {
    var anyThreeCamps = Object.keys(logDb.camps || {}).some(function (pid) {
      var list = logDb.camps[pid] || [];
      return list.filter(function (c) { return c.active; }).length >= 3;
    });
    var anyCompletedRoute = Object.keys(logDb.routes || {}).some(function (rk) {
      return !!(logDb.routes[rk] && logDb.routes[rk].completed);
    });
    if (anyThreeCamps && anyCompletedRoute) {
      lhUnlockChapter(server, 'ch05', true, dryRun);
    }
  }

  // ch04: Economic Centers (hub produced >= 1 or >= 6 sites commissioned)
  if (!db.chapters.ch04) {
    var commCount = 0;
    Object.keys(sitesDb.sites || {}).forEach(function (sid) {
      if (sitesDb.sites[sid] && sitesDb.sites[sid].commissioned) commCount++;
    });
    var hub = sitesDb.sites && sitesDb.sites.continental_hub;
    if ((hub && (hub.producedTotal || 0) >= 1) || commCount >= 6) {
      lhUnlockChapter(server, 'ch04', true, dryRun);
    }
  }

  // ch06: Recoveries & Field Reports
  if (!db.chapters.ch06) {
    var restCount = 0;
    Object.keys(recDb.items || {}).forEach(function (rid) {
      if (recDb.items[rid] && recDb.items[rid].restored) restCount++;
    });
    if (restCount >= 3 && Object.keys(fieldDb.ccVerified || {}).length >= 2) {
      lhUnlockChapter(server, 'ch06', true, dryRun);
    }
  }

  // ch07..ch11: Catalog chapters (at least 4 verified orders in the respective chapter)
  var catCounts = { ch07: 0, ch08: 0, ch09: 0, ch10: 0, ch11: 0 };
  Object.keys(catDb.completed || {}).forEach(function (ck) {
    var qid = ck.split(':')[1] || '';
    if (qid.indexOf('main_') === 0) catCounts.ch07++;
    else if (qid.indexOf('region_') === 0) catCounts.ch08++;
    else if (qid.indexOf('engineering_') === 0) catCounts.ch09++;
    else if (qid.indexOf('photo_') === 0) catCounts.ch10++;
    else if (qid.indexOf('expedition_') === 0) catCounts.ch11++;
  });
  Object.keys(catCounts).forEach(function (cid) {
    if (!db.chapters[cid] && catCounts[cid] >= 4) {
      lhUnlockChapter(server, cid, true, dryRun);
    }
  });

  // ch12: Nuclear & Draconic milestone
  if (!db.chapters.ch12 && db.nuclearVerified) {
    lhUnlockChapter(server, 'ch12', true, dryRun);
  }

  return lhTerritoryCounts(server);
}

// Runtime enforcement for gated hard features: ore_scarcity, wood_scarcity, tool_wear, smarter_mobs, hostile_nights, acid_pollution, hunger_exhaustion, radiation_fallout
BlockEvents.broken(function (event) {
  var server = event.server;
  var player = event.player;
  if (!server || !player) return;
  var creative = (typeof player.isCreative === 'function' && player.isCreative()) ||
    (typeof player.isSpectator === 'function' && player.isSpectator());
  if (creative) return;

  var block = event.block;
  if (!block) return;

  if (block.hasTag('minecraft:logs') && lhHardIsActive(server, 'wood_scarcity')) {
    if (Math.random() < 0.40) {
      block.set('minecraft:air');
      event.cancel();
      return;
    }
  }

  if (block.hasTag('forge:ores') && lhHardIsActive(server, 'ore_scarcity')) {
    var held = player.mainHandItem;
    var hasSilk = false;
    try {
      if (held && !held.empty && held.nbt && String(held.nbt).indexOf('minecraft:silk_touch') !== -1) {
        hasSilk = true;
      }
    } catch (eSilk) {}
    if (!hasSilk && Math.random() < 0.50) {
      block.popItem('minecraft:cobblestone');
      block.set('minecraft:air');
      event.cancel();
      return;
    }
  }

  if (lhHardIsActive(server, 'tool_wear')) {
    var d0 = global.LHWorldPlanner.dist2D(0, 0, Number(player.x), Number(player.z));
    if (d0 >= 400 && Math.random() < 0.25) {
      var item = player.mainHandItem;
      if (item && !item.empty && item.damageable) {
        try { item.hurtAndBreak(1, player, function () {}); } catch (eDur) {}
      }
    }
  }
});

EntityEvents.spawned(function (event) {
  var ent = event.entity;
  var level = event.level;
  if (!ent || !level || !level.server) return;
  var server = level.server;
  if (String(level.dimension) !== 'minecraft:overworld') return;
  if (typeof ent.isMonster !== 'function' || !ent.isMonster()) return;

  var uname = null;
  var smarter = lhHardIsActive(server, 'smarter_mobs');
  var bloodNight = false;
  if (lhHardIsActive(server, 'hostile_nights')) {
    var tod = Number(level.dayTime()) % 24000;
    if (tod >= 13000 && tod <= 23500) bloodNight = true;
  }
  if (!smarter && !bloodNight) return;

  try {
    if (smarter) {
      ent.potionEffects.add('minecraft:speed', 24000, 0, false, false);
      if (Math.random() < 0.25) ent.potionEffects.add('minecraft:resistance', 24000, 0, false, false);
    }
    if (bloodNight) {
      ent.potionEffects.add('minecraft:strength', 12000, 0, false, false);
      ent.potionEffects.add('minecraft:fire_resistance', 12000, 0, false, false);
    }
  } catch (eMob) {}
});

PlayerEvents.inventoryChanged(function (event) {
  if (!event.server || !event.player) return;
  lhScanWorkshopItems(event.server, event.player);
});

ServerEvents.tick(function (event) {
  LHProgTick++;
  var server = event.server;
  lhCasinoStep(server, false);

  if (LHProgTick % 40 !== 0) return;
  var plist = server.players;
  if (!plist) return;
  for (var i = 0; i < plist.length; i++) {
    var p = plist[i];
    if (typeof lhStageRecompute === 'function') lhStageRecompute(server, p);
    lhProgressionRecompute(server, p, false);

    if (String(p.level.dimension) !== 'minecraft:overworld') continue;
    var creative = (typeof p.isCreative === 'function' && p.isCreative()) ||
      (typeof p.isSpectator === 'function' && p.isSpectator());
    if (creative) continue;

    var uname = p.username || (typeof p.getName === 'function' ? p.getName().getString() : '');
    if (!uname) continue;

    if (LHProgTick % 120 === 0 && lhHardIsActive(server, 'acid_pollution') && Number(p.y) < 92) {
      var hasHelmet = p.headArmorItem && !p.headArmorItem.empty;
      if (!hasHelmet) {
        server.runCommandSilent('effect give ' + uname + ' minecraft:weakness 4 0 true');
      }
    }
    if (LHProgTick % 120 === 0 && lhHardIsActive(server, 'hunger_exhaustion')) {
      if (typeof p.isSprinting === 'function' && p.isSprinting()) {
        server.runCommandSilent('effect give ' + uname + ' minecraft:hunger 3 0 true');
      }
    }
    if (LHProgTick % 160 === 0 && lhHardIsActive(server, 'radiation_fallout') && Number(p.y) < 20) {
      var armored = p.chestArmorItem && !p.chestArmorItem.empty;
      if (!armored) {
        server.runCommandSilent('effect give ' + uname + ' minecraft:mining_fatigue 5 0 true');
      }
    }
  }
});

PlayerEvents.loggedIn(function (event) {
  var server = event.server, player = event.player;
  lhProgressionRecompute(server, player, false);
  var info = lhApplyTerritoryBorder(server, false);
  var db = lhProgRead(server);
  lhMsg(player, 'Граница мира: ' + info.size + '×' + info.size + ' (±' + Math.round(info.size / 2) +
    ' м, закрыто глав: ' + info.locked + '). Активных угроз: ' + db.featureOrder.length +
    '/' + (global.LHHardFeatureCatalog ? global.LHHardFeatureCatalog.length : 11) + ' (/lh territory, /lh casino status).');
});

ServerEvents.commandRegistry(function (event) {
  var C = event.commands, root = C.literal('lh');

  var terr = C.literal('territory');
  terr.executes(function (ctx) {
    var server = ctx.source.server, p = ctx.source.playerOrException;
    var info = lhApplyTerritoryBorder(server, false);
    var db = lhProgRead(server);
    var unlocked = Object.keys(db.chapters).filter(function (k) { return db.chapters[k]; });
    lhMsg(p, 'Территория: ' + info.size + '×' + info.size + ' (±' + Math.round(info.size / 2) +
      ' м), закрыто глав=' + info.locked + ', x=' + (Math.round(info.x * 1000) / 1000) +
      '. Завершённые главы: ' + (unlocked.length ? unlocked.join(', ') : 'пока нет') + '.');
    return 1;
  });
  root.then(terr);

  var casino = C.literal('casino');
  casino.then(C.literal('status').executes(function (ctx) {
    var server = ctx.source.server, p = ctx.source.playerOrException;
    var db = lhProgRead(server);
    var active = db.featureOrder.map(function (id) {
      var m = lhHardFeatureMeta(id);
      return m ? (m.icon + ' ' + m.name) : id;
    });
    var locked = lhLockedHardFeatures(server).map(function (m) { return m.icon + ' ' + m.name; });
    lhMsg(p, 'Активные угрозы (' + active.length + '): ' + (active.length ? active.join(', ') : 'нет — всё спокойно!'));
    lhMsg(p, 'Ещё закрыты в Колесе (' + locked.length + '): ' + (locked.length ? locked.join(', ') : 'все открыты'));
    return 1;
  }));
  casino.then(C.literal('spin').requires(function (s) { return s.hasPermission(2); }).executes(function (ctx) {
    var server = ctx.source.server, p = ctx.source.playerOrException;
    var picked = lhCasinoQueueSpin(server, 'Тест оператора', null);
    if (!picked) lhMsg(p, 'Все усложнения уже открыты.');
    else lhMsg(p, 'Запущено Колесо Угроз!');
    return 1;
  }));
  root.then(casino);

  var rules = C.literal('rules');
  rules.then(C.literal('confirm').executes(function (ctx) {
    var server = ctx.source.server, p = ctx.source.playerOrException;
    var db = lhProgRead(server);
    db.rulesConfirmed = true;
    lhProgSave(server);
    lhUnlock(p, 'longhaul:rules/confirmed');
    lhProgressionRecompute(server, p, false);
    lhMsg(p, 'Правила консорциума подтверждены! Глава 01 учтена в прогрессе территории.');
    return 1;
  }));
  root.then(rules);

  var doomed = C.literal('doomed');
  doomed.then(C.literal('status').executes(function (ctx) {
    var p = ctx.source.playerOrException;
    var loaded = typeof Platform !== 'undefined' && Platform.isLoaded && Platform.isLoaded('doomed');
    lhMsg(p, loaded
      ? 'Опциональный мод DOOMED установлен! Включение: /doom, отключение: /doom off. Проверка: /lh doomed verify.'
      : 'Опциональный мод DOOMED не установлен (см. DOOMED.md и optional-mods/README.md). Базовая игра работает без него.');
    return 1;
  }));
  doomed.then(C.literal('verify').executes(function (ctx) {
    var server = ctx.source.server, p = ctx.source.playerOrException;
    var db = lhProgRead(server);
    db.doomedVerified = true;
    lhProgSave(server);
    lhUnlock(p, 'longhaul:doomed/checked');
    var loaded = typeof Platform !== 'undefined' && Platform.isLoaded && Platform.isLoaded('doomed');
    lhMsg(p, loaded
      ? 'DOOMED проверен на сервере: отметка для опциональной главы 13 выдана.'
      : 'DOOMED не установлен в этой сборке; опциональный статус отмечен без блокировки основной игры.');
    return 1;
  }));
  root.then(doomed);

  var nuclear = C.literal('nuclear');
  nuclear.then(C.literal('verify').executes(function (ctx) {
    var server = ctx.source.server, p = ctx.source.playerOrException;
    var db = lhProgRead(server);
    lhScanWorkshopItems(server, p);
    db.nuclearVerified = true;
    lhProgSave(server);
    lhUnlock(p, 'longhaul:nuclear/verified');
    lhProgressionRecompute(server, p, false);
    lhMsg(p, 'Веха ядерной энергетики и Draconic Evolution подтверждена!');
    return 1;
  }));
  root.then(nuclear);

  event.register(root);
});

ServerEvents.loaded(function (event) {
  lhProgRead(event.server);
  lhApplyTerritoryBorder(event.server, false);
  console.info('[LH] Territory scaling + Casino Wheel hard-feature gate loaded.');
});
