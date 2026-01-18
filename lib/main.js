import * as THREE from 'three';
import { GLTFLoader } from 'gltfloader';
import { MindARThree } from 'mindar-image-three';

// --- GLOBAL EXPORTS ---
// Allow HTML to call these functions
window.startARSystem = start;
window.stopARSystem = stop;

console.log("Main.js Loaded. Waiting for user command.");

// --- VARIABLES ---
let mindarThree = null;
const container = document.querySelector("#container");

// --- HELPER: LOAD MODEL ---
const loadGLTF = (path) => {
    return new Promise((resolve, reject) => {
        const loader = new GLTFLoader();
        loader.load(path, (gltf) => resolve(gltf), undefined, (err) => reject(err));
    })
}

// --- MAIN START FUNCTION ---
// updateStatus = function from HTML to change text
// onComplete = function from HTML to hide landing page
async function start(updateStatus, onComplete) {
    try {
        updateStatus("Initializing MindAR Engine...");
        
        mindarThree = new MindARThree({
            container: container,
            imageTargetSrc: './markers/markers.mind', // Check this path!
            maxTrack: 5,
            filterMinCF: 0.0001, 
            filterBeta: 0.001,
            warmupTolerance: 5,
            missTolerance: 5
        });

        const { renderer, scene, camera } = mindarThree;

        // Renderer Fixes
        updateStatus("Configuring Renderer...");
        renderer.outputEncoding = THREE.sRGBEncoding;
        renderer.physicallyCorrectLights = true;

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 1);
        scene.add(ambientLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 4);
        dirLight.position.set(5, 10, 7);
        scene.add(dirLight);

        // Load Models
        updateStatus("Loading 3D Assets (0/5)...");
        
        let h2o, ar18, saturn, sun, camel;

        try { 
            h2o = await loadGLTF('./models/h2o.glb'); 
            updateStatus("Loading 3D Assets (1/5)...");
        } catch(e){ console.warn("H2O missing"); }

        try { 
            ar18 = await loadGLTF('./models/ar18.glb');
            updateStatus("Loading 3D Assets (2/5)...");
        } catch(e){ console.warn("AR18 missing"); }

        try { 
            saturn = await loadGLTF('./models/saturn.glb'); 
            updateStatus("Loading 3D Assets (3/5)...");
        } catch(e){ console.warn("Saturn missing"); }

        try { 
            sun = await loadGLTF('./models/sun.glb'); 
            updateStatus("Loading 3D Assets (4/5)...");
        } catch(e){ console.warn("Sun missing"); }

        try { 
            camel = await loadGLTF('./models/camel_r.glb'); 
            updateStatus("Loading 3D Assets (5/5)...");
        } catch(e){ console.warn("Camel missing"); }


        // Setup Anchors
        updateStatus("Configuring Anchors...");
        
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

        // START CAMERA
        updateStatus("Requesting Camera Access...");
        console.log("Calling mindarThree.start()...");
        
        // Use a race condition to detect if camera fails silently
        const startPromise = mindarThree.start();
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject("Camera Timeout - Check Permissions"), 15000)
        );

        await Promise.race([startPromise, timeoutPromise]);

        // If we get here, camera is running
        updateStatus("System Online.");
        onComplete(); // Hide UI

        // Loop
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
        updateStatus("[CRITICAL ERROR]: " + err);
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
