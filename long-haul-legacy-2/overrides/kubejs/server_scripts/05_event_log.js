// Long Haul Legacy 2.0: Dedicated persistent Event Log (/lh events, /lh log)
// Separates background world/bot/hazard/market events from main chat and lets players filter or mute chat echoes.
var LHEventStrArg = Java.loadClass('com.mojang.brigadier.arguments.StringArgumentType');
var LHEventState = null;

var LH_EVENT_CATS = {
  bot: { icon: '🤖', color: '§7', label: 'Боты' },
  market: { icon: '💰', color: '§e', label: 'Биржа' },
  territory: { icon: '🏴', color: '§b', label: 'Территории' },
  raid: { icon: '⚔', color: '§c', label: 'Рейды' },
  hazard: { icon: '☣', color: '§2', label: 'Угрозы' },
  chapter: { icon: '📜', color: '§a', label: 'Главы' },
  voidout: { icon: '💥', color: '§4', label: 'Voidout' }
};

function lhEventsRead(server) {
  if (LHEventState !== null) return LHEventState;
  var raw = server ? server.persistentData.getString('longhaul_events_v1') : '';
  LHEventState = raw ? JSON.parse(String(raw)) : { seq: 1, events: [], playerPrefs: {} };
  if (!LHEventState.events) LHEventState.events = [];
  if (!LHEventState.playerPrefs) LHEventState.playerPrefs = {};
  if (!(LHEventState.seq > 0)) LHEventState.seq = LHEventState.events.length + 1;
  return LHEventState;
}

function lhEventsSave(server) {
  if (server && LHEventState !== null) {
    server.persistentData.putString('longhaul_events_v1', JSON.stringify(LHEventState));
  }
}

function lhEventClock(server) {
  try {
    var ow = server ? server.getLevel('minecraft:overworld') : null;
    var dt = ow && typeof ow.dayTime === 'function' ? Number(ow.dayTime()) : 0;
    if (!(dt >= 0)) dt = 0;
    var day = Math.floor(dt / 24000) + 1;
    var ticksInDay = dt % 24000;
    var totalMinutes = Math.floor(((ticksInDay + 6000) % 24000) * 1440 / 24000);
    var hh = Math.floor(totalMinutes / 60);
    var mm = totalMinutes % 60;
    return 'Д' + day + ' ' + (hh < 10 ? '0' + hh : '' + hh) + ':' + (mm < 10 ? '0' + mm : '' + mm);
  } catch (e) {
    return 'Д1 06:00';
  }
}

function lhLogEvent(server, category, message, opts) {
  if (!server) return null;
  var st = lhEventsRead(server);
  var meta = LH_EVENT_CATS[category] || { icon: '•', color: '§f', label: String(category || 'info') };
  var entry = {
    seq: st.seq++,
    clock: lhEventClock(server),
    cat: String(category || 'info'),
    label: meta.label,
    text: String(message || '')
  };
  st.events.push(entry);
  if (st.events.length > 150) {
    st.events = st.events.slice(st.events.length - 150);
  }
  lhEventsSave(server);
  console.info('[LH-EVENT][' + entry.cat + '] ' + entry.text);

  var chatMode = (opts && opts.chatMode) ? opts.chatMode : 'never';
  var plist = (opts && opts.targetPlayer) ? [opts.targetPlayer] : (server.players || []);
  for (var i = 0; i < plist.length; i++) {
    var p = plist[i];
    if (!p || typeof p.tell !== 'function') continue;
    var pid = typeof lhId === 'function' ? lhId(p) : String(p.uuid);
    var pref = st.playerPrefs[pid] || 'brief';
    if (pref === 'off') continue;
    if (chatMode === 'never' && pref !== 'all') continue;
    p.tell(meta.color + meta.icon + ' [' + meta.label + '] §f' + entry.text);
  }
  return entry;
}

