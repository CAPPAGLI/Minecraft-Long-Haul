// Long Haul Legacy 2.0: Extended runtime enforcement for complications #21..#100.
// Cross-system complications (snail_*, voidout_aftershock, gas_*, death_xp_wipe, logistics_toll, bot_cartel_surge)
// are wired directly into 24_immortal_snail.js, 25_voidout_and_toxic_gas.js, and 27_openttd_companies.js.
var LHEffBlockPos = Java.loadClass('net.minecraft.core.BlockPos');
var LHEffTick = 0;

function lhEffIsCreative(player) {
  return !player || (typeof player.isCreative === 'function' && player.isCreative()) ||
    (typeof player.isSpectator === 'function' && player.isSpectator());
}

function lhEffName(player) {
  return player.username || (typeof player.getName === 'function' ? player.getName().getString() : '');
}

function lhEffHasFullArmor(p) {
  return !!(p.headArmorItem && !p.headArmorItem.empty &&
    p.chestArmorItem && !p.chestArmorItem.empty &&
    p.legsArmorItem && !p.legsArmorItem.empty &&
    p.feetArmorItem && !p.feetArmorItem.empty);
}

function lhEffBiomeId(level, pos) {
  try {
    var b = level.getBiome(pos);
    if (b && typeof b.unwrapKey === 'function') {
      var opt = b.unwrapKey();
      if (opt && opt.isPresent()) return String(opt.get().location());
    }
  } catch (eBio) {}
  return '';
}

function lhEffEffect(server, uname, effectId, secs, amp) {
  if (!server || !uname) return;
  server.runCommandSilent('effect give ' + uname + ' ' + effectId + ' ' + Math.max(1, Math.floor(secs)) + ' ' + Math.max(0, Math.floor(amp || 0)) + ' true');
}

function lhEffDamageHand(player, chance) {
  try {
    var item = player.mainHandItem;
    if (item && !item.empty && item.damageable && Math.random() < chance) {
      item.hurtAndBreak(1, player, function () {});
    }
  } catch (eDmg) {}
}

