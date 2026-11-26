// Long Haul Legacy 2.0: Interactive Chest GUI Command Center (/lh, /lh gui, longhaul:control_tablet)
// Server-authoritative multi-tab UI covering every /lh subsystem without client-server desync.

var LHGuiStrArg = Java.loadClass('com.mojang.brigadier.arguments.StringArgumentType');
var LHGuiMapView = {};

function lhGuiGetMapView(player) {
  var pid = typeof lhId === 'function' ? lhId(player) : String(player.uuid || player.username || 'p');
  var sc = global.LHOpenTTD ? global.LHOpenTTD.sectorCoords(player.x, player.z) : { sx: 0, sz: 0 };
  if (!LHGuiMapView[pid]) {
    LHGuiMapView[pid] = { cx: sc.sx, cz: sc.sz, zoom: 1, selSx: sc.sx, selSz: sc.sz };
  }
  return LHGuiMapView[pid];
}

var LH_GUI_TABS = [
  { id: 'hub', label: 'Обзор' },
  { id: 'chapters', label: 'Вилка глав' },
  { id: 'contracts', label: 'Контракты' },
  { id: 'sites', label: 'Узлы' },
  { id: 'logistics', label: 'Логистика' },
  { id: 'recovery', label: 'Восст. и Заказы' },
  { id: 'openttd', label: 'Компании' },
  { id: 'buildings', label: 'Здания' },
  { id: 'diplomacy', label: 'Дипломатия' },
  { id: 'territory', label: 'Карта 9x5' },
  { id: 'market', label: 'Биржа' },
  { id: 'bank', label: 'Банк и Налоги' },
  { id: 'pirates', label: 'Корсары и Караваны' },
  { id: 'events', label: 'События' },
  { id: 'world', label: 'Мир и Угрозы' },
  { id: 'help', label: 'Справка' }
];

var LH_CONTRACT_ICONS = {
  plates: 'create:iron_sheet',
  brass: 'create:brass_ingot',
  rails: 'create:track',
  provisions: 'minecraft:bread',
  mechanisms: 'create:precision_mechanism',
  plate_shift: 'minecraft:clock',
  food_shift: 'minecraft:baked_potato',
  rail_shift: 'minecraft:powered_rail'
};

var LH_SITE_ICONS = {
  forest: 'minecraft:oak_log',
  farm: 'minecraft:wheat',
  mine: 'minecraft:iron_ore',
  port: 'minecraft:oak_boat',
  badlands: 'minecraft:terracotta',
  smelter: 'minecraft:blast_furnace',
  wetland: 'minecraft:bucket',
  machine: 'create:cogwheel'
};

var LH_REC_ICONS = {
  sawmill: 'create:mechanical_saw',
  quarry: 'create:mechanical_drill',
  river_port: 'create:portable_storage_interface',
  sorting_yard: 'create:brass_funnel',
  power_plant: 'create:steam_engine',
  collapsed_bridge: 'create:track'
};

var LH_COMP_WOOL = {
  dark_green: 'minecraft:green_wool',
  green: 'minecraft:lime_wool',
  aqua: 'minecraft:cyan_wool',
  blue: 'minecraft:blue_wool',
  gold: 'minecraft:orange_wool',
  yellow: 'minecraft:yellow_wool',
  red: 'minecraft:red_wool',
  light_purple: 'minecraft:magenta_wool',
  white: 'minecraft:white_wool',
  gray: 'minecraft:light_gray_wool',
  dark_gray: 'minecraft:gray_wool'
};

function lhGuiSafeIcon(iconId) {
  try {
    var st = Item.of(String(iconId || 'minecraft:paper'));
    if (st && !st.empty) return String(iconId);
  } catch (e) {}
  return 'minecraft:paper';
}

function lhGuiItem(iconId, title, loreLines, count) {
  var safeId = lhGuiSafeIcon(iconId);
  var qty = Math.max(1, Math.min(64, Math.floor(Number(count || 1))));
  var st = Item.of(safeId, qty);
  try {
    st = st.withName(Text.of(String(title || '')));
  } catch (eName) {}
  if (loreLines && loreLines.length) {
    try {
      var comps = [];
      for (var i = 0; i < loreLines.length; i++) {
        comps.push(Text.of(String(loreLines[i])));
      }
      st = st.withLore(comps);
    } catch (eLoreArr) {
      try {
        for (var j = 0; j < loreLines.length; j++) {
          st = st.withLore(Text.of(String(loreLines[j])));
        }
      } catch (eLoreOne) {}
    }
  }
  return st;
}

function lhGuiClose(player) {
  if (!player) return;
  try {
    if (typeof player.closeContainer === 'function') player.closeContainer();
    else if (typeof player.closeMenu === 'function') player.closeMenu();
  } catch (eClose) {}
}

function lhGuiDeferAction(server, player, fn, reopenTab, reopenArg) {
  lhGuiClose(player);
  if (server && typeof server.scheduleInTicks === 'function') {
    server.scheduleInTicks(2, function () {
      try {
        if (typeof fn === 'function') fn(player);
      } catch (eFn) {}
      if (reopenTab) {
        server.scheduleInTicks(2, function () {
          try { lhOpenGui(server, player, reopenTab, reopenArg); } catch (eRe) {}
        });
      }
    });
  } else {
    if (typeof fn === 'function') fn(player);
    if (reopenTab) lhOpenGui(server, player, reopenTab, reopenArg);
  }
}

function lhGuiSlot(gui, x, y, iconId, title, loreLines, onLeft, onRight, count) {
  var slot = gui.getSlot(x, y);
  slot.setItem(lhGuiItem(iconId, title, loreLines, count));
  if (typeof slot.resetClickHandlers === 'function') {
    slot.resetClickHandlers();
  }
  var fire = function (fn, click) {
    if (click && typeof click.setHandled === 'function') click.setHandled();
    if (click && click.slot && click.slot.gui) {
      try { click.slot.gui.mouseItem = Item.of('minecraft:air'); } catch (eMouse) {}
    }
    var p = click && click.slot && click.slot.gui ? click.slot.gui.player : null;
    if (p && typeof fn === 'function') fn(p, click);
  };
  slot.setLeftClicked(function (click) {
    fire(onLeft, click);
  });
  slot.setRightClicked(function (click) {
    fire(typeof onRight === 'function' ? onRight : onLeft, click);
  });
  slot.setShiftLeftClicked(function (click) {
    fire(onLeft, click);
  });
  if (typeof slot.setShiftRightClicked === 'function') {
    slot.setShiftRightClicked(function (click) {
      fire(typeof onRight === 'function' ? onRight : onLeft, click);
    });
  }
  if (typeof slot.setMiddleClicked === 'function') {
    slot.setMiddleClicked(function (click) {
      fire(onLeft, click);
    });
  }
  if (typeof slot.setDoubleClicked === 'function') {
    slot.setDoubleClicked(function (click) {
      fire(onLeft, click);
    });
  }
  if (typeof slot.setSwapped === 'function') {
    slot.setSwapped(function (click) {
      if (click && typeof click.setHandled === 'function') click.setHandled();
    });
  }
  if (typeof slot.setThrown === 'function') {
    slot.setThrown(function (click) {
      if (click && typeof click.setHandled === 'function') click.setHandled();
    });
  }
}

function lhGuiFillBg(gui, rows) {
  for (var y = 0; y < rows; y++) {
    for (var x = 0; x < 9; x++) {
      var s = gui.getSlot(x, y);
      s.setItem(lhGuiItem('minecraft:gray_stained_glass_pane', ' ', [], 1));
      if (typeof s.resetClickHandlers === 'function') {
        s.resetClickHandlers();
      }
    }
  }
  gui.anyClicked = function (c) {
    if (c && typeof c.setHandled === 'function') c.setHandled();
    try { gui.mouseItem = Item.of('minecraft:air'); } catch (eMouse) {}
  };
  gui.inventoryClicked = function (c) { if (c && c.setHandled) c.setHandled(); };
}

function lhGuiFooter(gui, server, tab, arg) {
  lhGuiSlot(gui, 0, 5, 'minecraft:arrow', '§e◀ Главное меню', ['§7Вернуться на обзорную панель Long Haul'], function (p) {
    lhOpenGui(server, p, 'hub');
  });
  lhGuiSlot(gui, 1, 5, 'minecraft:enchanted_book', '§6Вилка глав', ['§7Выбор из 3 случайных глав по тиру'], function (p) {
    lhOpenGui(server, p, 'chapters');
  });
  lhGuiSlot(gui, 2, 5, 'minecraft:emerald', '§aКомпании', ['§7Управление компанией и специализациями'], function (p) {
    lhOpenGui(server, p, 'openttd');
  });
  lhGuiSlot(gui, 3, 5, 'minecraft:filled_map', '§bКарта 9×5', ['§7Увеличенная карта секторов + зум + миникарта'], function (p) {
    lhOpenGui(server, p, 'territory');
  });
  lhGuiSlot(gui, 4, 5, 'minecraft:sunflower', '§6🔄 Обновить', ['§7Перезагрузить актуальные данные экрана'], function (p) {
    lhOpenGui(server, p, tab, arg);
  });
  lhGuiSlot(gui, 5, 5, 'minecraft:blast_furnace', '§eЗдания', ['§7Строительство и 2-путная вилка прокачки'], function (p) {
    lhOpenGui(server, p, 'buildings');
  });
  lhGuiSlot(gui, 6, 5, 'minecraft:globe_banner_pattern', '§dДипломатия', ['§7Союзы, лицензии, поставки и покупка земли'], function (p) {
    lhOpenGui(server, p, 'diplomacy');
  });
  lhGuiSlot(gui, 7, 5, 'minecraft:gold_ingot', '§eБиржа', ['§7Биржа заказов и P2P-сделки'], function (p) {
    lhOpenGui(server, p, 'market');
  });
  lhGuiSlot(gui, 8, 5, 'minecraft:barrier', '§c✖ Закрыть', ['§7Закрыть терминал Long Haul'], function (p) {
    if (typeof p.closeContainer === 'function') p.closeContainer();
    else if (typeof p.closeMenu === 'function') p.closeMenu();
  });
}

function lhGuiDistStr(player, x, z) {
  var dx = Math.round(Number(x) - Number(player.x));
  var dz = Math.round(Number(z) - Number(player.z));
  var dist = Math.round(Math.sqrt(dx * dx + dz * dz));
  var dir = typeof lhBearing === 'function' ? lhBearing(dx, dz) : '';
  return dist + ' м (' + dir + ')';
}

function lhGuiSnapshot(server, player, tab, arg) {
  var progDb = typeof lhProgRead === 'function' ? lhProgRead(server) : { featureOrder: [], chapters: {} };
  var diff = typeof lhDifficultyStatus === 'function' ? lhDifficultyStatus(server) : { coeff: 1.0, onlineDeaths: 0, onlinePlayers: 1 };
  var border = typeof lhApplyTerritoryBorder === 'function' ? lhApplyTerritoryBorder(server, false) : { size: 724, unlocked: 0, total: 61 };
  var chap = typeof lhChapterProgressSummary === 'function' ? lhChapterProgressSummary(server) : { doneMain: 0, totalMain: 61, currentLabel: 'Старт' };
  var totalPool = (typeof global !== 'undefined' && global.LHHardFeatureCatalog) ? global.LHHardFeatureCatalog.length : 100;
  var ottd = typeof lhOttdRead === 'function' ? lhOttdRead(server) : { companies: {}, marketOrders: [], tradeOffers: [] };
  var comp = typeof lhGetPlayerCompany === 'function' ? lhGetPlayerCompany(server, player) : null;
  var sc = global.LHOpenTTD ? global.LHOpenTTD.sectorCoords(player.x, player.z) : { sx: 0, sz: 0 };
  return {
    tab: String(tab || 'hub'),
    arg: arg || null,
    coeff: Math.round((diff.coeff || 1) * 100) / 100,
    borderSize: border.size || 724,
    unlocked: border.unlocked || 0,
    totalChapters: chap.totalMain || 61,
    doneChapters: chap.doneMain || 0,
    currentChapter: chap.currentLabel || 'Старт',
    hazardsCount: (progDb.featureOrder || []).length,
    hazardsTotal: totalPool,
    company: comp ? { id: comp.id, name: comp.name, cash: comp.cash } : null,
    sector: sc
  };
}

