from pathlib import Path

ROOT = Path.cwd()
CONTENTS = {}

def replace_once(path, old, new, label):
    file = ROOT / path
    if path not in CONTENTS:
        CONTENTS[path] = file.read_text(encoding="utf-8")
    text = CONTENTS[path]
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one match for {label}, found {count}. No files have been written.")
    CONTENTS[path] = text.replace(old, new, 1)
    print(f"Prepared {path}: {label}")

replace_once("lib/main.js",
    'let txt = `Downloading models... (${idx}/5)`;',
    'let txt = `Downloading models... (${idx + 1}/8)`;',
    "8-model download progress")
replace_once("lib/main.js",
    "imageTargetSrc: './markers/markers.mind',\n            maxTrack: 5,",
    "imageTargetSrc: './markers/target.mind',\n            maxTrack: 8,",
    "target.mind and eight-target tracking")
replace_once("lib/main.js",
    '''        let h2o, ar18, sat, sun, cam;

        try { h2o = await loadModel('./models/h2o.glb', 1, statusCb); } catch(e){ console.warn("H2O fail"); }
        try { ar18 = await loadModel('./models/ar18.glb', 2, statusCb); } catch(e){ console.warn("AR18 fail"); }
        try { sat = await loadModel('./models/saturn.glb', 3, statusCb); } catch(e){ console.warn("Saturn fail"); }
        try { sun = await loadModel('./models/sun.glb', 4, statusCb); } catch(e){ console.warn("Sun fail"); }
        try { cam = await loadModel('./models/camel_r.glb', 5, statusCb); } catch(e){ console.warn("Camel fail"); }''',
    '''        const modelNames = ["H₂O", "Argon", "Saturn", "Sun", "Camel", "Earth", "Pluto", "Human Heart"];
        const modelKeys = ["0", "1", "2", "3", "4", "5", "6", "7"];
        const modelScenes = [];
        for (let i = 0; i < modelKeys.length; i++) {
            try {
                modelScenes[i] = await loadModel(`./models/${i}.glb`, i, statusCb);
            } catch (e) {
                console.warn(`Model ${i} (${modelNames[i]}) failed to load`, e);
            }
        }''',
    "dynamic AR model loading")
replace_once("lib/main.js",
    '''        const anchors = [];
        const modelKeys = ["h2o", "ar18", "saturn", "sun", "camel"];
        const modelNames = ["H₂O", "AR18", "Saturn", "Sun", "Camel"];
        const modelScenes = [h2o, ar18, sat, sun, cam];
        const trackedModels = new Set();''',
    '''        const anchors = [];
        const trackedModels = new Set();''',
    "remove old parallel-array mapping")
replace_once("lib/main.js",
    '''        setupAnc(0, h2o);
        setupAnc(1, ar18);
        setupAnc(2, sat);
        setupAnc(3, sun);
        setupAnc(4, cam);''',
    '''        for (let i = 0; i < modelKeys.length; i++) {
            setupAnc(i, modelScenes[i]);
        }''',
    "create anchors by target index")

replace_once("lib/viewer.js",
    '''const sources = {
  h2o: ['./models/h2o.glb', 'H₂O'],
  ar18: ['./models/ar18.glb', 'AR18'],
  saturn: ['./models/saturn.glb', 'Saturn'],
  sun: ['./models/sun.glb', 'Sun'],
  camel: ['./models/camel_r.glb', 'Camel']
};''',
    '''const modelNames = ['H₂O', 'Argon', 'Saturn', 'Sun', 'Camel', 'Earth', 'Pluto', 'Human Heart'];
const sources = Object.fromEntries(
  modelNames.map((name, index) => [String(index), [`./models/${index}.glb`, name]])
);''',
    "eight-model inspector catalogue")
replace_once("lib/viewer.js",
    '''  if (key && sources[key]) modelSelect.value = key;
  loadSelected(true);''',
    '''  if (key && sources[key]) modelSelect.value = key;
  else if (!selectionMode && !sources[modelSelect.value]) modelSelect.value = '0';
  loadSelected(true);''',
    "default inspector selection")

replace_once("index.html",
    '''        .markerPageHeader {
            display: flex; align-items: center; justify-content: space-between;
            gap: 16px; max-width: 1080px; margin: 0 auto 12px;
        }''',
    '''        .markerPageHeader {
            display: flex; align-items: center; justify-content: flex-start;
            gap: 16px; max-width: 1080px; margin: 0 auto 12px;
        }''',
    "align marker header to upper left")
