// Scene composition uses imported CC0 meshes. Playable surfaces stay on z=0.
const variation = n => Math.sin(n * 127.1 + 311.7) * 43758.5453 % 1;
const unit = n => Math.abs(variation(n));

export function buildScenery(level, place) {
  const grid = level.grid;
  for (let y = 0; y < grid.length; y++) for (let x = 0; x < level.w; x++) {
    const tile = grid[y][x], above = grid[y - 1]?.[x];
    const exposed = !['#','B'].includes(above);
    if (tile === '#' || tile === 'B') {
      if (exposed) place('stone', [x+.5, -y-1, 0], [1,1,1.8]);
      else place('stone', [x+.5, -y-1, -.12], [1,1,1.75]);
      if (exposed) {
        // Thin, weathered cap stones retain an exact, readable landing surface.
        place('stone', [x+.5, -y-.2, .06], [.96,.2,1.95], 0);
        place('meadow', [x+.25, -y, -.58], [.7,.22+unit(x)*.14,.6], unit(x)*6);
        if (x%2===0) place('wisps', [x+.7,-y,.68], [.7,.28,.38], unit(x+4)*6);
        if (x%5===1) place('blossoms', [x+.4,-y,-.62], [.55,.36,.35], unit(x)*3);
        if (x%7===3) place('fern', [x+.55,-y,-.65], [.85,.48,.65], unit(x)*3);
        if (x%9===5) place('bush', [x+.5,-y,-.82], [1.1,.6,.65], unit(x)*6);
      }
    } else if (tile==='-') {
      place('stone', [x+.5,-y-.24,0], [1,.24,1.8]);
      if (x%3===0) place('pillar',[x+.5,-y-3.8,-.45],[.32,3.55,.65]);
      place('meadow',[x+.6,-y,-.6],[.65,.18,.4],unit(x)*6);
    } else if (tile==='^') place('spikes',[x+.5,-y-1,0],[1,.55,1.0]);
  }

  // Wide arch bays support the bridge; narrow stretched rocks read as spikes.
  const bottom = grid.length - 1;
  for(let x=0;x<level.w-5;x+=6) {
    if(Array.from({length:6},(_,i)=>grid[bottom][x+i]).every(tile=>tile==='#')) {
      place('arch',[x+3,-bottom-5.8,-.25],[6,4.9,1.85]);
      if(x%12===0) place('rockC',[x+.4,-bottom-6,-.5],[2.8,1.8,2.4],unit(x)*3);
    }
  }

  // Each section frames an open valley rather than placing a wall behind the hero.
  for (let x=-30;x<level.w+45;x+=30) {
    place('cliff',[x-2,-18,-10],[11,8,8],.08);
    place('cliff',[x+24,-25,-14],[8,6,7],-.12);
    place('arch',[x+18,-21,-9],[5.5,6,2.5]);
    place('pillar',[x-3,-18,-7],[1.15,8.5,1.15],.035);
    place('stone',[x-3,-9.7,-7],[1.55,.35,1.45],.035);
    place('ladder',[x-2.35,-18.4,-6.2],[.5,4,.15]);
    place('broadTree',[x+21,-19,-13],[5.5,8,4.7],.3);
    place('broadTree',[x-3,-10.5,-10],[5.5,5.8,4.8],-.4);
    for(let i=0;i<7;i++) {
      place('bush',[x-6+i*1.1,-11.3-unit(i)*.5,-6.2],[1.7,1.05,1],unit(i)*6);
      const hanging=place('fern',[x-5+i*.68,-11.4-unit(i)*1.2,-6.3],[1.3,1.1,.7],unit(i)*3);
      hanging.rotation.z = Math.PI;
    }
    place('rockC',[x+10,-26,-10],[4.5,4,5],.3);
  }
}