function lhGuiRenderHub(gui, server, player) {
  var snap = lhGuiSnapshot(server, player, 'hub');
  var cDb = typeof lhRead === 'function' ? lhRead(server) : { players: {}, teams: {} };
  var prof = typeof lhProfile === 'function' ? lhProfile(server, player) : { terminal: null, job: null, receipts: {} };
  var sitesDb = typeof lhSitesRead === 'function' ? lhSitesRead(server) : { sites: {} };
  var recDb = typeof lhRecRead === 'function' ? lhRecRead(server) : { items: {} };
  var logDb = typeof lhLogRead === 'function' ? lhLogRead(server) : { camps: {}, routes: {}, manifests: {} };
  var evDb = typeof lhEventsRead === 'function' ? lhEventsRead(server) : { events: [], playerPrefs: {} };
  var st = typeof lhOttdRead === 'function' ? lhOttdRead(server) : { companies: {}, marketOrders: [], tradeOffers: [] };

  var commSites = 0;
  Object.keys(sitesDb.sites || {}).forEach(function (k) { if (sitesDb.sites[k] && sitesDb.sites[k].commissioned) commSites++; });
  var restRec = 0;
  Object.keys(recDb.items || {}).forEach(function (k) { if (recDb.items[k] && recDb.items[k].restored) restRec++; });
  var openMkt = (st.marketOrders || []).filter(function (o) { return o.remainingBatches > 0; }).length;
  var activeJob = prof.job && prof.job.status === 'active' ? prof.job.id : 'нет';

  lhGuiSlot(gui, 4, 0, 'minecraft:beacon', '§6✦ Центр управления Long Haul 2.0', [
    '§fГлавы: §a' + snap.doneChapters + '/' + snap.totalChapters + ' §7(' + snap.currentChapter + ')',
    '§fГраница мира: §b' + snap.borderSize + '×' + snap.borderSize + ' §7(±' + Math.round(snap.borderSize / 2) + ' м)',
    '§fСложность: §ek=' + snap.coeff + ' §7| Угроз: §c' + snap.hazardsCount + '/' + (snap.hazardsTotal || 100),
    snap.company
      ? ('§fКомпания: §a' + snap.company.name + ' §7| Касса: §e' + snap.company.cash + ' Cr')
      : '§7Компания: не выбрана (откройте «Компании OpenTTD»)',
    '§7Ваш сектор: §f(' + snap.sector.sx + ', ' + snap.sector.sz + ')'
  ]);

  lhGuiSlot(gui, 1, 1, 'minecraft:barrel', '§6Контракты и терминал', [
    '§fТерминал: ' + (prof.terminal ? ('§a' + prof.terminal.x + ',' + prof.terminal.y + ',' + prof.terminal.z) : '§cне привязан'),
    '§fАктивный заказ: §e' + activeJob,
    '§fВыполнено контрактов: §a' + Object.keys(prof.receipts || {}).length + '/8',
    '§e▶ Нажмите, чтобы открыть'
  ], function (p) { lhOpenGui(server, p, 'contracts'); });

  lhGuiSlot(gui, 3, 1, 'minecraft:compass', '§bУзлы и производство', [
    '§fЗапущено объектов: §a' + commSites + '/' + Object.keys(sitesDb.sites || {}).length,
    '§7Координаты 8 узлов, Архива и Хаба,',
    '§7запуск, производство, фото и CC-проверки.',
    '§e▶ Нажмите, чтобы открыть'
  ], function (p) { lhOpenGui(server, p, 'sites'); });

  lhGuiSlot(gui, 5, 1, 'minecraft:minecart', '§aЛагеря, маршруты и грузы', [
    '§fЛагерей: §e' + Object.keys(logDb.camps || {}).length + ' §7| Маршрутов: §e' + Object.keys(logDb.routes || {}).length,
    '§7Развернуть/свернуть лагерь, поставить ворота,',
    '§7запустить триал маршрута, сдать накладную.',
    '§e▶ Нажмите, чтобы открыть'
  ], function (p) { lhOpenGui(server, p, 'logistics'); });

  lhGuiSlot(gui, 7, 1, 'minecraft:anvil', '§fВосстановление и Заказы', [
    '§fВосстановлено объектов: §a' + restRec + '/6',
    '§7Разведка/ремонт 6 заброшенных объектов,',
    '§7проверка этапа, каталога и транспорта.',
    '§e▶ Нажмите, чтобы открыть'
  ], function (p) { lhOpenGui(server, p, 'recovery'); });

  var cbBank = global.LHOpenTTD && global.LHOpenTTD.updateCentralBankKeyRate ? global.LHOpenTTD.updateCentralBankKeyRate(st) : { keyRate: 0.08 };
  var psHub = global.LHOpenTTD && global.LHOpenTTD.ensurePirateSyndicate ? global.LHOpenTTD.ensurePirateSyndicate(st) : { level: 1, caravansRobbed: 0 };
  var myDebtHub = (snap.company && global.LHOpenTTD && global.LHOpenTTD.getCompanyActiveDebt) ? global.LHOpenTTD.getCompanyActiveDebt(st, snap.company.id) : 0;

  lhGuiSlot(gui, 2, 2, 'minecraft:gold_block', '§e🏛 Банк, Налоги, Акции и Камбэк', [
    '§fСтавка ЦБ: §e' + Math.round((cbBank.keyRate || 0.08) * 1000) / 10 + '% §7| Ваш долг: §c' + myDebtHub + ' Cr',
    '§7Кредиты под ставку, прогрессивные налоги,',
    '§7покупка акций (до 49%), уклонение и камбэк.',
    '§e▶ Нажмите, чтобы открыть'
  ], function (p) { lhOpenGui(server, p, 'bank'); });

  lhGuiSlot(gui, 6, 2, 'minecraft:crossbow', '§6☠ Синдикат Корсаров и Караваны', [
    '§fУровень корсаров: §cУр.' + (psHub.level || 1) + ' §7| Ограблений: §c' + (psHub.caravansRobbed || 0),
    '§7Охрана караванов, чёрный рынок лута,',
    '§7анонимные заказные налёты на конкурентов.',
    '§e▶ Нажмите, чтобы открыть'
  ], function (p) { lhOpenGui(server, p, 'pirates'); });

  lhGuiSlot(gui, 1, 3, 'minecraft:emerald', '§aOpenTTD: Компании и Пакты', [
    snap.company ? ('§fВаша компания: §a' + snap.company.name + ' (' + snap.company.cash + ' Cr)') : '§cВы не состоите в компании',
    '§7Основать или вступить, выбрать специализации,',
    '§7подписать торговый пакт, рейтинг ботов.',
    '§e▶ Нажмите, чтобы открыть'
  ], function (p) { lhOpenGui(server, p, 'openttd'); });

  lhGuiSlot(gui, 3, 3, 'minecraft:filled_map', '§bКарта секторов 9×5 + Зум + Миникарта', [
    '§fВы в секторе: §e(' + snap.sector.sx + ', ' + snap.sector.sz + ')',
    '§7Увеличенная карта (9×5 клеток, масштаб 1×/2×/4×),',
    '§7сдвиг камеры, постройки и HUD-миникарта.',
    '§e▶ Нажмите, чтобы открыть'
  ], function (p) { lhOpenGui(server, p, 'territory'); });

  lhGuiSlot(gui, 5, 3, 'minecraft:gold_ingot', '§6Биржа и P2P-сделки', [
    '§fАктивных лотов на бирже: §e' + openMkt,
    '§fОткрытых сделок компаний: §b' + (st.tradeOffers || []).filter(function (o) { return o.status === 'open'; }).length,
    '§7Покупайте и продавайте партии в один клик!',
    '§e▶ Нажмите, чтобы открыть'
  ], function (p) { lhOpenGui(server, p, 'market'); });

  lhGuiSlot(gui, 7, 3, 'minecraft:writable_book', '§dЛог событий и фильтры чата', [
    '§fЗаписей в журнале: §e' + (evDb.events || []).length,
    '§7Просмотр событий ботов, биржи, рейдов, угроз',
    '§7и быстрое переключение режима чата.',
    '§e▶ Нажмите, чтобы открыть'
  ], function (p) { lhOpenGui(server, p, 'events', 'all'); });

  lhGuiSlot(gui, 0, 4, 'minecraft:enchanted_book', '§6Вилка глав (3 случайные)', [
    '§7Ранний -> Средний -> Поздний тир.',
    '§7Выбирайте 1 из 3 случайных глав!',
    '§e▶ Нажмите, чтобы открыть'
  ], function (p) { lhOpenGui(server, p, 'chapters'); });

  lhGuiSlot(gui, 2, 4, 'minecraft:nether_star', '§cМир, угрозы и вехи', [
    '§7Рудоразведка, Улитка, Токсичный газ, Voidout,',
    '§7Сложность k, Колесо Угроз, Правила, Ядерка, DOOMED.',
    '§e▶ Нажмите, чтобы открыть'
  ], function (p) { lhOpenGui(server, p, 'world'); });

  lhGuiSlot(gui, 4, 4, 'minecraft:blast_furnace', '§eЗдания и вилка прокачки', [
    '§7Добыча, логистика, производство + выбор 1 из 2 веток.',
    '§e▶ Нажмите, чтобы открыть'
  ], function (p) { lhOpenGui(server, p, 'buildings'); });

  lhGuiSlot(gui, 6, 4, 'minecraft:knowledge_book', '§eСправка и предметы', [
    '§7Шпаргалка по всем командам /lh,',
    '§7выдача Планшета или Квестбука.',
    '§e▶ Нажмите, чтобы открыть'
  ], function (p) { lhOpenGui(server, p, 'help'); });

  lhGuiSlot(gui, 8, 4, 'minecraft:globe_banner_pattern', '§dДипломатия и лицензии', [
    '§7Союзы, право прохода/добычи, мирный выкуп, поставки.',
    '§e▶ Нажмите, чтобы открыть'
  ], function (p) { lhOpenGui(server, p, 'diplomacy'); });
}

function lhGuiRenderContracts(gui, server, player) {
  var db = lhRead(server);
  var p = lhProfile(server, player);
  var teamReceipts = lhAllTeamReceipts(db, p);

  lhGuiSlot(gui, 1, 0, 'minecraft:barrel', '§6Привязать терминал (/lh terminal)', [
    '§7Встаньте НА пустую обычную бочку и нажмите.',
    p.terminal ? ('§aТекущий: ' + p.terminal.x + ', ' + p.terminal.y + ', ' + p.terminal.z) : '§cТерминал ещё не зарегистрирован'
  ], function (pl) {
    lhRegister(server, pl);
    lhOpenGui(server, pl, 'contracts');
  });

  lhGuiSlot(gui, 3, 0, 'minecraft:paper', '§fСтатус в чат (/lh status)', [
    '§7Текущий заказ: §e' + (p.job && p.job.status === 'active' ? p.job.id : 'нет'),
    '§7Консорциум: §b' + (p.team || 'личный зачёт')
  ], function (pl) {
    lhStatus(server, pl);
  });

  lhGuiSlot(gui, 5, 0, 'minecraft:redstone_block', '§cОстановить заказ (/lh abort)', [
    '§7Отменяет текущий активный контракт.',
    '§7Уже принятые товары не возвращаются.'
  ], function (pl) {
    var pr = lhProfile(server, pl);
    if (pr.job && pr.job.status === 'active') {
      pr.job.status = 'aborted';
      lhSave(server);
      lhMsg(pl, 'Заказ остановлен.');
    } else {
      lhMsg(pl, 'Нет активного заказа.');
    }
    lhOpenGui(server, pl, 'contracts');
  });

  lhGuiSlot(gui, 7, 0, 'minecraft:name_tag', '§bВыйти из консорциума (/lh team leave)', [
    '§fТекущая команда: §e' + (p.team || 'нет'),
    '§7Для входа: /lh team join <имя>'
  ], function (pl) {
    lhTeamLeave(server, pl);
    lhOpenGui(server, pl, 'contracts');
  });

  var keys = Object.keys(global.LHContracts || {});
  keys.forEach(function (cid, idx) {
    var spec = global.LHContracts[cid];
    var x = 1 + (idx % 7);
    var y = 2 + Math.floor(idx / 7);
    if (idx >= 7) { x = 1; y = 3; }
    var done = !!(p.receipts && p.receipts[cid]);
    var teamDone = !!teamReceipts[cid];
    var active = p.job && p.job.status === 'active' && p.job.id === cid;
    var statusStr = active ? '§e⏳ Активен сейчас' : (done ? '§a✔ Выполнен лично' : (teamDone ? '§b✔ Зачтён консорциумом' : '§f▶ Доступен к взятию'));
    var goodsLines = Object.keys(spec.goods || {}).map(function (gid) {
      return '§7  • ' + gid + ' ×' + spec.goods[gid];
    });
    var lore = [statusStr].concat(goodsLines);
    if (spec.windows) lore.push('§bОкон: ' + spec.windows + ' × ' + spec.windowSeconds + ' сек.');
    if (!done && !active) lore.push('§e▶ ЛКМ: принять контракт (/lh accept ' + cid + ')');
    lhGuiSlot(gui, x, y, LH_CONTRACT_ICONS[cid] || 'minecraft:chest', '§6' + spec.title + ' §7[' + cid + ']', lore, function (pl) {
      lhAccept(server, pl, cid);
      lhOpenGui(server, pl, 'contracts');
    });
  });
}

function lhGuiRenderSites(gui, server, player) {
  var sitesDb = lhSitesRead(server);
  var fieldDb = typeof lhFieldRead === 'function' ? lhFieldRead(server) : { photoClaims: {}, ccVerified: {} };

  (global.LHSiteCatalog || []).forEach(function (spec, idx) {
    var entry = sitesDb.sites[spec.id];
    var x = idx % 8;
    var y = 1 + Math.floor(idx / 8);
    if (!entry) return;
    var icon = LH_SITE_ICONS[spec.id] || (spec.id === 'continental_archive' ? 'minecraft:lectern' : 'minecraft:nether_star');
    var dist = lhGuiDistStr(player, entry.x, entry.z);
    var lore = [
      entry.commissioned ? '§a✔ Введён в эксплуатацию' : '§c✖ Не введён (подойдите и нажмите ЛКМ)',
      '§fКоординаты: §b' + entry.x + ', ' + entry.y + ', ' + entry.z + ' §7(' + dist + ')',
      '§fПродукция: §e' + (spec.product || 'архив')
    ];
    if (spec.bootstrapInputs) {
      lore.push('§7Стартовый режим: ' + JSON.stringify(spec.bootstrapInputs));
    }
    if (spec.industrialInputs) {
      lore.push('§7Промышленный: ' + JSON.stringify(spec.industrialInputs));
    }
    lore.push(fieldDb.photoClaims && fieldDb.photoClaims[spec.id] ? '§aФотоотчёт: сдан' : '§7Фотоотчёт: не сдан (ПКМ — сдать рядом)');
    if (spec.tier <= 2) {
      lore.push(fieldDb.ccVerified && fieldDb.ccVerified[spec.id] ? '§aCC-телеметрия: пройдена' : '§7CC-телеметрия: не пройдена');
    }
    if (!entry.commissioned) {
      lore.push('§e▶ ЛКМ: ввести в строй (/lh site commission ' + spec.id + ')');
    } else if (spec.bootstrapInputs) {
      lore.push('§e▶ ЛКМ: произвести (bootstrap) | ПКМ: industrial');
    }
    lhGuiSlot(gui, x, y, icon, '§6' + spec.name + ' §7[' + spec.id + ']', lore, function (pl) {
      if (spec.id === 'continental_archive') {
        lhGuiDeferAction(server, pl, function (p2) { lhSiteArchive(server, p2); }, 'sites');
      } else if (!entry.commissioned) {
        lhSiteCommission(server, pl, spec.id);
        lhOpenGui(server, pl, 'sites');
      } else if (spec.bootstrapInputs) {
        lhGuiDeferAction(server, pl, function (p2) { lhSiteProduce(server, p2, spec.id, 'bootstrap'); }, 'sites');
      } else {
        lhMsg(pl, spec.name + ' в (' + entry.x + ', ' + entry.y + ', ' + entry.z + '), дист. ' + dist);
        lhOpenGui(server, pl, 'sites');
      }
    }, function (pl) {
      if (spec.id === 'continental_archive') {
        lhGuiDeferAction(server, pl, function (p2) { lhSiteRepairArchive(server, p2); }, 'sites');
      } else if (entry.commissioned && spec.industrialInputs) {
        lhGuiDeferAction(server, pl, function (p2) { lhSiteProduce(server, p2, spec.id, 'industrial'); }, 'sites');
      } else {
        lhMsg(pl, spec.name + ' в (' + entry.x + ', ' + entry.y + ', ' + entry.z + '), дист. ' + dist);
        lhOpenGui(server, pl, 'sites');
      }
    });
  });

  lhGuiSlot(gui, 1, 3, 'minecraft:spyglass', '§bСдать фотоотчёт рядом (/lh photo report)', [
    '§7Держите проявленное фото Exposure в руке рядом с узлом.',
    '§7Автоматически найдёт ближайший узел в радиусе 64 м.'
  ], function (pl) {
    var best = null, bestD = 999999;
    Object.keys(sitesDb.sites || {}).forEach(function (sid) {
      var s = sitesDb.sites[sid];
      var d = Math.hypot(s.x - pl.x, s.z - pl.z);
      if (d < bestD) { bestD = d; best = sid; }
    });
    lhGuiDeferAction(server, pl, function (p2) {
      if (best && typeof lhPhotoReport === 'function') lhPhotoReport(server, p2, best);
    }, 'sites');
  });

  lhGuiSlot(gui, 3, 3, 'minecraft:redstone_torch', '§eЗапросить CC-челлендж (/lh cc challenge)', [
    '§7Выбирает ближайший региональный узел (1–2 этап).',
    '§7Потом нажмите кнопку «Проверить CC» рядом с ПК!'
  ], function (pl) {
    var best = null, bestD = 999999;
    (global.LHSiteCatalog || []).forEach(function (sp) {
      if (sp.tier > 2) return;
      var s = sitesDb.sites[sp.id];
      if (!s) return;
      var d = Math.hypot(s.x - pl.x, s.z - pl.z);
      if (d < bestD) { bestD = d; best = sp.id; }
    });
    if (best && typeof lhCCIssue === 'function') lhCCIssue(server, pl, best);
    lhOpenGui(server, pl, 'sites');
  });

  lhGuiSlot(gui, 5, 3, 'minecraft:comparator', '§aПроверить CC-телеметрию (/lh cc verify)', [
    '§7Проверяет ближайший региональный узел + компьютер CC.'
  ], function (pl) {
    var best = null, bestD = 999999;
    (global.LHSiteCatalog || []).forEach(function (sp) {
      if (sp.tier > 2) return;
      var s = sitesDb.sites[sp.id];
      if (!s) return;
      var d = Math.hypot(s.x - pl.x, s.z - pl.z);
      if (d < bestD) { bestD = d; best = sp.id; }
    });
    if (best && typeof lhCCVerify === 'function') lhCCVerify(server, pl, best);
    lhOpenGui(server, pl, 'sites');
  });
}

