import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/game.js';
import { samplePosition } from '../src/render-motion.js';

function setup(saved = null, render = () => {}) {
  const elements = new Map();
  const makeElement = () => ({ style: { setProperty() {} }, classList: {add(){},remove(){}}, hidden:false,
    innerHTML:'', textContent:'', parentElement:{clientWidth:600}, querySelector(){return makeElement();},
    querySelectorAll(){return [];}, click(){this.onclick?.();}, addEventListener(){} });
  const events = new Map(); const data = new Map(); let frameCallback;
  if (saved) data.set('skyruins-v1', JSON.stringify(saved));
  globalThis.document = { body:makeElement(), activeElement:{blur(){}}, hidden:false,
    getElementById(id){if (!elements.has(id)) elements.set(id,makeElement());return elements.get(id);},
    querySelector(selector){return this.getElementById(selector);}, querySelectorAll(){return [];}, addEventListener(){} };
  globalThis.window = {};
  Object.defineProperty(globalThis,'navigator',{value:{getGamepads:()=>[]},configurable:true});
  globalThis.innerWidth = 1280; globalThis.innerHeight = 720;
  globalThis.matchMedia = () => ({matches:false});
  globalThis.localStorage = {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
  globalThis.addEventListener = (type, fn) => {if (!events.has(type)) events.set(type,[]);events.get(type).push(fn);};
  globalThis.requestAnimationFrame = fn => {frameCallback=fn;};
  const game = createGame({resize(){},render});
  return {game, elements, data, tick:t=>frameCallback(t), input:(code,type='keydown')=>{
    for(const fn of events.get(type)||[])fn({code,repeat:false,preventDefault(){}});
  }};
}

test('既存のセーブを読み、左右移動はX軸のゲーム処理だけに従う', () => {
  const {game, elements} = setup({stage:2,coins:27,skills:{atk:1}});
  elements.get('b-cont').click();game.step(5);
  assert.equal(game.snapshot().stage,2);assert.equal(game.snapshot().coins,27);
  const start = game.snapshot().player;
  game.setKey('right',true);game.step(20);game.setKey('right',false);
  assert.ok(game.snapshot().player.x>start.x+20);
  assert.equal(game.snapshot().player.y,start.y);
});

test('出口の中心に入るとクリアし、ボス生存中は出口が封印される', () => {
  for(const stage of [1,3]) {
    const {game}=setup();game.beginFrom({stage,coins:0,skills:{}});
    const goal=game.L.spawns.find(s=>s.ch==='G');
    Object.assign(game.P,{x:goal.tx*16+3,y:(goal.ty+1)*16-game.P.h,vx:0,vy:0,onGround:true,inv:200});
    game.step(1);
    if(stage===1)assert.equal(game.mode,'clearing');
    else {
      const boss=game.enemies.find(e=>e.type==='K');assert.ok(boss);
      assert.equal(game.mode,'play');boss.dead=true;game.step(1);assert.equal(game.mode,'clearing');
    }
  }
});

test('A相当のジャンプは押す長さで高さが変わり、足場に着地する', () => {
  function jump(held) {
    const {game}=setup();game.beginFrom({stage:1,coins:0,skills:{}});game.step(3);
    const ground=game.snapshot().player.y;game.setKey('jump',true);let top=ground;
    for(let i=0;i<65;i++){if(i===held)game.setKey('jump',false);game.step(1);top=Math.min(top,game.snapshot().player.y);}
    assert.equal(game.snapshot().player.y,ground);assert.equal(game.snapshot().player.onGround,true);
    return ground-top;
  }
  assert.ok(jump(20)>jump(1)+12);
});

test('移動は緩やかに加速し、入力を離すと短い距離で止まる', () => {
  const {game}=setup();game.beginFrom({stage:1,coins:0,skills:{}});game.step(3);
  game.setKey('right',true);game.step(1);
  const initial=game.P.vx;
  game.step(7);const cruising=game.P.vx;
  assert.ok(initial>0 && initial<cruising/4);
  assert.ok(cruising>=1.2 && cruising<=1.3, '従来の1.8px/fから約3割減速');
  const released=game.P.x;game.setKey('right',false);game.step(8);
  assert.equal(game.P.vx,0);assert.ok(game.P.x-released<4);
});

test('押し続けたジャンプは約3マスの高さで、頂点にふんわり滞空する', () => {
  const {game}=setup();game.beginFrom({stage:1,coins:0,skills:{}});game.step(3);
  const ground=game.P.y;game.setKey('jump',true);
  let top=ground,apex=0,landed=0;const heights=[];
  for(let i=1;i<=80;i++){
    game.step(1);
    heights.push(game.P.y);
    if(game.P.y<top){top=game.P.y;apex=i;}
    if(game.P.onGround){landed=i;break;}
  }
  assert.ok(ground-top>=48 && ground-top<=54);
  assert.ok(apex>=24);assert.ok(landed>=48 && landed<=60);
  assert.ok(heights.filter(y=>y-top<=4).length>=16, '頂点の前後を約0.27秒以上かけて通る');
});

test('120Hzと144Hzの描画では物理更新の間も等間隔に移動する', () => {
  for(const hz of [120,144]) {
    const positions=[];
    const {game,tick}=setup(null,state=>{if(state.P)positions.push(samplePosition(state.P,state.alpha).x);});
    game.beginFrom({stage:1,coins:0,skills:{}});game.step(3);game.setKey('right',true);
    const start=performance.now();
    for(let i=1;i<=hz;i++) tick(start+i*1000/hz);
    const deltas=positions.slice(30).map((x,i,a)=>i?x-a[i-1]:null).filter(x=>x!==null);
    assert.ok(deltas.length>50);
    for(const dx of deltas) assert.ok(Math.abs(dx-75/hz)<1e-6, `描画${hz}Hzで停止と飛びが交互に出ない: ${dx}`);
    game.togglePause();const paused=game.P.x;tick(start+1100);
    assert.equal(positions.at(-1),paused);
  }
});

test('落下後の復帰位置を補間してステージ上を横切らせない', () => {
  const {game}=setup();game.beginFrom({stage:1,coins:0,skills:{}});game.step(3);
  Object.assign(game.P,{x:160,y:350,vx:0,vy:0,inv:0});
  game.step(1);
  assert.equal(game.mode,'play');assert.ok(game.P.y<272);
  assert.deepEqual(samplePosition(game.P,.5),{x:game.P.x,y:game.P.y});
});

test('速度を落としても基本ジャンプで3マスの穴と中継足場を渡れる', () => {
  const {game}=setup();
  function prepare(rows) {
    game.beginFrom({stage:1,coins:0,skills:{}});
    for(const row of game.L.grid) row.fill('.');
    for(const [y,pattern] of rows) [...pattern].forEach((ch,x)=>{game.L.grid[y][x]=ch;});
    game.enemies.splice(0);
    Object.assign(game.P,{x:78,y:240-game.P.h,vx:1.25,vy:0,onGround:true});
    game.setKey('right',true);game.setKey('jump',true);
  }
  prepare([[15,'#####...########'],[16,'#####...########']]);
  game.step(60);
  assert.ok(game.P.x+game.P.w>=128);assert.equal(game.P.onGround,true);
  assert.equal(game.P.y+game.P.h,240);
  prepare([[13,'.......-----.......'],[15,'#####........#####'],[16,'#####........#####']]);
  game.step(60);
  assert.equal(game.P.onGround,true);assert.equal(game.P.y+game.P.h,208);
  game.setKey('jump',false);
  for(let i=0;i<60 && game.P.x<190;i++) game.step(1);
  assert.equal(game.P.onGround,true);
  game.setKey('jump',true);game.step(65);
  assert.ok(game.P.x+game.P.w>=208);assert.equal(game.P.onGround,true);
});

test('同じ攻撃入力で通常1発、2WAY取得時は上下2発になる', () => {
  for(const upgraded of [false,true]){
    const {game}=setup();game.beginFrom({stage:1,coins:0,skills:upgraded?{atk:1,twoway:1}:{}});game.step(3);
    game.setKey('shoot',true);game.step(1);game.setKey('shoot',false);
    const shots=game.snapshot().shots;assert.equal(shots.length,upgraded?2:1);
    if(upgraded){assert.ok(shots[0].vy<0);assert.ok(shots[1].vy>0);}
  }
});

test('スキルは前提とコインを満たすと取得でき、保存される', () => {
  const {game,data}=setup();game.beginFrom({stage:1,coins:25,skills:{}});
  game.select('twoway');game.buy();assert.equal(game.snapshot().coins,25);assert.equal(game.snapshot().skills.twoway,undefined);
  game.select('atk');game.buy();assert.equal(game.snapshot().coins,20);
  game.select('twoway');game.buy();assert.equal(game.snapshot().coins,0);assert.equal(game.snapshot().skills.twoway,1);
  assert.equal(JSON.parse(data.get('skyruins-v1')).skills.twoway,1);
});

test('ステージクリアからスキル画面を経て次のステージへ進む', () => {
  const {game,input}=setup();game.beginFrom({stage:1,coins:30,skills:{atk:1}});game.clearStage();game.step(101);
  assert.equal(game.snapshot().mode,'tree');assert.equal(game.snapshot().stage,2);
  input('Enter');assert.equal(game.snapshot().mode,'play');assert.equal(game.L.n,2);
});

test('Start相当で一時停止し、ループ中の位置が止まる', () => {
  const {game,input,tick}=setup();game.beginFrom({stage:1,coins:0,skills:{}});game.step(3);
  game.setKey('right',true);game.step(5);input('KeyP');
  const p=game.snapshot().player;tick(performance.now()+100);
  assert.equal(game.snapshot().mode,'pause');assert.deepEqual(game.snapshot().player,p);
  input('KeyP');assert.equal(game.snapshot().mode,'play');
});

test('ミス後はステージ開始時のコインに戻し、スキルを保持する', () => {
  const {game,data}=setup();game.beginFrom({stage:1,coins:30,skills:{atk:1}});
  game.save.coins=40;game.gameOver();assert.equal(game.snapshot().coins,30);
  assert.equal(JSON.parse(data.get('skyruins-v1')).skills.atk,1);
});

test('ゲームパッドの十字キーとA/Bだけでタイトル、移動、ジャンプ、攻撃、スキル画面を操作できる', () => {
  const {game,tick}=setup();
  const pad={connected:true,axes:[0,0],buttons:Array.from({length:16},()=>({pressed:false}))};
  navigator.getGamepads=()=>[pad];let time=performance.now();
  const advance=()=>tick(time+=20);
  pad.buttons[0].pressed=true;advance();assert.equal(game.mode,'play');
  pad.buttons[0].pressed=false;advance();game.step(5);
  const ground=game.P.y,start=game.P.x;
  pad.buttons[15].pressed=true;for(let i=0;i<10;i++)advance();
  assert.ok(game.P.x>start);
  pad.buttons[15].pressed=false;pad.buttons[0].pressed=true;advance();assert.ok(game.P.y<ground);
  pad.buttons[0].pressed=false;pad.buttons[1].pressed=true;advance();assert.ok(game.snapshot().shots.length>0);
  pad.buttons[1].pressed=false;advance();game.save.coins=30;game.openTree(false);
  pad.buttons[0].pressed=true;advance();assert.equal(game.save.skills.atk,1);
  pad.buttons[0].pressed=false;advance();pad.buttons[1].pressed=true;advance();assert.equal(game.mode,'play');
  navigator.getGamepads=()=>[];advance();const x=game.P.x;game.step(20);assert.ok(game.P.x-x<4);
});
