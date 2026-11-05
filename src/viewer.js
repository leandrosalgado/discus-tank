import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const canvas = document.querySelector('#scene');
const status = document.querySelector('#load-status');
const progress = document.querySelector('#load-progress');
const controlsPanel = document.querySelector('#controls-panel');
const mobileControls = document.querySelector('#mobile-controls');
const categoryNames = { glass: 'Glass panels', cover: 'Sliding cover', housing: 'Filter housing', pipes: 'Pipes & fittings', stand: 'Stand & support', filter: 'External filter' };
const checkboxes = [...document.querySelectorAll('input[data-category]')];
const viewButtons = [...document.querySelectorAll('[data-view]')];
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const views = {
  perspective: { position: [2.65, 1.95, 3.8], up: [0, 1, 0] },
  front: { position: [0, 1, 4.5], up: [0, 1, 0] },
  top: { position: [0, 5.3, .001], up: [0, 0, -1] },
  side: { position: [4.5, 1, 0], up: [0, 1, 0] },
};

function showError(message, error) {
  document.documentElement.dataset.viewerState = 'error';
  status.hidden = true;
  document.querySelector('#error-message').textContent = message;
  document.querySelector('#error-panel').hidden = false;
  console.error(message, error);
}

document.querySelector('#retry').addEventListener('click', () => window.location.reload());
function closeControls() {
  const wasOpen = controlsPanel.classList.contains('is-open');
  mobileControls.setAttribute('aria-expanded', 'false');
  controlsPanel.classList.remove('is-open');
  if (wasOpen) mobileControls.focus({ preventScroll: true });
}
mobileControls.addEventListener('click', () => {
  const open = mobileControls.getAttribute('aria-expanded') !== 'true';
  if (!open) {
    closeControls();
    return;
  }
  mobileControls.setAttribute('aria-expanded', 'true');
  controlsPanel.classList.add('is-open');
  document.querySelector('#close-controls').focus({ preventScroll: true });
});
document.querySelector('#close-controls').addEventListener('click', closeControls);
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeControls();
});

