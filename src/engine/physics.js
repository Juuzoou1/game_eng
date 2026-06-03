// 3D physics: axis-aligned bounding boxes (AABB) with vertical awareness, so
// the player can jump, land on top of boxes, and be blocked by walls only when
// actually overlapping them vertically. Plus a ray vs AABB cast for aiming.

// Build a full 3D AABB from an entity that uses a unit cube mesh.
// A unit cube spans [-0.5, 0.5] on each axis; scale stretches it.
export function aabbFromCube(entity) {
  const [px, py, pz] = entity.position;
  const hx = entity.scale[0] * 0.5;
  const hy = entity.scale[1] * 0.5;
  const hz = entity.scale[2] * 0.5;
  return {
    minX: px - hx, maxX: px + hx,
    minY: py - hy, maxY: py + hy,
    minZ: pz - hz, maxZ: pz + hz,
    entity, // back-reference so raycasts can tell you what was hit
  };
}

// Push a circle (player, XZ) out of a box if it overlaps. Returns [x, z].
export function resolveCircleBox(x, z, radius, box) {
  const cx = Math.max(box.minX, Math.min(x, box.maxX));
  const cz = Math.max(box.minZ, Math.min(z, box.maxZ));
  const dx = x - cx;
  const dz = z - cz;
  const distSq = dx * dx + dz * dz;
  if (distSq > radius * radius) return [x, z];

  if (distSq > 1e-6) {
    const dist = Math.sqrt(distSq);
    const push = (radius - dist) / dist;
    return [x + dx * push, z + dz * push];
  }
  // center inside: push out along smallest penetration axis
  const toLeft = x - box.minX, toRight = box.maxX - x;
  const toNear = z - box.minZ, toFar = box.maxZ - z;
  const minPen = Math.min(toLeft, toRight, toNear, toFar);
  if (minPen === toLeft) return [box.minX - radius, z];
  if (minPen === toRight) return [box.maxX + radius, z];
  if (minPen === toNear) return [x, box.minZ - radius];
  return [x, box.maxZ + radius];
}

// Resolve XZ movement against solids, but only block when the player's vertical
// span [feetY, feetY+height] actually overlaps the box. This lets you stand on
// top of crates and pass over them once high enough.
export function collide(x, z, radius, feetY, height, boxes) {
  const headY = feetY + height;
  for (const b of boxes) {
    if (feetY >= b.maxY - 0.001) continue; // standing on or above the box top
    if (headY <= b.minY) continue;         // entirely below the box
    [x, z] = resolveCircleBox(x, z, radius, b);
  }
  return [x, z];
}

// Highest support surface under the player at (x,z): the ground (0) plus the top
// of any box the player is standing over, as long as it's within `step` of the
// feet (so you can't teleport up walls — you must jump).
export function groundHeightAt(x, z, radius, feetY, boxes, step = 0.5) {
  let h = 0;
  for (const b of boxes) {
    const cx = Math.max(b.minX, Math.min(x, b.maxX));
    const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
    const dx = x - cx, dz = z - cz;
    if (dx * dx + dz * dz > radius * radius) continue; // not over this box
    if (b.maxY <= feetY + step && b.maxY > h) h = b.maxY;
  }
  return h;
}

// Ray vs single AABB (slab method). Returns entry distance t >= 0, or null.
function rayBox(o, d, b) {
  const min = [b.minX, b.minY, b.minZ];
  const max = [b.maxX, b.maxY, b.maxZ];
  let tmin = -Infinity, tmax = Infinity;
  for (let a = 0; a < 3; a++) {
    if (Math.abs(d[a]) < 1e-8) {
      if (o[a] < min[a] || o[a] > max[a]) return null;
    } else {
      let t1 = (min[a] - o[a]) / d[a];
      let t2 = (max[a] - o[a]) / d[a];
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
  }
  if (tmax < 0) return null;
  return tmin >= 0 ? tmin : tmax;
}

// Cast a ray against all boxes. Returns the nearest hit within maxDist:
//   { distance, point: [x,y,z], box, entity }  or null.
export function raycastBoxes(origin, dir, boxes, maxDist = Infinity) {
  let best = null;
  for (const b of boxes) {
    const t = rayBox(origin, dir, b);
    if (t !== null && t <= maxDist && (!best || t < best.distance)) {
      best = {
        distance: t,
        point: [origin[0] + dir[0] * t, origin[1] + dir[1] * t, origin[2] + dir[2] * t],
        box: b,
        entity: b.entity || null,
      };
    }
  }
  return best;
}
