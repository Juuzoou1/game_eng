// ============================================================================
//  EXAMPLE GAME: "Gem Collector"
//
//  This file contains ZERO engine internals — it only uses the public
//  Engine API. It's here to show how you'd design your own game: register
//  assets, spawn entities, and write update logic. Copy it as a starting
//  point for your own game.
// ============================================================================

import { Engine, TexGen, buildPlane, Vec3 } from '../engine/engine.js';

export function createGame(canvas, ui = {}) {
  const game = new Engine(canvas, {
    width: 320,
    height: 240,
    fogColor: [0.05, 0.06, 0.11],
    snap: 130,
  });

  // --- register textures (procedurally generated, no asset files) ---
  game.defineTexture('grass', TexGen.grass());
  game.defineTexture('brick', TexGen.brick());
  game.defineTexture('metal', TexGen.metal());
  game.defineTexture('crate', TexGen.crate());
  game.defineTexture('gem', TexGen.gem());
  game.defineTexture('ghost', TexGen.ghost());

  // a big ground mesh whose texture tiles 30x (instead of stretching)
  game.defineMesh('ground', buildPlane(60, 30));

  // --- use the engine's built-in walking controller, with footstep + jump sfx ---
  game.useFirstPersonController({
    bounds: 28,
    onStep: () => game.audio.step(),
    onJump: () => game.audio.jump(),
  });

  // game state
  let gems = [];
  let total = 0;
  let collected = 0;
  let ghosts = [];   // chasing enemies (billboard sprites)
  let zapped = 0;
  let health = 3;    // hearts
  let over = false;
  const best = game.load('gems:best', 0); // persistent high score (gems collected)

  function finish(win) {
    if (over) return;
    over = true;
    if (collected > best) game.save('gems:best', collected);
    const line = win ? `YOU GOT ALL ${total} GEMS!` : 'THE GHOSTS GOT YOU';
    game.gameOver(`${line}\ngems ${collected}/${total} · zapped ${zapped} · best ${Math.max(best, collected)}`);
  }

  const randomEdge = () => {
    const a = Math.random() * Math.PI * 2;
    return [Math.cos(a) * 24, Math.sin(a) * 24];
  };

  // --- build the level ---
  game.onStart = (g) => {
    // ground
    g.spawn({ mesh: 'ground', texture: 'grass' });

    // ring of solid crates
    const ring = 8;
    for (let i = 0; i < ring; i++) {
      const a = (i / ring) * Math.PI * 2;
      g.spawn({
        mesh: 'cube', texture: 'crate', solid: true,
        position: [Math.cos(a) * 8, 0.5, Math.sin(a) * 8],
        rotation: [0, a, 0],
      });
    }

    // solid brick pillars
    for (const x of [-4, 4]) {
      for (const z of [-4, 4]) {
        g.spawn({
          mesh: 'cube', texture: 'brick', solid: true,
          position: [x, 1.5, z], scale: [1, 3, 1],
        });
      }
    }

    // spinning metal centerpiece
    g.spawn({
      mesh: 'pyramid', texture: 'metal',
      position: [0, 1.2, 0], scale: [2, 2, 2],
      update: (e, dt, t) => {
        e.rotation[1] += dt * 1.2;
        e.position[1] = 1.4 + Math.sin(t * 2) * 0.3;
      },
    });

    // collectible gems
    const spots = [
      [10, 0], [-10, 2], [3, 11], [-7, -9], [12, -6],
      [-12, -3], [6, -12], [0, 13], [-2, -13], [9, 7],
    ];
    gems = spots.map(([x, z]) =>
      g.spawn({
        mesh: 'cube', texture: 'gem',
        position: [x, 1.0, z], scale: [0.4, 0.4, 0.4],
        update: (e, dt, t) => {
          e.rotation[1] += dt * 2.0;
          e.rotation[0] = 0.4;
          e.position[1] = 1.0 + Math.sin(t * 3 + x) * 0.2;
        },
      }));
    total = gems.length;

    // chasing ghosts — flat billboard sprites that always face you (PS1 style)
    for (let i = 0; i < 4; i++) {
      const [gx, gz] = randomEdge();
      const e = g.spawn({
        mesh: 'quad', texture: 'ghost', billboard: true,
        position: [gx, 0.2, gz], scale: [1.6, 1.9, 1],
        update: (en, dt, t) => { en.position[1] = 0.2 + Math.sin(t * 3 + en.position[0]) * 0.15; },
      });
      ghosts.push({ entity: e, speed: 2.2 + Math.random() });
    }
  };

  let aimed = null; // the solid the player is currently looking at

  // --- per-frame game logic ---
  game.onUpdate = (g) => {
    // collect gems you walk into
    for (let i = gems.length - 1; i >= 0; i--) {
      const gp = gems[i].position;
      if (g.distanceToCamera(gp) < 1.2) {
        g.emitBurst([gp[0], gp[1], gp[2]], { color: [0.4, 1, 1], count: 14, speed: 3, life: 0.5, size: 0.12 });
        g.despawn(gems[i]);
        gems.splice(i, 1);
        collected++;
        g.audio.pickup();
        if (collected === total) { g.audio.win(); finish(true); }
      }
    }

    // --- ghosts chase the player; touching you hurts and resets them ---
    const cam = g.camera;
    for (const gh of ghosts) {
      const p = gh.entity.position;
      const to = [cam.position[0] - p[0], 0, cam.position[2] - p[2]];
      const dist = Math.hypot(to[0], to[2]);
      if (dist > 0.001) {
        p[0] += (to[0] / dist) * gh.speed * g.dt;
        p[2] += (to[2] / dist) * gh.speed * g.dt;
      }
      if (dist < 1.1) {
        g.audio.hurt();
        g.shake(0.35);
        health--;
        const [ex, ez] = randomEdge();   // knock it back to an edge
        p[0] = ex; p[2] = ez;
        if (health <= 0) { finish(false); return; }
      }
    }

    // --- click to ZAP the ghost you're aiming at ---
    if (g.input.consumeClick()) {
      const fwd = Vec3.normalize(cam.forward());
      let best = null, bestDot = 0.97;
      for (const gh of ghosts) {
        const c = [gh.entity.position[0], gh.entity.position[1] + 0.9, gh.entity.position[2]];
        const to = Vec3.sub(c, cam.position);
        if (Vec3.length(to) > 18) continue;
        const d = Vec3.dot(Vec3.normalize(to), fwd);
        if (d > bestDot) { bestDot = d; best = gh; }
      }
      if (best) {
        const bp = best.entity.position;
        g.emitBurst([bp[0], bp[1] + 0.9, bp[2]], { color: [1, 0.7, 0.2], count: 18, speed: 5, life: 0.5, size: 0.16 });
        g.shake(0.12);
        g.despawn(best.entity);
        ghosts = ghosts.filter((x) => x !== best);
        zapped++;
        g.audio.zap();
      }
    }

    // RAYCAST demo: highlight whatever solid you're aiming at (within 12 units)
    if (aimed) { aimed.tint = [1, 1, 1]; aimed = null; }
    const hit = g.raycast(null, null, 12);
    let aimText = '—';
    if (hit && hit.entity) {
      aimed = hit.entity;
      aimed.tint = [1.6, 0.7, 0.7];           // glow red
      aimText = `${hit.distance.toFixed(1)}m`;
    }

    if (ui.score) {
      ui.score.textContent =
        `${'❤'.repeat(health)}   GEMS ${collected}/${total}   👻 ${ghosts.length}`;
    }
    if (ui.hud) {
      ui.hud.textContent = g.input.locked
        ? `${g.fps} FPS · WASD · Space jump · CLICK zap · best ${best} · aim:${aimText}`
        : `CLICK TO PLAY · grab gems · jump crates · zap ghosts · don't get caught!`;
    }
  };

  return game;
}
