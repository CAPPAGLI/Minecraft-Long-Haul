// Fresh alpha worlds only. Recipe removal is not a universal inventory blacklist.
ServerEvents.recipes(function(event){
  ['','white_','orange_','magenta_','light_blue_','yellow_','lime_','pink_','gray_','light_gray_','cyan_','purple_','blue_','brown_','green_','red_','black_'].forEach(function(color){event.remove({output:'minecraft:'+color+'shulker_box'});});
  event.remove({output:'minecraft:ender_chest'});
});
PlayerEvents.loggedIn(function(event){
  if(!event.player.persistentData.getBoolean('longhaul_alpha_book')){
    event.player.give('heracles:quest_book');
    event.player.persistentData.putBoolean('longhaul_alpha_book',true);
    event.player.tell('Long Haul Legacy 2.0 ALPHA: книга в инвентаре. /lh help — контрольные поставки. Это тестовое ядро, не завершённая сборка.');
  }
});
