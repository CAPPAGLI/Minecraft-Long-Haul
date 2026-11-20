// Long Haul Legacy 2.0: portable storage lockdown (recipes, loot, block interaction) & starter book.
var LH_SHULKERS = [
  'minecraft:shulker_box', 'minecraft:white_shulker_box', 'minecraft:orange_shulker_box',
  'minecraft:magenta_shulker_box', 'minecraft:light_blue_shulker_box', 'minecraft:yellow_shulker_box',
  'minecraft:lime_shulker_box', 'minecraft:pink_shulker_box', 'minecraft:gray_shulker_box',
  'minecraft:light_gray_shulker_box', 'minecraft:cyan_shulker_box', 'minecraft:purple_shulker_box',
  'minecraft:blue_shulker_box', 'minecraft:brown_shulker_box', 'minecraft:green_shulker_box',
  'minecraft:red_shulker_box', 'minecraft:black_shulker_box'
];

ServerEvents.recipes(function (event) {
  LH_SHULKERS.forEach(function (id) { event.remove({ output: id }); });
  event.remove({ output: 'minecraft:ender_chest' });
  event.remove({ output: 'supplementaries:sack' });
  event.remove({ output: 'supplementaries:safe' });
  event.remove({ output: 'quark:backpack' });
  event.remove({ output: 'functionalstorage:ender_drawer' });
  event.remove({ output: /jetpack/ });
});

LootJS.modifiers(function (event) {
  event.addEntityLootModifier('minecraft:shulker').removeLoot('minecraft:shulker_shell');
  LH_SHULKERS.forEach(function (id) {
    event.addLootTableModifier(/.*/).removeLoot(id);
  });
  event.addLootTableModifier(/.*/).removeLoot('minecraft:ender_chest');
  event.addLootTableModifier(/.*/).removeLoot('supplementaries:sack');
  event.addLootTableModifier(/.*/).removeLoot('supplementaries:safe');
  event.addLootTableModifier(/.*/).removeLoot('quark:backpack');
  event.addLootTableModifier(/.*/).removeLoot('functionalstorage:ender_drawer');
  // Sapling & log scarcity: no local tree farms; explore forests & commission the Forestry Guild.
  event.addLootTableModifier(/.*/).removeLoot('#minecraft:saplings');
  event.addBlockLootModifier('#minecraft:leaves').removeLoot('minecraft:azalea');
  event.addBlockLootModifier('#minecraft:leaves').removeLoot('minecraft:flowering_azalea');
  event.addBlockLootModifier('#minecraft:logs').randomChance(0.4).removeLoot('#minecraft:logs');
});

BlockEvents.placed(function (event) {
  if (event.block && event.block.hasTag('minecraft:saplings')) {
    if (event.player) event.player.tell('[Long Haul] Посадка саженцев отключена: добывайте дерево в экспедициях по новым лесам или через Лесную Артель.');
    event.cancel();
  }
});

ItemEvents.rightClicked(function (event) {
  if (event.item && event.item.hasTag('minecraft:saplings')) {
    if (event.player) event.player.tell('[Long Haul] Посадка саженцев отключена: добывайте дерево в экспедициях по новым лесам.');
    event.cancel();
  }
});

BlockEvents.rightClicked('minecraft:ender_chest', function (event) {
  event.player.tell('[Long Haul] Эндер-сундуки отключены правилами логистики.');
  event.cancel();
});

BlockEvents.placed('minecraft:ender_chest', function (event) {
  event.player.tell('[Long Haul] Размещение эндер-сундуков отключено правилами логистики.');
  event.cancel();
});

BlockEvents.rightClicked('functionalstorage:ender_drawer', function (event) {
  event.player.tell('[Long Haul] Беспроводные эндер-ящики отключены правилами логистики.');
  event.cancel();
});

BlockEvents.placed('functionalstorage:ender_drawer', function (event) {
  event.player.tell('[Long Haul] Размещение беспроводных эндер-ящиков отключено правилами логистики.');
  event.cancel();
});

ItemEvents.rightClicked('functionalstorage:ender_drawer', function (event) {
  event.player.tell('[Long Haul] Беспроводные эндер-ящики отключены правилами логистики.');
  event.cancel();
});

LH_SHULKERS.forEach(function (id) {
  BlockEvents.rightClicked(id, function (event) {
    event.player.tell('[Long Haul] Шалкеровые ящики отключены; используйте транспорт и стационарные склады.');
    event.cancel();
  });
  BlockEvents.placed(id, function (event) {
    event.player.tell('[Long Haul] Размещение шалкеровых ящиков отключено правилами логистики.');
    event.cancel();
  });
});

['supplementaries:sack', 'supplementaries:safe'].forEach(function (id) {
  BlockEvents.rightClicked(id, function (event) {
    event.player.tell('[Long Haul] Переносные мешки и сейфы отключены правилами логистики.');
    event.cancel();
  });
  BlockEvents.placed(id, function (event) {
    event.player.tell('[Long Haul] Размещение ' + id + ' отключено правилами логистики.');
    event.cancel();
  });
});

['supplementaries:sack', 'quark:backpack'].forEach(function (id) {
  ItemEvents.rightClicked(id, function (event) {
    event.player.tell('[Long Haul] Переносные сумки/рюкзаки отключены правилами логистики.');
    event.cancel();
  });
});

PlayerEvents.loggedIn(function (event) {
  if (!event.player.persistentData.getBoolean('longhaul_alpha_book')) {
    event.player.give('heracles:quest_book');
    event.player.persistentData.putBoolean('longhaul_alpha_book', true);
    event.player.tell('Long Haul Legacy 2.0 Alpha: книга в инвентаре. /lh help — контракты, узлы, лагеря и маршруты.');
  }
});
