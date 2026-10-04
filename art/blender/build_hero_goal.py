"""Adapt CC0 KayKit/Kenney models for Skyruins in an isolated Blender process."""
import bpy,bmesh,math,json,random
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
HERO=ROOT/'public/assets/adventurer';GATE=ROOT/'public/assets/landmarks'
HERO.mkdir(parents=True,exist_ok=True);GATE.mkdir(parents=True,exist_ok=True)
bpy.context.preferences.filepaths.save_version=0
for o in list(bpy.data.objects):bpy.data.objects.remove(o,do_unlink=True)

def mat(name,color,roughness=.85,metal=0):
 m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=roughness;p.inputs['Metallic'].default_value=metal;return m
hair=mat('hero_hair',(.080,.035,.015));hairLight=mat('hero_hair_light',(.13,.059,.022))
cloth=mat('hero_tunic',(.035,.085,.145));linen=mat('hero_linen',(.74,.64,.43));leather=mat('hero_leather',(.105,.053,.028));red=mat('hero_scarf',(.50,.030,.013));brass=mat('hero_brass',(.52,.32,.085),.45,.65)

def shape(name,verts,faces,material):
 me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.materials.append(material);me.update();o=bpy.data.objects.new(name,me);bpy.context.scene.collection.objects.link(o);return o

def sphere(name,pos,size,material,segments=20,rings=12):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=pos);o=bpy.context.object;o.name=name;o.scale=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(material)
 for p in o.data.polygons:p.use_smooth=True
 return o

def cube(name,pos,size,material,bevel=.04):
 bpy.ops.mesh.primitive_cube_add(size=1,location=pos);o=bpy.context.object;o.name=name;o.scale=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(material)
 m=o.modifiers.new('Soft worn edges','BEVEL');m.width=bevel;m.segments=3
 return o

bpy.ops.import_scene.gltf(filepath=str(ROOT/'public/assets/kaykit/Rogue.glb'))
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');rig.animation_data.action=None;rig.data.pose_position='REST';bpy.context.view_layer.update()
body=[bpy.data.objects[n] for n in ['Rogue_Body','Rogue_Head','Rogue_ArmLeft','Rogue_ArmRight','Rogue_LegLeft','Rogue_LegRight']]
# Keep the expressive face, ears, eyes and skin weighting; remove the blocky hair
# and rogue earrings by atlas color. The original atlas itself is never edited.
head=bpy.data.objects['Rogue_Head'];bm=bmesh.new();bm.from_mesh(head.data);uv=bm.loops.layers.uv.active
tex=next(n.image for n in head.data.materials[0].node_tree.nodes if n.type=='TEX_IMAGE');px=tex.pixels[:];W,H=tex.size

def color(face,uv):
 t=sum((l[uv].uv for l in face.loops),Vector((0,0)))/len(face.loops);i=(min(H-1,max(0,int(t.y*H)))*W+min(W-1,max(0,int(t.x*W))))*4;return px[i:i+3]
remove=[]
for f in bm.faces:
 r,g,b=color(f,uv)
 if not (r>.83 or max(r,g,b)<.14):remove.append(f)
bmesh.ops.delete(bm,geom=remove,context='FACES');bm.to_mesh(head.data);bm.free();head.data.update()
# Retain the skin atlas; change the original green cloth to blue and brown gear
# to warm leather without replacing the rig or any animation clip.
for o in body:
 if o==head:continue
 original=o.data.materials[0];o.data.materials.append(cloth);o.data.materials.append(leather);o.data.materials.append(linen);o.data.materials.append(brass)
 bm=bmesh.new();bm.from_mesh(o.data);uv=bm.loops.layers.uv.active
 for f in bm.faces:
  r,g,b=color(f,uv)
  if g>r*1.3:f.material_index=1
  elif r<.82 and r>g*1.15:f.material_index=2
  elif b>r*1.04:f.material_index=4
 bm.to_mesh(o.data);bm.free()
parts=[]
def bind(o,bone='head'):
 # Convert generated local coordinates to the same bind-pose space as KayKit.
 bpy.context.view_layer.update()
 for v in o.data.vertices:v.co=o.matrix_world@v.co
 o.matrix_world.identity();o.location=(0,0,0);o.rotation_euler=(0,0,0);o.scale=(1,1,1)
 o.parent=rig;vg=o.vertex_groups.new(name=bone);vg.add(list(range(len(o.data.vertices))),1,'REPLACE');m=o.modifiers.new('KayKit shared skeleton','ARMATURE');m.object=rig;parts.append(o);return o

