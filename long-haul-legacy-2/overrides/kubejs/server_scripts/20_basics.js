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
});

LootJS.modifiers(function (event) {
  event.addEntityLootModifier('minecraft:shulker').removeLoot('minecraft:shulker_shell');
  LH_SHULKERS.forEach(function (id) {
    event.addLootTableModifier(/.*/).removeLoot(id);
  });
  event.addLootTableModifier(/.*/).removeLoot('minecraft:ender_chest');
});

BlockEvents.rightClicked('minecraft:ender_chest', function (event) {
  event.player.tell('[Long Haul] Эндер-сундуки отключены правилами логистики.');
  event.cancel();
});

LH_SHULKERS.forEach(function (id) {
  BlockEvents.rightClicked(id, function (event) {
    event.player.tell('[Long Haul] Шалкеровые ящики отключены; используйте транспорт и стационарные склады.');
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
