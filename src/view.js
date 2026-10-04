import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { samplePosition } from './render-motion.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { buildScenery } from './scenery.js';

const assetRoot = `${import.meta.env.BASE_URL}assets/`;
const TILE = 16;
const specifications = {
  hero: ['adventurer', 'hero-v1'],
  exitGate: ['landmarks','exit-gate-v1'],
  stone: ['platformer', 'brick'], coin: ['platformer', 'coin-gold'], heart: ['platformer', 'heart'],
  spikes: ['platformer', 'trap-spikes'], ladder: ['platformer', 'ladder'],
  s: ['platformer', 'character-oobi'], b: ['platformer', 'character-ooli'],
  f: ['platformer', 'character-oodi'], k: ['platformer', 'character-oozi'], K: ['platformer', 'character-oobi'],
  pillar: ['castle', 'wall-pillar'],
  broadTree: ['nature', 'CommonTree_1', 'gltf'],
  fern: ['nature', 'Fern_1', 'gltf'], bush: ['nature', 'Bush_Common_Flowers', 'gltf'],
  meadow: ['nature', 'Grass_Common_Short', 'gltf'], wisps: ['nature', 'Grass_Wispy_Short', 'gltf'],
  blossoms: ['nature', 'Flower_3_Group', 'gltf'],
  cliffSkirt: ['ruins','cliff-skirt'],
  mesa: ['ruins','mesa'],
  ...Object.fromEntries(Array.from({length:12},(_,i)=>[`bridge${i+1}`,['ruins',`bridge-${String(i+1).padStart(2,'0')}`]])),
};

