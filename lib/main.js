import * as THREE from 'three';
import { GLTFLoader } from 'gltfloader';
import { MindARThree } from 'mindar-image-three';

window.runAR = start;
window.killAR = stop;

console.log("Main.js Ready.");

let mindar = null;
const container = document.querySelector("#container");
let notFoundTimer = null;

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

        statusCb("Waiting for Camera...");
        
        const startP = mindar.start();
        const timeP = new Promise((_, reject) => setTimeout(() => reject("Camera permission timed out."), 20000));

        await Promise.race([startP, timeP]);

        // Start the first 10s timer once camera is ready
        resetMsgTimer();

        statusCb("Ready.");
        doneCb(); 

        renderer.setAnimationLoop(() => {
            const spd = 0.01;
            if(h2o) h2o.scene.rotation.y += spd;
            if(ar18) ar18.scene.rotation.y += spd;
            if(sat) sat.scene.rotation.y += spd;
            if(sun) sun.scene.rotation.y += 0.002;
            if(cam) cam.scene.rotation.y += spd;
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
        clearMsgTimer(); // Kill the timer
    }
}
