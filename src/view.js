import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { samplePosition } from './render-motion.js';

const assetRoot = `${import.meta.env.BASE_URL}assets/`;
const TILE = 16;
const specifications = {
  hero: ['kaykit', 'Rogue'],
  ground: ['platformer', 'block-grass'], stone: ['platformer', 'brick'],
  platform: ['platformer', 'platform'], coin: ['platformer', 'coin-gold'], heart: ['platformer', 'heart'],
  grass: ['platformer', 'grass'], flowers: ['platformer', 'flowers'], tree: ['platformer', 'tree'],
  rocks: ['platformer', 'stones'], spikes: ['platformer', 'trap-spikes'], flag: ['platformer', 'flag'], ladder: ['platformer', 'ladder'],
  s: ['platformer', 'character-oobi'], b: ['platformer', 'character-ooli'],
  f: ['platformer', 'character-oodi'], k: ['platformer', 'character-oozi'], K: ['platformer', 'character-oobi'],
  arch: ['castle', 'tower-square-arch'], wall: ['castle', 'wall-half'], doorway: ['castle', 'wall-doorway'],
  pillar: ['castle', 'wall-pillar'], towerBase: ['castle', 'tower-square-base'],
  towerMid: ['castle', 'tower-square-mid-windows'], towerTop: ['castle', 'tower-square-top'],
  cliff: ['castle', 'rocks-large'], bridge: ['castle', 'bridge-straight-pillar'], smallTree: ['castle', 'tree-small'],
};

