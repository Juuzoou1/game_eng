// A scene is a flat list of entities. Each entity has a transform, a mesh,
// a texture and an optional per-frame update callback.
import { Mat4 } from './math.js';

export class Entity {
  constructor({ mesh, texture, position = [0, 0, 0], rotation = [0, 0, 0],
    scale = [1, 1, 1], tint = [1, 1, 1], update = null }) {
    this.mesh = mesh;
    this.texture = texture;
    this.position = position;
    this.rotation = rotation;
    this.scale = scale;
    this.tint = tint;
    this.update = update;
  }

  modelMatrix() {
    let m = Mat4.translation(this.position[0], this.position[1], this.position[2]);
    m = Mat4.multiply(m, Mat4.rotationY(this.rotation[1]));
    m = Mat4.multiply(m, Mat4.rotationX(this.rotation[0]));
    m = Mat4.multiply(m, Mat4.rotationZ(this.rotation[2]));
    m = Mat4.multiply(m, Mat4.scaling(this.scale[0], this.scale[1], this.scale[2]));
    return m;
  }
}

export class Scene {
  constructor() {
    this.entities = [];
  }

  add(entity) {
    this.entities.push(entity);
    return entity;
  }

  remove(entity) {
    const i = this.entities.indexOf(entity);
    if (i >= 0) this.entities.splice(i, 1);
  }

  update(dt, time) {
    for (const e of this.entities) {
      if (e.update) e.update(e, dt, time);
    }
  }

  render(renderer) {
    for (const e of this.entities) {
      const model = e.modelMatrix();
      const normalMat = Mat4.normalFromMat4(model);
      renderer.drawMesh(e.mesh, model, normalMat, e.texture, e.tint);
    }
  }
}
