// Long Haul Legacy 2.0: pure contract state machine, world site planner,
// route speed/checkpoint validator, and economy reachability verifier.
global.LHContractEngine = (function () {
  function begin(id, spec) {
    return { id: id, status: 'active', seconds: 0, windows: 0, current: {}, totals: {} };
  }
  function remaining(job, spec) {
    var out = {};
    Object.keys(spec.goods).forEach(function (item) {
      out[item] = Math.max(0, spec.goods[item] - (job.current[item] || 0));
    });
    return out;
  }
  function step(job, spec, accepted, loaded) {
    if (job.status !== 'active' || !loaded) return job;
    Object.keys(spec.goods).forEach(function (item) {
      var n = accepted[item] || 0;
      if (n < 0 || n !== Math.floor(n) || n > spec.goods[item] - (job.current[item] || 0))
        throw new Error('Invalid accepted amount for ' + item);
      job.current[item] = (job.current[item] || 0) + n;
      job.totals[item] = (job.totals[item] || 0) + n;
    });
    job.seconds++;
    var filled = Object.keys(spec.goods).every(function (i) { return job.current[i] >= spec.goods[i]; });
    if (!spec.windowSeconds) {
      if (filled) job.status = 'complete';
      return job;
    }
    if (job.seconds >= spec.windowSeconds) {
      if (!filled) { job.status = 'failed'; return job; }
      job.windows++;
      job.seconds = 0;
      job.current = {};
      if (job.windows >= spec.windows) job.status = 'complete';
    }
    return job;
  }
  return { begin: begin, remaining: remaining, step: step };
})();

global.LHContracts = {
  plates: { title: 'Первая партия пластин', goods: { 'create:iron_sheet': 64 } },
  brass: { title: 'Латунный заказ', goods: { 'create:brass_ingot': 32 } },
  rails: { title: 'Снабжение путейцев', goods: { 'create:track': 128 } },
  provisions: { title: 'Продовольственный склад', goods: { 'minecraft:bread': 32, 'minecraft:baked_potato': 32 } },
  mechanisms: { title: 'Приборы для депо', goods: { 'create:precision_mechanism': 8 } },
  plate_shift: { title: 'Ритм поставки пластин', goods: { 'create:iron_sheet': 16 }, windowSeconds: 60, windows: 3 },
  food_shift: { title: 'Регулярное снабжение', goods: { 'minecraft:bread': 8, 'minecraft:baked_potato': 8 }, windowSeconds: 60, windows: 3 },
  rail_shift: { title: 'Снабжение магистрали', goods: { 'create:track': 32, 'create:iron_sheet': 8 }, windowSeconds: 60, windows: 5 }
};

global.LHSiteCatalog = [
  {
    id: 'forest',
    name: 'Лесная артель',
    tier: 1,
    minDist: 1600,
    maxDist: 3600,
    product: 'longhaul:treated_timber',
    bootstrapInputs: { 'minecraft:oak_log': 4, 'minecraft:coal': 1 },
    industrialInputs: { 'minecraft:oak_log': 8, 'longhaul:ore_concentrate': 1, 'longhaul:machine_parts': 1 },
    demand: 'Полотна пил, крепёж, базовые инструменты'
  },
  {
    id: 'farm',
    name: 'Речной агрогород',
    tier: 1,
    minDist: 2000,
    maxDist: 4200,
    product: 'longhaul:field_rations',
    bootstrapInputs: { 'minecraft:wheat': 4, 'minecraft:coal': 1 },
    industrialInputs: { 'minecraft:wheat': 8, 'longhaul:treated_timber': 1, 'longhaul:ore_concentrate': 1 },
    demand: 'Инструменты, тара, удобрения'
  },
  {
    id: 'mine',
    name: 'Горный рудник',
    tier: 1,
    minDist: 2400,
    maxDist: 4800,
    product: 'longhaul:ore_concentrate',
    bootstrapInputs: { 'minecraft:iron_ingot': 4, 'minecraft:coal': 1 },
    industrialInputs: { 'minecraft:iron_ingot': 8, 'longhaul:machine_parts': 1, 'longhaul:technical_glass': 1 },
    demand: 'Рационы, крепёж, буровые головки'
  },
  {
    id: 'port',
    name: 'Морской порт',
    tier: 2,
    minDist: 5500,
    maxDist: 10500,
    product: 'longhaul:marine_reagent',
    bootstrapInputs: { 'minecraft:kelp': 4, 'minecraft:coal': 1 },
    industrialInputs: { 'minecraft:kelp': 8, 'longhaul:field_rations': 1, 'longhaul:treated_timber': 1 },
    demand: 'Канаты, ремонтные комплекты, провизия'
  },
  {
    id: 'badlands',
    name: 'Карьер пустошей',
    tier: 2,
    minDist: 6500,
    maxDist: 12000,
    product: 'longhaul:refractory_mix',
    bootstrapInputs: { 'minecraft:cobblestone': 8, 'minecraft:coal': 1 },
    industrialInputs: { 'minecraft:cobblestone': 16, 'longhaul:marine_reagent': 1, 'longhaul:field_rations': 1 },
    demand: 'Вода, продовольствие, детали насосов'
  },
  {
    id: 'smelter',
    name: 'Стекольная долина',
    tier: 2,
    minDist: 7500,
    maxDist: 13500,
    product: 'longhaul:technical_glass',
    bootstrapInputs: { 'minecraft:sand': 4, 'minecraft:coal': 1 },
    industrialInputs: { 'minecraft:sand': 8, 'longhaul:technical_oil': 1, 'longhaul:refractory_mix': 1 },
    demand: 'Флюс, топливо, огнеупорная тара'
  },
  {
    id: 'wetland',
    name: 'Химический посёлок',
    tier: 3,
    minDist: 13500,
    maxDist: 22000,
    product: 'longhaul:technical_oil',
    bootstrapInputs: { 'minecraft:coal': 4, 'minecraft:clay_ball': 2 },
    industrialInputs: { 'minecraft:coal': 8, 'longhaul:refractory_mix': 1, 'longhaul:marine_reagent': 1 },
    demand: 'Фильтры, техническое стекло, металлическая тара'
  },
  {
    id: 'machine',
    name: 'Машиностроительный центр',
    tier: 3,
    minDist: 16000,
    maxDist: 26000,
    product: 'longhaul:machine_parts',
    bootstrapInputs: { 'minecraft:copper_ingot': 4, 'minecraft:coal': 1 },
    industrialInputs: { 'minecraft:copper_ingot': 8, 'longhaul:technical_glass': 1, 'longhaul:technical_oil': 1 },
    demand: 'Продукция всех региональных центров'
  },
  {
    id: 'continental_archive',
    name: 'Центральный архив магистралей',
    tier: 4,
    unique: true,
    minDist: 28000,
    maxDist: 46000,
    product: null,
    bootstrapInputs: null,
    industrialInputs: null,
    demand: 'Историческая и инженерная документация'
  },
  {
    id: 'continental_hub',
    name: 'Континентальный узел консорциума',
    tier: 4,
    unique: true,
    minDist: 34000,
    maxDist: 56000,
    product: 'longhaul:continental_module',
    bootstrapInputs: null,
    industrialInputs: {
      'longhaul:ore_concentrate': 8,
      'longhaul:treated_timber': 8,
      'longhaul:field_rations': 8,
      'longhaul:marine_reagent': 8,
      'longhaul:refractory_mix': 8,
      'longhaul:technical_oil': 8,
      'longhaul:technical_glass': 8,
      'longhaul:machine_parts': 8
    },
    demand: 'Сборка финального континентального модуля'
  }
];

global.LHWorldPlanner = (function () {
  var BORDER_SAFE_LIMIT = 84000;
  var MIN_SEPARATION = 2400;
  var PI = 3.141592653589793;

  function abs(v) { return v < 0 ? -v : v; }
  function min(a, b) { return a < b ? a : b; }
  function round(v) {
    if (!(v === v)) return 0;
    return v >= 0 ? Math.floor(v + 0.5) : -Math.floor(-v + 0.5);
  }
  function sqrt(v) {
    if (v <= 0) return 0;
    var g = v > 1 ? v * 0.5 : 1;
    for (var i = 0; i < 24; i++) g = 0.5 * (g + v / g);
    return g;
  }
  function sinRad(x) {
    var twoPi = 2 * PI;
    x = x - Math.floor(x / twoPi) * twoPi;
    if (x > PI) x -= twoPi;
    if (x > PI * 0.5) x = PI - x;
    else if (x < -PI * 0.5) x = -PI - x;
    var x2 = x * x;
    return x * (1 - x2 / 6 * (1 - x2 / 20 * (1 - x2 / 42 * (1 - x2 / 72))));
  }
  function cosRad(x) { return sinRad(x + PI * 0.5); }

  function hashSeed(seedInput) {
    var s = String(seedInput || '0');
    var h = 5381;
    for (var i = 0; i < s.length; i++) {
      h = (h * 33 + s.charCodeAt(i)) % 2147483647;
    }
    return h > 0 ? h : 1;
  }

  function makeRng(seed) {
    var state = hashSeed(seed);
    return function () {
      state = (state * 48271) % 2147483647;
      return (state - 1) / 2147483646;
    };
  }

  function dist2D(ax, az, bx, bz) {
    var dx = ax - bx;
    var dz = az - bz;
    return sqrt(dx * dx + dz * dz);
  }

  function planSites(seed) {
    var rng = makeRng(seed);
    var placed = [];
    var count = global.LHSiteCatalog.length;
    for (var i = 0; i < count; i++) {
      var spec = global.LHSiteCatalog[i];
      var baseAngle = (PI * 2 * i) / count;
      var chosen = null;
      for (var attempt = 0; attempt < 64; attempt++) {
        var angle = baseAngle + (rng() - 0.5) * 0.9 + attempt * 0.13;
        var radius = spec.minDist + rng() * (spec.maxDist - spec.minDist);
        var x = round(cosRad(angle) * radius);
        var z = round(sinRad(angle) * radius);
        if (!(abs(x) <= BORDER_SAFE_LIMIT && abs(z) <= BORDER_SAFE_LIMIT)) continue;
        var ok = true;
        for (var j = 0; j < placed.length; j++) {
          if (dist2D(x, z, placed[j].x, placed[j].z) < MIN_SEPARATION) {
            ok = false;
            break;
          }
        }
        if (ok) {
          chosen = {
            id: spec.id,
            name: spec.name,
            tier: spec.tier,
            unique: !!spec.unique,
            x: x,
            z: z,
            distanceFromOrigin: round(dist2D(0, 0, x, z)),
            commissioned: false,
            discovered: false,
            depot: null,
            producedTotal: 0
          };
          break;
        }
      }
      if (!chosen) {
        var fallbackAngle = baseAngle;
        var fallbackRadius = min(BORDER_SAFE_LIMIT - 1000, round((spec.minDist + spec.maxDist) / 2));
        chosen = {
          id: spec.id,
          name: spec.name,
          tier: spec.tier,
          unique: !!spec.unique,
          x: round(cosRad(fallbackAngle) * fallbackRadius),
          z: round(sinRad(fallbackAngle) * fallbackRadius),
          distanceFromOrigin: fallbackRadius,
          commissioned: false,
          discovered: false,
          depot: null,
          producedTotal: 0
        };
      }
      placed.push(chosen);
    }
    return placed;
  }

  return {
    BORDER_SAFE_LIMIT: BORDER_SAFE_LIMIT,
    MIN_SEPARATION: MIN_SEPARATION,
    dist2D: dist2D,
    round: round,
    abs: abs,
    sinRad: sinRad,
    cosRad: cosRad,
    makeRng: makeRng,
    planSites: planSites
  };
})();

global.LHRecoveryCatalog = [
  {
    id: 'sawmill',
    name: 'Заброшенная лесопилка',
    parentSite: 'forest',
    offsetMin: 320,
    offsetMax: 720,
    repairInputs: { 'minecraft:iron_ingot': 16, 'create:andesite_alloy': 16, 'minecraft:oak_log': 32 },
    requiredMachinery: ['create:mechanical_saw', 'create:water_wheel', 'create:large_water_wheel', 'create:steam_engine'],
    summary: 'Восстановите привод пилы и подайте крепёж в бочку площадки.'
  },
  {
    id: 'quarry',
    name: 'Карьер с повреждённым подъездом',
    parentSite: 'mine',
    offsetMin: 360,
    offsetMax: 780,
    repairInputs: { 'create:iron_sheet': 24, 'create:track': 32, 'minecraft:cobblestone': 64 },
    requiredMachinery: ['create:mechanical_drill', 'create:crushing_wheel', 'create:track_station'],
    summary: 'Установите буровой/дробильный узел и доставьте рельсы с обшивкой.'
  },
  {
    id: 'river_port',
    name: 'Занесённый речной порт',
    parentSite: 'port',
    offsetMin: 340,
    offsetMax: 760,
    repairInputs: { 'minecraft:oak_planks': 64, 'minecraft:iron_ingot': 16, 'create:portable_storage_interface': 2 },
    requiredMachinery: ['create:portable_storage_interface', 'create:mechanical_harvester', 'create:chute', 'minecraft:hopper'],
    summary: 'Смонтируйте перегрузочный узел на причале и поставьте лес со сталью.'
  },
  {
    id: 'sorting_yard',
    name: 'Сортировочная станция',
    parentSite: 'smelter',
    offsetMin: 400,
    offsetMax: 840,
    repairInputs: { 'create:track': 64, 'create:brass_ingot': 16, 'create:belt_connector': 8 },
    requiredMachinery: ['create:track_station', 'create:brass_funnel', 'create:belt'],
    summary: 'Разверните станцию или латунный узел сортировки и поставьте комплектующие.'
  },
  {
    id: 'power_plant',
    name: 'Завод с разбитой энергосистемой',
    parentSite: 'wetland',
    offsetMin: 360,
    offsetMax: 800,
    repairInputs: { 'minecraft:copper_ingot': 32, 'create:brass_ingot': 16, 'minecraft:coal': 48 },
    requiredMachinery: ['create:steam_engine', 'createaddition:alternator', 'immersiveengineering:dynamo', 'create:windmill_bearing'],
    summary: 'Подключите генератор/паровой двигатель и подайте медь, латунь и топливо.'
  },
  {
    id: 'collapsed_bridge',
    name: 'Обрушенный магистральный мост',
    parentSite: 'machine',
    offsetMin: 420,
    offsetMax: 860,
    repairInputs: { 'create:metal_girder': 24, 'create:track': 48, 'minecraft:stone_bricks': 64 },
    requiredMachinery: ['create:track_station', 'create:gantry_carriage', 'create:track'],
    summary: 'Проложите рельсовый переход или пролёт рядом с обвалом и сдайте конструкции.'
  }
];

