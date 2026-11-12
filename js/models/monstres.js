'use strict';
/* ZaapRush 2.0 — modèles 3D (Three.js r128, primitives uniquement).
   Fichier partagé par la visionneuse (models/viewer.html) et le jeu. */
// Monstres ordinaires des 5 zones : modèles compacts (quelques dizaines de pièces)
// qui seront fusionnés en un seul bloc coloré pour être dessinés par centaines.

/* ---------------------------------------------------------------- Outils */
const mG = () => new THREE.Group();
/** Paire d'yeux : blanc + pupille (ou yeux lumineux si glow). */
function mEyes(g, x, y, z, s, glowHex) {
  for (const k of [-1, 1]) {
    if (glowHex) g.add(at(box(s, s * 0.7, 0.02, mat(glowHex, 0.9)), k * x, y, z));
    else {
      g.add(at(box(s, s * 1.1, 0.02, mat(0xffffff)), k * x, y, z));
      g.add(at(box(s * 0.5, s * 0.6, 0.02, mat(0x1e1214)), k * x, y, z + 0.012));
    }
  }
}

/* ---------------------------------------------------------------- Astrub */
/** Bouftou : mouton de laine aux cornes enroulées. */
function buildMonstreBouftou() { return buildBouftou(1); }
/** Tofu : petite boule à plumes jaune. */
function buildMonstreTofu() { return birdBase({ name: 'Tofu' }).root; }
/** Piou rouge : cousin du tofu, plus vif. */
function buildMonstrePiou() { return birdBase({ name: 'Piou', body: 0xff5b5b, body2: 0xc83a3a, belly: 0xffc8a0, angry: true }).root; }
/** Larve bleue : trois anneaux qui rampent. */
function buildMonstreLarve() {
  const g = mG(), b = mat(0x4fa3ff), d = mat(0x1f5fa8);
  for (let i = 0; i < 3; i++) {
    g.add(at(sph(0.3 - i * 0.05, 7, 5, b), 0, 0.27 - i * 0.03, -i * 0.36));
    g.add(at(box(0.18 - i * 0.03, 0.05, 0.12, d), 0, 0.55 - i * 0.08, -i * 0.36));
  }
  mEyes(g, 0.1, 0.34, 0.28, 0.09);
  for (const k of [-1, 1]) g.add(at(cone(0.025, 0.2, 4, d), k * 0.1, 0.62, 0.12, -0.4, 0, k * -0.3));
  return g;
}

/** Pichon : petit poisson bleu qui sautille hors de l'eau. */
function buildMonstrePichon() {
  const g = mG(), b = mat(0x5ab0e8), d = mat(0x1f5f9a), belly = mat(0xe8f4ff);
  const body = at(sph(0.32, 8, 6, b), 0, 0.36, 0); body.scale.set(0.8, 0.9, 1.25); g.add(body);
  const bl = at(sph(0.24, 8, 6, belly), 0, 0.28, 0.06); bl.scale.set(0.75, 0.7, 1.1); g.add(bl);
  g.add(at(cone(0.22, 0.3, 4, d), 0, 0.38, -0.5, -Math.PI / 2, Math.PI / 4));
  g.add(at(cone(0.09, 0.26, 4, d), 0, 0.68, -0.02, -0.3, Math.PI / 4));
  for (const k of [-1, 1]) g.add(at(cone(0.07, 0.18, 4, d), k * 0.25, 0.3, 0.05, 0, 0, k * 1.9));
  g.add(at(box(0.16, 0.05, 0.04, mat(0xff8a9a)), 0, 0.27, 0.39));
  mEyes(g, 0.12, 0.44, 0.3, 0.075);
  return g;
}

