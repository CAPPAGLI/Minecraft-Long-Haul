// Long Haul Legacy 2.0: Interactive Chest GUI Command Center (/lh, /lh gui, longhaul:control_tablet)
// Server-authoritative multi-tab UI covering every /lh subsystem without client-server desync.

var LHGuiStrArg = Java.loadClass('com.mojang.brigadier.arguments.StringArgumentType');

var LH_GUI_TABS = [
  { id: 'hub', label: 'Обзор' },
  { id: 'contracts', label: 'Контракты' },
  { id: 'sites', label: 'Узлы' },
  { id: 'logistics', label: 'Логистика' },
  { id: 'recovery', label: 'Восст. и Заказы' },
  { id: 'openttd', label: 'Компании' },
  { id: 'territory', label: 'Карта 5x5' },
  { id: 'market', label: 'Биржа' },
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

function lhGuiSlot(gui, x, y, iconId, title, loreLines, onLeft, onRight, count) {
  var slot = gui.getSlot(x, y);
  slot.setItem(lhGuiItem(iconId, title, loreLines, count));
  slot.setLeftClicked(function (click) {
    if (click && typeof click.setHandled === 'function') click.setHandled();
    var p = click && click.slot && click.slot.gui ? click.slot.gui.player : null;
    if (p && typeof onLeft === 'function') onLeft(p, click);
  });
  slot.setRightClicked(function (click) {
    if (click && typeof click.setHandled === 'function') click.setHandled();
    var p = click && click.slot && click.slot.gui ? click.slot.gui.player : null;
    if (p && typeof onRight === 'function') onRight(p, click);
    else if (p && typeof onLeft === 'function') onLeft(p, click);
  });
  slot.setShiftLeftClicked(function (click) {
    if (click && typeof click.setHandled === 'function') click.setHandled();
    var p = click && click.slot && click.slot.gui ? click.slot.gui.player : null;
    if (p && typeof onLeft === 'function') onLeft(p, click);
  });
}

function lhGuiFillBg(gui, rows) {
  for (var y = 0; y < rows; y++) {
    for (var x = 0; x < 9; x++) {
      var s = gui.getSlot(x, y);
      s.setItem(lhGuiItem('minecraft:gray_stained_glass_pane', ' ', [], 1));
      s.setLeftClicked(function (c) { if (c && c.setHandled) c.setHandled(); });
      s.setRightClicked(function (c) { if (c && c.setHandled) c.setHandled(); });
      s.setShiftLeftClicked(function (c) { if (c && c.setHandled) c.setHandled(); });
    }
  }
  gui.inventoryClicked = function (c) { if (c && c.setHandled) c.setHandled(); };
}

function lhGuiFooter(gui, server, tab, arg) {
  lhGuiSlot(gui, 0, 5, 'minecraft:arrow', '§e◀ Главное меню', ['§7Вернуться на обзорную панель Long Haul'], function (p) {
    lhOpenGui(server, p, 'hub');
  });
  lhGuiSlot(gui, 2, 5, 'minecraft:emerald', '§aКомпании', ['§7Открыть управление OpenTTD-компанией'], function (p) {
    lhOpenGui(server, p, 'openttd');
  });
  lhGuiSlot(gui, 3, 5, 'minecraft:filled_map', '§bКарта 5×5', ['§7Открыть интерактивную карту секторов'], function (p) {
    lhOpenGui(server, p, 'territory');
  });
  lhGuiSlot(gui, 4, 5, 'minecraft:sunflower', '§6🔄 Обновить', ['§7Перезагрузить актуальные данные экрана'], function (p) {
    lhOpenGui(server, p, tab, arg);
  });
  lhGuiSlot(gui, 5, 5, 'minecraft:gold_ingot', '§eБиржа', ['§7Открыть заказы скупки/продажи и P2P-сделки'], function (p) {
    lhOpenGui(server, p, 'market');
  });
  lhGuiSlot(gui, 6, 5, 'minecraft:writable_book', '§dЛог событий', ['§7Открыть ленту событий и фильтры чата'], function (p) {
    lhOpenGui(server, p, 'events', arg);
  });
  lhGuiSlot(gui, 8, 5, 'minecraft:barrier', '§c✖ Закрыть', ['§7Закрыть терминал Long Haul'], function (p) {
    if (typeof p.closeMenu === 'function') p.closeMenu();
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
  var border = typeof lhApplyTerritoryBorder === 'function' ? lhApplyTerritoryBorder(server, false) : { size: 724, unlocked: 0, total: 13 };
  var chap = typeof lhChapterProgressSummary === 'function' ? lhChapterProgressSummary(server) : { doneMain: 0, totalMain: 13, currentLabel: 'Старт' };
  var ottd = typeof lhOttdRead === 'function' ? lhOttdRead(server) : { companies: {}, marketOrders: [], tradeOffers: [] };
  var comp = typeof lhGetPlayerCompany === 'function' ? lhGetPlayerCompany(server, player) : null;
  var sc = global.LHOpenTTD ? global.LHOpenTTD.sectorCoords(player.x, player.z) : { sx: 0, sz: 0 };
  return {
    tab: String(tab || 'hub'),
    arg: arg || null,
    coeff: Math.round((diff.coeff || 1) * 100) / 100,
    borderSize: border.size || 724,
    unlocked: border.unlocked || 0,
    totalChapters: chap.totalMain || 13,
    doneChapters: chap.doneMain || 0,
    currentChapter: chap.currentLabel || 'Старт',
    hazardsCount: (progDb.featureOrder || []).length,
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
    '§fСложность: §ek=' + snap.coeff + ' §7| Угроз: §c' + snap.hazardsCount + '/20',
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

  lhGuiSlot(gui, 1, 3, 'minecraft:emerald', '§aOpenTTD: Компании и Пакты', [
    snap.company ? ('§fВаша компания: §a' + snap.company.name + ' (' + snap.company.cash + ' Cr)') : '§cВы не состоите в компании',
    '§7Основать или вступить, выбрать специализации,',
    '§7подписать торговый пакт, рейтинг ботов.',
    '§e▶ Нажмите, чтобы открыть'
  ], function (p) { lhOpenGui(server, p, 'openttd'); });

  lhGuiSlot(gui, 3, 3, 'minecraft:filled_map', '§bИнтерактивная карта секторов (5×5)', [
    '§fВы в секторе: §e(' + snap.sector.sx + ', ' + snap.sector.sz + ')',
    '§7Кликабельная карта 256×256 секторов прямо в окне!',
    '§7Покупка, выкуп, заселение грузом, укрепление, рейд.',
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

  lhGuiSlot(gui, 2, 4, 'minecraft:nether_star', '§cМир, угрозы и вехи', [
    '§7Рудоразведка, Улитка, Токсичный газ, Voidout,',
    '§7Сложность k, Колесо Угроз, Правила, Ядерка, DOOMED.',
    '§e▶ Нажмите, чтобы открыть'
  ], function (p) { lhOpenGui(server, p, 'world'); });

  lhGuiSlot(gui, 6, 4, 'minecraft:knowledge_book', '§eСправка и предметы', [
    '§7Шпаргалка по всем командам /lh,',
    '§7выдача Планшета или Квестбука.',
    '§e▶ Нажмите, чтобы открыть'
  ], function (p) { lhOpenGui(server, p, 'help'); });
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
        lhSiteArchive(server, pl);
      } else if (!entry.commissioned) {
        lhSiteCommission(server, pl, spec.id);
      } else if (spec.bootstrapInputs) {
        lhSiteProduce(server, pl, spec.id, 'bootstrap');
      } else {
        lhMsg(pl, spec.name + ' в (' + entry.x + ', ' + entry.y + ', ' + entry.z + '), дист. ' + dist);
      }
      lhOpenGui(server, pl, 'sites');
    }, function (pl) {
      if (spec.id === 'continental_archive') {
        lhSiteRepairArchive(server, pl);
      } else if (entry.commissioned && spec.industrialInputs) {
        lhSiteProduce(server, pl, spec.id, 'industrial');
      } else {
        lhMsg(pl, spec.name + ' в (' + entry.x + ', ' + entry.y + ', ' + entry.z + '), дист. ' + dist);
      }
      lhOpenGui(server, pl, 'sites');
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
    if (best && typeof lhPhotoReport === 'function') lhPhotoReport(server, pl, best);
    lhOpenGui(server, pl, 'sites');
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
    lhCargoDeliver(server, pl);
    lhOpenGui(server, pl, 'logistics');
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
  dests.slice(0, 8).forEach(function (dst, i) {
    if (!nearest || dst === nearest) return;
    lhGuiSlot(gui, i, 4, 'minecraft:chest_minecart', '§bНакладная: ' + nearest + ' → ' + dst, [
      '§7Оформить перевозку от ближайшего узла (' + nearest + ')',
      '§e▶ ЛКМ: выписать (/lh cargo issue ' + nearest + ' ' + dst + ')'
    ], function (pl) {
      lhCargoIssue(server, pl, nearest, dst);
      lhOpenGui(server, pl, 'logistics');
    });
  });
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
      lhRecRestore(server, pl, spec.id);
      lhOpenGui(server, pl, 'recovery');
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
    lhGuiSlot(gui, 1, 0, 'minecraft:emerald_block', myComp.colorCode + myComp.name + ' §7[' + myComp.id + ']', [
      '§fНаличные: §e' + myComp.cash + ' Cr',
      '§fОценка: §a' + global.LHOpenTTD.computeValuation(st, myComp.id) + ' Cr',
      '§fСекторов: §b' + global.LHOpenTTD.countClaims(st, myComp.id),
      '§fСпец.: §f' + (myComp.transportSpec || 'нет') + ' / ' + (myComp.resourceSpec || 'нет')
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

  for (var dz = -2; dz <= 2; dz++) {
    for (var dx = -2; dx <= 2; dx++) {
      (function (sx, sz, gx, gy) {
        var info = global.LHOpenTTD.resolveSectorOwner(st, sx, sz);
        var comp = info.owner ? st.companies[info.owner] : null;
        var isHere = (sx === sc.sx && sz === sc.sz);
        var isSanctuary = global.LHOpenTTD.isSpawnProtectedSector && global.LHOpenTTD.isSpawnProtectedSector(sx, sz);
        var icon = 'minecraft:light_gray_stained_glass_pane';
        if (isSanctuary) icon = 'minecraft:yellow_concrete';
        else if (info.isHq) icon = 'minecraft:gold_block';
        else if (myComp && info.owner === myComp.id && info.kind === 'claimed') icon = 'minecraft:lime_concrete';
        else if (comp) icon = LH_COMP_WOOL[lhCompanyMcColor(comp)] || 'minecraft:orange_wool';

        var lore = [
          (isHere ? '§e◆ ВЫ ЗДЕСЬ · ' : '') + '§fСектор (' + sx + ', ' + sz + ')',
          '§7Центр: ' + (sx * 256) + ', ' + (sz * 256),
          '§fВладелец: ' + (comp ? (comp.colorCode + comp.name) : '§7Свободен')
        ];
        if (isSanctuary) lore.push('§eСтартовый заповедник спауна (покупка запрещена)');
        else if (info.kind === 'claimed') lore.push('§7Статус: Захвачен (защита ' + info.strength + '/4)');
        else if (info.kind === 'voronoi') lore.push('§7Статус: Зона влияния');

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
      })(sc.sx + dx, sc.sz + dz, dx + 2, dz + 2);
    }
  }

  lhGuiSlot(gui, 6, 0, 'minecraft:lime_banner', '§aЗаявить текущий сектор', ['§7/lh territory claim'], function (pl) {
    lhCompanyClaimHere(server, pl, false);
    lhOpenGui(server, pl, 'territory');
  });
  lhGuiSlot(gui, 7, 0, 'minecraft:chest_minecart', '§eЗаселить грузом', ['§7Потребляет груз из бочки-терминала (/lh territory settle)'], function (pl) {
    lhCompanySettleCargo(server, pl, false);
    lhOpenGui(server, pl, 'territory');
  });
  lhGuiSlot(gui, 8, 0, 'minecraft:compass', '§bИнфо сектора', ['§7Выводит детали сектора в чат (/lh territory info)'], function (pl) {
    lhCompanySectorInfo(server, pl);
  });

  lhGuiSlot(gui, 6, 1, 'minecraft:gold_ingot', '§6Перебить цену (Outbid)', ['§7Мирный выкуп соседнего сектора (/lh territory outbid)'], function (pl) {
    lhCompanyOutbidHere(server, pl, false);
    lhOpenGui(server, pl, 'territory');
  });
  lhGuiSlot(gui, 7, 1, 'minecraft:shield', '§9Укрепить сектор', ['§7Повышает уровень защиты вашего сектора (/lh territory fortify)'], function (pl) {
    lhCompanyFortifyHere(server, pl);
    lhOpenGui(server, pl, 'territory');
  });
  lhGuiSlot(gui, 8, 1, 'minecraft:iron_sword', '§cНачать рейд', ['§7Штурм вражеского сектора (/lh territory raid)'], function (pl) {
    lhCompanyStartRaid(server, pl);
    lhOpenGui(server, pl, 'territory');
  });

  lhGuiSlot(gui, 6, 2, 'minecraft:iron_bars', '§dАнтимонопольный отбор', ['§7У лидера с 12+ секторами (/lh territory seize)'], function (pl) {
    lhCompanyAntitrustSeize(server, pl, false);
    lhOpenGui(server, pl, 'territory');
  });
  lhGuiSlot(gui, 7, 2, 'minecraft:map', '§fКарта в чат (5×5)', ['§7Интерактивная текстовая карта (/lh map 5)'], function (pl) {
    lhCompanyTerritoryMap(server, pl, 5);
  });
  lhGuiSlot(gui, 8, 2, 'minecraft:filled_map', '§6Выдать карту-предмет', ['§7Физическая карта территорий в руку (/lh map item)'], function (pl) {
    lhGiveTerritoryMapItem(server, pl, false);
  });

  var border = typeof lhApplyTerritoryBorder === 'function' ? lhApplyTerritoryBorder(server, false) : { size: 724, unlocked: 0, total: 6, areaShare: 0 };
  lhGuiSlot(gui, 7, 4, 'minecraft:bedrock', '§bГраница мира: ' + border.size + '×' + border.size, [
    '§fЭтапов расширения: §a' + border.unlocked + '/' + border.total + ' §7(§e' + Math.round((border.areaShare || 0) * 100) + '% §7площади)',
    '§7Светло-зелёный = ваш, Золотой = штаб, Жёлтый = заповедник.'
  ]);
}

function lhGuiRenderMarket(gui, server, player) {
  var st = lhOttdRead(server);
  var orders = (st.marketOrders || []).filter(function (o) { return o.remainingBatches > 0; });
  orders.slice(0, 18).forEach(function (o, idx) {
    var x = idx % 9;
    var y = 1 + Math.floor(idx / 9);
    var c = st.companies[o.companyId];
    var sub = st.subsidy && st.subsidy.orderId === o.id;
    var lore = [
      (o.side === 'buy' ? '§aСКУПКА (вы продаёте)' : '§bПРОДАЖА (вы покупаете)'),
      '§fПартия: §e' + o.qty + '× ' + o.item,
      '§fЦена: §6' + o.price + ' Cr §7(осталось лотов: ' + o.remainingBatches + ')',
      '§7Контрагент: ' + (c ? c.name : o.companyId)
    ];
    if (sub) lore.push('§e★ ГОССУБСИДИЯ ×1.75!');
    lore.push(o.side === 'buy' ? '§e▶ ЛКМ: продать партию из инвентаря' : '§e▶ ЛКМ: купить партию за Cr');
    lhGuiSlot(gui, x, y, o.item, (o.side === 'buy' ? '§a[СКУПКА] ' : '§b[ПРОДАЖА] ') + o.id, lore, function (pl) {
      if (o.side === 'buy') lhMarketSell(server, pl, o.id, false);
      else lhMarketBuy(server, pl, o.id, false);
      lhOpenGui(server, pl, 'market');
    }, null, Math.min(64, o.qty));
  });

  var openTrades = (st.tradeOffers || []).filter(function (t) { return t.status === 'open'; });
  openTrades.slice(0, 9).forEach(function (tr, idx) {
    lhGuiSlot(gui, idx, 4, tr.item || 'minecraft:emerald', '§dСделка: ' + tr.id, [
      '§f' + tr.sellerCompany + ' → ' + tr.targetCompany,
      '§fЛот: §e' + tr.qty + '× ' + tr.item + ' за §6' + tr.price + ' Cr',
      '§e▶ ЛКМ: принять сделку (/lh trade accept ' + tr.id + ')'
    ], function (pl) {
      lhAcceptTradeOffer(server, pl, tr.id, false);
      lhOpenGui(server, pl, 'market');
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

  lhGuiSlot(gui, 2, 3, 'minecraft:emerald', '§cКолесо Угроз (/lh casino status)', [
    '§fАктивно угроз: §c' + (progDb.featureOrder || []).length + '/20',
    '§7Показывает активные и закрытые усложнения.'
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

  lhGuiSlot(gui, 8, 3, 'minecraft:iron_sword', progDb.doomedVerified ? '§a✔ DOOMED отмечен' : '§7Проверить DOOMED (/lh doomed verify)', [
    '§7Отмечает опциональную главу 13.'
  ], function (pl) {
    if (server && server.commands && typeof pl.createCommandSourceStack === 'function') {
      server.commands.performPrefixedCommand(pl.createCommandSourceStack(), 'lh doomed verify');
    }
    lhOpenGui(server, pl, 'world');
  });
}

function lhGuiRenderHelp(gui, server, player) {
  lhGuiSlot(gui, 2, 1, 'minecraft:knowledge_book', '§6Вывести полную справку в чат', [
    '§7Отправит все основные команды /lh в ваш чат.'
  ], function (pl) {
    if (server && server.commands && typeof pl.createCommandSourceStack === 'function') {
      server.commands.performPrefixedCommand(pl.createCommandSourceStack(), 'lh help');
    }
  });

  lhGuiSlot(gui, 4, 1, 'longhaul:control_tablet', '§eВыдать Планшет диспетчера', [
    '§7Открывает этот GUI по ПКМ в любое время.',
    '§7Команда: /lh или /lh gui'
  ], function (pl) {
    pl.give('longhaul:control_tablet');
    lhMsg(pl, 'Планшет диспетчера выдан в инвентарь.');
  });

  lhGuiSlot(gui, 6, 1, 'heracles:quest_book', '§aВыдать Квестбук Heracles', [
    '§7Основные главы, заказы каталога и туториалы.'
  ], function (pl) {
    pl.give('heracles:quest_book');
    lhMsg(pl, 'Квестбук Heracles выдан в инвентарь.');
  });

  lhGuiSlot(gui, 4, 3, 'minecraft:paper', '§fБыстрые псевдонимы команд', [
    '§e/lh §7или §e/lh gui §7— главное меню',
    '§e/lh gui territory §7— сразу карта секторов 5×5',
    '§e/lh gui market §7— сразу биржа консорциума',
    '§e/lh gui events §7— сразу журнал событий'
  ]);
}

function lhRenderGuiTab(gui, server, player, tab, arg) {
  var activeTab = String(tab || 'hub').toLowerCase();
  lhGuiFillBg(gui, 6);
  if (activeTab === 'contracts') lhGuiRenderContracts(gui, server, player);
  else if (activeTab === 'sites') lhGuiRenderSites(gui, server, player);
  else if (activeTab === 'logistics') lhGuiRenderLogistics(gui, server, player);
  else if (activeTab === 'recovery') lhGuiRenderRecovery(gui, server, player);
  else if (activeTab === 'openttd') lhGuiRenderOpenTTD(gui, server, player);
  else if (activeTab === 'territory') lhGuiRenderTerritory(gui, server, player);
  else if (activeTab === 'market') lhGuiRenderMarket(gui, server, player);
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
    contracts: '§6Long Haul — Контракты и терминал',
    sites: '§bLong Haul — Узлы и производство',
    logistics: '§aLong Haul — Лагеря, маршруты и грузы',
    recovery: '§fLong Haul — Восстановление и заказы',
    openttd: '§aLong Haul — Компании OpenTTD',
    territory: '§bLong Haul — Карта секторов 5×5',
    market: '§6Long Haul — Биржа и P2P-сделки',
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
  if (event.player) {
    lhOpenGui(event.server, event.player, 'hub');
  }
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