// --- 1. Block Breaking Complications (#31-#42, #93, #97, #100) ---
BlockEvents.broken(function (event) {
  var server = event.server;
  var player = event.player;
  if (!server || !player || lhEffIsCreative(player)) return;
  var block = event.block;
  if (!block) return;

  var bid = String(block.id);
  var py = Math.floor(Number(block.y));
  var uname = lhEffName(player);
  var dim = String(player.level.dimension);

  // #31 brittle_stone: 25% of stone/deepslate crumbles without drop
  if ((bid === 'minecraft:stone' || bid === 'minecraft:deepslate' || bid === 'minecraft:cobbled_deepslate') &&
      lhHardIsActive(server, 'brittle_stone') && Math.random() < 0.25) {
    block.set('minecraft:air');
    event.cancel();
    return;
  }

  // #35 scarce_coal_seams: 35% of coal ore yields nothing without Silk Touch
  if ((bid === 'minecraft:coal_ore' || bid === 'minecraft:deepslate_coal_ore') &&
      lhHardIsActive(server, 'scarce_coal_seams')) {
    var held = player.mainHandItem;
    var hasSilk = held && !held.empty && held.nbt && String(held.nbt).indexOf('minecraft:silk_touch') !== -1;
    if (!hasSilk && Math.random() < 0.35) {
      block.set('minecraft:air');
      event.cancel();
      return;
    }
  }

  // #37 unrefined_gravel: 35% gravel/sand drops nothing + brief slowness
  if ((bid === 'minecraft:gravel' || bid === 'minecraft:sand' || bid === 'minecraft:red_sand') &&
      lhHardIsActive(server, 'unrefined_gravel') && Math.random() < 0.35) {
    lhEffEffect(server, uname, 'minecraft:slowness', 2, 0);
    block.set('minecraft:air');
    event.cancel();
    return;
  }

  // #42 blight_crops: 30% harvested crops rot on break
  if (block.hasTag('minecraft:crops') && lhHardIsActive(server, 'blight_crops') && Math.random() < 0.30) {
    block.set('minecraft:air');
    event.cancel();
    return;
  }

  // #32 dust_lung
  if (py < 50 && (bid.indexOf('stone') !== -1 || block.hasTag('forge:ores')) &&
      lhHardIsActive(server, 'dust_lung') && (!player.headArmorItem || player.headArmorItem.empty) && Math.random() < 0.08) {
    lhEffEffect(server, uname, 'minecraft:mining_fatigue', 3, 0);
  }

  // #33 pocket_cave_in
  if (py < 16 && lhHardIsActive(server, 'pocket_cave_in') && Math.random() < 0.015) {
    lhEffEffect(server, uname, 'minecraft:blindness', 2, 0);
    lhEffEffect(server, uname, 'minecraft:slowness', 3, 0);
    try { if (typeof player.attack === 'function') player.attack(1.0); } catch (eCi) {}
  }

  // #34 pickaxe_fatigue & #36 hardened_deepslate
  if (bid.indexOf('deepslate') !== -1) {
    if (lhHardIsActive(server, 'pickaxe_fatigue')) lhEffDamageHand(player, 0.30);
    if (lhHardIsActive(server, 'hardened_deepslate') && Math.random() < 0.35) {
      lhEffEffect(server, uname, 'minecraft:mining_fatigue', 2, 0);
    }
  }

  // #38 obsidian_strain
  if ((bid === 'minecraft:obsidian' || bid === 'minecraft:crying_obsidian' || bid === 'minecraft:blackstone') &&
      lhHardIsActive(server, 'obsidian_strain')) {
    lhEffEffect(server, uname, 'minecraft:weakness', 4, 0);
    lhEffEffect(server, uname, 'minecraft:hunger', 3, 1);
  }

  // #39 underground_gas_pocket
  if (py < 10 && (block.hasTag('forge:ores') || bid.indexOf('deepslate') !== -1) &&
      lhHardIsActive(server, 'underground_gas_pocket') && Math.random() < 0.03) {
    lhEffEffect(server, uname, 'minecraft:poison', 4, 0);
    try { player.setSecondsOnFire(2); } catch (eFire) {}
  }

  // #40 nether_quartz_shard
  if (dim === 'minecraft:the_nether' && block.hasTag('forge:ores') &&
      lhHardIsActive(server, 'nether_quartz_shard') && (!player.chestArmorItem || player.chestArmorItem.empty)) {
    try { if (typeof player.attack === 'function') player.attack(1.0); } catch (eNq) {}
  }

  // #41 axe_splintering
  if (block.hasTag('minecraft:logs') && lhHardIsActive(server, 'axe_splintering')) {
    lhEffDamageHand(player, 0.35);
  }

  // #43 dry_soil_penalty
  if ((bid === 'minecraft:farmland' || block.hasTag('minecraft:crops')) &&
      lhHardIsActive(server, 'dry_soil_penalty') && Math.random() < 0.30) {
    lhEffEffect(server, uname, 'minecraft:hunger', 3, 0);
  }

  // #93 voltage_shock
  if ((bid.indexOf('create:') === 0 || bid.indexOf('immersiveengineering:') === 0) &&
      lhHardIsActive(server, 'voltage_shock')) {
    try {
      if (player.level.isRaining() && Math.random() < 0.20 && typeof player.attack === 'function') {
        player.attack(1.0);
      }
    } catch (eVolt) {}
  }

  // #97 industrial_smog_zone
  if (py < 80 && (bid.indexOf('furnace') !== -1 || block.hasTag('forge:ores')) &&
      lhHardIsActive(server, 'industrial_smog_zone') && (!player.headArmorItem || player.headArmorItem.empty) && Math.random() < 0.25) {
    lhEffEffect(server, uname, 'minecraft:mining_fatigue', 3, 0);
  }

  // #100 doomed_final_protocol (mining slowdown far from origin)
  if (lhHardIsActive(server, 'doomed_final_protocol')) {
    var d0 = global.LHWorldPlanner ? global.LHWorldPlanner.dist2D(0, 0, Number(player.x), Number(player.z)) : 0;
    if (d0 >= 800 && Math.random() < 0.18) {
      lhEffEffect(server, uname, 'minecraft:mining_fatigue', 3, 0);
    }
  }
});

