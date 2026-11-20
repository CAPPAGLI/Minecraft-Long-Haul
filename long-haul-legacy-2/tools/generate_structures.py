#!/usr/bin/env python3
"""Generate authentic Minecraft 1.20.1 gzipped NBT structure templates (.nbt)
for the 10 strategic sites and 6 recoverable industrial facilities (11x7x11).
Center depot barrel is always at (5, 1, 5) -> aligns with (site.x, padY + 1, site.z).
"""
import gzip, io, pathlib, struct

R = pathlib.Path(__file__).resolve().parents[1]
OUT = R / 'overrides/kubejs/data/longhaul/structures'

TAG_END = 0
TAG_INT = 3
TAG_STRING = 8
TAG_LIST = 9
TAG_COMPOUND = 10

def write_str(buf: io.BytesIO, s: str):
    b = s.encode('utf-8')
    buf.write(struct.pack('>H', len(b)))
    buf.write(b)

def write_tag(buf: io.BytesIO, tag_type: int, name: str | None, val):
    if name is not None:
        buf.write(struct.pack('>B', tag_type))
        write_str(buf, name)
    if tag_type == TAG_INT:
        buf.write(struct.pack('>i', int(val)))
    elif tag_type == TAG_STRING:
        write_str(buf, str(val))
    elif tag_type == TAG_LIST:
        elem_type, items = val
        buf.write(struct.pack('>Bi', elem_type, len(items)))
        for item in items:
            write_tag(buf, elem_type, None, item)
    elif tag_type == TAG_COMPOUND:
        for k, (vt, vv) in val.items():
            write_tag(buf, vt, k, vv)
        buf.write(struct.pack('>B', TAG_END))
    else:
        raise ValueError(f'Unsupported NBT tag type: {tag_type}')

def build_structure_nbt(size: tuple[int, int, int], blocks_map: dict[tuple[int, int, int], tuple[str, dict[str, str] | None]]) -> bytes:
    palette_index: dict[tuple[str, tuple[tuple[str, str], ...]], int] = {}
    palette_entries = []
    block_entries = []

    for pos in sorted(blocks_map.keys()):
        name, props = blocks_map[pos]
        props_key = tuple(sorted((props or {}).items()))
        key = (name, props_key)
        if key not in palette_index:
            palette_index[key] = len(palette_entries)
            comp = {'Name': (TAG_STRING, name)}
            if props_key:
                comp['Properties'] = (TAG_COMPOUND, {pk: (TAG_STRING, pv) for pk, pv in props_key})
            palette_entries.append(comp)
        idx = palette_index[key]
        block_entries.append({
            'pos': (TAG_LIST, (TAG_INT, [pos[0], pos[1], pos[2]])),
            'state': (TAG_INT, idx),
        })

    root = {
        'DataVersion': (TAG_INT, 3465),  # Minecraft 1.20.1
        'size': (TAG_LIST, (TAG_INT, [size[0], size[1], size[2]])),
        'palette': (TAG_LIST, (TAG_COMPOUND, palette_entries)),
        'blocks': (TAG_LIST, (TAG_COMPOUND, block_entries)),
        'entities': (TAG_LIST, (TAG_COMPOUND, [])),
    }
    raw = io.BytesIO()
    write_tag(raw, TAG_COMPOUND, '', root)
    out = io.BytesIO()
    with gzip.GzipFile(fileobj=out, mode='wb', mtime=0) as gz:
        gz.write(raw.getvalue())
    return out.getvalue()

def read_nbt_smoke(gz_bytes: bytes) -> tuple[int, tuple[int, int, int], int, int]:
    data = gzip.decompress(gz_bytes)
    pos = 0

    def rd_str():
        nonlocal pos
        (ln,) = struct.unpack_from('>H', data, pos)
        pos += 2
        s = data[pos:pos + ln].decode('utf-8')
        pos += ln
        return s

    def rd_val(t):
        nonlocal pos
        if t == TAG_INT:
            (v,) = struct.unpack_from('>i', data, pos)
            pos += 4
            return v
        if t == TAG_STRING:
            return rd_str()
        if t == TAG_LIST:
            et, cnt = struct.unpack_from('>Bi', data, pos)
            pos += 5
            return [rd_val(et) for _ in range(cnt)]
        if t == TAG_COMPOUND:
            obj = {}
            while True:
                nt = data[pos]
                pos += 1
                if nt == TAG_END:
                    return obj
                k = rd_str()
                obj[k] = rd_val(nt)
        raise ValueError(f'Unexpected tag {t}')

    rt = data[pos]
    pos += 1
    assert rt == TAG_COMPOUND
    _ = rd_str()
    root = rd_val(TAG_COMPOUND)
    assert pos == len(data)
    return root['DataVersion'], tuple(root['size']), len(root['palette']), len(root['blocks'])

