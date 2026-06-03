// Entry point: wires the engine together and builds a small playable level.
import { Renderer } from './renderer.js';
import { Camera } from './camera.js';
import { Input } from './input.js';
import { Scene, Entity } from './scene.js';
import { Mesh, buildCube, buildPlane, buildPyramid } from './mesh.js';
import { TexGen, createTexture } from './textures.js';
import { Audio } from './audio.js';
import { aabbFromCube, collide } from './physics.js';
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
const audio = new Audio();
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
  gem: createTexture(gl, TexGen.gem(64)),
};

const cubeData = buildCube(1);
const floorData = buildPlane(60, 30);
const pyrData = buildPyramid(1);
const mesh = {
  cube: new Mesh(gl, cubeData.vertices, cubeData.indices),
  floor: new Mesh(gl, floorData.vertices, floorData.indices),
  pyramid: new Mesh(gl, pyrData.vertices, pyrData.indices),
};

// Solid colliders the player can't walk through.
const solids = [];
function addSolid(entity) {
  scene.add(entity);
  solids.push(aabbFromCube(entity, 0.3)); // pad by player radius
  return entity;
}

// Collectible gems.
const gems = [];

// --- level ---
scene.add(new Entity({ mesh: mesh.floor, texture: tex.grass, position: [0, 0, 0] }));

// A ring of crates (solid).
const ringCount = 8;
for (let i = 0; i < ringCount; i++) {
  const a = (i / ringCount) * Math.PI * 2;
  addSolid(new Entity({
    mesh: mesh.cube,
    texture: tex.crate,
    position: [Math.cos(a) * 8, 0.5, Math.sin(a) * 8],
    rotation: [0, a, 0],
  }));
}

// Brick pillars (solid).
for (const x of [-4, 4]) {
  for (const z of [-4, 4]) {
    addSolid(new Entity({
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

// Spinning gems scattered around for the player to collect.
const gemSpots = [
  [10, 0], [-10, 2], [3, 11], [-7, -9], [12, -6],
  [-12, -3], [6, -12], [0, 13], [-2, -13], [9, 7],
];
for (const [gx, gz] of gemSpots) {
  const gem = scene.add(new Entity({
    mesh: mesh.cube,
    texture: tex.gem,
    position: [gx, 1.0, gz],
    scale: [0.4, 0.4, 0.4],
    update: (e, dt, t) => {
      e.rotation[1] += dt * 2.0;
      e.rotation[0] = 0.4;
      e.position[1] = 1.0 + Math.sin(t * 3 + gx) * 0.2;
    },
  }));
  gems.push(gem);
}
const totalGems = gems.length;
let collected = 0;
let won = false;

// --- player movement with collision ---
let wasMoving = false;
let stepTimer = 0;

function movePlayer(dt) {
  const [dx, dy] = input.consumeMouse();
  camera.look(dx, dy);

  const running = input.down('ShiftLeft');
  const speed = (running ? 9 : 4.5) * dt;
  const f = camera.forward();
  const flat = Vec3.normalize([f[0], 0, f[2]]);
  const right = camera.right();
  let move = [0, 0, 0];
  if (input.down('KeyW')) move = Vec3.add(move, flat);
  if (input.down('KeyS')) move = Vec3.sub(move, flat);
  if (input.down('KeyD')) move = Vec3.sub(move, right);
  if (input.down('KeyA')) move = Vec3.add(move, right);

  const moving = Vec3.length(move) > 0;
  if (moving) {
    move = Vec3.scale(Vec3.normalize(move), speed);
    let nx = camera.position[0] + move[0];
    let nz = camera.position[2] + move[2];
    // resolve against solid boxes
    [nx, nz] = collide(nx, nz, 0.3, solids);
    camera.position[0] = nx;
    camera.position[2] = nz;

    // footstep ticks
    stepTimer -= dt;
    if (stepTimer <= 0) {
      audio.step();
      stepTimer = running ? 0.28 : 0.42;
    }
  }
  wasMoving = moving;

  camera.position[1] = 1.6;
  const limit = 28;
  camera.position[0] = Math.max(-limit, Math.min(limit, camera.position[0]));
  camera.position[2] = Math.max(-limit, Math.min(limit, camera.position[2]));
}

// --- pickups ---
function checkPickups() {
  const px = camera.position[0];
  const pz = camera.position[2];
  for (let i = gems.length - 1; i >= 0; i--) {
    const g = gems[i];
    const dx = g.position[0] - px;
    const dz = g.position[2] - pz;
    if (dx * dx + dz * dz < 1.2 * 1.2) {
      scene.remove(g);
      gems.splice(i, 1);
      collected++;
      audio.pickup();
      if (collected === totalGems && !won) {
        won = true;
        audio.win();
      }
    }
  }
}

// Start audio on the same gesture that locks the pointer.
canvas.addEventListener('click', () => audio.resume());

// --- main loop ---
const hud = document.getElementById('hud');
const score = document.getElementById('score');
let last = performance.now();
let frames = 0, fpsTime = 0, fps = 0;

function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  const time = now / 1000;

  movePlayer(dt);
  checkPickups();
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
      ? `${fps} FPS  ·  WASD move · Shift run · Esc release mouse`
      : `CLICK TO PLAY  ·  collect all the gems!`;
  }
  if (score) {
    score.textContent = won
      ? `★ ALL ${totalGems} GEMS! ★`
      : `GEMS  ${collected} / ${totalGems}`;
  }

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
