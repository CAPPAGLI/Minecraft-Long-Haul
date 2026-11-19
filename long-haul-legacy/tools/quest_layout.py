"""Hand-arranged pixel layouts. VORTEX Foundations 3.0.8 reference: 54px spacing.
We use 64px horizontal / 56px vertical spacing; chapter bounds centered at origin.
"""
CHAPTERS = {
 'start': '01 · Начало', 'workshop': '02 · Мастерская',
 'transport': '03 · Транспорт', 'regions': '04 · Региональная экспансия',
 'expeditions': '05 · Дальние экспедиции', 'bosses': '06 · Боссы и структуры',
 'megaproject': '07 · Мегапроект', 'space': '08 · Космическая программа',
 'guide': '09 · Справочник',
}
# Explicit positions avoid duplicates and keep prerequisite chains legible.
GRIDS = {
 'start': [
 ['welcome','first_tools','first_iron','first_zinc'],
 [None,'first_farm','first_coal','first_diamond']],
 'workshop': [
 ['water_power','mechanical_mixer','mechanical_press','brass_age','precision'],
 [None,'vein_atlas','drilling_machine','ore_drill','electric_motor'],
 [None,'extractor','diamond_drill','tesla_coil','rolling_mill']],
 'transport': [
 ['first_cart','first_track','track_station','schedule','steam_engine'],
 ['first_boat','charting_map','chunk_loader','brass_loader','scout_plane'],
 [None,None,'economy_plane','airship','diesel_engine']],
 'regions': [
 ['arid_journey','gold_vein','redstone_vein'],
 ['diesel_fuel',None,'lapis_vein']],
 'expeditions': [
 ['tropical_journey','diamond_vein','rice_farm','tomato_farm'],
 [None,'emerald_vein','atlas','explorers_compass'],
 ['polar_journey','cabbage_farm',None,None],
 ['natures_compass',None,None,None]],
 'bosses': [
 ['structure_hunter','precision_loot',None,None],
 ['track_loot',None,None,None],
 ['ancient_remnant',None,'lich','soul_star'],
 ['burning_ashes','ancient_metal','netherite_monstrosity','obsidian_heart'],
 [None,'wither_slayer',None,None]],
 'megaproject': [
 ['alloy_plate','precision_frame','energy_core','launch_catalyst'],
 ['launch_pad','megaproject_core','orbital_module',None]],
 'space': [
 ['steel_plate','nasa_workbench','rocket_fin','tier1_rocket','moon','desh_plate'],
 ['nose_cone',None,'oxygen_gear','jet_suit','gravity_normalizer','tier2_rocket'],
 [None,None,'tier4_rocket','calorite','tier3_rocket','ostrum']],
 'guide': [
 ['guide_climate','guide_farming','guide_worldgen'],
 ['guide_survival','guide_navigation','guide_create'],
 ['guide_bosses','guide_space','guide_perf']],
}
def positions():
 result={}
 for group, rows in GRIDS.items():
  entries={qid:(col*64,row*56) for row, line in enumerate(rows) for col,qid in enumerate(line) if qid}
  cx=(min(p[0] for p in entries.values())+max(p[0] for p in entries.values()))//2
  cy=(min(p[1] for p in entries.values())+max(p[1] for p in entries.values()))//2
  result.update({qid:[x-cx,y-cy] for qid,(x,y) in entries.items()})
 return result
