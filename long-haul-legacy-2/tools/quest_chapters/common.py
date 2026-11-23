"""Shared Heracles 1.20.1 quest/advancement/reward builders & validators."""
import json
import pathlib

R = pathlib.Path(__file__).resolve().parents[2]
O = R / 'overrides'
Q = O / 'config/heracles/quests'
ADV_ROOT = O / 'kubejs/data/longhaul/advancements'

BANNED_ITEM_SUBSTRINGS = (
    'shulker',
    'ender_chest',
    'ender_drawer',
    'jetpack',
    'dislocator',
    'supplementaries:sack',
    'supplementaries:safe',
    'quark:backpack',
    'allthemodium',
    'vibranium',
    'unobtainium',
    'spawn_egg',
)

# Registry populated during generation for strict validation
GENERATED_QUESTS = {}
GROUP_ORDER = []
GROUP_COORDS = {}


def reset_registry():
    Q.mkdir(parents=True, exist_ok=True)
    for old in Q.glob('*.json'):
        old.unlink()
    if ADV_ROOT.exists():
        for old in ADV_ROOT.rglob('*.json'):
            old.unlink()
    GENERATED_QUESTS.clear()
    GROUP_ORDER.clear()
    GROUP_COORDS.clear()


def register_group(group_name: str):
    if group_name not in GROUP_ORDER:
        GROUP_ORDER.append(group_name)


def assert_not_banned(item_id: str, context: str):
    low = item_id.lower()
    for bad in BANNED_ITEM_SUBSTRINGS:
        if bad in low:
            raise ValueError(f'Banned item {item_id!r} in {context}')


def put(p: pathlib.Path, obj, compact: bool = False):
    p.parent.mkdir(parents=True, exist_ok=True)
    if compact:
        p.write_text(json.dumps(obj, ensure_ascii=False, separators=(',', ':')) + '\n')
    else:
        p.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + '\n')


def adv(rel_path: str, xp: int = 15):
    put(ADV_ROOT / (rel_path + '.json'), {
        'criteria': {'server_verified': {'trigger': 'minecraft:impossible'}},
        'rewards': {'experience': xp},
    })


def r_xp(amount: int, xp_type: str = 'POINTS') -> dict:
    return {'type': 'heracles:xp', 'xptype': xp_type, 'amount': int(amount)}


def r_item(item_id: str, count: int = 1) -> dict:
    assert_not_banned(item_id, 'reward')
    return {'type': 'heracles:item', 'item': {'id': item_id, 'count': int(count)}}


def r_choice(options: list, amount: int = 1, title: str = 'Награда на выбор') -> dict:
    rewards_map = {}
    for idx, (item_id, count) in enumerate(options):
        assert_not_banned(item_id, 'selectable_reward')
        rewards_map[f'opt_{idx}'] = r_item(item_id, count)
    return {
        'type': 'heracles:selectable',
        'title': title,
        'amount': int(amount),
        'rewards': rewards_map,
    }


def tier_rewards(tier: int, seed_idx: int = 0, bonus_item=None) -> dict:
    """Balanced pack-friendly rewards by progression tier (1=early, 2=mid, 3=adv, 4=endgame)."""
    rewards = {}
    if tier <= 1:
        rewards['xp'] = r_xp(35 + (seed_idx % 4) * 15, 'POINTS')
        early_pool = [
            [('minecraft:bread', 4), ('minecraft:torch', 16), ('minecraft:coal', 6)],
            [('minecraft:iron_ingot', 3), ('minecraft:copper_ingot', 6), ('minecraft:oak_log', 12)],
            [('minecraft:cooked_beef', 3), ('minecraft:leather', 4), ('minecraft:redstone', 6)],
            [('create:andesite_alloy', 4), ('minecraft:iron_nugget', 12), ('minecraft:baked_potato', 6)],
        ]
        if bonus_item:
            rewards['item'] = r_item(bonus_item[0], bonus_item[1])
        else:
            rewards['choice'] = r_choice(early_pool[seed_idx % len(early_pool)], 1, 'Полевой паёк или ресурсы')
    elif tier == 2:
        rewards['xp'] = r_xp(1, 'LEVEL')
        mid_pool = [
            [('create:andesite_alloy', 8), ('minecraft:iron_ingot', 5), ('minecraft:coal', 12)],
            [('create:brass_ingot', 3), ('minecraft:copper_ingot', 8), ('minecraft:gold_ingot', 3)],
            [('farmersdelight:beef_stew', 2), ('minecraft:redstone', 12), ('minecraft:quartz', 6)],
            [('longhaul:treated_timber', 2), ('longhaul:field_rations', 2), ('minecraft:lapis_lazuli', 8)],
        ]
        if bonus_item:
            rewards['item'] = r_item(bonus_item[0], bonus_item[1])
        else:
            rewards['choice'] = r_choice(mid_pool[seed_idx % len(mid_pool)], 1, 'Промышленное снабжение')
    elif tier == 3:
        rewards['xp'] = r_xp(2, 'LEVEL')
        adv_pool = [
            [('minecraft:diamond', 2), ('create:brass_ingot', 6), ('immersiveengineering:ingot_steel', 4)],
            [('longhaul:ore_concentrate', 2), ('longhaul:technical_glass', 2), ('minecraft:amethyst_shard', 8)],
            [('minecraft:gold_ingot', 6), ('minecraft:ender_pearl', 2), ('minecraft:blaze_powder', 4)],
            [('longhaul:machine_parts', 2), ('longhaul:technical_oil', 2), ('minecraft:golden_apple', 1)],
        ]
        if bonus_item:
            rewards['item'] = r_item(bonus_item[0], bonus_item[1])
        else:
            rewards['choice'] = r_choice(adv_pool[seed_idx % len(adv_pool)], 1, 'Снабжение высокого тира')
    else:
        rewards['xp'] = r_xp(4 + (seed_idx % 2), 'LEVEL')
        end_pool = [
            [('minecraft:netherite_scrap', 2), ('minecraft:diamond', 4), ('minecraft:golden_apple', 2)],
            [('minecraft:totem_of_undying', 1), ('minecraft:enchanted_golden_apple', 1), ('longhaul:field_rations', 4)],
            [('longhaul:machine_parts', 4), ('longhaul:refractory_mix', 4), ('minecraft:emerald', 8)],
        ]
        if bonus_item:
            rewards['item'] = r_item(bonus_item[0], bonus_item[1])
        else:
            rewards['choice'] = r_choice(end_pool[seed_idx % len(end_pool)], 1, 'Премиальная награда консорциума')
    return rewards


