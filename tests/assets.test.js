import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../public/', import.meta.url));
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
