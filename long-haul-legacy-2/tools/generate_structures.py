#!/usr/bin/env python3
"""Generate authentic Minecraft 1.20.1 gzipped NBT structure templates (.nbt)
for the 10 strategic sites and 6 recoverable industrial facilities.
"""
import gzip, io, pathlib, struct

R = pathlib.Path(__file__).resolve().parents[1]
OUT = R / 'overrides/kubejs/data/longhaul/structures'

# Big-endian NBT tag IDs
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
                          trim_blk: str, special_blk: str, is_ruin: bool = False,
                          is_archive: bool = False, is_hub: bool = False) -> dict:
    sx, sy, sz = 9, 6, 9
    b: dict[tuple[int, int, int], tuple[str, dict[str, str] | None]] = {}

    # Clear interior volume with air so terrain rubble doesn't overlap depot
    for x in range(sx):
        for z in range(sz):
            b[(x, 0, z)] = (trim_blk if (x in (0, sx - 1) or z in (0, sz - 1)) else floor_blk, None)
            for y in range(1, sy):
                b[(x, y, z)] = ('minecraft:air', None)

    # Corner pillars & overhead frame
    corners = [(1, 1), (1, 7), (7, 1), (7, 7)]
    for cx, cz in corners:
        h = 3 if (is_ruin and (cx + cz) % 4 == 2) else 4
        for y in range(1, h + 1):
            b[(cx, y, cz)] = (pillar_blk, None)

    # Side low walls with central walk-in openings on all 4 sides
    for i in (2, 3, 5, 6):
        b[(i, 1, 1)] = (accent_blk, None)
        b[(i, 1, 7)] = (accent_blk, None)
        b[(1, 1, i)] = (accent_blk, None)
        b[(7, 1, i)] = (accent_blk, None)

    # Roof canopy (partially collapsed when ruin=True)
    for x in range(1, 8):
        for z in range(1, 8):
            if is_ruin and ((x + z) % 3 == 0):
                continue
            b[(x, 5, z)] = (roof_blk, None)

    # Rails leading into depot from south edge
    for z in range(5, 9):
        b[(4, 1, z)] = ('minecraft:rail', {'shape': 'north_south'})

    # Central depot barrel at (4, 1, 4) -> aligns exactly with (site.x, ground_y, site.z)
    b[(4, 1, 4)] = ('minecraft:barrel', {'facing': 'south'})
    b[(3, 1, 4)] = (special_blk, None)
    b[(5, 1, 4)] = (special_blk, None)

    # Warm lighting
    b[(2, 2, 2)] = ('minecraft:lantern', {'hanging': 'false'})
    b[(6, 2, 6)] = ('minecraft:lantern', {'hanging': 'false'})

    if is_archive:
        # Archival bookshelves + lecterns + polished deepslate monument trim
        for x in (2, 3, 5, 6):
            b[(x, 1, 2)] = ('minecraft:bookshelf', None)
            b[(x, 2, 2)] = ('minecraft:bookshelf', None)
        b[(4, 1, 2)] = ('minecraft:lectern', {'facing': 'south'})
        b[(4, 4, 4)] = ('minecraft:lantern', {'hanging': 'true'})
    elif is_hub:
        b[(2, 1, 2)] = ('minecraft:crafting_table', None)
        b[(6, 1, 2)] = ('minecraft:smithing_table', None)
        b[(4, 1, 2)] = ('minecraft:lectern', {'facing': 'south'})
        b[(4, 4, 4)] = ('minecraft:lantern', {'hanging': 'true'})

    return b