def t_item(item_id: str, amount: int = 1) -> dict:
    assert_not_banned(item_id, 'item_task')
    return {'item': {'type': 'heracles:item', 'item': item_id, 'amount': int(amount), 'collection': 'AUTOMATIC'}}


def t_check(title: str = 'Этап выполнен') -> dict:
    return {'check': {'type': 'heracles:check', 'title': title}}


def t_adv(adv_id: str, title: str) -> dict:
    return {'verified': {'type': 'heracles:advancement', 'title': title, 'advancements': [adv_id]}}


def t_kill(entity_type: str, amount: int = 5, title: str = '') -> dict:
    obj = {'type': 'heracles:kill_entity', 'entity': {'type': entity_type}, 'amount': int(amount)}
    if title:
        obj['title'] = title
    return {'kill': obj}


def t_dim(to_dim: str, title: str = '') -> dict:
    obj = {'type': 'heracles:changed_dimension', 'to': to_dim}
    if title:
        obj['title'] = title
    return {'dim': obj}


def quest(
    qid: str,
    title: str,
    group: str,
    pos,
    icon: str,
    tasks: dict,
    desc,
    deps=None,
    subtitle: str = 'Long Haul Legacy 2.0',
    rewards=None,
    compact: bool = True,
):
    if qid in GENERATED_QUESTS:
        raise ValueError(f'Duplicate quest ID: {qid}')
    assert_not_banned(icon, f'icon of {qid}')
    register_group(group)
    xy = (int(pos[0]), int(pos[1]))
    seen = GROUP_COORDS.setdefault(group, set())
    if xy in seen:
        raise ValueError(f'Duplicate coordinate {xy} in {group!r} for quest {qid!r}')
    seen.add(xy)

    for t in (tasks or {}).values():
        if t.get('type') == 'heracles:item' and t.get('item'):
            assert_not_banned(t['item'], f'task of {qid}')

    if not rewards:
        rewards = tier_rewards(1, len(GENERATED_QUESTS))

    obj = {
        'dependencies': list(deps or []),
        'tasks': tasks,
        'rewards': rewards,
        'display': {
            'title': {'text': title},
            'subtitle': {'text': subtitle},
            'description': desc if isinstance(desc, list) else [str(desc)],
            'groups': {group: {'position': [xy[0], xy[1]]}},
            'icon': {'type': 'heracles:item', 'item': {'id': icon, 'count': 1}},
            'icon_background': 'heracles:textures/gui/quest_backgrounds/default.png',
        },
        'settings': {
            'hidden': 'LOCKED',
            'showDependencyArrow': True,
            'individualProgress': True,
            'repeatable': False,
            'unlockNotification': True,
        },
    }
    GENERATED_QUESTS[qid] = obj
    put(Q / f'{qid}.json', obj, compact=compact)
    return qid


def add_item_lane_chapter(
    prefix: str,
    group: str,
    subtitle: str,
    lanes: list,
    root_quest_spec: tuple,
    tier: int = 2,
    dx: int = 100,
    dy: int = 92,
):
    """Build a clean multi-lane chapter with a root intro quest and horizontal progression tracks.
    lanes: list of (lane_title_prefix, [(item_id, ru_title, ru_desc, amount, reward_tuple_or_None), ...])
    """
    r_id, r_title, r_icon, r_desc, r_deps, r_rew = root_quest_spec
    mid_y = round(((len(lanes) - 1) / 2.0) * dy)
    quest(
        r_id, r_title, group, [-dx, mid_y], r_icon,
        t_check('Введение изучено'), r_desc,
        deps=r_deps, subtitle=subtitle, rewards=r_rew,
    )
    count = 1
    for row_idx, (lane_name, entries) in enumerate(lanes):
        prev_id = r_id
        y = row_idx * dy
        for col_idx, entry in enumerate(entries):
            item_id, q_title, q_desc, amt, rew = entry
            qid = f'{prefix}_{row_idx:02d}_{col_idx:02d}'
            x = col_idx * dx
            if rew is None:
                rew = tier_rewards(tier, count + col_idx)
            quest(
                qid,
                q_title,
                group,
                [x, y],
                item_id,
                t_item(item_id, amt),
                q_desc if isinstance(q_desc, list) else [q_desc],
                deps=[prev_id],
                subtitle=f'{subtitle} · {lane_name}',
                rewards=rew,
            )
            prev_id = qid
            count += 1
    return count
