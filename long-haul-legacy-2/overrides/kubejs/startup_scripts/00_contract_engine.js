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

global.LHStructureProduction = (function () {
  var CATEGORY_POOLS = {
    wood: [
      'minecraft:oak_log', 'minecraft:spruce_log', 'minecraft:birch_log', 'minecraft:jungle_log',
      'minecraft:acacia_log', 'minecraft:dark_oak_log', 'minecraft:mangrove_log', 'minecraft:cherry_log',
      'minecraft:bamboo_block', 'minecraft:crimson_stem', 'minecraft:warped_stem',
      'minecraft:stripped_oak_log', 'minecraft:stripped_spruce_log', 'minecraft:stripped_birch_log',
      'minecraft:stripped_jungle_log', 'minecraft:stripped_acacia_log', 'minecraft:stripped_dark_oak_log',
      'minecraft:stripped_mangrove_log', 'minecraft:stripped_cherry_log',
      'minecraft:oak_planks', 'minecraft:spruce_planks', 'minecraft:dark_oak_planks'
    ],
    mining: [
      'minecraft:raw_iron', 'minecraft:raw_copper', 'minecraft:raw_gold', 'minecraft:coal',
      'minecraft:redstone', 'minecraft:lapis_lazuli', 'minecraft:emerald', 'minecraft:diamond',
      'minecraft:amethyst_shard', 'minecraft:iron_ingot', 'minecraft:copper_ingot', 'minecraft:gold_ingot',
      'create:raw_zinc', 'create:zinc_ingot', 'create:andesite_alloy', 'create:brass_ingot',
      'minecraft:deepslate', 'minecraft:tuff', 'minecraft:calcite', 'minecraft:dripstone_block',
      'minecraft:basalt', 'minecraft:obsidian', 'minecraft:crying_obsidian'
    ],
    agro: [
      'minecraft:wheat', 'minecraft:honeycomb', 'minecraft:honey_bottle', 'minecraft:apple',
      'minecraft:sweet_berries', 'minecraft:pumpkin', 'minecraft:melon_slice', 'minecraft:sugar_cane',
      'minecraft:cocoa_beans', 'minecraft:brown_mushroom', 'minecraft:red_mushroom',
      'minecraft:leather', 'minecraft:white_wool', 'minecraft:feather', 'minecraft:egg',
      'minecraft:bread', 'minecraft:cake', 'minecraft:golden_carrot', 'minecraft:rabbit_hide'
    ],
    marine: [
      'minecraft:prismarine_shard', 'minecraft:prismarine_crystals', 'minecraft:kelp',
      'minecraft:sea_lantern', 'minecraft:sponge', 'minecraft:nautilus_shell', 'minecraft:heart_of_the_sea',
      'minecraft:cod', 'minecraft:salmon', 'minecraft:tropical_fish', 'minecraft:pufferfish',
      'minecraft:ink_sac', 'minecraft:glow_ink_sac', 'minecraft:turtle_scute', 'longhaul:marine_reagent'
    ],
    magic: [
      'minecraft:ender_pearl', 'minecraft:blaze_powder', 'minecraft:glowstone_dust',
      'minecraft:phantom_membrane', 'minecraft:experience_bottle', 'minecraft:echo_shard',
      'minecraft:sculk_catalyst', 'minecraft:sculk_sensor', 'minecraft:slime_ball',
      'minecraft:fermented_spider_eye', 'minecraft:gunpowder', 'minecraft:bone',
      'minecraft:string', 'minecraft:spider_eye', 'minecraft:ghast_tear', 'minecraft:nether_star'
    ],
    industry: [
      'create:iron_sheet', 'create:golden_sheet', 'create:copper_sheet', 'create:brass_sheet',
      'create:cogwheel', 'create:large_cogwheel', 'create:shaft', 'create:belt_connector',
      'create:precision_mechanism', 'create:electron_tube', 'create:sturdy_sheet',
      'longhaul:machine_parts', 'longhaul:ore_concentrate', 'longhaul:technical_oil',
      'longhaul:technical_glass', 'longhaul:refractory_mix', 'longhaul:treated_timber'
    ],
    nether: [
      'minecraft:quartz', 'minecraft:netherite_scrap', 'minecraft:ancient_debris', 'minecraft:blaze_rod',
      'minecraft:magma_cream', 'minecraft:nether_wart', 'minecraft:crimson_stem', 'minecraft:warped_stem',
      'minecraft:blackstone', 'minecraft:gilded_blackstone', 'minecraft:soul_sand',
      'minecraft:shroomlight', 'minecraft:wither_skeleton_skull', 'minecraft:gold_block'
    ],
    end: [
      'minecraft:chorus_fruit', 'minecraft:popped_chorus_fruit', 'minecraft:shulker_shell',
      'minecraft:end_stone', 'minecraft:purpur_block', 'minecraft:end_rod',
      'minecraft:dragon_breath', 'minecraft:elytra', 'minecraft:ender_eye'
    ],
    loot: [
      'minecraft:gold_nugget', 'minecraft:iron_nugget', 'minecraft:copper_block', 'minecraft:iron_block',
      'minecraft:emerald_block', 'minecraft:lapis_block', 'minecraft:redstone_block', 'minecraft:coal_block',
      'minecraft:clay_ball', 'minecraft:brick', 'minecraft:flint', 'minecraft:paper',
      'minecraft:book', 'minecraft:compass', 'minecraft:clock', 'minecraft:spyglass',
      'minecraft:candle', 'minecraft:lantern', 'minecraft:bell', 'minecraft:chain',
      'minecraft:name_tag', 'minecraft:saddle', 'minecraft:totem_of_undying'
    ]
  };

  var CATEGORY_META = {
    wood: { label: 'Лесной промысел', icon: '🪓', cost: 280, baseIncome: 38, baseQty: 6, bonusItem: 'minecraft:charcoal', inputItems: { 'minecraft:iron_axe': 1, 'minecraft:coal': 1 } },
    mining: { label: 'Горная выработка', icon: '⛏', cost: 340, baseIncome: 46, baseQty: 5, bonusItem: 'minecraft:coal', inputItems: { 'minecraft:oak_planks': 2, 'minecraft:coal': 1 } },
    agro: { label: 'Аграрная фактория', icon: '🌾', cost: 260, baseIncome: 36, baseQty: 7, bonusItem: 'minecraft:bread', inputItems: { 'minecraft:bone_meal': 2 } },
    marine: { label: 'Морской промысел', icon: '🌊', cost: 380, baseIncome: 52, baseQty: 4, bonusItem: 'minecraft:kelp', inputItems: { 'minecraft:oak_planks': 2, 'minecraft:iron_ingot': 1 } },
    magic: { label: 'Арканный узел', icon: '🔮', cost: 480, baseIncome: 68, baseQty: 3, bonusItem: 'minecraft:lapis_lazuli', inputItems: { 'minecraft:redstone': 2, 'minecraft:coal': 1 } },
    industry: { label: 'Индустриальный хаб', icon: '⚙', cost: 460, baseIncome: 64, baseQty: 4, bonusItem: 'create:andesite_alloy', inputItems: { 'minecraft:iron_ingot': 2, 'minecraft:coal': 2 } },
    nether: { label: 'Адский комплекс', icon: '🔥', cost: 540, baseIncome: 84, baseQty: 4, bonusItem: 'minecraft:quartz', inputItems: { 'minecraft:coal': 3, 'minecraft:iron_ingot': 1 } },
    end: { label: 'Аномалия Края', icon: '🌌', cost: 600, baseIncome: 96, baseQty: 3, bonusItem: 'minecraft:ender_pearl', inputItems: { 'minecraft:blaze_powder': 1, 'minecraft:redstone': 2 } },
    loot: { label: 'Реликтовый хаб', icon: '🏺', cost: 440, baseIncome: 60, baseQty: 4, bonusItem: 'minecraft:gold_nugget', inputItems: { 'minecraft:coal': 2, 'minecraft:iron_ingot': 1 } }
  };

  var STRUCTURE_RARITIES = {
    common: { id: 'common', name: 'Обычная', colorCode: '§f', color: 'white', rank: 1, incomeMult: 1.00, qtyMult: 1.00, costMult: 1.00 },
    magic: { id: 'magic', name: 'Магическая', colorCode: '§9', color: 'blue', rank: 2, incomeMult: 1.30, qtyMult: 1.15, costMult: 1.15 },
    rare: { id: 'rare', name: 'Редкая', colorCode: '§e', color: 'yellow', rank: 3, incomeMult: 1.65, qtyMult: 1.30, costMult: 1.35 },
    epic: { id: 'epic', name: 'Эпическая', colorCode: '§5', color: 'dark_purple', rank: 4, incomeMult: 2.10, qtyMult: 1.50, costMult: 1.60 },
    legendary: { id: 'legendary', name: 'Легендарная', colorCode: '§6', color: 'gold', rank: 5, incomeMult: 2.75, qtyMult: 1.75, costMult: 2.00 },
    mythic: { id: 'mythic', name: 'Мифическая', colorCode: '§c', color: 'red', rank: 6, incomeMult: 3.60, qtyMult: 2.00, costMult: 2.50 }
  };

  var RARITY_ORDER = ['common', 'magic', 'rare', 'epic', 'legendary', 'mythic'];

  var STRUCTURE_DIMENSIONS = {
    'minecraft:overworld': { id: 'minecraft:overworld', key: 'overworld', name: 'Верхний мир', icon: '🌿', colorCode: '§a', incomeMult: 1.00, minRarity: 'common' },
    'minecraft:the_nether': { id: 'minecraft:the_nether', key: 'nether', name: 'Нижний мир', icon: '🔥', colorCode: '§c', incomeMult: 1.35, minRarity: 'rare' },
    'minecraft:the_end': { id: 'minecraft:the_end', key: 'end', name: 'Край', icon: '🌌', colorCode: '§d', incomeMult: 1.75, minRarity: 'epic' },
    other: { id: 'other', key: 'other', name: 'Иное измерение', icon: '🌀', colorCode: '§b', incomeMult: 1.50, minRarity: 'rare' }
  };

  function normalizeDimension(dim) {
    if (!dim) return 'minecraft:overworld';
    var s = String(dim).toLowerCase().trim();
    if (s === 'overworld' || s === 'minecraft:overworld') return 'minecraft:overworld';
    if (s === 'nether' || s === 'the_nether' || s === 'minecraft:the_nether') return 'minecraft:the_nether';
    if (s === 'end' || s === 'the_end' || s === 'minecraft:the_end') return 'minecraft:the_end';
    if (s === 'other') return 'other';
    return s;
  }

  function detectStructureDimension(structureId, liveDimension) {
    if (liveDimension) {
      var nd = normalizeDimension(liveDimension);
      if (STRUCTURE_DIMENSIONS[nd]) return nd;
      return 'other';
    }
    var s = String(structureId || '').toLowerCase();
    if (/the_nether|:nether|nether_|_nether|bastion|fortress|piglin|crimson|warped|incendium|betternether|soul_black_smith|burning_arena/.test(s)) {
      return 'minecraft:the_nether';
    }
    if (/the_end|end_city|end_ship|_end\b|:end_|ender_guardian|betterend|nullscape|chorus|shulker/.test(s)) {
      return 'minecraft:the_end';
    }
    if (/^(aether|ad_astra|twilightforest|blue_skies|deeperdarker):/.test(s)) {
      return 'other';
    }
    return 'minecraft:overworld';
  }

  function detectStructureRarity(structureId, theme, dimension) {
    var s = String(structureId || '').toLowerCase();
    var rarity = 'common';
    if (/cataclysm:(burning_arena|sunken_city|ancient_factory|cursed_pyramid)|dungeons_arise:(heavenly_conqueror|shiraz_palace|foundry)|ignis|leviathan|ender_guardian/.test(s)) {
      rarity = 'mythic';
    } else if (/ancient_city|cataclysm:|end_ship|stronghold|dungeons_arise:(aviary|mechanical_nest|thornborn_towers)|monstrosity|harbinger/.test(s)) {
      rarity = 'legendary';
    } else if (/ocean_monument|monument_ocean|mansion|bastion|end_city|citadel|monastery|wizard_tower|palace|catacomb|deep_dark|sculk|bastille/.test(s)) {
      rarity = 'epic';
    } else if (/fortress|lighthouse|pyramid|temple|outpost|shipwreck|swamp_hut|witch|observatory|bakery|tavern|sky_village|apothecary|pillager|bandit/.test(s)) {
      rarity = 'rare';
    } else if (/sawmill|mineshaft|beekeeper|windmill|forge|smithy|dock|harbor|port|rail|station|foundry|quarry|trail_ruins/.test(s)) {
      rarity = 'magic';
    } else if (theme && theme.tier >= 3) {
      rarity = 'epic';
    } else if (theme && theme.tier === 2) {
      rarity = 'rare';
    } else if (simpleHash(s) % 5 === 0) {
      rarity = 'magic';
    }
    var dSpec = STRUCTURE_DIMENSIONS[dimension] || STRUCTURE_DIMENSIONS['minecraft:overworld'];
    var minIdx = RARITY_ORDER.indexOf(dSpec.minRarity || 'common');
    var curIdx = RARITY_ORDER.indexOf(rarity);
    if (curIdx < minIdx) rarity = RARITY_ORDER[minIdx];
    return rarity;
  }

  function isEligibleResourceItem(itemId) {
    if (!itemId) return false;
    var s = String(itemId).toLowerCase();
    if (!s || s === 'minecraft:air' || s === 'minecraft:void_air' || s === 'minecraft:cave_air') return false;
    var bannedSubstrings = [
      'spawn_egg', 'command_block', 'structure_block', 'structure_void', 'jigsaw',
      'debug_stick', 'barrier', 'light_block', 'minecraft:light', 'bedrock',
      'enchanted_book', 'potion', 'tipped_arrow', 'written_book', 'filled_map',
      'bundle', 'spawner', 'monster_spawner', 'petrified_oak_slab', 'knowledge_book',
      'infested_', 'budding_amethyst', 'reinforced_deepslate', 'frogspawn', 'farmland',
      'dirt_path', 'player_head', 'creative_', 'operator_', 'unfinished_'
    ];
    for (var i = 0; i < bannedSubstrings.length; i++) {
      if (s.indexOf(bannedSubstrings[i]) !== -1) return false;
    }
    return s.indexOf(':') !== -1;
  }

  function simpleHash(str) {
    var h = 2166136261;
    var s = String(str || '');
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h * 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function formatStructureName(structureId) {
    var raw = String(structureId || 'structure');
    var colon = raw.indexOf(':');
    var slug = colon >= 0 ? raw.slice(colon + 1) : raw;
    var slash = slug.lastIndexOf('/');
    if (slash >= 0) slug = slug.slice(slash + 1);
    var parts = slug.split('_');
    for (var i = 0; i < parts.length; i++) {
      if (parts[i].length > 0) parts[i] = parts[i].charAt(0).toUpperCase() + parts[i].slice(1);
    }
    return parts.join(' ');
  }

  function detectWoodPreferenceFromId(s) {
    if (/crimson/.test(s)) return 'minecraft:crimson_stem';
    if (/warped/.test(s)) return 'minecraft:warped_stem';
    if (/spruce|taiga|pine|snowy|winter|boreal/.test(s)) return 'minecraft:spruce_log';
    if (/birch|aspen/.test(s)) return 'minecraft:birch_log';
    if (/jungle|tropical/.test(s)) return 'minecraft:jungle_log';
    if (/bamboo/.test(s)) return 'minecraft:bamboo_block';
    if (/acacia|savanna|baobab/.test(s)) return 'minecraft:acacia_log';
    if (/dark_oak|dark_forest|mansion/.test(s)) return 'minecraft:dark_oak_log';
    if (/mangrove|bayou|marsh|swamp/.test(s)) return 'minecraft:mangrove_log';
    if (/cherry|sakura|blossom/.test(s)) return 'minecraft:cherry_log';
    return 'minecraft:oak_log';
  }

  function detectStructureTheme(structureId) {
    var s = String(structureId || '').toLowerCase();
    if (/sawmill|lumber|logging|timber|woodcutter|forestry|grove|cabin/.test(s)) {
      return { category: 'wood', preferred: detectWoodPreferenceFromId(s), tier: 1 };
    }
    if (/beekeeper|apiary|honey|windmill|farm|barn|bakery|orchard|pasture|greenhouse|tavern|winery|village/.test(s)) {
      if (/village_taiga|snowy/.test(s)) return { category: 'wood', preferred: 'minecraft:spruce_log', tier: 1 };
      if (/village_plains/.test(s)) return { category: 'agro', preferred: 'minecraft:wheat', tier: 1 };
      if (/village_desert/.test(s)) return { category: 'agro', preferred: 'minecraft:cactus', tier: 1 };
      if (/village_savanna/.test(s)) return { category: 'agro', preferred: 'minecraft:melon_slice', tier: 1 };
      return { category: 'agro', tier: 1 };
    }
    if (/end_city|end_ship|_end\b|ender|chorus|shulker|betterend/.test(s)) return { category: 'end', preferred: /ship/.test(s) ? 'minecraft:elytra' : 'minecraft:shulker_shell', tier: 3 };
    if (/fortress|bastion|nether|piglin|crimson|warped|burning_arena|soul_black_smith/.test(s)) {
      if (/bastion_treasure/.test(s)) return { category: 'nether', preferred: 'minecraft:ancient_debris', tier: 3 };
      if (/bastion_hoglin/.test(s)) return { category: 'nether', preferred: 'minecraft:netherite_scrap', tier: 3 };
      if (/fortress/.test(s)) return { category: 'nether', preferred: 'minecraft:blaze_rod', tier: 3 };
      return { category: 'nether', tier: 3 };
    }
    if (/ocean|shipwreck|lighthouse|sunken|monument|harbor|dock|coral|kelp|pirate|raft|port/.test(s)) {
      if (/monument/.test(s)) return { category: 'marine', preferred: 'minecraft:prismarine_crystals', tier: 2 };
      if (/shipwreck/.test(s)) return { category: 'marine', preferred: 'minecraft:heart_of_the_sea', tier: 2 };
      return { category: 'marine', tier: 2 };
    }
    if (/mineshaft|quarry|excavation|crypt|catacomb|tomb|dungeon|ancient_city|stronghold|foundry|forge|smithy|drill/.test(s)) {
      if (/gold_mine|mesa|badlands/.test(s)) return { category: 'mining', preferred: 'minecraft:raw_gold', tier: 2 };
      if (/copper/.test(s)) return { category: 'mining', preferred: 'minecraft:raw_copper', tier: 2 };
      if (/ancient_city/.test(s)) return { category: 'mining', preferred: 'minecraft:deepslate', tier: 2 };
      if (/foundry|forge|smithy/.test(s)) return { category: 'mining', preferred: 'create:brass_ingot', tier: 2 };
      return { category: 'mining', tier: 2 };
    }
    if (/wizard|witch|swamp_hut|apothecary|monastery|temple|pyramid|shrine|library|observatory|altar|arcane|mage|portal|tower|citadel|aviary|sanctum/.test(s)) {
      if (/desert_pyramid/.test(s)) return { category: 'magic', preferred: 'minecraft:glowstone_dust', tier: 2 };
      if (/jungle_pyramid/.test(s)) return { category: 'magic', preferred: 'minecraft:experience_bottle', tier: 2 };
      if (/swamp_hut|witch/.test(s)) return { category: 'magic', preferred: 'minecraft:fermented_spider_eye', tier: 2 };
      return { category: 'magic', tier: 2 };
    }
    if (/factory|workshop|station|rail|depot|bunker|camp|outpost|fort|castle|mansion|palace|bastille|pillager/.test(s)) {
      if (/mansion/.test(s)) return { category: 'industry', preferred: 'minecraft:totem_of_undying', tier: 2 };
      if (/pillager_outpost/.test(s)) return { category: 'industry', preferred: 'create:iron_sheet', tier: 2 };
      return { category: 'industry', tier: 2 };
    }
    return { category: 'loot', tier: 1 };
  }

  function makeSpec(structureId, itemId, theme, liveDimension) {
    var meta = CATEGORY_META[theme.category] || CATEGORY_META.loot;
    var tier = theme.tier || 1;
    var dimension = detectStructureDimension(structureId, liveDimension);
    var dSpec = STRUCTURE_DIMENSIONS[dimension] || STRUCTURE_DIMENSIONS['minecraft:overworld'];
    var rarity = detectStructureRarity(structureId, theme, dimension);
    var rSpec = STRUCTURE_RARITIES[rarity] || STRUCTURE_RARITIES.common;
    var qty = Math.max(1, Math.round(Math.max(1, meta.baseQty - (tier - 1)) * rSpec.qtyMult));
    var income = Math.round(meta.baseIncome * (1 + (tier - 1) * 0.25) * rSpec.incomeMult * dSpec.incomeMult);
    var cost = Math.round(meta.cost * (1 + (tier - 1) * 0.18) * rSpec.costMult);
    var reqInputs = {};
    var inpBase = meta.inputItems || { 'minecraft:coal': 1 };
    Object.keys(inpBase).forEach(function (ik) {
      reqInputs[ik] = Math.max(1, Math.round(inpBase[ik] * (1 + (rSpec.rank >= 4 ? 1 : 0))));
    });
    return {
      structureId: String(structureId),
      displayName: formatStructureName(structureId),
      category: theme.category,
      categoryLabel: meta.label,
      icon: meta.icon,
      tier: tier,
      dimension: dimension,
      dimensionKey: dSpec.key,
      dimensionName: dSpec.name,
      dimensionIcon: dSpec.icon,
      dimensionColor: dSpec.colorCode,
      rarity: rarity,
      rarityName: rSpec.name,
      rarityColor: rSpec.colorCode,
      rarityRank: rSpec.rank,
      itemId: String(itemId),
      baseQty: qty,
      baseIncome: income,
      cost: cost,
      upkeepCost: Math.max(10, Math.round(14 * rSpec.costMult * dSpec.incomeMult)),
      inputItems: reqInputs,
      bonusItem: meta.bonusItem
    };
  }

  var MODPACK_RANDOM_ITEM_POOL = [
    'create:andesite_alloy', 'create:brass_ingot', 'create:precision_mechanism', 'create:electron_tube',
    'create:sturdy_sheet', 'create:belt_connector', 'create:cogwheel', 'create:propeller',
    'create:whisk', 'create:blaze_cake', 'create:chromatic_compound', 'create:experience_nugget',
    'immersiveengineering:ingot_steel', 'immersiveengineering:component_steel', 'immersiveengineering:circuit_board',
    'immersiveengineering:wire_copper', 'immersiveengineering:coil_lv', 'immersiveengineering:plate_aluminum',
    'ae2:certus_quartz_crystal', 'ae2:fluix_crystal', 'ae2:silicon', 'ae2:calculation_processor',
    'ae2:engineering_processor', 'ae2:logic_processor', 'ae2:annihilation_core', 'ae2:formation_core',
    'bigreactors:yellorium_ingot', 'bigreactors:cyanite_ingot', 'bigreactors:graphite_ingot', 'bigreactors:basic_reactorcasing',
    'electrodynamics:ingotsteel', 'electrodynamics:wirecopper', 'electrodynamics:circuitbasic', 'electrodynamics:motor',
    'nuclearcraft:uranium_238', 'nuclearcraft:thorium_ingot', 'nuclearcraft:tough_alloy_ingot', 'nuclearcraft:basic_plating',
    'pneumaticcraft:ingot_iron_compressed', 'pneumaticcraft:plastic', 'pneumaticcraft:printed_circuit_board', 'pneumaticcraft:turbine_rotor',
    'alexscaves:amber_curiosity', 'alexscaves:abyssmarine', 'alexscaves:uranium', 'alexscaves:polymer_plate',
    'alexscaves:scarlet_neodymium_ingot', 'alexscaves:azure_neodymium_ingot', 'alexscaves:moth_dust', 'alexscaves:bioluminesscence',
    'alexsmobs:ambergris', 'alexsmobs:bone_serpent_tooth', 'alexsmobs:shark_tooth', 'alexsmobs:gazelle_horn',
    'alexsmobs:komodo_spit_bottle', 'alexsmobs:mimicream', 'alexsmobs:cosmic_cod', 'alexsmobs:void_worm_eye',
    'aquaculture:algae', 'aquaculture:neptunium_ingot', 'aquaculture:tin_can', 'aquaculture:treasure_chest',
    'aquamirae:abyssal_amethyst', 'aquamirae:esca', 'aquamirae:fin', 'aquamirae:ship_graveyard_echo',
    'automobility:automobile_engine', 'automobility:automobile_wheel', 'automobility:dash_panel', 'automobility:auto_mechanic_table',
    'immersive_aircraft:engine', 'immersive_aircraft:boiler', 'immersive_aircraft:sail', 'immersive_aircraft:hull',
    'smallships:sail', 'smallships:cannon', 'smallships:cannon_ball',
    'cataclysm:ancient_metal_ingot', 'cataclysm:black_steel_ingot', 'cataclysm:ignitium_ingot', 'cataclysm:cursium_ingot',
    'farmersdelight:rice', 'farmersdelight:tomato', 'farmersdelight:onion', 'farmersdelight:canvas',
    'brewinandchewin:beer', 'brewinandchewin:cocoa_fudge', 'brewinandchewin:kimchi', 'brewinandchewin:jerky',
    'biomesoplenty:rose_quartz_chunk', 'biomesoplenty:glowshroom', 'biomesoplenty:barley', 'biomesoplenty:brimstone',
    'longhaul:machine_parts', 'longhaul:ore_concentrate', 'longhaul:technical_oil',
    'longhaul:technical_glass', 'longhaul:refractory_mix', 'longhaul:treated_timber', 'longhaul:marine_reagent'
  ];

  var GLOBAL_MOD_ITEM_POOL = [];

  function setGlobalItemPool(items) {
    var seen = {};
    var out = [];
    for (var i = 0; i < (items || []).length; i++) {
      var id = String(items[i] || '');
      if (!seen[id] && isEligibleResourceItem(id)) {
        seen[id] = true;
        out.push(id);
      }
    }
    GLOBAL_MOD_ITEM_POOL = out;
    return GLOBAL_MOD_ITEM_POOL.length;
  }

  function getGlobalItemPool() {
    if (GLOBAL_MOD_ITEM_POOL.length > 0) return GLOBAL_MOD_ITEM_POOL.slice();
    return MODPACK_RANDOM_ITEM_POOL.slice();
  }

  function buildCombinedRandomPool(availableItemIds) {
    var seen = {};
    var pool = [];
    if (availableItemIds && availableItemIds.length > 0) {
      for (var i = 0; i < availableItemIds.length; i++) {
        var id = String(availableItemIds[i] || '');
        if (!seen[id] && isEligibleResourceItem(id)) {
          seen[id] = true;
          pool.push(id);
        }
      }
      if (pool.length > 0) return pool;
    }
    var sources = [GLOBAL_MOD_ITEM_POOL, MODPACK_RANDOM_ITEM_POOL];
    for (var s = 0; s < sources.length; s++) {
      var arr = sources[s];
      if (!arr || !arr.length) continue;
      for (var j = 0; j < arr.length; j++) {
        var id2 = String(arr[j] || '');
        if (!seen[id2] && isEligibleResourceItem(id2)) {
          seen[id2] = true;
          pool.push(id2);
        }
      }
      if (s === 0 && pool.length >= 24) break;
    }
    return pool;
  }

  function pickRandomItemFromPool(seedKey, availableItemIds, usedItems, rngFn) {
    var pool = buildCombinedRandomPool(availableItemIds);
    if (!pool.length) return 'longhaul:machine_parts';
    var len = pool.length;
    var startIdx = typeof rngFn === 'function'
      ? Math.floor(Math.max(0, Math.min(0.999999, Number(rngFn()))) * len)
      : (simpleHash(String(seedKey || 'rnd')) % len);
    var stride = 1;
    if (len > 7) {
      var stepCand = (simpleHash(String(seedKey || 'rnd') + ':stride') % Math.max(2, len - 1)) + 1;
      // Find coprime stride so full pool is visited
      while (stepCand > 1) {
        var a = stepCand, b = len;
        while (b) { var t = b; b = a % b; a = t; }
        if (a === 1) { stride = stepCand; break; }
        stepCand--;
      }
    }
    if (usedItems) {
      for (var i = 0; i < len; i++) {
        var cand = pool[(startIdx + i * stride) % len];
        if (!usedItems[cand]) return cand;
      }
    }
    return pool[startIdx % len];
  }

  function buildStructureCatalog(structureIds, availableItemIds, existingCatalog, structureDimMap, opts) {
    var catalog = {};
    var usedItems = {};
    var dimMap = structureDimMap || {};
    var o = opts || {};
    var sortedIds = (structureIds || []).map(String).filter(function (s) { return s.length > 0; });
    sortedIds.sort();

    if (existingCatalog && typeof existingCatalog === 'object') {
      Object.keys(existingCatalog).sort().forEach(function (sid) {
        var prev = existingCatalog[sid];
        if (prev && prev.itemId && !usedItems[prev.itemId]) {
          var themePrev = detectStructureTheme(sid);
          var prevDim = dimMap[sid] || prev.dimension || null;
          catalog[sid] = makeSpec(sid, prev.itemId, themePrev, prevDim);
          usedItems[prev.itemId] = sid;
        }
      });
    }

    for (var i = 0; i < sortedIds.length; i++) {
      var sid = sortedIds[i];
      if (catalog[sid]) continue;
      var theme = detectStructureTheme(sid);
      var chosen = pickRandomItemFromPool(sid + ':' + (o.seed || 'modpack'), availableItemIds, usedItems, o.rng);
      usedItems[chosen] = sid;
      catalog[sid] = makeSpec(sid, chosen, theme, dimMap[sid] || null);
    }
    return catalog;
  }

  function resolveStructureSpec(catalog, structureId, availableItemIds, liveDimension, opts) {
    var sid = String(structureId || '');
    if (!sid) return null;
    if (catalog && catalog[sid]) {
      if (liveDimension && catalog[sid].dimension !== detectStructureDimension(sid, liveDimension)) {
        return makeSpec(sid, catalog[sid].itemId, detectStructureTheme(sid), liveDimension);
      }
      return catalog[sid];
    }
    var usedItems = {};
    if (catalog) {
      Object.keys(catalog).forEach(function (k) {
        if (catalog[k] && catalog[k].itemId) usedItems[catalog[k].itemId] = k;
      });
    }
    var o = opts || {};
    var theme = detectStructureTheme(sid);
    var chosen = pickRandomItemFromPool(sid + ':' + (o.seed || 'modpack'), availableItemIds, usedItems, o.rng);
    var spec = makeSpec(sid, chosen, theme, liveDimension || null);
    if (catalog) catalog[sid] = spec;
    return spec;
  }

  function rerollStructureSpecProduct(catalog, structureId, availableItemIds, liveDimension, rngFn) {
    var sid = String(structureId || '');
    if (!sid) return null;
    var usedItems = {};
    if (catalog) {
      Object.keys(catalog).forEach(function (k) {
        if (k !== sid && catalog[k] && catalog[k].itemId) usedItems[catalog[k].itemId] = k;
      });
    }
    var theme = detectStructureTheme(sid);
    var chosen = pickRandomItemFromPool(sid + ':reroll:' + Math.random(), availableItemIds, usedItems, rngFn || Math.random);
    var spec = makeSpec(sid, chosen, theme, liveDimension || null);
    if (catalog) catalog[sid] = spec;
    return spec;
  }

  function groupCatalogByDimension(catalog) {
    var out = { overworld: [], nether: [], end: [], other: [] };
    if (!catalog) return out;
    Object.keys(catalog).sort().forEach(function (sid) {
      var sp = catalog[sid];
      var dk = (sp && sp.dimensionKey && out[sp.dimensionKey]) ? sp.dimensionKey : 'overworld';
      out[dk].push(sp);
    });
    Object.keys(out).forEach(function (dk) {
      out[dk].sort(function (a, b) {
        return (b.rarityRank || 1) - (a.rarityRank || 1) || String(a.structureId).localeCompare(String(b.structureId));
      });
    });
    return out;
  }

  function filterCatalog(catalog, dimensionFilter, rarityFilter) {
    var out = [];
    if (!catalog) return out;
    var normDim = dimensionFilter ? normalizeDimension(dimensionFilter) : null;
    Object.keys(catalog).sort().forEach(function (sid) {
      var sp = catalog[sid];
      if (!sp) return;
      if (normDim && sp.dimension !== normDim && sp.dimensionKey !== dimensionFilter) return;
      if (rarityFilter && sp.rarity !== rarityFilter) return;
      out.push(sp);
    });
    out.sort(function (a, b) {
      return (b.rarityRank || 1) - (a.rarityRank || 1) || String(a.structureId).localeCompare(String(b.structureId));
    });
    return out;
  }

  return {
    CATEGORY_POOLS: CATEGORY_POOLS,
    CATEGORY_META: CATEGORY_META,
    MODPACK_RANDOM_ITEM_POOL: MODPACK_RANDOM_ITEM_POOL,
    STRUCTURE_RARITIES: STRUCTURE_RARITIES,
    STRUCTURE_DIMENSIONS: STRUCTURE_DIMENSIONS,
    isEligibleResourceItem: isEligibleResourceItem,
    setGlobalItemPool: setGlobalItemPool,
    getGlobalItemPool: getGlobalItemPool,
    pickRandomItemFromPool: pickRandomItemFromPool,
    formatStructureName: formatStructureName,
    normalizeDimension: normalizeDimension,
    detectStructureDimension: detectStructureDimension,
    detectStructureRarity: detectStructureRarity,
    detectStructureTheme: detectStructureTheme,
    buildStructureCatalog: buildStructureCatalog,
    resolveStructureSpec: resolveStructureSpec,
    rerollStructureSpecProduct: rerollStructureSpecProduct,
    groupCatalogByDimension: groupCatalogByDimension,
    filterCatalog: filterCatalog
  };
})();

global.LHOpenTTD = (function () {
  var SECTOR_SIZE = 256; // 16x16 chunks per sector, centered at (sx*256, sz*256)
  var BASE_CLAIM_COST = 250;
  var BASE_FORTIFY_COST = 200;
  var SPEC_SWITCH_COST = 500;
  var STARTING_CASH = 1000;

  var COMPANY_ENV_TYPES = {
    normal: { id: 'normal', name: 'Обычная (поверхность)', icon: '🏔', defaultY: 70 },
    air: { id: 'air', name: 'Воздушная (у потолка мира)', icon: '☁', defaultY: 286 },
    sea: { id: 'sea', name: 'Морская (на воде / нефтевышке)', icon: '🌊', defaultY: 64 },
    underground: { id: 'underground', name: 'Подземная (у дна мира)', icon: '🕳', defaultY: -44 }
  };

  var TRANSPORT_SPECS = {
    rail: {
      id: 'rail',
      name: 'Железнодорожная корпорация',
      icon: '🚆',
      telemetryFamily: 'rail',
      envType: 'normal',
      payoutBonus: 0.45,
      claimDiscount: 0.35,
      summary: '+45% выручки с ж/д маршрутов и контрактов, -35% цена захвата секторов, ускорение на поездах/вагонетках.'
    },
    road: {
      id: 'road',
      name: 'Автотранспортный конвой',
      icon: '🚚',
      telemetryFamily: 'road_vehicle',
      envType: 'normal',
      payoutBonus: 0.45,
      claimDiscount: 0.20,
      summary: '+45% выручки с авто/повозок, +8 слотов к лимиту перегруза, скидка 20% на захват секторов.'
    },
    sea: {
      id: 'sea',
      name: 'Морское пароходство',
      icon: '🚢',
      telemetryFamily: 'watercraft',
      envType: 'sea',
      payoutBonus: 0.50,
      claimDiscount: 0.25,
      summary: '+50% выручки на воде и в портовых узлах, спаун на нефтяных платформах и плавучих базах, водное дыхание.'
    },
    air: {
      id: 'air',
      name: 'Воздушный флот',
      icon: '✈',
      telemetryFamily: 'aircraft_vs',
      envType: 'air',
      payoutBonus: 0.50,
      claimDiscount: 0.25,
      summary: '+50% выручки на авиа/VS-судах, штаб и здания в воздухе у потолка мира, страховка от падений.'
    },
    underground: {
      id: 'underground',
      name: 'Подземная корпорация',
      icon: '🚇',
      telemetryFamily: 'rail',
      envType: 'underground',
      payoutBonus: 0.45,
      claimDiscount: 0.25,
      summary: '+45% выручки на подземных/ж/д трассах, штаб и все здания в глубине у дна мира (Y=-44), скидка 25%.'
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

  var BOT_ARCHETYPES = {
    mining_syndicate: {
      id: 'mining_syndicate',
      name: 'Горнопромышленный синдикат',
      icon: '⛏',
      tag: 'MINE',
      colorCode: '§6',
      transportSpec: 'underground',
      resourceSpec: 'mining',
      envType: 'underground',
      preferredBuildings: ['mine_shaft', 'quarry', 'refinery'],
      buyFocus: ['minecraft:oak_planks', 'minecraft:coal', 'minecraft:iron_ingot', 'minecraft:redstone'],
      sellFocus: ['minecraft:raw_iron', 'minecraft:raw_gold', 'longhaul:ore_concentrate']
    },
    agro_holding: {
      id: 'agro_holding',
      name: 'Аграрно-пищевой холдинг',
      icon: '🌾',
      tag: 'AGRO',
      colorCode: '§a',
      transportSpec: 'road',
      resourceSpec: 'agro',
      envType: 'normal',
      preferredBuildings: ['agro_complex', 'sawmill', 'warehouse'],
      buyFocus: ['minecraft:bone_meal', 'minecraft:iron_ingot', 'minecraft:oak_log'],
      sellFocus: ['minecraft:bread', 'minecraft:wheat', 'longhaul:field_rations']
    },
    aero_logistics: {
      id: 'aero_logistics',
      name: 'Воздушная грузовая лига',
      icon: '✈',
      tag: 'AERO',
      colorCode: '§b',
      transportSpec: 'air',
      resourceSpec: 'energy',
      envType: 'air',
      preferredBuildings: ['airport', 'power_plant', 'trade_exchange'],
      buyFocus: ['longhaul:technical_oil', 'minecraft:coal', 'minecraft:copper_ingot'],
      sellFocus: ['create:brass_ingot', 'create:precision_mechanism', 'longhaul:technical_glass']
    },
    marine_cartel: {
      id: 'marine_cartel',
      name: 'Морской торговый картель',
      icon: '🚢',
      tag: 'SEA',
      colorCode: '§9',
      transportSpec: 'sea',
      resourceSpec: 'forestry',
      envType: 'sea',
      preferredBuildings: ['oil_rig', 'sawmill', 'warehouse'],
      buyFocus: ['longhaul:treated_timber', 'minecraft:iron_ingot', 'minecraft:coal'],
      sellFocus: ['longhaul:marine_reagent', 'longhaul:technical_oil', 'minecraft:oak_log']
    },
    industrial_foundry: {
      id: 'industrial_foundry',
      name: 'Металлургический комбинат',
      icon: '🏭',
      tag: 'IND',
      colorCode: '§e',
      transportSpec: 'rail',
      resourceSpec: 'mining',
      envType: 'normal',
      preferredBuildings: ['factory', 'refinery', 'power_plant'],
      buyFocus: ['minecraft:iron_ingot', 'minecraft:coal', 'minecraft:redstone', 'minecraft:gold_ingot'],
      sellFocus: ['create:iron_sheet', 'longhaul:machine_parts', 'create:andesite_alloy']
    },
    petrochemical_trust: {
      id: 'petrochemical_trust',
      name: 'Нефтехимический трест',
      icon: '⚗',
      tag: 'CHEM',
      colorCode: '§5',
      transportSpec: 'rail',
      resourceSpec: 'energy',
      envType: 'normal',
      preferredBuildings: ['chemical_plant', 'oil_rig', 'power_plant'],
      buyFocus: ['minecraft:coal', 'minecraft:redstone', 'longhaul:technical_oil'],
      sellFocus: ['longhaul:technical_oil', 'longhaul:refractory_mix', 'minecraft:blaze_powder']
    },
    security_pmc: {
      id: 'security_pmc',
      name: 'ЧВК и охранный холдинг',
      icon: '🛡',
      tag: 'PMC',
      colorCode: '§c',
      transportSpec: 'road',
      resourceSpec: 'mining',
      envType: 'normal',
      preferredBuildings: ['patrol_post', 'trade_exchange', 'factory'],
      buyFocus: ['minecraft:iron_ingot', 'minecraft:coal', 'minecraft:gold_ingot'],
      sellFocus: ['minecraft:arrow', 'minecraft:emerald', 'create:iron_sheet']
    },
    frontier_monopoly: {
      id: 'frontier_monopoly',
      name: 'Пограничная монополия',
      icon: '🏛',
      tag: 'FRNT',
      colorCode: '§d',
      transportSpec: 'air',
      resourceSpec: 'forestry',
      envType: 'air',
      preferredBuildings: ['trade_exchange', 'warehouse', 'airport'],
      buyFocus: ['minecraft:diamond', 'minecraft:emerald', 'minecraft:coal'],
      sellFocus: ['minecraft:gold_ingot', 'create:brass_ingot', 'longhaul:technical_glass']
    }
  };

  var COMPANY_TRAITS = {
    aggressive_expander: {
      id: 'aggressive_expander',
      name: 'Экспансионист',
      icon: '🚩',
      colorCode: '§c',
      claimCostMult: 0.80,
      botExpandThreshold: 420,
      startingRelBonus: -15,
      aggressionWeight: 25,
      summary: '-20% стоимость захвата секторов, агрессивное расширение и рейды, -15 старт. репутации.'
    },
    trade_magnate: {
      id: 'trade_magnate',
      name: 'Торговый магнат',
      icon: '💰',
      colorCode: '§6',
      incomeMult: 1.15,
      botCashBonus: 350,
      valuationMult: 1.10,
      summary: '+15% денежного дохода построек, +10% оценки компании и +350 Cr резерва боту.'
    },
    industrial_titan: {
      id: 'industrial_titan',
      name: 'Промышленный титан',
      icon: '🏭',
      colorCode: '§e',
      incomeMult: 1.15,
      yieldMult: 1.25,
      summary: '+25% объёма выпуска продукции и +15% дохода Cr от предприятий.'
    },
    fortress_builder: {
      id: 'fortress_builder',
      name: 'Бастионный архитектор',
      icon: '🛡',
      colorCode: '§7',
      startingStrengthBonus: 1,
      fortifyCostMult: 0.75,
      securityUpkeepMult: 0.80,
      summary: '+1 к укреплению новых секторов, -25% цены фортификации и -20% расходов на охрану.'
    },
    frugal_logistics: {
      id: 'frugal_logistics',
      name: 'Бережливый логист',
      icon: '📦',
      colorCode: '§a',
      buildCostMult: 0.85,
      upkeepMult: 0.85,
      summary: '-15% стоимость строительства и содержания всех производств.'
    },
    diplomat_guild: {
      id: 'diplomat_guild',
      name: 'Гильдия дипломатов',
      icon: '🤝',
      colorCode: '§b',
      diplomacyCostMult: 0.70,
      startingRelBonus: 15,
      summary: '-30% стоимость лицензий/мирного выкупа и +15 стартовых отношений.'
    },
    energy_baron: {
      id: 'energy_baron',
      name: 'Энергобарон',
      icon: '⚡',
      colorCode: '§e',
      extraAdjacencyPct: 0.15,
      incomeMult: 1.08,
      summary: '+15% доп. бонус от энергоподстанций и +8% выручки.'
    },
    structure_prospector: {
      id: 'structure_prospector',
      name: 'Охотник за руинами',
      icon: '🏛',
      colorCode: '§d',
      structureCostMult: 0.75,
      structureYieldMult: 1.30,
      summary: '-25% цены освоения мировых структур и +30% их добычи.'
    },
    ruthless_raider: {
      id: 'ruthless_raider',
      name: 'Беспощадный рейдер',
      icon: '⚔',
      colorCode: '§4',
      captureCostMult: 0.75,
      startingRelBonus: -20,
      aggressionWeight: 35,
      summary: '-25% стоимость силового захвата секторов и частые рейды.'
    },
    steady_financier: {
      id: 'steady_financier',
      name: 'Стабильный финансист',
      icon: '🏦',
      colorCode: '§2',
      botCashBonus: 250,
      valuationMult: 1.08,
      landTaxMult: 0.80,
      summary: '+250 Cr резерва боту, -20% земельного налога и +8% к оценке.'
    }
  };

  function rollCompanyTraits(count, rngFn) {
    var rng = rngFn || Math.random;
    var allIds = Object.keys(COMPANY_TRAITS);
    var desired = Math.max(1, Math.min(3, Math.floor(Number(count || 2))));
    var picked = [];
    var pool = allIds.slice();
    while (picked.length < desired && pool.length > 0) {
      var idx = Math.floor(rng() * pool.length) % pool.length;
      picked.push(pool.splice(idx, 1)[0]);
    }
    return picked;
  }

  function getCompanyTraitModifiers(comp) {
    var mods = {
      claimCostMult: 1.0,
      captureCostMult: 1.0,
      buildCostMult: 1.0,
      structureCostMult: 1.0,
      fortifyCostMult: 1.0,
      diplomacyCostMult: 1.0,
      upkeepMult: 1.0,
      landTaxMult: 1.0,
      securityUpkeepMult: 1.0,
      incomeMult: 1.0,
      yieldMult: 1.0,
      structureYieldMult: 1.0,
      extraAdjacencyPct: 0,
      startingStrengthBonus: 0,
      startingRelBonus: 0,
      aggressionWeight: 0,
      valuationMult: 1.0,
      botExpandThreshold: 600,
      botCashBonus: 0
    };
    if (!comp || !comp.traits || !comp.traits.length) return mods;
    for (var i = 0; i < comp.traits.length; i++) {
      var tr = COMPANY_TRAITS[comp.traits[i]];
      if (!tr) continue;
      if (tr.claimCostMult) mods.claimCostMult *= Number(tr.claimCostMult);
      if (tr.captureCostMult) mods.captureCostMult *= Number(tr.captureCostMult);
      if (tr.buildCostMult) mods.buildCostMult *= Number(tr.buildCostMult);
      if (tr.structureCostMult) mods.structureCostMult *= Number(tr.structureCostMult);
      if (tr.fortifyCostMult) mods.fortifyCostMult *= Number(tr.fortifyCostMult);
      if (tr.diplomacyCostMult) mods.diplomacyCostMult *= Number(tr.diplomacyCostMult);
      if (tr.upkeepMult) mods.upkeepMult *= Number(tr.upkeepMult);
      if (tr.landTaxMult) mods.landTaxMult *= Number(tr.landTaxMult);
      if (tr.securityUpkeepMult) mods.securityUpkeepMult *= Number(tr.securityUpkeepMult);
      if (tr.incomeMult) mods.incomeMult *= Number(tr.incomeMult);
      if (tr.yieldMult) mods.yieldMult *= Number(tr.yieldMult);
      if (tr.structureYieldMult) mods.structureYieldMult *= Number(tr.structureYieldMult);
      if (tr.extraAdjacencyPct) mods.extraAdjacencyPct += Number(tr.extraAdjacencyPct);
      if (tr.startingStrengthBonus) mods.startingStrengthBonus += Number(tr.startingStrengthBonus);
      if (tr.startingRelBonus) mods.startingRelBonus += Number(tr.startingRelBonus);
      if (tr.aggressionWeight) mods.aggressionWeight += Number(tr.aggressionWeight);
      if (tr.valuationMult) mods.valuationMult *= Number(tr.valuationMult);
      if (tr.botExpandThreshold) mods.botExpandThreshold = Math.min(mods.botExpandThreshold, Number(tr.botExpandThreshold));
      if (tr.botCashBonus) mods.botCashBonus += Number(tr.botCashBonus);
    }
    return mods;
  }

  function formatCompanyTraits(comp) {
    if (!comp || !comp.traits || !comp.traits.length) return 'нет';
    return comp.traits.map(function (tid) {
      var tr = COMPANY_TRAITS[tid];
      return tr ? (tr.colorCode + tr.icon + ' ' + tr.name + '§f') : tid;
    }).join(', ');
  }

  var DEFAULT_BOT_COMPANIES = [
    {
      id: 'bot_ironrail',
      name: 'Подземный Синдикат',
      archetype: 'mining_syndicate',
      color: 'gold',
      colorCode: '§6',
      tag: 'DEEP',
      transportSpec: 'underground',
      resourceSpec: 'mining',
      envType: 'underground',
      hqSx: 7,
      hqSz: 2,
      hqY: -44,
      cash: 1500
    },
    {
      id: 'bot_greencart',
      name: 'Зелёный Обоз',
      archetype: 'agro_holding',
      color: 'green',
      colorCode: '§a',
      tag: 'AGRO',
      transportSpec: 'road',
      resourceSpec: 'agro',
      envType: 'normal',
      hqSx: -7,
      hqSz: -2,
      hqY: 70,
      cash: 1500
    },
    {
      id: 'bot_skyport',
      name: 'Небесный Альянс',
      archetype: 'aero_logistics',
      color: 'aqua',
      colorCode: '§b',
      tag: 'AERO',
      transportSpec: 'air',
      resourceSpec: 'energy',
      envType: 'air',
      hqSx: 2,
      hqSz: -8,
      hqY: 286,
      cash: 1500
    },
    {
      id: 'bot_seawolf',
      name: 'Морской Конвой',
      archetype: 'marine_cartel',
      color: 'blue',
      colorCode: '§9',
      tag: 'SEA',
      transportSpec: 'sea',
      resourceSpec: 'forestry',
      envType: 'sea',
      hqSx: -3,
      hqSz: 8,
      hqY: 64,
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
    },
    bot_seawolf: {
      buy: [
        { item: 'longhaul:treated_timber', qty: 4, price: 185 },
        { item: 'minecraft:iron_ingot', qty: 16, price: 115 },
        { item: 'minecraft:coal', qty: 24, price: 70 }
      ],
      sell: [
        { item: 'longhaul:marine_reagent', qty: 4, price: 195 },
        { item: 'minecraft:oak_log', qty: 24, price: 72 },
        { item: 'longhaul:technical_oil', qty: 4, price: 225 }
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
      upkeepCost: 14,
      upgradeUpkeepPerLevel: 16,
      inputItems: { 'minecraft:oak_planks': 2, 'minecraft:coal': 1 },
      upgradeItems: { 'minecraft:iron_ingot': 4, 'minecraft:redstone': 2 },
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
      upkeepCost: 18,
      upgradeUpkeepPerLevel: 20,
      inputItems: { 'minecraft:coal': 2, 'minecraft:iron_ingot': 1 },
      upgradeItems: { 'minecraft:copper_ingot': 4, 'minecraft:redstone': 4 },
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
      upkeepCost: 12,
      upgradeUpkeepPerLevel: 14,
      inputItems: { 'minecraft:oak_log': 2, 'minecraft:iron_ingot': 1 },
      upgradeItems: { 'minecraft:iron_ingot': 4, 'minecraft:oak_planks': 6 },
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
      upkeepCost: 26,
      upgradeUpkeepPerLevel: 24,
      inputItems: { 'longhaul:technical_oil': 1, 'minecraft:coal': 2 },
      upgradeItems: { 'minecraft:copper_ingot': 6, 'minecraft:gold_ingot': 2 },
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
      upkeepCost: 22,
      upgradeUpkeepPerLevel: 20,
      inputItems: { 'minecraft:raw_iron': 3, 'minecraft:coal': 2 },
      upgradeItems: { 'minecraft:iron_ingot': 6, 'minecraft:redstone': 4 },
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
      upkeepCost: 24,
      upgradeUpkeepPerLevel: 22,
      inputItems: { 'minecraft:raw_iron': 2, 'minecraft:coal': 3 },
      upgradeItems: { 'minecraft:gold_ingot': 3, 'minecraft:redstone': 6 },
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
    },
    patrol_post: {
      id: 'patrol_post',
      category: 'security',
      categoryName: 'Охрана',
      name: 'Пост патруля',
      icon: 'minecraft:iron_sword',
      mapSym: 'P',
      cost: 380,
      baseIncome: 12,
      baseProduct: 'minecraft:arrow',
      baseQty: 4,
      baseRadius: 256,
      upkeepCost: 20,
      securityCost: 18,
      upgradeUpkeepPerLevel: 18,
      inputItems: { 'minecraft:iron_ingot': 1, 'minecraft:coal': 1 },
      upgradeItems: { 'minecraft:iron_ingot': 4, 'minecraft:gold_ingot': 2 },
      summary: 'Охраняет границы в радиусе 256 м: шлёт тревоги о вторжении, добыче, убийстве мобов и сборе ресурсов; на 3-м ур. спавнит охранников.',
      tier1Fork: [
        {
          id: 'radar_watchtower',
          name: 'Радарная вышка',
          icon: 'minecraft:spyglass',
          cost: 460,
          incomeMult: 1.20,
          yieldMult: 1.35,
          patrolRadius: 420,
          markIntruders: true,
          summary: 'Радиус охраны 420 м и подсветка нарушителей. Блокирует Гарнизон перехвата.'
        },
        {
          id: 'interceptor_garrison',
          name: 'Гарнизон перехвата',
          icon: 'minecraft:crossbow',
          cost: 480,
          incomeMult: 1.35,
          yieldMult: 1.60,
          patrolRadius: 340,
          penaltyMult: 1.45,
          bonusProduct: 'minecraft:spectral_arrow',
          bonusQty: 2,
          summary: 'Радиус 340 м, ×1.45 штрафы нарушителям и +2 спектр. стрелы/цикл. Блокирует Радарную вышку.'
        }
      ],
      tier2Fork: [
        {
          id: 'autonomous_sentinel',
          name: 'Автономный гарнизон',
          icon: 'minecraft:iron_chestplate',
          cost: 820,
          incomeMult: 1.40,
          yieldMult: 1.60,
          patrolRadius: 560,
          spawnGuards: true,
          guardCount: 2,
          guardMob: 'minecraft:pillager',
          summary: 'Радиус до 560 м и спавн 2 враждебных охранников-патрульных рядом с нарушителем. Блокирует Цитадель стражи.'
        },
        {
          id: 'warden_bunker',
          name: 'Цитадель стражи',
          icon: 'minecraft:netherite_sword',
          cost: 860,
          incomeMult: 1.50,
          yieldMult: 1.50,
          patrolRadius: 480,
          spawnGuards: true,
          guardCount: 3,
          guardMob: 'minecraft:vindicator',
          summary: 'Радиус 480 м и спавн 3 элитных поборников-охранников рядом с нарушителем. Блокирует Автономный гарнизон.'
        }
      ]
    },
    sawmill: {
      id: 'sawmill',
      category: 'extraction',
      categoryName: 'Добыча',
      name: 'Лесопилка',
      icon: 'minecraft:iron_axe',
      mapSym: 'L',
      cost: 280,
      baseIncome: 34,
      baseProduct: 'minecraft:oak_log',
      baseQty: 8,
      upkeepCost: 11,
      upgradeUpkeepPerLevel: 12,
      inputItems: { 'minecraft:iron_ingot': 1 },
      upgradeItems: { 'minecraft:iron_ingot': 4, 'minecraft:oak_log': 8 },
      summary: 'Заготавливает древесину, древесный уголь и пропитанный брус.',
      tier1Fork: [
        { id: 'kiln_drying', name: 'Сушильная камера', icon: 'minecraft:charcoal', cost: 340, incomeMult: 1.60, yieldMult: 1.35, bonusProduct: 'minecraft:charcoal', bonusQty: 8, summary: '+60% дохода и +8 древесного угля/цикл. Блокирует Строевой цех.' },
        { id: 'timber_mill', name: 'Строевой цех', icon: 'longhaul:treated_timber', cost: 360, incomeMult: 1.40, yieldMult: 1.90, bonusProduct: 'longhaul:treated_timber', bonusQty: 2, summary: '×1.90 бревна и +2 обработанного бруса/цикл. Блокирует Сушильную камеру.' }
      ],
      tier2Fork: [
        { id: 'forestry_harvester', name: 'Механический харвестер', icon: 'create:mechanical_saw', cost: 680, incomeMult: 1.55, yieldMult: 1.75, summary: '+75% заготовки леса и +55% прибыли. Блокирует Бумажный комбинат.' },
        { id: 'pulp_mill', name: 'Бумажный комбинат', icon: 'minecraft:paper', cost: 660, incomeMult: 1.85, yieldMult: 1.35, summary: '+85% прибыли с переработки целлюлозы. Блокирует Механический харвестер.' }
      ]
    },
    quarry: {
      id: 'quarry',
      category: 'extraction',
      categoryName: 'Добыча',
      name: 'Каменоломня',
      icon: 'minecraft:stone_bricks',
      mapSym: 'Q',
      cost: 340,
      baseIncome: 40,
      baseProduct: 'minecraft:deepslate',
      baseQty: 10,
      upkeepCost: 14,
      upgradeUpkeepPerLevel: 15,
      inputItems: { 'minecraft:coal': 2, 'minecraft:oak_planks': 2 },
      upgradeItems: { 'minecraft:iron_ingot': 4, 'minecraft:copper_ingot': 4 },
      summary: 'Добывает строительный камень, андезит, сланец и огнеупорные смеси.',
      tier1Fork: [
        { id: 'andesite_vein', name: 'Андезитовый пласт', icon: 'create:andesite_alloy', cost: 400, incomeMult: 1.55, yieldMult: 1.65, bonusProduct: 'create:andesite_alloy', bonusQty: 4, summary: '+65% камня и +4 андезитового сплава/цикл. Блокирует Огнеупорный карьер.' },
        { id: 'refractory_kiln', name: 'Огнеупорный карьер', icon: 'longhaul:refractory_mix', cost: 420, incomeMult: 1.75, yieldMult: 1.35, bonusProduct: 'longhaul:refractory_mix', bonusQty: 2, summary: '+75% дохода и +2 огнеупорной смеси/цикл. Блокирует Андезитовый пласт.' }
      ],
      tier2Fork: [
        { id: 'diamond_wire_saw', name: 'Алмазная канатная пила', icon: 'minecraft:diamond', cost: 740, incomeMult: 1.70, yieldMult: 1.55, summary: '+70% дохода и +55% блоков. Блокирует Гравитационную дробилку.' },
        { id: 'gravity_crusher', name: 'Гравитационная дробилка', icon: 'create:crushing_wheel', cost: 720, incomeMult: 1.45, yieldMult: 1.95, summary: '+95% объёма породы и щебня. Блокирует Алмазную канатную пилу.' }
      ]
    },
    agro_complex: {
      id: 'agro_complex',
      category: 'production',
      categoryName: 'Производство',
      name: 'Агрокомплекс',
      icon: 'minecraft:wheat',
      mapSym: 'G',
      cost: 300,
      baseIncome: 36,
      baseProduct: 'minecraft:bread',
      baseQty: 8,
      upkeepCost: 11,
      upgradeUpkeepPerLevel: 12,
      inputItems: { 'minecraft:bone_meal': 2, 'minecraft:coal': 1 },
      upgradeItems: { 'minecraft:iron_ingot': 3, 'minecraft:gold_ingot': 1 },
      summary: 'Выращивает продовольствие, пайки и техническое сырьё.',
      tier1Fork: [
        { id: 'hydroponics', name: 'Гидропоника', icon: 'minecraft:golden_carrot', cost: 380, incomeMult: 1.70, yieldMult: 1.45, bonusProduct: 'minecraft:golden_carrot', bonusQty: 4, summary: '+70% выручки и +4 золотые моркови/цикл. Блокирует Пайковый конвейер.' },
        { id: 'ration_cannery', name: 'Пайковый конвейер', icon: 'longhaul:field_rations', cost: 400, incomeMult: 1.45, yieldMult: 1.90, bonusProduct: 'longhaul:field_rations', bonusQty: 2, summary: '×1.90 объёма и +2 полевых пайка/цикл. Блокирует Гидропонику.' }
      ],
      tier2Fork: [
        { id: 'bio_greenhouse', name: 'Био-оранжерея', icon: 'minecraft:honey_bottle', cost: 700, incomeMult: 1.65, yieldMult: 1.60, summary: '+65% прибыли и +60% урожая. Блокирует Зерновой элеватор.' },
        { id: 'grain_elevator', name: 'Зерновой элеватор', icon: 'create:millstone', cost: 680, incomeMult: 1.40, yieldMult: 2.00, summary: '×2.0 объёма продовольствия. Блокирует Био-оранжерею.' }
      ]
    },
    chemical_plant: {
      id: 'chemical_plant',
      category: 'production',
      categoryName: 'Производство',
      name: 'Химкомбинат',
      icon: 'minecraft:brewing_stand',
      mapSym: 'C',
      cost: 520,
      baseIncome: 66,
      baseProduct: 'longhaul:marine_reagent',
      baseQty: 2,
      upkeepCost: 24,
      upgradeUpkeepPerLevel: 22,
      inputItems: { 'minecraft:coal': 2, 'minecraft:redstone': 2 },
      upgradeItems: { 'minecraft:gold_ingot': 3, 'minecraft:diamond': 1 },
      summary: 'Производит химреагенты, порох, полимеры и реагенты очистки.',
      tier1Fork: [
        { id: 'acid_synthesis', name: 'Кислотный синтез', icon: 'minecraft:blaze_powder', cost: 500, incomeMult: 1.75, yieldMult: 1.40, bonusProduct: 'minecraft:gunpowder', bonusQty: 6, summary: '+75% прибыли и +6 пороха/цикл. Блокирует Полимерный цех.' },
        { id: 'polymer_reactor', name: 'Полимерный цех', icon: 'longhaul:technical_glass', cost: 480, incomeMult: 1.45, yieldMult: 1.85, bonusProduct: 'longhaul:technical_glass', bonusQty: 2, summary: '+85% реагентов и +2 тех. стекла/цикл. Блокирует Кислотный синтез.' }
      ],
      tier2Fork: [
        { id: 'electrolysis_array', name: 'Электролизный блок', icon: 'minecraft:redstone_block', cost: 900, incomeMult: 1.80, yieldMult: 1.50, summary: '+80% выручки и +50% выхода. Блокирует Катализ высокого давления.' },
        { id: 'high_pressure_catalysis', name: 'Катализ высокого давления', icon: 'minecraft:ghast_tear', cost: 880, incomeMult: 1.50, yieldMult: 1.95, summary: '+95% товарного выпуска химикатов. Блокирует Электролизный блок.' }
      ]
    },
    power_plant: {
      id: 'power_plant',
      category: 'energy',
      categoryName: 'Энергетика',
      name: 'Энергоподстанция',
      icon: 'minecraft:lightning_rod',
      mapSym: 'E',
      cost: 460,
      baseIncome: 44,
      baseProduct: 'minecraft:redstone',
      baseQty: 6,
      upkeepCost: 18,
      upgradeUpkeepPerLevel: 18,
      inputItems: { 'minecraft:coal': 3 },
      upgradeItems: { 'minecraft:copper_ingot': 6, 'minecraft:redstone': 6 },
      summary: 'Питает соседние сектора компании: +20% (Ур.1), +35% (Ур.2) и +50% (Ур.3) к выработке всех построек рядом.',
      tier1Fork: [
        { id: 'steam_turbine', name: 'Паровая турбина', icon: 'create:steam_engine', cost: 480, incomeMult: 1.55, yieldMult: 1.45, adjacencyBonus: 0.35, bonusProduct: 'minecraft:copper_ingot', bonusQty: 4, summary: 'Усиливает соседние предприятия до +35% и даёт +4 меди/цикл. Блокирует Высоковольтную ЛЭП.' },
        { id: 'hv_grid', name: 'Высоковольтная ЛЭП', icon: 'minecraft:copper_block', cost: 460, incomeMult: 1.40, yieldMult: 1.65, adjacencyBonus: 0.35, bonusProduct: 'minecraft:redstone', bonusQty: 6, summary: 'Усиливает соседние предприятия до +35% и +6 редстоуна/цикл. Блокирует Паровую турбину.' }
      ],
      tier2Fork: [
        { id: 'fusion_substation', name: 'Термоядерный узел', icon: 'minecraft:nether_star', cost: 920, incomeMult: 1.80, yieldMult: 1.55, adjacencyBonus: 0.50, summary: 'Бонус соседних секторов до +50% и +80% собственной прибыли. Блокирует Каскадный трансформатор.' },
        { id: 'cascade_transformer', name: 'Каскадный трансформатор', icon: 'minecraft:amethyst_shard', cost: 880, incomeMult: 1.55, yieldMult: 1.85, adjacencyBonus: 0.50, summary: 'Бонус соседних секторов до +50% и +85% ресурсов. Блокирует Термоядерный узел.' }
      ]
    },
    road_depot: {
      id: 'road_depot',
      category: 'logistics',
      categoryName: 'Логистика',
      name: 'Автостанция и дорога',
      icon: 'automobility:automobile',
      mapSym: 'R',
      cost: 220,
      baseIncome: 26,
      baseProduct: 'minecraft:cobblestone',
      baseQty: 8,
      upkeepCost: 8,
      upgradeUpkeepPerLevel: 10,
      inputItems: { 'minecraft:coal': 1 },
      upgradeItems: { 'minecraft:iron_ingot': 3, 'minecraft:cobblestone': 8 },
      summary: 'Пристраивает автодорожную развязку к сектору и соседним заводам: открывает автоконвои (Automobility, 10.5 м/с).',
      tier1Fork: [
        { id: 'asphalt_highway', name: 'Скоростная магистраль', icon: 'automobility:dash_panel', cost: 280, incomeMult: 1.50, yieldMult: 1.40, bonusProduct: 'minecraft:iron_nugget', bonusQty: 6, summary: '+50% дохода и +25% скорости дорожных конвоев. Блокирует Грузовую эстакаду.' },
        { id: 'freight_yard', name: 'Грузовая эстакада', icon: 'create:chute', cost: 300, incomeMult: 1.35, yieldMult: 1.80, bonusProduct: 'create:iron_sheet', bonusQty: 3, summary: '+80% выпуска и +3 жел. пластины/цикл. Блокирует Скоростную магистраль.' }
      ],
      tier2Fork: [
        { id: 'toll_plaza', name: 'Платный автобан', icon: 'minecraft:gold_ingot', cost: 540, incomeMult: 1.80, yieldMult: 1.30, summary: '+80% транзитной выручки с автопотока. Блокирует Логистический хаб.' },
        { id: 'auto_dispatch', name: 'Диспетчерский парк', icon: 'minecraft:compass', cost: 520, incomeMult: 1.45, yieldMult: 1.85, summary: '+85% пропускной способности дорог. Блокирует Платный автобан.' }
      ]
    },
    rail_depot: {
      id: 'rail_depot',
      category: 'logistics',
      categoryName: 'Логистика',
      name: 'Ж/Д депо и пути',
      icon: 'create:track',
      mapSym: 'J',
      cost: 360,
      baseIncome: 46,
      baseProduct: 'create:track',
      baseQty: 4,
      upkeepCost: 15,
      upgradeUpkeepPerLevel: 16,
      inputItems: { 'minecraft:coal': 2, 'minecraft:iron_ingot': 1 },
      upgradeItems: { 'create:track': 6, 'minecraft:iron_ingot': 4 },
      summary: 'Подключает сектор и соседние заводы к Ж/Д магистралям Create: открывает тяжёлые поезда (16.0 м/с, 64 груза).',
      tier1Fork: [
        { id: 'steam_locomotive', name: 'Паровозное депо', icon: 'create:steam_engine', cost: 420, incomeMult: 1.65, yieldMult: 1.40, bonusProduct: 'create:track', bonusQty: 4, summary: '+65% дохода и +4 рельсы/цикл. Блокирует Сортировочную горку.' },
        { id: 'marshalling_yard', name: 'Сортировочная горка', icon: 'minecraft:powered_rail', cost: 400, incomeMult: 1.35, yieldMult: 1.90, bonusProduct: 'minecraft:iron_ingot', bonusQty: 4, summary: '+90% объёма и +4 железа/цикл. Блокирует Паровозное депо.' }
      ],
      tier2Fork: [
        { id: 'maglev_corridor', name: 'Экспресс-магистраль', icon: 'minecraft:redstone_block', cost: 780, incomeMult: 1.80, yieldMult: 1.45, summary: '+80% дохода от Ж/Д экспрессов. Блокирует Грузовой терминал.' },
        { id: 'freight_terminal', name: 'Тяжёлый грузовой терминал', icon: 'create:brass_funnel', cost: 740, incomeMult: 1.45, yieldMult: 1.95, summary: '+95% грузовместимости узла. Блокирует Экспресс-магистраль.' }
      ]
    },
    port: {
      id: 'port',
      category: 'logistics',
      categoryName: 'Логистика',
      name: 'Грузовой порт',
      icon: 'smallships:oak_cog',
      mapSym: 'P',
      cost: 340,
      baseIncome: 44,
      baseProduct: 'minecraft:oak_boat',
      baseQty: 1,
      upkeepCost: 14,
      upgradeUpkeepPerLevel: 15,
      inputItems: { 'minecraft:oak_planks': 2, 'minecraft:coal': 1 },
      upgradeItems: { 'minecraft:oak_planks': 8, 'minecraft:iron_ingot': 4 },
      summary: 'Пристраивает причал к сектору и соседним заводам: открывает водные конвои (Small Ships / лодки, 12.0 м/с, 48 груза).',
      tier1Fork: [
        { id: 'deep_harbor', name: 'Глубоководный причал', icon: 'minecraft:prismarine_shard', cost: 400, incomeMult: 1.65, yieldMult: 1.40, bonusProduct: 'minecraft:cod', bonusQty: 6, summary: '+65% прибыли от морских рейсов. Блокирует Верфь.' },
        { id: 'shipyard_dock', name: 'Судостроительная верфь', icon: 'minecraft:oak_chest_boat', cost: 390, incomeMult: 1.40, yieldMult: 1.85, bonusProduct: 'minecraft:oak_planks', bonusQty: 10, summary: '+85% судовых материалов и досок. Блокирует Глубоководный причал.' }
      ],
      tier2Fork: [
        { id: 'free_port', name: 'Порто-франко', icon: 'minecraft:emerald', cost: 760, incomeMult: 1.85, yieldMult: 1.40, summary: '+85% торговой маржи порта. Блокирует Контейнерный кран.' },
        { id: 'container_crane', name: 'Контейнерный кран', icon: 'create:gantry_carriage', cost: 720, incomeMult: 1.45, yieldMult: 1.95, summary: '+95% отгрузки баржами. Блокирует Порто-франко.' }
      ]
    },
    trade_exchange: {
      id: 'trade_exchange',
      category: 'logistics',
      categoryName: 'Логистика',
      name: 'Торговый терминал',
      icon: 'minecraft:emerald',
      mapSym: 'T',
      cost: 440,
      baseIncome: 62,
      baseProduct: 'minecraft:emerald',
      baseQty: 2,
      upkeepCost: 16,
      upgradeUpkeepPerLevel: 16,
      inputItems: { 'minecraft:paper': 2, 'minecraft:gold_nugget': 2 },
      upgradeItems: { 'minecraft:emerald': 2, 'minecraft:gold_ingot': 3 },
      summary: 'Приносит брокерскую комиссию и изумрудную валюту с каждого цикла.',
      tier1Fork: [
        { id: 'commodity_desk', name: 'Товарная биржа', icon: 'minecraft:gold_ingot', cost: 440, incomeMult: 1.75, yieldMult: 1.35, bonusProduct: 'minecraft:gold_ingot', bonusQty: 2, summary: '+75% прибыли и +2 золота/цикл. Блокирует Таможенный брокер.' },
        { id: 'customs_broker', name: 'Таможенный брокер', icon: 'minecraft:compass', cost: 420, incomeMult: 1.45, yieldMult: 1.80, bonusProduct: 'minecraft:emerald', bonusQty: 2, summary: '+80% валюты и +2 изумруда/цикл. Блокирует Товарную биржу.' }
      ],
      tier2Fork: [
        { id: 'clearing_house', name: 'Клиринговый дом', icon: 'minecraft:emerald_block', cost: 840, incomeMult: 1.85, yieldMult: 1.45, summary: '+85% прибыли с оборота. Блокирует Фьючерсный центр.' },
        { id: 'futures_desk', name: 'Фьючерсный центр', icon: 'minecraft:clock', cost: 800, incomeMult: 1.55, yieldMult: 1.90, summary: '+90% выпуска активов. Блокирует Клиринговый дом.' }
      ]
    },
    structure_facility: {
      id: 'structure_facility',
      category: 'structure',
      categoryName: 'Мировая структура',
      name: 'Освоенная структура',
      icon: 'minecraft:lodestone',
      mapSym: 'S',
      cost: 360,
      baseIncome: 52,
      baseProduct: 'minecraft:iron_ingot',
      baseQty: 4,
      upkeepCost: 16,
      upgradeUpkeepPerLevel: 18,
      requiresWorldStructure: true,
      inputItems: { 'minecraft:coal': 1 },
      upgradeItems: { 'minecraft:iron_ingot': 4, 'minecraft:emerald': 2 },
      summary: 'Перепрофилирует существующую в секторе мировую структуру в уникальное производство (1 вид структуры = 1 уникальный ресурс).',
      tier1Fork: [
        { id: 'high_value_refine', name: 'Глубокая переработка', icon: 'minecraft:emerald', cost: 440, incomeMult: 1.75, yieldMult: 1.35, summary: '+75% дохода Cr и бонусный побочный ресурс структуры. Блокирует Интенсивный промысел.' },
        { id: 'mass_extraction', name: 'Интенсивный промысел', icon: 'create:mechanical_drill', cost: 420, incomeMult: 1.35, yieldMult: 2.00, summary: '×2.0 выпуска уникального ресурса структуры. Блокирует Глубокую переработку.' }
      ],
      tier2Fork: [
        { id: 'monopoly_brand', name: 'Монопольный бренд', icon: 'minecraft:nether_star', cost: 840, incomeMult: 1.80, yieldMult: 1.45, summary: '+80% выручки и +45% уникального товара. Блокирует Сетевой хаб.' },
        { id: 'automated_network', name: 'Сетевой хаб структуры', icon: 'create:brass_funnel', cost: 800, incomeMult: 1.45, yieldMult: 1.95, summary: '+95% товарного выпуска структуры. Блокирует Монопольный бренд.' }
      ]
    }
  };

  var PROGRESSIVE_TAX_BRACKETS = [
    { upTo: 200, rate: 0.05, label: '5% (Стартовая)' },
    { upTo: 600, rate: 0.15, label: '15% (Малый бизнес)' },
    { upTo: 1500, rate: 0.30, label: '30% (Средний)' },
    { upTo: 3500, rate: 0.50, label: '50% (Крупный)' },
    { upTo: 7000, rate: 0.72, label: '72% (Корпоративный)' },
    { upTo: 1e12, rate: 0.90, label: '90% (Сверхприбыль)' }
  ];

  var FUEL_EQUIVALENTS = {
    'minecraft:coal': 1,
    'minecraft:charcoal': 1,
    'longhaul:technical_oil': 3,
    'gtceu:oil_bucket': 3,
    'minecraft:lava_bucket': 4,
    'minecraft:coal_block': 9,
    'minecraft:blaze_rod': 4
  };

  var PIRATE_SYNDICATE_ID = 'bot_pirates';
  var MAX_PLAYER_EXTERNAL_SHARES = 49;

  function ensureCompanyFinancialFields(comp, cid) {
    if (!comp) return comp;
    if (!comp.shareHoldings || typeof comp.shareHoldings !== 'object') {
      comp.shareHoldings = {};
      comp.shareHoldings[cid || comp.id] = 100;
    }
    if (!(comp.totalShares > 0)) comp.totalShares = 100;
    if (!(comp.unpaidUpkeep >= 0)) comp.unpaidUpkeep = 0;
    if (!(comp.taxAuditPenaltyCycles >= 0)) comp.taxAuditPenaltyCycles = 0;
    if (!(comp.taxAuditPenaltyRate >= 0)) comp.taxAuditPenaltyRate = 0;
    if (!(comp.taxEvasionDiscount >= 0)) comp.taxEvasionDiscount = 0;
    if (!(comp.lastComebackBailoutTick >= 0)) comp.lastComebackBailoutTick = 0;
    if (!(comp.pirateImmunityUntilTick >= 0)) comp.pirateImmunityUntilTick = 0;
    if (!(comp.forcedAuctionCount >= 0)) comp.forcedAuctionCount = 0;
    return comp;
  }

  function ensurePirateSyndicate(state) {
    if (!state) return null;
    if (!state.pirateSyndicate) {
      state.pirateSyndicate = {
        id: PIRATE_SYNDICATE_ID,
        name: 'Синдикат Корсаров',
        level: 1,
        power: 12,
        cash: 1200,
        caravansRobbed: 0,
        raidsCompleted: 0,
        lootStash: {
          'minecraft:iron_ingot': 12,
          'minecraft:coal': 24,
          'longhaul:technical_oil': 4
        },
        ordersHistory: []
      };
    }
    var ps = state.pirateSyndicate;
    if (!ps.lootStash) ps.lootStash = {};
    if (!ps.ordersHistory) ps.ordersHistory = [];
    if (!state.companies) state.companies = {};
    if (!state.companies[PIRATE_SYNDICATE_ID]) {
      state.companies[PIRATE_SYNDICATE_ID] = {
        id: PIRATE_SYNDICATE_ID,
        name: 'Синдикат Корсаров',
        archetype: 'raider_cartel',
        archetypeName: 'Корсарский синдикат',
        traits: ['raider_elite', 'smuggler_net'],
        color: 'dark_red',
        colorCode: '§4',
        tag: 'PIR',
        isBot: true,
        isPirate: true,
        owner: 'AI_PIRATES',
        members: [],
        cash: ps.cash || 1200,
        transportSpec: 'sea',
        resourceSpec: 'logistics',
        envType: 'sea',
        hqSx: -14,
        hqSz: -14,
        hqX: -14 * SECTOR_SIZE,
        hqY: 64,
        hqZ: -14 * SECTOR_SIZE,
        stockBuffer: {},
        incomeHistory: [],
        physicalStockEstimate: 0,
        stats: { deliveries: 0, tradeVolume: 0, blocksMined: 0, sectorsCaptured: 0, contractsDone: 0, routesDone: 0, raidsLaunched: 0, hostileCaptures: 0 }
      };
    }
    var pComp = state.companies[PIRATE_SYNDICATE_ID];
    pComp.isBot = true;
    pComp.isPirate = true;
    ensureCompanyFinancialFields(pComp, PIRATE_SYNDICATE_ID);
    ps.cash = pComp.cash;
    return ps;
  }

  function ensureDiplomacyState(state) {
    if (!state.buildings) state.buildings = {};
    if (!state.relations) state.relations = {};
    if (!state.playerRelations) state.playerRelations = {};
    if (!state.supplyContracts) state.supplyContracts = [];
    if (!state.sectorOffers) state.sectorOffers = [];
    if (!state.sectorStructures) state.sectorStructures = {};
    if (!state.structureCatalog) state.structureCatalog = {};
    if (!state.auctions) state.auctions = [];
    if (!state.activeMobRaids) state.activeMobRaids = [];
    if (!state.coalitions) state.coalitions = {};
    if (!state.centralBank) {
      state.centralBank = {
        keyRate: 0.08,
        baseRate: 0.08,
        inflationIndex: 1.0,
        totalIssued: 0,
        totalRepaid: 0,
        totalDefaulted: 0
      };
    }
    if (!state.loans) state.loans = [];
    if (!(state.nextLoanSeq > 0)) state.nextLoanSeq = 1;
    if (!(state.nextBuildingSeq > 0)) state.nextBuildingSeq = 1;
    if (!(state.nextSupplySeq > 0)) state.nextSupplySeq = 1;
    if (!(state.nextAuctionSeq > 0)) state.nextAuctionSeq = 1;
    if (!(state.nextMobRaidSeq > 0)) state.nextMobRaidSeq = 1;
    if (!(state.botChapterSpawnsDone >= 0)) state.botChapterSpawnsDone = 0;
    if (!(state.completedChapters >= 0)) state.completedChapters = 0;
    if (state.companies) {
      Object.keys(state.companies).forEach(function (cid) {
        ensureCompanyFinancialFields(state.companies[cid], cid);
      });
    }
    ensurePirateSyndicate(state);
    return state;
  }

  function relationKey(a, b) {
    return a < b ? (a + '|' + b) : (b + '|' + a);
  }

  function getPlayerRelation(state, playerId, companyId) {
    ensureDiplomacyState(state);
    if (!playerId || !companyId) {
      return { score: 0, trespassCount: 0, griefCount: 0, lastIncident: '' };
    }
    var k = String(playerId) + '|' + String(companyId);
    if (!state.playerRelations[k]) {
      state.playerRelations[k] = {
        score: 0,
        trespassCount: 0,
        griefCount: 0,
        lastIncident: ''
      };
    }
    return state.playerRelations[k];
  }

  function adjustPlayerRelation(state, playerId, companyId, delta, reason) {
    if (!playerId || !companyId) return 0;
    var r = getPlayerRelation(state, playerId, companyId);
    r.score = Math.max(-100, Math.min(100, Math.round(Number(r.score || 0) + Number(delta || 0))));
    if (reason) r.lastIncident = String(reason).slice(0, 120);
    return r.score;
  }

  function getEffectiveRelationScore(state, companyIdOrNull, playerIdOrNull, targetCompanyId) {
    ensureDiplomacyState(state);
    if (!targetCompanyId) return 0;
    if (companyIdOrNull && companyIdOrNull === targetCompanyId) return 100;
    if (companyIdOrNull && state.companies && state.companies[companyIdOrNull]) {
      return Number(getRelation(state, companyIdOrNull, targetCompanyId).score || 0);
    }
    if (playerIdOrNull) {
      return Number(getPlayerRelation(state, playerIdOrNull, targetCompanyId).score || 0);
    }
    return 0;
  }

  function getReputationPriceModifiers(score) {
    var s = Math.max(-100, Math.min(100, Number(score || 0)));
    var buyMult = s >= 0
      ? Math.max(0.70, 1.0 - (s / 100.0) * 0.30)
      : Math.min(1.75, 1.0 + (Math.abs(s) / 100.0) * 0.75);
    var sellMult = s >= 0
      ? Math.min(1.35, 1.0 + (s / 100.0) * 0.35)
      : Math.max(0.55, 1.0 - (Math.abs(s) / 100.0) * 0.45);
    return {
      score: Math.round(s),
      buyMult: Number(buyMult.toFixed(2)),
      sellMult: Number(sellMult.toFixed(2)),
      standing: getStandingLabel(s)
    };
  }

  function getAverageBotReputationScore(state, companyIdOrNull, playerIdOrNull) {
    ensureDiplomacyState(state);
    if (!state || !state.companies) return 0;
    var sum = 0;
    var cnt = 0;
    var ids = Object.keys(state.companies);
    for (var i = 0; i < ids.length; i++) {
      var c = state.companies[ids[i]];
      if (!c || !c.isBot) continue;
      sum += getEffectiveRelationScore(state, companyIdOrNull, playerIdOrNull, c.id);
      cnt++;
    }
    return cnt > 0 ? Math.round(sum / cnt) : 0;
  }

  function syncPlayerReputationToCompany(state, playerId, companyId) {
    ensureDiplomacyState(state);
    if (!playerId || !companyId || !state.companies || !state.companies[companyId]) return 0;
    var synced = 0;
    var prefix = String(playerId) + '|';
    var keys = Object.keys(state.playerRelations || {});
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (k.indexOf(prefix) !== 0) continue;
      var targetCid = k.slice(prefix.length);
      if (!targetCid || targetCid === companyId || !state.companies[targetCid]) continue;
      var pr = state.playerRelations[k];
      if (pr && Number(pr.score || 0) !== 0) {
        adjustRelation(state, companyId, targetCid, Math.round(Number(pr.score) * 0.75), pr.lastIncident || 'Личная репутация основателя');
        synced++;
      }
    }
    return synced;
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
    var tMods = getCompanyTraitModifiers(buyer);
    var cost = Math.round(base * mult * tMods.diplomacyCostMult);
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

  function recordTerritoryViolation(state, intruderCid, ownerCid, kind, sx, sz, playerId, penaltyMult) {
    ensureDiplomacyState(state);
    if (!ownerCid || intruderCid === ownerCid) return { violated: false };
    var owner = state.companies && state.companies[ownerCid];
    if (!owner) return { violated: false };
    var isMine = kind === 'break_block' || kind === 'break_ore' || kind === 'break_log';
    if (isMine && intruderCid && canMine(state, intruderCid, ownerCid)) return { violated: false };
    if (!isMine && intruderCid && canTransit(state, intruderCid, ownerCid)) return { violated: false };

    var mult = Math.max(1.0, Number(penaltyMult || 1.0));
    var baseDelta = kind === 'break_ore' ? -12 : (kind === 'break_block' || kind === 'break_log' ? -6 : (kind === 'mob_kill' ? -7 : -5));
    var baseFine = kind === 'break_ore' ? 20 : (kind === 'break_block' || kind === 'break_log' ? 10 : (kind === 'mob_kill' ? 12 : 8));
    var delta = Math.round(baseDelta * mult);
    var fine = Math.round(baseFine * mult);
    var paid = 0;
    var rel = null;
    var pRel = null;
    var reasonStr = (isMine ? 'Добыча в (' : (kind === 'mob_kill' ? 'Охота в (' : 'Нарушение границ (')) + sx + ',' + sz + ')';
    if (intruderCid && state.companies[intruderCid]) {
      rel = getRelation(state, intruderCid, ownerCid);
      if (isMine) rel.griefCount = (rel.griefCount || 0) + 1;
      else rel.trespassCount = (rel.trespassCount || 0) + 1;
      adjustRelation(state, intruderCid, ownerCid, delta, reasonStr);
      var intr = state.companies[intruderCid];
      if (intr.cash >= fine) {
        intr.cash -= fine;
        owner.cash += fine;
        paid = fine;
      }
    }
    if (playerId) {
      pRel = getPlayerRelation(state, playerId, ownerCid);
      if (isMine) pRel.griefCount = (pRel.griefCount || 0) + 1;
      else pRel.trespassCount = (pRel.trespassCount || 0) + 1;
      adjustPlayerRelation(state, playerId, ownerCid, delta, reasonStr);
    }
    var scNow = rel ? rel.score : (pRel ? pRel.score : delta);
    return {
      violated: true,
      kind: kind,
      delta: delta,
      fine: paid,
      newScore: scNow,
      standing: getStandingLabel(scNow),
      pricing: getReputationPriceModifiers(scNow),
      hostile: scNow <= -40
    };
  }

  function diplomaticBuySector(state, buyerCid, sx, sz, dimension) {
    ensureDiplomacyState(state);
    var buyer = state.companies && state.companies[buyerCid];
    var info = resolveSectorOwner(state, sx, sz, dimension);
    if (!buyer || info.kind !== 'claimed' || !info.owner || info.owner === buyerCid) {
      return { ok: false, reason: 'not_owned_by_other' };
    }
    var seller = state.companies[info.owner];
    if (!seller) return { ok: false, reason: 'no_seller' };
    if (info.isHq && countClaims(state, seller.id) <= 1) return { ok: false, reason: 'last_hq' };
    var rel = getRelation(state, buyerCid, seller.id);
    if (rel.score <= -30) return { ok: false, reason: 'hostile', score: rel.score };
    var mult = rel.alliance ? 0.75 : (rel.score >= 20 ? 0.85 : 1.0);
    var tMods = getCompanyTraitModifiers(buyer);
    var bldg = getSectorBuilding(state, sx, sz, dimension);
    var bldgVal = bldg ? (BUILDING_CATALOG[bldg.type] ? BUILDING_CATALOG[bldg.type].cost * bldg.level * 0.6 : 200) : 0;
    var price = Math.round((220 * info.strength + bldgVal) * mult * tMods.diplomacyCostMult);
    if (buyer.cash < price) return { ok: false, reason: 'no_cash', cost: price, cash: buyer.cash };
    buyer.cash -= price;
    seller.cash += price;
    var k = sectorKey(sx, sz, dimension);
    state.claims[k].owner = buyerCid;
    state.claims[k].isHq = false;
    if (bldg) bldg.owner = buyerCid;
    buyer.stats.sectorsCaptured = (buyer.stats.sectorsCaptured || 0) + 1;
    adjustRelation(state, buyerCid, seller.id, 5, 'Мирная покупка сектора (' + sx + ',' + sz + ')');
    return { ok: true, price: price, sellerName: seller.name, newScore: rel.score };
  }

  function offerSectorSale(state, sellerCid, buyerCid, sx, sz, price, dimension) {
    ensureDiplomacyState(state);
    var k = sectorKey(sx, sz, dimension);
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
      dimension: global.LHStructureProduction ? global.LHStructureProduction.normalizeDimension(dimension) : 'minecraft:overworld',
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
    var k = sectorKey(offer.sx, offer.sz, offer.dimension);
    var cl = state.claims[k];
    if (!buyer || !seller || !cl || cl.owner !== offer.sellerCid) return { ok: false, reason: 'invalid_state' };
    if (buyer.cash < offer.price) return { ok: false, reason: 'no_cash', cost: offer.price };
    buyer.cash -= offer.price;
    seller.cash += offer.price;
    cl.owner = buyerCid;
    cl.isHq = false;
    var bldg = getSectorBuilding(state, offer.sx, offer.sz, offer.dimension);
    if (bldg) bldg.owner = buyerCid;
    offer.status = 'completed';
    adjustRelation(state, buyerCid, seller.id, 6, 'Сделка по сектору');
    return { ok: true, offer: offer };
  }

  function getSectorBuilding(state, sx, sz, dimension) {
    ensureDiplomacyState(state);
    return state.buildings[sectorKey(sx, sz, dimension)] || null;
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

  function getCompanyEnvType(comp) {
    if (!comp) return 'normal';
    if (comp.envType && COMPANY_ENV_TYPES[comp.envType]) return comp.envType;
    if (comp.transportSpec && TRANSPORT_SPECS[comp.transportSpec] && TRANSPORT_SPECS[comp.transportSpec].envType) {
      return TRANSPORT_SPECS[comp.transportSpec].envType;
    }
    return 'normal';
  }

  function preferredBuildingY(envType, fallbackY) {
    if (envType === 'air') {
      var ay = Number(fallbackY);
      return (ay >= 278 && ay <= 300) ? Math.round(ay) : 286;
    }
    if (envType === 'sea') return 64;
    if (envType === 'underground') return -44;
    return Math.max(63, Math.round(Number(fallbackY || 70)));
  }

  function setCompanyEnvType(state, cid, envType) {
    var comp = state.companies && state.companies[cid];
    if (!comp) return { ok: false, reason: 'no_company' };
    if (!COMPANY_ENV_TYPES[envType]) return { ok: false, reason: 'bad_env' };
    comp.envType = envType;
    comp.hqY = preferredBuildingY(envType, comp.hqY);
    return { ok: true, envType: envType, info: COMPANY_ENV_TYPES[envType], hqY: comp.hqY };
  }

  function getCompanyTerminalCoords(state, cid) {
    var comp = state.companies && state.companies[cid];
    if (!comp) return null;
    if (comp.terminalPos && typeof comp.terminalPos.x === 'number') {
      return {
        x: Math.round(comp.terminalPos.x),
        y: Math.round(comp.terminalPos.y),
        z: Math.round(comp.terminalPos.z),
        sx: Number(comp.hqSx || 0),
        sz: Number(comp.hqSz || 0),
        envType: getCompanyEnvType(comp)
      };
    }
    var env = getCompanyEnvType(comp);
    var hx = (typeof comp.hqX === 'number') ? Math.round(comp.hqX) : (Number(comp.hqSx || 0) * SECTOR_SIZE);
    var hz = (typeof comp.hqZ === 'number') ? Math.round(comp.hqZ) : (Number(comp.hqSz || 0) * SECTOR_SIZE);
    var hy = (typeof comp.hqY === 'number') ? Math.round(comp.hqY) : preferredBuildingY(env, 70);
    return { x: hx, y: hy, z: hz, sx: Number(comp.hqSx || 0), sz: Number(comp.hqSz || 0), envType: env };
  }

  function syncStructureCatalog(state, structureIds, availableItemIds, structureDimMap) {
    ensureDiplomacyState(state);
    if (!global.LHStructureProduction) return {};
    state.structureCatalog = global.LHStructureProduction.buildStructureCatalog(
      structureIds || [],
      availableItemIds || null,
      state.structureCatalog || {},
      structureDimMap || null
    );
    return state.structureCatalog;
  }

  function recordSectorStructures(state, sx, sz, structureIds, dimension) {
    ensureDiplomacyState(state);
    var dim = global.LHStructureProduction ? global.LHStructureProduction.normalizeDimension(dimension) : 'minecraft:overworld';
    var k = sectorKey(sx, sz, dim);
    var prev = state.sectorStructures[k] || [];
    var added = [];
    for (var i = 0; i < (structureIds || []).length; i++) {
      var sid = String(structureIds[i] || '');
      if (!sid) continue;
      if (prev.indexOf(sid) === -1) {
        prev.push(sid);
        added.push(sid);
      }
      if (global.LHStructureProduction && !state.structureCatalog[sid]) {
        global.LHStructureProduction.resolveStructureSpec(state.structureCatalog, sid, null, dim);
      }
    }
    if (prev.length > 0) state.sectorStructures[k] = prev;
    return added;
  }

  function getSectorStructures(state, sx, sz, dimension) {
    ensureDiplomacyState(state);
    var dim = global.LHStructureProduction ? global.LHStructureProduction.normalizeDimension(dimension) : 'minecraft:overworld';
    var k = sectorKey(sx, sz, dim);
    var list = state.sectorStructures[k] || [];
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var sid = list[i];
      var sp = state.structureCatalog[sid] || (global.LHStructureProduction ? global.LHStructureProduction.resolveStructureSpec(state.structureCatalog, sid, null, dim) : null);
      if (sp) out.push(sp);
    }
    out.sort(function (a, b) {
      return (b.rarityRank || 1) - (a.rarityRank || 1);
    });
    return out;
  }

  function getBuildingRequiredInputs(b) {
    if (!b) return {};
    if (b.inputItems && typeof b.inputItems === 'object') return b.inputItems;
    var spec = BUILDING_CATALOG[b.type];
    return (spec && spec.inputItems) ? spec.inputItems : {};
  }

  function getBuildingFuelRequirements(b) {
    if (!b) return { fuelUnits: 1, preferredItem: 'minecraft:coal' };
    var spec = BUILDING_CATALOG[b.type] || {};
    var req = getBuildingRequiredInputs(b);
    var fuelUnits = 0;
    Object.keys(req || {}).forEach(function (iid) {
      if (FUEL_EQUIVALENTS[iid]) {
        fuelUnits += Math.max(1, Math.round(Number(req[iid] || 1))) * FUEL_EQUIVALENTS[iid];
      }
    });
    if (fuelUnits <= 0) {
      fuelUnits = (b.type === 'power_plant' || b.type === 'chemical_plant' || b.type === 'factory') ? 2 : 1;
    }
    return {
      fuelUnits: Math.max(1, fuelUnits),
      preferredItem: spec.fuelItem || 'minecraft:coal'
    };
  }

  function getBuildingOptionalInputs(b) {
    var req = getBuildingRequiredInputs(b);
    var opt = {};
    Object.keys(req || {}).forEach(function (iid) {
      if (!FUEL_EQUIVALENTS[iid]) opt[iid] = Math.max(1, Math.round(Number(req[iid] || 1)));
    });
    return opt;
  }

  function supplyBuildingInputs(state, cid, sx, sz, itemsMap, dimension) {
    ensureDiplomacyState(state);
    var b = getSectorBuilding(state, sx, sz, dimension);
    if (!b || (cid && b.owner !== cid)) return { ok: false, reason: 'not_found' };
    if (!b.inputBuffer) b.inputBuffer = {};
    var added = 0;
    Object.keys(itemsMap || {}).forEach(function (iid) {
      var q = Math.max(0, Math.round(Number(itemsMap[iid] || 0)));
      if (q > 0) {
        b.inputBuffer[iid] = Number(b.inputBuffer[iid] || 0) + q;
        added += q;
      }
    });
    if (added > 0 && (b.pausedReason === 'missing_inputs' || b.pausedReason === 'missing_fuel')) {
      b.pausedReason = null;
      b.missingItem = null;
    }
    return { ok: true, added: added, inputBuffer: b.inputBuffer };
  }

  function seedStarterInputs(b, reqInputs, cycles) {
    if (!b.inputBuffer) b.inputBuffer = {};
    var c = Math.max(0, Math.round(Number(cycles || 2)));
    if (c <= 0) return;
    var fuelInfo = getBuildingFuelRequirements(b);
    var hadFuel = false;
    Object.keys(reqInputs || {}).forEach(function (iid) {
      if (FUEL_EQUIVALENTS[iid]) hadFuel = true;
      b.inputBuffer[iid] = Number(b.inputBuffer[iid] || 0) + Math.max(1, Math.round(Number(reqInputs[iid] || 1))) * c;
    });
    if (!hadFuel) {
      b.inputBuffer[fuelInfo.preferredItem] = Number(b.inputBuffer[fuelInfo.preferredItem] || 0) + fuelInfo.fuelUnits * c;
    }
  }

  var BUILDING_VARIANTS = {
    sawmill: {
      oak: { id: 'oak', name: 'Дубовая лесопилка', product: 'minecraft:oak_log', icon: 'minecraft:oak_log' },
      spruce: { id: 'spruce', name: 'Таёжная (еловая) лесопилка', product: 'minecraft:spruce_log', icon: 'minecraft:spruce_log' },
      birch: { id: 'birch', name: 'Берёзовая лесопилка', product: 'minecraft:birch_log', icon: 'minecraft:birch_log' },
      jungle: { id: 'jungle', name: 'Тропическая лесопилка', product: 'minecraft:jungle_log', icon: 'minecraft:jungle_log' },
      acacia: { id: 'acacia', name: 'Саванная (акациевая) лесопилка', product: 'minecraft:acacia_log', icon: 'minecraft:acacia_log' },
      dark_oak: { id: 'dark_oak', name: 'Лесопилка тёмного леса', product: 'minecraft:dark_oak_log', icon: 'minecraft:dark_oak_log' },
      mangrove: { id: 'mangrove', name: 'Мангровая лесопилка', product: 'minecraft:mangrove_log', icon: 'minecraft:mangrove_log' },
      cherry: { id: 'cherry', name: 'Вишнёвая лесопилка', product: 'minecraft:cherry_log', icon: 'minecraft:cherry_log' },
      bamboo: { id: 'bamboo', name: 'Бамбуковая фактория', product: 'minecraft:bamboo_block', icon: 'minecraft:bamboo_block' },
      crimson: { id: 'crimson', name: 'Багровая лесопилка Незера', product: 'minecraft:crimson_stem', icon: 'minecraft:crimson_stem' },
      warped: { id: 'warped', name: 'Искажённая лесопилка Незера', product: 'minecraft:warped_stem', icon: 'minecraft:warped_stem' }
    },
    quarry: {
      deepslate: { id: 'deepslate', name: 'Глубинный сланец', product: 'minecraft:deepslate', icon: 'minecraft:deepslate' },
      sandstone: { id: 'sandstone', name: 'Пустынный карьер', product: 'minecraft:sandstone', icon: 'minecraft:sandstone' },
      terracotta: { id: 'terracotta', name: 'Глиняный карьер', product: 'minecraft:terracotta', icon: 'minecraft:terracotta' },
      calcite: { id: 'calcite', name: 'Горный известняк', product: 'minecraft:calcite', icon: 'minecraft:calcite' },
      basalt: { id: 'basalt', name: 'Базальтовый разлом', product: 'minecraft:basalt', icon: 'minecraft:basalt' },
      blackstone: { id: 'blackstone', name: 'Чернитная штольня', product: 'minecraft:blackstone', icon: 'minecraft:blackstone' },
      end_stone: { id: 'end_stone', name: 'Карьер Края', product: 'minecraft:end_stone', icon: 'minecraft:end_stone' }
    },
    mine_shaft: {
      raw_iron: { id: 'raw_iron', name: 'Железный рудник', product: 'minecraft:raw_iron', icon: 'minecraft:raw_iron' },
      raw_copper: { id: 'raw_copper', name: 'Медный рудник', product: 'minecraft:raw_copper', icon: 'minecraft:raw_copper' },
      raw_gold: { id: 'raw_gold', name: 'Золотой прииск', product: 'minecraft:raw_gold', icon: 'minecraft:raw_gold' },
      coal: { id: 'coal', name: 'Угольная шахта', product: 'minecraft:coal', icon: 'minecraft:coal' },
      redstone: { id: 'redstone', name: 'Редстоун-шахта', product: 'minecraft:redstone', icon: 'minecraft:redstone' },
      quartz: { id: 'quartz', name: 'Кварцевая выработка', product: 'minecraft:quartz', icon: 'minecraft:quartz' }
    },
    agro_complex: {
      bread: { id: 'bread', name: 'Хлебопашенный комплекс', product: 'minecraft:bread', icon: 'minecraft:bread' },
      sweet_berries: { id: 'sweet_berries', name: 'Таёжный ягодник', product: 'minecraft:sweet_berries', icon: 'minecraft:sweet_berries' },
      cocoa_beans: { id: 'cocoa_beans', name: 'Тропическая плантация', product: 'minecraft:cocoa_beans', icon: 'minecraft:cocoa_beans' },
      melon_slice: { id: 'melon_slice', name: 'Бахчевой комплекс', product: 'minecraft:melon_slice', icon: 'minecraft:melon_slice' },
      sugar_cane: { id: 'sugar_cane', name: 'Тростниковая ферма', product: 'minecraft:sugar_cane', icon: 'minecraft:sugar_cane' },
      nether_wart: { id: 'nether_wart', name: 'Незер-оранжерея', product: 'minecraft:nether_wart', icon: 'minecraft:nether_wart' }
    }
  };

  function resolveBuildingVariant(bType, biomeId, variantId, dimension, sx, sz) {
    var pool = BUILDING_VARIANTS[bType];
    if (!pool) return null;
    if (variantId && pool[variantId]) return pool[variantId];
    var bio = String(biomeId || '').toLowerCase();
    var dim = String(dimension || 'minecraft:overworld').toLowerCase();
    if (bType === 'sawmill') {
      if (dim.indexOf('nether') !== -1 || bio.indexOf('crimson') !== -1) return pool.crimson;
      if (bio.indexOf('warped') !== -1) return pool.warped;
      if (bio.indexOf('cherry') !== -1 || bio.indexOf('sakura') !== -1) return pool.cherry;
      if (bio.indexOf('mangrove') !== -1 || bio.indexOf('swamp') !== -1) return pool.mangrove;
      if (bio.indexOf('bamboo') !== -1) return pool.bamboo;
      if (bio.indexOf('jungle') !== -1) return pool.jungle;
      if (bio.indexOf('birch') !== -1) return pool.birch;
      if (bio.indexOf('dark_forest') !== -1 || bio.indexOf('dark_oak') !== -1) return pool.dark_oak;
      if (bio.indexOf('savanna') !== -1 || bio.indexOf('acacia') !== -1) return pool.acacia;
      if (bio.indexOf('taiga') !== -1 || bio.indexOf('snowy') !== -1 || bio.indexOf('grove') !== -1 || bio.indexOf('pine') !== -1 || bio.indexOf('frozen') !== -1) return pool.spruce;
      if (bio) return pool.oak;
      // Deterministic variety by sector coords when biomeId is not supplied
      var owKeys = ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak', 'mangrove', 'cherry'];
      var h = Math.abs((Number(sx || 0) * 73856093) ^ (Number(sz || 0) * 19349663));
      return pool[owKeys[h % owKeys.length]];
    }
    if (bType === 'quarry') {
      if (dim.indexOf('end') !== -1) return pool.end_stone;
      if (dim.indexOf('nether') !== -1) return pool.blackstone;
      if (bio.indexOf('desert') !== -1 || bio.indexOf('beach') !== -1) return pool.sandstone;
      if (bio.indexOf('badlands') !== -1 || bio.indexOf('mesa') !== -1) return pool.terracotta;
      if (bio.indexOf('mountain') !== -1 || bio.indexOf('peak') !== -1 || bio.indexOf('stony') !== -1) return pool.calcite;
      if (bio.indexOf('basalt') !== -1 || bio.indexOf('volcan') !== -1) return pool.basalt;
      return pool.deepslate;
    }
    if (bType === 'mine_shaft') {
      if (dim.indexOf('nether') !== -1) return pool.quartz;
      if (bio.indexOf('badlands') !== -1 || bio.indexOf('mesa') !== -1) return pool.raw_gold;
      if (bio.indexOf('dripstone') !== -1 || bio.indexOf('lush') !== -1) return pool.raw_copper;
      if (bio.indexOf('deep_dark') !== -1) return pool.redstone;
      return pool.raw_iron;
    }
    if (bType === 'agro_complex') {
      if (dim.indexOf('nether') !== -1) return pool.nether_wart;
      if (bio.indexOf('taiga') !== -1 || bio.indexOf('snowy') !== -1) return pool.sweet_berries;
      if (bio.indexOf('jungle') !== -1) return pool.cocoa_beans;
      if (bio.indexOf('savanna') !== -1) return pool.melon_slice;
      if (bio.indexOf('swamp') !== -1 || bio.indexOf('mangrove') !== -1 || bio.indexOf('river') !== -1) return pool.sugar_cane;
      return pool.bread;
    }
    return null;
  }

  function setBuildingVariant(state, cid, sx, sz, variantId, dimension) {
    ensureDiplomacyState(state);
    var b = getSectorBuilding(state, sx, sz, dimension);
    if (!b || (cid && b.owner !== cid)) return { ok: false, reason: 'not_found' };
    var pool = BUILDING_VARIANTS[b.type];
    if (!pool) return { ok: false, reason: 'no_variants' };
    var v = pool[variantId];
    if (!v) return { ok: false, reason: 'bad_variant' };
    b.variant = v.id;
    b.variantName = v.name;
    b.customProduct = v.product;
    return { ok: true, building: b, variant: v };
  }

  var RANDOM_PRODUCT_BUILDING_TYPES = {
    mine_shaft: true,
    oil_rig: true,
    refinery: true,
    sawmill: true,
    quarry: true,
    agro_complex: true,
    factory: true
  };

  function collectUsedBuildingProducts(state) {
    var used = {};
    Object.keys((state && state.buildings) || {}).forEach(function (bk) {
      var b = state.buildings[bk];
      if (!b) return;
      var p = b.productItem || b.customProduct;
      if (p) used[p] = bk;
    });
    return used;
  }

  function setBuildingCustomProduct(state, cid, sx, sz, itemIdOrRandom, dimension, availableItemIds, rngFn) {
    ensureDiplomacyState(state);
    var b = getSectorBuilding(state, sx, sz, dimension);
    if (!b || (cid && b.owner !== cid)) return { ok: false, reason: 'not_found' };
    var chosen = null;
    if (!itemIdOrRandom || String(itemIdOrRandom).toLowerCase() === 'random') {
      if (global.LHStructureProduction && typeof global.LHStructureProduction.pickRandomItemFromPool === 'function') {
        var used = collectUsedBuildingProducts(state);
        chosen = global.LHStructureProduction.pickRandomItemFromPool(
          (b.structureId || b.type) + ':' + b.id + ':' + (b.cyclesDone || 0) + ':' + Math.random(),
          availableItemIds || null,
          used,
          rngFn || Math.random
        );
      }
      if (!chosen) chosen = 'longhaul:machine_parts';
    } else {
      chosen = String(itemIdOrRandom);
      if (global.LHStructureProduction && !global.LHStructureProduction.isEligibleResourceItem(chosen)) {
        return { ok: false, reason: 'ineligible_item' };
      }
    }
    b.customProduct = chosen;
    if (b.type === 'structure_facility') b.productItem = chosen;
    b.variant = 'custom';
    b.variantName = 'Выпуск: ' + chosen;
    return { ok: true, building: b, productItem: chosen };
  }

  function setBuildingPlayerValuation(state, cid, sx, sz, customPrice, dimension) {
    ensureDiplomacyState(state);
    var b = getSectorBuilding(state, sx, sz, dimension);
    if (!b || (cid && b.owner !== cid)) return { ok: false, reason: 'not_found' };
    var p = Number(customPrice);
    if (isNaN(p) || p <= 0) {
      delete b.playerValuation;
      return { ok: true, cleared: true, building: b, playerValuation: null };
    }
    b.playerValuation = Math.max(10, Math.min(10000000, Math.round(p)));
    return { ok: true, cleared: false, building: b, playerValuation: b.playerValuation };
  }

  function buildCompanyBuilding(state, cid, sx, sz, bType, wx, wy, wz, options) {
    ensureDiplomacyState(state);
    var opts = options || {};
    var comp = state.companies && state.companies[cid];
    if (!comp) return { ok: false, reason: 'no_company' };
    var spec = BUILDING_CATALOG[bType];
    if (!spec) return { ok: false, reason: 'bad_type' };
    if (spec.requiresWorldStructure) {
      return { ok: false, reason: 'requires_world_structure' };
    }
    var dim = global.LHStructureProduction ? global.LHStructureProduction.normalizeDimension(opts.dimension || 'minecraft:overworld') : 'minecraft:overworld';
    var k = sectorKey(sx, sz, dim);
    var cl = state.claims[k];
    if (!cl || cl.owner !== cid) return { ok: false, reason: 'not_your_sector' };
    if (state.buildings[k]) return { ok: false, reason: 'already_built', existing: state.buildings[k] };
    var tMods = getCompanyTraitModifiers(comp);
    var cost = Math.max(50, Math.round(spec.cost * tMods.buildCostMult));
    if (comp.cash < cost) return { ok: false, reason: 'no_cash', cost: cost, cash: comp.cash };
    comp.cash -= cost;
    var env = getCompanyEnvType(comp);
    var resolvedY = (dim !== 'minecraft:overworld')
      ? Math.round(Number(wy || 70))
      : (env === 'normal' ? Math.max(63, Math.round(Number(wy || 70))) : preferredBuildingY(env, wy));
    var resolvedVariant = opts.variant ? resolveBuildingVariant(bType, opts.biomeId || null, opts.variant, dim, sx, sz) : null;
    var chosenProduct = null;
    var variantName = resolvedVariant ? resolvedVariant.name : null;
    if (opts.fixedProduct) {
      chosenProduct = String(opts.fixedProduct);
      variantName = 'Выпуск: ' + chosenProduct;
    } else if (resolvedVariant) {
      chosenProduct = resolvedVariant.product;
    } else if (RANDOM_PRODUCT_BUILDING_TYPES[bType] && global.LHStructureProduction && typeof global.LHStructureProduction.pickRandomItemFromPool === 'function') {
      var usedP = collectUsedBuildingProducts(state);
      var seedStr = bType + ':' + k + ':' + (state.nextBuildingSeq || 1);
      chosenProduct = global.LHStructureProduction.pickRandomItemFromPool(seedStr, opts.availableItemIds || null, usedP, opts.rng || null);
      variantName = 'Мод-продукт: ' + chosenProduct;
    } else {
      var fallbackV = resolveBuildingVariant(bType, opts.biomeId || null, null, dim, sx, sz);
      if (fallbackV) {
        resolvedVariant = fallbackV;
        chosenProduct = fallbackV.product;
        variantName = fallbackV.name;
      }
    }
    var bldg = {
      id: 'b' + (state.nextBuildingSeq++),
      type: bType,
      category: spec.category,
      envType: env,
      dimension: dim,
      biomeId: opts.biomeId ? String(opts.biomeId) : null,
      variant: resolvedVariant ? resolvedVariant.id : (chosenProduct ? 'mod_random' : null),
      variantName: variantName,
      customProduct: chosenProduct,
      owner: cid,
      sx: sx,
      sz: sz,
      key: k,
      x: Math.round(Number(wx || sx * SECTOR_SIZE)),
      y: resolvedY,
      z: Math.round(Number(wz || sz * SECTOR_SIZE)),
      halfSpan: 3,
      maxBlocks: 20,
      intactBlocks: 20,
      integrityPct: 100,
      operational: true,
      pausedReason: null,
      level: 1,
      branch1: null,
      locked1: null,
      branch2: null,
      locked2: null,
      cashBuffer: 0,
      stockBuffer: {},
      inputBuffer: {},
      outputContainerQueue: {},
      cyclesDone: 0
    };
    if (!opts.emptyInputs) {
      seedStarterInputs(bldg, spec.inputItems || {}, 2);
    }
    state.buildings[k] = bldg;
    return { ok: true, building: bldg, spec: spec, cost: cost };
  }

  function convertStructureToFacility(state, cid, sx, sz, structureId, wx, wy, wz, options) {
    ensureDiplomacyState(state);
    var opts = options || {};
    var comp = state.companies && state.companies[cid];
    if (!comp) return { ok: false, reason: 'no_company' };
    var dim = global.LHStructureProduction ? global.LHStructureProduction.normalizeDimension(opts.dimension || 'minecraft:overworld') : 'minecraft:overworld';
    var k = sectorKey(sx, sz, dim);
    var cl = state.claims[k];
    if (!cl || cl.owner !== cid) return { ok: false, reason: 'not_your_sector', key: k };
    if (state.buildings[k]) return { ok: false, reason: 'already_built', existing: state.buildings[k] };

    var discovered = state.sectorStructures[k] || [];
    var chosenSid = structureId ? String(structureId) : (discovered.length ? discovered[0] : '');
    if (!chosenSid) return { ok: false, reason: 'no_structure_in_sector' };
    if (!opts.skipDiscoveryCheck && discovered.indexOf(chosenSid) === -1) {
      return { ok: false, reason: 'structure_not_in_sector', structureId: chosenSid };
    }
    var sSpec = (state.structureCatalog && state.structureCatalog[chosenSid]) ||
      (global.LHStructureProduction ? global.LHStructureProduction.resolveStructureSpec(state.structureCatalog, chosenSid, opts.availableItemIds || null, dim) : null);
    if (!sSpec) return { ok: false, reason: 'unknown_structure' };

    var baseSpec = BUILDING_CATALOG.structure_facility;
    var tMods = getCompanyTraitModifiers(comp);
    var cost = Math.max(50, Math.round(Number(sSpec.cost || baseSpec.cost || 360) * tMods.buildCostMult * tMods.structureCostMult));
    if (comp.cash < cost) return { ok: false, reason: 'no_cash', cost: cost, cash: comp.cash };
    comp.cash -= cost;

    var env = getCompanyEnvType(comp);
    var resolvedY = (dim !== 'minecraft:overworld')
      ? Math.round(Number(wy || 70))
      : (env === 'normal' ? Math.max(63, Math.round(Number(wy || 70))) : preferredBuildingY(env, wy));

    var reqInputs = sSpec.inputItems || baseSpec.inputItems || { 'minecraft:coal': 1 };
    var bldg = {
      id: 'b' + (state.nextBuildingSeq++),
      type: 'structure_facility',
      category: 'structure',
      envType: env,
      dimension: sSpec.dimension || dim,
      owner: cid,
      sx: sx,
      sz: sz,
      key: k,
      x: Math.round(Number(wx || sx * SECTOR_SIZE)),
      y: resolvedY,
      z: Math.round(Number(wz || sz * SECTOR_SIZE)),
      halfSpan: 2,
      maxBlocks: 16,
      intactBlocks: 16,
      integrityPct: 100,
      operational: true,
      pausedReason: null,
      preserveWorldStructure: true,
      structureId: sSpec.structureId,
      structureName: sSpec.displayName,
      structureCategory: sSpec.category,
      structureCategoryLabel: sSpec.categoryLabel,
      structureIcon: sSpec.icon,
      structureRarity: sSpec.rarity || 'common',
      structureRarityName: sSpec.rarityName || 'Обычная',
      structureRarityColor: sSpec.rarityColor || '§f',
      structureRarityRank: sSpec.rarityRank || 1,
      rarity: sSpec.rarity || 'common',
      rarityName: sSpec.rarityName || 'Обычная',
      rarityColor: sSpec.rarityColor || '§f',
      rarityRank: sSpec.rarityRank || 1,
      structureDimensionName: sSpec.dimensionName || 'Верхний мир',
      productItem: sSpec.itemId,
      bonusProduct: sSpec.bonusItem,
      baseIncome: sSpec.baseIncome,
      baseQty: sSpec.baseQty,
      upkeepCost: sSpec.upkeepCost || baseSpec.upkeepCost || 16,
      inputItems: reqInputs,
      level: 1,
      branch1: null,
      locked1: null,
      branch2: null,
      locked2: null,
      cashBuffer: 0,
      stockBuffer: {},
      inputBuffer: {},
      outputContainerQueue: {},
      cyclesDone: 0
    };
    if (!opts.emptyInputs) {
      seedStarterInputs(bldg, reqInputs, 2);
    }
    state.buildings[k] = bldg;
    return { ok: true, building: bldg, spec: baseSpec, structureSpec: sSpec, cost: cost };
  }

  function damageBuildingIntegrity(state, sx, sz, blockDelta, isCoreBroken, dimension) {
    ensureDiplomacyState(state);
    var b = getSectorBuilding(state, sx, sz, dimension);
    if (!b) return { ok: false, reason: 'no_building' };
    var maxB = Math.max(1, Number(b.maxBlocks || 20));
    var cur = typeof b.intactBlocks === 'number' ? b.intactBlocks : maxB;
    var delta = Math.max(1, Math.round(Number(blockDelta || 1)));
    cur = Math.max(0, cur - delta);
    if (isCoreBroken) cur = 0;
    b.intactBlocks = cur;
    b.integrityPct = Math.round((cur / maxB) * 100);
    b.operational = b.integrityPct >= 35 && !isCoreBroken;
    var destroyed = b.integrityPct <= 0 || !!isCoreBroken;
    if (destroyed) {
      delete state.buildings[sectorKey(sx, sz, dimension)];
    }
    return {
      ok: true,
      buildingId: b.id,
      type: b.type,
      owner: b.owner,
      intactBlocks: cur,
      integrityPct: b.integrityPct,
      operational: b.operational,
      destroyed: destroyed
    };
  }

  function repairBuildingIntegrity(state, cid, sx, sz, dimension) {
    ensureDiplomacyState(state);
    var comp = state.companies && state.companies[cid];
    var b = getSectorBuilding(state, sx, sz, dimension);
    if (!comp || !b || b.owner !== cid) return { ok: false, reason: 'not_found' };
    var maxB = Math.max(1, Number(b.maxBlocks || 20));
    var cur = typeof b.intactBlocks === 'number' ? b.intactBlocks : maxB;
    if (cur >= maxB && b.operational !== false) return { ok: false, reason: 'already_intact' };
    var missing = Math.max(1, maxB - cur);
    var cost = missing * 12;
    if (comp.cash < cost) return { ok: false, reason: 'no_cash', cost: cost, cash: comp.cash };
    comp.cash -= cost;
    b.intactBlocks = maxB;
    b.integrityPct = 100;
    b.operational = true;
    return { ok: true, cost: cost, integrityPct: 100, building: b };
  }

  function upgradeCompanyBuilding(state, cid, sx, sz, choiceId, dimension) {
    ensureDiplomacyState(state);
    var comp = state.companies && state.companies[cid];
    var b = getSectorBuilding(state, sx, sz, dimension);
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

  function getPowerPlantAdjacencyMultiplier(state, ownerCid, sx, sz, dimension) {
    ensureDiplomacyState(state);
    if (!ownerCid) return 1.0;
    var dim = global.LHStructureProduction ? global.LHStructureProduction.normalizeDimension(dimension) : 'minecraft:overworld';
    var bestBonus = 0;
    var dirs = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
    for (var i = 0; i < dirs.length; i++) {
      var nb = getSectorBuilding(state, sx + dirs[i][0], sz + dirs[i][1], dim);
      if (!nb || nb.owner !== ownerCid || nb.type !== 'power_plant' || nb.operational === false) continue;
      var lvl = Number(nb.level || 1);
      var bonus = lvl >= 3 ? 0.50 : (lvl === 2 ? 0.35 : 0.20);
      if (bonus > bestBonus) bestBonus = bonus;
    }
    var comp = state.companies && state.companies[ownerCid];
    if (bestBonus > 0 && comp) {
      var tMods = getCompanyTraitModifiers(comp);
      bestBonus += tMods.extraAdjacencyPct;
    }
    return 1.0 + bestBonus;
  }

  function isCompanySubsidized(state, cid, sx, sz) {
    if (!state || !state.subsidy) return false;
    if (state.subsidy.companyId && state.subsidy.companyId === cid) return true;
    if (typeof state.subsidy.sx === 'number' && typeof state.subsidy.sz === 'number' &&
        state.subsidy.sx === sx && state.subsidy.sz === sz) return true;
    return false;
  }

  function getBuildingYieldProfile(b, adjMultOrOpts, compOrNull) {
    var spec = BUILDING_CATALOG[b.type];
    if (!spec) return { income: 0, items: {}, adjacencyMult: 1.0, subsidyMult: 1.0, inputBoostMult: 1.0, comebackMult: 1.0 };
    var adjMult = (typeof adjMultOrOpts === 'number') ? Math.max(1.0, adjMultOrOpts) : 1.0;
    var subsidyMult = (adjMultOrOpts && typeof adjMultOrOpts === 'object' && adjMultOrOpts.subsidyMult) ? Number(adjMultOrOpts.subsidyMult) : 1.0;
    var inputBoostMult = (adjMultOrOpts && typeof adjMultOrOpts === 'object' && adjMultOrOpts.inputBoostMult) ? Number(adjMultOrOpts.inputBoostMult) : 1.0;
    var comebackMult = (adjMultOrOpts && typeof adjMultOrOpts === 'object' && adjMultOrOpts.comebackMult) ? Number(adjMultOrOpts.comebackMult) : 1.0;
    if (adjMultOrOpts && typeof adjMultOrOpts === 'object' && adjMultOrOpts.adjMult) adjMult = Math.max(1.0, Number(adjMultOrOpts.adjMult));
    var tMods = compOrNull ? getCompanyTraitModifiers(compOrNull) : getCompanyTraitModifiers(null);

    var incMult = adjMult * subsidyMult * inputBoostMult * comebackMult * tMods.incomeMult;
    var yMult = adjMult * subsidyMult * inputBoostMult * comebackMult * tMods.yieldMult * (b.type === 'structure_facility' ? tMods.structureYieldMult : 1.0);
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

    var baseInc = (b.type === 'structure_facility' && b.baseIncome) ? Number(b.baseIncome) : Number(spec.baseIncome || 40);
    var baseProd = (b.type === 'structure_facility' && b.productItem)
      ? String(b.productItem)
      : (b.customProduct ? String(b.customProduct) : String(spec.baseProduct));
    var baseQ = (b.type === 'structure_facility' && b.baseQty) ? Number(b.baseQty) : Number(spec.baseQty || 2);

    var income = Math.round(baseInc * incMult);
    items[baseProd] = Math.max(1, Math.round(baseQ * yMult));
    if (f1 && f1.bonusProduct) {
      items[f1.bonusProduct] = (items[f1.bonusProduct] || 0) + Math.max(1, Math.round((f1.bonusQty || 1) * (f2 ? f2.yieldMult : 1.0) * adjMult * subsidyMult * inputBoostMult * comebackMult));
    } else if (b.type === 'structure_facility' && f1 && b.bonusProduct) {
      items[b.bonusProduct] = (items[b.bonusProduct] || 0) + Math.max(1, Math.round(2 * (f2 ? f2.yieldMult : 1.0) * adjMult * subsidyMult * inputBoostMult * comebackMult));
    }
    return {
      income: income,
      items: items,
      adjacencyMult: adjMult,
      subsidyMult: subsidyMult,
      inputBoostMult: inputBoostMult,
      comebackMult: comebackMult
    };
  }

  function getPatrolProfile(b) {
    if (!b || b.type !== 'patrol_post' || b.operational === false) return null;
    var spec = BUILDING_CATALOG.patrol_post;
    if (!spec) return null;
    var radius = Number(spec.baseRadius || 256);
    var markIntruders = false;
    var penaltyMult = 1.0;
    var spawnGuards = false;
    var guardCount = 0;
    var guardMob = 'minecraft:pillager';

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
    if (f1) {
      if (f1.patrolRadius) radius = Math.max(radius, Number(f1.patrolRadius));
      if (f1.markIntruders) markIntruders = true;
      if (f1.penaltyMult) penaltyMult = Math.max(penaltyMult, Number(f1.penaltyMult));
    }
    if (f2 || Number(b.level || 1) >= 3) {
      spawnGuards = true;
      guardCount = (f2 && f2.guardCount) ? Number(f2.guardCount) : 2;
      guardMob = (f2 && f2.guardMob) ? String(f2.guardMob) : 'minecraft:pillager';
      if (f2 && f2.patrolRadius) radius = Math.max(radius, Number(f2.patrolRadius));
    }
    return {
      buildingId: b.id,
      owner: b.owner,
      sx: b.sx,
      sz: b.sz,
      dimension: b.dimension || 'minecraft:overworld',
      x: Number(b.x || b.sx * SECTOR_SIZE),
      y: Number(b.y || 64),
      z: Number(b.z || b.sz * SECTOR_SIZE),
      level: Number(b.level || 1),
      radius: radius,
      markIntruders: markIntruders,
      penaltyMult: penaltyMult,
      spawnGuards: spawnGuards,
      guardCount: guardCount,
      guardMob: guardMob
    };
  }

  function findPatrolPostsCovering(state, ownerCid, wx, wz, dimension) {
    ensureDiplomacyState(state);
    var dim = dimension ? (global.LHStructureProduction ? global.LHStructureProduction.normalizeDimension(dimension) : dimension) : null;
    var out = [];
    var keys = Object.keys(state.buildings || {});
    for (var i = 0; i < keys.length; i++) {
      var b = state.buildings[keys[i]];
      if (!b || b.type !== 'patrol_post' || b.operational === false) continue;
      if (ownerCid && b.owner !== ownerCid) continue;
      if (dim && (b.dimension || 'minecraft:overworld') !== dim) continue;
      var prof = getPatrolProfile(b);
      if (!prof) continue;
      var dx = Number(wx) - prof.x;
      var dz = Number(wz) - prof.z;
      var dist = Math.sqrt(dx * dx + dz * dz);
      if (dist <= prof.radius) {
        prof.distance = Math.round(dist);
        out.push(prof);
      }
    }
    out.sort(function (a, b) {
      if (b.level !== a.level) return b.level - a.level;
      return a.distance - b.distance;
    });
    return out;
  }

  // ---- Shares / Equity & Asset Valuation Helpers ----
  function getOperationalValuationBreakdown(state, cid) {
    var c = state.companies && state.companies[cid];
    if (!c) {
      return {
        cash: 0, inventoryValue: 0, facilitiesValue: 0, productionPotentialValue: 0,
        territoryValue: 0, activityValue: 0, avgHourlyIncome: 0, operationalTotal: 0
      };
    }
    var cash = Math.max(0, Math.round(Number(c.cash || 0)));
    var tMods = getCompanyTraitModifiers(c);
    var invVal = Math.max(0, Math.round(Number(c.physicalStockEstimate || 0)));
    Object.keys(c.stockBuffer || {}).forEach(function (iid) {
      invVal += estimateItemUnitPrice(iid) * Math.max(0, Number(c.stockBuffer[iid] || 0));
    });

    var bldgs = listCompanyBuildings(state, cid);
    var bldgValue = 0;
    var hourlyNet = 0;
    var cyclesPerHour = 20;
    for (var i = 0; i < bldgs.length; i++) {
      var b = bldgs[i];
      var sp = BUILDING_CATALOG[b.type] || {};
      var baseCost = (b.playerValuation && Number(b.playerValuation) > 0)
        ? Number(b.playerValuation)
        : ((b.type === 'structure_facility' && b.rarityRank) ? (360 * (1 + (b.rarityRank - 1) * 0.35)) : Number(sp.cost || 320));
      var upgInvested = (b.playerValuation && Number(b.playerValuation) > 0)
        ? 0
        : ((Number(b.level || 1) >= 2 ? 420 : 0) + (Number(b.level || 1) >= 3 ? 820 : 0));
      bldgValue += Math.round((baseCost + upgInvested) * (Number(b.integrityPct || 100) / 100));
      bldgValue += Math.round(Number(b.cashBuffer || 0));
      Object.keys(b.stockBuffer || {}).forEach(function (iidB) {
        invVal += estimateItemUnitPrice(iidB) * Math.max(0, Number(b.stockBuffer[iidB] || 0));
      });
      Object.keys(b.inputBuffer || {}).forEach(function (iidIn) {
        invVal += estimateItemUnitPrice(iidIn) * Math.max(0, Number(b.inputBuffer[iidIn] || 0));
      });
      if (b.operational !== false) {
        var adjM = getPowerPlantAdjacencyMultiplier(state, cid, b.sx, b.sz, b.dimension || 'minecraft:overworld');
        var subM = isCompanySubsidized(state, cid, b.sx, b.sz) ? 1.35 : 1.0;
        var yp = getBuildingYieldProfile(b, { adjMult: adjM, subsidyMult: subM }, c);
        var itemYieldWorth = 0;
        Object.keys(yp.items || {}).forEach(function (yi) {
          itemYieldWorth += estimateItemUnitPrice(yi) * Number(yp.items[yi] || 0);
        });
        var upkeepC = Number(b.upkeepCost || sp.upkeepCost || 14) + Math.max(0, Number(b.level || 1) - 1) * Number(sp.upgradeUpkeepPerLevel || 15);
        hourlyNet += Math.max(0, (yp.income + itemYieldWorth - upkeepC) * cyclesPerHour);
      }
    }
    var productionPotentialValue = Math.round(hourlyNet * 1.6);

    var territoryValue = 0;
    var claimKeys = Object.keys(state.claims || {});
    for (var k = 0; k < claimKeys.length; k++) {
      var cl = state.claims[claimKeys[k]];
      if (!cl || cl.owner !== cid) continue;
      var dimB = cl.dimension === 'minecraft:the_end' ? 1.50 : (cl.dimension === 'minecraft:the_nether' ? 1.30 : 1.0);
      territoryValue += Math.round((300 + Math.max(0, Number(cl.strength || 1) - 1) * 140) * dimB);
    }

    var avgHourlyIncome = Math.round(hourlyNet);
    if (Array.isArray(c.incomeHistory) && c.incomeHistory.length > 0) {
      var sumH = 0;
      for (var h = 0; h < c.incomeHistory.length; h++) sumH += Number(c.incomeHistory[h] || 0);
      avgHourlyIncome = Math.round((sumH / c.incomeHistory.length) * cyclesPerHour);
    }

    var s = c.stats || {};
    var activityValue = Math.round(
      Number(s.deliveries || 0) * 45 +
      Number(s.tradeVolume || 0) * 0.5 +
      Number(s.contractsDone || 0) * 200 +
      Number(s.routesDone || 0) * 250
    );

    var rawTotal = cash + invVal + bldgValue + productionPotentialValue + territoryValue + Math.max(0, Math.round(avgHourlyIncome * 0.5)) + activityValue;
    var operationalTotal = Math.max(0, Math.round(rawTotal * tMods.valuationMult));
    return {
      cash: cash,
      inventoryValue: Math.round(invVal),
      facilitiesValue: Math.round(bldgValue),
      productionPotentialValue: productionPotentialValue,
      territoryValue: territoryValue,
      activityValue: activityValue,
      avgHourlyIncome: avgHourlyIncome,
      operationalTotal: operationalTotal
    };
  }

  function getSharePrice(state, targetCid) {
    ensureDiplomacyState(state);
    var br = getOperationalValuationBreakdown(state, targetCid);
    return Math.max(5, Math.round(br.operationalTotal / 100));
  }

  function getExternalSharesOwnedPct(state, targetCid) {
    var tgt = state.companies && state.companies[targetCid];
    if (!tgt) return 0;
    ensureCompanyFinancialFields(tgt, targetCid);
    var ext = 0;
    Object.keys(tgt.shareHoldings || {}).forEach(function (holderCid) {
      if (holderCid !== targetCid) ext += Math.max(0, Number(tgt.shareHoldings[holderCid] || 0));
    });
    return ext;
  }

  function getCompanyPortfolioDetails(state, ownerCid) {
    ensureDiplomacyState(state);
    var holdings = [];
    var externalEquityValue = 0;
    var selfEquityValue = 0;
    var cids = Object.keys(state.companies || {});
    for (var i = 0; i < cids.length; i++) {
      var tCid = cids[i];
      var tc = state.companies[tCid];
      if (!tc) continue;
      ensureCompanyFinancialFields(tc, tCid);
      var cnt = Math.max(0, Number(tc.shareHoldings[ownerCid] || 0));
      if (cnt <= 0) continue;
      var sp = getSharePrice(state, tCid);
      var val = cnt * sp;
      if (tCid === ownerCid) {
        selfEquityValue += val;
      } else {
        externalEquityValue += val;
        holdings.push({ targetCid: tCid, targetName: tc.name, shares: cnt, sharePrice: sp, value: val });
      }
    }
    return {
      holdings: holdings,
      externalEquityValue: Math.round(externalEquityValue),
      selfEquityValue: Math.round(selfEquityValue),
      totalEquityBookValue: Math.round(externalEquityValue)
    };
  }

  function buyCompanyShares(state, buyerCid, targetCid, count) {
    ensureDiplomacyState(state);
    var buyer = state.companies && state.companies[buyerCid];
    var target = state.companies && state.companies[targetCid];
    if (!buyer || !target || buyerCid === targetCid) return { ok: false, reason: 'bad_company' };
    if (target.isPirate) return { ok: false, reason: 'pirate_no_equity' };
    ensureCompanyFinancialFields(target, targetCid);
    var qty = Math.max(1, Math.min(50, Math.round(Number(count || 10))));
    var issuerOwned = Math.max(0, Number(target.shareHoldings[targetCid] || 0));
    var currentExt = getExternalSharesOwnedPct(state, targetCid);
    var maxExt = target.isBot ? 90 : MAX_PLAYER_EXTERNAL_SHARES;
    if (currentExt + qty > maxExt) {
      return { ok: false, reason: 'equity_cap_reached', maxExternal: maxExt, currentExternal: currentExt };
    }
    if (issuerOwned < qty) return { ok: false, reason: 'no_shares_available', available: issuerOwned };
    var unitPrice = getSharePrice(state, targetCid);
    var cost = unitPrice * qty;
    if (buyer.cash < cost) return { ok: false, reason: 'no_cash', cost: cost, cash: buyer.cash };
    buyer.cash -= cost;
    target.cash += Math.round(cost * 0.85);
    target.shareHoldings[targetCid] = issuerOwned - qty;
    target.shareHoldings[buyerCid] = Number(target.shareHoldings[buyerCid] || 0) + qty;
    adjustRelation(state, buyerCid, targetCid, 4, 'Покупка ' + qty + '% акций компании');
    return { ok: true, targetCid: targetCid, sharesBought: qty, unitPrice: unitPrice, cost: cost, buyerOwnedPct: target.shareHoldings[buyerCid] };
  }

  function sellCompanyShares(state, sellerCid, targetCid, count) {
    ensureDiplomacyState(state);
    var seller = state.companies && state.companies[sellerCid];
    var target = state.companies && state.companies[targetCid];
    if (!seller || !target || sellerCid === targetCid) return { ok: false, reason: 'bad_company' };
    ensureCompanyFinancialFields(target, targetCid);
    var held = Math.max(0, Number(target.shareHoldings[sellerCid] || 0));
    var qty = Math.max(1, Math.min(held, Math.round(Number(count || held))));
    if (held <= 0 || qty <= 0) return { ok: false, reason: 'no_shares_held' };
    var unitPrice = getSharePrice(state, targetCid);
    var proceeds = Math.max(5, Math.round(unitPrice * qty * 0.95));
    target.shareHoldings[sellerCid] = held - qty;
    target.shareHoldings[targetCid] = Number(target.shareHoldings[targetCid] || 0) + qty;
    seller.cash += proceeds;
    return { ok: true, targetCid: targetCid, sharesSold: qty, unitPrice: unitPrice, proceeds: proceeds };
  }

  // ---- Comeback Mechanics & Dynamic Underdog Subsidies ----
  function getComebackStatus(state, cid) {
    ensureDiplomacyState(state);
    var comp = state.companies && state.companies[cid];
    if (!comp || comp.isPirate) return { active: false, tier: 0, taxDiscount: 0, yieldMult: 1.0, incomeMult: 1.0, claimDiscount: 0, loanRateMult: 1.0, hqAuctionImmune: false };
    var myOp = getOperationalValuationBreakdown(state, cid).operationalTotal + getCompanyPortfolioDetails(state, cid).externalEquityValue;
    var leaderVal = 0;
    var cids = Object.keys(state.companies || {});
    var nonPirateCount = 0;
    for (var i = 0; i < cids.length; i++) {
      var oc = state.companies[cids[i]];
      if (!oc || oc.isPirate || cids[i] === cid) continue;
      nonPirateCount++;
      var ov = getOperationalValuationBreakdown(state, cids[i]).operationalTotal + getCompanyPortfolioDetails(state, cids[i]).externalEquityValue;
      if (ov > leaderVal) leaderVal = ov;
    }
    if (nonPirateCount === 0 || leaderVal < 2200) {
      return { active: false, tier: 0, ratio: 1.0, taxDiscount: 0, yieldMult: 1.0, incomeMult: 1.0, claimDiscount: 0, loanRateMult: 1.0, hqAuctionImmune: !comp.isBot };
    }
    var ratio = myOp / Math.max(1, leaderVal);
    var claimsCnt = countClaims(state, cid);
    var distressed = (comp.forcedAuctionCount || 0) > 0 || (comp.unpaidUpkeep || 0) >= 120 || claimsCnt <= 1;
    var tier = 0;
    if (ratio <= 0.20 || (ratio <= 0.35 && distressed)) tier = 3;
    else if (ratio <= 0.35) tier = 2;
    else if (ratio <= 0.50 && !comp.isBot) tier = 1;

    if (tier <= 0) {
      return { active: false, tier: 0, ratio: Math.round(ratio * 100) / 100, taxDiscount: 0, yieldMult: 1.0, incomeMult: 1.0, claimDiscount: 0, loanRateMult: 1.0, hqAuctionImmune: !comp.isBot };
    }
    var taxDisc = tier === 3 ? 0.75 : (tier === 2 ? 0.55 : 0.35);
    var yMult = tier === 3 ? 1.55 : (tier === 2 ? 1.35 : 1.20);
    var iMult = tier === 3 ? 1.55 : (tier === 2 ? 1.35 : 1.20);
    var cDisc = tier === 3 ? 0.50 : (tier === 2 ? 0.35 : 0.20);
    return {
      active: true,
      tier: tier,
      ratio: Math.round(ratio * 100) / 100,
      leaderVal: leaderVal,
      myVal: myOp,
      taxDiscount: taxDisc,
      yieldMult: yMult,
      incomeMult: iMult,
      claimDiscount: cDisc,
      loanRateMult: 0.50,
      hqAuctionImmune: true
    };
  }

  function activateComebackBailout(state, cid, nowTick) {
    ensureDiplomacyState(state);
    var comp = state.companies && state.companies[cid];
    if (!comp || comp.isBot) return { ok: false, reason: 'not_eligible' };
    var cb = getComebackStatus(state, cid);
    if (!cb.active) return { ok: false, reason: 'not_lagging', ratio: cb.ratio };
    var tick = Math.round(Number(nowTick || 0));
    var cooldown = 6000;
    if (comp.lastComebackBailoutTick && tick - comp.lastComebackBailoutTick < cooldown) {
      return { ok: false, reason: 'cooldown', waitTicks: cooldown - (tick - comp.lastComebackBailoutTick) };
    }
    var grant = cb.tier >= 3 ? 600 : (cb.tier === 2 ? 420 : 280);
    var coalGrant = cb.tier >= 2 ? 16 : 10;
    comp.cash += grant;
    if (!comp.stockBuffer) comp.stockBuffer = {};
    comp.stockBuffer['minecraft:coal'] = Number(comp.stockBuffer['minecraft:coal'] || 0) + coalGrant;
    var forgiven = Math.round(Number(comp.unpaidUpkeep || 0) * 0.60);
    comp.unpaidUpkeep = Math.max(0, Number(comp.unpaidUpkeep || 0) - forgiven);
    comp.lastComebackBailoutTick = tick;
    return { ok: true, tier: cb.tier, grantCash: grant, grantCoal: coalGrant, debtForgiven: forgiven };
  }

  function selectDynamicSubsidyTarget(state) {
    ensureDiplomacyState(state);
    var candidates = [];
    Object.keys(state.companies || {}).forEach(function (cid) {
      var c = state.companies[cid];
      if (!c || c.isBot || c.isPirate) return;
      var val = getOperationalValuationBreakdown(state, cid).operationalTotal + getCompanyPortfolioDetails(state, cid).externalEquityValue;
      candidates.push({ cid: cid, comp: c, val: val });
    });
    if (!candidates.length) return null;
    candidates.sort(function (a, b) { return a.val - b.val; });
    var lowest = candidates[0];
    var cb = getComebackStatus(state, lowest.cid);
    if (!cb.active && candidates.length < 2) return null;
    var bldgs = listCompanyBuildings(state, lowest.cid);
    var sx = bldgs.length ? bldgs[0].sx : lowest.comp.hqSx;
    var sz = bldgs.length ? bldgs[0].sz : lowest.comp.hqSz;
    var item = bldgs.length && BUILDING_CATALOG[bldgs[0].type] ? BUILDING_CATALOG[bldgs[0].type].baseProduct : 'minecraft:iron_ingot';
    state.subsidy = {
      companyId: lowest.cid,
      item: item,
      sx: sx,
      sz: sz,
      reason: 'comeback_underdog',
      tier: cb.tier || 1
    };
    return state.subsidy;
  }

  function getMonopolyMetrics(state) {
    ensureDiplomacyState(state);
    var claimKeys = Object.keys(state.claims || {});
    var totalClaims = Math.max(1, claimKeys.length);
    var byCid = {};
    for (var i = 0; i < claimKeys.length; i++) {
      var cl = state.claims[claimKeys[i]];
      if (cl && cl.owner) byCid[cl.owner] = (byCid[cl.owner] || 0) + 1;
    }
    var valsByCid = {};
    var totalMarketVal = 0;
    var cids = Object.keys(state.companies || {});
    for (var vi = 0; vi < cids.length; vi++) {
      var vc = state.companies[cids[vi]];
      if (!vc || vc.isPirate) continue;
      var v = getOperationalValuationBreakdown(state, vc.id).operationalTotal + getCompanyPortfolioDetails(state, vc.id).externalEquityValue;
      valsByCid[vc.id] = v;
      totalMarketVal += v;
    }
    totalMarketVal = Math.max(1, totalMarketVal);

    var list = [];
    for (var j = 0; j < cids.length; j++) {
      var c = state.companies[cids[j]];
      if (!c || c.isPirate) continue;
      var claims = byCid[c.id] || 0;
      var share = claims / totalClaims;
      var assetVal = valsByCid[c.id] || 0;
      var assetShare = assetVal / totalMarketVal;
      var tMods = getCompanyTraitModifiers(c);
      var raidScore = Number((c.stats && c.stats.raidsLaunched) || 0) * 12 + Number((c.stats && c.stats.hostileCaptures) || 0) * 15;
      var aggr = Math.min(100, tMods.aggressionWeight + raidScore + (claims > 8 ? Math.round((share - 0.15) * 80) : 0));
      var threat = Math.round(Math.max(share, assetShare) * 100 + aggr * 0.5);
      var isMonop = (claims >= 5 && share >= 0.22) || (assetShare >= 0.34 && assetVal >= 3500) || (claims >= 4 && aggr >= 35);
      var taxRate = 0;
      if (share > 0.35 || assetShare > 0.45) taxRate = 0.45;
      else if ((claims >= 5 && share > 0.22) || (assetShare > 0.32 && assetVal >= 3500)) taxRate = 0.25;
      list.push({
        cid: c.id,
        name: c.name,
        isBot: !!c.isBot,
        claims: claims,
        territoryShare: Math.round(share * 1000) / 1000,
        assetShare: Math.round(assetShare * 1000) / 1000,
        assetValuationWithEquity: assetVal,
        aggressionScore: Math.max(0, aggr),
        monopolyThreat: Math.max(0, threat),
        isMonopolyTarget: isMonop,
        antiMonopolyTaxRate: taxRate
      });
    }
    list.sort(function (a, b) { return b.monopolyThreat - a.monopolyThreat; });
    return list;
  }

  function joinAntiMonopolyCoalition(state, cid, targetCid) {
    ensureDiplomacyState(state);
    var c = state.companies && state.companies[cid];
    var tgt = state.companies && state.companies[targetCid];
    if (!c || !tgt || cid === targetCid) return { ok: false, reason: 'bad_company' };
    if (!state.coalitions[targetCid]) state.coalitions[targetCid] = { targetCid: targetCid, members: [], formedAt: state.botCycle || 0 };
    var co = state.coalitions[targetCid];
    if (co.members.indexOf(cid) === -1) co.members.push(cid);
    adjustRelation(state, cid, targetCid, -15, 'Вступление в антимонопольную коалицию против ' + tgt.name);
    for (var i = 0; i < co.members.length; i++) {
      if (co.members[i] !== cid) {
        adjustRelation(state, cid, co.members[i], 10, 'Союзник по антимонопольному пакту');
      }
    }
    return { ok: true, coalition: co, membersCount: co.members.length };
  }

  function leaveAntiMonopolyCoalition(state, cid, targetCid) {
    ensureDiplomacyState(state);
    if (!targetCid) {
      Object.keys(state.coalitions || {}).forEach(function (tk) {
        var co = state.coalitions[tk];
        if (co && Array.isArray(co.members)) {
          co.members = co.members.filter(function (m) { return m !== cid; });
        }
      });
      return { ok: true };
    }
    var co2 = state.coalitions[targetCid];
    if (!co2) return { ok: false, reason: 'not_found' };
    co2.members = (co2.members || []).filter(function (m) { return m !== cid; });
    return { ok: true };
  }

  function getCoalitionModifiers(state, attackerCid, targetCid) {
    ensureDiplomacyState(state);
    var co = state.coalitions && state.coalitions[targetCid];
    var inCoalition = !!(co && co.members && co.members.indexOf(attackerCid) !== -1);
    var revCo = state.coalitions && state.coalitions[attackerCid];
    var targetInRev = !!(revCo && revCo.members && revCo.members.indexOf(targetCid) !== -1);
    return {
      isCoalitionAttack: inCoalition,
      captureCostMult: inCoalition ? 0.70 : 1.0,
      raidPowerBonus: inCoalition ? 1 : 0,
      bountyReward: inCoalition ? 100 : 0,
      captureBounty: inCoalition ? 100 : 0,
      defenderStrengthBonus: targetInRev ? 1 : 0,
      defenseBonus: targetInRev ? 1 : 0
    };
  }

  // ---- Progressive Taxes, Upkeep, Central Bank, Loans & Tax Evasion ----
  function computeProgressiveTaxForIncome(incomeAmount) {
    var inc = Math.max(0, Math.round(Number(incomeAmount || 0)));
    if (inc <= 0) return { tax: 0, effectiveRate: 0, topRate: 0.05, bracketLabel: PROGRESSIVE_TAX_BRACKETS[0].label };
    var prevCap = 0;
    var tax = 0;
    var topBracket = PROGRESSIVE_TAX_BRACKETS[0];
    for (var i = 0; i < PROGRESSIVE_TAX_BRACKETS.length; i++) {
      var br = PROGRESSIVE_TAX_BRACKETS[i];
      if (inc > prevCap) {
        var slice = Math.min(inc, br.upTo) - prevCap;
        tax += slice * br.rate;
        topBracket = br;
      }
      prevCap = br.upTo;
      if (inc <= br.upTo) break;
    }
    var rounded = Math.round(tax);
    return {
      tax: rounded,
      effectiveRate: Math.round((rounded / inc) * 1000) / 1000,
      topRate: topBracket.rate,
      bracketLabel: topBracket.label
    };
  }

  function computeCompanyExpenses(state, cid) {
    ensureDiplomacyState(state);
    var comp = state.companies && state.companies[cid];
    if (!comp) {
      return {
        facilityUpkeep: 0, upgradeUpkeep: 0, landTax: 0, securityUpkeep: 0,
        progressiveTax: 0, progressiveTaxRate: 0.05, progressiveBracketLabel: '5%',
        antiMonopolyTax: 0, auditPenaltyTax: 0, evasionDiscount: 0, comebackDiscount: 0, total: 0
      };
    }
    var tMods = getCompanyTraitModifiers(comp);
    var bldgs = listCompanyBuildings(state, cid);
    var facilityUpkeep = 0;
    var upgradeUpkeep = 0;
    var securityUpkeep = 0;
    for (var i = 0; i < bldgs.length; i++) {
      var b = bldgs[i];
      var sp = BUILDING_CATALOG[b.type] || {};
      var baseUp = Number(b.upkeepCost || sp.upkeepCost || 12);
      facilityUpkeep += Math.round(baseUp * tMods.upkeepMult);
      var extraLvls = Math.max(0, Number(b.level || 1) - 1);
      upgradeUpkeep += Math.round(extraLvls * Number(sp.upgradeUpkeepPerLevel || 15) * tMods.upkeepMult);
      if (b.type === 'patrol_post') {
        securityUpkeep += Math.round((Number(sp.securityCost || 16) * Number(b.level || 1)) * tMods.securityUpkeepMult);
      }
    }
    var claims = 0;
    var fortCosts = 0;
    var cKeys = Object.keys(state.claims || {});
    for (var j = 0; j < cKeys.length; j++) {
      var cl = state.claims[cKeys[j]];
      if (cl && cl.owner === cid) {
        claims++;
        var str = Math.max(1, Number(cl.strength || 1));
        if (str > 1) fortCosts += (str - 1) * 10;
      }
    }
    securityUpkeep += Math.round(fortCosts * tMods.securityUpkeepMult);
    var rawLandTax = Math.round(claims * 12 * tMods.landTaxMult);
    var totalAllClaims = Math.max(1, cKeys.length);
    var share = claims / totalAllClaims;

    // Progressive income tax across gross cycle income
    var grossRef = Math.max(0, Number(comp._cycleGrossIncome || 0));
    if (grossRef <= 0 && Array.isArray(comp.incomeHistory) && comp.incomeHistory.length > 0) {
      grossRef = Math.max(0, Number(comp.incomeHistory[comp.incomeHistory.length - 1] || 0));
    }
    var progInfo = computeProgressiveTaxForIncome(grossRef);
    var progressiveTax = progInfo.tax;

    // Anti-monopoly tax considers BOTH territory share AND asset/equity valuation share
    var monoRate = 0;
    if (claims >= 5 && share > 0.22) monoRate = share > 0.35 ? 0.45 : 0.25;
    var port = getCompanyPortfolioDetails(state, cid);
    var myAssetVal = getOperationalValuationBreakdown(state, cid).operationalTotal + port.externalEquityValue;
    var totalAllAssets = 0;
    Object.keys(state.companies || {}).forEach(function (ocid) {
      var oc = state.companies[ocid];
      if (!oc || oc.isPirate) return;
      totalAllAssets += getOperationalValuationBreakdown(state, ocid).operationalTotal + getCompanyPortfolioDetails(state, ocid).externalEquityValue;
    });
    var assetShare = totalAllAssets > 0 ? (myAssetVal / totalAllAssets) : 0;
    if (assetShare > 0.45 && myAssetVal >= 4500) monoRate = Math.max(monoRate, 0.45);
    else if (assetShare > 0.32 && myAssetVal >= 3500) monoRate = Math.max(monoRate, 0.25);

    var antiMonopolyTax = monoRate > 0 ? Math.round((rawLandTax + facilityUpkeep + progressiveTax) * monoRate) : 0;

    var preAdjust = facilityUpkeep + upgradeUpkeep + rawLandTax + securityUpkeep + progressiveTax + antiMonopolyTax;
    var auditPenaltyTax = (comp.taxAuditPenaltyCycles > 0) ? Math.round(preAdjust * Number(comp.taxAuditPenaltyRate || 0.35)) : 0;
    var cb = getComebackStatus(state, cid);
    var comebackDiscount = cb.active ? Math.round(preAdjust * cb.taxDiscount) : 0;
    var evasionDiscount = (comp.taxEvasionDiscount > 0) ? Math.round((preAdjust - comebackDiscount) * Math.min(0.90, Number(comp.taxEvasionDiscount))) : 0;
    var total = Math.max(0, preAdjust + auditPenaltyTax - comebackDiscount - evasionDiscount);

    return {
      facilityUpkeep: facilityUpkeep,
      upgradeUpkeep: upgradeUpkeep,
      landTax: rawLandTax,
      securityUpkeep: securityUpkeep,
      progressiveTax: progressiveTax,
      progressiveTaxRate: progInfo.topRate,
      progressiveBracketLabel: progInfo.bracketLabel,
      antiMonopolyTax: antiMonopolyTax,
      assetShare: Math.round(assetShare * 1000) / 1000,
      auditPenaltyTax: auditPenaltyTax,
      comebackDiscount: comebackDiscount,
      evasionDiscount: evasionDiscount,
      total: total
    };
  }

  function createSectorAuction(state, sellerCid, sx, sz, startPrice, durationTicks, nowTick, opts) {
    ensureDiplomacyState(state);
    var o = opts || {};
    var dim = o.dimension ? (global.LHStructureProduction ? global.LHStructureProduction.normalizeDimension(o.dimension) : o.dimension) : 'minecraft:overworld';
    var k = sectorKey(sx, sz, dim);
    var cl = state.claims[k];
    if (!cl || cl.owner !== sellerCid) return { ok: false, reason: 'not_owned_sector' };
    if (cl.isHq && !state.companies[sellerCid].isBot) return { ok: false, reason: 'hq_protected' };
    for (var i = 0; i < state.auctions.length; i++) {
      var ex = state.auctions[i];
      if (ex && ex.status === 'open' && ex.sx === sx && ex.sz === sz && (ex.dimension || 'minecraft:overworld') === dim) {
        return { ok: false, reason: 'already_on_auction', auction: ex };
      }
    }
    var minPrice = Math.max(80, Math.round(Number(startPrice || (200 * Number(cl.strength || 1)))));
    var dur = Math.max(400, Math.round(Number(durationTicks || 3600)));
    var tick = Math.round(Number(nowTick || 0));
    var auc = {
      id: 'auc_' + (state.nextAuctionSeq++),
      assetType: 'sector',
      sellerCid: sellerCid,
      sx: sx,
      sz: sz,
      dimension: dim,
      buildingKey: k,
      buildingType: 'sector',
      buildingName: 'Сектор (' + sx + ', ' + sz + ')',
      buildingLevel: cl.strength || 1,
      rarityLabel: null,
      startPrice: minPrice,
      currentBid: 0,
      minIncrement: Math.max(20, Math.round(minPrice * 0.10)),
      highestBidderCid: null,
      bidHistory: [],
      createdTick: tick,
      endsAtTick: tick + dur,
      buyoutPrice: o.buyoutPrice ? Math.max(minPrice * 2, Math.round(Number(o.buyoutPrice))) : null,
      isForcedDebtAuction: !!o.isForcedDebtAuction,
      debtReason: o.debtReason || null,
      debtLoanId: o.debtLoanId || null,
      status: 'open'
    };
    state.auctions.push(auc);
    return { ok: true, auction: auc };
  }

  function enforceDebtAuctions(state, cid, debtAmount, reason, nowTick, rngFn) {
    ensureDiplomacyState(state);
    var comp = state.companies && state.companies[cid];
    var debt = Math.max(0, Math.round(Number(debtAmount || 0)));
    if (!comp || debt <= 0) return [];
    var rng = rngFn || Math.random;
    var candidates = [];

    // Gather non-HQ facilities first & non-HQ sectors
    var bldgs = listCompanyBuildings(state, cid);
    for (var i = 0; i < bldgs.length; i++) {
      var b = bldgs[i];
      var bCl = state.claims[sectorKey(b.sx, b.sz, b.dimension)];
      if (bCl && bCl.isHq && !comp.isBot) continue;
      var alreadyAuc = state.auctions.some(function (a) {
        return a && a.status === 'open' && a.sx === b.sx && a.sz === b.sz && (a.dimension || 'minecraft:overworld') === (b.dimension || 'minecraft:overworld');
      });
      if (alreadyAuc) continue;
      var sp = BUILDING_CATALOG[b.type] || {};
      var est = Math.max(150, Math.round((Number(sp.cost || 320) * Number(b.level || 1)) * 0.70));
      candidates.push({ kind: 'building', sx: b.sx, sz: b.sz, dimension: b.dimension || 'minecraft:overworld', startPrice: est });
    }
    Object.keys(state.claims || {}).forEach(function (ck) {
      var cl = state.claims[ck];
      if (!cl || cl.owner !== cid || cl.isHq) return;
      if (getSectorBuilding(state, cl.sx, cl.sz, cl.dimension)) return;
      var alreadyAuc2 = state.auctions.some(function (a) {
        return a && a.status === 'open' && a.sx === cl.sx && a.sz === cl.sz && (a.dimension || 'minecraft:overworld') === (cl.dimension || 'minecraft:overworld');
      });
      if (alreadyAuc2) return;
      var estSec = Math.max(100, Math.round((220 * Number(cl.strength || 1)) * 0.70));
      candidates.push({ kind: 'sector', sx: cl.sx, sz: cl.sz, dimension: cl.dimension || 'minecraft:overworld', startPrice: estSec });
    });

    // Shuffle randomly (Fisher-Yates)
    for (var s = candidates.length - 1; s > 0; s--) {
      var j = Math.floor(rng() * (s + 1));
      var tmp = candidates[s];
      candidates[s] = candidates[j];
      candidates[j] = tmp;
    }

    var created = [];
    var covered = 0;
    for (var c = 0; c < candidates.length && covered < debt; c++) {
      var item = candidates[c];
      var res = item.kind === 'building'
        ? createFacilityAuction(state, cid, item.sx, item.sz, item.startPrice, 2400, nowTick || 0, { dimension: item.dimension, isForcedDebtAuction: true, debtReason: reason || 'tax_debt' })
        : createSectorAuction(state, cid, item.sx, item.sz, item.startPrice, 2400, nowTick || 0, { dimension: item.dimension, isForcedDebtAuction: true, debtReason: reason || 'tax_debt' });
      if (res && res.ok) {
        created.push(res.auction);
        covered += item.startPrice;
      }
    }
    if (created.length > 0) comp.forcedAuctionCount = (comp.forcedAuctionCount || 0) + created.length;
    return created;
  }

  function attemptTaxEvasion(state, cid, method, nowTick, rngFn) {
    ensureDiplomacyState(state);
    var comp = state.companies && state.companies[cid];
    if (!comp) return { ok: false, reason: 'no_company' };
    var exp = computeCompanyExpenses(state, cid);
    var m = String(method || 'bribe').toLowerCase();
    if (m === 'forged_docs') m = 'forge_docs';
    if (m !== 'bribe' && m !== 'forge_docs' && m !== 'offshore' && m !== 'shell_split') {
      return { ok: false, reason: 'bad_method' };
    }
    var bribeCost = m === 'bribe'
      ? Math.max(40, Math.round(exp.total * 0.12))
      : (m === 'offshore' ? Math.max(80, Math.round(exp.total * 0.10)) : (m === 'shell_split' ? 35 : 20));
    if (comp.cash < bribeCost) return { ok: false, reason: 'no_cash', cost: bribeCost, cash: comp.cash };
    comp.cash -= bribeCost;

    var rng = rngFn || Math.random;
    var baseChance = m === 'bribe' ? 0.68 : (m === 'offshore' ? 0.62 : (m === 'shell_split' ? 0.52 : 0.48));
    // Loophole bonus: warehouses & trade exchanges make revenue hiding easier
    var bldgs = listCompanyBuildings(state, cid);
    var hideBonus = 0;
    for (var bi = 0; bi < bldgs.length; bi++) {
      if (bldgs[bi].type === 'trade_exchange' || bldgs[bi].type === 'warehouse') hideBonus += 0.04;
    }
    baseChance += Math.min(0.16, hideBonus);
    if ((comp.taxAuditPenaltyCycles || 0) > 0) baseChance -= 0.12;
    var monoPenalty = exp.antiMonopolyTax > 0 ? 0.12 : 0;
    var chance = Math.max(0.20, Math.min(0.90, baseChance - monoPenalty));

    if (rng() < chance) {
      comp.taxEvasionDiscount = m === 'offshore' ? 0.85 : (m === 'shell_split' ? 0.80 : (m === 'bribe' ? 0.72 : 0.60));
      var debtForgiven = Math.round(Number(comp.unpaidUpkeep || 0) * (m === 'offshore' ? 0.45 : 0.30));
      comp.unpaidUpkeep = Math.max(0, Number(comp.unpaidUpkeep || 0) - debtForgiven);
      return { ok: true, succeeded: true, method: m, cost: bribeCost, discountPct: Math.round(comp.taxEvasionDiscount * 100), debtForgiven: debtForgiven };
    }
    // Audit failure: fine added to debt + extra penalty tax for 3 cycles
    var fine = Math.max(120, Math.round(exp.total * 0.35));
    comp.unpaidUpkeep = Number(comp.unpaidUpkeep || 0) + fine;
    comp.taxAuditPenaltyCycles = 3;
    comp.taxAuditPenaltyRate = 0.35;
    return { ok: true, succeeded: false, method: m, cost: bribeCost, fine: fine, penaltyCycles: 3, penaltyRate: 0.35 };
  }

  // ---- Central Bank, Key Rate & Loans ----
  function updateCentralBankKeyRate(state) {
    ensureDiplomacyState(state);
    var totalCash = 0;
    var cnt = 0;
    Object.keys(state.companies || {}).forEach(function (cid) {
      var c = state.companies[cid];
      if (!c || c.isPirate) return;
      totalCash += Math.max(0, Number(c.cash || 0));
      cnt++;
    });
    var avgCash = cnt > 0 ? totalCash / cnt : 1000;
    // Key rate rises when average liquidity inflates, falls when economy is tight
    var inflation = Math.max(0.5, Math.min(3.0, avgCash / 2000));
    var rawRate = 0.05 + (inflation - 0.5) * 0.06;
    var clamped = Math.max(0.04, Math.min(0.22, Math.round(rawRate * 1000) / 1000));
    state.centralBank.inflationIndex = Math.round(inflation * 100) / 100;
    state.centralBank.keyRate = clamped;
    return state.centralBank;
  }

  function getEffectiveLoanRate(state, cid) {
    ensureDiplomacyState(state);
    var base = Number(state.centralBank.keyRate || 0.08);
    var comp = state.companies && state.companies[cid];
    var cb = getComebackStatus(state, cid);
    var riskSpread = (comp && (comp.unpaidUpkeep || 0) > 100) ? 0.04 : 0.01;
    var rate = (base + riskSpread) * (cb.active ? cb.loanRateMult : 1.0);
    return Math.max(0.02, Math.round(rate * 1000) / 1000);
  }

  function getCompanyActiveDebt(state, cid) {
    ensureDiplomacyState(state);
    var total = 0;
    for (var i = 0; i < state.loans.length; i++) {
      var l = state.loans[i];
      if (l && l.companyId === cid && (l.status === 'active' || l.status === 'defaulted')) {
        total += Math.max(0, Number(l.remainingDebt || 0));
      }
    }
    return Math.round(total);
  }

  function getMaxLoanLimit(state, cid) {
    ensureDiplomacyState(state);
    var val = getOperationalValuationBreakdown(state, cid).operationalTotal + getCompanyPortfolioDetails(state, cid).externalEquityValue;
    var cb = getComebackStatus(state, cid);
    var cap = Math.max(500, Math.round(val * (cb.active ? 0.85 : 0.65)));
    return Math.max(0, cap - getCompanyActiveDebt(state, cid));
  }

  function takeBankLoan(state, cid, amount, termCycles, nowTick) {
    ensureDiplomacyState(state);
    var comp = state.companies && state.companies[cid];
    if (!comp) return { ok: false, reason: 'no_company' };
    var principal = Math.max(100, Math.round(Number(amount || 500)));
    var limit = getMaxLoanLimit(state, cid);
    if (principal > limit) return { ok: false, reason: 'exceeds_credit_limit', limit: limit };
    var terms = Math.max(2, Math.min(12, Math.round(Number(termCycles || 5))));
    var rate = getEffectiveLoanRate(state, cid);
    var totalDue = Math.round(principal * (1 + rate * terms));
    var paymentPerCycle = Math.max(20, Math.ceil(totalDue / terms));
    var loan = {
      id: 'loan_' + (state.nextLoanSeq++),
      companyId: cid,
      principal: principal,
      ratePerCycle: rate,
      termCycles: terms,
      cyclesRemaining: terms,
      totalDue: totalDue,
      remainingDebt: totalDue,
      paymentPerCycle: paymentPerCycle,
      missedPayments: 0,
      createdTick: Math.round(Number(nowTick || 0)),
      status: 'active'
    };
    state.loans.push(loan);
    state.centralBank.totalIssued = (state.centralBank.totalIssued || 0) + principal;
    comp.cash += principal;
    return { ok: true, loan: loan, keyRate: state.centralBank.keyRate, effectiveRate: rate };
  }

  function repayBankLoan(state, cid, loanId, amount) {
    ensureDiplomacyState(state);
    var comp = state.companies && state.companies[cid];
    if (!comp) return { ok: false, reason: 'no_company' };
    var loan = null;
    for (var i = 0; i < state.loans.length; i++) {
      var l = state.loans[i];
      if (l && l.companyId === cid && (!loanId || l.id === loanId) && (l.status === 'active' || l.status === 'defaulted')) {
        loan = l;
        break;
      }
    }
    if (!loan) return { ok: false, reason: 'no_active_loan' };
    var pay = Math.min(comp.cash, loan.remainingDebt, amount ? Math.max(1, Math.round(Number(amount))) : loan.remainingDebt);
    if (pay <= 0) return { ok: false, reason: 'no_cash', remainingDebt: loan.remainingDebt };
    comp.cash -= pay;
    loan.remainingDebt -= pay;
    state.centralBank.totalRepaid = (state.centralBank.totalRepaid || 0) + pay;
    if (loan.remainingDebt <= 0) {
      loan.remainingDebt = 0;
      loan.status = 'repaid';
    }
    return { ok: true, paid: pay, remainingDebt: loan.remainingDebt, status: loan.status };
  }

  function tickBankLoans(state, nowTick, rngFn) {
    ensureDiplomacyState(state);
    updateCentralBankKeyRate(state);
    var events = [];
    for (var i = 0; i < state.loans.length; i++) {
      var l = state.loans[i];
      if (!l || l.status !== 'active') continue;
      var comp = state.companies[l.companyId];
      if (!comp) continue;
      var due = Math.min(l.remainingDebt, l.paymentPerCycle);
      var paid = Math.min(Math.max(0, Number(comp.cash || 0)), due);
      comp.cash = Math.max(0, Number(comp.cash || 0) - paid);
      l.remainingDebt -= paid;
      state.centralBank.totalRepaid = (state.centralBank.totalRepaid || 0) + paid;
      l.cyclesRemaining = Math.max(0, l.cyclesRemaining - 1);

      if (paid < due) {
        l.missedPayments = (l.missedPayments || 0) + 1;
        var penalty = Math.max(25, Math.round((due - paid) * 0.25));
        l.remainingDebt += penalty;
        if (l.missedPayments >= 2 || (l.cyclesRemaining <= 0 && l.remainingDebt > 0)) {
          l.status = 'defaulted';
          state.centralBank.totalDefaulted = (state.centralBank.totalDefaulted || 0) + l.remainingDebt;
          var aucs = enforceDebtAuctions(state, comp.id, l.remainingDebt, 'loan_default', nowTick || 0, rngFn);
          events.push({ type: 'loan_default', loanId: l.id, companyId: comp.id, debt: l.remainingDebt, auctionsCreated: aucs.length });
          continue;
        }
        events.push({ type: 'loan_missed', loanId: l.id, companyId: comp.id, shortfall: due - paid, missedPayments: l.missedPayments });
      } else if (l.remainingDebt <= 0) {
        l.remainingDebt = 0;
        l.status = 'repaid';
        events.push({ type: 'loan_repaid', loanId: l.id, companyId: comp.id });
      }
    }
    return events;
  }

  function tickCompanyUpkeep(state, opts) {
    ensureDiplomacyState(state);
    var o = opts || {};
    var summary = {};
    var cids = Object.keys(state.companies || {});
    for (var i = 0; i < cids.length; i++) {
      var cid = cids[i];
      var comp = state.companies[cid];
      if (!comp || comp.isPirate) continue;
      ensureCompanyFinancialFields(comp, cid);
      var exp = computeCompanyExpenses(state, cid);
      comp.lastExpenses = exp;
      if (comp.taxAuditPenaltyCycles > 0) comp.taxAuditPenaltyCycles -= 1;
      if (comp.taxAuditPenaltyCycles <= 0) comp.taxAuditPenaltyRate = 0;
      comp.taxEvasionDiscount = 0;

      var paid = Math.min(Math.max(0, Number(comp.cash || 0)), exp.total);
      comp.cash = Math.max(0, Number(comp.cash || 0) - paid);
      var shortfall = exp.total - paid;
      var forcedAuctions = [];
      if (shortfall > 0) {
        comp.unpaidUpkeep = Number(comp.unpaidUpkeep || 0) + shortfall;
        comp.taxDefaultCycles = Number(comp.taxDefaultCycles || 0) + 1;
        if (comp.unpaidUpkeep >= 150) {
          var cKeys = Object.keys(state.claims || {});
          for (var k = 0; k < cKeys.length; k++) {
            var cl = state.claims[cKeys[k]];
            if (cl && cl.owner === cid && !cl.isHq && (cl.strength || 1) > 1) {
              cl.strength -= 1;
              break;
            }
          }
        }
        // Trigger forced random auctions of facilities/territories until debt is covered
        if (o.autoAuctionDebt !== false && (comp.unpaidUpkeep >= 100 || comp.taxDefaultCycles >= 1)) {
          forcedAuctions = enforceDebtAuctions(state, cid, comp.unpaidUpkeep, 'tax_debt', o.nowTick || 0, o.rng);
        }
      } else {
        comp.taxDefaultCycles = 0;
        comp.unpaidUpkeep = Math.max(0, Number(comp.unpaidUpkeep || 0) - Math.min(Number(comp.unpaidUpkeep || 0), 50));
      }
      var cycleIncome = Number(comp._cycleGrossIncome || 0);
      var net = cycleIncome - paid;
      comp._cycleGrossIncome = 0;
      if (!Array.isArray(comp.incomeHistory)) comp.incomeHistory = [];
      comp.incomeHistory.push(net);
      if (comp.incomeHistory.length > 24) comp.incomeHistory.shift();

      // Distribute modest equity dividends (25% of positive net profit across external shareholders)
      if (net > 20 && comp.shareHoldings) {
        var divPool = Math.round(net * 0.25);
        Object.keys(comp.shareHoldings).forEach(function (hCid) {
          if (hCid === cid) return;
          var sh = Number(comp.shareHoldings[hCid] || 0);
          if (sh > 0 && state.companies[hCid] && comp.cash >= Math.round(divPool * (sh / 100))) {
            var divPay = Math.round(divPool * (sh / 100));
            comp.cash -= divPay;
            state.companies[hCid].cash += divPay;
          }
        });
      }
      summary[cid] = { expenses: exp, paid: paid, shortfall: shortfall, net: net, forcedAuctions: forcedAuctions };
    }
    return summary;
  }

  function consumeBuildingFuel(state, comp, b, strictFuel) {
    var req = getBuildingFuelRequirements(b);
    var needUnits = Math.max(1, Number(req.fuelUnits || 1));
    if (!b.inputBuffer) b.inputBuffer = {};
    if (!comp.stockBuffer) comp.stockBuffer = {};

    var fuelKeys = Object.keys(FUEL_EQUIVALENTS);
    var totalAvail = 0;
    for (var i = 0; i < fuelKeys.length; i++) {
      var fk = fuelKeys[i];
      var eq = FUEL_EQUIVALENTS[fk];
      totalAvail += Number(b.inputBuffer[fk] || 0) * eq + Number(comp.stockBuffer[fk] || 0) * eq;
    }
    if (totalAvail < needUnits) {
      if (strictFuel !== false) {
        return { ok: false, missingItem: req.preferredItem, needUnits: needUnits, haveUnits: totalAvail };
      }
    }
    var remUnits = needUnits;
    for (var j = 0; j < fuelKeys.length && remUnits > 0; j++) {
      var fk2 = fuelKeys[j];
      var eq2 = FUEL_EQUIVALENTS[fk2];
      var bQty = Math.max(0, Number(b.inputBuffer[fk2] || 0));
      if (bQty > 0) {
        var takeB = Math.min(bQty, Math.ceil(remUnits / eq2));
        b.inputBuffer[fk2] -= takeB;
        if (b.inputBuffer[fk2] <= 0) delete b.inputBuffer[fk2];
        remUnits -= takeB * eq2;
      }
    }
    for (var k = 0; k < fuelKeys.length && remUnits > 0; k++) {
      var fk3 = fuelKeys[k];
      var eq3 = FUEL_EQUIVALENTS[fk3];
      var cQty = Math.max(0, Number(comp.stockBuffer[fk3] || 0));
      if (cQty > 0) {
        var takeC = Math.min(cQty, Math.ceil(remUnits / eq3));
        comp.stockBuffer[fk3] -= takeC;
        if (comp.stockBuffer[fk3] <= 0) delete comp.stockBuffer[fk3];
        remUnits -= takeC * eq3;
      }
    }
    return { ok: true, consumedUnits: needUnits };
  }

  function consumeOptionalInputs(state, comp, b) {
    var opt = getBuildingOptionalInputs(b);
    var optKeys = Object.keys(opt || {});
    if (!optKeys.length) return { boosted: false };
    if (!b.inputBuffer) b.inputBuffer = {};
    if (!comp.stockBuffer) comp.stockBuffer = {};

    for (var i = 0; i < optKeys.length; i++) {
      var iid = optKeys[i];
      var need = Math.max(1, Math.round(Number(opt[iid] || 1)));
      if (Number(b.inputBuffer[iid] || 0) + Number(comp.stockBuffer[iid] || 0) < need) {
        return { boosted: false };
      }
    }
    for (var j = 0; j < optKeys.length; j++) {
      var iid2 = optKeys[j];
      var rem = Math.max(1, Math.round(Number(opt[iid2] || 1)));
      var takeB = Math.min(rem, Number(b.inputBuffer[iid2] || 0));
      if (takeB > 0) { b.inputBuffer[iid2] -= takeB; rem -= takeB; }
      if (rem > 0) {
        var takeC = Math.min(rem, Number(comp.stockBuffer[iid2] || 0));
        if (takeC > 0) { comp.stockBuffer[iid2] -= takeC; rem -= takeC; }
      }
    }
    return { boosted: true, mult: 1.45 };
  }

  function tickCompanyBuildings(state, opts) {
    ensureDiplomacyState(state);
    var o = opts || {};
    var keys = Object.keys(state.buildings);
    var producedCount = 0;
    for (var i = 0; i < keys.length; i++) {
      var b = state.buildings[keys[i]];
      if (!b || !state.companies[b.owner] || b.operational === false) continue;
      var comp = state.companies[b.owner];
      if ((comp.unpaidUpkeep || 0) >= 250 && b.type !== 'power_plant') {
        b.pausedReason = 'unpaid_upkeep';
        continue;
      }
      // Fuel is mandatory; missing optional raw materials only skips the +45% input boost (partial out-of-thin-air output continues)
      var fuelRes = consumeBuildingFuel(state, comp, b, o.strictInputs !== false && o.strictFuel !== false);
      if (!fuelRes.ok) {
        b.pausedReason = 'missing_fuel';
        b.missingItem = fuelRes.missingItem;
        continue;
      }
      var optRes = consumeOptionalInputs(state, comp, b);
      b.pausedReason = null;
      b.missingItem = null;
      b.lastInputBoosted = !!optRes.boosted;
      var dim = b.dimension || 'minecraft:overworld';
      var adjMult = getPowerPlantAdjacencyMultiplier(state, b.owner, b.sx, b.sz, dim);
      var subMult = isCompanySubsidized(state, b.owner, b.sx, b.sz) ? 1.35 : 1.0;
      var cbStat = getComebackStatus(state, b.owner);
      var prof = getBuildingYieldProfile(b, {
        adjMult: adjMult,
        subsidyMult: subMult,
        inputBoostMult: optRes.boosted ? optRes.mult : 1.0,
        comebackMult: cbStat.active ? cbStat.yieldMult : 1.0
      }, comp);
      var capCash = prof.income * 8;
      if ((b.cashBuffer || 0) < capCash) {
        b.cashBuffer = Math.min(capCash, (b.cashBuffer || 0) + prof.income);
      }
      comp._cycleGrossIncome = Number(comp._cycleGrossIncome || 0) + prof.income;
      if (!b.stockBuffer) b.stockBuffer = {};
      if (!b.outputContainerQueue) b.outputContainerQueue = {};
      Object.keys(prof.items).forEach(function (iid) {
        var cur = Number(b.stockBuffer[iid] || 0);
        var capItem = prof.items[iid] * 6;
        if (cur < capItem) {
          var addQ = Math.min(capItem - cur, prof.items[iid]);
          b.stockBuffer[iid] = cur + addQ;
          b.outputContainerQueue[iid] = Number(b.outputContainerQueue[iid] || 0) + addQ;
        }
      });
      b.cyclesDone = (b.cyclesDone || 0) + 1;
      producedCount++;
    }
    if (o.chargeUpkeep) {
      tickCompanyUpkeep(state);
    }
    return producedCount;
  }

  function collectBuildingOutput(state, cid, sx, sz, dimension) {
    ensureDiplomacyState(state);
    var comp = state.companies && state.companies[cid];
    var b = getSectorBuilding(state, sx, sz, dimension);
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
    b.outputContainerQueue = {};
    return { ok: true, cash: cash, items: items };
  }

  function estimateItemUnitPrice(itemId) {
    if (global.LHEconomyEngine && typeof global.LHEconomyEngine.getLiveCachedPrice === 'function') {
      return global.LHEconomyEngine.getLiveCachedPrice(itemId);
    }
    if (global.LHEconomyEngine && typeof global.LHEconomyEngine.inferFallbackBasePrice === 'function') {
      return global.LHEconomyEngine.inferFallbackBasePrice(itemId);
    }
    var s = String(itemId || '').toLowerCase();
    if (s.indexOf('diamond') !== -1 || s.indexOf('nether_star') !== -1 || s.indexOf('ancient_debris') !== -1) return 140;
    if (s.indexOf('emerald') !== -1 || s.indexOf('precision') !== -1 || s.indexOf('oil') !== -1) return 65;
    if (s.indexOf('gold') !== -1 || s.indexOf('brass') !== -1 || s.indexOf('concentrate') !== -1) return 32;
    if (s.indexOf('iron') !== -1 || s.indexOf('redstone') !== -1 || s.indexOf('copper') !== -1) return 14;
    if (s.indexOf('coal') !== -1 || s.indexOf('charcoal') !== -1) return 6;
    return 8;
  }

  function calculateUpkeepAwareContractPrice(state, supplierCid, sx, sz, itemId, qtyPerPeriod, dimension) {
    ensureDiplomacyState(state);
    var q = Math.max(1, Math.round(Number(qtyPerPeriod || 16)));
    var unitMarket = estimateItemUnitPrice(itemId);
    var b = (typeof sx === 'number' && typeof sz === 'number') ? getSectorBuilding(state, sx, sz, dimension) : null;
    var comp = supplierCid ? state.companies[supplierCid] : null;
    var inputCostPerCycle = 0;
    var upkeepShare = 18;
    if (b) {
      var sp = BUILDING_CATALOG[b.type] || {};
      var req = getBuildingRequiredInputs(b);
      Object.keys(req).forEach(function (rk) {
        inputCostPerCycle += estimateItemUnitPrice(rk) * Number(req[rk] || 1);
      });
      upkeepShare = Number(b.upkeepCost || sp.upkeepCost || 16) + Math.max(0, Number(b.level || 1) - 1) * Number(sp.upgradeUpkeepPerLevel || 15) + 12;
    } else if (comp) {
      var exp = computeCompanyExpenses(state, supplierCid);
      var bCount = Math.max(1, listCompanyBuildings(state, supplierCid).length);
      upkeepShare = Math.round(exp.total / bCount);
    }
    var baseGoodsCost = unitMarket * q;
    var upkeepAllowance = Math.round((upkeepShare + inputCostPerCycle) * Math.max(1, q / 8));
    var margin = Math.round((baseGoodsCost + upkeepAllowance) * 0.22);
    var totalPrice = Math.max(25, baseGoodsCost + upkeepAllowance + margin);
    return {
      qty: q,
      baseGoodsCost: baseGoodsCost,
      inputCostPerCycle: inputCostPerCycle,
      upkeepShare: upkeepShare,
      upkeepAllowance: upkeepAllowance,
      margin: margin,
      totalPrice: totalPrice,
      unitPrice: Math.round((totalPrice / q) * 10) / 10,
      recommendedPenalty: Math.max(20, Math.round(totalPrice * 0.45))
    };
  }

  function createSupplyContract(state, initiatorCid, partnerCid, item, qty, price, batches, opts) {
    ensureDiplomacyState(state);
    if (!state.companies[initiatorCid] || !state.companies[partnerCid] || initiatorCid === partnerCid) {
      return { ok: false, reason: 'bad_company' };
    }
    var o = opts || {};
    var q = Math.max(1, Math.round(Number(qty || 16)));
    var pCalc = (!price || o.useUpkeepPricing)
      ? calculateUpkeepAwareContractPrice(state, initiatorCid, o.sx, o.sz, item, q, o.dimension)
      : null;
    var p = Math.max(10, Math.round(Number(price || (pCalc ? pCalc.totalPrice : 100))));
    var b = Math.max(1, Math.min(24, Math.round(Number(batches || 3))));
    var periodTicks = Math.max(600, Math.round(Number(o.periodTicks || 6000)));
    var nowTick = Math.max(0, Math.round(Number(o.nowTick || 0)));
    var penaltyPerMiss = Math.max(0, Math.round(Number(o.penaltyPerMiss !== undefined ? o.penaltyPerMiss : Math.round(p * 0.40))));
    var c = {
      id: 'sc' + (state.nextSupplySeq++),
      supplierCid: initiatorCid,
      buyerCid: partnerCid,
      item: String(item || 'minecraft:iron_ingot'),
      qty: q,
      price: p,
      upkeepIncluded: pCalc ? pCalc.upkeepAllowance : Math.round(p * 0.20),
      remainingBatches: b,
      totalPeriods: b,
      periodsDone: 0,
      periodsMissed: 0,
      periodTicks: periodTicks,
      nextDueTick: o.timed ? (nowTick + periodTicks) : null,
      penaltyPerMiss: penaltyPerMiss,
      timed: !!o.timed,
      autoFromSector: (typeof o.sx === 'number' && typeof o.sz === 'number') ? { sx: o.sx, sz: o.sz, dimension: o.dimension || 'minecraft:overworld' } : null,
      status: 'open'
    };
    state.supplyContracts.push(c);
    return { ok: true, contract: c, pricing: pCalc };
  }

  function createTimedSupplyContract(state, supplierCid, buyerCid, itemId, qtyPerPeriod, totalPeriods, periodTicks, pricePerPeriod, penaltyPerMiss, nowTick, opts) {
    var o = opts || {};
    o.timed = true;
    o.periodTicks = periodTicks || 6000;
    o.penaltyPerMiss = penaltyPerMiss;
    o.nowTick = nowTick || 0;
    return createSupplyContract(state, supplierCid, buyerCid, itemId, qtyPerPeriod, pricePerPeriod, totalPeriods, o);
  }

  function tickSupplyContracts(state, nowTick) {
    ensureDiplomacyState(state);
    var tick = Math.round(Number(nowTick || 0));
    var events = [];
    for (var i = 0; i < state.supplyContracts.length; i++) {
      var c = state.supplyContracts[i];
      if (!c || c.status !== 'open' || !c.timed || c.nextDueTick === null) continue;
      if (tick < c.nextDueTick) continue;
      var sup = state.companies[c.supplierCid];
      var buy = state.companies[c.buyerCid];
      if (!sup || !buy) { c.status = 'cancelled'; continue; }
      // Check if supplier auto-linked facility or stockBuffer has enough items to auto-fulfill
      var delivered = false;
      if (c.autoFromSector) {
        var b = getSectorBuilding(state, c.autoFromSector.sx, c.autoFromSector.sz, c.autoFromSector.dimension);
        if (b && b.owner === c.supplierCid && b.stockBuffer && Number(b.stockBuffer[c.item] || 0) >= c.qty && buy.cash >= c.price) {
          b.stockBuffer[c.item] -= c.qty;
          delivered = true;
        }
      }
      if (!delivered && sup.stockBuffer && Number(sup.stockBuffer[c.item] || 0) >= c.qty && buy.cash >= c.price) {
        sup.stockBuffer[c.item] -= c.qty;
        delivered = true;
      }
      if (delivered) {
        buy.cash -= c.price;
        sup.cash += c.price;
        sup.stats.tradeVolume = (sup.stats.tradeVolume || 0) + c.price;
        buy.stats.tradeVolume = (buy.stats.tradeVolume || 0) + c.price;
        sup.stats.contractsDone = (sup.stats.contractsDone || 0) + 1;
        c.periodsDone = (c.periodsDone || 0) + 1;
        c.remainingBatches -= 1;
        c.nextDueTick = tick + c.periodTicks;
        if (c.remainingBatches <= 0) c.status = 'completed';
        adjustRelation(state, c.supplierCid, c.buyerCid, 6, 'Вовремя выполнен период контракта ' + c.id);
        events.push({ type: 'fulfilled', contractId: c.id, supplierCid: c.supplierCid, buyerCid: c.buyerCid, payout: c.price });
      } else {
        // Missed deadline -> charge неустойка (penaltyPerMiss)
        var pen = Math.min(Math.max(0, Number(sup.cash || 0)), Number(c.penaltyPerMiss || 0));
        sup.cash = Math.max(0, Number(sup.cash || 0) - pen);
        buy.cash += pen;
        c.periodsMissed = (c.periodsMissed || 0) + 1;
        c.nextDueTick = tick + c.periodTicks;
        adjustRelation(state, c.supplierCid, c.buyerCid, -12, 'Срыв срока поставки по контракту ' + c.id);
        if (c.periodsMissed >= 2 || c.remainingBatches <= 0) {
          c.status = 'defaulted';
        }
        events.push({ type: 'penalty', contractId: c.id, supplierCid: c.supplierCid, buyerCid: c.buyerCid, penalty: pen, status: c.status });
      }
    }
    return events;
  }

  function refreshBotSupplyContracts(state) {
    ensureDiplomacyState(state);
    var kept = (state.supplyContracts || []).filter(function (c) {
      return c.status === 'open' && !c.isBot && c.remainingBatches > 0;
    });
    var cids = Object.keys(state.companies || {});
    for (var i = 0; i < cids.length; i++) {
      var bot = state.companies[cids[i]];
      if (!bot || !bot.isBot) continue;
      var tpl = BOT_ORDER_TEMPLATES[bot.id];
      var arch = BOT_ARCHETYPES[bot.archetype] || null;
      var bo = (tpl && tpl.buy && tpl.buy.length) ? tpl.buy[0] : (arch && arch.buyFocus && arch.buyFocus.length ? { item: arch.buyFocus[0], qty: 16, price: 110 } : null);
      if (!bo) continue;
      kept.push({
        id: 'sc' + (state.nextSupplySeq++),
        supplierCid: 'any',
        buyerCid: bot.id,
        isBot: true,
        item: bo.item,
        qty: bo.qty * 2,
        price: Math.round(bo.price * 2.15),
        penaltyPerMiss: Math.round(bo.price * 0.65),
        remainingBatches: 3,
        status: 'open'
      });
    }
    state.supplyContracts = kept;
    return kept.length;
  }

  function fulfillSupplyContract(state, actorCid, contractId, nowTick) {
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
    actor.stats.contractsDone = (actor.stats.contractsDone || 0) + 1;
    c.periodsDone = (c.periodsDone || 0) + 1;
    c.remainingBatches -= 1;
    if (c.timed && c.periodTicks && typeof nowTick === 'number') {
      c.nextDueTick = nowTick + c.periodTicks;
    }
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

  function sectorKey(sx, sz, dimension) {
    var dim = dimension ? (global.LHStructureProduction ? global.LHStructureProduction.normalizeDimension(dimension) : String(dimension)) : 'minecraft:overworld';
    if (!dim || dim === 'minecraft:overworld' || dim === 'overworld') return sx + ',' + sz;
    return dim + '|' + sx + ',' + sz;
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
      playerRelations: {},
      supplyContracts: [],
      sectorOffers: [],
      sectorStructures: {},
      structureCatalog: {},
      auctions: [],
      activeMobRaids: [],
      coalitions: {},
      marketOrders: [],
      tradeOffers: [],
      nextOrderSeq: 1,
      nextBuildingSeq: 1,
      nextSupplySeq: 1,
      nextAuctionSeq: 1,
      nextMobRaidSeq: 1,
      botChapterSpawnsDone: 0,
      completedChapters: 0,
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

  function ensureBots(state, rngFn) {
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
      var arch = BOT_ARCHETYPES[b.archetype] || BOT_ARCHETYPES.mining_syndicate;
      if (!state.companies[b.id]) {
        var traits = rollCompanyTraits(2, rngFn);
        var bComp = {
          id: b.id,
          name: b.name,
          archetype: arch.id,
          archetypeName: arch.name,
          traits: traits,
          color: b.color,
          colorCode: b.colorCode,
          tag: b.tag,
          isBot: true,
          owner: 'AI',
          members: [],
          cash: b.cash,
          transportSpec: b.transportSpec,
          resourceSpec: b.resourceSpec,
          envType: b.envType || 'normal',
          hqSx: b.hqSx,
          hqSz: b.hqSz,
          hqX: b.hqSx * SECTOR_SIZE,
          hqY: typeof b.hqY === 'number' ? b.hqY : preferredBuildingY(b.envType || 'normal', 70),
          hqZ: b.hqSz * SECTOR_SIZE,
          stockBuffer: {},
          incomeHistory: [],
          physicalStockEstimate: 0,
          stats: { deliveries: 0, tradeVolume: 0, blocksMined: 0, sectorsCaptured: 1, contractsDone: 0, routesDone: 0, raidsLaunched: 0, hostileCaptures: 0 }
        };
        var bMods = getCompanyTraitModifiers(bComp);
        bComp.cash += bMods.botCashBonus;
        state.companies[b.id] = bComp;
      } else {
        var existingB = state.companies[b.id];
        existingB.hqSx = b.hqSx;
        existingB.hqSz = b.hqSz;
        if (!existingB.envType) existingB.envType = b.envType || 'normal';
        if (!existingB.archetype) { existingB.archetype = arch.id; existingB.archetypeName = arch.name; }
        if (!existingB.traits || !existingB.traits.length) existingB.traits = rollCompanyTraits(2, rngFn);
        if (!existingB.stockBuffer) existingB.stockBuffer = {};
        if (!existingB.incomeHistory) existingB.incomeHistory = [];
        if (typeof existingB.hqY !== 'number') existingB.hqY = typeof b.hqY === 'number' ? b.hqY : preferredBuildingY(existingB.envType, 70);
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

  function countClaims(state, cid, dimension) {
    var cnt = 0;
    var normDim = dimension ? (global.LHStructureProduction ? global.LHStructureProduction.normalizeDimension(dimension) : dimension) : null;
    var keys = Object.keys(state.claims || {});
    for (var i = 0; i < keys.length; i++) {
      var cl = state.claims[keys[i]];
      if (!cl || cl.owner !== cid) continue;
      if (normDim && (cl.dimension || 'minecraft:overworld') !== normDim) continue;
      cnt++;
    }
    return cnt;
  }

  function getCompanyValuationBreakdown(state, cid) {
    var c = state.companies && state.companies[cid];
    if (!c) {
      return {
        cash: 0, inventoryValue: 0, facilitiesValue: 0, productionPotentialValue: 0,
        territoryValue: 0, activityValue: 0, equityPortfolioValue: 0, sharePrice: 5,
        avgHourlyIncome: 0, totalValuation: 0
      };
    }
    var op = getOperationalValuationBreakdown(state, cid);
    var port = getCompanyPortfolioDetails(state, cid);
    var totalValuation = Math.max(0, Math.round(op.operationalTotal + port.externalEquityValue));
    return {
      cash: op.cash,
      inventoryValue: op.inventoryValue,
      facilitiesValue: op.facilitiesValue,
      productionPotentialValue: op.productionPotentialValue,
      territoryValue: op.territoryValue,
      activityValue: op.activityValue,
      equityPortfolioValue: port.externalEquityValue,
      sharePrice: getSharePrice(state, cid),
      avgHourlyIncome: op.avgHourlyIncome,
      totalValuation: totalValuation
    };
  }

  function computeValuation(state, cid) {
    return getCompanyValuationBreakdown(state, cid).totalValuation;
  }

  function collectCompanyAnchors(state) {
    var anchors = [];
    var cids = Object.keys(state.companies || {});
    for (var i = 0; i < cids.length; i++) {
      var c = state.companies[cids[i]];
      if (!c || c.isPirate) continue;
      anchors.push({ cid: c.id, sx: Number(c.hqSx || 0), sz: Number(c.hqSz || 0), weight: 1.0 });
    }
    var claimKeys = Object.keys(state.claims || {});
    for (var j = 0; j < claimKeys.length; j++) {
      var cl = state.claims[claimKeys[j]];
      if (cl && state.companies[cl.owner] && !state.companies[cl.owner].isPirate && (!cl.dimension || cl.dimension === 'minecraft:overworld')) {
        anchors.push({ cid: cl.owner, sx: cl.sx, sz: cl.sz, weight: 1.0 });
      }
    }
    return anchors;
  }

  function resolveSectorOwner(state, sx, sz, dimension) {
    var dim = global.LHStructureProduction ? global.LHStructureProduction.normalizeDimension(dimension) : 'minecraft:overworld';
    var key = sectorKey(sx, sz, dim);
    if (dim === 'minecraft:overworld' && isSpawnProtectedSector(sx, sz)) {
      return { sx: sx, sz: sz, dimension: dim, key: key, owner: null, kind: 'unclaimed', strength: 0, isHq: false, claim: null };
    }
    var cl = state.claims && state.claims[key];
    if (cl && state.companies && state.companies[cl.owner]) {
      return {
        sx: sx,
        sz: sz,
        dimension: dim,
        key: key,
        owner: cl.owner,
        kind: 'claimed',
        strength: Number(cl.strength || 1),
        isHq: !!cl.isHq,
        claim: cl
      };
    }
    if (dim !== 'minecraft:overworld') {
      return { sx: sx, sz: sz, dimension: dim, key: key, owner: null, kind: 'unclaimed', strength: 0, isHq: false, claim: null };
    }
    var anchors = collectCompanyAnchors(state);
    if (!anchors.length) {
      return { sx: sx, sz: sz, dimension: dim, key: key, owner: null, kind: 'unclaimed', strength: 0, isHq: false, claim: null };
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
      dimension: dim,
      key: key,
      owner: bestCid,
      kind: 'voronoi',
      strength: 0,
      isHq: false,
      claim: null
    };
  }

  function isAdjacentOwned(state, cid, sx, sz, dimension) {
    var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (var i = 0; i < dirs.length; i++) {
      var k = sectorKey(sx + dirs[i][0], sz + dirs[i][1], dimension);
      var cl = state.claims && state.claims[k];
      if (cl && cl.owner === cid) return true;
    }
    return false;
  }

  function minOwnedSectorDistance(state, cid, sx, sz, dimension) {
    var normDim = global.LHStructureProduction ? global.LHStructureProduction.normalizeDimension(dimension) : 'minecraft:overworld';
    var best = 999999;
    var owned = 0;
    var keys = Object.keys(state.claims || {});
    for (var i = 0; i < keys.length; i++) {
      var cl = state.claims[keys[i]];
      if (!cl || cl.owner !== cid) continue;
      if ((cl.dimension || 'minecraft:overworld') !== normDim) continue;
      owned++;
      var md = Math.abs(sx - cl.sx) + Math.abs(sz - cl.sz);
      if (md < best) best = md;
    }
    if (owned === 0) return 1;
    return best;
  }

  function computeClaimCost(state, cid, sx, sz, dimension) {
    var c = state.companies && state.companies[cid];
    if (!c) return { ok: false, reason: 'no_company', cost: BASE_CLAIM_COST };
    var dim = global.LHStructureProduction ? global.LHStructureProduction.normalizeDimension(dimension) : 'minecraft:overworld';
    if (dim === 'minecraft:overworld' && isSpawnProtectedSector(sx, sz)) {
      return { ok: false, reason: 'spawn_protected', cost: 0, adjacent: false, sectorDist: 0, exclaveMult: 1.0 };
    }
    var ownerInfo = resolveSectorOwner(state, sx, sz, dim);
    var tSpec = c.transportSpec ? TRANSPORT_SPECS[c.transportSpec] : null;
    var disc = tSpec ? Number(tSpec.claimDiscount || 0) : 0;
    var owned = countClaims(state, cid);
    var sectorDist = dim === 'minecraft:overworld' ? minOwnedSectorDistance(state, cid, sx, sz, dim) : 1;
    var adjacent = sectorDist <= 1;
    var adjDiscount = (owned > 0 && adjacent) ? 0.20 : 0.0;
    var specMult = Math.max(0.40, 1.0 - disc - adjDiscount);
    var tMods = getCompanyTraitModifiers(c);
    var dimMult = dim === 'minecraft:the_nether' ? 1.35 : (dim === 'minecraft:the_end' ? 1.75 : (dim !== 'minecraft:overworld' ? 1.50 : 1.0));
    var bldgs = listCompanyBuildings(state, cid);
    var warehouseCount = 0;
    for (var bi = 0; bi < bldgs.length; bi++) {
      if (bldgs[bi].type === 'warehouse') warehouseCount++;
    }
    if (warehouseCount > 0) {
      specMult = Math.max(0.35, specMult * Math.max(0.75, 1.0 - Math.min(0.25, warehouseCount * 0.10)));
    }
    var exclaveMult = adjacent ? 1.0 : (1.0 + 1.5 * (sectorDist - 1) + 0.5 * (sectorDist - 1) * (sectorDist - 1));
    var cbStat = getComebackStatus(state, cid);
    var comebackClaimMult = (cbStat.active && ownerInfo.kind !== 'claimed') ? Math.max(0.45, 1.0 - cbStat.claimDiscount) : 1.0;

    if (ownerInfo.kind === 'claimed') {
      if (ownerInfo.owner === cid) return { ok: false, reason: 'already_yours', cost: 0, adjacent: true, sectorDist: 0, exclaveMult: 1.0 };
      if (hasPact(state, cid, ownerInfo.owner)) {
        return { ok: false, reason: 'pact_protected', targetOwner: ownerInfo.owner, cost: 0 };
      }
      var coalMod = getCoalitionModifiers(state, cid, ownerInfo.owner);
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
        coalitionAttack: coalMod.isCoalitionAttack,
        cost: Math.round(baseTakeover * specMult * exclaveMult * nonAdjSiege * dimMult * tMods.claimCostMult * tMods.captureCostMult * coalMod.captureCostMult)
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
      cost: Math.round(BASE_CLAIM_COST * specMult * exclaveMult * dimMult * tMods.claimCostMult * comebackClaimMult)
    };
  }

  function minCompanyHqDistance(state, sx, sz) {
    var best = 999999;
    var cids = Object.keys(state.companies || {});
    for (var i = 0; i < cids.length; i++) {
      var c = state.companies[cids[i]];
      if (!c) continue;
      var d = Math.max(Math.abs(Number(c.hqSx || 0) - sx), Math.abs(Number(c.hqSz || 0) - sz));
      if (d < best) best = d;
    }
    return best;
  }

  function minPlayerHqDistance(state, sx, sz) {
    var best = 999999;
    var cids = Object.keys(state.companies || {});
    for (var i = 0; i < cids.length; i++) {
      var c = state.companies[cids[i]];
      if (!c || c.isBot) continue;
      var d = Math.max(Math.abs(Number(c.hqSx || 0) - sx), Math.abs(Number(c.hqSz || 0) - sz));
      if (d < best) best = d;
    }
    return best;
  }

  function companyCreate(state, playerUuid, rawId, displayName, hqX, hqZ, opts) {
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
    if (isSpawnProtectedSector(sc.sx, sc.sz) || state.claims[sc.key]) {
      // Wide HQ spacing fallback so player bases don't cluster right next to each other
      var ringCandidates = [
        [0, 5], [5, 0], [-5, 0], [0, -5],
        [4, 4], [-4, 4], [4, -4], [-4, -4],
        [0, -10], [10, 0], [-10, 0], [0, 10],
        [9, 9], [-9, 9], [9, -9], [-9, -9],
        [0, 3], [3, 0], [-3, 0], [0, -3],
        [0, 2], [2, 2], [-2, 2], [2, -2], [-2, -2]
      ];
      var bestCand = null;
      var bestPlayerDist = -1;
      for (var ri = 0; ri < ringCandidates.length; ri++) {
        var rx = ringCandidates[ri][0], rz = ringCandidates[ri][1];
        var rKey = sectorKey(rx, rz);
        if (!state.claims[rKey]) {
          var pDist = minPlayerHqDistance(state, rx, rz);
          var cDist = minCompanyHqDistance(state, rx, rz);
          if (pDist > bestPlayerDist) {
            bestPlayerDist = pDist;
            bestCand = { sx: rx, sz: rz, key: rKey };
          }
          if (pDist >= 8 && cDist >= 3) {
            sc = { sx: rx, sz: rz, key: rKey };
            bestCand = sc;
            break;
          }
        }
      }
      if (bestCand) sc = bestCand;
    }
    var reqEnv = (opts && (opts.envType || opts.environment)) ? (opts.envType || opts.environment) : 'normal';
    var envType = COMPANY_ENV_TYPES[reqEnv] ? reqEnv : 'normal';
    var hqY = (opts && typeof opts.hqY === 'number') ? Math.round(opts.hqY) : preferredBuildingY(envType, 70);
    var traits = (opts && Array.isArray(opts.traits) && opts.traits.length) ? opts.traits : rollCompanyTraits(1);
    var comp = {
      id: cid,
      name: String(displayName || cid).slice(0, 32),
      traits: traits,
      color: 'blue',
      colorCode: colorCode,
      tag: cid.toUpperCase().slice(0, 4),
      isBot: false,
      owner: playerUuid,
      members: [playerUuid],
      cash: STARTING_CASH,
      transportSpec: null,
      resourceSpec: null,
      envType: envType,
      hqSx: sc.sx,
      hqSz: sc.sz,
      hqX: Math.round(Number(hqX || sc.sx * SECTOR_SIZE)),
      hqY: hqY,
      hqZ: Math.round(Number(hqZ || sc.sz * SECTOR_SIZE)),
      stockBuffer: {},
      incomeHistory: [],
      physicalStockEstimate: 0,
      stats: { deliveries: 0, tradeVolume: 0, blocksMined: 0, sectorsCaptured: 0, contractsDone: 0, routesDone: 0, raidsLaunched: 0, hostileCaptures: 0 }
    };
    state.companies[cid] = comp;
    state.playerCompany[playerUuid] = cid;

    // Claim HQ sector if not already claimed by a bot/player HQ
    var cur = state.claims[sc.key];
    if (!cur) {
      state.claims[sc.key] = { sx: sc.sx, sz: sc.sz, dimension: 'minecraft:overworld', owner: cid, strength: 2, isHq: true };
      comp.stats.sectorsCaptured = 1;
    }
    syncPlayerReputationToCompany(state, playerUuid, cid);
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
    syncPlayerReputationToCompany(state, playerUuid, cid);
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
      if (TRANSPORT_SPECS[specId].envType) {
        comp.envType = TRANSPORT_SPECS[specId].envType;
        comp.hqY = preferredBuildingY(comp.envType, comp.hqY);
      }
      return { ok: true, switched: switching, cost: switching ? SPEC_SWITCH_COST : 0, spec: TRANSPORT_SPECS[specId], envType: comp.envType };
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

  function relocateHqIfNeeded(state, cid) {
    var comp = state.companies && state.companies[cid];
    if (!comp) return false;
    var hqKey = sectorKey(comp.hqSx, comp.hqSz);
    var hqCl = state.claims[hqKey];
    if (hqCl && hqCl.owner === cid && hqCl.isHq) return true;
    var keys = Object.keys(state.claims || {});
    for (var i = 0; i < keys.length; i++) {
      var cl = state.claims[keys[i]];
      if (cl && cl.owner === cid && (!cl.dimension || cl.dimension === 'minecraft:overworld')) {
        cl.isHq = true;
        comp.hqSx = cl.sx;
        comp.hqSz = cl.sz;
        comp.hqX = cl.sx * SECTOR_SIZE;
        comp.hqZ = cl.sz * SECTOR_SIZE;
        return true;
      }
    }
    return false;
  }

  function wouldEliminatePlayerCompany(state, targetCid, targetCl) {
    var tc = state.companies && state.companies[targetCid];
    if (!tc || tc.isBot) return false;
    if (!targetCl || targetCl.owner !== targetCid) return false;
    return countClaims(state, targetCid) <= 1;
  }

  var ENDGAME_BUYOUT_CHAPTER_RATIO = 0.8;

  function getEndgameBuyoutStatus(state, completedChapters, totalChapters) {
    var total = Math.max(1, Math.round(Number(totalChapters || 61)));
    var done = Math.max(0, Math.round(Number(completedChapters !== undefined ? completedChapters : (state && state.completedChapters ? state.completedChapters : 0))));
    var required = Math.ceil(total * ENDGAME_BUYOUT_CHAPTER_RATIO);
    var unlocked = done >= required;
    var targets = [];
    if (state && state.companies) {
      Object.keys(state.companies).forEach(function (cid) {
        var c = state.companies[cid];
        if (!c || c.isBot || c.isPirate) return;
        var val = computeValuation(state, cid);
        targets.push({
          cid: cid,
          name: c.name,
          valuation: val,
          buyoutPrice: Math.max(500, Math.round(val * 1.25))
        });
      });
    }
    return {
      unlocked: unlocked,
      completedChapters: done,
      requiredChapters: required,
      totalChapters: total,
      ratio: Math.min(1, done / total),
      targets: targets,
      victory: (state && state.endgameVictory) ? state.endgameVictory : null
    };
  }

  function companyMerge(state, fromCid, toCid, opts) {
    ensureDiplomacyState(state);
    var o = opts || {};
    var fromComp = state.companies && state.companies[fromCid];
    var toComp = state.companies && state.companies[toCid];
    if (!fromComp || !toComp || fromCid === toCid) return { ok: false, reason: 'bad_company' };
    var totalChapters = Math.max(1, Math.round(Number(o.totalChapters || 61)));
    var completedChapters = Math.max(0, Math.round(Number(o.completedChapters !== undefined ? o.completedChapters : (state.completedChapters || 0))));
    var requiredChapters = Math.ceil(totalChapters * ENDGAME_BUYOUT_CHAPTER_RATIO);
    var isEndgameBuyout = false;
    var buyoutPrice = 0;

    // Early/mid game: protect player companies from hostile absorption;
    // Endgame (>= 4/5 chapters completed): allow corporate buyout as campaign completion!
    if (!fromComp.isBot) {
      if (completedChapters < requiredChapters) {
        return {
          ok: false,
          reason: 'player_merge_disabled',
          completedChapters: completedChapters,
          requiredChapters: requiredChapters,
          totalChapters: totalChapters,
          message: 'Полное поглощение компаний игроков отключено до эндгейма (' + completedChapters + '/' + requiredChapters + ' глав, нужно 4/5) — до тех пор доступно до 49% акций.'
        };
      }
      isEndgameBuyout = true;
      buyoutPrice = o.buyoutPrice !== undefined ? Math.max(0, Math.round(Number(o.buyoutPrice))) : Math.max(500, Math.round(computeValuation(state, fromCid) * 1.25));
      if (toComp.cash < buyoutPrice) {
        return {
          ok: false,
          reason: 'no_cash_for_buyout',
          cost: buyoutPrice,
          cash: toComp.cash,
          completedChapters: completedChapters,
          requiredChapters: requiredChapters
        };
      }
      toComp.cash -= buyoutPrice;
    }

    Object.keys(state.claims || {}).forEach(function (ck) {
      var cl = state.claims[ck];
      if (cl && cl.owner === fromCid) {
        cl.owner = toCid;
        cl.isHq = false;
      }
    });
    Object.keys(state.buildings || {}).forEach(function (bk) {
      var b = state.buildings[bk];
      if (b && b.owner === fromCid) b.owner = toCid;
    });
    toComp.cash += Math.max(0, Math.round(Number(fromComp.cash || 0)));

    // Transfer player memberships from absorbed company to buyer so players stay in the consolidated empire
    if (isEndgameBuyout) {
      if (!state.playerCompany) state.playerCompany = {};
      if (!Array.isArray(toComp.members)) toComp.members = [];
      (fromComp.members || []).forEach(function (pid) {
        if (toComp.members.indexOf(pid) === -1) toComp.members.push(pid);
        state.playerCompany[pid] = toCid;
      });
      Object.keys(state.playerCompany).forEach(function (pid) {
        if (state.playerCompany[pid] === fromCid) {
          state.playerCompany[pid] = toCid;
          if (toComp.members.indexOf(pid) === -1) toComp.members.push(pid);
        }
      });
    }

    var victory = null;
    if (isEndgameBuyout) {
      victory = {
        winnerCid: toCid,
        winnerName: toComp.name,
        absorbedCid: fromCid,
        absorbedName: fromComp.name,
        buyoutPrice: buyoutPrice,
        completedChapters: completedChapters,
        totalChapters: totalChapters,
        tick: Number(o.nowTick || 0)
      };
      state.endgameVictory = victory;
      toComp.endgameVictory = victory;
    }
    delete state.companies[fromCid];
    return {
      ok: true,
      merged: fromCid,
      into: toCid,
      isEndgameBuyout: isEndgameBuyout,
      buyoutPrice: buyoutPrice,
      endgameVictory: victory
    };
  }

  function claimOrCaptureSector(state, cid, sx, sz, allowCapture, opts) {
    var comp = state.companies[cid];
    if (!comp) return { ok: false, reason: 'no_company' };
    var dim = (opts && opts.dimension) ? (global.LHStructureProduction ? global.LHStructureProduction.normalizeDimension(opts.dimension) : opts.dimension) : 'minecraft:overworld';
    var info = computeClaimCost(state, cid, sx, sz, dim);
    if (!info.ok) return info;
    if (opts && opts.remote && !info.adjacent) {
      return { ok: false, reason: 'not_adjacent_remote', sectorDist: info.sectorDist, cost: info.cost };
    }
    if (info.mode === 'capture' && !allowCapture) return { ok: false, reason: 'enemy_claimed', targetOwner: info.targetOwner, cost: info.cost };
    var kCheck = sectorKey(sx, sz, dim);
    if (info.mode === 'capture' && info.targetOwner && wouldEliminatePlayerCompany(state, info.targetOwner, state.claims[kCheck])) {
      return { ok: false, reason: 'cannot_eliminate_player_company', targetOwner: info.targetOwner };
    }
    var discountFactor = (opts && opts.discountFactor > 0) ? Number(opts.discountFactor) : 1.0;
    var costMult = (opts && opts.costMultiplier > 0) ? Number(opts.costMultiplier) : 1.0;
    var finalCost = Math.max(10, Math.round(info.cost * discountFactor * costMult));
    if (comp.cash < finalCost) return { ok: false, reason: 'no_cash', cost: finalCost, cash: comp.cash };

    comp.cash -= finalCost;
    if (info.mode === 'capture' && info.targetOwner && state.companies[info.targetOwner]) {
      // Pay 50% compensation into rival company's balance in hostile buyout
      state.companies[info.targetOwner].cash += Math.round(finalCost * 0.5);
      comp.stats.hostileCaptures = (comp.stats.hostileCaptures || 0) + 1;
      adjustRelation(state, cid, info.targetOwner, -20, 'Силовой захват сектора (' + sx + ',' + sz + ')');
      var coalMod = getCoalitionModifiers(state, cid, info.targetOwner);
      if (coalMod.isCoalitionAttack && coalMod.captureBounty > 0) {
        comp.cash += coalMod.captureBounty;
      }
    }
    var k = sectorKey(sx, sz, dim);
    var prevWasHq = !!(state.claims[k] && state.claims[k].isHq);
    state.claims[k] = { sx: sx, sz: sz, dimension: dim, owner: cid, strength: 1, isHq: false };
    if (prevWasHq && info.targetOwner) relocateHqIfNeeded(state, info.targetOwner);
    comp.stats.sectorsCaptured = (comp.stats.sectorsCaptured || 0) + 1;
    return {
      ok: true,
      mode: info.mode,
      cost: finalCost,
      key: k,
      dimension: dim,
      previousOwner: info.targetOwner,
      adjacent: info.adjacent,
      sectorDist: info.sectorDist,
      coalitionAttack: !!info.coalitionAttack
    };
  }

  function weakenOrCaptureSector(state, attackerCid, sx, sz, powerLevels, cashCost, dimension) {
    var comp = state.companies[attackerCid];
    if (!comp) return { ok: false, reason: 'no_company' };
    var dim = global.LHStructureProduction ? global.LHStructureProduction.normalizeDimension(dimension) : 'minecraft:overworld';
    var k = sectorKey(sx, sz, dim);
    var cl = state.claims[k];
    if (!cl || !state.companies[cl.owner]) return { ok: false, reason: 'not_claimed' };
    if (cl.owner === attackerCid) return { ok: false, reason: 'already_yours' };
    var cost = Math.max(0, Math.round(Number(cashCost || 0)));
    if (comp.cash < cost) return { ok: false, reason: 'no_cash', cost: cost, cash: comp.cash };

    comp.cash -= cost;
    var prevOwner = cl.owner;
    var coalMod = getCoalitionModifiers(state, attackerCid, prevOwner);
    var dmg = Math.max(1, Math.round(Number(powerLevels || 1)) + Number(coalMod.raidPowerBonus || 0) - Number(coalMod.defenseBonus || 0));
    var rem = Number(cl.strength || 1) - dmg;
    if (rem <= 0) {
      if (wouldEliminatePlayerCompany(state, prevOwner, cl)) {
        cl.strength = 1;
        return { ok: true, captured: false, protectedLastHq: true, previousOwner: prevOwner, newStrength: 1, cost: cost, coalitionAttack: coalMod.isCoalitionAttack };
      }
      var wasHq = !!cl.isHq;
      state.claims[k] = { sx: sx, sz: sz, dimension: dim, owner: attackerCid, strength: 1, isHq: false };
      if (wasHq) relocateHqIfNeeded(state, prevOwner);
      comp.stats.sectorsCaptured = (comp.stats.sectorsCaptured || 0) + 1;
      comp.stats.hostileCaptures = (comp.stats.hostileCaptures || 0) + 1;
      if (coalMod.isCoalitionAttack && coalMod.captureBounty > 0) comp.cash += coalMod.captureBounty;
      adjustRelation(state, attackerCid, prevOwner, -18, 'Рейдерский захват сектора (' + sx + ',' + sz + ')');
      return { ok: true, captured: true, previousOwner: prevOwner, newStrength: 1, cost: cost, coalitionAttack: coalMod.isCoalitionAttack };
    }
    cl.strength = rem;
    return { ok: true, captured: false, previousOwner: prevOwner, newStrength: rem, cost: cost, coalitionAttack: coalMod.isCoalitionAttack };
  }

  function transferSector(state, fromCid, toCid, sx, sz, dimension) {
    var fromComp = state.companies[fromCid];
    var toComp = state.companies[toCid];
    if (!fromComp || !toComp || fromCid === toCid) return { ok: false, reason: 'bad_company' };
    var k = sectorKey(sx, sz, dimension);
    var cl = state.claims[k];
    if (!cl || cl.owner !== fromCid) return { ok: false, reason: 'not_owned' };
    if (wouldEliminatePlayerCompany(state, fromCid, cl)) return { ok: false, reason: 'last_hq' };
    var wasHq = !!cl.isHq;
    cl.owner = toCid;
    cl.isHq = false;
    cl.strength = 1;
    if (wasHq) relocateHqIfNeeded(state, fromCid);
    toComp.stats.sectorsCaptured = (toComp.stats.sectorsCaptured || 0) + 1;
    return { ok: true, key: k, from: fromCid, to: toCid };
  }

  function antitrustSeize(state, attackerCid, sx, sz, dimension) {
    var comp = state.companies[attackerCid];
    if (!comp) return { ok: false, reason: 'no_company' };
    var k = sectorKey(sx, sz, dimension);
    var cl = state.claims[k];
    if (!cl || !state.companies[cl.owner]) return { ok: false, reason: 'not_claimed' };
    if (cl.owner === attackerCid) return { ok: false, reason: 'already_yours' };
    if (wouldEliminatePlayerCompany(state, cl.owner, cl)) return { ok: false, reason: 'cannot_eliminate_player_company' };
    if (!isAdjacentOwned(state, attackerCid, sx, sz, dimension)) return { ok: false, reason: 'not_adjacent' };
    if ((cl.strength || 1) > 1) return { ok: false, reason: 'fortified', strength: cl.strength };
    var target = state.companies[cl.owner];
    var myVal = computeValuation(state, attackerCid);
    var rivalVal = computeValuation(state, target.id);
    if (target.cash >= 100 && myVal < rivalVal * 1.8) {
      return { ok: false, reason: 'antitrust_not_eligible', myVal: myVal, rivalVal: rivalVal, rivalCash: target.cash };
    }
    return claimOrCaptureSector(state, attackerCid, sx, sz, true, { discountFactor: 0.55, dimension: dimension });
  }

  function fortifySector(state, cid, sx, sz, dimension) {
    var comp = state.companies[cid];
    if (!comp) return { ok: false, reason: 'no_company' };
    var k = sectorKey(sx, sz, dimension);
    var cl = state.claims[k];
    if (!cl || cl.owner !== cid) return { ok: false, reason: 'not_owned' };
    if ((cl.strength || 1) >= 4) return { ok: false, reason: 'max_strength' };
    var cost = BASE_FORTIFY_COST * (cl.strength || 1);
    if (comp.cash < cost) return { ok: false, reason: 'no_cash', cost: cost };
    comp.cash -= cost;
    cl.strength = (cl.strength || 1) + 1;
    return { ok: true, strength: cl.strength, cost: cost };
  }

  function countPlayerClaimsTotal(state) {
    var cnt = 0;
    var keys = Object.keys(state.claims || {});
    for (var i = 0; i < keys.length; i++) {
      var cl = state.claims[keys[i]];
      if (!cl || !cl.owner) continue;
      var comp = state.companies && state.companies[cl.owner];
      if (comp && !comp.isBot) cnt++;
    }
    return cnt;
  }

  function countBotClaimsTotal(state) {
    var cnt = 0;
    var keys = Object.keys(state.claims || {});
    for (var i = 0; i < keys.length; i++) {
      var cl = state.claims[keys[i]];
      if (!cl || !cl.owner) continue;
      var comp = state.companies && state.companies[cl.owner];
      if (comp && comp.isBot && !comp.isPirate) cnt++;
    }
    return cnt;
  }

  function countActiveBots(state) {
    var cnt = 0;
    var cids = Object.keys(state.companies || {});
    for (var i = 0; i < cids.length; i++) {
      var c = state.companies[cids[i]];
      if (c && c.isBot && !c.isPirate) cnt++;
    }
    return cnt;
  }

  function countPlayerCompanies(state) {
    var cnt = 0;
    var cids = Object.keys(state.companies || {});
    for (var i = 0; i < cids.length; i++) {
      var c = state.companies[cids[i]];
      if (c && !c.isBot && !c.isPirate) cnt++;
    }
    return cnt;
  }

  function countOverworldAvailableSectors(maxSectorAbs) {
    var limit = Math.max(2, Math.floor(Number(maxSectorAbs || 5)));
    var side = limit * 2 + 1;
    return Math.max(1, side * side - 9); // excluding 3x3 spawn sanctuary
  }

  function getBotScalingDetails(state, maxSectorAbs, completedChapters) {
    ensureDiplomacyState(state);
    var activeBots = countActiveBots(state);
    var playerCompanies = countPlayerCompanies(state);
    var playerClaims = countPlayerClaimsTotal(state);
    var playerChunks = playerClaims * 256;
    var chDone = Math.max(0, Number(completedChapters !== undefined ? completedChapters : (state.completedChapters || 0)));
    var totalOpen = countOverworldAvailableSectors(maxSectorAbs || 5);
    var nonPlayerOpen = Math.max(activeBots, totalOpen - playerClaims);

    if (chDone <= 0 && playerCompanies <= 0 && playerClaims <= 0) {
      return {
        maxSectors: activeBots,
        maxChunks: activeBots * 256,
        activeBots: activeBots,
        playerCompanies: 0,
        playerSectors: 0,
        playerChunks: 0,
        completedChapters: 0,
        nonPlayerOpenSectors: nonPlayerOpen
      };
    }
    // Linear scaling combining player company count (+3 sectors/company), player occupied chunks/sectors (+1.5 sectors per player sector), and 1/3-campaign progress
    var oneThirdChapters = 20;
    var chapterProgress = Math.min(1.0, chDone / oneThirdChapters);
    var playerLinearCap = activeBots + playerCompanies * 3 + Math.round(playerClaims * 1.5);
    var chapterLinearCap = Math.round(activeBots + (nonPlayerOpen - activeBots) * chapterProgress);
    var maxSectors = Math.min(nonPlayerOpen, Math.max(activeBots + playerClaims, Math.max(playerLinearCap, chapterLinearCap)));
    return {
      maxSectors: maxSectors,
      maxChunks: maxSectors * 256,
      activeBots: activeBots,
      playerCompanies: playerCompanies,
      playerSectors: playerClaims,
      playerChunks: playerChunks,
      completedChapters: chDone,
      nonPlayerOpenSectors: nonPlayerOpen
    };
  }

  function maxBotClaimsAllowed(state, maxSectorAbs, completedChapters) {
    return getBotScalingDetails(state, maxSectorAbs, completedChapters).maxSectors;
  }

  var DYNAMIC_BOT_NAMES = [
    'Север-Транс', 'УралРуда', 'БайкалЛогист', 'Волга-Карго', 'СибЭнерго',
    'ДальМорПорт', 'АрктикСнаб', 'КамаИндустри', 'ОбьЭкспресс', 'ТайгаТрест',
    'СтепьМагистраль', 'ЕнисейСтрой', 'КрымНефть', 'КолымаЗолото', 'АлтайКарго',
    'ДонХимПром', 'АмурМост', 'НеваЭнерджи', 'МагаданПорт', 'СахалинГаз'
  ];

  function spawnDynamicBotCompany(state, maxSectorAbs, rngFn, opts) {
    ensureBots(state, rngFn);
    var rng = rngFn || Math.random;
    var limit = Math.max(3, Math.floor(Number(maxSectorAbs || 3)));
    if (!state.nextBotSeq) state.nextBotSeq = 1;

    var seq = state.nextBotSeq++;
    var bid = 'bot_dyn_' + seq;
    while (state.companies[bid]) {
      seq = state.nextBotSeq++;
      bid = 'bot_dyn_' + seq;
    }

    var minRing = Math.max(4, Math.floor(limit * 0.40));
    var hqSx = null;
    var hqSz = null;
    for (var attempt = 0; attempt < 64; attempt++) {
      var angle = rng() * 6.283185307179586;
      var rad = minRing + rng() * Math.max(1, limit - minRing);
      var csx = Math.round(Math.cos(angle) * rad);
      var csz = Math.round(Math.sin(angle) * rad);
      if (isSpawnProtectedSector(csx, csz)) continue;
      if (Math.abs(csx) > limit || Math.abs(csz) > limit) continue;
      if (!state.claims[sectorKey(csx, csz)] && minCompanyHqDistance(state, csx, csz) >= 4) {
        hqSx = csx;
        hqSz = csz;
        break;
      }
    }
    if (hqSx === null) {
      for (var ring = 2; ring <= limit && hqSx === null; ring++) {
        var ringPts = [[ring, 0], [-ring, 0], [0, ring], [0, -ring], [ring, ring], [-ring, -ring]];
        for (var rp = 0; rp < ringPts.length; rp++) {
          var rx = ringPts[rp][0], rz = ringPts[rp][1];
          if (!isSpawnProtectedSector(rx, rz) && !state.claims[sectorKey(rx, rz)]) {
            hqSx = rx;
            hqSz = rz;
            break;
          }
        }
      }
    }
    if (hqSx === null) return { ok: false, reason: 'no_free_sector' };

    var archKeys = Object.keys(BOT_ARCHETYPES);
    var archId = (opts && opts.archetype && BOT_ARCHETYPES[opts.archetype]) ? opts.archetype : archKeys[(seq - 1) % archKeys.length];
    var arch = BOT_ARCHETYPES[archId];
    var chosenTSpec = arch.transportSpec || 'rail';
    var chosenRSpec = arch.resourceSpec || 'ore';
    var chosenEnv = arch.envType || (TRANSPORT_SPECS[chosenTSpec] ? TRANSPORT_SPECS[chosenTSpec].envType : 'normal');
    var traits = rollCompanyTraits(2, rng);
    var nameBase = DYNAMIC_BOT_NAMES[(seq - 1) % DYNAMIC_BOT_NAMES.length];
    var displayName = seq > DYNAMIC_BOT_NAMES.length ? (nameBase + ' #' + seq) : nameBase;
    var colorCode = PLAYER_COLORS[(seq + 2) % PLAYER_COLORS.length];
    var bot = {
      id: bid,
      name: displayName,
      archetype: arch.id,
      archetypeName: arch.name,
      traits: traits,
      color: 'aqua',
      colorCode: colorCode,
      tag: ('B' + seq).slice(0, 4),
      isBot: true,
      owner: 'AI',
      members: [],
      cash: 1200 + Math.min(2500, seq * 140),
      transportSpec: chosenTSpec,
      resourceSpec: chosenRSpec,
      envType: chosenEnv,
      hqSx: hqSx,
      hqSz: hqSz,
      hqX: hqSx * SECTOR_SIZE,
      hqY: preferredBuildingY(chosenEnv, 70),
      hqZ: hqSz * SECTOR_SIZE,
      stockBuffer: {},
      incomeHistory: [],
      physicalStockEstimate: 0,
      stats: { deliveries: 0, tradeVolume: 0, blocksMined: 0, sectorsCaptured: 1, contractsDone: 0, routesDone: 0, raidsLaunched: 0, hostileCaptures: 0 }
    };
    var bMods = getCompanyTraitModifiers(bot);
    bot.cash += bMods.botCashBonus;
    state.companies[bid] = bot;
    state.claims[sectorKey(hqSx, hqSz)] = {
      sx: hqSx,
      sz: hqSz,
      dimension: 'minecraft:overworld',
      owner: bid,
      strength: 2,
      isHq: true
    };
    return { ok: true, bot: bot, sx: hqSx, sz: hqSz };
  }

  function onChapterCompletedBotSpawn(state, completedChaptersCount, maxSectorAbs, rngFn) {
    ensureDiplomacyState(state);
    var chCount = Math.max(0, Math.round(Number(completedChaptersCount || 0)));
    state.completedChapters = Math.max(Number(state.completedChapters || 0), chCount);
    var targetSpawns = Math.floor(state.completedChapters / 2);
    var spawned = [];
    while ((state.botChapterSpawnsDone || 0) < targetSpawns) {
      var res = spawnDynamicBotCompany(state, maxSectorAbs || 10, rngFn);
      state.botChapterSpawnsDone = (state.botChapterSpawnsDone || 0) + 1;
      if (res.ok) spawned.push(res.bot);
      else break;
    }
    return { ok: true, completedChapters: state.completedChapters, targetSpawns: targetSpawns, spawned: spawned };
  }

  function applyBotCatchupBalancing(state) {
    ensureDiplomacyState(state);
    var playerVals = [];
    var botIds = [];
    Object.keys(state.companies || {}).forEach(function (cid) {
      var c = state.companies[cid];
      if (!c || c.isPirate) return;
      if (c.isBot) botIds.push(cid);
      else playerVals.push(computeValuation(state, cid));
    });
    if (!playerVals.length || !botIds.length) return { adjusted: 0, topPlayerValuation: 0 };
    var topPlayerVal = Math.max.apply(null, playerVals);
    var avgPlayerVal = Math.round(playerVals.reduce(function (a, b) { return a + b; }, 0) / playerVals.length);
    var benchmark = Math.round(topPlayerVal * 0.65 + avgPlayerVal * 0.35);
    var adjusted = 0;
    for (var i = 0; i < botIds.length; i++) {
      var bot = state.companies[botIds[i]];
      var bVal = computeValuation(state, bot.id);
      if (bVal < benchmark * 0.60 && benchmark > 3000) {
        var gap = Math.round((benchmark * 0.60 - bVal) * 0.08);
        var grant = Math.max(40, Math.min(600, gap));
        bot.cash += grant;
        bot.catchupBoost = Math.min(1.80, Math.max(1.15, benchmark / Math.max(800, bVal)));
        adjusted++;
      } else {
        bot.catchupBoost = 1.0;
      }
    }
    return { adjusted: adjusted, topPlayerValuation: topPlayerVal, benchmark: benchmark };
  }

  function triggerBotMobRaid(state, botCid, targetCid, sx, sz, nowTick, opts) {
    ensureDiplomacyState(state);
    var bot = state.companies[botCid];
    var target = state.companies[targetCid];
    if (!bot || !target || botCid === targetCid) return { ok: false, reason: 'bad_company' };
    if (hasPact(state, botCid, targetCid) || isAllied(state, botCid, targetCid)) {
      return { ok: false, reason: 'allied_or_pact' };
    }
    var o = opts || {};
    var raidCost = Math.max(120, Math.round(Number(o.cost || 240)));
    if (bot.cash < raidCost) return { ok: false, reason: 'no_cash', cost: raidCost };
    bot.cash -= raidCost;
    bot.stats.raidsLaunched = (bot.stats.raidsLaunched || 0) + 1;
    var cl = state.claims[sectorKey(sx, sz, o.dimension)];
    var strength = Math.max(1, Math.min(5, Math.round(Number(o.strength || (1 + Math.floor((state.completedChapters || 0) / 10))))));
    var mobRoster = strength >= 3
      ? ['minecraft:pillager', 'minecraft:vindicator', 'minecraft:ravager']
      : ['minecraft:pillager', 'minecraft:vindicator', 'minecraft:zombie'];
    var raid = {
      id: 'raid_' + (state.nextMobRaidSeq++),
      attackerCid: botCid,
      attackerName: bot.name,
      targetCid: targetCid,
      targetName: target.name,
      sx: sx,
      sz: sz,
      dimension: o.dimension || 'minecraft:overworld',
      x: sx * SECTOR_SIZE,
      z: sz * SECTOR_SIZE,
      strength: strength,
      mobCount: 3 + strength * 2,
      mobRoster: mobRoster,
      spawnedInWorld: false,
      startedTick: Number(nowTick || 0),
      expiresTick: Number(nowTick || 0) + 6000,
      status: 'active',
      targetStrengthBefore: cl ? Number(cl.strength || 1) : 1
    };
    state.activeMobRaids.push(raid);
    adjustRelation(state, botCid, targetCid, -15, 'Агрессивный моб-рейд на сектор (' + sx + ',' + sz + ')');
    return { ok: true, raid: raid };
  }

  function evolvePirateSyndicate(state, rngFn) {
    ensureDiplomacyState(state);
    var ps = ensurePirateSyndicate(state);
    var pComp = state.companies[PIRATE_SYNDICATE_ID];
    ps.cash = pComp.cash;
    var score = Math.floor(ps.cash / 800) + ps.caravansRobbed * 2 + ps.raidsCompleted * 3;
    ps.level = Math.max(1, Math.min(10, 1 + Math.floor(score / 4)));
    ps.power = Math.max(12, 12 + ps.level * 6 + ps.caravansRobbed * 2 + ps.raidsCompleted * 3);

    // Pirates establish remote hideout claims when growing strong
    var pirateClaims = countClaims(state, PIRATE_SYNDICATE_ID);
    var desiredClaims = Math.min(5, Math.floor(ps.level / 2));
    if (pirateClaims < desiredClaims && pComp.cash >= 600) {
      var rng = rngFn || Math.random;
      var spots = [
        [-14, -14], [14, -14], [-14, 14], [14, 14],
        [-12, 0], [12, 0], [0, -12], [0, 12]
      ];
      for (var i = 0; i < spots.length; i++) {
        var pick = spots[Math.floor(rng() * spots.length)];
        var k = sectorKey(pick[0], pick[1]);
        if (!isSpawnProtectedSector(pick[0], pick[1]) && !state.claims[k]) {
          state.claims[k] = {
            sx: pick[0],
            sz: pick[1],
            dimension: 'minecraft:overworld',
            owner: PIRATE_SYNDICATE_ID,
            strength: Math.min(3, 1 + Math.floor(ps.level / 3)),
            isHq: pirateClaims === 0,
            isPirateDen: true
          };
          pComp.cash -= 300;
          ps.cash = pComp.cash;
          break;
        }
      }
    }
    return ps;
  }

  function computeCaravanPiracyRisk(state, cid, srcSx, srcSz, dstSx, dstSz, hasEscort, nowTick) {
    ensureDiplomacyState(state);
    var ps = ensurePirateSyndicate(state);
    var comp = state.companies && state.companies[cid];
    if (comp && comp.pirateImmunityUntilTick && Number(nowTick || 0) < comp.pirateImmunityUntilTick) {
      return 0;
    }
    var span = Math.max(1, Math.abs(Number(dstSx || 0) - Number(srcSx || 0)) + Math.abs(Number(dstSz || 0) - Number(srcSz || 0)));
    var baseRisk = Math.min(0.45, 0.04 + span * 0.02 + (ps.level - 1) * 0.03);
    // Patrol posts near origin or destination lower piracy risk
    var patrols = findPatrolPostsCovering(state, cid, Number(srcSx || 0) * SECTOR_SIZE, Number(srcSz || 0) * SECTOR_SIZE).length +
      findPatrolPostsCovering(state, cid, Number(dstSx || 0) * SECTOR_SIZE, Number(dstSz || 0) * SECTOR_SIZE).length;
    if (patrols > 0) baseRisk *= Math.max(0.35, 1.0 - patrols * 0.25);
    if (hasEscort) baseRisk *= 0.18;
    return Math.max(0, Math.min(0.65, Math.round(baseRisk * 1000) / 1000));
  }

  function interceptCaravanByPirates(state, victimCid, itemId, qty, cashValue, nowTick, rngFn) {
    ensureDiplomacyState(state);
    var ps = ensurePirateSyndicate(state);
    var pComp = state.companies[PIRATE_SYNDICATE_ID];
    var rng = rngFn || Math.random;
    var stolenPct = 0.35 + rng() * 0.25;
    var stolenQty = Math.max(1, Math.round(Number(qty || 1) * stolenPct));
    var stolenCash = Math.max(20, Math.round(Number(cashValue || 60) * 0.40));
    if (itemId) {
      ps.lootStash[itemId] = Number(ps.lootStash[itemId] || 0) + stolenQty;
    }
    pComp.cash += stolenCash;
    ps.cash = pComp.cash;
    ps.caravansRobbed += 1;
    evolvePirateSyndicate(state, rngFn);
    if (victimCid && state.companies[victimCid]) {
      adjustRelation(state, PIRATE_SYNDICATE_ID, victimCid, -10, 'Ограбление каравана пиратами');
    }
    return {
      robbed: true,
      stolenItem: itemId,
      stolenQty: stolenQty,
      stolenCash: stolenCash,
      pirateLevel: ps.level,
      piratePower: ps.power
    };
  }

  function buyPirateImmunity(state, cid, durationTicks, nowTick) {
    ensureDiplomacyState(state);
    var ps = ensurePirateSyndicate(state);
    var comp = state.companies && state.companies[cid];
    var pComp = state.companies[PIRATE_SYNDICATE_ID];
    if (!comp) return { ok: false, reason: 'no_company' };
    var dur = Math.max(2400, Math.round(Number(durationTicks || 12000)));
    var cost = Math.max(180, Math.round((180 + ps.level * 45) * (dur / 12000)));
    if (comp.cash < cost) return { ok: false, reason: 'no_cash', cost: cost, cash: comp.cash };
    comp.cash -= cost;
    pComp.cash += cost;
    ps.cash = pComp.cash;
    var startTick = Math.max(Number(nowTick || 0), Number(comp.pirateImmunityUntilTick || 0));
    comp.pirateImmunityUntilTick = startTick + dur;
    return { ok: true, cost: cost, untilTick: comp.pirateImmunityUntilTick };
  }

  function buyPirateBlackMarketLoot(state, cid, itemId, qty) {
    ensureDiplomacyState(state);
    var ps = ensurePirateSyndicate(state);
    var comp = state.companies && state.companies[cid];
    var pComp = state.companies[PIRATE_SYNDICATE_ID];
    if (!comp) return { ok: false, reason: 'no_company' };
    var avail = Math.max(0, Number(ps.lootStash[itemId] || 0));
    if (avail <= 0) return { ok: false, reason: 'out_of_stock' };
    var take = Math.max(1, Math.min(avail, Math.round(Number(qty || avail))));
    var unitMarket = estimateItemUnitPrice(itemId);
    // Black market fenced loot sold at ~65% of market price
    var cost = Math.max(10, Math.round(unitMarket * take * 0.65));
    if (comp.cash < cost) return { ok: false, reason: 'no_cash', cost: cost, cash: comp.cash };
    comp.cash -= cost;
    pComp.cash += cost;
    ps.cash = pComp.cash;
    ps.lootStash[itemId] -= take;
    if (ps.lootStash[itemId] <= 0) delete ps.lootStash[itemId];
    if (!comp.stockBuffer) comp.stockBuffer = {};
    comp.stockBuffer[itemId] = Number(comp.stockBuffer[itemId] || 0) + take;
    return { ok: true, itemId: itemId, qty: take, cost: cost };
  }

  function orderPirateRaid(state, clientCid, targetCid, sx, sz, tier, nowTick, opts) {
    ensureDiplomacyState(state);
    var ps = ensurePirateSyndicate(state);
    var pComp = state.companies[PIRATE_SYNDICATE_ID];
    var client = state.companies && state.companies[clientCid];
    var target = state.companies && state.companies[targetCid];
    if (!client || !target || clientCid === targetCid || target.isPirate) {
      return { ok: false, reason: 'bad_company' };
    }
    var o = opts || {};
    var t = Math.max(1, Math.min(3, Math.round(Number(tier || 1))));
    var basePrice = t === 3 ? 750 : (t === 2 ? 450 : 250);
    var anonFee = o.anonymous ? Math.round(basePrice * 0.25) : 0;
    var cost = basePrice + anonFee;
    if (client.cash < cost) return { ok: false, reason: 'no_cash', cost: cost, cash: client.cash };

    client.cash -= cost;
    pComp.cash += Math.round(cost * 0.85);
    ps.cash = pComp.cash;

    var strength = Math.max(1, Math.min(5, t + Math.floor(ps.level / 3)));
    var mobRoster = strength >= 3
      ? ['minecraft:pillager', 'minecraft:vindicator', 'minecraft:ravager']
      : ['minecraft:pillager', 'minecraft:vindicator', 'minecraft:witch'];
    var raid = {
      id: 'raid_' + (state.nextMobRaidSeq++),
      attackerCid: PIRATE_SYNDICATE_ID,
      attackerName: o.anonymous ? 'Неизвестные Корсары' : ('Корсары (заказ ' + client.name + ')'),
      clientCid: clientCid,
      anonymous: !!o.anonymous,
      isPirateRaid: true,
      tier: t,
      targetCid: targetCid,
      targetName: target.name,
      sx: sx,
      sz: sz,
      dimension: o.dimension || 'minecraft:overworld',
      x: sx * SECTOR_SIZE,
      z: sz * SECTOR_SIZE,
      strength: strength,
      mobCount: 4 + strength * 2,
      mobRoster: mobRoster,
      spawnedInWorld: false,
      startedTick: Number(nowTick || 0),
      expiresTick: Number(nowTick || 0) + 5400,
      status: 'active'
    };
    state.activeMobRaids.push(raid);
    ps.ordersHistory.push({ raidId: raid.id, clientCid: clientCid, targetCid: targetCid, tier: t, cost: cost, tick: Number(nowTick || 0) });
    if (ps.ordersHistory.length > 30) ps.ordersHistory.shift();
    if (!o.anonymous) {
      adjustRelation(state, clientCid, targetCid, -25, 'Заказан пиратский набег на (' + sx + ',' + sz + ')');
    }
    evolvePirateSyndicate(state);
    return { ok: true, raid: raid, cost: cost, pirateLevel: ps.level };
  }

  function raidForeignCaravan(state, attackerCid, route, nowTick, rngFn) {
    ensureDiplomacyState(state);
    var attacker = state.companies && state.companies[attackerCid];
    if (!attacker || !route || route.companyId === attackerCid) return { ok: false, reason: 'bad_target' };
    var victim = state.companies[route.companyId];
    if (!victim) return { ok: false, reason: 'no_victim' };
    var rng = rngFn || Math.random;
    var raidCost = 80;
    if (attacker.cash < raidCost) return { ok: false, reason: 'no_cash', cost: raidCost };
    attacker.cash -= raidCost;

    var risk = route.escortEnabled ? 0.45 : 0.85;
    if (rng() > risk) {
      adjustRelation(state, attackerCid, victim.id, -15, 'Неудачная попытка ограбить караван');
      return { ok: true, robbed: false, reason: 'escort_repelled' };
    }
    var lootQty = Math.max(1, Math.round(Number(route.qtyPerRun || 8) * 0.50));
    var lootCash = Math.max(40, Math.round(Number((route.costProfile && route.costProfile.totalCashCost) || 60) * 1.5));
    var takeCash = Math.min(victim.cash, lootCash);
    victim.cash -= takeCash;
    attacker.cash += takeCash;
    if (route.itemId && route.itemId !== 'auto') {
      if (!attacker.stockBuffer) attacker.stockBuffer = {};
      attacker.stockBuffer[route.itemId] = Number(attacker.stockBuffer[route.itemId] || 0) + lootQty;
    }
    attacker.stats.raidsLaunched = (attacker.stats.raidsLaunched || 0) + 1;
    adjustRelation(state, attackerCid, victim.id, -30, 'Ограбление каравана ' + route.id);
    return { ok: true, robbed: true, lootCash: takeCash, lootQty: lootQty, itemId: route.itemId };
  }

  function resolveBotMobRaid(state, raidId, outcome) {
    ensureDiplomacyState(state);
    for (var i = 0; i < state.activeMobRaids.length; i++) {
      var r = state.activeMobRaids[i];
      if (!r || r.id !== raidId || r.status !== 'active') continue;
      if (outcome === 'defended') {
        r.status = 'defended';
        var defender = state.companies[r.targetCid];
        if (defender) defender.cash += 120 * r.strength;
        return { ok: true, status: 'defended', raid: r };
      }
      r.status = 'breached';
      var bldg = getSectorBuilding(state, r.sx, r.sz, r.dimension);
      if (bldg) damageBuildingIntegrity(state, r.sx, r.sz, 25 * r.strength, r.dimension);
      var k = sectorKey(r.sx, r.sz, r.dimension);
      var cl = state.claims[k];
      if (cl && cl.owner === r.targetCid) {
        if ((cl.strength || 1) > 1) cl.strength -= 1;
        else weakenOrCaptureSector(state, r.attackerCid, r.sx, r.sz, 1, 0, r.dimension);
      }
      if (r.isPirateRaid) {
        var ps = ensurePirateSyndicate(state);
        var pComp = state.companies[PIRATE_SYNDICATE_ID];
        var tgt = state.companies[r.targetCid];
        var lootCash = tgt ? Math.min(tgt.cash, 90 * r.strength) : 0;
        if (tgt && lootCash > 0) tgt.cash -= lootCash;
        pComp.cash += lootCash + 80;
        ps.cash = pComp.cash;
        ps.raidsCompleted += 1;
        if (bldg && bldg.stockBuffer) {
          Object.keys(bldg.stockBuffer).forEach(function (iid) {
            var q = Math.floor(Number(bldg.stockBuffer[iid] || 0) * 0.4);
            if (q > 0) {
              bldg.stockBuffer[iid] -= q;
              ps.lootStash[iid] = Number(ps.lootStash[iid] || 0) + q;
            }
          });
        }
        evolvePirateSyndicate(state);
      }
      return { ok: true, status: 'breached', raid: r };
    }
    return { ok: false, reason: 'not_found' };
  }

  function tickBotMobRaids(state, nowTick) {
    ensureDiplomacyState(state);
    var tick = Number(nowTick || 0);
    var resolved = [];
    for (var i = 0; i < state.activeMobRaids.length; i++) {
      var r = state.activeMobRaids[i];
      if (!r || r.status !== 'active') continue;
      if (tick >= r.expiresTick) {
        resolved.push(resolveBotMobRaid(state, r.id, 'breached'));
      }
    }
    return resolved;
  }

  function botExpandStep(state, maxSectorAbs, rngFn) {
    ensureBots(state, rngFn);
    state.botCycle = (state.botCycle || 0) + 1;
    var rng = rngFn || Math.random;
    var limit = Math.max(1, Math.floor(Number(maxSectorAbs || 1)));
    var events = [];
    var allBotIds = Object.keys(state.companies || {}).filter(function (cid) {
      return state.companies[cid] && state.companies[cid].isBot && !state.companies[cid].isPirate;
    });

    applyBotCatchupBalancing(state);
    var allowedCap = maxBotClaimsAllowed(state, limit, state.completedChapters || 0);
    var highPace = allowedCap > (countActiveBots(state) + countPlayerClaimsTotal(state));

    for (var i = 0; i < allBotIds.length; i++) {
      var bot = state.companies[allBotIds[i]];
      if (!bot) continue;
      var tMods = getCompanyTraitModifiers(bot);
      var arch = BOT_ARCHETYPES[bot.archetype] || BOT_ARCHETYPES.mining_syndicate;
      var ownedCount = countClaims(state, bot.id);
      var catchup = Number(bot.catchupBoost || 1.0);
      var income = Math.round((75 + ownedCount * 28) * tMods.incomeMult * catchup);
      bot.cash += income;
      bot.stats.deliveries += 1;

      // Bots try to construct/upgrade facilities on owned sectors when wealthy
      var botBldgs = listCompanyBuildings(state, bot.id);
      if (bot.cash >= 620 && botBldgs.length < Math.max(1, Math.min(4, Math.floor(ownedCount / 2) + 1))) {
        var bClaimKeys = Object.keys(state.claims || {});
        for (var bc = 0; bc < bClaimKeys.length; bc++) {
          var bcl = state.claims[bClaimKeys[bc]];
          if (!bcl || bcl.owner !== bot.id || bcl.isHq) continue;
          if (!getSectorBuilding(state, bcl.sx, bcl.sz, bcl.dimension)) {
            var bType = (arch.preferredBuildings && arch.preferredBuildings.length)
              ? arch.preferredBuildings[botBldgs.length % arch.preferredBuildings.length]
              : 'mine_shaft';
            var bRes = buildCompanyBuilding(state, bot.id, bcl.sx, bcl.sz, bType, null, null, null, { dimension: bcl.dimension });
            if (bRes.ok) {
              events.push({ type: 'bot_build', botId: bot.id, botName: bot.name, buildingType: bType, sx: bcl.sx, sz: bcl.sz });
              break;
            }
          }
        }
      } else if (botBldgs.length > 0 && bot.cash >= 900) {
        for (var ub = 0; ub < botBldgs.length; ub++) {
          var tgtB = botBldgs[ub];
          if ((tgtB.level || 1) < 3) {
            var uRes = upgradeCompanyBuilding(state, bot.id, tgtB.sx, tgtB.sz, null, tgtB.dimension);
            if (uRes.ok) {
              events.push({ type: 'bot_upgrade', botId: bot.id, botName: bot.name, buildingType: tgtB.type, level: uRes.level, sx: tgtB.sx, sz: tgtB.sz });
              break;
            }
          }
        }
      }

      // Aggressive bots may launch hostile mob raids against neighboring rivals/monopolists
      var raidThreshold = 0.08 * tMods.botAggressionMult * (arch.raidBias || 1.0);
      if (bot.cash >= 700 && (state.activeMobRaids || []).length < 4 && rng() < raidThreshold) {
        var monoList = getMonopolyMetrics(state);
        var monoTargetIds = {};
        for (var mi = 0; mi < monoList.length; mi++) {
          if (monoList[mi].isMonopolyTarget) monoTargetIds[monoList[mi].cid] = true;
        }
        var targetSector = null;
        var claimKeysR = Object.keys(state.claims || {});
        for (var rk = 0; rk < claimKeysR.length; rk++) {
          var rcl = state.claims[claimKeysR[rk]];
          if (!rcl || rcl.owner === bot.id || rcl.isHq) continue;
          if (hasPact(state, bot.id, rcl.owner) || isAllied(state, bot.id, rcl.owner)) continue;
          if (isAdjacentOwned(state, bot.id, rcl.sx, rcl.sz, rcl.dimension) || monoTargetIds[rcl.owner]) {
            targetSector = rcl;
            break;
          }
        }
        if (targetSector) {
          var raidRes = triggerBotMobRaid(state, bot.id, targetSector.owner, targetSector.sx, targetSector.sz, state.botCycle * 1000, { dimension: targetSector.dimension });
          if (raidRes.ok) {
            events.push({ type: 'bot_mob_raid', botId: bot.id, botName: bot.name, targetCid: targetSector.owner, sx: targetSector.sx, sz: targetSector.sz, raidId: raidRes.raid.id });
          }
        }
      }

      if (countBotClaimsTotal(state) >= allowedCap) {
        continue;
      }

      var claimsThisTick = highPace ? 2 : 1;
      for (var step = 0; step < claimsThisTick; step++) {
        if (countBotClaimsTotal(state) >= allowedCap) break;
        if (bot.cash < (highPace ? 320 : 650)) break;

        var candidates = [];
        var claimKeys = Object.keys(state.claims);
        var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (var k = 0; k < claimKeys.length; k++) {
          var cl = state.claims[claimKeys[k]];
          if (!cl || cl.owner !== bot.id) continue;
          if (cl.dimension && cl.dimension !== 'minecraft:overworld') continue;
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
        // Fallback: if all adjacent sectors are taken but open sectors remain inside map, pick a frontier unclaimed sector
        if (candidates.length === 0 && highPace) {
          for (var fx = -limit; fx <= limit && candidates.length < 16; fx++) {
            for (var fz = -limit; fz <= limit && candidates.length < 16; fz++) {
              if (isSpawnProtectedSector(fx, fz)) continue;
              if (!state.claims[sectorKey(fx, fz)]) candidates.push({ sx: fx, sz: fz });
            }
          }
        }
        if (candidates.length > 0) {
          var pick = candidates[Math.floor(rng() * candidates.length)];
          var res = claimOrCaptureSector(state, bot.id, pick.sx, pick.sz, false);
          if (res.ok) {
            events.push({ type: 'bot_claim', botId: bot.id, botName: bot.name, sx: pick.sx, sz: pick.sz, cost: res.cost });
          }
        }
      }
    }
    tickCompanyBuildings(state);
    tickCompanyUpkeep(state);
    return events;
  }

  function refreshBotOrders(state, rngFn) {
    ensureBots(state, rngFn);
    var rng = rngFn || Math.random;
    var kept = (state.marketOrders || []).filter(function (o) { return !o.isBot; });
    var allBots = Object.keys(state.companies || {}).filter(function (cid) {
      return state.companies[cid] && state.companies[cid].isBot && !state.companies[cid].isPirate;
    });

    for (var i = 0; i < allBots.length; i++) {
      var bid = allBots[i];
      var bot = state.companies[bid];
      if (!bot) continue;
      var tpl = BOT_ORDER_TEMPLATES[bid];
      if (tpl) {
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

      // Dynamic + default bots actively buy upgrade/input items needed for their facilities!
      var bldgs = listCompanyBuildings(state, bid);
      var upgradeNeeded = {};
      for (var bi = 0; bi < bldgs.length; bi++) {
        var bldg = bldgs[bi];
        var sp = BUILDING_CATALOG[bldg.type] || {};
        var upItems = sp.upgradeItems || { 'minecraft:iron_block': 4, 'minecraft:redstone_block': 2 };
        if ((bldg.level || 1) < 3) {
          Object.keys(upItems).forEach(function (uk) {
            upgradeNeeded[uk] = (upgradeNeeded[uk] || 0) + Number(upItems[uk] || 2);
          });
        }
        var reqIn = getBuildingRequiredInputs(bldg);
        Object.keys(reqIn).forEach(function (ik) {
          upgradeNeeded[ik] = (upgradeNeeded[ik] || 0) + Number(reqIn[ik] || 2) * 2;
        });
      }
      if (Object.keys(upgradeNeeded).length === 0) {
        upgradeNeeded['minecraft:iron_block'] = 4;
        upgradeNeeded['minecraft:redstone'] = 16;
      }
      var addedUpgradeOrders = 0;
      Object.keys(upgradeNeeded).forEach(function (itemId) {
        if (addedUpgradeOrders >= 3) return;
        var qty = Math.max(2, Math.min(32, Math.round(upgradeNeeded[itemId])));
        var unitP = estimateItemUnitPrice(itemId);
        kept.push({
          id: 'm' + (state.nextOrderSeq++),
          companyId: bid,
          isBot: true,
          purpose: 'facility_upgrade',
          side: 'buy',
          item: itemId,
          qty: qty,
          price: Math.max(30, Math.round(unitP * qty * (1.12 + rng() * 0.15))),
          remainingBatches: 3
        });
        addedUpgradeOrders++;
      });
    }
    state.marketOrders = kept;
    return kept.length;
  }

  // ---- Production Facility Auction Mini-Game ----
  function createFacilityAuction(state, sellerCid, sx, sz, startPrice, durationTicks, nowTick, opts) {
    ensureDiplomacyState(state);
    var o = opts || {};
    var dim = o.dimension ? (global.LHStructureProduction ? global.LHStructureProduction.normalizeDimension(o.dimension) : o.dimension) : 'minecraft:overworld';
    var b = getSectorBuilding(state, sx, sz, dim);
    if (!b || b.owner !== sellerCid) return { ok: false, reason: 'not_owned_building' };
    for (var i = 0; i < state.auctions.length; i++) {
      var ex = state.auctions[i];
      if (ex && ex.status === 'open' && ex.sx === sx && ex.sz === sz && (ex.dimension || 'minecraft:overworld') === dim) {
        return { ok: false, reason: 'already_on_auction', auction: ex };
      }
    }
    var sp = BUILDING_CATALOG[b.type] || {};
    var defaultStart = (b.playerValuation && Number(b.playerValuation) > 0)
      ? Math.max(100, Math.round(Number(b.playerValuation)))
      : Math.max(200, Math.round((Number(sp.cost || 400) * Number(b.level || 1)) * 0.75));
    var minPrice = Math.max(100, Math.round(Number(startPrice || defaultStart)));
    var dur = Math.max(400, Math.round(Number(durationTicks || 3600)));
    var tick = Math.round(Number(nowTick || 0));
    var auc = {
      id: 'auc_' + (state.nextAuctionSeq++),
      sellerCid: sellerCid,
      sx: sx,
      sz: sz,
      dimension: dim,
      buildingKey: b.key || sectorKey(sx, sz, dim),
      buildingType: b.type,
      buildingName: b.structureName || sp.name || b.type,
      buildingLevel: b.level || 1,
      rarityLabel: b.rarityLabel || null,
      startPrice: minPrice,
      currentBid: 0,
      minIncrement: Math.max(25, Math.round(minPrice * 0.10)),
      highestBidderCid: null,
      bidHistory: [],
      createdTick: tick,
      endsAtTick: tick + dur,
      buyoutPrice: o.buyoutPrice ? Math.max(minPrice * 2, Math.round(Number(o.buyoutPrice))) : null,
      assetType: 'building',
      isForcedDebtAuction: !!o.isForcedDebtAuction,
      debtReason: o.debtReason || null,
      status: 'open'
    };
    state.auctions.push(auc);
    return { ok: true, auction: auc };
  }

  function placeAuctionBid(state, auctionId, bidderCid, bidAmount, nowTick) {
    ensureDiplomacyState(state);
    var bidder = state.companies[bidderCid];
    if (!bidder) return { ok: false, reason: 'no_company' };
    var auc = null;
    for (var i = 0; i < state.auctions.length; i++) {
      if (state.auctions[i] && state.auctions[i].id === auctionId) { auc = state.auctions[i]; break; }
    }
    if (!auc || auc.status !== 'open') return { ok: false, reason: 'auction_closed' };
    if (auc.sellerCid === bidderCid) return { ok: false, reason: 'cannot_bid_own' };
    var amt = Math.round(Number(bidAmount || 0));
    var minReq = auc.highestBidderCid ? (auc.currentBid + auc.minIncrement) : auc.startPrice;
    if (amt < minReq) return { ok: false, reason: 'bid_too_low', minRequired: minReq };
    if (bidder.cash < amt) return { ok: false, reason: 'no_cash', required: amt, cash: bidder.cash };

    // Escrow bid: refund previous highest bidder, reserve new bidder's cash
    if (auc.highestBidderCid && state.companies[auc.highestBidderCid]) {
      state.companies[auc.highestBidderCid].cash += auc.currentBid;
    }
    bidder.cash -= amt;
    auc.currentBid = amt;
    auc.highestBidderCid = bidderCid;
    var tick = Math.round(Number(nowTick || 0));
    if (auc.endsAtTick - tick < 300) {
      auc.endsAtTick = tick + 300; // anti-snipe extension
    }
    auc.bidHistory.push({ bidderCid: bidderCid, amount: amt, tick: tick });
    if (auc.buyoutPrice && amt >= auc.buyoutPrice) {
      return settleAuction(state, auctionId);
    }
    return { ok: true, auction: auc, currentBid: amt, highestBidderCid: bidderCid };
  }

  function settleAuction(state, auctionId) {
    ensureDiplomacyState(state);
    var auc = null;
    for (var i = 0; i < state.auctions.length; i++) {
      if (state.auctions[i] && state.auctions[i].id === auctionId) { auc = state.auctions[i]; break; }
    }
    if (!auc || auc.status !== 'open') return { ok: false, reason: 'auction_closed' };

    var isSectorLot = auc.assetType === 'sector';
    var b = isSectorLot ? null : getSectorBuilding(state, auc.sx, auc.sz, auc.dimension);
    var cl = state.claims[sectorKey(auc.sx, auc.sz, auc.dimension)];
    var assetValid = isSectorLot ? !!(cl && cl.owner === auc.sellerCid) : !!b;

    if (!auc.highestBidderCid || !state.companies[auc.highestBidderCid] || !assetValid) {
      if (auc.highestBidderCid && state.companies[auc.highestBidderCid]) {
        state.companies[auc.highestBidderCid].cash += auc.currentBid;
      }
      auc.status = 'unsold';
      return { ok: true, sold: false, reason: assetValid ? 'no_bids' : 'asset_missing', auction: auc };
    }

    var seller = state.companies[auc.sellerCid];
    var buyer = state.companies[auc.highestBidderCid];
    var fee = Math.round(auc.currentBid * 0.05);
    var payout = Math.max(0, auc.currentBid - fee);
    var debtPaid = 0;
    if (seller) {
      seller.stats.tradeVolume = (seller.stats.tradeVolume || 0) + auc.currentBid;
      if (auc.isForcedDebtAuction) {
        var remPayout = payout;
        if (auc.debtReason === 'loan_default') {
          for (var li = 0; li < (state.loans || []).length && remPayout > 0; li++) {
            var ln = state.loans[li];
            if (ln && ln.companyId === seller.id && (ln.status === 'active' || ln.status === 'defaulted') && ln.remainingDebt > 0) {
              var payL = Math.min(remPayout, ln.remainingDebt);
              ln.remainingDebt -= payL;
              remPayout -= payL;
              debtPaid += payL;
              state.centralBank.totalRepaid = (state.centralBank.totalRepaid || 0) + payL;
              if (ln.remainingDebt <= 0) { ln.remainingDebt = 0; ln.status = 'repaid'; }
            }
          }
        }
        if (remPayout > 0 && (seller.unpaidUpkeep || 0) > 0) {
          var payTax = Math.min(remPayout, seller.unpaidUpkeep);
          seller.unpaidUpkeep -= payTax;
          remPayout -= payTax;
          debtPaid += payTax;
          if (seller.unpaidUpkeep <= 0) seller.taxDefaultCycles = 0;
        }
        seller.cash += remPayout;
      } else {
        seller.cash += payout;
      }
    }
    buyer.stats.tradeVolume = (buyer.stats.tradeVolume || 0) + auc.currentBid;
    if (b) b.owner = buyer.id;
    // Transfer sector claim ownership unless it's the seller's protected last HQ sector
    if (cl && cl.owner === auc.sellerCid && !wouldEliminatePlayerCompany(state, auc.sellerCid, cl)) {
      if (!cl.isHq || isSectorLot) {
        var wasHq = !!cl.isHq;
        cl.owner = buyer.id;
        cl.isHq = false;
        if (wasHq) relocateHqIfNeeded(state, auc.sellerCid);
      }
    }
    auc.status = 'sold';
    auc.finalPrice = auc.currentBid;
    auc.fee = fee;
    auc.payout = payout;
    auc.debtPaid = debtPaid;
    adjustRelation(state, auc.sellerCid, buyer.id, auc.isForcedDebtAuction ? 0 : 8, 'Успешный аукцион ' + auc.buildingName);
    return { ok: true, sold: true, buyerCid: buyer.id, sellerCid: auc.sellerCid, finalPrice: auc.currentBid, payout: payout, debtPaid: debtPaid, fee: fee, auction: auc };
  }

  function cancelFacilityAuction(state, auctionId, requesterCid) {
    ensureDiplomacyState(state);
    for (var i = 0; i < state.auctions.length; i++) {
      var auc = state.auctions[i];
      if (!auc || auc.id !== auctionId) continue;
      if (auc.status !== 'open') return { ok: false, reason: 'auction_closed' };
      if (auc.isForcedDebtAuction) return { ok: false, reason: 'forced_debt_auction' };
      if (requesterCid && auc.sellerCid !== requesterCid) return { ok: false, reason: 'not_seller' };
      if (auc.highestBidderCid && state.companies[auc.highestBidderCid]) {
        state.companies[auc.highestBidderCid].cash += auc.currentBid;
      }
      auc.status = 'cancelled';
      return { ok: true, auction: auc };
    }
    return { ok: false, reason: 'not_found' };
  }

  function tickAuctions(state, nowTick) {
    ensureDiplomacyState(state);
    var tick = Math.round(Number(nowTick || 0));
    var settled = [];
    for (var i = 0; i < state.auctions.length; i++) {
      var auc = state.auctions[i];
      if (!auc || auc.status !== 'open') continue;
      if (tick >= auc.endsAtTick) {
        settled.push(settleAuction(state, auc.id));
      }
    }
    return settled;
  }

  function renderAsciiMap(state, centerSx, centerSz, radius, dimension) {
    var r = radius > 0 ? radius : 3;
    var rows = [];
    for (var dz = -r; dz <= r; dz++) {
      var row = '';
      for (var dx = -r; dx <= r; dx++) {
        var sx = centerSx + dx;
        var sz = centerSz + dz;
        var info = resolveSectorOwner(state, sx, sz, dimension);
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
    COMPANY_ENV_TYPES: COMPANY_ENV_TYPES,
    TRANSPORT_SPECS: TRANSPORT_SPECS,
    RESOURCE_SPECS: RESOURCE_SPECS,
    BOT_ARCHETYPES: BOT_ARCHETYPES,
    COMPANY_TRAITS: COMPANY_TRAITS,
    DEFAULT_BOT_COMPANIES: DEFAULT_BOT_COMPANIES,
    BOT_ORDER_TEMPLATES: BOT_ORDER_TEMPLATES,
    BUILDING_CATALOG: BUILDING_CATALOG,
    BUILDING_VARIANTS: BUILDING_VARIANTS,
    PROGRESSIVE_TAX_BRACKETS: PROGRESSIVE_TAX_BRACKETS,
    FUEL_EQUIVALENTS: FUEL_EQUIVALENTS,
    PIRATE_SYNDICATE_ID: PIRATE_SYNDICATE_ID,
    MAX_PLAYER_EXTERNAL_SHARES: MAX_PLAYER_EXTERNAL_SHARES,
    ENDGAME_BUYOUT_CHAPTER_RATIO: ENDGAME_BUYOUT_CHAPTER_RATIO,
    getEndgameBuyoutStatus: getEndgameBuyoutStatus,
    resolveBuildingVariant: resolveBuildingVariant,
    setBuildingVariant: setBuildingVariant,
    setBuildingCustomProduct: setBuildingCustomProduct,
    setBuildingPlayerValuation: setBuildingPlayerValuation,
    getCompanyEnvType: getCompanyEnvType,
    setCompanyEnvType: setCompanyEnvType,
    preferredBuildingY: preferredBuildingY,
    getCompanyTerminalCoords: getCompanyTerminalCoords,
    rollCompanyTraits: rollCompanyTraits,
    getCompanyTraitModifiers: getCompanyTraitModifiers,
    formatCompanyTraits: formatCompanyTraits,
    minCompanyHqDistance: minCompanyHqDistance,
    sectorCoords: sectorCoords,
    sectorKey: sectorKey,
    sanitizeId: sanitizeId,
    createInitialState: createInitialState,
    ensureBots: ensureBots,
    ensureDiplomacyState: ensureDiplomacyState,
    ensurePirateSyndicate: ensurePirateSyndicate,
    hasPact: hasPact,
    togglePact: togglePact,
    countClaims: countClaims,
    countPlayerClaimsTotal: countPlayerClaimsTotal,
    countPlayerCompanies: countPlayerCompanies,
    countBotClaimsTotal: countBotClaimsTotal,
    countActiveBots: countActiveBots,
    getBotScalingDetails: getBotScalingDetails,
    maxBotClaimsAllowed: maxBotClaimsAllowed,
    spawnDynamicBotCompany: spawnDynamicBotCompany,
    onChapterCompletedBotSpawn: onChapterCompletedBotSpawn,
    applyBotCatchupBalancing: applyBotCatchupBalancing,
    getOperationalValuationBreakdown: getOperationalValuationBreakdown,
    getSharePrice: getSharePrice,
    getCompanyPortfolioDetails: getCompanyPortfolioDetails,
    buyCompanyShares: buyCompanyShares,
    sellCompanyShares: sellCompanyShares,
    getComebackStatus: getComebackStatus,
    activateComebackBailout: activateComebackBailout,
    selectDynamicSubsidyTarget: selectDynamicSubsidyTarget,
    getCompanyValuationBreakdown: getCompanyValuationBreakdown,
    computeValuation: computeValuation,
    resolveSectorOwner: resolveSectorOwner,
    isSpawnProtectedSector: isSpawnProtectedSector,
    isAdjacentOwned: isAdjacentOwned,
    minOwnedSectorDistance: minOwnedSectorDistance,
    computeClaimCost: computeClaimCost,
    companyCreate: companyCreate,
    companyJoin: companyJoin,
    companyLeave: companyLeave,
    companyMerge: companyMerge,
    setSpecialization: setSpecialization,
    claimOrCaptureSector: claimOrCaptureSector,
    weakenOrCaptureSector: weakenOrCaptureSector,
    transferSector: transferSector,
    antitrustSeize: antitrustSeize,
    fortifySector: fortifySector,
    botExpandStep: botExpandStep,
    refreshBotOrders: refreshBotOrders,
    triggerBotMobRaid: triggerBotMobRaid,
    resolveBotMobRaid: resolveBotMobRaid,
    tickBotMobRaids: tickBotMobRaids,
    evolvePirateSyndicate: evolvePirateSyndicate,
    computeCaravanPiracyRisk: computeCaravanPiracyRisk,
    interceptCaravanByPirates: interceptCaravanByPirates,
    buyPirateImmunity: buyPirateImmunity,
    buyPirateBlackMarketLoot: buyPirateBlackMarketLoot,
    orderPirateRaid: orderPirateRaid,
    raidForeignCaravan: raidForeignCaravan,
    createFacilityAuction: createFacilityAuction,
    createSectorAuction: createSectorAuction,
    enforceDebtAuctions: enforceDebtAuctions,
    placeAuctionBid: placeAuctionBid,
    settleAuction: settleAuction,
    cancelFacilityAuction: cancelFacilityAuction,
    tickAuctions: tickAuctions,
    renderAsciiMap: renderAsciiMap,
    getRelation: getRelation,
    getPlayerRelation: getPlayerRelation,
    adjustPlayerRelation: adjustPlayerRelation,
    getEffectiveRelationScore: getEffectiveRelationScore,
    getReputationPriceModifiers: getReputationPriceModifiers,
    getAverageBotReputationScore: getAverageBotReputationScore,
    syncPlayerReputationToCompany: syncPlayerReputationToCompany,
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
    syncStructureCatalog: syncStructureCatalog,
    recordSectorStructures: recordSectorStructures,
    getSectorStructures: getSectorStructures,
    convertStructureToFacility: convertStructureToFacility,
    buildCompanyBuilding: buildCompanyBuilding,
    upgradeCompanyBuilding: upgradeCompanyBuilding,
    damageBuildingIntegrity: damageBuildingIntegrity,
    repairBuildingIntegrity: repairBuildingIntegrity,
    getBuildingRequiredInputs: getBuildingRequiredInputs,
    getBuildingFuelRequirements: getBuildingFuelRequirements,
    getBuildingOptionalInputs: getBuildingOptionalInputs,
    supplyBuildingInputs: supplyBuildingInputs,
    getPowerPlantAdjacencyMultiplier: getPowerPlantAdjacencyMultiplier,
    isCompanySubsidized: isCompanySubsidized,
    getBuildingYieldProfile: getBuildingYieldProfile,
    getPatrolProfile: getPatrolProfile,
    findPatrolPostsCovering: findPatrolPostsCovering,
    tickCompanyBuildings: tickCompanyBuildings,
    collectBuildingOutput: collectBuildingOutput,
    getMonopolyMetrics: getMonopolyMetrics,
    joinAntiMonopolyCoalition: joinAntiMonopolyCoalition,
    leaveAntiMonopolyCoalition: leaveAntiMonopolyCoalition,
    getCoalitionModifiers: getCoalitionModifiers,
    computeProgressiveTaxForIncome: computeProgressiveTaxForIncome,
    computeCompanyExpenses: computeCompanyExpenses,
    attemptTaxEvasion: attemptTaxEvasion,
    updateCentralBankKeyRate: updateCentralBankKeyRate,
    getEffectiveLoanRate: getEffectiveLoanRate,
    getMaxLoanLimit: getMaxLoanLimit,
    getCompanyActiveDebt: getCompanyActiveDebt,
    takeBankLoan: takeBankLoan,
    repayBankLoan: repayBankLoan,
    tickBankLoans: tickBankLoans,
    tickCompanyUpkeep: tickCompanyUpkeep,
    calculateUpkeepAwareContractPrice: calculateUpkeepAwareContractPrice,
    createSupplyContract: createSupplyContract,
    createTimedSupplyContract: createTimedSupplyContract,
    tickSupplyContracts: tickSupplyContracts,
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

global.LHEconomyEngine = (function () {
  var CRASH_NET_SUPPLY_THRESHOLD = 80;
  var CRASH_DURATION_TICKS = 12;
  var CRASH_PRICE_MULT = 0.24;

  // Rarity & source metadata for base commodities:
  // kind: 'item' | 'fluid' | 'gas' | 'energy'
  // worldSpawn: 0..10 (10 = abundant surface block, 1 = ultra-rare ore/biome)
  // lootChest: 0..10 (10 = very common, 0 = never in chests, 1 = ultra-rare)
  // mobRarity: 0..10 (0 = not mob drop, 10 = boss/rare mob)
  // mobDropRate: 0..1 (1 = guaranteed, 0.05 = 5% drop)
  var BASE_COMMODITY_CATALOG = {
    'minecraft:cobblestone':        { name: 'Булыжник', kind: 'item', worldSpawn: 10, lootChest: 8, mobRarity: 0, mobDropRate: 0, floor: 1 },
    'minecraft:oak_log':            { name: 'Дубовое бревно', kind: 'item', worldSpawn: 9, lootChest: 7, mobRarity: 0, mobDropRate: 0, floor: 2 },
    'minecraft:coal':               { name: 'Уголь', kind: 'item', worldSpawn: 8, lootChest: 7, mobRarity: 2, mobDropRate: 0.4, floor: 4 },
    'minecraft:raw_copper':         { name: 'Сырая медь', kind: 'item', worldSpawn: 7, lootChest: 5, mobRarity: 0, mobDropRate: 0, floor: 7 },
    'minecraft:copper_ingot':       { name: 'Медный слиток', kind: 'item', worldSpawn: 7, lootChest: 6, mobRarity: 2, mobDropRate: 0.11, floor: 9 },
    'minecraft:raw_iron':           { name: 'Сырое железо', kind: 'item', worldSpawn: 6, lootChest: 5, mobRarity: 0, mobDropRate: 0, floor: 11 },
    'minecraft:iron_ingot':         { name: 'Железный слиток', kind: 'item', worldSpawn: 6, lootChest: 6, mobRarity: 3, mobDropRate: 0.08, floor: 14 },
    'minecraft:redstone':           { name: 'Красная пыль', kind: 'item', worldSpawn: 5, lootChest: 5, mobRarity: 3, mobDropRate: 0.5, floor: 12 },
    'minecraft:lapis_lazuli':       { name: 'Лазурит', kind: 'item', worldSpawn: 4, lootChest: 4, mobRarity: 0, mobDropRate: 0, floor: 18 },
    'minecraft:raw_gold':           { name: 'Сырое золото', kind: 'item', worldSpawn: 4, lootChest: 4, mobRarity: 0, mobDropRate: 0, floor: 24 },
    'minecraft:gold_ingot':         { name: 'Золотой слиток', kind: 'item', worldSpawn: 4, lootChest: 5, mobRarity: 4, mobDropRate: 0.12, floor: 30 },
    'minecraft:quartz':             { name: 'Кварц Незера', kind: 'item', worldSpawn: 5, lootChest: 4, mobRarity: 0, mobDropRate: 0, floor: 20 },
    'minecraft:diamond':            { name: 'Алмаз', kind: 'item', worldSpawn: 2, lootChest: 2, mobRarity: 0, mobDropRate: 0, floor: 85 },
    'minecraft:emerald':            { name: 'Изумруд', kind: 'item', worldSpawn: 2, lootChest: 3, mobRarity: 5, mobDropRate: 0.25, floor: 65 },
    'minecraft:ancient_debris':     { name: 'Древние обломки', kind: 'item', worldSpawn: 1, lootChest: 1, mobRarity: 0, mobDropRate: 0, floor: 260 },
    'minecraft:netherite_scrap':    { name: 'Незеритовый лом', kind: 'item', worldSpawn: 1, lootChest: 1, mobRarity: 0, mobDropRate: 0, floor: 290 },
    'minecraft:ender_pearl':        { name: 'Жемчуг Энда', kind: 'item', worldSpawn: 0, lootChest: 2, mobRarity: 5, mobDropRate: 0.5, floor: 42 },
    'minecraft:blaze_rod':          { name: 'Огненный стержень', kind: 'item', worldSpawn: 0, lootChest: 1, mobRarity: 6, mobDropRate: 0.5, floor: 68 },
    'minecraft:ghast_tear':         { name: 'Слеза гаста', kind: 'item', worldSpawn: 0, lootChest: 1, mobRarity: 7, mobDropRate: 0.4, floor: 95 },
    'minecraft:phantom_membrane':   { name: 'Мембрана фантома', kind: 'item', worldSpawn: 0, lootChest: 0, mobRarity: 5, mobDropRate: 0.5, floor: 46 },
    'minecraft:shulker_shell':      { name: 'Панцирь шалкера', kind: 'item', worldSpawn: 0, lootChest: 0, mobRarity: 8, mobDropRate: 0.5, floor: 155 },
    'minecraft:wither_skeleton_skull': { name: 'Череп визер-скелета', kind: 'item', worldSpawn: 0, lootChest: 0, mobRarity: 8, mobDropRate: 0.05, floor: 380 },
    'minecraft:nether_star':        { name: 'Звезда Незера', kind: 'item', worldSpawn: 0, lootChest: 0, mobRarity: 10, mobDropRate: 1.0, floor: 920 },
    'minecraft:golden_apple':       { name: 'Золотое яблоко', kind: 'item', worldSpawn: 0, lootChest: 3, mobRarity: 0, mobDropRate: 0, floor: 180 },
    'minecraft:enchanted_golden_apple': { name: 'Зачарованное золотое яблоко', kind: 'item', worldSpawn: 0, lootChest: 1, mobRarity: 0, mobDropRate: 0, floor: 780 },
    'minecraft:saddle':             { name: 'Седло', kind: 'item', worldSpawn: 0, lootChest: 3, mobRarity: 6, mobDropRate: 0.3, floor: 52 },
    'minecraft:name_tag':           { name: 'Бирка', kind: 'item', worldSpawn: 0, lootChest: 3, mobRarity: 0, mobDropRate: 0, floor: 48 },
    'create:andesite_alloy':        { name: 'Андезитовый сплав', kind: 'item', worldSpawn: 5, lootChest: 4, mobRarity: 0, mobDropRate: 0, floor: 18 },
    'create:brass_ingot':           { name: 'Латунный слиток', kind: 'item', worldSpawn: 3, lootChest: 2, mobRarity: 0, mobDropRate: 0, floor: 46 },
    'immersiveengineering:ingot_steel': { name: 'Стальной слиток', kind: 'item', worldSpawn: 3, lootChest: 2, mobRarity: 0, mobDropRate: 0, floor: 42 },
    'ae2:certus_quartz_crystal':    { name: 'Кристалл истинного кварца', kind: 'item', worldSpawn: 3, lootChest: 2, mobRarity: 0, mobDropRate: 0, floor: 36 },
    'longhaul:freight_crate':       { name: 'Грузовой контейнер', kind: 'item', worldSpawn: 0, lootChest: 2, mobRarity: 0, mobDropRate: 0, floor: 95 },
    'longhaul:transit_voucher':     { name: 'Транзитный ваучер', kind: 'item', worldSpawn: 0, lootChest: 2, mobRarity: 0, mobDropRate: 0, floor: 70 },
    // Fluids (per 1000 mB / 1 Bucket)
    'fluid:minecraft:water':        { name: 'Вода (1000 mB)', kind: 'fluid', worldSpawn: 10, lootChest: 0, mobRarity: 0, mobDropRate: 0, floor: 2 },
    'fluid:minecraft:lava':         { name: 'Лава (1000 mB)', kind: 'fluid', worldSpawn: 5, lootChest: 0, mobRarity: 0, mobDropRate: 0, floor: 26 },
    'fluid:minecraft:milk':         { name: 'Молоко (1000 mB)', kind: 'fluid', worldSpawn: 7, lootChest: 0, mobRarity: 1, mobDropRate: 1.0, floor: 14 },
    'fluid:immersivepetroleum:crudeoil': { name: 'Сырая нефть (1000 mB)', kind: 'fluid', worldSpawn: 2, lootChest: 0, mobRarity: 0, mobDropRate: 0, floor: 52 },
    'fluid:immersivepetroleum:diesel': { name: 'Дизель (1000 mB)', kind: 'fluid', worldSpawn: 0, lootChest: 0, mobRarity: 0, mobDropRate: 0, floor: 88 },
    'fluid:createdieselgenerators:biodiesel': { name: 'Биодизель (1000 mB)', kind: 'fluid', worldSpawn: 0, lootChest: 0, mobRarity: 0, mobDropRate: 0, floor: 76 },
    'fluid:nuclearcraft:heavy_water': { name: 'Тяжёлая вода (1000 mB)', kind: 'fluid', worldSpawn: 1, lootChest: 0, mobRarity: 0, mobDropRate: 0, floor: 135 },
    // Gases (per 1000 mB)
    'gas:mekanism:hydrogen':        { name: 'Водород (1000 mB)', kind: 'gas', worldSpawn: 0, lootChest: 0, mobRarity: 0, mobDropRate: 0, floor: 32 },
    'gas:mekanism:oxygen':          { name: 'Кислород (1000 mB)', kind: 'gas', worldSpawn: 0, lootChest: 0, mobRarity: 0, mobDropRate: 0, floor: 28 },
    'gas:nuclearcraft:steam':       { name: 'Пар высокого давления (1000 mB)', kind: 'gas', worldSpawn: 0, lootChest: 0, mobRarity: 0, mobDropRate: 0, floor: 24 },
    'gas:nuclearcraft:deuterium':   { name: 'Дейтерий (1000 mB)', kind: 'gas', worldSpawn: 0, lootChest: 0, mobRarity: 0, mobDropRate: 0, floor: 145 },
    'gas:electrodynamics:chlorine': { name: 'Хлор (1000 mB)', kind: 'gas', worldSpawn: 0, lootChest: 0, mobRarity: 0, mobDropRate: 0, floor: 64 },
    // Energy (per 10 kFE / 100 kFE)
    'energy:fe_10k':                { name: 'Электроэнергия (10 kFE)', kind: 'energy', worldSpawn: 0, lootChest: 0, mobRarity: 0, mobDropRate: 0, floor: 14 },
    'energy:fe_100k':               { name: 'Электроэнергия (100 kFE)', kind: 'energy', worldSpawn: 0, lootChest: 0, mobRarity: 0, mobDropRate: 0, floor: 128 }
  };

  function inferCommodityKind(id) {
    var s = String(id || '');
    if (s.indexOf('fluid:') === 0) return 'fluid';
    if (s.indexOf('gas:') === 0) return 'gas';
    if (s.indexOf('energy:') === 0) return 'energy';
    return 'item';
  }

  function computeRarityScorePrice(meta) {
    if (!meta) return 20;
    var base = Number(meta.floor || 10);
    var ws = Number(meta.worldSpawn || 0);
    var lc = Number(meta.lootChest || 0);
    var mr = Number(meta.mobRarity || 0);
    var mdr = Number(meta.mobDropRate || 0);

    var rarityBonus = 0;
    if (ws > 0) rarityBonus += Math.max(0, (10 - ws) * 4);
    else if (lc > 0) rarityBonus += Math.max(0, (8 - lc) * 7);
    if (mr > 0) {
      var dropMult = mdr > 0 ? Math.min(8, 1 / Math.max(0.05, mdr)) : 1;
      rarityBonus += Math.round(mr * 5 * Math.sqrt(dropMult));
    }
    return Math.max(1, Math.round(Math.max(base, base * 0.7 + rarityBonus)));
  }

  function inferFallbackBasePrice(id) {
    var s = String(id || '').toLowerCase();
    var meta = BASE_COMMODITY_CATALOG[s];
    if (meta) return computeRarityScorePrice(meta);

    var p = 18;
    if (s.indexOf('fluid:') === 0) p = 30;
    else if (s.indexOf('gas:') === 0) p = 48;
    else if (s.indexOf('energy:') === 0) p = 16;

    if (s.indexOf('draconicevolution:') === 0 || s.indexOf('awakened') !== -1) p = 320;
    else if (s.indexOf('nuclearcraft:') === 0 || s.indexOf('nuclearscience:') === 0 || s.indexOf('bigreactors:') === 0) p = 110;
    else if (s.indexOf('electrodynamics:') === 0 || s.indexOf('mekanism:') === 0) p = 85;
    else if (s.indexOf('ae2:') === 0 || s.indexOf('pneumaticcraft:') === 0) p = 64;
    else if (s.indexOf('immersive') === 0 || s.indexOf('create:') === 0 || s.indexOf('tfmg:') === 0) p = 34;

    if (s.indexOf('netherite') !== -1 || s.indexOf('nether_star') !== -1 || s.indexOf('dragon') !== -1) p = Math.max(p, 280);
    else if (s.indexOf('diamond') !== -1 || s.indexOf('uranium') !== -1 || s.indexOf('plutonium') !== -1) p = Math.max(p, 95);
    else if (s.indexOf('steel') !== -1 || s.indexOf('titanium') !== -1 || s.indexOf('processor') !== -1) p = Math.max(p, 52);
    else if (s.indexOf('block') !== -1) p = Math.round(p * 1.4);
    else if (s.indexOf('nugget') !== -1) p = Math.max(1, Math.round(p * 0.15));
    return Math.max(1, Math.round(p));
  }

  var _cachedRecipeEdges = [];
  var _lastActiveEconState = null;

  function createInitialEconomyState() {
    return {
      items: {},
      adminOverrides: {},
      playerPrices: {},
      recipePrices: {},
      pureRecipePrices: {},
      listings: [],
      pickupOrders: [],
      nextListingSeq: 1,
      nextPickupSeq: 1,
      traderSeed: 1,
      totalCrashes: 0
    };
  }

  function ensureEconomyState(st) {
    if (!st) return createInitialEconomyState();
    if (!st.items) st.items = {};
    if (!st.adminOverrides) st.adminOverrides = {};
    if (!st.playerPrices) st.playerPrices = {};
    if (!st.recipePrices) st.recipePrices = {};
    if (!st.pureRecipePrices) st.pureRecipePrices = {};
    if (!st.listings) st.listings = [];
    if (!st.pickupOrders) st.pickupOrders = [];
    if (!st.nextListingSeq) st.nextListingSeq = 1;
    if (!st.nextPickupSeq) st.nextPickupSeq = 1;
    if (typeof st.totalCrashes !== 'number') st.totalCrashes = 0;
    _lastActiveEconState = st;
    return st;
  }

  function solveGraphWithAdminPins(st, edges, purePrices) {
    ensureEconomyState(st);
    var prices = {};
    Object.keys(purePrices || {}).forEach(function (k) {
      prices[k] = Number(purePrices[k]);
    });

    // Collect hard admin pins (never overwritten by propagation or each other)
    var pins = {};
    var pinList = [];
    Object.keys(st.adminOverrides || {}).forEach(function (aid) {
      var ov = st.adminOverrides[aid];
      if (ov && ov.locked && Number(ov.price) > 0) {
        var pVal = Math.max(1, Math.round(Number(ov.price)));
        pins[aid] = pVal;
        prices[aid] = pVal;
        pinList.push(aid);
      }
    });

    if (pinList.length === 0 || !edges || !edges.length) {
      st.recipePrices = prices;
      return { prices: prices, affectedItems: [] };
    }

    // Build bidirectional recipe adjacency
    var edgesByOut = {};
    var edgesByIng = {};
    var adj = {};
    function linkAdj(a, b) {
      if (!a || !b || a === b) return;
      if (!adj[a]) adj[a] = [];
      if (adj[a].indexOf(b) === -1) adj[a].push(b);
    }

    for (var i = 0; i < edges.length; i++) {
      var e = edges[i];
      if (!e || !e.outId || !e.ingredients || !e.ingredients.length) continue;
      if (!edgesByOut[e.outId]) edgesByOut[e.outId] = [];
      edgesByOut[e.outId].push(e);
      if (!prices[e.outId]) prices[e.outId] = inferFallbackBasePrice(e.outId);
      for (var j = 0; j < e.ingredients.length; j++) {
        var ing = e.ingredients[j];
        if (!ing || !ing.id) continue;
        if (!edgesByIng[ing.id]) edgesByIng[ing.id] = [];
        edgesByIng[ing.id].push(e);
        if (!prices[ing.id]) prices[ing.id] = inferFallbackBasePrice(ing.id);
        linkAdj(e.outId, ing.id);
        linkAdj(ing.id, e.outId);
        for (var k = 0; k < e.ingredients.length; k++) {
          if (k !== j && e.ingredients[k] && e.ingredients[k].id) {
            linkAdj(ing.id, e.ingredients[k].id);
          }
        }
      }
    }

    // Multi-source BFS from ALL admin pins simultaneously so distance is symmetric and order-independent
    var distPin = {};
    var queue = [];
    for (var pIdx = 0; pIdx < pinList.length; pIdx++) {
      var pid = pinList[pIdx];
      distPin[pid] = 0;
      queue.push(pid);
    }
    var qHead = 0;
    var activeNodes = [];
    while (qHead < queue.length) {
      var cur = queue[qHead++];
      var curD = distPin[cur];
      if (curD >= 8) continue;
      var nbrs = adj[cur] || [];
      for (var ni = 0; ni < nbrs.length; ni++) {
        var nb = nbrs[ni];
        if (distPin[nb] === undefined) {
          distPin[nb] = curD + 1;
          queue.push(nb);
          if (!pins[nb]) activeNodes.push(nb);
        }
      }
    }

    if (activeNodes.length === 0) {
      st.recipePrices = prices;
      return { prices: prices, affectedItems: [] };
    }

    // Baseline pure prices snapshot (fallback for unknown nodes)
    var baseSnap = {};
    Object.keys(prices).forEach(function (k) {
      baseSnap[k] = Math.max(1, Number(purePrices[k] || prices[k] || inferFallbackBasePrice(k)));
    });

    // Iterative conflict-free log-linear harmonic relaxation with Dirichlet boundary pins
    var MAX_ITERS = 12;
    for (var iter = 0; iter < MAX_ITERS; iter++) {
      var nextVals = {};
      for (var ai = 0; ai < activeNodes.length; ai++) {
        var u = activeNodes[ai];
        if (pins[u]) continue;
        var logSum = 0;
        var wSum = 0;
        var uBase = baseSnap[u] || 10;

        // 1. Upward pull: u is output of recipes
        var outEdges = edgesByOut[u] || [];
        for (var oe = 0; oe < outEdges.length; oe++) {
          var er = outEdges[oe];
          var outC = Math.max(1, Number(er.outCount || 1));
          var ingCost = 0;
          var minIngD = 99;
          for (var ii = 0; ii < er.ingredients.length; ii++) {
            var ig = er.ingredients[ii];
            if (!ig || !ig.id) continue;
            var cnt = Math.max(1, Number(ig.count || 1));
            ingCost += (prices[ig.id] || baseSnap[ig.id] || 10) * cnt;
            if (distPin[ig.id] !== undefined && distPin[ig.id] < minIngD) minIngD = distPin[ig.id];
          }
          if (ingCost > 0 && minIngD < 99) {
            var candUp = Math.max(1, Math.min(500000, (ingCost / outC) * 1.12));
            var wUp = 1.0 / (1.0 + minIngD * 0.5);
            logSum += wUp * Math.log(candUp);
            wSum += wUp;
          }
        }

        // 2. Downward & parallel pull: u is ingredient in recipes
        var inEdges = edgesByIng[u] || [];
        for (var ie = 0; ie < inEdges.length; ie++) {
          var er2 = inEdges[ie];
          var outId = er2.outId;
          var outC2 = Math.max(1, Number(er2.outCount || 1));
          var outD = distPin[outId];
          var uCount = 1;
          var lockedIngCost = 0;
          var freeBaseSum = 0;
          var bestSibDist = 99;
          var sibRatioLogSum = 0;
          var sibRatioW = 0;

          for (var jj = 0; jj < er2.ingredients.length; jj++) {
            var ig2 = er2.ingredients[jj];
            if (!ig2 || !ig2.id) continue;
            var cnt2 = Math.max(1, Number(ig2.count || 1));
            if (ig2.id === u) uCount += (cnt2 - 1);
            if (pins[ig2.id]) {
              lockedIngCost += pins[ig2.id] * cnt2;
            } else {
              freeBaseSum += (baseSnap[ig2.id] || 10) * cnt2;
            }
            if (ig2.id !== u && distPin[ig2.id] !== undefined && distPin[ig2.id] <= distPin[u]) {
              var sRatio = Math.max(0.25, Math.min(4.0, (prices[ig2.id] || baseSnap[ig2.id]) / Math.max(1, baseSnap[ig2.id])));
              var sw = 1.0 / (1.0 + distPin[ig2.id] * 0.7);
              sibRatioLogSum += sw * Math.log(sRatio);
              sibRatioW += sw;
              if (distPin[ig2.id] < bestSibDist) bestSibDist = distPin[ig2.id];
            }
          }

          // Downward propagation from output price (especially strong when output is pinned or closer to a pin)
          if (outD !== undefined && outD <= distPin[u]) {
            var targetIngBudget = Math.max(1, ((prices[outId] || baseSnap[outId]) * outC2) / 1.12);
            var freeBudget = Math.max(1, targetIngBudget - lockedIngCost);
            var share = Math.max(0.05, ((uBase * uCount) / Math.max(1, freeBaseSum)));
            var candDown = Math.max(1, Math.min(500000, (freeBudget * share) / Math.max(1, uCount)));
            var wDown = (pins[outId] ? 1.15 : 0.75) / (1.0 + outD * 0.55);
            logSum += wDown * Math.log(candDown);
            wSum += wDown;
          }

          // Parallel propagation between sibling ingredients in the same recipe (when output is not strictly pinned against it)
          if (sibRatioW > 0 && !pins[outId]) {
            var avgSibRatio = Math.exp(sibRatioLogSum / sibRatioW);
            var candPar = Math.max(1, Math.min(500000, uBase * Math.pow(avgSibRatio, 0.65)));
            var wPar = 0.45 / (1.0 + bestSibDist * 0.65);
            logSum += wPar * Math.log(candPar);
            wSum += wPar;
          }
        }

        // Mild anchor toward pure base for nodes far away from any pin
        var anchorW = Math.min(0.45, 0.06 * (distPin[u] || 1));
        logSum += anchorW * Math.log(uBase);
        wSum += anchorW;

        if (wSum > 0) {
          nextVals[u] = Math.max(1, Math.min(500000, Math.round(Math.exp(logSum / wSum))));
        }
      }
      Object.keys(nextVals).forEach(function (uk) {
        prices[uk] = nextVals[uk];
      });
    }

    // Enforce exact admin pin values (zero conflict guarantee)
    for (var pk = 0; pk < pinList.length; pk++) {
      prices[pinList[pk]] = pins[pinList[pk]];
    }

    var affectedItems = [];
    for (var ai2 = 0; ai2 < activeNodes.length; ai2++) {
      var nId = activeNodes[ai2];
      if (prices[nId] !== baseSnap[nId]) {
        affectedItems.push({ id: nId, oldPrice: baseSnap[nId], newPrice: prices[nId] });
      }
    }
    st.recipePrices = prices;
    return { prices: prices, affectedItems: affectedItems };
  }

  function propagateRecipePrices(st, recipeEdges, maxPasses) {
    ensureEconomyState(st);
    var passes = Math.max(1, Math.min(8, Number(maxPasses || 5)));
    var prices = {};
    Object.keys(BASE_COMMODITY_CATALOG).forEach(function (cid) {
      prices[cid] = computeRarityScorePrice(BASE_COMMODITY_CATALOG[cid]);
    });
    Object.keys(st.pureRecipePrices || {}).forEach(function (k) {
      if (Number(st.pureRecipePrices[k]) > 0 && !prices[k]) prices[k] = Number(st.pureRecipePrices[k]);
    });

    var edges = (recipeEdges && typeof recipeEdges !== 'string' && typeof recipeEdges.length === 'number')
      ? recipeEdges
      : (_cachedRecipeEdges.length ? _cachedRecipeEdges : (st._recipeEdges || []));
    if (recipeEdges && typeof recipeEdges.length === 'number' && recipeEdges.length > 0) {
      _cachedRecipeEdges = recipeEdges;
      if (recipeEdges.length <= 400) st._recipeEdges = recipeEdges;
    }

    for (var pass = 0; pass < passes; pass++) {
      var changed = false;
      for (var i = 0; i < edges.length; i++) {
        var e = edges[i];
        if (!e || !e.outId || !e.ingredients || typeof e.ingredients.length !== 'number' || !e.ingredients.length) continue;
        var outCount = Math.max(1, Number(e.outCount || 1));
        var ingSum = 0;
        for (var j = 0; j < e.ingredients.length; j++) {
          var ing = e.ingredients[j];
          if (!ing || !ing.id) continue;
          var cnt = Math.max(1, Number(ing.count || 1));
          var unitP = prices[ing.id] || inferFallbackBasePrice(ing.id);
          ingSum += unitP * cnt;
        }
        if (ingSum <= 0) continue;
        var craftUnit = Math.max(1, Math.round((ingSum / outCount) * 1.12));
        var floorP = BASE_COMMODITY_CATALOG[e.outId]
          ? computeRarityScorePrice(BASE_COMMODITY_CATALOG[e.outId])
          : 1;
        var nextP = Math.max(floorP, craftUnit);
        if (nextP > 250000) nextP = 250000;
        if (!prices[e.outId] || Math.abs(prices[e.outId] - nextP) >= 1) {
          if (!prices[e.outId] || nextP < prices[e.outId] || pass === 0) {
            prices[e.outId] = nextP;
            changed = true;
          }
        }
      }
      if (!changed) break;
    }
    st.pureRecipePrices = prices;
    var solved = solveGraphWithAdminPins(st, edges, prices);
    st._lastAffectedCount = solved.affectedItems.length;
    return st.recipePrices;
  }

  function recalculateWithPins(st) {
    ensureEconomyState(st);
    var edges = _cachedRecipeEdges.length ? _cachedRecipeEdges : (st._recipeEdges || []);
    if (!Object.keys(st.pureRecipePrices || {}).length && edges.length > 0) {
      return propagateRecipePrices(st, edges, 4);
    }
    var solved = solveGraphWithAdminPins(st, edges, st.pureRecipePrices || st.recipePrices || {});
    st._lastAffectedCount = solved.affectedItems.length;
    return solved;
  }

  function getCommodityState(st, itemId) {
    ensureEconomyState(st);
    var id = String(itemId || '');
    if (!st.items[id]) {
      st.items[id] = {
        supply: 0,
        demand: 0,
        crashTicks: 0,
        crashCount: 0,
        volumeTraded: 0
      };
    }
    return st.items[id];
  }

  function getBasePrice(st, itemId) {
    ensureEconomyState(st);
    var id = String(itemId || '');
    var ov = st.adminOverrides && st.adminOverrides[id];
    if (ov && ov.locked && Number(ov.price) > 0) return Number(ov.price);
    if (st.recipePrices && st.recipePrices[id] > 0) return Number(st.recipePrices[id]);
    if (st.playerPrices && st.playerPrices[id] && Number(st.playerPrices[id].price) > 0) {
      return Number(st.playerPrices[id].price);
    }
    return inferFallbackBasePrice(id);
  }

  function getLiveCachedPrice(itemId) {
    if (_lastActiveEconState) {
      var id = String(itemId || '');
      var ov = _lastActiveEconState.adminOverrides && _lastActiveEconState.adminOverrides[id];
      if (ov && ov.locked && Number(ov.price) > 0) return Math.round(Number(ov.price));
      if (_lastActiveEconState.recipePrices && _lastActiveEconState.recipePrices[id] > 0) {
        return Math.round(Number(_lastActiveEconState.recipePrices[id]));
      }
      if (_lastActiveEconState.playerPrices && _lastActiveEconState.playerPrices[id] && Number(_lastActiveEconState.playerPrices[id].price) > 0) {
        return Math.round(Number(_lastActiveEconState.playerPrices[id].price));
      }
    }
    return inferFallbackBasePrice(itemId);
  }

  function getMarketQuote(st, itemId) {
    ensureEconomyState(st);
    var id = String(itemId || '');
    var recipeBase = (st.recipePrices && st.recipePrices[id] > 0)
      ? Number(st.recipePrices[id])
      : inferFallbackBasePrice(id);
    var playerEntry = st.playerPrices && st.playerPrices[id];
    var basePrice = (playerEntry && Number(playerEntry.price) > 0)
      ? Math.max(1, Math.round(Number(playerEntry.price)))
      : recipeBase;
    var ov = st.adminOverrides && st.adminOverrides[id];
    var cs = getCommodityState(st, id);

    if (ov && ov.locked && Number(ov.price) > 0) {
      return {
        itemId: id,
        kind: inferCommodityKind(id),
        basePrice: basePrice,
        recipeBasePrice: recipeBase,
        price: Math.max(1, Math.round(Number(ov.price))),
        multiplier: Number((Number(ov.price) / Math.max(1, basePrice)).toFixed(2)),
        crashed: false,
        crashTicks: 0,
        adminLocked: true,
        playerPriced: false,
        supply: cs.supply,
        demand: cs.demand
      };
    }

    var netPressure = Number(cs.demand || 0) - Number(cs.supply || 0);
    // Smooth logarithmic/atan-like supply-demand curve between 0.45x and 2.40x
    var sdMult = 1.0 + Math.max(-0.55, Math.min(1.40, netPressure / 110.0));
    var crashed = Number(cs.crashTicks || 0) > 0;
    var finalMult = crashed ? Math.min(CRASH_PRICE_MULT, sdMult * 0.45) : sdMult;
    var price = Math.max(1, Math.round(basePrice * finalMult));

    if (ov) {
      if (Number(ov.minPrice) > 0) price = Math.max(Math.round(ov.minPrice), price);
      if (Number(ov.maxPrice) > 0) price = Math.min(Math.round(ov.maxPrice), price);
    }

    return {
      itemId: id,
      kind: inferCommodityKind(id),
      basePrice: basePrice,
      recipeBasePrice: recipeBase,
      price: price,
      multiplier: Number((price / Math.max(1, basePrice)).toFixed(2)),
      crashed: crashed,
      crashTicks: Number(cs.crashTicks || 0),
      adminLocked: false,
      playerPriced: !!(playerEntry && Number(playerEntry.price) > 0),
      playerPriceBy: playerEntry ? playerEntry.by : null,
      supply: Number(cs.supply || 0),
      demand: Number(cs.demand || 0)
    };
  }

  function recordTradePressure(st, itemId, side, qty) {
    ensureEconomyState(st);
    var id = String(itemId || '');
    var q = Math.max(1, Math.round(Number(qty || 1)));
    var cs = getCommodityState(st, id);
    cs.volumeTraded = (cs.volumeTraded || 0) + q;
    var crashedJustNow = false;

    if (side === 'sell') {
      cs.supply = Number(cs.supply || 0) + q;
      var netOversupply = cs.supply - Number(cs.demand || 0);
      if (netOversupply >= CRASH_NET_SUPPLY_THRESHOLD && cs.crashTicks <= 0) {
        cs.crashTicks = CRASH_DURATION_TICKS;
        cs.crashCount = (cs.crashCount || 0) + 1;
        st.totalCrashes = (st.totalCrashes || 0) + 1;
        crashedJustNow = true;
      }
    } else if (side === 'buy') {
      cs.demand = Number(cs.demand || 0) + q;
    }
    var qAfter = getMarketQuote(st, id);
    return {
      crashedJustNow: crashedJustNow,
      quote: qAfter
    };
  }

  function decayMarketTick(st) {
    ensureEconomyState(st);
    var keys = Object.keys(st.items);
    var recovered = [];
    for (var i = 0; i < keys.length; i++) {
      var id = keys[i];
      var cs = st.items[id];
      cs.supply = Math.max(0, Math.floor(Number(cs.supply || 0) * 0.85));
      cs.demand = Math.max(0, Math.floor(Number(cs.demand || 0) * 0.85));
      if (cs.crashTicks > 0) {
        cs.crashTicks--;
        if (cs.crashTicks === 0) recovered.push(id);
      }
    }
    return recovered;
  }

  function setAdminPrice(st, itemId, price) {
    ensureEconomyState(st);
    var id = String(itemId || '');
    var p = Math.max(1, Math.round(Number(price || 1)));
    st.adminOverrides[id] = { price: p, locked: true, minPrice: 0, maxPrice: 0 };
    var solved = recalculateWithPins(st);
    var q = getMarketQuote(st, id);
    q.propagatedCount = (solved && solved.affectedItems) ? solved.affectedItems.length : 0;
    return q;
  }

  function setAdminBounds(st, itemId, minPrice, maxPrice) {
    ensureEconomyState(st);
    var id = String(itemId || '');
    var mn = Math.max(1, Math.round(Number(minPrice || 1)));
    var mx = Math.max(mn, Math.round(Number(maxPrice || mn)));
    st.adminOverrides[id] = { price: 0, locked: false, minPrice: mn, maxPrice: mx };
    return getMarketQuote(st, id);
  }

  function clearAdminPrice(st, itemId) {
    ensureEconomyState(st);
    var id = String(itemId || '');
    delete st.adminOverrides[id];
    var solved = recalculateWithPins(st);
    var q = getMarketQuote(st, id);
    q.propagatedCount = (solved && solved.affectedItems) ? solved.affectedItems.length : 0;
    return q;
  }

  function setPlayerItemPrice(st, itemId, price, actorName, nowTick) {
    ensureEconomyState(st);
    var id = String(itemId || '');
    if (!id || id === 'minecraft:air') return { ok: false, reason: 'bad_item' };
    var ov = st.adminOverrides && st.adminOverrides[id];
    if (ov && ov.locked) return { ok: false, reason: 'admin_locked', quote: getMarketQuote(st, id) };
    var p = Math.max(1, Math.min(1000000, Math.round(Number(price || 1))));
    st.playerPrices[id] = {
      price: p,
      by: String(actorName || 'player'),
      updatedTick: Number(nowTick || 0)
    };
    return { ok: true, quote: getMarketQuote(st, id) };
  }

  function clearPlayerItemPrice(st, itemId) {
    ensureEconomyState(st);
    var id = String(itemId || '');
    delete st.playerPrices[id];
    return { ok: true, quote: getMarketQuote(st, id) };
  }

  function forceCrash(st, itemId, ticks) {
    ensureEconomyState(st);
    var id = String(itemId || '');
    var cs = getCommodityState(st, id);
    cs.crashTicks = Math.max(1, Math.round(Number(ticks || CRASH_DURATION_TICKS)));
    cs.supply = Math.max(cs.supply, CRASH_NET_SUPPLY_THRESHOLD + 16);
    cs.crashCount = (cs.crashCount || 0) + 1;
    st.totalCrashes = (st.totalCrashes || 0) + 1;
    return getMarketQuote(st, id);
  }

  // Physical Facility Trading (Owner lists at facility with custom price + market reference;
  // buyer must physically visit facility coordinates to pick up purchased cargo)
  function createFacilityListing(st, sellerCid, building, itemId, qty, customUnitPrice) {
    ensureEconomyState(st);
    if (!sellerCid || !building) return { ok: false, reason: 'no_facility' };
    var q = Math.max(1, Math.round(Number(qty || 1)));
    var unitP = Math.max(1, Math.round(Number(customUnitPrice || 1)));
    var quote = getMarketQuote(st, itemId);
    var listing = {
      id: 'L' + (st.nextListingSeq++),
      sellerCid: sellerCid,
      buildingId: building.id,
      buildingType: building.type,
      sx: building.sx,
      sz: building.sz,
      x: Number(building.x || building.sx * 256),
      y: Number(building.y || 64),
      z: Number(building.z || building.sz * 256),
      itemId: String(itemId),
      kind: inferCommodityKind(itemId),
      qtyAvailable: q,
      unitPrice: unitP,
      marketPriceSnapshot: quote.price,
      status: 'open'
    };
    st.listings.push(listing);
    return { ok: true, listing: listing, marketQuote: quote };
  }

  function buyFacilityListing(ottdState, econState, buyerCid, listingId, qty) {
    ensureEconomyState(econState);
    var buyer = ottdState.companies && ottdState.companies[buyerCid];
    if (!buyer) return { ok: false, reason: 'no_buyer_company' };
    var listing = null;
    for (var i = 0; i < econState.listings.length; i++) {
      if (econState.listings[i].id === listingId && econState.listings[i].status === 'open') {
        listing = econState.listings[i];
        break;
      }
    }
    if (!listing) return { ok: false, reason: 'not_found' };
    if (listing.sellerCid === buyerCid) return { ok: false, reason: 'own_listing' };
    var seller = ottdState.companies && ottdState.companies[listing.sellerCid];
    if (!seller) return { ok: false, reason: 'no_seller' };
    var q = Math.max(1, Math.min(listing.qtyAvailable, Math.round(Number(qty || 1))));
    var repScore = (global.LHOpenTTD && global.LHOpenTTD.getEffectiveRelationScore)
      ? global.LHOpenTTD.getEffectiveRelationScore(ottdState, buyerCid, null, listing.sellerCid)
      : 0;
    var repPricing = (global.LHOpenTTD && global.LHOpenTTD.getReputationPriceModifiers)
      ? global.LHOpenTTD.getReputationPriceModifiers(repScore)
      : { score: 0, buyMult: 1.0, sellMult: 1.0 };
    var totalPrice = Math.max(1, Math.round(q * listing.unitPrice * repPricing.buyMult));
    if (buyer.cash < totalPrice) return { ok: false, reason: 'no_cash', cost: totalPrice, cash: buyer.cash, repMult: repPricing.buyMult };

    buyer.cash -= totalPrice;
    seller.cash += totalPrice;
    buyer.stats.tradeVolume = (buyer.stats.tradeVolume || 0) + totalPrice;
    seller.stats.tradeVolume = (seller.stats.tradeVolume || 0) + totalPrice;

    listing.qtyAvailable -= q;
    if (listing.qtyAvailable <= 0) listing.status = 'sold_out';

    recordTradePressure(econState, listing.itemId, 'buy', q);

    var order = {
      id: 'P' + (econState.nextPickupSeq++),
      listingId: listing.id,
      buyerCid: buyerCid,
      sellerCid: listing.sellerCid,
      buildingId: listing.buildingId,
      sx: listing.sx,
      sz: listing.sz,
      x: listing.x,
      y: listing.y,
      z: listing.z,
      itemId: listing.itemId,
      kind: listing.kind,
      qty: q,
      totalPrice: totalPrice,
      status: 'ready'
    };
    econState.pickupOrders.push(order);
    return { ok: true, order: order, totalPrice: totalPrice, repScore: repScore, repMult: repPricing.buyMult };
  }

  function pickupLogisticsOrder(econState, buyerCid, orderId, playerX, playerY, playerZ, maxDist) {
    ensureEconomyState(econState);
    var distLimit = Number(maxDist || 24);
    var order = null;
    for (var i = 0; i < econState.pickupOrders.length; i++) {
      if (econState.pickupOrders[i].id === orderId && econState.pickupOrders[i].status === 'ready') {
        order = econState.pickupOrders[i];
        break;
      }
    }
    if (!order || order.buyerCid !== buyerCid) return { ok: false, reason: 'not_found' };
    var dx = Number(playerX) - Number(order.x);
    var dz = Number(playerZ) - Number(order.z);
    var dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > distLimit) {
      return {
        ok: false,
        reason: 'too_far',
        distance: Math.round(dist),
        maxDist: distLimit,
        target: { x: order.x, y: order.y, z: order.z }
      };
    }
    order.status = 'collected';
    return { ok: true, order: order, distance: Math.round(dist) };
  }

  function listReadyPickups(econState, buyerCid) {
    ensureEconomyState(econState);
    return econState.pickupOrders.filter(function (o) {
      return o.buyerCid === buyerCid && o.status === 'ready';
    });
  }

  // Wandering Trader offers: offsets from -60% (0.40x) to +200% (3.00x),
  // balanced so total discounted value ~ total marked-up value.
  function generateWanderingTraderOffers(st, rngFn, repBuyMult, repSellMult) {
    ensureEconomyState(st);
    var rng = rngFn || Math.random;
    var rBuy = Number(repBuyMult || 1.0);
    var rSell = Number(repSellMult || 1.0);
    var pool = Object.keys(BASE_COMMODITY_CATALOG).filter(function (id) {
      return inferCommodityKind(id) === 'item';
    });
    // Fisher-Yates partial pick of 8 unique items
    var copy = pool.slice();
    for (var i = copy.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    var chosen = copy.slice(0, 8);
    var offers = [];
    // Paired offsets ensuring symmetry in value deltas:
    // Discount group: -60%.. -15% (0.40x..0.85x)
    // Markup group:   +20%..+200% (1.20x..3.00x)
    var discountMults = [0.40, 0.55, 0.70, 0.85];
    var markupMults   = [3.00, 2.20, 1.65, 1.25];
    var totalDiscountDelta = 0;
    var totalMarkupDelta = 0;

    for (var idx = 0; idx < 4; idx++) {
      var dItem = chosen[idx * 2];
      var mItem = chosen[idx * 2 + 1];
      var dQuote = getMarketQuote(st, dItem);
      var mQuote = getMarketQuote(st, mItem);
      var dMult = discountMults[idx];
      var mMult = markupMults[idx];

      // Determine qty so total discount delta and markup delta stay balanced
      var dBase = Math.max(2, dQuote.price);
      var mBase = Math.max(2, mQuote.price);
      var dQty = Math.max(1, Math.min(32, Math.round(160 / dBase)));
      var targetDelta = Math.max(10, Math.round(dQty * dBase * (1.0 - dMult)));
      var mUnitDelta = Math.max(1, Math.round(mBase * (mMult - 1.0)));
      var mQty = Math.max(1, Math.min(32, Math.round(targetDelta / mUnitDelta)));

      var dPrice = Math.max(1, Math.round(dBase * dMult * (idx % 2 === 0 ? rBuy : (1.0 / Math.max(0.55, rSell)))));
      var mPrice = Math.max(1, Math.round(mBase * mMult * (idx % 2 === 0 ? (1.0 / Math.max(0.55, rSell)) : rBuy)));
      totalDiscountDelta += (dBase - dPrice) * dQty;
      totalMarkupDelta += (mPrice - mBase) * mQty;

      offers.push({
        id: 'wt_' + (idx * 2 + 1),
        side: idx % 2 === 0 ? 'sell_to_player' : 'buy_from_player',
        itemId: dItem,
        qty: dQty,
        marketPrice: dBase,
        offerPrice: dPrice,
        offsetPct: Math.round((dMult - 1.0) * 100),
        tag: 'СКИДКА'
      });
      offers.push({
        id: 'wt_' + (idx * 2 + 2),
        side: idx % 2 === 0 ? 'buy_from_player' : 'sell_to_player',
        itemId: mItem,
        qty: mQty,
        marketPrice: mBase,
        offerPrice: mPrice,
        offsetPct: Math.round((mMult - 1.0) * 100),
        tag: 'НАЦЕНКА'
      });
    }
    return {
      offers: offers,
      totalDiscountDelta: totalDiscountDelta,
      totalMarkupDelta: totalMarkupDelta,
      imbalancePct: Math.round(
        (Math.abs(totalDiscountDelta - totalMarkupDelta) /
        Math.max(1, Math.max(totalDiscountDelta, totalMarkupDelta))) * 100
      )
    };
  }

  return {
    CRASH_NET_SUPPLY_THRESHOLD: CRASH_NET_SUPPLY_THRESHOLD,
    CRASH_DURATION_TICKS: CRASH_DURATION_TICKS,
    CRASH_PRICE_MULT: CRASH_PRICE_MULT,
    BASE_COMMODITY_CATALOG: BASE_COMMODITY_CATALOG,
    inferCommodityKind: inferCommodityKind,
    computeRarityScorePrice: computeRarityScorePrice,
    inferFallbackBasePrice: inferFallbackBasePrice,
    createInitialEconomyState: createInitialEconomyState,
    ensureEconomyState: ensureEconomyState,
    propagateRecipePrices: propagateRecipePrices,
    recalculateWithPins: recalculateWithPins,
    getLiveCachedPrice: getLiveCachedPrice,
    getCommodityState: getCommodityState,
    getBasePrice: getBasePrice,
    getMarketQuote: getMarketQuote,
    recordTradePressure: recordTradePressure,
    decayMarketTick: decayMarketTick,
    setAdminPrice: setAdminPrice,
    setAdminBounds: setAdminBounds,
    clearAdminPrice: clearAdminPrice,
    setPlayerItemPrice: setPlayerItemPrice,
    clearPlayerItemPrice: clearPlayerItemPrice,
    forceCrash: forceCrash,
    createFacilityListing: createFacilityListing,
    buyFacilityListing: buyFacilityListing,
    pickupLogisticsOrder: pickupLogisticsOrder,
    listReadyPickups: listReadyPickups,
    generateWanderingTraderOffers: generateWanderingTraderOffers
  };
})();

global.LHTradeLogistics = (function () {
  var MIN_DELIVERY_SPEED_BPS = 1.04; // vanilla crouch ~1.30 m/s - 20%
  var MAX_DELIVERY_SPEED_BPS = 24.0; // modpack top speed ~30.0 m/s - 20%
  var TICKS_PER_GAME_DAY = 24000;
  var SPEED_PRESETS = [
    { id: 'slow', bps: 1.04, label: 'Обоз (присед −20%)' },
    { id: 'walk', bps: 4.30, label: 'Пеший курьер' },
    { id: 'road', bps: 10.50, label: 'Автоконвой' },
    { id: 'sea', bps: 12.00, label: 'Водный конвой' },
    { id: 'rail', bps: 16.00, label: 'Скоростной поезд' },
    { id: 'air', bps: 24.00, label: 'Авиа-экспресс (макс. −20%)' }
  ];

  var VEHICLE_FLEET_SPECS = {
    cart: {
      id: 'cart',
      name: 'Гужевой обоз / Вагонетка',
      speedBps: 4.5,
      capacity: 16,
      requiredBuildingTypes: [], // works between any facilities
      acceptedItems: ['minecraft:chest_minecart', 'minecraft:minecart', 'astikorcarts:supply_cart'],
      fuelMult: 0.8
    },
    road: {
      id: 'road',
      name: 'Автоколонна (Automobility)',
      speedBps: 10.5,
      capacity: 32,
      requiredBuildingTypes: ['road_depot', 'warehouse', 'trade_exchange'],
      acceptedItems: [
        'automobility:automobile',
        'automobility:automobile_frame',
        'automobility:automobile_engine',
        'automobility:automobile_wheel'
      ],
      fuelMult: 1.0
    },
    sea: {
      id: 'sea',
      name: 'Грузовое судно / Баржа (Small Ships / Лодка)',
      speedBps: 12.0,
      capacity: 48,
      requiredBuildingTypes: ['port'],
      acceptedItems: [
        'smallships:oak_cog', 'smallships:spruce_cog', 'smallships:birch_cog',
        'smallships:oak_galleon', 'smallships:oak_brigg', 'smallships:oak_caravel',
        'vs_eureka:oak_ship_helm', 'minecraft:oak_chest_boat', 'minecraft:oak_boat',
        'minecraft:spruce_boat', 'minecraft:birch_boat', 'minecraft:dark_oak_boat',
        'minecraft:acacia_boat', 'minecraft:jungle_boat', 'minecraft:mangrove_boat',
        'minecraft:cherry_boat', 'minecraft:bamboo_raft'
      ],
      fuelMult: 0.9
    },
    rail: {
      id: 'rail',
      name: 'Грузовой поезд (Create / Steam \'n\' Rails)',
      speedBps: 16.0,
      capacity: 64,
      requiredBuildingTypes: ['rail_depot'],
      acceptedItems: [
        'create:schedule', 'create:track', 'create:train_casing', 'minecraft:chest_minecart'
      ],
      fuelMult: 1.15
    },
    air: {
      id: 'air',
      name: 'Грузовой дирижабль / Самолёт (Immersive Aircraft)',
      speedBps: 24.0,
      capacity: 40,
      requiredBuildingTypes: ['airport'],
      acceptedItems: [
        'immersive_aircraft:cargo_airship', 'immersive_aircraft:airship',
        'immersive_aircraft:biplane', 'immersive_aircraft:gyrodyne',
        'immersive_aircraft:quadrocopter', 'man_of_many_planes:economy_plane'
      ],
      fuelMult: 1.35
    }
  };

  function createState() {
    return {
      passes: {},
      deliveries: [],
      automatedRoutes: [],
      convoys: [],
      haggles: {},
      p2pSessions: {},
      nextPassSeq: 1,
      nextDeliverySeq: 1,
      nextRouteSeq: 1,
      nextConvoySeq: 1,
      nextHaggleSeq: 1,
      nextP2pSeq: 1
    };
  }

  function ensureState(st) {
    if (!st || typeof st !== 'object') st = createState();
    if (!st.passes) st.passes = {};
    if (!Array.isArray(st.deliveries)) st.deliveries = [];
    if (!Array.isArray(st.automatedRoutes)) st.automatedRoutes = [];
    if (!Array.isArray(st.convoys)) st.convoys = [];
    if (!st.haggles) st.haggles = {};
    if (!st.p2pSessions) st.p2pSessions = {};
    if (!st.nextPassSeq) st.nextPassSeq = 1;
    if (!st.nextDeliverySeq) st.nextDeliverySeq = 1;
    if (!st.nextRouteSeq) st.nextRouteSeq = 1;
    if (!st.nextConvoySeq) st.nextConvoySeq = 1;
    if (!st.nextHaggleSeq) st.nextHaggleSeq = 1;
    if (!st.nextP2pSeq) st.nextP2pSeq = 1;
    return st;
  }

  function getSubsidyModifiers(ottdState, cid, sx, sz) {
    var active = (global.LHOpenTTD && global.LHOpenTTD.isCompanySubsidized && ottdState)
      ? global.LHOpenTTD.isCompanySubsidized(ottdState, cid, sx, sz)
      : false;
    return {
      active: active,
      productionYieldMult: active ? 1.35 : 1.0,
      productionSpeedMult: active ? 1.25 : 1.0,
      deliveryFeeMult: active ? 0.60 : 1.0, // -40% delivery cost
      routeFuelDiscount: active ? 0.50 : 1.0, // -50% automated route fuel/customs cost
      speedBoostMult: active ? 1.30 : 1.0, // +30% convoy speed on subsidized routes
      zeroRelayToll: active, // subsidized corridors waive foreign relay tolls
      freeEscort: active, // subsidized corridors provide state escort discount
      travelCooldownMult: active ? 0.50 : 1.0,
      freeExpressTravel: active
    };
  }

  function matchVehicleItem(itemId, preferredType) {
    var id = String(itemId || '').toLowerCase();
    if (!id || id === 'minecraft:air') return null;
    var order = preferredType ? [preferredType] : ['air', 'rail', 'sea', 'road', 'cart'];
    for (var i = 0; i < order.length; i++) {
      var vt = order[i];
      var spec = VEHICLE_FLEET_SPECS[vt];
      if (!spec) continue;
      if (spec.acceptedItems.indexOf(id) !== -1) return vt;
      if (vt === 'sea' && (/^smallships:/.test(id) || /_boat$/.test(id) || /_raft$/.test(id) || /^vs_eureka:.*_ship_helm$/.test(id))) return 'sea';
      if (vt === 'road' && /^automobility:automobile/.test(id)) return 'road';
      if (vt === 'air' && (/^immersive_aircraft:/.test(id) || /^man_of_many_planes:/.test(id))) return 'air';
      if (vt === 'rail' && (/^railways:/.test(id) || id === 'create:track' || id === 'create:schedule' || id === 'create:train_casing')) return 'rail';
      if (vt === 'cart' && (/^astikorcarts:/.test(id) || /minecart$/.test(id))) return 'cart';
    }
    return null;
  }

  function hasTransportInfrastructure(ottdState, sx, sz, dim, vehicleType) {
    var spec = VEHICLE_FLEET_SPECS[vehicleType || 'cart'] || VEHICLE_FLEET_SPECS.cart;
    if (!spec.requiredBuildingTypes || spec.requiredBuildingTypes.length === 0) return { ok: true, hubType: 'any' };
    if (!ottdState || !ottdState.buildings) return { ok: false, reason: 'no_buildings', required: spec.requiredBuildingTypes };
    var dNorm = dim || 'minecraft:overworld';
    var bestHub = null;
    Object.keys(ottdState.buildings).forEach(function (bk) {
      var b = ottdState.buildings[bk];
      if (!b || (b.dimension || 'minecraft:overworld') !== dNorm) return;
      if (Math.abs(b.sx - sx) <= 1 && Math.abs(b.sz - sz) <= 1) {
        if (spec.requiredBuildingTypes.indexOf(b.type) !== -1) {
          bestHub = b;
        }
      }
    });
    if (bestHub) return { ok: true, hubType: bestHub.type, hubBuilding: bestHub };
    return {
      ok: false,
      reason: 'missing_infrastructure',
      vehicleType: vehicleType,
      required: spec.requiredBuildingTypes,
      sx: sx,
      sz: sz
    };
  }

  function registerCompanyConvoy(lState, ottdState, companyId, vehicleType, consumedItemId, opts) {
    ensureState(lState);
    var vt = vehicleType || matchVehicleItem(consumedItemId);
    var spec = VEHICLE_FLEET_SPECS[vt];
    if (!spec) return { ok: false, reason: 'invalid_vehicle_type' };
    if (ottdState && (!ottdState.companies || !ottdState.companies[companyId])) return { ok: false, reason: 'no_company' };
    var itemNorm = String(consumedItemId || spec.acceptedItems[0]);
    if (opts && opts.strictItemCheck && matchVehicleItem(itemNorm, vt) !== vt) {
      return { ok: false, reason: 'incompatible_item', requiredItems: spec.acceptedItems };
    }
    var convoy = {
      id: 'CV' + (lState.nextConvoySeq++),
      companyId: companyId,
      vehicleType: vt,
      name: spec.name,
      itemId: itemNorm,
      speedBps: spec.speedBps,
      capacity: spec.capacity,
      assignedRouteId: null,
      status: 'idle',
      createdAtTick: Number((opts && opts.nowTick) || 0),
      totalTrips: 0,
      totalMoved: 0
    };
    lState.convoys.push(convoy);
    return { ok: true, convoy: convoy };
  }

  function listCompanyConvoys(lState, companyId) {
    ensureState(lState);
    return lState.convoys.filter(function (c) { return c && (!companyId || c.companyId === companyId); });
  }

  function getBuildingRoadSpeedBonus(ottdState, sx, sz, dim) {
    if (!ottdState || !ottdState.buildings) return 1.0;
    var bonus = 1.0;
    Object.keys(ottdState.buildings).forEach(function (bk) {
      var b = ottdState.buildings[bk];
      if (!b || (b.dimension || 'minecraft:overworld') !== (dim || 'minecraft:overworld')) return;
      if (Math.abs(b.sx - sx) <= 1 && Math.abs(b.sz - sz) <= 1) {
        if (b.type === 'road_depot' && b.branch1 === 'asphalt_highway') bonus = Math.max(bonus, 1.25);
        if (b.type === 'rail_depot' && b.branch1 === 'steam_locomotive') bonus = Math.max(bonus, 1.15);
        if (b.type === 'airport' && b.branch2 === 'continental_runway') bonus = Math.max(bonus, 1.20);
      }
    });
    return bonus;
  }

  function planTransportPath(lState, ottdState, companyId, srcNode, dstNode, vehicleType, opts) {
    var vt = vehicleType || 'cart';
    var vSpec = VEHICLE_FLEET_SPECS[vt] || VEHICLE_FLEET_SPECS.cart;
    var o = opts || {};
    var srcDim = srcNode.dim || srcNode.dimension || 'minecraft:overworld';
    var dstDim = dstNode.dim || dstNode.dimension || 'minecraft:overworld';

    // Explicit infrastructure check when required or requested
    if (o.requireInfra) {
      var infSrc = hasTransportInfrastructure(ottdState, srcNode.sx, srcNode.sz, srcDim, vt);
      if (!infSrc.ok) return { ok: false, reason: 'missing_src_infra', required: infSrc.required, sx: srcNode.sx, sz: srcNode.sz };
      var infDst = hasTransportInfrastructure(ottdState, dstNode.sx, dstNode.sz, dstDim, vt);
      if (!infDst.ok) return { ok: false, reason: 'missing_dst_infra', required: infDst.required, sx: dstNode.sx, sz: dstNode.sz };
    }

    var waypoints = Array.isArray(o.waypoints) ? o.waypoints.slice() : [];
    // Optional auto-relay discovery through intermediate owned or foreign facilities (shortest graph hops)
    if (waypoints.length === 0 && o.autoRelay && srcDim === dstDim && ottdState && ottdState.buildings) {
      var candidates = [];
      Object.keys(ottdState.buildings).forEach(function (bk) {
        var b = ottdState.buildings[bk];
        if (!b || (b.dimension || 'minecraft:overworld') !== srcDim) return;
        if ((b.sx === srcNode.sx && b.sz === srcNode.sz) || (b.sx === dstNode.sx && b.sz === dstNode.sz)) return;
        if (vt === 'cart' || hasTransportInfrastructure(ottdState, b.sx, b.sz, srcDim, vt).ok) {
          candidates.push(b);
        }
      });
      // Pick closest single relay node that lies reasonably between src and dst if direct distance > 512
      var directDist = computeDistance(srcNode.sx * 256, srcNode.sz * 256, dstNode.sx * 256, dstNode.sz * 256);
      if (directDist >= 512 && candidates.length > 0) {
        var bestRelay = null, bestScore = 1e12;
        for (var ci = 0; ci < candidates.length; ci++) {
          var cb = candidates[ci];
          var d1 = computeDistance(srcNode.sx * 256, srcNode.sz * 256, cb.sx * 256, cb.sz * 256);
          var d2 = computeDistance(cb.sx * 256, cb.sz * 256, dstNode.sx * 256, dstNode.sz * 256);
          var score = d1 + d2 + (cb.owner !== companyId ? 120 : 0);
          if (score < bestScore) { bestScore = score; bestRelay = cb; }
        }
        if (bestRelay) waypoints.push({ sx: bestRelay.sx, sz: bestRelay.sz, dim: srcDim });
      }
    }

    var chain = [{ sx: srcNode.sx, sz: srcNode.sz, dim: srcDim, owner: companyId }].concat(waypoints).concat([{ sx: dstNode.sx, sz: dstNode.sz, dim: dstDim, owner: companyId }]);
    var totalDistanceBlocks = 0;
    var relayTolls = [];
    var totalRelayToll = 0;
    var subSrc = getSubsidyModifiers(ottdState, companyId, srcNode.sx, srcNode.sz);
    var subDst = getSubsidyModifiers(ottdState, companyId, dstNode.sx, dstNode.sz);
    var isSubsidized = !!(subSrc.active || subDst.active);

    for (var wi = 0; wi < chain.length; wi++) {
      var node = chain[wi];
      if (wi > 0 && wi < chain.length - 1) {
        var wDim = node.dim || srcDim;
        node.dim = wDim;
        if (o.requireInfra) {
          var infMid = hasTransportInfrastructure(ottdState, node.sx, node.sz, wDim, vt);
          if (!infMid.ok) return { ok: false, reason: 'missing_waypoint_infra', sx: node.sx, sz: node.sz, required: infMid.required };
        }
        var midB = (ottdState && global.LHOpenTTD) ? global.LHOpenTTD.getSectorBuilding(ottdState, node.sx, node.sz, wDim) : null;
        if (!midB && ottdState && global.LHOpenTTD) {
          var ownerInfo = global.LHOpenTTD.resolveSectorOwner(ottdState, node.sx, node.sz, wDim);
          node.owner = ownerInfo && ownerInfo.kind === 'claimed' ? ownerInfo.owner : companyId;
        } else if (midB) {
          node.owner = midB.owner;
          node.buildingName = midB.variantName || midB.structureName || midB.type;
        }
        if (node.owner && node.owner !== companyId && ottdState && global.LHOpenTTD) {
          var rel = global.LHOpenTTD.getRelation(ottdState, companyId, node.owner);
          if (rel && rel.score <= -60) {
            return { ok: false, reason: 'relay_embargo', owner: node.owner, sx: node.sx, sz: node.sz };
          }
          var isAllied = global.LHOpenTTD.isAllied(ottdState, companyId, node.owner) || global.LHOpenTTD.hasPact(ottdState, companyId, node.owner);
          var toll = (isAllied || isSubsidized) ? 0 : Math.max(8, Math.round(12 + Number(o.qtyPerRun || 8) * 0.6));
          if (toll > 0) {
            relayTolls.push({ owner: node.owner, sx: node.sx, sz: node.sz, toll: toll });
            totalRelayToll += toll;
          }
        }
      }
      if (wi > 0) {
        var prev = chain[wi - 1];
        var segDist = ((prev.dim || srcDim) !== (node.dim || srcDim))
          ? 768
          : computeDistance(prev.sx * 256, prev.sz * 256, node.sx * 256, node.sz * 256);
        totalDistanceBlocks += segDist;
      }
    }

    var infraSpeedMult = getBuildingRoadSpeedBonus(ottdState, srcNode.sx, srcNode.sz, srcDim);
    var subSpeedMult = isSubsidized ? 1.30 : 1.0;
    var effectiveSpeedBps = Math.round(vSpec.speedBps * infraSpeedMult * subSpeedMult * 100) / 100;
    var travelSeconds = Math.round((totalDistanceBlocks / Math.max(1.0, effectiveSpeedBps)) * 10) / 10;
    var travelTicks = Math.max(40, Math.round((totalDistanceBlocks / Math.max(1.0, effectiveSpeedBps)) * 20));

    return {
      ok: true,
      vehicleType: vt,
      pathNodes: chain,
      waypointCount: Math.max(0, chain.length - 2),
      totalDistanceBlocks: totalDistanceBlocks,
      speedBps: effectiveSpeedBps,
      travelSeconds: travelSeconds,
      travelTicks: travelTicks,
      relayTolls: relayTolls,
      totalRelayToll: totalRelayToll,
      subsidized: isSubsidized
    };
  }

  function computeAutomatedRouteCost(ottdState, cid, srcBuilding, dstBuilding, qtyPerRun, opts) {
    var o = opts || {};
    var q = Math.max(1, Math.round(Number(qtyPerRun || 8)));
    var dist = Number(o.totalDistanceBlocks || computeDistance(srcBuilding.sx * 256, srcBuilding.sz * 256, dstBuilding.sx * 256, dstBuilding.sz * 256));
    var srcDim = srcBuilding.dimension || 'minecraft:overworld';
    var dstDim = dstBuilding.dimension || 'minecraft:overworld';
    var crossDim = srcDim !== dstDim;
    var sectorsSpan = Math.max(1, Math.round(dist / 256));
    var subSrc = getSubsidyModifiers(ottdState, cid, srcBuilding.sx, srcBuilding.sz);
    var subDst = getSubsidyModifiers(ottdState, cid, dstBuilding.sx, dstBuilding.sz);
    var fuelDisc = (subSrc.active || subDst.active) ? 0.50 : 1.0;
    var vSpec = VEHICLE_FLEET_SPECS[o.vehicleType || 'cart'] || VEHICLE_FLEET_SPECS.cart;
    var fMult = vSpec.fuelMult || 1.0;

    // Sample foreign sectors along route for customs tax
    var foreignSectors = 0;
    if (!crossDim && ottdState && global.LHOpenTTD) {
      var steps = Math.min(12, Math.max(1, sectorsSpan));
      for (var s = 1; s < steps; s++) {
        var t = s / steps;
        var msx = Math.round(srcBuilding.sx + (dstBuilding.sx - srcBuilding.sx) * t);
        var msz = Math.round(srcBuilding.sz + (dstBuilding.sz - srcBuilding.sz) * t);
        var own = global.LHOpenTTD.resolveSectorOwner(ottdState, msx, msz, srcDim);
        if (own && own.kind === 'claimed' && own.owner && own.owner !== cid && !global.LHOpenTTD.isAllied(ottdState, cid, own.owner)) {
          foreignSectors++;
        }
      }
    }

    var relayToll = Math.round(Number(o.totalRelayToll || 0) * fuelDisc);
    var coalCost = Math.max(1, Math.round((1 + sectorsSpan * 0.4 + q * 0.08) * fMult * fuelDisc));
    var oilCost = crossDim ? Math.max(2, Math.round(4 * fuelDisc)) : Math.max(0, Math.round(sectorsSpan * 0.35 * fMult * fuelDisc));
    var customsTax = Math.round((foreignSectors * 14 + (crossDim ? 36 : 0)) * fuelDisc) + relayToll;
    var cashFuelFee = Math.max(4, Math.round((8 + sectorsSpan * 3.5 + q * 0.5) * fMult * fuelDisc));
    return {
      distance: dist,
      sectorsSpan: sectorsSpan,
      crossDim: crossDim,
      foreignSectors: foreignSectors,
      relayToll: relayToll,
      subsidized: (subSrc.active || subDst.active),
      coalItem: 'minecraft:coal',
      coalQty: coalCost,
      oilItem: 'gtceu:oil_bucket',
      oilQty: oilCost,
      customsTax: customsTax,
      cashFuelFee: cashFuelFee,
      totalCashCost: customsTax + cashFuelFee
    };
  }

  function createAutomatedRoute(lState, ottdState, cid, srcSx, srcSz, dstSx, dstSz, itemId, qtyPerRun, opts) {
    ensureState(lState);
    if (!ottdState || !global.LHOpenTTD) return { ok: false, reason: 'no_ottd' };
    var o = opts || {};
    var srcDim = o.srcDim || 'minecraft:overworld';
    var dstDim = o.dstDim || 'minecraft:overworld';
    var srcB = global.LHOpenTTD.getSectorBuilding(ottdState, srcSx, srcSz, srcDim);
    var dstB = global.LHOpenTTD.getSectorBuilding(ottdState, dstSx, dstSz, dstDim);
    if (!srcB || !dstB) return { ok: false, reason: 'missing_building' };
    if (srcB.owner !== cid || dstB.owner !== cid) return { ok: false, reason: 'not_owned' };
    if (srcB.id === dstB.id) return { ok: false, reason: 'same_building' };

    var vt = o.vehicleType || 'cart';
    var convoyObj = null;
    if (o.convoyId) {
      for (var ci = 0; ci < lState.convoys.length; ci++) {
        if (lState.convoys[ci] && lState.convoys[ci].id === o.convoyId && lState.convoys[ci].companyId === cid) {
          convoyObj = lState.convoys[ci];
          vt = convoyObj.vehicleType;
          break;
        }
      }
      if (!convoyObj) return { ok: false, reason: 'convoy_not_found' };
    } else if (o.requireConvoy) {
      for (var cj = 0; cj < lState.convoys.length; cj++) {
        var cv = lState.convoys[cj];
        if (cv && cv.companyId === cid && cv.vehicleType === vt && !cv.assignedRouteId) {
          convoyObj = cv;
          break;
        }
      }
      if (!convoyObj) return { ok: false, reason: 'missing_convoy', vehicleType: vt };
    }

    var vSpec = VEHICLE_FLEET_SPECS[vt] || VEHICLE_FLEET_SPECS.cart;
    var q = Math.max(1, Math.min(vSpec.capacity || 64, Math.round(Number(qtyPerRun || 8))));
    var pathPlan = planTransportPath(lState, ottdState, cid, { sx: srcSx, sz: srcSz, dim: srcDim }, { sx: dstSx, sz: dstSz, dim: dstDim }, vt, {
      waypoints: o.waypoints,
      autoRelay: !!o.autoRelay,
      requireInfra: !!o.requireInfra,
      qtyPerRun: q
    });
    if (!pathPlan.ok) return pathPlan;

    var costInfo = computeAutomatedRouteCost(ottdState, cid, srcB, dstB, q, {
      vehicleType: vt,
      totalDistanceBlocks: pathPlan.totalDistanceBlocks,
      totalRelayToll: pathPlan.totalRelayToll
    });
    var useTransit = !!(o.useTransitTimer || convoyObj);
    var period = Math.max(600, Math.round(Number(o.periodTicks || (useTransit ? Math.max(400, pathPlan.travelTicks) : 2400))));

    var route = {
      id: 'R' + (lState.nextRouteSeq++),
      companyId: cid,
      srcKey: srcB.key || global.LHOpenTTD.sectorKey(srcSx, srcSz, srcDim),
      dstKey: dstB.key || global.LHOpenTTD.sectorKey(dstSx, dstSz, dstDim),
      srcSx: srcSx,
      srcSz: srcSz,
      srcDim: srcDim,
      dstSx: dstSx,
      dstSz: dstSz,
      dstDim: dstDim,
      vehicleType: vt,
      convoyId: convoyObj ? convoyObj.id : null,
      pathNodes: pathPlan.pathNodes,
      relayTolls: pathPlan.relayTolls,
      totalDistanceBlocks: pathPlan.totalDistanceBlocks,
      speedBps: pathPlan.speedBps,
      travelSeconds: pathPlan.travelSeconds,
      travelTicks: pathPlan.travelTicks,
      useTransitTimer: useTransit,
      convoyState: 'idle',
      transitStartTick: 0,
      transitEtaTick: 0,
      inTransitCargo: null,
      itemId: String(itemId || 'auto'),
      qtyPerRun: q,
      periodTicks: period,
      nextRunTick: useTransit ? Number(o.nowTick || 0) : (Number(o.nowTick || 0) + period),
      enabled: true,
      escortEnabled: !!(o.escortEnabled || pathPlan.subsidized),
      mode: o.mode || 'to_input', // 'to_input' | 'to_stock'
      costProfile: costInfo,
      totalTransferred: 0,
      totalRuns: 0,
      robbedCount: 0,
      lastStatus: 'ready'
    };
    if (convoyObj) {
      convoyObj.assignedRouteId = route.id;
      convoyObj.status = 'assigned';
    }
    lState.automatedRoutes.push(route);
    return { ok: true, route: route, costProfile: costInfo, pathPlan: pathPlan, convoy: convoyObj };
  }

  function createConvoyRoute(lState, ottdState, cid, srcSx, srcSz, dstSx, dstSz, vehicleType, itemId, qtyPerRun, opts) {
    var o = Object.assign({}, opts || {}, {
      vehicleType: vehicleType || 'road',
      requireInfra: (opts && opts.requireInfra !== undefined) ? opts.requireInfra : true,
      useTransitTimer: true
    });
    return createAutomatedRoute(lState, ottdState, cid, srcSx, srcSz, dstSx, dstSz, itemId, qtyPerRun, o);
  }

  function dispatchConvoyRoute(lState, ottdState, routeId, nowTick, opts) {
    ensureState(lState);
    var route = null;
    for (var i = 0; i < lState.automatedRoutes.length; i++) {
      if (lState.automatedRoutes[i] && lState.automatedRoutes[i].id === routeId) { route = lState.automatedRoutes[i]; break; }
    }
    if (!route) return { ok: false, reason: 'not_found' };
    if (route.convoyState === 'in_transit') return { ok: false, reason: 'already_in_transit', etaTick: route.transitEtaTick };
    route.enabled = true;
    route.nextRunTick = Number(nowTick || 0);
    return { ok: true, events: tickAutomatedRoutes(lState, ottdState, Number(nowTick || 0), opts) };
  }

  function toggleAutomatedRoute(lState, routeId, cid) {
    ensureState(lState);
    for (var i = 0; i < lState.automatedRoutes.length; i++) {
      var r = lState.automatedRoutes[i];
      if (r && r.id === routeId && (!cid || r.companyId === cid)) {
        r.enabled = !r.enabled;
        return { ok: true, enabled: r.enabled, route: r };
      }
    }
    return { ok: false, reason: 'not_found' };
  }

  function deleteAutomatedRoute(lState, routeId, cid) {
    ensureState(lState);
    var before = lState.automatedRoutes.length;
    lState.automatedRoutes = lState.automatedRoutes.filter(function (r) {
      if (r && r.id === routeId && (!cid || r.companyId === cid)) {
        if (r.convoyId) {
          for (var c = 0; c < lState.convoys.length; c++) {
            if (lState.convoys[c] && lState.convoys[c].id === r.convoyId) {
              lState.convoys[c].assignedRouteId = null;
              lState.convoys[c].status = 'idle';
            }
          }
        }
        return false;
      }
      return true;
    });
    return { ok: lState.automatedRoutes.length < before };
  }

  function payRelayTollsToOwners(ottdState, route, fuelDisc) {
    if (!ottdState || !ottdState.companies || !Array.isArray(route.relayTolls)) return 0;
    var paid = 0;
    for (var ti = 0; ti < route.relayTolls.length; ti++) {
      var rt = route.relayTolls[ti];
      if (!rt || !rt.owner || !(rt.toll > 0)) continue;
      var tAmt = Math.round(rt.toll * (fuelDisc || 1.0));
      if (tAmt > 0 && ottdState.companies[rt.owner]) {
        ottdState.companies[rt.owner].cash += tAmt;
        paid += tAmt;
      }
    }
    return paid;
  }

  function deliverCargoToEndpoint(dstB, mode, itemId, qty) {
    if (!dstB || !(qty > 0)) return;
    if (mode === 'to_input') {
      if (!dstB.inputBuffer) dstB.inputBuffer = {};
      dstB.inputBuffer[itemId] = (dstB.inputBuffer[itemId] || 0) + qty;
      if (dstB.pausedReason === 'missing_inputs' || dstB.pausedReason === 'missing_fuel') dstB.pausedReason = null;
    } else {
      if (!dstB.stockBuffer) dstB.stockBuffer = {};
      dstB.stockBuffer[itemId] = (dstB.stockBuffer[itemId] || 0) + qty;
    }
  }

  function tickAutomatedRoutes(lState, ottdState, nowTick, opts) {
    ensureState(lState);
    if (!ottdState || !global.LHOpenTTD) return [];
    var o = opts || {};
    var rng = typeof o.rng === 'function' ? o.rng : Math.random;
    var tick = Number(nowTick || 0);
    var events = [];
    for (var i = 0; i < lState.automatedRoutes.length; i++) {
      var r = lState.automatedRoutes[i];
      if (!r || !r.enabled) continue;

      var comp = ottdState.companies && ottdState.companies[r.companyId];
      var srcB = global.LHOpenTTD.getSectorBuilding(ottdState, r.srcSx, r.srcSz, r.srcDim);
      var dstB = global.LHOpenTTD.getSectorBuilding(ottdState, r.dstSx, r.dstSz, r.dstDim);
      if (!comp || !srcB || !dstB) { r.lastStatus = 'missing_endpoint'; continue; }

      // Phase 1: Check active in-transit convoy arrival (distance / speed = travel time)
      if (r.useTransitTimer && r.convoyState === 'in_transit') {
        if (tick < Number(r.transitEtaTick || 0)) {
          r.lastStatus = 'in_transit';
          continue;
        }
        var cargo = r.inTransitCargo || {};
        var delivQty = Number(cargo.qty || 0);
        if (delivQty > 0 && cargo.itemId) {
          deliverCargoToEndpoint(dstB, r.mode, cargo.itemId, delivQty);
        }
        r.convoyState = 'idle';
        r.inTransitCargo = null;
        r.nextRunTick = tick + Math.max(200, Math.round(Number(r.periodTicks || 600) * 0.25));
        r.totalTransferred = (r.totalTransferred || 0) + delivQty;
        r.totalRuns = (r.totalRuns || 0) + 1;
        r.lastStatus = cargo.pirateHit ? 'robbed_by_pirates' : 'arrived';
        comp.stats.routesDone = (comp.stats.routesDone || 0) + 1;
        if (r.convoyId) {
          for (var c1 = 0; c1 < lState.convoys.length; c1++) {
            if (lState.convoys[c1] && lState.convoys[c1].id === r.convoyId) {
              lState.convoys[c1].status = 'assigned';
              lState.convoys[c1].totalTrips = (lState.convoys[c1].totalTrips || 0) + 1;
              lState.convoys[c1].totalMoved = (lState.convoys[c1].totalMoved || 0) + delivQty;
            }
          }
        }
        events.push({
          routeId: r.id,
          ok: true,
          arrived: true,
          itemId: cargo.itemId,
          qty: delivQty,
          travelSeconds: r.travelSeconds,
          pirateHit: cargo.pirateHit || null
        });
        continue;
      }

      if (tick < Number(r.nextRunTick || 0)) continue;
      if (!r.useTransitTimer) r.nextRunTick = tick + Number(r.periodTicks || 2400);

      var waypointsOnly = (Array.isArray(r.pathNodes) && r.pathNodes.length > 2) ? r.pathNodes.slice(1, r.pathNodes.length - 1) : [];
      var pathCheck = planTransportPath(lState, ottdState, r.companyId, { sx: r.srcSx, sz: r.srcSz, dim: r.srcDim }, { sx: r.dstSx, sz: r.dstSz, dim: r.dstDim }, r.vehicleType || 'cart', {
        waypoints: waypointsOnly,
        qtyPerRun: r.qtyPerRun
      });
      if (pathCheck.ok) {
        r.totalDistanceBlocks = pathCheck.totalDistanceBlocks;
        r.speedBps = pathCheck.speedBps;
        r.travelSeconds = pathCheck.travelSeconds;
        r.travelTicks = pathCheck.travelTicks;
        r.relayTolls = pathCheck.relayTolls;
      }

      var costP = computeAutomatedRouteCost(ottdState, r.companyId, srcB, dstB, r.qtyPerRun, {
        vehicleType: r.vehicleType || 'cart',
        totalDistanceBlocks: r.totalDistanceBlocks,
        totalRelayToll: pathCheck.ok ? pathCheck.totalRelayToll : 0
      });
      r.costProfile = costP;
      var escortFee = (r.escortEnabled && !costP.subsidized) ? Math.max(10, Math.round(costP.sectorsSpan * 4)) : 0;
      var coalAvail = Number((comp.stockBuffer && comp.stockBuffer[costP.coalItem]) || 0);
      var coalFromStock = Math.min(coalAvail, costP.coalQty);
      var missingCoal = costP.coalQty - coalFromStock;
      var cashNeeded = costP.totalCashCost + escortFee + missingCoal * 4 + costP.oilQty * 10;

      if (comp.cash < cashNeeded) {
        r.lastStatus = 'no_cash_for_fuel';
        if (r.useTransitTimer) r.nextRunTick = tick + 200;
        events.push({ routeId: r.id, ok: false, reason: 'no_cash', cashNeeded: cashNeeded });
        continue;
      }

      // Resolve item to transfer
      var chosenItem = r.itemId;
      if (chosenItem === 'auto') {
        var reqIn = global.LHOpenTTD.getBuildingRequiredInputs(dstB);
        var reqKeys = Object.keys(reqIn);
        for (var rk = 0; rk < reqKeys.length; rk++) {
          if (srcB.stockBuffer && Number(srcB.stockBuffer[reqKeys[rk]] || 0) > 0) {
            chosenItem = reqKeys[rk];
            break;
          }
        }
        if (chosenItem === 'auto' && srcB.stockBuffer) {
          var sKeys = Object.keys(srcB.stockBuffer);
          for (var sk = 0; sk < sKeys.length; sk++) {
            if (Number(srcB.stockBuffer[sKeys[sk]] || 0) > 0) { chosenItem = sKeys[sk]; break; }
          }
        }
      }

      var avail = (srcB.stockBuffer && chosenItem !== 'auto') ? Number(srcB.stockBuffer[chosenItem] || 0) : 0;
      if (avail <= 0) {
        r.lastStatus = 'waiting_cargo';
        if (r.useTransitTimer) r.nextRunTick = tick + 200;
        continue;
      }
      var moveQty = Math.min(avail, r.qtyPerRun);
      comp.cash -= cashNeeded;
      if (coalFromStock > 0 && comp.stockBuffer) comp.stockBuffer[costP.coalItem] -= coalFromStock;
      payRelayTollsToOwners(ottdState, r, costP.subsidized ? 0.50 : 1.0);

      srcB.stockBuffer[chosenItem] -= moveQty;
      if (srcB.stockBuffer[chosenItem] <= 0) delete srcB.stockBuffer[chosenItem];

      var pirateHit = null;
      var isLongCaravan = costP.sectorsSpan >= 2 || costP.crossDim;
      if (!o.skipPiracy && isLongCaravan && global.LHOpenTTD.computeCaravanPiracyRisk && global.LHOpenTTD.interceptCaravanByPirates) {
        var pRisk = global.LHOpenTTD.computeCaravanPiracyRisk(ottdState, r.companyId, r.srcSx, r.srcSz, r.dstSx, r.dstSz, !!r.escortEnabled, tick);
        if (pRisk > 0 && rng() < pRisk) {
          pirateHit = global.LHOpenTTD.interceptCaravanByPirates(ottdState, r.companyId, chosenItem, moveQty, cashNeeded, tick, rng);
          moveQty = Math.max(0, moveQty - pirateHit.stolenQty);
          r.robbedCount = (r.robbedCount || 0) + 1;
        }
      }

      if (r.useTransitTimer) {
        r.convoyState = 'in_transit';
        r.transitStartTick = tick;
        r.transitEtaTick = tick + Number(r.travelTicks || 100);
        r.inTransitCargo = { itemId: chosenItem, qty: moveQty, pirateHit: pirateHit };
        r.lastStatus = 'in_transit';
        if (r.convoyId) {
          for (var c2 = 0; c2 < lState.convoys.length; c2++) {
            if (lState.convoys[c2] && lState.convoys[c2].id === r.convoyId) lState.convoys[c2].status = 'in_transit';
          }
        }
        events.push({
          routeId: r.id,
          ok: true,
          dispatched: true,
          itemId: chosenItem,
          qty: moveQty,
          cashCost: cashNeeded,
          travelSeconds: r.travelSeconds,
          etaTick: r.transitEtaTick,
          pirateHit: pirateHit
        });
      } else {
        deliverCargoToEndpoint(dstB, r.mode, chosenItem, moveQty);
        r.totalTransferred = (r.totalTransferred || 0) + moveQty;
        r.totalRuns = (r.totalRuns || 0) + 1;
        r.lastStatus = pirateHit ? 'robbed_by_pirates' : 'ok';
        comp.stats.routesDone = (comp.stats.routesDone || 0) + 1;
        events.push({
          routeId: r.id,
          ok: true,
          itemId: chosenItem,
          qty: moveQty,
          cashCost: cashNeeded,
          coalUsed: coalFromStock,
          pirateHit: pirateHit
        });
      }
    }
    return events;
  }

  function clampSpeed(bps) {
    var v = Number(bps || MIN_DELIVERY_SPEED_BPS);
    if (isNaN(v)) v = MIN_DELIVERY_SPEED_BPS;
    return Math.max(MIN_DELIVERY_SPEED_BPS, Math.min(MAX_DELIVERY_SPEED_BPS, Math.round(v * 100) / 100));
  }

  function computeCargoVolume(qty, stackSize) {
    var q = Math.max(1, Math.round(Number(qty || 1)));
    var stSz = Math.max(1, Math.round(Number(stackSize || 13))); // 5x reduced stacks (64 -> 13)
    return Math.max(0.25, Math.round((q / stSz) * 100) / 100);
  }

  function computeDistance(ax, az, bx, bz) {
    var dx = Number(ax || 0) - Number(bx || 0);
    var dz = Number(az || 0) - Number(bz || 0);
    return Math.max(32, Math.round(Math.sqrt(dx * dx + dz * dz)));
  }

  function computeDeliveryFee(distanceBlocks, volumeStacks, speedBps) {
    var dist = Math.max(32, Number(distanceBlocks || 256));
    var vol = Math.max(0.25, Number(volumeStacks || 1));
    var spd = clampSpeed(speedBps);
    var ratio = (spd - MIN_DELIVERY_SPEED_BPS) / (MAX_DELIVERY_SPEED_BPS - MIN_DELIVERY_SPEED_BPS);
    var speedMult = 0.75 + 2.25 * Math.pow(Math.max(0, Math.min(1, ratio)), 1.15);
    var distComponent = 14 + dist * 0.045;
    var volFactor = 0.55 + 0.45 * vol;
    return Math.max(8, Math.round(distComponent * volFactor * speedMult));
  }

  function computeSelfDeliveryReward(distanceBlocks, volumeStacks) {
    // Self-delivery always pays generously so doing it yourself beats hiring/delegating
    return Math.max(10, Math.round(computeDeliveryFee(distanceBlocks, volumeStacks, 9.0) * 0.90));
  }

  function computeHoldDailyFee(volumeStacks) {
    var vol = Math.max(0.25, Number(volumeStacks || 1));
    return Math.max(2, Math.round(4 * vol));
  }

  function isNearCompanyBorder(ottdState, targetCid, wx, wz) {
    if (!ottdState || !targetCid || !global.LHOpenTTD) return false;
    var sc = global.LHOpenTTD.sectorCoords(wx, wz);
    var claims = ottdState.claims || {};
    var cur = claims[global.LHOpenTTD.sectorKey(sc.sx, sc.sz)];
    // Check if player stands adjacent to a claimed sector of targetCid OR on an outer-edge sector of targetCid
    var hasOutsideNeighbor = false;
    var touchesTarget = false;
    for (var dx = -1; dx <= 1; dx++) {
      for (var dz = -1; dz <= 1; dz++) {
        var nCl = claims[global.LHOpenTTD.sectorKey(sc.sx + dx, sc.sz + dz)];
        if (nCl && nCl.owner === targetCid) touchesTarget = true;
        if (!nCl || nCl.owner !== targetCid) hasOutsideNeighbor = true;
      }
    }
    if (cur && cur.owner === targetCid) {
      return hasOutsideNeighbor;
    }
    return touchesTarget;
  }

  function requestBorderTradePass(lState, ottdState, playerUuid, myCid, targetCid, wx, wz, spec, nowTick) {
    ensureState(lState);
    if (!ottdState || !ottdState.companies || !ottdState.companies[targetCid]) {
      return { ok: false, reason: 'bad_target' };
    }
    if (myCid && myCid === targetCid) return { ok: false, reason: 'own_company' };
    if (!isNearCompanyBorder(ottdState, targetCid, wx, wz)) {
      return { ok: false, reason: 'not_at_border', targetCid: targetCid };
    }
    var term = global.LHOpenTTD.getCompanyTerminalCoords(ottdState, targetCid);
    if (!term) return { ok: false, reason: 'no_terminal' };
    var tick = Number(nowTick || 0);
    if (!lState.passes[playerUuid]) lState.passes[playerUuid] = {};
    var pass = {
      id: 'BP' + (lState.nextPassSeq++),
      playerUuid: playerUuid,
      myCid: myCid || null,
      targetCid: targetCid,
      side: (spec && spec.side) || 'buy', // 'buy' (take from target terminal) or 'sell' (deposit into target terminal)
      orderId: (spec && spec.orderId) || null,
      deliveryId: (spec && spec.deliveryId) || null,
      itemId: String((spec && spec.itemId) || 'minecraft:iron_ingot'),
      qty: Math.max(1, Math.round(Number((spec && spec.qty) || 1))),
      totalPrice: Math.max(0, Math.round(Number((spec && spec.totalPrice) || 0))),
      deliveryBonus: Math.max(0, Math.round(Number((spec && spec.deliveryBonus) || 0))),
      terminal: term,
      grantedTick: tick,
      expiresTick: tick + 12000, // 10 real minutes
      loadedInContainer: false,
      pickedUpQty: 0,
      depositedQty: 0,
      status: 'active'
    };
    lState.passes[playerUuid][targetCid] = pass;
    return { ok: true, pass: pass };
  }

  function getActiveBorderPass(lState, playerUuid, targetCid, nowTick) {
    ensureState(lState);
    var map = lState.passes[playerUuid];
    if (!map || !map[targetCid]) return null;
    var p = map[targetCid];
    if (p.status !== 'active' && p.status !== 'loaded') return null;
    if (typeof nowTick === 'number' && p.expiresTick < nowTick) {
      p.status = 'expired';
      return null;
    }
    return p;
  }

  function hasActiveBorderPass(lState, playerUuid, targetCid, nowTick) {
    return !!getActiveBorderPass(lState, playerUuid, targetCid, nowTick);
  }

  function completeBorderTradeOnLeave(lState, ottdState, playerUuid, targetCid) {
    ensureState(lState);
    var map = lState.passes[playerUuid];
    if (!map || !map[targetCid]) return { ok: false, reason: 'no_pass' };
    var p = map[targetCid];
    if (p.status === 'completed' || p.status === 'expired') return { ok: false, reason: 'already_closed' };
    var buyerComp = p.side === 'buy'
      ? (p.myCid ? ottdState.companies[p.myCid] : null)
      : ottdState.companies[targetCid];
    var sellerComp = p.side === 'buy'
      ? ottdState.companies[targetCid]
      : (p.myCid ? ottdState.companies[p.myCid] : null);

    if (p.side === 'sell') {
      if (p.depositedQty <= 0) {
        p.status = 'cancelled_empty';
        delete map[targetCid];
        return { ok: true, finalized: false, side: 'sell', reason: 'nothing_deposited', pass: p };
      }
      var ratio = Math.min(1, p.depositedQty / Math.max(1, p.qty));
      var saleCredit = Math.max(1, Math.round(p.totalPrice * ratio));
      var bonusCredit = Math.round(p.deliveryBonus * ratio);
      var totalPayout = saleCredit + bonusCredit;
      if (buyerComp && buyerComp.cash >= saleCredit) buyerComp.cash -= saleCredit;
      if (sellerComp) {
        sellerComp.cash += totalPayout;
        sellerComp.stats.tradeVolume = (sellerComp.stats.tradeVolume || 0) + totalPayout;
        sellerComp.stats.deliveries = (sellerComp.stats.deliveries || 0) + 1;
      }
      if (p.deliveryId) {
        for (var di = 0; di < lState.deliveries.length; di++) {
          if (lState.deliveries[di].id === p.deliveryId) lState.deliveries[di].status = 'completed';
        }
      }
      p.status = 'completed';
      delete map[targetCid];
      return { ok: true, finalized: true, side: 'sell', payout: totalPayout, saleCredit: saleCredit, bonusCredit: bonusCredit, qty: p.depositedQty, pass: p };
    }

    // Buy side: pass closes cleanly upon leaving territory after picking up goods
    if (p.pickedUpQty > 0 || p.loadedInContainer) {
      if (p.deliveryId) {
        for (var dj = 0; dj < lState.deliveries.length; dj++) {
          if (lState.deliveries[dj].id === p.deliveryId) lState.deliveries[dj].status = 'completed';
        }
      }
      p.status = 'completed';
      delete map[targetCid];
      return { ok: true, finalized: true, side: 'buy', qty: p.pickedUpQty, pass: p };
    }
    p.status = 'left_without_pickup';
    delete map[targetCid];
    return { ok: true, finalized: false, side: 'buy', pass: p };
  }

  function createBuyOrderDelivery(lState, ottdState, buyerCid, sellerCid, itemId, qty, itemCost, speedBps, nowTick, stackSize) {
    ensureState(lState);
    var buyer = ottdState.companies[buyerCid];
    var seller = ottdState.companies[sellerCid];
    if (!buyer || !seller || buyerCid === sellerCid) return { ok: false, reason: 'bad_company' };
    var bTerm = global.LHOpenTTD.getCompanyTerminalCoords(ottdState, buyerCid);
    var sTerm = global.LHOpenTTD.getCompanyTerminalCoords(ottdState, sellerCid);
    var dist = computeDistance(bTerm.x, bTerm.z, sTerm.x, sTerm.z);
    var vol = computeCargoVolume(qty, stackSize);
    var spd = clampSpeed(speedBps);
    var subMod = getSubsidyModifiers(ottdState, buyerCid, buyer.hqSx, buyer.hqSz);
    var fee = Math.max(5, Math.round(computeDeliveryFee(dist, vol, spd) * subMod.deliveryFeeMult));
    var total = Math.max(1, Math.round(Number(itemCost || 0))) + fee;
    if (buyer.cash < total) return { ok: false, reason: 'no_cash', cost: total, fee: fee, cash: buyer.cash };

    buyer.cash -= total;
    seller.cash += Math.round(Number(itemCost || 0));
    buyer.stats.tradeVolume = (buyer.stats.tradeVolume || 0) + total;
    seller.stats.tradeVolume = (seller.stats.tradeVolume || 0) + Math.round(Number(itemCost || 0));
    var durationTicks = Math.max(200, Math.round((dist / spd) * 20));
    var rec = {
      id: 'D' + (lState.nextDeliverySeq++),
      mode: 'hired_delivery',
      side: 'buy',
      buyerCid: buyerCid,
      sellerCid: sellerCid,
      itemId: String(itemId),
      qty: Math.max(1, Math.round(Number(qty || 1))),
      volume: vol,
      distance: dist,
      speedBps: spd,
      deliveryFee: fee,
      itemCost: Math.round(Number(itemCost || 0)),
      startTick: Number(nowTick || 0),
      etaTick: Number(nowTick || 0) + durationTicks,
      destTerminal: bTerm,
      status: 'in_transit'
    };
    lState.deliveries.push(rec);
    return { ok: true, delivery: rec, totalCost: total, deliveryFee: fee, durationTicks: durationTicks };
  }

  function createBuyOrderOnHold(lState, ottdState, buyerCid, sellerCid, itemId, qty, itemCost, nowTick, stackSize) {
    ensureState(lState);
    var buyer = ottdState.companies[buyerCid];
    var seller = ottdState.companies[sellerCid];
    if (!buyer || !seller || buyerCid === sellerCid) return { ok: false, reason: 'bad_company' };
    var cost = Math.max(1, Math.round(Number(itemCost || 0)));
    if (buyer.cash < cost) return { ok: false, reason: 'no_cash', cost: cost, cash: buyer.cash };
    var bTerm = global.LHOpenTTD.getCompanyTerminalCoords(ottdState, buyerCid);
    var sTerm = global.LHOpenTTD.getCompanyTerminalCoords(ottdState, sellerCid);
    var dist = computeDistance(bTerm.x, bTerm.z, sTerm.x, sTerm.z);
    var vol = computeCargoVolume(qty, stackSize);
    var dailyFee = computeHoldDailyFee(vol);

    buyer.cash -= cost;
    seller.cash += cost;
    buyer.stats.tradeVolume = (buyer.stats.tradeVolume || 0) + cost;
    seller.stats.tradeVolume = (seller.stats.tradeVolume || 0) + cost;

    var rec = {
      id: 'D' + (lState.nextDeliverySeq++),
      mode: 'self_hold',
      side: 'buy',
      buyerCid: buyerCid,
      sellerCid: sellerCid,
      itemId: String(itemId),
      qty: Math.max(1, Math.round(Number(qty || 1))),
      volume: vol,
      distance: dist,
      itemCost: cost,
      holdDailyFee: dailyFee,
      lastHoldChargeTick: Number(nowTick || 0),
      holdDaysCharged: 0,
      holdFeesPaid: 0,
      sourceTerminal: sTerm,
      status: 'on_hold'
    };
    lState.deliveries.push(rec);
    return { ok: true, delivery: rec, holdDailyFee: dailyFee };
  }

  function chargeHoldDailyFees(lState, ottdState, nowTick) {
    ensureState(lState);
    var tick = Number(nowTick || 0);
    var events = [];
    for (var i = 0; i < lState.deliveries.length; i++) {
      var d = lState.deliveries[i];
      if (!d || d.status !== 'on_hold') continue;
      var elapsed = tick - Number(d.lastHoldChargeTick || 0);
      if (elapsed >= TICKS_PER_GAME_DAY) {
        var days = Math.floor(elapsed / TICKS_PER_GAME_DAY);
        d.lastHoldChargeTick += days * TICKS_PER_GAME_DAY;
        var buyer = ottdState.companies[d.buyerCid];
        var feeTotal = d.holdDailyFee * days;
        var paid = 0;
        if (buyer && buyer.cash > 0) {
          paid = Math.min(buyer.cash, feeTotal);
          buyer.cash -= paid;
        }
        d.holdDaysCharged = (d.holdDaysCharged || 0) + days;
        d.holdFeesPaid = (d.holdFeesPaid || 0) + paid;
        events.push({ deliveryId: d.id, buyerCid: d.buyerCid, days: days, fee: paid });
      }
    }
    return events;
  }

  function createSellOrderSelfDelivery(lState, ottdState, sellerCid, buyerCid, itemId, qty, saleRevenue, stackSize) {
    ensureState(lState);
    var seller = ottdState.companies[sellerCid];
    var buyer = ottdState.companies[buyerCid];
    if (!seller || !buyer || sellerCid === buyerCid) return { ok: false, reason: 'bad_company' };
    var sTerm = global.LHOpenTTD.getCompanyTerminalCoords(ottdState, sellerCid);
    var bTerm = global.LHOpenTTD.getCompanyTerminalCoords(ottdState, buyerCid);
    var dist = computeDistance(sTerm.x, sTerm.z, bTerm.x, bTerm.z);
    var vol = computeCargoVolume(qty, stackSize);
    var bonus = computeSelfDeliveryReward(dist, vol);
    var rec = {
      id: 'D' + (lState.nextDeliverySeq++),
      mode: 'self_delivery',
      side: 'sell',
      sellerCid: sellerCid,
      buyerCid: buyerCid,
      itemId: String(itemId),
      qty: Math.max(1, Math.round(Number(qty || 1))),
      volume: vol,
      distance: dist,
      saleRevenue: Math.max(1, Math.round(Number(saleRevenue || 1))),
      deliveryBonus: bonus,
      destTerminal: bTerm,
      status: 'awaiting_border_delivery'
    };
    lState.deliveries.push(rec);
    return { ok: true, delivery: rec, deliveryBonus: bonus };
  }

  function createSellOrderDelegated(lState, ottdState, sellerCid, buyerCid, itemId, qty, saleRevenue, buyerSpeedBps, nowTick, stackSize) {
    ensureState(lState);
    var seller = ottdState.companies[sellerCid];
    var buyer = ottdState.companies[buyerCid];
    if (!seller || !buyer || sellerCid === buyerCid) return { ok: false, reason: 'bad_company' };
    var sTerm = global.LHOpenTTD.getCompanyTerminalCoords(ottdState, sellerCid);
    var bTerm = global.LHOpenTTD.getCompanyTerminalCoords(ottdState, buyerCid);
    var dist = computeDistance(sTerm.x, sTerm.z, bTerm.x, bTerm.z);
    var vol = computeCargoVolume(qty, stackSize);
    var spd = clampSpeed(buyerSpeedBps || 12.0);
    var durationTicks = Math.max(200, Math.round((dist / spd) * 20));
    var rec = {
      id: 'D' + (lState.nextDeliverySeq++),
      mode: 'buyer_delegated',
      side: 'sell',
      sellerCid: sellerCid,
      buyerCid: buyerCid,
      itemId: String(itemId),
      qty: Math.max(1, Math.round(Number(qty || 1))),
      volume: vol,
      distance: dist,
      speedBps: spd,
      deliveryFee: 0,
      saleRevenue: Math.max(1, Math.round(Number(saleRevenue || 1))),
      startTick: Number(nowTick || 0),
      etaTick: Number(nowTick || 0) + durationTicks,
      sourceTerminal: sTerm,
      occupyingTerminal: true,
      status: 'waiting_pickup'
    };
    lState.deliveries.push(rec);
    return { ok: true, delivery: rec, durationTicks: durationTicks };
  }

  function tickDeliveries(lState, ottdState, nowTick) {
    ensureState(lState);
    var tick = Number(nowTick || 0);
    var arrivedBuy = [];
    var dueDelegatedSell = [];
    for (var i = 0; i < lState.deliveries.length; i++) {
      var d = lState.deliveries[i];
      if (!d) continue;
      if (d.status === 'in_transit' && tick >= Number(d.etaTick || 0)) {
        d.status = 'arrived_at_terminal';
        arrivedBuy.push(d);
      } else if (d.status === 'waiting_pickup' && tick >= Number(d.etaTick || 0)) {
        d.status = 'ready_for_pickup_drain';
        dueDelegatedSell.push(d);
      }
    }
    var holdEvents = chargeHoldDailyFees(lState, ottdState, tick);
    return { arrivedBuy: arrivedBuy, dueDelegatedSell: dueDelegatedSell, holdEvents: holdEvents };
  }

  return {
    MIN_DELIVERY_SPEED_BPS: MIN_DELIVERY_SPEED_BPS,
    MAX_DELIVERY_SPEED_BPS: MAX_DELIVERY_SPEED_BPS,
    TICKS_PER_GAME_DAY: TICKS_PER_GAME_DAY,
    SPEED_PRESETS: SPEED_PRESETS,
    VEHICLE_FLEET_SPECS: VEHICLE_FLEET_SPECS,
    createState: createState,
    ensureState: ensureState,
    clampSpeed: clampSpeed,
    computeCargoVolume: computeCargoVolume,
    computeDistance: computeDistance,
    computeDeliveryFee: computeDeliveryFee,
    computeSelfDeliveryReward: computeSelfDeliveryReward,
    computeHoldDailyFee: computeHoldDailyFee,
    isNearCompanyBorder: isNearCompanyBorder,
    requestBorderTradePass: requestBorderTradePass,
    getActiveBorderPass: getActiveBorderPass,
    hasActiveBorderPass: hasActiveBorderPass,
    completeBorderTradeOnLeave: completeBorderTradeOnLeave,
    createBuyOrderDelivery: createBuyOrderDelivery,
    createBuyOrderOnHold: createBuyOrderOnHold,
    chargeHoldDailyFees: chargeHoldDailyFees,
    createSellOrderSelfDelivery: createSellOrderSelfDelivery,
    createSellOrderDelegated: createSellOrderDelegated,
    tickDeliveries: tickDeliveries,
    getSubsidyModifiers: getSubsidyModifiers,
    matchVehicleItem: matchVehicleItem,
    hasTransportInfrastructure: hasTransportInfrastructure,
    registerCompanyConvoy: registerCompanyConvoy,
    listCompanyConvoys: listCompanyConvoys,
    planTransportPath: planTransportPath,
    computeAutomatedRouteCost: computeAutomatedRouteCost,
    createAutomatedRoute: createAutomatedRoute,
    createConvoyRoute: createConvoyRoute,
    dispatchConvoyRoute: dispatchConvoyRoute,
    toggleAutomatedRoute: toggleAutomatedRoute,
    deleteAutomatedRoute: deleteAutomatedRoute,
    tickAutomatedRoutes: tickAutomatedRoutes
  };
})();

global.LHHaggleEngine = (function () {
  var SCALE_PCTS = [-35, -20, -10, 0, 10, 20, 35];

  function createSession(id, mode, buyerCid, sellerCid, itemId, qty, marketTotal, opts) {
    var mTotal = Math.max(10, Math.round(Number(marketTotal || 100)));
    var minPrice = Math.max(5, Math.round(mTotal * 0.65));
    var maxPrice = Math.max(minPrice + 10, Math.round(mTotal * 1.35));
    var repScore = Number((opts && opts.repScore) || 0);
    // Bot reservation price depends on reputation
    var repShift = Math.max(-0.12, Math.min(0.12, -repScore / 800));
    var botReservation = (mode === 'vs_bot')
      ? (opts && opts.botSide === 'seller'
          ? Math.round(mTotal * (0.92 + repShift))
          : Math.round(mTotal * (1.08 - repShift)))
      : null;

    var buyerBid = Math.round(mTotal * 0.80);
    var sellerAsk = Math.round(mTotal * 1.25);
    if (opts && opts.initialBuyerBid > 0) buyerBid = Math.round(opts.initialBuyerBid);
    if (opts && opts.initialSellerAsk > 0) sellerAsk = Math.round(opts.initialSellerAsk);

    var scalePrices = SCALE_PCTS.map(function (pct) {
      return Math.max(1, Math.round(mTotal * (1 + pct / 100)));
    });

    return {
      id: id || 'H1',
      mode: mode || 'vs_bot', // 'vs_bot' | 'vs_player'
      botSide: (opts && opts.botSide) || 'seller', // 'seller' | 'buyer'
      buyerCid: buyerCid,
      sellerCid: sellerCid,
      itemId: String(itemId || 'minecraft:iron_ingot'),
      qty: Math.max(1, Math.round(Number(qty || 1))),
      marketTotal: mTotal,
      minPrice: minPrice,
      maxPrice: maxPrice,
      scalePrices: scalePrices,
      scalePcts: SCALE_PCTS.slice(),
      buyerBid: buyerBid,
      sellerAsk: sellerAsk,
      botReservation: botReservation,
      repScore: repScore,
      patience: 100,
      round: 0,
      maxRounds: 6,
      persuadeUsed: false,
      agreedPrice: null,
      status: 'active',
      lastMsg: 'Торг начат! Предложите цену по шкале или согласуйте компромисс.'
    };
  }

  function submitOffer(s, role, proposedPrice, opts) {
    if (!s || s.status !== 'active') return { ok: false, reason: 'not_active' };
    var p = Math.max(1, Math.round(Number(proposedPrice || s.marketTotal)));
    if (opts && opts.compromise) {
      p = Math.round((s.buyerBid + s.sellerAsk) / 2);
    }
    s.round += 1;

    if (role === 'buyer') s.buyerBid = p;
    else s.sellerAsk = p;

    if (s.mode === 'vs_player') {
      if (s.buyerBid >= s.sellerAsk) {
        s.agreedPrice = Math.round((s.buyerBid + s.sellerAsk) / 2);
        s.status = 'agreed';
        s.lastMsg = 'Обе стороны сошлись на цене ' + s.agreedPrice + ' Cr!';
        return { ok: true, agreed: true, price: s.agreedPrice, session: s };
      }
      if (s.round >= s.maxRounds * 2) {
        s.status = 'walked_away';
        s.lastMsg = 'Лимит раундов исчерпан без соглашения.';
        return { ok: true, agreed: false, walkedAway: true, session: s };
      }
      s.lastMsg = (role === 'buyer' ? 'Покупатель предложил ' : 'Продавец запросил ') + p + ' Cr.';
      return { ok: true, agreed: false, session: s };
    }

    // vs_bot evaluation
    var botIsSeller = s.botSide === 'seller';
    var playerOffer = p;
    var acceptable = botIsSeller ? (playerOffer >= s.botReservation) : (playerOffer <= s.botReservation);

    if (opts && opts.persuade && !s.persuadeUsed) {
      s.persuadeUsed = true;
      var bonusShift = Math.max(2, Math.round(s.marketTotal * 0.06));
      if (botIsSeller) s.botReservation = Math.max(s.minPrice, s.botReservation - bonusShift);
      else s.botReservation = Math.min(s.maxPrice, s.botReservation + bonusShift);
      acceptable = botIsSeller ? (playerOffer >= s.botReservation) : (playerOffer <= s.botReservation);
    }

    if (acceptable) {
      s.agreedPrice = playerOffer;
      s.status = 'agreed';
      s.lastMsg = 'Партнёр согласился на вашу цену: ' + s.agreedPrice + ' Cr!';
      return { ok: true, agreed: true, price: s.agreedPrice, session: s };
    }

    var gap = botIsSeller ? (s.botReservation - playerOffer) : (playerOffer - s.botReservation);
    var gapPct = gap / Math.max(1, s.marketTotal);
    var patienceDrop = Math.max(14, Math.round(16 + gapPct * 55 - Math.max(-10, Math.min(10, s.repScore / 8))));
    s.patience = Math.max(0, s.patience - patienceDrop);

    if (s.patience <= 0 || s.round >= s.maxRounds) {
      s.status = 'walked_away';
      s.lastMsg = 'Партнёр потерял терпение и прекратил торг.';
      return { ok: true, agreed: false, walkedAway: true, session: s };
    }

    // Bot concedes partway toward player's offer without crossing reservation
    if (botIsSeller) {
      var stepS = Math.max(2, Math.round((s.sellerAsk - s.botReservation) * 0.42));
      s.sellerAsk = Math.max(s.botReservation, s.sellerAsk - stepS);
      s.lastMsg = 'Бот снизил цену до ' + s.sellerAsk + ' Cr (терпение: ' + s.patience + '%).';
    } else {
      var stepB = Math.max(2, Math.round((s.botReservation - s.buyerBid) * 0.42));
      s.buyerBid = Math.min(s.botReservation, s.buyerBid + stepB);
      s.lastMsg = 'Бот поднял предложение до ' + s.buyerBid + ' Cr (терпение: ' + s.patience + '%).';
    }
    return { ok: true, agreed: false, session: s };
  }

  function acceptCurrentOffer(s, role) {
    if (!s || s.status !== 'active') return { ok: false, reason: 'not_active' };
    var accepted = (role === 'buyer') ? s.sellerAsk : s.buyerBid;
    s.agreedPrice = Math.max(1, Math.round(accepted));
    s.status = 'agreed';
    s.lastMsg = 'Предложение принято! Итоговая цена: ' + s.agreedPrice + ' Cr.';
    return { ok: true, agreed: true, price: s.agreedPrice, session: s };
  }

  return {
    SCALE_PCTS: SCALE_PCTS,
    createSession: createSession,
    submitOffer: submitOffer,
    acceptCurrentOffer: acceptCurrentOffer
  };
})();

global.LHP2PTradeEngine = (function () {
  var PROXIMITY_MAX_BLOCKS = 10;

  function createSession(id, uuidA, nameA, cidA, uuidB, nameB, cidB) {
    return {
      id: id || 'P2P1',
      sideA: {
        uuid: uuidA,
        name: nameA || 'Игрок A',
        cid: cidA || null,
        items: [], // [{ itemId, count }]
        currency: 0,
        confirmed: false
      },
      sideB: {
        uuid: uuidB,
        name: nameB || 'Игрок B',
        cid: cidB || null,
        items: [],
        currency: 0,
        confirmed: false
      },
      status: 'open',
      revision: 1
    };
  }

  function getSideKey(session, uuid) {
    if (!session) return null;
    if (session.sideA.uuid === uuid) return 'sideA';
    if (session.sideB.uuid === uuid) return 'sideB';
    return null;
  }

  function resetConfirmations(session) {
    session.sideA.confirmed = false;
    session.sideB.confirmed = false;
    session.revision = (session.revision || 1) + 1;
  }

  function addItemOffer(session, uuid, itemId, count) {
    if (!session || session.status !== 'open') return { ok: false, reason: 'closed' };
    var sk = getSideKey(session, uuid);
    if (!sk) return { ok: false, reason: 'not_participant' };
    var side = session[sk];
    var cnt = Math.max(1, Math.round(Number(count || 1)));
    var id = String(itemId);
    var merged = false;
    for (var i = 0; i < side.items.length; i++) {
      if (side.items[i].itemId === id) {
        side.items[i].count += cnt;
        merged = true;
        break;
      }
    }
    if (!merged) {
      if (side.items.length >= 12) return { ok: false, reason: 'grid_full' };
      side.items.push({ itemId: id, count: cnt });
    }
    resetConfirmations(session);
    return { ok: true, session: session };
  }

  function removeItemOffer(session, uuid, idx) {
    if (!session || session.status !== 'open') return { ok: false, reason: 'closed' };
    var sk = getSideKey(session, uuid);
    if (!sk) return { ok: false, reason: 'not_participant' };
    var side = session[sk];
    if (idx < 0 || idx >= side.items.length) return { ok: false, reason: 'bad_slot' };
    side.items.splice(idx, 1);
    resetConfirmations(session);
    return { ok: true, session: session };
  }

  function setCurrencyOffer(session, uuid, amount) {
    if (!session || session.status !== 'open') return { ok: false, reason: 'closed' };
    var sk = getSideKey(session, uuid);
    if (!sk) return { ok: false, reason: 'not_participant' };
    session[sk].currency = Math.max(0, Math.round(Number(amount || 0)));
    resetConfirmations(session);
    return { ok: true, currency: session[sk].currency, session: session };
  }

  function setConfirmed(session, uuid, flag) {
    if (!session || session.status !== 'open') return { ok: false, reason: 'closed' };
    var sk = getSideKey(session, uuid);
    if (!sk) return { ok: false, reason: 'not_participant' };
    session[sk].confirmed = !!flag;
    session.revision = (session.revision || 1) + 1;
    return {
      ok: true,
      bothConfirmed: !!(session.sideA.confirmed && session.sideB.confirmed),
      session: session
    };
  }

  function validateProximity(ax, ay, az, bx, by, bz, sameDim) {
    if (sameDim === false) return { ok: false, reason: 'wrong_dimension', dist: 999999 };
    var dx = Number(ax) - Number(bx);
    var dy = Number(ay) - Number(by);
    var dz = Number(az) - Number(bz);
    var dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return {
      ok: dist <= PROXIMITY_MAX_BLOCKS,
      reason: dist <= PROXIMITY_MAX_BLOCKS ? null : 'too_far',
      dist: Math.round(dist * 10) / 10,
      maxDist: PROXIMITY_MAX_BLOCKS
    };
  }

  return {
    PROXIMITY_MAX_BLOCKS: PROXIMITY_MAX_BLOCKS,
    createSession: createSession,
    getSideKey: getSideKey,
    addItemOffer: addItemOffer,
    removeItemOffer: removeItemOffer,
    setCurrencyOffer: setCurrencyOffer,
    setConfirmed: setConfirmed,
    validateProximity: validateProximity
  };
})();


