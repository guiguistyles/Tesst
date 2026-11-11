'use strict';
/* ZaapRush 2.0 — modèles 3D (Three.js r128, primitives uniquement).
   Fichier partagé par la visionneuse (models/viewer.html) et le jeu. */
// Familiers et boss des zones du jeu.

/* =====================================================================
   3. FAMILIERS ET BOSS DU JEU — outils communs
   Squelettes paramétrables (oiseau, lapin, dragon, mouton, arbre,
   golem, manchot) : un familier et un boss partagent le même socle,
   chaque modèle garde sa propre fonction buildXxx().
   ===================================================================== */

/** Aura circulaire derrière une créature : disque, anneaux, piques qui tournent. */
function addAura(parent, o) {
  const R = o.R ?? 1.2;
  const g = joint('aura', parent, 0, o.y ?? 1, o.z ?? -0.6);
  const m1 = mat(o.c1, 0.45), m2 = mat(o.c2 ?? o.c1, 0.6), soft = mat(o.c1, 0.3, 0.14);
  g.add(at(cyl(R, R, 0.02, 40, soft), 0, 0, 0, Math.PI / 2));
  g.add(torus(R * 1.04, 0.035 * R, 6, 48, m1));
  g.add(torus(R * 0.78, 0.02 * R, 6, 40, m2));
  const spikes = joint('aura_piques', g);
  const n = o.spikes ?? 16;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    spikes.add(at(cone(0.05 * R, (0.2 + (i % 2) * 0.12) * R, 4, i % 2 ? m1 : m2), Math.cos(a) * R * 1.16, Math.sin(a) * R * 1.16, 0, 0, 0, a - Math.PI / 2));
  }
  return { g, update(t) { spikes.rotation.z = -t * 0.25; spikes.children.forEach((s, i) => { s.scale.y = 1 + Math.sin(t * 5 + i) * 0.2; }); } };
}
/** Émetteur de particules montantes autour d'une créature. */
function moteEmitter(fxA, root, mats, rate = 8, rad = 1.2, life = 1.5) {
  let acc = 0;
  return (dt) => {
    acc += dt * rate;
    while (acc > 1) {
      acc--;
      const a = Math.random() * TAU, rr = rad * (0.4 + Math.random() * 0.8);
      fxA.mote(new V3(root.position.x + Math.cos(a) * rr, Math.random() * 0.5, root.position.z + Math.sin(a) * rr), mats[(Math.random() * mats.length) | 0], life + Math.random(), 0.8, CUBE_GEO, 0.3 + Math.random() * 0.3);
    }
  };
}
/** Couronne dorée à piques et gemme. */
function addCrown(parent, x, y, z, s = 1, gem = 0xff3b6b) {
  const g = joint('couronne', parent, x, y, z);
  const gold = mat(0xf2c14e, 0.35);
  g.add(cyl(0.2, 0.18, 0.1, 8, gold));
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; g.add(at(cone(0.045, 0.16, 4, gold), Math.cos(a) * 0.18, 0.12, Math.sin(a) * 0.18)); }
  g.add(at(crystal(0.05, 0.14, mat(gem, 0.6), 4), 0, 0.02, 0.2, Math.PI / 2));
  g.scale.setScalar(s);
  return g;
}
/** Cylindre orienté d'un point A vers un point B (rayons, poutres). */
function beamBetween(a, b, r, m) {
  const d = b.clone().sub(a);
  const c = cyl(r, r, 1, 8, m);
  c.castShadow = false;
  c.scale.y = d.length();
  c.position.copy(a).addScaledVector(d, 0.5);
  c.quaternion.setFromUnitVectors(new V3(0, 1, 0), d.normalize());
  return c;
}

/* ---------------------------------------------------------------- Socle OISEAU (Tofu, Tofu Royal) */
function birdBase(o = {}) {
  const S = o.scale ?? 1;
  const C = {
    body: mat(o.body ?? 0xffd23f), body2: mat(o.body2 ?? 0xf4b400), belly: mat(o.belly ?? 0xffe78a),
    beak: mat(0xf77f00), white: mat(0xffffff), dark: mat(0x1e1214), blush: mat(0xff8fab),
  };
  const root = new THREE.Group();
  root.name = o.name ?? 'Tofu';
  const fx = new THREE.Group();
  fx.name = root.name + '_fx';
  const rig = joint('echelle', root);
  rig.scale.setScalar(S);
  // Le tofu est une boule : la tête et le corps ne font qu'un
  const body = joint('corps', rig, 0, 0.36, 0);
  body.add(sph(0.26, 8, 6, C.body));
  body.add(at(sph(0.19, 8, 6, C.belly), 0, -0.05, 0.1));
  body.add(at(cone(0.075, 0.18, 4, C.beak), 0, 0.03, 0.31, Math.PI / 2, Math.PI / 4));
  const jaw = joint('bec_bas', body, 0, -0.01, 0.22);
  jaw.add(at(cone(0.05, 0.11, 4, C.beak), 0, 0, 0.06, Math.PI / 2, Math.PI / 4));
  for (const s of [-1, 1]) {
    body.add(at(box(0.075, 0.085, 0.02, C.white), s * 0.09, 0.1, 0.235));
    body.add(at(box(0.035, 0.055, 0.02, o.eyeMat ?? C.dark), s * 0.095, 0.1, 0.247));
    body.add(at(box(0.06, 0.03, 0.02, C.blush), s * 0.15, 0.0, 0.205));
    body.add(at(box(0.08, 0.02, 0.02, C.dark), s * 0.09, 0.16, 0.24, 0, 0, s * (o.angry ? 0.35 : -0.15)));
  }
  for (let i = -1; i <= 1; i++) body.add(at(cone(0.04, 0.16 - Math.abs(i) * 0.04, 4, C.body2), i * 0.05, 0.3, -0.02 - Math.abs(i) * 0.03, -0.3, 0, -i * 0.3));
  const wings = [];
  for (const s of [-1, 1]) {
    const w = joint('aile', body, s * 0.25, 0.0, 0);
    w.add(at(box(0.05, 0.16, 0.22, C.body2), s * 0.02, -0.03, 0, 0, 0, s * 0.3));
    w.add(at(cone(0.03, 0.1, 4, C.body2), s * 0.06, -0.13, -0.06, 0.4, 0, s * 0.3));
    wings.push({ w, s });
  }
  for (let i = -1; i <= 1; i++) body.add(at(cone(0.035, 0.18, 4, C.body2), i * 0.06, 0.06, -0.3, -1.1, 0, i * 0.3));
  const legs = [];
  for (const s of [-1, 1]) {
    const l = joint('patte', body, s * 0.09, -0.22, 0.02);
    l.add(at(cyl(0.018, 0.018, 0.12, 4, C.beak), 0, -0.06, 0));
    for (const a of [-0.5, 0, 0.5]) l.add(at(box(0.025, 0.02, 0.08, C.beak), Math.sin(a) * 0.03, -0.12, 0.03 + Math.cos(a) * 0.02, 0, a, 0));
    legs.push(l);
  }
  return { root, fx, rig, body, jaw, wings, legs, C, fxA: makeFx(fx) };
}
function animBird(b, mode, t, baseY = 0.36) {
  b.body.position.y = baseY; b.body.rotation.set(0, 0, 0); b.jaw.rotation.x = 0;
  b.legs.forEach((l) => l.rotation.set(0, 0, 0));
  let flap = 0;
  if (mode === 'idle') {
    b.body.position.y = baseY + Math.abs(Math.sin(t * 3)) * 0.02;
    b.body.rotation.z = Math.sin(t * 1.5) * 0.06;
    flap = Math.sin(t * 4) * 0.15;
  } else if (mode === 'move') {
    const h = Math.abs(Math.sin(t * 8));
    b.body.position.y = baseY + h * 0.22;
    b.body.rotation.x = 0.15 - h * 0.2;
    b.legs.forEach((l) => { l.rotation.x = -h * 0.8; });
    flap = 0.3 + Math.sin(t * 16) * 0.4;
  }
  b.wings.forEach(({ w, s }) => { w.rotation.z = s * flap; });
}
function miniTofu() {
  const g = new THREE.Group();
  g.add(at(sph(0.13, 6, 5, mat(0xffd23f)), 0, 0.15, 0));
  g.add(at(cone(0.04, 0.09, 4, mat(0xf77f00)), 0, 0.16, 0.15, Math.PI / 2));
  for (const s of [-1, 1]) g.add(at(box(0.03, 0.04, 0.01, mat(0x1e1214)), s * 0.05, 0.2, 0.125));
  return g;
}

/** FAMILIER COMMUN — Tofu Bagarreur : petite boule à plumes qui picore tout. */
function buildTofuBagarreur() {
  const b = birdBase({ name: 'TofuBagarreur', scale: 1, angry: true });
  // Bandeau de bagarreur
  b.body.add(at(torus(0.24, 0.025, 6, 20, mat(0xd62828)), 0, 0.14, 0, Math.PI / 2 - 0.15));
  b.body.add(at(box(0.04, 0.12, 0.02, mat(0xd62828)), 0.04, 0.12, -0.26, 0.4, 0, 0.5));
  const feather = [mat(0xffd23f), mat(0xf4b400)];
  function update(mode, t, dt) {
    animBird(b, mode, t);
    if (mode === 'ability') {
      // Rafale de coups de bec
      const { k, cross } = phase(t, dt, 1.6);
      const peck = k < 0.9 ? Math.max(0, Math.sin(k * 30)) : 0;
      b.body.rotation.x = 0.55 * peck;
      b.body.position.z = 0.08 * peck;
      b.jaw.rotation.x = 0.4 * peck;
      if (cross(0.05) || cross(0.26) || cross(0.47) || cross(0.68)) {
        const p = new V3(b.root.position.x, 0.12, b.root.position.z + 0.45);
        b.fxA.burst(p, feather, 5, 1.2, 1.6, CUBE_GEO, 0.6);
        b.fxA.puff(p.clone().setY(0.02), mat(0xd8cfc0), 2, 0.4, 0.2);
      }
    }
    b.body.position.z = mode === 'ability' ? b.body.position.z : 0;
    if (mode !== 'still') b.fxA.update(dt);
  }
  return { root: b.root, fx: b.fx, update };
}

