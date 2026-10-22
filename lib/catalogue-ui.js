import * as THREE from 'three';
import { GLTFLoader } from 'gltfloader';
import { DRACOLoader } from 'dracoloader';
import { searchAssets } from './model-provider.js?v=f7dca9bd';
const overlay = document.querySelector('#catalogueOverlay');
const openButton = document.querySelector('#catalogueOpen');
const closeButton = document.querySelector('#catalogueClose');
const form = document.querySelector('#catalogueSearchForm');
const queryInput = document.querySelector('#catalogueQuery');
const status = document.querySelector('#catalogueStatus');
const grid = document.querySelector('#catalogueGrid');
const moreButton = document.querySelector('#catalogueMore');
const previewStatus = document.querySelector('#cataloguePreviewStatus');
const previewHost = document.querySelector('#catalogueModelPreview');

let currentQuery = '';
let currentPage = 1;
let hasMore = false;
let busy = false;
let previewRenderer = null;
let previewScene = null;
let previewCamera = null;
let previewModel = null;
let previewFrame = 0;
let loadSequence = 0;
const cache = new Map();

window.setCatalogueARStatus = (message) => {
    if (previewStatus) previewStatus.textContent = message;
};

openButton.addEventListener('click', () => {
    overlay.classList.add('open');
    queryInput.focus();
});
closeButton.addEventListener('click', () => overlay.classList.remove('open'));
overlay.addEventListener('click', (event) => {
    if (event.target === overlay) overlay.classList.remove('open');
});

function disposePreviewModel() {
    if (!previewModel) return;
    previewScene.remove(previewModel);
    previewModel.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            materials.forEach((material) => {
                for (const value of Object.values(material)) {
                    if (value && value.isTexture) value.dispose();
                }
                material.dispose();
            });
        }
    });
    previewModel = null;
}

function ensurePreview() {
    if (previewRenderer) return;
    previewScene = new THREE.Scene();
    previewScene.background = new THREE.Color(0x11141b);
    previewCamera = new THREE.PerspectiveCamera(38, 1, 0.01, 1000);
    previewCamera.position.set(2.4, 1.7, 3.2);
    previewScene.add(new THREE.HemisphereLight(0xffffff, 0x596078, 2));
    const keyLight = new THREE.DirectionalLight(0xffffff, 3);
    keyLight.position.set(3, 5, 4);
    previewScene.add(keyLight);
    previewRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    previewRenderer.setSize(Math.max(1, previewHost.clientWidth), Math.max(1, previewHost.clientHeight));
    previewRenderer.outputEncoding = THREE.sRGBEncoding;
    previewHost.replaceChildren(previewRenderer.domElement);
    const resize = () => {
        if (!previewRenderer || !previewHost.isConnected) return;
        const width = Math.max(1, previewHost.clientWidth);
        const height = Math.max(1, previewHost.clientHeight);
        previewCamera.aspect = width / height;
        previewCamera.updateProjectionMatrix();
        previewRenderer.setSize(width, height);
    };
    window.addEventListener('resize', resize);
    previewFrame = window.setInterval(() => {
        if (previewModel) previewModel.rotation.y += 0.006;
        previewRenderer.render(previewScene, previewCamera);
    }, 1000 / 30);
    resize();
}

async function loadSelectedModel(asset) {
    const sequence = ++loadSequence;
    if (!asset.modelUrl) {
        previewStatus.textContent = 'Cannot load: no direct model file URL was provided.';
        return;
    }
    previewStatus.textContent = 'Loading GLB into Three.js…';
    try {
        ensurePreview();
        disposePreviewModel();
        const loader = new GLTFLoader();
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
        loader.setDRACOLoader(dracoLoader);
        const gltf = await new Promise((resolve, reject) => {
            loader.load(asset.modelUrl, resolve, undefined, reject);
        });
        if (sequence !== loadSequence) {
            gltf.scene.traverse((object) => {
                if (object.geometry) object.geometry.dispose();
                if (object.material) {
                    const materials = Array.isArray(object.material) ? object.material : [object.material];
                    materials.forEach((material) => material.dispose());
                }
            });
            return;
        }
        previewModel = gltf.scene;
        previewModel.updateMatrixWorld(true);
        const bounds = new THREE.Box3().setFromObject(previewModel);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        bounds.getSize(size);
        bounds.getCenter(center);
        const maxDimension = Math.max(size.x, size.y, size.z);
        if (maxDimension > 0) {
            previewModel.position.sub(center);
            previewModel.scale.setScalar(2 / maxDimension);
        }
        previewScene.add(previewModel);
        previewCamera.position.set(2.4, 1.7, 3.2);
        previewCamera.lookAt(0, 0, 0);
        previewStatus.textContent = 'Loaded successfully · ' + asset.title + ' · GLTFLoader accepted the model URL.';
    } catch (error) {
        if (sequence !== loadSequence) return;
        previewStatus.textContent = 'Model load failed: ' + (error?.message || String(error)) + '. The host may block cross-origin loading, or the file may use an unsupported compression format.';
    }
}

