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
  var TOTAL_GATES = 6;
  var MAX_BORDER = 175000;

  function computeBorder(totalGates, unlockedCount) {
    var total = totalGates > 0 ? totalGates : TOTAL_GATES;
    var unlocked = unlockedCount > 0 ? unlockedCount : 0;
    var locked = total - unlocked;
    if (locked < 0) locked = 0;
    if (locked <= 1) {
      return { total: total, unlocked: unlocked, locked: locked, x: 1.0, size: MAX_BORDER };
    }
    var x = 2.0 - (1.0 / locked);
    var size = Math.round(Math.pow(MAX_BORDER, 1.0 / x));
    return { total: total, unlocked: unlocked, locked: locked, x: x, size: size };
  }

  return { TOTAL_GATES: TOTAL_GATES, MAX_BORDER: MAX_BORDER, computeBorder: computeBorder };
})();

global.LHDifficultyMath = (function () {
  // Time-weighted end-of-run target average deaths per online player:
  // (23*0.90 + 63*0.75 + 3*90*0.45) / (0.90 + 0.75 + 3*0.45) = 189.45 / 3.00 = 63.15
  var TARGET_AVG_DEATHS = 63.15;
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
  { id: 'ore_scarcity', name: 'Рудный голод', icon: '⛏', color: 'gold', summary: 'Руды вне богатых жил теряют 50% добычи без Шёлкового касания — ищите жилы через /lh prospect и буры.' },
  { id: 'wood_scarcity', name: 'Дефицит леса', icon: '🪓', color: 'dark_green', summary: 'Саженцы отключены, а 40% срубленных брёвен рассыпается — стройте линии в новые леса.' },
  { id: 'smarter_mobs', name: 'Тактический ИИ мобов', icon: '🧠', color: 'red', summary: 'Враждебные мобы получают ускорение, усиленное чутьё и тактические баффы.' },
  { id: 'immortal_snail', name: 'Бессмертная Улитка', icon: '🐌', color: 'dark_red', summary: 'Неуязвимая Улитка пробуждается и бесконечно ползёт к вам сквозь стены (/lh snail status).' },
  { id: 'voidout_explosion', name: 'Сингулярный выброс', icon: '💥', color: 'dark_purple', summary: 'Каждая смерть вызывает взрыв Voidout силой 1.0 * k (растёт от коэффициента сложности без капа).' },
  { id: 'toxic_gas', name: 'Сезонный токсичный газ', icon: '☣', color: 'green', summary: 'Раз в 4 дня ядовитый туман поднимается до Y=114 — спасайтесь на горах и летающих островах.' },
  { id: 'random_respawn', name: 'Случайный спаун', icon: '🧭', color: 'aqua', summary: 'После смерти вы возрождаетесь в случайной точке вокруг спауна (радиус = 20203 * k / 96).' },
  { id: 'death_item_loss', name: 'Распад инвентаря', icon: '🗑', color: 'dark_red', summary: 'После гибели случайная часть предметов в инвентаре безвозвратно исчезает (доля растёт с k).' },
  { id: 'acid_pollution', name: 'Кислотный смог', icon: '🌫', color: 'gray', summary: 'Тяжёлый дым промышленных зон и низин (Y<92) вызывает слабость без шлема и дымоходов.' },
  { id: 'hostile_nights', name: 'Кровавые ночи', icon: '🌙', color: 'dark_red', summary: 'Ночные монстры на поверхности появляются с Силой и огнестойкостью — обустраивайте укрытия.' },
  { id: 'hunger_exhaustion', name: 'Экспедиционный голод', icon: '🍖', color: 'yellow', summary: 'Долгий бег ускоряет расход сытости — используйте транспорт, поезда и рационы.' },
  { id: 'tool_wear', name: 'Хрупкость инструментов', icon: '⚒', color: 'aqua', summary: 'Вдали от дома (>400 м) инструменты изнашиваются быстрее — переходите на механизмы Create.' },
  { id: 'radiation_fallout', name: 'Радиационный фон', icon: '☢', color: 'light_purple', summary: 'Глубокие шахты (Y<20) накапливают усталость без защитного нагрудника.' },
  { id: 'overload_encumbrance', name: 'Гравитационный перегруз', icon: '🪨', color: 'gold', summary: 'Более 24 занятых слотов в инвентаре замедляют шаг — возите грузы вагонетками и транспортом!' },
  { id: 'cold_altitude_frost', name: 'Высотный мороз', icon: '❄', color: 'aqua', summary: 'На высоте Y>=120 без полной брони или тепла в руке накапливается обморожение.' },
  { id: 'machine_sabotage_lightning', name: 'Магнитные грозы', icon: '⚡', color: 'yellow', summary: 'Во время грозы и дождя под открытым небом бьют молнии — стройте крыши и громоотводы.' },
  { id: 'abyssal_pressure', name: 'Глубинная баротравма', icon: '🕳', color: 'dark_gray', summary: 'Ниже Y=0 без источника света в руках накатывает Тьма и давление недр.' },
  { id: 'toxic_rain_corrosion', name: 'Кислотные осадки', icon: '🌧', color: 'dark_green', summary: 'Дождь под открытым небом разъедает броню и наносит слабый урон — стройте навесы и кабины.' },
  { id: 'spore_spoilage', name: 'Брожение провианта', icon: '🍄', color: 'green', summary: 'В сырых низинах (Y<68) при уроне сырая еда портится — готовьте полноценные блюда и консервы.' },
  { id: 'insomnia_ambush', name: 'Сингулярная бессонница', icon: '👁', color: 'dark_purple', summary: 'Ночью под открытым небом к одиноким путникам притягиваются засады фантомов и нежити.' }
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
      hqSx: 1,
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
      hqSx: -1,
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
      hqSz: -1,
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
      marketOrders: [],
      tradeOffers: [],
      nextOrderSeq: 1,
      subsidy: null,
      botCycle: 0
    };
    ensureBots(st);
    return st;
  }

  function ensureBots(state) {
    if (!state.companies) state.companies = {};
    if (!state.claims) state.claims = {};
    if (!state.pacts) state.pacts = {};
    if (!state.playerCompany) state.playerCompany = {};
    if (!state.marketOrders) state.marketOrders = [];
    if (!state.tradeOffers) state.tradeOffers = [];

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
    var s = c.stats || {};
    return Math.round(
      Number(c.cash || 0) +
      claims * 300 +
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

  function computeClaimCost(state, cid, sx, sz) {
    var c = state.companies && state.companies[cid];
    if (!c) return { ok: false, reason: 'no_company', cost: BASE_CLAIM_COST };
    var ownerInfo = resolveSectorOwner(state, sx, sz);
    var tSpec = c.transportSpec ? TRANSPORT_SPECS[c.transportSpec] : null;
    var disc = tSpec ? Number(tSpec.claimDiscount || 0) : 0;
    var adj = isAdjacentOwned(state, cid, sx, sz) ? 0.20 : 0.0;
    var mult = Math.max(0.40, 1.0 - disc - adj);

    if (ownerInfo.kind === 'claimed') {
      if (ownerInfo.owner === cid) return { ok: false, reason: 'already_yours', cost: 0 };
      var baseTakeover = ownerInfo.isHq ? 600 : (225 * ownerInfo.strength);
      return {
        ok: true,
        mode: 'capture',
        targetOwner: ownerInfo.owner,
        strength: ownerInfo.strength,
        cost: Math.round(baseTakeover * mult)
      };
    }
    return {
      ok: true,
      mode: 'claim',
      targetOwner: ownerInfo.owner,
      strength: 1,
      cost: Math.round(BASE_CLAIM_COST * mult)
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

  function claimOrCaptureSector(state, cid, sx, sz, allowCapture) {
    var comp = state.companies[cid];
    if (!comp) return { ok: false, reason: 'no_company' };
    var info = computeClaimCost(state, cid, sx, sz);
    if (!info.ok) return info;
    if (info.mode === 'capture' && !allowCapture) return { ok: false, reason: 'enemy_claimed', targetOwner: info.targetOwner, cost: info.cost };
    if (comp.cash < info.cost) return { ok: false, reason: 'no_cash', cost: info.cost, cash: comp.cash };

    comp.cash -= info.cost;
    if (info.mode === 'capture' && info.targetOwner && state.companies[info.targetOwner]) {
      // Pay 50% compensation into rival company's balance in hostile buyout
      state.companies[info.targetOwner].cash += Math.round(info.cost * 0.5);
    }
    var k = sectorKey(sx, sz);
    state.claims[k] = { sx: sx, sz: sz, owner: cid, strength: 1, isHq: false };
    comp.stats.sectorsCaptured = (comp.stats.sectorsCaptured || 0) + 1;
    return { ok: true, mode: info.mode, cost: info.cost, key: k, previousOwner: info.targetOwner };
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
      var income = 85 + ownedCount * 42;
      bot.cash += income;
      bot.stats.deliveries += 1;

      if (bot.cash >= 420) {
        // Pick an unclaimed sector adjacent to an owned sector within active worldborder
        var candidates = [];
        var claimKeys = Object.keys(state.claims);
        var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (var k = 0; k < claimKeys.length; k++) {
          var cl = state.claims[claimKeys[k]];
          if (!cl || cl.owner !== bot.id) continue;
          for (var d = 0; d < dirs.length; d++) {
            var nsx = cl.sx + dirs[d][0];
            var nsz = cl.sz + dirs[d][1];
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
    sectorCoords: sectorCoords,
    sectorKey: sectorKey,
    sanitizeId: sanitizeId,
    createInitialState: createInitialState,
    ensureBots: ensureBots,
    hasPact: hasPact,
    togglePact: togglePact,
    countClaims: countClaims,
    computeValuation: computeValuation,
    resolveSectorOwner: resolveSectorOwner,
    computeClaimCost: computeClaimCost,
    companyCreate: companyCreate,
    companyJoin: companyJoin,
    companyLeave: companyLeave,
    setSpecialization: setSpecialization,
    claimOrCaptureSector: claimOrCaptureSector,
    fortifySector: fortifySector,
    botExpandStep: botExpandStep,
    refreshBotOrders: refreshBotOrders,
    renderAsciiMap: renderAsciiMap
  };
})();

