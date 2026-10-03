# Blender ruins geometry

Created for Skyruins with Blender 5.2.0 LTS, 2026-10-03.
Editable source: `art/blender/ruins-source.blend`.
Reproducible builder: `art/blender/build_ruins.py` (run with `Blender --background --factory-startup --python ...`).

The irregular paving reuses and reshapes Kenney Platformer Kit 4.1 `brick.glb` geometry (CC0 1.0):
https://kenney.nl/assets/platformer-kit
Original license remains at `public/assets/platformer/LICENSE.txt`.
Continuous arch foundations, arch stones, moss silhouettes and the deep cliff mesh are project-authored geometry.
`mesa.glb` reshapes Quaternius Stylized Nature MegaKit Standard `Rock_Medium_1` (CC0 1.0).
Its original upper silhouette is retained; lower vertices are extended to 60m below the summit.
Original source/license: `public/assets/nature/SOURCE.json` and `public/assets/nature/LICENSE.txt`.
The glTF files retain their authored dimensions and top origin; they must not be normalized to a unit cube.
The runtime reuses the already-bundled Poly Haven stone/rock textures; source and licenses are in ASSET_CREDITS.md.

Existing candidates compared:
- Kenney Castle Kit (CC0): reusable supports, but the small repeated meshes leave obvious tile outlines.
- JamesWhite Stone Bridge (CC0), https://opengameart.org/content/stone-bridge-0 : downloaded and inspected in Blender;
  a small handrail bridge with a single central support, unsuitable for worn continuous arch spans. Not redistributed.
- KHORNE Big Stone Bridge (CC0), https://opengameart.org/content/big-stone-bridge : a high-poly 47.1 MB source pack;
  excessive for a lightweight side-scroller and lacks direct matching to arbitrary collision-grid spans.
- Quaternius Ultimate Modular Ruins (CC0), https://quaternius.com/packs/ultimatemodularruins.html : modular room/ruin architecture;
  no continuous bridge with the required flat collision top and configurable span lengths.

Bridge deck origins are y=0 with all visible paving below the collision plane.
Widths 1–12 match contiguous surfaces; holes and height changes retain their original collision boundaries.
Cliff skirts extend 60m below the upper ledge, beyond the camera's gameplay range.
No user Blender scene is modified: the builder runs in an isolated factory-startup background process.
