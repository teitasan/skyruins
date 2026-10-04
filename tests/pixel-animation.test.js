import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createPixelAnimator} from '../src/pixel-animation.js';

const root=new URL('../public/assets/witch-pixel/',import.meta.url);
const data=JSON.parse(await readFile(new URL('animations.json',root),'utf8'));
const player=()=>({onGround:true,vx:0,vy:0,face:1,land:0});

test('待機・8コマ歩行・ダッシュは速度と向きに従う',()=>{
  const a=createPixelAnimator(data),p=player();
  assert.deepEqual(a.update(p,0),{animation:'idle',index:0,face:1});
  p.vx=1.25;
  const frames=new Set();
  for(let tick=1;tick<=60;tick++){
    const pose=a.update(p,tick);assert.equal(pose.animation,'walk');frames.add(pose.index);
  }
  assert.equal(frames.size,8);
  p.vx=-1.9375;p.face=-1;
  assert.equal(a.update(p,61).animation,'dash');assert.equal(a.update(p,62).face,-1);
  p.vx=0;assert.equal(a.update(p,63).animation,'idle');
});

test('離陸・上昇・頂点・下降・着地でジャンプのポーズが切り替わる',()=>{
  const a=createPixelAnimator(data),p=player();a.update(p,0);
  p.onGround=false;p.vy=-3;
  assert.equal(a.update(p,1).index,1);assert.equal(a.update(p,8).index,2);
  p.vy=-.2;assert.deepEqual(a.update(p,25),{animation:'jump',index:3,face:1});
  p.vy=2;assert.equal(a.update(p,40).index,4);
  p.onGround=true;p.land=8;assert.equal(a.update(p,60).index,5);
  p.land=0;assert.equal(a.update(p,68).animation,'idle');
});

test('描画回数に依存せず、停止とヒットストップ中はコマが進まない',()=>{
  const p=player();p.vx=1.25;
  const a=createPixelAnimator(data),b=createPixelAnimator(data);
  a.update(p,0);b.update(p,0);
  for(let tick=1;tick<=48;tick++){
    a.update(p,tick);
    for(const fraction of [0,.25,.5,.75,1])b.update(p,tick-1+fraction);
  }
  const pose=a.update(p,48);
  assert.deepEqual(b.update(p,48),pose);
  for(let i=0;i<20;i++)assert.deepEqual(a.update(p,48,'pause'),pose);
  assert.deepEqual(a.update(p,47.4),pose);
  assert.deepEqual(a.update(p,48),pose);
  const fresh=player();fresh.vx=1.25;
  assert.equal(a.update(fresh,0).index,0);
});

test('承認済みの原画像を保持し、参照する全コマはシート内に収まる',async()=>{
  for(const name of ['idle.png','witch-walk-v2.png','witch-motions-v1.png']){
    const installed=await readFile(new URL(name,root));
    const approved=await readFile(new URL(`../art/sprites/witch-v2/${name}`,import.meta.url));
    assert.deepEqual(installed,approved,name);
  }
  assert.equal(data.animations.walk.frames.length,8);
  for(const name of ['walk','dash','jump']){
    const seq=data.animations[name],size=data.meta.images[seq.image||data.meta.image];
    for(const {frame:f,durationMs} of seq.frames){
      assert.ok(f.x>=0&&f.y>=0&&f.x+f.w<=size.w&&f.y+f.h<=size.h,name);
      assert.ok(durationMs>0);
    }
  }
});
