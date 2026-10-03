"""Fetch a documented, CC0 subset. Existing files are reused, never deleted."""
import concurrent.futures
import hashlib
import json
from pathlib import Path
import re
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1] / 'public'
HEADERS = {'User-Agent': 'Mozilla/5.0 (Skyruins asset import)'}

def read(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=60).read()

def fetch(url, path):
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists():
        target.write_bytes(read(url))
    return target

commit = 'db3df04d1e4714298a09510b26fb6de6645138a2'
prefix = 'Stylized Nature MegaKit[Standard]/'
base = f'https://raw.githubusercontent.com/agentkaerf/FreeModels/{commit}/'
def nature_url(path):
    return base + urllib.parse.quote(prefix + path)

names = ['CommonTree_1', 'CommonTree_4', 'Fern_1', 'Bush_Common_Flowers',
         'Grass_Wispy_Short', 'Grass_Common_Short', 'Flower_3_Group',
         'Rock_Medium_1', 'Rock_Medium_2', 'Rock_Medium_3']
dependencies = set()
for name in names:
    target = fetch(nature_url('glTF/' + name + '.gltf'), 'assets/nature/' + name + '.gltf')
    gltf = json.loads(target.read_text())
    dependencies.update(item['uri'] for item in gltf.get('buffers', []) + gltf.get('images', []) if 'uri' in item)
jobs = [(nature_url('glTF/' + name), 'assets/nature/' + name) for name in dependencies]
jobs.append((nature_url('License_Standard.txt'), 'assets/nature/LICENSE.txt'))
for asset in ['mossy_stone_wall', 'rock_pitted_mossy']:
    html = read('https://polyhaven.com/a/' + asset).decode()
    urls = set(re.findall(r'https://dl.polyhaven.org[^"\\<> ]+', html))
    for suffix in ['diff', 'nor_gl', 'rough']:
        url = next(u for u in urls if f'/jpg/1k/{asset}/{asset}_{suffix}_1k.jpg' in u)
        jobs.append((url, 'assets/surfaces/' + url.rsplit('/', 1)[1]))
sky = 'kloofendal_48d_partly_cloudy_puresky'
html = read('https://polyhaven.com/a/' + sky).decode()
url = next(u for u in set(re.findall(r'https://dl.polyhaven.org[^"\\<> ]+', html)) if f'/hdr/1k/{sky}_1k.hdr' in u)
jobs.append((url, 'assets/surfaces/' + sky + '_1k.hdr'))
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    for target in pool.map(lambda job: fetch(*job), jobs):
        print(target.relative_to(ROOT), target.stat().st_size)

(ROOT / 'assets/nature/SOURCE.json').write_text(json.dumps({'author':'Quaternius', 'license':'CC0-1.0',
    'official':'https://quaternius.com/packs/stylizednaturemegakit.html',
    'mirror':'https://github.com/agentkaerf/FreeModels', 'commit':commit}, indent=2) + '\n')
(ROOT / 'assets/surfaces/LICENSE.txt').write_text('Poly Haven assets: CC0 1.0 Universal.\nhttps://polyhaven.com/license\nhttps://creativecommons.org/publicdomain/zero/1.0/\nMossy Stone Wall: Amal Kumar\nRock Pitted Mossy: Dimitrios Savva and Rico Cilliers\nKloofendal 48d Partly Cloudy (Pure Sky): Greg Zaal and Jarod Guest\n')
manifest = [{'path':str(p.relative_to(ROOT)), 'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),
             'bytes':p.stat().st_size} for p in sorted((ROOT / 'assets').rglob('*')) if p.is_file() and p.name != 'manifest.json']
(ROOT / 'assets/manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
