// First-person camera with yaw/pitch. Walks the XZ plane (eye height fixed).
import { Mat4, Vec3, deg2rad } from './math.js';

export class Camera {
  constructor() {
    this.position = [0, 1.6, 6];
    this.yaw = Math.PI;   // looking toward -Z
    this.pitch = 0;
    this.fov = deg2rad(70);
    this.near = 0.1;
    this.far = 60;
  }

  // Unit vector the camera is facing.
  forward() {
    return [
      Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      Math.cos(this.yaw) * Math.cos(this.pitch),
    ];
  }

  right() {
    // forward x up, on the ground plane
    const f = this.forward();
    return Vec3.normalize(Vec3.cross([0, 1, 0], f));
  }

  view() {
    const target = Vec3.add(this.position, this.forward());
    return Mat4.lookAt(this.position, target, [0, 1, 0]);
  }

  projection(aspect) {
    return Mat4.perspective(this.fov, aspect, this.near, this.far);
  }

  look(dx, dy) {
    const sens = 0.0025;
    this.yaw -= dx * sens;
    this.pitch -= dy * sens;
    const limit = deg2rad(89);
    this.pitch = Math.max(-limit, Math.min(limit, this.pitch));
  }
}
