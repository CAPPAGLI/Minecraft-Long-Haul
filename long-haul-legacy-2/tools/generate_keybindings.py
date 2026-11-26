#!/usr/bin/env python3
"""Generate and validate conflict-free 65%-keyboard DefaultOptions keybindings.txt.

Target file: overrides/config/defaultoptions/keybindings.txt
Format (DefaultOptions 18.0.5 / Forge 1.20.1):
    key_<keyMappingName>:<InputConstantsKey>:<NONE|SHIFT|CONTROL|ALT>

Design rules:
- 0 Numpad keys (no key.keyboard.keypad.*)
- 65% keyboard safe (no grave.accent/~, caps.lock, insert, print.screen,
  scroll.lock, pause, home, end, menu)
- No hazardous combos (never SHIFT/CONTROL + W/A/S/D/Space/Q/E/1..9;
  never ALT + Tab/F4/Enter/Escape)
- Every registered KeyMapping in the pack (456 total) is explicitly configured
  so no mod's noisy default binding can cause Controlling red conflicts.
"""
import pathlib
import re

R = pathlib.Path(__file__).resolve().parents[1]
OUT_PATH = R / 'overrides/config/defaultoptions/keybindings.txt'

NONE = 'NONE'
SHIFT = 'SHIFT'
CTRL = 'CONTROL'
ALT = 'ALT'