replace_once("index.html",
    '''        #btnCloseMarkers {
            flex: 0 0 auto; border: 1px solid #cfcbbf; border-radius: 3px;
            padding: 9px 16px; background: transparent; color: #26271f;
            font: inherit; font-size: 1.25rem; cursor: pointer;
        }''',
    '''        #btnCloseMarkers {
            flex: 0 0 auto; order: -1; border: 1px solid #cfcbbf; border-radius: 3px;
            padding: 9px 16px; background: transparent; color: #26271f;
            font: inherit; font-size: 1.25rem; cursor: pointer;
        }''',
    "place back button first")
replace_once("index.html",
    '''        <header class="markerPageHeader">
            <h2 id="markerPageTitle">เปิดดู Marker</h2>
            <button id="btnCloseMarkers" type="button">กลับหน้าหลัก</button>
        </header>''',
    '''        <header class="markerPageHeader">
            <button id="btnCloseMarkers" type="button">กลับหน้าหลัก</button>
            <h2 id="markerPageTitle">เปิดดู Marker</h2>
        </header>''',
    "move back button to upper left")

replace_once("index.html",
    '''        <div class="markerGrid">
            <article class="markerCard">
                <img src="markers/0.png" alt="Marker 0 สำหรับโมเดล H2O" loading="lazy">
                <h3>H₂O · Water</h3>
                <p>Marker 0 · markers/0.png</p>
            </article>
            <article class="markerCard">
                <img src="markers/1.png" alt="Marker 1 สำหรับโมเดล Argon" loading="lazy">
                <h3>Argon</h3>
                <p>Marker 1 · markers/1.png</p>
            </article>
            <article class="markerCard">
                <img src="markers/2.png" alt="Marker 2 สำหรับโมเดล Sun" loading="lazy">
                <h3>Sun</h3>
                <p>Marker 2 · markers/2.png</p>
            </article>
            <article class="markerCard">
                <img src="markers/3.png" alt="Marker 3 สำหรับโมเดล test_0" loading="lazy">
                <h3>test_0</h3>
                <p>Marker 3 · markers/3.png</p>
            </article>
        </div>''',
    '''        <div class="markerGrid">
            <article class="markerCard">
                <img src="markers/0.png" alt="Marker 0 สำหรับโมเดล H₂O" loading="lazy">
                <h3>H₂O</h3>
                <p>Marker 0 · markers/0.png</p>
            </article>
            <article class="markerCard">
                <img src="markers/1.png" alt="Marker 1 สำหรับโมเดล Argon" loading="lazy">
                <h3>Argon</h3>
                <p>Marker 1 · markers/1.png</p>
            </article>
            <article class="markerCard">
                <img src="markers/2.png" alt="Marker 2 สำหรับโมเดล Saturn" loading="lazy">
                <h3>Saturn</h3>
                <p>Marker 2 · markers/2.png</p>
            </article>
            <article class="markerCard">
                <img src="markers/3.png" alt="Marker 3 สำหรับโมเดล Sun" loading="lazy">
                <h3>Sun</h3>
                <p>Marker 3 · markers/3.png</p>
            </article>
            <article class="markerCard">
                <img src="markers/4.png" alt="Marker 4 สำหรับโมเดล Camel" loading="lazy">
                <h3>Camel</h3>
                <p>Marker 4 · markers/4.png</p>
            </article>
            <article class="markerCard">
                <img src="markers/5.png" alt="Marker 5 สำหรับโมเดล Earth" loading="lazy">
                <h3>Earth</h3>
                <p>Marker 5 · markers/5.png</p>
            </article>
            <article class="markerCard">
                <img src="markers/6.jpg" alt="Marker 6 สำหรับโมเดล Pluto" loading="lazy">
                <h3>Pluto</h3>
                <p>Marker 6 · markers/6.jpg</p>
            </article>
            <article class="markerCard">
                <img src="markers/7.png" alt="Marker 7 สำหรับโมเดล Human Heart" loading="lazy">
                <h3>Human Heart</h3>
                <p>Marker 7 · markers/7.png</p>
            </article>
        </div>''',
    "eight marker catalogue cards")

replace_once("index.html",
    '''            <select id="viewerModel" aria-label="เลือกโมเดล">
                <option value="h2o">H₂O</option>
                <option value="ar18">AR18</option>
                <option value="saturn">Saturn</option>
                <option value="sun">Sun</option>
                <option value="camel">Camel</option>
            </select>''',
    '''            <select id="viewerModel" aria-label="เลือกโมเดล">
                <option value="0">H₂O</option>
                <option value="1">Argon</option>
                <option value="2">Saturn</option>
                <option value="3">Sun</option>
                <option value="4">Camel</option>
                <option value="5">Earth</option>
                <option value="6">Pluto</option>
                <option value="7">Human Heart</option>
            </select>''',
    "eight-model inspector dropdown")

for relative_path, updated_text in CONTENTS.items():
    (ROOT / relative_path).write_text(updated_text, encoding="utf-8")

print("\\nDone. All files updated. Review `git diff`, then commit the changes yourself.")