// --- 2. Mob Spawn Escalation (#51-#61, #100) ---
EntityEvents.spawned(function (event) {
  var ent = event.entity;
  var level = event.level;
  if (!ent || !level || !level.server) return;
  var server = level.server;
  if (typeof ent.isMonster !== 'function' || !ent.isMonster()) return;

  var etype = String(ent.type);
  var dim = String(level.dimension);
  var py = Number(ent.y);

  try {
    if ((etype === 'minecraft:zombie' || etype === 'minecraft:skeleton' || etype === 'minecraft:stray' || etype === 'minecraft:husk') &&
        lhHardIsActive(server, 'armored_undead') && Math.random() < 0.35) {
      ent.potionEffects.add('minecraft:resistance', 24000, 0, false, false);
    }
    if (etype === 'minecraft:creeper' && lhHardIsActive(server, 'swift_creepers')) {
      ent.potionEffects.add('minecraft:speed', 24000, 1, false, false);
    }
    if ((etype === 'minecraft:spider' || etype === 'minecraft:cave_spider') && lhHardIsActive(server, 'toxic_spiders')) {
      ent.potionEffects.add('minecraft:speed', 24000, 0, false, false);
      ent.potionEffects.add('minecraft:strength', 24000, 0, false, false);
    }
    if ((etype === 'minecraft:skeleton' || etype === 'minecraft:stray') && lhHardIsActive(server, 'skeleton_sharpshooters')) {
      ent.potionEffects.add('minecraft:strength', 24000, 0, false, false);
      ent.potionEffects.add('minecraft:speed', 24000, 0, false, false);
    }
    if (lhHardIsActive(server, 'regenerating_horrors') && Math.random() < 0.25) {
      ent.potionEffects.add('minecraft:regeneration', 24000, 0, false, false);
    }
    if (dim === 'minecraft:the_nether' && lhHardIsActive(server, 'nether_brutes')) {
      ent.potionEffects.add('minecraft:strength', 24000, 0, false, false);
      ent.potionEffects.add('minecraft:resistance', 24000, 0, false, false);
    }
    if (dim === 'minecraft:the_end' && lhHardIsActive(server, 'end_stalkers')) {
      ent.potionEffects.add('minecraft:speed', 24000, 1, false, false);
      ent.potionEffects.add('minecraft:strength', 24000, 0, false, false);
    }
    if (py < 20 && lhHardIsActive(server, 'cavern_predators')) {
      ent.potionEffects.add('minecraft:strength', 24000, 0, false, false);
      ent.potionEffects.add('minecraft:resistance', 24000, 0, false, false);
    }
    if ((etype === 'minecraft:pillager' || etype === 'minecraft:witch' || etype === 'minecraft:vindicator') &&
        lhHardIsActive(server, 'fireproof_raiders')) {
      ent.potionEffects.add('minecraft:fire_resistance', 24000, 0, false, false);
      ent.potionEffects.add('minecraft:speed', 24000, 0, false, false);
    }
    if (dim === 'minecraft:overworld') {
      var tod = Number(level.dayTime()) % 24000;
      if (tod >= 13000 && tod <= 23500) {
        if (lhHardIsActive(server, 'phantom_swarms') && Math.random() < 0.20) {
          ent.potionEffects.add('minecraft:jump_boost', 12000, 0, false, false);
          ent.potionEffects.add('minecraft:resistance', 12000, 0, false, false);
        }
        if (lhHardIsActive(server, 'doomed_final_protocol')) {
          ent.potionEffects.add('minecraft:regeneration', 12000, 0, false, false);
        }
      }
    }
  } catch (eSpawn) {}
});