function makeTexture(kind) {
  const image = document.createElement('canvas');
  image.width = image.height = 256;
  const context = image.getContext('2d');
  if (!context) throw new Error('Canvas textures are unavailable.');
  let seed = kind === 'wood' ? 619 : 947;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  context.fillStyle = kind === 'wood' ? '#d5bd98' : '#b5a080';
  context.fillRect(0, 0, 256, 256);
  if (kind === 'wood') {
    for (let y = 0; y < 256; y++) {
      const tone = 95 + Math.round(random() * 55);
      context.strokeStyle = `rgba(${tone},${tone - 22},${tone - 45},${.025 + random() * .08})`;
      context.lineWidth = .4 + random() * .65;
      context.beginPath();
      for (let x = 0; x <= 256; x += 8) {
        const offset = Math.sin(x / 60 + y / 30) * 1.2 + Math.sin(x / 140 + y) * .5;
        if (x === 0) context.moveTo(x, y + offset);
        else context.lineTo(x, y + offset);
      }
      context.stroke();
    }
  } else {
    for (let i = 0; i < 1300; i++) {
      context.save();
      context.translate(random() * 256, random() * 256);
      context.rotate(random() * Math.PI);
      const light = 150 + Math.round(random() * 65);
      context.fillStyle = `rgba(${light + 25},${light + 5},${light - 28},.7)`;
      context.fillRect(-10, -1.5, 5 + random() * 21, 1.5 + random() * 4);
      context.restore();
    }
  }
  const texture = new THREE.CanvasTexture(image);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

async function start() {
  document.documentElement.dataset.viewerState = 'loading';
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (error) {
    showError('WebGL is unavailable. Try a current browser with hardware acceleration enabled.', error);
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, .01, 50);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, .8, 0);
  controls.enableDamping = true;
  controls.dampingFactor = .09;
  controls.minDistance = .7;
  controls.maxDistance = 9;
  controls.maxPolarAngle = Math.PI * .83;
  controls.listenToKeyEvents(canvas);
  const hemi = new THREE.HemisphereLight('#fcfffb', '#9d977d', 1.9);
  scene.add(hemi);
  const key = new THREE.DirectionalLight('#fff8e9', 3.0);
  key.position.set(3.2, 5, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = key.shadow.camera.bottom = -2.6;
  key.shadow.camera.right = key.shadow.camera.top = 2.6;
  key.shadow.camera.near = .1;
  key.shadow.camera.far = 12;
  key.shadow.bias = -.00012;
  key.shadow.normalBias = .018;
  scene.add(key);
  const fill = new THREE.DirectionalLight('#e7f2ef', 1.2);
  fill.position.set(-3, 2, -2);
  scene.add(fill);
  const room = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(room, .04);
  scene.environment = environment.texture;
  scene.environmentIntensity = .35;
  room.dispose();
  pmrem.dispose();
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.ShadowMaterial({ color: '#496353', opacity: .14 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -.006;
  floor.receiveShadow = true;
  scene.add(floor);
  const meshes = [];
  let activeAnimation = null;
  let pendingFrame = false;
  let selectionBox = null;
  const target = new THREE.Vector3(0, .8, 0);
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  function render(time) {
    pendingFrame = false;
    if (activeAnimation) {
      const t = Math.min(1, (time - activeAnimation.start) / 550);
      const eased = 1 - (1 - t) ** 3;
      camera.position.lerpVectors(activeAnimation.from, activeAnimation.to, eased);
      camera.up.lerpVectors(activeAnimation.fromUp, activeAnimation.toUp, eased).normalize();
      controls.target.lerpVectors(activeAnimation.fromTarget, target, eased);
      if (t === 1) activeAnimation = null;
      else requestRender();
    }
    controls.update();
    renderer.render(scene, camera);
  }
  function requestRender() {
    if (!pendingFrame) {
      pendingFrame = true;
      requestAnimationFrame(render);
    }
  }
  function setView(name, instant = false) {
    const view = views[name];
    if (!view) throw new Error(`Unknown viewpoint: ${name}`);
    const position = new THREE.Vector3(...view.position);
    const mobileScale = camera.aspect < 1 ? 1.35 : 1;
    position.sub(target).multiplyScalar(mobileScale).add(target);
    if (instant || reducedMotion) {
      activeAnimation = null;
      camera.position.copy(position);
      camera.up.set(...view.up);
      controls.target.copy(target);
    } else {
      activeAnimation = {
        from: camera.position.clone(), to: position,
        fromUp: camera.up.clone(), toUp: new THREE.Vector3(...view.up),
        fromTarget: controls.target.clone(), start: performance.now(),
      };
    }
    viewButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === name)));
    requestRender();
  }
  function clearSelection() {
    if (selectionBox) {
      scene.remove(selectionBox);
      selectionBox.geometry.dispose();
      selectionBox.material.dispose();
      selectionBox = null;
    }
    document.querySelector('#selection').hidden = true;
    requestRender();
  }
  function updateVisibility() {
    const visible = new Map(checkboxes.map(input => [input.dataset.category, input.checked]));
    meshes.forEach(mesh => { mesh.visible = visible.get(mesh.userData.category) === true; });
    document.documentElement.dataset.visibleCategories = [...visible].filter(([, value]) => value).map(([name]) => name).join(',');
    clearSelection();
    requestRender();
  }
  const resize = () => {
    const { width, height } = canvas.parentElement.getBoundingClientRect();
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    requestRender();
  };
  new ResizeObserver(resize).observe(canvas.parentElement);
  resize();
  setView('perspective', true);
  controls.addEventListener('change', requestRender);
  controls.addEventListener('start', () => {
    activeAnimation = null;
    viewButtons.forEach(button => button.setAttribute('aria-pressed', 'false'));
  });
  viewButtons.forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
  document.querySelector('#reset-view').addEventListener('click', () => setView('perspective'));
  checkboxes.forEach(input => input.addEventListener('change', updateVisibility));
  document.querySelector('#show-all').addEventListener('click', () => {
    checkboxes.forEach(input => { input.checked = true; });
    updateVisibility();
  });
  document.querySelector('#look-inside').addEventListener('click', () => {
    checkboxes.forEach(input => { input.checked = !['glass', 'cover', 'housing'].includes(input.dataset.category); });
    updateVisibility();
    setView('perspective');
    closeControls();
  });
  document.querySelector('#clear-selection').addEventListener('click', clearSelection);
  canvas.addEventListener('keydown', event => {
    if (event.key === 'Escape') clearSelection();
  });
  let pressed = null;
  canvas.addEventListener('pointerdown', event => {
    canvas.focus({ preventScroll: true });
    pressed = { x: event.clientX, y: event.clientY };
  });
  canvas.addEventListener('pointerup', event => {
    if (!pressed || Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y) > 5) return;
    pressed = null;
    const rect = canvas.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const candidates = meshes.filter(mesh => mesh.visible && mesh.material.opacity >= .2);
    const hit = raycaster.intersectObjects(candidates, false)[0];
    clearSelection();
    if (!hit) return;
    selectionBox = new THREE.BoxHelper(hit.object, '#ba9561');
    scene.add(selectionBox);
    document.querySelector('#selection-category').textContent = categoryNames[hit.object.userData.category];
    document.querySelector('#selection-name').textContent = hit.object.name.replaceAll('_', ' ');
    document.querySelector('#selection').hidden = false;
    requestRender();
  });
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    showError('The graphics context was lost. Reload the page to restore the model.', new Error('WebGL context lost'));
  });

  try {
    const model = await new GLTFLoader().loadAsync(new URL('./aquarium.glb', import.meta.url).href, event => {
      progress.textContent = event.total > 0 ? `${Math.round(event.loaded / event.total * 100)}% loaded` : 'Loading geometry...';
    });
    const wood = makeTexture('wood');
    const osb = makeTexture('osb');
    model.scene.traverse(obj => {
      if (!obj.isMesh) return;
      if (!Object.hasOwn(categoryNames, obj.userData.category)) throw new Error('Model contains an unexpected component category.');
      obj.castShadow = obj.material.opacity === 1 && obj.userData.category !== 'glass';
      obj.receiveShadow = obj.material.opacity === 1;
      if (obj.material.transparent) {
        obj.material.depthWrite = false;
        obj.renderOrder = 2;
      }
      if (obj.material.name === 'Timber' || obj.material.name === 'OSB') {
        obj.material.map = obj.material.name === 'Timber' ? wood : osb;
        obj.material.color.set('#ffffff');
        obj.material.needsUpdate = true;
      }
      meshes.push(obj);
    });
    if (!meshes.length) throw new Error('The model contains no renderable geometry.');
    scene.add(model.scene);
    updateVisibility();
    status.hidden = true;
    document.documentElement.dataset.viewerState = 'ready';
    document.documentElement.dataset.meshCount = String(meshes.length);
    requestRender();
  } catch (error) {
    showError('The aquarium model could not be loaded. Check your connection and try again.', error);
  }
}

start().catch(error => showError('The viewer encountered an unexpected error.', error));