global.LHRecoveryPlanner = (function () {
  function planRecoveries(seed, sitesMap) {
    var P = global.LHWorldPlanner;
    var rng = P.makeRng(String(seed) + '_recovery');
    var placed = {};
    for (var i = 0; i < global.LHRecoveryCatalog.length; i++) {
      var spec = global.LHRecoveryCatalog[i];
      var parent = sitesMap[spec.parentSite];
      var px = parent ? parent.x : (i + 1) * 1500;
      var pz = parent ? parent.z : (i + 1) * 1500;
      var angle = rng() * 6.283185307179586;
      var r = spec.offsetMin + rng() * (spec.offsetMax - spec.offsetMin);
      var x = P.round(px + P.cosRad(angle) * r);
      var z = P.round(pz + P.sinRad(angle) * r);
      if (P.abs(x) > P.BORDER_SAFE_LIMIT) x = x > 0 ? P.BORDER_SAFE_LIMIT - 200 : -P.BORDER_SAFE_LIMIT + 200;
      if (P.abs(z) > P.BORDER_SAFE_LIMIT) z = z > 0 ? P.BORDER_SAFE_LIMIT - 200 : -P.BORDER_SAFE_LIMIT + 200;
      placed[spec.id] = {
        id: spec.id,
        name: spec.name,
        parentSite: spec.parentSite,
        x: x,
        z: z,
        surveyed: false,
        restored: false,
        depot: null
      };
    }
    return placed;
  }

  return { planRecoveries: planRecoveries };
})();

global.LHRouteValidator = (function () {
  var MAX_SPEED_BPS = 85; // Reject instant teleportation / nether-roof skips between gates

  function pathLength(gates) {
    if (!gates || gates.length < 2) return 0;
    var P = global.LHWorldPlanner;
    var total = 0;
    for (var i = 1; i < gates.length; i++) {
      total += P.dist2D(gates[i - 1].x, gates[i - 1].z, gates[i].x, gates[i].z);
    }
    return P.round(total);
  }

  function validateSegmentSpeed(prevGate, nextGate, elapsedSeconds) {
    var P = global.LHWorldPlanner;
    var dist = P.dist2D(prevGate.x, prevGate.z, nextGate.x, nextGate.z);
    var dt = elapsedSeconds > 1 ? elapsedSeconds : 1;
    var speed = dist / dt;
    return { distance: P.round(dist), seconds: dt, speedBps: P.round(speed * 10) / 10, ok: speed <= MAX_SPEED_BPS };
  }

  return { MAX_SPEED_BPS: MAX_SPEED_BPS, pathLength: pathLength, validateSegmentSpeed: validateSegmentSpeed };
})();

global.LHEconomyGraph = (function () {
  var BASE_ITEMS = [
    'minecraft:oak_log', 'minecraft:wheat', 'minecraft:iron_ingot',
    'minecraft:kelp', 'minecraft:cobblestone', 'minecraft:sand',
    'minecraft:coal', 'minecraft:clay_ball', 'minecraft:copper_ingot'
  ];

  function checkReachability() {
    var have = {};
    BASE_ITEMS.forEach(function (id) { have[id] = true; });
    var unlocked = {};
    var progress = true;
    while (progress) {
      progress = false;
      global.LHSiteCatalog.forEach(function (site) {
        if (!site.product) return;
        [site.bootstrapInputs, site.industrialInputs].forEach(function (inputs) {
          if (!inputs) return;
          var ready = Object.keys(inputs).every(function (k) { return !!have[k]; });
          if (ready && !have[site.product]) {
            have[site.product] = true;
            progress = true;
          }
          if (ready && inputs === site.industrialInputs) {
            unlocked[site.id + '_industrial'] = true;
          }
        });
      });
    }
    var missing = [];
    global.LHSiteCatalog.forEach(function (site) {
      if (site.product && !have[site.product]) missing.push(site.product);
      if (site.industrialInputs && !unlocked[site.id + '_industrial']) missing.push(site.id + '_industrial');
    });
    return { ok: missing.length === 0, missing: missing, reachableCount: Object.keys(have).length };
  }

  return { BASE_ITEMS: BASE_ITEMS, checkReachability: checkReachability };
})();

global.LHTerritoryMath = (function () {
  var TOTAL_GATES = 61;
  var BASE_BORDER = 724;
  var MAX_BORDER = 175000;

  // Concave diminishing-returns area curve across all 61 non-optional chapters (60 expansion steps, reaching 175000 at locked <= 1):
  // More territory opens at the start, so both delta-Area and delta-Size strictly decrease toward the end of the playthrough.
  function computeBorder(totalGates, unlockedCount) {
    var total = totalGates > 0 ? totalGates : TOTAL_GATES;
    var steps = total > 1 ? (total - 1) : 1;
    var unlocked = unlockedCount > 0 ? unlockedCount : 0;
    var locked = total - unlocked;
    if (locked < 0) locked = 0;
    if (unlocked <= 0) {
      return { total: total, unlocked: 0, locked: total, progress: 0, areaShare: 0, x: 0, size: BASE_BORDER };
    }
    if (locked <= 1) {
      return { total: total, unlocked: unlocked, locked: locked, progress: 1, areaShare: 1, x: 1, size: MAX_BORDER };
    }
    var p = Math.min(1.0, unlocked / steps);
    var areaShare = 1.0 - Math.pow(1.0 - p, 2.0);
    var baseArea = BASE_BORDER * BASE_BORDER;
    var maxArea = MAX_BORDER * MAX_BORDER;
    var size = Math.round(Math.sqrt(baseArea + (maxArea - baseArea) * areaShare));
    return {
      total: total,
      unlocked: unlocked,
      locked: locked,
      progress: p,
      areaShare: areaShare,
      x: areaShare,
      size: size
    };
  }

  return {
    TOTAL_GATES: TOTAL_GATES,
    BASE_BORDER: BASE_BORDER,
    MAX_BORDER: MAX_BORDER,
    computeBorder: computeBorder
  };
})();

global.LHDifficultyMath = (function () {
  // Scaled from the 14-chapter baseline (63.15 deaths/player) to the 61-chapter campaign:
  // 63.15 * (61 / 14) = 275.15 target average deaths per online player at k=96.
  var TARGET_AVG_DEATHS = 275.15;
  var RANDOM_SPAWN_AT_END = 20203;
  var END_COEFF = 96.0;

  function compute(onlineDeathsSum, onlinePlayerCount, targetAvg) {
    var n = Number(onlinePlayerCount || 0);
    var d = Number(onlineDeathsSum || 0);
    var t = Number(targetAvg || TARGET_AVG_DEATHS);
    if (!(n > 0) || !(t > 0) || !(d > 0)) return 1.0;
    return 1.0 + 95.0 * (d / n) / t;
  }

  function randomRespawnRadius(coeff) {
    var k = Number(coeff || 1.0);
    if (!(k > 0)) k = 1.0;
    return Math.round(RANDOM_SPAWN_AT_END * (k / END_COEFF));
  }

  return {
    TARGET_AVG_DEATHS: TARGET_AVG_DEATHS,
    RANDOM_SPAWN_AT_END: RANDOM_SPAWN_AT_END,
    END_COEFF: END_COEFF,
    compute: compute,
    randomRespawnRadius: randomRespawnRadius
  };
})();

global.LHVoidoutMath = (function () {
  var BASE_STRENGTH = 1.0;

  function computePower(difficultyCoeff) {
    var k = Number(difficultyCoeff || 1.0);
    if (!(k >= 1.0)) k = 1.0;
    var power = BASE_STRENGTH * k;
    return { coeff: k, base: BASE_STRENGTH, raw: power, primary: power };
  }

  return { BASE_STRENGTH: BASE_STRENGTH, computePower: computePower };
})();

