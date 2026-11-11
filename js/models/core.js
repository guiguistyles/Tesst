'use strict';
/* ZaapRush 2.0 — modèles 3D (Three.js r128, primitives uniquement).
   Fichier partagé par la visionneuse (models/viewer.html) et le jeu. */
// Outils de construction communs à tous les modèles 3D (primitives, matériaux, articulations).

/* =====================================================================
   ZaapRush 2.0 — Bestiaire 3D
   Toutes les créatures sont construites uniquement avec des primitives
   Three.js (Box, Cone, Cylinder, Torus, Sphere) et des couleurs unies.
   Chaque modèle a sa fonction buildXxx() qui renvoie :
     { root, fx, update(mode, t, dt) }
   - root : le modèle (hiérarchie tête / corps / membres), exportable
   - fx   : effets temporaires (flèches tirées, traînées), jamais exportés
   - update : anime le modèle selon le mode "idle" | "move" | "ability" | "still"
   ===================================================================== */


/* ---------------------------------------------------------------- Outils de construction */
const TAU = Math.PI * 2;
const MATS = new Map();

/** Matériau uni, flat shading. glow > 0 rend la couleur émissive (yeux, cristaux, runes). */
function mat(hex, glow = 0, opacity = 1) {
  const key = hex + '|' + glow + '|' + opacity;
  if (!MATS.has(key)) {
    const m = new THREE.MeshStandardMaterial({
      color: hex, flatShading: true, roughness: 0.75, metalness: 0.05,
      emissive: glow ? hex : 0x000000, emissiveIntensity: glow,
      transparent: opacity < 1, opacity, depthWrite: opacity >= 1,
    });
    MATS.set(key, m);
  }
  return MATS.get(key);
}

function mesh(geo, material, name) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = material.opacity >= 1;
  m.receiveShadow = true;
  if (name) m.name = name;
  return m;
}
const box = (w, h, d, m, name) => mesh(new THREE.BoxGeometry(w, h, d), m, name);
const cone = (r, h, seg, m, name) => mesh(new THREE.ConeGeometry(r, h, seg), m, name);
const cyl = (rt, rb, h, seg, m, name) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m, name);
const sph = (r, ws, hs, m, name) => mesh(new THREE.SphereGeometry(r, ws, hs), m, name);
const torus = (R, t, rs, ts, m, arc = TAU, name) => mesh(new THREE.TorusGeometry(R, t, rs, ts, arc), m, name);

/** Place un objet : position puis rotation (radians). */
function at(obj, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  obj.position.set(x, y, z);
  obj.rotation.set(rx, ry, rz);
  return obj;
}
/** Groupe nommé (articulation) attaché à un parent. */
function joint(name, parent, x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  g.name = name;
  g.position.set(x, y, z);
  if (parent) parent.add(g);
  return g;
}
/** Cristal : deux cônes base contre base (bipyramide). */
function crystal(r, h, m, seg = 4) {
  const g = new THREE.Group();
  g.add(at(cone(r, h * 0.6, seg, m), 0, h * 0.3, 0));
  g.add(at(cone(r, h * 0.4, seg, m), 0, -h * 0.2, 0, Math.PI));
  return g;
}
const lerp = (a, b, k) => a + (b - a) * k;
const ease = (k) => k * k * (3 - 2 * k);
const clamp01 = (k) => Math.max(0, Math.min(1, k));