/** BOSS — Tofu Royal : tofu géant couronné qui écrase le sol et appelle ses sujets. */
function buildTofuRoyal() {
  const b = birdBase({ name: 'TofuRoyal', scale: 4.2, body: 0xffcc00, body2: 0xd06010, belly: 0xffe78a, angry: true });
  addCrown(b.body, 0, 0.27, 0, 0.75);
  // Cape royale et collier
  const cape = joint('cape', b.body, 0, 0.1, -0.2);
  cape.add(at(box(0.36, 0.3, 0.03, mat(0x8a1a2a)), 0, -0.12, -0.04, 0.35));
  cape.add(at(box(0.38, 0.04, 0.05, mat(0xf2c14e, 0.3)), 0, 0.02, -0.02, 0.35));
  b.body.add(at(torus(0.2, 0.02, 6, 20, mat(0xf2c14e, 0.3)), 0, -0.12, 0.02, Math.PI / 2 + 0.3));
  b.body.add(at(crystal(0.025, 0.08, mat(0xff3b6b, 0.6), 4), 0, -0.18, 0.21));
  const aura = addAura(b.root, { y: 1.6, z: -1.3, R: 1.5, c1: 0xffcf3a, c2: 0xff8a1a });
  const motes = moteEmitter(b.fxA, b.root, [mat(0xffcf3a, 0.5), mat(0xffffff, 0.3)], 6, 1.6);
  const orange = mat(0xff8a1a, 0.6), feather = [mat(0xffcc00), mat(0xd06010)];
  function update(mode, t, dt) {
    animBird(b, mode, t);
    if (mode === 'ability') {
      // Saut, atterrissage écrasant, puis 4 petits tofus jaillissent
      const { k, cross } = phase(t, dt, 3);
      const air = k > 0.3 && k < 1.0 ? Math.sin((k - 0.3) / 0.7 * Math.PI) : 0;
      const crouch = k < 0.3 ? ease(k / 0.3) : k > 1 && k < 1.4 ? 1 - ease((k - 1) / 0.4) : 0;
      b.body.position.y = 0.36 + air * 0.45 - crouch * 0.06;
      b.rig.scale.set(4.2 * (1 + crouch * 0.12), 4.2 * (1 - crouch * 0.15 + air * 0.05), 4.2 * (1 + crouch * 0.12));
      b.wings.forEach(({ w, s }) => { w.rotation.z = s * (air * 1.2); });
      if (cross(1.0)) {
        const g = new V3(b.root.position.x, 0.05, b.root.position.z);
        b.fxA.ring(g, orange, 6, 0.7);
        b.fxA.burst(g.clone().setY(0.3), feather, 18, 4, 3, CUBE_GEO, 1);
        b.fxA.puff(g, mat(0xd8cfc0), 12, 1, 3);
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * TAU + 0.4;
          const m = miniTofu();
          m.scale.setScalar(1.8);
          const start = new V3(b.root.position.x + Math.cos(a) * 1.2, 0, b.root.position.z + Math.sin(a) * 1.2);
          m.position.copy(start);
          m.rotation.y = Math.PI / 2 - a;
          b.fxA.obj(m, 1.5, (p, d, kk) => { const age = p.max - p.life; p.m.position.set(start.x + Math.cos(a) * age * 2.2, Math.abs(Math.sin(age * 12)) * 0.3, start.z + Math.sin(a) * age * 2.2); p.m.scale.setScalar(1.8 * Math.min(1, age * 5, kk * 4)); });
        }
      }
    } else b.rig.scale.setScalar(4.2);
    if (mode !== 'still') { aura.update(t); motes(dt); b.fxA.update(dt); }
  }
  return { root: b.root, fx: b.fx, update };
}

/* ---------------------------------------------------------------- Socle LAPIN (Wabbit Lunaire, Black Wabbit) */
function wabbitBase(o = {}) {
  const S = o.scale ?? 1;
  const C = {
    fur: mat(o.fur ?? 0xdfe6f2), fur2: mat(o.fur2 ?? 0xb8c4dc), ear: mat(o.ear ?? 0xffb3c8), eye: mat(o.eye ?? 0xb48cff, 0.9),
    cloth: mat(o.cloth ?? 0x5a3fa0), white: mat(0xffffff), dark: mat(0x1e1214), nose: mat(0xff8fab), gold: mat(0xf2c14e, 0.3),
  };
  const root = new THREE.Group();
  root.name = o.name ?? 'Wabbit';
  const fx = new THREE.Group();
  fx.name = root.name + '_fx';
  const rig = joint('echelle', root);
  rig.scale.setScalar(S);
  const hips = joint('hanches', rig, 0, 0.42, 0);
  hips.add(box(0.32, 0.2, 0.26, C.fur));
  hips.add(at(sph(0.08, 6, 5, C.white), 0, 0.02, -0.16));
  const torso = joint('torse', hips, 0, 0.1, 0);
  torso.add(at(box(0.34, 0.36, 0.26, C.fur), 0, 0.18, 0));
  torso.add(at(box(0.24, 0.26, 0.04, C.fur2), 0, 0.16, 0.13));
  torso.add(at(torus(0.17, 0.04, 6, 16, C.cloth), 0, 0.36, 0, Math.PI / 2));
  torso.add(at(box(0.08, 0.2, 0.03, C.cloth), 0.08, 0.26, 0.16, 0, 0, 0.3));
  const head = joint('tete', torso, 0, 0.38, 0);
  head.add(at(box(0.32, 0.28, 0.28, C.fur), 0, 0.14, 0));
  head.add(at(box(0.16, 0.1, 0.08, C.fur2), 0, 0.07, 0.15));
  head.add(at(box(0.05, 0.04, 0.03, C.nose), 0, 0.11, 0.19));
  head.add(at(box(0.06, 0.05, 0.02, C.white), 0, 0.02, 0.19));
  for (const s of [-1, 1]) {
    head.add(at(box(0.07, 0.07, 0.02, o.eyeShape === 'patch' && s > 0 ? C.dark : C.eye), s * 0.08, 0.17, 0.145));
    for (let i = 0; i < 2; i++) head.add(at(box(0.16, 0.01, 0.01, C.dark), s * 0.14, 0.08 + i * 0.03, 0.17, 0, 0, s * (0.1 - i * 0.2)));
  }
  const ears = [];
  for (const s of [-1, 1]) {
    const e1 = joint('oreille', head, s * 0.08, 0.28, -0.02);
    e1.rotation.z = s * -0.15;
    e1.add(at(box(0.09, 0.26, 0.05, C.fur), 0, 0.13, 0));
    e1.add(at(box(0.05, 0.2, 0.02, C.ear), 0, 0.13, 0.03));
    const e2 = joint('oreille_haut', e1, 0, 0.26, 0);
    e2.add(at(box(0.09, 0.22, 0.05, C.fur), 0, 0.11, 0));
    e2.add(at(box(0.05, 0.16, 0.02, C.ear), 0, 0.11, 0.03));
    ears.push({ e1, e2, s });
  }
  function arm(s) {
    const sh = joint('bras', torso, s * 0.21, 0.3, 0);
    sh.add(at(box(0.09, 0.2, 0.09, C.fur), 0, -0.1, 0));
    const el = joint('coude', sh, 0, -0.2, 0);
    el.add(at(box(0.08, 0.16, 0.08, C.fur), 0, -0.08, 0));
    const hand = joint('main', el, 0, -0.17, 0);
    hand.add(at(box(0.09, 0.07, 0.09, C.fur2), 0, -0.02, 0));
    return { sh, el, hand };
  }
  function leg(s) {
    const hip = joint('jambe', hips, s * 0.11, -0.05, 0);
    hip.add(at(box(0.14, 0.22, 0.18, C.fur), 0, -0.1, 0.02));
    const knee = joint('genou', hip, 0, -0.2, 0);
    knee.add(at(box(0.1, 0.14, 0.1, C.fur), 0, -0.07, 0));
    knee.add(at(box(0.12, 0.06, 0.28, C.fur2), 0, -0.15, 0.08));
    return { hip, knee };
  }
  const armL = arm(1), armR = arm(-1), legL = leg(1), legR = leg(-1);
  return { root, fx, rig, hips, torso, head, ears, armL, armR, legL, legR, C, fxA: makeFx(fx) };
}
function cawotte(s = 1) {
  const g = new THREE.Group();
  g.add(at(cone(0.06, 0.32, 6, mat(0xff8a1a)), 0, -0.16, 0, Math.PI));
  for (let i = 0; i < 3; i++) g.add(at(cone(0.025, 0.14, 4, mat(0x5fbf3a)), (i - 1) * 0.025, 0.06, 0, 0, 0, (i - 1) * 0.4));
  for (let i = 0; i < 3; i++) g.add(at(box(0.08, 0.01, 0.01, mat(0xc85a10)), 0, -0.08 - i * 0.07, 0.04));
  g.scale.setScalar(s);
  return g;
}
function animWabbit(w, mode, t) {
  for (const j of [w.hips, w.torso, w.head, w.armL.sh, w.armL.el, w.armR.sh, w.armR.el, w.legL.hip, w.legL.knee, w.legR.hip, w.legR.knee]) j.rotation.set(0, 0, 0);
  w.hips.position.y = 0.42;
  w.ears.forEach(({ e1, e2, s }) => { e1.rotation.set(0, 0, s * -0.15); e2.rotation.set(0, 0, 0); });
  if (mode === 'idle') {
    w.torso.scale.y = 1 + Math.sin(t * 2.4) * 0.02;
    w.head.rotation.y = Math.sin(t * 0.8) * 0.25;
    w.ears.forEach(({ e1, e2, s }, i) => { e2.rotation.x = Math.max(0, Math.sin(t * 1.3 + i)) * 0.5; e1.rotation.x = Math.sin(t * 2 + i) * 0.05; });
  } else if (mode === 'move') {
    const h = Math.abs(Math.sin(t * 6));
    w.hips.position.y = 0.42 + h * 0.25;
    w.legL.hip.rotation.x = w.legR.hip.rotation.x = -0.6 * h;
    w.legL.knee.rotation.x = w.legR.knee.rotation.x = 0.8 * (1 - h);
    w.armL.sh.rotation.x = w.armR.sh.rotation.x = -0.5 * h;
    w.ears.forEach(({ e2 }) => { e2.rotation.x = 0.6 * (1 - h); });
  }
}