function lhGuiRenderLogistics(gui, server, player) {
  var db = lhLogRead(server);
  var pid = lhId(player);
  var camps = Object.keys(db.camps || {}).map(function (k) { return db.camps[k]; });
  var routes = Object.keys(db.routes || {}).map(function (k) { return db.routes[k]; });
  var draft = db.drafts ? db.drafts[pid] : null;
  var activeRun = db.activeRuns ? db.activeRuns[pid] : null;

  lhGuiSlot(gui, 0, 0, 'minecraft:white_bed', '§aРазвернуть лагерь (/lh camp deploy)', [
    '§7Ставит полевой лагерь в текущей точке.',
    '§7Рядом должны быть кровать и сундук/бочка.'
  ], function (pl) {
    lhCampDeploy(server, pl);
    lhOpenGui(server, pl, 'logistics');
  });

  lhGuiSlot(gui, 2, 0, 'minecraft:blaze_rod', '§6Начать разметку маршрута (/lh route begin)', [
    draft ? ('§eЧерновик уже открыт: ' + draft.id + ' (' + draft.gates.length + ' ворот)') : '§7Создаст черновик маршрута r_<ник>'
  ], function (pl) {
    var rName = 'r_' + String(pl.username || 'player').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 12);
    lhRouteBegin(server, pl, rName);
    lhOpenGui(server, pl, 'logistics');
  });

  lhGuiSlot(gui, 3, 0, 'minecraft:oak_fence_gate', '§bПоставить ворота (/lh route gate)', [
    '§7Добавляет текущие координаты в черновик маршрута.'
  ], function (pl) {
    lhRouteGate(server, pl);
    lhOpenGui(server, pl, 'logistics');
  });

  lhGuiSlot(gui, 4, 0, 'minecraft:emerald_block', '§aЗавершить маршрут (/lh route finish)', [
    '§7Сохраняет маршрут из добавленных ворот.'
  ], function (pl) {
    lhRouteFinish(server, pl);
    lhOpenGui(server, pl, 'logistics');
  });

  lhGuiSlot(gui, 6, 0, 'minecraft:redstone', '§cОтменить маршрут (/lh route abort)', [
    activeRun ? ('§eАктивный заезд: ' + activeRun.routeId) : '§7Нет активного заезда'
  ], function (pl) {
    var ldb = lhLogRead(server);
    delete ldb.activeRuns[lhId(pl)];
    lhLogSave(server);
    lhMsg(pl, 'Активный маршрутный рейс отменён.');
    lhOpenGui(server, pl, 'logistics');
  });

  lhGuiSlot(gui, 8, 0, 'minecraft:paper', '§eСдать накладную (/lh cargo deliver)', [
    '§7Держите груз-накладную в руке на узле назначения.'
  ], function (pl) {
    lhGuiDeferAction(server, pl, function (p2) { lhCargoDeliver(server, p2); }, 'logistics');
  });

  camps.slice(0, 8).forEach(function (c, i) {
    lhGuiSlot(gui, i, 2, 'minecraft:campfire', '§aЛагерь: ' + c.id, [
      '§fКоординаты: §b' + c.x + ', ' + c.y + ', ' + c.z + ' §7(' + lhGuiDistStr(player, c.x, c.z) + ')',
      '§e▶ ЛКМ: свернуть лагерь (/lh camp pack ' + c.id + ')'
    ], function (pl) {
      lhCampPack(server, pl, c.id);
      lhOpenGui(server, pl, 'logistics');
    });
  });

  routes.slice(0, 8).forEach(function (r, i) {
    lhGuiSlot(gui, i, 3, 'minecraft:powered_rail', '§6Маршрут: ' + r.id, [
      '§fВорот: §e' + (r.gates ? r.gates.length : 0) + ' §7| Лимит: ' + r.timeLimitSec + ' сек.',
      '§e▶ ЛКМ: запустить испытание (/lh route start ' + r.id + ')'
    ], function (pl) {
      lhRouteStart(server, pl, r.id);
      lhOpenGui(server, pl, 'logistics');
    });
  });

  var sitesDb = lhSitesRead(server);
  var nearest = null, nearestD = 999999;
  Object.keys(sitesDb.sites || {}).forEach(function (sid) {
    var s = sitesDb.sites[sid];
    var d = Math.hypot(s.x - player.x, s.z - player.z);
    if (d < nearestD) { nearestD = d; nearest = sid; }
  });
  var dests = ['farm', 'mine', 'port', 'badlands', 'smelter', 'wetland', 'machine', 'continental_hub'];
  dests.slice(0, 4).forEach(function (dst, i) {
    if (!nearest || dst === nearest) return;
    lhGuiSlot(gui, i, 4, 'minecraft:chest_minecart', '§bНакладная: ' + nearest + ' → ' + dst, [
      '§7Оформить перевозку от ближайшего узла (' + nearest + ')',
      '§e▶ ЛКМ: выписать (/lh cargo issue ' + nearest + ' ' + dst + ')'
    ], function (pl) {
      lhGuiDeferAction(server, pl, function (p2) { lhCargoIssue(server, p2, nearest, dst); }, 'logistics');
    });
  });

  // Automated Inter-Structure Exchange Routes (cols 4..8 on row 4)
  if (typeof lhOttdRead === 'function' && typeof lhLogisticsRead === 'function' && global.LHTradeLogistics) {
    var stL = lhOttdRead(server);
    var logL = lhLogisticsRead(server);
    var myCompL = typeof lhGetPlayerCompany === 'function' ? lhGetPlayerCompany(server, player) : null;
    var subMod = myCompL ? global.LHTradeLogistics.getSubsidyModifiers(stL, myCompL.id, myCompL.hqSx, myCompL.hqSz) : { active: false };
    var autoList = myCompL ? (logL.automatedRoutes || []).filter(function (r) { return r.companyId === myCompL.id; }) : [];
    lhGuiSlot(gui, 4, 4, 'minecraft:hopper', '§a⚙ Создать авто-маршрут', [
      '§7Соединяет ваши первые 2 предприятия для авто-перевозки.',
      '§7Учитывает уголь, нефть и таможенную пошлину.',
      subMod.active ? '§e★ Субсидия активна: −50% топливо и пошлины!' : '§7Команда: /lh route create <sx1> <sz1> <sx2> <sz2> <кол>',
      '§e▶ ЛКМ: запустить маршрут между объектами'
    ], function (pl) {
      if (!myCompL) { lhMsg(pl, 'Сначала создайте компанию.'); return; }
      var blds = global.LHOpenTTD.listCompanyBuildings(stL, myCompL.id);
      if (blds.length < 2) { lhMsg(pl, 'Нужно минимум 2 построенных объекта компании.'); return; }
      var res = global.LHTradeLogistics.createAutomatedRoute(logL, stL, myCompL.id, blds[0].sx, blds[0].sz, blds[1].sx, blds[1].sz, 'auto', 8, {
        srcDim: blds[0].dimension, dstDim: blds[1].dimension, nowTick: typeof LHOTTDTick === 'number' ? LHOTTDTick : 0
      });
      if (res.ok) {
        lhLogisticsSave(server);
        lhMsg(pl, '§a[Авто-маршрут ' + res.route.id + '] Соединён (' + blds[0].sx + ',' + blds[0].sz + ') -> (' + blds[1].sx + ',' + blds[1].sz + ')!');
      } else {
        lhMsg(pl, '§cОшибка маршрута: ' + res.reason);
      }
      lhOpenGui(server, pl, 'logistics');
    });
    autoList.slice(0, 4).forEach(function (ar, aIdx) {
      var cp = ar.costProfile || {};
      var statusTag = !ar.enabled ? '§c[ПАУЗА] ' : (ar.pausedReason === 'robbed_by_pirates' ? '§6[ОГРАБЛЕН] ' : '§a[ВКЛ] ');
      lhGuiSlot(gui, 5 + aIdx, 4, ar.enabled ? (ar.escortEnabled ? 'minecraft:shield' : 'minecraft:lime_dye') : 'minecraft:gray_dye',
        statusTag + 'Маршрут ' + ar.id, [
          '§f(' + ar.srcSx + ',' + ar.srcSz + ') → (' + ar.dstSx + ',' + ar.dstSz + ')',
          '§fГруз: §e' + ar.qtyPerRun + '× ' + ar.itemId + ' §7(перевезено: ' + (ar.totalTransferred || 0) + ')',
          '§fОхрана каравана: ' + (ar.escortEnabled ? '§aВКЛ (−82% пиратов)' : '§cВЫКЛ §7(/lh route escort ' + ar.id + ')'),
          '§fРасход: §7' + (cp.coalQty || 1) + ' угля, ' + (cp.oilQty || 0) + ' нефти, §6' + (cp.totalCashCost || 10) + ' Cr (таможня ' + (cp.customsTax || 0) + ')',
          '§eЛКМ: вкл/выкл | ПКМ: удалить'
        ], function (pl) {
          global.LHTradeLogistics.toggleAutomatedRoute(logL, ar.id, myCompL ? myCompL.id : null);
          lhLogisticsSave(server);
          lhOpenGui(server, pl, 'logistics');
        }, function (pl) {
          global.LHTradeLogistics.deleteAutomatedRoute(logL, ar.id, myCompL ? myCompL.id : null);
          lhLogisticsSave(server);
          lhOpenGui(server, pl, 'logistics');
        });
    });
  }
}

function lhGuiRenderRecovery(gui, server, player) {
  var recDb = lhRecRead(server);
  (global.LHRecoveryCatalog || []).forEach(function (spec, idx) {
    var rec = recDb.items ? recDb.items[spec.id] : null;
    if (!rec) return;
    var x = 1 + idx;
    var lore = [
      rec.restored ? '§a✔ Восстановлен' : (rec.surveyed ? '§e🔍 Обследован (готов к ремонту)' : '§7✖ Не обследован'),
      '§fКоординаты: §b' + rec.x + ', ' + rec.y + ', ' + rec.z + ' §7(' + lhGuiDistStr(player, rec.x, rec.z) + ')',
      '§7Требует: ' + JSON.stringify(spec.repairInputs),
      '§e▶ ЛКМ: обследовать (survey) | ПКМ: восстановить (restore)'
    ];
    lhGuiSlot(gui, x, 1, LH_REC_ICONS[spec.id] || 'minecraft:anvil', '§6' + spec.name + ' §7[' + spec.id + ']', lore, function (pl) {
      lhRecSurvey(server, pl, spec.id);
      lhOpenGui(server, pl, 'recovery');
    }, function (pl) {
      lhGuiDeferAction(server, pl, function (p2) { lhRecRestore(server, p2, spec.id); }, 'recovery');
    });
  });

  lhGuiSlot(gui, 2, 3, 'minecraft:experience_bottle', '§aПроверить этап (/lh stage)', [
    '§7Пересчитывает этапы прогрессии I–IV и GameStages.'
  ], function (pl) {
    if (typeof lhStageRecompute === 'function') {
      var res = lhStageRecompute(server, pl);
      lhMsg(pl, 'Текущий этап: ' + (res && res.stage ? res.stage : 'I'));
    }
    lhOpenGui(server, pl, 'recovery');
  });

  lhGuiSlot(gui, 4, 3, 'minecraft:book', '§6Список заказов каталога (/lh catalog list)', [
    '§7Выводит категории и количество открытых заказов в чат.'
  ], function (pl) {
    var catDb = typeof lhCatRead === 'function' ? lhCatRead(server) : { done: {} };
    var total = (global.LHQuestCatalog || []).length;
    var doneCount = Object.keys(catDb.done || {}).length;
    lhMsg(pl, 'Каталог заказов: выполнено ' + doneCount + ' из ' + total + '. Проверить заказ: /lh catalog verify <id>.');
  });

  lhGuiSlot(gui, 6, 3, 'minecraft:saddle', '§bТелеметрия транспорта (/lh vehicle status)', [
    '§7Показывает учтённый пробег по земле, воде, воздуху и рельсам.'
  ], function (pl) {
    var tel = typeof lhTelemetryRead === 'function' ? lhTelemetryRead(server) : { players: {} };
    var pr = tel.players ? tel.players[lhId(pl)] : null;
    lhMsg(pl, 'Пробег транспорта: ' + JSON.stringify(pr || {}));
  });
}

function lhGuiRenderOpenTTD(gui, server, player) {
  var st = lhOttdRead(server);
  var myComp = lhGetPlayerCompany(server, player);

  if (myComp) {
    var vBr = global.LHOpenTTD.getCompanyValuationBreakdown ? global.LHOpenTTD.getCompanyValuationBreakdown(st, myComp.id) : { totalValuation: global.LHOpenTTD.computeValuation(st, myComp.id), cash: myComp.cash, inventoryValue: 0, facilitiesValue: 0, productionPotentialValue: 0, territoryValue: 0, avgHourlyIncome: 0 };
    var expBr = global.LHOpenTTD.computeCompanyExpenses ? global.LHOpenTTD.computeCompanyExpenses(st, myComp.id) : { total: 0, facilityUpkeep: 0, upgradeUpkeep: 0, landTax: 0, securityUpkeep: 0, antiMonopolyTax: 0 };
    var trText = global.LHOpenTTD.formatCompanyTraits ? global.LHOpenTTD.formatCompanyTraits(myComp) : '-';
    var isSub = global.LHOpenTTD.isCompanySubsidized && global.LHOpenTTD.isCompanySubsidized(st, myComp.id, myComp.hqSx, myComp.hqSz);
    var cbMy = global.LHOpenTTD.getComebackStatus ? global.LHOpenTTD.getComebackStatus(st, myComp.id) : { active: false };
    lhGuiSlot(gui, 1, 0, 'minecraft:emerald_block', myComp.colorCode + myComp.name + ' §7[' + myComp.id + ']', [
      '§fНаличные: §e' + myComp.cash + ' Cr §7| Капитал: §a' + vBr.totalValuation + ' Cr',
      '§7Запасы: §f' + vBr.inventoryValue + ' §7| Объекты: §f' + vBr.facilitiesValue + ' §7| Акции: §b' + (vBr.equityPortfolioValue || 0),
      '§7Потенциал: §f' + vBr.productionPotentialValue + ' §7| Земля: §f' + vBr.territoryValue + ' §7| Ср.доход/ч: §a' + vBr.avgHourlyIncome + ' Cr',
      '§cРасходы/цикл: §f' + expBr.total + ' Cr §7(прогр. ' + (expBr.progressiveTax || 0) + ' [' + (expBr.progressiveBracketLabel || '5%') + '], земля ' + expBr.landTax + (expBr.antiMonopolyTax > 0 ? (', §cантимоноп ' + expBr.antiMonopolyTax) : '') + ')',
      '§dЧерты: §f' + trText + (cbMy.active ? (' §a| Камбэк Ур.' + cbMy.tier) : ''),
      '§fСреда: §d' + (myComp.envType || 'normal') + ' §7| Спец.: §f' + (myComp.transportSpec || 'нет') + ' / ' + (myComp.resourceSpec || 'нет'),
      isSub ? '§e★ СУБСИДИЯ: +35% выпуск, −40% доставка, −50% топливо!' : '§7Команда: /lh valuation'
    ]);
    lhGuiSlot(gui, 3, 0, 'minecraft:oak_door', '§cПокинуть компанию', ['§7Выйти из текущей компании OpenTTD'], function (pl) {
      global.LHOpenTTD.companyLeave(st, lhId(pl));
      lhOttdSave(server);
      lhMsg(pl, 'Вы покинули компанию.');
      lhOpenGui(server, pl, 'openttd');
    });
  } else {
    var autoId = String(player.username || 'corp').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10) || 'corp';
    lhGuiSlot(gui, 1, 0, 'minecraft:emerald', '§aСоздать компанию [' + autoId + ']', [
      '§7Быстрое основание компании по вашему нику.',
      '§7Или вручную: /lh company create <id> <название>'
    ], function (pl) {
      var res = global.LHOpenTTD.companyCreate(st, lhId(pl), autoId, String(pl.username || 'Cargo') + ' Logistics', pl.x, pl.z);
      if (res.ok) {
        lhOttdSave(server);
        lhUnlock(pl, 'longhaul:openttd/company');
        if (typeof lhTeamJoin === 'function') lhTeamJoin(server, pl, res.company.id);
        lhMsg(pl, 'Основана компания «' + res.company.name + '»! Стартовый капитал: ' + res.company.cash + ' Cr.');
      } else {
        lhMsg(pl, 'Не удалось создать компанию: ' + res.reason);
      }
      lhOpenGui(server, pl, 'openttd');
    });
  }

  lhGuiSlot(gui, 5, 0, 'minecraft:nether_star', '§6Верификация империи (/lh openttd verify)', [
    '§7Обновляет квестовые отметки OpenTTD-главы.'
  ], function (pl) {
    if (server && server.commands && typeof pl.createCommandSourceStack === 'function') {
      server.commands.performPrefixedCommand(pl.createCommandSourceStack(), 'lh openttd verify');
    }
    lhOpenGui(server, pl, 'openttd');
  });

  lhGuiSlot(gui, 7, 0, 'minecraft:gold_block', '§e🏛 Банк, Налоги, Акции', [
    '§7Кредиты ЦБ, уклонение от налогов, акции и камбэк.'
  ], function (pl) { lhOpenGui(server, pl, 'bank'); });

  lhGuiSlot(gui, 8, 0, 'minecraft:crossbow', '§6☠ Синдикат Корсаров', [
    '§7Охрана караванов и заказные налёты.'
  ], function (pl) { lhOpenGui(server, pl, 'pirates'); });

  // Row 1: Environment selection (/lh company env <normal|air|sea|underground>)
  var envSpecs = (global.LHOpenTTD && global.LHOpenTTD.COMPANY_ENV_TYPES) || {
    normal: { name: 'Наземная (Surface)', y: 70 },
    air: { name: 'Небесная (Y=286)', y: 286 },
    sea: { name: 'Морская (Y=64)', y: 64 },
    underground: { name: 'Подземная (Y=-44)', y: -44 }
  };
  var envIcons = {
    normal: 'minecraft:grass_block',
    air: 'minecraft:feather',
    sea: 'minecraft:oak_boat',
    underground: 'minecraft:deepslate'
  };
  ['normal', 'air', 'sea', 'underground'].forEach(function (eid, eIdx) {
    var esp = envSpecs[eid] || { name: eid, y: 70 };
    var activeEnv = myComp && (myComp.envType || 'normal') === eid;
    lhGuiSlot(gui, 2 + eIdx, 1, envIcons[eid] || 'minecraft:stone',
      (activeEnv ? '§a✔ ' : '§d') + 'Среда: ' + esp.name,
      [
        '§7Высота терминала/штаба: Y=' + esp.y,
        '§7Новые здания строятся в этой среде.',
        activeEnv ? '§aТекущая среда компании' : '§e▶ ЛКМ: переключить среду (/lh company env ' + eid + ')'
      ],
      function (pl) {
        if (typeof lhRelocateCompanyEnv === 'function') lhRelocateCompanyEnv(server, pl, eid, false);
        lhOpenGui(server, pl, 'openttd');
      });
  });

  var tKeys = Object.keys(global.LHOpenTTD.TRANSPORT_SPECS || {});
  tKeys.forEach(function (sid, idx) {
    var sp = global.LHOpenTTD.TRANSPORT_SPECS[sid];
    var active = myComp && myComp.transportSpec === sid;
    lhGuiSlot(gui, 1 + idx, 2, 'minecraft:minecart', (active ? '§a✔ ' : '§e') + sp.icon + ' ' + sp.name + ' §7[' + sid + ']', [
      '§7' + sp.summary,
      active ? '§aАктивная транспортная специализация' : '§e▶ ЛКМ: выбрать специализацию'
    ], function (pl) {
      var c = lhGetPlayerCompany(server, pl);
      if (!c) { lhMsg(pl, 'Сначала создайте или выберите компанию.'); return; }
      var res = global.LHOpenTTD.setSpecialization(st, c.id, 'transport', sid);
      if (!res.ok) lhMsg(pl, 'Для смены специализации нужно ' + res.cost + ' Cr.');
      else {
        lhOttdSave(server);
        if (c.transportSpec && c.resourceSpec) lhUnlock(pl, 'longhaul:openttd/specs');
        lhMsg(pl, 'Выбрано: ' + sp.name);
      }
      lhOpenGui(server, pl, 'openttd');
    });
  });

  var rKeys = Object.keys(global.LHOpenTTD.RESOURCE_SPECS || {});
  rKeys.forEach(function (sid, idx) {
    var sp = global.LHOpenTTD.RESOURCE_SPECS[sid];
    var active = myComp && myComp.resourceSpec === sid;
    lhGuiSlot(gui, 1 + idx, 3, 'minecraft:iron_pickaxe', (active ? '§a✔ ' : '§b') + sp.icon + ' ' + sp.name + ' §7[' + sid + ']', [
      '§7' + sp.summary,
      active ? '§aАктивная ресурсная специализация' : '§e▶ ЛКМ: выбрать специализацию'
    ], function (pl) {
      var c = lhGetPlayerCompany(server, pl);
      if (!c) { lhMsg(pl, 'Сначала создайте или выберите компанию.'); return; }
      var res = global.LHOpenTTD.setSpecialization(st, c.id, 'resource', sid);
      if (!res.ok) lhMsg(pl, 'Для смены специализации нужно ' + res.cost + ' Cr.');
      else {
        lhOttdSave(server);
        if (c.transportSpec && c.resourceSpec) lhUnlock(pl, 'longhaul:openttd/specs');
        lhMsg(pl, 'Выбрано: ' + sp.name);
      }
      lhOpenGui(server, pl, 'openttd');
    });
  });

  var list = Object.keys(st.companies || {}).map(function (cid) {
    return { c: st.companies[cid], val: global.LHOpenTTD.computeValuation(st, cid), claims: global.LHOpenTTD.countClaims(st, cid) };
  });
  list.sort(function (a, b) { return b.val - a.val; });
  list.slice(0, 9).forEach(function (row, idx) {
    var c = row.c;
    var pact = myComp && myComp.id !== c.id && global.LHOpenTTD.hasPact && global.LHOpenTTD.hasPact(st, myComp.id, c.id);
    var lore = [
      '§fКапитал: §e' + row.val + ' Cr §7(нал: ' + c.cash + ' Cr)',
      '§fСекторов: §b' + row.claims + ' §7| Спец: ' + (c.transportSpec || '-') + '/' + (c.resourceSpec || '-')
    ];
    if (c.isBot) lore.push('§7Тип: ИИ-конкурент');
    if (myComp && myComp.id !== c.id) {
      lore.push(pact ? '§a✔ Торговый пакт активен (ЛКМ: расторгнуть)' : '§e▶ ЛКМ: подписать торговый пакт (0% пошлины)');
    } else if (!myComp && !c.isBot) {
      lore.push('§e▶ ЛКМ: вступить в компанию');
    }
    lhGuiSlot(gui, idx, 4, LH_COMP_WOOL[lhCompanyMcColor(c)] || 'minecraft:white_wool',
      '§f#' + (idx + 1) + ' ' + c.colorCode + c.name + (c.isBot ? ' §7[BOT]' : ''), lore, function (pl) {
        if (!myComp && !c.isBot) {
          var jr = global.LHOpenTTD.companyJoin(st, lhId(pl), c.id);
          if (jr.ok) { lhOttdSave(server); lhUnlock(pl, 'longhaul:openttd/company'); lhMsg(pl, 'Вы вступили в ' + c.name); }
        } else if (myComp && myComp.id !== c.id) {
          var act = global.LHOpenTTD.togglePact(st, myComp.id, c.id);
          lhOttdSave(server);
          lhMsg(pl, act ? ('Торговый пакт с ' + c.name + ' подписан!') : ('Торговый пакт с ' + c.name + ' расторгнут.'));
        }
        lhOpenGui(server, pl, 'openttd');
      });
  });
}

