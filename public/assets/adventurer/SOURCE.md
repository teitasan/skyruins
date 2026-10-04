# Skyruins adventurer

Adapted in Blender 5.2.0 LTS, 2026-10-04, from the already-bundled KayKit Adventurers Character Pack 1.0 `Rogue.glb` (CC0 1.0).
Original: https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0
Pinned source commit: 672074b73ba276876a19e8816ecdc5241817ab47.
Original license: `public/assets/kaykit/LICENSE.txt`.

The body, facial geometry, skin atlas, skeleton and seven animations are retained.
Green clothing is remapped to blue fabric and leather; old rogue hair, earrings, weapons and cape are omitted.
Layered brown hair, red scarf and small travel pack are project-authored additions bound to the original head/chest bones.
No source bitmap is edited. No user Blender scene is modified.

Editable source: `art/blender/adventurer-source.blend`.
Builder: `art/blender/build_hero_goal.py`, run with Blender `--background --factory-startup --python`.

Candidates compared before adapting the model:
- KayKit Adventurers 2.0 (CC0 game-ready models), https://kaylousberg.itch.io/kaykit-adventurers : alternate models still require appearance changes; retaining the existing rig avoids changing tested movement.
- Existing KayKit Knight/Mage/Barbarian/Rogue_Hooded (CC0): armor, robe or hood do not match the brown-haired scarf-wearing adventurer reference.
- Quaternius Ultimate Animated Character Pack (CC0), https://quaternius.com/packs/ultimatedanimatedcharacter.html : human base characters need new clothing and a different animation pipeline; the existing compatible KayKit rig is preferable.
