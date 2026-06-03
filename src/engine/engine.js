// ============================================================================
//  RETRO-PSX ENGINE  —  the facade you build games on top of.
//
//  A game is just: create an Engine, register some assets, spawn entities,
//  and provide an update function. Example:
//
//      import { Engine, TexGen } from './engine/engine.js';
//
//      const game = new Engine(canvas, { width: 320, height: 240 });
//      game.defineTexture('floor', TexGen.grass());
//      game.useFirstPersonController();
//
//      game.onStart = (g) => {
//        g.spawn({ mesh: 'plane', texture: 'floor', scale: [60,1,60] });
//        g.spawn({ mesh: 'cube', texture: 'floor', position: [0,0.5,-4], solid: true });
//      };
//      game.onUpdate = (g, dt) => { /* your game logic */ };
//
//      game.run();
// ============================================================================

import { Renderer } from './renderer.js';
import { Camera } from './camera.js';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { Scene, Entity } from './scene.js';
import { Mesh, buildCube, buildPlane, buildPyramid } from './mesh.js';
import { TexGen, createTexture } from './textures.js';
import { aabbFromCube, collide } from './physics.js';
import { Vec3 } from './math.js';

export { TexGen, Vec3, Entity, buildCube, buildPlane, buildPyramid };

export class Engine {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.renderer = new Renderer(canvas, options);
    this.gl = this.renderer.gl;
    this.camera = new Camera();
    this.input = new Input(canvas);
    this.audio = new Audio();
    this.scene = new Scene();

    this.time = 0;        // seconds since start
    this.dt = 0;          // seconds since last frame
    this.fps = 0;

    this._solids = [];    // AABB colliders
    this._textures = {};  // name -> GL texture
    this._meshes = {};    // name -> Mesh
    this._fp = null;      // first-person controller config (or null)

    // user hooks
    this.onStart = null;
    this.onUpdate = null;

    this._registerBuiltins();

    // Audio must be unlocked by a user gesture.
    canvas.addEventListener('click', () => this.audio.resume());

    // Keep the canvas filling the window.
    const fit = () => this.renderer.resize(window.innerWidth, window.innerHeight);
    window.addEventListener('resize', fit);
    fit();
  }

  _registerBuiltins() {
    this.defineMesh('cube', buildCube(1));
    this.defineMesh('plane', buildPlane(1, 1));
    this.defineMesh('pyramid', buildPyramid(1));
  }

  // --- asset registration -------------------------------------------------

  // Register a texture from a <canvas>, an ImageData, or a CSS color string.
  defineTexture(name, source) {
    let canvas = source;
    if (typeof source === 'string') {
      // solid color
      canvas = document.createElement('canvas');
      canvas.width = canvas.height = 2;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = source;
      ctx.fillRect(0, 0, 2, 2);
    }
    this._textures[name] = createTexture(this.gl, canvas);
    return this._textures[name];
  }

  defineMesh(name, data) {
    this._meshes[name] = (data instanceof Mesh)
      ? data
      : new Mesh(this.gl, data.vertices, data.indices);
    return this._meshes[name];
  }

  texture(name) { return this._textures[name]; }
  mesh(name) { return this._meshes[name]; }

  // --- entities -----------------------------------------------------------

  // Spawn an entity. `mesh` and `texture` may be names or raw objects.
  // Pass `solid: true` to add an AABB collider (uses the entity's box).
  spawn(opts = {}) {
    const mesh = typeof opts.mesh === 'string' ? this._meshes[opts.mesh] : opts.mesh;
    const texture = typeof opts.texture === 'string'
      ? this._textures[opts.texture] : opts.texture;
    if (!mesh) throw new Error(`spawn(): unknown mesh "${opts.mesh}"`);
    if (!texture) throw new Error(`spawn(): unknown texture "${opts.texture}"`);

    const entity = new Entity({ ...opts, mesh, texture });
    this.scene.add(entity);
    if (opts.solid) {
      entity._collider = aabbFromCube(entity, opts.colliderPad ?? 0.3);
      this._solids.push(entity._collider);
    }
    return entity;
  }

  despawn(entity) {
    this.scene.remove(entity);
    if (entity._collider) {
      const i = this._solids.indexOf(entity._collider);
      if (i >= 0) this._solids.splice(i, 1);
    }
  }

  // Resolve a circle (x,z,radius) against all solids. Returns [x, z].
  collide(x, z, radius) {
    return collide(x, z, radius, this._solids);
  }

  // Distance (XZ) from the camera to a world position — handy for pickups/AI.
  distanceToCamera(pos) {
    const dx = pos[0] - this.camera.position[0];
    const dz = pos[2] - this.camera.position[2];
    return Math.hypot(dx, dz);
  }

  // --- built-in first-person controller (optional) ------------------------

  useFirstPersonController(cfg = {}) {
    this._fp = {
      speed: cfg.speed ?? 4.5,
      runSpeed: cfg.runSpeed ?? 9,
      eyeHeight: cfg.eyeHeight ?? 1.6,
      radius: cfg.radius ?? 0.3,
      bounds: cfg.bounds ?? 28,
      onStep: cfg.onStep ?? null, // callback for footstep sfx, etc.
      stepTimer: 0,
    };
    return this;
  }

  _updateFirstPerson(dt) {
    const fp = this._fp;
    const [dx, dy] = this.input.consumeMouse();
    this.camera.look(dx, dy);

    const running = this.input.down('ShiftLeft');
    const speed = (running ? fp.runSpeed : fp.speed) * dt;
    const f = this.camera.forward();
    const flat = Vec3.normalize([f[0], 0, f[2]]);
    const right = this.camera.right();
    let move = [0, 0, 0];
    if (this.input.down('KeyW')) move = Vec3.add(move, flat);
    if (this.input.down('KeyS')) move = Vec3.sub(move, flat);
    if (this.input.down('KeyD')) move = Vec3.sub(move, right);
    if (this.input.down('KeyA')) move = Vec3.add(move, right);

    if (Vec3.length(move) > 0) {
      move = Vec3.scale(Vec3.normalize(move), speed);
      let nx = this.camera.position[0] + move[0];
      let nz = this.camera.position[2] + move[2];
      [nx, nz] = this.collide(nx, nz, fp.radius);
      this.camera.position[0] = nx;
      this.camera.position[2] = nz;

      if (fp.onStep) {
        fp.stepTimer -= dt;
        if (fp.stepTimer <= 0) {
          fp.onStep(running);
          fp.stepTimer = running ? 0.28 : 0.42;
        }
      }
    }

    this.camera.position[1] = fp.eyeHeight;
    const b = fp.bounds;
    this.camera.position[0] = Math.max(-b, Math.min(b, this.camera.position[0]));
    this.camera.position[2] = Math.max(-b, Math.min(b, this.camera.position[2]));
  }

  // --- main loop ----------------------------------------------------------

  run() {
    if (this.onStart) this.onStart(this);

    let last = performance.now();
    let frames = 0, acc = 0;

    const loop = (now) => {
      this.dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      this.time += this.dt;

      if (this._fp) this._updateFirstPerson(this.dt);
      if (this.onUpdate) this.onUpdate(this, this.dt);
      this.scene.update(this.dt, this.time);

      this.renderer.beginScene(this.camera);
      this.scene.render(this.renderer);
      this.renderer.endScene();

      frames++;
      acc += this.dt;
      if (acc >= 0.5) { this.fps = Math.round(frames / acc); frames = 0; acc = 0; }

      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}
