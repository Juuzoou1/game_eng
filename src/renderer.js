// The PS1-flavored renderer.
//
// Tricks that sell the look:
//  1. Render the whole scene into a tiny offscreen framebuffer (e.g. 320x240),
//     then blit it to the screen with NEAREST filtering -> chunky pixels.
//  2. Vertex snapping: positions are quantized to a low-res grid in the vertex
//     shader, which makes geometry wobble/jitter exactly like the PSX did
//     (it had no sub-pixel precision).
//  3. Affine texture mapping: skip perspective correction on UVs so textures
//     warp and swim across polygons.
//  4. Per-vertex (Gouraud) lighting + distance fog, no per-pixel anything.
//  5. Ordered 4x4 Bayer dithering to fake more colors on a limited palette.

const SCENE_VS = `
precision mediump float;

attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec2 aUV;

uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProj;
uniform mat3 uNormalMat;
uniform vec2 uSnap;        // snap resolution (grid)
uniform vec3 uLightDir;
uniform vec3 uAmbient;

varying vec2 vUV;
varying float vW;          // for affine texture mapping
varying float vFog;        // 0 = near, 1 = fully fogged
varying vec3 vLight;

void main() {
  vec4 world = uModel * vec4(aPosition, 1.0);
  vec4 viewPos = uView * world;
  vec4 clip = uProj * viewPos;

  // --- vertex snapping (the PSX wobble) ---
  vec4 snapped = clip;
  snapped.xyz = clip.xyz / clip.w;          // to NDC
  snapped.xy = floor(snapped.xy * uSnap) / uSnap;
  snapped.xyz *= clip.w;                     // back to clip space
  gl_Position = snapped;

  // --- affine texture mapping ---
  // Pre-multiply UV by w; we divide by an interpolated w in the fragment
  // shader. The net effect cancels perspective correction -> warping UVs.
  vUV = aUV * clip.w;
  vW = clip.w;

  // --- per-vertex lighting (flat-ish, hard) ---
  vec3 n = normalize(uNormalMat * aNormal);
  float diff = max(dot(n, normalize(uLightDir)), 0.0);
  vLight = uAmbient + vec3(diff);

  // --- distance fog ---
  float dist = length(viewPos.xyz);
  vFog = clamp((dist - 6.0) / 22.0, 0.0, 1.0);
}
`;

const SCENE_FS = `
precision mediump float;

uniform sampler2D uTex;
uniform vec3 uFogColor;
uniform vec3 uTint;

varying vec2 vUV;
varying float vW;
varying float vFog;
varying vec3 vLight;

void main() {
  vec2 uv = vUV / vW;                 // affine: divide back out
  vec4 tex = texture2D(uTex, uv);
  vec3 col = tex.rgb * vLight * uTint;

  // crush the color depth a little (15-bit-ish) for retro banding
  col = floor(col * 31.0) / 31.0;

  col = mix(col, uFogColor, vFog);
  gl_FragColor = vec4(col, tex.a);
}
`;

// Fullscreen pass that upscales the low-res buffer and applies dithering.
const POST_VS = `
precision mediump float;
attribute vec2 aPos;
varying vec2 vUV;
void main() {
  vUV = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const POST_FS = `
precision mediump float;
uniform sampler2D uScene;
uniform vec2 uResolution;
varying vec2 vUV;

// 4x4 ordered Bayer dither matrix.
float bayer(vec2 p) {
  int x = int(mod(p.x, 4.0));
  int y = int(mod(p.y, 4.0));
  int i = x + y * 4;
  float m[16];
  m[0]=0.0;  m[1]=8.0;  m[2]=2.0;  m[3]=10.0;
  m[4]=12.0; m[5]=4.0;  m[6]=14.0; m[7]=6.0;
  m[8]=3.0;  m[9]=11.0; m[10]=1.0; m[11]=9.0;
  m[12]=15.0;m[13]=7.0; m[14]=13.0;m[15]=5.0;
  for (int k = 0; k < 16; k++) {
    if (k == i) return m[k] / 16.0 - 0.5;
  }
  return 0.0;
}

