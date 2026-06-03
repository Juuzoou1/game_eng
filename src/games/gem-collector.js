// ============================================================================
//  EXAMPLE GAME: "Gem Collector"
//
//  This file contains ZERO engine internals — it only uses the public
//  Engine API. It's here to show how you'd design your own game: register
//  assets, spawn entities, and write update logic. Copy it as a starting
//  point for your own game.
// ============================================================================

import { Engine, TexGen, buildPlane } from '../engine/engine.js';

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

  // a big ground mesh whose texture tiles 30x (instead of stretching)
  game.defineMesh('ground', buildPlane(60, 30));

  // --- use the engine's built-in walking controller, with footstep sfx ---
  game.useFirstPersonController({
    bounds: 28,
    onStep: () => game.audio.step(),
  });

  // game state
  let gems = [];
  let total = 0;
  let collected = 0;
  let won = false;

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
  };

  // --- per-frame game logic ---
  game.onUpdate = (g) => {
    for (let i = gems.length - 1; i >= 0; i--) {
      if (g.distanceToCamera(gems[i].position) < 1.2) {
        g.despawn(gems[i]);
        gems.splice(i, 1);
        collected++;
        g.audio.pickup();
        if (collected === total && !won) { won = true; g.audio.win(); }
      }
    }

    if (ui.score) {
      ui.score.textContent = won
        ? `★ ALL ${total} GEMS! ★`
        : `GEMS  ${collected} / ${total}`;
    }
    if (ui.hud) {
      ui.hud.textContent = g.input.locked
        ? `${g.fps} FPS  ·  WASD move · Shift run · Esc release mouse`
        : `CLICK TO PLAY  ·  collect all the gems!`;
    }
  };

  return game;
}
