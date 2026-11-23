"""Generate Long Haul Legacy 2.0 Heracles quests (4,600-4,800 quests across 62 chapters) and KubeJS catalog."""
from quest_chapters.common import (
    GENERATED_QUESTS,
    GROUP_ORDER,
    O,
    reset_registry,
)
from quest_chapters.ch_core import build_core_chapters
from quest_chapters.ch_expansion import build_expansion_chapters


def validate_all():
    missing_deps = []
    empty_rewards = []
    for qid, q in GENERATED_QUESTS.items():
        for dep in q.get('dependencies', []):
            if dep not in GENERATED_QUESTS:
                missing_deps.append((qid, dep))
        if not q.get('rewards'):
            empty_rewards.append(qid)
    if missing_deps:
        raise RuntimeError(f'Dangling dependencies: {missing_deps[:10]}')
    if empty_rewards:
        raise RuntimeError(f'Quests missing rewards: {empty_rewards[:10]}')


def main():
    reset_registry()
    catalog_count = build_core_chapters()
    core_count = len(GENERATED_QUESTS)
    exp_count = build_expansion_chapters()
    validate_all()

    # Sort groups numerically by leading "NN · ..." prefix
    ordered_groups = sorted(GROUP_ORDER, key=lambda g: (int(g.split(' ')[0]) if g[:2].isdigit() else 999, g))
    (O / 'config/heracles/groups.txt').write_text('\n'.join(ordered_groups) + '\n')

    total = len(GENERATED_QUESTS)
    print(f'Generated {total} Heracles quests ({core_count} core + {exp_count} expansion), {catalog_count} catalog quests, {len(ordered_groups)} groups.')


if __name__ == '__main__':
    main()
