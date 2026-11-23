// Long Haul Legacy 2.0: logistics-friendly recipes (bundle & bulk rail assembly) without bypassing site-bound goods.
ServerEvents.recipes(function (event) {
  // Small expedition bundle (max 64 items) for Stage I hauling before wagons/trains
  event.shaped('minecraft:bundle', [
    'SLS',
    'L L',
    'LLL'
  ], {
    S: 'minecraft:string',
    L: 'minecraft:leather'
  }).id('longhaul:expedition_bundle');

  // Industrial bulk rail forging using Create iron sheets for 175k-scale corridors
  event.shaped('24x minecraft:rail', [
    'P P',
    'PSP',
    'P P'
  ], {
    P: 'create:iron_sheet',
    S: 'minecraft:stick'
  }).id('longhaul:bulk_rail_from_sheets');

  // Bulk powered rail using Create brass/gold sheets + redstone
  event.shaped('8x minecraft:powered_rail', [
    'G G',
    'GSG',
    'GRG'
  ], {
    G: 'create:golden_sheet',
    S: 'minecraft:stick',
    R: 'minecraft:redstone'
  }).id('longhaul:bulk_powered_rail_from_sheets');

  // Anti-deadlock leather curing from rotten flesh for early bundles, carts, and Create belts
  event.smoking('minecraft:leather', 'minecraft:rotten_flesh').id('longhaul:cure_leather_smoking');
  event.campfireCooking('minecraft:leather', 'minecraft:rotten_flesh').id('longhaul:cure_leather_campfire');

  // Cheap dispatcher tablet for opening the /lh GUI anywhere
  event.shapeless('longhaul:control_tablet', [
    'minecraft:iron_ingot',
    'minecraft:redstone',
    'minecraft:paper'
  ]).id('longhaul:control_tablet_recipe');
});