/** FAMILIER ÉPIQUE — Wabbit Lunaire : lapin de nuit, croissant de lune et cawotte magique. */
function buildWabbitLunaire() {
  const w = wabbitBase({ name: 'WabbitLunaire', scale: 1.15 });
  const carrot = cawotte(1.1);
  const hold = joint('cawotte_prise', w.armR.hand, 0, -0.05, 0.02);
  hold.rotation.x = Math.PI / 2;
  hold.add(carrot);
  // Croissant de lune et étoiles derrière la tête
  const moonM = mat(0xfff2b0, 0.7);
  const moonG = joint('croissant', w.head, 0, 0.32, -0.28);
  moonG.add(at(torus(0.22, 0.05, 6, 20, moonM, Math.PI * 1.25), 0, 0, 0, 0, 0, Math.PI * 0.6));
  const stars = [];
  for (let i = 0; i < 5; i++) { const s = crystal(0.03, 0.1, moonM, 4); w.rig.add(s); stars.push(s); }
  const aura = addAura(w.rig, { y: 0.75, z: -0.4, R: 0.62, c1: 0xb48cff, c2: 0xfff2b0, spikes: 14 });
  const motes = moteEmitter(w.fxA, w.root, [mat(0xb48cff, 0.5), moonM], 5, 0.8, 1.2);
  const violet = mat(0xb48cff, 0.6);
  function update(mode, t, dt) {
    animWabbit(w, mode, t);
    carrot.visible = true;
    if (mode === 'ability') {
      // Lance la cawotte qui éclate en éclats de lune
      const { k, cross } = phase(t, dt, 2.2);
      const wind = k < 0.4 ? ease(k / 0.4) : k < 0.55 ? 1 - ease((k - 0.4) / 0.15) * 2 : k < 1 ? -1 + ease((k - 0.55) / 0.45) : 0;
      w.armR.sh.rotation.x = -2.6 * Math.max(0, wind) - 1.2 * Math.max(0, -wind);
      w.torso.rotation.y = 0.4 * wind;
      w.ears.forEach(({ e2 }) => { e2.rotation.x = 0.4 * Math.abs(wind); });
      carrot.visible = k < 0.5 || k > 1.6;
      if (cross(0.5)) {
        const start = wpos(w.armR.hand);
        const target = front({ root: w.root }, 2.6, 0, 0.1);
        const T = 0.6, g = 10;
        const v = target.clone().sub(start).divideScalar(T);
        v.y = (target.y - start.y) / T + 0.5 * g * T;
        w.fxA.proj(cawotte(1.6), start, v, { g, life: 2, spin: 12, ground: 0.12, trail: violet, trailSize: 0.5, end: (p) => {
          const pos = p.m.position.clone().setY(0.05);
          w.fxA.ring(pos, violet, 2.6, 0.6);
          w.fxA.burst(pos.clone().setY(0.2), [moonM, violet], 14, 2.5, 3, SPARK_GEO, 0.9);
        } });
      }
    }
    if (mode !== 'still') {
      moonG.rotation.z = Math.sin(t) * 0.2;
      stars.forEach((s, i) => { const a = (i / 5) * TAU + t * 0.8; s.position.set(Math.cos(a) * 0.55, 1.05 + Math.sin(t * 2 + i) * 0.08, Math.sin(a) * 0.55); s.rotation.y = t * 2; });
      aura.update(t); motes(dt); w.fxA.update(dt);
    }
  }
  return { root: w.root, fx: w.fx, update };
}

/** BOSS — Black Wabbit : seigneur des wabbits, armure noire et cawotte-massue. */
function buildBlackWabbit() {
  const w = wabbitBase({ name: 'BlackWabbit', scale: 3.4, fur: 0x2a2a2e, fur2: 0x3e3e46, ear: 0x8a1a2a, eye: 0xff3030, cloth: 0x8a1a2a, eyeShape: 'patch' });
  // Armure : plastron, épaulières à piques, ceinture
  const steel = mat(0x5a5a66), gold = mat(0xf2c14e, 0.3);
  w.torso.add(at(box(0.3, 0.24, 0.05, steel), 0, 0.2, 0.15));
  w.torso.add(at(crystal(0.03, 0.1, mat(0xff3030, 0.6), 4), 0, 0.22, 0.18));
  for (const s of [-1, 1]) {
    const pad = joint('epauliere', w.torso, s * 0.22, 0.34, 0);
    pad.add(sph(0.08, 6, 4, steel));
    for (let i = 0; i < 3; i++) pad.add(at(cone(0.02, 0.1, 4, gold), s * 0.03, 0.08, (i - 1) * 0.05, 0, 0, s * -0.5));
  }
  w.hips.add(at(box(0.36, 0.05, 0.3, gold), 0, 0.08, 0));
  w.head.add(at(box(0.09, 0.02, 0.02, w.C.dark), 0.07, 0.24, 0.146, 0, 0, -0.5));
  // Cawotte-massue cloutée
  const club = joint('massue', w.armR.hand, 0, -0.05, 0.02);
  club.rotation.x = 2.3;
  const c = cawotte(1.8);
  club.add(c);
  for (let i = 0; i < 5; i++) c.add(at(cone(0.015, 0.06, 4, steel), Math.cos(i * 1.3) * 0.05, -0.12 - i * 0.04, Math.sin(i * 1.3) * 0.05, 0, 0, Math.PI / 2 + i));
  const aura = addAura(w.root, { y: 2.6, z: -1.2, R: 1.6, c1: 0xff3030, c2: 0x8a1a2a });
  const motes = moteEmitter(w.fxA, w.root, [mat(0xff3030, 0.5), mat(0x2a2a2e)], 7, 1.8);
  const red = mat(0xff3030, 0.6);
  function update(mode, t, dt) {
    animWabbit(w, mode, t);
    if (mode === 'ability') {
      // Coup de massue au sol et cawottes qui jaillissent
      const { k, cross } = phase(t, dt, 2.8);
      const up = k < 0.6 ? ease(k / 0.6) : 0;
      const slam = k >= 0.6 && k < 0.8 ? ease((k - 0.6) / 0.2) : k >= 0.8 && k < 1.8 ? 1 : k >= 1.8 ? 1 - ease(clamp01((k - 1.8) / 0.6)) : 0;
      w.armR.sh.rotation.x = -2.8 * up - 1.2 * slam;
      w.armL.sh.rotation.x = -0.8 * up;
      w.torso.rotation.x = -0.2 * up + 0.4 * slam;
      w.hips.position.y = 0.42 - 0.06 * slam;
      if (cross(0.8)) {
        const g = front({ root: w.root }, 2.4, -0.4, 0.05);
        w.fxA.ring(g, red, 5, 0.7);
        w.fxA.puff(g, mat(0x5a4a3a), 10, 1, 1.4);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TAU;
          w.fxA.proj(cawotte(1.4), g.clone().setY(0.3), new V3(Math.cos(a) * 2.2, 5 + Math.random() * 2, Math.sin(a) * 2.2), { g: 10, life: 1.4, spin: 9, ground: 0.1, end: (p) => w.fxA.burst(p.m.position, red, 4, 1.2, 1.5) });
        }
      }
    }
    if (mode !== 'still') { aura.update(t); motes(dt); w.fxA.update(dt); }
  }
  return { root: w.root, fx: w.fx, update };
}