export async function createView(canvas, onProgress) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .95;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#b5cdd7');
  scene.fog = new THREE.Fog('#b5cdd7', 37, 110);
  const camera = new THREE.PerspectiveCamera(24.5, 16 / 9, .1, 180);
  let halfWidth = 6;
  scene.add(new THREE.HemisphereLight('#d6e7ef', '#64704b', 1.25));
  const sun = new THREE.DirectionalLight('#ffe1ac', 3.0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -18; sun.shadow.camera.right = 18;
  sun.shadow.camera.top = 16; sun.shadow.camera.bottom = -16;
  sun.shadow.camera.near = .1; sun.shadow.camera.far = 70;
  sun.shadow.bias = -.0005; sun.shadow.normalBias = .025;
  scene.add(sun, sun.target);
  const rim = new THREE.DirectionalLight('#b2dcff', 1.15);
  rim.position.set(-15, -4, -10); scene.add(rim);

  const loader = new GLTFLoader();
  const models = {};
  let loaded = 0;
  await Promise.all(Object.entries(specifications).map(async ([key, [pack, name, extension = 'glb']]) => {
    models[key] = await loader.loadAsync(`${assetRoot}${pack}/${name}.${extension}`);
    onProgress(`遺跡を準備しています… ${++loaded} / ${Object.keys(specifications).length}`);
  }));
  const textureLoader = new THREE.TextureLoader();
  const loadSurface = async name => {
    const [map, normalMap, roughnessMap] = await Promise.all(['diff','nor_gl','rough'].map(suffix => textureLoader.loadAsync(`${assetRoot}surfaces/${name}_${suffix}_1k.jpg`)));
    map.colorSpace = THREE.SRGBColorSpace;
    for (const texture of [map, normalMap, roughnessMap]) {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    }
    return {map, normalMap, roughnessMap};
  };
  const [masonry, rockSurface, sky] = await Promise.all([
    loadSurface('mossy_stone_wall'), loadSurface('rock_pitted_mossy'),
    new HDRLoader().loadAsync(`${assetRoot}surfaces/kloofendal_48d_partly_cloudy_puresky_1k.hdr`),
  ]);
  sky.mapping = THREE.EquirectangularReflectionMapping;
  const panorama = await textureLoader.loadAsync(`${assetRoot}scenery/skyruins-valley-v1.png`);
  panorama.colorSpace = THREE.SRGBColorSpace;
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(1,1), new THREE.MeshBasicMaterial({map:panorama, fog:false, toneMapped:false, depthWrite:false}));
  backdrop.renderOrder = -10; scene.add(backdrop);
  scene.background = new THREE.Color('#b6d8eb');
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromEquirectangular(sky);
  scene.environment = environment.texture; scene.environmentIntensity = .5; pmrem.dispose();
  const masonryMaterial = new THREE.MeshStandardMaterial({...masonry, color:'#f2e4c7', roughness:1, normalScale:new THREE.Vector2(.65,.65)});
  const rockMaterial = new THREE.MeshStandardMaterial({...rockSurface, color:'#999c7d', roughness:1, normalScale:new THREE.Vector2(.75,.75)});
  masonryMaterial.color.multiplyScalar(1.8);
  rockMaterial.color.multiplyScalar(1.35);
  const pavingMaterial = new THREE.MeshStandardMaterial({...rockSurface,color:'#ded5b9',roughness:.95,normalScale:new THREE.Vector2(.4,.4),vertexColors:true});
  pavingMaterial.color.multiplyScalar(1.5);
  const foundationMaterial = masonryMaterial.clone(); foundationMaterial.color.set('#c6c1a6').multiplyScalar(1.35);
  const mossMaterial = new THREE.MeshStandardMaterial({color:'#52642a',roughness:1,side:THREE.DoubleSide});
  const stoneKeys = new Set(['stone','ground','arch','wall','doorway','pillar','towerBase','towerMid','towerTop','bridge']);
  const surfaceKeys = new Set(['cliff']);
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(1,1), .18, .5, 1.2));
  composer.addPass(new OutputPass());
  const normalized = new Map();
  const modelSizes = new Map();
  const gateRuneMaterial = new THREE.MeshStandardMaterial({color:'#5bbedd',emissive:'#40cfff',emissiveIntensity:2.2,roughness:.4,side:THREE.DoubleSide});
  const gateGoldMaterial = new THREE.MeshStandardMaterial({color:'#cfa358',metalness:.65,roughness:.45});
  function model(key) {
    if (normalized.has(key)) return normalized.get(key);
    const gltf = models[key];
    const object = gltf.scene;
    if (key === 'exitGate') {
      object.updateMatrixWorld(true);
      object.traverse(child=>{if(child.isMesh){
        child.castShadow = true; child.receiveShadow = true;
        const name = child.material.name;
        child.material = name === 'goal_rune' ? gateRuneMaterial : name === 'goal_gold' ? gateGoldMaterial : name === 'goal_stone' ? masonryMaterial : rockMaterial;
        if(name === 'goal_stone' || name === 'goal_carving') {
          const geometry = child.geometry.toNonIndexed(), pos = geometry.attributes.position, normal = geometry.attributes.normal;
          const uv = new Float32Array(pos.count*2);
          for(let t=0;t<pos.count;t+=3) {
            const n = new THREE.Vector3(); for(let j=0;j<3;j++)n.add(new THREE.Vector3().fromBufferAttribute(normal,t+j));
            for(let j=0;j<3;j++){const i=t+j;uv[i*2]=.3*(Math.abs(n.x)>Math.abs(n.z)?pos.getZ(i):pos.getX(i));uv[i*2+1]=.3*(Math.abs(n.y)>Math.max(Math.abs(n.x),Math.abs(n.z))?pos.getZ(i):pos.getY(i));}
          }
          geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));child.geometry=geometry;
        }
      }});
      normalized.set(key,object);return object;
    }
    if (specifications[key][0] === 'ruins') {
      object.traverse(child=>{if(child.isMesh){
        child.castShadow = true;child.receiveShadow = true;
        const name = child.material.name;
        child.material = name === 'ruins_moss' ? mossMaterial : ['cliffSkirt','mesa'].includes(key) ? rockMaterial : name === 'ruins_stone' ? pavingMaterial : foundationMaterial;
        child.userData.worldUV = name !== 'ruins_moss';
        child.userData.uvScale = name === 'ruins_stone' ? .24 : .30;
      }});
      normalized.set(key,object);return object;
    }
    object.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    modelSizes.set(key, size.clone());
    const center = box.getCenter(new THREE.Vector3());
    const group = new THREE.Group();
    const offset = new THREE.Group();
    offset.scale.set(1 / size.x, 1 / size.y, 1 / size.z);
    object.position.sub(new THREE.Vector3(key === 'hero' ? 0 : center.x, box.min.y, key === 'hero' ? 0 : center.z));
    offset.add(object); group.add(offset);
    object.traverse(child => { if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; } });
    if (specifications[key][0] === 'nature') object.traverse(child => {
      if (!child.isMesh) return;
      child.material = child.material.clone();
      child.material.roughness = 1;
      if (child.material.transparent || child.material.alphaTest > 0) {
        child.material.alphaTest = .45; child.material.transparent = false; child.material.side = THREE.DoubleSide;
      }
    });
    if (key === 'ladder') object.traverse(child => { if (child.isMesh) {child.material = child.material.clone(); child.material.color.set('#a48768');} });
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
    if (stoneKeys.has(key) || surfaceKeys.has(key)) instance.traverse(mesh => {
      if (!mesh.isMesh) return;
      mesh.material = stoneKeys.has(key) ? masonryMaterial : rockMaterial;
      mesh.userData.worldUV = true;
    });
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
      if (mesh.userData.worldUV) {
        const pos = geometry.getAttribute('position'), normal = geometry.getAttribute('normal');
        const uv = new Float32Array(pos.count * 2);
        for (let triangle = 0; triangle < pos.count; triangle += 3) {
          // All three corners must use the same projection; per-vertex axis
          // switches stretched the textures into diagonal stripes on curved rocks.
          let nx=0,ny=0,nz=0;
          for(let j=0;j<3;j++){nx+=normal.getX(triangle+j);ny+=normal.getY(triangle+j);nz+=normal.getZ(triangle+j);}
          const ax=Math.abs(nx),ay=Math.abs(ny),az=Math.abs(nz),scale=mesh.userData.uvScale || .30;
          for(let j=0;j<3;j++) {
            const i=triangle+j;
            uv[i*2] = (ax > az && ax > ay ? pos.getZ(i) : pos.getX(i)) * scale;
            uv[i*2+1] = (ay > ax && ay > az ? pos.getZ(i) : pos.getY(i)) * scale;
          }
        }
        geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      }
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
        // Quaternius foliage uses vertex-painted shading. Keep it when batching.
        const sourceColor = geometry.getAttribute('color');
        const colors = new Float32Array(group.count * 3);
        for(let i=0;i<group.count;i++) {
          colors[i*3] = sourceColor ? sourceColor.getX(group.start+i) : 1;
          colors[i*3+1] = sourceColor ? sourceColor.getY(group.start+i) : 1;
          colors[i*3+2] = sourceColor ? sourceColor.getZ(group.start+i) : 1;
        }
        part.setAttribute('color', new THREE.BufferAttribute(colors, 3));
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
    buildScenery(L, staticObject);
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
  const hero = actor('hero', [.76, 1.55, .72]);
  hero.group.traverse(mesh => {
    if (!mesh.isMesh) return;
    if (['Knife','Knife_Offhand','Throwable','1H_Crossbow','2H_Crossbow'].includes(mesh.name)) mesh.visible = false;
    if (mesh.name === 'Rogue_Cape') mesh.material = new THREE.MeshStandardMaterial({color:'#b63823', roughness:.9, side:THREE.DoubleSide});
    else { mesh.material = mesh.material.clone(); mesh.material.roughness = .85; }
  });
  hero.actions.Jump_Land.setLoop(THREE.LoopOnce, 1);
  hero.actions.Jump_Land.clampWhenFinished = true;
  scene.add(hero.group); hero.animate('Idle');
  const spellLight = new THREE.PointLight('#64c9ff',0,2.8,2);
  scene.add(spellLight);
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
  const boltMaterial = new THREE.MeshBasicMaterial({color:new THREE.Color().setRGB(1.1,2.5,4),toneMapped:false});
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
  // The exit stays centered on the existing goal collision line.
  const gate = new THREE.Group();gate.add(model('exitGate').clone(true));scene.add(gate);gate.visible=false;
  for(const [key,x,height,angle] of [['fern',-1.48,.43,.4],['wisps',-1.15,.23,-.3],['fern',1.50,.37,-.8],['blossoms',1.27,.26,.9]]) {
    const plant=model(key).clone(true);plant.position.set(x,4.11,.1);plant.scale.set(.62,height,.55);plant.rotation.y=angle;gate.add(plant);
  }
  const opening = new THREE.Shape();opening.moveTo(-.85,.10);opening.lineTo(.85,.10);opening.lineTo(.85,2.03);opening.quadraticCurveTo(.85,2.91,0,3.05);opening.quadraticCurveTo(-.85,2.91,-.85,2.03);opening.closePath();
  const portalMaterial = new THREE.MeshBasicMaterial({color:'#55d7ff',transparent:true,opacity:.18,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending});
  const portal = new THREE.Mesh(new THREE.ShapeGeometry(opening),portalMaterial);portal.position.z=.05;gate.add(portal);
  const outline = new THREE.CatmullRomCurve3(opening.getPoints(48).map(p=>new THREE.Vector3(p.x,p.y,.08)),true);
  const portalEdge = new THREE.Mesh(new THREE.TubeGeometry(outline,96,.026,6,true),gateRuneMaterial);gate.add(portalEdge);
  const motes = Array.from({length:14},(_,i)=>{const mesh=new THREE.Mesh(particleGeometry,gateRuneMaterial);mesh.scale.setScalar(.38+i%3*.15);gate.add(mesh);return mesh;});
  const exitLabel = textSprite('出口','#ffe1ac');exitLabel.scale.set(1.35,.67,1);exitLabel.position.set(0,4.43,.1);gate.add(exitLabel);
  let goalLocked = false;
  let cameraX = 5.7, cameraY = -13.8, lastTime = performance.now(), previousPlayer = null;
  let wasGrounded = false, landingUntil = 0;
  function sweep(map, live, cleanup = () => {}) {
    for (const [entity, object] of map) if (!live.has(entity)) {
      scene.remove(object.group || object); cleanup(object); map.delete(entity);
    }
  }
  function render(state) {
    const { L, P, enemies, bullets, coins, pickups, parts, texts, goal, frame, mode, bossRef, shake, alpha = 1 } = state;
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
      const firing = bullets.some(b => b.life>0 && b.vx*P.face>0 && Math.abs(b.x-(P.face>0?P.x+P.w:P.x))<18);
      const name = mode === 'dying' ? 'Death_A_Pose' : mode === 'clearing' ? 'Cheer' : !P.onGround ? 'Jump_Idle' : speed > .12 ? 'Walking_A' : firing ? '1H_Ranged_Shooting' : frame < landingUntil ? 'Jump_Land' : 'Idle';
      spellLight.position.set(hero.group.position.x+P.face*.45,hero.group.position.y+.65,.6);
      if (moving) spellLight.intensity = THREE.MathUtils.damp(spellLight.intensity,firing?3:0,16,dt);
      const rate = name === 'Walking_A' ? THREE.MathUtils.clamp(speed / 1.25 * .85, .3, 1.3) : name === 'Jump_Idle' ? .7 : 1;
      hero.animate(name, rate); hero.mixer.update(moving ? dt : 0);
      const targetX = THREE.MathUtils.clamp(hero.group.position.x + 1.8, halfWidth, Math.max(halfWidth, L.w - halfWidth));
      const targetY = Math.max(-12.8, hero.group.position.y + 2);
      if (previousPlayer !== P) { cameraX = targetX; cameraY = targetY; previousPlayer = P; }
      const follow = 1 - Math.exp(-dt * 7);
      cameraX += (targetX - cameraX) * follow; cameraY += (targetY - cameraY) * follow;
    } else {
      spellLight.intensity = 0;
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
        a = actor(e.type, [big ? 2.3 : .94, big ? 1.9 : .82, big ? 1.65 : .72]);
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
      gate.visible = true; gate.position.set(goal.x / TILE, -goal.bottom / TILE, -.65);
      const locked = Boolean(bossRef && !bossRef.dead);
      if(locked !== goalLocked) {
        goalLocked=locked;gateRuneMaterial.color.set(locked?'#c58b43':'#5bbedd');gateRuneMaterial.emissive.set(locked?'#e79d36':'#40cfff');
        portalMaterial.color.set(locked?'#e6a34c':'#55d7ff');
        const label=textSprite(locked?'封印中':'出口','#ffe1ac');exitLabel.material.dispose();exitLabel.material=label.material;scene.remove(label);
      }
      portalMaterial.opacity = locked ? .045 : (mode === 'clearing' ? .38 : .15+.04*Math.sin(frame*.025));
      for(let i=0;i<motes.length;i++) {const phase=frame*.012+i*2.4;motes[i].visible=!locked;motes[i].position.set(Math.sin(phase)*.7,.35+(frame*.009+i*.21)%2.6,.2+Math.cos(phase)*.18);}
    } else gate.visible = false;
    const vibration = moving && shake ? (Math.sin(frame * 2.6) * shake / TILE) : 0;
    camera.position.set(cameraX + vibration, cameraY + 1.45, 20);
    camera.lookAt(cameraX + vibration, cameraY, 0);
    // Face the camera so its pitch cannot expose the image's bottom edge.
    backdrop.quaternion.copy(camera.quaternion);
    backdrop.position.copy(camera.position).addScaledVector(camera.getWorldDirection(new THREE.Vector3()),110);
    backdrop.position.x += Math.sin(cameraX*.006)*2;
    sun.position.set(cameraX + 8, cameraY + 16, 14);
    sun.target.position.set(cameraX, cameraY - 2, 0);
    composer.render(dt);
  }
  function resize(width, height) {
    const gameHeight = Math.min(height, width / 1.5);
    const wrap = canvas.parentElement;
    wrap.style.width = width + 'px'; wrap.style.height = gameHeight + 'px';
    renderer.setSize(width, gameHeight, false);
    const aspect = width / gameHeight;
    const panoramaAspect = panorama.image.width / panorama.image.height;
    const backdropHeight = Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*2*110*1.15*Math.max(1,aspect/panoramaAspect);
    backdrop.scale.set(backdropHeight*panoramaAspect,backdropHeight,1);
    composer.setSize(width, gameHeight);
    camera.aspect = aspect; halfWidth = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 20 * aspect;
    camera.updateProjectionMatrix();
  }
  return { render, resize, stats: () => ({calls:renderer.info.render.calls, triangles:renderer.info.render.triangles, models:Object.keys(models).length}) };
}