global.LHHardFeatureCatalog = [
  // 1. Always-active base complication (worldgen ~10x ore reduction + rare mono-ore chunks + 50% mining loss outside Silk Touch)
  { id: 'ore_scarcity', name: 'Рудный голод', icon: '⛏', color: 'gold', isBase: true, category: 'world_base', summary: '[БАЗОВОЕ, ВСЕГДА АКТИВНО] Генерация руд снижена (~×10) с редкими моно-жилами (/lh prospect), а руды вне жил теряют 50% добычи без Шёлкового касания.' },

  // 2..20. Core unlockable complications
  { id: 'wood_scarcity', name: 'Дефицит леса', icon: '🪓', color: 'dark_green', category: 'logistics', summary: 'Саженцы отключены, а 40% срубленных брёвен рассыпается — стройте линии в новые леса.' },
  { id: 'smarter_mobs', name: 'Тактический ИИ мобов', icon: '🧠', color: 'red', category: 'combat', summary: 'Враждебные мобы получают ускорение, усиленное чутьё и тактические баффы.' },
  { id: 'immortal_snail', name: 'Бессмертная Улитка', icon: '🐌', color: 'dark_red', category: 'pressure', summary: 'Неуязвимая Улитка пробуждается и бесконечно ползёт к вам сквозь стены (/lh snail status).' },
  { id: 'voidout_explosion', name: 'Сингулярный выброс', icon: '💥', color: 'dark_purple', category: 'pressure', summary: 'Каждая смерть вызывает взрыв Voidout силой 1.0 * k (растёт от коэффициента сложности без капа).' },
  { id: 'toxic_gas', name: 'Сезонный токсичный газ', icon: '☣', color: 'green', category: 'pressure', summary: 'Раз в 4 дня ядовитый туман поднимается до Y=114 — спасайтесь на горах и летающих островах.' },
  { id: 'random_respawn', name: 'Случайный спаун', icon: '🧭', color: 'aqua', category: 'pressure', summary: 'После смерти вы возрождаетесь в случайной точке вокруг спауна (радиус = 20203 * k / 96).' },
  { id: 'death_item_loss', name: 'Распад инвентаря', icon: '🗑', color: 'dark_red', category: 'pressure', summary: 'После гибели случайная часть предметов в инвентаре безвозвратно исчезает (доля растёт с k).' },
  { id: 'acid_pollution', name: 'Кислотный смог', icon: '🌫', color: 'gray', category: 'env', summary: 'Тяжёлый дым промышленных зон и низин (Y<92) вызывает слабость без шлема и дымоходов.' },
  { id: 'hostile_nights', name: 'Кровавые ночи', icon: '🌙', color: 'dark_red', category: 'combat', summary: 'Ночные монстры на поверхности появляются с Силой и огнестойкостью — обустраивайте укрытия.' },
  { id: 'hunger_exhaustion', name: 'Экспедиционный голод', icon: '🍖', color: 'yellow', category: 'survival', summary: 'Долгий бег ускоряет расход сытости — используйте транспорт, поезда и рационы.' },
  { id: 'tool_wear', name: 'Хрупкость инструментов', icon: '⚒', color: 'aqua', category: 'mining', summary: 'Вдали от дома (>400 м) инструменты изнашиваются быстрее — переходите на механизмы Create.' },
  { id: 'radiation_fallout', name: 'Радиационный фон', icon: '☢', color: 'light_purple', category: 'env', summary: 'Глубокие шахты (Y<20) накапливают усталость без защитного нагрудника.' },
  { id: 'overload_encumbrance', name: 'Гравитационный перегруз', icon: '🪨', color: 'gold', category: 'logistics', summary: 'Более 24 занятых слотов в инвентаре замедляют шаг — возите грузы вагонетками и транспортом!' },
  { id: 'cold_altitude_frost', name: 'Высотный мороз', icon: '❄', color: 'aqua', category: 'env', summary: 'На высоте Y>=120 без полной брони или тепла в руке накапливается обморожение.' },
  { id: 'machine_sabotage_lightning', name: 'Магнитные грозы', icon: '⚡', color: 'yellow', category: 'env', summary: 'Во время грозы и дождя под открытым небом бьют молнии — стройте крыши и громоотводы.' },
  { id: 'abyssal_pressure', name: 'Глубинная баротравма', icon: '🕳', color: 'dark_gray', category: 'env', summary: 'Ниже Y=0 без источника света в руках накатывает Тьма и давление недр.' },
  { id: 'toxic_rain_corrosion', name: 'Кислотные осадки', icon: '🌧', color: 'dark_green', category: 'env', summary: 'Дождь под открытым небом разъедает броню и наносит слабый урон — стройте навесы и кабины.' },
  { id: 'spore_spoilage', name: 'Брожение провианта', icon: '🍄', color: 'green', category: 'survival', summary: 'В сырых низинах (Y<68) при уроне сырая еда портится — готовьте полноценные блюда и консервы.' },
  { id: 'insomnia_ambush', name: 'Сингулярная бессонница', icon: '👁', color: 'dark_purple', category: 'combat', summary: 'Ночью под открытым небом к одиноким путникам притягиваются засады фантомов.' },

  // 21..30. Category A: Environment, Biomes & Altitude Hazards
  { id: 'solar_heatstroke', name: 'Солнечный удар', icon: '☀', color: 'gold', category: 'env', summary: 'Днём под открытым солнцем без шлема (Y>=70) накапливаются голод и вялость.' },
  { id: 'nether_heat_wave', name: 'Жар Незера', icon: '🔥', color: 'red', category: 'env', summary: 'В Нижнем мире без полной брони или огнестойкости накрывают перегрев и слабость.' },
  { id: 'end_void_chill', name: 'Пустотный холод Энда', icon: '🌌', color: 'dark_purple', category: 'env', summary: 'В Краю без полной брони или факела в руке наступают мороз и Тьма.' },
  { id: 'thin_air_hypoxia', name: 'Разрежённый воздух', icon: '💨', color: 'aqua', category: 'env', summary: 'На пиках выше Y=220 без шлема развивается гипоксия (усталость и замедление).' },
  { id: 'cave_dampness', name: 'Пещерная сырость', icon: '💧', color: 'blue', category: 'env', summary: 'Ниже Y=40 без источника света в руке накатывает зябкая дрожь.' },
  { id: 'desert_mirage', name: 'Пустынный мираж', icon: '🏜', color: 'yellow', category: 'env', summary: 'Днём в пустынях и пустошах без шлема возможны миражи (тошнота и слепота).' },
  { id: 'swamp_miasma', name: 'Болотные миазмы', icon: '🌿', color: 'dark_green', category: 'env', summary: 'В болотных и мангровых биомах без сапог или шлема пробивается отравление.' },
  { id: 'glacial_wind', name: 'Ледниковый ветер', icon: '🧊', color: 'aqua', category: 'env', summary: 'В снежных и ледяных биомах под открытым небом без полной брони морозит.' },
  { id: 'ash_fallout', name: 'Вулканический пепел', icon: '🌋', color: 'dark_gray', category: 'env', summary: 'В непогоду под открытым небом пепел режет глаза и ускоряет голод.' },
  { id: 'magnetic_anomaly', name: 'Магнитная аномалия', icon: '🧲', color: 'light_purple', category: 'env', summary: 'Во время грозы и на глубине Y<0 сбивается ориентация (краткая тошнота).' },

  // 31..40. Category B: Mining, Quarrying & Resource Friction
  { id: 'brittle_stone', name: 'Хрупкая порода', icon: '🪨', color: 'gray', category: 'mining', summary: '25% камня и сланца при ручной добыче крошится в пыль без дропа.' },
  { id: 'dust_lung', name: 'Шахтёрская пыль', icon: '😷', color: 'gray', category: 'mining', summary: 'Добыча камня ниже Y=50 без шлема вызывает приступ кашля (усталость).' },
  { id: 'pocket_cave_in', name: 'Обвал забоя', icon: '⚠', color: 'red', category: 'mining', summary: 'Глубокие выработки (Y<16) с редким шансом вызывают микрообвал (слепота и урон).' },
  { id: 'pickaxe_fatigue', name: 'Перегрев кирки', icon: '⛏', color: 'gold', category: 'mining', summary: 'Добыча глубинного сланца с шансом 30% снимает дополнительную прочность кирки.' },
  { id: 'scarce_coal_seams', name: 'Истощение угля', icon: '🖤', color: 'dark_gray', category: 'mining', summary: '35% угольной руды без Шёлкового касания рассыпается пустой породой.' },
  { id: 'hardened_deepslate', name: 'Сверхплотный сланец', icon: '🧱', color: 'dark_gray', category: 'mining', summary: 'Ломание глубинного сланца кратковременно нагружает руки (усталость на 2 с).' },
  { id: 'unrefined_gravel', name: 'Пустой гравий', icon: '⏳', color: 'gray', category: 'mining', summary: '35% гравия и песка осыпается без выпадения блока и замедляет раскопку.' },
  { id: 'obsidian_strain', name: 'Нагрузка обсидиана', icon: '🟪', color: 'dark_purple', category: 'mining', summary: 'Добыча обсидиана или чёрного камня истощает сытость и даёт слабость.' },
  { id: 'underground_gas_pocket', name: 'Метановый карман', icon: '💨', color: 'green', category: 'mining', summary: 'Вскрытие руд и сланца ниже Y=10 иногда выпускает ядовитый газ.' },
  { id: 'nether_quartz_shard', name: 'Режущий кварц', icon: '💎', color: 'white', category: 'mining', summary: 'Добыча незерских руд без нагрудника ранит острыми осколками.' },

  // 41..50. Category C: Forestry, Agriculture & Logistics Friction
  { id: 'axe_splintering', name: 'Твёрдая древесина', icon: '🪵', color: 'gold', category: 'logistics', summary: 'Топоры при рубке брёвен теряют дополнительную прочность с шансом 35%.' },
  { id: 'blight_crops', name: 'Фитофтора урожая', icon: '🌾', color: 'dark_green', category: 'logistics', summary: '30% собираемых посевов поражается гнилью и не даёт урожая.' },
  { id: 'dry_soil_penalty', name: 'Истощённая почва', icon: '🏜', color: 'yellow', category: 'logistics', summary: 'Полевые работы днём под открытым небом быстрее тратят сытость.' },
  { id: 'heavy_timber_drag', name: 'Тяжёлый лесоповал', icon: '🌲', color: 'dark_green', category: 'logistics', summary: 'Ношение более 192 брёвен в инвентаре замедляет передвижение.' },
  { id: 'rot_in_rain', name: 'Сырость на складе', icon: '🥖', color: 'green', category: 'logistics', summary: 'Урон под дождём портит часть сырой еды и овощей в инвентаре.' },
  { id: 'rusty_rails', name: 'Коррозия экипировки', icon: '⛓', color: 'gray', category: 'logistics', summary: 'Вдали от базы (>600 м) под дождём броня и инструменты быстрее ржавеют.' },
  { id: 'logistics_toll', name: 'Таможенный сбор', icon: '💰', color: 'gold', category: 'logistics', summary: 'Консорциум удерживает 10% комиссии с выручки OpenTTD-компаний.' },
  { id: 'freight_overweight', name: 'Осевая нагрузка', icon: '📦', color: 'gold', category: 'logistics', summary: 'При >=20 занятых слотах и тяжёлом блоке/инструменте в руке снижается скорость.' },
  { id: 'expedition_attrition', name: 'Полевой износ', icon: '🥾', color: 'yellow', category: 'logistics', summary: 'На расстоянии >1000 м от центра (0,0) возрастает расход сытости.' },
  { id: 'fog_disorientation', name: 'Туман трассы', icon: '🌁', color: 'gray', category: 'logistics', summary: 'В дождь на открытых дорогах (Y=60..85) периодически сгущается пелена тумана.' },

  // 51..65. Category D: Hostile Mob Buffs & Combat Escalation
  { id: 'armored_undead', name: 'Бронированная нежить', icon: '🛡', color: 'gray', category: 'combat', summary: '35% зомби и скелетов появляются с эффектом Сопротивления I.' },
  { id: 'swift_creepers', name: 'Реактивные криперы', icon: '💣', color: 'green', category: 'combat', summary: 'Криперы появляются со Скоростью II.' },
  { id: 'toxic_spiders', name: 'Ядовитые пауки', icon: '🕷', color: 'dark_red', category: 'combat', summary: 'Пауки и пещерные пауки получают Скорость I и Силу I.' },
  { id: 'phantom_swarms', name: 'Прыгучие орды', icon: '🦇', color: 'dark_purple', category: 'combat', summary: 'Ночные монстры на поверхности получают Прыгучесть и Сопротивление.' },
  { id: 'skeleton_sharpshooters', name: 'Снайперы-скелеты', icon: '🏹', color: 'white', category: 'combat', summary: 'Скелеты и зимогоры получают Силу I и Скорость I.' },
  { id: 'bloodlust_aggression', name: 'Кровавая ярость', icon: '🩸', color: 'dark_red', category: 'combat', summary: 'При ранении игрока ближайшие монстры получают всплеск Силы.' },
  { id: 'regenerating_horrors', name: 'Регенерация тварей', icon: '❤', color: 'light_purple', category: 'combat', summary: '25% враждебных мобов появляются с Регенерацией I.' },
  { id: 'nether_brutes', name: 'Ярость Незера', icon: '👹', color: 'red', category: 'combat', summary: 'Монстры Нижнего мира спавнятся с Силой I и Сопротивлением I.' },
  { id: 'end_stalkers', name: 'Хранители Края', icon: '👾', color: 'dark_purple', category: 'combat', summary: 'Монстры Края получают Скорость II и Силу I.' },
  { id: 'cavern_predators', name: 'Пещерные хищники', icon: '🦇', color: 'dark_gray', category: 'combat', summary: 'Монстры глубин (Y<20) появляются с Силой I и Сопротивлением I.' },
  { id: 'fireproof_raiders', name: 'Огнеупорные рейдеры', icon: '🪓', color: 'gold', category: 'combat', summary: 'Разбойники, ведьмы и поборники не боятся огня и быстрее бегают.' },
  { id: 'venomous_strikes', name: 'Заражённые когти', icon: '☠', color: 'dark_green', category: 'combat', summary: 'Удары мобов с шансом 25% заражают голодом или отравлением.' },
  { id: 'concussive_blows', name: 'Оглушающие удары', icon: '💫', color: 'yellow', category: 'combat', summary: 'Сильные удары (>=4 HP) оглушают игрока (тошнота и медлительность).' },
  { id: 'armor_piercing_foes', name: 'Бронебойные атаки', icon: '🗡', color: 'red', category: 'combat', summary: 'Удары мобов с шансом 30% дополнительно повреждают случайный элемент брони.' },
  { id: 'cursed_ambush_moon', name: 'Проклятая луна', icon: '🌑', color: 'dark_red', category: 'combat', summary: 'Ночью под открытым небом вокруг путника периодически материализуется нежить.' },

  // 66..80. Category E: Survival, Nutrition & Vitality Penalties
  { id: 'metabolic_burn', name: 'Ускоренный метаболизм', icon: '⚡', color: 'yellow', category: 'survival', summary: 'Спринт в броне быстрее расходует запасы сытости.' },
  { id: 'raw_food_aversion', name: 'Сырая диета', icon: '🥩', color: 'red', category: 'survival', summary: 'Поедание сырой еды вызывает тошноту и голод на 6 с.' },
  { id: 'sugar_crash', name: 'Сахарный спад', icon: '🍪', color: 'gold', category: 'survival', summary: 'Сладкая пища после перекуса оставляет кратковременную слабость.' },
  { id: 'sleep_deprivation', name: 'Хронический недосып', icon: '🥱', color: 'gray', category: 'survival', summary: 'Ночью вдали от дома накладывается усталость на добычу.' },
  { id: 'fragile_bones', name: 'Хрупкие кости', icon: '🦴', color: 'white', category: 'survival', summary: 'Любой существенный урон от падения (>=3 HP) замедляет на 5 с.' },
  { id: 'bleeding_wounds', name: 'Кровотечение', icon: '🩸', color: 'dark_red', category: 'survival', summary: 'Сильные раны (>=6 HP) с шансом 35% вызывают краткое иссушение.' },
  { id: 'panic_adrenaline', name: 'Паника в бою', icon: '💓', color: 'red', category: 'survival', summary: 'При падении здоровья ниже 4 сердец накатывают Тьма и слабость.' },
  { id: 'water_drag', name: 'Тяжёлая вода', icon: '🌊', color: 'blue', category: 'survival', summary: 'Плавание в полной броне замедляет движение в воде.' },
  { id: 'drowning_pressure', name: 'Глубоководный шок', icon: '🫧', color: 'dark_aqua', category: 'survival', summary: 'Погружение под воду ниже Y=50 без шлема вызывает усталость и Тьму.' },
  { id: 'fire_vulnerability', name: 'Горючая экипировка', icon: '🔥', color: 'gold', category: 'survival', summary: 'Горение игрока дополнительно высушивает сытость и повреждает нагрудник.' },
  { id: 'toxin_sensitivity', name: 'Токсический шок', icon: '🧪', color: 'green', category: 'survival', summary: 'Отравление или урон ядом дополнительно накладывают слабость.' },
  { id: 'heavy_shield_stance', name: 'Тяжёлый щит', icon: '🛡', color: 'gray', category: 'survival', summary: 'Удержание щита во второй руке замедляет шаг.' },
  { id: 'combat_exhaustion', name: 'Боевое истощение', icon: '🥵', color: 'yellow', category: 'survival', summary: 'Получение урона в бою с шансом 30% вызывает голод.' },
  { id: 'night_blindness', name: 'Куриная слепота', icon: '🕶', color: 'dark_gray', category: 'survival', summary: 'Ночью без факела в руках зрение заволакивает Тьма.' },
  { id: 'cursed_resurrection', name: 'Тяжкое возрождение', icon: '⚰', color: 'dark_purple', category: 'survival', summary: 'После каждого возрождения на 20 с накладываются слабость и голод.' },

  // 81..90. Category F: Death, Voidout, Snail & Territory Pressure
  { id: 'snail_sprint_surge', name: 'Ускорение Улитки', icon: '🐌', color: 'red', category: 'pressure', summary: 'Бессмертная Улитка преследует игрока на 35% быстрее.' },
  { id: 'snail_short_grace', name: 'Короткая передышка', icon: '⏱', color: 'dark_red', category: 'pressure', summary: 'Перезарядка Улитки после убийства сокращается вдвое (60 с).' },
  { id: 'voidout_aftershock', name: 'Вторичный выброс', icon: '💥', color: 'dark_red', category: 'pressure', summary: 'Сила взрыва Voidout увеличивается на +25%.' },
  { id: 'death_xp_wipe', name: 'Потеря опыта', icon: '✨', color: 'light_purple', category: 'pressure', summary: 'Смерть дополнительно сжигает половину накопленного опыта игрока.' },
  { id: 'border_edge_static', name: 'Помехи периметра', icon: '🚧', color: 'red', category: 'pressure', summary: 'В пределах 64 м от границы мира накрывают Тьма и слабость.' },
  { id: 'gas_early_rise', name: 'Усиленный токсичный газ', icon: '☣', color: 'dark_green', category: 'pressure', summary: 'Потолок сезонного токсичного газа поднимается на +16 блоков выше (до Y=130).' },
  { id: 'gas_corrosive_cloud', name: 'Едкий туман', icon: '🌫', color: 'green', category: 'pressure', summary: 'Токсичный газ быстрее разъедает броню и усиливает отравление.' },
  { id: 'respawn_disorientation', name: 'Смещение координат', icon: '🌀', color: 'aqua', category: 'pressure', summary: 'Случайное возрождение вызывает 8 с тошноты и Тьмы.' },
  { id: 'cargo_piracy_risk', name: 'Риск перевозки', icon: '📜', color: 'gold', category: 'pressure', summary: 'Перевозка грузовой накладной снижает скорость пешком на 10%.' },
  { id: 'bot_cartel_surge', name: 'Картельный прессинг', icon: '🏦', color: 'gold', category: 'pressure', summary: 'Стоимость захвата новых секторов OpenTTD возрастает на +20%.' },

  // 91..100. Category G: Industrial, Arcane & Late-Game Escalation
  { id: 'arcane_backlash', name: 'Магическая отдача', icon: '🪄', color: 'light_purple', category: 'late', summary: 'Урон с магическим жезлом/фокусом в руке вызывает краткую левитацию и Тьму.' },
  { id: 'kinetic_overload', name: 'Кинетическая перегрузка', icon: '⚙', color: 'gold', category: 'late', summary: 'Ношение >4 тяжёлых механизмов Create/IE в инвентаре накладывает слабость.' },
  { id: 'voltage_shock', name: 'Статический разряд', icon: '⚡', color: 'yellow', category: 'late', summary: 'Использование механизмов/инструментов под дождём может ударить разрядом (1 HP).' },
  { id: 'radiation_sickness_plus', name: 'Изотопный фон', icon: '☢', color: 'green', category: 'late', summary: 'Ношение уранового/ториевого/плутониевого топлива без полной брони вызывает иссушение.' },
  { id: 'draconic_resonance', name: 'Драконий резонанс', icon: '🐉', color: 'dark_purple', category: 'late', summary: 'Предметы Draconic Evolution при получении урона вызывают вспышку ослепления.' },
  { id: 'magnetic_interference', name: 'Электромагнитный шум', icon: '📡', color: 'aqua', category: 'late', summary: 'На глубине Y<0 в полной броне периодически гаснет обзор (Тьма).' },
  { id: 'industrial_smog_zone', name: 'Промзона', icon: '🏭', color: 'dark_gray', category: 'late', summary: 'Работа с механизмами и рудами ниже Y=80 без шлема накладывает усталость.' },
  { id: 'overheated_reactor_aura', name: 'Тепловой след', icon: '🌡', color: 'red', category: 'late', summary: 'В Нижнем мире и рядом с реакторным топливом вдвое быстрее уходит сытость.' },
  { id: 'void_echo_whispers', name: 'Эхо пустоты', icon: '👁', color: 'dark_purple', category: 'late', summary: 'Ниже Y=-32 или в Краю периодически накатывает Тьма и шёпот пустоты.' },
  { id: 'doomed_final_protocol', name: 'Протокол Судного Дня', icon: '💀', color: 'dark_red', category: 'late', summary: 'Ночные монстры получают Регенерацию, а добыча вдали от спауна замедляется.' }
];