/* ---------------------------------------------------------------- Socle DRAGON (Dragoeuf Céleste, Dragon Cochon) */
function dragonBase(o = {}) {
  const S = o.scale ?? 1;
  const C = {
    scale: mat(o.scale1 ?? 0x2fa3a8), scale2: mat(o.scale2 ?? 0x1f6f78), belly: mat(o.belly ?? 0xf2d79a), horn: mat(o.horn ?? 0xf4f1de),
    glow: mat(o.glow ?? 0x8ff6ff, 0.7), eye: mat(o.eye ?? 0xffe066, 0.9), dark: mat(0x1e1214), teeth: mat(0xffffff),
    wing: mat(o.wing ?? 0x8ff6ff, 0.3, o.wingOpacity ?? 0.55), bone: mat(o.bone ?? 0x1f6f78),
  };
  const root = new THREE.Group();
  root.name = o.name ?? 'Dragon';
  const fx = new THREE.Group();
  fx.name = root.name + '_fx';
  const rig = joint('echelle', root);
  rig.scale.setScalar(S);
  const hover = o.hover ?? 0.9;
  const body = joint('corps', rig, 0, hover, 0);
  const bw = o.bulk ?? 1;
  body.add(box(0.56 * bw, 0.48 * bw, 0.8, C.scale));
  body.add(at(box(0.44 * bw, 0.1, 0.66, C.belly), 0, -0.25 * bw, 0.02));
  for (let i = 0; i < 4; i++) body.add(at(box(0.46 * bw, 0.03, 0.08, C.scale2), 0, -0.2 * bw, -0.25 + i * 0.17));
  for (let i = 0; i < 5; i++) body.add(at(cone(0.06, 0.18, 4, i % 2 ? C.glow : C.horn), 0, 0.28 * bw, -0.3 + i * 0.15, -0.3));
  // Cou en 3 segments puis tête
  let p = joint('cou_0', body, 0, 0.12, 0.38);
  const neck = [];
  for (let i = 0; i < 3; i++) {
    p.rotation.x = -0.35;
    p.add(at(box(0.3 - i * 0.03, 0.28 - i * 0.03, 0.22, C.scale), 0, 0, 0.1));
    p.add(at(cone(0.04, 0.12, 4, C.horn), 0, 0.15, 0.1, -0.3));
    neck.push(p);
    p = joint('cou_' + (i + 1), p, 0, 0, 0.2);
  }
  const head = p;
  head.name = 'tete';
  head.rotation.x = 0.7;
  head.add(at(box(0.34, 0.26, 0.34, C.scale), 0, 0.02, 0.12));
  head.add(at(box(0.24, 0.14, 0.26, o.snout ? C.belly : C.scale), 0, -0.02, 0.38));
  if (o.snout) { head.add(at(box(0.2, 0.14, 0.04, mat(0xf4a0b0)), 0, -0.02, 0.52)); for (const s of [-1, 1]) head.add(at(box(0.04, 0.05, 0.02, C.dark), s * 0.05, -0.02, 0.545)); }
  else for (const s of [-1, 1]) head.add(at(box(0.03, 0.03, 0.02, C.dark), s * 0.06, 0.03, 0.51));
  const jaw = joint('machoire', head, 0, -0.1, 0.14);
  jaw.add(at(box(0.22, 0.07, 0.36, C.scale2), 0, -0.02, 0.17));
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) {
    head.add(at(cone(0.02, 0.06, 4, C.teeth), s * 0.08, -0.1, 0.24 + i * 0.07, Math.PI));
    jaw.add(at(cone(0.018, 0.05, 4, C.teeth), s * 0.07, 0.03, 0.08 + i * 0.07));
  }
  if (o.tusks) for (const s of [-1, 1]) jaw.add(at(cone(0.035, 0.18, 5, C.teeth), s * 0.12, 0.06, 0.3, -0.2, 0, s * -0.3));
  for (const s of [-1, 1]) {
    head.add(at(box(0.07, 0.05, 0.02, C.eye), s * 0.11, 0.08, 0.29));
    head.add(at(box(0.1, 0.025, 0.03, C.dark), s * 0.11, 0.12, 0.29, 0, 0, s * 0.35));
    horn(head, s, C.horn, C.glow, { x: 0.12, y: 0.12, z: -0.02, rx: -1.2, rz: -0.3, bz: 0.15, bx: -0.15, len: 0.12, segs: 4, r: 0.05 });
    if (o.ears) head.add(at(cone(0.08, 0.16, 4, C.scale), s * 0.17, 0.18, 0.02, 0, 0, s * -0.5));
  }
  for (let i = 0; i < 3; i++) head.add(at(cone(0.03, 0.12, 4, C.glow), 0, 0.16, 0.05 - i * 0.1, -0.5));
  // Queue en 6 segments
  const tail = [];
  let tp = joint('queue_0', body, 0, 0.02, -0.4);
  for (let i = 0; i < 6; i++) {
    const s = 1 - i * 0.13;
    tp.add(at(box(0.26 * s, 0.22 * s, 0.22, C.scale), 0, 0, -0.1));
    tp.add(at(cone(0.03, 0.1 * s + 0.04, 4, C.horn), 0, 0.13 * s, -0.1, -0.4));
    tail.push(tp);
    tp = joint('queue_' + (i + 1), tp, 0, 0, -0.2);
  }
  if (o.curlyTail) tp.add(at(torus(0.07, 0.025, 6, 12, C.belly, Math.PI * 1.6), 0, 0.04, -0.04, 0, Math.PI / 2, 0));
  else tp.add(at(crystal(0.06, 0.26, C.glow, 4), 0, 0, -0.08, -Math.PI / 2));
  // Pattes griffues
  const legs = [];
  for (const [x, z] of [[0.24, 0.26], [-0.24, 0.26], [0.24, -0.26], [-0.24, -0.26]]) {
    const l = joint('patte', body, x * bw, -0.2 * bw, z);
    l.add(at(box(0.12, 0.26, 0.14, C.scale2), 0, -0.13, 0));
    for (const a of [-0.4, 0, 0.4]) l.add(at(cone(0.02, 0.08, 4, C.horn), Math.sin(a) * 0.05, -0.27, 0.06, Math.PI / 2 + 0.5));
    legs.push(l);
  }
  // Ailes : os + doigts + membranes
  const wings = [];
  for (const s of [-1, 1]) {
    const w = joint('aile', body, s * 0.26 * bw, 0.2 * bw, 0.12);
    const span = o.wingSpan ?? 1;
    w.add(at(cyl(0.035, 0.035, 0.6 * span, 6, C.bone), s * 0.3 * span, 0.05, 0, 0, 0, Math.PI / 2));
    for (let f = 0; f < 3; f++) {
      const a = -0.5 - f * 0.45;
      w.add(at(cone(0.025, 0.6 * span, 4, C.bone), s * (0.55 * span), 0.05 - Math.sin(-a) * 0.0, -0.05 - f * 0.08, a, 0, s * -1.2));
      w.add(at(box(0.5 * span, 0.01, 0.34, C.wing), s * 0.34 * span, 0.03 - f * 0.02, -0.18 - f * 0.18, 0, 0, s * (0.05 + f * 0.08)));
    }
    w.add(at(cone(0.04, 0.12, 4, C.horn), s * 0.62 * span, 0.08, 0, 0, 0, s * -Math.PI / 2));
    wings.push({ w, s });
  }
  return { root, fx, rig, body, neck, head, jaw, tail, legs, wings, C, hover, fxA: makeFx(fx) };
}
function animDragon(d, mode, t) {
  d.body.position.set(0, d.hover, 0);
  d.body.rotation.set(0, 0, 0);
  d.jaw.rotation.x = 0;
  d.head.rotation.x = 0.7;
  let flap = 0;
  if (mode === 'idle' || mode === 'ability') {
    d.body.position.y = d.hover + Math.sin(t * 2) * 0.06;
    flap = Math.sin(t * 3) * 0.45;
    d.tail.forEach((s, i) => { s.rotation.set(0.05, Math.sin(t * 1.6 - i * 0.5) * 0.18, 0); });
    d.neck.forEach((s, i) => { s.rotation.y = Math.sin(t * 0.8 + i * 0.3) * 0.08; });
    d.legs.forEach((l, i) => { l.rotation.x = 0.3 + Math.sin(t * 2 + i) * 0.1; });
  } else if (mode === 'move') {
    d.body.position.y = d.hover + 0.15 + Math.sin(t * 4) * 0.08;
    d.body.rotation.x = 0.15;
    flap = Math.sin(t * 6) * 0.7;
    d.tail.forEach((s, i) => { s.rotation.set(-0.05, Math.sin(t * 4 - i * 0.6) * 0.25, 0); });
    d.legs.forEach((l) => { l.rotation.x = 0.9; });
  } else {
    d.tail.forEach((s) => s.rotation.set(0.05, 0, 0));
    d.legs.forEach((l) => { l.rotation.x = 0.3; });
  }
  d.wings.forEach(({ w, s }) => { w.rotation.z = s * flap; w.rotation.y = s * 0.1; });
}
/** Souffle : la gueule s'ouvre et un rayon part vers le sol devant. */
function dragonBreath(d, k, cross, opt) {
  const charge = k < 0.5 ? ease(k / 0.5) : 0;
  const blow = k >= 0.5 && k < 1.6 ? 1 : k >= 1.6 && k < 2 ? 1 - ease((k - 1.6) / 0.4) : 0;
  d.neck.forEach((s) => { s.rotation.x = -0.35 - 0.25 * charge + 0.15 * blow; });
  d.head.rotation.x = 0.7 - 0.4 * charge + 0.45 * blow;
  d.jaw.rotation.x = 0.2 * charge + 0.65 * blow;
  d.wings.forEach(({ w, s }) => { w.rotation.z = s * (0.9 * charge - 0.2 * blow); });
  if (blow > 0.5 && k < 1.6) {
    const mouth = wpos(d.jaw).add(new V3(0, 0.05, 0.1 * d.rig.scale.x));
    const target = front({ root: d.root }, opt.dist, 0, 0.05);
    d.fxA.obj(beamBetween(mouth, target, opt.width * (0.7 + Math.random() * 0.4), opt.beam), 0.06, null);
    d.fxA.obj(beamBetween(mouth, target, opt.width * 0.45, opt.core), 0.06, null);
    if (Math.random() < 0.6) d.fxA.burst(target.clone().setY(0.15), opt.sparks, 2, 2, 2.5, SPARK_GEO, 0.6);
    if (Math.random() < 0.25) d.fxA.puff(target, opt.smoke, 1, 0.8, 0.6);
  }
  if (cross(0.55)) d.fxA.ring(front({ root: d.root }, opt.dist, 0, 0.05), opt.beam, opt.dist * 0.8, 0.6);
}

/** FAMILIER MYTHIQUE — Dragoeuf Céleste : jeune dragon aux ailes de cristal, né d'un œuf d'étoile. */
function buildDragoeufCeleste() {
  const d = dragonBase({ name: 'DragoeufCeleste', scale: 1.25 });
  // Fragments de coquille et cristaux en orbite
  const shellM = mat(0xf6f0e0), spot = mat(0x8ff6ff, 0.5);
  const orbit = [];
  for (let i = 0; i < 5; i++) {
    const g = joint('coquille_' + i, d.rig);
    const sh = mesh(new THREE.SphereGeometry(0.16, 8, 6, 0, Math.PI * 0.9, 0, Math.PI * 0.6), shellM);
    g.add(sh);
    g.add(at(box(0.04, 0.04, 0.02, spot), 0.06, 0.1, 0.1));
    orbit.push({ g, a: (i / 5) * TAU, h: 0.6 + (i % 3) * 0.35, r: 1.1 + (i % 2) * 0.15 });
  }
  const crystals = [];
  for (let i = 0; i < 4; i++) { const c = crystal(0.06, 0.24, i % 2 ? d.C.glow : mat(0xf2c14e, 0.5), 4); d.rig.add(c); crystals.push(c); }
  const aura = addAura(d.rig, { y: 1.05, z: -0.9, R: 1.05, c1: 0x8ff6ff, c2: 0xf2c14e });
  const motes = moteEmitter(d.fxA, d.root, [d.C.glow, mat(0xf2c14e, 0.5)], 9, 1.4);
  const beam = mat(0x8ff6ff, 0.7, 0.55), core = mat(0xffffff, 0.8, 0.85), sparks = [mat(0x8ff6ff, 0.7), mat(0xf2c14e, 0.6)];
  function update(mode, t, dt) {
    animDragon(d, mode, t);
    if (mode === 'ability') {
      const { k, cross } = phase(t, dt, 2.6);
      dragonBreath(d, k, cross, { dist: 3.2, width: 0.14, beam, core, sparks, smoke: mat(0xdaf8ff) });
    }
    if (mode !== 'still') {
      orbit.forEach((o, i) => { const a = o.a + t * 0.5; o.g.position.set(Math.cos(a) * o.r, o.h + Math.sin(t * 1.5 + i) * 0.1, Math.sin(a) * o.r); o.g.rotation.set(t + i, t * 0.7, 0); });
      crystals.forEach((c, i) => { const a = (i / 4) * TAU - t * 0.7; c.position.set(Math.cos(a) * 0.8, 1.5 + Math.sin(t * 2 + i) * 0.1, Math.sin(a) * 0.8); c.rotation.y = t * 2; });
      aura.update(t); motes(dt); d.fxA.update(dt);
    }
  }
  return { root: d.root, fx: d.fx, update };
}