/* ---------------------------------------------------------------- Amakna */
/** Sanglier : corps trapu, groin, défenses, crête de poils. */
function buildMonstreSanglier() {
  const g = mG(), b = mat(0x7a5236), d = mat(0x4a3020), tusk = mat(0xf0e6d0);
  g.add(at(box(0.62, 0.48, 0.95, b), 0, 0.5, 0));
  g.add(at(box(0.42, 0.38, 0.36, b), 0, 0.55, 0.6));
  g.add(at(box(0.24, 0.18, 0.12, mat(0xa87a5a)), 0, 0.48, 0.82));
  for (const k of [-1, 1]) {
    g.add(at(cone(0.04, 0.2, 4, tusk), k * 0.13, 0.44, 0.84, -0.6, 0, k * -0.3));
    g.add(at(cone(0.07, 0.16, 4, d), k * 0.15, 0.8, 0.52, 0, 0, k * -0.4));
    g.add(at(box(0.07, 0.05, 0.02, mat(0xff3030, 0.6)), k * 0.11, 0.62, 0.785));
    for (const z of [0.3, -0.3]) g.add(at(box(0.14, 0.3, 0.14, d), k * 0.2, 0.15, z));
  }
  for (let i = 0; i < 5; i++) g.add(at(cone(0.05, 0.18, 4, d), 0, 0.8, 0.35 - i * 0.18, -0.4));
  g.add(at(cone(0.03, 0.2, 4, d), 0, 0.6, -0.52, -2));
  return g;
}
/** Arakne : araignée noire à huit pattes, tache rouge. */
function buildMonstreArakne() {
  const g = mG(), b = mat(0x3a3a3a), d = mat(0x262626);
  g.add(at(sph(0.28, 7, 5, b), 0, 0.35, 0.15));
  g.add(at(sph(0.4, 7, 5, b), 0, 0.42, -0.45));
  g.add(at(box(0.2, 0.04, 0.2, mat(0xdd3333, 0.4)), 0, 0.8, -0.45, 0, Math.PI / 4, 0));
  for (const k of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const z = 0.3 - i * 0.18, a = k * (0.5 + i * 0.05);
      g.add(at(cyl(0.025, 0.03, 0.45, 4, d), k * 0.38, 0.52, z, 0.2 * (i - 1.5), 0, a + k * 0.6));
      g.add(at(cyl(0.02, 0.025, 0.55, 4, d), k * 0.68, 0.25, z * 1.2, 0.2 * (i - 1.5), 0, -k * 0.35));
    }
    g.add(at(box(0.05, 0.05, 0.02, mat(0xff3030, 0.9)), k * 0.07, 0.42, 0.42));
    g.add(at(box(0.035, 0.035, 0.02, mat(0xff3030, 0.9)), k * 0.15, 0.48, 0.38));
  }
  return g;
}
/** Moskito : insecte violet, ailes pâles, long dard. */
function buildMonstreMoskito() {
  const g = mG(), b = mat(0x8a6a9a), d = mat(0x5a4068), wing = mat(0xe0e0ff, 0.3);
  const body = sph(0.22, 7, 5, b); body.scale.set(1, 0.9, 1.6); g.add(at(body, 0, 0.5, -0.1));
  for (let i = 0; i < 3; i++) g.add(at(torus(0.17 - i * 0.03, 0.02, 4, 12, d), 0, 0.5, -0.2 - i * 0.12));
  g.add(at(sph(0.15, 7, 5, b), 0, 0.55, 0.3));
  g.add(at(cone(0.02, 0.4, 4, d), 0, 0.48, 0.6, Math.PI / 2 + 0.3));
  for (const k of [-1, 1]) {
    g.add(at(box(0.5, 0.02, 0.22, wing), k * 0.3, 0.72, -0.05, 0, k * 0.3, k * 0.35));
    g.add(at(box(0.07, 0.07, 0.02, mat(0xff3030, 0.7)), k * 0.07, 0.6, 0.43));
    for (const z of [0.15, -0.1]) g.add(at(cyl(0.012, 0.012, 0.4, 4, d), k * 0.15, 0.3, z, 0, 0, k * 0.5));
  }
  return g;
}
/** Prespic : hérisson trapu couvert de piquants. */
function buildMonstrePrespic() {
  const g = mG(), b = mat(0x5a4a3a), spike = mat(0xd8c8a0), face = mat(0xb89a7a);
  const body = sph(0.42, 8, 6, b); body.scale.set(1, 0.75, 1.15); g.add(at(body, 0, 0.32, 0));
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2, row = i % 2;
    g.add(at(cone(0.05, 0.28, 4, spike), Math.cos(a) * 0.28, 0.5 + row * 0.1, Math.sin(a) * 0.32 - 0.05, Math.sin(a) * 0.7 - 0.3, 0, -Math.cos(a) * 0.7));
  }
  g.add(at(cone(0.16, 0.3, 6, face), 0, 0.3, 0.52, Math.PI / 2));
  g.add(at(sph(0.05, 5, 4, mat(0x1e1214)), 0, 0.3, 0.68));
  mEyes(g, 0.1, 0.42, 0.42, 0.07);
  return g;
}

