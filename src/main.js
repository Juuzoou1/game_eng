// Entry point: wires the engine together and builds a small demo level.
import { Renderer } from './renderer.js';
import { Camera } from './camera.js';
import { Input } from './input.js';
import { Scene, Entity } from './scene.js';
import { Mesh, buildCube, buildPlane, buildPyramid } from './mesh.js';
import { TexGen, createTexture } from './textures.js';
import { Vec3 } from './math.js';

const canvas = document.getElementById('game');

// Fit the canvas to the window but keep it crisp (CSS upscales the pixels).
function fitCanvas() {
  renderer.resize(window.innerWidth, window.innerHeight);
}

const renderer = new Renderer(canvas, {
  width: 320,
  height: 240,
  fogColor: [0.05, 0.06, 0.11],
  snap: 130,
});
const camera = new Camera();
const input = new Input(canvas);
const scene = new Scene();
const gl = renderer.gl;

window.addEventListener('resize', fitCanvas);
fitCanvas();

// --- assets ---
const tex = {
  grass: createTexture(gl, TexGen.grass(64)),
  brick: createTexture(gl, TexGen.brick(64)),
  metal: createTexture(gl, TexGen.metal(64)),
  crate: createTexture(gl, TexGen.crate(64)),
  checker: createTexture(gl, TexGen.checker(64)),
};

const cubeData = buildCube(1);
const floorData = buildPlane(60, 30);
const pyrData = buildPyramid(1);
const mesh = {
  cube: new Mesh(gl, cubeData.vertices, cubeData.indices),
  floor: new Mesh(gl, floorData.vertices, floorData.indices),
  pyramid: new Mesh(gl, pyrData.vertices, pyrData.indices),
};

// --- level ---
scene.add(new Entity({ mesh: mesh.floor, texture: tex.grass, position: [0, 0, 0] }));

// A ring of crates.
const ringCount = 8;
for (let i = 0; i < ringCount; i++) {
  const a = (i / ringCount) * Math.PI * 2;
  scene.add(new Entity({
    mesh: mesh.cube,
    texture: tex.crate,
    position: [Math.cos(a) * 8, 0.5, Math.sin(a) * 8],
    rotation: [0, a, 0],
  }));
}

// Brick pillars.
for (const x of [-4, 4]) {
  for (const z of [-4, 4]) {
    scene.add(new Entity({
      mesh: mesh.cube,
      texture: tex.brick,
      position: [x, 1.5, z],
      scale: [1, 3, 1],
    }));
  }
}

// A spinning metal pyramid centerpiece that bobs up and down.
scene.add(new Entity({
  mesh: mesh.pyramid,
  texture: tex.metal,
  position: [0, 1.2, 0],
  scale: [2, 2, 2],
  update: (e, dt, t) => {
    e.rotation[1] += dt * 1.2;
    e.position[1] = 1.4 + Math.sin(t * 2) * 0.3;
  },
}));

// A few floating checker cubes that orbit.
for (let i = 0; i < 5; i++) {
  scene.add(new Entity({
    mesh: mesh.cube,
    texture: tex.checker,
    position: [0, 3, 0],
    scale: [0.6, 0.6, 0.6],
    tint: [1, 0.8, 0.8],
    update: ((phase) => (e, dt, t) => {
      const a = t * 0.8 + phase;
      e.position[0] = Math.cos(a) * 4;
      e.position[2] = Math.sin(a) * 4;
      e.position[1] = 3 + Math.sin(t * 1.5 + phase) * 0.8;
      e.rotation[0] += dt;
      e.rotation[1] += dt * 1.3;
    })((i / 5) * Math.PI * 2),
  }));
}

// --- player movement ---
function movePlayer(dt) {
  const [dx, dy] = input.consumeMouse();
  camera.look(dx, dy);

  const speed = (input.down('ShiftLeft') ? 9 : 4.5) * dt;
  const f = camera.forward();
  const flat = Vec3.normalize([f[0], 0, f[2]]);
  const right = camera.right();
  let move = [0, 0, 0];
  if (input.down('KeyW')) move = Vec3.add(move, flat);
  if (input.down('KeyS')) move = Vec3.sub(move, flat);
  if (input.down('KeyD')) move = Vec3.sub(move, right);
  if (input.down('KeyA')) move = Vec3.add(move, right);
  if (Vec3.length(move) > 0) {
    move = Vec3.scale(Vec3.normalize(move), speed);
    camera.position = Vec3.add(camera.position, move);
  }
  // keep the player on the ground inside the arena
  camera.position[1] = 1.6;
  const limit = 28;
  camera.position[0] = Math.max(-limit, Math.min(limit, camera.position[0]));
  camera.position[2] = Math.max(-limit, Math.min(limit, camera.position[2]));
}

// --- main loop ---
const hud = document.getElementById('hud');
let last = performance.now();
let frames = 0, fpsTime = 0, fps = 0;

function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  const time = now / 1000;

  movePlayer(dt);
  scene.update(dt, time);

  renderer.beginScene(camera);
  scene.render(renderer);
  renderer.endScene();

  // fps counter
  frames++;
  fpsTime += dt;
  if (fpsTime >= 0.5) {
    fps = Math.round(frames / fpsTime);
    frames = 0;
    fpsTime = 0;
  }
  if (hud) {
    hud.textContent = input.locked
      ? `RETRO-PSX ENGINE  |  ${fps} FPS  |  WASD move · Shift run · Esc release mouse`
      : `RETRO-PSX ENGINE  |  ${fps} FPS  |  CLICK TO PLAY`;
  }

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