/** BOSS — Dragon Cochon : dragon ventru à groin et défenses, crache du feu. */
function buildDragonCochon() {
  const d = dragonBase({ name: 'DragonCochon', scale: 3, scale1: 0xe090a0, scale2: 0xb86070, belly: 0xf6c8c8, horn: 0x4a2a2a, glow: 0xff6a1a,
    eye: 0xffd84a, wing: 0x7a2030, wingOpacity: 0.85, bone: 0x7a2030, snout: true, tusks: true, ears: true, curlyTail: true, bulk: 1.35, wingSpan: 0.8, hover: 0.95 });
  addCrown(d.head, 0, 0.2, 0.05, 0.6, 0xff6a1a);
  const aura = addAura(d.root, { y: 3.2, z: -2.2, R: 2.2, c1: 0xff6a1a, c2: 0xffcf3a });
  const motes = moteEmitter(d.fxA, d.root, [mat(0xff6a1a, 0.6), mat(0x5a4a40)], 8, 2.6);
  const beam = mat(0xff6a1a, 0.7, 0.6), core = mat(0xffd84a, 0.8, 0.85), sparks = [mat(0xff6a1a, 0.7), mat(0xffd84a, 0.7)];
  function update(mode, t, dt) {
    animDragon(d, mode, t);
    if (mode === 'ability') {
      const { k, cross } = phase(t, dt, 2.8);
      dragonBreath(d, k, cross, { dist: 5.5, width: 0.3, beam, core, sparks, smoke: mat(0x4a4040) });
    }
    if (mode !== 'still') { aura.update(t); motes(dt); d.fxA.update(dt); }
  }
  return { root: d.root, fx: d.fx, update };
}

