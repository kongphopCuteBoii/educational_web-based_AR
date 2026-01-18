import * as THREE from 'three';
import { GLTFLoader } from 'gltfloader';
import { MindARThree } from 'mindar-image-three';

window.startARSystem = start;
window.stopARSystem = stop;

console.log("Main.js Ready.");

let mindarThree = null;
const container = document.querySelector("#container");

// --- HELPER: LOAD WITH PROGRESS ---
const loadGLTF = (path, name, updateCallback) => {
    return new Promise((resolve, reject) => {
        const loader = new GLTFLoader();
        loader.load(
            path, 
            (gltf) => resolve(gltf), 
            // ON PROGRESS CALLBACK
            (xhr) => {
                if (xhr.lengthComputable) {
                    const percent = Math.round((xhr.loaded / xhr.total) * 100);
                    // Update the UI text
                    updateCallback(`Downloading ${name}: ${percent}%`);
                } else {
                    // Fallback if file size unknown
                    const kb = Math.round(xhr.loaded / 1024);
                    updateCallback(`Downloading ${name}: ${kb} KB`);
                }
            }, 
            (err) => reject(err)
        );
    })
}

async function start(updateStatus, onComplete) {
    try {
        updateStatus("Initializing Engine...");
        
        mindarThree = new MindARThree({
            container: container,
            imageTargetSrc: './markers/markers.mind',
            maxTrack: 5,
            filterMinCF: 0.0001, 
            filterBeta: 0.001,
            warmupTolerance: 5,
            missTolerance: 5
        });

        const { renderer, scene, camera } = mindarThree;

        updateStatus("Configuring Renderer...");
        renderer.outputEncoding = THREE.sRGBEncoding;
        renderer.physicallyCorrectLights = true;

        const ambientLight = new THREE.AmbientLight(0xffffff, 1);
        scene.add(ambientLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 4);
        dirLight.position.set(5, 10, 7);
        scene.add(dirLight);

        // --- LOAD MODELS WITH PROGRESS ---
        let h2o, ar18, saturn, sun, camel;

        try { 
            h2o = await loadGLTF('./models/h2o.glb', 'H2O', updateStatus); 
        } catch(e){ console.warn("H2O missing"); }

        try { 
            ar18 = await loadGLTF('./models/ar18.glb', 'AR-18', updateStatus);
        } catch(e){ console.warn("AR18 missing"); }

        try { 
            saturn = await loadGLTF('./models/saturn.glb', 'Saturn', updateStatus); 
        } catch(e){ console.warn("Saturn missing"); }

        try { 
            sun = await loadGLTF('./models/sun.glb', 'Sun', updateStatus); 
        } catch(e){ console.warn("Sun missing"); }

        try { 
            camel = await loadGLTF('./models/camel_r.glb', 'Camel', updateStatus); 
        } catch(e){ console.warn("Camel missing"); }

        
        updateStatus("Finalizing Setup...");

        // Setup Anchors
        const anchor0 = mindarThree.addAnchor(0);
        if(h2o) { h2o.scene.scale.set(2.0, 2.0, 2.0); anchor0.group.add(h2o.scene); }

        const anchor1 = mindarThree.addAnchor(1);
        if(ar18) { ar18.scene.scale.set(0.175, 0.175, 0.175); anchor1.group.add(ar18.scene); }

        const anchor2 = mindarThree.addAnchor(2);
        if(saturn) { saturn.scene.scale.set(0.3, 0.3, 0.3); anchor2.group.add(saturn.scene); }

        const anchor3 = mindarThree.addAnchor(3);
        if(sun) { sun.scene.scale.set(5.0, 5.0, 5.0); anchor3.group.add(sun.scene); }

        const anchor4 = mindarThree.addAnchor(4);
        if(camel) { camel.scene.scale.set(0.5, 0.5, 0.5); anchor4.group.add(camel.scene); }

        updateStatus("Waiting for Camera...");
        
        const startPromise = mindarThree.start();
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject("Camera permission timed out."), 20000)
        );

        await Promise.race([startPromise, timeoutPromise]);

        updateStatus("Ready.");
        onComplete(); 

        renderer.setAnimationLoop(() => {
            const speed = 0.01;
            if(h2o) h2o.scene.rotation.y += speed;
            if(ar18) ar18.scene.rotation.y += speed;
            if(saturn) saturn.scene.rotation.y += speed;
            if(sun) sun.scene.rotation.y += 0.002;
            if(camel) camel.scene.rotation.y += speed;
            renderer.render(scene, camera);
        });

    } catch (err) {
        console.error(err);
        updateStatus("Error: " + err);
        alert("Error: " + err);
    }
}

function stop() {
    if (mindarThree) {
        mindarThree.stop();
        mindarThree.renderer.setAnimationLoop(null);
        container.innerHTML = "";
    }
}
