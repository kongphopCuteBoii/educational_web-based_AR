import * as THREE from 'three';
import { GLTFLoader } from 'gltfloader';
import { MindARThree } from 'mindar-image-three';

window.runAR = start;
window.killAR = stop;

console.log("Main.js Ready.");

let mindar = null;
const container = document.querySelector("#container");
let notFoundTimer = null;
let motionEnabled = false;
window.setARMotion = () => {};

const loadModel = (path, idx, cb) => {
    return new Promise((resolve, reject) => {
        const loader = new GLTFLoader();
        loader.load(path, (gltf) => resolve(gltf), (xhr) => {
            let txt = `Downloading models... (${idx}/5)`;
            if (xhr.lengthComputable && xhr.total > 0) {
                let pc = (xhr.loaded / xhr.total) * 100;
                if (pc > 100) pc = 100;
                cb(`${txt} ${Math.round(pc)}%`);
            } else {
                let mb = (xhr.loaded / 1024 / 1024).toFixed(2);
                cb(`${txt} ${mb}MB`);
            }
        }, (err) => reject(err));
    })
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

        let h2o, ar18, sat, sun, cam;

        try { h2o = await loadModel('./models/h2o.glb', 1, statusCb); } catch(e){ console.warn("H2O fail"); }
        try { ar18 = await loadModel('./models/ar18.glb', 2, statusCb); } catch(e){ console.warn("AR18 fail"); }
        try { sat = await loadModel('./models/saturn.glb', 3, statusCb); } catch(e){ console.warn("Saturn fail"); }
        try { sun = await loadModel('./models/sun.glb', 4, statusCb); } catch(e){ console.warn("Sun fail"); }
        try { cam = await loadModel('./models/camel_r.glb', 5, statusCb); } catch(e){ console.warn("Camel fail"); }
        
        statusCb("Finalizing Setup...");

        const anchors = [];
        const modelKeys = ["h2o", "ar18", "saturn", "sun", "camel"];
        const modelNames = ["H₂O", "AR18", "Saturn", "Sun", "Camel"];
        const modelScenes = [h2o, ar18, sat, sun, cam];
        const trackedModels = new Set();
        const arModelList = document.getElementById("arModelList");

        window.setARTrackedModel = (idx, found) => {
            if (found && modelScenes[idx]) trackedModels.add(idx);
            else trackedModels.delete(idx);
            arModelList.replaceChildren();
            trackedModels.forEach(index => {
                const button = document.createElement("button");
                button.type = "button";
                button.className = "arModelChoice";
                button.textContent = modelNames[index];
                button.addEventListener("click", () => {
                    if (window.openARModelSelection) window.openARModelSelection(modelKeys[index]);
                });
                arModelList.appendChild(button);
            });
            document.getElementById("arModelPanel").style.display =
                trackedModels.size ? "flex" : "none";
        };

        // Isolate the GLB hierarchy, center its bounds, and fit it to the marker.
        // MindAR anchors use marker-space units; a fixed target size avoids model-
        // specific scale guesses making one asset enormous and another microscopic.
        const setupAnc = (idx, model) => {
            const anc = mindar.addAnchor(idx);
            if (model) {
                model.scene.updateMatrixWorld(true);
                const bounds = new THREE.Box3().setFromObject(model.scene);
                const size = bounds.getSize(new THREE.Vector3());
                const center = bounds.getCenter(new THREE.Vector3());
                const maxDimension = Math.max(size.x, size.y, size.z);

                if (Number.isFinite(maxDimension) && maxDimension > 0) {
                    model.scene.position.sub(center);
                    const modelRoot = new THREE.Group();
                    modelRoot.name = `ARModelRoot_${modelKeys[idx]}`;
                    modelRoot.scale.setScalar(0.65 / maxDimension);
                    modelRoot.add(model.scene);
                    anc.group.add(modelRoot);
                    modelRoot.updateMatrixWorld(true);
                    console.info("[AR model fit]", modelKeys[idx], {
                        originalSize: size.toArray(),
                        maxDimension,
                        fitSize: 0.65
                    });
                } else {
                    console.warn("[AR model fit] Invalid bounds:", modelKeys[idx], size);
                    anc.group.add(model.scene);
                }
            }
            anc.onTargetFound = () => {
                clearMsgTimer();
                window.setARTrackedModel(idx, true);
            };
            anc.onTargetLost = () => {
                window.setARTrackedModel(idx, false);
                resetMsgTimer();
            };
            anchors.push(anc);
            return anc;
        };

        setupAnc(0, h2o);
        setupAnc(1, ar18);
        setupAnc(2, sat);
        setupAnc(3, sun);
        setupAnc(4, cam);

        statusCb("Waiting for Camera...");
        
        const startP = mindar.start();
        const timeP = new Promise((_, reject) => setTimeout(() => reject("Camera permission timed out."), 20000));

        await Promise.race([startP, timeP]);

        document.getElementById("arModelPanel").style.display = trackedModels.size ? "flex" : "none";

        // Start the first 10s timer once camera is ready
        resetMsgTimer();

        statusCb("Ready.");
        doneCb(); 

        renderer.setAnimationLoop(() => {
            renderer.render(scene, camera);
        });

    } catch (err) {
        console.error(err);
        if (mindar) {
            try { mindar.stop(); } catch (_) {}
            try { mindar.renderer.setAnimationLoop(null); } catch (_) {}
        }
        statusCb("Error: " + err);
        alert("Error: " + err);
    }
}

function stop() {
    if (mindar) {
        mindar.stop();
        mindar.renderer.setAnimationLoop(null);
        document.getElementById("arModelPanel").style.display = "none";
        trackedModels.clear();
        container.innerHTML = "";
        clearMsgTimer(); // Kill the timer
    }
}
