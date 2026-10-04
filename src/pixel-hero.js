import * as THREE from 'three';
import {createPixelAnimator} from './pixel-animation.js';

export async function createPixelHero(root) {
  const response=await fetch(`${root}animations.json`);
  if(!response.ok)throw new Error(`Pixel character metadata: ${response.status}`);
  const data=await response.json();
  const names=[...new Set([data.meta.image,data.idle.image,data.animations.walk.image])];
  const images=Object.fromEntries(await Promise.all(names.map(async name=>{
    const image=await new THREE.ImageLoader().loadAsync(`${root}${name}`);return [name,image];
  })));
  const textureCache=new Map();
  // Reuse the preview's nearest-neighbor crop and foot pivot without editing PNGs.
  function texture(animation,index) {
    const key=`${animation}:${index}`;
    if(textureCache.has(key))return textureCache.get(key);
    const seq=data.animations[animation],info=animation==='idle'?data.idle:seq.frames[index];
    const image=images[animation==='idle'?data.idle.image:seq.image||data.meta.image];
    const scale=animation==='idle'?1:seq.scale||data.meta.sourceScale;
    const canvas=document.createElement('canvas');canvas.width=canvas.height=160;
    const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
    const f=info.frame,p=info.pivot;
    ctx.drawImage(image,f.x,f.y,f.w,f.h,Math.round(80-p.x*scale),Math.round(148-p.y*scale),Math.round(f.w*scale),Math.round(f.h*scale));
    const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
    map.magFilter=map.minFilter=THREE.NearestFilter;map.generateMipmaps=false;
    textureCache.set(key,map);return map;
  }
  const group=new THREE.Group();group.name='PixelWitch';
  const material=new THREE.SpriteMaterial({map:texture('idle',0),transparent:true,alphaTest:.2,depthWrite:false,toneMapped:false,fog:false});
  const sprite=new THREE.Sprite(material);sprite.center.set(.5,12/160);
  const unit=1.65/122,extent=160*unit;sprite.scale.set(extent,extent,1);
  group.add(sprite);
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(.25,24),new THREE.MeshBasicMaterial({color:'#292b20',transparent:true,opacity:.22,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));
  shadow.rotation.x=-Math.PI/2;shadow.scale.set(1,.62,1);shadow.position.set(0,.018,0);group.add(shadow);
  const animator=createPixelAnimator(data);
  let pose={animation:'idle',index:0,face:1};
  return {group,update(p,tick,mode) {
    pose=animator.update(p,tick,mode);material.map=texture(pose.animation,pose.index);
    // Sprite extracts unsigned world scale; flip UVs instead of negative scale.
    material.map.repeat.x=pose.face;material.map.offset.x=pose.face<0?1:0;
    material.rotation=mode==='dying'?.22*pose.face:0;
    shadow.visible=!p||p.onGround;
  },stats:()=>({...pose,textures:textureCache.size})};
}