function lhGuiRenderTerritory(gui, server, player) {
  var st = lhOttdRead(server);
  var myComp = lhGetPlayerCompany(server, player);
  var sc = global.LHOpenTTD.sectorCoords(player.x, player.z);
  var view = lhGuiGetMapView(player);
  var zoom = view.zoom || 1; // 1, 2, or 4 sectors per cell

  for (var row = 0; row < 5; row++) {
    for (var col = 0; col < 7; col++) {
      (function (gx, gy, dxCell, dzCell) {
        var sx = view.cx + dxCell * zoom;
        var sz = view.cz + dzCell * zoom;
        var info = global.LHOpenTTD.resolveSectorOwner(st, sx, sz);
        var bldg = global.LHOpenTTD.getSectorBuilding(st, sx, sz);
        var comp = (info.kind === 'claimed' && info.owner) ? st.companies[info.owner] : null;
        var isHere = (Math.abs(sc.sx - sx) < zoom && Math.abs(sc.sz - sz) < zoom &&
          sc.sx >= sx && sc.sx < sx + zoom && sc.sz >= sz && sc.sz < sz + zoom);
        var isSanctuary = global.LHOpenTTD.isSpawnProtectedSector && global.LHOpenTTD.isSpawnProtectedSector(sx, sz);

        var icon = 'minecraft:light_gray_stained_glass_pane';
        if (isSanctuary) icon = 'minecraft:yellow_concrete';
        else if (bldg) icon = 'minecraft:anvil';
        else if (info.isHq) icon = 'minecraft:gold_block';
        else if (myComp && info.owner === myComp.id && info.kind === 'claimed') icon = 'minecraft:lime_concrete';
        else if (comp) icon = LH_COMP_WOOL[lhCompanyMcColor(comp)] || 'minecraft:orange_wool';

        var lore = [
          (isHere ? '§e◆ ВЫ ЗДЕСЬ · ' : '') + '§fСектор (' + sx + ', ' + sz + ')' + (zoom > 1 ? (' §7[' + zoom + '×' + zoom + ']') : ''),
          '§7Центр: ' + (sx * 256) + ', ' + (sz * 256),
          '§fВладелец: ' + (comp ? (comp.colorCode + comp.name) : '§7Свободен (не запривачен)')
        ];
        if (isSanctuary) lore.push('§eСтартовый заповедник спауна (покупка запрещена)');
        else if (info.kind === 'claimed') lore.push('§7Статус: Захвачен (защита ' + info.strength + '/4)');
        else lore.push('§cДобыча и лутинг запрещены до привата');

        if (bldg && global.LHOpenTTD.BUILDING_CATALOG[bldg.type]) {
          lore.push('§bЗдание: §f' + global.LHOpenTTD.BUILDING_CATALOG[bldg.type].name + ' §7(Ур.' + bldg.level + ')');
        }
        if (myComp && info.owner && info.owner !== myComp.id && info.kind === 'claimed') {
          var rel = global.LHOpenTTD.getRelation(st, myComp.id, info.owner);
          var tOk = global.LHOpenTTD.canTransit(st, myComp.id, info.owner);
          var mOk = global.LHOpenTTD.canMine(st, myComp.id, info.owner);
          lore.push('§7Отношение: §e' + rel.score + ' §7| Проход: ' + (tOk ? '§aДа' : '§cНет') + ' §7| Добыча: ' + (mOk ? '§aДа' : '§cНет'));
        }
        if (myComp && !isSanctuary) {
          var ci = global.LHOpenTTD.computeClaimCost(st, myComp.id, sx, sz);
          if (ci.ok) {
            lore.push((ci.mode === 'capture' ? '§cПКМ: Выкуп (' : '§aЛКМ: Купить (') + ci.cost + ' Cr)');
          }
        }

        lhGuiSlot(gui, gx, gy, icon,
          (isHere ? '§e◆ ' : '') + (comp ? (comp.colorCode + comp.name) : '§7Сектор') + ' §f(' + sx + ',' + sz + ')',
          lore,
          function (pl) {
            lhCompanyClaimAt(server, pl, sx, sz, false, true);
            lhOpenGui(server, pl, 'territory');
          },
          function (pl) {
            lhCompanyClaimAt(server, pl, sx, sz, true, true);
            lhOpenGui(server, pl, 'territory');
          });
      })(col, row, col - 3, row - 2);
    }
  }

  // Right sidebar (columns 7..8): Zoom, Pan, Actions, HUD Minimap
  lhGuiSlot(gui, 7, 0, 'minecraft:feather', '§e▲ Сдвиг на Север', ['§7Центр вида: (' + view.cx + ', ' + view.cz + ')'], function (pl) {
    lhGuiGetMapView(pl).cz -= zoom * 2;
    lhOpenGui(server, pl, 'territory');
  });
  lhGuiSlot(gui, 8, 0, 'minecraft:spyglass', '§b🔍 Масштаб: ' + zoom + '×', [
    '§7Текущий охват: §f' + (7 * zoom) + '×' + (5 * zoom) + ' секторов',
    '§e▶ ЛКМ: переключить 1× → 2× → 4×'
  ], function (pl) {
    var v = lhGuiGetMapView(pl);
    v.zoom = v.zoom === 1 ? 2 : (v.zoom === 2 ? 4 : 1);
    lhOpenGui(server, pl, 'territory');
  });

  lhGuiSlot(gui, 7, 1, 'minecraft:arrow', '§e◀ Сдвиг на Запад', ['§7Сместить обзор влево'], function (pl) {
    lhGuiGetMapView(pl).cx -= zoom * 2;
    lhOpenGui(server, pl, 'territory');
  });
  lhGuiSlot(gui, 8, 1, 'minecraft:spectral_arrow', '§e▶ Сдвиг на Восток', ['§7Сместить обзор вправо'], function (pl) {
    lhGuiGetMapView(pl).cx += zoom * 2;
    lhOpenGui(server, pl, 'territory');
  });

  lhGuiSlot(gui, 7, 2, 'minecraft:lead', '§e▼ Сдвиг на Юг', ['§7Сместить обзор вниз'], function (pl) {
    lhGuiGetMapView(pl).cz += zoom * 2;
    lhOpenGui(server, pl, 'territory');
  });
  lhGuiSlot(gui, 8, 2, 'minecraft:compass', '§a🎯 Центрировать на мне', [
    '§7Ваш сектор: §e(' + sc.sx + ', ' + sc.sz + ')',
    '§7ПКМ: вывести подробное инфо в чат'
  ], function (pl) {
    var v = lhGuiGetMapView(pl);
    v.cx = sc.sx; v.cz = sc.sz;
    lhOpenGui(server, pl, 'territory');
  }, function (pl) {
    lhCompanySectorInfo(server, pl);
  });

  lhGuiSlot(gui, 7, 3, 'minecraft:lime_banner', '§aЗаявить / Укрепить', [
    '§7ЛКМ: Заявить текущий сектор',
    '§7ПКМ: Укрепить (+защита) или Заселить грузом'
  ], function (pl) {
    lhCompanyClaimHere(server, pl, false);
    lhOpenGui(server, pl, 'territory');
  }, function (pl) {
    lhCompanyFortifyHere(server, pl);
    lhOpenGui(server, pl, 'territory');
  });

  var pid = typeof lhId === 'function' ? lhId(player) : String(player.uuid || '');
  var mmPref = (st.minimapPrefs && st.minimapPrefs[pid]) ? st.minimapPrefs[pid] : { enabled: true, size: 'medium' };
  lhGuiSlot(gui, 8, 3, 'minecraft:filled_map', mmPref.enabled ? '§a🗺 Границы в Xaero: ВКЛ' : '§c🗺 Границы в Xaero: ВЫКЛ', [
    '§7Подсветка секторов и границ мира прямо в',
    '§bXaero\'s World Map (M) §7и §bXaero\'s Minimap§7.',
    '§eЛКМ: Вкл/Выкл слой границ Xaero',
    '§bПКМ: Выдать карту-предмет для Map Atlases'
  ], function (pl) {
    if (!st.minimapPrefs) st.minimapPrefs = {};
    var cur = st.minimapPrefs[pid] || { enabled: true, size: 'medium' };
    cur.enabled = !cur.enabled;
    st.minimapPrefs[pid] = cur;
    lhOttdSave(server);
    if (typeof lhSyncXaeroTerritories === 'function') lhSyncXaeroTerritories(server, pl);
    lhOpenGui(server, pl, 'territory');
  }, function (pl) {
    lhGuiDeferAction(server, pl, function (p2) {
      lhGiveTerritoryMapItem(server, p2, false, false);
    });
  });

  lhGuiSlot(gui, 7, 4, 'minecraft:iron_sword', '§cРейд / Антимонополия', [
    '§7ЛКМ: Начать 60с рейд сектора (75 Cr)',
    '§7ПКМ: Антимонопольный отбор лидера'
  ], function (pl) {
    lhCompanyStartRaid(server, pl);
    lhOpenGui(server, pl, 'territory');
  }, function (pl) {
    lhCompanyAntitrustSeize(server, pl, false);
    lhOpenGui(server, pl, 'territory');
  });

  var border = typeof lhApplyTerritoryBorder === 'function' ? lhApplyTerritoryBorder(server, false) : { size: 724, unlocked: 0, total: 61, areaShare: 0 };
  lhGuiSlot(gui, 8, 4, 'minecraft:bedrock', '§bГраница: ' + border.size + '×' + border.size, [
    '§fГлав: §a' + border.unlocked + '/' + border.total + ' §7(§e' + Math.round((border.areaShare || 0) * 100) + '%§7)',
    '§7Наковальня = здание, Золото = штаб, Лайм = ваш сектор.'
  ]);
}

