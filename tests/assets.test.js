import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

async function glb(relative) {
  const bytes=await readFile(path.join(root,relative));
  return JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
}

const root = fileURLToPath(new URL('../public/', import.meta.url));
test('改修主人公の顔・装備は同じ骨格で動き、必要な7種のクリップを保持する', async () => {
  const model=await glb('assets/adventurer/hero-v1.glb');
  assert.equal(model.skins.length,1);
  const clips=new Set(model.animations.map(a=>a.name));
  for(const name of ['Idle','Walking_A','Jump_Idle','Jump_Land','1H_Ranged_Shooting','Death_A_Pose','Cheer'])assert.ok(clips.has(name),name);
  const head=model.nodes.findIndex(n=>n.name==='head'),chest=model.nodes.findIndex(n=>n.name==='chest');
  assert.ok(model.skins[0].joints.includes(head));assert.ok(model.skins[0].joints.includes(chest));
  for(const node of model.nodes.filter(n=>n.mesh!==undefined)){
    assert.equal(node.skin,0,`${node.name}: 改修パーツも骨格に追従する`);
    for(const primitive of model.meshes[node.mesh].primitives) {
      assert.ok(primitive.attributes.JOINTS_0!==undefined,node.name);
      assert.ok(primitive.attributes.WEIGHTS_0!==undefined,node.name);
    }
  }
  const materials=new Set(model.materials.map(m=>m.name));
  for(const name of ['rogue_texture','hero_hair','hero_scarf','hero_tunic'])assert.ok(materials.has(name));
});

test('出口モデルには石門と発光ルーンがあり外部ファイルに依存しない', async () => {
  const model=await glb('assets/landmarks/exit-gate-v1.glb');
  assert.ok(model.materials.some(m=>m.name==='goal_rune'));
  assert.ok(model.nodes.some(n=>n.name==='CC0 ancient arch'));
  assert.ok(model.buffers.every(b=>!b.uri));
});
test('収録素材は記録したサイズとSHA-256に一致する', async () => {
  const manifest = JSON.parse(await readFile(path.join(root,'assets/manifest.json'),'utf8'));
  assert.ok(manifest.some(item=>item.path==='assets/scenery/skyruins-valley-v1.png'));
  for(const item of manifest) {
    const bytes=await readFile(path.join(root,item.path));
    assert.equal(bytes.length,item.bytes,item.path);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),item.sha256,item.path);
  }
});

test('GLB/glTFの外部テクスチャとバッファがすべて同梱されている', async () => {
  const manifest = JSON.parse(await readFile(path.join(root,'assets/manifest.json'),'utf8'));
  for(const item of manifest.filter(item=>/\.(gltf|glb)$/.test(item.path))) {
    const file=path.join(root,item.path),bytes=await readFile(file);
    const text=item.path.endsWith('.gltf')?bytes.toString():bytes.subarray(20,20+bytes.readUInt32LE(12)).toString();
    const gltf=JSON.parse(text);
    for(const resource of [...(gltf.images||[]),...(gltf.buffers||[])]) {
      if(!resource.uri || resource.uri.startsWith('data:')) continue;
      assert.ok(!resource.uri.startsWith('http'),`${item.path}: 実行時に外部配信に依存しない`);
      await access(path.resolve(path.dirname(file),decodeURIComponent(resource.uri)));
    }
  }
  await access(path.join(root,'assets/nature/LICENSE.txt'));
  await access(path.join(root,'assets/surfaces/LICENSE.txt'));
  await access(path.join(root,'licenses/bootstrap-icons-LICENSE.txt'));
});
