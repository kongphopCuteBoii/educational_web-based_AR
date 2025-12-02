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
    startButton.innerText = "Loading...";
    startButton.disabled = true;

    try {
        console.log("Initializing MindAR...");
        mindarThree = new MindARThree({
            container: container,
            imageTargetSrc: './markers/markers.mind',
            maxTrack: 5, 
        });

        const { renderer, scene, camera } = mindarThree;

        // --- COMMENT THIS OUT TEMPORARILY ---
        // const h2o = await loadGLTF('./models/h2o.glb');
        // ... comment out all models ...
        // ... comment out all anchor.group.add ...
        // ------------------------------------

        // Just add a simple box to test
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshNormalMaterial();
        const box = new THREE.Mesh(geometry, material);
        const anchor = mindarThree.addAnchor(0);
        anchor.group.add(box);

        console.log("Starting AR Engine...");
        await mindarThree.start(); // <--- Is it stuck here?
        
        renderer.setAnimationLoop(() => {
            renderer.render(scene, camera);
        });

        startButton.innerText = "AR Running";

    } catch (err) {
        console.error(err);
        alert("ERROR: " + err);
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