function lhGuiRenderBuildings(gui, server, player) {
  var st = lhOttdRead(server);
  var myComp = lhGetPlayerCompany(server, player);
  var dim = (player.level && player.level.dimension) ? String(player.level.dimension) : 'minecraft:overworld';
  var sc = global.LHOpenTTD.sectorCoords(player.x, player.z);
  var curBldg = global.LHOpenTTD.getSectorBuilding(st, sc.sx, sc.sz, dim);

  var bIcons = {
    mine_shaft: 'minecraft:iron_pickaxe',
    oil_rig: 'minecraft:bucket',
    warehouse: 'minecraft:chest',
    airport: 'minecraft:elytra',
    factory: 'minecraft:blast_furnace',
    refinery: 'minecraft:brewing_stand',
    patrol_post: 'minecraft:iron_sword',
    power_plant: 'minecraft:redstone_block',
    deep_quarry: 'minecraft:diamond_pickaxe',
    sawmill: 'minecraft:iron_axe',
    greenhouse: 'minecraft:wheat',
    chemical_plant: 'minecraft:cauldron',
    rail_depot: 'minecraft:powered_rail',
    structure_facility: 'minecraft:lodestone'
  };

  // Rows 0..1 (cols 0..8 row 0, 0..3 row 1): all buildable facilities
  var bKeys = Object.keys(global.LHOpenTTD.BUILDING_CATALOG || {}).filter(function (bt) {
    return !global.LHOpenTTD.BUILDING_CATALOG[bt].requiresWorldStructure;
  });
  bKeys.slice(0, 13).forEach(function (bt, idx) {
    var gx = idx % 9;
    var gy = Math.floor(idx / 9);
    var spec = global.LHOpenTTD.BUILDING_CATALOG[bt];
    var reqIn = spec.inputItems ? Object.keys(spec.inputItems).map(function (k) { return spec.inputItems[k] + '×' + k.replace('minecraft:', ''); }).join(', ') : 'нет';
    var reqFuel = global.LHOpenTTD.getBuildingFuelCost ? global.LHOpenTTD.getBuildingFuelCost(spec) : 1;
    var lore = [
      '§7Категория: §e' + spec.categoryName,
      '§fСтоимость: §6' + spec.cost + ' Cr §7| Содержание: §c' + (spec.upkeepCost || 12) + ' Cr',
      '§6Обяз. топливо/цикл: §e' + reqFuel + ' угля §7(или нефть/лава)',
      '§fСырьё (+45% бонус): §b' + reqIn + ' §7(без сырья работает частично)',
      spec.baseRadius
        ? ('§fРадиус охраны: §b' + spec.baseRadius + ' м §7(на 3 ур. спавнит стражу)')
        : ('§fДоход за цикл: §a' + spec.baseIncome + ' Cr §7+ ' + (spec.baseQty || 0) + '× ' + (spec.baseProduct || '')),
      '§e▶ ЛКМ: построить в секторе (' + sc.sx + ', ' + sc.sz + ')'
    ];
    lhGuiSlot(gui, gx, gy, bIcons[bt] || 'minecraft:anvil', spec.icon + ' §6' + spec.name, lore, function (pl) {
      if (typeof lhBuildFacilityCmd === 'function') lhBuildFacilityCmd(server, pl, bt, sc.sx, sc.sz, false);
      lhOpenGui(server, pl, 'buildings');
    });
  });

  // Row 1 cols 6..8: Convert World Structure, Supply Inputs, Collect All
  var sectorStructs = (typeof lhScanNearbyStructuresForSector === 'function')
    ? lhScanNearbyStructuresForSector(server, player, st)
    : (global.LHOpenTTD.getSectorStructures ? global.LHOpenTTD.getSectorStructures(st, sc.sx, sc.sz, dim) : []);
  var topStruct = sectorStructs.length > 0 ? sectorStructs[0] : null;
  lhGuiSlot(gui, 6, 1, 'minecraft:lodestone', '§d🏛 Освоить структуру мира', [
    topStruct ? (topStruct.rarityColor + '[' + topStruct.rarityName + '] §f' + topStruct.displayName) : '§7Нет найденных структур в этом секторе',
    topStruct ? ('§fДобыча: §e' + topStruct.itemId + ' §7(' + topStruct.cost + ' Cr)') : '§7Встаньте в сектор со структурой (крепость/храм/город)',
    '§7Структура сохраняется нетронутой!',
    '§e▶ ЛКМ: освоить структуру (/lh structure convert)'
  ], function (pl) {
    if (typeof lhConvertStructureCmd === 'function') lhConvertStructureCmd(server, pl, topStruct ? topStruct.structureId : null, sc.sx, sc.sz, false);
    lhOpenGui(server, pl, 'buildings');
  });

  lhGuiSlot(gui, 7, 1, 'minecraft:coal', '§b⛽ Загрузить топливо и сырьё', [
    '§7Передаёт топливо (обязательно) и сырьё (+45% бонус)',
    '§7из вашего инвентаря в буфер объекта.',
    '§e▶ ЛКМ: загрузить 2 цикла (/lh building supply)'
  ], function (pl) {
    lhGuiDeferAction(server, pl, function (p2) {
      if (typeof lhSupplyBuildingCmd === 'function') lhSupplyBuildingCmd(server, p2, sc.sx, sc.sz, false);
    }, 'buildings');
  });

  lhGuiSlot(gui, 8, 1, 'minecraft:emerald', '§a💰 Собрать всю прибыль', [
    '§7Забрать накопленные Cr и ресурсы со всех зданий компании.'
  ], function (pl) {
    if (typeof lhCollectFacilityCmd === 'function') lhCollectFacilityCmd(server, pl, false);
    lhOpenGui(server, pl, 'buildings');
  });

  // Row 2: Active building in current sector + 2-way Upgrade Fork (Tier 1 & Tier 2) + Auction button
  if (curBldg && myComp && curBldg.owner === myComp.id) {
    var bSpec = global.LHOpenTTD.BUILDING_CATALOG[curBldg.type] || {};
    var intPct = typeof curBldg.integrityPct === 'number' ? curBldg.integrityPct : 100;
    var reqMap = global.LHOpenTTD.getBuildingRequiredInputs ? global.LHOpenTTD.getBuildingRequiredInputs(curBldg) : {};
    var reqFuelNeed = global.LHOpenTTD.getBuildingFuelCost ? global.LHOpenTTD.getBuildingFuelCost(curBldg) : 1;
    var fuelHave = Math.round((curBldg.fuelBuffer || 0) * 10) / 10;
    var reqStr = Object.keys(reqMap).map(function (rk) {
      var haveIn = (curBldg.inputBuffer && curBldg.inputBuffer[rk]) || 0;
      return rk.replace('minecraft:', '') + ' ' + haveIn + '/' + reqMap[rk];
    }).join(', ') || 'нет';
    var adjM = global.LHOpenTTD.getPowerPlantAdjacencyMultiplier ? global.LHOpenTTD.getPowerPlantAdjacencyMultiplier(st, myComp.id, sc.sx, sc.sz, dim) : 1.0;

    lhGuiSlot(gui, 0, 2, bIcons[curBldg.type] || 'minecraft:anvil',
      (curBldg.rarityColor || '§a') + (curBldg.structureName || bSpec.name || curBldg.type), [
      '§fСектор: §e(' + sc.sx + ', ' + sc.sz + ') §7| Уровень: §b' + curBldg.level + '/3',
      '§fБочка выхода: §7' + curBldg.x + ', ' + curBldg.y + ', ' + curBldg.z + ' §7| Сырья/топлива: §b' + (curBldg.x + 1) + ', ' + curBldg.y + ', ' + curBldg.z,
      '§fСтатус: ' + (curBldg.pausedReason === 'missing_fuel' ? '§cПАУЗА (НЕТ ТОПЛИВА!)' : (curBldg.pausedReason === 'missing_inputs' ? '§cПАУЗА (нет сырья)' : (curBldg.operational === false ? '§c[НЕ РАБОТАЕТ]' : '§aРаботает'))) +
        ' §7| Прочность: ' + (intPct >= 75 ? '§a' : (intPct >= 35 ? '§e' : '§c')) + intPct + '%',
      '§6Топливо: §e' + fuelHave + '/' + reqFuelNeed + ' §7| §fСырьё (+45%): §b' + reqStr + (adjM > 1.0 ? (' §e| Энергосеть ×' + Math.round(adjM * 100) / 100) : ''),
      '§fНакоплено: §e' + (curBldg.cashBuffer || 0) + ' Cr',
      curBldg.branch1 ? ('§aT1 ветка: ' + curBldg.branch1) : '§7T1: выберите 1 из 2 веток справа →',
      curBldg.branch2 ? ('§aT2 ветка: ' + curBldg.branch2) : (curBldg.level === 2 ? '§7T2: выберите 1 из 2 веток справа →' : '§7T2: откроется после T1'),
      intPct < 100 ? '§e▶ ЛКМ: восстановить физическое здание (/lh building repair)' : '§7Выставить товар на витрину: /lh shop sell hand <кол-во> <цена>'
    ], function (pl) {
      if (intPct < 100) {
        var rep = global.LHOpenTTD.repairBuildingIntegrity(st, myComp.id, sc.sx, sc.sz, dim);
        if (rep.ok) {
          lhOttdSave(server);
          if (typeof lhPlacePhysicalBuildingBlocks === 'function') lhPlacePhysicalBuildingBlocks(server, rep.building);
          lhMsg(pl, '§a[Ремонт] Здание восстановлено до 100% за ' + rep.cost + ' Cr!');
        } else {
          lhMsg(pl, '§cОшибка ремонта: ' + rep.reason);
        }
        lhOpenGui(server, pl, 'buildings');
      }
    });

    (bSpec.tier1Fork || []).forEach(function (opt, oi) {
      var chosen = curBldg.branch1 === opt.id;
      var locked = curBldg.branch1 && curBldg.branch1 !== opt.id;
      lhGuiSlot(gui, 2 + oi, 2, chosen ? 'minecraft:lime_stained_glass_pane' : (locked ? 'minecraft:red_stained_glass_pane' : 'minecraft:yellow_concrete'),
        (chosen ? '§a✔ [T1] ' : (locked ? '§c✖ [ЗАБЛОКИРОВАНО] ' : '§e▶ [T1 Вилка] ')) + opt.name,
        ['§7' + opt.summary, '§fЦена: §6' + opt.cost + ' Cr', locked ? '§cДругая ветка уже выбрана!' : (chosen ? '§aАктивно' : '§eЛКМ: выбрать (заблокирует 2-й путь)')],
        function (pl) {
          if (!locked && !chosen && typeof lhUpgradeFacilityCmd === 'function') {
            lhUpgradeFacilityCmd(server, pl, sc.sx, sc.sz, opt.id, false);
          }
          lhOpenGui(server, pl, 'buildings');
        });
    });

    (bSpec.tier2Fork || []).forEach(function (opt, oi) {
      var chosen = curBldg.branch2 === opt.id;
      var locked = (curBldg.branch2 && curBldg.branch2 !== opt.id) || curBldg.level < 2;
      lhGuiSlot(gui, 5 + oi, 2, chosen ? 'minecraft:lime_stained_glass_pane' : (locked ? 'minecraft:gray_stained_glass_pane' : 'minecraft:orange_concrete'),
        (chosen ? '§a✔ [T2] ' : (locked ? '§7🔒 [T2] ' : '§6▶ [T2 Вилка] ')) + opt.name,
        ['§7' + opt.summary, '§fЦена: §6' + opt.cost + ' Cr', curBldg.level < 2 ? '§7Сначала выберите улучшение T1' : (chosen ? '§aАктивно' : '§eЛКМ: выбрать (заблокирует 2-й путь)')],
        function (pl) {
          if (!locked && !chosen && curBldg.level === 2 && typeof lhUpgradeFacilityCmd === 'function') {
            lhUpgradeFacilityCmd(server, pl, sc.sx, sc.sz, opt.id, false);
          }
          lhOpenGui(server, pl, 'buildings');
        });
    });

    lhGuiSlot(gui, 8, 2, 'minecraft:gold_ingot', '§6🔨 Выставить на аукцион', [
      '§7Запускает торги за этот объект среди игроков и компаний.',
      '§fДлительность: §e3 минуты §7(анти-снайп +15с)',
      '§e▶ ЛКМ: выставить с авто-стартовой ценой (/lh auction create)'
    ], function (pl) {
      var tickNow = typeof LHOTTDTick === 'number' ? LHOTTDTick : 0;
      var aRes = global.LHOpenTTD.createFacilityAuction(st, myComp.id, sc.sx, sc.sz, 0, 3600, tickNow, { dimension: dim });
      if (aRes.ok) {
        lhOttdSave(server);
        lhMsg(pl, '§a[Аукцион ' + aRes.auction.id + '] Объект «' + aRes.auction.buildingName + '» выставлен от ' + aRes.auction.startPrice + ' Cr!');
      } else {
        lhMsg(pl, '§cОшибка аукциона: ' + aRes.reason);
      }
      lhOpenGui(server, pl, 'buildings');
    });
  } else {
    lhGuiSlot(gui, 4, 2, 'minecraft:barrier', '§7В секторе (' + sc.sx + ', ' + sc.sz + ') нет вашего здания', [
      '§7Захватите сектор на карте и нажмите на постройку в верхнем ряду.'
    ]);
  }

  // Row 3: Active Facility Auctions (Mini-game bidding!)
  var openAucs = (st.auctions || []).filter(function (a) { return a && a.status === 'open'; });
  if (openAucs.length === 0) {
    lhGuiSlot(gui, 0, 3, 'minecraft:bell', '§7Аукционов предприятий пока нет', [
      '§7Вы можете выставить свой объект на аукцион справа в ряду выше.'
    ]);
  } else {
    openAucs.slice(0, 9).forEach(function (a, ai) {
      var nextBid = a.highestBidderCid ? (a.currentBid + a.minIncrement) : a.startPrice;
      var isMine = myComp && a.sellerCid === myComp.id;
      lhGuiSlot(gui, ai, 3, 'minecraft:gold_block', '§6Аукцион ' + a.id + ': §f' + a.buildingName, [
        '§fПродавец: §7' + a.sellerCid + ' §7| Сектор (' + a.sx + ',' + a.sz + ') Ур.' + a.buildingLevel,
        '§fТекущая ставка: ' + (a.highestBidderCid ? ('§a' + a.currentBid + ' Cr (' + a.highestBidderCid + ')') : ('§eстарт ' + a.startPrice + ' Cr')),
        '§fСлед. ставка: §6' + nextBid + ' Cr',
        isMine ? '§cПКМ: отменить свой аукцион' : '§e▶ ЛКМ: сделать ставку ' + nextBid + ' Cr'
      ], function (pl) {
        if (!myComp || isMine) return;
        var tickNow = typeof LHOTTDTick === 'number' ? LHOTTDTick : 0;
        var br = global.LHOpenTTD.placeAuctionBid(st, a.id, myComp.id, nextBid, tickNow);
        if (br.ok) {
          lhOttdSave(server);
          lhMsg(pl, br.sold ? ('§a[Аукцион выигран!] Вы купили объект за ' + br.finalPrice + ' Cr!') : ('§a[Ставка ' + nextBid + ' Cr] Вы лидируете в торгах!'));
        } else {
          lhMsg(pl, '§cСтавка отклонена: ' + br.reason);
        }
        lhOpenGui(server, pl, 'buildings');
      }, function (pl) {
        if (!isMine) return;
        var cr = global.LHOpenTTD.cancelFacilityAuction(st, a.id, myComp.id);
        if (cr.ok) { lhOttdSave(server); lhMsg(pl, '§eАукцион отменён.'); }
        lhOpenGui(server, pl, 'buildings');
      });
    });
  }

  // Row 4: List of owned buildings
  if (myComp) {
    var owned = global.LHOpenTTD.listCompanyBuildings(st, myComp.id);
    owned.slice(0, 9).forEach(function (b, bi) {
      var sp = global.LHOpenTTD.BUILDING_CATALOG[b.type] || {};
      lhGuiSlot(gui, bi, 4, bIcons[b.type] || 'minecraft:chest', (b.rarityColor || '') + (b.structureName || sp.name || b.type) + ' §7(' + b.sx + ',' + b.sz + ')', [
        '§fУровень: §b' + b.level + '/3 §7| Статус: ' + (b.pausedReason === 'missing_inputs' ? '§cНет сырья' : '§aАктивен'),
        '§fНакоплено: §e' + (b.cashBuffer || 0) + ' Cr',
        '§7Ветки: ' + (b.branch1 || '-') + ' / ' + (b.branch2 || '-')
      ]);
    });
  }
}