# Closed layered scalp with a natural fringe rather than a smooth helmet.
verts=[];faces=[];steps=28;rows=10
for j in range(rows+1):
 for i in range(steps):
  phi=2*math.pi*i/steps
  front=max(0,-math.sin(phi));cut=2.20-.83*front
  theta=.035+cut*j/rows
  rr=1+.035*math.sin(phi*3+theta*2)
  verts.append((.49*math.sin(theta)*math.cos(phi)*rr,.05+.46*math.sin(theta)*math.sin(phi)*rr,1.70+.56*math.cos(theta)))
for j in range(rows):
 for i in range(steps):
  a=j*steps+i;b=j*steps+(i+1)%steps;faces.append((a,b,b+steps,a+steps))
faces.extend([tuple(reversed(range(steps))),tuple(rows*steps+i for i in range(steps))])
scalp=bind(shape('Layered brown hair',verts,faces,hair));
for p in scalp.data.polygons:p.use_smooth=True

def lock(name,start,middle,tip,width,material):
 s=Vector(start);m=Vector(middle);t=Vector(tip);side=Vector((1,0,.1))*width;depth=Vector((0,.10,.04))*width/.13
 vs=[s-side,s+side,s+depth,s-depth,m-side*.72,m+side*.72,m+depth*.8,m-depth*.8,t]
 fs=[(0,2,1,3),(0,4,6,2),(2,6,5,1),(1,5,7,3),(3,7,4,0),(4,8,6),(6,8,5),(5,8,7),(7,8,4)]
 return bind(shape(name,[tuple(v) for v in vs],fs,material))
for i,(x,z,tipx,tipz) in enumerate([(-.33,2.10,-.48,2.12),(-.16,2.18,-.28,2.31),(.02,2.20,.10,2.37),(.20,2.13,.41,2.28),(.33,2.02,.53,2.08)]):
 lock('Wind-swept crown', (x,.04,z-.12),(x+.025,-.11,z),(tipx,-.10,tipz),.14,hairLight if i%2 else hair)
for i,x in enumerate([-.31,-.17,0,.16,.32]):
 lock('Swept fringe',(x,-.28,2.0),(x+.07,-.43,1.90),(x+.11,-.46,1.73+(i%2)*.06),.09,hairLight if i%2 else hair)
# Neck wrap, knot and split tails follow the chest's existing animation.
wrap=bind(sphere('Red scarf wrap',(0,0,1.24),(.33,.28,.13),red), 'chest')
bind(sphere('Scarf knot',(.25,.13,1.24),(.13,.12,.11),red),'chest')
for i in range(2):
 vs=[]
 for j in range(7):
  t=j/6;y=.18+t*.89;z=1.25-.32*t+.06*math.sin(t*5+i);x=.17+i*.1-.12*t
  vs.extend([(x-.12*(1-t*.5),y,z),(x+.12*(1-t*.5),y,z-.04)])
 faces=[(j*2,j*2+1,j*2+3,j*2+2) for j in range(6)]
 tail=bind(shape(f'Scarf_Tail_{i}',vs,faces,red),'chest');m=tail.modifiers.new('Fabric thickness','SOLIDIFY');m.thickness=.012
# Small travel pack adds an adventurer silhouette to the reused torso.
bind(cube('Travel pack',(0,.28,.95),(.40,.22,.43),leather,.065),'chest')
bind(cube('Pack flap',(0,.42,1.09),(.42,.055,.13),linen,.025),'chest')
for x in [-.16,.16]:bind(cube('Pack buckle',(x,.45,.98),(.05,.026,.075),brass,.012),'chest')
keep={'Idle','Walking_A','Jump_Idle','Jump_Land','1H_Ranged_Shooting','Death_A_Pose','Cheer'}
for track in list(rig.animation_data.nla_tracks):
 if track.name not in keep:rig.animation_data.nla_tracks.remove(track)
for a in list(bpy.data.actions):
 if a.name not in keep:bpy.data.actions.remove(a)
rig.data.pose_position='POSE'
selected=body+parts+[rig]
bpy.ops.object.select_all(action='DESELECT')
for o in selected:o.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(HERO/'hero-v1.glb'),export_format='GLB',use_selection=True,export_apply=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_rest_position_armature=True)
# Save only the hero scene, excluding the original weapons, cape and unused head hair.
for o in list(bpy.data.objects):
 if o not in selected:bpy.data.objects.remove(o,do_unlink=True)
