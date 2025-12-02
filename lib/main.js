import * as THREE from 'three';
import { GLTFLoader } from 'gltfloader';
import { MindARThree } from 'mindar-image-three';

const loadGLTF = (path) => {
    return new Promise((resolve, reject) => {
        const loader = new GLTFLoader();
        console.log(`Attempting to load: ${path}`); // Debug log
        loader.load(path, (gltf) => {
            console.log(`Loaded: ${path}`); // Debug log
            resolve(gltf);
        }, undefined, (error) => {
            // This will tell us specifically which model failed
            reject(`Failed to load model: ${path}. Make sure the file is in the folder and the name matches EXACTLY.`);
        });
    })
}

document.addEventListener('DOMContentLoaded', () => {
    const startButton = document.querySelector("#startButton");
    const stopButton = document.querySelector("#stopButton");
    const container = document.querySelector("#container");

    let mindarThree = null;

    const start = async () => {
        // Disable button to prevent double clicking
        startButton.innerText = "Loading...";
        startButton.disabled = true;

        try {
            // 1. Initialize MindAR
            console.log("Initializing MindAR...");
            mindarThree = new MindARThree({
                container: container,
                imageTargetSrc: './markers/markers.mind',
                maxTrack: 5, // Changed to 5 to match your 5 anchors
            });

            const { renderer, scene, camera } = mindarThree;

            const light = new THREE.HemisphereLight(0xffffff, 0xffffff, 1);
            scene.add(light);

            // 2. Load Models (With Error Catching)
            // If one of these fails, the code jumps to the 'catch' block below
            const h2o = await loadGLTF('./models/h2o.glb');
            h2o.scene.scale.set(0.5, 0.5, 0.5);

            const ar18 = await loadGLTF('./models/ar18.glb');
            ar18.scene.scale.set(0.5, 0.5, 0.5);

            const saturn = await loadGLTF('./models/saturn.glb');
            saturn.scene.scale.set(0.5, 0.5, 0.5);

            const sun = await loadGLTF('./models/sun.glb');
            sun.scene.scale.set(0.5, 0.5, 0.5);

            const camel = await loadGLTF('./models/camel.glb');
            camel.scene.scale.set(0.5, 0.5, 0.5);

            // 3. Create Anchors
            const h20A = mindarThree.addAnchor(0);
            h20A.group.add(h2o.scene);

            const ar18A = mindarThree.addAnchor(1);
            ar18A.group.add(ar18.scene);

            const saturnA = mindarThree.addAnchor(2);
            saturnA.group.add(saturn.scene);

            const sunA = mindarThree.addAnchor(3);
            sunA.group.add(sun.scene);

            const camelA = mindarThree.addAnchor(4);
            camelA.group.add(camel.scene);

            // 4. Start AR
            console.log("Starting AR Engine...");
            await mindarThree.start();
            
            renderer.setAnimationLoop(() => {
                renderer.render(scene, camera);
            });

            startButton.innerText = "AR Running";

        } catch (err) {
            // THIS IS THE IMPORTANT PART
            // It will alert the exact error on your phone screen
            console.error(err);
            alert("ERROR: " + err);
            startButton.innerText = "Start AR";
            startButton.disabled = false;
        }
    }

    const stop = () => {
        if (mindarThree) {
            mindarThree.stop();
            mindarThree.renderer.setAnimationLoop(null);
            container.innerHTML = ""; // Clear the canvas
        }
    }

    startButton.addEventListener("click", () => {
        start();
    });

    stopButton.addEventListener("click", () => {
        stop();
    });
});