/* ---------------------------------------------------------------- BOSS — Bouftou Royal */
function buildBouftouRoyal() {
  const S = 3.2;
  const root = new THREE.Group();
  root.name = 'BouftouRoyal';
  const fx = new THREE.Group();
  fx.name = 'BouftouRoyal_fx';
  const fxA = makeFx(fx);
  const rig = joint('echelle', root);
  rig.scale.setScalar(S);
  const wool = mat(0xfffbe8), wool2 = mat(0xe8dfc8), face = mat(0x4a2f1a), hornM = mat(0xc9a227, 0.15), dark = mat(0x1e1214);
  const body = joint('corps', rig, 0, 0.5, 0);
  for (const [x, y, z, r] of [[0, 0.05, 0, 0.36], [-0.22, 0, 0.05, 0.24], [0.22, 0, 0.05, 0.24], [-0.18, 0.12, -0.2, 0.24], [0.18, 0.12, -0.2, 0.24], [0, 0.25, -0.05, 0.25], [0, -0.05, -0.28, 0.22], [-0.15, 0.24, 0.15, 0.18], [0.15, 0.24, 0.15, 0.18]])
    body.add(at(sph(r, 7, 5, (x + z) > 0 ? wool : wool2), x, y, z));
  // Tête avec cornes enroulées
  const head = joint('tete', body, 0, 0.08, 0.36);
  head.add(at(box(0.3, 0.26, 0.26, face), 0, 0, 0.06));
  head.add(at(box(0.22, 0.12, 0.08, mat(0x6a4a30)), 0, -0.06, 0.2));
  for (const s of [-1, 1]) {
    head.add(at(box(0.07, 0.06, 0.02, mat(0xff3030, 0.7)), s * 0.07, 0.05, 0.195));
    head.add(at(box(0.1, 0.025, 0.02, dark), s * 0.07, 0.1, 0.196, 0, 0, s * 0.35));
    horn(head, s, hornM, mat(0xf2c14e, 0.5), { x: 0.14, y: 0.08, z: -0.02, rz: -1.6, bz: 0.95, bx: 0.2, len: 0.08, segs: 7, r: 0.055 });
    head.add(at(box(0.08, 0.05, 0.12, wool2), s * 0.18, 0.02, 0.02, 0, 0, s * 0.4));
  }
  for (const [x, y] of [[0, 0.17], [-0.08, 0.15], [0.08, 0.15]]) head.add(at(sph(0.07, 6, 4, wool), x, y, 0.04));
  addCrown(head, 0, 0.24, 0.0, 0.55, 0xff3030);
  // Pattes et cape
  const legs = [];
  for (const [x, z] of [[0.18, 0.2], [-0.18, 0.2], [0.18, -0.2], [-0.18, -0.2]]) {
    const l = joint('patte', body, x, -0.25, z);
    l.add(at(box(0.09, 0.26, 0.09, face), 0, -0.12, 0));
    l.add(at(box(0.11, 0.06, 0.12, dark), 0, -0.25, 0.01));
    legs.push(l);
  }
  const cape = joint('cape', body, 0, 0.32, -0.08);
  cape.add(at(box(0.5, 0.04, 0.5, mat(0x8a1a2a)), 0, 0, -0.1, -0.25));
  cape.add(at(box(0.52, 0.04, 0.06, mat(0xf2c14e, 0.3)), 0, -0.06, -0.35, -0.25));
  const aura = addAura(root, { y: 2.3, z: -1.8, R: 1.8, c1: 0xffcf3a, c2: 0xffffff });
  const motes = moteEmitter(fxA, root, [mat(0xffcf3a, 0.5), wool], 6, 2.2);
  const gold = mat(0xffcf3a, 0.6);
  function update(mode, t, dt) {
    body.position.set(0, 0.5, 0); body.rotation.set(0, 0, 0); head.rotation.set(0, 0, 0);
    legs.forEach((l) => l.rotation.set(0, 0, 0));
    if (mode === 'idle') { body.scale.y = 1 + Math.sin(t * 2) * 0.02; head.rotation.y = Math.sin(t * 0.7) * 0.2; }
    if (mode === 'move') { const w = t * 7; legs.forEach((l, i) => { l.rotation.x = Math.sin(w + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.5; }); body.position.y = 0.5 + Math.abs(Math.sin(w)) * 0.04; }
    if (mode === 'ability') {
      // Charge tête baissée puis coup de cornes
      const { k, cross } = phase(t, dt, 3);
      const paw = k < 0.7 ? Math.max(0, Math.sin(k * 18)) : 0;
      const run = k >= 0.7 && k < 1.2 ? ease((k - 0.7) / 0.5) : k >= 1.2 && k < 2 ? 1 : k >= 2 ? 1 - ease(clamp01((k - 2) / 0.8)) : 0;
      legs[0].rotation.x = -0.6 * paw;
      head.rotation.x = 0.35 * Math.max(paw > 0 ? 0.6 : 0, run);
      body.position.z = 0.5 * run;
      body.rotation.x = 0.1 * run;
      if (k > 0.7 && k < 1.2) { const w = t * 14; legs.forEach((l, i) => { l.rotation.x = Math.sin(w + (i % 2) * Math.PI) * 0.7; }); if (Math.random() < 0.5) fxA.puff(new V3(root.position.x, 0.05, root.position.z + body.position.z * S - 0.6), mat(0xd8cfc0), 1, 0.7, 0.8); }
      if (cross(0.3) || cross(0.55)) fxA.puff(new V3(root.position.x + 0.6, 0.05, root.position.z + 0.6), mat(0xd8cfc0), 3, 0.6, 0.4);
      if (cross(1.2)) {
        const g = front({ root }, 0.5 * S + 1.4, 0, 0.6);
        fxA.ring(g.clone().setY(0.05), gold, 4.5, 0.6);
        fxA.burst(g, [gold, wool], 16, 3.5, 3);
        fxA.ring(g.clone().setY(1.2), gold, 2.5, 0.5, true);
      }
    }
    if (mode !== 'still') { aura.update(t); motes(dt); fxA.update(dt); }
  }
  return { root, fx, update };
}

/* ---------------------------------------------------------------- Socle ARBRE (Abraknyde Ancestral, Chêne Mou) */
function treantBase(o) {
  const S = o.scale;
  const root = new THREE.Group();
  root.name = o.name;
  const fx = new THREE.Group();
  fx.name = o.name + '_fx';
  const rig = joint('echelle', root);
  rig.scale.setScalar(S);
  const bark = mat(o.bark), bark2 = mat(o.bark2), leaf = mat(o.leaf), leaf2 = mat(o.leaf2), eye = mat(o.eye, 0.9), dark = mat(0x1e1214);
  const hips = joint('souche', rig, 0, 0.62, 0);
  hips.add(box(0.5, 0.3, 0.42, bark));
  // Jambes-racines
  const legs = [];
  for (const s of [-1, 1]) {
    const l = joint('racine', hips, s * 0.16, -0.1, 0);
    l.add(at(box(0.2, 0.32, 0.22, bark2), 0, -0.16, 0));
    const k = joint('racine_bas', l, 0, -0.3, 0);
    k.add(at(box(0.18, 0.24, 0.2, bark2), 0, -0.1, 0.02));
    for (const a of [-0.6, 0, 0.6]) k.add(at(cone(0.05, 0.2, 4, bark2), Math.sin(a) * 0.1, -0.2, 0.08 + Math.cos(a) * 0.04, Math.PI / 2 + 0.7, a, 0));
    legs.push({ l, k });
  }
  // Tronc (torse) avec visage creusé
  const trunk = joint('tronc', hips, 0, 0.15, 0);
  trunk.add(at(box(0.56, 0.8, 0.46, bark), 0, 0.4, 0));
  for (let i = 0; i < 4; i++) trunk.add(at(box(0.04, 0.6, 0.02, bark2), -0.18 + i * 0.12, 0.42, 0.235));
  trunk.add(at(box(0.36, 0.14, 0.02, dark), 0, 0.5, 0.236));
  for (const s of [-1, 1]) {
    trunk.add(at(box(0.09, 0.07, 0.02, eye), s * 0.1, 0.52, 0.24));
    trunk.add(at(box(0.14, 0.04, 0.03, bark2), s * 0.1, 0.6, 0.24, 0, 0, s * 0.3));
  }
  trunk.add(at(box(0.2, 0.08, 0.02, dark), 0, 0.3, 0.237));
  for (let i = 0; i < 3; i++) trunk.add(at(cone(0.015, 0.05, 4, mat(0xe8dcc0)), -0.06 + i * 0.06, 0.32, 0.245, Math.PI));
  // Bras-branches
  const arms = [];
  for (const s of [-1, 1]) {
    const a = joint('branche', trunk, s * 0.32, 0.62, 0);
    a.rotation.z = s * 0.5;
    a.add(at(box(0.16, 0.42, 0.16, bark), 0, -0.2, 0));
    const e = joint('branche_bas', a, 0, -0.4, 0);
    e.add(at(box(0.13, 0.36, 0.13, bark), 0, -0.17, 0));
    for (const f of [-0.5, 0, 0.5]) e.add(at(cone(0.04, 0.24, 4, bark2), Math.sin(f) * 0.06, -0.42, Math.cos(f) * 0.03, Math.PI + f * 0.4, 0, f));
    e.add(at(sph(0.1, 6, 4, leaf2), s * 0.06, -0.1, 0.05));
    arms.push({ a, e, s });
  }
  // Couronne de feuillage
  const crown = joint('feuillage', trunk, 0, 0.85, -0.02);
  for (const [x, y, z, r] of o.canopy) crown.add(at(sph(r, 7, 5, (x * 3 + z) % 2 > 0 ? leaf : leaf2), x, y, z));
  return { root, fx, rig, hips, trunk, legs, arms, crown, mats: { bark, bark2, leaf, leaf2, eye }, fxA: makeFx(fx) };
}
function animTreant(tr, mode, t) {
  tr.hips.position.y = 0.62; tr.trunk.rotation.set(0, 0, 0);
  tr.legs.forEach(({ l, k }) => { l.rotation.set(0, 0, 0); k.rotation.set(0, 0, 0); });
  tr.arms.forEach(({ a, e, s }) => { a.rotation.set(0, 0, s * 0.5); e.rotation.set(-0.3, 0, 0); });
  if (mode === 'idle' || mode === 'ability') {
    tr.trunk.rotation.z = Math.sin(t * 0.8) * 0.04;
    tr.crown.rotation.y = Math.sin(t * 0.5) * 0.08;
    tr.arms.forEach(({ a, s }, i) => { a.rotation.x = Math.sin(t * 1.2 + i) * 0.08; });
  } else if (mode === 'move') {
    const w = t * 3.5;
    tr.legs.forEach(({ l, k }, i) => { l.rotation.x = Math.sin(w + i * Math.PI) * 0.45; k.rotation.x = Math.max(0, Math.sin(w + i * Math.PI + 1)) * 0.5; });
    tr.trunk.rotation.z = Math.sin(w) * 0.08;
    tr.hips.position.y = 0.62 + Math.abs(Math.sin(w)) * 0.04;
    tr.arms.forEach(({ a }, i) => { a.rotation.x = Math.sin(w + i * Math.PI + Math.PI) * 0.35; });
  }
}
function rootSpike(fxA, pos, m1, m2, h = 1) {
  const g = new THREE.Group();
  g.add(at(cone(0.16, h, 5, m1), 0, h / 2, 0));
  g.add(at(cone(0.04, 0.2, 4, m1), 0.1, h * 0.5, 0, 0, 0, -1));
  g.add(at(cone(0.05, 0.16, 4, m2), 0, h + 0.05, 0));
  g.position.copy(pos);
  g.rotation.set((Math.random() - 0.5) * 0.4, Math.random() * 3, (Math.random() - 0.5) * 0.4);
  fxA.obj(g, 1.3, (p, d, k) => { const age = p.max - p.life; p.m.scale.set(1, Math.min(1, age * 7) * Math.min(1, k * 3), 1); });
}

/** BOSS — Abraknyde Ancestral : arbre millénaire dont les racines jaillissent du sol. */
function buildAbraknydeAncestral() {
  const tr = treantBase({ name: 'AbraknydeAncestral', scale: 2.6, bark: 0x4a321a, bark2: 0x35230f, leaf: 0x2f5a1f, leaf2: 0x3f7a2a, eye: 0xffe060,
    canopy: [[0, 0.2, 0, 0.42], [-0.32, 0.05, 0.05, 0.3], [0.32, 0.05, 0.05, 0.3], [0, 0.45, -0.1, 0.3], [-0.2, 0.35, 0.2, 0.22], [0.22, 0.32, 0.18, 0.22], [0, 0.1, -0.3, 0.3]] });
  // Mousse, champignons et lanternes de sève
  for (let i = 0; i < 5; i++) tr.trunk.add(at(sph(0.06, 5, 4, mat(0x6a9a3a)), -0.25 + i * 0.12, 0.05 + (i % 2) * 0.1, 0.22));
  for (let i = 0; i < 3; i++) tr.crown.add(at(crystal(0.05, 0.16, mat(0xffe060, 0.6), 4), -0.3 + i * 0.3, -0.2, 0.3));
  const aura = addAura(tr.root, { y: 2.4, z: -1.6, R: 1.9, c1: 0x8fd14f, c2: 0xffe060 });
  const motes = moteEmitter(tr.fxA, tr.root, [mat(0x8fd14f, 0.4), mat(0xffe060, 0.5)], 6, 2.2);
  const green = mat(0x8fd14f, 0.6);
  function update(mode, t, dt) {
    animTreant(tr, mode, t);
    if (mode === 'ability') {
      const { k, cross } = phase(t, dt, 3.2);
      const up = k < 0.6 ? ease(k / 0.6) : k < 1.8 ? 1 : 1 - ease(clamp01((k - 1.8) / 0.6));
      tr.arms.forEach(({ a, s }) => { a.rotation.z = s * (0.5 + 1.8 * up); });
      tr.trunk.rotation.x = -0.15 * up;
      for (const [x, d] of [[0.7, 2], [0.9, 3], [1.1, 4], [1.3, 5]]) if (cross(x)) {
        for (let i = -2; i <= 2; i++) rootSpike(tr.fxA, front({ root: tr.root }, d, i * 0.6 * (d / 3), 0), tr.mats.bark2, green, 1 + Math.random() * 0.8);
        tr.fxA.puff(front({ root: tr.root }, d, 0, 0), mat(0x6a5a40), 4, 0.7, 1.4);
      }
    }
    if (mode !== 'still') { aura.update(t); motes(dt); tr.fxA.update(dt); }
  }
  return { root: tr.root, fx: tr.fx, update };
}

/** BOSS — Le Chêne Mou : chêne affaissé et moussu qui crache un nuage de spores. */
function buildCheneMou() {
  const tr = treantBase({ name: 'CheneMou', scale: 3.2, bark: 0x5a3a1a, bark2: 0x40280f, leaf: 0x7aa040, leaf2: 0x5a8a30, eye: 0xd0ff7a,
    canopy: [[0, 0.1, 0, 0.5], [-0.42, -0.08, 0.05, 0.34], [0.42, -0.08, 0.05, 0.34], [-0.25, -0.22, 0.2, 0.26], [0.25, -0.22, 0.2, 0.26], [0, 0.4, -0.05, 0.32], [0, -0.05, -0.36, 0.34]] });
  // Champignons sur le tronc, glands qui pendent
  const capM = mat(0xc0392b), dotM = mat(0xffffff);
  for (const [x, y, s] of [[-0.24, 0.2, 1], [0.26, 0.45, 0.8], [0.15, 0.1, 0.7]]) {
    const m = joint('champignon', tr.trunk, x, y, 0.22);
    m.add(at(cyl(0.025, 0.03, 0.08, 6, mat(0xf4ecdd)), 0, 0, 0.02, Math.PI / 2));
    m.add(at(sph(0.08, 8, 4, capM), 0, 0.02, 0.08));
    m.add(at(box(0.02, 0.02, 0.01, dotM), 0.03, 0.06, 0.13));
    m.scale.setScalar(s);
  }
  const acorns = [];
  for (let i = 0; i < 6; i++) {
    const a = joint('gland', tr.crown, Math.cos(i) * 0.4, -0.35, Math.sin(i) * 0.35);
    a.add(at(cyl(0.006, 0.006, 0.12, 4, tr.mats.bark2), 0, -0.06, 0));
    a.add(at(sph(0.05, 6, 5, mat(0xa86a2a)), 0, -0.15, 0));
    a.add(at(cyl(0.055, 0.05, 0.03, 6, tr.mats.bark2), 0, -0.11, 0));
    acorns.push(a);
  }
  const aura = addAura(tr.root, { y: 3, z: -2, R: 2.3, c1: 0xd0ff7a, c2: 0x8a6a3a });
  const motes = moteEmitter(tr.fxA, tr.root, [mat(0xd0ff7a, 0.4), mat(0xa0c860, 0.2, 0.6)], 7, 2.6);
  const spore = mat(0xc8e070, 0.3, 0.55);
  function update(mode, t, dt) {
    animTreant(tr, mode, t);
    tr.arms.forEach(({ e }) => { e.rotation.x = -0.6; });
    if (mode !== 'still') acorns.forEach((a, i) => { a.rotation.z = Math.sin(t * 1.5 + i) * 0.25; });
    if (mode === 'ability') {
      // Bâillement : nuage de spores et pluie de glands
      const { k, cross } = phase(t, dt, 3.2);
      const lean = k < 0.6 ? ease(k / 0.6) : k < 2 ? 1 : 1 - ease(clamp01((k - 2) / 0.6));
      tr.trunk.rotation.x = 0.3 * lean;
      if (k > 0.6 && k < 2) {
        const mouth = wpos(tr.trunk).add(new V3(0, 0.3 * 3.2, 0.8));
        if (Math.random() < 0.7) tr.fxA.proj(mesh(BUBBLE_GEO, spore), mouth, new V3((Math.random() - 0.5) * 1.5, -0.6 - Math.random(), 2.5 + Math.random() * 1.5), { life: 1.6, g: 0 });
      }
      if (cross(0.9)) for (let i = 0; i < 10; i++) {
        const target = front({ root: tr.root }, 2 + Math.random() * 3, (Math.random() - 0.5) * 4, 0);
        const g = new THREE.Group(); g.add(sph(0.12, 6, 5, mat(0xa86a2a))); g.add(at(cyl(0.13, 0.12, 0.07, 6, tr.mats.bark2), 0, 0.08, 0));
        tr.fxA.proj(g, target.clone().setY(6 + Math.random() * 2), new V3(0, -1, 0), { g: 12, life: 2, ground: 0.12, spin: 4, end: (p) => { tr.fxA.ring(p.m.position.clone().setY(0.04), spore, 1.4, 0.4); tr.fxA.puff(p.m.position, spore, 3, 0.8, 0.5); } });
      }
    }
    if (mode !== 'still') { aura.update(t); motes(dt); tr.fxA.update(dt); }
  }
  return { root: tr.root, fx: tr.fx, update };
}

/* ---------------------------------------------------------------- Socle GOLEM (Craqueleurs, Obsidiantre) */
function golemBase(o) {
  const S = o.scale;
  const root = new THREE.Group();
  root.name = o.name;
  const fx = new THREE.Group();
  fx.name = o.name + '_fx';
  const rig = joint('echelle', root);
  rig.scale.setScalar(S);
  const rock = mat(o.rock), rock2 = mat(o.rock2), vein = mat(o.vein, 0.8), eye = mat(o.eye, 0.9);
  const hips = joint('bassin', rig, 0, 0.7, 0);
  hips.add(box(0.6, 0.3, 0.46, rock2));
  const legs = [];
  for (const s of [-1, 1]) {
    const l = joint('jambe', hips, s * 0.2, -0.12, 0);
    l.add(at(box(0.28, 0.3, 0.3, rock), 0, -0.15, 0, 0.1, 0.2 * s, 0));
    const k = joint('genou', l, 0, -0.3, 0);
    k.add(at(box(0.32, 0.28, 0.36, rock2), 0, -0.13, 0.03));
    k.add(at(box(0.04, 0.2, 0.02, vein), 0, -0.13, 0.215));
    legs.push({ l, k });
  }
  const torso = joint('torse', hips, 0, 0.15, 0);
  torso.add(at(box(0.9, 0.7, 0.6, rock), 0, 0.38, 0, 0, 0.05, 0));
  torso.add(at(box(0.5, 0.4, 0.5, rock2), 0.25, 0.62, -0.05, 0.2, 0.4, 0.1));
  torso.add(at(box(0.5, 0.4, 0.5, rock2), -0.25, 0.62, -0.05, -0.1, -0.3, -0.1));
  // Fissures lumineuses
  for (const [x, y, rz, h] of [[-0.15, 0.4, 0.4, 0.4], [0.12, 0.3, -0.3, 0.3], [0.05, 0.55, 1.2, 0.25]]) torso.add(at(box(0.04, h, 0.02, vein), x, y, 0.305, 0, 0, rz));
  const head = joint('tete', torso, 0, 0.8, 0.2);
  head.add(at(box(0.36, 0.28, 0.32, rock2), 0, 0.1, 0));
  for (const s of [-1, 1]) head.add(at(box(0.08, 0.05, 0.02, eye), s * 0.08, 0.12, 0.165));
  head.add(at(box(0.4, 0.06, 0.36, rock), 0, 0.2, 0, 0.1));
  // Cristaux sur le dos
  for (let i = 0; i < o.crystals; i++) {
    const a = (i / o.crystals) * Math.PI - Math.PI / 2;
    torso.add(at(crystal(0.08 + (i % 2) * 0.04, 0.35 + (i % 3) * 0.12, vein, 5), Math.sin(a) * 0.32, 0.75 + Math.cos(a) * 0.08, -0.25, -0.5, 0, -Math.sin(a) * 0.6));
  }
  const arms = [];
  for (const s of [-1, 1]) {
    const a = joint('bras', torso, s * 0.55, 0.55, 0);
    a.add(at(box(0.3, 0.4, 0.3, rock2), 0, -0.18, 0, 0, 0, s * 0.1));
    const e = joint('coude', a, 0, -0.38, 0);
    e.add(at(box(0.34, 0.36, 0.34, rock), 0, -0.16, 0.02));
    const fist = joint('poing', e, 0, -0.36, 0);
    fist.add(at(box(0.4, 0.3, 0.4, rock2), 0, -0.06, 0.02));
    fist.add(at(box(0.05, 0.22, 0.02, vein), 0, -0.06, 0.225));
    arms.push({ a, e, fist, s });
  }
  return { root, fx, rig, hips, torso, head, legs, arms, mats: { rock, rock2, vein, eye }, fxA: makeFx(fx) };
}
function animGolem(g, mode, t) {
  g.hips.position.y = 0.7; g.torso.rotation.set(0, 0, 0); g.head.rotation.set(0, 0, 0);
  g.legs.forEach(({ l, k }) => { l.rotation.set(0, 0, 0); k.rotation.set(0, 0, 0); });
  g.arms.forEach(({ a, e, s }) => { a.rotation.set(0, 0, s * 0.15); e.rotation.set(-0.3, 0, 0); });
  if (mode === 'idle' || mode === 'ability') {
    g.torso.scale.y = 1 + Math.sin(t * 1.4) * 0.015;
    g.head.rotation.y = Math.sin(t * 0.5) * 0.25;
  } else if (mode === 'move') {
    const w = t * 3.2;
    g.legs.forEach(({ l, k }, i) => { l.rotation.x = Math.sin(w + i * Math.PI) * 0.4; k.rotation.x = Math.max(0, Math.sin(w + i * Math.PI + 1)) * 0.5; });
    g.arms.forEach(({ a }, i) => { a.rotation.x = Math.sin(w + i * Math.PI + Math.PI) * 0.4; });
    g.torso.rotation.z = Math.sin(w) * 0.06;
    g.hips.position.y = 0.7 + Math.abs(Math.sin(w)) * 0.03;
  }
}
/** Ability commune des golems : coup double au sol, onde, rochers projetés (et pics de cristal en option). */
function golemSlam(g, mode, t, dt, o) {
  if (mode !== 'ability') return;
  const { k, cross } = phase(t, dt, 3);
  const up = k < 0.7 ? ease(k / 0.7) : 0;
  const slam = k >= 0.7 && k < 0.85 ? ease((k - 0.7) / 0.15) : k >= 0.85 && k < 1.8 ? 1 : k >= 1.8 ? 1 - ease(clamp01((k - 1.8) / 0.7)) : 0;
  g.arms.forEach(({ a }) => { a.rotation.x = -2.9 * up - 1.0 * slam; });
  g.torso.rotation.x = -0.25 * up + 0.5 * slam;
  g.hips.position.y = 0.7 - 0.12 * slam;
  g.legs.forEach(({ k: kn }) => { kn.rotation.x = 0.5 * slam; });
  if (cross(0.85)) {
    const c = front({ root: g.root }, o.dist, 0, 0.05);
    g.fxA.ring(c, o.ring, o.dist * 2, 0.8);
    g.fxA.ring(c.clone().setY(0.1), o.ring2, o.dist * 1.2, 0.6);
    g.fxA.puff(c, o.dust, 14, 1.1, 2.5);
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * TAU;
      const rockM = box(0.3, 0.26, 0.3, Math.random() < 0.5 ? g.mats.rock : g.mats.rock2);
      g.fxA.proj(rockM, c.clone().setY(0.3), new V3(Math.cos(a) * 3, 5 + Math.random() * 3, Math.sin(a) * 3), { g: 12, life: 2, spin: 5, ground: 0.13, end: (p) => g.fxA.puff(p.m.position, o.dust, 2, 0.5, 0.3) });
    }
    if (o.spikes) for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU, rr = 1.6 + (i % 2) * 0.8;
      const pos = c.clone().add(new V3(Math.cos(a) * rr, -0.05, Math.sin(a) * rr));
      const sp = crystal(0.18, 1.2 + Math.random() * 0.8, o.spikes, 5);
      sp.position.copy(pos);
      sp.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35);
      g.fxA.obj(sp, 1.5, (p, d, kk) => { const age = p.max - p.life; p.m.scale.set(1, Math.min(1, age * 6) * Math.min(1, kk * 3), 1); });
    }
  }
}