# Complete authoritative list of all 456 KeyMappings registered by the 485-mod pack
ALL_KEYS = [
    'key.attack', 'key.use', 'key.forward', 'key.left', 'key.back', 'key.right',
    'key.jump', 'key.sneak', 'key.sprint', 'key.drop', 'key.inventory', 'key.chat',
    'key.playerlist', 'key.pickItem', 'key.command', 'key.socialInteractions',
    'key.screenshot', 'key.togglePerspective', 'key.smoothCamera', 'key.fullscreen',
    'key.spectatorOutlines', 'key.swapOffhand', 'key.saveToolbarActivator',
    'key.loadToolbarActivator', 'key.advancements',
    'key.hotbar.1', 'key.hotbar.2', 'key.hotbar.3', 'key.hotbar.4', 'key.hotbar.5',
    'key.hotbar.6', 'key.hotbar.7', 'key.hotbar.8', 'key.hotbar.9',
    'key.dungeonconfig.open', 'key.entityculling.toggle',
    'key.mimi.midi.gui.filecaster', 'key.mimi.midi.gui.transmitter',
    'key.mimi.midi.gui.settings', 'key.mimi.midi.alloff', 'key.mimi.midi.gui.main',
    'key.mimi.midi.gui.off', 'key.mimi.midi.gui.seat', 'key.modernfix.config',
    'key.exposure.camera_controls',
    'info.structure_gel.building_tool.undo', 'info.structure_gel.building_tool.redo',
    'key.structure_gel.open_building_tool_gui', 'key.corpse.death_history',
    'key.astikorcartsredux.action', 'key.astikorcartsredux.slow',
    'key.additionalplacements.placement_toggle',
    'iris.keybind.reload', 'iris.keybind.toggleShaders', 'iris.keybind.shaderPackSelection',
    'key.dynamic_fps.toggle_forced', 'key.dynamic_fps.toggle_disabled',
    'key.sfm.more_info', 'key.sfm.container_inspector.activation_key',
    'key.sfm.item_inspector.activation_key', 'key.sfm.toggle_label_view_key',
    'key.sfm.label_gun.open_gui', 'key.sfm.label_gun.pick_block_modifier',
    'key.sfm.label_gun.contiguous_modifier', 'key.sfm.label_gun.clear_modifier',
    'key.sfm.label_gun.scroll_modifier', 'key.sfm.label_gun.next_label',
    'key.sfm.label_gun.previous_label', 'key.sfm.label_gun.pull_modifier',
    'key.sfm.label_gun.target_manager_modifier', 'key.sfm.text_editor.accept_intellisense',
    'key.sfm.manager.text_editor', 'key.sfm.title_screen.text_editor',
    'key.sfm.toggle_network_tool_overlay',
    'key.recruits.command_screen_key', 'key.recruits.team_screen_key',
    'key.recruits.map_screen_key',
    'key.electrodynamics.jetpackascend', 'key.electrodynamics.jetpackmode',
    'key.electrodynamics.togglenvgs', 'key.electrodynamics.servoleggingsmode',
    'key.electrodynamics.toggleservoleggings', 'key.electrodynamics.swapbattery',
    'key.push_to_talk', 'key.whisper', 'key.mute_microphone', 'key.disable_voice_chat',
    'key.hide_icons', 'key.voice_chat', 'key.voice_chat_settings',
    'key.voice_chat_group', 'key.voice_chat_toggle_recording',
    'key.voice_chat_adjust_volumes',
    'key.ryoamiclights.dyn_light', 'key.open_muffler_gui',
    'key.boththrow.desc', 'key.leftthrow.desc', 'key.rightthrow.desc',
    'key.motoronoff.desc', 'key.jumpanddetach.desc', 'key.slow.desc',
    'key.climb.desc', 'key.climbup.desc', 'key.climbdown.desc',
    'key.enderlaunch.desc', 'key.rocket.desc', 'key.slide.desc',
    'key.craftingtweaks.rotate', 'key.craftingtweaks.rotate_counter_clockwise',
    'key.craftingtweaks.balance', 'key.craftingtweaks.spread',
    'key.craftingtweaks.clear', 'key.craftingtweaks.force_clear',
    'key.craftingtweaks.compress_one', 'key.craftingtweaks.compress_stack',
    'key.craftingtweaks.compress_all', 'key.craftingtweaks.decompress_one',
    'key.craftingtweaks.decompress_stack', 'key.craftingtweaks.decompress_all',
    'key.craftingtweaks.refill_last', 'key.craftingtweaks.refill_last_stack',
    'key.craftingtweaks.transfer_stack',
    'key.inventoryessentials.single_transfer', 'key.inventoryessentials.screen_bulk_drop',
    'key.inventoryessentials.sort_inventory',
    'key.trashslot.toggle', 'key.trashslot.toggle_lock',
    'key.trashslot.delete', 'key.trashslot.delete_all',
    'keybind.advancedperipherals.description',
    'create_mobile_packages.keyinfo.open_portable_stock_ticker',
    'create_mobile_packages.keyinfo.open_player_networks_screen',
    'placebo.toggleTrails', 'placebo.toggleWings',
    'key.carry.desc', 'equipmentcompare.key.showTooltips',
    'key.cataclysm.ability', 'key.cataclysm.helmet_ability',
    'key.cataclysm.chestplate_ability', 'key.cataclysm.boots_ability',
    'key.hypertube.tube_escape', 'keyinfo.copycats.fill_copycat',
    'key.map_atlases.open_minimap', 'key.map_atlases.zoom_out_minimap',
    'key.map_atlases.zoom_in_minimap', 'key.map_atlases.place_pin',
    'key.map_atlases.increase_slice', 'key.map_atlases.decrease_slice',
    'key.toastcontrol.clear', 'key.horsecombatcontrols.toggle',
    'create_radar.key.binocular.use', 'create_radar.key.binocular.fire',
    'key.valkyrienskies.ship_down', 'key.valkyrienskies.ship_cruise',
    'key.raised.options', 'key.modularrouters.configure', 'key.modularrouters.moduleInfo',
    'justzoom.keybinds.keybind.zoom', 'justzoom.keybinds.keybind.zoom_in',
    'justzoom.keybinds.keybind.zoom_out', 'justzoom.keybinds.keybind.open_options',
    'keybinds.combatroll.roll', 'key.ponder.ponder',
    'key.effortlessbuilding.mode.desc', 'key.effortlessbuilding.hud.desc',
    'key.effortlessbuilding.undo.desc', 'key.effortlessbuilding.redo.desc',
    'key.effortlessbuilding.previous_build_mode.desc',
    'key.effortlessbuilding.disable_build_mode_toggle.desc',
    'zume.zoom', 'zume.zoom_in', 'zume.zoom_out',
    'key.curios.open.desc',
    'key.origins.primary_active', 'key.origins.secondary_active', 'key.origins.view_origin',
    'create_tweaked_controllers.keybind.mouse_focus',
    'create_tweaked_controllers.keybind.mouse_reset',
    'create_tweaked_controllers.keybind.controller_exit',
    'key.toggleVisualItemContents', 'key.toggleSelectedItemTooltips',
    'key.toggleCarriedItemTooltips', 'key.cycleLeft', 'key.cycleRight',
    'key.jei.cheatItemStack2', 'key.jei.toggleHideIngredient',
    'key.jei.pauseRecipeCycling', 'key.jei.cheatOneItem2', 'key.jei.toggleEditMode',
    'key.jei.nextCategory', 'key.jei.transferRecipeBookmark',
    'key.jei.maxTransferRecipeBookmark', 'key.jei.clearSearchBar',
    'key.jei.copy.recipe.id', 'key.jei.showBookmarkTooltipFeatures',
    'key.jei.quickMove', 'key.jei.cheatItemStack', 'key.jei.showUses',
    'key.jei.previousPage', 'key.jei.cheatOneItem', 'key.jei.showRecipe2',
    'key.jei.toggleCheatModeConfigButton', 'key.jei.closeRecipeGui',
    'key.jei.nextRecipePage', 'key.jei.recipeForward', 'key.jei.previousRecipePage',
    'key.jei.toggleCheatMode', 'key.jei.toggleWildcardHideIngredient',
    'key.jei.showRecipe', 'key.jei.toggleOverlay', 'key.jei.showUses2',
    'key.jei.recipeBack', 'key.jei.shareToChat', 'key.jei.previousCategory',
    'key.jei.nextPage', 'key.jei.previousSearch', 'key.jei.toggleBookmarkOverlay',
    'key.jei.focusSearch', 'key.jei.bookmark', 'key.jei.nextSearch',
    'key.heracles.open_quests',
    'pneumaticcraft.armor.options', 'pneumaticcraft.helmet.hack',
    'pneumaticcraft.helmet.debugging.drone', 'pneumaticcraft.boots.kick',
    'pneumaticcraft.chestplate.launcher', 'pneumaticcraft.boots.jet_boots',
    'key.immersivepetroleum.projector.flip', 'key.immersiveengineering.magnetEquip',
    'key.immersiveengineering.railgunZoom', 'key.immersiveengineering.chemthrowerSwitch',
    'key.mount_jump',
    'gui.xaero_minimap_settings', 'gui.xaero_minimap_server_profiles',
    'gui.xaero_zoom_in', 'gui.xaero_zoom_out', 'gui.xaero_new_waypoint',
    'gui.xaero_waypoints_key', 'gui.xaero_enlarge_map', 'gui.xaero_toggle_map',
    'gui.xaero_toggle_waypoints', 'gui.xaero_toggle_map_waypoints',
    'gui.xaero_toggle_slime', 'gui.xaero_toggle_grid', 'gui.xaero_instant_waypoint',
    'gui.xaero_switch_waypoint_set', 'gui.xaero_display_all_sets',
    'gui.xaero_toggle_light_overlay', 'gui.xaero_toggle_entity_radar',
    'gui.xaero_reverse_entity_radar', 'gui.xaero_toggle_manual_cave_mode',
    'gui.xaero_alternative_list_players', 'gui.xaero_toggle_tracked_players_on_map',
    'gui.xaero_toggle_tracked_players_in_world', 'gui.xaero_toggle_pac_chunk_claims',
    'key.integrateddynamics.logic_programmer_focus_search',
    'key.integrateddynamics.logic_programmer_open_rename',
    'tetra.toolbelt.binding.access', 'tetra.toolbelt.binding.restock',
    'tetra.toolbelt.binding.open', 'tetra.toolbelt.binding.secondary_use',
    'treechop.key.toggle_chopping', 'treechop.key.toggle_felling',
    'treechop.key.cycle_sneak_behavior', 'treechop.key.open_settings_overlay',
    'key.immersive_aircraft.fallback_control_left',
    'key.immersive_aircraft.fallback_control_right',
    'key.immersive_aircraft.fallback_control_forward',
    'key.immersive_aircraft.fallback_control_backward',
    'key.immersive_aircraft.fallback_control_up',
    'key.immersive_aircraft.fallback_control_down',
    'key.immersive_aircraft.fallback_control_pull',
    'key.immersive_aircraft.fallback_control_push',
    'key.immersive_aircraft.fallback_use',
    'key.immersive_aircraft.dismount', 'key.immersive_aircraft.boost',
    'gui.xaero_open_map', 'gui.xaero_open_settings',
    'gui.xaero_world_map_server_settings', 'gui.xaero_map_zoom_in',
    'gui.xaero_map_zoom_out', 'gui.xaero_quick_confirm', 'gui.xaero_toggle_dimension',
    'key.railcraft.change_aura', 'key.railcraft.loco.reverse',
    'key.railcraft.loco.faster', 'key.railcraft.loco.slower',
    'key.railcraft.loco.mode', 'key.railcraft.loco.whistle',
    'key.primalmagick.change_spell', 'key.primalmagick.carpet_forward',
    'key.primalmagick.carpet_backward', 'key.primalmagick.grimoire_next_page',
    'key.primalmagick.grimoire_prev_page', 'key.primalmagick.grimoire_prev_topic',
    'key.primalmagick.view_affinity',
    'fpsreducer.key.openGui', 'fpsreducer.key.forceIdle',
    'crashutils.openscreen', 'crashutils.copycontainer', 'crashutils.slottooltips',
    'key.createrailwaysnavigator.route_overlay_options',
    'key.walkietalkie.activate',
    'key.simplyswords.mainhand_ability', 'key.simplyswords.offhand_ability',
    'key.vs_clockwork.aeronaut_goggles_toggle', 'key.vs_clockwork.debug_lightning_toggle',
    'key.simplytooltips.cycle_tab', 'key.simplytooltips.capture_gif',
    'key.draconicevolution.place_item', 'key.draconicevolution.tool_config',
    'key.draconicevolution.tool_modules', 'key.draconicevolution.toggle_flight',
    'key.draconicevolution.toggle_magnet', 'key.draconicevolution.dislocator_teleport',
    'key.draconicevolution.dislocator_blink', 'key.draconicevolution.dislocator_gui',
    'key.draconicevolution.dislocator_up', 'key.draconicevolution.dislocator_down',
    'key.smallships.ship_sail', 'key.smallships.cannon_barrel_enter',
    'key.tacz.unload.desc', 'key.tacz.aim.desc', 'key.tacz.crawl.desc',
    'key.tacz.reload.desc', 'key.tacz.inspect.desc', 'key.tacz.fire_select.desc',
    'key.tacz.melee.desc', 'key.tacz.zoom.desc', 'key.tacz.interact.desc',
    'key.tacz.refit.desc', 'key.tacz.open_config.desc', 'key.tacz.shoot.desc',
    'create.keyinfo.toolmenu', 'create.keyinfo.toolbelt', 'create.keyinfo.rotate_menu',
    'key.doomedmatu.open_panel', 'key.doomedmatu.open_wear',
    'key.doomedmatu.open_settings', 'key.doomedmatu.open_codex',
    'key.doomedmatu.reload_firearm', 'key.doomedmatu.select_round',
    'key.doomedmatu.accept_medical',
    'framedblocks.key.update_cull', 'framedblocks.key.wipe_cache',
    'key.createbigcannons.pitch_mode', 'key.createbigcannons.fire_controlled_cannon',
    'key.guideme.guide',
    'key.hexcasting.spellbook_prev', 'key.hexcasting.spellbook_next',
    'railways.keyinfo.bogey_menu', 'railways.keyinfo.cycle_menu',
    'key.special_ability',
    'key.jade.config', 'key.jade.show_overlay', 'key.jade.toggle_liquid',
    'key.jade.show_recipes', 'key.jade.show_uses', 'key.jade.narrate',
    'key.jade.show_details',
    'key.ae2.portable_item_cell', 'key.ae2.portable_fluid_cell', 'key.ae2.wireless_terminal',
    'key.car_forward', 'key.car_back', 'key.car_left', 'key.car_right',
    'key.car_gui', 'key.car_start', 'key.car_horn', 'key.center_car',
    'quark.keybind.autorun', 'quark.keybind.back', 'quark.keybind.camera_mode',
    'quark.keybind.transfer_insert', 'quark.keybind.transfer_extract',
    'quark.keybind.shift_lock',
    'quark.emote.no', 'quark.emote.yes', 'quark.emote.wave', 'quark.emote.salute',
    'quark.emote.cheer', 'quark.emote.clap', 'quark.emote.think', 'quark.emote.point',
    'quark.emote.shrug', 'quark.emote.headbang', 'quark.emote.weep', 'quark.emote.facepalm',
    'quark.keybind.patreon_emote.dance', 'quark.keybind.patreon_emote.tpose',
    'quark.keybind.patreon_emote.dab', 'quark.keybind.patreon_emote.jet',
    'quark.keybind.patreon_emote.exorcist', 'quark.keybind.patreon_emote.zombie',
    'quark.keybind.change_hotbar', 'quark.keybind.sort_player',
    'quark.keybind.sort_container', 'quark.keybind.lock_rotation',
    'quark.keybind.narrator_readout', 'quark.keybind.narrator_full_readout',
    'quark.keybind.variant_selector',
    'supplementaries.keybind.quiver', 'key.diet.open.desc',
    'key.create_sa.flying', 'key.create_sa.increase_reach', 'key.create_sa.decrease_reach',
    'key.parcool.Enable', 'key.parcool.Crawl', 'key.parcool.ClingToCliff',
    'key.parcool.Breakfall', 'key.parcool.FastRun', 'key.parcool.Dodge',
    'key.parcool.RideZipline', 'key.parcool.WallSlide', 'key.parcool.WallJump',
    'key.parcool.Vault', 'key.parcool.HorizontalWallRun', 'key.parcool.HideInBlock',
    'key.parcool.openSetting', 'key.parcool.QuickTurn', 'key.parcool.Flipping',
    'key.parcool.HangDown',
    'key.screenshot_viewer.open_screenshots_screen',
    'key.presencefootsteps.settings', 'key.presencefootsteps.toggle',
    'pneumaticcraft.armor.upgrade.fall_protection',
    'pneumaticcraft.armor.upgrade.jet_boots.module.hover',
    'pneumaticcraft.armor.upgrade.air_conditioning',
    'pneumaticcraft.armor.upgrade.stomp',
    'pneumaticcraft.armor.upgrade.jet_boots.module.flight_stabilizers',
    'pneumaticcraft.armor.upgrade.block_tracker',
    'pneumaticcraft.armor.upgrade.jump_boost',
    'pneumaticcraft.armor.upgrade.charging',
    'pneumaticcraft.armor.upgrade.step_assist',
    'pneumaticcraft.armor.upgrade.coordinate_tracker',
    'pneumaticcraft.armor.upgrade.entity_tracker',
    'pneumaticcraft.armor.upgrade.run_speed',
    'pneumaticcraft.armor.upgrade.block_tracker.module.spawner',
    'pneumaticcraft.armor.upgrade.ender_visor',
    'pneumaticcraft.armor.upgrade.night_vision',
    'pneumaticcraft.armor.upgrade.reach_distance',
    'pneumaticcraft.armor.upgrade.magnet',
    'pneumaticcraft.armor.upgrade.jet_boots',
    'pneumaticcraft.armor.upgrade.block_tracker.module.energy',
    'pneumaticcraft.armor.upgrade.block_tracker.module.fluids',
    'pneumaticcraft.armor.upgrade.block_tracker.module.inventories',
    'pneumaticcraft.armor.upgrade.core_components',
    'pneumaticcraft.armor.upgrade.elytra',
    'pneumaticcraft.armor.upgrade.search',
    'pneumaticcraft.armor.upgrade.block_tracker.module.misc',
    'pneumaticcraft.armor.upgrade.jet_boots.module.smart_hover',
    'pneumaticcraft.armor.upgrade.block_tracker.module.hackables',
    'pneumaticcraft.armor.upgrade.scuba',
    'pneumaticcraft.armor.upgrade.jet_boots.module.builder_mode',
    'pneumaticcraft.armor.upgrade.block_tracker.module.end_portal',
]

