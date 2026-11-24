// Long Haul Legacy 2.0: 61-chapter territory expansion (concave area curve 1 - (1 - u/60)^2 from 724 to 175000),
// always-active base ore scarcity + 99 randomized Casino Wheel complications (100 total), global death difficulty k,
// random respawn scatter, random death item loss, and full 62-chapter Heracles completion sync.
var LHBlockPos = Java.loadClass('net.minecraft.core.BlockPos');
var LHDiffArgStr = Java.loadClass('com.mojang.brigadier.arguments.StringArgumentType');
var LHHeraclesProgressHandler = null;
try {
  LHHeraclesProgressHandler = Java.loadClass('earth.terrarium.heracles.common.handlers.progress.QuestProgressHandler');
} catch (eHeraclesCls) {
  LHHeraclesProgressHandler = null;
}
var LHProgState = null;
var LHProgTick = 0;
var LHActiveSpin = null;
var LHSpinQueue = [];
var LHBossbarTimer = 0;
var LHRespawnScatterQueue = [];
var LHLightningWarnings = [];
var LHSporeWarnCooldown = {};

var LH_WORKSHOP_ITEMS = [
  'create:water_wheel', 'create:mechanical_press', 'create:mechanical_mixer',
  'create:brass_ingot', 'create:precision_mechanism', 'create:track',
  'create:track_station', 'computercraft:computer_normal', 'farmersdelight:cooking_pot'
];

var LH_GATE_ORDER = [
  'ch00', 'ch01', 'ch02', 'ch03', 'ch05', 'ch06', 'ch07', 'ch08', 'ch09', 'ch10',
  'ch11', 'ch12', 'ch14', 'ch15', 'ch16', 'ch17', 'ch18', 'ch19', 'ch20', 'ch21',
  'ch22', 'ch23', 'ch24', 'ch25', 'ch26', 'ch27', 'ch28', 'ch29', 'ch30', 'ch31',
  'ch32', 'ch33', 'ch34', 'ch35', 'ch36', 'ch37', 'ch38', 'ch39', 'ch40', 'ch41',
  'ch42', 'ch43', 'ch44', 'ch45', 'ch46', 'ch47', 'ch48', 'ch49', 'ch50', 'ch51',
  'ch52', 'ch53', 'ch54', 'ch55', 'ch56', 'ch57', 'ch58', 'ch59', 'ch60', 'ch61',
  'ch04'
];
var LH_MAIN_CHAPTER_KEYS = [
  'ch00', 'ch01', 'ch02', 'ch03', 'ch04', 'ch05', 'ch06', 'ch07', 'ch08', 'ch09',
  'ch10', 'ch11', 'ch12', 'ch14', 'ch15', 'ch16', 'ch17', 'ch18', 'ch19', 'ch20',
  'ch21', 'ch22', 'ch23', 'ch24', 'ch25', 'ch26', 'ch27', 'ch28', 'ch29', 'ch30',
  'ch31', 'ch32', 'ch33', 'ch34', 'ch35', 'ch36', 'ch37', 'ch38', 'ch39', 'ch40',
  'ch41', 'ch42', 'ch43', 'ch44', 'ch45', 'ch46', 'ch47', 'ch48', 'ch49', 'ch50',
  'ch51', 'ch52', 'ch53', 'ch54', 'ch55', 'ch56', 'ch57', 'ch58', 'ch59', 'ch60',
  'ch61'
];
var LH_EXPANSION_CHAPTER_CODES = [];
for (var _ec = 15; _ec <= 61; _ec++) {
  LH_EXPANSION_CHAPTER_CODES.push(_ec < 10 ? ('0' + _ec) : String(_ec));
}

var LH_CHAPTER_LABELS = {
  ch00: '00 · Сюжет: Ушёл за хлебом',
  ch01: '01 · Начало и правила',
  ch02: '02 · Мастерская и экспедиция',
  ch03: '03 · Контрольные поставки',
  ch04: '04 · Экономические центры',
  ch05: '05 · Маршруты и лагеря',
  ch06: '06 · Восстановление и телеметрия',
  ch07: '07 · Кампания: Основная прогрессия',
  ch08: '08 · Кампания: Региональные контракты',
  ch09: '09 · Кампания: Инженерные испытания',
  ch10: '10 · Кампания: Лагеря и экспедиции',
  ch11: '11 · Ядерная энергетика и Драконик',
  ch12: '12 · OpenTTD: Компании и Империя',
  ch13: '13 · Фотодокументация (Опционально)',
  ch14: '14 · DOOMED: Хардкор-выживание',
  ch15: '15 · Выживание: Стартовые ремёсла',
  ch16: '16 · Выживание: Инструменты, Незер и Энд',
  ch17: '17 · Вооружение: Tetra и Кузница',
  ch18: '18 · Арсенал: Simply Swords и Артефакты',
  ch19: '19 · Create: Кинетика и Механизмы',
  ch20: '20 · Create: Поезда и Автоматика',
  ch21: '21 · Create: Конструкции и Декор',
  ch22: '22 · Create Addons: Энергия и Чар-магия',
  ch23: '23 · Immersive Engineering: Сталь и Многоблоки',
  ch24: '24 · Immersive Engineering: Конструкции и Арсенал',
  ch25: '25 · PneumaticCraft: Давление и Компрессоры',
  ch26: '26 · Логистика: Modular Routers и SFM',
  ch27: '27 · Логика: Integrated Dynamics',
  ch28: '28 · Railcraft Reborn: Ж/Д Магистрали',
  ch29: '29 · Little Logistics и Автотранспорт',
  ch30: '30 · Флот: Small Ships и Valkyrien Skies',
  ch31: '31 · Авиация: Immersive Aircraft',
  ch32: '32 · Вычислительная сеть: CC: Tweaked',
  ch33: '33 · Склады и Печи: Functional & Iron Furnaces',
  ch34: '34 · Extreme Reactors: Энергоблоки',
  ch35: '35 · NuclearCraft: Топливо и Изотопы',
  ch36: '36 · NuclearCraft: Реакторы и Электродинамика',
  ch37: '37 · Draconic Evolution: Поздняя энергетика',
  ch38: '38 · Farmer\'s Delight: Полевая кухня',
  ch39: '39 · Farmer\'s Delight: Праздничные столы и Кухня',
  ch40: '40 · Виноделие и Сыроварня: Vinery & Brewin',
  ch41: '41 · Aquaculture 2: Рыболовство и Снасти',
  ch42: '42 · Productive Bees: Промышленная пасека',
  ch43: '43 · Primal Magick: Стихии и Теория',
  ch44: '44 · Primal Magick: Жезлы и Алхимия',
  ch45: '45 · Primal Magick: Ритуалы и Тауматургия',
  ch46: '46 · Hex Casting: Стековая магия',
  ch47: '47 · Биомы мира: Biomes O\' Plenty (Породы)',
  ch48: '48 · Биомы мира: Biomes O\' Plenty (Флора)',
  ch49: '49 · Alex\'s Caves: Магнитные, Дино и Токсик',
  ch50: '50 · Alex\'s Caves: Бездна, Забвение и Сладости',
  ch51: '51 · Фауна мира: Alex\'s Mobs',
  ch52: '52 · Боссы: Cataclysm и Aquamirae',
  ch53: '53 · Архитектура: FramedBlocks (Каркасы)',
  ch54: '54 · Архитектура: FramedBlocks (Детали)',
  ch55: '55 · Архитектура: Chipped (Отделка)',
  ch56: '56 · Механика и Декор: Quark (Блоки)',
  ch57: '57 · Механика и Декор: Quark (Детали и Трофеи)',
  ch58: '58 · Промышленные Тиры I–IV: Масштабирование',
  ch59: '59 · Логистика Консорциума: Массовые поставки',
  ch60: '60 · Опасности и Среда: Выживание в кризисах',
  ch61: '61 · Великий Синтез: Абсолютное мастерство'
};

function lhEnsureBaseHardFeatures(db) {
  if (!db) return;
  if (!db.hardFeatures) db.hardFeatures = {};
  if (!db.featureOrder) db.featureOrder = [];
  var pool = global.LHHardFeatureCatalog || [];
  for (var i = 0; i < pool.length; i++) {
    if (pool[i].isBase) {
      var fid = pool[i].id;
      db.hardFeatures[fid] = true;
      if (db.featureOrder.indexOf(fid) === -1) {
        db.featureOrder.unshift(fid);
      }
    }
  }
}

