# Skyruins exit gate

Adapted in Blender 5.2.0 LTS, 2026-10-04, from the already-bundled Kenney Castle Kit `tower-square-arch.glb` (CC0 1.0).
Source: https://kenney.nl/assets/castle-kit
Original license: `public/assets/castle/LICENSE.txt`.

The original arch is reshaped to an exit landmark with carved plinths, rune plates, gold collars and a blue keystone crystal.
Additional solid details are project-authored. Runtime materials reuse the bundled Poly Haven mossy stone textures (CC0); Three.js (MIT) provides the portal outline, translucent fill and drifting particles.
Model dimensions and ground origin are preserved. The landmark center matches the original goal trigger; gameplay controls, collision grid and boss-clear requirement are retained.

Editable source: `art/blender/exit-gate-source.blend`.
Builder: `art/blender/build_hero_goal.py`, run with Blender `--background --factory-startup --python`.
The builder uses an isolated factory-startup process and does not modify any user Blender scene.
Existing Kenney architecture was reused instead of creating a new arch mesh from scratch. The old Platformer Kit flag did not communicate a destination in the ruins setting.
