// Procedurally generated textures drawn on a 2D canvas, then uploaded to GL.
// Low resolution + chunky pixels for that PS1 / late-90s look.

function makeCanvas(size = 64) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  return cv;
}

// Add per-pixel noise so flat colors look grimy like old game art.
function grime(ctx, size, amount = 18) {
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amount;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);
}

export const TexGen = {
  checker(size = 64, a = '#7a7a8c', b = '#3a3a4a') {
    const cv = makeCanvas(size);
    const ctx = cv.getContext('2d');
    const n = 8;
    const s = size / n;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        ctx.fillStyle = (x + y) % 2 ? a : b;
        ctx.fillRect(x * s, y * s, s, s);
      }
    }
    grime(ctx, size);
    return cv;
  },

  brick(size = 64) {
    const cv = makeCanvas(size);
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#5a3a2a';
    ctx.fillRect(0, 0, size, size);
    const rows = 8;
    const h = size / rows;
    ctx.fillStyle = '#8a5038';
    for (let r = 0; r < rows; r++) {
      const offset = (r % 2) * (size / 8);
      for (let bx = -1; bx < 4; bx++) {
        const x = bx * (size / 4) + offset;
        ctx.fillRect(x + 1, r * h + 1, size / 4 - 2, h - 2);
      }
    }
    grime(ctx, size, 26);
    return cv;
  },

  metal(size = 64) {
    const cv = makeCanvas(size);
    const ctx = cv.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, size);
    g.addColorStop(0, '#9aa0aa');
    g.addColorStop(0.5, '#5a606a');
    g.addColorStop(1, '#787e88');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = 'rgba(20,20,30,0.6)';
    for (let i = 0; i < size; i += 8) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(size, i);
      ctx.stroke();
    }
    // bolts in the corners
    ctx.fillStyle = '#2a2a32';
    for (const [x, y] of [[6, 6], [size - 6, 6], [6, size - 6], [size - 6, size - 6]]) {
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    grime(ctx, size, 14);
    return cv;
  },

  crate(size = 64) {
    const cv = makeCanvas(size);
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#9a6a32';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#7a4e22';
    ctx.fillRect(4, 4, size - 8, size - 8);
    ctx.fillStyle = '#b07c40';
    ctx.fillRect(8, 8, size - 16, size - 16);
    // metal bands
    ctx.fillStyle = '#444';
    ctx.fillRect(0, size / 2 - 3, size, 6);
    ctx.fillRect(size / 2 - 3, 0, 6, size);
    grime(ctx, size, 22);
    return cv;
  },

  gem(size = 64) {
    const cv = makeCanvas(size);
    const ctx = cv.getContext('2d');
    // faceted crystal look: bright facets on a teal body
    ctx.fillStyle = '#0a3a44';
    ctx.fillRect(0, 0, size, size);
    const facets = [
      ['#2ad0e0', [0.5, 0.0, 1.0, 0.5, 0.5, 1.0]],
      ['#16a0b4', [0.5, 0.0, 0.0, 0.5, 0.5, 1.0]],
      ['#8ff4ff', [0.5, 0.0, 0.7, 0.35, 0.5, 0.5]],
      ['#1d8ea0', [0.5, 1.0, 0.0, 0.5, 0.5, 0.5]],
    ];
    for (const [color, t] of facets) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(t[0] * size, t[1] * size);
      ctx.lineTo(t[2] * size, t[3] * size);
      ctx.lineTo(t[4] * size, t[5] * size);
      ctx.closePath();
      ctx.fill();
    }
    // sparkle
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(size * 0.55, size * 0.2, 3, 3);
    return cv;
  },

  // A blocky ghost SPRITE for billboards. Drawn as hard-edged pixel art on a
  // pure-magenta background; the renderer color-keys magenta out as transparent.
  ghost(size = 64) {
    const cv = makeCanvas(size);
    const ctx = cv.getContext('2d');
    const N = 16;                 // 16x16 logical pixels
    const s = Math.ceil(size / N);
    for (let cy = 0; cy < N; cy++) {
      for (let cx = 0; cx < N; cx++) {
        const dx = (cx - 7.5) / 7;
        const dy = (cy - 7) / 7.5;
        let inside = dx * dx + dy * dy <= 1.0;     // rounded body
        if (cy >= 12 && cx % 3 === 1) inside = false; // wavy feet
        let color = '#ff00ff';                     // magenta = transparent key
        if (inside) {
          color = cx < 7 ? '#e8f0ff' : '#c2cee8';  // light body w/ shaded side
          if (cy >= 5 && cy <= 7 && (cx === 5 || cx === 10)) color = '#101020'; // eyes
        }
        ctx.fillStyle = color;
        ctx.fillRect(cx * (size / N), cy * (size / N), s, s);
      }
    }
    return cv;
  },

  grass(size = 64) {
    const cv = makeCanvas(size);
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#3a6a2a';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 400; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const shades = ['#2e5a22', '#4a7e34', '#5a8e3a', '#26461c'];
      ctx.fillStyle = shades[(Math.random() * shades.length) | 0];
      ctx.fillRect(x, y, 2, 2);
    }
    return cv;
  },
};

// Upload a canvas as a GL texture with nearest filtering (no smoothing).
// We upload the raw RGBA bytes (not the canvas object) so the alpha channel is
// preserved identically on every GL backend — some drivers drop canvas alpha,
// which would break our sprite cutouts.
export function createTexture(gl, canvas) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  const ctx = canvas.getContext('2d');
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, canvas.width, canvas.height, 0,
    gl.RGBA, gl.UNSIGNED_BYTE, img.data);
  // Nearest filter = crunchy pixels. No mipmaps = shimmery aliasing, very PS1.
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  // WebGL1 only allows REPEAT on power-of-two textures; non-POT must clamp or
  // they become "incomplete" and sample as solid black. Tiling ground textures
  // are 64x64 (POT) and keep REPEAT; sprites can be any size and clamp.
  const pot = (n) => (n & (n - 1)) === 0;
  const wrap = (pot(canvas.width) && pot(canvas.height)) ? gl.REPEAT : gl.CLAMP_TO_EDGE;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
  return tex;
}
