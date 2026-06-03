// Keyboard + pointer-lock mouse input.
export class Input {
  constructor(canvas) {
    this.keys = {};
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.locked = false;

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
