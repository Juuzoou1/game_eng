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
import { Mesh, buildCube, buildPlane, buildPyramid, buildQuad } from './mesh.js';
import { TexGen, createTexture } from './textures.js';
import { aabbFromCube, collide, groundHeightAt, raycastBoxes } from './physics.js';
import { Vec3, Mat4 } from './math.js';

export { TexGen, Vec3, Mat4, Entity, buildCube, buildPlane, buildPyramid, buildQuad };

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

    this._solids = [];      // AABB colliders
    this._billboards = [];  // entities that always face the camera
    this._particles = [];   // transient particle effects
    this._textures = {};    // name -> GL texture
    this._meshes = {};      // name -> Mesh
    this._fp = null;        // first-person controller config (or null)
    this._shake = 0;        // screen-shake magnitude
    this._everLocked = false;

    // game state: 'playing' | 'paused' | 'over'
    this.state = 'playing';

    // user hooks
    this.onStart = null;
    this.onUpdate = null;
    this.onStateChange = null; // (state, message) => {}

    this._registerBuiltins();

    // Bound listeners (kept so destroy() can remove them cleanly).
    this._onResize = () => this.renderer.resize(window.innerWidth, window.innerHeight);
    this._onClickAudio = () => this.audio.resume();
    this._onLockChange = () => {
      const locked = document.pointerLockElement === this.canvas;
      if (locked) { this._everLocked = true; if (this.state === 'paused') this._setState('playing'); }
      else if (this._everLocked && this.state === 'playing') this._setState('paused');
    };
    canvas.addEventListener('click', this._onClickAudio);
    window.addEventListener('resize', this._onResize);
    document.addEventListener('pointerlockchange', this._onLockChange);
    this._onResize();
  }

  _setState(state, message = '') {
    this.state = state;
    // Release the mouse on game-over so the player can click the overlay buttons.
    if (state === 'over' && document.pointerLockElement === this.canvas) document.exitPointerLock();
    if (this.onStateChange) this.onStateChange(state, message);
  }

  // End the game with a result message (shows the overlay via onStateChange).
  gameOver(message = 'GAME OVER') { this._setState('over', message); }

  _registerBuiltins() {
    this.defineMesh('cube', buildCube(1));
    this.defineMesh('plane', buildPlane(1, 1));
    this.defineMesh('pyramid', buildPyramid(1));
    this.defineMesh('quad', buildQuad()); // for billboard sprites
    this.defineTexture('white', '#ffffff'); // for tinted particles
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
      entity._collider = aabbFromCube(entity);
      this._solids.push(entity._collider);
    }
    if (opts.billboard) {
      entity._billboard = true;
      this._billboards.push(entity);
    }
    return entity;
  }

  despawn(entity) {
    this.scene.remove(entity);
    if (entity._collider) {
      const i = this._solids.indexOf(entity._collider);
      if (i >= 0) this._solids.splice(i, 1);
    }
    if (entity._billboard) {
      const j = this._billboards.indexOf(entity);
      if (j >= 0) this._billboards.splice(j, 1);
    }
  }

  // Distance (XZ) from the camera to a world position — handy for pickups/AI.
  distanceToCamera(pos) {
    const dx = pos[0] - this.camera.position[0];
    const dz = pos[2] - this.camera.position[2];
    return Math.hypot(dx, dz);
  }

  // Cast a ray against all solids. Pass origin+dir, or omit to shoot from the
  // camera along where you're looking. Returns { distance, point, entity } | null.
  raycast(origin, dir, maxDist = Infinity) {
    if (!origin) origin = this.camera.position;
    if (!dir) dir = Vec3.normalize(this.camera.forward());
    return raycastBoxes(origin, dir, this._solids, maxDist);
  }

  // --- juice: particles, screen shake -------------------------------------

  // Spit out a burst of particles at a world position.
  emitBurst(pos, opts = {}) {
    const count = opts.count ?? 12;
    const color = opts.color ?? [1, 1, 1];
    const speed = opts.speed ?? 4;
    const life = opts.life ?? 0.5;
    const size = opts.size ?? 0.15;
    const gravity = opts.gravity ?? 8;
    for (let i = 0; i < count; i++) {
      // random direction, biased slightly upward
      let d = [Math.random() * 2 - 1, Math.random() * 2 - 0.4, Math.random() * 2 - 1];
      d = Vec3.normalize(d);
      const sp = speed * (0.4 + Math.random() * 0.6);
      this._particles.push({
        pos: [pos[0], pos[1], pos[2]],
        vel: [d[0] * sp, d[1] * sp, d[2] * sp],
        life, maxLife: life, size, gravity, color,
      });
    }
  }

  // Kick the camera for a moment (impact feedback). amount in world units.
  shake(amount = 0.25) { this._shake = Math.max(this._shake, amount); }

  _updateParticles(dt) {
    const ps = this._particles;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.life -= dt;
      if (p.life <= 0) { ps.splice(i, 1); continue; }
      p.vel[1] -= p.gravity * dt;
      p.pos[0] += p.vel[0] * dt;
      p.pos[1] += p.vel[1] * dt;
      p.pos[2] += p.vel[2] * dt;
    }
  }

  _renderParticles() {
    if (!this._particles.length) return;
    const quad = this._meshes.quad;
    const white = this._textures.white;
    const yaw = this.camera.yaw + Math.PI;
    const rotY = Mat4.rotationY(yaw);
    for (const p of this._particles) {
      const s = p.size * (p.life / p.maxLife); // shrink as it dies
      let m = Mat4.multiply(Mat4.translation(p.pos[0], p.pos[1], p.pos[2]), rotY);
      m = Mat4.multiply(m, Mat4.scaling(s, s, s));
      // center the quad on the point (quad spans y[0,1], x[-0.5,0.5])
      m = Mat4.multiply(m, Mat4.translation(0, -0.5, 0));
      this.renderer.drawMesh(quad, m, Mat4.normalFromMat4(m), white, p.color);
    }
  }

  // --- tiny persistence helper (high scores, etc.) ------------------------

  save(key, value) {
    try { localStorage.setItem('retropsx:' + key, JSON.stringify(value)); } catch (e) { /* ignore */ }
  }

  load(key, fallback = null) {
    try {
      const v = localStorage.getItem('retropsx:' + key);
      return v == null ? fallback : JSON.parse(v);
    } catch (e) { return fallback; }
  }

  // --- built-in first-person controller (optional) ------------------------

  useFirstPersonController(cfg = {}) {
    this._fp = {
      speed: cfg.speed ?? 4.5,
      runSpeed: cfg.runSpeed ?? 9,
      eyeHeight: cfg.eyeHeight ?? 1.6,
      radius: cfg.radius ?? 0.3,
      height: cfg.height ?? 1.6,     // body height for collision
      bounds: cfg.bounds ?? 28,
      gravity: cfg.gravity ?? 24,
      jumpSpeed: cfg.jumpSpeed ?? 8.5,
      onStep: cfg.onStep ?? null,    // footstep callback
      onJump: cfg.onJump ?? null,    // jump callback (for sfx)
      // runtime state
      feetY: this.camera.position[1] - (cfg.eyeHeight ?? 1.6),
      vy: 0,
      onGround: true,
      stepTimer: 0,
    };
    return this;
  }

  // Is the player currently standing on the ground/a surface?
  get onGround() { return this._fp ? this._fp.onGround : true; }

  _updateFirstPerson(dt) {
    const fp = this._fp;
    const cam = this.camera;
    const [dx, dy] = this.input.consumeMouse();
    cam.look(dx, dy);

    // --- horizontal movement ---
    const running = this.input.down('ShiftLeft');
    const speed = (running ? fp.runSpeed : fp.speed) * dt;
    const f = cam.forward();
    const flat = Vec3.normalize([f[0], 0, f[2]]);
    const right = cam.right();
    let move = [0, 0, 0];
    if (this.input.down('KeyW')) move = Vec3.add(move, flat);
    if (this.input.down('KeyS')) move = Vec3.sub(move, flat);
    if (this.input.down('KeyD')) move = Vec3.sub(move, right);
    if (this.input.down('KeyA')) move = Vec3.add(move, right);

    const moving = Vec3.length(move) > 0;
    if (moving) {
      move = Vec3.scale(Vec3.normalize(move), speed);
      let nx = cam.position[0] + move[0];
      let nz = cam.position[2] + move[2];
      [nx, nz] = collide(nx, nz, fp.radius, fp.feetY, fp.height, this._solids);
      cam.position[0] = nx;
      cam.position[2] = nz;
      if (fp.onGround && fp.onStep) {
        fp.stepTimer -= dt;
        if (fp.stepTimer <= 0) { fp.onStep(running); fp.stepTimer = running ? 0.28 : 0.42; }
      }
    }

    const b = fp.bounds;
    cam.position[0] = Math.max(-b, Math.min(b, cam.position[0]));
    cam.position[2] = Math.max(-b, Math.min(b, cam.position[2]));

    // --- jumping / gravity (vertical) ---
    if (this.input.down('Space') && fp.onGround) {
      fp.vy = fp.jumpSpeed;
      fp.onGround = false;
      if (fp.onJump) fp.onJump();
    }
    fp.vy -= fp.gravity * dt;
    fp.feetY += fp.vy * dt;

    const floorY = groundHeightAt(
      cam.position[0], cam.position[2], fp.radius, fp.feetY, this._solids);
    if (fp.feetY <= floorY) {
      fp.feetY = floorY;
      fp.vy = 0;
      fp.onGround = true;
    } else {
      fp.onGround = false;
    }

    cam.position[1] = fp.feetY + fp.eyeHeight;
  }

  // --- main loop ----------------------------------------------------------

  run() {
    if (this.onStart) this.onStart(this);
    this._running = true;

    let last = performance.now();
    let frames = 0, acc = 0;

    const loop = (now) => {
      if (!this._running) return; // stopped by destroy()
      this.dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      // Gameplay only advances while playing; paused/over freezes the world.
      if (this.state === 'playing') {
        this.time += this.dt;
        if (this._fp) this._updateFirstPerson(this.dt);
        if (this.onUpdate) this.onUpdate(this, this.dt);
        this.scene.update(this.dt, this.time);
        this._updateParticles(this.dt);
      }

      // Billboards always face the camera (cylindrical, Y-axis only).
      const faceYaw = this.camera.yaw + Math.PI;
      for (const e of this._billboards) e.rotation[1] = faceYaw;

      // Screen shake: nudge the camera, render, then restore.
      let ox = 0, oz = 0;
      if (this._shake > 0.001) {
        ox = (Math.random() * 2 - 1) * this._shake;
        oz = (Math.random() * 2 - 1) * this._shake;
        this.camera.position[0] += ox;
        this.camera.position[2] += oz;
        this._shake *= 0.86;
      } else this._shake = 0;

      this.renderer.beginScene(this.camera);
      this.scene.render(this.renderer);
      this._renderParticles();
      this.renderer.endScene();

      this.camera.position[0] -= ox;
      this.camera.position[2] -= oz;

      frames++;
      acc += this.dt;
      if (acc >= 0.5) { this.fps = Math.round(frames / acc); frames = 0; acc = 0; }

      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  // Stop the loop and remove all listeners so the engine can be discarded
  // (used to restart cleanly into a fresh game without stacking listeners).
  destroy() {
    this._running = false;
    window.removeEventListener('resize', this._onResize);
    document.removeEventListener('pointerlockchange', this._onLockChange);
    this.canvas.removeEventListener('click', this._onClickAudio);
    this.input.destroy();
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
  }
}