function lhGuiRenderDiplomacy(gui, server, player) {
  var st = lhOttdRead(server);
  var myComp = lhGetPlayerCompany(server, player);
  var sc = global.LHOpenTTD.sectorCoords(player.x, player.z);
  if (!myComp) {
    lhGuiSlot(gui, 4, 2, 'minecraft:barrier', '§cВы не состоите в компании', ['§7Сначала создайте компанию во вкладке «Компании».'], function (pl) {
      lhOpenGui(server, pl, 'openttd');
    });
    return;
  }

  var others = Object.keys(st.companies || {}).filter(function (cid) { return cid !== myComp.id; });
  others.slice(0, 9).forEach(function (otherId, idx) {
    var c = st.companies[otherId];
    var rel = global.LHOpenTTD.getRelation(st, myComp.id, otherId);
    var pm = global.LHOpenTTD.getReputationPriceModifiers
      ? global.LHOpenTTD.getReputationPriceModifiers(rel.score)
      : { buyMult: 1.0, sellMult: 1.0, standing: '' };
    var tLic = global.LHOpenTTD.canTransit(st, myComp.id, otherId);
    var mLic = global.LHOpenTTD.canMine(st, myComp.id, otherId);
    lhGuiSlot(gui, idx, 1, LH_COMP_WOOL[lhCompanyMcColor(c)] || 'minecraft:white_wool',
      c.colorCode + c.name + (rel.alliance ? ' §a[АЛЬЯНС]' : ''),
      [
        '§fОтношение: §e' + rel.score + ' §7(' + global.LHOpenTTD.getStandingLabel(rel.score) + ')',
        '§fЦены: покупка §e×' + pm.buyMult + ' §7| сбыт §a×' + pm.sellMult,
        '§fПроход: ' + (tLic ? '§aЕсть' : '§cНет') + ' §7| Добыча: ' + (mLic ? '§aЕсть' : '§cНет'),
        '§aЛКМ: Альянс / Расторгнуть',
        '§bПКМ: Подарок (+15 отношений за 100 Cr)'
      ],
      function (pl) {
        if (typeof lhDiplomacyAction === 'function') lhDiplomacyAction(server, pl, 'ally', otherId, null, false);
        lhOpenGui(server, pl, 'diplomacy');
      },
      function (pl) {
        if (typeof lhDiplomacyAction === 'function') lhDiplomacyAction(server, pl, 'gift', otherId, 100, false);
        lhOpenGui(server, pl, 'diplomacy');
      });

    lhGuiSlot(gui, idx, 2, tLic ? 'minecraft:lime_dye' : 'minecraft:paper',
      tLic ? '§aПроход разрешён' : '§bКупить право прохода (120 Cr)',
      ['§7Снимает штрафы за пересечение границ ' + c.name, '§bПКМ: купить право добычи (240 Cr)'],
      function (pl) {
        if (!tLic && typeof lhDiplomacyAction === 'function') lhDiplomacyAction(server, pl, 'transit', otherId, null, false);
        lhOpenGui(server, pl, 'diplomacy');
      },
      function (pl) {
        if (!mLic && typeof lhDiplomacyAction === 'function') lhDiplomacyAction(server, pl, 'mining', otherId, null, false);
        lhOpenGui(server, pl, 'diplomacy');
      });
  });

  // Row 0 cols 0..2: Anti-Monopoly Coalitions against monopolists & aggressive companies
  if (global.LHOpenTTD.getMonopolyMetrics) {
    var monoList = global.LHOpenTTD.getMonopolyMetrics(st).filter(function (m) { return m.cid !== myComp.id; });
    monoList.slice(0, 3).forEach(function (m, mi) {
      var co = st.coalitions && st.coalitions[m.cid];
      var joined = !!(co && co.members && co.members.indexOf(myComp.id) !== -1);
      lhGuiSlot(gui, mi, 0, joined ? 'minecraft:red_banner' : 'minecraft:shield',
        (joined ? '§a✔ Коалиция против: ' : (m.isMonopolyTarget ? '§c⚠ Монополист: ' : '§eКоалиция против: ')) + m.name, [
          '§fДоля карты: §e' + Math.round(m.territoryShare * 100) + '% §7| Угроза: §c' + m.monopolyThreat,
          '§fНалог монополиста: §c' + Math.round(m.antiMonopolyTaxRate * 100) + '%',
          '§7Бонус коалиции: §a−30% цена захвата, +1 сила рейда, +100 Cr',
          joined ? '§eПКМ: выйти из коалиции' : '§e▶ ЛКМ: вступить в коалицию (/lh coalition join ' + m.cid + ')'
        ], function (pl) {
          if (!joined) {
            global.LHOpenTTD.joinAntiMonopolyCoalition(st, myComp.id, m.cid);
            lhOttdSave(server);
            lhMsg(pl, '§a[Коалиция] Вы вступили в пакт против «' + m.name + '»!');
          }
          lhOpenGui(server, pl, 'diplomacy');
        }, function (pl) {
          if (joined) {
            global.LHOpenTTD.leaveAntiMonopolyCoalition(st, myComp.id, m.cid);
            lhOttdSave(server);
            lhMsg(pl, '§eВы вышли из коалиции против «' + m.name + '».');
          }
          lhOpenGui(server, pl, 'diplomacy');
        });
    });
  }

  // Peaceful buyout button for current sector
  var curSec = global.LHOpenTTD.resolveSectorOwner(st, sc.sx, sc.sz);
  lhGuiSlot(gui, 4, 0, 'minecraft:gold_block', '§6Мирный выкуп сектора (' + sc.sx + ', ' + sc.sz + ')', [
    curSec.kind === 'claimed' && curSec.owner !== myComp.id
      ? ('§fВладелец: ' + curSec.owner + ' §7| Выкуп без войны (отношения > -30)')
      : '§7Встаньте в чужой захваченный сектор для мирного выкупа'
  ], function (pl) {
    if (typeof lhDiplomacyAction === 'function') lhDiplomacyAction(server, pl, 'buysector', curSec.owner || '', { sx: sc.sx, sz: sc.sz }, false);
    lhOpenGui(server, pl, 'diplomacy');
  });

  // Row 0 cols 6..8: Active Bot Hostile Mob Raids
  var activeRaids = (st.activeMobRaids || []).filter(function (r) { return r && r.status === 'active'; });
  if (activeRaids.length > 0) {
    activeRaids.slice(0, 3).forEach(function (ar, ari) {
      lhGuiSlot(gui, 6 + ari, 0, 'minecraft:iron_sword', '§c⚔ Бот-рейд ' + ar.id, [
        '§fАгрессор: §c' + (ar.attackerName || ar.attackerCid),
        '§fЦель: §e' + (ar.targetName || ar.targetCid) + ' @ (' + ar.sx + ',' + ar.sz + ')',
        '§fОтряд: §c' + (ar.mobCount || 4) + ' мобов §7(сила ' + ar.strength + ')'
      ]);
    });
  }

  // Row 3: Border Trade Visit passes (/lh trade visit <cid>)
  others.slice(0, 9).forEach(function (otherId, idx) {
    var c = st.companies[otherId];
    lhGuiSlot(gui, idx, 3, 'minecraft:ender_eye', '§bВизит к терминалу: ' + c.name, [
      '§7Покупает временный пограничный пропуск',
      '§7к торговому терминалу компании ' + c.id + '.',
      '§7Без пропуска охрана штрафует за вторжение.',
      '§e▶ ЛКМ: запросить визит (/lh trade visit ' + otherId + ')'
    ], function (pl) {
      if (typeof lhRequestBorderTrade === 'function') lhRequestBorderTrade(server, pl, otherId, false);
      lhOpenGui(server, pl, 'diplomacy');
    });
  });

  // Row 4: Periodic Supply Contracts (with upkeep-aware pricing & breach penalty)
  var openSupply = (st.supplyContracts || []).filter(function (s) { return s.status === 'open'; });
  openSupply.slice(0, 9).forEach(function (sup, si) {
    lhGuiSlot(gui, si, 4, sup.item || 'minecraft:chest', '§eПоставка ' + sup.id + ' (' + sup.buyerCid + ')', [
      '§fТребуется: §b' + sup.qty + '× ' + sup.item,
      '§fЦена (с содержанием): §a' + sup.price + ' Cr §7(содерж. +' + (sup.upkeepIncluded || 0) + ')',
      '§fПериодов ост.: §e' + sup.remainingBatches + (sup.timed ? (' §7| Штраф срыва: §c' + (sup.penaltyPerMiss || 0) + ' Cr') : ''),
      '§e▶ ЛКМ: выполнить поставку из инвентаря'
    ], function (pl) {
      lhGuiDeferAction(server, pl, function (p2) {
        if (server && server.commands && typeof p2.createCommandSourceStack === 'function') {
          server.commands.performPrefixedCommand(p2.createCommandSourceStack(), 'lh diplomacy supply fulfill ' + sup.id);
        }
      }, 'diplomacy');
    });
  });
}

function lhGuiRenderChapters(gui, server, player) {
  if (typeof lhChapterForkStatus !== 'function') return;
  var st = lhChapterForkStatus(server, player, false);
  if (!st) return;

  lhGuiSlot(gui, 4, 0, 'minecraft:enchanted_book', '§6Вилка глав по тирам сложности', [
    '§fТекущий тир: §e' + st.tierLabel,
    '§fОткрыто глав: §a' + st.unlocked.length + '/61',
    '§7Порядок: Обязательный старт (00-02) → Ранние (5) → Средние (6) → Поздние.'
  ]);

  if (!st.mandatoryDone) {
    lhGuiSlot(gui, 4, 2, 'minecraft:clock', '§eСначала завершите обязательные стартовые главы', [
      '§7• ch00 — Сюжетное вступление',
      '§7• ch01 — Правила консорциума (/lh rules confirm)',
      '§7• ch02 — Базовая мастерская'
    ]);
    return;
  }

  if (st.activePick) {
    var lbl = (typeof LH_CHAPTER_LABELS !== 'undefined' && LH_CHAPTER_LABELS[st.activePick]) ? LH_CHAPTER_LABELS[st.activePick] : st.activePick;
    lhGuiSlot(gui, 4, 2, 'minecraft:lime_concrete', '§aАктивная выбранная глава: ' + lbl, [
      '§7Завершите её квесты в Heracles,',
      '§7чтобы открыть новую вилку из 3 случайных глав!'
    ]);
    return;
  }

  var offerCols = [2, 4, 6];
  (st.offers || []).slice(0, 3).forEach(function (cid, idx) {
    var lbl = (typeof LH_CHAPTER_LABELS !== 'undefined' && LH_CHAPTER_LABELS[cid]) ? LH_CHAPTER_LABELS[cid] : cid;
    lhGuiSlot(gui, offerCols[idx], 2, 'minecraft:writable_book', '§6Вариант #' + (idx + 1) + ': §f' + lbl, [
      '§fКод главы: §b' + cid,
      '§fТир: §e' + st.tierLabel,
      '§e▶ ЛКМ: выбрать эту главу и открыть её в Heracles!'
    ], function (pl) {
      lhChapterForkPick(server, pl, cid, false);
      lhOpenGui(server, pl, 'chapters');
    });
  });
}

function lhGuiRenderMarket(gui, server, player) {
  var st = lhOttdRead(server);
  var econ = (typeof lhEconRead === 'function' && global.LHEconomyEngine) ? lhEconRead(server) : null;
  var myComp = typeof lhGetPlayerCompany === 'function' ? lhGetPlayerCompany(server, player) : null;

  // Row 0: Live Economy Benchmarks (Items, Fluids, Gases, FE Energy) + Physical Pickup Info
  if (econ && global.LHEconomyEngine) {
    var benchIds = [
      'minecraft:iron_ingot', 'minecraft:diamond', 'fluid:immersivepetroleum:crudeoil',
      'fluid:immersivepetroleum:diesel', 'gas:mekanism:hydrogen', 'energy:fe_10k'
    ];
    benchIds.forEach(function (bid, bIdx) {
      var q = global.LHEconomyEngine.getMarketQuote(econ, bid);
      var icon = bid.indexOf('fluid:') === 0 ? 'minecraft:bucket'
        : (bid.indexOf('gas:') === 0 ? 'minecraft:glass_bottle'
        : (bid.indexOf('energy:') === 0 ? 'minecraft:redstone_block' : bid));
      lhGuiSlot(gui, bIdx, 0, icon, (q.crashed ? '§c[ОБВАЛ] ' : '§e') + bid, [
        '§fБаза (редкость/крафт): §7' + q.basePrice + ' Cr',
        '§fРыночная цена: §a' + q.price + ' Cr §7(×' + q.multiplier + ')',
        '§7Спрос: §a' + q.demand + ' §7| Предложение: §c' + q.supply,
        q.crashed ? ('§c⚠ Обвал ещё ' + q.crashTicks + ' цикл.') : '§7Команда: /lh price check <id>'
      ]);
    });
    lhGuiSlot(gui, 7, 0, 'minecraft:minecart', '§aДоставки и Торг', [
      '§7Заказы с биржи едут в ваш терминал',
      '§7со скоростью транспорта (1.04–24 м/с).',
      '§eЛКМ: забрать прибывшие доставки в терминале',
      '§bПКМ: список доставок, торга и P2P в чат'
    ], function (pl) {
      lhGuiDeferAction(server, pl, function (p2) {
        if (typeof lhClaimArrivedDeliveriesAtTerminal === 'function') {
          lhClaimArrivedDeliveriesAtTerminal(server, p2, null);
        }
      }, 'market');
    }, function (pl) {
      if (server && server.commands && typeof pl.createCommandSourceStack === 'function') {
        server.commands.performPrefixedCommand(pl.createCommandSourceStack(), 'lh delivery list');
        server.commands.performPrefixedCommand(pl.createCommandSourceStack(), 'lh haggle status');
        server.commands.performPrefixedCommand(pl.createCommandSourceStack(), 'lh p2p list');
      }
    });
    lhGuiSlot(gui, 8, 0, 'minecraft:chest_minecart', '§6Логистика самовывоза', [
      '§7Покупка с витрины компании требует',
      '§7физически забрать груз со склада!',
      '§eКоманда: /lh shop sell hand <кол> <цена>',
      '§aЗабрать: /lh shop pickup <id>'
    ]);
  }

  var orders = (st.marketOrders || []).filter(function (o) { return o.remainingBatches > 0; });
  orders.slice(0, 18).forEach(function (o, idx) {
    var x = idx % 9;
    var y = 1 + Math.floor(idx / 9);
    var c = st.companies[o.companyId];
    var sub = st.subsidy && st.subsidy.orderId === o.id;
    var qLive = (econ && global.LHEconomyEngine) ? global.LHEconomyEngine.getMarketQuote(econ, o.item) : null;
    var lore = [
      (o.side === 'buy' ? '§aСКУПКА (вы продаёте)' : '§bПРОДАЖА (вы покупаете)'),
      '§fПартия: §e' + o.qty + '× ' + o.item,
      '§fБазовая цена лота: §6' + o.price + ' Cr §7(ост: ' + o.remainingBatches + ')',
      qLive ? ('§fЖивой рынок: §e×' + qLive.multiplier + (qLive.crashed ? ' §c[ОБВАЛ]' : '')) : '',
      '§7Контрагент: ' + (c ? c.name : o.companyId)
    ].filter(Boolean);
    if (sub) lore.push('§e★ ГОССУБСИДИЯ ×1.75!');
    lore.push(o.side === 'buy' ? '§e▶ ЛКМ: продать партию из инвентаря' : '§e▶ ЛКМ: купить (доставка или визит к терминалу)');
    lhGuiSlot(gui, x, y, o.item, (o.side === 'buy' ? '§a[СКУПКА] ' : '§b[ПРОДАЖА] ') + o.id, lore, function (pl) {
      lhGuiDeferAction(server, pl, function (p2) {
        if (o.side === 'buy') lhMarketSell(server, p2, o.id, false);
        else lhMarketBuy(server, p2, o.id, false);
      }, 'market');
    }, null, Math.min(64, o.qty));
  });

  // Row 3: Physical Company Facility Listings (Custom Price vs Live Market Reference)
  if (econ && global.LHEconomyEngine) {
    var listings = (econ.listings || []).filter(function (l) { return l.status === 'open' && l.qtyAvailable > 0; });
    listings.slice(0, 9).forEach(function (l, lIdx) {
      var q = global.LHEconomyEngine.getMarketQuote(econ, l.itemId);
      var seller = st.companies[l.sellerCid];
      var iconL = l.kind === 'fluid' ? 'minecraft:bucket'
        : (l.kind === 'gas' ? 'minecraft:glass_bottle'
        : (l.kind === 'energy' ? 'minecraft:redstone_block' : l.itemId));
      lhGuiSlot(gui, lIdx, 3, iconL, '§6Витрина ' + l.id + ': §f' + l.itemId, [
        '§fПродавец: ' + (seller ? seller.name : l.sellerCid),
        '§fЦена владельца: §e' + l.unitPrice + ' Cr/шт §7(рынок: §b' + q.price + ' Cr§7)',
        '§fВ наличии: §a' + l.qtyAvailable + ' §7| Склад: §7(' + l.x + ',' + l.y + ',' + l.z + ')',
        '§e▶ ЛКМ: оплатить 1 ед. (забрать лично на складе)'
      ], function (pl) {
        var bComp = lhGetPlayerCompany(server, pl);
        if (!bComp) { lhMsg(pl, 'Сначала создайте компанию.'); return; }
        var res = global.LHEconomyEngine.buyFacilityListing(st, econ, bComp.id, l.id, 1);
        if (!res.ok) { lhMsg(pl, '§cОшибка покупки: ' + res.reason); }
        else {
          lhOttdSave(server);
          lhEconSave(server);
          lhMsg(pl, '§a[Заказ ' + res.order.id + '] Оплачено! Заберите лично на (' + res.order.x + ',' + res.order.y + ',' + res.order.z + '): /lh shop pickup ' + res.order.id);
        }
        lhOpenGui(server, pl, 'market');
      });
    });
  }

  // Row 4: Ready Physical Pickup Orders (left) + Open P2P Trades (right)
  var readyPickups = (econ && myComp && global.LHEconomyEngine) ? global.LHEconomyEngine.listReadyPickups(econ, myComp.id) : [];
  readyPickups.slice(0, 4).forEach(function (po, pIdx) {
    lhGuiSlot(gui, pIdx, 4, 'minecraft:barrel', '§aСамовывоз ' + po.id, [
      '§fГруз: §e' + po.qty + '× ' + po.itemId,
      '§fСклад: §b(' + po.x + ', ' + po.y + ', ' + po.z + ')',
      '§e▶ ЛКМ: забрать груз (нужно быть рядом ≤ 24 м)'
    ], function (pl) {
      lhGuiDeferAction(server, pl, function (p2) {
        var res = global.LHEconomyEngine.pickupLogisticsOrder(econ, myComp.id, po.id, p2.x, p2.y, p2.z, 24);
        if (!res.ok) {
          lhMsg(p2, res.reason === 'too_far'
            ? ('§cВы в ' + res.distance + ' м от склада (' + res.target.x + ',' + res.target.y + ',' + res.target.z + ')!')
            : ('§cОшибка: ' + res.reason));
        } else {
          lhEconSave(server);
          if (po.kind === 'item' && typeof Item !== 'undefined' && typeof p2.give === 'function') {
            p2.give(Item.of(po.itemId, Math.min(256, po.qty)));
          }
          lhMsg(p2, '§a[Самовывоз ' + po.id + '] Получено ' + po.qty + '× ' + po.itemId + '!');
        }
      }, 'market');
    });
  });

  var openTrades = (st.tradeOffers || []).filter(function (t) { return t.status === 'open'; });
  openTrades.slice(0, 5).forEach(function (tr, idx) {
    lhGuiSlot(gui, 4 + idx, 4, tr.item || 'minecraft:emerald', '§dСделка: ' + tr.id, [
      '§f' + tr.sellerCompany + ' → ' + tr.targetCompany,
      '§fЛот: §e' + tr.qty + '× ' + tr.item + ' за §6' + tr.price + ' Cr',
      '§e▶ ЛКМ: принять с доставкой (/lh trade accept ' + tr.id + ')'
    ], function (pl) {
      lhGuiDeferAction(server, pl, function (p2) {
        lhAcceptTradeOffer(server, p2, tr.id, false);
      }, 'market');
    });
  });
}