for image in bpy.data.images:
 if image.filepath:image.pack()
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art/blender/adventurer-source.blend'))

# New isolated scene for the exit landmark, based on existing CC0 architecture.
for o in list(bpy.data.objects):bpy.data.objects.remove(o,do_unlink=True)
stone=mat('goal_stone',(.56,.51,.39));gold=mat('goal_gold',(.50,.28,.06),.5,.6);blue=mat('goal_rune',(.04,.52,.85));dark=mat('goal_carving',(.13,.16,.14))
bpy.ops.import_scene.gltf(filepath=str(ROOT/'public/assets/castle/tower-square-arch.glb'))
obs=[o for o in bpy.data.objects if o.type=='MESH'];coords=[o.matrix_world@v.co for o in obs for v in o.data.vertices]
lo=Vector([min(v[i] for v in coords) for i in range(3)]);hi=Vector([max(v[i] for v in coords) for i in range(3)]);size=hi-lo
for o in obs:
 for v in o.data.vertices:
  p=o.matrix_world@v.co;n=(p-lo);v.co=((n.x/size.x-.5)*3.65,(n.y/size.y-.5)*.85,n.z/size.z*4.05)
 o.matrix_world.identity();o.data.materials.clear();o.data.materials.append(stone);o.name='CC0 ancient arch'
 bevel=o.modifiers.new('Weathered stone edge','BEVEL');bevel.width=.025;bevel.segments=2
# Stone footing stays at the existing ground height and does not add a step.
for x in [-1.4,1.4]:
 cube('Carved plinth',(x,0,.17),(.70,1.2,.34),stone,.05)
 cube('Gold collar',(x,-.46,2.40),(.58,.09,.14),gold,.025)
 for j in range(4):
  # Recessed plates with a readable glowing diamond language.
  z=.65+j*.44
  cube('Recessed rune plate',(x,-.475,z),(.29,.055,.29),dark,.03)
  vs=[(x,-.515,z+.095),(x+.07,-.515,z),(x,-.515,z-.095),(x-.07,-.515,z)]
  shape('Blue waypoint rune',vs,[(0,1,2,3)],blue)
# Individual arch stones add real depth instead of a flat rectangular facade.
for i in range(11):
 a=math.pi*i/11+.018;b=math.pi*(i+1)/11-.018
 vs=[]
 for y in [-.48,-.58]:
  for angle,r in [(a,.92),(a,1.18),(b,1.18),(b,.92)]:vs.append((r*math.cos(angle),y,2.02+r*math.sin(angle)))
 shape('Worn arch voussoir',vs,[(3,2,1,0),(5,6,7,4),(1,5,4,0),(2,6,5,1),(3,7,6,2),(0,4,7,3)],stone)
for i in range(7):
 x=-1.54+i*.51;z=4.045+(.035 if i%2 else -.018)
 cube('Broken crown stone',(x,-.06,z),(.47,.96,.18),stone,.025)
# Large keystone with a cyan gem and gold mount marks the goal from a distance.
bpy.ops.mesh.primitive_torus_add(major_radius=.24,minor_radius=.045,major_segments=24,minor_segments=8,location=(0,-.49,3.55),rotation=(math.pi/2,0,0));bpy.context.object.name='Keystone gold seal';bpy.context.object.data.materials.append(gold)
vs=[(0,-.55,3.79),(.20,-.55,3.55),(0,-.55,3.31),(-.20,-.55,3.55),(0,-.70,3.55)]
shape('Waystone crystal',vs,[(0,1,4),(1,2,4),(2,3,4),(3,0,4)],blue)
# Cracks and uneven edge stones soften the architecture's clean kit silhouette.
for x in [-1.66,1.63]:
 for z in [1.20,2.8]:cube('Old edge stone',(x,-.17,z),(.36,.95,.26),stone,.065)
# Portal fill and animation are runtime effects; the GLB stores editable solid architecture.
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.data.objects:
 if o.type=='MESH':o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(GATE/'exit-gate-v1.glb'),export_format='GLB',use_selection=True,export_apply=True,export_animations=False)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art/blender/exit-gate-source.blend'))
print('SKYRUINS_HERO_AND_GOAL_READY')
