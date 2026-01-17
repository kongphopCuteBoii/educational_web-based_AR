import * as THREE from 'three';
import { GLTFLoader } from 'gltfloader';
import { MindARThree } from 'mindar-image-three';

window.AR_ENGINE_READY = true;
console.log("Main.js loaded (v147 + Fixed Perspective Lag)");

const loadGLTF = (path) => {
    return new Promise((resolve, reject) => {
        const loader = new GLTFLoader();
        loader.load(path, (gltf) => resolve(gltf), undefined, (err) => reject(err));
    })
}

const container = document.querySelector("#container");
const startButton = document.querySelector("#startButton");
const stopButton = document.querySelector("#stopButton");

let mindarThree = null;

const start = async () => {
    try {
        mindarThree = new MindARThree({
            container: container,
            imageTargetSrc: './markers/markers.mind',
            maxTrack: 5,
            
            // --- FIXED TRACKING SETTINGS ---
            // 1. MinCF: 0.0001 -> Stops the shaking when your hand is still.
            filterMinCF: 0.0001, 
            
            // 2. Beta: 1000 -> Reacts INSTANTLY when you move/tilt. 
            // This prevents the "stretching/lag" effect at angles.
            filterBeta: 1000,

            warmupTolerance: 5,
            missTolerance: 5
        });

        const { renderer, scene, camera } = mindarThree;

        // --- RENDERER QUALITY ---
        renderer.outputEncoding = THREE.sRGBEncoding;
        renderer.physicallyCorrectLights = true;
        // Make it sharp on high-res phone screens
        renderer.setPixelRatio(window.devicePixelRatio); 

        // --- LIGHTING ---
        const ambientLight = new THREE.AmbientLight(0xffffff, 1);
        scene.add(ambientLight);
        
        const dirLight = new THREE.DirectionalLight(0xffffff, 4);
        dirLight.position.set(5, 10, 7);
        scene.add(dirLight);

        // --- LOAD MODELS ---
        let h2o, ar18, saturn, sun, camel;

        try { h2o = await loadGLTF('./models/h2o.glb'); } catch(e){ console.warn("H2O missing"); }
        try { ar18 = await loadGLTF('./models/ar18.glb'); } catch(e){ console.warn("AR18 missing"); }
        try { saturn = await loadGLTF('./models/saturn.glb'); } catch(e){ console.warn("Saturn missing"); }
        try { sun = await loadGLTF('./models/sun.glb'); } catch(e){ console.warn("Sun missing"); }
        try { camel = await loadGLTF('./models/camel_r.glb'); } catch(e){ console.warn("Camel missing"); }

        // --- SETUP ANCHORS & SIZES ---

        // Anchor 0: H2O
        const anchor0 = mindarThree.addAnchor(0);
        if(h2o) {
            h2o.scene.scale.set(2.0, 2.0, 2.0);
            anchor0.group.add(h2o.scene);
        }

        // Anchor 1: AR18
        const anchor1 = mindarThree.addAnchor(1);
        if(ar18) {
            ar18.scene.scale.set(0.175, 0.175, 0.175);
            anchor1.group.add(ar18.scene);
        }

        // Anchor 2: Saturn
        const anchor2 = mindarThree.addAnchor(2);
        if(saturn) {
            saturn.scene.scale.set(0.3, 0.3, 0.3);
            anchor2.group.add(saturn.scene);
        }

        // Anchor 3: Sun
        const anchor3 = mindarThree.addAnchor(3);
        if(sun) {
            sun.scene.scale.set(5.0, 5.0, 5.0);
            anchor3.group.add(sun.scene);
        }

        // Anchor 4: Camel
        const anchor4 = mindarThree.addAnchor(4);
        if(camel) {
            camel.scene.scale.set(0.5, 0.5, 0.5);
            anchor4.group.add(camel.scene);
        }

        console.log("Starting MindAR...");
        await mindarThree.start();
        
        if(window.hideLanding) window.hideLanding();

        // --- ANIMATION LOOP ---
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
        alert("Error: " + err);
        if(window.showLanding) window.showLanding();
    }
}

const stop = () => {
    if (mindarThree) {
        mindarThree.stop();
        mindarThree.renderer.setAnimationLoop(null);
        container.innerHTML = "";
        if(window.showLanding) window.showLanding();
    }
}

if(startButton) startButton.addEventListener("click", start);
if(stopButton) stopButton.addEventListener("click", stop);