/** BOSS — Craqueleur des Plaines : golem de roche ocre des plaines de Cania. */
function buildCraqueleurPlaines() {
  const g = golemBase({ name: 'CraqueleurPlaines', scale: 2.5, rock: 0xa08a6a, rock2: 0x8a7656, vein: 0xffa84a, eye: 0xffd060, crystals: 3 });
  for (let i = 0; i < 6; i++) g.torso.add(at(sph(0.06, 5, 4, mat(0x7a9a4a)), -0.35 + i * 0.14, 0.75, 0.15 - (i % 2) * 0.2));
  const aura = addAura(g.root, { y: 2.4, z: -1.6, R: 1.9, c1: 0xffa84a, c2: 0xffd060 });
  const motes = moteEmitter(g.fxA, g.root, [mat(0xffa84a, 0.4), mat(0xa08a6a)], 6, 2.2);
  function update(mode, t, dt) {
    animGolem(g, mode, t);
    golemSlam(g, mode, t, dt, { dist: 2.4, ring: mat(0xffa84a, 0.6), ring2: mat(0xffd060, 0.6), dust: mat(0xc8b490) });
    if (mode !== 'still') { aura.update(t); motes(dt); g.fxA.update(dt); }
  }
  return { root: g.root, fx: g.fx, update };
}