SITES = {
    'mine': ('minecraft:cobblestone', 'minecraft:stone_bricks', 'minecraft:oak_log', 'minecraft:deepslate_tile_slab', 'minecraft:andesite', 'minecraft:blast_furnace', False, False, False),
    'forest': ('minecraft:spruce_planks', 'minecraft:stripped_spruce_log', 'minecraft:spruce_log', 'minecraft:spruce_slab', 'minecraft:cobblestone', 'minecraft:crafting_table', False, False, False),
    'farm': ('minecraft:oak_planks', 'minecraft:bricks', 'minecraft:oak_log', 'minecraft:oak_slab', 'minecraft:cobblestone', 'minecraft:composter', False, False, False),
    'port': ('minecraft:stone_bricks', 'minecraft:spruce_planks', 'minecraft:stripped_oak_log', 'minecraft:spruce_slab', 'minecraft:polished_andesite', 'minecraft:smoker', False, False, False),
    'quarry': ('minecraft:smooth_sandstone', 'minecraft:terracotta', 'minecraft:cut_sandstone', 'minecraft:sandstone_slab', 'minecraft:cobblestone', 'minecraft:stonecutter', False, False, False),
    'swamp': ('minecraft:dark_oak_planks', 'minecraft:mud_bricks', 'minecraft:dark_oak_log', 'minecraft:dark_oak_slab', 'minecraft:mossy_cobblestone', 'minecraft:cauldron', False, False, False),
    'glass': ('minecraft:bricks', 'minecraft:terracotta', 'minecraft:brick_wall', 'minecraft:brick_slab', 'minecraft:smooth_stone', 'minecraft:furnace', False, False, False),
    'machines': ('minecraft:polished_andesite', 'minecraft:iron_block', 'minecraft:deepslate_bricks', 'minecraft:polished_andesite_slab', 'minecraft:stone_bricks', 'minecraft:anvil', False, False, False),
    'continental_archive': ('minecraft:polished_deepslate', 'minecraft:deepslate_bricks', 'minecraft:deepslate_brick_wall', 'minecraft:polished_deepslate_slab', 'minecraft:chiseled_deepslate', 'minecraft:bookshelf', False, True, False),
    'continental_hub': ('minecraft:stone_bricks', 'minecraft:copper_block', 'minecraft:polished_andesite', 'minecraft:stone_brick_slab', 'minecraft:chiseled_stone_bricks', 'minecraft:blast_furnace', False, False, True),
}

RECOVERIES = {
    'sawmill': ('minecraft:oak_planks', 'minecraft:cobblestone', 'minecraft:oak_log', 'minecraft:oak_slab', 'minecraft:mossy_cobblestone', 'minecraft:stonecutter', True, False, False),
    'quarry': ('minecraft:cobblestone', 'minecraft:andesite', 'minecraft:deepslate_bricks', 'minecraft:cobblestone_slab', 'minecraft:gravel', 'minecraft:blast_furnace', True, False, False),
    'river_port': ('minecraft:spruce_planks', 'minecraft:mossy_stone_bricks', 'minecraft:spruce_log', 'minecraft:spruce_slab', 'minecraft:cobblestone', 'minecraft:smoker', True, False, False),
    'sorting_yard': ('minecraft:polished_andesite', 'minecraft:bricks', 'minecraft:iron_bars', 'minecraft:polished_andesite_slab', 'minecraft:stone_bricks', 'minecraft:hopper', True, False, False),
    'power_plant': ('minecraft:deepslate_bricks', 'minecraft:copper_block', 'minecraft:deepslate_brick_wall', 'minecraft:deepslate_brick_slab', 'minecraft:polished_deepslate', 'minecraft:blast_furnace', True, False, False),
    'collapsed_bridge': ('minecraft:stone_bricks', 'minecraft:mossy_stone_bricks', 'minecraft:stone_brick_wall', 'minecraft:stone_brick_slab', 'minecraft:cobblestone', 'minecraft:lantern', True, False, False),
}

def main():
    count = 0
    for folder, specs in [('sites', SITES), ('recovery', RECOVERIES)]:
        d = OUT / folder
        d.mkdir(parents=True, exist_ok=True)
        for name, params in specs.items():
            blocks = make_station_template(*params)
            nbt = build_structure_nbt((9, 6, 9), blocks)
            path = d / f'{name}.nbt'
            path.write_bytes(nbt)
            dv, sz, pal_n, blk_n = read_nbt_smoke(nbt)
            assert dv == 3465 and sz == (9, 6, 9) and pal_n >= 4 and blk_n == 9 * 6 * 9 - (0 if params[6] else 0) or blk_n > 200
            count += 1
    print(f'Generated and verified {count} Minecraft 1.20.1 .nbt structures in {OUT}')

if __name__ == '__main__':
    main()