# Bindings strictly partitioned into GUI-only vs IN_GAME/UNIVERSAL
GUI_ONLY_KEYS = {
    'key.ponder.ponder': ('key.keyboard.w', NONE),
    'key.jei.showRecipe': ('key.keyboard.r', NONE),
    'key.jei.showUses': ('key.keyboard.u', NONE),
    'key.jei.bookmark': ('key.keyboard.a', NONE),
    'key.jei.focusSearch': ('key.keyboard.f', CTRL),
    'key.jei.toggleOverlay': ('key.keyboard.o', CTRL),
    'key.jei.recipeBack': ('key.keyboard.backspace', NONE),
    'key.jei.closeRecipeGui': ('key.keyboard.escape', NONE),
    'key.jei.previousPage': ('key.keyboard.page.up', NONE),
    'key.jei.nextPage': ('key.keyboard.page.down', NONE),
    'key.inventoryessentials.sort_inventory': ('key.mouse.middle', NONE),
    'key.trashslot.delete': ('key.keyboard.delete', NONE),
    'key.trashslot.delete_all': ('key.keyboard.delete', SHIFT),
    'key.trashslot.toggle': ('key.keyboard.delete', CTRL),
    'key.trashslot.toggle_lock': ('key.keyboard.delete', ALT),
    'key.craftingtweaks.rotate': ('key.keyboard.r', CTRL),
    'key.craftingtweaks.balance': ('key.keyboard.b', CTRL),
    'key.craftingtweaks.clear': ('key.keyboard.c', CTRL),
    'quark.keybind.transfer_insert': ('key.keyboard.up', SHIFT),
    'quark.keybind.transfer_extract': ('key.keyboard.down', SHIFT),
    'key.cycleLeft': ('key.keyboard.left', NONE),
    'key.cycleRight': ('key.keyboard.right', NONE),
}

