import * as THREE from 'three';
import { GLTFLoader } from 'gltfloader';
import { MindARThree } from 'mindar-image-three';

// Flag to tell HTML we exist
window.AR_ENGINE_READY = true;
console.log("Main.js has loaded!");

const loadGLTF = (path) => {
    return new Promise((resolve, reject) => {
        const loader = new GLTFLoader();
        loader.load(path, (gltf) => resolve(gltf), undefined, (err) => reject(err));
    })
}

// References
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
        });

        const { renderer, scene, camera } = mindarThree;

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 2);
        dirLight.position.set(5, 10, 7);
        scene.add(dirLight);

        // Load Models (Safe)
        let h2o, ar18, saturn, sun, camel;
        
        try { h2o = await loadGLTF('./models/h2o.glb'); } catch(e){ console.warn("H2O missing"); }
        try { ar18 = await loadGLTF('./models/ar18.glb'); } catch(e){ console.warn("AR18 missing"); }
        try { saturn = await loadGLTF('./models/saturn.glb'); } catch(e){ console.warn("Saturn missing"); }
        try { sun = await loadGLTF('./models/sun.glb'); } catch(e){ console.warn("Sun missing"); }
        try { camel = await loadGLTF('./models/camel.glb'); } catch(e){ console.warn("Camel missing"); }

        // Setup Anchors
        const addModel = (index, model) => {
            const anchor = mindarThree.addAnchor(index);
            if(model) {
                model.scene.scale.set(0.5, 0.5, 0.5);
                anchor.group.add(model.scene);
            }
        }

        addModel(0, h2o);
        addModel(1, ar18);
        addModel(2, saturn);
        addModel(3, sun);
        addModel(4, camel);

        // Start
        await mindarThree.start();
        
        // Hide UI
        if(window.hideLanding) window.hideLanding();

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

// Event Listeners
if(startButton) startButton.addEventListener("click", start);
if(stopButton) stopButton.addEventListener("click", stop);