function lhProgRead(server) {
  if (LHProgState !== null) {
    lhEnsureBaseHardFeatures(LHProgState);
    return LHProgState;
  }
  var raw = server.persistentData.getString('longhaul_progression_v1');
  LHProgState = raw ? JSON.parse(String(raw)) : {
    schemaVersion: 2,
    chapters: {},
    hardFeatures: {},
    featureOrder: [],
    workshopItems: {},
    deathsByPlayer: {},
    playerForks: {},
    chaptersByPlayer: {},
    playerHomeSpawns: {},
    firstJoinDone: {},
    targetAvgDeaths: 275.15,
    rulesConfirmed: false,
    nuclearVerified: false,
    doomedVerified: false,
    lastBorderSize: 0
  };
  if (!LHProgState.chapters) LHProgState.chapters = {};
  if (!LHProgState.hardFeatures) LHProgState.hardFeatures = {};
  if (!LHProgState.featureOrder) LHProgState.featureOrder = [];
  if (!LHProgState.workshopItems) LHProgState.workshopItems = {};
  if (!LHProgState.deathsByPlayer) LHProgState.deathsByPlayer = {};
  if (!LHProgState.playerForks) LHProgState.playerForks = {};
  if (!LHProgState.chaptersByPlayer) LHProgState.chaptersByPlayer = {};
  if (!LHProgState.playerHomeSpawns) LHProgState.playerHomeSpawns = {};
  if (!LHProgState.firstJoinDone) LHProgState.firstJoinDone = {};
  if ((LHProgState.schemaVersion || 1) < 2) {
    if (!(LHProgState.targetAvgDeaths > 0) || Math.abs(LHProgState.targetAvgDeaths - 63.15) < 0.01) {
      LHProgState.targetAvgDeaths = 275.15;
    }
    LHProgState.schemaVersion = 2;
  }
  if (!(LHProgState.targetAvgDeaths > 0)) LHProgState.targetAvgDeaths = 275.15;
  lhEnsureBaseHardFeatures(LHProgState);
  return LHProgState;
}

function lhProgSave(server) {
  if (LHProgState !== null) {
    server.persistentData.putString('longhaul_progression_v1', JSON.stringify(LHProgState));
  }
}

function lhRecordPlayerDeath(server, player) {
  if (!server || !player) return 0;
  var db = lhProgRead(server);
  var pid = lhId(player);
  db.deathsByPlayer[pid] = (db.deathsByPlayer[pid] || 0) + 1;
  lhProgSave(server);
  return db.deathsByPlayer[pid];
}

function lhDifficultyStatus(server, overridePlayers) {
  var db = lhProgRead(server);
  var plist = overridePlayers || (server ? server.players : null) || [];
  var onlineCount = plist.length || 0;
  var onlineDeaths = 0;
  for (var i = 0; i < onlineCount; i++) {
    var pid = lhId(plist[i]);
    onlineDeaths += (db.deathsByPlayer[pid] || 0);
  }
  var target = Number(db.targetAvgDeaths || global.LHDifficultyMath.TARGET_AVG_DEATHS);
  var coeff = global.LHDifficultyMath.compute(onlineDeaths, onlineCount, target);
  var respawnRadius = global.LHDifficultyMath.randomRespawnRadius(coeff);
  var voidoutPower = global.LHVoidoutMath.computePower(coeff).raw;
  return {
    onlineDeaths: onlineDeaths,
    onlinePlayers: onlineCount,
    targetAvgDeaths: target,
    coeff: coeff,
    respawnRadius: respawnRadius,
    voidoutPower: voidoutPower
  };
}

function lhActiveBorderHalf(server) {
  var ow = server ? server.getLevel('minecraft:overworld') : null;
  var borderSize = (ow && ow.worldBorder && Number(ow.worldBorder.size) > 0)
    ? Number(ow.worldBorder.size)
    : Number(lhTerritoryCounts(server).size || 724);
  return Math.max(32, Math.floor(borderSize / 2));
}

function lhClampToSafeBorder(server, x, z, margin) {
  var half = lhActiveBorderHalf(server);
  var safeHalf = Math.max(16, half - Number(margin || 20));
  return {
    x: Math.max(-safeHalf, Math.min(safeHalf, Math.round(Number(x || 0)))),
    z: Math.max(-safeHalf, Math.min(safeHalf, Math.round(Number(z || 0)))),
    halfBorder: half,
    safeHalf: safeHalf
  };
}

function lhGetPlayerSpawnCenter(server, player) {
  var half = lhActiveBorderHalf(server);
  var safeMargin = Math.max(16, half - 16);
  try {
    if (player && typeof player.getRespawnPosition === 'function') {
      var rPos = player.getRespawnPosition();
      var rDim = typeof player.getRespawnDimension === 'function' ? player.getRespawnDimension() : null;
      var dimStr = rDim && typeof rDim.location === 'function' ? String(rDim.location()) : String(rDim || 'minecraft:overworld');
      if (rPos && dimStr === 'minecraft:overworld' &&
          Math.abs(Number(rPos.x)) <= safeMargin && Math.abs(Number(rPos.z)) <= safeMargin) {
        return { x: Number(rPos.x), z: Number(rPos.z) };
      }
    }
  } catch (eR) {}
  try {
    var dbHome = lhProgRead(server);
    var pidHome = player ? lhId(player) : null;
    if (pidHome && dbHome.playerHomeSpawns && dbHome.playerHomeSpawns[pidHome]) {
      var hx = Number(dbHome.playerHomeSpawns[pidHome].x);
      var hz = Number(dbHome.playerHomeSpawns[pidHome].z);
      if (Math.abs(hx) <= safeMargin && Math.abs(hz) <= safeMargin) {
        return { x: hx, z: hz };
      }
    }
  } catch (eH) {}
  try {
    var ow = server.getLevel('minecraft:overworld');
    if (ow && typeof ow.getSharedSpawnPos === 'function') {
      var sp = ow.getSharedSpawnPos();
      if (sp && Math.abs(Number(sp.x)) <= safeMargin && Math.abs(Number(sp.z)) <= safeMargin) {
        return { x: Number(sp.x), z: Number(sp.z) };
      }
    }
  } catch (eS) {}
  return { x: 0, z: 0 };
}

function lhComputeRandomRespawnTarget(server, centerX, centerZ, coeff, rngA, rngB) {
  var radius = global.LHDifficultyMath.randomRespawnRadius(coeff);
  var ow = server ? server.getLevel('minecraft:overworld') : null;
  var borderSize = (ow && ow.worldBorder && Number(ow.worldBorder.size) > 0) ? Number(ow.worldBorder.size) : 724;
  var halfBorder = Math.max(16, Math.floor(borderSize / 2) - 8);
  var a = typeof rngA === 'number' ? rngA : Math.random();
  var b = typeof rngB === 'number' ? rngB : Math.random();
  var theta = a * 6.283185307179586;
  var dist = radius * Math.sqrt(Math.max(0, Math.min(1, b)));
  var tx = Math.round(Number(centerX || 0) + Math.cos(theta) * dist);
  var tz = Math.round(Number(centerZ || 0) + Math.sin(theta) * dist);
  if (tx > halfBorder) tx = halfBorder;
  if (tx < -halfBorder) tx = -halfBorder;
  if (tz > halfBorder) tz = halfBorder;
  if (tz < -halfBorder) tz = -halfBorder;
  return {
    radius: radius,
    x: tx,
    z: tz,
    centerX: Math.round(Number(centerX || 0)),
    centerZ: Math.round(Number(centerZ || 0)),
    halfBorder: halfBorder
  };
}

function lhIsPassableSpawnSpace(bid) {
  return bid === 'minecraft:air' || bid === 'minecraft:cave_air' || bid === 'minecraft:void_air' ||
    bid === 'minecraft:snow' || bid.indexOf('grass') !== -1 || bid.indexOf('flower') !== -1 || bid === 'minecraft:vine';
}

function lhFindSafeRespawnY(overworld, tx, tz, allowPlatform) {
  try {
    overworld.getChunk(tx >> 4, tz >> 4);
  } catch (eChk) {}
  var startY = 240;
  try {
    if (typeof overworld.getHeight === 'function') {
      var hm = Number(overworld.getHeight('motion_blocking_no_leaves', tx, tz));
      if (hm >= 48 && hm <= 430) startY = Math.min(435, hm + 4);
    }
  } catch (eHm) {}
  for (var y = startY; y >= 48; y--) {
    var b = overworld.getBlock(tx, y, tz);
    var bid = String(b.id);
    if (bid === 'minecraft:air' || bid === 'minecraft:cave_air' || bid === 'minecraft:void_air' ||
        bid === 'minecraft:bedrock' || bid === 'minecraft:water' || bid === 'minecraft:lava' ||
        bid.indexOf('leaves') !== -1 || bid.indexOf('grass') !== -1 || bid.indexOf('flower') !== -1 ||
        bid === 'minecraft:snow' || bid === 'minecraft:vine') {
      continue;
    }
    var above1 = String(overworld.getBlock(tx, y + 1, tz).id);
    var above2 = String(overworld.getBlock(tx, y + 2, tz).id);
    if (lhIsPassableSpawnSpace(above1) && lhIsPassableSpawnSpace(above2)) {
      return y + 1;
    }
  }
  if (allowPlatform === false) return -1;
  for (var dx = -1; dx <= 1; dx++) {
    for (var dz = -1; dz <= 1; dz++) {
      overworld.getBlock(tx + dx, 80, tz + dz).set('minecraft:cobblestone');
      overworld.getBlock(tx + dx, 81, tz + dz).set('minecraft:air');
      overworld.getBlock(tx + dx, 82, tz + dz).set('minecraft:air');
    }
  }
  return 81;
}

function lhFindSafeSurfaceColumn(overworld, cx, cz) {
  var directY = lhFindSafeRespawnY(overworld, cx, cz, false);
  if (directY > 0) return { x: cx, y: directY, z: cz };
  var radii = [4, 12, 24];
  for (var ri = 0; ri < radii.length; ri++) {
    var rad = radii[ri];
    for (var step = 0; step < 6; step++) {
      var ang = (step / 6.0) * 6.2831853;
      var sx = Math.round(cx + Math.cos(ang) * rad);
      var sz = Math.round(cz + Math.sin(ang) * rad);
      var sy = lhFindSafeRespawnY(overworld, sx, sz, false);
      if (sy > 0) return { x: sx, y: sy, z: sz };
    }
  }
  return { x: cx, y: lhFindSafeRespawnY(overworld, cx, cz, true), z: cz };
}

