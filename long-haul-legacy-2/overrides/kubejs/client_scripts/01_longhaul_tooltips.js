// Long Haul Legacy 2.0: client-side tooltips for site-bound goods and logistics rules.
ItemEvents.tooltip(function (event) {
  var siteNotes = {
    'longhaul:treated_timber': 'Узел: Лесная артель (/lh site info forest)',
    'longhaul:field_rations': 'Узел: Речной агрогород (/lh site info farm)',
    'longhaul:ore_concentrate': 'Узел: Горный рудник (/lh site info mine)',
    'longhaul:marine_reagent': 'Узел: Морской порт (/lh site info port)',
    'longhaul:refractory_mix': 'Узел: Карьер пустошей (/lh site info badlands)',
    'longhaul:technical_glass': 'Узел: Стекольная долина (/lh site info smelter)',
    'longhaul:technical_oil': 'Узел: Заболоченный посёлок (/lh site info wetland)',
    'longhaul:machine_parts': 'Узел: Машиностроительный центр (/lh site info machine)',
    'longhaul:continental_module': 'Финальный модуль: Континентальный узел (/lh site info continental_hub)'
  };
  Object.keys(siteNotes).forEach(function (id) {
    event.add(id, [
      Text.gold(siteNotes[id]),
      Text.gray('Производится только на территории узла (/lh site produce).')
    ]);
  });

  event.add('longhaul:cargo_manifest', [
    Text.aqua('Серверная грузовая накладная (/lh cargo issue|deliver).'),
    Text.gray('Требует физической доставки до узла назначения.')
  ]);
  event.add('longhaul:control_tablet', [
    Text.gold('ПКМ: открыть графический терминал Long Haul (/lh gui).'),
    Text.gray('Контракты, узлы, маршруты, OpenTTD-карта, биржа и лог событий.')
  ]);

  event.add('minecraft:bundle', Text.green('Этап I: походный узелок (до телег и грузовых поездов).'));
  event.add('functionalstorage:ender_drawer', Text.red('Отключено правилами Long Haul: портальные сети запрещены.'));
  event.add('minecraft:ender_chest', Text.red('Отключено правилами Long Haul: эндер-сундуки запрещены.'));
  event.add('supplementaries:sack', Text.red('Отключено правилами Long Haul: переносные мешки запрещены.'));
  event.add('supplementaries:safe', Text.red('Отключено правилами Long Haul: переносные сейфы запрещены.'));
  event.add('quark:backpack', Text.red('Отключено правилами Long Haul: рюкзаки запрещены.'));
  event.add('#minecraft:shulker_boxes', Text.red('Отключено правилами Long Haul: шалкеровые ящики запрещены.'));
  event.add('draconicevolution:dislocator', Text.red('Отключено правилами Long Haul: телепортация запрещена.'));
  event.add('draconicevolution:advanced_dislocator', Text.red('Отключено правилами Long Haul: телепортация запрещена.'));
  event.add('draconicevolution:dislocator_receptacle', Text.red('Отключено правилами Long Haul: телепортация запрещена.'));
  event.add('#minecraft:saplings', Text.red('При активной угрозе «Дефицит леса» посадка саженцев отключается.'));
});
