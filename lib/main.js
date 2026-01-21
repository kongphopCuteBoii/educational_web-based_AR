import * as THREE from 'three';
import { GLTFLoader } from 'gltfloader';
import { MindARThree } from 'mindar-image-three';

window.runAR = start;
window.killAR = stop;

console.log("Main.js Ready.");

let mindar = null;
const container = document.querySelector("#container");

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

async function start(statusCb, doneCb) {
    try {
        statusCb("Initializing Engine...");
        
        mindar = new MindARThree({
            container: container,
            imageTargetSrc: './markers/markers.mind',
            maxTrack: 5,
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

        const a0 = mindar.addAnchor(0);
        if(h2o) { h2o.scene.scale.set(2.0, 2.0, 2.0); a0.group.add(h2o.scene); }

        const a1 = mindar.addAnchor(1);
        if(ar18) { ar18.scene.scale.set(0.175, 0.175, 0.175); a1.group.add(ar18.scene); }

        const a2 = mindar.addAnchor(2);
        if(sat) { sat.scene.scale.set(0.3, 0.3, 0.3); a2.group.add(sat.scene); }

        const a3 = mindar.addAnchor(3);
        if(sun) { sun.scene.scale.set(5.0, 5.0, 5.0); a3.group.add(sun.scene); }

        const a4 = mindar.addAnchor(4);
        if(cam) { cam.scene.scale.set(0.5, 0.5, 0.5); a4.group.add(cam.scene); }

        statusCb("Waiting for Camera...");
        
        const startP = mindar.start();
        const timeP = new Promise((_, reject) => setTimeout(() => reject("Camera permission timed out."), 20000));

        await Promise.race([startP, timeP]);

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
    }
}