function lhIsPlayerTrappedOrBedrock(overworld, px, py, pz, halfBorder) {
  var ix = Math.floor(px), iy = Math.floor(py), iz = Math.floor(pz);
  if (iy <= -58) return true;
  if (halfBorder > 0 && (Math.abs(ix) >= halfBorder - 1 || Math.abs(iz) >= halfBorder - 1)) return true;
  try {
    var below = String(overworld.getBlock(ix, iy - 1, iz).id);
    var feetBlock = overworld.getBlock(ix, iy, iz);
    var headBlock = overworld.getBlock(ix, iy + 1, iz);
    var feet = String(feetBlock.id);
    var head = String(headBlock.id);
    if (below === 'minecraft:bedrock' || feet === 'minecraft:bedrock' || head === 'minecraft:bedrock') return true;
    var feetSolid = feet === 'minecraft:stone' || feet === 'minecraft:deepslate' || feet === 'minecraft:dirt' || feet === 'minecraft:netherrack';
    var headSolid = head === 'minecraft:stone' || head === 'minecraft:deepslate' || head === 'minecraft:dirt' || head === 'minecraft:netherrack';
    if (feetSolid && headSolid) return true;
  } catch (eTrap) {}
  return false;
}

function lhEnsureSafeSpawn(server, player, fixWorldSpawn) {
  if (!server || !player || !player.level) return false;
  if (String(player.level.dimension) !== 'minecraft:overworld') return false;
  var creative = (typeof player.isCreative === 'function' && player.isCreative()) ||
    (typeof player.isSpectator === 'function' && player.isSpectator());
  if (creative) return false;
  var ow = server.getLevel('minecraft:overworld');
  if (!ow) return false;
  var halfBorder = lhActiveBorderHalf(server);
  var px = Number(player.x), py = Number(player.y), pz = Number(player.z);
  var outOfBorder = Math.abs(px) >= halfBorder - 1 || Math.abs(pz) >= halfBorder - 1;
  if (!outOfBorder && !lhIsPlayerTrappedOrBedrock(ow, px, py, pz, halfBorder)) return false;

  var targetCenter = lhClampToSafeBorder(server, px, pz, 24);
  if (outOfBorder) {
    var homeCenter = lhGetPlayerSpawnCenter(server, player);
    if (Math.abs(homeCenter.x) <= targetCenter.safeHalf && Math.abs(homeCenter.z) <= targetCenter.safeHalf) {
      targetCenter = { x: Math.round(homeCenter.x), z: Math.round(homeCenter.z), halfBorder: halfBorder, safeHalf: targetCenter.safeHalf };
    }
  }
  var safe = lhFindSafeSurfaceColumn(ow, targetCenter.x, targetCenter.z);
  var uname = player.username || (typeof player.getName === 'function' ? player.getName().getString() : '');
  if (uname) {
    server.runCommandSilent('execute in minecraft:overworld run tp ' + uname + ' ' + (safe.x + 0.5) + ' ' + safe.y + ' ' + (safe.z + 0.5));
    server.runCommandSilent('effect give ' + uname + ' minecraft:resistance 8 4 true');
    if (outOfBorder) {
      server.runCommandSilent('spawnpoint ' + uname + ' ' + safe.x + ' ' + safe.y + ' ' + safe.z);
      var dbFix = lhProgRead(server);
      var pidFix = lhId(player);
      var scFix = global.LHOpenTTD ? global.LHOpenTTD.sectorCoords(safe.x, safe.z) : { sx: 0, sz: 0 };
      dbFix.playerHomeSpawns[pidFix] = { x: safe.x, y: safe.y, z: safe.z, sx: scFix.sx, sz: scFix.sz };
      lhProgSave(server);
    }
  }
  if (typeof player.tell === 'function') {
    player.tell(outOfBorder
      ? ('§e[Безопасный спаун] Вы оказались за границей мира (±' + halfBorder + ' м) — возвращены в безопасную зону (' + safe.x + ', ' + safe.y + ', ' + safe.z + ').')
      : ('§e[Безопасный спаун] Обнаружен спаун в бэдроке/породе (Y=' + Math.round(py) + ') — вы перемещены на поверхность (' + safe.x + ', ' + safe.y + ', ' + safe.z + ').'));
  }
  return true;
}

function lhFirstJoinRandomSpawn(server, player) {
  if (!server || !player) return false;
  var db = lhProgRead(server);
  var pid = lhId(player);
  if (db.firstJoinDone[pid]) return false;

  var creative = (typeof player.isCreative === 'function' && player.isCreative()) ||
    (typeof player.isSpectator === 'function' && player.isSpectator());
  var ow = server.getLevel('minecraft:overworld');
  if (!ow) return false;

  var borderInfo = lhTerritoryCounts(server);
  var halfBorder = Math.max(48, Math.floor(borderInfo.size / 2));
  var safeHalf = Math.max(32, halfBorder - Math.min(36, Math.floor(halfBorder / 6)));
  var ottdSt = typeof lhOttdRead === 'function' ? lhOttdRead(server) : null;

  var chosen = null;
  for (var attempt = 0; attempt < 3; attempt++) {
    var wx = 0, wz = 0;
    if (safeHalf < 560) {
      // Initial 724x724 border (±362): pick inside the claimable L-strip [-safeHalf, -264]
      // which is strictly inside the world border AND outside the 3x3 spawn sanctuary (-256..511).
      if (attempt % 2 === 0) {
        wx = -270 - Math.floor(Math.random() * Math.max(8, safeHalf - 270));
        wz = Math.floor((Math.random() * 2 - 1) * (safeHalf - 16));
      } else {
        wz = -270 - Math.floor(Math.random() * Math.max(8, safeHalf - 270));
        wx = Math.floor((Math.random() * 2 - 1) * (safeHalf - 16));
      }
    } else {
      wx = Math.floor((Math.random() * 2 - 1) * safeHalf);
      wz = Math.floor((Math.random() * 2 - 1) * safeHalf);
    }
    wx = Math.max(-safeHalf, Math.min(safeHalf, wx));
    wz = Math.max(-safeHalf, Math.min(safeHalf, wz));
    var cSc = global.LHOpenTTD ? global.LHOpenTTD.sectorCoords(wx, wz) : { sx: Math.floor(wx / 256), sz: Math.floor(wz / 256) };
    if (ottdSt && global.LHOpenTTD) {
      var ownerInfo = global.LHOpenTTD.resolveSectorOwner(ottdSt, cSc.sx, cSc.sz);
      if (ownerInfo.kind === 'claimed') continue;
    }
    var sy = lhFindSafeRespawnY(ow, wx, wz, attempt === 2);
    if (sy > 52) {
      chosen = { x: wx, y: sy, z: wz, sx: cSc.sx, sz: cSc.sz };
      break;
    }
  }
  if (!chosen) {
    // Guaranteed inside-border fallback inside sector (-2, 0) -> x=-288, z=0
    var fWx = Math.max(-safeHalf, Math.min(safeHalf, -288));
    var fWz = 0;
    var fY = lhFindSafeRespawnY(ow, fWx, fWz, true);
    var fSc = global.LHOpenTTD ? global.LHOpenTTD.sectorCoords(fWx, fWz) : { sx: -2, sz: 0 };
    chosen = { x: fWx, y: fY, z: fWz, sx: fSc.sx, sz: fSc.sz };
  }
  chosen.x = Math.max(-safeHalf, Math.min(safeHalf, chosen.x));
  chosen.z = Math.max(-safeHalf, Math.min(safeHalf, chosen.z));

  db.firstJoinDone[pid] = true;
  db.playerHomeSpawns[pid] = chosen;
  lhProgSave(server);

  if (!creative) {
    // Place company terminal barrel directly beneath player's landing tile
    try {
      var termY = chosen.y - 1;
      var termBlock = ow.getBlock(chosen.x, termY, chosen.z);
      termBlock.set('minecraft:barrel');
      ow.getBlock(chosen.x, termY + 1, chosen.z).set('minecraft:air');
      ow.getBlock(chosen.x, termY + 2, chosen.z).set('minecraft:air');
    } catch (eBar) {}

    if (typeof lhRegisterTerminalForPlayer === 'function') {
      lhRegisterTerminalForPlayer(server, player, chosen.x, chosen.y - 1, chosen.z, 'minecraft:overworld');
    } else if (typeof lhProfile === 'function' && typeof lhSave === 'function') {
      var cProf = lhProfile(server, player);
      if (cProf && !cProf.terminal) {
        cProf.terminal = { dim: 'minecraft:overworld', x: chosen.x, y: chosen.y - 1, z: chosen.z };
        lhSave(server);
        if (typeof lhUnlock === 'function') lhUnlock(player, 'longhaul:story/03_dinner_telegram');
      }
    }
    if (typeof lhAutoCreateCompanyAtSpawn === 'function') {
      lhAutoCreateCompanyAtSpawn(server, player, chosen.x, chosen.z);
    }

    var uname = player.username || (typeof player.getName === 'function' ? player.getName().getString() : '');
    if (uname) {
      server.runCommandSilent('execute in minecraft:overworld run tp ' + uname + ' ' + (chosen.x + 0.5) + ' ' + chosen.y + ' ' + (chosen.z + 0.5));
      server.runCommandSilent('spawnpoint ' + uname + ' ' + chosen.x + ' ' + chosen.y + ' ' + chosen.z);
      server.runCommandSilent('effect give ' + uname + ' minecraft:resistance 8 4 true');
    }
    lhMsg(player, '§a§l[Высадка компании] §fВы высажены на свободный участок §b(' + chosen.x + ', ' + chosen.y + ', ' + chosen.z +
      ') §7в секторе (' + chosen.sx + ',' + chosen.sz + '). Прямо под вами установлен §eТерминал компании§7, а сектор закреплён как ваша штаб-квартира!');
  }
  return true;
}

