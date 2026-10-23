import * as THREE from 'three';
import { GLTFLoader } from 'gltfloader';
import { DRACOLoader } from 'dracoloader';
import { MindARThree } from 'mindar-image-three';
import { resolveModel } from './model-provider.js';

window.runAR = start;
window.killAR = stop;

console.log("Main.js Ready.");

let mindar = null;
const container = document.querySelector("#container");
let notFoundTimer = null;
const visibleTargets = new Map();
let activeTargetId = null;
const modelPivots = new Map();
const contentItems = new Map();
let selectedCatalogueGltf = null;
let catalogueSwapSequence = 0;

function buildTargetPivot(gltf, item) {
    const source = gltf.scene.clone(true);
    source.traverse((object) => {
        if (object.isMesh && object.material) {
            object.material = Array.isArray(object.material)
                ? object.material.map((material) => material.clone())
                : object.material.clone();
        }
    });
    source.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(source);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    bounds.getSize(size);
    bounds.getCenter(center);
    const maxDimension = Math.max(size.x, size.y, size.z);
    const desiredSize = Number(item.displaySize) || 0.45;
    const fitScale = maxDimension > 0 ? desiredSize / maxDimension : 1;
    const userScale = Number(item.scale) || 1;
    const pivot = new THREE.Group();
    source.position.sub(center);
    source.scale.setScalar(fitScale * userScale);
    pivot.add(source);
    return pivot;
}

function disposeObject(root) {
    if (!root) return;
    root.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            materials.forEach((material) => material.dispose());
        }
    });
}

function replaceTargetModel(targetId, gltf) {
    const item = contentItems.get(targetId);
    const oldPivot = modelPivots.get(targetId);
    if (!item || !oldPivot || !oldPivot.parent) return false;
    const parent = oldPivot.parent;
    const replacement = buildTargetPivot(gltf, item);
    // Catalogue assets should keep their authored orientation and must not inherit
    // the starter lesson model's accumulated auto-rotation.
    replacement.rotation.set(0, 0, 0);
    parent.add(replacement);
    parent.remove(oldPivot);
    disposeObject(oldPivot);
    modelPivots.set(targetId, replacement);
    item.rotate = false;
    item.rotationSpeed = 0;
    item.modelSource = selectedCatalogueGltf?.asset?.source || 'Catalogue selection';
    item.modelAttribution = selectedCatalogueGltf?.asset?.license || null;
    item.modelAssetName = selectedCatalogueGltf?.asset?.title || 'Catalogue model';
    item.modelAssetUrl = selectedCatalogueGltf?.asset?.assetUrl || null;
    if (window.showARInfo && visibleTargets.has(targetId)) window.showARInfo(item);
    return true;
}

window.addEventListener('catalogue:model-selected', async (event) => {
    const asset = event.detail;
    if (!asset?.modelUrl || !asset.previewLoaded) return;
    const sequence = ++catalogueSwapSequence;
    try {
        const loader = new GLTFLoader();
        const gltf = await loadModel(asset.modelUrl, 1, 1, (message) => {
            if (window.setCatalogueARStatus) window.setCatalogueARStatus(message);
        });
        if (sequence !== catalogueSwapSequence) return;
        selectedCatalogueGltf = { gltf, asset };
        if (activeTargetId && replaceTargetModel(activeTargetId, gltf)) {
            if (window.setCatalogueARStatus) window.setCatalogueARStatus('Loaded "' + asset.title + '" into active AR marker ' + activeTargetId + '.');
        } else {
            if (window.setCatalogueARStatus) window.setCatalogueARStatus('Model loaded and queued. Scan any supported marker to place "' + asset.title + '".');
        }
    } catch (error) {
        if (sequence !== catalogueSwapSequence) return;
        console.error('Catalogue model could not be loaded into AR:', error);
        if (window.setCatalogueARStatus) window.setCatalogueARStatus('AR insertion failed: ' + describeError(error));
    }
});