def make_station_template(floor_blk: str, accent_blk: str, pillar_blk: str, roof_blk: str,
                          trim_blk: str, special_blk: str, role: str, is_ruin: bool = False) -> dict:
    sx, sy, sz = 11, 7, 11
    b: dict[tuple[int, int, int], tuple[str, dict[str, str] | None]] = {}

    # Platform floor & cleared air interior
    for x in range(sx):
        for z in range(sz):
            is_border = (x in (0, sx - 1) or z in (0, sz - 1))
            b[(x, 0, z)] = (trim_blk if is_border else floor_blk, None)
            for y in range(1, sy):
                b[(x, y, z)] = ('minecraft:air', None)

    # Corner pillars & mid-span supports
    corners = [(1, 1), (1, 9), (9, 1), (9, 9)]
    for cx, cz in corners:
        h = 3 if (is_ruin and (cx + cz) % 4 == 2) else 4
        for y in range(1, h + 1):
            b[(cx, y, cz)] = (pillar_blk, None)

    # Perimeter low walls with wide 3-block walk-in / rail entrances (x=4..6, z=4..6)
    for i in (2, 3, 7, 8):
        b[(i, 1, 1)] = (accent_blk, None)
        b[(i, 1, 9)] = (accent_blk, None)
        b[(1, 1, i)] = (accent_blk, None)
        b[(9, 1, i)] = (accent_blk, None)
        if not is_ruin and i in (2, 8):
            b[(i, 2, 1)] = ('minecraft:oak_fence' if 'oak' in pillar_blk else 'minecraft:iron_bars', None)
            b[(i, 2, 9)] = ('minecraft:oak_fence' if 'oak' in pillar_blk else 'minecraft:iron_bars', None)

    # Roof canopy (partially collapsed if is_ruin)
    for x in range(1, 10):
        for z in range(1, 10):
            if is_ruin and ((x * 3 + z) % 3 == 0 or x == 5):
                continue
            b[(x, 5, z)] = (roof_blk, None)

    # Incoming spur track from south gate to depot
    for z in range(6, 11):
        b[(5, 1, z)] = ('minecraft:rail', {'shape': 'north_south'})

    # Central depot barrel at (5, 1, 5) -> aligns with (site.x, padY + 1, site.z)
    b[(5, 1, 5)] = ('minecraft:barrel', {'facing': 'south'})
    b[(4, 1, 5)] = (special_blk, None)
    if not is_ruin:
        b[(6, 1, 5)] = (special_blk, None)

    # Base lighting
    b[(2, 2, 2)] = ('minecraft:lantern', {'hanging': 'false'})
    b[(8, 2, 8)] = ('minecraft:lantern', {'hanging': 'false'})
    if not is_ruin:
        b[(5, 4, 5)] = ('minecraft:lantern', {'hanging': 'true'})

    # Role-specific architectural landmarks
    if role == 'mine':
        # Timber mine headframe & hoist chain over depot
        for y in range(1, 6):
            b[(3, y, 3)] = ('minecraft:oak_log', None)
            b[(7, y, 3)] = ('minecraft:oak_log', None)
        for x in range(3, 8):
            b[(x, 5, 3)] = ('minecraft:cobblestone_wall', None)
        b[(5, 4, 3)] = ('minecraft:chain', {'axis': 'y'})
        b[(2, 1, 7)] = ('minecraft:raw_iron_block', None)
    elif role == 'forest':
        # Stacked timber stockpile & carpenter bench
        for x in (2, 3):
            b[(x, 1, 2)] = ('minecraft:spruce_log', {'axis': 'x'})
            b[(x, 1, 3)] = ('minecraft:spruce_log', {'axis': 'x'})
            b[(x, 2, 2)] = ('minecraft:spruce_log', {'axis': 'x'})
        b[(8, 1, 2)] = ('minecraft:stonecutter', None)
    elif role == 'farm':
        # Hayloft bales & enclosed irrigation basin in floor
        for x in (2, 3):
            b[(x, 1, 2)] = ('minecraft:hay_block', {'axis': 'y'})
        b[(2, 2, 2)] = ('minecraft:hay_block', {'axis': 'y'})
        b[(8, 0, 2)] = ('minecraft:water', {'level': '0'})
        b[(7, 0, 2)] = ('minecraft:farmland', {'moisture': '7'})
        b[(7, 1, 2)] = ('minecraft:wheat', {'age': '7'})
    elif role == 'port':
        # Coastal beacon tower on NE corner
        for y in range(1, 7):
            b[(8, y, 2)] = ('minecraft:stone_bricks', None)
        b[(8, 6, 2)] = ('minecraft:sea_lantern', None)
        b[(2, 1, 2)] = ('minecraft:barrel', {'facing': 'east'})
        b[(2, 1, 3)] = ('minecraft:barrel', {'facing': 'east'})
    elif role == 'quarry':
        # Quarry jib crane boom & terracotta stockpiles
        for y in range(1, 7):
            b[(2, y, 2)] = ('minecraft:cut_sandstone', None)
        for x in range(3, 7):
            b[(x, 6, 2)] = ('minecraft:oak_fence', None)
        b[(6, 5, 2)] = ('minecraft:chain', {'axis': 'y'})
        b[(8, 1, 2)] = ('minecraft:terracotta', None)
    elif role == 'swamp':
        # Elevated stilt chemical vats & tinted glass baffles
        for x in (2, 8):
            b[(x, 1, 2)] = ('minecraft:cauldron', None)
            b[(x, 1, 8)] = ('minecraft:cauldron', None)
        for x in range(3, 8):
            b[(x, 2, 2)] = ('minecraft:green_stained_glass', None)
    elif role == 'glass':
        # Tall brick furnace chimney
        for y in range(1, 7):
            b[(2, y, 2)] = ('minecraft:bricks', None)
            b[(3, y, 2)] = ('minecraft:bricks', None)
        b[(2, 6, 2)] = ('minecraft:campfire', {'lit': 'true'})
        b[(8, 1, 2)] = ('minecraft:glass', None)
        b[(8, 2, 2)] = ('minecraft:glass', None)
    elif role == 'machines':
        # Steel gantry & copper/iron assembly bay
        for x in range(2, 9):
            b[(x, 4, 2)] = ('minecraft:iron_bars', None)
        b[(2, 1, 2)] = ('minecraft:smithing_table', None)
        b[(8, 1, 2)] = ('minecraft:crafting_table', None)
        b[(5, 3, 2)] = ('minecraft:chain', {'axis': 'y'})
    elif role == 'continental_archive':
        # Monumental archive: bookshelf wings, twin lecterns, chandelier
        for x in (2, 3, 7, 8):
            b[(x, 1, 2)] = ('minecraft:bookshelf', None)
            b[(x, 2, 2)] = ('minecraft:bookshelf', None)
            b[(x, 3, 2)] = ('minecraft:bookshelf', None)
        b[(4, 1, 2)] = ('minecraft:lectern', {'facing': 'south'})
        b[(6, 1, 2)] = ('minecraft:lectern', {'facing': 'south'})
        b[(5, 1, 2)] = ('minecraft:chiseled_deepslate', None)
        b[(5, 2, 2)] = ('minecraft:lantern', {'hanging': 'false'})
        b[(5, 5, 5)] = ('minecraft:polished_deepslate', None)
    elif role == 'continental_hub':
        # Continental logistics dispatch arch
        for y in range(1, 6):
            b[(3, y, 2)] = ('minecraft:copper_block', None)
            b[(7, y, 2)] = ('minecraft:copper_block', None)
        for x in range(3, 8):
            b[(x, 6, 2)] = ('minecraft:cut_copper', None)
        b[(5, 1, 2)] = ('minecraft:lectern', {'facing': 'south'})
        b[(2, 1, 2)] = ('minecraft:crafting_table', None)
        b[(8, 1, 2)] = ('minecraft:smithing_table', None)
    elif role.startswith('ruin_'):
        # Overgrown / collapsed industrial ruin clues
        b[(2, 1, 2)] = ('minecraft:mossy_cobblestone', None)
        b[(8, 1, 2)] = ('minecraft:cobweb', None)
        b[(3, 2, 2)] = ('minecraft:chain', {'axis': 'y'})
        if role == 'ruin_bridge':
            for x in range(2, 9):
                b[(x, 0, 5)] = ('minecraft:stone_bricks', None)
                if x not in (4, 5, 6):
                    b[(x, 1, 4)] = ('minecraft:stone_brick_wall', None)
                    b[(x, 1, 6)] = ('minecraft:stone_brick_wall', None)

    return b

