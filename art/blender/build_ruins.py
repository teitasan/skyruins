"""Blender 5.2: reusable CC0 stone geometry reshaped into worn continuous ruins.
Run in an isolated background process; never edits an existing user scene.
"""
import bpy, math, random, json
from pathlib import Path
from mathutils import Vector
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT/'public/assets/ruins'
OUT.mkdir(parents=True, exist_ok=True)
# Factory-startup objects belong to this temporary process only.
for ob in list(bpy.data.objects): bpy.data.objects.remove(ob, do_unlink=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'public/assets/platformer/brick.glb'))
bpy.context.preferences.filepaths.save_version=0
source = next(o for o in bpy.data.objects if o.type=='MESH')
source_mesh = source.data.copy()
bounds = [(min(v.co[i] for v in source_mesh.vertices), max(v.co[i] for v in source_mesh.vertices)) for i in range(3)]
for ob in list(bpy.data.objects): bpy.data.objects.remove(ob, do_unlink=True)

def material(name, color):
    m=bpy.data.materials.new(name);m.use_nodes=True
    bsdf=m.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Base Color'].default_value=(*color,1);bsdf.inputs['Roughness'].default_value=.95
    return m
stone=material('ruins_stone',(.69,.63,.49));rock=material('ruins_rock',(.53,.52,.40));moss=material('ruins_moss',(.22,.31,.09))

def mesh(name,verts,faces,mat,col):
    data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.materials.append(mat);data.update()
    ob=bpy.data.objects.new(name,data);col.objects.link(ob);return ob

def bevel(ob,width=.035):
    mod=ob.modifiers.new('Worn edges','BEVEL');mod.width=width;mod.segments=2;mod.limit_method='ANGLE';mod.angle_limit=.6

def slab(col,rng,x,y,w,d,z=-.025,thickness=.32):
    data=source_mesh.copy();data.materials.clear();data.materials.append(stone)
    # Independent corner wear, larger varied paving, no rounded toy tile borders.
    jitter={}
    for v in data.vertices:
        n=[(v.co[i]-bounds[i][0])/(bounds[i][1]-bounds[i][0]) for i in range(3)]
        k=(round(n[0],2),round(n[1],2));jitter.setdefault(k,(rng.uniform(-.065,.065),rng.uniform(-.045,.045)))
        jx,jy=jitter[k]
        v.co=(x+(n[0]-.5)*w+jx,y+(n[1]-.5)*d+jy,z-(1-n[2])*thickness-rng.uniform(0,.018))
    ob=bpy.data.objects.new('CC0 worn paving',data);col.objects.link(ob)
    bevel(ob,.015)
    # Vertex color variation is preserved by the runtime's material batching.
    attr=data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='POINT')
    tint=rng.uniform(.82,1.10)
    for c in attr.data:c.color=(tint,tint,tint*.97,1)
    return ob

records=[]
for length in range(1,13):
    rng=random.Random(821+length)
    col=bpy.data.collections.new(f'bridge_{length:02d}');bpy.context.scene.collection.children.link(col)
    # A closed arch profile: the whole support is one shape, not a row of tiles.
    steps=max(8,length*4); half=length/2
    profile=[(-half,-.38),(half,-.38)]
    depth=4.8 if length>=5 else 1.55
    for i in range(steps+1):
        x=half-length*i/steps
        crown=math.sqrt(max(0,1-(x/(half*.80))**2)) if abs(x)<half*.80 and length>=5 else 0
        profile.append((x,-depth+crown*3.85))
    n=len(profile);verts=[(x,y,z) for y in [-1.12,1.10] for x,z in profile]
    faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    base=mesh('Continuous arch foundation',verts,faces,rock,col);bevel(base,.055)
    # Paving is offset in depth, with non-uniform seams independent of the game grid.
    for row in range(3):
        x=-half
        while x<half-.02:
            w=min(rng.uniform(.80,1.65),half-x)
            slab(col,rng,x+w/2,(row-1)*.77,w-.018,.80,z=-.018,thickness=rng.uniform(.27,.39));x+=w
    # Individual voussoirs follow the arch curve; they emphasize weight and construction.
    if length>=5:
        radius=half*.8
        for i in range(14):
            a0=math.pi*i/14+.012;a1=math.pi*(i+1)/14-.012
            vs=[]
            for y in [-1.17,-1.07]:
                for r in [1,1.13]:
                    for a in [a0,a1]:vs.append((radius*r*math.cos(a),y,-depth+3.85*r*math.sin(a)))
            ob=mesh('Arch stone',vs,[(0,1,3,2),(4,6,7,5),(0,4,5,1),(2,3,7,6),(0,2,6,4),(1,5,7,3)],stone,col);bevel(ob,.02)
    # Broken ledge slabs and moss deposits interrupt the silhouette without raising the landing plane.
    for i in range(max(1,length)):
        x=rng.uniform(-half+.08,half-.08)
        slab(col,rng,x,-1.15,rng.uniform(.28,.55),.35,z=-rng.uniform(.19,.38),thickness=.22)
        if i%2==0:
            vs=[(x-.30,-1.18,-.27),(x+.32,-1.18,-.28),(x+.26,-1.20,-.45),(x-.16,-1.21,-.60)]
            ob=mesh('Moss drape',vs,[(0,1,2,3)],moss,col)
    # Decorative chips and moss also stop at gaps, even on a one-metre span.
    for ob in col.objects:
        for v in ob.data.vertices:v.co.x=max(-half,min(half,v.co.x))
    bpy.ops.object.select_all(action='DESELECT')
    for ob in col.objects:ob.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(OUT/f'bridge-{length:02d}.glb'),export_format='GLB',use_selection=True,export_apply=True,export_animations=False,export_vertex_color='ACTIVE',export_extras=True)
    records.append({'name':f'bridge-{length:02d}','width':length,'top':0,'foundationDepth':depth})
    # Layout only after export, to keep the saved Blender source easy to inspect.
    for ob in col.objects:ob.location.x += (length-1)%4*16;ob.location.y += (length-1)//4*9