void main() {
  vec3 col = texture2D(uScene, vUV).rgb;
  vec2 pix = vUV * uResolution;
  col += bayer(pix) * (1.0 / 32.0);  // nudge before quantizing
  col = floor(col * 31.0 + 0.5) / 31.0;
  gl_FragColor = vec4(col, 1.0);
}
`;

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error('Shader error: ' + gl.getShaderInfoLog(sh) + '\n' + src);
  }
  return sh;
}

function program(gl, vsSrc, fsSrc) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vsSrc));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fsSrc));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error('Link error: ' + gl.getProgramInfoLog(p));
  }
  return p;
}

export class Renderer {
  constructor(canvas, options = {}) {
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
    if (!gl) throw new Error('WebGL not supported in this browser.');
    this.gl = gl;
    this.canvas = canvas;

    // Internal render resolution (kept tiny on purpose).
    this.lowW = options.width || 320;
    this.lowH = options.height || 240;

    this.fogColor = options.fogColor || [0.04, 0.05, 0.09];
    this.snap = options.snap || 160; // higher = less wobble

    this._buildPrograms();
    this._buildFramebuffer();
    this._buildQuad();

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
  }

  _buildPrograms() {
    const gl = this.gl;
    this.scene = program(gl, SCENE_VS, SCENE_FS);
    this.sceneLoc = {
      position: gl.getAttribLocation(this.scene, 'aPosition'),
      normal: gl.getAttribLocation(this.scene, 'aNormal'),
      uv: gl.getAttribLocation(this.scene, 'aUV'),
      model: gl.getUniformLocation(this.scene, 'uModel'),
      view: gl.getUniformLocation(this.scene, 'uView'),
      proj: gl.getUniformLocation(this.scene, 'uProj'),
      normalMat: gl.getUniformLocation(this.scene, 'uNormalMat'),
      snap: gl.getUniformLocation(this.scene, 'uSnap'),
      lightDir: gl.getUniformLocation(this.scene, 'uLightDir'),
      ambient: gl.getUniformLocation(this.scene, 'uAmbient'),
      tex: gl.getUniformLocation(this.scene, 'uTex'),
      fogColor: gl.getUniformLocation(this.scene, 'uFogColor'),
      tint: gl.getUniformLocation(this.scene, 'uTint'),
    };

    this.post = program(gl, POST_VS, POST_FS);
    this.postLoc = {
      pos: gl.getAttribLocation(this.post, 'aPos'),
      scene: gl.getUniformLocation(this.post, 'uScene'),
      resolution: gl.getUniformLocation(this.post, 'uResolution'),
    };
  }

  _buildFramebuffer() {
    const gl = this.gl;
    this.colorTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.colorTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.lowW, this.lowH, 0,
      gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this.depthBuf = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.depthBuf);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, this.lowW, this.lowH);

    this.fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D, this.colorTex, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT,
      gl.RENDERBUFFER, this.depthBuf);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  _buildQuad() {
    const gl = this.gl;
    this.quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  }

  // --- frame lifecycle ---

  beginScene(camera) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.viewport(0, 0, this.lowW, this.lowH);
    gl.clearColor(this.fogColor[0], this.fogColor[1], this.fogColor[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(this.scene);
    const aspect = this.lowW / this.lowH;
    gl.uniformMatrix4fv(this.sceneLoc.proj, false, camera.projection(aspect));
    gl.uniformMatrix4fv(this.sceneLoc.view, false, camera.view());
    gl.uniform2f(this.sceneLoc.snap, this.snap, this.snap * (this.lowH / this.lowW));
    gl.uniform3fv(this.sceneLoc.lightDir, [0.4, 0.8, 0.3]);
    gl.uniform3fv(this.sceneLoc.ambient, [0.35, 0.35, 0.4]);
    gl.uniform3fv(this.sceneLoc.fogColor, this.fogColor);
    gl.uniform1i(this.sceneLoc.tex, 0);
  }

  drawMesh(mesh, modelMatrix, normalMatrix, texture, tint = [1, 1, 1]) {
    const gl = this.gl;
    gl.uniformMatrix4fv(this.sceneLoc.model, false, modelMatrix);
    gl.uniformMatrix3fv(this.sceneLoc.normalMat, false, normalMatrix);
    gl.uniform3fv(this.sceneLoc.tint, tint);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    mesh.bind(this.sceneLoc);
    mesh.draw();
  }

  endScene() {
    const gl = this.gl;
    // Blit low-res buffer to the screen with dithering.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.disable(gl.DEPTH_TEST);

    gl.useProgram(this.post);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.enableVertexAttribArray(this.postLoc.pos);
    gl.vertexAttribPointer(this.postLoc.pos, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.colorTex);
    gl.uniform1i(this.postLoc.scene, 0);
    gl.uniform2f(this.postLoc.resolution, this.lowW, this.lowH);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.enable(gl.DEPTH_TEST);
  }

  resize(w, h) {
    this.canvas.width = w;
    this.canvas.height = h;
  }
}