SITES = {
    'mine': ('minecraft:cobblestone', 'minecraft:stone_bricks', 'minecraft:oak_log', 'minecraft:deepslate_tile_slab', 'minecraft:andesite', 'minecraft:blast_furnace', 'mine', False),
    'forest': ('minecraft:spruce_planks', 'minecraft:stripped_spruce_log', 'minecraft:spruce_log', 'minecraft:spruce_slab', 'minecraft:cobblestone', 'minecraft:crafting_table', 'forest', False),
    'farm': ('minecraft:oak_planks', 'minecraft:bricks', 'minecraft:oak_log', 'minecraft:oak_slab', 'minecraft:cobblestone', 'minecraft:composter', 'farm', False),
    'port': ('minecraft:stone_bricks', 'minecraft:spruce_planks', 'minecraft:stripped_oak_log', 'minecraft:spruce_slab', 'minecraft:polished_andesite', 'minecraft:smoker', 'port', False),
    'quarry': ('minecraft:smooth_sandstone', 'minecraft:terracotta', 'minecraft:cut_sandstone', 'minecraft:sandstone_slab', 'minecraft:cobblestone', 'minecraft:stonecutter', 'quarry', False),
    'swamp': ('minecraft:dark_oak_planks', 'minecraft:mud_bricks', 'minecraft:dark_oak_log', 'minecraft:dark_oak_slab', 'minecraft:mossy_cobblestone', 'minecraft:cauldron', 'swamp', False),
    'glass': ('minecraft:bricks', 'minecraft:terracotta', 'minecraft:brick_wall', 'minecraft:brick_slab', 'minecraft:smooth_stone', 'minecraft:furnace', 'glass', False),
    'machines': ('minecraft:polished_andesite', 'minecraft:iron_block', 'minecraft:deepslate_bricks', 'minecraft:polished_andesite_slab', 'minecraft:stone_bricks', 'minecraft:anvil', 'machines', False),
    'continental_archive': ('minecraft:polished_deepslate', 'minecraft:deepslate_bricks', 'minecraft:deepslate_brick_wall', 'minecraft:polished_deepslate_slab', 'minecraft:chiseled_deepslate', 'minecraft:bookshelf', 'continental_archive', False),
    'continental_hub': ('minecraft:stone_bricks', 'minecraft:copper_block', 'minecraft:polished_andesite', 'minecraft:stone_brick_slab', 'minecraft:chiseled_stone_bricks', 'minecraft:blast_furnace', 'continental_hub', False),
}

