#!/usr/bin/env python3
"""Generate 1.20.1 worldgen ore rebalance overrides (vanilla + modded ~10x reduction)
and rare vanilla + modded mono-ore rich chunks + sky-island refuges.
"""
import json, pathlib

R = pathlib.Path(__file__).resolve().parents[1]
DATA = R / 'overrides/kubejs/data'


def write_json(path: pathlib.Path, obj: dict):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')


def height_uniform(min_y: int, max_y: int):
    return {
        'type': 'minecraft:height_range',
        'height': {
            'type': 'minecraft:uniform',
            'min_inclusive': {'absolute': min_y},
            'max_inclusive': {'absolute': max_y},
        },
    }


def height_triangle(min_y: int, max_y: int):
    return {
        'type': 'minecraft:height_range',
        'height': {
            'type': 'minecraft:trapezoid',
            'min_inclusive': {'absolute': min_y},
            'max_inclusive': {'absolute': max_y},
        },
    }


def placed_ore(feature: str, first_filter: dict, hr: dict, count_after: int | None = None, extra_tail: list | None = None):
    placement = [first_filter]
    if count_after is not None:
        placement.append({'type': 'minecraft:count', 'count': count_after})
    placement.extend([
        {'type': 'minecraft:in_square'},
        hr,
    ])
    placement.extend(extra_tail if extra_tail is not None else [{'type': 'minecraft:biome'}])
    return {'feature': feature, 'placement': placement}


def ore_configured(size: int, stone_block: str, deepslate_block: str | None = None):
    targets = [
        {
            'target': {'predicate_type': 'minecraft:tag_match', 'tag': 'minecraft:stone_ore_replaceables'},
            'state': {'Name': stone_block},
        }
    ]
    if deepslate_block:
        targets.append({
            'target': {'predicate_type': 'minecraft:tag_match', 'tag': 'minecraft:deepslate_ore_replaceables'},
            'state': {'Name': deepslate_block},
        })
    return {
        'type': 'minecraft:ore',
        'config': {
            'size': size,
            'discard_chance_on_air_exposure': 0.0,
            'targets': targets,
        },
    }


def ie_scarce_placed(feature: str, ie_idx: int, chance: int = 8):
    return {
        'feature': feature,
        'placement': [
            {'type': 'minecraft:rarity_filter', 'chance': chance},
            {'type': 'minecraft:height_range', 'height': {'type': 'immersiveengineering:ie_range', 'value': ie_idx}},
            {'type': 'minecraft:in_square'},
            {'type': 'immersiveengineering:ie_count', 'value': ie_idx},
        ],
    }


