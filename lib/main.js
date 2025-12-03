import * as THREE from 'three';
import { GLTFLoader } from 'gltfloader';
import { MindARThree } from 'mindar-image-three';

// Helper to load GLTF
const loadGLTF = (path) => {
    return new Promise((resolve, reject) => {
        const loader = new GLTFLoader();
        loader.load(path, (gltf) => {
            console.log(`Loaded: ${path}`);
            resolve(gltf);
        }, undefined, (error) => {
            reject(`Failed to load: ${path}`);
        });
    })
}

document.addEventListener('DOMContentLoaded', () => {
    const startButton = document.querySelector("#startButton");
    const stopButton = document.querySelector("#stopButton");
    const container = document.querySelector("#container");

    let mindarThree = null;

    const start = async () => {
        startButton.innerText = "Loading Models...";
        startButton.disabled = true;

        try {
            mindarThree = new MindARThree({
                container: container,
                imageTargetSrc: './markers/markers.mind',
                maxTrack: 5, // We have 5 anchors (0 to 4)
            });

            const { renderer, scene, camera } = mindarThree;

            // Add Light
            // 1. Ambient Light: Soft white light everywhere so shadows aren't pitch black
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.3); // 0.3 intensity
            scene.add(ambientLight);

            // 2. Directional Light: The "Sun". Creates the 3D look.
            const dirLight = new THREE.DirectionalLight(0xffffff, 1); // 1.0 intensity
            dirLight.position.set(5, 10, 7); // Light coming from top-right
            scene.add(dirLight);

            const backLight = new THREE.DirectionalLight(0xffffff, 1);
            backLight.position.set(-5, -5, -5);
            scene.add(backLight);

            // --- SAFELY LOAD MODELS ---
            // We use try/catch for each one. If Saturn fails, the app won't crash.
            
            let h2o = null, ar18 = null, saturn = null, sun = null, camel = null;

            try { h2o = await loadGLTF('./models/h2o.glb'); } catch(e) { console.error(e); }
            try { ar18 = await loadGLTF('./models/ar18.glb'); } catch(e) { console.error(e); }
            try { saturn = await loadGLTF('./models/saturn.glb'); } catch(e) { console.error(e); }
            try { sun = await loadGLTF('./models/sun.glb'); } catch(e) { console.error(e); }
            try { camel = await loadGLTF('./models/camel_r.glb'); } catch(e) { console.error(e); }

            // --- SETUP ANCHORS ---

            // Anchor 0
            const anchor0 = mindarThree.addAnchor(0);
            if (h2o) {
                h2o.scene.scale.set(1.0, 1.0, 1.0); 
                anchor0.group.add(h2o.scene);
            }

            // Anchor 1
            const anchor1 = mindarThree.addAnchor(1);
            if (ar18) {
                ar18.scene.scale.set(0.2, 0.2, 0.2);
                anchor1.group.add(ar18.scene);
            }

            // Anchor 2
            const anchor2 = mindarThree.addAnchor(2);
            if (saturn) {
                saturn.scene.scale.set(0.5, 0.5, 0.5);
                anchor2.group.add(saturn.scene);
            }

            // Anchor 3
            const anchor3 = mindarThree.addAnchor(3);
            if (sun) {
                sun.scene.scale.set(5.0, 5.0, 5.0);
                anchor3.group.add(sun.scene);
            }

            // Anchor 4
            const anchor4 = mindarThree.addAnchor(4);
            if (camel) {
                camel.scene.scale.set(0.5, 0.5, 0.5);
                anchor4.group.add(camel.scene);
            }

            console.log("Starting AR Engine...");
            await mindarThree.start();
            
            renderer.setAnimationLoop(() => {
                // Rotate models slightly every frame (if they are loaded)
                // Y-axis is usually the "Spinning top" axis
                if (h2o) h2o.scene.rotation.y += 0.01;
                if (ar18) ar18.scene.rotation.y += 0.01;
                if (saturn) saturn.scene.rotation.y += 0.005; // Spin slower
                if (sun) sun.scene.rotation.y += 0.002;
                if (camel) camel.scene.rotation.y += 0.01;

                renderer.render(scene, camera);
            });

            startButton.innerText = "AR Running";

        } catch (err) {
            console.error("CRITICAL ERROR:", err);
            alert("Error: " + err);
            startButton.innerText = "Start AR";
            startButton.disabled = false;
        }
    }

    const stop = () => {
        if (mindarThree) {
            mindarThree.stop();
            mindarThree.renderer.setAnimationLoop(null);
            container.innerHTML = "";
            startButton.innerText = "Start AR";
            startButton.disabled = false;
        }
    }

    startButton.addEventListener("click", () => {
        start();
    });

    stopButton.addEventListener("click", () => {
        stop();
    });
});




