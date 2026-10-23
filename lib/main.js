import * as THREE from 'three';
import { GLTFLoader } from 'gltfloader';
import { MindARThree } from 'mindar-image-three';

window.runAR = start;
window.killAR = stop;

console.log("Main.js Ready.");

let mindar = null;
const container = document.querySelector("#container");
let notFoundTimer = null;
let motionEnabled = true;
window.setARMotion = (enabled) => { motionEnabled = Boolean(enabled); };

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
        
        // Helper to setup anchor with tracking events
        const setupAnc = (idx, model, scale) => {
            const anc = mindar.addAnchor(idx);
            if(model) {
                model.scene.scale.set(scale, scale, scale);
                anc.group.add(model.scene);
            }
            // Tracking Events
            anc.onTargetFound = () => { clearMsgTimer(); }
            anc.onTargetLost = () => { resetMsgTimer(); }
            anchors.push(anc);
            return anc;
        }

        setupAnc(0, h2o, 2.0);
        setupAnc(1, ar18, 0.175);
        setupAnc(2, sat, 0.3);
        setupAnc(3, sun, 5.0);
        setupAnc(4, cam, 0.5);

        
        // Modest AR Games-inspired interaction: tap a visible model for a brief pulse.
        // The tracked anchor remains fully owned by MindAR; only the GLB root is animated.
        const raycaster = new THREE.Raycaster();
        const pointer = new THREE.Vector2();
        const modelRoots = [h2o, ar18, sat, sun, cam].filter(Boolean).map(model => model.scene);
        const anchorModels = anchors.filter(anchor => anchor.group.children.length > 0).map(anchor => ({ group: anchor.group, model: anchor.group.children[0] }));
        let pulseModel = null;
        let pulseStartedAt = 0;
        let pulseBaseScale = new THREE.Vector3(1, 1, 1);

        const onModelTap = (event) => {
            const bounds = renderer.domElement.getBoundingClientRect();
            if (!bounds.width || !bounds.height) return;
            pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
            pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
            raycaster.setFromCamera(pointer, camera);
            const hits = raycaster.intersectObjects(modelRoots, true);
            let root = null;
            if (hits.length) {
                root = hits[0].object;
                while (root.parent && !modelRoots.includes(root)) root = root.parent;
                if (!modelRoots.includes(root)) root = null;
            }
            // If mobile overlays intercept precise hit-testing, use a currently visible anchor.
            if (!root) {
                const visible = anchorModels.find(entry => entry.group.visible);
                if (visible) root = visible.model;
            }
            if (!root) {
                if (window.showARHint) window.showARHint("มอง Marker ให้กล้องเห็นก่อน แล้วแตะหน้าจอ");
                return;
            }

            pulseModel = root;
            pulseBaseScale.copy(root.scale);
            pulseStartedAt = performance.now();
            if (window.showARHint) window.showARHint("โมเดลตอบสนองแล้ว · แตะอีกครั้งเพื่อเล่นซ้ำ");
        };

        statusCb("Waiting for Camera...");
        
        const startP = mindar.start();
        const timeP = new Promise((_, reject) => setTimeout(() => reject("Camera permission timed out."), 20000));

        await Promise.race([startP, timeP]);

        // Attach interaction only after MindAR has initialized the camera successfully.
        document.addEventListener("pointerdown", onModelTap);
        mindar._portfolioTapHandler = onModelTap;

        // Start the first 10s timer once camera is ready
        resetMsgTimer();

        statusCb("Ready.");
        doneCb(); 

        renderer.setAnimationLoop(() => {
            if (pulseModel) {
                const elapsed = (performance.now() - pulseStartedAt) / 1000;
                if (elapsed >= 0.42) {
                    pulseModel.scale.copy(pulseBaseScale);
                    pulseModel = null;
                } else {
                    const factor = 1 + Math.sin((elapsed / 0.42) * Math.PI) * 0.12;
                    pulseModel.scale.set(
                        pulseBaseScale.x * factor,
                        pulseBaseScale.y * factor,
                        pulseBaseScale.z * factor
                    );
                }
            }
            if (motionEnabled) {
                const spd = 0.006;
                if(h2o) h2o.scene.rotation.y += spd;
                if(ar18) ar18.scene.rotation.y += spd;
                if(sat) sat.scene.rotation.y += spd;
                if(sun) sun.scene.rotation.y += 0.0015;
                if(cam) cam.scene.rotation.y += spd;
            }
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
        if (mindar._portfolioTapHandler && mindar.renderer.domElement) {
            document.removeEventListener("pointerdown", mindar._portfolioTapHandler);
        }
        container.innerHTML = "";
        clearMsgTimer(); // Kill the timer
    }
}