// --- 3. Player Hurt & Combat Complications (#45, #56, #62-#64, #70-#72, #76, #78, #91, #95) ---
EntityEvents.hurt(function (event) {
  var ent = event.entity;
  if (!ent || typeof ent.isPlayer !== 'function' || !ent.isPlayer()) return;
  var server = ent.server;
  if (!server || lhEffIsCreative(ent)) return;

  var uname = lhEffName(ent);
  var amt = Number(event.amount || 0);
  var msgId = '';
  var attacker = null;
  try {
    if (event.source) {
      if (typeof event.source.getMsgId === 'function') msgId = String(event.source.getMsgId());
      if (event.source.actual) attacker = event.source.actual;
    }
  } catch (eSrc) {}

  // #45 rot_in_rain
  if (lhHardIsActive(server, 'rot_in_rain')) {
    try {
      if (ent.level.isRaining() && Math.random() < 0.25 && ent.inventory) {
        var rInv = ent.inventory;
        for (var rs = 0; rs < rInv.slots; rs++) {
          var rst = rInv.getStackInSlot(rs);
          if (!rst || rst.empty) continue;
          var rsid = String(rst.id);
          if (rsid === 'minecraft:bread' || rsid === 'minecraft:apple' || rsid === 'minecraft:carrot') {
            rInv.extractItem(rs, 1, false);
            ent.give('minecraft:rotten_flesh');
            break;
          }
        }
      }
    } catch (eRainRot) {}
  }

  // #56 bloodlust_aggression
  if (attacker && lhHardIsActive(server, 'bloodlust_aggression')) {
    try {
      if (attacker.potionEffects) attacker.potionEffects.add('minecraft:strength', 120, 0, false, false);
    } catch (eBl) {}
  }

  // #62 venomous_strikes
  if (attacker && lhHardIsActive(server, 'venomous_strikes') && Math.random() < 0.25) {
    lhEffEffect(server, uname, Math.random() < 0.5 ? 'minecraft:poison' : 'minecraft:hunger', 3, 0);
  }

  // #63 concussive_blows
  if (amt >= 4 && lhHardIsActive(server, 'concussive_blows') && Math.random() < 0.30) {
    lhEffEffect(server, uname, 'minecraft:nausea', 3, 0);
    lhEffEffect(server, uname, 'minecraft:slowness', 2, 0);
  }

  // #64 armor_piercing_foes
  if (attacker && lhHardIsActive(server, 'armor_piercing_foes') && Math.random() < 0.30) {
    var arm = [ent.headArmorItem, ent.chestArmorItem, ent.legsArmorItem, ent.feetArmorItem];
    var pick = arm[Math.floor(Math.random() * arm.length)];
    if (pick && !pick.empty && pick.damageable) {
      try { pick.hurtAndBreak(1, ent, function () {}); } catch (eAp) {}
    }
  }

  // #70 fragile_bones
  if (msgId === 'fall' && amt >= 3 && lhHardIsActive(server, 'fragile_bones')) {
    lhEffEffect(server, uname, 'minecraft:slowness', 5, 1);
  }

  // #71 bleeding_wounds
  if (amt >= 6 && lhHardIsActive(server, 'bleeding_wounds') && Math.random() < 0.35) {
    lhEffEffect(server, uname, 'minecraft:wither', 3, 0);
  }

  // #72 panic_adrenaline
  if (Number(ent.health || 20) - amt < 8 && lhHardIsActive(server, 'panic_adrenaline')) {
    lhEffEffect(server, uname, 'minecraft:darkness', 3, 0);
    lhEffEffect(server, uname, 'minecraft:weakness', 4, 0);
  }

  // #76 toxin_sensitivity
  if (msgId === 'magic' && lhHardIsActive(server, 'toxin_sensitivity')) {
    lhEffEffect(server, uname, 'minecraft:weakness', 5, 0);
  }

  // #78 combat_exhaustion
  if (attacker && lhHardIsActive(server, 'combat_exhaustion') && Math.random() < 0.30) {
    lhEffEffect(server, uname, 'minecraft:hunger', 4, 0);
  }

  // #91 arcane_backlash
  if (lhHardIsActive(server, 'arcane_backlash')) {
    var mh = ent.mainHandItem ? String(ent.mainHandItem.id) : '';
    var oh = ent.offHandItem ? String(ent.offHandItem.id) : '';
    if (mh.indexOf('primalmagick:') === 0 || mh.indexOf('hexcasting:') === 0 ||
        oh.indexOf('primalmagick:') === 0 || oh.indexOf('hexcasting:') === 0) {
      lhEffEffect(server, uname, 'minecraft:levitation', 1, 0);
      lhEffEffect(server, uname, 'minecraft:darkness', 3, 0);
    }
  }

  // #95 draconic_resonance
  if (lhHardIsActive(server, 'draconic_resonance') && ent.inventory) {
    for (var ds = 0; ds < ent.inventory.slots; ds++) {
      var dst = ent.inventory.getStackInSlot(ds);
      if (dst && !dst.empty && String(dst.id).indexOf('draconicevolution:') === 0) {
        lhEffEffect(server, uname, 'minecraft:blindness', 2, 0);
        break;
      }
    }
  }
});