RECOVERIES = {
    'sawmill': ('minecraft:oak_planks', 'minecraft:cobblestone', 'minecraft:oak_log', 'minecraft:oak_slab', 'minecraft:mossy_cobblestone', 'minecraft:stonecutter', 'ruin_sawmill', True),
    'quarry': ('minecraft:cobblestone', 'minecraft:andesite', 'minecraft:deepslate_bricks', 'minecraft:cobblestone_slab', 'minecraft:gravel', 'minecraft:blast_furnace', 'ruin_quarry', True),
    'river_port': ('minecraft:spruce_planks', 'minecraft:mossy_stone_bricks', 'minecraft:spruce_log', 'minecraft:spruce_slab', 'minecraft:cobblestone', 'minecraft:smoker', 'ruin_port', True),
    'sorting_yard': ('minecraft:polished_andesite', 'minecraft:bricks', 'minecraft:iron_bars', 'minecraft:polished_andesite_slab', 'minecraft:stone_bricks', 'minecraft:hopper', 'ruin_yard', True),
    'power_plant': ('minecraft:deepslate_bricks', 'minecraft:copper_block', 'minecraft:deepslate_brick_wall', 'minecraft:deepslate_brick_slab', 'minecraft:polished_deepslate', 'minecraft:blast_furnace', 'ruin_power', True),
    'collapsed_bridge': ('minecraft:stone_bricks', 'minecraft:mossy_stone_bricks', 'minecraft:stone_brick_wall', 'minecraft:stone_brick_slab', 'minecraft:cobblestone', 'minecraft:lantern', 'ruin_bridge', True),
}

def main():
    count = 0
    for folder, specs in [('sites', SITES), ('recovery', RECOVERIES)]:
        d = OUT / folder
        d.mkdir(parents=True, exist_ok=True)
        for name, params in specs.items():
            blocks = make_station_template(*params)
            nbt = build_structure_nbt((11, 7, 11), blocks)
            path = d / f'{name}.nbt'
            path.write_bytes(nbt)
            dv, sz, pal_n, blk_n = read_nbt_smoke(nbt)
            assert dv == 3465 and sz == (11, 7, 11) and pal_n >= 5 and blk_n > 500
            count += 1
    print(f'Generated and verified {count} Minecraft 1.20.1 11x7x11 .nbt structures in {OUT}')

if __name__ == '__main__':
    main()
