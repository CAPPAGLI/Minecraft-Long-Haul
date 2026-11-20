#!/usr/bin/env python3
"""Generate 1.20.1 worldgen ore rebalance overrides (10x reduction) and rare rich-ore chunks."""
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


def placed_ore(feature: str, first_filter: dict, hr: dict, count_after: int | None = None):
    placement = [first_filter]
    if count_after is not None:
        placement.append({'type': 'minecraft:count', 'count': count_after})
    placement.extend([
        {'type': 'minecraft:in_square'},
        hr,
        {'type': 'minecraft:biome'},
    ])
    return {'feature': feature, 'placement': placement}


def main():
    mc_pf = DATA / 'minecraft/worldgen/placed_feature'
    lh_pf = DATA / 'longhaul/worldgen/placed_feature'
    lh_bm = DATA / 'longhaul/forge/biome_modifier'

    # 1. Global ~10x reduction of vanilla Overworld ores (making coal/metals scarce outside rich chunks)
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

    # 2. Rare single-type ore motherlode chunks (1 in 64..160 chunks packed with one specific ore)
    rich_chunks = {
        'rich_coal_chunk': placed_ore('minecraft:ore_coal', {'type': 'minecraft:rarity_filter', 'chance': 64}, height_uniform(0, 160), count_after=32),
        'rich_iron_chunk': placed_ore('minecraft:ore_iron', {'type': 'minecraft:rarity_filter', 'chance': 72}, height_uniform(-32, 96), count_after=28),
        'rich_copper_chunk': placed_ore('minecraft:ore_copper_large', {'type': 'minecraft:rarity_filter', 'chance': 72}, height_uniform(-16, 112), count_after=24),
        'rich_gold_chunk': placed_ore('minecraft:ore_gold', {'type': 'minecraft:rarity_filter', 'chance': 96}, height_uniform(-64, 32), count_after=18),
        'rich_redstone_chunk': placed_ore('minecraft:ore_redstone', {'type': 'minecraft:rarity_filter', 'chance': 96}, height_uniform(-64, 16), count_after=18),
        'rich_diamond_chunk': placed_ore('minecraft:ore_diamond_large', {'type': 'minecraft:rarity_filter', 'chance': 160}, height_uniform(-64, 16), count_after=10),
    }
    for name, obj in rich_chunks.items():
        write_json(lh_pf / f'{name}.json', obj)

    write_json(lh_bm / 'add_rich_ore_chunks.json', {
        'type': 'forge:add_features',
        'biomes': '#minecraft:is_overworld',
        'features': [f'longhaul:{k}' for k in rich_chunks.keys()],
        'step': 'underground_ores',
    })

    # 3. Floating sky-island refuge structures above the seasonal toxic gas ceiling (Y=172..212)
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
            'min_inclusive': {'absolute': 172},
            'max_inclusive': {'absolute': 212},
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
    print(f'Generated {len(vanilla_overrides)} ore rebalance overrides, {len(rich_chunks)} rare rich-ore chunk features, and floating sky-island refuges.')


if __name__ == '__main__':
    main()
