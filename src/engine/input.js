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
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (swallow.has(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });

    canvas.addEventListener('click', () => {
      if (!this.locked) canvas.requestPointerLock();
    });

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
    });

    document.addEventListener('mousemove', (e) => {
      if (this.locked) {
        this.mouseDX += e.movementX;
        this.mouseDY += e.movementY;
      }
    });

    // Left-click while playing (used for shooting). The click that grabs the
    // pointer lock doesn't count, since `locked` is still false at that point.
    document.addEventListener('mousedown', (e) => {
      if (this.locked && e.button === 0) this._clicked = true;
    });
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