/* ---------------------------------------------------------------- Forêt des Abraknydes */
/** Abraknyde : jeune arbre qui marche, yeux jaunes. */
function buildMonstreAbraknyde(o = {}) {
  const g = mG(), bark = mat(o.bark ?? 0x6a4a2a), leaf = mat(o.leaf ?? 0x3f7a2f), leaf2 = mat(o.leaf2 ?? 0x5a9a3a);
  g.add(at(box(0.42, 0.75, 0.36, bark), 0, 0.55, 0));
  for (const k of [-1, 1]) {
    g.add(at(box(0.16, 0.25, 0.18, bark), k * 0.13, 0.12, 0.02));
    g.add(at(cone(0.05, 0.2, 4, bark), k * 0.18, 0.04, 0.16, Math.PI / 2 + 0.6));
    g.add(at(box(0.12, 0.42, 0.12, bark), k * 0.32, 0.72, 0, 0, 0, k * 0.7));
    g.add(at(sph(0.1, 5, 4, leaf2), k * 0.5, 0.92, 0));
  }
  g.add(at(box(0.26, 0.08, 0.02, mat(0x1e1214)), 0, 0.5, 0.185));
  mEyes(g, 0.08, 0.66, 0.185, 0.08, o.eye ?? 0xffe060);
  if (o.pine) {
    for (let i = 0; i < 3; i++) {
      g.add(at(cone(0.45 - i * 0.1, 0.42, 7, leaf), 0, 1.05 + i * 0.28, 0));
      g.add(at(cone(0.3 - i * 0.07, 0.12, 7, leaf2), 0, 1.22 + i * 0.28, 0));
    }
  } else {
    g.add(at(sph(0.42, 7, 5, leaf), 0, 1.15, 0));
    g.add(at(sph(0.28, 6, 4, leaf2), -0.28, 1.05, 0.1));
    g.add(at(sph(0.28, 6, 4, leaf2), 0.28, 1.08, -0.05));
  }
  if (o.ice) for (let i = 0; i < 4; i++) g.add(at(crystal(0.06, 0.28, mat(0x7ab0d0, 0.4), 4), Math.cos(i * 1.6) * 0.25, 1 + (i % 2) * 0.25, Math.sin(i * 1.6) * 0.25, 0.3, 0, -0.4));
  return g;
}
/** Chafer : squelette guerrier, crâne aux yeux rouges, épée rouillée. */
function buildMonstreChafer(o = {}) {
  const g = mG(), bone = mat(o.bone ?? 0xe8e4d8), dark = mat(0x2a2420), rust = mat(0x8a6a5a);
  g.add(at(sph(0.2, 7, 5, bone), 0, 1.05, 0));
  g.add(at(box(0.22, 0.08, 0.16, bone), 0, 0.88, 0.05));
  for (const k of [-1, 1]) {
    g.add(at(box(0.08, 0.07, 0.02, dark), k * 0.07, 1.06, 0.18));
    g.add(at(box(0.035, 0.035, 0.02, mat(0xff3030, 0.9)), k * 0.07, 1.06, 0.192));
  }
  g.add(at(box(0.06, 0.45, 0.06, bone), 0, 0.6, -0.04));
  for (let i = 0; i < 3; i++) g.add(at(box(0.32 - i * 0.04, 0.035, 0.18, bone), 0, 0.75 - i * 0.09, 0.02));
  g.add(at(box(0.28, 0.1, 0.14, bone), 0, 0.38, 0));
  for (const k of [-1, 1]) {
    g.add(at(box(0.05, 0.36, 0.05, bone), k * 0.1, 0.18, 0));
    g.add(at(box(0.04, 0.38, 0.04, bone), k * 0.22, 0.62, 0.05, 0.3, 0, k * 0.15));
  }
  if (o.bow) {
    g.add(at(torus(0.3, 0.025, 4, 14, mat(0x6a4a2a), Math.PI * 0.8), -0.32, 0.6, 0.25, 0, Math.PI / 2, -Math.PI * 0.4));
    g.add(at(cyl(0.06, 0.06, 0.4, 6, mat(0x5c3a24)), 0.1, 0.72, -0.15, 0.3));
  } else {
    g.add(at(box(0.06, 0.6, 0.02, rust), 0.24, 0.55, 0.32, 1.2));
    g.add(at(box(0.18, 0.04, 0.05, dark), 0.24, 0.42, 0.16, 1.2));
  }
  return g;
}
/** Fantôme Pandore : spectre pâle qui flotte, chaînes aux poignets. */
function buildMonstreFantome() {
  const g = mG(), b = mat(0xc8d8ff, 0.15), d = mat(0x334), chain = mat(0x8a8a9a);
  g.add(at(sph(0.32, 8, 6, b), 0, 0.75, 0));
  g.add(at(cone(0.32, 0.6, 8, b), 0, 0.3, -0.05, Math.PI));
  g.add(at(cone(0.12, 0.3, 5, b), 0, 0.08, -0.3, Math.PI + 0.6));
  for (const k of [-1, 1]) {
    g.add(at(sph(0.09, 5, 4, b), k * 0.36, 0.62, 0.1));
    g.add(at(torus(0.06, 0.02, 4, 10, chain), k * 0.38, 0.52, 0.12, Math.PI / 2));
    g.add(at(box(0.09, 0.13, 0.02, d), k * 0.11, 0.8, 0.31));
  }
  g.add(at(box(0.12, 0.06, 0.02, d), 0, 0.64, 0.315));
  return g;
}

