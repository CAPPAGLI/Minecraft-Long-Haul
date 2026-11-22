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

global.LHVoidoutMath = (function () {
  var BASE_STRENGTH = 12.0;
  var MAX_PRIMARY_STRENGTH = 96.0;

  function computePower(deathCount) {
    if (!(deathCount >= 1)) {
      return { deathCount: 0, raw: 0, primary: 0, shockwaves: 0 };
    }
    var raw = BASE_STRENGTH * Math.pow(2, deathCount - 1);
    var primary = raw > MAX_PRIMARY_STRENGTH ? MAX_PRIMARY_STRENGTH : raw;
    var shockwaves = raw > MAX_PRIMARY_STRENGTH
      ? Math.min(6, Math.floor(Math.log(raw / MAX_PRIMARY_STRENGTH) / Math.log(2)) * 2)
      : 0;
    return { deathCount: deathCount, raw: raw, primary: primary, shockwaves: shockwaves };
  }

  return { BASE_STRENGTH: BASE_STRENGTH, MAX_PRIMARY_STRENGTH: MAX_PRIMARY_STRENGTH, computePower: computePower };
})();

global.LHHardFeatureCatalog = [
  { id: 'ore_scarcity', name: 'Рудный голод', icon: '⛏', color: 'gold', summary: 'Руды вне богатых жил теряют 50% добычи без Шёлкового касания — ищите жилы через /lh prospect и буры.' },
  { id: 'wood_scarcity', name: 'Дефицит леса', icon: '🪓', color: 'dark_green', summary: 'Саженцы отключены, а 40% срубленных брёвен рассыпается — стройте линии в новые леса.' },
  { id: 'smarter_mobs', name: 'Тактический ИИ мобов', icon: '🧠', color: 'red', summary: 'Враждебные мобы получают ускорение, усиленное чутьё и тактические баффы.' },
  { id: 'immortal_snail', name: 'Бессмертная Улитка', icon: '🐌', color: 'dark_red', summary: 'Неуязвимая Улитка пробуждается и бесконечно ползёт к вам сквозь стены (/lh snail status).' },
  { id: 'voidout_explosion', name: 'Сингулярный выброс', icon: '💥', color: 'dark_purple', summary: 'Каждая смерть вызывает взрыв Voidout, сила которого УДВАИВАЕТСЯ с каждой смертью.' },
  { id: 'toxic_gas', name: 'Сезонный токсичный газ', icon: '☣', color: 'green', summary: 'Раз в 4 дня ядовитый туман поднимается до Y=114 — спасайтесь на горах и летающих островах.' },
  { id: 'acid_pollution', name: 'Кислотный смог', icon: '🌫', color: 'gray', summary: 'Тяжёлый дым промышленных зон и открытый огонь вызывают удушье без защиты головы/дымоходов.' },
  { id: 'hostile_nights', name: 'Кровавые ночи', icon: '🌙', color: 'dark_red', summary: 'Ночные монстры на поверхности появляются с Силой и огнестойкостью — обустраивайте укрытия.' },
  { id: 'hunger_exhaustion', name: 'Экспедиционный голод', icon: '🍖', color: 'yellow', summary: 'Долгий бег ускоряет расход сытости; сырая пища ослабляет — переходите на рационы.' },
  { id: 'tool_wear', name: 'Хрупкость инструментов', icon: '⚒', color: 'aqua', summary: 'Вдали от дома (>400 м) кустарные инструменты изнашиваются быстрее — используйте Tetra и Create.' },
  { id: 'radiation_fallout', name: 'Радиационный фон', icon: '☢', color: 'light_purple', summary: 'Глубокие шахты (Y<24) накапливают радиационную усталость без защитной брони.' }
];