const loadModel = (path, idx, total, cb) => {
    return new Promise((resolve, reject) => {
        const loader = new GLTFLoader();
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
        loader.setDRACOLoader(dracoLoader);
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

function describeError(error) {
    if (error instanceof Error) {
        return `${error.name}: ${error.message || "(no error message)"}`;
    }
    if (typeof error === "string") {
        return error || "(empty error string)";
    }
    if (error === undefined) {
        return "The operation was rejected without an error value (undefined).";
    }
    if (error === null) {
        return "The operation was rejected with a null error value.";
    }
    try {
        return JSON.stringify(error) || String(error);
    } catch (_) {
        return String(error);
    }
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
    let stage = "initialization";
    try {
        visibleTargets.clear();
        activeTargetId = null;
        statusCb("Initializing Engine...");
        
        stage = "creating MindAR engine";
        const trackingProfiles = {
            stable: { filterMinCF: 0.0005, filterBeta: 500 },
            balanced: { filterMinCF: 0.001, filterBeta: 1000 },
            responsive: { filterMinCF: 0.005, filterBeta: 1500 }
        };
        const trackingProfile = document.querySelector("#trackingProfile")?.value || "balanced";
        const tracking = trackingProfiles[trackingProfile] || trackingProfiles.balanced;

        mindar = new MindARThree({
            container: container,
            imageTargetSrc: './markers/markers.mind',
            maxTrack: 5,
            uiLoading: "no",
            uiScanning: "no",
            uiError: "no",
            // Lower cutoff smooths tracking noise; higher beta responds faster to motion.
            filterMinCF: tracking.filterMinCF,
            filterBeta: tracking.filterBeta,
            warmupTolerance: 5,
            missTolerance: 5
        });

        const { renderer, scene, camera } = mindar;

        stage = "configuring renderer";
        statusCb("Configuring Renderer...");
        renderer.outputEncoding = THREE.sRGBEncoding;
        renderer.physicallyCorrectLights = true;

        const ambLight = new THREE.AmbientLight(0xffffff, 1);
        scene.add(ambLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 4);
        dirLight.position.set(5, 10, 7);
        scene.add(dirLight);

        stage = "loading content manifest";
        const content = await loadContentManifest();
        contentItems.clear();
        content.forEach((item) => contentItems.set(item.id, item));
        const loadedModels = [];
        const total = content.length;

        for (let i = 0; i < total; i++) {
            const item = content[i];
            try {
                stage = `resolving model ${item.title || item.id}`;
                const resolved = await resolveModel(item, statusCb);
                item.resolvedModelUrl = resolved.url;
                item.modelSource = resolved.source;
                item.modelAttribution = resolved.attribution;
                item.modelAssetName = resolved.assetName || null;
                item.modelAssetUrl = resolved.assetUrl || null;

                stage = `loading model ${item.title || item.id}`;
                statusCb(`Loading ${item.title || item.id}...`);
                const gltf = await loadModel(resolved.url, i + 1, total, statusCb);
                loadedModels.push({ item, gltf });
            } catch (error) {
                console.warn(`Could not load model for target ${item.id}:`, error);
                loadedModels.push({ item, gltf: null });
            }
        }

        stage = "setting up image anchors";
        statusCb("Finalizing Setup...");

        const anchors = [];
        const setupAnc = (item, gltf) => {
            const anc = mindar.addAnchor(item.targetIndex);
            if (gltf) {
                // Fit each imported asset into a predictable size, preserving its aspect ratio.
                // Rotate a centered pivot instead of the source scene's arbitrary origin.
                const source = gltf.scene;
                source.updateMatrixWorld(true);
                const bounds = new THREE.Box3().setFromObject(source);
                const size = new THREE.Vector3();
                const center = new THREE.Vector3();
                bounds.getSize(size);
                bounds.getCenter(center);

                const maxDimension = Math.max(size.x, size.y, size.z);
                const desiredSize = Number(item.displaySize) || 0.45;
                const fitScale = maxDimension > 0 ? desiredSize / maxDimension : 1;
                const userScale = Number(item.scale) || 1;

                const pivot = new THREE.Group();
                source.position.sub(center);
                source.scale.setScalar(fitScale * userScale);
                pivot.add(source);
                anc.group.add(pivot);
                modelPivots.set(item.id, pivot);
            }
            anc.onTargetFound = () => {
                // Diagnose angle-dependent apparent deformation on-device. MindAR
                // should provide a rigid anchor transform; non-uniform anchor scale
                // would point to tracking output, while uniform scale points elsewhere.
                anc.group.updateMatrixWorld(true);
                const anchorScale = new THREE.Vector3();
                anc.group.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), anchorScale);
                const modelScale = new THREE.Vector3();
                const pivotForDebug = modelPivots.get(item.id);
                if (pivotForDebug) {
                    pivotForDebug.updateMatrixWorld(true);
                    pivotForDebug.getWorldScale(modelScale);
                }
                console.debug("[AR pose]", item.id, {
                    anchorWorldScale: anchorScale.toArray().map((value) => Number(value.toFixed(4))),
                    modelWorldScale: modelScale.toArray().map((value) => Number(value.toFixed(4))),
                    anchorLocalScale: anc.group.scale.toArray().map((value) => Number(value.toFixed(4)))
                });
                visibleTargets.set(item.id, item);
                if (selectedCatalogueGltf) {
                    replaceTargetModel(item.id, selectedCatalogueGltf.gltf);
                }
                activeTargetId = item.id;
                clearMsgTimer();
                if (window.showARInfo) window.showARInfo(item);
            };
            anc.onTargetLost = () => {
                visibleTargets.delete(item.id);
                if (activeTargetId === item.id) {
                    const remaining = Array.from(visibleTargets.values()).pop();
                    activeTargetId = remaining ? remaining.id : null;
                    if (remaining) {
                        if (window.showARInfo) window.showARInfo(remaining);
                    } else if (window.hideARInfo) {
                        window.hideARInfo(item.id);
                    }
                }
                if (visibleTargets.size === 0) resetMsgTimer();
            };
            anchors.push(anc);
            return anc;
        };

        loadedModels.forEach(({ item, gltf }) => setupAnc(item, gltf));

        stage = "starting camera";
        statusCb("Checking camera support...");

        if (!window.isSecureContext) {
            throw new Error(`Camera access requires a secure context. Current protocol: ${location.protocol}`);
        }
        if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") {
            throw new Error("This browser context does not expose navigator.mediaDevices.getUserMedia(). Open the HTTPS preview directly in Chrome, not inside an embedded in-app browser.");
        }

        // MindAR 1.2.5 discards the real getUserMedia rejection and calls reject()
        // without a value. Temporarily wrap the method so we can preserve that cause.
        const mediaDevices = navigator.mediaDevices;
        const originalDescriptor = Object.getOwnPropertyDescriptor(mediaDevices, "getUserMedia");
        const originalGetUserMedia = mediaDevices.getUserMedia;
        let cameraRequestError = null;
        let cameraInstrumentationInstalled = false;

        const trackedGetUserMedia = function (...args) {
            let request;
            try {
                request = originalGetUserMedia.apply(this, args);
            } catch (error) {
                cameraRequestError = error;
                console.error("Camera API threw before returning a promise:", error);
                throw error;
            }
            return Promise.resolve(request).catch((error) => {
                cameraRequestError = error;
                console.error("Browser camera request rejected:", error);
                throw error;
            });
        };

        try {
            Object.defineProperty(mediaDevices, "getUserMedia", {
                configurable: true,
                writable: true,
                value: trackedGetUserMedia
            });
            cameraInstrumentationInstalled = mediaDevices.getUserMedia === trackedGetUserMedia;
        } catch (error) {
            console.warn("Could not instrument getUserMedia; keeping normal camera startup.", error);
        }

        const restoreGetUserMedia = () => {
            if (!cameraInstrumentationInstalled || mediaDevices.getUserMedia !== trackedGetUserMedia) return;
            try {
                if (originalDescriptor) {
                    Object.defineProperty(mediaDevices, "getUserMedia", originalDescriptor);
                } else {
                    delete mediaDevices.getUserMedia;
                }
            } catch (error) {
                console.warn("Could not restore getUserMedia wrapper:", error);
            }
        };

        statusCb("Waiting for Camera...");
        let cameraTimeout;
        const startP = Promise.resolve()
            .then(() => mindar.start())
            .catch((error) => {
                if (cameraRequestError) {
                    throw new Error(`Browser camera request failed: ${describeError(cameraRequestError)}. Check Chrome's site camera permission and close other apps using the camera.`);
                }
                if (error === undefined || error === null) {
                    throw new Error(`MindAR rejected startup without a cause. Secure context: ${window.isSecureContext}; camera API present: ${Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)}; camera request detail unavailable.`);
                }
                throw new Error(`MindAR camera startup failed: ${describeError(error)}`);
            })
            .finally(restoreGetUserMedia);

        const timeP = new Promise((_, reject) => {
            cameraTimeout = setTimeout(() => {
                reject(new Error("Camera startup timed out after 20 seconds. Allow the browser camera prompt, then retry."));
            }, 20000);
        });

        try {
            await Promise.race([startP, timeP]);
        } finally {
            clearTimeout(cameraTimeout);
        }

        resetMsgTimer();

        statusCb("Ready.");
        doneCb(); 

        renderer.setAnimationLoop(() => {
            for (const { item, gltf } of loadedModels) {
                const pivot = modelPivots.get(item.id);
                if (gltf && pivot && item.rotate !== false) {
                    pivot.rotation.y += Number(item.rotationSpeed ?? 0.01);
                }
            }
            renderer.render(scene, camera);
        });

    } catch (err) {
        const detail = describeError(err);
        console.error(`AR initialization failed during "${stage}".`, err);
        statusCb(`ERROR [${stage}]: ${detail}`);

        // Allow another attempt after a startup failure.
        const btnStart = document.querySelector("#btnStart");
        if (btnStart) btnStart.disabled = false;

        alert(`AR startup failed during "${stage}".\n${detail}`);
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