# A continuous cliff skirt extends well below all reachable camera positions.
col=bpy.data.collections.new('Cliff skirt');bpy.context.scene.collection.children.link(col)
rng=random.Random(982);xs=[-8+i*.5 for i in range(33)];zs=[0,-.4,-1.1,-2,-3.5,-6,-9,-15,-24,-40,-60]
verts=[]
for j,z in enumerate(zs):
    for i,x in enumerate(xs):
        face=-1.7-.35*math.sin(x*1.12)-.24*math.cos(x*2.7+z*.2)-.28*math.sin(z*.7+x*.8)
        crest=-2.6*(abs(x)/8)**1.5-.25*math.sin(x*.9)
        height=z+crest*math.exp(z/4)+(rng.uniform(-.10,.10) if j>0 else 0)
        verts.append((x,face,height))
faces=[]
for j in range(len(zs)-1):
    for i in range(len(xs)-1):
        a=j*len(xs)+i;faces.extend([(a,a+1+len(xs),a+1),(a,a+len(xs),a+1+len(xs))])
skirt=mesh('Unbroken deep cliff',verts,faces,rock,col)
for p in skirt.data.polygons:p.use_smooth=True
bpy.ops.object.select_all(action='DESELECT');skirt.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'cliff-skirt.glb'),export_format='GLB',use_selection=True,export_apply=True,export_animations=False)
skirt.location=(24,30,0)

# Extend a real CC0 boulder into a single deep mesa. Its upper silhouette stays
# intact; the bottom cannot detach from a separately placed support skirt.
old=set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'public/assets/nature/Rock_Medium_1.gltf'))
mesa=next(o for o in bpy.data.objects if o not in old and o.type=='MESH')
mesa.name='CC0 boulder extended into deep mesa'
mesa.data=mesa.data.copy();mesa.data.materials.clear();mesa.data.materials.append(rock)
bb=[(min(v.co[i] for v in mesa.data.vertices),max(v.co[i] for v in mesa.data.vertices)) for i in range(3)]
for v in mesa.data.vertices:
    nx,ny,nz=[(v.co[i]-bb[i][0])/(bb[i][1]-bb[i][0]) for i in range(3)]
    height=-60+nz/.32*51 if nz<.32 else -9+(nz-.32)/.68*9
    v.co=((nx-.5)*16,(ny-.5)*9,height)
# Bake the original object's transform before glTF export; authored dimensions
# now use Blender Z-up and are converted to game Y-up by the standard exporter.
mesa.matrix_world.identity()
bpy.ops.object.select_all(action='DESELECT');mesa.select_set(True)
bpy.context.view_layer.objects.active=mesa
bpy.ops.export_scene.gltf(filepath=str(OUT/'mesa.glb'),export_format='GLB',use_selection=True,export_apply=True,export_animations=False)
mesa.location=(48,30,0)
# All meshes remain editable; bevel modifiers are retained in the source.
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art/blender/ruins-source.blend'))
(OUT/'geometry.json').write_text(json.dumps(records,indent=2)+'\n')
print('SKYRUINS_EXPORT',len(records)+2,'models')