function lhGuiRenderEvents(gui, server, player, filterCat) {
  var db = typeof lhEventsRead === 'function' ? lhEventsRead(server) : { events: [], playerPrefs: {} };
  var pid = lhId(player);
  var pref = (db.playerPrefs && db.playerPrefs[pid]) || 'brief';
  var cat = filterCat ? String(filterCat) : 'all';

  var cats = [
    ['all', 'minecraft:book', '§fВсе'],
    ['bot', 'minecraft:iron_helmet', '§7Боты'],
    ['market', 'minecraft:gold_ingot', '§eБиржа'],
    ['territory', 'minecraft:filled_map', '§bТерритории'],
    ['raid', 'minecraft:iron_sword', '§cРейды'],
    ['hazard', 'minecraft:slime_ball', '§2Угрозы'],
    ['chapter', 'minecraft:writable_book', '§aГлавы']
  ];
  cats.forEach(function (c, i) {
    var active = (cat === c[0]);
    lhGuiSlot(gui, i, 0, c[1], (active ? '§a[✔] ' : '') + c[2], ['§7Фильтр категории: ' + c[0]], function (pl) {
      lhOpenGui(server, pl, 'events', c[0]);
    });
  });

  var nextPref = pref === 'brief' ? 'off' : (pref === 'off' ? 'all' : 'brief');
  lhGuiSlot(gui, 8, 0, 'minecraft:bell', '§6Чат: ' + pref, [
    '§7brief = только важные, off = тихо, all = всё.',
    '§e▶ ЛКМ: переключить на «' + nextPref + '»'
  ], function (pl) {
    db.playerPrefs[lhId(pl)] = nextPref;
    lhEventsSave(server);
    lhMsg(pl, 'Режим уведомлений в чате: ' + nextPref);
    lhOpenGui(server, pl, 'events', cat);
  });

  var list = (db.events || []).filter(function (ev) { return cat === 'all' || ev.cat === cat; });
  var shown = list.slice(Math.max(0, list.length - 27)).reverse();
  shown.forEach(function (ev, idx) {
    var x = idx % 9;
    var y = 1 + Math.floor(idx / 9);
    lhGuiSlot(gui, x, y, 'minecraft:paper', '§8[' + ev.clock + '] §f' + (ev.label || ev.cat), [
      '§f' + ev.text
    ]);
  });
}

function lhGuiRenderWorld(gui, server, player) {
  var diff = typeof lhDifficultyStatus === 'function' ? lhDifficultyStatus(server) : { coeff: 1, onlineDeaths: 0, onlinePlayers: 1, voidoutPower: 1, respawnRadius: 0 };
  var gas = typeof lhGasComputeStatus === 'function' ? lhGasComputeStatus(server) : { phase: 1, level: 0 };
  var progDb = typeof lhProgRead === 'function' ? lhProgRead(server) : { featureOrder: [], rulesConfirmed: false, nuclearVerified: false, doomedVerified: false };

  lhGuiSlot(gui, 1, 1, 'minecraft:raw_iron', '§6Рудоразведка чанка (/lh prospect)', [
    '§7Проверяет богатые глубокие жилы в текущем чанке.'
  ], function (pl) {
    if (typeof lhProspectChunk === 'function') lhProspectChunk(server, pl);
  });

  lhGuiSlot(gui, 3, 1, 'minecraft:nautilus_shell', '§cСтатус Бессмертной Улитки', [
    '§7Выводит дистанцию и состояние охоты Улитки в чат.'
  ], function (pl) {
    if (server && server.commands && typeof pl.createCommandSourceStack === 'function') {
      server.commands.performPrefixedCommand(pl.createCommandSourceStack(), 'lh snail status');
    }
  });

  lhGuiSlot(gui, 5, 1, 'minecraft:green_dye', '§2Токсичный газ (/lh gas status)', [
    '§fФаза: §e' + (gas.phase || 1) + ' §7| Опасность: ' + (gas.level || 0)
  ], function (pl) {
    if (server && server.commands && typeof pl.createCommandSourceStack === 'function') {
      server.commands.performPrefixedCommand(pl.createCommandSourceStack(), 'lh gas status');
    }
  });

  lhGuiSlot(gui, 7, 1, 'minecraft:tnt', '§4Сложность и Voidout', [
    '§fКоэффициент: §ek=' + (Math.round(diff.coeff * 100) / 100),
    '§fСила Voidout: §c' + (Math.round((diff.voidoutPower || 1) * 100) / 100),
    '§fРадиус спауна: §e' + (diff.respawnRadius || 0) + ' м'
  ], function (pl) {
    lhMsg(pl, 'Сложность k=' + (Math.round(diff.coeff * 100) / 100) + ', смертей онлайн=' + diff.onlineDeaths + ', Voidout=' + (Math.round((diff.voidoutPower || 1) * 100) / 100));
  });

  var totalPool = (typeof global !== 'undefined' && global.LHHardFeatureCatalog) ? global.LHHardFeatureCatalog.length : 100;
  lhGuiSlot(gui, 2, 3, 'minecraft:emerald', '§cКолесо Угроз (/lh casino status)', [
    '§fАктивно угроз: §c' + (progDb.featureOrder || []).length + '/' + totalPool,
    '§7Показывает базовые и открытые главами усложнения.'
  ], function (pl) {
    if (server && server.commands && typeof pl.createCommandSourceStack === 'function') {
      server.commands.performPrefixedCommand(pl.createCommandSourceStack(), 'lh casino status');
    }
  });

  lhGuiSlot(gui, 4, 3, 'minecraft:written_book', progDb.rulesConfirmed ? '§a✔ Правила подтверждены' : '§eПодтвердить правила (/lh rules confirm)', [
    '§7Засчитывает вводную главу 01 консорциума.'
  ], function (pl) {
    if (server && server.commands && typeof pl.createCommandSourceStack === 'function') {
      server.commands.performPrefixedCommand(pl.createCommandSourceStack(), 'lh rules confirm');
    }
    lhOpenGui(server, pl, 'world');
  });

  lhGuiSlot(gui, 6, 3, 'minecraft:nether_star', progDb.nuclearVerified ? '§a✔ Ядерка проверена' : '§bПроверить Ядерку (/lh nuclear verify)', [
    '§7Верифицирует прогресс ядерной энергетики и Draconic Evolution.'
  ], function (pl) {
    if (server && server.commands && typeof pl.createCommandSourceStack === 'function') {
      server.commands.performPrefixedCommand(pl.createCommandSourceStack(), 'lh nuclear verify');
    }
    lhOpenGui(server, pl, 'world');
  });

  lhGuiSlot(gui, 8, 3, 'minecraft:iron_sword', progDb.doomedVerified ? '§a✔ DOOMED (Гл. 14) отмечен' : '§eПодтвердить DOOMED (/lh doomed verify)', [
    '§7Подтверждает Главу 14 (DOOMED: Хардкор-выживание).'
  ], function (pl) {
    if (server && server.commands && typeof pl.createCommandSourceStack === 'function') {
      server.commands.performPrefixedCommand(pl.createCommandSourceStack(), 'lh doomed verify');
    }
    lhOpenGui(server, pl, 'world');
  });
}

function lhGuiRenderHelp(gui, server, player) {
  lhGuiSlot(gui, 1, 1, 'minecraft:knowledge_book', '§6Вывести полную справку в чат', [
    '§7Отправит все основные команды /lh в ваш чат.'
  ], function (pl) {
    if (server && server.commands && typeof pl.createCommandSourceStack === 'function') {
      server.commands.performPrefixedCommand(pl.createCommandSourceStack(), 'lh help');
    }
  });

  lhGuiSlot(gui, 3, 1, 'longhaul:control_tablet', '§eВыдать Планшет диспетчера', [
    '§7Открывает этот GUI по ПКМ в любое время.',
    '§7Команда: /lh или /lh gui'
  ], function (pl) {
    lhGuiDeferAction(server, pl, function (p2) {
      p2.give('longhaul:control_tablet');
      lhMsg(p2, 'Планшет диспетчера выдан в инвентарь.');
    });
  });

  lhGuiSlot(gui, 5, 1, 'heracles:quest_book', '§aВыдать Квестбук Heracles', [
    '§7Основные главы, заказы каталога и туториалы.'
  ], function (pl) {
    lhGuiDeferAction(server, pl, function (p2) {
      p2.give('heracles:quest_book');
      lhMsg(p2, 'Квестбук Heracles выдан в инвентарь.');
    });
  });

  lhGuiSlot(gui, 7, 1, 'minecraft:lightning_rod', '§bСтартовая радиостанция (/lh radio kit)', [
    '§7Выдаёт рацию Realistic Walkie-Talkie (100–999 МГц)',
    '§7при установленном опциональном моде.'
  ], function (pl) {
    lhGuiDeferAction(server, pl, function (p2) {
      if (typeof lhGrantStarterRadio === 'function') {
        lhGrantStarterRadio(server, p2, true);
      } else if (server && server.commands && typeof p2.createCommandSourceStack === 'function') {
        server.commands.performPrefixedCommand(p2.createCommandSourceStack(), 'lh radio kit');
      }
    });
  });

  lhGuiSlot(gui, 4, 3, 'minecraft:paper', '§fНовые команды логистики и среды', [
    '§e/lh company env <normal|air|sea|underground> §7— среда штаба',
    '§e/lh trade visit <id> §7— пограничный пропуск к терминалу',
    '§e/lh delivery list|claim §7— доставки (1.04–24 м/с)',
    '§e/lh haggle start <comp> <buy|sell> <item> <qty> §7— торг',
    '§e/lh p2p propose <игрок> ... §7— P2P обмен рядом (<= 10м)',
    '§e/lh radio kit §7— получить рацию'
  ]);
}

function lhGuiRenderBank(gui, server, player) {
  var st = lhOttdRead(server);
  var myComp = lhGetPlayerCompany(server, player);
  var nowTick = typeof LHOTTDTick === 'number' ? LHOTTDTick : 0;
  var cb = global.LHOpenTTD.updateCentralBankKeyRate ? global.LHOpenTTD.updateCentralBankKeyRate(st) : { keyRate: 0.08, inflationIndex: 1.0 };

  if (!myComp) {
    lhGuiSlot(gui, 4, 1, 'minecraft:barrier', '§cНет компании', [
      '§7Сначала создайте или выберите компанию на вкладке «Компании».'
    ]);
    return;
  }

  var lim = global.LHOpenTTD.getMaxLoanLimit ? global.LHOpenTTD.getMaxLoanLimit(st, myComp.id) : 1000;
  var effRate = global.LHOpenTTD.getEffectiveLoanRate ? global.LHOpenTTD.getEffectiveLoanRate(st, myComp.id) : cb.keyRate;
  var debt = global.LHOpenTTD.getCompanyActiveDebt ? global.LHOpenTTD.getCompanyActiveDebt(st, myComp.id) : 0;
  var expBr = global.LHOpenTTD.computeCompanyExpenses ? global.LHOpenTTD.computeCompanyExpenses(st, myComp.id) : { total: 0, progressiveTax: 0, progressiveBracketLabel: '5%', antiMonopolyTax: 0, auditPenaltyTax: 0 };
  var comeback = global.LHOpenTTD.getComebackStatus ? global.LHOpenTTD.getComebackStatus(st, myComp.id) : { active: false };

  lhGuiSlot(gui, 1, 0, 'minecraft:gold_block', '§e🏛 Центральный Банк Консорциума', [
    '§fКлючевая ставка ЦБ: §e' + Math.round(cb.keyRate * 1000) / 10 + '% §7(инфляция ' + cb.inflationIndex + ')',
    '§fВаша ставка по займу: §b' + Math.round(effRate * 1000) / 10 + '%/цикл',
    '§fКредитный лимит: §a' + lim + ' Cr',
    '§fТекущий долг по кредитам: §c' + debt + ' Cr',
    '§7При просрочке активы и сектора уходят на принудительный аукцион!'
  ]);

  lhGuiSlot(gui, 2, 0, 'minecraft:gold_ingot', '§aВзять заём 500 Cr', [
    '§7Срок: 5 циклов | Ставка: ' + Math.round(effRate * 1000) / 10 + '%',
    '§e▶ ЛКМ: оформить заём 500 Cr'
  ], function (pl) {
    var r1 = global.LHOpenTTD.takeBankLoan(st, myComp.id, 500, 5, nowTick);
    if (r1.ok) { lhOttdSave(server); lhMsg(pl, '§a[Банк] Получен заём 500 Cr. К возврату: ' + r1.loan.totalDue + ' Cr.'); }
    else { lhMsg(pl, '§cОтказ банка: ' + r1.reason); }
    lhOpenGui(server, pl, 'bank');
  });

  lhGuiSlot(gui, 3, 0, 'minecraft:emerald_block', '§aВзять заём 1500 Cr', [
    '§7Срок: 5 циклов | Ставка: ' + Math.round(effRate * 1000) / 10 + '%',
    '§e▶ ЛКМ: оформить заём 1500 Cr'
  ], function (pl) {
    var r2 = global.LHOpenTTD.takeBankLoan(st, myComp.id, 1500, 5, nowTick);
    if (r2.ok) { lhOttdSave(server); lhMsg(pl, '§a[Банк] Получен заём 1500 Cr. К возврату: ' + r2.loan.totalDue + ' Cr.'); }
    else { lhMsg(pl, '§cОтказ банка: ' + r2.reason); }
    lhOpenGui(server, pl, 'bank');
  });

  lhGuiSlot(gui, 4, 0, 'minecraft:emerald', '§bПогасить кредит', [
    '§fТекущий долг: §c' + debt + ' Cr §7| Касса: §e' + myComp.cash + ' Cr',
    '§e▶ ЛКМ: погасить максимум из кассы'
  ], function (pl) {
    var rp = global.LHOpenTTD.repayBankLoan(st, myComp.id);
    if (rp.ok) { lhOttdSave(server); lhMsg(pl, '§a[Банк] Погашено ' + rp.paid + ' Cr. Остаток: ' + rp.remainingDebt + ' Cr.'); }
    else { lhMsg(pl, '§cНе удалось погасить: ' + rp.reason); }
    lhOpenGui(server, pl, 'bank');
  });

  lhGuiSlot(gui, 6, 0, 'minecraft:paper', '§6Налоги и Содержание', [
    '§fСкобка прогрессии: §b' + (expBr.progressiveBracketLabel || '5%'),
    '§fПрогрессивный налог: §e' + (expBr.progressiveTax || 0) + ' Cr',
    '§fАнтимонопольный (с акциями): §c' + (expBr.antiMonopolyTax || 0) + ' Cr',
    '§fШтраф аудита: §4' + (expBr.auditPenaltyTax || 0) + ' Cr §7| Недоимка: §c' + (myComp.unpaidUpkeep || 0) + ' Cr',
    '§7Итого за цикл: §e' + expBr.total + ' Cr'
  ]);

  lhGuiSlot(gui, 7, 0, 'minecraft:amethyst_shard', '§dУклонение: Подкуп инспектора', [
    '§7Стоимость: §e80 Cr §7| Риск поимки ~28%',
    '§7Успех: скидка −35% на налоги, −60 Cr долга.',
    '§cПровал: штраф +220 Cr и аудит +35% на 3 цикла!',
    '§e▶ ЛКМ: рискнуть'
  ], function (pl) {
    var ev1 = global.LHOpenTTD.attemptTaxEvasion(st, myComp.id, 'bribe', nowTick);
    if (ev1.ok) {
      lhOttdSave(server);
      lhMsg(pl, ev1.succeeded ? ('§a[Подкуп удался] −' + ev1.discountPct + '% налога!') : ('§c[ПРОВАЛ АУДИТА!] Штраф +' + ev1.fine + ' Cr и доп.налог на 3 цикла!'));
    } else {
      lhMsg(pl, '§cНедоступно: ' + ev1.reason);
    }
    lhOpenGui(server, pl, 'bank');
  });

  lhGuiSlot(gui, 8, 0, 'minecraft:writable_book', '§dУклонение: Подделка отчётов', [
    '§7Стоимость: §e140 Cr §7| Риск поимки ~42%',
    '§7Успех: скидка −55% на налоги, −140 Cr долга.',
    '§cПровал: крупный штраф +350 Cr и аудит +35% на 3 цикла!',
    '§e▶ ЛКМ: рискнуть'
  ], function (pl) {
    var ev2 = global.LHOpenTTD.attemptTaxEvasion(st, myComp.id, 'forge_docs', nowTick);
    if (ev2.ok) {
      lhOttdSave(server);
      lhMsg(pl, ev2.succeeded ? ('§a[Подлог удался] −' + ev2.discountPct + '% налога!') : ('§c[ПРОВАЛ АУДИТА!] Штраф +' + ev2.fine + ' Cr и доп.налог на 3 цикла!'));
    } else {
      lhMsg(pl, '§cНедоступно: ' + ev2.reason);
    }
    lhOpenGui(server, pl, 'bank');
  });

  lhGuiSlot(gui, 1, 1, comeback.active ? 'minecraft:totem_of_undying' : 'minecraft:iron_ingot',
    comeback.active ? ('§a★ Камбэк-бонусы (Ур.' + comeback.tier + ')') : '§7Камбэк-программа', [
      comeback.active
        ? ('§fНалоги: §a−' + Math.round(comeback.taxDiscount * 100) + '% §7| Выпуск: §a×' + comeback.yieldMult)
        : '§7Вы не отстаёте от лидера достаточно сильно.',
      comeback.active
        ? ('§fЗахват земли: §a−' + Math.round(comeback.claimDiscount * 100) + '% §7| ЦБ ставка: §a×0.5')
        : '§7Бонусы включаются автоматически при отставании <45% лидера.',
      '§e▶ ЛКМ: запросить антикризисный грант (/lh comeback bailout)'
    ], function (pl) {
      var cbRes = global.LHOpenTTD.activateComebackBailout(st, myComp.id, nowTick);
      if (cbRes.ok) {
        lhOttdSave(server);
        lhMsg(pl, '§a[Антикризисная помощь] +' + cbRes.grantCash + ' Cr, +' + cbRes.grantCoal + ' угля, списано ' + cbRes.debtForgiven + ' Cr долга!');
      } else {
        lhMsg(pl, '§cГрант недоступен: ' + cbRes.reason);
      }
      lhOpenGui(server, pl, 'bank');
    });

  // Row 3: Equity Market (buy +10% LMB / sell -10% RMB)
  var compKeys = Object.keys(st.companies || {}).filter(function (cid) {
    return st.companies[cid] && !st.companies[cid].isPirate;
  });
  compKeys.slice(0, 9).forEach(function (cid, idx) {
    var tc = st.companies[cid];
    var sp = global.LHOpenTTD.getSharePrice ? global.LHOpenTTD.getSharePrice(st, cid) : 50;
    var myShares = (tc.shareHoldings && tc.shareHoldings[myComp.id]) ? tc.shareHoldings[myComp.id] : 0;
    var freeShares = (tc.shareHoldings && tc.shareHoldings[cid]) ? tc.shareHoldings[cid] : 0;
    var capNote = tc.isBot ? 'до 100%' : 'до 49% (без поглощения)';
    lhGuiSlot(gui, idx, 3, cid === myComp.id ? 'minecraft:diamond' : 'minecraft:emerald',
      tc.colorCode + 'Акции: ' + tc.name, [
        '§fЦена 1% доли: §e' + sp + ' Cr §7(10% = ' + (sp * 10) + ' Cr)',
        '§fВаша доля: §a' + myShares + '% §7| Свободно: §b' + freeShares + '%',
        '§7Лимит владения: ' + capNote,
        '§eЛКМ: купить +10% | ПКМ: продать −10%'
      ], function (pl) {
        var br = global.LHOpenTTD.buyCompanyShares(st, myComp.id, cid, 10);
        if (br.ok) { lhOttdSave(server); lhMsg(pl, '§aКуплено 10% акций ' + tc.name + ' за ' + br.cost + ' Cr.'); }
        else { lhMsg(pl, '§cОшибка покупки: ' + br.reason); }
        lhOpenGui(server, pl, 'bank');
      }, function (pl) {
        var sr = global.LHOpenTTD.sellCompanyShares(st, myComp.id, cid, 10);
        if (sr.ok) { lhOttdSave(server); lhMsg(pl, '§aПродано 10% акций ' + tc.name + ' за ' + sr.proceeds + ' Cr.'); }
        else { lhMsg(pl, '§cОшибка продажи: ' + sr.reason); }
        lhOpenGui(server, pl, 'bank');
      });
  });
}

