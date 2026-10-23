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
let targetZoom = 3.8;
let zoomSensitivity = 1;
let panSensitivity = 1;
const cameraTarget = new THREE.Vector3(0, 0, 0);
const activePointers = new Map();
let lastPinchCenter = null;

function init() {
  if (renderer) return;
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x101114);
  camera = new THREE.PerspectiveCamera(38, 1, 0.01, 1000);
  camera.position.set(cameraTarget.x, cameraTarget.y, targetZoom);
  camera.lookAt(cameraTarget);
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.display = 'block';
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
  renderer.domElement.style.touchAction = 'none';
  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerup', onPointerUp);
  renderer.domElement.addEventListener('pointercancel', onPointerUp);
  renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
  renderer.domElement.addEventListener('touchstart', onTouchStart, { passive: false });
  renderer.domElement.addEventListener('touchmove', onTouchMove, { passive: false });
  renderer.domElement.addEventListener('touchend', onTouchEnd, { passive: false });
  renderer.domElement.addEventListener('touchcancel', onTouchEnd, { passive: false });
  document.getElementById('viewerReset').addEventListener('click', resetView);
  document.getElementById('viewerZoomIn').addEventListener('click', () => zoomBy(0.8));
  document.getElementById('viewerZoomOut').addEventListener('click', () => zoomBy(1.25));
  document.getElementById('btnViewerClose').addEventListener('click', close);
  modelSelect.addEventListener('change', () => loadSelected());
  const zoomInput = document.getElementById('viewerZoomSensitivity');
  const panInput = document.getElementById('viewerPanSensitivity');
  zoomInput.addEventListener('input', () => {
    zoomSensitivity = Number(zoomInput.value) / 50;
    document.getElementById('viewerZoomValue').value = zoomInput.value;
    document.getElementById('viewerZoomValue').textContent = zoomInput.value;
  });
  panInput.addEventListener('input', () => {
    panSensitivity = Number(panInput.value) / 50;
    document.getElementById('viewerPanValue').value = panInput.value;
    document.getElementById('viewerPanValue').textContent = panInput.value;
  });
  window.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });
}

function resize() {
  if (!renderer || !panel) return;
  const width = Math.max(1, canvasHost.clientWidth);
  const height = Math.max(1, canvasHost.clientHeight);
  renderer.setSize(width, height, true);
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
      camera.position.x += (cameraTarget.x - camera.position.x) * 0.18;
      camera.position.y += (cameraTarget.y - camera.position.y) * 0.18;
      camera.position.z += (targetZoom - camera.position.z) * 0.18;
      camera.lookAt(cameraTarget);
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
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const fitScale = 1.0 / maxDim;
    model.scale.multiplyScalar(fitScale);
    model.position.x -= center.x * fitScale;
    model.position.y -= center.y * fitScale;
    model.position.z -= center.z * fitScale;
    model.updateMatrixWorld(true);
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
  cameraTarget.set(0, 0, 0);
  camera.position.set(0, 0, 3.8);
  camera.lookAt(cameraTarget);
  targetZoom = 3.8;
}

function zoomBy(factor) {
  targetZoom = THREE.MathUtils.clamp(targetZoom * Math.pow(factor, zoomSensitivity), 1.25, 12);
}

function onPointerDown(event) {
  if (event.pointerType === 'touch') return;
  dragPointer = event.pointerId;
  lastX = event.clientX;
  lastY = event.clientY;
  renderer.domElement.setPointerCapture?.(event.pointerId);
}

function onPointerMove(event) {
  if (event.pointerType === 'touch' || dragPointer !== event.pointerId || !objectPivot) return;
  const dx = event.clientX - lastX;
  const dy = event.clientY - lastY;
  objectPivot.rotation.y += dx * 0.009;
  objectPivot.rotation.x = THREE.MathUtils.clamp(objectPivot.rotation.x + dy * 0.009, -Math.PI, Math.PI);
  lastX = event.clientX;
  lastY = event.clientY;
}

function onPointerUp(event) {
  if (dragPointer === event.pointerId) dragPointer = null;
}

function onWheel(event) {
  event.preventDefault();
  zoomBy(event.deltaY > 0 ? 1.12 : 0.89);
}

function touchCenter(touches) {
  return {
    x: (touches[0].clientX + touches[1].clientX) * 0.5,
    y: (touches[0].clientY + touches[1].clientY) * 0.5
  };
}

function onTouchStart(event) {
  event.preventDefault();
  if (event.touches.length === 2) {
    pinchDistance = touchDistance(event.touches);
    lastPinchCenter = touchCenter(event.touches);
  } else {
    pinchDistance = 0;
    lastPinchCenter = null;
    if (event.touches.length === 1) {
      lastX = event.touches[0].clientX;
      lastY = event.touches[0].clientY;
    }
  }
}

function onTouchMove(event) {
  event.preventDefault();
  if (!objectPivot) return;

  if (event.touches.length === 1) {
    const touch = event.touches[0];
    const dx = touch.clientX - lastX;
    const dy = touch.clientY - lastY;
    objectPivot.rotation.y += dx * 0.009;
    objectPivot.rotation.x = THREE.MathUtils.clamp(objectPivot.rotation.x + dy * 0.009, -Math.PI, Math.PI);
    lastX = touch.clientX;
    lastY = touch.clientY;
    pinchDistance = 0;
    lastPinchCenter = null;
    return;
  }

  if (event.touches.length === 2) {
    const distance = touchDistance(event.touches);
    const center = touchCenter(event.touches);
    if (pinchDistance > 0) zoomBy(pinchDistance > distance ? 1.025 : 0.975);
    if (lastPinchCenter) {
      const worldPerPixel = targetZoom * 0.0018 * panSensitivity;
      cameraTarget.x -= (center.x - lastPinchCenter.x) * worldPerPixel;
      cameraTarget.y += (center.y - lastPinchCenter.y) * worldPerPixel;
      const bound = Math.max(1.5, targetZoom * 0.8);
      cameraTarget.x = THREE.MathUtils.clamp(cameraTarget.x, -bound, bound);
      cameraTarget.y = THREE.MathUtils.clamp(cameraTarget.y, -bound, bound);
    }
    pinchDistance = distance;
    lastPinchCenter = center;
  }
}

function onTouchEnd(event) {
  event.preventDefault();
  pinchDistance = 0;
  lastPinchCenter = null;
  if (event.touches.length === 1) {
    lastX = event.touches[0].clientX;
    lastY = event.touches[0].clientY;
  }
}

function touchDistance(touches) {
  return Math.hypot(
    touches[0].clientX - touches[1].clientX,
    touches[0].clientY - touches[1].clientY
  );
}

window.openModelViewer = open;