// --- 4. Food & Respawn Complications (#67, #68, #80, #88) ---
if (typeof ItemEvents !== 'undefined' && ItemEvents.foodEaten) {
  ItemEvents.foodEaten(function (event) {
    var server = event.server;
    var player = event.player;
    var item = event.item;
    if (!server || !player || !item || lhEffIsCreative(player)) return;
    var iid = String(item.id);
    var uname = lhEffName(player);

    // #67 raw_food_aversion
    if ((iid === 'minecraft:beef' || iid === 'minecraft:porkchop' || iid === 'minecraft:chicken' ||
         iid === 'minecraft:mutton' || iid === 'minecraft:rabbit' || iid === 'minecraft:cod' ||
         iid === 'minecraft:salmon' || iid === 'minecraft:potato') &&
        lhHardIsActive(server, 'raw_food_aversion')) {
      lhEffEffect(server, uname, 'minecraft:nausea', 6, 0);
      lhEffEffect(server, uname, 'minecraft:hunger', 6, 0);
    }

    // #68 sugar_crash
    if ((iid === 'minecraft:cookie' || iid === 'minecraft:sweet_berries' || iid === 'minecraft:honey_bottle' ||
         iid === 'minecraft:pumpkin_pie' || iid === 'minecraft:apple') &&
        lhHardIsActive(server, 'sugar_crash')) {
      lhEffEffect(server, uname, 'minecraft:weakness', 5, 0);
    }
  });
}

if (typeof PlayerEvents !== 'undefined' && PlayerEvents.respawned) {
  PlayerEvents.respawned(function (event) {
    var server = event.server, player = event.player;
    if (!server || !player || lhEffIsCreative(player)) return;
    var uname = lhEffName(player);
    // #80 cursed_resurrection
    if (lhHardIsActive(server, 'cursed_resurrection')) {
      lhEffEffect(server, uname, 'minecraft:weakness', 20, 0);
      lhEffEffect(server, uname, 'minecraft:hunger', 20, 0);
    }
    // #88 respawn_disorientation
    if (lhHardIsActive(server, 'random_respawn') && lhHardIsActive(server, 'respawn_disorientation')) {
      lhEffEffect(server, uname, 'minecraft:nausea', 8, 0);
      lhEffEffect(server, uname, 'minecraft:darkness', 8, 0);
    }
  });
}