def main():
    mc_pf = DATA / 'minecraft/worldgen/placed_feature'
    create_pf = DATA / 'create/worldgen/placed_feature'
    ie_pf = DATA / 'immersiveengineering/worldgen/placed_feature'
    pm_pf = DATA / 'primalmagick/worldgen/placed_feature'
    lh_cf = DATA / 'longhaul/worldgen/configured_feature'
    lh_pf = DATA / 'longhaul/worldgen/placed_feature'
    lh_bm = DATA / 'longhaul/forge/biome_modifier'

    # 1. Global ~10x reduction of vanilla Overworld ores
    vanilla_overrides = {
        'ore_coal_upper': placed_ore('minecraft:ore_coal', {'type': 'minecraft:count', 'count': 3}, height_uniform(136, 320)),
        'ore_coal_lower': placed_ore('minecraft:ore_coal_buried', {'type': 'minecraft:count', 'count': 2}, height_triangle(0, 192)),
        'ore_iron_upper': placed_ore('minecraft:ore_iron', {'type': 'minecraft:count', 'count': 9}, height_triangle(80, 384)),
        'ore_iron_middle': placed_ore('minecraft:ore_iron', {'type': 'minecraft:count', 'count': 1}, height_triangle(-24, 56)),
        'ore_iron_small': placed_ore('minecraft:ore_iron_small', {'type': 'minecraft:count', 'count': 1}, height_uniform(-64, 72)),
        'ore_copper': placed_ore('minecraft:ore_copper_small', {'type': 'minecraft:count', 'count': 2}, height_triangle(-16, 112)),
        'ore_copper_large': placed_ore('minecraft:ore_copper_large', {'type': 'minecraft:count', 'count': 2}, height_triangle(-16, 112)),
        'ore_gold': placed_ore('minecraft:ore_gold_buried', {'type': 'minecraft:rarity_filter', 'chance': 3}, height_triangle(-64, 32)),
        'ore_gold_lower': placed_ore('minecraft:ore_gold_buried', {'type': 'minecraft:rarity_filter', 'chance': 10}, height_uniform(-64, -48)),
        'ore_redstone': placed_ore('minecraft:ore_redstone', {'type': 'minecraft:rarity_filter', 'chance': 3}, height_uniform(-64, 15)),
        'ore_redstone_lower': placed_ore('minecraft:ore_redstone', {'type': 'minecraft:count', 'count': 1}, height_triangle(-64, 0)),
        'ore_diamond': placed_ore('minecraft:ore_diamond_small', {'type': 'minecraft:rarity_filter', 'chance': 2}, height_triangle(-80, 80)),
        'ore_diamond_large': placed_ore('minecraft:ore_diamond_large', {'type': 'minecraft:rarity_filter', 'chance': 90}, height_triangle(-80, 80)),
        'ore_diamond_buried': placed_ore('minecraft:ore_diamond_buried', {'type': 'minecraft:rarity_filter', 'chance': 3}, height_triangle(-80, 80)),
        'ore_lapis': placed_ore('minecraft:ore_lapis', {'type': 'minecraft:rarity_filter', 'chance': 5}, height_triangle(-32, 32)),
        'ore_lapis_buried': placed_ore('minecraft:ore_lapis_buried', {'type': 'minecraft:rarity_filter', 'chance': 3}, height_uniform(-64, 64)),
        'ore_emerald': placed_ore('minecraft:ore_emerald', {'type': 'minecraft:count', 'count': 10}, height_triangle(-16, 480)),
    }
    for name, obj in vanilla_overrides.items():
        write_json(mc_pf / f'{name}.json', obj)

    # 2. Modded Overworld ore scarcity overrides (Create, Immersive Engineering, Primal Magick)
    create_overrides = {
        'zinc_ore': placed_ore('create:zinc_ore', {'type': 'minecraft:rarity_filter', 'chance': 2}, height_uniform(-63, 70), extra_tail=[{'type': 'create:config_filter'}]),
        'striated_ores_overworld': placed_ore('create:striated_ores_overworld', {'type': 'minecraft:rarity_filter', 'chance': 90}, height_uniform(-30, 70), extra_tail=[{'type': 'create:config_filter'}]),
    }
    for name, obj in create_overrides.items():
        write_json(create_pf / f'{name}.json', obj)

    ie_overrides = {
        'bauxite': ie_scarce_placed('immersiveengineering:bauxite', 0, chance=8),
        'lead': ie_scarce_placed('immersiveengineering:lead', 1, chance=8),
        'silver': ie_scarce_placed('immersiveengineering:silver', 2, chance=8),
        'nickel': ie_scarce_placed('immersiveengineering:nickel', 3, chance=8),
        'deep_nickel': ie_scarce_placed('immersiveengineering:deep_nickel', 4, chance=8),
        'uranium': ie_scarce_placed('immersiveengineering:uranium', 5, chance=10),
    }
    for name, obj in ie_overrides.items():
        write_json(ie_pf / f'{name}.json', obj)

    pm_overrides = {
        'ore_rock_salt_upper': placed_ore('primalmagick:ore_rock_salt', {'type': 'minecraft:rarity_filter', 'chance': 48}, height_uniform(64, 128)),
        'ore_rock_salt_lower': placed_ore('primalmagick:ore_rock_salt', {'type': 'minecraft:rarity_filter', 'chance': 4}, height_uniform(0, 60)),
        'ore_quartz_upper': placed_ore('primalmagick:ore_quartz', {'type': 'minecraft:count', 'count': 1}, height_uniform(64, 128)),
        'ore_quartz_lower': placed_ore('primalmagick:ore_quartz', {'type': 'minecraft:count', 'count': 2}, height_uniform(0, 60)),
    }
    for name, obj in pm_overrides.items():
        write_json(pm_pf / f'{name}.json', obj)

    # 3. Custom configured ore veins for modded mono-ore rich chunks
    modded_veins = {
        'rich_bauxite_vein': ore_configured(10, 'immersiveengineering:ore_aluminum', 'immersiveengineering:deepslate_ore_aluminum'),
        'rich_lead_vein': ore_configured(9, 'immersiveengineering:ore_lead', 'immersiveengineering:deepslate_ore_lead'),
        'rich_silver_vein': ore_configured(9, 'immersiveengineering:ore_silver', 'immersiveengineering:deepslate_ore_silver'),
        'rich_nickel_vein': ore_configured(9, 'immersiveengineering:ore_nickel', 'immersiveengineering:deepslate_ore_nickel'),
        'rich_uranium_vein': ore_configured(8, 'immersiveengineering:ore_uranium', 'immersiveengineering:deepslate_ore_uranium'),
        'rich_thorium_vein': ore_configured(8, 'create_new_age:thorium_ore', None),
        'rich_tin_vein': ore_configured(10, 'railcraft:tin_ore', 'railcraft:deepslate_tin_ore'),
        'rich_sulfur_vein': ore_configured(9, 'railcraft:sulfur_ore', 'railcraft:deepslate_sulfur_ore'),
    }
    for name, obj in modded_veins.items():
        write_json(lh_cf / f'{name}.json', obj)

    # 4. Rare single-type ore motherlode chunks (6 vanilla + 11 modded = 17 total)
    rich_chunks = {
        # Vanilla mono-ore chunks
        'rich_coal_chunk': placed_ore('minecraft:ore_coal', {'type': 'minecraft:rarity_filter', 'chance': 64}, height_uniform(0, 160), count_after=32),
        'rich_iron_chunk': placed_ore('minecraft:ore_iron', {'type': 'minecraft:rarity_filter', 'chance': 72}, height_uniform(-32, 96), count_after=28),
        'rich_copper_chunk': placed_ore('minecraft:ore_copper_large', {'type': 'minecraft:rarity_filter', 'chance': 72}, height_uniform(-16, 112), count_after=24),
        'rich_gold_chunk': placed_ore('minecraft:ore_gold', {'type': 'minecraft:rarity_filter', 'chance': 96}, height_uniform(-64, 32), count_after=18),
        'rich_redstone_chunk': placed_ore('minecraft:ore_redstone', {'type': 'minecraft:rarity_filter', 'chance': 96}, height_uniform(-64, 16), count_after=18),
        'rich_diamond_chunk': placed_ore('minecraft:ore_diamond_large', {'type': 'minecraft:rarity_filter', 'chance': 160}, height_uniform(-64, 16), count_after=10),
        # Modded mono-ore chunks
        'rich_zinc_chunk': placed_ore('create:zinc_ore', {'type': 'minecraft:rarity_filter', 'chance': 72}, height_uniform(-63, 70), count_after=24),
        'rich_bauxite_chunk': placed_ore('longhaul:rich_bauxite_vein', {'type': 'minecraft:rarity_filter', 'chance': 84}, height_uniform(16, 112), count_after=22),
        'rich_lead_chunk': placed_ore('longhaul:rich_lead_vein', {'type': 'minecraft:rarity_filter', 'chance': 96}, height_uniform(-32, 48), count_after=20),
        'rich_silver_chunk': placed_ore('longhaul:rich_silver_vein', {'type': 'minecraft:rarity_filter', 'chance': 96}, height_uniform(-32, 48), count_after=20),
        'rich_nickel_chunk': placed_ore('longhaul:rich_nickel_vein', {'type': 'minecraft:rarity_filter', 'chance': 112}, height_uniform(-64, 32), count_after=18),
        'rich_uranium_chunk': placed_ore('longhaul:rich_uranium_vein', {'type': 'minecraft:rarity_filter', 'chance': 144}, height_uniform(-64, 24), count_after=14),
        'rich_thorium_chunk': placed_ore('longhaul:rich_thorium_vein', {'type': 'minecraft:rarity_filter', 'chance': 128}, height_uniform(20, 120), count_after=14),
        'rich_tin_chunk': placed_ore('longhaul:rich_tin_vein', {'type': 'minecraft:rarity_filter', 'chance': 84}, height_uniform(-24, 80), count_after=20),
        'rich_sulfur_chunk': placed_ore('longhaul:rich_sulfur_vein', {'type': 'minecraft:rarity_filter', 'chance': 112}, height_uniform(-64, 24), count_after=18),
        'rich_rock_salt_chunk': placed_ore('primalmagick:ore_rock_salt', {'type': 'minecraft:rarity_filter', 'chance': 96}, height_uniform(8, 128), count_after=18),
        'rich_quartz_chunk': placed_ore('primalmagick:ore_quartz', {'type': 'minecraft:rarity_filter', 'chance': 96}, height_uniform(0, 128), count_after=18),
    }
    for name, obj in rich_chunks.items():
        write_json(lh_pf / f'{name}.json', obj)

    write_json(lh_bm / 'add_rich_ore_chunks.json', {
        'type': 'forge:add_features',
        'biomes': '#minecraft:is_overworld',
        'features': [f'longhaul:{k}' for k in rich_chunks.keys()],
        'step': 'underground_ores',
    })

    # 5. Floating sky-island refuge structures above the seasonal toxic gas ceiling (Y=210..260)
    lh_wg = DATA / 'longhaul/worldgen'
    write_json(lh_wg / 'template_pool/sky_refuges.json', {
        'fallback': 'minecraft:empty',
        'elements': [
            {
                'weight': 2,
                'element': {
                    'element_type': 'minecraft:single_pool_element',
                    'location': 'longhaul:sky_islands/sky_refuge_camp',
                    'projection': 'rigid',
                    'processors': 'minecraft:empty',
                },
            },
            {
                'weight': 1,
                'element': {
                    'element_type': 'minecraft:single_pool_element',
                    'location': 'longhaul:sky_islands/sky_beacon_isle',
                    'projection': 'rigid',
                    'processors': 'minecraft:empty',
                },
            },
        ],
    })
    write_json(lh_wg / 'structure/sky_refuges.json', {
        'type': 'minecraft:jigsaw',
        'biomes': '#minecraft:is_overworld',
        'step': 'surface_structures',
        'spawn_overrides': {},
        'terrain_adaptation': 'none',
        'start_pool': 'longhaul:sky_refuges',
        'size': 1,
        'start_height': {
            'type': 'minecraft:uniform',
            'min_inclusive': {'absolute': 210},
            'max_inclusive': {'absolute': 260},
        },
        'max_distance_from_center': 80,
        'use_expansion_hack': False,
    })
    write_json(lh_wg / 'structure_set/sky_refuges.json', {
        'structures': [{'structure': 'longhaul:sky_refuges', 'weight': 1}],
        'placement': {
            'type': 'minecraft:random_spread',
            'salt': 20941751,
            'spacing': 28,
            'separation': 12,
        },
    })

    # 6. Boosted canyon carvers for dramatic gorges and mountain valleys across expanded height
    mc_carver = DATA / 'minecraft/worldgen/configured_carver'
    write_json(mc_carver / 'canyon.json', {
        'type': 'minecraft:canyon',
        'config': {
            'debug_settings': {
                'air_state': {'Name': 'minecraft:warped_button', 'Properties': {'face': 'wall', 'facing': 'north', 'powered': 'false'}},
                'barrier_state': {'Name': 'minecraft:glass'},
                'lava_state': {'Name': 'minecraft:orange_stained_glass'},
                'water_state': {'Name': 'minecraft:candle', 'Properties': {'candles': '1', 'lit': 'false', 'waterlogged': 'false'}},
            },
            'lava_level': {'above_bottom': 8},
            'probability': 0.032,
            'replaceable': '#minecraft:overworld_carver_replaceables',
            'shape': {
                'distance_factor': {'type': 'minecraft:uniform', 'value': {'max_exclusive': 1.15, 'min_inclusive': 0.75}},
                'horizontal_radius_factor': {'type': 'minecraft:uniform', 'value': {'max_exclusive': 1.35, 'min_inclusive': 0.85}},
                'thickness': {'type': 'minecraft:trapezoid', 'value': {'max': 6.0, 'min': 0.0, 'plateau': 2.0}},
                'vertical_radius_center_factor': 0.0,
                'vertical_radius_default_factor': 1.0,
                'width_smoothness': 3,
            },
            'vertical_rotation': {'type': 'minecraft:uniform', 'value': {'max_exclusive': 0.14, 'min_inclusive': -0.14}},
            'y': {'type': 'minecraft:uniform', 'min_inclusive': {'absolute': -16}, 'max_inclusive': {'absolute': 120}},
            'yScale': 3.5,
        },
    })
    print(
        f'Generated {len(vanilla_overrides)} vanilla + {len(create_overrides) + len(ie_overrides) + len(pm_overrides)} modded ore overrides, '
        f'{len(modded_veins)} custom ore veins, {len(rich_chunks)} rare mono-ore rich chunks, floating sky-island refuges, and boosted canyon carvers.'
    )


if __name__ == '__main__':
    main()
