// Register Long Haul Legacy 2.0 regional economic items and logistics manifests.
StartupEvents.registry('item', function (event) {
  var items = [
    ['ore_concentrate', 'Рудный концентрат'],
    ['treated_timber', 'Пропитанная древесина'],
    ['field_rations', 'Экспедиционные рационы'],
    ['marine_reagent', 'Морской реагент'],
    ['refractory_mix', 'Огнеупорная смесь'],
    ['technical_oil', 'Техническое масло'],
    ['technical_glass', 'Техническое стекло'],
    ['machine_parts', 'Прецизионные узлы'],
    ['continental_module', 'Континентальный модуль'],
    ['cargo_manifest', 'Грузовая накладная'],
    ['control_tablet', 'Планшет диспетчера Long Haul']
  ];
  items.forEach(function (entry) {
    var id = entry[0];
    var title = entry[1];
    var builder = event.create('longhaul:' + id).displayName(title).texture('longhaul:item/' + id);
    if (id === 'control_tablet') {
      builder.maxStackSize(1);
    } else if (id === 'cargo_manifest' || id === 'continental_module') {
      builder.maxStackSize(4); // ceil(16 / 5)
    } else {
      builder.maxStackSize(13); // ceil(64 / 5)
    }
  });
});