INGAME_KEYS = {
    # Vanilla core
    'key.attack': ('key.mouse.left', NONE),
    'key.use': ('key.mouse.right', NONE),
    'key.pickItem': ('key.mouse.middle', NONE),
    'key.forward': ('key.keyboard.w', NONE),
    'key.left': ('key.keyboard.a', NONE),
    'key.back': ('key.keyboard.s', NONE),
    'key.right': ('key.keyboard.d', NONE),
    'key.jump': ('key.keyboard.space', NONE),
    'key.sneak': ('key.keyboard.left.shift', NONE),
    'key.sprint': ('key.keyboard.left.control', NONE),
    'key.drop': ('key.keyboard.q', NONE),
    'key.inventory': ('key.keyboard.e', NONE),
    'key.swapOffhand': ('key.keyboard.f', NONE),
    'key.chat': ('key.keyboard.t', NONE),
    'key.command': ('key.keyboard.slash', NONE),
    'key.playerlist': ('key.keyboard.tab', NONE),
    'key.advancements': ('key.keyboard.l', NONE),
    'key.hotbar.1': ('key.keyboard.1', NONE),
    'key.hotbar.2': ('key.keyboard.2', NONE),
    'key.hotbar.3': ('key.keyboard.3', NONE),
    'key.hotbar.4': ('key.keyboard.4', NONE),
    'key.hotbar.5': ('key.keyboard.5', NONE),
    'key.hotbar.6': ('key.keyboard.6', NONE),
    'key.hotbar.7': ('key.keyboard.7', NONE),
    'key.hotbar.8': ('key.keyboard.8', NONE),
    'key.hotbar.9': ('key.keyboard.9', NONE),
    'key.screenshot': ('key.keyboard.f2', NONE),
    'key.togglePerspective': ('key.keyboard.f5', NONE),
    'key.fullscreen': ('key.keyboard.f11', NONE),

    # Pack essentials (Quests, Origins, Curios, Map, Jade, Zoom)
    'key.heracles.open_quests': ('key.keyboard.h', NONE),
    'key.origins.primary_active': ('key.keyboard.g', NONE),
    'key.origins.secondary_active': ('key.keyboard.g', SHIFT),
    'key.origins.view_origin': ('key.keyboard.o', NONE),
    'key.curios.open.desc': ('key.keyboard.i', NONE),
    'key.jade.show_overlay': ('key.keyboard.j', NONE),
    'key.jade.config': ('key.keyboard.j', ALT),
    'key.jade.toggle_liquid': ('key.keyboard.j', SHIFT),
    'key.jade.show_details': ('key.keyboard.j', CTRL),
    'justzoom.keybinds.keybind.zoom': ('key.keyboard.c', NONE),
    'justzoom.keybinds.keybind.zoom_in': ('key.keyboard.equal', NONE),
    'justzoom.keybinds.keybind.zoom_out': ('key.keyboard.minus', NONE),

    # Xaero's World Map & Minimap
    'gui.xaero_open_map': ('key.keyboard.m', NONE),
    'gui.xaero_new_waypoint': ('key.keyboard.b', NONE),
    'gui.xaero_waypoints_key': ('key.keyboard.n', NONE),
    'gui.xaero_zoom_out': ('key.keyboard.left.bracket', NONE),
    'gui.xaero_zoom_in': ('key.keyboard.right.bracket', NONE),
    'gui.xaero_enlarge_map': ('key.keyboard.backslash', NONE),
    'gui.xaero_toggle_map': ('key.keyboard.m', CTRL),
    'gui.xaero_minimap_settings': ('key.keyboard.m', ALT),
    'gui.xaero_open_settings': ('key.keyboard.m', SHIFT),
    'gui.xaero_instant_waypoint': ('key.keyboard.b', ALT),
    'gui.xaero_toggle_waypoints': ('key.keyboard.n', ALT),
    'key.map_atlases.open_minimap': ('key.keyboard.b', CTRL),

    # Voice Chat & Realistic Walkie-Talkie
    'key.push_to_talk': ('key.keyboard.v', NONE),
    'key.walkietalkie.activate': ('key.keyboard.y', NONE),
    'key.voice_chat': ('key.keyboard.p', NONE),
    'key.mute_microphone': ('key.keyboard.k', NONE),
    'key.whisper': ('key.keyboard.v', SHIFT),
    'key.disable_voice_chat': ('key.keyboard.k', ALT),
    'key.voice_chat_group': ('key.keyboard.p', ALT),
    'key.voice_chat_settings': ('key.keyboard.p', CTRL),
    'key.voice_chat_adjust_volumes': ('key.keyboard.p', SHIFT),

    # Combat, Movement, Carry On, TaCZ, ParCool, Grappling Hook
    'keybinds.combatroll.roll': ('key.keyboard.z', NONE),
    'key.carry.desc': ('key.keyboard.x', NONE),
    'key.tacz.shoot.desc': ('key.mouse.left', NONE),
    'key.tacz.aim.desc': ('key.mouse.right', NONE),
    'key.tacz.reload.desc': ('key.keyboard.r', NONE),
    'key.tacz.fire_select.desc': ('key.keyboard.r', SHIFT),
    'key.tacz.inspect.desc': ('key.keyboard.r', ALT),
    'key.tacz.refit.desc': ('key.keyboard.z', ALT),
    'key.tacz.crawl.desc': ('key.keyboard.c', CTRL),
    'key.tacz.melee.desc': ('key.keyboard.v', ALT),
    'key.tacz.zoom.desc': ('key.keyboard.x', ALT),
    'key.tacz.interact.desc': ('key.keyboard.f', ALT),
    'key.tacz.unload.desc': ('key.keyboard.u', ALT),

    'key.parcool.Crawl': ('key.keyboard.c', SHIFT),
    'key.parcool.Dodge': ('key.keyboard.x', SHIFT),
    'key.parcool.FastRun': ('key.keyboard.r', CTRL),
    'key.parcool.ClingToCliff': ('key.keyboard.f', CTRL),
    'key.parcool.Breakfall': ('key.keyboard.f', SHIFT),
    'key.parcool.Vault': ('key.keyboard.v', CTRL),
    'key.parcool.WallJump': ('key.keyboard.x', CTRL),
    'key.parcool.HorizontalWallRun': ('key.keyboard.g', CTRL),
    'key.parcool.WallSlide': ('key.keyboard.l', SHIFT),
    'key.parcool.HangDown': ('key.keyboard.l', ALT),
    'key.parcool.RideZipline': ('key.keyboard.y', ALT),
    'key.parcool.QuickTurn': ('key.keyboard.t', ALT),
    'key.parcool.Flipping': ('key.keyboard.t', SHIFT),
    'key.parcool.Enable': ('key.keyboard.z', CTRL),
    'key.parcool.openSetting': ('key.keyboard.z', SHIFT),

    'key.boththrow.desc': ('key.keyboard.y', SHIFT),
    'key.leftthrow.desc': ('key.keyboard.left.bracket', SHIFT),
    'key.rightthrow.desc': ('key.keyboard.right.bracket', SHIFT),
    'key.jumpanddetach.desc': ('key.keyboard.space', ALT),
    'key.motoronoff.desc': ('key.keyboard.y', CTRL),
    'key.enderlaunch.desc': ('key.keyboard.u', CTRL),
    'key.rocket.desc': ('key.keyboard.u', SHIFT),

    'key.simplyswords.mainhand_ability': ('key.keyboard.g', ALT),
    'key.simplyswords.offhand_ability': ('key.keyboard.k', SHIFT),
    'key.cataclysm.ability': ('key.keyboard.k', CTRL),
    'key.special_ability': ('key.keyboard.o', CTRL),

    # Create, Transport, Building, Tech & Utility
    'create.keyinfo.toolmenu': ('key.keyboard.left.alt', NONE),
    'create.keyinfo.toolbelt': ('key.keyboard.b', SHIFT),
    'create.keyinfo.rotate_menu': ('key.keyboard.n', SHIFT),
    'railways.keyinfo.bogey_menu': ('key.keyboard.n', CTRL),
    'railways.keyinfo.cycle_menu': ('key.keyboard.left.bracket', ALT),
    'key.create_sa.flying': ('key.keyboard.right.bracket', ALT),
    'key.create_sa.increase_reach': ('key.keyboard.up', NONE),
    'key.create_sa.decrease_reach': ('key.keyboard.down', NONE),
    'key.hypertube.tube_escape': ('key.keyboard.backspace', ALT),
    'keyinfo.copycats.fill_copycat': ('key.keyboard.0', SHIFT),
    'create_mobile_packages.keyinfo.open_portable_stock_ticker': ('key.keyboard.i', SHIFT),
    'create_mobile_packages.keyinfo.open_player_networks_screen': ('key.keyboard.o', SHIFT),
    'key.ae2.wireless_terminal': ('key.keyboard.0', NONE),
    'key.ae2.portable_item_cell': ('key.keyboard.0', ALT),
    'key.ae2.portable_fluid_cell': ('key.keyboard.0', CTRL),
    'treechop.key.toggle_chopping': ('key.keyboard.semicolon', NONE),
    'treechop.key.toggle_felling': ('key.keyboard.semicolon', SHIFT),
    'treechop.key.cycle_sneak_behavior': ('key.keyboard.semicolon', CTRL),
    'treechop.key.open_settings_overlay': ('key.keyboard.semicolon', ALT),
    'key.effortlessbuilding.mode.desc': ('key.keyboard.h', ALT),
    'key.effortlessbuilding.hud.desc': ('key.keyboard.h', SHIFT),
    'key.effortlessbuilding.undo.desc': ('key.keyboard.left.bracket', CTRL),
    'key.effortlessbuilding.redo.desc': ('key.keyboard.right.bracket', CTRL),
    'quark.keybind.change_hotbar': ('key.keyboard.tab', SHIFT),
    'quark.keybind.lock_rotation': ('key.keyboard.l', CTRL),
    'key.corpse.death_history': ('key.keyboard.period', NONE),
    'key.diet.open.desc': ('key.keyboard.apostrophe', NONE),
    'key.exposure.camera_controls': ('key.keyboard.apostrophe', SHIFT),
    'supplementaries.keybind.quiver': ('key.keyboard.apostrophe', ALT),
    'tetra.toolbelt.binding.access': ('key.keyboard.t', CTRL),
    'tetra.toolbelt.binding.open': ('key.keyboard.i', CTRL),
    'tetra.toolbelt.binding.restock': ('key.keyboard.apostrophe', CTRL),
    'key.open_muffler_gui': ('key.keyboard.page.up', NONE),
    'key.toastcontrol.clear': ('key.keyboard.page.down', NONE),
    'key.car_forward': ('key.keyboard.w', NONE),
    'key.car_back': ('key.keyboard.s', NONE),
    'key.car_left': ('key.keyboard.a', NONE),
    'key.car_right': ('key.keyboard.d', NONE),
    'key.car_start': ('key.keyboard.i', ALT),
    'key.car_gui': ('key.keyboard.o', ALT),
    'key.car_horn': ('key.keyboard.h', CTRL),
    'key.valkyrienskies.ship_down': ('key.keyboard.c', ALT),
    'key.valkyrienskies.ship_cruise': ('key.keyboard.backslash', CTRL),
    'key.smallships.ship_sail': ('key.keyboard.backslash', SHIFT),
    'key.smallships.cannon_barrel_enter': ('key.keyboard.backslash', ALT),
    'key.immersive_aircraft.boost': ('key.keyboard.comma', SHIFT),
    'key.modularrouters.configure': ('key.keyboard.comma', NONE),
    'pneumaticcraft.armor.options': ('key.keyboard.comma', CTRL),
    'pneumaticcraft.helmet.hack': ('key.keyboard.comma', ALT),
    'pneumaticcraft.boots.jet_boots': ('key.keyboard.slash', ALT),
    'key.draconicevolution.toggle_flight': ('key.keyboard.slash', SHIFT),
    'key.draconicevolution.tool_config': ('key.keyboard.slash', CTRL),
    'key.draconicevolution.tool_modules': ('key.keyboard.period', CTRL),
    'key.electrodynamics.jetpackmode': ('key.keyboard.period', ALT),
    'key.electrodynamics.togglenvgs': ('key.keyboard.period', SHIFT),
    'key.doomedmatu.reload_firearm': ('key.keyboard.minus', ALT),
    'key.doomedmatu.select_round': ('key.keyboard.equal', ALT),
    'key.doomedmatu.accept_medical': ('key.keyboard.equal', SHIFT),
    'key.doomedmatu.open_panel': ('key.keyboard.equal', CTRL),
    'key.primalmagick.change_spell': ('key.keyboard.minus', CTRL),
    'key.recruits.command_screen_key': ('key.keyboard.minus', SHIFT),
    'iris.keybind.toggleShaders': ('key.keyboard.f6', NONE),
    'iris.keybind.shaderPackSelection': ('key.keyboard.f7', NONE),
    'iris.keybind.reload': ('key.keyboard.f8', NONE),
    'key.ryoamiclights.dyn_light': ('key.keyboard.f9', NONE),
    'key.sfm.toggle_label_view_key': ('key.keyboard.f10', NONE),
    'key.immersiveengineering.magnetEquip': ('key.keyboard.f12', NONE),
    'key.screenshot_viewer.open_screenshots_screen': ('key.keyboard.f2', ALT),
}