function lhApplyDeathItemLoss(server, player, coeff, dryRun) {
  if (!player || !player.inventory) return { lostStacks: 0, lostItems: 0, fraction: 0, names: [] };
  var inv = player.inventory;
  var candidates = [];
  for (var s = 0; s < inv.slots; s++) {
    var st = inv.getStackInSlot(s);
    if (!st || st.empty) continue;
    var sid = String(st.id);
    if (sid === 'heracles:quest_book' || sid === 'eccentrictome:tome') continue;
    candidates.push({ slot: s, id: sid, count: Number(st.count || 1) });
  }
  if (!candidates.length) return { lostStacks: 0, lostItems: 0, fraction: 0, names: [] };

  var k = Number(coeff || 1.0);
  if (!(k >= 1.0)) k = 1.0;
  var frac = 0.15 + 0.35 * Math.min(1.0, Math.max(0.0, (k - 1.0) / 95.0));
  var toDelete = Math.min(candidates.length, Math.max(1, Math.round(candidates.length * frac)));

  for (var i = candidates.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = candidates[i];
    candidates[i] = candidates[j];
    candidates[j] = tmp;
  }

  var lostItems = 0;
  var names = [];
  for (var d = 0; d < toDelete; d++) {
    var c = candidates[d];
    lostItems += c.count;
    names.push(c.id.split(':')[1] + '×' + c.count);
    try {
      if (typeof inv.setStackInSlot === 'function' && typeof Item !== 'undefined') {
        inv.setStackInSlot(c.slot, Item.empty);
      } else if (typeof inv.extractItem === 'function') {
        inv.extractItem(c.slot, c.count, false);
      }
    } catch (eDel) {
      if (typeof inv.extractItem === 'function') {
        try { inv.extractItem(c.slot, c.count, false); } catch (eDel2) {}
      }
    }
  }
  if (!dryRun && typeof player.tell === 'function' && toDelete > 0) {
    player.tell('§c[Распад инвентаря] При смерти безвозвратно уничтожено слотов: §f' + toDelete +
      ' §7(' + names.slice(0, 6).join(', ') + (names.length > 6 ? '…' : '') + ').');
  }
  return { lostStacks: toDelete, lostItems: lostItems, fraction: Math.round(frac * 100) / 100, names: names };
}

