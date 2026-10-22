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
        statusCb("Initializing Engine...");
        
        stage = "creating MindAR engine";
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
        const loadedModels = [];
        const total = content.length;

        for (let i = 0; i < total; i++) {
            const item = content[i];
            try {
                stage = `loading model ${item.title || item.id}`;
                statusCb(`Loading ${item.title || item.id}...`);
                const gltf = await loadModel(item.modelUrl, i + 1, total, statusCb);
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
                gltf.scene.scale.setScalar(Number(item.scale) || 1);
                anc.group.add(gltf.scene);
            }
            anc.onTargetFound = () => { clearMsgTimer(); };
            anc.onTargetLost = () => { resetMsgTimer(); };
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
                if (gltf && item.rotate !== false) {
                    gltf.scene.rotation.y += Number(item.rotationSpeed ?? 0.01);
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
