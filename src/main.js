// Launcher: a menu to pick a game, plus pause / game-over overlay handling and
// restart — all driven by the engine's state machine. Each game is a module
// that uses only the public Engine API.
import { createGame as gemCollector } from './games/gem-collector.js';
import { createGame as towerClimb } from './games/tower-climb.js';

const GAMES = { gems: gemCollector, climb: towerClimb };

const canvas = document.getElementById('game');
const ui = { hud: document.getElementById('hud'), score: document.getElementById('score') };
const menu = document.getElementById('menu');
const overlay = document.getElementById('overlay');
const overlayMsg = document.getElementById('overlay-msg');
const btnAgain = document.getElementById('btn-again');
const btnMenu = document.getElementById('btn-menu');

let current = null;     // the running Engine
let currentName = null;

function showOverlay(show, msg = '', interactive = true) {
  overlay.style.display = show ? 'flex' : 'none';
  overlay.style.pointerEvents = interactive ? 'auto' : 'none';
  overlayMsg.textContent = msg;
  // Buttons only make sense on game-over, not on a transient pause.
  btnAgain.style.display = interactive ? '' : 'none';
  btnMenu.style.display = interactive ? '' : 'none';
}

function startGame(name) {
  if (!GAMES[name]) return;
  if (current) current.destroy();
  showOverlay(false);
  if (menu) menu.style.display = 'none';
  currentName = name;
  current = GAMES[name](canvas, ui);
  current.onStateChange = (state, message) => {
    if (state === 'playing') showOverlay(false);
    else if (state === 'paused') showOverlay(true, 'PAUSED\nclick to resume', false);
    else if (state === 'over') showOverlay(true, message, true);
  };
  current.run();
}

function toMenu() {
  if (current) { current.destroy(); current = null; }
  showOverlay(false);
  if (ui.score) ui.score.textContent = '';
  if (ui.hud) ui.hud.textContent = '';
  if (menu) menu.style.display = 'flex';
}

document.querySelectorAll('[data-game]').forEach((btn) => {
  btn.addEventListener('click', () => startGame(btn.dataset.game));
});
btnAgain.addEventListener('click', () => startGame(currentName));
btnMenu.addEventListener('click', toMenu);

// Optional direct launch: ?game=climb
const wanted = new URLSearchParams(location.search).get('game');
if (wanted && GAMES[wanted]) startGame(wanted);