global.LHOpenTTD = (function () {
  var SECTOR_SIZE = 256; // 16x16 chunks per sector, centered at (sx*256, sz*256)
  var BASE_CLAIM_COST = 250;
  var BASE_FORTIFY_COST = 200;
  var SPEC_SWITCH_COST = 500;
  var STARTING_CASH = 1000;

  var TRANSPORT_SPECS = {
    rail: {
      id: 'rail',
      name: 'Железнодорожная корпорация',
      icon: '🚆',
      telemetryFamily: 'rail',
      payoutBonus: 0.45,
      claimDiscount: 0.35,
      summary: '+45% выручки с ж/д маршрутов и контрактов, -35% цена захвата секторов, ускорение на поездах/вагонетках.'
    },
    road: {
      id: 'road',
      name: 'Автотранспортный конвой',
      icon: '🚚',
      telemetryFamily: 'road_vehicle',
      payoutBonus: 0.45,
      claimDiscount: 0.20,
      summary: '+45% выручки с авто/повозок, +8 слотов к лимиту перегруза, скидка 20% на захват секторов.'
    },
    sea: {
      id: 'sea',
      name: 'Морское пароходство',
      icon: '🚢',
      telemetryFamily: 'watercraft',
      payoutBonus: 0.50,
      claimDiscount: 0.25,
      summary: '+50% выручки на воде и в портовых узлах, водное дыхание и скорость на воде, скидка 25% на захват.'
    },
    air: {
      id: 'air',
      name: 'Воздушный флот',
      icon: '✈',
      telemetryFamily: 'aircraft_vs',
      payoutBonus: 0.50,
      claimDiscount: 0.25,
      summary: '+50% выручки на авиа/VS-судах, иммунитет к высотному морозу, страховка от падений, скидка 25% на захват.'
    }
  };

  var RESOURCE_SPECS = {
    mining: {
      id: 'mining',
      name: 'Горно-рудный холдинг',
      icon: '⛏',
      yieldBonus: 0.35,
      scarcityReduction: 0.70,
      summary: '+35% добычи руды и снижение потерь «Рудного голода» с 50% до 15%.'
    },
    forestry: {
      id: 'forestry',
      name: 'Лесозаготовительный трест',
      icon: '🪓',
      yieldBonus: 0.35,
      scarcityReduction: 0.75,
      summary: '+35% выхода древесины/угля и снижение потерь «Дефицита леса» с 40% до 10%.'
    },
    agro: {
      id: 'agro',
      name: 'Аграрный синдикат',
      icon: '🌾',
      yieldBonus: 0.35,
      contractBonus: 0.40,
      summary: '+35% урожая, +40% оплаты за продовольственные заказы и защита от брожения еды.'
    },
    energy: {
      id: 'energy',
      name: 'Энергетика и химия',
      icon: '☢',
      yieldBonus: 0.40,
      hazardMitigation: true,
      summary: '+40% прибыли с нефти/урана/драконика и ослабление радиационного и кислотного фона.'
    }
  };

  var DEFAULT_BOT_COMPANIES = [
    {
      id: 'bot_ironrail',
      name: 'Стальная Магистраль',
      color: 'gold',
      colorCode: '§6',
      tag: 'IRON',
      transportSpec: 'rail',
      resourceSpec: 'mining',
      hqSx: 2,
      hqSz: 0,
      cash: 1500
    },
    {
      id: 'bot_greencart',
      name: 'Зелёный Обоз',
      color: 'green',
      colorCode: '§a',
      tag: 'AGRO',
      transportSpec: 'road',
      resourceSpec: 'agro',
      hqSx: -2,
      hqSz: 0,
      cash: 1500
    },
    {
      id: 'bot_skyport',
      name: 'Небесный Альянс',
      color: 'aqua',
      colorCode: '§b',
      tag: 'AERO',
      transportSpec: 'air',
      resourceSpec: 'energy',
      hqSx: 0,
      hqSz: -2,
      cash: 1500
    }
  ];

  var BOT_ORDER_TEMPLATES = {
    bot_ironrail: {
      buy: [
        { item: 'minecraft:iron_ingot', qty: 16, price: 110 },
        { item: 'minecraft:coal', qty: 32, price: 85 },
        { item: 'longhaul:ore_concentrate', qty: 4, price: 190 }
      ],
      sell: [
        { item: 'create:track', qty: 32, price: 140 },
        { item: 'create:brass_ingot', qty: 8, price: 160 },
        { item: 'longhaul:machine_parts', qty: 4, price: 240 }
      ]
    },
    bot_greencart: {
      buy: [
        { item: 'minecraft:oak_log', qty: 32, price: 80 },
        { item: 'longhaul:treated_timber', qty: 4, price: 170 },
        { item: 'minecraft:wheat', qty: 32, price: 75 }
      ],
      sell: [
        { item: 'minecraft:bread', qty: 16, price: 70 },
        { item: 'longhaul:field_rations', qty: 4, price: 180 },
        { item: 'minecraft:cooked_beef', qty: 12, price: 95 }
      ]
    },
    bot_skyport: {
      buy: [
        { item: 'longhaul:technical_oil', qty: 4, price: 220 },
        { item: 'longhaul:marine_reagent', qty: 4, price: 210 },
        { item: 'minecraft:copper_ingot', qty: 24, price: 115 }
      ],
      sell: [
        { item: 'longhaul:technical_glass', qty: 4, price: 210 },
        { item: 'longhaul:refractory_mix', qty: 4, price: 205 },
        { item: 'create:precision_mechanism', qty: 2, price: 260 }
      ]
    }
  };

  var PLAYER_COLORS = ['§9', '§d', '§e', '§c', '§3', '§5', '§f'];

  var BUILDING_CATALOG = {
    mine_shaft: {
      id: 'mine_shaft',
      category: 'extraction',
      categoryName: 'Добыча',
      name: 'Шахта',
      icon: 'minecraft:iron_pickaxe',
      mapSym: 'M',
      cost: 320,
      baseIncome: 38,
      baseProduct: 'minecraft:raw_iron',
      baseQty: 6,
      summary: 'Добывает руды в захваченном секторе и приносит стабильный доход.',
      tier1Fork: [
        {
          id: 'deep_bore',
          name: 'Глубокое бурение',
          icon: 'minecraft:diamond_pickaxe',
          cost: 420,
          incomeMult: 1.75,
          yieldMult: 1.25,
          bonusProduct: 'minecraft:raw_gold',
          bonusQty: 3,
          summary: '+75% дохода Cr и редкая золотая жила (+3 золота/цикл). Блокирует Открытый карьер.'
        },
        {
          id: 'strip_mining',
          name: 'Открытый карьер',
          icon: 'create:mechanical_drill',
          cost: 380,
          incomeMult: 1.35,
          yieldMult: 2.25,
          bonusProduct: 'minecraft:coal',
          bonusQty: 8,
          summary: '×2.25 объёма базовой руды и +8 угля/цикл. Блокирует Глубокое бурение.'
        }
      ],
      tier2Fork: [
        {
          id: 'seismic_charges',
          name: 'Сейсмические заряды',
          icon: 'minecraft:tnt',
          cost: 760,
          incomeMult: 1.65,
          yieldMult: 1.40,
          summary: '+65% прибыли и +40% объёма добычи. Блокирует Роботизированный ствол.'
        },
        {
          id: 'automated_hoist',
          name: 'Роботизированный ствол',
          icon: 'create:brass_funnel',
          cost: 720,
          incomeMult: 1.40,
          yieldMult: 1.75,
          summary: '+75% выпуска ресурсов и 2× ёмкость склада. Блокирует Сейсмические заряды.'
        }
      ]
    },
    oil_rig: {
      id: 'oil_rig',
      category: 'extraction',
      categoryName: 'Добыча',
      name: 'Нефтяная вышка',
      icon: 'minecraft:bucket',
      mapSym: 'O',
      cost: 420,
      baseIncome: 48,
      baseProduct: 'longhaul:technical_oil',
      baseQty: 2,
      summary: 'Качает нефтепродукты и техническое масло в секторе компании.',
      tier1Fork: [
        {
          id: 'field_cracking',
          name: 'Полевой крекинг',
          icon: 'minecraft:blaze_powder',
          cost: 480,
          incomeMult: 1.80,
          yieldMult: 1.30,
          bonusProduct: 'minecraft:redstone',
          bonusQty: 6,
          summary: '+80% выручки и побочная химия (+6 редстоуна/цикл). Блокирует Сверхвысокое давление.'
        },
        {
          id: 'high_pressure_pump',
          name: 'Сверхвысокое давление',
          icon: 'create:fluid_pipe',
          cost: 450,
          incomeMult: 1.30,
          yieldMult: 2.00,
          bonusProduct: 'longhaul:technical_oil',
          bonusQty: 2,
          summary: '×2.0 дебит нефти (+2 тех. масла/цикл). Блокирует Полевой крекинг.'
        }
      ],
      tier2Fork: [
        {
          id: 'offshore_platform',
          name: 'Морская платформа',
          icon: 'minecraft:prismarine_shard',
          cost: 840,
          incomeMult: 1.70,
          yieldMult: 1.35,
          summary: '+70% дохода и экспортная премия. Блокирует Газлифт-контур.'
        },
        {
          id: 'gas_lift_loop',
          name: 'Газлифт-контур',
          icon: 'create:steam_engine',
          cost: 800,
          incomeMult: 1.35,
          yieldMult: 1.80,
          summary: '+80% выпуска нефтепродуктов. Блокирует Морскую платформу.'
        }
      ]
    },
    warehouse: {
      id: 'warehouse',
      category: 'logistics',
      categoryName: 'Логистика',
      name: 'Логистический склад',
      icon: 'minecraft:barrel',
      mapSym: 'W',
      cost: 300,
      baseIncome: 34,
      baseProduct: 'create:iron_sheet',
      baseQty: 4,
      summary: 'Ускоряет оборот грузов, снижает экспансию (-10% захват/склад) и хранит сырьё.',
      tier1Fork: [
        {
          id: 'customs_hub',
          name: 'Таможенный терминал',
          icon: 'minecraft:emerald',
          cost: 390,
          incomeMult: 1.85,
          yieldMult: 1.20,
          bonusProduct: 'minecraft:gold_nugget',
          bonusQty: 9,
          summary: '+85% дохода с транзита и торговый сбор. Блокирует Распределительный узел.'
        },
        {
          id: 'distribution_hub',
          name: 'Распределительный узел',
          icon: 'create:package_frogport',
          cost: 370,
          incomeMult: 1.35,
          yieldMult: 2.00,
          bonusProduct: 'create:andesite_alloy',
          bonusQty: 6,
          summary: '×2.0 запаса материалов и +6 андезитового сплава/цикл. Блокирует Таможенный терминал.'
        }
      ],
      tier2Fork: [
        {
          id: 'bonded_vault',
          name: 'Таможенный сейф',
          icon: 'minecraft:iron_block',
          cost: 700,
          incomeMult: 1.75,
          yieldMult: 1.25,
          summary: '+75% пассивной прибыли и усиленная охрана сектора. Блокирует Конвейер-док.'
        },
        {
          id: 'cross_dock',
          name: 'Кросс-докинг платформа',
          icon: 'create:belt_connector',
          cost: 680,
          incomeMult: 1.35,
          yieldMult: 1.85,
          summary: '+85% отгрузки деталей и грузов. Блокирует Таможенный сейф.'
        }
      ]
    },
    airport: {
      id: 'airport',
      category: 'logistics',
      categoryName: 'Логистика',
      name: 'Грузовой аэропорт',
      icon: 'minecraft:elytra',
      mapSym: 'A',
      cost: 560,
      baseIncome: 68,
      baseProduct: 'create:brass_ingot',
      baseQty: 3,
      summary: 'Магистральный воздушный узел компании: высокая выручка и дальний экспорт.',
      tier1Fork: [
        {
          id: 'heavy_airlift',
          name: 'Тяжёлые дирижабли',
          icon: 'minecraft:phantom_membrane',
          cost: 540,
          incomeMult: 1.75,
          yieldMult: 1.40,
          bonusProduct: 'create:brass_ingot',
          bonusQty: 3,
          summary: '+75% доходов от авиафрахта и +3 латуни/цикл. Блокирует Диспетчерский радар.'
        },
        {
          id: 'atc_radar',
          name: 'Диспетчерский радар',
          icon: 'minecraft:spyglass',
          cost: 500,
          incomeMult: 1.45,
          yieldMult: 1.80,
          bonusProduct: 'minecraft:copper_ingot',
          bonusQty: 8,
          summary: '+80% пропускной способности и +8 меди/цикл. Блокирует Тяжёлые дирижабли.'
        }
      ],
      tier2Fork: [
        {
          id: 'continental_runway',
          name: 'Трансконтинентальная ВПП',
          icon: 'minecraft:nether_star',
          cost: 960,
          incomeMult: 1.80,
          yieldMult: 1.35,
          summary: '+80% сверхприбыли от межконтинентальных рейсов. Блокирует Автопилот-сеть.'
        },
        {
          id: 'drone_apron',
          name: 'Автономный перрон',
          icon: 'computercraft:wireless_modem_advanced',
          cost: 920,
          incomeMult: 1.40,
          yieldMult: 1.90,
          summary: '+90% товарного потока без простоя. Блокирует Трансконтинентальную ВПП.'
        }
      ]
    },
    factory: {
      id: 'factory',
      category: 'production',
      categoryName: 'Производство',
      name: 'Завод',
      icon: 'create:mechanical_press',
      mapSym: 'F',
      cost: 480,
      baseIncome: 58,
      baseProduct: 'create:iron_sheet',
      baseQty: 8,
      summary: 'Штампует промышленные комплектующие, пластины и детали механизмов.',
      tier1Fork: [
        {
          id: 'mass_assembly',
          name: 'Конвейерный цех',
          icon: 'create:cogwheel',
          cost: 460,
          incomeMult: 1.40,
          yieldMult: 2.10,
          bonusProduct: 'create:iron_sheet',
          bonusQty: 6,
          summary: '×2.1 выпуска пластин (+6/цикл). Блокирует Точное приборостроение.'
        },
        {
          id: 'precision_tooling',
          name: 'Точное приборостроение',
          icon: 'create:precision_mechanism',
          cost: 520,
          incomeMult: 1.85,
          yieldMult: 1.25,
          bonusProduct: 'longhaul:machine_parts',
          bonusQty: 1,
          summary: '+85% прибыли и выпуск Прецизионных узлов (+1/цикл). Блокирует Конвейерный цех.'
        }
      ],
      tier2Fork: [
        {
          id: 'overclocked_stamping',
          name: 'Форсированная штамповка',
          icon: 'create:blaze_burner',
          cost: 880,
          incomeMult: 1.75,
          yieldMult: 1.45,
          summary: '+75% дохода и +45% продукции. Блокирует Безотходный цикл.'
        },
        {
          id: 'zero_waste_line',
          name: 'Безотходная автоматика',
          icon: 'create:deployer',
          cost: 840,
          incomeMult: 1.40,
          yieldMult: 1.95,
          summary: '+95% товарного выхода со станков. Блокирует Форсированную штамповку.'
        }
      ]
    },
    refinery: {
      id: 'refinery',
      category: 'production',
      categoryName: 'Производство',
      name: 'Перерабатывающая станция',
      icon: 'minecraft:blast_furnace',
      mapSym: 'R',
      cost: 540,
      baseIncome: 64,
      baseProduct: 'longhaul:ore_concentrate',
      baseQty: 2,
      summary: 'Обогащает руду и синтезирует химические реагенты и концентраты.',
      tier1Fork: [
        {
          id: 'ore_enrichment',
          name: 'Обогащение руд',
          icon: 'longhaul:ore_concentrate',
          cost: 500,
          incomeMult: 1.50,
          yieldMult: 2.00,
          bonusProduct: 'longhaul:ore_concentrate',
          bonusQty: 1,
          summary: '×2.0 выхода рудного концентрата (+1/цикл). Блокирует Нефтехимический синтез.'
        },
        {
          id: 'petrochem_synth',
          name: 'Нефтехимический синтез',
          icon: 'longhaul:refractory_mix',
          cost: 540,
          incomeMult: 1.90,
          yieldMult: 1.30,
          bonusProduct: 'longhaul:technical_glass',
          bonusQty: 2,
          summary: '+90% прибыли и +2 тех. стекла/цикл. Блокирует Обогащение руд.'
        }
      ],
      tier2Fork: [
        {
          id: 'catalytic_tower',
          name: 'Каталитическая колонна',
          icon: 'minecraft:brewing_stand',
          cost: 920,
          incomeMult: 1.80,
          yieldMult: 1.40,
          summary: '+80% выручки от тонкой переработки. Блокирует Крио-ректификацию.'
        },
        {
          id: 'cryo_rectification',
          name: 'Крио-ректификация',
          icon: 'minecraft:packed_ice',
          cost: 890,
          incomeMult: 1.45,
          yieldMult: 1.90,
          summary: '+90% выхода химикатов и концентратов. Блокирует Каталитическую колонну.'
        }
      ]
    }
  };

  function ensureDiplomacyState(state) {
    if (!state.buildings) state.buildings = {};
    if (!state.relations) state.relations = {};
    if (!state.supplyContracts) state.supplyContracts = [];
    if (!state.sectorOffers) state.sectorOffers = [];
    if (!(state.nextBuildingSeq > 0)) state.nextBuildingSeq = 1;
    if (!(state.nextSupplySeq > 0)) state.nextSupplySeq = 1;
    return state;
  }

  function relationKey(a, b) {
    return a < b ? (a + '|' + b) : (b + '|' + a);
  }

  function getRelation(state, a, b) {
    ensureDiplomacyState(state);
    if (!a || !b || a === b) {
      return { score: 100, alliance: true, transit: {}, mining: {}, trespassCount: 0, griefCount: 0, lastIncident: '' };
    }
    var k = relationKey(a, b);
    if (!state.relations[k]) {
      state.relations[k] = {
        score: 0,
        alliance: false,
        transit: {},
        mining: {},
        trespassCount: 0,
        griefCount: 0,
        lastIncident: ''
      };
    }
    var r = state.relations[k];
    if (!r.transit) r.transit = {};
    if (!r.mining) r.mining = {};
    return r;
  }

  function getStandingLabel(score) {
    var s = Number(score || 0);
    if (s >= 60) return 'Альянс / Дружба';
    if (s >= 20) return 'Дружелюбие';
    if (s > -20) return 'Нейтралитет';
    if (s > -50) return 'Недовольство';
    return 'Вражда';
  }

  function adjustRelation(state, a, b, delta, reason) {
    if (!a || !b || a === b) return 100;
    var r = getRelation(state, a, b);
    r.score = Math.max(-100, Math.min(100, Math.round(Number(r.score || 0) + Number(delta || 0))));
    if (reason) r.lastIncident = String(reason).slice(0, 120);
    if (r.score <= -50 && r.alliance) {
      r.alliance = false;
      if (state.pacts) delete state.pacts[pactKey(a, b)];
    }
    return r.score;
  }

  function isAllied(state, a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    var r = getRelation(state, a, b);
    return !!r.alliance;
  }

  function canTransit(state, visitorCid, ownerCid) {
    if (!ownerCid || !visitorCid || visitorCid === ownerCid) return true;
    var r = getRelation(state, visitorCid, ownerCid);
    if (r.alliance) return true;
    if (r.transit && r.transit[visitorCid]) return true;
    return false;
  }

  function canMine(state, visitorCid, ownerCid) {
    if (!ownerCid || !visitorCid || visitorCid === ownerCid) return true;
    var r = getRelation(state, visitorCid, ownerCid);
    if (r.alliance) return true;
    if (r.mining && r.mining[visitorCid]) return true;
    return false;
  }

  function buyLicense(state, buyerCid, ownerCid, kind) {
    ensureDiplomacyState(state);
    var buyer = state.companies && state.companies[buyerCid];
    var owner = state.companies && state.companies[ownerCid];
    if (!buyer || !owner || buyerCid === ownerCid) return { ok: false, reason: 'bad_company' };
    var rel = getRelation(state, buyerCid, ownerCid);
    if (rel.score <= -75) return { ok: false, reason: 'hostile', score: rel.score };
    if (rel.alliance) return { ok: false, reason: 'already_allied' };
    var k = kind === 'mining' ? 'mining' : 'transit';
    var map = k === 'mining' ? rel.mining : rel.transit;
    if (map[buyerCid]) return { ok: false, reason: 'already_owned' };
    var base = k === 'mining' ? 240 : 120;
    var mult = rel.score < 0 ? (1.0 + Math.abs(rel.score) / 100.0) : Math.max(0.70, 1.0 - rel.score / 250.0);
    var cost = Math.round(base * mult);
    if (buyer.cash < cost) return { ok: false, reason: 'no_cash', cost: cost, cash: buyer.cash };
    buyer.cash -= cost;
    owner.cash += cost;
    map[buyerCid] = true;
    adjustRelation(state, buyerCid, ownerCid, 6, 'Покупка лицензии: ' + k);
    return { ok: true, kind: k, cost: cost, newScore: rel.score };
  }

  function formOrBreakAlliance(state, cidA, cidB, action) {
    ensureDiplomacyState(state);
    var compA = state.companies && state.companies[cidA];
    var compB = state.companies && state.companies[cidB];
    if (!compA || !compB || cidA === cidB) return { ok: false, reason: 'bad_company' };
    var rel = getRelation(state, cidA, cidB);
    if (action === 'break') {
      if (!rel.alliance) return { ok: false, reason: 'not_allied' };
      rel.alliance = false;
      if (state.pacts) delete state.pacts[pactKey(cidA, cidB)];
      adjustRelation(state, cidA, cidB, -25, 'Разрыв альянса');
      return { ok: true, allied: false, score: rel.score };
    }
    if (action === 'gift') {
      var giftCost = 100;
      if (compA.cash < giftCost) return { ok: false, reason: 'no_cash', cost: giftCost };
      compA.cash -= giftCost;
      compB.cash += giftCost;
      var ns = adjustRelation(state, cidA, cidB, 15, 'Дипломатический жест');
      return { ok: true, gifted: true, cost: giftCost, score: ns };
    }
    if (rel.alliance) return { ok: false, reason: 'already_allied' };
    if (compB.isBot && rel.score < 15 && !hasPact(state, cidA, cidB)) {
      return { ok: false, reason: 'low_relation', score: rel.score, needScore: 15 };
    }
    var fee = 250;
    if (compA.cash < fee) return { ok: false, reason: 'no_cash', cost: fee, cash: compA.cash };
    compA.cash -= fee;
    compB.cash += Math.round(fee * 0.5);
    rel.alliance = true;
    rel.transit[cidA] = true;
    rel.transit[cidB] = true;
    rel.mining[cidA] = true;
    rel.mining[cidB] = true;
    state.pacts[pactKey(cidA, cidB)] = true;
    adjustRelation(state, cidA, cidB, 30, 'Подписан альянс');
    return { ok: true, allied: true, cost: fee, score: rel.score };
  }

  function recordTerritoryViolation(state, intruderCid, ownerCid, kind, sx, sz) {
    ensureDiplomacyState(state);
    if (!ownerCid || intruderCid === ownerCid) return { violated: false };
    var owner = state.companies && state.companies[ownerCid];
    if (!owner) return { violated: false };
    var isMine = kind === 'break_block' || kind === 'break_ore';
    if (isMine && intruderCid && canMine(state, intruderCid, ownerCid)) return { violated: false };
    if (!isMine && intruderCid && canTransit(state, intruderCid, ownerCid)) return { violated: false };

    var delta = kind === 'break_ore' ? -12 : (kind === 'break_block' ? -5 : -4);
    var fine = kind === 'break_ore' ? 20 : (kind === 'break_block' ? 10 : 8);
    var paid = 0;
    var rel = null;
    if (intruderCid && state.companies[intruderCid]) {
      rel = getRelation(state, intruderCid, ownerCid);
      if (isMine) rel.griefCount = (rel.griefCount || 0) + 1;
      else rel.trespassCount = (rel.trespassCount || 0) + 1;
      adjustRelation(state, intruderCid, ownerCid, delta, (isMine ? 'Добыча в (' : 'Нарушение границ (') + sx + ',' + sz + ')');
      var intr = state.companies[intruderCid];
      if (intr.cash >= fine) {
        intr.cash -= fine;
        owner.cash += fine;
        paid = fine;
      }
    }
    var scNow = rel ? rel.score : -10;
    return {
      violated: true,
      kind: kind,
      delta: delta,
      fine: paid,
      newScore: scNow,
      standing: getStandingLabel(scNow),
      hostile: scNow <= -40
    };
  }

  function diplomaticBuySector(state, buyerCid, sx, sz) {
    ensureDiplomacyState(state);
    var buyer = state.companies && state.companies[buyerCid];
    var info = resolveSectorOwner(state, sx, sz);
    if (!buyer || info.kind !== 'claimed' || !info.owner || info.owner === buyerCid) {
      return { ok: false, reason: 'not_owned_by_other' };
    }
    var seller = state.companies[info.owner];
    if (!seller) return { ok: false, reason: 'no_seller' };
    if (info.isHq && countClaims(state, seller.id) <= 1) return { ok: false, reason: 'last_hq' };
    var rel = getRelation(state, buyerCid, seller.id);
    if (rel.score <= -30) return { ok: false, reason: 'hostile', score: rel.score };
    var mult = rel.alliance ? 0.75 : (rel.score >= 20 ? 0.85 : 1.0);
    var bldg = getSectorBuilding(state, sx, sz);
    var bldgVal = bldg ? (BUILDING_CATALOG[bldg.type] ? BUILDING_CATALOG[bldg.type].cost * bldg.level * 0.6 : 200) : 0;
    var price = Math.round((220 * info.strength + bldgVal) * mult);
    if (buyer.cash < price) return { ok: false, reason: 'no_cash', cost: price, cash: buyer.cash };
    buyer.cash -= price;
    seller.cash += price;
    var k = sectorKey(sx, sz);
    state.claims[k].owner = buyerCid;
    state.claims[k].isHq = false;
    if (bldg) bldg.owner = buyerCid;
    buyer.stats.sectorsCaptured = (buyer.stats.sectorsCaptured || 0) + 1;
    adjustRelation(state, buyerCid, seller.id, 5, 'Мирная покупка сектора (' + sx + ',' + sz + ')');
    return { ok: true, price: price, sellerName: seller.name, newScore: rel.score };
  }

  function offerSectorSale(state, sellerCid, buyerCid, sx, sz, price) {
    ensureDiplomacyState(state);
    var k = sectorKey(sx, sz);
    var cl = state.claims[k];
    if (!cl || cl.owner !== sellerCid) return { ok: false, reason: 'not_owned' };
    if (cl.isHq && countClaims(state, sellerCid) <= 1) return { ok: false, reason: 'last_hq' };
    if (!state.companies[buyerCid] || buyerCid === sellerCid) return { ok: false, reason: 'bad_buyer' };
    var pr = Math.max(10, Math.round(Number(price || 200)));
    var offer = {
      id: 'so' + (state.nextOrderSeq++),
      sellerCid: sellerCid,
      buyerCid: buyerCid,
      sx: sx,
      sz: sz,
      price: pr,
      status: 'open'
    };
    state.sectorOffers.push(offer);
    return { ok: true, offer: offer };
  }

  function acceptSectorOffer(state, buyerCid, offerId) {
    ensureDiplomacyState(state);
    var offer = null;
    for (var i = 0; i < state.sectorOffers.length; i++) {
      if (state.sectorOffers[i].id === offerId && state.sectorOffers[i].status === 'open') {
        offer = state.sectorOffers[i];
        break;
      }
    }
    if (!offer || offer.buyerCid !== buyerCid) return { ok: false, reason: 'not_found' };
    var buyer = state.companies[buyerCid];
    var seller = state.companies[offer.sellerCid];
    var k = sectorKey(offer.sx, offer.sz);
    var cl = state.claims[k];
    if (!buyer || !seller || !cl || cl.owner !== offer.sellerCid) return { ok: false, reason: 'invalid_state' };
    if (buyer.cash < offer.price) return { ok: false, reason: 'no_cash', cost: offer.price };
    buyer.cash -= offer.price;
    seller.cash += offer.price;
    cl.owner = buyerCid;
    cl.isHq = false;
    var bldg = getSectorBuilding(state, offer.sx, offer.sz);
    if (bldg) bldg.owner = buyerCid;
    offer.status = 'completed';
    adjustRelation(state, buyerCid, seller.id, 6, 'Сделка по сектору');
    return { ok: true, offer: offer };
  }

  function getSectorBuilding(state, sx, sz) {
    ensureDiplomacyState(state);
    return state.buildings[sectorKey(sx, sz)] || null;
  }

  function listCompanyBuildings(state, cid) {
    ensureDiplomacyState(state);
    var out = [];
    var keys = Object.keys(state.buildings);
    for (var i = 0; i < keys.length; i++) {
      var b = state.buildings[keys[i]];
      if (b && b.owner === cid) out.push(b);
    }
    return out;
  }

  function buildCompanyBuilding(state, cid, sx, sz, bType, wx, wy, wz) {
    ensureDiplomacyState(state);
    var comp = state.companies && state.companies[cid];
    if (!comp) return { ok: false, reason: 'no_company' };
    var spec = BUILDING_CATALOG[bType];
    if (!spec) return { ok: false, reason: 'bad_type' };
    var k = sectorKey(sx, sz);
    var cl = state.claims[k];
    if (!cl || cl.owner !== cid) return { ok: false, reason: 'not_your_sector' };
    if (state.buildings[k]) return { ok: false, reason: 'already_built', existing: state.buildings[k] };
    if (comp.cash < spec.cost) return { ok: false, reason: 'no_cash', cost: spec.cost, cash: comp.cash };
    comp.cash -= spec.cost;
    var bldg = {
      id: 'b' + (state.nextBuildingSeq++),
      type: bType,
      category: spec.category,
      owner: cid,
      sx: sx,
      sz: sz,
      key: k,
      x: Math.round(Number(wx || sx * SECTOR_SIZE)),
      y: Math.round(Number(wy || 64)),
      z: Math.round(Number(wz || sz * SECTOR_SIZE)),
      level: 1,
      branch1: null,
      locked1: null,
      branch2: null,
      locked2: null,
      cashBuffer: 0,
      stockBuffer: {},
      cyclesDone: 0
    };
    state.buildings[k] = bldg;
    return { ok: true, building: bldg, spec: spec, cost: spec.cost };
  }

  function upgradeCompanyBuilding(state, cid, sx, sz, choiceId) {
    ensureDiplomacyState(state);
    var comp = state.companies && state.companies[cid];
    var b = getSectorBuilding(state, sx, sz);
    if (!comp || !b || b.owner !== cid) return { ok: false, reason: 'not_found' };
    var spec = BUILDING_CATALOG[b.type];
    if (!spec) return { ok: false, reason: 'bad_type' };

    if (b.level === 1) {
      var opts1 = spec.tier1Fork || [];
      var chosen1 = null, locked1 = null;
      for (var i = 0; i < opts1.length; i++) {
        if (opts1[i].id === choiceId) chosen1 = opts1[i];
        else locked1 = opts1[i].id;
      }
      if (!chosen1) return { ok: false, reason: 'bad_choice' };
      if (comp.cash < chosen1.cost) return { ok: false, reason: 'no_cash', cost: chosen1.cost, cash: comp.cash };
      comp.cash -= chosen1.cost;
      b.level = 2;
      b.branch1 = chosen1.id;
      b.locked1 = locked1;
      return { ok: true, building: b, chosen: chosen1, lockedOut: locked1 };
    }
    if (b.level === 2) {
      var opts2 = spec.tier2Fork || [];
      var chosen2 = null, locked2 = null;
      for (var j = 0; j < opts2.length; j++) {
        if (opts2[j].id === choiceId) chosen2 = opts2[j];
        else locked2 = opts2[j].id;
      }
      if (!chosen2) return { ok: false, reason: 'bad_choice' };
      if (comp.cash < chosen2.cost) return { ok: false, reason: 'no_cash', cost: chosen2.cost, cash: comp.cash };
      comp.cash -= chosen2.cost;
      b.level = 3;
      b.branch2 = chosen2.id;
      b.locked2 = locked2;
      return { ok: true, building: b, chosen: chosen2, lockedOut: locked2 };
    }
    return { ok: false, reason: 'max_level' };
  }

  function getBuildingYieldProfile(b) {
    var spec = BUILDING_CATALOG[b.type];
    if (!spec) return { income: 0, items: {} };
    var incMult = 1.0, yMult = 1.0;
    var items = {};
    var f1 = null, f2 = null;
    if (b.branch1 && spec.tier1Fork) {
      for (var i = 0; i < spec.tier1Fork.length; i++) {
        if (spec.tier1Fork[i].id === b.branch1) f1 = spec.tier1Fork[i];
      }
    }
    if (b.branch2 && spec.tier2Fork) {
      for (var j = 0; j < spec.tier2Fork.length; j++) {
        if (spec.tier2Fork[j].id === b.branch2) f2 = spec.tier2Fork[j];
      }
    }
    if (f1) { incMult *= f1.incomeMult; yMult *= f1.yieldMult; }
    if (f2) { incMult *= f2.incomeMult; yMult *= f2.yieldMult; }
    var income = Math.round(spec.baseIncome * incMult);
    items[spec.baseProduct] = Math.max(1, Math.round(spec.baseQty * yMult));
    if (f1 && f1.bonusProduct) {
      items[f1.bonusProduct] = (items[f1.bonusProduct] || 0) + Math.max(1, Math.round((f1.bonusQty || 1) * (f2 ? f2.yieldMult : 1.0)));
    }
    return { income: income, items: items };
  }

  function tickCompanyBuildings(state) {
    ensureDiplomacyState(state);
    var keys = Object.keys(state.buildings);
    var producedCount = 0;
    for (var i = 0; i < keys.length; i++) {
      var b = state.buildings[keys[i]];
      if (!b || !state.companies[b.owner]) continue;
      var prof = getBuildingYieldProfile(b);
      var capCash = prof.income * 8;
      if ((b.cashBuffer || 0) < capCash) {
        b.cashBuffer = Math.min(capCash, (b.cashBuffer || 0) + prof.income);
      }
      if (!b.stockBuffer) b.stockBuffer = {};
      Object.keys(prof.items).forEach(function (iid) {
        var cur = Number(b.stockBuffer[iid] || 0);
        var capItem = prof.items[iid] * 6;
        if (cur < capItem) {
          b.stockBuffer[iid] = Math.min(capItem, cur + prof.items[iid]);
        }
      });
      b.cyclesDone = (b.cyclesDone || 0) + 1;
      producedCount++;
    }
    return producedCount;
  }

  function collectBuildingOutput(state, cid, sx, sz) {
    ensureDiplomacyState(state);
    var comp = state.companies && state.companies[cid];
    var b = getSectorBuilding(state, sx, sz);
    if (!comp || !b || b.owner !== cid) return { ok: false, reason: 'not_found' };
    var cash = Math.round(Number(b.cashBuffer || 0));
    var items = {};
    Object.keys(b.stockBuffer || {}).forEach(function (iid) {
      var q = Math.round(Number(b.stockBuffer[iid] || 0));
      if (q > 0) items[iid] = q;
    });
    if (cash <= 0 && !Object.keys(items).length) return { ok: false, reason: 'empty' };
    comp.cash += cash;
    comp.stats.deliveries = (comp.stats.deliveries || 0) + 1;
    b.cashBuffer = 0;
    b.stockBuffer = {};
    return { ok: true, cash: cash, items: items };
  }

  function createSupplyContract(state, initiatorCid, partnerCid, item, qty, price, batches) {
    ensureDiplomacyState(state);
    if (!state.companies[initiatorCid] || !state.companies[partnerCid] || initiatorCid === partnerCid) {
      return { ok: false, reason: 'bad_company' };
    }
    var q = Math.max(1, Math.round(Number(qty || 16)));
    var p = Math.max(10, Math.round(Number(price || 100)));
    var b = Math.max(1, Math.min(12, Math.round(Number(batches || 3))));
    var c = {
      id: 'sc' + (state.nextSupplySeq++),
      supplierCid: initiatorCid,
      buyerCid: partnerCid,
      item: String(item || 'minecraft:iron_ingot'),
      qty: q,
      price: p,
      remainingBatches: b,
      status: 'open'
    };
    state.supplyContracts.push(c);
    return { ok: true, contract: c };
  }

  function refreshBotSupplyContracts(state) {
    ensureDiplomacyState(state);
    var kept = (state.supplyContracts || []).filter(function (c) {
      return c.status === 'open' && !c.isBot && c.remainingBatches > 0;
    });
    for (var i = 0; i < DEFAULT_BOT_COMPANIES.length; i++) {
      var bot = DEFAULT_BOT_COMPANIES[i];
      var tpl = BOT_ORDER_TEMPLATES[bot.id];
      if (!tpl || !tpl.buy || !tpl.buy.length) continue;
      var bo = tpl.buy[0];
      kept.push({
        id: 'sc' + (state.nextSupplySeq++),
        supplierCid: 'any',
        buyerCid: bot.id,
        isBot: true,
        item: bo.item,
        qty: bo.qty * 2,
        price: Math.round(bo.price * 2.15),
        remainingBatches: 3,
        status: 'open'
      });
    }
    state.supplyContracts = kept;
    return kept.length;
  }

  function fulfillSupplyContract(state, actorCid, contractId) {
    ensureDiplomacyState(state);
    var c = null;
    for (var i = 0; i < state.supplyContracts.length; i++) {
      if (state.supplyContracts[i].id === contractId && state.supplyContracts[i].status === 'open') {
        c = state.supplyContracts[i];
        break;
      }
    }
    if (!c || c.remainingBatches <= 0) return { ok: false, reason: 'not_found' };
    if (c.buyerCid === actorCid) return { ok: false, reason: 'own_contract' };
    if (c.supplierCid !== 'any' && c.supplierCid !== actorCid) return { ok: false, reason: 'wrong_supplier' };
    var actor = state.companies[actorCid];
    var buyer = state.companies[c.buyerCid];
    if (!actor || !buyer) return { ok: false, reason: 'bad_company' };
    if (buyer.cash < c.price) return { ok: false, reason: 'buyer_no_cash' };
    buyer.cash -= c.price;
    actor.cash += c.price;
    actor.stats.tradeVolume = (actor.stats.tradeVolume || 0) + c.price;
    buyer.stats.tradeVolume = (buyer.stats.tradeVolume || 0) + c.price;
    c.remainingBatches -= 1;
    if (c.remainingBatches <= 0) c.status = 'completed';
    var newScore = adjustRelation(state, actorCid, buyer.id, 8, 'Поставка по контракту ' + c.id);
    return { ok: true, contract: c, payout: c.price, buyerName: buyer.name, newScore: newScore };
  }

  function sectorCoords(x, z) {
    var half = SECTOR_SIZE / 2;
    var sx = Math.floor((Number(x || 0) + half) / SECTOR_SIZE);
    var sz = Math.floor((Number(z || 0) + half) / SECTOR_SIZE);
    return {
      sx: sx,
      sz: sz,
      key: sx + ',' + sz,
      centerX: sx * SECTOR_SIZE,
      centerZ: sz * SECTOR_SIZE
    };
  }

  function sectorKey(sx, sz) {
    return sx + ',' + sz;
  }

  function sanitizeId(raw) {
    return String(raw || '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);
  }

  function createInitialState() {
    var st = {
      companies: {},
      playerCompany: {},
      claims: {},
      pacts: {},
      buildings: {},
      relations: {},
      supplyContracts: [],
      sectorOffers: [],
      marketOrders: [],
      tradeOffers: [],
      nextOrderSeq: 1,
      nextBuildingSeq: 1,
      nextSupplySeq: 1,
      subsidy: null,
      botCycle: 0
    };
    ensureBots(st);
    ensureDiplomacyState(st);
    return st;
  }

  function isSpawnProtectedSector(sx, sz) {
    return Math.max(Math.abs(Number(sx || 0)), Math.abs(Number(sz || 0))) <= 1;
  }

  function ensureBots(state) {
    if (!state.companies) state.companies = {};
    if (!state.claims) state.claims = {};
    if (!state.pacts) state.pacts = {};
    if (!state.playerCompany) state.playerCompany = {};
    if (!state.marketOrders) state.marketOrders = [];
    if (!state.tradeOffers) state.tradeOffers = [];
    ensureDiplomacyState(state);

    // Migrate legacy bot claims out of the 3x3 spawn sanctuary (-1..1, -1..1)
    Object.keys(state.claims).forEach(function (ck) {
      var cl = state.claims[ck];
      if (cl && cl.owner && String(cl.owner).indexOf('bot_') === 0 && isSpawnProtectedSector(cl.sx, cl.sz)) {
        delete state.claims[ck];
      }
    });

    for (var i = 0; i < DEFAULT_BOT_COMPANIES.length; i++) {
      var b = DEFAULT_BOT_COMPANIES[i];
      if (!state.companies[b.id]) {
        state.companies[b.id] = {
          id: b.id,
          name: b.name,
          color: b.color,
          colorCode: b.colorCode,
          tag: b.tag,
          isBot: true,
          owner: 'AI',
          members: [],
          cash: b.cash,
          transportSpec: b.transportSpec,
          resourceSpec: b.resourceSpec,
          hqSx: b.hqSx,
          hqSz: b.hqSz,
          stats: { deliveries: 0, tradeVolume: 0, blocksMined: 0, sectorsCaptured: 1, contractsDone: 0, routesDone: 0 }
        };
      } else {
        state.companies[b.id].hqSx = b.hqSx;
        state.companies[b.id].hqSz = b.hqSz;
      }
      var k = sectorKey(b.hqSx, b.hqSz);
      if (!state.claims[k]) {
        state.claims[k] = {
          sx: b.hqSx,
          sz: b.hqSz,
          owner: b.id,
          strength: 2,
          isHq: true
        };
      }
    }
    return state;
  }

  function pactKey(a, b) {
    return a < b ? (a + '|' + b) : (b + '|' + a);
  }

  function hasPact(state, a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    return !!(state.pacts && state.pacts[pactKey(a, b)]);
  }

  function togglePact(state, a, b) {
    if (!a || !b || a === b) return false;
    var k = pactKey(a, b);
    if (state.pacts[k]) {
      delete state.pacts[k];
      return false;
    }
    state.pacts[k] = true;
    return true;
  }

  function countClaims(state, cid) {
    var cnt = 0;
    var keys = Object.keys(state.claims || {});
    for (var i = 0; i < keys.length; i++) {
      if (state.claims[keys[i]] && state.claims[keys[i]].owner === cid) cnt++;
    }
    return cnt;
  }

  function computeValuation(state, cid) {
    var c = state.companies && state.companies[cid];
    if (!c) return 0;
    var claims = countClaims(state, cid);
    var bldgs = listCompanyBuildings(state, cid);
    var bldgValue = 0;
    for (var i = 0; i < bldgs.length; i++) {
      var sp = BUILDING_CATALOG[bldgs[i].type];
      bldgValue += (sp ? sp.cost : 300) * Number(bldgs[i].level || 1);
    }
    var s = c.stats || {};
    return Math.round(
      Number(c.cash || 0) +
      claims * 300 +
      bldgValue +
      Number(s.deliveries || 0) * 45 +
      Number(s.tradeVolume || 0) * 0.5 +
      Number(s.contractsDone || 0) * 200 +
      Number(s.routesDone || 0) * 250
    );
  }

  function collectCompanyAnchors(state) {
    var anchors = [];
    var cids = Object.keys(state.companies || {});
    for (var i = 0; i < cids.length; i++) {
      var c = state.companies[cids[i]];
      anchors.push({ cid: c.id, sx: Number(c.hqSx || 0), sz: Number(c.hqSz || 0), weight: 1.0 });
    }
    var claimKeys = Object.keys(state.claims || {});
    for (var j = 0; j < claimKeys.length; j++) {
      var cl = state.claims[claimKeys[j]];
      if (cl && state.companies[cl.owner]) {
        anchors.push({ cid: cl.owner, sx: cl.sx, sz: cl.sz, weight: 1.0 });
      }
    }
    return anchors;
  }

  function resolveSectorOwner(state, sx, sz) {
    var key = sectorKey(sx, sz);
    if (isSpawnProtectedSector(sx, sz)) {
      return { sx: sx, sz: sz, key: key, owner: null, kind: 'unclaimed', strength: 0, isHq: false, claim: null };
    }
    var cl = state.claims && state.claims[key];
    if (cl && state.companies && state.companies[cl.owner]) {
      return {
        sx: sx,
        sz: sz,
        key: key,
        owner: cl.owner,
        kind: 'claimed',
        strength: Number(cl.strength || 1),
        isHq: !!cl.isHq,
        claim: cl
      };
    }
    var anchors = collectCompanyAnchors(state);
    if (!anchors.length) {
      return { sx: sx, sz: sz, key: key, owner: null, kind: 'unclaimed', strength: 0, isHq: false, claim: null };
    }
    var bestCid = null;
    var bestDist = 1e18;
    for (var i = 0; i < anchors.length; i++) {
      var a = anchors[i];
      var dx = sx - a.sx;
      var dz = sz - a.sz;
      var d2 = dx * dx + dz * dz;
      if (d2 < bestDist || (d2 === bestDist && bestCid !== null && a.cid < bestCid)) {
        bestDist = d2;
        bestCid = a.cid;
      }
    }
    return {
      sx: sx,
      sz: sz,
      key: key,
      owner: bestCid,
      kind: 'voronoi',
      strength: 0,
      isHq: false,
      claim: null
    };
  }

  function isAdjacentOwned(state, cid, sx, sz) {
    var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (var i = 0; i < dirs.length; i++) {
      var k = sectorKey(sx + dirs[i][0], sz + dirs[i][1]);
      var cl = state.claims && state.claims[k];
      if (cl && cl.owner === cid) return true;
    }
    return false;
  }

  function minOwnedSectorDistance(state, cid, sx, sz) {
    var best = 999999;
    var owned = 0;
    var keys = Object.keys(state.claims || {});
    for (var i = 0; i < keys.length; i++) {
      var cl = state.claims[keys[i]];
      if (!cl || cl.owner !== cid) continue;
      owned++;
      var md = Math.abs(sx - cl.sx) + Math.abs(sz - cl.sz);
      if (md < best) best = md;
    }
    if (owned === 0) return 1;
    return best;
  }

  function computeClaimCost(state, cid, sx, sz) {
    var c = state.companies && state.companies[cid];
    if (!c) return { ok: false, reason: 'no_company', cost: BASE_CLAIM_COST };
    if (isSpawnProtectedSector(sx, sz)) {
      return { ok: false, reason: 'spawn_protected', cost: 0, adjacent: false, sectorDist: 0, exclaveMult: 1.0 };
    }
    var ownerInfo = resolveSectorOwner(state, sx, sz);
    var tSpec = c.transportSpec ? TRANSPORT_SPECS[c.transportSpec] : null;
    var disc = tSpec ? Number(tSpec.claimDiscount || 0) : 0;
    var owned = countClaims(state, cid);
    var sectorDist = minOwnedSectorDistance(state, cid, sx, sz);
    var adjacent = sectorDist <= 1;
    var adjDiscount = (owned > 0 && adjacent) ? 0.20 : 0.0;
    var specMult = Math.max(0.40, 1.0 - disc - adjDiscount);
    var exclaveMult = adjacent ? 1.0 : (1.0 + 1.5 * (sectorDist - 1) + 0.5 * (sectorDist - 1) * (sectorDist - 1));

    if (ownerInfo.kind === 'claimed') {
      if (ownerInfo.owner === cid) return { ok: false, reason: 'already_yours', cost: 0, adjacent: true, sectorDist: 0, exclaveMult: 1.0 };
      var baseTakeover = ownerInfo.isHq ? 750 : (240 * ownerInfo.strength);
      var nonAdjSiege = adjacent ? 1.0 : 1.75;
      return {
        ok: true,
        mode: 'capture',
        targetOwner: ownerInfo.owner,
        strength: ownerInfo.strength,
        adjacent: adjacent,
        sectorDist: sectorDist,
        exclaveMult: exclaveMult * nonAdjSiege,
        cost: Math.round(baseTakeover * specMult * exclaveMult * nonAdjSiege)
      };
    }
    return {
      ok: true,
      mode: 'claim',
      targetOwner: ownerInfo.owner,
      strength: 1,
      adjacent: adjacent,
      sectorDist: sectorDist,
      exclaveMult: exclaveMult,
      cost: Math.round(BASE_CLAIM_COST * specMult * exclaveMult)
    };
  }

  function companyCreate(state, playerUuid, rawId, displayName, hqX, hqZ) {
    var cid = sanitizeId(rawId);
    if (!cid || cid.indexOf('bot_') === 0) return { ok: false, reason: 'invalid_id' };
    if (state.companies[cid]) return { ok: false, reason: 'exists' };

    var existing = state.playerCompany[playerUuid];
    if (existing && state.companies[existing]) {
      companyLeave(state, playerUuid);
    }

    var playerCount = 0;
    Object.keys(state.companies).forEach(function (k) {
      if (!state.companies[k].isBot) playerCount++;
    });
    var colorCode = PLAYER_COLORS[playerCount % PLAYER_COLORS.length];
    var sc = sectorCoords(hqX || 0, hqZ || 0);
    if (isSpawnProtectedSector(sc.sx, sc.sz)) {
      var ringCandidates = [
        [0, 2], [2, 2], [-2, 2], [2, -2], [-2, -2],
        [1, 2], [-1, 2], [2, 1], [-2, 1], [2, -1], [-2, -1], [1, -2], [-1, -2],
        [0, 3], [3, 0], [-3, 0], [0, -3]
      ];
      for (var ri = 0; ri < ringCandidates.length; ri++) {
        var rKey = sectorKey(ringCandidates[ri][0], ringCandidates[ri][1]);
        if (!state.claims[rKey]) {
          sc = { sx: ringCandidates[ri][0], sz: ringCandidates[ri][1], key: rKey };
          break;
        }
      }
    }
    var comp = {
      id: cid,
      name: String(displayName || cid).slice(0, 32),
      color: 'blue',
      colorCode: colorCode,
      tag: cid.toUpperCase().slice(0, 4),
      isBot: false,
      owner: playerUuid,
      members: [playerUuid],
      cash: STARTING_CASH,
      transportSpec: null,
      resourceSpec: null,
      hqSx: sc.sx,
      hqSz: sc.sz,
      stats: { deliveries: 0, tradeVolume: 0, blocksMined: 0, sectorsCaptured: 0, contractsDone: 0, routesDone: 0 }
    };
    state.companies[cid] = comp;
    state.playerCompany[playerUuid] = cid;

    // Claim HQ sector if not already claimed by a bot/player HQ
    var cur = state.claims[sc.key];
    if (!cur) {
      state.claims[sc.key] = { sx: sc.sx, sz: sc.sz, owner: cid, strength: 2, isHq: true };
      comp.stats.sectorsCaptured = 1;
    }
    return { ok: true, company: comp };
  }

  function companyJoin(state, playerUuid, rawId) {
    var cid = sanitizeId(rawId);
    var comp = state.companies[cid];
    if (!comp || comp.isBot) return { ok: false, reason: 'not_found' };
    var prev = state.playerCompany[playerUuid];
    if (prev && prev !== cid) companyLeave(state, playerUuid);
    if (comp.members.indexOf(playerUuid) === -1) comp.members.push(playerUuid);
    state.playerCompany[playerUuid] = cid;
    return { ok: true, company: comp };
  }

  function companyLeave(state, playerUuid) {
    var cid = state.playerCompany[playerUuid];
    if (!cid || !state.companies[cid]) return false;
    var comp = state.companies[cid];
    comp.members = comp.members.filter(function (m) { return m !== playerUuid; });
    delete state.playerCompany[playerUuid];
    return true;
  }

  function setSpecialization(state, cid, kind, specId) {
    var comp = state.companies[cid];
    if (!comp) return { ok: false, reason: 'no_company' };
    if (kind === 'transport') {
      if (!TRANSPORT_SPECS[specId]) return { ok: false, reason: 'bad_spec' };
      var switching = !!comp.transportSpec && comp.transportSpec !== specId;
      if (switching && comp.cash < SPEC_SWITCH_COST) return { ok: false, reason: 'no_cash', cost: SPEC_SWITCH_COST };
      if (switching) comp.cash -= SPEC_SWITCH_COST;
      comp.transportSpec = specId;
      return { ok: true, switched: switching, cost: switching ? SPEC_SWITCH_COST : 0, spec: TRANSPORT_SPECS[specId] };
    }
    if (kind === 'resource') {
      if (!RESOURCE_SPECS[specId]) return { ok: false, reason: 'bad_spec' };
      var switchingR = !!comp.resourceSpec && comp.resourceSpec !== specId;
      if (switchingR && comp.cash < SPEC_SWITCH_COST) return { ok: false, reason: 'no_cash', cost: SPEC_SWITCH_COST };
      if (switchingR) comp.cash -= SPEC_SWITCH_COST;
      comp.resourceSpec = specId;
      return { ok: true, switched: switchingR, cost: switchingR ? SPEC_SWITCH_COST : 0, spec: RESOURCE_SPECS[specId] };
    }
    return { ok: false, reason: 'bad_kind' };
  }

  function claimOrCaptureSector(state, cid, sx, sz, allowCapture, opts) {
    var comp = state.companies[cid];
    if (!comp) return { ok: false, reason: 'no_company' };
    var info = computeClaimCost(state, cid, sx, sz);
    if (!info.ok) return info;
    if (opts && opts.remote && !info.adjacent) {
      return { ok: false, reason: 'not_adjacent_remote', sectorDist: info.sectorDist, cost: info.cost };
    }
    if (info.mode === 'capture' && !allowCapture) return { ok: false, reason: 'enemy_claimed', targetOwner: info.targetOwner, cost: info.cost };
    var discountFactor = (opts && opts.discountFactor > 0) ? Number(opts.discountFactor) : 1.0;
    var costMult = (opts && opts.costMultiplier > 0) ? Number(opts.costMultiplier) : 1.0;
    var finalCost = Math.max(10, Math.round(info.cost * discountFactor * costMult));
    if (comp.cash < finalCost) return { ok: false, reason: 'no_cash', cost: finalCost, cash: comp.cash };

    comp.cash -= finalCost;
    if (info.mode === 'capture' && info.targetOwner && state.companies[info.targetOwner]) {
      // Pay 50% compensation into rival company's balance in hostile buyout
      state.companies[info.targetOwner].cash += Math.round(finalCost * 0.5);
    }
    var k = sectorKey(sx, sz);
    state.claims[k] = { sx: sx, sz: sz, owner: cid, strength: 1, isHq: false };
    comp.stats.sectorsCaptured = (comp.stats.sectorsCaptured || 0) + 1;
    return {
      ok: true,
      mode: info.mode,
      cost: finalCost,
      key: k,
      previousOwner: info.targetOwner,
      adjacent: info.adjacent,
      sectorDist: info.sectorDist
    };
  }

  function weakenOrCaptureSector(state, attackerCid, sx, sz, powerLevels, cashCost) {
    var comp = state.companies[attackerCid];
    if (!comp) return { ok: false, reason: 'no_company' };
    var k = sectorKey(sx, sz);
    var cl = state.claims[k];
    if (!cl || !state.companies[cl.owner]) return { ok: false, reason: 'not_claimed' };
    if (cl.owner === attackerCid) return { ok: false, reason: 'already_yours' };
    var cost = Math.max(0, Math.round(Number(cashCost || 0)));
    if (comp.cash < cost) return { ok: false, reason: 'no_cash', cost: cost, cash: comp.cash };

    comp.cash -= cost;
    var prevOwner = cl.owner;
    var dmg = Math.max(1, Math.round(Number(powerLevels || 1)));
    var rem = Number(cl.strength || 1) - dmg;
    if (rem <= 0) {
      state.claims[k] = { sx: sx, sz: sz, owner: attackerCid, strength: 1, isHq: false };
      comp.stats.sectorsCaptured = (comp.stats.sectorsCaptured || 0) + 1;
      return { ok: true, captured: true, previousOwner: prevOwner, newStrength: 1, cost: cost };
    }
    cl.strength = rem;
    return { ok: true, captured: false, previousOwner: prevOwner, newStrength: rem, cost: cost };
  }

  function transferSector(state, fromCid, toCid, sx, sz) {
    var fromComp = state.companies[fromCid];
    var toComp = state.companies[toCid];
    if (!fromComp || !toComp || fromCid === toCid) return { ok: false, reason: 'bad_company' };
    var k = sectorKey(sx, sz);
    var cl = state.claims[k];
    if (!cl || cl.owner !== fromCid) return { ok: false, reason: 'not_owned' };
    if (cl.isHq && countClaims(state, fromCid) <= 1) return { ok: false, reason: 'last_hq' };
    cl.owner = toCid;
    cl.isHq = false;
    cl.strength = 1;
    toComp.stats.sectorsCaptured = (toComp.stats.sectorsCaptured || 0) + 1;
    return { ok: true, key: k, from: fromCid, to: toCid };
  }

  function antitrustSeize(state, attackerCid, sx, sz) {
    var comp = state.companies[attackerCid];
    if (!comp) return { ok: false, reason: 'no_company' };
    var k = sectorKey(sx, sz);
    var cl = state.claims[k];
    if (!cl || !state.companies[cl.owner]) return { ok: false, reason: 'not_claimed' };
    if (cl.owner === attackerCid) return { ok: false, reason: 'already_yours' };
    if (!isAdjacentOwned(state, attackerCid, sx, sz)) return { ok: false, reason: 'not_adjacent' };
    if ((cl.strength || 1) > 1) return { ok: false, reason: 'fortified', strength: cl.strength };
    var target = state.companies[cl.owner];
    var myVal = computeValuation(state, attackerCid);
    var rivalVal = computeValuation(state, target.id);
    if (target.cash >= 100 && myVal < rivalVal * 1.8) {
      return { ok: false, reason: 'antitrust_not_eligible', myVal: myVal, rivalVal: rivalVal, rivalCash: target.cash };
    }
    return claimOrCaptureSector(state, attackerCid, sx, sz, true, { discountFactor: 0.55 });
  }

  function fortifySector(state, cid, sx, sz) {
    var comp = state.companies[cid];
    if (!comp) return { ok: false, reason: 'no_company' };
    var k = sectorKey(sx, sz);
    var cl = state.claims[k];
    if (!cl || cl.owner !== cid) return { ok: false, reason: 'not_owned' };
    if ((cl.strength || 1) >= 4) return { ok: false, reason: 'max_strength' };
    var cost = BASE_FORTIFY_COST * (cl.strength || 1);
    if (comp.cash < cost) return { ok: false, reason: 'no_cash', cost: cost };
    comp.cash -= cost;
    cl.strength = (cl.strength || 1) + 1;
    return { ok: true, strength: cl.strength, cost: cost };
  }

  function botExpandStep(state, maxSectorAbs, rngFn) {
    ensureBots(state);
    state.botCycle = (state.botCycle || 0) + 1;
    var rng = rngFn || Math.random;
    var limit = Math.max(1, Math.floor(Number(maxSectorAbs || 1)));
    var events = [];

    for (var i = 0; i < DEFAULT_BOT_COMPANIES.length; i++) {
      var bot = state.companies[DEFAULT_BOT_COMPANIES[i].id];
      if (!bot) continue;
      var ownedCount = countClaims(state, bot.id);
      var income = 70 + ownedCount * 28;
      bot.cash += income;
      bot.stats.deliveries += 1;

      if (bot.cash >= 650) {
        // Pick an unclaimed sector adjacent to an owned sector within active worldborder, never inside the 3x3 spawn ring
        var candidates = [];
        var claimKeys = Object.keys(state.claims);
        var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (var k = 0; k < claimKeys.length; k++) {
          var cl = state.claims[claimKeys[k]];
          if (!cl || cl.owner !== bot.id) continue;
          for (var d = 0; d < dirs.length; d++) {
            var nsx = cl.sx + dirs[d][0];
            var nsz = cl.sz + dirs[d][1];
            if (isSpawnProtectedSector(nsx, nsz)) continue;
            if (Math.abs(nsx) > limit || Math.abs(nsz) > limit) continue;
            var nKey = sectorKey(nsx, nsz);
            if (!state.claims[nKey]) {
              candidates.push({ sx: nsx, sz: nsz });
            }
          }
        }
        if (candidates.length > 0) {
          var pick = candidates[Math.floor(rng() * candidates.length)];
          var res = claimOrCaptureSector(state, bot.id, pick.sx, pick.sz, false);
          if (res.ok) {
            events.push({ botId: bot.id, botName: bot.name, sx: pick.sx, sz: pick.sz, cost: res.cost });
          }
        }
      }
    }
    tickCompanyBuildings(state);
    return events;
  }

  function refreshBotOrders(state, rngFn) {
    ensureBots(state);
    var rng = rngFn || Math.random;
    // Keep player-created market orders, replace stale bot orders
    var kept = (state.marketOrders || []).filter(function (o) { return !o.isBot; });
    for (var i = 0; i < DEFAULT_BOT_COMPANIES.length; i++) {
      var bid = DEFAULT_BOT_COMPANIES[i].id;
      var bot = state.companies[bid];
      var tpl = BOT_ORDER_TEMPLATES[bid];
      if (!bot || !tpl) continue;

      for (var b = 0; b < tpl.buy.length; b++) {
        var bo = tpl.buy[b];
        var bFactor = 0.90 + rng() * 0.25;
        kept.push({
          id: 'm' + (state.nextOrderSeq++),
          companyId: bid,
          isBot: true,
          side: 'buy',
          item: bo.item,
          qty: bo.qty,
          price: Math.round(bo.price * bFactor),
          remainingBatches: 4
        });
      }
      for (var s = 0; s < tpl.sell.length; s++) {
        var so = tpl.sell[s];
        var sFactor = 0.90 + rng() * 0.25;
        kept.push({
          id: 'm' + (state.nextOrderSeq++),
          companyId: bid,
          isBot: true,
          side: 'sell',
          item: so.item,
          qty: so.qty,
          price: Math.round(so.price * sFactor),
          remainingBatches: 4
        });
      }
    }
    state.marketOrders = kept;
    return kept.length;
  }

  function renderAsciiMap(state, centerSx, centerSz, radius) {
    var r = radius > 0 ? radius : 3;
    var rows = [];
    for (var dz = -r; dz <= r; dz++) {
      var row = '';
      for (var dx = -r; dx <= r; dx++) {
        var sx = centerSx + dx;
        var sz = centerSz + dz;
        var info = resolveSectorOwner(state, sx, sz);
        var comp = info.owner ? state.companies[info.owner] : null;
        var cc = comp ? (comp.colorCode || '§7') : '§8';
        var sym = (dx === 0 && dz === 0) ? '◆' : (info.kind === 'claimed' ? '█' : '▒');
        row += cc + sym + ' ';
      }
      rows.push(row);
    }
    return rows;
  }

  return {
    SECTOR_SIZE: SECTOR_SIZE,
    BASE_CLAIM_COST: BASE_CLAIM_COST,
    SPEC_SWITCH_COST: SPEC_SWITCH_COST,
    STARTING_CASH: STARTING_CASH,
    TRANSPORT_SPECS: TRANSPORT_SPECS,
    RESOURCE_SPECS: RESOURCE_SPECS,
    DEFAULT_BOT_COMPANIES: DEFAULT_BOT_COMPANIES,
    BOT_ORDER_TEMPLATES: BOT_ORDER_TEMPLATES,
    BUILDING_CATALOG: BUILDING_CATALOG,
    sectorCoords: sectorCoords,
    sectorKey: sectorKey,
    sanitizeId: sanitizeId,
    createInitialState: createInitialState,
    ensureBots: ensureBots,
    ensureDiplomacyState: ensureDiplomacyState,
    hasPact: hasPact,
    togglePact: togglePact,
    countClaims: countClaims,
    computeValuation: computeValuation,
    resolveSectorOwner: resolveSectorOwner,
    isSpawnProtectedSector: isSpawnProtectedSector,
    isAdjacentOwned: isAdjacentOwned,
    minOwnedSectorDistance: minOwnedSectorDistance,
    computeClaimCost: computeClaimCost,
    companyCreate: companyCreate,
    companyJoin: companyJoin,
    companyLeave: companyLeave,
    setSpecialization: setSpecialization,
    claimOrCaptureSector: claimOrCaptureSector,
    weakenOrCaptureSector: weakenOrCaptureSector,
    transferSector: transferSector,
    antitrustSeize: antitrustSeize,
    fortifySector: fortifySector,
    botExpandStep: botExpandStep,
    refreshBotOrders: refreshBotOrders,
    renderAsciiMap: renderAsciiMap,
    getRelation: getRelation,
    getStandingLabel: getStandingLabel,
    adjustRelation: adjustRelation,
    isAllied: isAllied,
    canTransit: canTransit,
    canMine: canMine,
    buyLicense: buyLicense,
    formOrBreakAlliance: formOrBreakAlliance,
    recordTerritoryViolation: recordTerritoryViolation,
    diplomaticBuySector: diplomaticBuySector,
    offerSectorSale: offerSectorSale,
    acceptSectorOffer: acceptSectorOffer,
    getSectorBuilding: getSectorBuilding,
    listCompanyBuildings: listCompanyBuildings,
    buildCompanyBuilding: buildCompanyBuilding,
    upgradeCompanyBuilding: upgradeCompanyBuilding,
    getBuildingYieldProfile: getBuildingYieldProfile,
    tickCompanyBuildings: tickCompanyBuildings,
    collectBuildingOutput: collectBuildingOutput,
    createSupplyContract: createSupplyContract,
    refreshBotSupplyContracts: refreshBotSupplyContracts,
    fulfillSupplyContract: fulfillSupplyContract
  };
})();

global.LHChapterFork = (function () {
  var MANDATORY_CHAPTERS = ['ch00', 'ch01', 'ch02'];
  var EARLY_CHAPTERS = [
    'ch03', 'ch05', 'ch07', 'ch12', 'ch15', 'ch17', 'ch19', 'ch29', 'ch30',
    'ch38', 'ch41', 'ch43', 'ch47', 'ch48', 'ch51', 'ch53', 'ch55', 'ch56'
  ];
  var MID_CHAPTERS = [
    'ch04', 'ch06', 'ch08', 'ch09', 'ch10', 'ch16', 'ch18', 'ch20', 'ch21',
    'ch22', 'ch23', 'ch24', 'ch28', 'ch31', 'ch32', 'ch33', 'ch39', 'ch40',
    'ch42', 'ch44', 'ch49', 'ch54', 'ch57'
  ];
  var LATE_CHAPTERS = [
    'ch11', 'ch14', 'ch25', 'ch26', 'ch27', 'ch34', 'ch35', 'ch36', 'ch37',
    'ch45', 'ch46', 'ch50', 'ch52', 'ch58', 'ch59', 'ch60', 'ch61'
  ];
  var EARLY_TO_MID_REQ = 5;
  var MID_TO_LATE_REQ = 6;

  function getChapterTier(chId) {
    if (chId === 'ch13') return 'optional';
    if (MANDATORY_CHAPTERS.indexOf(chId) !== -1) return 'mandatory';
    if (EARLY_CHAPTERS.indexOf(chId) !== -1) return 'early';
    if (MID_CHAPTERS.indexOf(chId) !== -1) return 'mid';
    if (LATE_CHAPTERS.indexOf(chId) !== -1) return 'late';
    return 'optional';
  }

  function getTierLabel(tier) {
    if (tier === 'mandatory') return 'Обязательный старт';
    if (tier === 'early') return 'Ранний тир (Стартовые моды и логистика)';
    if (tier === 'mid') return 'Средний тир (Индустрия, сети и экспедиции)';
    if (tier === 'late') return 'Поздний тир (Эндгейм, ядерка, боссы и синтез)';
    if (tier === 'cleanup') return 'Добор оставшихся глав';
    return 'Опционально';
  }

  function createPlayerForkState() {
    return {
      unlocked: MANDATORY_CHAPTERS.slice(),
      activePick: null,
      offers: [],
      history: []
    };
  }

  function ensurePlayerState(pState) {
    var st = pState || createPlayerForkState();
    if (!st.unlocked) st.unlocked = MANDATORY_CHAPTERS.slice();
    for (var i = 0; i < MANDATORY_CHAPTERS.length; i++) {
      if (st.unlocked.indexOf(MANDATORY_CHAPTERS[i]) === -1) {
        st.unlocked.unshift(MANDATORY_CHAPTERS[i]);
      }
    }
    if (!st.offers) st.offers = [];
    if (!st.history) st.history = [];
    return st;
  }

  function countCompletedInList(list, completedMap) {
    var n = 0;
    var map = completedMap || {};
    for (var i = 0; i < list.length; i++) {
      if (map[list[i]]) n++;
    }
    return n;
  }

  function isMandatoryDone(completedMap) {
    return countCompletedInList(MANDATORY_CHAPTERS, completedMap) >= MANDATORY_CHAPTERS.length;
  }

  function unpickedInList(list, unlockedArr) {
    var out = [];
    for (var i = 0; i < list.length; i++) {
      if (unlockedArr.indexOf(list[i]) === -1) out.push(list[i]);
    }
    return out;
  }

  function currentEligibleTier(pState, completedMap) {
    var st = ensurePlayerState(pState);
    var map = completedMap || {};
    if (!isMandatoryDone(map)) return 'mandatory';

    var earlyRem = unpickedInList(EARLY_CHAPTERS, st.unlocked);
    var earlyDone = countCompletedInList(EARLY_CHAPTERS, map);
    if (earlyDone < EARLY_TO_MID_REQ && earlyRem.length > 0) return 'early';

    var midRem = unpickedInList(MID_CHAPTERS, st.unlocked);
    var midDone = countCompletedInList(MID_CHAPTERS, map);
    if (midDone < MID_TO_LATE_REQ && midRem.length > 0) return 'mid';

    var lateRem = unpickedInList(LATE_CHAPTERS, st.unlocked);
    if (lateRem.length > 0) return 'late';

    if (earlyRem.length > 0 || midRem.length > 0) return 'cleanup';
    return 'complete';
  }

  function eligiblePool(pState, completedMap) {
    var st = ensurePlayerState(pState);
    var tier = currentEligibleTier(st, completedMap);
    if (tier === 'mandatory' || tier === 'complete') return [];
    if (tier === 'early') return unpickedInList(EARLY_CHAPTERS, st.unlocked);
    if (tier === 'mid') return unpickedInList(MID_CHAPTERS, st.unlocked);
    if (tier === 'late') return unpickedInList(LATE_CHAPTERS, st.unlocked);
    var remEarly = unpickedInList(EARLY_CHAPTERS, st.unlocked);
    if (remEarly.length > 0) return remEarly;
    return unpickedInList(MID_CHAPTERS, st.unlocked);
  }

  function rollThreeChoices(pState, completedMap, rngFn) {
    var st = ensurePlayerState(pState);
    var map = completedMap || {};
    if (!isMandatoryDone(map)) {
      st.offers = [];
      return { ok: false, reason: 'mandatory_incomplete', tier: 'mandatory', offers: [] };
    }
    // If activePick is already completed, clear it so a fresh 3-choice fork can roll
    if (st.activePick && map[st.activePick]) {
      st.activePick = null;
    }
    var pool = eligiblePool(st, map);
    var tier = currentEligibleTier(st, map);
    if (!pool.length) {
      st.offers = [];
      return { ok: true, tier: tier, offers: [] };
    }
    // Keep existing offers if all are still valid in current eligible pool
    if (st.offers && st.offers.length > 0) {
      var allValid = st.offers.every(function (cid) { return pool.indexOf(cid) !== -1; });
      if (allValid) {
        return { ok: true, tier: tier, offers: st.offers.slice() };
      }
    }
    var rng = rngFn || Math.random;
    var copy = pool.slice();
    for (var i = copy.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    st.offers = copy.slice(0, Math.min(3, copy.length));
    return { ok: true, tier: tier, offers: st.offers.slice() };
  }

  function pickChapterFromOffer(pState, chId, completedMap, rngFn) {
    var st = ensurePlayerState(pState);
    var map = completedMap || {};
    if (!isMandatoryDone(map)) {
      return { ok: false, reason: 'mandatory_incomplete' };
    }
    if (st.activePick && !map[st.activePick]) {
      return { ok: false, reason: 'active_chapter_pending', activePick: st.activePick };
    }
    if (!st.offers || !st.offers.length) {
      rollThreeChoices(st, map, rngFn);
    }
    if (st.offers.indexOf(chId) === -1) {
      return { ok: false, reason: 'not_in_offers', offers: st.offers.slice() };
    }
    if (st.unlocked.indexOf(chId) === -1) st.unlocked.push(chId);
    st.activePick = chId;
    st.history.push({ chId: chId, tier: getChapterTier(chId), offers: st.offers.slice() });
    st.offers = [];
    return { ok: true, picked: chId, tier: getChapterTier(chId), unlocked: st.unlocked.slice() };
  }

  function onChapterCompleted(pState, chId, completedMap, rngFn) {
    var st = ensurePlayerState(pState);
    var map = completedMap || {};
    if (st.activePick === chId) {
      st.activePick = null;
    }
    if (isMandatoryDone(map) && (!st.activePick || map[st.activePick])) {
      return rollThreeChoices(st, map, rngFn);
    }
    return { ok: true, tier: currentEligibleTier(st, map), offers: st.offers.slice() };
  }

  return {
    MANDATORY_CHAPTERS: MANDATORY_CHAPTERS,
    EARLY_CHAPTERS: EARLY_CHAPTERS,
    MID_CHAPTERS: MID_CHAPTERS,
    LATE_CHAPTERS: LATE_CHAPTERS,
    EARLY_TO_MID_REQ: EARLY_TO_MID_REQ,
    MID_TO_LATE_REQ: MID_TO_LATE_REQ,
    getChapterTier: getChapterTier,
    getTierLabel: getTierLabel,
    createPlayerForkState: createPlayerForkState,
    ensurePlayerState: ensurePlayerState,
    isMandatoryDone: isMandatoryDone,
    currentEligibleTier: currentEligibleTier,
    eligiblePool: eligiblePool,
    rollThreeChoices: rollThreeChoices,
    pickChapterFromOffer: pickChapterFromOffer,
    onChapterCompleted: onChapterCompleted
  };
})();