export async function createView(canvas, onProgress) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#9acbe9');
  scene.fog = new THREE.Fog('#a9cbd7', 30, 92);
  const camera = new THREE.PerspectiveCamera(19.3, 16 / 9, .1, 140);
  let halfWidth = 6;
  scene.add(new THREE.HemisphereLight('#c6e7ff', '#596140', 2.4));
  const sun = new THREE.DirectionalLight('#ffe9b7', 3.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -18; sun.shadow.camera.right = 18;
  sun.shadow.camera.top = 16; sun.shadow.camera.bottom = -16;
  sun.shadow.camera.near = .1; sun.shadow.camera.far = 70;
  sun.shadow.bias = -.0005; sun.shadow.normalBias = .025;
  scene.add(sun, sun.target);
  const rim = new THREE.DirectionalLight('#a7daff', 1.4);
  rim.position.set(-15, -4, -10); scene.add(rim);

  const loader = new GLTFLoader();
  const models = {};
  let loaded = 0;
  await Promise.all(Object.entries(specifications).map(async ([key, [pack, name]]) => {
    models[key] = await loader.loadAsync(`${assetRoot}${pack}/${name}.glb`);
    onProgress(`遺跡を準備しています… ${++loaded} / ${Object.keys(specifications).length}`);
  }));
  const normalized = new Map();
  const modelSizes = new Map();
  function model(key) {
    if (normalized.has(key)) return normalized.get(key);
    const gltf = models[key];
    const object = gltf.scene;
    object.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    modelSizes.set(key, size.clone());
    const center = box.getCenter(new THREE.Vector3());
    const group = new THREE.Group();
    const offset = new THREE.Group();
    offset.scale.set(1 / size.x, 1 / size.y, 1 / size.z);
    object.position.sub(new THREE.Vector3(center.x, box.min.y, center.z));
    offset.add(object); group.add(offset);
    object.traverse(child => { if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; } });
    normalized.set(key, group);
    return group;
  }
  Object.keys(models).forEach(model);

  let world = null, level = null;
  const mergedGeometries = [];
  function staticObject(key, position, dimensions, angle = 0) {
    const instance = model(key).clone(true);
    instance.position.set(...position);
    instance.scale.set(...dimensions);
    instance.rotation.y = angle;
    world.add(instance);
    return instance;
  }
  // Imported static meshes are batched by material, keeping the original CC0 geometry.
  function batchWorld() {
    world.updateMatrixWorld(true);
    const buckets = new Map();
    world.traverse(mesh => {
      if (!mesh.isMesh || mesh.isSkinnedMesh) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      geometry.applyMatrix4(mesh.matrixWorld);
      const groups = geometry.groups.length ? geometry.groups : [{ start: 0, count: geometry.attributes.position.count, materialIndex: 0 }];
      for (const group of groups) {
        const material = materials[group.materialIndex];
        if (!material) continue;
        const part = new THREE.BufferGeometry();
        for (const name of ['position', 'normal', 'uv']) {
          const attr = geometry.getAttribute(name);
          if (attr) part.setAttribute(name, new THREE.BufferAttribute(attr.array.slice(group.start * attr.itemSize, (group.start + group.count) * attr.itemSize), attr.itemSize));
        }
        if (!part.getAttribute('uv')) part.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(group.count * 2), 2));
        if (!part.getAttribute('normal')) part.computeVertexNormals();
        let bucket = buckets.get(material.uuid);
        if (!bucket) { bucket = { material, geometries: [] }; buckets.set(material.uuid, bucket); }
        bucket.geometries.push(part);
      }
      geometry.dispose();
    });
    world.clear();
    for (const {material, geometries} of buckets.values()) {
      const geometry = mergeGeometries(geometries, false);
      geometries.forEach(g => g.dispose());
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true; mesh.receiveShadow = true;
      world.add(mesh); mergedGeometries.push(geometry);
    }
  }
  function buildLevel(L) {
    if (world) scene.remove(world);
    mergedGeometries.splice(0).forEach(g => g.dispose());
    world = new THREE.Group(); scene.add(world); level = L;
    for (let y = 0; y < L.grid.length; y++) for (let x = 0; x < L.w; x++) {
      const t = L.grid[y][x], above = L.grid[y - 1]?.[x];
      const exposed = !['#', 'B'].includes(above);
      if (t === '#' || t === 'B') {
        staticObject(t === '#' && exposed ? 'ground' : 'stone', [x + .5, -y - 1, 0], [1, 1, 1.65]);
        if (exposed && t === '#' && x % 3 === 0) staticObject('grass', [x + .45, -y, -.55], [.8, .32, .7]);
        if (exposed && t === '#' && x % 11 === 4) staticObject('flowers', [x + .5, -y, .55], [.48, .24, .3]);
      } else if (t === '-') {
        staticObject('platform', [x + .5, -y - .2, 0], [1, .2, 1.5]);
        if (x % 4 === 0) staticObject('pillar', [x + .5, -y - 4, -.45], [.4, 3.8, .6]);
      } else if (t === '^') staticObject('spikes', [x + .5, -y - 1, 0], [1, .48, 1]);
      if (t === '#' && exposed && x % 17 === 5) staticObject('rocks', [x + .5, -y, -.5], [.7, .45, .65]);
    }
    // A continuous path stays readable on z=0. Scenery occupies separate depth layers.
    for (let x = -12; x < L.w + 20; x += 12) {
      staticObject('cliff', [x + 6, -23, -4], [12, 7.3, 5]);
      staticObject('arch', [x, -20, -6], [4.2, 6, 2.8]);
      staticObject('wall', [x + 3.6, -16, -7], [4.3, 2.9, 1.4]);
      staticObject('smallTree', [x + 5, -16, -4.5], [2.2, 3.2, 2.2]);
      staticObject('grass', [x + 4, -15.9, -5], [3.2, .7, 1.7]);
      staticObject('ladder', [x + 2, -18, -2], [.6, 2.2, .1]);
    }
    for (let x = -25; x < L.w + 45; x += 25) {
      const height = 6 + ((x + 25) % 3) * 1.4;
      staticObject('cliff', [x + 3, -24, -25], [21, 9, 9]);
      staticObject('towerBase', [x, -15, -25], [3.7, 2.8, 3.7]);
      staticObject('towerMid', [x, -12.2, -25], [3.7, height, 3.7]);
      staticObject('towerTop', [x, -12.2 + height, -25], [3.8, 1.7, 3.8]);
      staticObject('arch', [x + 9, -17, -21], [7, 8, 3]);
      staticObject('bridge', [x + 5, -18, -25], [8, 4.2, 2]);
    }
    batchWorld();
  }

  function actor(key, dimensions) {
    const group = cloneSkeleton(model(key));
    if (key === 'hero') {
      const size = modelSizes.get(key), height = dimensions[1];
      group.scale.set(height * size.x / size.y, height, height * size.z / size.y);
    } else group.scale.set(...dimensions);
    const mixer = new THREE.AnimationMixer(group);
    const actions = Object.fromEntries(models[key].animations.map(clip => [clip.name, mixer.clipAction(clip)]));
    let current = null;
    return { group, mixer, actions, animate(name, speed = 1) {
      actions[name]?.setEffectiveTimeScale(speed);
      if (name === current || !actions[name]) return;
      if (current) actions[current]?.fadeOut(.16);
      actions[name].reset().fadeIn(name === 'Jump_Land' ? .06 : .16).play(); current = name;
    } };
  }
  const hero = actor('hero', [.62, 1.02, .58]);
  hero.actions.Jump_Land.setLoop(THREE.LoopOnce, 1);
  hero.actions.Jump_Land.clampWhenFinished = true;
  scene.add(hero.group); hero.animate('Idle');
  const creatures = new Map();
  const items = new Map();
  const bolts = new Map();
  const fx = new Map();
  const barMaterial = new THREE.MeshBasicMaterial({color:'#ff694e'});
  const barBackMaterial = new THREE.MeshBasicMaterial({color:'#25303b'});
  const barGeometry = new THREE.PlaneGeometry(1, .065);
  function hpBar(group) {
    const bar = new THREE.Group();
    const back = new THREE.Mesh(barGeometry, barBackMaterial);
    const fill = new THREE.Mesh(barGeometry, barMaterial);
    fill.position.z = .01; bar.add(back, fill); group.add(bar);
    return {bar, fill};
  }
  const boltGeometry = new THREE.SphereGeometry(1, 12, 8);
  const boltMaterial = new THREE.MeshBasicMaterial({color:'#d5ffff'});
  const haloMaterial = new THREE.MeshBasicMaterial({color:'#56baff', transparent:true, opacity:.28, depthWrite:false, blending:THREE.AdditiveBlending});
  function makeBolt() {
    const group = new THREE.Group();
    const core = new THREE.Mesh(boltGeometry, boltMaterial); core.scale.set(.26, .10, .10);
    const halo = new THREE.Mesh(boltGeometry, haloMaterial); halo.scale.set(.5, .23, .2);
    const trail = new THREE.Mesh(boltGeometry, haloMaterial); trail.scale.set(.58, .08, .08); trail.position.x = -.35;
    group.add(core, halo, trail); scene.add(group); return group;
  }
  const particleGeometry = new THREE.IcosahedronGeometry(.06, 0);
  const particleMaterials = new Map();
  const textTextures = new Map();
  const floatingLabels = new Map();
  function textSprite(text, color) {
    const key = text + color;
    let texture = textTextures.get(key);
    if (!texture) {
      const c = document.createElement('canvas'); c.width = 128; c.height = 64;
      const ctx = c.getContext('2d'); ctx.font = 'bold 30px sans-serif'; ctx.textAlign = 'center';
      ctx.lineWidth = 6; ctx.strokeStyle = '#283444'; ctx.strokeText(text, 64, 42); ctx.fillStyle = color; ctx.fillText(text, 64, 42);
      texture = new THREE.CanvasTexture(c); textTextures.set(key, texture);
    }
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({map:texture, transparent:true, depthTest:false}));
    sprite.scale.set(.95, .48, 1); scene.add(sprite); return sprite;
  }
  let flag = null;
  let cameraX = 5.7, cameraY = -13.8, lastTime = performance.now(), previousPlayer = null;
  let wasGrounded = false, landingUntil = 0;
  function sweep(map, live, cleanup = () => {}) {
    for (const [entity, object] of map) if (!live.has(entity)) {
      scene.remove(object.group || object); cleanup(object); map.delete(entity);
    }
  }
  function render(state) {
    const { L, P, enemies, bullets, coins, pickups, parts, texts, goal, frame, mode, shake, alpha = 1 } = state;
    if (!L) return;
    const now = performance.now();
    const dt = Math.min(.05, (now - lastTime) / 1000); lastTime = now;
    const moving = !['pause','tree','over'].includes(mode);
    if (L !== level) buildLevel(L);
    hero.group.visible = Boolean(P) && !(P.inv > 0 && Math.floor(frame / 3) % 2);
    if (P) {
      const pos = samplePosition(P, alpha);
      hero.group.position.set((pos.x + P.w / 2) / TILE, -(pos.y + P.h) / TILE, 0);
      if (previousPlayer !== P) { wasGrounded = P.onGround; landingUntil = 0; hero.group.rotation.y = P.face * (Math.PI / 2 - .22); }
      if (moving) {
        hero.group.rotation.y = THREE.MathUtils.damp(hero.group.rotation.y, P.face * (Math.PI / 2 - .22), 18, dt);
        if (P.onGround && !wasGrounded) landingUntil = frame + 30;
        wasGrounded = P.onGround;
      }
      const speed = Math.abs(P.vx);
      const name = mode === 'dying' ? 'Death_A_Pose' : !P.onGround ? 'Jump_Idle' : P.cd > 12 ? '1H_Ranged_Shooting' : speed > .12 ? 'Walking_A' : frame < landingUntil ? 'Jump_Land' : 'Idle';
      const rate = name === 'Walking_A' ? THREE.MathUtils.clamp(speed / 1.25 * .85, .3, 1.3) : name === 'Jump_Idle' ? .7 : 1;
      hero.animate(name, rate); hero.mixer.update(moving ? dt : 0);
      const targetX = THREE.MathUtils.clamp(hero.group.position.x + 1.8, halfWidth, Math.max(halfWidth, L.w - halfWidth));
      const targetY = Math.max(-13.8, hero.group.position.y + 1.2);
      if (previousPlayer !== P) { cameraX = targetX; cameraY = targetY; previousPlayer = P; }
      const follow = 1 - Math.exp(-dt * 7);
      cameraX += (targetX - cameraX) * follow; cameraY += (targetY - cameraY) * follow;
    } else {
      cameraX = 6 + Math.sin(frame / 700) * 1.5; cameraY = -13.5;
      // The start scene also shows the playable character before the first button press.
      hero.group.visible = true; hero.group.position.set(2.5, -15, 0);
      hero.group.rotation.y = Math.PI / 2 - .22; hero.animate('Idle'); hero.mixer.update(dt);
    }
    const liveEnemies = new Set(enemies.filter(e => !e.dead && Math.abs(e.x / TILE - cameraX) < 20));
    sweep(creatures, liveEnemies, a => {a.mixer.stopAllAction(); a.mixer.uncacheRoot(a.group);});
    for (const e of liveEnemies) {
      let a = creatures.get(e);
      if (!a) {
        const big = e.type === 'K';
        a = actor(e.type, [big ? 2.3 : .76, big ? 1.9 : .67, big ? 1.65 : .58]);
        a.hp = hpBar(a.group); a.animate('walk', .75); scene.add(a.group); creatures.set(e, a);
      }
      const pos = samplePosition(e, alpha);
      a.group.position.set((pos.x + e.w / 2) / TILE, -(pos.y + e.h) / TILE, 0);
      a.group.rotation.y = e.dir * (Math.PI / 2 - .38);
      a.group.visible = !(e.flash > 0 && frame % 4 < 2);
      a.mixer.update(moving ? dt : 0);
      // Billboard health bars remain horizontal while the creature turns.
      a.hp.bar.rotation.y = -a.group.rotation.y;
      a.hp.bar.position.set(0, 1.16, 0);
      a.hp.bar.visible = e.bar > 0 || e.type === 'K';
      const ratio = Math.max(0, e.hp / e.maxHp);
      a.hp.fill.scale.x = ratio; a.hp.fill.position.x = (ratio - 1) / 2;
    }
    const liveItems = new Set([...coins, ...pickups].filter(c => Math.abs(c.x / TILE - cameraX) < 16));
    sweep(items, liveItems);
    for (const c of liveItems) {
      let mesh = items.get(c);
      const coin = coins.includes(c);
      if (!mesh) { mesh = model(coin ? 'coin' : 'heart').clone(true); mesh.scale.setScalar(coin ? .4 : .43); scene.add(mesh); items.set(c, mesh); }
      const pos = samplePosition(c, alpha), visualFrame = frame + alpha;
      mesh.position.set((pos.x + 4) / TILE, -(pos.y + 5) / TILE + .08 * Math.sin(visualFrame * .06 + (c.ph || 0)), 0);
      mesh.rotation.y = visualFrame * .03;
    }
    const liveBolts = new Set(bullets.filter(b => b.life > 0)); sweep(bolts, liveBolts);
    for (const b of liveBolts) {
      let mesh = bolts.get(b); if (!mesh) {mesh = makeBolt(); bolts.set(b, mesh);}
      const pos = samplePosition(b, alpha);
      mesh.position.set((pos.x + b.w / 2) / TILE, -(pos.y + b.h / 2) / TILE, .12);
      mesh.rotation.z = Math.atan2(-b.vy, b.vx);
    }
    const liveFx = new Set(parts); sweep(fx, liveFx);
    for (const p of parts) {
      let mesh = fx.get(p);
      if (!mesh) {
        let material = particleMaterials.get(p.c);
        if (!material) {material = new THREE.MeshBasicMaterial({color:p.c}); particleMaterials.set(p.c, material);}
        mesh = new THREE.Mesh(particleGeometry, material); scene.add(mesh); fx.set(p, mesh);
      }
      const pos = samplePosition(p, alpha);
      mesh.position.set(pos.x / TILE, -pos.y / TILE, .2);
      mesh.scale.setScalar(p.s * Math.max(.1, p.life / p.max));
    }
    const liveLabels = new Set(texts); sweep(floatingLabels, liveLabels, sprite => sprite.material.dispose());
    for (const t of liveLabels) {
      let sprite = floatingLabels.get(t);
      if (!sprite) {sprite = textSprite(t.txt, t.c); floatingLabels.set(t, sprite);}
      const pos = samplePosition(t, alpha);
      sprite.position.set(pos.x / TILE, -pos.y / TILE + .3, .3);
      sprite.material.opacity = Math.min(1, t.life / 15);
    }
    if (goal) {
      if (!flag) {flag = model('flag').clone(true); flag.scale.set(1.0, 4.3, .5); scene.add(flag);}
      flag.visible = true; flag.position.set(goal.x / TILE, -goal.bottom / TILE, -.15);
    } else if (flag) flag.visible = false;
    const vibration = moving && shake ? (Math.sin(frame * 2.6) * shake / TILE) : 0;
    camera.position.set(cameraX + vibration, cameraY + 1.45, 20);
    camera.lookAt(cameraX + vibration, cameraY, 0);
    sun.position.set(cameraX - 8, cameraY + 16, 10);
    sun.target.position.set(cameraX, cameraY - 2, 0);
    renderer.render(scene, camera);
  }
  function resize(width, height) {
    const gameHeight = Math.min(height, width / 1.5);
    const wrap = canvas.parentElement;
    wrap.style.width = width + 'px'; wrap.style.height = gameHeight + 'px';
    renderer.setSize(width, gameHeight, false);
    const aspect = width / gameHeight;
    camera.aspect = aspect; halfWidth = 3.4 * aspect;
    camera.updateProjectionMatrix();
  }
  return { render, resize, stats: () => ({calls:renderer.info.render.calls, triangles:renderer.info.render.triangles, models:Object.keys(models).length}) };
}
