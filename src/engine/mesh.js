// Mesh = interleaved vertex data uploaded to a GL buffer.
// Layout per vertex: position(3), normal(3), uv(2)  -> 8 floats.

export class Mesh {
  constructor(gl, vertices, indices) {
    this.gl = gl;
    this.count = indices.length;

    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

    this.ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
  }

  // Bind attributes given a shader's attribute locations.
  bind(loc) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
    const stride = 8 * 4;
    gl.enableVertexAttribArray(loc.position);
    gl.vertexAttribPointer(loc.position, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(loc.normal);
    gl.vertexAttribPointer(loc.normal, 3, gl.FLOAT, false, stride, 3 * 4);
    gl.enableVertexAttribArray(loc.uv);
    gl.vertexAttribPointer(loc.uv, 2, gl.FLOAT, false, stride, 6 * 4);
  }

  draw() {
    this.gl.drawElements(this.gl.TRIANGLES, this.count, this.gl.UNSIGNED_SHORT, 0);
  }
}

// --- Primitive builders: return { vertices, indices } ---

export function buildCube(uvScale = 1) {
  // 6 faces, each with its own normal & uvs (24 verts).
  const faces = [
    // dir, u, v  (right-handed)
    { n: [0, 0, 1], t: [1, 0, 0], b: [0, 1, 0] }, // +Z
    { n: [0, 0, -1], t: [-1, 0, 0], b: [0, 1, 0] }, // -Z
    { n: [1, 0, 0], t: [0, 0, -1], b: [0, 1, 0] }, // +X
    { n: [-1, 0, 0], t: [0, 0, 1], b: [0, 1, 0] }, // -X
    { n: [0, 1, 0], t: [1, 0, 0], b: [0, 0, -1] }, // +Y
    { n: [0, -1, 0], t: [1, 0, 0], b: [0, 0, 1] }, // -Y
  ];
  const verts = [];
  const indices = [];
  faces.forEach((f, fi) => {
    const corners = [
      [-1, -1], [1, -1], [1, 1], [-1, 1],
    ];
    corners.forEach(([cu, cv]) => {
      const p = [
        f.n[0] + f.t[0] * cu + f.b[0] * cv,
        f.n[1] + f.t[1] * cu + f.b[1] * cv,
        f.n[2] + f.t[2] * cu + f.b[2] * cv,
      ];
      verts.push(
        p[0] * 0.5, p[1] * 0.5, p[2] * 0.5,
        f.n[0], f.n[1], f.n[2],
        ((cu + 1) / 2) * uvScale, ((cv + 1) / 2) * uvScale,
      );
    });
    const o = fi * 4;
    indices.push(o, o + 1, o + 2, o, o + 2, o + 3);
  });
  return { vertices: verts, indices };
}

export function buildPlane(size = 1, uvScale = 1) {
  const h = size / 2;
  const verts = [
    -h, 0, -h, 0, 1, 0, 0, 0,
    h, 0, -h, 0, 1, 0, uvScale, 0,
    h, 0, h, 0, 1, 0, uvScale, uvScale,
    -h, 0, h, 0, 1, 0, 0, uvScale,
  ];
  return { vertices: verts, indices: [0, 1, 2, 0, 2, 3] };
}

export function buildPyramid(uvScale = 1) {
  const verts = [];
  const indices = [];
  const apex = [0, 1, 0];
  const base = [
    [-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1],
  ];
  // 4 side faces
  for (let i = 0; i < 4; i++) {
    const a = base[i];
    const b = base[(i + 1) % 4];
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const e2 = [apex[0] - a[0], apex[1] - a[1], apex[2] - a[2]];
    let n = [
      e1[1] * e2[2] - e1[2] * e2[1],
      e1[2] * e2[0] - e1[0] * e2[2],
      e1[0] * e2[1] - e1[1] * e2[0],
    ];
    const len = Math.hypot(n[0], n[1], n[2]) || 1;
    n = [n[0] / len, n[1] / len, n[2] / len];
    const o = verts.length / 8;
    verts.push(a[0] * 0.6, a[1] * 0.6, a[2] * 0.6, n[0], n[1], n[2], 0, uvScale);
    verts.push(b[0] * 0.6, b[1] * 0.6, b[2] * 0.6, n[0], n[1], n[2], uvScale, uvScale);
    verts.push(apex[0] * 0.6, apex[1] * 0.6, apex[2] * 0.6, n[0], n[1], n[2], uvScale / 2, 0);
    indices.push(o, o + 1, o + 2);
  }
  return { vertices: verts, indices };
}

// A vertical, double-sided quad for billboard sprites. Spans x[-0.5,0.5],
// y[0,1] (feet on the ground), facing +Z. Double-sided so it shows from any
// angle regardless of how it's rotated to face the camera.
export function buildQuad() {
  const n = [0, 0, 1];
  const v = [
    -0.5, 0, 0, ...n, 0, 1,
    0.5, 0, 0, ...n, 1, 1,
    0.5, 1, 0, ...n, 1, 0,
    -0.5, 1, 0, ...n, 0, 0,
  ];
  // front (CCW from +Z) + back (reversed)
  const indices = [0, 1, 2, 0, 2, 3, 0, 2, 1, 0, 3, 2];
  return { vertices: v, indices };
}
