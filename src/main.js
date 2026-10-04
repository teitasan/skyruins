import { createView } from './view.js';
import { createGame } from './game.js';

const loading = document.getElementById('loading');
try {
  const view = await createView(document.getElementById('cv'), text => { loading.textContent = text; });
  const game = createGame(view);
  document.getElementById('b-new').disabled = false;
  document.getElementById('b-new').textContent = 'はじめから';
  loading.textContent = '十字キーと、ふたつのボタンで冒険しよう。';
  // Local-only scene checks. Vite removes this branch from the production bundle.
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('qa')) {
    const panel = document.createElement('aside');
    panel.style.cssText = 'position:fixed;bottom:4px;left:4px;z-index:100;display:flex;gap:6px';
    let motionTimers = [];
    const actions = {
      '歩行とジャンプを確認': () => {
        game.beginFrom({stage:1,coins:0,skills:{}});
        game.setKey('right',true);
        const schedule = (ms, action) => motionTimers.push(setTimeout(action, ms));
        schedule(600, () => game.setKey('jump',true));
        schedule(1500, () => game.setKey('jump',false));
        schedule(1800, () => game.setKey('right',false));
      },
      '敵の描画を確認': () => {
        game.beginFrom({stage:1,coins:60,skills:{}});
        const enemy = game.enemies.find(e => e.type === 's' || e.type === 'b');
        if (enemy) Object.assign(game.P,{x:enemy.x-50,y:enemy.y+enemy.h-game.P.h,vx:0,vy:0,onGround:true});
      },
      'ジャンプ頂点の描画を確認': () => {
        game.beginFrom({stage:1,coins:0,skills:{}});
        game.step(2); game.setKey('jump',true); game.step(28);
        game.setKey('jump',false); game.togglePause();
      },
      'スキル画面を確認': () => game.openTree(false),
      'ゴールの描画を確認': () => {
        game.beginFrom({stage:1,coins:0,skills:{}});
        const goal=game.L.spawns.find(s=>s.ch==='G');
        Object.assign(game.P,{x:goal.tx*16-48,y:(goal.ty+1)*16-game.P.h,vx:0,vy:0,onGround:true});
      },
      '出口に入る動きを確認': () => {
        actions['ゴールの描画を確認']();game.setKey('right',true);
        motionTimers.push(setTimeout(()=>game.setKey('right',false),1200));
      },
      'クリア進行を確認': () => {if (game.mode === 'tree') game.startStage(game.save.stage);game.clearStage();},
    };
    for (const [text, action] of Object.entries(actions)) {
      const button = document.createElement('button');button.textContent=text;button.onclick=()=>{
        motionTimers.forEach(clearTimeout); motionTimers = [];
        for (const key of ['left','right','jump','shoot']) game.setKey(key,false);
        button.blur();
        if (document.getElementById('ov-msg').classList.contains('show')) document.getElementById('msg-b').click();
        action();
      };panel.append(button);
    }
    document.body.append(panel);
  }
} catch (error) {
  console.error(error);
  loading.textContent = 'ゲームを読み込めませんでした。ページを再読み込みしてください。';
}