# Intentional shared physical controls whose mods gate them by held gun / seated car
ALLOWED_INGAME_SHARES = {
    ('key.mouse.left', NONE): {'key.attack', 'key.tacz.shoot.desc'},
    ('key.mouse.right', NONE): {'key.use', 'key.tacz.aim.desc'},
    ('key.keyboard.w', NONE): {'key.forward', 'key.car_forward'},
    ('key.keyboard.a', NONE): {'key.left', 'key.car_left'},
    ('key.keyboard.s', NONE): {'key.back', 'key.car_back'},
    ('key.keyboard.d', NONE): {'key.right', 'key.car_right'},
}

DISALLOWED_65_KEYS = {
    'key.keyboard.grave.accent',
    'key.keyboard.caps.lock',
    'key.keyboard.insert',
    'key.keyboard.print.screen',
    'key.keyboard.scroll.lock',
    'key.keyboard.pause',
    'key.keyboard.home',
    'key.keyboard.end',
    'key.keyboard.menu',
    'key.keyboard.num.lock',
}

HAZARD_MODIFIER_BASE_KEYS = {
    'key.keyboard.w', 'key.keyboard.a', 'key.keyboard.s', 'key.keyboard.d',
    'key.keyboard.space', 'key.keyboard.q', 'key.keyboard.e',
    'key.keyboard.1', 'key.keyboard.2', 'key.keyboard.3', 'key.keyboard.4',
    'key.keyboard.5', 'key.keyboard.6', 'key.keyboard.7', 'key.keyboard.8',
    'key.keyboard.9',
}

