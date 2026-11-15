// 모바일 안전 후처리: 필름 그레인, 비네트, 색수차, 왜곡(불안 연출), 페이드. 품질 낮음이면 생략.
import * as THREE from 'three';

const FRAG = `
precision highp float;
uniform sampler2D tDiffuse; uniform float time, grain, vig, ca, distort, fade, desat, warm; uniform vec3 fadeColor; uniform vec2 res;
varying vec2 vUv;
float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
vec3 toSRGB(vec3 c){ c = max(c, 0.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }
void main(){
  vec2 uv = vUv;
  if (distort > 0.0) { uv.x += sin(uv.y * 18.0 + time * 2.3) * 0.004 * distort; uv.y += sin(uv.x * 11.0 + time * 1.7) * 0.003 * distort; }
  vec2 d = uv - 0.5; float r2 = dot(d, d);
  float k = ca * (0.6 + r2 * 3.0);
  vec3 col; col.r = texture2D(tDiffuse, uv + d * k * 0.012).r; col.g = texture2D(tDiffuse, uv).g; col.b = texture2D(tDiffuse, uv - d * k * 0.012).b;
  col = toSRGB(col);
  float l = dot(col, vec3(0.299, 0.587, 0.114)); col = mix(col, vec3(l), desat);
  col *= vec3(1.0 + warm * 0.04, 1.0, 1.0 - warm * 0.05);
  col *= 1.0 - vig * smoothstep(0.12, 0.75, r2 * 1.6);
  col += (h(uv * res + fract(time * 13.7)) - 0.5) * grain;
  col = mix(col, fadeColor, fade);
  gl_FragColor = vec4(col, 1.0);
}`;
export class Post {
  constructor(renderer) {
    this.r = renderer; this.enabled = true;
    const isWebGL2 = renderer.capabilities.isWebGL2;
    this.rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: isWebGL2 ? 4 : 0, depthBuffer: true });
    this.u = { tDiffuse: { value: this.rt.texture }, time: { value: 0 }, grain: { value: .06 }, vig: { value: .55 }, ca: { value: .35 }, distort: { value: 0 }, fade: { value: 0 }, desat: { value: .12 }, warm: { value: 1 }, fadeColor: { value: new THREE.Color(0, 0, 0) }, res: { value: new THREE.Vector2(1, 1) } };
    this.mat = new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: FRAG, depthTest: false, depthWrite: false });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat); this.quad.frustumCulled = false;
    this.scene = new THREE.Scene(); this.scene.add(this.quad); this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.fadeDom = document.getElementById('fade');
  }
  setSize(w, h, pr) { this.rt.setSize(Math.floor(w * pr), Math.floor(h * pr)); this.u.res.value.set(w * pr, h * pr); }
  render(scene, camera, overlay) {
    const r = this.r;
    if (!this.enabled) { // 후처리 없이: 페이드는 DOM 으로
      r.setRenderTarget(null); r.render(scene, camera); if (overlay) { r.autoClear = false; r.clearDepth(); r.render(overlay.scene, overlay.camera); r.autoClear = true; }
      this.fadeDom.style.opacity = this.u.fade.value; this.fadeDom.style.background = '#' + this.u.fadeColor.value.getHexString(); return;
    }
    this.fadeDom.style.opacity = 0;
    r.setRenderTarget(this.rt); r.render(scene, camera);
    if (overlay) { r.autoClear = false; r.clearDepth(); r.render(overlay.scene, overlay.camera); r.autoClear = true; }
    r.setRenderTarget(null); r.render(this.scene, this.cam);
  }
}
