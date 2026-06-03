// Launcher: pick a game and run it.
// To make your own game, copy src/games/gem-collector.js and import it here.
import { createGame } from './games/gem-collector.js';

const canvas = document.getElementById('game');
const ui = {
  hud: document.getElementById('hud'),
  score: document.getElementById('score'),
};

const game = createGame(canvas, ui);
game.run();
