import * as THREE from 'three';
import { GLTFLoader } from 'gltfloader';
import { MindARThree } from 'mindar-image-three';

window.runAR = start;
window.killAR = stop;

console.log("Main.js Ready.");

let mindar = null;
const container = document.querySelector("#container");
let notFoundTimer = null;

const loadModel = (path, idx, total, cb) => {
    return new Promise((resolve, reject) => {
        const loader = new GLTFLoader();
        loader.load(path, (gltf) => resolve(gltf), (xhr) => {
            const label = `Loading model ${idx}/${total}`;
            if (xhr.lengthComputable && xhr.total > 0) {
                cb(`${label} ${Math.min(100, Math.round((xhr.loaded / xhr.total) * 100))}%`);
            } else {
                cb(`${label} ${(xhr.loaded / 1024 / 1024).toFixed(2)} MB`);
            }
        }, (err) => reject(err));
    });
}

// Content is data, not renderer code. A model can be hosted locally or at a
// public URL. No API secrets belong in this static frontend.
async function loadContentManifest() {
    const response = await fetch('./content/manifest.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error(`Content manifest unavailable (${response.status})`);
    const manifest = await response.json();
    if (!Array.isArray(manifest.targets) || manifest.targets.length === 0) {
        throw new Error('Content manifest has no targets');
    }
    return manifest.targets;
}

// Logic for "No Marker" notification
const resetMsgTimer = () => {
    if(window.toggleNoMarker) window.toggleNoMarker(false);
    clearTimeout(notFoundTimer);
    notFoundTimer = setTimeout(() => {
        if(window.toggleNoMarker) window.toggleNoMarker(true);
    }, 10000);
}

const clearMsgTimer = () => {
    clearTimeout(notFoundTimer);
    if(window.toggleNoMarker) window.toggleNoMarker(false);
}

async function start(statusCb, doneCb) {
    try {
        statusCb("Initializing Engine...");
        
        mindar = new MindARThree({
            container: container,
            imageTargetSrc: './markers/markers.mind',
            maxTrack: 5,
            uiLoading: "no",
            uiScanning: "no",
            uiError: "no",
            filterMinCF: 0.0001, 
            filterBeta: 0.001,
            warmupTolerance: 5,
            missTolerance: 5
        });

        const { renderer, scene, camera } = mindar;

        statusCb("Configuring Renderer...");
        renderer.outputEncoding = THREE.sRGBEncoding;
        renderer.physicallyCorrectLights = true;

        const ambLight = new THREE.AmbientLight(0xffffff, 1);
        scene.add(ambLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 4);
        dirLight.position.set(5, 10, 7);
        scene.add(dirLight);

        const content = await loadContentManifest();
        const loadedModels = [];
        const total = content.length;

        for (let i = 0; i < total; i++) {
            const item = content[i];
            try {
                statusCb(`Loading ${item.title || item.id}...`);
                const gltf = await loadModel(item.modelUrl, i + 1, total, statusCb);
                loadedModels.push({ item, gltf });
            } catch (error) {
                console.warn(`Could not load model for target ${item.id}:`, error);
                loadedModels.push({ item, gltf: null });
            }
        }

        statusCb("Finalizing Setup...");

        const anchors = [];
        const setupAnc = (item, gltf) => {
            const anc = mindar.addAnchor(item.targetIndex);
            if (gltf) {
                gltf.scene.scale.setScalar(Number(item.scale) || 1);
                anc.group.add(gltf.scene);
            }
            anc.onTargetFound = () => { clearMsgTimer(); };
            anc.onTargetLost = () => { resetMsgTimer(); };
            anchors.push(anc);
            return anc;
        };

        loadedModels.forEach(({ item, gltf }) => setupAnc(item, gltf));

        statusCb("Waiting for Camera...");
        
        const startP = mindar.start();
        const timeP = new Promise((_, reject) => setTimeout(() => reject("Camera permission timed out."), 20000));

        await Promise.race([startP, timeP]);

        resetMsgTimer();

        statusCb("Ready.");
        doneCb(); 

        renderer.setAnimationLoop(() => {
            for (const { item, gltf } of loadedModels) {
                if (gltf && item.rotate !== false) {
                    gltf.scene.rotation.y += Number(item.rotationSpeed ?? 0.01);
                }
            }
            renderer.render(scene, camera);
        });

    } catch (err) {
        console.error(err);
        statusCb("Error: " + err);
        alert("Error: " + err);
    }
}

function stop() {
    if (mindar) {
        mindar.stop();
        mindar.renderer.setAnimationLoop(null);
        container.innerHTML = "";
        clearMsgTimer();
    }
}
