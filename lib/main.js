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
            let txt = `Downloading models... (${idx + 1}/8)`;
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

function getAdaptiveCameraSettings() {
    const portrait = window.innerHeight >= window.innerWidth;
    const longEdge = Math.max(window.innerWidth, window.innerHeight);
    const memory = navigator.deviceMemory || 4;
    const cores = navigator.hardwareConcurrency || 4;

    // Ask for more detail on capable devices; keep the request modest on low-end phones.
    const targetLongEdge = memory <= 2 || cores <= 4 ? 1280 : (memory >= 6 && cores >= 8 ? 1920 : 1600);
    const shortEdge = Math.round(targetLongEdge * 9 / 16);
    const width = portrait ? shortEdge : targetLongEdge;
    const height = portrait ? targetLongEdge : shortEdge;

    return {
        facingMode: { ideal: "environment" },
        width: { ideal: width },
        height: { ideal: height },
        frameRate: { ideal: 30, max: 30 }
    };
}

function logActualCameraSettings() {
    const video = container.querySelector("video");
    const track = video?.srcObject?.getVideoTracks?.()[0];
    if (!track) return;
    const settings = track.getSettings();
    console.info("[AR camera] Requested adaptive settings:", getAdaptiveCameraSettings());
    console.info("[AR camera] Actual capture settings:", {
        width: settings.width,
        height: settings.height,
        frameRate: settings.frameRate,
        facingMode: settings.facingMode
    });
}

async function start(statusCb, doneCb) {
    try {
        statusCb("Initializing Engine...");
        const cameraSettings = getAdaptiveCameraSettings();

        mindar = new MindARThree({
            container: container,
            imageTargetSrc: './markers/target.mind',
            maxTrack: 8,
            uiLoading: "no",
            uiScanning: "no",
            uiError: "no",
            filterMinCF: 0.0001,
            filterBeta: 0.001,
            warmupTolerance: 5,
            missTolerance: 5,
            videoSettings: cameraSettings
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

        const modelNames = ["H₂O", "Argon", "Saturn", "Sun", "Camel", "Earth", "Pluto", "Human Heart"];
        const modelKeys = ["0", "1", "2", "3", "4", "5", "6", "7"];
        const modelScenes = [];
        for (let i = 0; i < modelKeys.length; i++) {
            try {
                modelScenes[i] = await loadModel(`./models/${i}.glb`, i, statusCb);
            } catch (e) {
                console.warn(`Model ${i} (${modelNames[i]}) failed to load`, e);
            }
        }
        
        statusCb("Finalizing Setup...");

        const anchors = [];
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

        for (let i = 0; i < modelKeys.length; i++) {
            setupAnc(i, modelScenes[i]);
        }

        statusCb("Waiting for Camera...");
        
        const startP = mindar.start();
        const timeP = new Promise((_, reject) => setTimeout(() => reject("Camera permission timed out."), 20000));

        await Promise.race([startP, timeP]);

        document.getElementById("arModelPanel").style.display = trackedModels.size ? "flex" : "none";

        // Start the first 10s timer once camera is ready
        resetMsgTimer();

        logActualCameraSettings();
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
