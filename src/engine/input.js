// Keyboard + pointer-lock mouse input.
export class Input {
  constructor(canvas) {
    this.keys = {};
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.locked = false;
    this._clicked = false; // a left-click happened this frame (while locked)

    // Keys that would otherwise scroll the page — swallow them while playing.
    const swallow = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
    // Handlers kept as fields so destroy() can remove them.
    this._h = {
      keydown: (e) => { this.keys[e.code] = true; if (swallow.has(e.code)) e.preventDefault(); },
      keyup: (e) => { this.keys[e.code] = false; },
      click: () => { if (!this.locked) canvas.requestPointerLock(); },
      lock: () => { this.locked = document.pointerLockElement === canvas; },
      mousemove: (e) => { if (this.locked) { this.mouseDX += e.movementX; this.mouseDY += e.movementY; } },
      // The click that grabs pointer lock doesn't count as a shot (locked is
      // still false at that moment).
      mousedown: (e) => { if (this.locked && e.button === 0) this._clicked = true; },
    };
    this._canvas = canvas;
    window.addEventListener('keydown', this._h.keydown);
    window.addEventListener('keyup', this._h.keyup);
    canvas.addEventListener('click', this._h.click);
    document.addEventListener('pointerlockchange', this._h.lock);
    document.addEventListener('mousemove', this._h.mousemove);
    document.addEventListener('mousedown', this._h.mousedown);
  }

  destroy() {
    window.removeEventListener('keydown', this._h.keydown);
    window.removeEventListener('keyup', this._h.keyup);
    this._canvas.removeEventListener('click', this._h.click);
    document.removeEventListener('pointerlockchange', this._h.lock);
    document.removeEventListener('mousemove', this._h.mousemove);
    document.removeEventListener('mousedown', this._h.mousedown);
  }

  // True once per left-click; consumes the event.
  consumeClick() {
    const c = this._clicked;
    this._clicked = false;
    return c;
  }

  down(code) {
    return !!this.keys[code];
  }

  // Consume accumulated mouse delta for this frame.
  consumeMouse() {
    const d = [this.mouseDX, this.mouseDY];
    this.mouseDX = 0;
    this.mouseDY = 0;
    return d;
  }
}
