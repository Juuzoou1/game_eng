// A tiny Wavefront .OBJ parser → interleaved mesh data for our Mesh class.
// Supports v / vt / vn / f (with polygon fan triangulation). Missing normals
// are computed per-face (flat shading), missing UVs default to (0,0).
//
// Output: { vertices: [x,y,z, nx,ny,nz, u,v, ...], indices: [...] }
// (8 floats per vertex, matching Mesh's expected layout.)

export function parseOBJ(text) {
  const positions = [];
  const uvs = [];
  const normals = [];
  const verts = [];   // flat list of 8-float vertices
  const indices = [];

  const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const norm = (v) => {
    const l = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  };

  const lines = text.split('\n');
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line[0] === '#') continue;
    const parts = line.split(/\s+/);
    const tag = parts[0];
    if (tag === 'v') positions.push(parts.slice(1, 4).map(Number));
    else if (tag === 'vt') uvs.push(parts.slice(1, 3).map(Number));
    else if (tag === 'vn') normals.push(parts.slice(1, 4).map(Number));
    else if (tag === 'f') {
      // collect the polygon's corner refs, then fan-triangulate
      const corner = parts.slice(1).map((tok) => {
        const [vi, ti, ni] = tok.split('/');
        return {
          v: parseIndex(vi, positions.length),
          t: ti ? parseIndex(ti, uvs.length) : -1,
          n: ni ? parseIndex(ni, normals.length) : -1,
        };
      });
      for (let i = 1; i < corner.length - 1; i++) {
        const tri = [corner[0], corner[i], corner[i + 1]];
        // face normal fallback when the OBJ has no vn
        let fn = null;
        if (tri.some((c) => c.n < 0)) {
          const p0 = positions[tri[0].v], p1 = positions[tri[1].v], p2 = positions[tri[2].v];
          fn = norm(cross(sub(p1, p0), sub(p2, p0)));
        }
        for (const c of tri) {
          const p = positions[c.v];
          const uv = c.t >= 0 ? uvs[c.t] : [0, 0];
          const n = c.n >= 0 ? normals[c.n] : fn;
          verts.push(p[0], p[1], p[2], n[0], n[1], n[2], uv[0], uv[1]);
          indices.push(indices.length);
        }
      }
    }
  }
  return { vertices: verts, indices };
}

// OBJ indices are 1-based; negatives count back from the end.
function parseIndex(s, count) {
  const i = parseInt(s, 10);
  return i > 0 ? i - 1 : count + i;
}