function lhHardIsActive(server, featureId) {
  var meta = lhHardFeatureMeta(featureId);
  if (meta && meta.isBase) return true;
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

function lhChapterProgressSummary(server) {
  var db = lhProgRead(server);
  var doneMain = 0;
  var firstOpenKey = LH_MAIN_CHAPTER_KEYS[LH_MAIN_CHAPTER_KEYS.length - 1];
  for (var i = 0; i < LH_MAIN_CHAPTER_KEYS.length; i++) {
    var ck = LH_MAIN_CHAPTER_KEYS[i];
    if (db.chapters[ck]) {
      doneMain++;
    } else if (firstOpenKey === LH_MAIN_CHAPTER_KEYS[LH_MAIN_CHAPTER_KEYS.length - 1] && !db.chapters[ck]) {
      firstOpenKey = ck;
    }
  }
  return {
    doneMain: doneMain,
    totalMain: LH_MAIN_CHAPTER_KEYS.length,
    currentKey: firstOpenKey,
    currentLabel: LH_CHAPTER_LABELS[firstOpenKey] || firstOpenKey
  };
}

function lhCountEffectiveMainForMap(chMap) {
  var totalMain = LH_MAIN_CHAPTER_KEYS.length; // 61
  var map = chMap || {};
  var otherMainUnlocked = 0;
  LH_MAIN_CHAPTER_KEYS.forEach(function (cid) {
    if (cid !== 'ch04' && map[cid]) otherMainUnlocked++;
  });
  return map.ch04
    ? Math.min(totalMain, otherMainUnlocked + 1)
    : Math.min(totalMain - 1, otherMainUnlocked);
}

function lhTerritoryCounts(server) {
  var db = lhProgRead(server);
  // Photo chapter (ch13) remains strictly optional and never affects border progression;
  // world border expands strictly according to the HIGHEST count of main chapters
  // completed by any SINGLE player (never pooled across multiple players).
  var totalMain = LH_MAIN_CHAPTER_KEYS.length; // 61
  var byPlayer = db.chaptersByPlayer || {};
  var playerIds = Object.keys(byPlayer);
  var effectiveUnlocked = 0;

  if (playerIds.length > 0) {
    for (var i = 0; i < playerIds.length; i++) {
      var cnt = lhCountEffectiveMainForMap(byPlayer[playerIds[i]]);
      if (cnt > effectiveUnlocked) effectiveUnlocked = cnt;
    }
    // Include explicit operator /lh chapter unlock overrides only if higher
    if (db.adminChapters) {
      var adminCnt = lhCountEffectiveMainForMap(db.adminChapters);
      if (adminCnt > effectiveUnlocked) effectiveUnlocked = adminCnt;
    }
  } else {
    effectiveUnlocked = lhCountEffectiveMainForMap(db.chapters);
  }
  return global.LHTerritoryMath.computeBorder(totalMain, effectiveUnlocked);
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

  if (prev > 0 && info.size > prev) {
    if (typeof lhSpawnBotOnBorderExpansion === 'function') {
      lhSpawnBotOnBorderExpansion(server, info, !!announce);
    }
    if (typeof lhSyncXaeroTerritories === 'function') {
      lhSyncXaeroTerritories(server, null);
    }
    if (announce) {
      var half = Math.round(info.size / 2);
      var msgB = 'Территория расширена до ' + info.size + '×' + info.size + ' (±' + half + ' м, этапы расширения: ' + info.unlocked + '/' + info.total + ').';
      if (typeof lhLogEvent === 'function') {
        lhLogEvent(server, 'territory', msgB, { chatMode: 'important' });
      } else if (server.players) {
        for (var i = 0; i < server.players.length; i++) {
          server.players[i].tell('§b§l[Граница мира] §a' + msgB);
        }
      }
    }
  }
  return info;
}

function lhLockedHardFeatures(server) {
  var db = lhProgRead(server);
  var pool = global.LHHardFeatureCatalog || [];
  var pending = {};
  if (LHActiveSpin && LHActiveSpin.winnerId) pending[LHActiveSpin.winnerId] = true;
  for (var q = 0; q < LHSpinQueue.length; q++) {
    if (LHSpinQueue[q] && LHSpinQueue[q].winnerId) pending[LHSpinQueue[q].winnerId] = true;
  }
  var out = [];
  for (var i = 0; i < pool.length; i++) {
    var fid = pool[i].id;
    if (!pool[i].isBase && !db.hardFeatures[fid] && !pending[fid]) out.push(pool[i]);
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
    if (typeof lhLogEvent === 'function') {
      lhLogEvent(server, 'hazard', 'Колесо Угроз (' + (reasonLabel || 'Глава') + '): выпало «' + winner.name + '» — ' + winner.summary, { chatMode: 'important' });
    }
    var plist = server.players;
    if (plist) {
      for (var j = 0; j < plist.length; j++) {
        if (typeof lhLogEvent !== 'function') {
          plist[j].tell('§6§l[Колесо Угроз · ' + (reasonLabel || 'Глава') + '] §cВыпало усложнение: §f' +
            winner.icon + ' ' + winner.name + ' §7— ' + winner.summary);
        }
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

function lhChapterForkStatus(server, player, dryRun) {
  var db = lhProgRead(server);
  if (!player || !global.LHChapterFork) return null;
  var pid = lhId(player);
  var pState = global.LHChapterFork.ensurePlayerState(db.playerForks[pid]);
  db.playerForks[pid] = pState;
  var mandatoryDone = global.LHChapterFork.isMandatoryDone(db.chapters);
  var hadOffers = (pState.offers || []).length;
  var roll = null;
  if (mandatoryDone) {
    if (!dryRun && typeof lhUnlock === 'function') {
      lhUnlock(player, 'longhaul:tier/mandatory_done');
    }
    if (!pState.activePick || db.chapters[pState.activePick]) {
      roll = global.LHChapterFork.rollThreeChoices(pState, db.chapters);
    }
  }
  if (!dryRun && typeof lhUnlock === 'function') {
    for (var i = 0; i < pState.unlocked.length; i++) {
      var cid = pState.unlocked[i];
      if (global.LHChapterFork.MANDATORY_CHAPTERS.indexOf(cid) === -1) {
        lhUnlock(player, 'longhaul:chapters/' + cid + '_unlocked');
      }
    }
  }
  lhProgSave(server);
  if (!dryRun && mandatoryDone && hadOffers === 0 && pState.offers && pState.offers.length > 0 && typeof player.tell === 'function') {
    var names = pState.offers.map(function (c) { return LH_CHAPTER_LABELS[c] || c; });
    player.tell('§6§l[Вилка глав · ' + global.LHChapterFork.getTierLabel(global.LHChapterFork.currentEligibleTier(pState, db.chapters)) + '] §fДоступны 3 случайные главы: §e' + names.join(' §7| §e') + ' §7(/lh gui chapters)');
  }
  return {
    mandatoryDone: mandatoryDone,
    tier: global.LHChapterFork.currentEligibleTier(pState, db.chapters),
    tierLabel: global.LHChapterFork.getTierLabel(global.LHChapterFork.currentEligibleTier(pState, db.chapters)),
    unlocked: pState.unlocked.slice(),
    activePick: pState.activePick,
    offers: (pState.offers || []).slice(),
    roll: roll
  };
}

function lhChapterForkPick(server, player, chId, dryRun) {
  var db = lhProgRead(server);
  if (!player || !global.LHChapterFork) return { ok: false, reason: 'no_engine' };
  var pid = lhId(player);
  var pState = global.LHChapterFork.ensurePlayerState(db.playerForks[pid]);
  db.playerForks[pid] = pState;
  var res = global.LHChapterFork.pickChapterFromOffer(pState, chId, db.chapters);
  if (!res.ok) {
    if (!dryRun) {
      if (res.reason === 'mandatory_incomplete') {
        lhMsg(player, '§cСначала завершите обязательные стартовые главы: 00 (Сюжет), 01 (Правила) и 02 (Мастерская).');
      } else if (res.reason === 'active_chapter_pending') {
        lhMsg(player, '§eСначала завершите текущую выбранную главу: ' + (LH_CHAPTER_LABELS[res.activePick] || res.activePick) + '.');
      } else {
        lhMsg(player, '§cГлава ' + chId + ' не входит в вашу текущую вилку из 3 глав (' + (res.offers || []).join(', ') + ').');
      }
    }
    return res;
  }
  lhProgSave(server);
  if (!dryRun && typeof lhUnlock === 'function') {
    lhUnlock(player, 'longhaul:chapters/' + chId + '_unlocked');
    if (typeof lhLogEvent === 'function') {
      lhLogEvent(server, 'chapter', (player.username || 'Игрок') + ' выбрал главу из вилки 3: ' + (LH_CHAPTER_LABELS[chId] || chId), { chatMode: 'never' });
    }
    lhMsg(player, '§a[Вилка глав] Открыта глава: §f' + (LH_CHAPTER_LABELS[chId] || chId) + ' §7[' + global.LHChapterFork.getTierLabel(res.tier) + '].');
  }
  return res;
}

function lhMarkPlayerChapter(db, pid, chapterId) {
  if (!db || !pid || !chapterId) return;
  if (!db.chaptersByPlayer) db.chaptersByPlayer = {};
  if (!db.chaptersByPlayer[pid]) db.chaptersByPlayer[pid] = {};
  db.chaptersByPlayer[pid][chapterId] = true;
}

function lhUnlockChapter(server, chapterId, triggerSpin, dryRun, playerOrPid) {
  var db = lhProgRead(server);
  var pid = null;
  if (playerOrPid) {
    pid = typeof playerOrPid === 'string' ? playerOrPid : lhId(playerOrPid);
    lhMarkPlayerChapter(db, pid, chapterId);
  } else {
    if (!db.adminChapters) db.adminChapters = {};
    db.adminChapters[chapterId] = true;
  }
  if (db.chapters[chapterId]) {
    lhProgSave(server);
    lhApplyTerritoryBorder(server, !dryRun);
    return false;
  }
  db.chapters[chapterId] = true;
  if (global.LHChapterFork && db.playerForks) {
    Object.keys(db.playerForks).forEach(function (fpid) {
      global.LHChapterFork.onChapterCompleted(db.playerForks[fpid], chapterId, db.chapters);
    });
  }
  lhProgSave(server);

  var label = LH_CHAPTER_LABELS[chapterId] || chapterId;
  if (!dryRun) {
    if (typeof lhLogEvent === 'function') {
      lhLogEvent(server, 'chapter', 'Глава завершена: ' + label + ' -> расширяем границу и крутим Колесо Угроз!', { chatMode: 'important' });
    } else if (server.players) {
      for (var i = 0; i < server.players.length; i++) {
        server.players[i].tell('§a§l[Глава завершена] §f' + label + ' §7-> расширяем территорию и крутим Колесо Угроз!');
      }
    }
    if (server.players) {
      for (var j = 0; j < server.players.length; j++) {
        lhChapterForkStatus(server, server.players[j], false);
      }
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

  // ch00: Chapter 00 (Story prologue; 03_dinner_telegram moved to Chapter 01)
  if (player && typeof player.isAdvancementDone === 'function') {
    var storyOk = [
      'longhaul:story/01_left_for_bread',
      'longhaul:story/02_bakery_burned',
      'longhaul:story/04_snail_at_door',
      'longhaul:story/05_continental_bakery',
      'longhaul:story/06_forgot_the_milk'
    ].every(function (a) { return player.isAdvancementDone(a); });
    if (storyOk) lhUnlockChapter(server, 'ch00', true, dryRun, player);
  }

  // ch01: Rules & Start (auto-completes once rules confirmed OR ch00 done + terminal placed)
  if (db.rulesConfirmed || (db.chapters.ch00 && hasTerminal)) {
    lhUnlockChapter(server, 'ch01', true, dryRun, player);
  }

  // ch02: Workshop & Expedition (>= 6 of 9 core industrial milestone items obtained)
  if (Object.keys(db.workshopItems || {}).length >= 6) {
    lhUnlockChapter(server, 'ch02', true, dryRun, player);
  }

  // ch03: Home Contracts (all 5 core + 3 shift contracts, or >= 6 contracts completed)
  var receiptCount = Object.keys(allReceipts).length;
  if (receiptCount >= 6) {
    lhUnlockChapter(server, 'ch03', true, dryRun, player);
  }

  // ch05: Routes & Camps (deploy >= 3 active camps or camp + completed route)
  var anyThreeCamps = Object.keys(logDb.camps || {}).some(function (pid) {
    var list = logDb.camps[pid] || [];
    return list.filter(function (c) { return c.active; }).length >= 3;
  });
  var anyCompletedRoute = Object.keys(logDb.routes || {}).some(function (rk) {
    return !!(logDb.routes[rk] && logDb.routes[rk].completed);
  });
  if (anyThreeCamps && anyCompletedRoute) {
    lhUnlockChapter(server, 'ch05', true, dryRun, player);
  }

  // ch04: Economic Centers (hub produced >= 1 or >= 6 sites commissioned)
  var commCount = 0;
  Object.keys(sitesDb.sites || {}).forEach(function (sid) {
    if (sitesDb.sites[sid] && sitesDb.sites[sid].commissioned) commCount++;
  });
  var hub = sitesDb.sites && sitesDb.sites.continental_hub;
  if ((hub && (hub.producedTotal || 0) >= 1) || commCount >= 6) {
    lhUnlockChapter(server, 'ch04', true, dryRun, player);
  }

  // ch06: Recoveries & CC Telemetry
  var restCount = 0;
  Object.keys(recDb.items || {}).forEach(function (rid) {
    if (recDb.items[rid] && recDb.items[rid].restored) restCount++;
  });
  if (restCount >= 3 && Object.keys(fieldDb.ccVerified || {}).length >= 2) {
    lhUnlockChapter(server, 'ch06', true, dryRun, player);
  }

  // ch07..ch10 (main campaign) + ch13 (optional photo): at least 4 verified orders
  var catCounts = { ch07: 0, ch08: 0, ch09: 0, ch10: 0, ch13: 0 };
  Object.keys(catDb.completed || {}).forEach(function (ck) {
    var qid = ck.split(':')[1] || '';
    if (qid.indexOf('main_') === 0) catCounts.ch07++;
    else if (qid.indexOf('region_') === 0) catCounts.ch08++;
    else if (qid.indexOf('engineering_') === 0) catCounts.ch09++;
    else if (qid.indexOf('expedition_') === 0) catCounts.ch10++;
    else if (qid.indexOf('photo_') === 0) catCounts.ch13++;
  });
  Object.keys(catCounts).forEach(function (cid) {
    if (catCounts[cid] >= 4) {
      lhUnlockChapter(server, cid, true, dryRun, player);
    }
  });

  // ch11: Nuclear & Draconic milestone (ONLY explicit /lh nuclear verify or advancement, never chest loot)
  if (db.nuclearVerified || (player && typeof player.isAdvancementDone === 'function' && player.isAdvancementDone('longhaul:nuclear/verified'))) {
    lhUnlockChapter(server, 'ch11', true, dryRun, player);
  }

  // ch12: OpenTTD Empire milestone
  if (player && typeof player.isAdvancementDone === 'function' && player.isAdvancementDone('longhaul:openttd/empire')) {
    lhUnlockChapter(server, 'ch12', true, dryRun, player);
  }

  // ch14: DOOMED Hardcore Survival (mandatory main chapter)
  if (db.doomedVerified) {
    lhUnlockChapter(server, 'ch14', true, dryRun, player);
  }

  // ch15..ch61: Expansion chapters verified directly from live Heracles capstone quest completion (chXX_99_master)
  if (LHHeraclesProgressHandler && player && player.uuid) {
    try {
      var qProg = LHHeraclesProgressHandler.getProgress(server, player.uuid);
      if (qProg && typeof qProg.isComplete === 'function') {
        for (var ei = 0; ei < LH_EXPANSION_CHAPTER_CODES.length; ei++) {
          var code = LH_EXPANSION_CHAPTER_CODES[ei];
          var chId = 'ch' + code;
          if (qProg.isComplete(chId + '_99_master')) {
            lhUnlockChapter(server, chId, true, dryRun, player);
          }
        }
      }
    } catch (eHeraclesProg) {}
  }

  if (player) lhChapterForkStatus(server, player, !!dryRun);
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
    var woodChance = 0.40 * (typeof lhCompanyScarcityFactor === 'function' ? lhCompanyScarcityFactor(server, player, 'forestry') : 1.0);
    if (Math.random() < woodChance) {
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
    var oreChance = 0.50 * (typeof lhCompanyScarcityFactor === 'function' ? lhCompanyScarcityFactor(server, player, 'mining') : 1.0);
    if (!hasSilk && Math.random() < oreChance) {
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

function lhHasLightSourceInHand(player) {
  var check = function (st) {
    if (!st || st.empty) return false;
    var sid = String(st.id);
    return sid.indexOf('torch') !== -1 || sid.indexOf('lantern') !== -1 ||
      sid.indexOf('glowstone') !== -1 || sid.indexOf('lamp') !== -1 || sid.indexOf('flare') !== -1;
  };
  return check(player.mainHandItem) || check(player.offHandItem);
}

function lhCountOccupiedSlots(player) {
  if (!player || !player.inventory) return 0;
  var inv = player.inventory;
  var used = 0;
  for (var s = 0; s < inv.slots; s++) {
    var st = inv.getStackInSlot(s);
    if (st && !st.empty) used++;
  }
  return used;
}

function lhProcessRespawnScatter(server, dryRun) {
  if (!LHRespawnScatterQueue.length) return 0;
  var remaining = [];
  var moved = 0;
  var diff = lhDifficultyStatus(server);
  var ow = server.getLevel('minecraft:overworld');
  for (var i = 0; i < LHRespawnScatterQueue.length; i++) {
    var job = LHRespawnScatterQueue[i];
    job.delay -= 1;
    if (job.delay > 0) {
      remaining.push(job);
      continue;
    }
    moved++;
    if (dryRun || !ow) continue;
    var plist = server.players || [];
    var targetPlayer = null;
    for (var pi = 0; pi < plist.length; pi++) {
      if (lhId(plist[pi]) === job.uuid) { targetPlayer = plist[pi]; break; }
    }
    if (!targetPlayer) continue;
    var tgt = lhComputeRandomRespawnTarget(server, job.centerX, job.centerZ, diff.coeff);
    var safeY = lhFindSafeRespawnY(ow, tgt.x, tgt.z);
    var uname = targetPlayer.username || (typeof targetPlayer.getName === 'function' ? targetPlayer.getName().getString() : '');
    if (uname) {
      server.runCommandSilent('execute in minecraft:overworld run tp ' + uname + ' ' + (tgt.x + 0.5) + ' ' + safeY + ' ' + (tgt.z + 0.5));
      server.runCommandSilent('effect give ' + uname + ' minecraft:resistance 5 2 true');
      server.runCommandSilent('effect give ' + uname + ' minecraft:slow_falling 5 0 true');
    }
    targetPlayer.tell('§e[Случайный спаун] Вы выброшены в точку (' + tgt.x + ', ' + safeY + ', ' + tgt.z +
      ')! Текущий радиус рассеивания R=' + tgt.radius + ' м (k=' + (Math.round(diff.coeff * 100) / 100) + ').');
  }
  LHRespawnScatterQueue = remaining;
  return moved;
}

if (typeof PlayerEvents !== 'undefined' && PlayerEvents.respawned) {
  PlayerEvents.respawned(function (event) {
    var server = event.server, player = event.player;
    if (!server || !player) return;
    var creative = (typeof player.isCreative === 'function' && player.isCreative()) ||
      (typeof player.isSpectator === 'function' && player.isSpectator());
    if (creative) return;
    if (!lhHardIsActive(server, 'random_respawn')) {
      lhEnsureSafeSpawn(server, player, true);
      return;
    }
    var center = lhGetPlayerSpawnCenter(server, player);
    LHRespawnScatterQueue.push({
      uuid: lhId(player),
      centerX: center.x,
      centerZ: center.z,
      delay: 2
    });
  });
}

EntityEvents.hurt(function (event) {
  var ent = event.entity;
  if (!ent || typeof ent.isPlayer !== 'function' || !ent.isPlayer()) return;
  var server = ent.server;
  if (!server || !lhHardIsActive(server, 'spore_spoilage')) return;
  var compHurt = typeof lhGetPlayerCompany === 'function' ? lhGetPlayerCompany(server, ent) : null;
  if (compHurt && compHurt.resourceSpec === 'agro') return;
  if (Number(ent.y) >= 68 || Math.random() >= 0.25) return;
  var inv = ent.inventory;
  if (!inv) return;
  var rawFoods = {
    'minecraft:beef': 'minecraft:rotten_flesh',
    'minecraft:porkchop': 'minecraft:rotten_flesh',
    'minecraft:chicken': 'minecraft:rotten_flesh',
    'minecraft:mutton': 'minecraft:rotten_flesh',
    'minecraft:rabbit': 'minecraft:rotten_flesh',
    'minecraft:cod': 'minecraft:rotten_flesh',
    'minecraft:salmon': 'minecraft:rotten_flesh',
    'minecraft:potato': 'minecraft:poisonous_potato'
  };
  for (var s = 0; s < inv.slots; s++) {
    var st = inv.getStackInSlot(s);
    if (!st || st.empty) continue;
    var spoiled = rawFoods[String(st.id)];
    if (spoiled) {
      inv.extractItem(s, 1, false);
      ent.give(spoiled);
      var pidSp = lhId(ent);
      if (!LHSporeWarnCooldown[pidSp] || LHProgTick - LHSporeWarnCooldown[pidSp] >= 600) {
        LHSporeWarnCooldown[pidSp] = LHProgTick;
        if (typeof lhLogEvent === 'function') {
          lhLogEvent(server, 'hazard', 'Брожение провианта: сырая еда испортилась у игрока в сырой низине.', { chatMode: 'never' });
        }
      }
      break;
    }
  }
});

ServerEvents.tick(function (event) {
  LHProgTick++;
  var server = event.server;
  lhCasinoStep(server, false);
  lhProcessRespawnScatter(server, false);

  if (LHLightningWarnings.length > 0) {
    var nextWarn = [];
    for (var wi = 0; wi < LHLightningWarnings.length; wi++) {
      var lw = LHLightningWarnings[wi];
      lw.delay -= 1;
      if (lw.delay > 0) {
        nextWarn.push(lw);
      } else {
        try {
          var owL = server.getLevel('minecraft:overworld');
          if (owL) {
            var bolt = owL.createEntity('minecraft:lightning_bolt');
            if (bolt) {
              bolt.setPos(lw.x, lw.y, lw.z);
              bolt.spawn();
            }
          }
        } catch (eBolt2) {}
      }
    }
    LHLightningWarnings = nextWarn;
  }

  if (LHProgTick % 40 !== 0) return;
  var plist = server.players;
  if (!plist) return;
  var diff = lhDifficultyStatus(server);
  var k = diff.coeff;

  for (var i = 0; i < plist.length; i++) {
    var p = plist[i];
    if (typeof lhStageRecompute === 'function') lhStageRecompute(server, p);
    lhProgressionRecompute(server, p, false);

    if (String(p.level.dimension) !== 'minecraft:overworld') continue;
    var creative = (typeof p.isCreative === 'function' && p.isCreative()) ||
      (typeof p.isSpectator === 'function' && p.isSpectator());
    if (creative) continue;

    // Continuous safeguard for players below Y=0, trapped inside bedrock, or outside the world border
    var halfB = lhActiveBorderHalf(server);
    if (Number(p.y) <= 0 || Math.abs(Number(p.x)) >= halfB - 1 || Math.abs(Number(p.z)) >= halfB - 1) {
      lhEnsureSafeSpawn(server, p, true);
    }

    var uname = p.username || (typeof p.getName === 'function' ? p.getName().getString() : '');
    if (!uname) continue;
    var py = Number(p.y);
    var px = Math.floor(Number(p.x));
    var pz = Math.floor(Number(p.z));
    var pPos = new LHBlockPos(px, Math.floor(py) + 1, pz);
    var seeSky = false;
    try { seeSky = p.level.canSeeSky(pPos); } catch (eSky) {}

    if (LHProgTick % 240 === 0 && lhHardIsActive(server, 'acid_pollution') && py < 92) {
      var compAcid = typeof lhGetPlayerCompany === 'function' ? lhGetPlayerCompany(server, p) : null;
      var hasHelmet = (p.headArmorItem && !p.headArmorItem.empty) || (compAcid && compAcid.resourceSpec === 'energy');
      if (!hasHelmet) {
        server.runCommandSilent('effect give ' + uname + ' minecraft:weakness 4 0 true');
      }
    }
    if (LHProgTick % 240 === 0 && lhHardIsActive(server, 'hunger_exhaustion')) {
      if (typeof p.isSprinting === 'function' && p.isSprinting()) {
        server.runCommandSilent('effect give ' + uname + ' minecraft:hunger 3 0 true');
      }
    }
    if (LHProgTick % 320 === 0 && lhHardIsActive(server, 'radiation_fallout') && py < 20) {
      var compRad = typeof lhGetPlayerCompany === 'function' ? lhGetPlayerCompany(server, p) : null;
      var armored = (p.chestArmorItem && !p.chestArmorItem.empty) || (compRad && compRad.resourceSpec === 'energy');
      if (!armored) {
        server.runCommandSilent('effect give ' + uname + ' minecraft:mining_fatigue 5 0 true');
      }
    }
    if (LHProgTick % 160 === 0 && lhHardIsActive(server, 'overload_encumbrance')) {
      var compRoad = typeof lhGetPlayerCompany === 'function' ? lhGetPlayerCompany(server, p) : null;
      var roadBonus = (compRoad && compRoad.transportSpec === 'road') ? 8 : 0;
      var usedSlots = lhCountOccupiedSlots(p);
      var limit = Math.max(16, 25 - Math.floor(k / 20)) + roadBonus;
      if (usedSlots > limit) {
        var amp = k >= 50 ? 1 : 0;
        server.runCommandSilent('effect give ' + uname + ' minecraft:slowness 5 ' + amp + ' true');
        server.runCommandSilent('effect give ' + uname + ' minecraft:mining_fatigue 5 0 true');
      }
    }
    if (LHProgTick % 240 === 0 && lhHardIsActive(server, 'cold_altitude_frost') && py >= 120) {
      var compAir = typeof lhGetPlayerCompany === 'function' ? lhGetPlayerCompany(server, p) : null;
      var fullArmor = (compAir && compAir.transportSpec === 'air') ||
        (p.headArmorItem && !p.headArmorItem.empty &&
        p.chestArmorItem && !p.chestArmorItem.empty &&
        p.legsArmorItem && !p.legsArmorItem.empty &&
        p.feetArmorItem && !p.feetArmorItem.empty);
      if (!fullArmor && !lhHasLightSourceInHand(p)) {
        server.runCommandSilent('effect give ' + uname + ' minecraft:slowness 5 0 true');
        try { if (typeof p.setTicksFrozen === 'function') p.setTicksFrozen(160); } catch (eFr) {}
      }
    }
    if (LHProgTick % 240 === 0 && lhHardIsActive(server, 'abyssal_pressure') && py < 0) {
      if (!lhHasLightSourceInHand(p)) {
        server.runCommandSilent('effect give ' + uname + ' minecraft:darkness 6 0 true');
        server.runCommandSilent('effect give ' + uname + ' minecraft:slowness 4 0 true');
      }
    }
    if (LHProgTick % 320 === 0 && lhHardIsActive(server, 'toxic_rain_corrosion')) {
      var isRaining = false;
      try { isRaining = !!p.level.isRaining(); } catch (eRain) {}
      if (isRaining && seeSky) {
        server.runCommandSilent('effect give ' + uname + ' minecraft:wither 3 0 true');
        var armorSlots = [p.headArmorItem, p.chestArmorItem, p.legsArmorItem, p.feetArmorItem];
        for (var ai = 0; ai < armorSlots.length; ai++) {
          var ar = armorSlots[ai];
          if (ar && !ar.empty && ar.damageable && Math.random() < 0.35) {
            try { ar.hurtAndBreak(1, p, function () {}); } catch (eAr) {}
          }
        }
      }
    }
    if (LHProgTick % 480 === 0 && lhHardIsActive(server, 'machine_sabotage_lightning')) {
      var storm = false;
      try { storm = !!p.level.isThundering() || (k >= 35 && !!p.level.isRaining()); } catch (eSt) {}
      if (storm && seeSky && Math.random() < 0.25) {
        var angL = Math.random() * 6.2831853;
        var radL = 5.0 + Math.random() * 4.0;
        var lx = Math.round(px + Math.cos(angL) * radL);
        var lz = Math.round(pz + Math.sin(angL) * radL);
        LHLightningWarnings.push({ x: lx, y: Math.floor(py), z: lz, delay: 60 });
        server.runCommandSilent('title ' + uname + ' actionbar ' + JSON.stringify({ text: '⚡ Магнитная гроза: укройтесь под крышей!', color: 'yellow' }));
        if (typeof lhLogEvent === 'function') {
          lhLogEvent(server, 'hazard', 'Магнитная гроза: разряд рядом с (' + lx + ', ' + lz + ').', { chatMode: 'never' });
        }
      }
    }
    if (LHProgTick % 1200 === 0 && lhHardIsActive(server, 'insomnia_ambush')) {
      var tod = Number(p.level.dayTime()) % 24000;
      if (tod >= 13500 && tod <= 23000 && seeSky && Math.random() < 0.22) {
        try {
          var angM = Math.random() * 6.2831853;
          var rM = 18.0 + Math.random() * 6.0;
          var mob = p.level.createEntity('minecraft:phantom');
          if (mob) {
            mob.setPos(px + Math.cos(angM) * rM, py + 12.0, pz + Math.sin(angM) * rM);
            mob.spawn();
          }
        } catch (ePh) {}
      }
    }
  }
});

PlayerEvents.loggedIn(function (event) {
  var server = event.server, player = event.player;
  lhProgressionRecompute(server, player, false);
  var info = lhApplyTerritoryBorder(server, false);
  lhFirstJoinRandomSpawn(server, player);
  lhEnsureSafeSpawn(server, player, false);
  var db = lhProgRead(server);
  var diff = lhDifficultyStatus(server);
  var chap = lhChapterProgressSummary(server);
  lhMsg(player, 'Граница мира: ' + info.size + '×' + info.size + ' (±' + Math.round(info.size / 2) +
    ' м). Этапы расширения: ' + info.unlocked + '/' + info.total + ' (осталось этапов: ' + info.locked +
    '). Пройдено глав: ' + chap.doneMain + '/' + chap.totalMain + ' · Текущая: ' + chap.currentLabel + '.');
  lhMsg(player, 'Сложность k=' + (Math.round(diff.coeff * 100) / 100) +
    ', угроз: ' + db.featureOrder.length + '/' + (global.LHHardFeatureCatalog ? global.LHHardFeatureCatalog.length : 100) +
    ' (базовое «Рудный голод» всегда активно; /lh territory, /lh map, /lh events, /lh difficulty).');
});

ServerEvents.commandRegistry(function (event) {
  var C = event.commands, root = C.literal('lh');

  var terr = C.literal('territory');
  terr.executes(function (ctx) {
    var server = ctx.source.server, p = ctx.source.playerOrException;
    var info = lhApplyTerritoryBorder(server, false);
    var db = lhProgRead(server);
    var chap = lhChapterProgressSummary(server);
    var unlocked = Object.keys(db.chapters).filter(function (k) { return db.chapters[k]; });
    lhMsg(p, 'Территория: ' + info.size + '×' + info.size + ' (±' + Math.round(info.size / 2) +
      ' м), этапов расширения: ' + info.unlocked + '/' + info.total + ' (осталось: ' + info.locked +
      '), открыто площади: ' + Math.round((info.areaShare || 0) * 100) + '%. Пройдено глав: ' + chap.doneMain + '/' + chap.totalMain +
      ' (' + (unlocked.length ? unlocked.join(', ') : 'старт') + ').');
    return 1;
  });
  terr.then(C.literal('map')
    .executes(function (ctx) {
      return typeof lhCompanyTerritoryMap === 'function' ? lhCompanyTerritoryMap(ctx.source.server, ctx.source.playerOrException, 5) : 0;
    })
    .then(C.argument('radius', LHDiffArgStr.word()).executes(function (ctx) {
      var rad = parseInt(LHDiffArgStr.getString(ctx, 'radius'), 10);
      return typeof lhCompanyTerritoryMap === 'function' ? lhCompanyTerritoryMap(ctx.source.server, ctx.source.playerOrException, isNaN(rad) ? 5 : rad) : 0;
    })));
  terr.then(C.literal('mapitem').executes(function (ctx) {
    return typeof lhGiveTerritoryMapItem === 'function' ? lhGiveTerritoryMapItem(ctx.source.server, ctx.source.playerOrException, false) : 0;
  }));
  terr.then(C.literal('inspect')
    .then(C.argument('sx', LHDiffArgStr.word())
      .then(C.argument('sz', LHDiffArgStr.word()).executes(function (ctx) {
        var sx = parseInt(LHDiffArgStr.getString(ctx, 'sx'), 10);
        var sz = parseInt(LHDiffArgStr.getString(ctx, 'sz'), 10);
        if (isNaN(sx) || isNaN(sz)) return 0;
        return typeof lhCompanyInspectSector === 'function' ? lhCompanyInspectSector(ctx.source.server, ctx.source.playerOrException, sx, sz) : 0;
      }))));
  terr.then(C.literal('buy')
    .then(C.argument('sx', LHDiffArgStr.word())
      .then(C.argument('sz', LHDiffArgStr.word()).executes(function (ctx) {
        var sx = parseInt(LHDiffArgStr.getString(ctx, 'sx'), 10);
        var sz = parseInt(LHDiffArgStr.getString(ctx, 'sz'), 10);
        if (isNaN(sx) || isNaN(sz)) return 0;
        return typeof lhCompanyClaimAt === 'function' ? lhCompanyClaimAt(ctx.source.server, ctx.source.playerOrException, sx, sz, false, true) : 0;
      }))));
  terr.then(C.literal('buyout')
    .then(C.argument('sx', LHDiffArgStr.word())
      .then(C.argument('sz', LHDiffArgStr.word()).executes(function (ctx) {
        var sx = parseInt(LHDiffArgStr.getString(ctx, 'sx'), 10);
        var sz = parseInt(LHDiffArgStr.getString(ctx, 'sz'), 10);
        if (isNaN(sx) || isNaN(sz)) return 0;
        return typeof lhCompanyClaimAt === 'function' ? lhCompanyClaimAt(ctx.source.server, ctx.source.playerOrException, sx, sz, true, true) : 0;
      }))));
  terr.then(C.literal('claim').executes(function (ctx) {
    return typeof lhCompanyClaimHere === 'function' ? lhCompanyClaimHere(ctx.source.server, ctx.source.playerOrException, false) : 0;
  }));
  terr.then(C.literal('settle').executes(function (ctx) {
    return typeof lhCompanySettleCargo === 'function' ? lhCompanySettleCargo(ctx.source.server, ctx.source.playerOrException, false) : 0;
  }));
  terr.then(C.literal('capture').executes(function (ctx) {
    return typeof lhCompanyClaimHere === 'function' ? lhCompanyClaimHere(ctx.source.server, ctx.source.playerOrException, true) : 0;
  }));
  terr.then(C.literal('raid').executes(function (ctx) {
    return typeof lhCompanyStartRaid === 'function' ? lhCompanyStartRaid(ctx.source.server, ctx.source.playerOrException) : 0;
  }));
  terr.then(C.literal('outbid').executes(function (ctx) {
    return typeof lhCompanyOutbidHere === 'function' ? lhCompanyOutbidHere(ctx.source.server, ctx.source.playerOrException, false) : 0;
  }));
  terr.then(C.literal('seize').executes(function (ctx) {
    return typeof lhCompanyAntitrustSeize === 'function' ? lhCompanyAntitrustSeize(ctx.source.server, ctx.source.playerOrException, false) : 0;
  }));
  terr.then(C.literal('transfer').then(C.argument('companyId', LHDiffArgStr.word()).executes(function (ctx) {
    return typeof lhCompanyTransferHere === 'function'
      ? lhCompanyTransferHere(ctx.source.server, ctx.source.playerOrException, LHDiffArgStr.getString(ctx, 'companyId'))
      : 0;
  })));
  terr.then(C.literal('fortify').executes(function (ctx) {
    return typeof lhCompanyFortifyHere === 'function' ? lhCompanyFortifyHere(ctx.source.server, ctx.source.playerOrException) : 0;
  }));
  terr.then(C.literal('info').executes(function (ctx) {
    return typeof lhCompanySectorInfo === 'function' ? lhCompanySectorInfo(ctx.source.server, ctx.source.playerOrException) : 0;
  }));
  root.then(terr);

  var diffCmd = C.literal('difficulty');
  diffCmd.executes(function (ctx) {
    var server = ctx.source.server, p = ctx.source.playerOrException;
    var d = lhDifficultyStatus(server);
    lhMsg(p, 'Коэффициент сложности k=' + (Math.round(d.coeff * 100) / 100) +
      ' (смертей онлайн=' + d.onlineDeaths + ', игроков онлайн=' + d.onlinePlayers +
      ', база T=' + d.targetAvgDeaths + '). Сила Voidout=' + (Math.round(d.voidoutPower * 100) / 100) +
      ', радиус случайного спауна=' + d.respawnRadius + ' м.');
    return 1;
  });
  diffCmd.then(C.literal('target').requires(function (s) { return s.hasPermission(2); })
    .then(C.argument('value', LHDiffArgStr.word()).executes(function (ctx) {
      var server = ctx.source.server, p = ctx.source.playerOrException;
      var val = parseFloat(LHDiffArgStr.getString(ctx, 'value'));
      if (!(val > 0)) {
        lhMsg(p, 'Укажите положительное число T, например /lh difficulty target 275.15');
        return 0;
      }
      var db = lhProgRead(server);
      db.targetAvgDeaths = val;
      lhProgSave(server);
      var d = lhDifficultyStatus(server);
      lhMsg(p, 'Целевой порог T обновлён до ' + val + ' -> k=' + (Math.round(d.coeff * 100) / 100) + '.');
      return 1;
    })));
  root.then(diffCmd);

  var casino = C.literal('casino');
  casino.then(C.literal('status').executes(function (ctx) {
    var server = ctx.source.server, p = ctx.source.playerOrException;
    var db = lhProgRead(server);
    var totalPool = global.LHHardFeatureCatalog ? global.LHHardFeatureCatalog.length : 100;
    var active = db.featureOrder.map(function (id) {
      var m = lhHardFeatureMeta(id);
      if (!m) return id;
      return (m.isBase ? '[БАЗА] ' : '') + m.icon + ' ' + m.name;
    });
    var lockedCount = lhLockedHardFeatures(server).length;
    lhMsg(p, 'Активные усложнения (' + active.length + '/' + totalPool + '): ' + (active.length ? active.join(', ') : 'нет'));
    lhMsg(p, 'Ещё закрыто в Колесе Угроз: ' + lockedCount + ' (крутится после завершения каждой главы; статус глав: /lh chapter status).');
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

  var chapterCmd = C.literal('chapter');
  chapterCmd.then(C.literal('status').executes(function (ctx) {
    var server = ctx.source.server, p = ctx.source.playerOrException;
    var chap = lhChapterProgressSummary(server);
    var info = lhTerritoryCounts(server);
    lhMsg(p, 'Главы: ' + chap.doneMain + '/' + chap.totalMain + ' (текущая: ' + chap.currentLabel +
      '), граница мира: ' + info.size + '×' + info.size + ' (этапов: ' + info.unlocked + '/' + info.total + ').');
    return 1;
  }));
  chapterCmd.then(C.literal('unlock').requires(function (s) { return s.hasPermission(2); })
    .then(C.argument('chapterId', LHDiffArgStr.word()).executes(function (ctx) {
      var server = ctx.source.server, p = ctx.source.playerOrException;
      var cid = LHDiffArgStr.getString(ctx, 'chapterId');
      if (!LH_CHAPTER_LABELS[cid]) {
        lhMsg(p, 'Неизвестный ID главы: ' + cid + ' (ожидается ch00..ch61).');
        return 0;
      }
      var okU = lhUnlockChapter(server, cid, true, false);
      lhMsg(p, okU ? ('Глава ' + LH_CHAPTER_LABELS[cid] + ' открыта -> запущено Колесо Угроз!') : ('Глава ' + cid + ' уже пройдена.'));
      return 1;
    })));
  root.then(chapterCmd);

  var chaptersCmd = C.literal('chapters');
  chaptersCmd.executes(function (ctx) {
    var server = ctx.source.server, p = ctx.source.playerOrException;
    var st = lhChapterForkStatus(server, p, false);
    if (!st) return 0;
    lhMsg(p, '=== Вилка глав по сложности (' + st.tierLabel + ') ===');
    if (!st.mandatoryDone) {
      lhMsg(p, '§eСначала завершите обязательные стартовые главы: 00 (Сюжет), 01 (Правила), 02 (Мастерская).');
    } else if (st.activePick) {
      lhMsg(p, '§aТекущая выбранная глава: §f' + (LH_CHAPTER_LABELS[st.activePick] || st.activePick));
    } else if (st.offers && st.offers.length) {
      lhMsg(p, '§6Выберите 1 из 3 случайных глав (/lh chapters pick <id> или Планшет → Главы):');
      st.offers.forEach(function (cid) {
        lhMsg(p, '  §e• [' + cid + '] §f' + (LH_CHAPTER_LABELS[cid] || cid));
      });
    } else {
      lhMsg(p, '§aВсе доступные главы открыты!');
    }
    return 1;
  });
  chaptersCmd.then(C.literal('status').executes(function (ctx) {
    var server = ctx.source.server, p = ctx.source.playerOrException;
    var st = lhChapterForkStatus(server, p, false);
    if (!st) return 0;
    lhMsg(p, 'Тир: ' + st.tierLabel + ' | Открыто у вас: ' + st.unlocked.length + '/61 | Активная: ' + (st.activePick || 'нет') + ' | Вилка: ' + ((st.offers || []).join(', ') || 'нет'));
    return 1;
  }));
  chaptersCmd.then(C.literal('pick').then(C.argument('chapterId', LHDiffArgStr.word()).executes(function (ctx) {
    var res = lhChapterForkPick(ctx.source.server, ctx.source.playerOrException, LHDiffArgStr.getString(ctx, 'chapterId'), false);
    return res && res.ok ? 1 : 0;
  })));
  root.then(chaptersCmd);

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
      ? 'DOOMED проверен на сервере: отметка для главы 14 выдана.'
      : 'Протокол полевого выживания (Глава 14 · DOOMED) подтверждён сервером.');
    lhProgressionRecompute(server, p, false);
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
  console.info('[LH] Territory scaling + Casino Wheel hard-feature gate + global difficulty k loaded.');
});
