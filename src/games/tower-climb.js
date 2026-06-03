// ============================================================================
//  EXAMPLE GAME #2: "Tower Climb"
//
//  A completely different game from gem-collector — no gems, no enemies — built
//  on the SAME engine, using only its public API. Proof that this is an engine
//  you make games WITH, not a single game.
//
//  Goal: jump up a spiral of platforms to reach the gem at the top. Beat the clock.
// ============================================================================

import { Engine, TexGen, buildPlane, Vec3 } from '../engine/engine.js';

export function createGame(canvas, ui = {}) {
  const game = new Engine(canvas, {
    width: 320,
    height: 240,
    fogColor: [0.07, 0.05, 0.10],
    snap: 130,
  });

  game.defineTexture('floor', TexGen.checker());
  game.defineTexture('metal', TexGen.metal());
  game.defineTexture('gem', TexGen.gem());
  game.defineMesh('ground', buildPlane(60, 30));

  game.useFirstPersonController({
    bounds: 26,
    onStep: () => game.audio.step(),
    onJump: () => game.audio.jump(),
  });

  const PLATFORMS = 12;
  const TOP_Y = 0.5 + PLATFORMS * 0.9; // surface height of the last platform
  let goal = null;
  let won = false;
  let time = 0;

  game.onStart = (g) => {
    g.spawn({ mesh: 'ground', texture: 'floor' });

    // a rising spiral of solid platforms to jump across
    for (let i = 0; i < PLATFORMS; i++) {
      const a = i * 0.9;
      const r = 4 + (i % 2) * 0.6;
      g.spawn({
        mesh: 'cube', texture: 'metal', solid: true,
        position: [Math.cos(a) * r, 0.25 + i * 0.9, Math.sin(a) * r],
        scale: [2, 0.5, 2],
      });
    }

    // the goal gem, floating above the top platform
    const a = (PLATFORMS - 1) * 0.9;
    const r = 4 + ((PLATFORMS - 1) % 2) * 0.6;
    goal = g.spawn({
      mesh: 'cube', texture: 'gem',
      position: [Math.cos(a) * r, TOP_Y + 1.2, Math.sin(a) * r],
      scale: [0.7, 0.7, 0.7],
      update: (e, dt, t) => {
        e.rotation[1] += dt * 2;
        e.position[1] = TOP_Y + 1.2 + Math.sin(t * 3) * 0.2;
      },
    });
  };

  game.onUpdate = (g) => {
    if (!won) time += g.dt;

    // reached the gem? (full 3D distance)
    if (!won && goal) {
      const to = Vec3.sub(goal.position, g.camera.position);
      if (Vec3.length(to) < 2.0) { won = true; g.audio.win(); }
    }

    if (ui.score) {
      const h = Math.max(0, g.camera.position[1] - 1.6).toFixed(1);
      ui.score.textContent = won ? '★ YOU REACHED THE TOP! ★' : `TIME ${time.toFixed(1)}s · H ${h}m`;
    }
    if (ui.hud) {
      ui.hud.textContent = won
        ? `DONE in ${time.toFixed(1)}s — refresh to retry`
        : g.input.locked
          ? `${g.fps} FPS · WASD + Space · jump up the tower to the gem!`
          : `CLICK TO PLAY · climb the tower, reach the gem at the top!`;
    }
  };

  return game;
}