function lhGuiRenderPirates(gui, server, player) {
  var st = lhOttdRead(server);
  var logSt = typeof lhLogisticsRead === 'function' ? lhLogisticsRead(server) : { automatedRoutes: [] };
  var myComp = lhGetPlayerCompany(server, player);
  var nowTick = typeof LHOTTDTick === 'number' ? LHOTTDTick : 0;
  var ps = global.LHOpenTTD.ensurePirateSyndicate ? global.LHOpenTTD.ensurePirateSyndicate(st) : { level: 1, power: 10, cash: 0, caravansRobbed: 0, raidsCompleted: 0, lootStash: [] };

  lhGuiSlot(gui, 1, 0, 'minecraft:skeleton_skull', '§c☠ Синдикат Корсаров (Ур.' + ps.level + ')', [
    '§fБоевая мощь: §c' + ps.power + ' §7| Казна: §e' + ps.cash + ' Cr',
    '§fОграблено караванов: §c' + ps.caravansRobbed + ' §7| Набегов: §c' + ps.raidsCompleted,
    '§7Корсары усиливаются от каждого грабежа и заказа!',
    '§7Длинные маршруты (>=2 секторов) без охраны под угрозой.'
  ]);

  if (myComp) {
    var immuneUntil = Number(myComp.pirateImmunityUntilTick || 0);
    var isImm = immuneUntil > nowTick;
    var immCost = 180 + ps.level * 45;
    lhGuiSlot(gui, 3, 0, isImm ? 'minecraft:totem_of_undying' : 'minecraft:shield',
      isImm ? '§a✔ Чёрный пакт активен' : '§eКупить Чёрный пакт неприкосновенности', [
        '§7Защищает ваши караваны от пиратов на 10 минут.',
        '§fЦена: §6' + immCost + ' Cr',
        '§e▶ ЛКМ: заключить пакт (/lh pirate immunity)'
      ], function (pl) {
        var rImm = global.LHOpenTTD.buyPirateImmunity(st, myComp.id, 12000, nowTick);
        if (rImm.ok) { lhOttdSave(server); lhMsg(pl, '§a[Корсары] Пакт неприкосновенности активирован!'); }
        else { lhMsg(pl, '§cНе хватает Cr (нужно ' + rImm.cost + ').'); }
        lhOpenGui(server, pl, 'pirates');
      });

    // Row 1: Hire anonymous pirate raids against rival companies
    var targets = Object.keys(st.companies || {}).filter(function (cid) {
      return cid !== myComp.id && st.companies[cid] && !st.companies[cid].isPirate;
    });
    targets.slice(0, 8).forEach(function (tid, idx) {
      var tc = st.companies[tid];
      var c1 = Math.round(250 * 1.25);
      var c3 = Math.round(750 * 1.25);
      lhGuiSlot(gui, idx, 1, 'minecraft:crossbow', '§6Наёмный налёт на ' + tc.colorCode + tc.name, [
        '§7Штаб цели: (' + tc.hqSx + ', ' + tc.hqSz + ') | Наём анонимный',
        '§fТир 1 (разведгруппа): §e~' + c1 + ' Cr',
        '§fТир 3 (тяжёлый штурм): §c~' + c3 + ' Cr',
        '§eЛКМ: налёт Тир 1 | ПКМ: штурм Тир 3'
      ], function (pl) {
        var o1 = global.LHOpenTTD.orderPirateRaid(st, myComp.id, tid, tc.hqSx, tc.hqSz, 1, nowTick, { anonymous: true });
        if (o1.ok) {
          if (typeof lhSpawnBotMobRaids === 'function') lhSpawnBotMobRaids(server, st);
          lhOttdSave(server);
          lhMsg(pl, '§6[Корсары] Направлен анонимный налёт на «' + tc.name + '» (' + o1.cost + ' Cr)!');
        } else { lhMsg(pl, '§cОтказ: ' + o1.reason); }
        lhOpenGui(server, pl, 'pirates');
      }, function (pl) {
        var o3 = global.LHOpenTTD.orderPirateRaid(st, myComp.id, tid, tc.hqSx, tc.hqSz, 3, nowTick, { anonymous: true });
        if (o3.ok) {
          if (typeof lhSpawnBotMobRaids === 'function') lhSpawnBotMobRaids(server, st);
          lhOttdSave(server);
          lhMsg(pl, '§c[Корсары] Направлен штурм Тир 3 на «' + tc.name + '» (' + o3.cost + ' Cr)!');
        } else { lhMsg(pl, '§cОтказ: ' + o3.reason); }
        lhOpenGui(server, pl, 'pirates');
      });
    });

    // Row 3: Black market loot stash (object { itemId: qty })
    var lootKeys = Object.keys(ps.lootStash || {}).filter(function (lk) { return Number(ps.lootStash[lk] || 0) > 0; });
    lootKeys.slice(0, 8).forEach(function (itemId, lIdx) {
      var lQty = Number(ps.lootStash[itemId] || 0);
      var estUnit = global.LHOpenTTD.estimateItemUnitPrice ? global.LHOpenTTD.estimateItemUnitPrice(itemId) : 10;
      var lotPrice = Math.max(10, Math.round(estUnit * lQty * 0.65));
      lhGuiSlot(gui, lIdx, 3, 'minecraft:chest', '§dТрофей: ' + lQty + '× ' + itemId, [
        '§7Склад трофеев Синдиката Корсаров',
        '§fЦена выкупа (−35%): §e' + lotPrice + ' Cr',
        '§e▶ ЛКМ: выкупить на склад компании'
      ], function (pl) {
        var bm = global.LHOpenTTD.buyPirateBlackMarketLoot(st, myComp.id, itemId, lQty);
        if (bm.ok) {
          lhOttdSave(server);
          lhMsg(pl, '§a[Чёрный рынок] Куплено ' + bm.qty + '× ' + bm.itemId + ' за ' + bm.cost + ' Cr!');
        } else { lhMsg(pl, '§cНе удалось выкупить: ' + bm.reason); }
        lhOpenGui(server, pl, 'pirates');
      });
    });

    // Row 4: My automated caravans (toggle escort)
    var myRoutes = (logSt.automatedRoutes || []).filter(function (r) { return r && r.companyId === myComp.id; });
    myRoutes.slice(0, 8).forEach(function (rt, rIdx) {
      var risk = global.LHOpenTTD.computeCaravanPiracyRisk
        ? global.LHOpenTTD.computeCaravanPiracyRisk(st, myComp.id, rt.srcSx, rt.srcSz, rt.dstSx, rt.dstSz, !!rt.escortEnabled, nowTick)
        : 0;
      lhGuiSlot(gui, rIdx, 4, rt.escortEnabled ? 'minecraft:shield' : 'minecraft:minecart',
        (rt.escortEnabled ? '§a[ОХРАНА] ' : '§e[БЕЗ ОХРАНЫ] ') + 'Караван ' + rt.id, [
          '§f(' + rt.srcSx + ',' + rt.srcSz + ') → (' + rt.dstSx + ',' + rt.dstSz + ')',
          '§fРиск грабежа: §c' + Math.round(risk * 100) + '% §7| Ограблен раз: ' + (rt.robbedCount || 0),
          '§e▶ ЛКМ: переключить охрану каравана'
        ], function (pl) {
          rt.escortEnabled = !rt.escortEnabled;
          if (typeof lhLogisticsSave === 'function') lhLogisticsSave(server);
          lhMsg(pl, '§eОхрана каравана ' + rt.id + ': ' + (rt.escortEnabled ? '§aВКЛ' : '§cВЫКЛ'));
          lhOpenGui(server, pl, 'pirates');
        });
    });
  }
}

function lhRenderGuiTab(gui, server, player, tab, arg) {
  var activeTab = String(tab || 'hub').toLowerCase();
  lhGuiFillBg(gui, 6);
  if (activeTab === 'contracts') lhGuiRenderContracts(gui, server, player);
  else if (activeTab === 'chapters') lhGuiRenderChapters(gui, server, player);
  else if (activeTab === 'sites') lhGuiRenderSites(gui, server, player);
  else if (activeTab === 'logistics') lhGuiRenderLogistics(gui, server, player);
  else if (activeTab === 'recovery') lhGuiRenderRecovery(gui, server, player);
  else if (activeTab === 'openttd') lhGuiRenderOpenTTD(gui, server, player);
  else if (activeTab === 'buildings') lhGuiRenderBuildings(gui, server, player);
  else if (activeTab === 'diplomacy') lhGuiRenderDiplomacy(gui, server, player);
  else if (activeTab === 'territory') lhGuiRenderTerritory(gui, server, player);
  else if (activeTab === 'market') lhGuiRenderMarket(gui, server, player);
  else if (activeTab === 'bank') lhGuiRenderBank(gui, server, player);
  else if (activeTab === 'pirates') lhGuiRenderPirates(gui, server, player);
  else if (activeTab === 'events') lhGuiRenderEvents(gui, server, player, arg || 'all');
  else if (activeTab === 'world') lhGuiRenderWorld(gui, server, player);
  else if (activeTab === 'help') lhGuiRenderHelp(gui, server, player);
  else lhGuiRenderHub(gui, server, player);
  lhGuiFooter(gui, server, activeTab, arg);
}

function lhOpenGui(server, player, tab, arg) {
  if (!player || typeof player.openChestGUI !== 'function') return 0;
  var activeTab = String(tab || 'hub').toLowerCase();
  var titleMap = {
    hub: '§6Long Haul 2.0 — Диспетчерская',
    chapters: '§6Long Haul — Вилка глав (3 случайные)',
    contracts: '§6Long Haul — Контракты и терминал',
    sites: '§bLong Haul — Узлы и производство',
    logistics: '§aLong Haul — Лагеря, маршруты и грузы',
    recovery: '§fLong Haul — Восстановление и заказы',
    openttd: '§aLong Haul — Компании OpenTTD',
    buildings: '§eLong Haul — Здания и вилка прокачки',
    diplomacy: '§dLong Haul — Дипломатия и лицензии',
    territory: '§bLong Haul — Карта секторов 7×5 (Зум)',
    market: '§6Long Haul — Биржа и P2P-сделки',
    bank: '§eLong Haul — Банк, Налоги, Акции и Камбэк',
    pirates: '§6Long Haul — Синдикат Корсаров и Караваны',
    events: '§dLong Haul — Лог событий',
    world: '§cLong Haul — Мир, угрозы и вехи',
    help: '§eLong Haul — Справка'
  };
  var title = titleMap[activeTab] || titleMap.hub;

  player.openChestGUI(title, 6, function (gui) {
    lhRenderGuiTab(gui, server, player, activeTab, arg);
  });
  return 1;
}

ItemEvents.rightClicked('longhaul:control_tablet', function (event) {
  if (!event.server || !event.player) return;
  lhOpenGui(event.server, event.player, 'hub');
  if (typeof event.cancel === 'function') event.cancel();
});

ServerEvents.commandRegistry(function (event) {
  var C = event.commands;
  var root = C.literal('lh');
  root.executes(function (ctx) {
    return lhOpenGui(ctx.source.server, ctx.source.playerOrException, 'hub');
  });

  ['gui', 'ui', 'menu'].forEach(function (alias) {
    var node = C.literal(alias);
    node.executes(function (ctx) {
      return lhOpenGui(ctx.source.server, ctx.source.playerOrException, 'hub');
    });
    LH_GUI_TABS.forEach(function (t) {
      node.then(C.literal(t.id).executes(function (ctx) {
        return lhOpenGui(ctx.source.server, ctx.source.playerOrException, t.id);
      }));
    });
    root.then(node);
  });

  root.then(C.literal('tablet').executes(function (ctx) {
    var p = ctx.source.playerOrException;
    p.give('longhaul:control_tablet');
    lhMsg(p, 'Планшет диспетчера Long Haul выдан (ПКМ — открыть терминал, или /lh).');
    return 1;
  }));

  event.register(root);
});

ServerEvents.loaded(function () {
  console.info('[LH] Interactive Chest GUI (/lh, /lh gui, longhaul:control_tablet) loaded.');
});
