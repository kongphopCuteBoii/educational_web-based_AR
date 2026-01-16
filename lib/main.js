import * as THREE from 'three';
import { GLTFLoader } from 'gltfloader';
import { MindARThree } from 'mindar-image-three';

// --- HELPER FUNCTION: LOAD GLTF MODELS ---
const loadGLTF = (path) => {
    return new Promise((resolve, reject) => {
        const loader = new GLTFLoader();
        loader.load(path, (gltf) => {
            console.log(`Successfully loaded: ${path}`);
            resolve(gltf);
        }, undefined, (error) => {
            console.warn(`Error loading ${path} - skipping this model.`);
            reject(error);
        });
    })
}

document.addEventListener('DOMContentLoaded', () => {
    // 1. Get references to UI elements
    const startButton = document.querySelector("#startButton");
    const stopButton = document.querySelector("#stopButton");
    const container = document.querySelector("#container");
    
    // UI Panels
    const landingPage = document.querySelector("#landing-page");
    const arInterface = document.querySelector("#ar-interface");
    
    // UI Text/Spinner inside the button
    const btnText = document.querySelector(".btn-text");
    const spinner = document.querySelector(".spinner");

    let mindarThree = null;

    // --- START AR FUNCTION ---
    const start = async () => {
        
        // Safety: Prevent double clicks
        startButton.disabled = true;

        try {
            // 2. Initialize MindAR
            mindarThree = new MindARThree({
                container: container,
                imageTargetSrc: './markers/markers.mind', // Ensure this path is correct
                maxTrack: 5, // We are tracking 5 targets (Index 0-4)
            });

            const { renderer, scene, camera } = mindarThree;

            // 3. Add Studio Lighting (Better than HemisphereLight)
            // Soft base light
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.3); 
            scene.add(ambientLight);

            // Strong "Sun" light from top-right
            const dirLight = new THREE.DirectionalLight(0xffffff, 2); 
            dirLight.position.set(5, 10, 7); 
            scene.add(dirLight);
            
            // Backlight for edge definition
            const backLight = new THREE.DirectionalLight(0xffffff, 1);
            backLight.position.set(-5, -5, -5);
            scene.add(backLight);

            // 4. Load Models Safely (Try/Catch for each)
            let h2o = null, ar18 = null, saturn = null, sun = null, camel = null;

            try { h2o = await loadGLTF('./models/h2o.glb'); } catch(e) {}
            try { ar18 = aw
