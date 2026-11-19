// ============================================================
// Long Haul Legacy — Усиленный лут редких структур (LootJS 3.x API)
// Структуры теперь в 3 раза реже (Structurify), но награда за них
// многократно выше: промышленные реликвии, рельсовые наборы,
// прецизионные механизмы и эндгейм-катализаторы.
//
// API LootJS 3.x: LootJS.lootTables(event => ...)
//   event.getLootTable("id").createPool(pool => pool.addEntry(...))
//   LootEntry.of("item").limitCount(min, max)
// Каждый пул гарантированно выпадает (rolls по умолчанию = 1),
// поэтому каждое улучшение — отдельный пул.
// ============================================================

LootJS.lootTables(event => {
  // --- Ванильные структуры ---
  // Пустынные пирамиды: золото, редстоун, промышленные реликвии
  event.getLootTable('minecraft:chests/desert_pyramid')
    .createPool(pool => pool.addEntry(LootEntry.of('minecraft:gold_ingot').limitCount(4, 4)))
    .createPool(pool => pool.addEntry(LootEntry.of('minecraft:redstone').limitCount(8, 8)))
    .createPool(pool => pool.addEntry(LootEntry.of('create:precision_mechanism')))
    .createPool(pool => pool.addEntry(LootEntry.of('create:track').limitCount(8, 8)));

  // Храмы в джунглях: изумруды, алмазы, прецизионные механизмы
  event.getLootTable('minecraft:chests/jungle_temple')
    .createPool(pool => pool.addEntry(LootEntry.of('minecraft:emerald').limitCount(3, 3)))
    .createPool(pool => pool.addEntry(LootEntry.of('minecraft:diamond').limitCount(2, 2)))
    .createPool(pool => pool.addEntry(LootEntry.of('create:precision_mechanism').limitCount(2, 2)))
    .createPool(pool => pool.addEntry(LootEntry.of('create:track').limitCount(12, 12)));

  // Иглу: редстоун, золото, рельсы
  event.getLootTable('minecraft:chests/igloo_chest')
    .createPool(pool => pool.addEntry(LootEntry.of('minecraft:redstone').limitCount(6, 6)))
    .createPool(pool => pool.addEntry(LootEntry.of('minecraft:gold_ingot').limitCount(3, 3)))
    .createPool(pool => pool.addEntry(LootEntry.of('create:track').limitCount(8, 8)))
    .createPool(pool => pool.addEntry(LootEntry.of('create:precision_mechanism')));

  // Заброшенные шахты: рельсы, железо, промышленные реликвии
  event.getLootTable('minecraft:chests/abandoned_mineshaft')
    .createPool(pool => pool.addEntry(LootEntry.of('create:track').limitCount(16, 16)))
    .createPool(pool => pool.addEntry(LootEntry.of('minecraft:iron_ingot').limitCount(6, 6)))
    .createPool(pool => pool.addEntry(LootEntry.of('create:precision_mechanism')))
    .createPool(pool => pool.addEntry(LootEntry.of('create:zinc_ingot').limitCount(4, 4)));

  // Затонувшие сокровища: золото, алмазы, прецизионные механизмы
  event.getLootTable('minecraft:chests/buried_treasure')
    .createPool(pool => pool.addEntry(LootEntry.of('minecraft:gold_ingot').limitCount(5, 5)))
    .createPool(pool => pool.addEntry(LootEntry.of('minecraft:diamond').limitCount(2, 2)))
    .createPool(pool => pool.addEntry(LootEntry.of('create:precision_mechanism').limitCount(2, 2)));

  // Бастионы: незерит, золото, промышленные реликвии
  event.getLootTable('minecraft:chests/bastion_treasure')
    .createPool(pool => pool.addEntry(LootEntry.of('minecraft:netherite_scrap')))
    .createPool(pool => pool.addEntry(LootEntry.of('minecraft:gold_ingot').limitCount(6, 6)))
    .createPool(pool => pool.addEntry(LootEntry.of('create:precision_mechanism').limitCount(3, 3)))
    .createPool(pool => pool.addEntry(LootEntry.of('create:track').limitCount(16, 16)));

  // Особняки: изумруды, алмазы, прецизионные механизмы
  event.getLootTable('minecraft:chests/woodland_mansion')
    .createPool(pool => pool.addEntry(LootEntry.of('minecraft:emerald').limitCount(4, 4)))
    .createPool(pool => pool.addEntry(LootEntry.of('minecraft:diamond').limitCount(2, 2)))
    .createPool(pool => pool.addEntry(LootEntry.of('create:precision_mechanism').limitCount(2, 2)))
    .createPool(pool => pool.addEntry(LootEntry.of('create:track').limitCount(8, 8)));

  // Кораблекрушения: железо, золото, рельсы
  event.getLootTable('minecraft:chests/shipwreck_treasure')
    .createPool(pool => pool.addEntry(LootEntry.of('minecraft:iron_ingot').limitCount(5, 5)))
    .createPool(pool => pool.addEntry(LootEntry.of('minecraft:gold_ingot').limitCount(3, 3)))
    .createPool(pool => pool.addEntry(LootEntry.of('create:track').limitCount(8, 8)));

  // Подземелья: алмазы, золото, прецизионные механизмы
  event.getLootTable('minecraft:chests/simple_dungeon')
    .createPool(pool => pool.addEntry(LootEntry.of('minecraft:diamond')))
    .createPool(pool => pool.addEntry(LootEntry.of('minecraft:gold_ingot').limitCount(4, 4)))
    .createPool(pool => pool.addEntry(LootEntry.of('create:precision_mechanism')));

  // Аванпосты разбойников: изумруды, железо, рельсы
  event.getLootTable('minecraft:chests/pillager_outpost')
    .createPool(pool => pool.addEntry(LootEntry.of('minecraft:emerald').limitCount(3, 3)))
    .createPool(pool => pool.addEntry(LootEntry.of('minecraft:iron_ingot').limitCount(5, 5)))
    .createPool(pool => pool.addEntry(LootEntry.of('create:track').limitCount(12, 12)));

  // --- Боссы L_Ender's Cataclysm: эндгейм-катализаторы ---
  // Древний остаток (Ancient Remnant)
  event.getLootTable('cataclysm:entities/ancient_remnant')
    .createPool(pool => pool.addEntry(LootEntry.of('cataclysm:burning_ashes').limitCount(2, 2)))
    .createPool(pool => pool.addEntry(LootEntry.of('megaproject:launch_catalyst')));

  // Незеритовый голем (Netherite Ministrosity — так называется в моде)
  event.getLootTable('cataclysm:entities/netherite_ministrosity')
    .createPool(pool => pool.addEntry(LootEntry.of('minecraft:netherite_scrap').limitCount(2, 2)))
    .createPool(pool => pool.addEntry(LootEntry.of('megaproject:launch_catalyst')));

  // --- Боссы Bosses of Mass Destruction ---
  // Древний лич (Ancient Lich)
  event.getLootTable('bosses_of_mass_destruction:entities/lich')
    .createPool(pool => pool.addEntry(LootEntry.of('minecraft:nether_star')))
    .createPool(pool => pool.addEntry(LootEntry.of('megaproject:launch_catalyst')));

  // --- Explorify структуры ---
  event.getLootTable('explorify:chest/supply_cache')
    .createPool(pool => pool.addEntry(LootEntry.of('create:precision_mechanism').limitCount(2, 2)))
    .createPool(pool => pool.addEntry(LootEntry.of('create:track').limitCount(16, 16)))
    .createPool(pool => pool.addEntry(LootEntry.of('minecraft:gold_ingot').limitCount(4, 4)));

  event.getLootTable('explorify:chest/dark_forest_settlement')
    .createPool(pool => pool.addEntry(LootEntry.of('minecraft:emerald').limitCount(3, 3)))
    .createPool(pool => pool.addEntry(LootEntry.of('create:precision_mechanism')))
    .createPool(pool => pool.addEntry(LootEntry.of('create:track').limitCount(8, 8)));
});