/* ---------------------------------------------------------------- Montagne des Craqueleurs */
/** Craqueleur : petit golem de pierre, fissures et œil jaune. */
function buildMonstreCraqueleur() {
  const g = mG(), r1 = mat(0x8a8a8a), r2 = mat(0x6a6a6a), vein = mat(0xffd060, 0.7), moss = mat(0x7a9a4a);
  g.add(at(box(0.7, 0.6, 0.55, r1), 0, 0.62, 0, 0, 0.1, 0.05));
  g.add(at(box(0.36, 0.3, 0.32, r2), 0, 1.05, 0.08));
  g.add(at(box(0.18, 0.05, 0.02, vein), 0, 1.07, 0.245));
  g.add(at(box(0.04, 0.35, 0.02, vein), -0.1, 0.62, 0.28, 0, 0, 0.4));
  for (const k of [-1, 1]) {
    g.add(at(box(0.24, 0.5, 0.26, r2), k * 0.48, 0.55, 0.05, 0, 0, k * 0.15));
    g.add(at(box(0.3, 0.24, 0.3, r1), k * 0.52, 0.25, 0.1));
    g.add(at(box(0.22, 0.3, 0.24, r2), k * 0.18, 0.15, 0));
  }
  for (let i = 0; i < 4; i++) g.add(at(sph(0.06, 5, 4, moss), -0.24 + i * 0.16, 0.94, -0.1 + (i % 2) * 0.1));
  return g;
}
/** Bwork : ogre vert à défenses, massue cloutée (ou bâton de mage). */
function buildMonstreBwork(o = {}) {
  const g = mG(), skin = mat(o.skin ?? 0x6a8a3a), skin2 = mat(o.skin2 ?? 0x4a6a2a), tusk = mat(0xf0e0b0), cloth = mat(o.cloth ?? 0x6a4a2a);
  g.add(at(box(0.6, 0.55, 0.42, skin), 0, 0.72, 0));
  g.add(at(box(0.44, 0.3, 0.1, skin2), 0, 0.62, 0.2));
  g.add(at(box(0.5, 0.2, 0.44, cloth), 0, 0.38, 0));
  g.add(at(box(0.4, 0.34, 0.36, skin), 0, 1.15, 0.05));
  for (const k of [-1, 1]) {
    g.add(at(cone(0.04, 0.16, 4, tusk), k * 0.1, 1.04, 0.24, -0.3));
    g.add(at(cone(0.07, 0.2, 4, skin2), k * 0.24, 1.22, 0, 0, 0, k * -1.2));
    g.add(at(box(0.18, 0.32, 0.2, skin2), k * 0.16, 0.15, 0));
    g.add(at(box(0.16, 0.5, 0.16, skin), k * 0.4, 0.72, 0.05, 0, 0, k * 0.2));
  }
  mEyes(g, 0.09, 1.18, 0.235, 0.08, o.eye ?? 0xffd040);
  if (o.mage) {
    g.add(at(cone(0.28, 0.5, 6, mat(0x3a2060)), 0, 1.55, 0.03, -0.15));
    g.add(at(cyl(0.03, 0.03, 1.2, 5, mat(0x5a3a2a)), 0.48, 0.75, 0.25));
    g.add(at(sph(0.1, 6, 5, mat(0xd070ff, 0.8)), 0.48, 1.38, 0.25));
  } else {
    g.add(at(cyl(0.05, 0.1, 0.7, 6, mat(0x5a3a2a)), 0.5, 0.65, 0.3, 0.6));
    for (let i = 0; i < 4; i++) g.add(at(cone(0.03, 0.1, 4, mat(0x9a9a9a)), 0.5 + Math.cos(i * 1.6) * 0.09, 0.85, 0.48 + Math.sin(i * 1.6) * 0.09, 0, 0, Math.PI / 2 + i * 1.6));
  }
  return g;
}
/** Gelée bleue : dôme gélatineux et brillant. */
function buildMonstreGelee() {
  const g = mG(), b = mat(0x4f8fff, 0.15), d = mat(0x1a3a7a);
  const dome = mesh(new THREE.SphereGeometry(0.5, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), b);
  dome.scale.set(1, 1.1, 1);
  g.add(dome);
  g.add(at(cyl(0.5, 0.52, 0.06, 10, d), 0, 0.03, 0));
  g.add(at(box(0.1, 0.18, 0.04, mat(0xffffff, 0.4)), -0.2, 0.35, 0.3, -0.4, 0, 0.4));
  for (const k of [-1, 1]) g.add(at(box(0.08, 0.12, 0.02, d), k * 0.12, 0.32, 0.43));
  g.add(at(box(0.14, 0.04, 0.02, d), 0, 0.2, 0.46));
  return g;
}

