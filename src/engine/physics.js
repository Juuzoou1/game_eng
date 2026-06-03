// Dead-simple physics: axis-aligned bounding boxes (AABB) for solid props,
// and a circle-vs-AABB resolve so the player can't walk through walls.
// Collision is done in the XZ plane only (player walks on flat ground).

// Build an AABB from an entity that uses a unit cube mesh.
// A unit cube spans [-0.5, 0.5]; scale stretches it.
export function aabbFromCube(entity, pad = 0) {
  const [px, , pz] = entity.position;
  const hx = entity.scale[0] * 0.5 + pad;
  const hz = entity.scale[2] * 0.5 + pad;
  return { minX: px - hx, maxX: px + hx, minZ: pz - hz, maxZ: pz + hz };
}

// Push a circle (player) out of a box if it overlaps. Returns new [x, z].
export function resolveCircleBox(x, z, radius, box) {
  // Closest point on the box to the circle center.
  const cx = Math.max(box.minX, Math.min(x, box.maxX));
  const cz = Math.max(box.minZ, Math.min(z, box.maxZ));
  const dx = x - cx;
  const dz = z - cz;
  const distSq = dx * dx + dz * dz;

  if (distSq > radius * radius) return [x, z]; // no overlap

  if (distSq > 1e-6) {
    // Push out along the vector from the box surface to the center.
    const dist = Math.sqrt(distSq);
    const push = (radius - dist) / dist;
    return [x + dx * push, z + dz * push];
  }

  // Center is inside the box: push out along the smallest penetration axis.
  const toLeft = x - box.minX;
  const toRight = box.maxX - x;
  const toNear = z - box.minZ;
  const toFar = box.maxZ - z;
  const minPen = Math.min(toLeft, toRight, toNear, toFar);
  if (minPen === toLeft) return [box.minX - radius, z];
  if (minPen === toRight) return [box.maxX + radius, z];
  if (minPen === toNear) return [x, box.minZ - radius];
  return [x, box.maxZ + radius];
}

// Resolve the player position against every solid box.
export function collide(x, z, radius, boxes) {
  for (const box of boxes) {
    [x, z] = resolveCircleBox(x, z, radius, box);
  }
  return [x, z];
}