/** BOSS — Craqueleur Légendaire : colosse de pierre sombre veiné d'or en fusion. */
function buildCraqueleurLegendaire() {
  const g = golemBase({ name: 'CraqueleurLegendaire', scale: 3.4, rock: 0x5a5a6a, rock2: 0x44444f, vein: 0xffb020, eye: 0xffcc40, crystals: 7 });
  addCrown(g.head, 0, 0.28, 0, 0.9, 0xffb020);
  // Anneaux de pierre flottants
  const rings = [];
  // Halo de pierre au-dessus de la tête (exclu de la taille comme l'aura)
  for (let i = 0; i < 3; i++) { const r = torus(0.3 + i * 0.08, 0.035, 5, 20, i % 2 ? g.mats.vein : g.mats.rock2); r.name = 'aura_anneau_' + i; r.castShadow = true; g.rig.add(r); rings.push(r); }
  const aura = addAura(g.root, { y: 3.4, z: -2.2, R: 2.6, c1: 0xffb020, c2: 0xff5a1a, spikes: 22 });
  const motes = moteEmitter(g.fxA, g.root, [mat(0xffb020, 0.6), mat(0x5a5a6a)], 9, 3);
  function update(mode, t, dt) {
    animGolem(g, mode, t);
    golemSlam(g, mode, t, dt, { dist: 3, ring: mat(0xffb020, 0.7), ring2: mat(0xff5a1a, 0.6), dust: mat(0x6a6a72), spikes: mat(0xffb020, 0.6) });
    if (mode !== 'still') {
      rings.forEach((r, i) => { r.position.set(0, 2.25 + i * 0.07 + Math.sin(t + i) * 0.04, 0.15); r.rotation.set(Math.PI / 2 + Math.sin(t * 0.7 + i) * 0.3, Math.cos(t * 0.5 + i) * 0.2, t * (i % 2 ? -0.8 : 0.8)); });
      aura.update(t); motes(dt); g.fxA.update(dt);
    }
  }
  return { root: g.root, fx: g.fx, update };
}

/** BOSS — Obsidiantre : gardien d'obsidienne de Frigost, hérissé de cristaux violets. */
function buildObsidiantre() {
  const g = golemBase({ name: 'Obsidiantre', scale: 3.6, rock: 0x1a1a2a, rock2: 0x2a2a3e, vein: 0xa040ff, eye: 0xd8a0ff, crystals: 9 });
  // Cristaux supplémentaires sur les épaules et les poings
  g.arms.forEach(({ a, fist, s }) => {
    for (let i = 0; i < 3; i++) a.add(at(crystal(0.06, 0.3, g.mats.vein, 5), s * 0.1, 0.05, (i - 1) * 0.1, 0, 0, s * -0.6));
    fist.add(at(crystal(0.05, 0.22, g.mats.vein, 5), 0, -0.24, 0.12, 0.4));
  });
  for (const s of [-1, 1]) horn(g.head, s, g.mats.rock2, g.mats.vein, { x: 0.16, y: 0.2, rz: -0.7, bz: 0.15, bx: -0.2, len: 0.14, segs: 4, r: 0.06 });
  // Éclats de glace et d'obsidienne en orbite
  const shards = [];
  for (let i = 0; i < 6; i++) { const c = crystal(0.07, 0.3, i % 2 ? mat(0xb8e0ff, 0.4) : g.mats.vein, 4); g.rig.add(c); shards.push(c); }
  const aura = addAura(g.root, { y: 3.6, z: -2.2, R: 2.7, c1: 0xa040ff, c2: 0xb8e0ff, spikes: 22 });
  const motes = moteEmitter(g.fxA, g.root, [mat(0xa040ff, 0.6), mat(0xb8e0ff, 0.4)], 10, 3);
  function update(mode, t, dt) {
    animGolem(g, mode, t);
    golemSlam(g, mode, t, dt, { dist: 3, ring: mat(0xa040ff, 0.7), ring2: mat(0xb8e0ff, 0.6), dust: mat(0x3a3a4a), spikes: mat(0xa040ff, 0.6) });
    if (mode !== 'still') {
      shards.forEach((c, i) => { const a = (i / 6) * TAU + t * 0.6; c.position.set(Math.cos(a) * 0.95, 1.2 + Math.sin(t * 1.8 + i) * 0.12, Math.sin(a) * 0.95); c.rotation.set(0.3, t * 2, 0); });
      aura.update(t); motes(dt); g.fxA.update(dt);
    }
  }
  return { root: g.root, fx: g.fx, update };
}

/* ---------------------------------------------------------------- BOSS — Mansot Royal */
function buildMansotRoyal() {
  const S = 3.4;
  const root = new THREE.Group();
  root.name = 'MansotRoyal';
  const fx = new THREE.Group();
  fx.name = 'MansotRoyal_fx';
  const fxA = makeFx(fx);
  const rig = joint('echelle', root);
  rig.scale.setScalar(S);
  const black = mat(0x1a2a4a), white = mat(0xf0f0f0), beakM = mat(0xffa020), ice = mat(0xb8e8ff, 0.4), iceT = mat(0xb8e8ff, 0.3, 0.7), dark = mat(0x1e1214);
  const body = joint('corps', rig, 0, 0.45, 0);
  body.add(at(sph(0.32, 8, 7, black), 0, 0.1, 0));
  body.scale.set(1, 1.35, 1);
  body.add(at(sph(0.25, 8, 6, white), 0, 0.06, 0.1));
  const head = joint('tete', body, 0, 0.38, 0.02);
  head.add(at(sph(0.2, 8, 6, black), 0, 0.05, 0));
  head.add(at(box(0.22, 0.1, 0.06, white), 0, 0.02, 0.15));
  head.add(at(cone(0.06, 0.22, 4, beakM), 0, 0.0, 0.27, Math.PI / 2, Math.PI / 4));
  for (const s of [-1, 1]) {
    head.add(at(box(0.05, 0.04, 0.02, mat(0x7ad8ff, 0.8)), s * 0.07, 0.08, 0.18));
    head.add(at(box(0.08, 0.06, 0.02, mat(0xffd84a)), s * 0.16, -0.02, 0.1, 0, s * 0.6, 0));
  }
  addCrown(head, 0, 0.22, 0, 0.6, 0x7ad8ff);
  const flippers = [];
  for (const s of [-1, 1]) {
    const f = joint('aileron', body, s * 0.3, 0.2, 0);
    f.add(at(box(0.06, 0.38, 0.16, black), s * 0.02, -0.17, 0, 0, 0, s * 0.15));
    flippers.push({ f, s });
  }
  // Sceptre de glace dans l'aileron droit
  const scep = joint('sceptre', flippers[0].f, -0.04, -0.34, 0.06);
  scep.add(at(cyl(0.02, 0.02, 0.6, 6, mat(0xf2c14e, 0.3)), 0, 0.15, 0));
  scep.add(at(crystal(0.07, 0.28, ice, 5), 0, 0.52, 0));
  const feet = [];
  for (const s of [-1, 1]) { const ft = joint('pied', body, s * 0.12, -0.33, 0.08); ft.add(at(box(0.12, 0.04, 0.18, beakM), 0, -0.02, 0.04)); feet.push(ft); }
  const cape = joint('cape', body, 0, 0.3, -0.25);
  cape.add(at(box(0.5, 0.5, 0.03, mat(0x2a5aa0)), 0, -0.25, -0.02, 0.15));
  cape.add(at(box(0.52, 0.04, 0.05, white), 0, -0.5, -0.06, 0.15));
  const aura = addAura(root, { y: 2.4, z: -1.6, R: 1.9, c1: 0x7ad8ff, c2: 0xffffff });
  const motes = moteEmitter(fxA, root, [ice, white], 8, 2.2);
  function update(mode, t, dt) {
    body.position.set(0, 0.45, 0); body.rotation.set(0, 0, 0); head.rotation.set(0, 0, 0);
    flippers.forEach(({ f, s }) => f.rotation.set(0, 0, s * 0.15)); feet.forEach((f) => f.rotation.set(0, 0, 0));
    if (mode === 'idle') { body.rotation.z = Math.sin(t * 1.8) * 0.05; head.rotation.y = Math.sin(t * 0.7) * 0.3; flippers.forEach(({ f, s }) => { f.rotation.z = s * (0.15 + Math.max(0, Math.sin(t * 2)) * 0.2); }); }
    if (mode === 'move') { const w = t * 6; body.rotation.z = Math.sin(w) * 0.15; feet.forEach((f, i) => { f.position.y = -0.33 + Math.max(0, Math.sin(w + i * Math.PI)) * 0.06; }); flippers.forEach(({ f, s }) => { f.rotation.z = s * 0.5; }); }
    if (mode === 'ability') {
      // Glissade sur le ventre puis pics de glace en éventail
      const { k, cross } = phase(t, dt, 3);
      const dive = k < 0.4 ? ease(k / 0.4) : k < 1.4 ? 1 : 1 - ease(clamp01((k - 1.4) / 0.5));
      const slide = k >= 0.4 && k < 1.4 ? ease((k - 0.4) / 1) : k >= 1.4 ? 1 - ease(clamp01((k - 1.4) / 1.2)) : 0;
      body.rotation.x = 1.35 * dive;
      body.position.y = 0.45 - 0.18 * dive;
      body.position.z = 0.45 * slide;
      flippers.forEach(({ f, s }) => { f.rotation.z = s * (0.15 + 1.2 * dive); });
      if (k > 0.4 && k < 1.4 && Math.random() < 0.6) fxA.mote(new V3(root.position.x + (Math.random() - 0.5) * 1.2, 0.1, root.position.z + body.position.z * S - 0.8), ice, 0.6, 0.4, CUBE_GEO, 1.2);
      if (cross(1.4)) for (let i = 0; i < 9; i++) {
        const a = -0.8 + (i / 8) * 1.6, d = 1.5 + (i % 3) * 0.8;
        const pos = new V3(root.position.x + Math.sin(a) * (d + 2), 0, root.position.z + Math.cos(a) * (d + 2));
        const sp = crystal(0.22, 1.4 + Math.random(), iceT, 5);
        sp.position.copy(pos);
        sp.rotation.set(Math.cos(a) * 0.3, 0, -Math.sin(a) * 0.3);
        fxA.obj(sp, 1.4, (p, dd, kk) => { const age = p.max - p.life; p.m.scale.set(1, Math.min(1, age * 6) * Math.min(1, kk * 3), 1); });
        fxA.burst(pos.clone().setY(0.2), [ice, white], 3, 1.5, 2);
      }
    }
    if (mode !== 'still') { aura.update(t); motes(dt); fxA.update(dt); }
  }
  return { root, fx, update };
}