function renderAssets(assets, append = false) {
    if (!append) grid.replaceChildren();
    assets.forEach((asset) => {
        const card = document.createElement('article');
        card.className = 'assetCard';
        const preview = document.createElement('div');
        preview.className = 'assetPreview';
        preview.textContent = '◇';
        if (asset.preview) {
            const image = document.createElement('img');
            image.loading = 'lazy';
            image.alt = '';
            image.src = asset.preview;
            image.onerror = () => { image.remove(); preview.textContent = '◇'; };
            preview.replaceChildren(image);
        }
        const body = document.createElement('div');
        body.className = 'assetBody';
        const title = document.createElement('h3');
        title.className = 'assetTitle';
        title.textContent = asset.title;
        const summary = document.createElement('p');
        summary.className = 'assetSummary';
        summary.textContent = asset.summary;
        const source = document.createElement('p');
        source.className = 'assetSummary';
        source.textContent = (asset.source || 'External source') + ' · ' + (asset.license || 'License not specified');
        const actions = document.createElement('div');
        actions.className = 'assetActions';
        const select = document.createElement('button');
        select.type = 'button';
        select.className = 'assetSelect';
        select.textContent = 'Select + Load';
        select.disabled = !asset.modelUrl;
        select.title = asset.modelUrl ? 'Load this model into the Three.js preview' : 'No direct model file is available';
        select.addEventListener('click', async () => {
            if (!asset.modelUrl) {
                status.textContent = 'This candidate has no direct model file, so it cannot enter the display pipeline.';
                return;
            }
            grid.querySelectorAll('.assetSelect').forEach((button) => { button.textContent = 'Select + Load'; });
            select.textContent = 'Loading…';
            await loadSelectedModel(asset);
            if (previewStatus.textContent.startsWith('Model load failed:')) {
                status.textContent = 'Could not select "' + asset.title + '": the GLB failed to load into Three.js.';
                select.textContent = 'Load failed';
                return;
            }
            window.dispatchEvent(new CustomEvent('catalogue:model-selected', {
                detail: { ...asset, modelUrl: asset.modelUrl, previewLoaded: true }
            }));
            status.textContent = 'Loaded "' + asset.title + '" into the catalogue preview. Sending selection to the AR viewer…';
            select.textContent = 'Selected ✓';
        });
        actions.appendChild(select);
        if (asset.assetUrl) {
            const link = document.createElement('a');
            link.href = asset.assetUrl;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = 'Details ↗';
            actions.appendChild(link);
        }
        body.append(title, summary, source, actions);
        card.append(preview, body);
        grid.appendChild(card);
    });
}

async function search(nextPage = 1) {
    const query = queryInput.value.trim();
    if (!query || busy) return;
    if (nextPage === 1) {
        currentQuery = query;
        grid.replaceChildren();
    }
    busy = true;
    moreButton.style.display = 'none';
    status.textContent = nextPage === 1 ? 'Searching catalogue…' : 'Loading more models…';
    try {
        const key = currentQuery.toLowerCase() + '::' + nextPage;
        let result = cache.get(key);
        if (!result) {
            result = await searchAssets(currentQuery, { page: nextPage, limit: 24 });
            cache.set(key, result);
        }
        renderAssets(result.assets, nextPage > 1);
        currentPage = result.page;
        hasMore = result.hasMore;
        status.textContent = result.notice || (result.assets.length
            ? 'Found ' + result.assets.length + ' candidate(s)' + (hasMore ? ' · more available' : '') + ' for "' + currentQuery + '".'
            : 'No models found for "' + currentQuery + '". Try another search term.');
        if (result.externalSearchUrl) {
            const link = document.createElement('a');
            link.href = result.externalSearchUrl;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = ' Browse NIH 3D results for “' + currentQuery + '” ↗';
            link.style.color = '#a5b4fc';
            link.style.display = 'inline-block';
            link.style.marginLeft = '0.35rem';
            status.appendChild(link);
        }
        moreButton.style.display = hasMore ? 'block' : 'none';
    } catch (error) {
        status.textContent = 'Could not search the catalogue: ' + error.message + '. Check your connection and try again.';
    } finally {
        busy = false;
    }
}

form.addEventListener('submit', (event) => {
    event.preventDefault();
    search(1);
});
moreButton.addEventListener('click', () => {
    if (hasMore) search(currentPage + 1);
});
