// Launcher: a tiny menu that lets you pick which game to run on the engine.
// Each game is a self-contained module that uses only the public Engine API.
import { createGame as gemCollector } from './games/gem-collector.js';
import { createGame as towerClimb } from './games/tower-climb.js';

const GAMES = {
  gems: gemCollector,
  climb: towerClimb,
};

const canvas = document.getElementById('game');
const ui = {
  hud: document.getElementById('hud'),
  score: document.getElementById('score'),
};
const menu = document.getElementById('menu');

function startGame(name) {
  const make = GAMES[name];
  if (!make) return;
  if (menu) menu.style.display = 'none';
  make(canvas, ui).run();
}

// Wire the menu buttons.
document.querySelectorAll('[data-game]').forEach((btn) => {
  btn.addEventListener('click', () => startGame(btn.dataset.game));
});

// Allow direct launch via ?game=climb (skips the menu).
const wanted = new URLSearchParams(location.search).get('game');
if (wanted && GAMES[wanted]) startGame(wanted);