// --- 5. Throttled Periodic Environment & Inventory Complications (#21-#30, #44, #46, #48-#50, #65, #66, #69, #73-#75, #77, #79, #85, #89, #92, #94, #96, #98, #99) ---
ServerEvents.tick(function (event) {
  LHEffTick++;
  if (LHEffTick % 160 !== 0) return;
  var server = event.server;
  var plist = server.players;
  if (!plist || !plist.length) return;

  var ow = server.getLevel('minecraft:overworld');
  var borderHalf = (ow && ow.worldBorder && Number(ow.worldBorder.size) > 0) ? (Number(ow.worldBorder.size) / 2.0) : 362.0;

  for (var i = 0; i < plist.length; i++) {
    var p = plist[i];
    if (lhEffIsCreative(p)) continue;
    var uname = lhEffName(p);
    if (!uname) continue;

    var level = p.level;
    var dim = String(level.dimension);
    var px = Number(p.x), py = Number(p.y), pz = Number(p.z);
    var pPos = new LHEffBlockPos(Math.floor(px), Math.floor(py) + 1, Math.floor(pz));
    var fullArmor = lhEffHasFullArmor(p);
    var hasHelmet = !!(p.headArmorItem && !p.headArmorItem.empty);
    var hasLight = typeof lhHasLightSourceInHand === 'function' ? lhHasLightSourceInHand(p) : false;
    var seeSky = false;
    var isRaining = false;
    var isThundering = false;
    try { seeSky = level.canSeeSky(pPos); } catch (eS) {}
    try { isRaining = !!level.isRaining(); } catch (eR) {}
    try { isThundering = !!level.isThundering(); } catch (eT) {}
    var tod = Number(level.dayTime()) % 24000;
    var isDay = tod >= 0 && tod < 12500;
    var isNight = tod >= 13500 && tod <= 23000;
    var d0 = global.LHWorldPlanner ? global.LHWorldPlanner.dist2D(0, 0, px, pz) : 0;

    // Dimension hazards (#22, #23, #98, #99)
    if (dim === 'minecraft:the_nether') {
      if (lhHardIsActive(server, 'nether_heat_wave') && !fullArmor) {
        lhEffEffect(server, uname, 'minecraft:weakness', 5, 0);
      }
      if (lhHardIsActive(server, 'overheated_reactor_aura')) {
        lhEffEffect(server, uname, 'minecraft:hunger', 5, 0);
      }
    }
    if (dim === 'minecraft:the_end') {
      if (lhHardIsActive(server, 'end_void_chill') && !fullArmor && !hasLight) {
        lhEffEffect(server, uname, 'minecraft:darkness', 5, 0);
        lhEffEffect(server, uname, 'minecraft:slowness', 4, 0);
      }
      if (lhHardIsActive(server, 'void_echo_whispers')) {
        lhEffEffect(server, uname, 'minecraft:darkness', 4, 0);
      }
    }

    // Overworld altitude / sky / biome hazards (#21, #24-#30, #46, #49, #50, #65, #69, #79, #85, #96, #99)
    if (dim === 'minecraft:overworld') {
      if (isDay && seeSky && py >= 70 && !hasHelmet && lhHardIsActive(server, 'solar_heatstroke')) {
        lhEffEffect(server, uname, 'minecraft:hunger', 4, 0);
        lhEffEffect(server, uname, 'minecraft:slowness', 3, 0);
      }
      if (py >= 220 && !hasHelmet && lhHardIsActive(server, 'thin_air_hypoxia')) {
        lhEffEffect(server, uname, 'minecraft:mining_fatigue', 5, 0);
        lhEffEffect(server, uname, 'minecraft:slowness', 4, 0);
      }
      if (py < 40 && !hasLight && lhHardIsActive(server, 'cave_dampness')) {
        lhEffEffect(server, uname, 'minecraft:slowness', 4, 0);
      }
      if (py < -32 && lhHardIsActive(server, 'void_echo_whispers') && LHEffTick % 320 === 0) {
        lhEffEffect(server, uname, 'minecraft:darkness', 4, 0);
      }
      if (py < 0 && fullArmor && lhHardIsActive(server, 'magnetic_interference') && LHEffTick % 320 === 0) {
        lhEffEffect(server, uname, 'minecraft:darkness', 4, 0);
      }

      // Biome-specific checks throttled every 320 ticks
      if (LHEffTick % 320 === 0) {
        var biome = lhEffBiomeId(level, pPos);
        if (biome) {
          if ((biome.indexOf('desert') !== -1 || biome.indexOf('badlands') !== -1 || biome.indexOf('mesa') !== -1) &&
              isDay && seeSky && !hasHelmet && lhHardIsActive(server, 'desert_mirage')) {
            lhEffEffect(server, uname, 'minecraft:nausea', 4, 0);
          }
          if ((biome.indexOf('swamp') !== -1 || biome.indexOf('mangrove') !== -1) &&
              (!p.feetArmorItem || p.feetArmorItem.empty) && lhHardIsActive(server, 'swamp_miasma')) {
            lhEffEffect(server, uname, 'minecraft:poison', 3, 0);
          }
          if ((biome.indexOf('snow') !== -1 || biome.indexOf('frozen') !== -1 || biome.indexOf('ice') !== -1 || biome.indexOf('grove') !== -1) &&
              seeSky && !fullArmor && lhHardIsActive(server, 'glacial_wind')) {
            try { if (typeof p.setTicksFrozen === 'function') p.setTicksFrozen(120); } catch (eGw) {}
          }
        }
      }

      if (seeSky && (isRaining || isThundering) && lhHardIsActive(server, 'ash_fallout') && LHEffTick % 320 === 0) {
        lhEffEffect(server, uname, 'minecraft:hunger', 4, 0);
      }
      if ((isThundering || py < 0) && lhHardIsActive(server, 'magnetic_anomaly') && LHEffTick % 480 === 0) {
        lhEffEffect(server, uname, 'minecraft:nausea', 3, 0);
      }
      if (d0 >= 600 && isRaining && seeSky && lhHardIsActive(server, 'rusty_rails')) {
        lhEffDamageHand(p, 0.25);
      }
      if (d0 >= 1000 && lhHardIsActive(server, 'expedition_attrition')) {
        lhEffEffect(server, uname, 'minecraft:hunger', 4, 0);
      }
      if (isRaining && py >= 60 && py <= 85 && seeSky && lhHardIsActive(server, 'fog_disorientation') && LHEffTick % 320 === 0) {
        lhEffEffect(server, uname, 'minecraft:blindness', 2, 0);
      }
      if (isNight && seeSky && LHEffTick % 1440 === 0 && lhHardIsActive(server, 'cursed_ambush_moon') && Math.random() < 0.25) {
        try {
          var ang = Math.random() * 6.2831853;
          var amb = level.createEntity('minecraft:zombie');
          if (amb) {
            amb.setPos(px + Math.cos(ang) * 18.0, py + 1.0, pz + Math.sin(ang) * 18.0);
            amb.spawn();
          }
        } catch (eAmb) {}
      }
      if (isNight && d0 >= 300 && lhHardIsActive(server, 'sleep_deprivation')) {
        lhEffEffect(server, uname, 'minecraft:mining_fatigue', 4, 0);
      }
      if (isNight && !hasLight && lhHardIsActive(server, 'night_blindness') && LHEffTick % 320 === 0) {
        lhEffEffect(server, uname, 'minecraft:darkness', 4, 0);
      }
      if (lhHardIsActive(server, 'border_edge_static') &&
          (Math.abs(px) >= borderHalf - 64 || Math.abs(pz) >= borderHalf - 64)) {
        lhEffEffect(server, uname, 'minecraft:darkness', 4, 0);
        lhEffEffect(server, uname, 'minecraft:weakness', 4, 0);
      }
    }

    // Mobility / Equipment / Inventory checks (#44, #48, #66, #73-#75, #77, #89, #92, #94, #98)
    if (lhHardIsActive(server, 'metabolic_burn') && fullArmor && typeof p.isSprinting === 'function' && p.isSprinting()) {
      lhEffEffect(server, uname, 'minecraft:hunger', 3, 0);
    }
    if (lhHardIsActive(server, 'water_drag') && fullArmor && typeof p.isInWater === 'function' && p.isInWater()) {
      lhEffEffect(server, uname, 'minecraft:slowness', 3, 0);
    }
    if (lhHardIsActive(server, 'drowning_pressure') && py < 50 && !hasHelmet && typeof p.isInWater === 'function' && p.isInWater()) {
      lhEffEffect(server, uname, 'minecraft:mining_fatigue', 4, 0);
      lhEffEffect(server, uname, 'minecraft:darkness', 4, 0);
    }
    if (lhHardIsActive(server, 'fire_vulnerability') && typeof p.isOnFire === 'function' && p.isOnFire()) {
      lhEffEffect(server, uname, 'minecraft:hunger', 4, 0);
      if (p.chestArmorItem && !p.chestArmorItem.empty && p.chestArmorItem.damageable) {
        try { p.chestArmorItem.hurtAndBreak(1, p, function () {}); } catch (eFv) {}
      }
    }
    if (lhHardIsActive(server, 'heavy_shield_stance') && p.offHandItem && String(p.offHandItem.id) === 'minecraft:shield') {
      lhEffEffect(server, uname, 'minecraft:slowness', 3, 0);
    }

    // Single inventory scan for inventory-based complications (#44, #48, #89, #92, #94, #98)
    var needInv = lhHardIsActive(server, 'heavy_timber_drag') ||
      lhHardIsActive(server, 'freight_overweight') ||
      lhHardIsActive(server, 'cargo_piracy_risk') ||
      lhHardIsActive(server, 'kinetic_overload') ||
      lhHardIsActive(server, 'radiation_sickness_plus') ||
      lhHardIsActive(server, 'overheated_reactor_aura');

    if (needInv && p.inventory) {
      var inv = p.inventory;
      var logCount = 0, usedSlots = 0, machineCount = 0, hasManifest = false, hasNuclearFuel = false;
      for (var s = 0; s < inv.slots; s++) {
        var st = inv.getStackInSlot(s);
        if (!st || st.empty) continue;
        usedSlots++;
        var sid = String(st.id);
        var cnt = Number(st.count || 1);
        if (sid.indexOf('_log') !== -1 || sid.indexOf('_wood') !== -1) logCount += cnt;
        if (sid === 'longhaul:cargo_manifest') hasManifest = true;
        if (sid.indexOf('create:mechanical_') === 0 || sid.indexOf('create:crushing_wheel') === 0 ||
            sid.indexOf('immersiveengineering:') === 0) machineCount += cnt;
        if (sid.indexOf('uranium') !== -1 || sid.indexOf('plutonium') !== -1 ||
            sid.indexOf('thorium') !== -1 || sid.indexOf('yellorium') !== -1) hasNuclearFuel = true;
      }
      if (logCount > 192 && lhHardIsActive(server, 'heavy_timber_drag')) {
        lhEffEffect(server, uname, 'minecraft:slowness', 4, 0);
      }
      if (usedSlots >= 20 && lhHardIsActive(server, 'freight_overweight')) {
        lhEffEffect(server, uname, 'minecraft:slowness', 3, 0);
      }
      if (hasManifest && lhHardIsActive(server, 'cargo_piracy_risk')) {
        lhEffEffect(server, uname, 'minecraft:slowness', 3, 0);
      }
      if (machineCount > 4 && lhHardIsActive(server, 'kinetic_overload')) {
        lhEffEffect(server, uname, 'minecraft:weakness', 4, 0);
      }
      if (hasNuclearFuel && !fullArmor && lhHardIsActive(server, 'radiation_sickness_plus')) {
        lhEffEffect(server, uname, 'minecraft:wither', 3, 0);
      }
      if (hasNuclearFuel && lhHardIsActive(server, 'overheated_reactor_aura')) {
        lhEffEffect(server, uname, 'minecraft:hunger', 4, 0);
      }
    }
  }
});