/* ---------------------------------------------------------------- Frigost */
/** Mansot : manchot des glaces. */
function buildMonstreMansot() {
  const g = mG(), b = mat(0x2a3a5a), w = mat(0xf0f0f0), o2 = mat(0xffa020);
  const body = sph(0.32, 8, 6, b); body.scale.set(1, 1.35, 0.95); g.add(at(body, 0, 0.45, 0));
  const belly = sph(0.24, 8, 6, w); belly.scale.set(1, 1.35, 0.8); g.add(at(belly, 0, 0.42, 0.1));
  g.add(at(sph(0.2, 7, 5, b), 0, 0.92, 0.02));
  g.add(at(cone(0.06, 0.2, 4, o2), 0, 0.9, 0.27, Math.PI / 2));
  mEyes(g, 0.07, 0.98, 0.19, 0.07);
  for (const k of [-1, 1]) {
    g.add(at(box(0.06, 0.34, 0.16, b), k * 0.33, 0.52, 0, 0, 0, k * 0.25));
    g.add(at(box(0.12, 0.04, 0.18, o2), k * 0.12, 0.02, 0.1));
  }
  return g;
}
/** Boufmouth : bouftou des neiges à la laine bleutée. */
function buildMonstreBoufmouth() { return buildBouftou(1, 0xc8e0ff); }
/** Sapik : sapin vivant givré. */
function buildMonstreSapik() { return buildMonstreAbraknyde({ bark: 0x4a3a2a, leaf: 0x2f6a5a, leaf2: 0xe8f6ff, eye: 0x7ad8ff, pine: true }); }
/** Fécorce : arbre sombre hérissé de glace, qui tire des éclats. */
function buildMonstreFecorce() { return buildMonstreAbraknyde({ bark: 0x3a2a1a, leaf: 0x3a5a6a, leaf2: 0x7ab0d0, eye: 0xa0e0ff, ice: true }); }

/* ---------------------------------------------------------------- Catalogue et animation */
/**
 * Monstre -> modèle et façon de bouger.
 * anim : hop (sautille), trot (petit trot), crawl (rampe), fly (vole), jelly (rebondit), lumber (se dandine), walk (marche)
 */
