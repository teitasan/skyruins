// Sprite timing uses the simulation timeline, so pause and hit-stop freeze poses.
export function createPixelAnimator(data) {
  let player=null,lastTick=null,animation='idle',elapsed=0,jumpStart=null;
  function update(p, tick, mode='play') {
    const reset = p !== player || (lastTick!==null && tick<lastTick-1);
    if(reset){animation='idle';elapsed=0;jumpStart=null;lastTick=tick;player=p;}
    // Hit-stop can snap alpha to 1, then resume below it in the same tick.
    // Keep that sub-tick correction from rewinding the animation.
    if(lastTick!==null)tick=Math.max(lastTick,tick);
    const delta=lastTick===null?0:Math.max(0,tick-lastTick);lastTick=tick;
    if(!p){animation='idle';elapsed=0;return {animation,index:0,face:1};}
    let next='idle',index=0;
    if(mode==='dying')next='idle';
    else if(!p.onGround){
      next='jump';
      if(jumpStart===null)jumpStart=tick;
      index=p.vy<-1.2?(tick-jumpStart<6?1:2):Math.abs(p.vy)<=1.2?3:4;
    } else if((p.land||0)>0){next='jump';index=5;jumpStart=null;}
    else if(Math.abs(p.vx)>.12){
      next=Math.abs(p.vx)>1.65?'dash':'walk';jumpStart=null;
    } else jumpStart=null;
    if(next!==animation){animation=next;elapsed=0;}
    if(animation==='walk'||animation==='dash') {
      const referenceSpeed=animation==='walk'?1.25:1.9375;
      elapsed+=delta*1000/60*Math.min(1.8,Math.abs(p.vx)/referenceSpeed);
      const frames=data.animations[animation].frames;
      let time=elapsed%frames.reduce((n,f)=>n+f.durationMs,0);
      index=frames.length-1;
      for(let i=0;i<frames.length;i++){if(time<frames[i].durationMs){index=i;break;}time-=frames[i].durationMs;}
    }
    // Death uses the original pose with an orientation change in the view.
    return {animation,index,face:p.face<0?-1:1};
  }
  return {update};
}
