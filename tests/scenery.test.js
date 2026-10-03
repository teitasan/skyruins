import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {surfaceSpans,buildScenery} from '../src/scenery.js';

test('橋の区間は穴や段差をまたがず、衝突する表面を重複なく覆う',()=>{
  const grid=['....BBBB..............','##..BBBB...-----......','##......#####..#######','##......#####..#######'].map(row=>[...row]);
  const level={grid,w:grid[0].length},counts=new Map();
  for(const s of surfaceSpans(level)) {
    assert.ok(s.width>=1&&s.width<=12);
    for(let x=s.x;x<s.x+s.width;x++) counts.set(`${x},${s.y}`,(counts.get(`${x},${s.y}`)||0)+1);
  }
  const solid=tile=>tile==='#'||tile==='B';
  for(let y=0;y<grid.length;y++) for(let x=0;x<level.w;x++) {
    const exposed=(solid(grid[y][x])&&!solid(grid[y-1]?.[x]))||grid[y][x]==='-';
    assert.equal(counts.get(`${x},${y}`)||0,exposed?1:0,`${x},${y}`);
  }
  for(const width of [13,24,25,45]) {
    const spans=surfaceSpans({grid:[Array(width).fill('#')],w:width});
    assert.equal(spans.reduce((sum,s)=>sum+s.width,0),width);
    assert.ok(spans.every(s=>s.width<=12));
  }
});

test('Blenderの橋は着地面より上に突き出さず、背景岩盤は60m下まで続く',async()=>{
  for(let n=1;n<=12;n++) {
    const bytes=await readFile(new URL(`../public/assets/ruins/bridge-${String(n).padStart(2,'0')}.glb`,import.meta.url));
    const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
    const bounds=gltf.meshes.flatMap(m=>m.primitives.map(p=>gltf.accessors[p.attributes.POSITION]));
    assert.ok(bounds.every(b=>b.max[1]<=.001),`bridge ${n}: top`);
    assert.ok(bounds.every(b=>b.min[0]>=-n/2-.1 && b.max[0]<=n/2+.1),`bridge ${n}: gap boundary`);
  }
  const bytes=await readFile(new URL('../public/assets/ruins/cliff-skirt.glb',import.meta.url));
  const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
  assert.ok(gltf.accessors.some(a=>a.min?.[1]<-59));
  const mesaBytes=await readFile(new URL('../public/assets/ruins/mesa.glb',import.meta.url));
  const mesa=JSON.parse(mesaBytes.subarray(20,20+mesaBytes.readUInt32LE(12)).toString());
  assert.ok(mesa.accessors.some(a=>a.min?.[1]<=-60));
  const placements=[];
  buildScenery({grid:[['#']],w:1},(key,position,scale)=>{placements.push({key,position,scale});return {rotation:{z:0}};});
  for(const p of placements.filter(p=>p.key==='cliffSkirt')) assert.ok(p.position[1]-60*p.scale[1]<-60);
});