const MONSTER_MODELS = {
  bouftou: { build: buildMonstreBouftou, anim: 'trot' },
  tofu: { build: buildMonstreTofu, anim: 'hop' },
  piou: { build: buildMonstrePiou, anim: 'hop' },
  larve_bleue: { build: buildMonstreLarve, anim: 'crawl' },
  pichon: { build: buildMonstrePichon, anim: 'hop' },
  sanglier: { build: buildMonstreSanglier, anim: 'trot' },
  arakne: { build: buildMonstreArakne, anim: 'crawl' },
  moskito: { build: buildMonstreMoskito, anim: 'fly' },
  prespic: { build: buildMonstrePrespic, anim: 'walk' },
  abraknyde: { build: buildMonstreAbraknyde, anim: 'lumber' },
  chafer: { build: buildMonstreChafer, anim: 'walk' },
  chafer_archer: { build: () => buildMonstreChafer({ bone: 0xd8d0b8, bow: true }), anim: 'walk' },
  fantome: { build: buildMonstreFantome, anim: 'fly' },
  craqueleur: { build: buildMonstreCraqueleur, anim: 'lumber' },
  bwork: { build: buildMonstreBwork, anim: 'walk' },
  gelee: { build: buildMonstreGelee, anim: 'jelly' },
  bwork_mage: { build: () => buildMonstreBwork({ skin: 0x5a3a8a, skin2: 0x40286a, cloth: 0x2a1a4a, eye: 0xffb0ff, mage: true }), anim: 'walk' },
  mansot: { build: buildMonstreMansot, anim: 'walk' },
  boufmouth: { build: buildMonstreBoufmouth, anim: 'trot' },
  sapik: { build: buildMonstreSapik, anim: 'lumber' },
  fecorce: { build: buildMonstreFecorce, anim: 'lumber' },
};

/**
 * Pose d'un monstre à l'instant t (seed = décalage propre à chaque individu).
 * Renvoie un décalage vertical (en hauteurs de modèle), des échelles et des inclinaisons.
 */
function monsterPose(anim, t, seed, out) {
  const s = Math.sin(t * 8 + seed), c = Math.cos(t * 8 + seed);
  out.y = 0; out.sx = 1; out.sy = 1; out.sz = 1; out.rx = 0; out.rz = 0; out.yaw = 0;
  switch (anim) {
    case 'hop': { const h = Math.abs(Math.sin(t * 7 + seed)); out.y = h * 0.35; out.sy = 1 + (h - 0.5) * 0.16; out.sx = out.sz = 1 - (h - 0.5) * 0.08; out.rx = 0.15 * c; break; }
    case 'trot': out.y = Math.abs(Math.sin(t * 10 + seed)) * 0.06; out.rx = 0.05 * s; break;
    case 'crawl': out.sz = 1 + 0.1 * s; out.sy = 1 - 0.05 * s; out.yaw = 0.12 * Math.sin(t * 4 + seed); break;
    case 'fly': out.y = 0.55 + Math.sin(t * 3 + seed) * 0.12; out.rx = 0.2; out.rz = 0.12 * Math.sin(t * 2 + seed); break;
    case 'jelly': { const j = Math.sin(t * 6 + seed); out.sy = 1 + j * 0.14; out.sx = out.sz = 1 - j * 0.07; break; }
    case 'lumber': out.rz = 0.1 * Math.sin(t * 3.5 + seed); out.y = Math.abs(Math.sin(t * 3.5 + seed)) * 0.03; break;
    default: out.y = Math.abs(s) * 0.05; out.rz = 0.06 * s;
  }
  return out;
}

/**
 * Fusionne un modèle (groupe de primitives) en une seule géométrie à couleurs par sommet,
 * posée au sol, centrée, et mise à l'échelle pour un rayon d'emprise de 1.
 */
function mergeModel(group) {
  group.updateMatrixWorld(true);
  const pos = [], col = [];
  const c = new THREE.Color();
  group.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);
    const m = o.material;
    c.copy(m.color);
    // Les parties lumineuses (yeux, cristaux) sont éclaircies faute d'émission par instance
    if (m.emissiveIntensity > 0 && m.emissive && m.emissive.getHex() !== 0) c.multiplyScalar(1 + m.emissiveIntensity * 0.6);
    const p = g.attributes.position.array;
    for (let i = 0; i < p.length; i += 3) { pos.push(p[i], p[i + 1], p[i + 2]); col.push(c.r, c.g, c.b); }
    g.dispose();
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  out.computeBoundingBox();
  const b = out.boundingBox;
  out.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
  const rad = Math.max(b.max.x - b.min.x, b.max.z - b.min.z) / 2 || 1;
  out.scale(1 / rad, 1 / rad, 1 / rad);
  out.computeVertexNormals();
  out.computeBoundingBox();
  return out;
}
