// Blender-authored bridge spans match the old collision grid exactly.
const unit = n => Math.abs(Math.sin(n * 127.1 + 311.7) * 43758.5453 % 1);
const solid = tile => tile==='#' || tile==='B';

export function surfaceSpans(level) {
  const spans=[];
  for(let y=0;y<level.grid.length;y++) {
    for(let x=0;x<level.w;) {
      const tile=level.grid[y][x];
      const exposed=solid(tile) && !solid(level.grid[y-1]?.[x]);
      if(!exposed && tile!=='-') {x++;continue;}
      const start=x,oneWay=tile==='-';
      while(x<level.w && (oneWay ? level.grid[y][x]==='-' : solid(level.grid[y][x])&&!solid(level.grid[y-1]?.[x]))) x++;
      let left=x-start,at=start;
      const pieces=Math.ceil(left/12),width=Math.ceil(left/pieces);
      while(left>0) {const count=Math.min(width,left);spans.push({x:at,y,width:count,oneWay});at+=count;left-=count;}
    }
  }
  return spans;
}

export function buildScenery(level, place) {
  for(const span of surfaceSpans(level)) {
    place(`bridge${span.width}`,[span.x+span.width/2,-span.y,0],[1,1,span.oneWay?.68:1]);
    // Tall level boundaries remain visually solid below their uppermost surface.
    if(span.y<5) place('cliffSkirt',[span.x+span.width/2,-span.y-.4,-.5],[span.width/16,1,1]);
    for(let i=0;i<span.width;i++) {
      const x=span.x+i,y=span.y;
      place('meadow',[x+.25,-y,-.78],[.75,.20+unit(x)*.13,.55],unit(x)*6);
      if(x%2===0) place('wisps',[x+.7,-y,.82],[.65,.26,.35],unit(x+4)*6);
      if(x%5===1) place('blossoms',[x+.4,-y,-.68],[.52,.34,.35],unit(x)*3);
      if(x%7===3) place('fern',[x+.55,-y,-.78],[.82,.48,.6],unit(x)*3);
      if(x%9===5) place('bush',[x+.5,-y,-.92],[1.05,.55,.62],unit(x)*6);
      // Hanging growth ties paving, arch and cliff into one silhouette.
      if(!span.oneWay && x%4===2) {
        const hanging=place('fern',[x+.4,-y-.38,1.05],[.8,.8,.35],unit(x)*3);
        hanging.rotation.z=Math.PI;
      }
    }
  }
  for(let y=0;y<level.grid.length;y++) for(let x=0;x<level.w;x++) {
    if(level.grid[y][x]==='^') place('spikes',[x+.5,-y-1,0],[1,.55,1.0]);
  }
  // Cliff skirts continue 60m down; no finite mesh underside crosses the camera.
  for(let x=-30;x<level.w+45;x+=30) {
    place('mesa',[x-2,-9.8,-10.6],[.75,1,.89],.08);
    place('mesa',[x+24,-19,-14.5],[.56,1,.78],-.12);
    place('bridge12',[x+17,-17,-9],[1,1,1.25]);
    place('pillar',[x+12,-65,-9],[1.2,44,1.6]);
    place('pillar',[x+22,-65,-9],[1.2,44,1.6]);
    place('pillar',[x-3,-65,-7],[1.15,55.3,1.15],.035);
    place('stone',[x-3,-9.7,-7],[1.55,.35,1.45],.035);
    place('ladder',[x-2.35,-18.4,-6.2],[.5,4,.15]);
    place('broadTree',[x+21,-19,-13],[5.5,8,4.7],.3);
    place('broadTree',[x-3,-10,-10],[5.5,5.8,4.8],-.4);
    for(let i=0;i<7;i++) {
      place('bush',[x-6+i*1.1,-10.2-unit(i)*.5,-6.2],[1.7,1.05,1],unit(i)*6);
      const hanging=place('fern',[x-5+i*.68,-10.4-unit(i)*1.2,-6.3],[1.3,1.1,.7],unit(i)*3);
      hanging.rotation.z=Math.PI;
    }
  }
}
