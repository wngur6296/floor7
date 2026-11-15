// 에셋 로더: data/assets.js 매니페스트를 읽어 텍스처·재질·모델을 id 로 제공한다.
import * as THREE from 'three';
import { TEXTURES, MATERIALS, MODELS } from '../../data/assets.js';
import { procTexture } from './proctex.js';
import { makeBuilders } from './props.js';

const texCache = new Map(), matCache = new Map(), glbCache = new Map();
const texLoader = new THREE.TextureLoader();

export function tex(id) {
  if (texCache.has(id)) return texCache.get(id);
  const d = TEXTURES[id] || { proc: id };
  const t = procTexture(d.proc || id);
  if (d.url) { // 이미지가 지정되면 로드 후 교체 (실패 시 절차 텍스처 유지)
    texLoader.load(d.url, img => { t.image = img.image; t.needsUpdate = true; }, undefined, () => console.warn('texture fallback', id));
  }
  texCache.set(id, t); return t;
}
export function mat(id) {
  if (matCache.has(id)) return matCache.get(id);
  let m;
  if (id.startsWith('emit:')) m = new THREE.MeshBasicMaterial({ color: new THREE.Color(id.slice(5)) });
  else if (id.startsWith('#')) m = new THREE.MeshLambertMaterial({ color: new THREE.Color(id) });
  else {
    const d = MATERIALS[id] || { color: 0xff00ff };
    m = new THREE.MeshLambertMaterial({ color: d.color ?? 0xffffff });
    if (d.tex) m.map = tex(d.tex);
    if (d.emissive) { m.emissive = new THREE.Color(d.emissive); if (d.tex) m.emissiveMap = m.map; }
    if (d.opacity) { m.transparent = true; m.opacity = d.opacity; }
    m.userData.tile = d.tile || 1;
  }
  m.userData.id = id; matCache.set(id, m); return m;
}
export const builders = makeBuilders(mat);

export async function preloadModels(onProgress) {
  const ids = Object.keys(MODELS).filter(k => MODELS[k].glb); if (!ids.length) return; // GLB 가 하나도 없으면 로더(108KB)도 받지 않는다
  const { GLTFLoader } = await import('../../vendor/GLTFLoader.js'); const loader = new GLTFLoader();
  let n = 0;
  await Promise.all(ids.map(id => new Promise(res => loader.load(MODELS[id].glb, g => { glbCache.set(id, g.scene); onProgress?.(++n / ids.length); res(); }, undefined, e => { console.warn('GLB 로드 실패 → 프리미티브 사용:', id, e?.message); res(); }))));
}
// 모델 인스턴스 생성. GLB 가 있으면 GLB, 아니면 프리미티브 빌더.
export function model(id, o = {}) {
  const d = MODELS[id] || {}; const glb = glbCache.get(id);
  if (glb) {
    const g = new THREE.Group(); const c = glb.clone(true); c.scale.setScalar(d.scale || 1); c.rotation.y = THREE.MathUtils.degToRad(d.rotY || 0); c.position.y = d.y || 0; g.add(c);
    const prim = builders[id]?.(o);
    g.userData.size = d.size || prim?.userData.size;
    if (prim && d.keepPrimitive) prim.traverse(ch => { if (ch.name === 'screen' || ch.name === 'label') g.add(ch.clone()); });
    // 상호작용 부품 이름 유지: GLB 안에 'drawer','leaf','screen' 이름이 있으면 그대로 동작
    return g;
  }
  const b = builders[id]; if (!b) { console.warn('모델 없음', id); return builders.placeholder({ label: id }); }
  return b(o);
}
