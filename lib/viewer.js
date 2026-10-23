import * as THREE from 'three';
import { GLTFLoader } from 'gltfloader';

const panel = document.getElementById('modelViewer');
const canvasHost = document.getElementById('viewerCanvas');
const modelSelect = document.getElementById('viewerModel');
const status = document.getElementById('viewerStatus');
const loader = new GLTFLoader();
const sources = {
  h2o: ['./models/h2o.glb', 'H₂O'],
  ar18: ['./models/ar18.glb', 'AR18'],
  saturn: ['./models/saturn.glb', 'Saturn'],
  sun: ['./models/sun.glb', 'Sun'],
  camel: ['./models/camel_r.glb', 'Camel']
};

let renderer, scene, camera, objectPivot, currentKey = '';
let frameStarted = false;
let loadToken = 0;
let dragPointer = null;
let lastX = 0, lastY = 0, pinchDistance = 0;
let targetZoom = 3.2;

function init() {
  if (renderer) return;
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x101114);
  camera = new THREE.PerspectiveCamera(38, 1, 0.01, 1000);
  camera.position.set(0, 0, targetZoom);
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  canvasHost.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xdce8ff, 0x29232a, 2.0));
  const key = new THREE.DirectionalLight(0xffffff, 2.5);
  key.position.set(4, 6, 5);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x8aaaff, 1.1);
  fill.position.set(-5, 1, -3);
  scene.add(fill);

  objectPivot = new THREE.Group();
  scene.add(objectPivot);
  resize();
  window.addEventListener('resize', resize);
  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerup', onPointerUp);
  renderer.domElement.addEventListener('pointercancel', onPointerUp);
  renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
  renderer.domElement.addEventListener('touchmove', onTouchMove, { passive: false });
  document.getElementById('viewerReset').addEventListener('click', resetView);
  document.getElementById('viewerZoomIn').addEventListener('click', () => zoomBy(0.8));
  document.getElementById('viewerZoomOut').addEventListener('click', () => zoomBy(1.25));
  document.getElementById('btnViewerClose').addEventListener('click', close);
  modelSelect.addEventListener('change', () => loadSelected());
  window.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });
}

function resize() {
  if (!renderer || !panel) return;
  const width = Math.max(1, canvasHost.clientWidth);
  const height = Math.max(1, canvasHost.clientHeight);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function open() {
  init();
  panel.style.display = 'block';
  document.getElementById('landingPage').style.visibility = 'hidden';
  resize();
  if (!frameStarted) {
    frameStarted = true;
    renderer.setAnimationLoop(() => {
      camera.position.z += (targetZoom - camera.position.z) * 0.18;
      renderer.render(scene, camera);
    });
  }
  loadSelected();
}

function close() {
  panel.style.display = 'none';
  document.getElementById('landingPage').style.visibility = '';
}

function loadSelected() {
  const key = modelSelect.value;
  if (key === currentKey && objectPivot.children.length) return;
  const token = ++loadToken;
  currentKey = key;
  status.textContent = 'กำลังโหลด ' + sources[key][1] + '…';
  loader.load(sources[key][0], (gltf) => {
    if (token !== loadToken) return;
    objectPivot.clear();
    const model = gltf.scene;
    model.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    model.position.sub(center);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    model.scale.multiplyScalar(1.8 / maxDim);
    objectPivot.add(model);
    resetView();
    status.textContent = sources[key][1] + ' · พร้อมตรวจสอบ';
  }, undefined, (error) => {
    if (token !== loadToken) return;
    console.error('Model viewer failed to load', error);
    status.textContent = 'โหลดไม่สำเร็จ ลองเลือกโมเดลอีกครั้ง';
  });
}

function resetView() {
  if (objectPivot) objectPivot.rotation.set(-0.12, 0.45, 0);
  targetZoom = 3.2;
}

function zoomBy(factor) {
  targetZoom = THREE.MathUtils.clamp(targetZoom * factor, 1.25, 12);
}

function onPointerDown(event) {
  renderer.domElement.setPointerCapture?.(event.pointerId);
  dragPointer = event.pointerId;
  lastX = event.clientX;
  lastY = event.clientY;
}

function onPointerMove(event) {
  if (dragPointer !== event.pointerId || !objectPivot) return;
  const dx = event.clientX - lastX;
  const dy = event.clientY - lastY;
  objectPivot.rotation.y += dx * 0.009;
  objectPivot.rotation.x = THREE.MathUtils.clamp(objectPivot.rotation.x + dy * 0.009, -Math.PI, Math.PI);
  lastX = event.clientX;
  lastY = event.clientY;
}

function onPointerUp(event) {
  if (dragPointer === event.pointerId) dragPointer = null;
  pinchDistance = 0;
}

function onWheel(event) {
  event.preventDefault();
  zoomBy(event.deltaY > 0 ? 1.12 : 0.89);
}

function onTouchMove(event) {
  if (event.touches.length !== 2) return;
  event.preventDefault();
  const dx = event.touches[0].clientX - event.touches[1].clientX;
  const dy = event.touches[0].clientY - event.touches[1].clientY;
  const distance = Math.hypot(dx, dy);
  if (pinchDistance) zoomBy(pinchDistance > distance ? 1.04 : 0.96);
  pinchDistance = distance;
}

window.openModelViewer = open;