ALT_HAZARD_KEYS = {
    'key.keyboard.tab', 'key.keyboard.f4', 'key.keyboard.enter', 'key.keyboard.escape',
}


def validate(all_bindings):
    # 1. Coverage check
    assert len(ALL_KEYS) == len(set(ALL_KEYS)), 'Duplicate in ALL_KEYS'
    assert set(all_bindings) == set(ALL_KEYS), 'Mismatch between bound keys and ALL_KEYS'

    # 2. Format, Numpad, 65%, and hazardous-combo checks
    pattern = re.compile(r'^key_([^:]+):([^:]+):(NONE|SHIFT|CONTROL|ALT)$')
    for name, (key, mod) in all_bindings.items():
        line = f'key_{name}:{key}:{mod}'
        assert pattern.match(line), f'Invalid DefaultOptions line: {line}'
        assert 'keypad' not in key, f'Numpad key forbidden: {line}'
        assert key not in DISALLOWED_65_KEYS, f'Non-65% key forbidden: {line}'
        if mod in (SHIFT, CTRL) and key in HAZARD_MODIFIER_BASE_KEYS:
            raise AssertionError(f'Hazardous {mod}+movement/hotbar combo: {line}')
        if mod == ALT and key in ALT_HAZARD_KEYS:
            raise AssertionError(f'Hazardous OS ALT combo: {line}')

    # 3. Conflict check within GUI_ONLY_KEYS
    gui_used = {}
    for name, combo in GUI_ONLY_KEYS.items():
        assert name in ALL_KEYS, f'Unknown key: {name}'
        assert name not in INGAME_KEYS, f'Key in both GUI and INGAME: {name}'
        if combo in gui_used:
            raise AssertionError(f'GUI conflict on {combo}: {gui_used[combo]} vs {name}')
        gui_used[combo] = name

    # 4. Conflict check within INGAME_KEYS
    ingame_used = {}
    for name, combo in INGAME_KEYS.items():
        assert name in ALL_KEYS, f'Unknown key: {name}'
        if combo in ingame_used:
            allowed = ALLOWED_INGAME_SHARES.get(combo, set())
            if {ingame_used[combo], name}.issubset(allowed):
                continue
            raise AssertionError(f'IN_GAME conflict on {combo}: {ingame_used[combo]} vs {name}')
        ingame_used[combo] = name


def main():
    all_bindings = {}
    for k in ALL_KEYS:
        if k in INGAME_KEYS:
            all_bindings[k] = INGAME_KEYS[k]
        elif k in GUI_ONLY_KEYS:
            all_bindings[k] = GUI_ONLY_KEYS[k]
        else:
            all_bindings[k] = ('key.keyboard.unknown', NONE)

    validate(all_bindings)

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    lines = [f'key_{k}:{key}:{mod}' for k, (key, mod) in all_bindings.items()]
    OUT_PATH.write_text('\n'.join(lines) + '\n', encoding='utf-8')
    bound_cnt = sum(1 for k, _ in all_bindings.values() if k != 'key.keyboard.unknown')
    unbound_cnt = len(all_bindings) - bound_cnt
    print(f'Generated {OUT_PATH} ({len(all_bindings)} keys: {bound_cnt} bound, {unbound_cnt} unbound, 0 conflicts)')


if __name__ == '__main__':
    main()