function lhPrintEventLog(server, player, filterCat) {
  var st = lhEventsRead(server);
  var pid = typeof lhId === 'function' ? lhId(player) : String(player.uuid);
  var pref = st.playerPrefs[pid] || 'brief';
  var cat = (!filterCat || filterCat === 'all') ? null : String(filterCat).toLowerCase();
  var list = st.events.filter(function (ev) { return !cat || ev.cat === cat; });
  var shown = list.slice(Math.max(0, list.length - 12));

  player.tell('§6=== Лог событий Long Haul (' + (cat ? cat : 'все') + ': ' + list.length + ', чат=' + pref + ') ===');
  if (!shown.length) {
    player.tell('§7Событий в этой категории пока нет.');
  } else {
    for (var i = 0; i < shown.length; i++) {
      var ev = shown[i];
      var meta = LH_EVENT_CATS[ev.cat] || { icon: '•', color: '§f', label: ev.cat };
      player.tell('§8[' + ev.clock + '] ' + meta.color + meta.icon + ' [' + meta.label + '] §f' + ev.text);
    }
  }
  try {
    var uname = player.username || (typeof player.getName === 'function' ? player.getName().getString() : '');
    if (uname && server) {
      var nav = [
        { text: 'Фильтры: ', color: 'gray' },
        { text: '[Все] ', color: 'white', clickEvent: { action: 'run_command', value: '/lh events all' } },
        { text: '[Боты] ', color: 'gray', clickEvent: { action: 'run_command', value: '/lh events bot' } },
        { text: '[Биржа] ', color: 'yellow', clickEvent: { action: 'run_command', value: '/lh events market' } },
        { text: '[Территории] ', color: 'aqua', clickEvent: { action: 'run_command', value: '/lh events territory' } },
        { text: '[Рейды] ', color: 'red', clickEvent: { action: 'run_command', value: '/lh events raid' } },
        { text: '[Угрозы] ', color: 'green', clickEvent: { action: 'run_command', value: '/lh events hazard' } },
        { text: ' | Чат: ', color: 'gray' },
        { text: '[Только важные] ', color: 'gold', clickEvent: { action: 'run_command', value: '/lh events chat brief' } },
        { text: '[Тихо] ', color: 'dark_gray', clickEvent: { action: 'run_command', value: '/lh events chat off' } },
        { text: '[Всё]', color: 'green', clickEvent: { action: 'run_command', value: '/lh events chat all' } }
      ];
      server.runCommandSilent('tellraw ' + uname + ' ' + JSON.stringify(nav));
    }
  } catch (eTell) {}
  return 1;
}

ServerEvents.commandRegistry(function (event) {
  var C = event.commands, root = C.literal('lh');

  function registerLogCmd(cmdName) {
    var node = C.literal(cmdName);
    node.executes(function (ctx) {
      return lhPrintEventLog(ctx.source.server, ctx.source.playerOrException, 'all');
    });
    ['all', 'bot', 'market', 'territory', 'raid', 'hazard', 'chapter', 'voidout'].forEach(function (cat) {
      node.then(C.literal(cat).executes(function (ctx) {
        return lhPrintEventLog(ctx.source.server, ctx.source.playerOrException, cat);
      }));
    });
    var chatNode = C.literal('chat');
    ['off', 'brief', 'all'].forEach(function (mode) {
      chatNode.then(C.literal(mode).executes(function (ctx) {
        var server = ctx.source.server, p = ctx.source.playerOrException;
        var st = lhEventsRead(server);
        st.playerPrefs[typeof lhId === 'function' ? lhId(p) : String(p.uuid)] = mode;
        lhEventsSave(server);
        p.tell('§a[Long Haul] Режим дублирования событий в чат: §f' + mode + ' §7(полный архив всегда в /lh events).');
        return 1;
      }));
    });
    node.then(chatNode);
    node.then(C.literal('clear').requires(function (s) { return s.hasPermission(2); }).executes(function (ctx) {
      var st = lhEventsRead(ctx.source.server);
      st.events = [];
      lhEventsSave(ctx.source.server);
      ctx.source.playerOrException.tell('§eЛог событий очищен.');
      return 1;
    }));
    root.then(node);
  }

  registerLogCmd('events');
  registerLogCmd('log');
  event.register(root);
});

ServerEvents.loaded(function (event) {
  lhEventsRead(event.server);
});
