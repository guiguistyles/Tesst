'use strict';
/* ZaapRush 2.0 — modèles 3D (Three.js r128, primitives uniquement).
   Fichier partagé par la visionneuse (models/viewer.html) et le jeu. */
// Boss Modo des 13 classes, moteur d'effets et socle humanoïde partagé.

/* =====================================================================
   2. BOSS MODO — socle commun
   Les 13 boss partagent un squelette massif (rigHumanoid), un habillage
   "Modo" (addModo : aura dorée, cornes, armure, cape, pierres, particules)
   et un petit moteur d'effets (makeFx). Chaque classe ajoute ses
   accessoires et son Ability dans sa propre fonction buildModoXxx().
   ===================================================================== */
const V3 = THREE.Vector3;
const RING_GEO = new THREE.TorusGeometry(0.5, 0.045, 6, 36);
const SPARK_GEO = new THREE.ConeGeometry(0.05, 0.22, 4);
const CUBE_GEO = new THREE.BoxGeometry(0.1, 0.1, 0.1);
const COIN_GEO = new THREE.CylinderGeometry(0.09, 0.09, 0.025, 10);
const BUBBLE_GEO = new THREE.SphereGeometry(0.12, 8, 6);

/** Moteur d'effets : anneaux, gerbes, fumée, particules, projectiles. Tout vit dans le groupe fx. */
function makeFx(fx) {
  const parts = [];
  const add = (m, o) => { fx.add(m); o.m = m; o.max = o.life; parts.push(o); return o; };
  const api = {
    ring(pos, m, size = 2, life = 0.6, vertical = false) {
      const r = new THREE.Mesh(RING_GEO, m);
      r.position.copy(pos);
      if (!vertical) r.rotation.x = Math.PI / 2;
      return add(r, { kind: 'ring', life, size });
    },
    burst(pos, m, n = 10, speed = 2.5, up = 2, geo = SPARK_GEO, life = 0.8) {
      for (let i = 0; i < n; i++) {
        const s = new THREE.Mesh(geo, Array.isArray(m) ? m[i % m.length] : m);
        s.position.copy(pos);
        const a = Math.random() * TAU, sp = speed * (0.5 + Math.random() * 0.7);
        add(s, { kind: 'spark', life: life * (0.7 + Math.random() * 0.5), v: new V3(Math.cos(a) * sp, up * (0.5 + Math.random()), Math.sin(a) * sp), spin: 2 + Math.random() * 8 });
      }
    },
    puff(pos, m, n = 6, life = 0.9, spread = 0.6) {
      for (let i = 0; i < n; i++) {
        const s = new THREE.Mesh(CUBE_GEO, m);
        s.position.copy(pos).add(new V3((Math.random() - 0.5) * spread, Math.random() * spread * 0.5, (Math.random() - 0.5) * spread));
        s.rotation.set(Math.random() * 3, Math.random() * 3, 0);
        add(s, { kind: 'puff', life: life * (0.7 + Math.random() * 0.5), s: 1.5 + Math.random() * 1.5 });
      }
    },
    mote(pos, m, life = 1.6, rise = 0.7, geo = CUBE_GEO, s = 0.5) {
      const p = new THREE.Mesh(geo, m);
      p.position.copy(pos);
      return add(p, { kind: 'mote', life, rise, s });
    },
    /** Objet libre animé par tick(p, dt, k) où k va de 1 (début) à 0 (fin). */
    obj(mesh, life, tick, end) { return add(mesh, { kind: 'obj', life, tick, end }); },
    /** Projectile : vitesse, gravité, rotation, traînée, fin au sol. */
    proj(mesh, pos, vel, o = {}) {
      mesh.position.copy(pos);
      return add(mesh, Object.assign({ kind: 'proj', v: vel.clone(), g: 0, life: 2 }, o));
    },
    update(dt) {
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.life -= dt;
        const k = Math.max(0, p.life / p.max);
        const m = p.m;
        if (p.kind === 'ring') m.scale.setScalar(p.size * (0.15 + (1 - k) * 1.2));
        else if (p.kind === 'spark') { p.v.y -= 7 * dt; m.position.addScaledVector(p.v, dt); m.rotation.x += p.spin * dt; m.rotation.z += p.spin * dt * 0.5; m.scale.setScalar(Math.min(1, k * 1.6)); if (m.position.y < 0.03) { m.position.y = 0.03; p.v.set(p.v.x * 0.5, Math.abs(p.v.y) * 0.3, p.v.z * 0.5); } }
        else if (p.kind === 'puff') { m.position.y += dt * 0.5; m.scale.setScalar(p.s * (0.6 + (1 - k)) * Math.min(1, k * 3)); }
        else if (p.kind === 'mote') { m.position.y += p.rise * dt; m.rotation.y += dt * 3; m.scale.setScalar(p.s * Math.min(1, k * 2.5)); }
        else if (p.kind === 'obj') p.tick && p.tick(p, dt, k);
        else if (p.kind === 'proj') {
          p.v.y -= p.g * dt;
          m.position.addScaledVector(p.v, dt);
          if (p.spin) { m.rotation.x += p.spin * dt; m.rotation.y += p.spin * dt * 0.6; }
          if (p.face) m.lookAt(m.position.clone().add(p.v));
          if (p.trail) { const t = api.mote(m.position.clone(), p.trail, 0.4, 0.3, CUBE_GEO, p.trailSize || 1.2); t.kind = 'puff'; t.s = p.trailSize || 1.2; }
          if (p.ground != null && m.position.y <= p.ground) p.life = 0;
        }
        if (p.life <= 0) { fx.remove(m); parts.splice(i, 1); if (p.end) p.end(p); }
      }
    },
  };
  return api;
}

/** Palette d'un boss : 3 couleurs principales + métal, or et accent émissif. */
function palette(o) {
  const d = { skin: 0xf1c27d, body: 0x8c1c13, body2: 0x5c120c, legs: 0x2c2c3a, legs2: 0x3b3b4c, boots: 0x3a2a20, metal: 0x9aa3ae, metal2: 0x6d7580,
    gold: 0xe0a526, gold2: 0xa8741a, cape: 0x5c120c, horn: 0xe8dcc0, glow: 0xffcf3a, eye: 0xffe066, dark: 0x1e1214 };
  const c = Object.assign(d, o);
  const P = {};
  for (const k in c) P[k] = mat(c[k], k === 'glow' ? 0.7 : k === 'eye' ? 0.9 : 0);
  P.glowSoft = mat(c.glow, 0.35, 0.18);
  P.hex = c;
  return P;
}

/** Squelette humanoïde massif : hanches > torse > cou > tête, bras et jambes en 3 articulations. */
function rigHumanoid(name, P, o = {}) {
  const w = o.bulk ?? 1.3;
  const root = new THREE.Group();
  root.name = name;
  const fx = new THREE.Group();
  fx.name = name + '_fx';
  const body = joint('corps', root);
  const S = o.scale ?? 1.5;
  body.scale.setScalar(S);

  const hips = joint('hanches', body, 0, 1.05, 0);
  hips.add(box(0.56 * w, 0.26, 0.38, P.legs));
  hips.add(at(box(0.62 * w, 0.09, 0.42, P.metal), 0, 0.1, 0));
  hips.add(at(box(0.16, 0.13, 0.05, P.gold), 0, 0.1, 0.22));
  const buckle = crystal(0.05, 0.14, P.glow, 4);
  hips.add(at(buckle, 0, 0.1, 0.26));
  // Tassettes d'armure
  for (const [x, z, ry] of [[0, 0.21, 0], [0, -0.21, Math.PI], [0.3 * w, 0, Math.PI / 2], [-0.3 * w, 0, -Math.PI / 2]]) {
    const t = joint('tassette', hips, x, 0.02, z);
    t.rotation.y = ry;
    t.add(at(box(0.3, 0.3, 0.04, P.metal), 0, -0.15, 0, -0.12));
    t.add(at(box(0.3, 0.04, 0.05, P.gold), 0, -0.29, 0.02, -0.12));
  }

  const torso = joint('torse', hips, 0, 0.16, 0);
  torso.add(at(box(0.66 * w, 0.62, 0.42, P.body), 0, 0.31, 0));
  torso.add(at(box(0.5 * w, 0.44, 0.06, P.metal), 0, 0.35, 0.22));
  torso.add(at(box(0.08, 0.44, 0.07, P.gold), 0, 0.35, 0.235));
  torso.add(at(box(0.7 * w, 0.07, 0.46, P.gold), 0, 0.03, 0));
  const emblem = crystal(0.08, 0.24, P.glow, 4);
  torso.add(at(emblem, 0, 0.42, 0.29));
  torso.add(at(torus(0.13, 0.022, 6, 16, P.gold), 0, 0.42, 0.26));

  const neck = joint('cou', torso, 0, 0.64, 0);
  neck.add(at(cyl(0.1, 0.11, 0.12, 8, P.skin), 0, 0.03, 0));
  neck.add(at(torus(0.16, 0.04, 6, 16, P.gold), 0, 0, 0, Math.PI / 2));
  const head = joint('tete', neck, 0, 0.1, 0);
  head.add(at(box(0.4, 0.4, 0.38, P.skin), 0, 0.2, 0));
  const eyes = [];
  for (const s of [-1, 1]) {
    const e = at(box(0.09, 0.05, 0.02, P.eye), s * 0.09, 0.22, 0.195);
    eyes.push(e);
    head.add(e);
    head.add(at(box(0.12, 0.03, 0.02, P.dark), s * 0.09, 0.28, 0.196, 0, 0, s * 0.3));
  }
  head.add(at(box(0.12, 0.025, 0.02, P.dark), 0, 0.1, 0.195));

  function arm(side) {
    const s = side === 'g' ? 1 : -1;
    const shoulder = joint('bras_' + side, torso, s * (0.33 * w + 0.1), 0.5, 0);
    shoulder.add(at(box(0.19, 0.4, 0.19, P.body), 0, -0.2, 0));
    const elbow = joint('coude_' + side, shoulder, 0, -0.4, 0);
    elbow.add(at(box(0.17, 0.34, 0.17, P.skin), 0, -0.17, 0));
    elbow.add(at(box(0.2, 0.2, 0.2, P.metal), 0, -0.19, 0));
    elbow.add(at(torus(0.12, 0.022, 6, 12, P.gold), 0, -0.1, 0, Math.PI / 2));
    elbow.add(at(torus(0.12, 0.022, 6, 12, P.gold), 0, -0.28, 0, Math.PI / 2));
    elbow.add(at(cone(0.035, 0.14, 4, P.gold), s * 0.12, -0.19, 0, 0, 0, s * -Math.PI / 2));
    const hand = joint('main_' + side, elbow, 0, -0.36, 0);
    hand.add(at(box(0.15, 0.15, 0.15, P.legs2), 0, -0.05, 0));
    return { shoulder, elbow, hand };
  }
  function leg(side) {
    const s = side === 'g' ? 1 : -1;
    const hip = joint('jambe_' + side, hips, s * 0.16 * w, -0.1, 0);
    hip.add(at(box(0.22, 0.46, 0.22, P.legs), 0, -0.23, 0));
    const knee = joint('genou_' + side, hip, 0, -0.46, 0);
    knee.add(at(box(0.2, 0.38, 0.2, P.legs2), 0, -0.19, 0));
    knee.add(at(box(0.22, 0.14, 0.08, P.metal), 0, 0.02, 0.11));
    knee.add(at(cone(0.05, 0.16, 4, P.gold), 0, 0.02, 0.2, Math.PI / 2));
    const boot = joint('botte_' + side, knee, 0, -0.4, 0);
    boot.add(at(box(0.25, 0.16, 0.36, P.boots), 0, -0.02, 0.05));
    boot.add(at(cone(0.08, 0.16, 4, P.boots), 0, -0.04, 0.29, Math.PI / 2, Math.PI / 4));
    boot.add(at(torus(0.13, 0.03, 6, 12, P.gold), 0, 0.08, 0, Math.PI / 2));
    return { hip, knee, boot };
  }
  const armL = arm('g'), armR = arm('d'), legL = leg('g'), legR = leg('d');
  const joints = [hips, torso, neck, head, armL.shoulder, armL.elbow, armL.hand, armR.shoulder, armR.elbow, armR.hand, legL.hip, legL.knee, legR.hip, legR.knee];
  return { root, fx, body, S, w, hips, torso, neck, head, eyes, emblem, buckle, armL, armR, legL, legR, joints, fxApi: makeFx(fx) };
}

/** Corne courbe : une chaîne de cylindres effilés qui se plient à chaque segment. */
function horn(parent, side, m, tip, o = {}) {
  const n = o.segs ?? 4, len = o.len ?? 0.16, r0 = o.r ?? 0.07;
  let p = joint('corne_' + (side > 0 ? 'g' : 'd'), parent, side * (o.x ?? 0.2), o.y ?? 0.34, o.z ?? 0);
  p.rotation.set(o.rx ?? 0, 0, side * (o.rz ?? -0.9));
  for (let i = 0; i < n; i++) {
    const r1 = r0 * (1 - i / n), r2 = r0 * (1 - (i + 1) / n) + 0.008;
    p.add(at(cyl(r2, r1, len, 6, m), 0, len / 2, 0));
    const nx = joint('seg', p, 0, len, 0);
    nx.rotation.set(o.bx ?? 0, 0, side * (o.bz ?? 0.35));
    p = nx;
  }
  p.add(at(cone(0.02 + r0 * 0.15, 0.12, 6, tip || m), 0, 0.05, 0));
  return p;
}

/** Habillage Modo : épaulières à piques, cornes, couronne, cape, aura dorée, pierres flottantes, particules. */
function addModo(r, P, o = {}) {
  const gold = mat(0xf2c14e, 0.45), goldSoft = mat(0xffd76a, 0.3, 0.14);
  // Épaulières massives
  for (const s of [-1, 1]) {
    const pad = joint('epauliere', r.torso, s * (0.33 * r.w + 0.12), 0.56, 0);
    pad.add(sph(0.2, 6, 4, P.metal));
    pad.add(at(box(0.36, 0.08, 0.4, P.gold), 0, 0.09, 0, 0, 0, s * -0.35));
    pad.add(at(box(0.3, 0.06, 0.34, P.metal2), s * 0.04, 0.15, 0, 0, 0, s * -0.4));
    for (let k = 0; k < 4; k++) pad.add(at(cone(0.045, 0.24 + (k % 2) * 0.08, 4, P.gold), s * (0.04 + k * 0.05), 0.2, (k - 1.5) * 0.09, 0, 0, s * -0.55));
  }
  // Cornes
  const hs = o.horns ?? {};
  for (const s of [-1, 1]) horn(r.head, s, P.horn, P.glow, hs);
  // Couronne dorée à piques
  if (o.crown !== false) {
    const crown = joint('couronne', r.head, 0, o.crownY ?? 0.42, 0);
    crown.add(at(box(0.44, 0.06, 0.42, P.gold), 0, 0, 0));
    for (let k = -2; k <= 2; k++) crown.add(at(cone(0.035, 0.12 + (2 - Math.abs(k)) * 0.05, 4, k ? P.gold : P.glow), k * 0.085, 0.09, 0.2));
  }
  // Cape en 3 segments
  const capes = [];
  let cp = joint('cape', r.torso, 0, 0.6, -0.23);
  for (let i = 0; i < 3; i++) {
    const seg = joint('cape_' + i, cp, 0, i ? -0.34 : 0, 0);
    seg.add(at(box(0.62 * r.w - i * 0.04, 0.34, 0.03, P.cape), 0, -0.17, 0));
    seg.add(at(box(0.62 * r.w - i * 0.04, 0.035, 0.035, P.gold), 0, -0.33, 0));
    capes.push(seg);
    cp = seg;
  }
  // Aura dorée derrière le boss
  const aura = joint('aura', r.body, 0, 1.55, -0.75);
  aura.add(at(cyl(1.45, 1.45, 0.02, 48, goldSoft), 0, 0, 0, Math.PI / 2));
  aura.add(torus(1.5, 0.04, 6, 56, gold));
  aura.add(torus(1.12, 0.025, 6, 48, P.glow));
  const spikes = joint('aura_piques', aura);
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * TAU;
    spikes.add(at(cone(0.06, 0.3 + (i % 2) * 0.16, 4, i % 2 ? gold : P.glow), Math.cos(a) * 1.66, Math.sin(a) * 1.66, 0, 0, 0, a - Math.PI / 2));
  }
  const runes = joint('aura_runes', aura);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    runes.add(at(box(0.08, 0.16, 0.02, gold), Math.cos(a) * 1.3, Math.sin(a) * 1.3, 0.02, 0, 0, a));
  }
  // Pierres flottantes cerclées d'or
  const stones = [];
  for (let i = 0; i < 4; i++) {
    const g = joint('pierre_' + i, r.body);
    const st = box(0.2, 0.26, 0.2, P.metal2);
    st.rotation.set(0.5, 0.7, 0.3);
    g.add(st);
    g.add(at(torus(0.19, 0.018, 6, 14, gold), 0, 0, 0, Math.PI / 2));
    g.add(at(crystal(0.04, 0.12, P.glow, 4), 0, 0.2, 0));
    stones.push({ g, a: (i / 4) * TAU + 0.4, rad: 1.25 + (i % 2) * 0.2, h: 1.0 + (i % 2) * 0.9 });
  }
  const moteMats = [gold, P.glow];
  let moteAcc = 0;
  return {
    capes,
    update(t, dt, mode) {
      const still = mode === 'still';
      capes.forEach((c, i) => { c.rotation.x = still ? 0.06 : 0.1 + Math.sin(t * 2.2 - i * 0.8) * (mode === 'move' ? 0.22 : 0.07) + (mode === 'move' ? 0.3 : 0); });
      if (still) return;
      spikes.rotation.z = -t * 0.2;
      runes.rotation.z = t * 0.35;
      spikes.children.forEach((s, i) => { s.scale.y = 1 + Math.sin(t * 5 + i) * 0.2; });
      r.emblem.rotation.y = t * 1.4;
      r.buckle.rotation.y = -t * 1.2;
      stones.forEach((s, i) => {
        const a = s.a + t * 0.45;
        s.g.position.set(Math.cos(a) * s.rad, s.h + Math.sin(t * 1.4 + i) * 0.12, Math.sin(a) * s.rad);
        s.g.rotation.y = t * (0.8 + i * 0.2);
      });
      // Particules dorées qui montent autour du boss
      moteAcc += dt * 14;
      while (moteAcc > 1) {
        moteAcc--;
        const a = Math.random() * TAU, rr = 0.6 + Math.random() * 1.6;
        r.fxApi.mote(new V3(r.root.position.x + Math.cos(a) * rr, Math.random() * 0.6, r.root.position.z + Math.sin(a) * rr), moteMats[moteAcc > 0.5 ? 0 : 1], 1.4 + Math.random(), 0.9, CUBE_GEO, 0.35 + Math.random() * 0.3);
      }
    },
  };
}

/**
 * Habillage léger des héros jouables (version normale, sans aura ni cornes) :
 * épaulettes simples et cape courte qui ondule.
 */
function heroDress(r, P) {
  for (const s of [-1, 1]) {
    const pad = joint('epaulette', r.torso, s * (0.33 * r.w + 0.1), 0.56, 0);
    pad.add(at(box(0.26, 0.08, 0.28, P.metal), 0, 0, 0, 0, 0, s * -0.3));
    pad.add(at(box(0.27, 0.03, 0.29, P.gold), 0, 0.05, 0, 0, 0, s * -0.3));
  }
  const capes = [];
  let cp = joint('cape', r.torso, 0, 0.6, -0.23);
  for (let i = 0; i < 2; i++) {
    const seg = joint('cape_' + i, cp, 0, i ? -0.32 : 0, 0);
    seg.add(at(box(0.56 * r.w - i * 0.04, 0.32, 0.03, P.cape), 0, -0.16, 0));
    capes.push(seg);
    cp = seg;
  }
  capes[1].add(at(box(0.52 * r.w, 0.035, 0.035, P.gold), 0, -0.31, 0));
  return {
    capes,
    update(t, dt, mode) {
      capes.forEach((c, i) => { c.rotation.x = mode === 'still' ? 0.06 : 0.1 + Math.sin(t * 2.6 - i * 0.8) * (mode === 'move' ? 0.25 : 0.07) + (mode === 'move' ? 0.35 : 0); });
    },
  };
}

/** Pose et animation de base communes : respiration (Idle), marche lourde (Move). */
function animBase(r, mode, t) {
  for (const j of r.joints) j.rotation.set(0, 0, 0);
  r.hips.position.set(0, 1.05, 0);
  r.body.position.set(0, 0, 0);
  r.body.scale.setScalar(r.S);
  r.torso.scale.set(1, 1, 1);
  r.armL.shoulder.rotation.z = 0.18;
  r.armR.shoulder.rotation.z = -0.18;
  r.armL.elbow.rotation.x = -0.25;
  r.armR.elbow.rotation.x = -0.25;
  if (mode === 'idle' || mode === 'ability') {
    const b = Math.sin(t * 1.8);
    r.torso.scale.y = 1 + b * 0.03;
    r.hips.position.y = 1.05 + b * 0.012;
    r.head.rotation.y = Math.sin(t * 0.6) * 0.2;
    r.armL.shoulder.rotation.z = 0.18 + Math.sin(t * 1.8 + 1) * 0.04;
    r.armR.shoulder.rotation.z = -0.18 - Math.sin(t * 1.8 + 1) * 0.04;
  } else if (mode === 'move') {
    const w = t * 5;
    const sw = Math.sin(w);
    r.legL.hip.rotation.x = sw * 0.5;
    r.legR.hip.rotation.x = -sw * 0.5;
    r.legL.knee.rotation.x = Math.max(0, -Math.cos(w)) * 0.8;
    r.legR.knee.rotation.x = Math.max(0, Math.cos(w)) * 0.8;
    r.armL.shoulder.rotation.x = -sw * 0.45;
    r.armR.shoulder.rotation.x = sw * 0.45;
    r.hips.position.y = 1.03 + Math.abs(Math.cos(w)) * 0.05;
    r.hips.rotation.z = sw * 0.05;
    r.torso.rotation.y = sw * 0.1;
    r.torso.rotation.x = 0.1;
  }
}

/** Position monde devant le boss (dist en mètres) au niveau du sol. */
function front(r, dist, side = 0, y = 0) {
  return new V3(r.root.position.x + side, y, r.root.position.z + dist);
}
function wpos(obj) { return obj.getWorldPosition(new V3()); }
/** Phase de l'Ability : k dans le cycle, et détection du passage d'un instant. */
function phase(t, dt, T) {
  const k = t % T;
  const prev = k - dt;
  return { k, cross: (x) => prev < x && k >= x };
}

/* ---------------------------------------------------------------- Armes et objets réutilisables */
function buildSword(P, len = 1.5, glowMat) {
  const g = new THREE.Group();
  g.name = 'epee';
  g.add(at(cyl(0.045, 0.05, 0.3, 6, P.legs), 0, 0, 0));
  g.add(at(sph(0.08, 6, 4, P.gold), 0, -0.18, 0));
  g.add(at(box(0.5, 0.08, 0.1, P.gold), 0, 0.16, 0));
  for (const s of [-1, 1]) g.add(at(cone(0.05, 0.14, 4, P.gold), s * 0.29, 0.16, 0, 0, 0, s * -Math.PI / 2));
  g.add(at(box(0.2, len, 0.05, P.metal), 0, 0.2 + len / 2, 0));
  g.add(at(box(0.05, len * 0.9, 0.06, glowMat || P.glow), 0, 0.2 + len * 0.47, 0));
  g.add(at(cone(0.14, 0.32, 4, P.metal), 0, 0.2 + len + 0.15, 0, 0, Math.PI / 4));
  for (let i = 0; i < 4; i++) g.add(at(box(0.06, 0.06, 0.07, P.gold), 0, 0.4 + i * len * 0.2, 0));
  return g;
}
/**
 * Épée céleste géante (sort Épée Céleste du Iop) : lame claire aux bords lumineux,
 * rainure de lumière et runes, garde dorée ailée, gemme, auréole, poignée et pommeau.
 * L'origine est la pointe de la lame : posée à y = 0, l'épée est plantée dans le sol.
 */
function buildEpeeCeleste() {
  const g = new THREE.Group();
  g.name = 'epee_celeste';
  const steel = mat(0xe8f0ff), steel2 = mat(0xc4d2ee), edge = mat(0x9fe8ff, 0.8), core = mat(0xffffff, 1);
  const gold = mat(0xf2c14e, 0.35), gold2 = mat(0xd8a838, 0.2), gem = mat(0x5fd0ff, 0.9), grip = mat(0x2a3a6a), feather = mat(0xffffff, 0.5);
  const L = 2.6, base = 0.4;
  // Lame : acier, bords lumineux, rainure de lumière, pointe en losange
  g.add(at(box(0.36, L, 0.08, steel), 0, base + L / 2, 0));
  g.add(at(box(0.46, L * 0.94, 0.04, edge), 0, base + L * 0.47, 0));
  g.add(at(box(0.09, L * 0.86, 0.11, core), 0, base + L * 0.46, 0));
  g.add(at(box(0.3, 0.08, 0.1, steel2), 0, base + L - 0.05, 0));
  g.add(at(cone(0.26, base + 0.05, 4, steel), 0, base / 2, 0, Math.PI, Math.PI / 4));
  for (let i = 0; i < 5; i++) g.add(at(box(0.1, 0.1, 0.13, gem), 0, base + 0.35 + i * L * 0.17, 0, 0, 0, Math.PI / 4));
  // Garde ailée
  const gy = base + L + 0.07;
  g.add(at(box(1.0, 0.16, 0.2, gold), 0, gy, 0));
  g.add(at(box(0.5, 0.26, 0.22, gold2), 0, gy + 0.02, 0));
  for (const s of [-1, 1]) {
    g.add(at(cone(0.09, 0.3, 4, gold), s * 0.6, gy, 0, 0, 0, s * -Math.PI / 2));
    for (let i = 0; i < 4; i++) {
      g.add(at(box(0.5 - i * 0.07, 0.09, 0.05, i % 2 ? feather : gold), s * (0.42 + i * 0.1), gy + 0.18 + i * 0.13, -0.02, 0, 0, s * (0.35 + i * 0.22)));
    }
  }
  g.add(at(crystal(0.12, 0.34, gem, 6), 0, gy + 0.02, 0.14, Math.PI / 2));
  g.add(at(torus(0.5, 0.03, 6, 32, gold), 0, gy + 0.05, -0.05));
  // Poignée et pommeau
  g.add(at(cyl(0.065, 0.065, 0.62, 8, grip), 0, gy + 0.42, 0));
  for (let i = 0; i < 3; i++) g.add(at(torus(0.075, 0.02, 6, 12, gold), 0, gy + 0.2 + i * 0.2, 0, Math.PI / 2));
  g.add(at(sph(0.12, 8, 6, gold), 0, gy + 0.8, 0));
  g.add(at(crystal(0.08, 0.3, gem, 6), 0, gy + 1.0, 0));
  return g;
}

function buildStaff(P, len = 2, topMat) {
  const g = new THREE.Group();
  g.name = 'baton';
  g.add(at(cyl(0.04, 0.05, len, 6, P.legs), 0, len / 2 - 0.5, 0));
  for (const y of [0.2, len * 0.5, len - 0.6]) g.add(at(torus(0.06, 0.018, 6, 12, P.gold), 0, y, 0, Math.PI / 2));
  const top = joint('baton_tete', g, 0, len - 0.45, 0);
  top.add(torus(0.16, 0.03, 6, 18, P.gold));
  top.add(sph(0.11, 8, 6, topMat || P.glow));
  return { g, top };
}
function buildBouftou(scale = 1, wool = 0xf4efe6) {
  const g = new THREE.Group();
  g.name = 'bouftou';
  const W = mat(wool), D = mat(0x5a3a28), H = mat(0x8a5a2b);
  for (const [x, y, z, rr] of [[-0.12, 0.3, 0, 0.16], [0.12, 0.3, 0, 0.16], [0, 0.38, -0.05, 0.17], [0, 0.3, 0.1, 0.14]]) g.add(at(sph(rr, 6, 5, W), x, y, z));
  g.add(at(box(0.18, 0.16, 0.14, D), 0, 0.3, 0.24));
  for (const s of [-1, 1]) {
    g.add(at(torus(0.06, 0.02, 5, 10, H, Math.PI * 1.4), s * 0.1, 0.42, 0.2, 0, Math.PI / 2, 0));
    g.add(at(box(0.05, 0.05, 0.02, mat(0xffffff, 0.3)), s * 0.05, 0.33, 0.315));
    g.add(at(box(0.06, 0.16, 0.06, D), s * 0.1, 0.08, 0.08));
    g.add(at(box(0.06, 0.16, 0.06, D), s * 0.1, 0.08, -0.1));
  }
  g.scale.setScalar(scale);
  return g;
}

/* ---------------------------------------------------------------- Iop Modo */
function buildModoIop(o = {}) {
  const P = palette({ body: 0xb0221a, body2: 0x7a1410, legs: 0x2c2c3a, cape: 0x7a1410, glow: 0xffcf3a, eye: 0xffe066, horn: 0x3a2a24 });
  const r = rigHumanoid(o.hero ? 'HerosIop' : 'ModoIop', P, o.hero ? { bulk: 1.15, scale: 0.78 } : { bulk: 1.4, scale: 1.55 });
  const modo = o.hero ? heroDress(r, P) : addModo(r, P, { horns: { rz: -1.1, bz: 0.45, bx: -0.2, len: 0.17 } });
  // Crinière de feu en piques
  const hair = mat(0xd62828), hair2 = mat(0xff6a1a, 0.4);
  for (let i = 0; i < 9; i++) {
    const a = -0.9 + (i / 8) * 1.8;
    r.head.add(at(cone(0.07, 0.34 + (i % 2) * 0.12, 4, i % 3 ? hair : hair2), Math.sin(a) * 0.18, 0.36, -0.1 - Math.cos(a) * 0.08, -0.6, 0, -a * 0.7));
  }
  // Épée géante dans la main droite
  const swordHold = joint('epee_prise', r.armR.hand, 0, -0.08, 0);
  swordHold.rotation.x = 1.9;
  swordHold.add(buildSword(P, 1.5));
  const fxA = r.fxApi;
  let skySword = null;
  function update(mode, t, dt) {
    animBase(r, mode, t);
    if (mode === 'ability') {
      const { k, cross } = phase(t, dt, 3);
      const up = k < 0.6 ? ease(k / 0.6) : k < 1.0 ? 1 : 0;
      const down = k >= 1.0 && k < 1.2 ? ease((k - 1.0) / 0.2) : k >= 1.2 && k < 2.2 ? 1 : k >= 2.2 ? 1 - ease(clamp01((k - 2.2) / 0.6)) : 0;
      r.armR.shoulder.rotation.x = -2.9 * up + -0.5 * down;
      r.armL.shoulder.rotation.x = -2.6 * up + -0.6 * down;
      r.armL.shoulder.rotation.z = 0.18 - 0.3 * up;
      r.torso.rotation.x = -0.25 * up + 0.45 * down;
      r.hips.position.y = 1.05 - 0.12 * down;
      r.legL.hip.rotation.x = -0.4 * down; r.legL.knee.rotation.x = 0.6 * down;
      r.legR.hip.rotation.x = 0.3 * down; r.legR.knee.rotation.x = 0.4 * down;
      if (cross(0.55)) {
        // Épée géante qui tombe du ciel (Colère de Iop)
        const big = buildSword(P, 1.5);
        big.scale.setScalar(2.6);
        big.rotation.x = Math.PI;
        const pos = front(r, 3.2, 0, 9);
        skySword = fxA.obj(big, 2.4, (p, d) => {
          const age = p.max - p.life;
          p.m.position.y = Math.max(5.0, 9 - age * age * 40);
          if (p.life < 0.5) p.m.scale.setScalar(2.6 * p.life / 0.5);
        });
        big.position.copy(pos);
      }
      if (cross(0.88)) {
        const g = front(r, 3.2, 0, 0.05);
        fxA.ring(g, mat(0xffcf3a, 0.8), 5, 0.7);
        fxA.ring(g, mat(0xff4a1a, 0.6), 3, 0.5);
        fxA.burst(g.clone().setY(0.2), [mat(0xffcf3a, 0.8), mat(0xff6a1a, 0.6)], 18, 4, 4);
        fxA.puff(g, mat(0xd8cfc0), 10, 1, 1.4);
      }
    }
    modo.update(t, dt, mode);
    if (mode !== 'still') fxA.update(dt);
  }
  return { root: r.root, fx: r.fx, update, rig: r };
}

/* ---------------------------------------------------------------- Cra Modo */
function buildModoCra(o = {}) {
  const P = palette({ body: 0x2f6b3f, body2: 0x1f4a2b, legs: 0x3a2a1e, legs2: 0x4a3626, metal: 0xc9d1d9, metal2: 0x8f99a6, cape: 0x1f4a2b, glow: 0x5dff8a, eye: 0xb6ffcf, horn: 0xe8e2d0 });
  const r = rigHumanoid(o.hero ? 'HerosCra' : 'ModoCra', P, o.hero ? { bulk: 1.15, scale: 0.78 } : { bulk: 1.25, scale: 1.55 });
  // Bois de cerf (cornes ramifiées)
  const modo = o.hero ? heroDress(r, P) : addModo(r, P, { horns: { rz: -0.35, bz: 0.25, bx: -0.25, len: 0.2, segs: 5, r: 0.05 }, crownY: 0.4 });
  for (const s of [-1, 1]) r.head.add(at(cone(0.03, 0.22, 4, P.horn), s * 0.32, 0.6, -0.05, -0.2, 0, s * -0.9));
  // Capuche verte à pointe
  r.head.add(at(box(0.46, 0.08, 0.44, P.body2), 0, 0.42, -0.01));
  r.head.add(at(box(0.46, 0.44, 0.06, P.body2), 0, 0.2, -0.21));
  r.head.add(at(cone(0.17, 0.5, 4, P.body2), 0, 0.42, -0.4, -1.9, Math.PI / 4));
  // Grand arc d'argent tenu dans la main gauche
  const bowHold = joint('arc_prise', r.armL.hand, 0, -0.06, 0);
  const R = 0.85, ARC = Math.PI * 0.74;
  const limbs = joint('arc', bowHold, 0, 0, -R * 0.55);
  limbs.add(at(torus(R, 0.04, 5, 20, P.metal, ARC), 0, 0, 0, 0, -Math.PI / 2, -ARC / 2));
  limbs.add(at(torus(R + 0.05, 0.02, 5, 20, P.glow, ARC), 0, 0, 0, 0, -Math.PI / 2, -ARC / 2));
  for (let i = 0; i < 7; i++) {
    const a = -ARC / 2 + (i / 6) * ARC;
    limbs.add(at(cone(0.035, 0.16, 4, i % 2 ? P.gold : P.glow), 0, Math.sin(a) * (R + 0.08), Math.cos(a) * (R + 0.08), Math.atan2(Math.cos(a), Math.sin(a))));
  }
  const tipY = Math.sin(ARC / 2) * R, tipZ = Math.cos(ARC / 2) * R - R * 0.55;
  const str = [cyl(0.012, 0.012, 1, 4, mat(0xdfffe8, 0.4)), cyl(0.012, 0.012, 1, 4, mat(0xdfffe8, 0.4))];
  bowHold.add(...str);
  const nocked = joint('fleche', bowHold);
  function arrowMesh() {
    const a = new THREE.Group();
    a.add(at(cyl(0.014, 0.014, 0.9, 4, P.legs), 0, 0, 0.45, Math.PI / 2));
    a.add(at(cone(0.045, 0.14, 4, P.glow), 0, 0, 0.95, Math.PI / 2));
    a.add(at(box(0.005, 0.08, 0.14, P.metal), 0, 0, 0.06));
    return a;
  }
  nocked.add(arrowMesh());
  function setString(pull) {
    const nz = tipZ - pull * 0.5;
    [[str[0], tipY], [str[1], -tipY]].forEach(([s, ty]) => {
      const dz = tipZ - nz;
      s.scale.set(1, Math.hypot(ty, dz), 1);
      s.position.set(0, ty / 2, (tipZ + nz) / 2 - R * 0.55 + R * 0.55);
      s.rotation.set(Math.atan2(dz, ty), 0, 0);
    });
    nocked.position.set(0, 0, nz);
  }
  const fxA = r.fxApi;
  const green = mat(0x5dff8a, 0.7);
  function update(mode, t, dt) {
    animBase(r, mode, t);
    let pull = 0, aimUp = 0;
    nocked.visible = false;
    r.armL.shoulder.rotation.x = -0.3;
    if (mode === 'ability') {
      // Tir vers le ciel puis pluie de flèches devant le boss
      const { k, cross } = phase(t, dt, 3);
      const raise = k < 0.4 ? ease(k / 0.4) : k < 1.4 ? 1 : 1 - ease(clamp01((k - 1.4) / 0.6));
      pull = k < 0.4 ? 0 : k < 0.9 ? ease((k - 0.4) / 0.5) : 0;
      aimUp = raise;
      r.hips.rotation.y = -0.8 * raise;
      r.head.rotation.set(-0.5 * raise, 0.8 * raise, 0);
      r.armL.shoulder.rotation.set(lerp(-0.3, -2.4, raise), 0, lerp(0.18, 0, raise));
      r.armL.elbow.rotation.x = 0;
      r.armR.shoulder.rotation.set(lerp(0, -2.2, raise), lerp(0, -0.5, raise), 0);
      r.armR.elbow.rotation.x = lerp(-0.25, -1.9, raise);
      nocked.visible = raise > 0.6 && k < 0.9;
      if (cross(0.9)) {
        const p = wpos(nocked);
        fxA.proj(arrowMesh(), p, new V3(0, 14, 0), { life: 0.5, face: true, trail: green, trailSize: 0.9 });
      }
      if (cross(1.3)) {
        for (let i = 0; i < 10; i++) {
          const target = front(r, 3 + (Math.random() - 0.3) * 2.2, (Math.random() - 0.5) * 3.2, 0);
          const start = target.clone().add(new V3(0.6, 7 + Math.random() * 2, -0.8));
          const v = target.clone().sub(start).normalize().multiplyScalar(13);
          fxA.proj(arrowMesh(), start, v, { life: 2, face: true, ground: 0.05, trail: green, trailSize: 0.6, end: (pp) => { fxA.ring(pp.m.position.clone().setY(0.04), green, 0.9, 0.4); fxA.burst(pp.m.position.clone().setY(0.1), green, 4, 1.2, 1.5); } });
        }
      }
    }
    // Arc vertical, incliné vers le ciel pendant l'Ability
    bowHold.rotation.x = -(r.armL.shoulder.rotation.x + r.armL.elbow.rotation.x) - 1.1 * aimUp;
    setString(pull);
    modo.update(t, dt, mode);
    if (mode !== 'still') fxA.update(dt);
  }
  return { root: r.root, fx: r.fx, update, rig: r };
}

/* ---------------------------------------------------------------- Féca Modo */
function buildModoFeca(o = {}) {
  const P = palette({ body: 0x2f5fb8, body2: 0x1d3f80, legs: 0x22324f, legs2: 0x2d4166, metal: 0xe8edf5, metal2: 0xb8c2d2, cape: 0x1d3f80, glow: 0x7fd7ff, eye: 0xcfefff, horn: 0xf4f1de });
  const r = rigHumanoid(o.hero ? 'HerosFeca' : 'ModoFeca', P, o.hero ? { bulk: 1.15, scale: 0.78 } : { bulk: 1.45, scale: 1.55 });
  const modo = o.hero ? heroDress(r, P) : addModo(r, P, { horns: { rz: -1.5, bz: 0.7, bx: 0.15, len: 0.13, segs: 5, r: 0.07, y: 0.3 } });
  // Casque
  r.head.add(at(box(0.46, 0.1, 0.44, P.metal), 0, 0.4, 0));
  for (const s of [-1, 1]) r.head.add(at(box(0.06, 0.3, 0.3, P.metal), s * 0.23, 0.2, 0.02));
  r.head.add(at(box(0.06, 0.18, 0.04, P.gold), 0, 0.38, 0.22));
  // Bouclier-tour sur l'avant-bras gauche
  const shield = joint('bouclier', r.armL.elbow, 0.14, -0.2, 0.05);
  shield.rotation.y = Math.PI / 2;
  shield.add(box(0.72, 0.95, 0.08, P.metal));
  for (const [x, y, w, h] of [[0, 0.47, 0.76, 0.06], [0, -0.47, 0.76, 0.06], [0.37, 0, 0.06, 0.98], [-0.37, 0, 0.06, 0.98]]) shield.add(at(box(w, h, 0.1, P.gold), x, y, 0.01));
  shield.add(at(torus(0.2, 0.03, 6, 20, P.gold), 0, 0.05, 0.06));
  shield.add(at(crystal(0.08, 0.26, P.glow, 4), 0, 0.05, 0.08, Math.PI / 2));
  for (const [x, y] of [[0.3, 0.4], [-0.3, 0.4], [0.3, -0.4], [-0.3, -0.4]]) shield.add(at(cone(0.04, 0.16, 4, P.gold), x, y, 0.12, Math.PI / 2));
  // Bâton à orbe
  const staff = buildStaff(P, 2.1);
  const staffHold = joint('baton_prise', r.armR.hand, 0, -0.06, 0);
  staffHold.rotation.x = 0.2;
  staffHold.add(staff.g);
  staff.g.position.z = 0.13;
  const fxA = r.fxApi;
  const blue = mat(0x7fd7ff, 0.6), blueSoft = mat(0x7fd7ff, 0.3, 0.22);
  function glyph(pos) {
    const g = new THREE.Group();
    g.add(at(cyl(2.4, 2.4, 0.02, 40, blueSoft), 0, 0.02, 0));
    g.add(at(torus(2.4, 0.05, 6, 48, blue), 0, 0.04, 0, Math.PI / 2));
    g.add(at(torus(1.7, 0.04, 6, 40, blue), 0, 0.04, 0, Math.PI / 2));
    for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; g.add(at(box(0.16, 0.03, 0.34, blue), Math.cos(a) * 2.05, 0.05, Math.sin(a) * 2.05, 0, -a, 0)); }
    g.position.copy(pos);
    fxA.obj(g, 2, (p, d, k) => { p.m.rotation.y += d * 0.8; p.m.scale.setScalar(Math.min(1, (1 - k) * 6) * (k < 0.2 ? k / 0.2 : 1)); });
    // Bulle protectrice (demi-sphère)
    const dome = mesh(new THREE.SphereGeometry(2.2, 20, 10, 0, TAU, 0, Math.PI / 2), mat(0x9fe0ff, 0.3, 0.2));
    dome.castShadow = false;
    dome.position.copy(pos);
    fxA.obj(dome, 1.7, (p, d, k) => { p.m.scale.setScalar(Math.min(1, (1 - k) * 4) * (k < 0.25 ? k / 0.25 : 1)); });
  }
  function update(mode, t, dt) {
    animBase(r, mode, t);
    r.armL.shoulder.rotation.x = -0.5;
    r.armL.elbow.rotation.x = -1.1;
    r.armL.shoulder.rotation.z = 0.25;
    if (mode === 'ability') {
      const { k, cross } = phase(t, dt, 3);
      const up = k < 0.5 ? ease(k / 0.5) : k < 0.7 ? 1 - ease((k - 0.5) / 0.2) : 0;
      const hold = k >= 0.7 && k < 2 ? 1 : k >= 2 ? 1 - ease(clamp01((k - 2) / 0.5)) : 0;
      r.armR.shoulder.rotation.x = -2.6 * up - 0.7 * hold;
      r.armL.shoulder.rotation.x = -0.5 - 0.6 * hold;
      r.torso.rotation.x = 0.2 * hold;
      r.hips.position.y = 1.05 - 0.06 * hold;
      if (cross(0.7)) {
        const g = new V3(r.root.position.x, 0, r.root.position.z);
        glyph(g);
        fxA.ring(g.clone().setY(0.05), blue, 6, 0.8);
        fxA.burst(g.clone().setY(0.2), [blue, mat(0xffffff, 0.5)], 16, 3, 3);
      }
    }
    staff.top.rotation.y = t * 1.5;
    modo.update(t, dt, mode);
    if (mode !== 'still') fxA.update(dt);
  }
  return { root: r.root, fx: r.fx, update, rig: r };
}

/* ---------------------------------------------------------------- Eniripsa Modo */
function buildModoEniripsa(o = {}) {
  const P = palette({ skin: 0xf6d5b8, body: 0xe07bb5, body2: 0xb85a92, legs: 0x8a3f6a, legs2: 0xa24f7e, metal: 0xf5f0ff, metal2: 0xd8cce8, cape: 0xf2b8d8, glow: 0xff9ad5, eye: 0xffd6ef, horn: 0xf2c14e, boots: 0x6a2a50 });
  const r = rigHumanoid(o.hero ? 'HerosEniripsa' : 'ModoEniripsa', P, o.hero ? { bulk: 1.15, scale: 0.78 } : { bulk: 1.2, scale: 1.5 });
  const modo = o.hero ? heroDress(r, P) : addModo(r, P, { horns: { rz: -1.2, bz: 0.6, len: 0.1, segs: 4, r: 0.05 } });
  // Auréole
  const halo = joint('aureole', r.head, 0, 0.72, -0.05);
  halo.add(at(torus(0.24, 0.035, 6, 24, mat(0xffe08a, 0.7)), 0, 0, 0, Math.PI / 2));
  // Ailes en plumes superposées
  const wings = [];
  for (const s of [-1, 1]) {
    const wg = joint('aile', r.torso, s * 0.2, 0.5, -0.24);
    for (let i = 0; i < 5; i++) {
      const f = box(0.16, 0.9 - i * 0.12, 0.03, i % 2 ? P.metal : mat(0xffd0e8));
      at(f, s * (0.18 + i * 0.16), 0.1 - i * 0.06, -0.02 * i, 0, 0, s * (-0.9 + i * 0.15));
      wg.add(f);
    }
    wings.push({ wg, s });
  }
  // Baguette au cœur (deux sphères + un cône)
  const wand = joint('baguette', r.armR.hand, 0, -0.08, 0);
  wand.rotation.x = Math.PI / 2 - 0.3;
  wand.add(at(cyl(0.03, 0.035, 0.8, 6, P.gold), 0, 0.3, 0));
  function heart(m, s = 1) {
    const h = new THREE.Group();
    h.add(at(sph(0.09, 8, 6, m), -0.07, 0.04, 0));
    h.add(at(sph(0.09, 8, 6, m), 0.07, 0.04, 0));
    h.add(at(cone(0.13, 0.2, 6, m), 0, -0.08, 0, Math.PI));
    h.scale.setScalar(s);
    return h;
  }
  const wandHeart = heart(P.glow, 1.2);
  wand.add(at(wandHeart, 0, 0.8, 0));
  wand.add(at(torus(0.2, 0.02, 6, 18, P.gold), 0, 0.8, 0));
  const fxA = r.fxApi;
  const pink = mat(0xff9ad5, 0.6), green = mat(0x7dff9a, 0.6);
  let heartAcc = 0;
  function update(mode, t, dt) {
    animBase(r, mode, t);
    let flap = mode === 'still' ? 0 : Math.sin(t * (mode === 'ability' ? 9 : 2.5)) * (mode === 'ability' ? 0.5 : 0.2);
    if (mode === 'ability') {
      const { k, cross } = phase(t, dt, 3);
      const lift = k < 0.6 ? ease(k / 0.6) : k < 2.2 ? 1 : 1 - ease(clamp01((k - 2.2) / 0.6));
      r.body.position.y = lift * 0.6;
      r.armR.shoulder.rotation.x = -2.8 * lift;
      r.armL.shoulder.rotation.set(-1.2 * lift, 0, 0.18 + 0.8 * lift);
      r.legL.knee.rotation.x = 0.5 * lift; r.legR.knee.rotation.x = 0.3 * lift;
      r.head.rotation.x = -0.3 * lift;
      if (cross(0.7) || cross(1.2) || cross(1.7)) {
        const g = new V3(r.root.position.x, 0.05, r.root.position.z);
        fxA.ring(g, pink, 5, 0.9);
        fxA.ring(g.clone().setY(0.1), green, 3.5, 0.7);
      }
      if (k > 0.6 && k < 2.2) {
        heartAcc += dt * 10;
        while (heartAcc > 1) { heartAcc--; const a = Math.random() * TAU, rr = 0.5 + Math.random() * 2; fxA.mote(new V3(r.root.position.x + Math.cos(a) * rr, 0.3 + Math.random(), r.root.position.z + Math.sin(a) * rr), Math.random() < 0.5 ? pink : green, 1.2, 1.4, CUBE_GEO, 1.2); }
        if (cross(1.0)) for (let i = 0; i < 6; i++) { const h = heart(i % 2 ? pink : green, 1.4); const a = (i / 6) * TAU; h.position.set(r.root.position.x + Math.cos(a) * 1.6, 1, r.root.position.z + Math.sin(a) * 1.6); fxA.obj(h, 1.4, (p, d, kk) => { p.m.position.y += d * 1.3; p.m.rotation.y += d * 3; p.m.scale.setScalar(1.4 * Math.min(1, kk * 2)); }); }
      }
    }
    wings.forEach(({ wg, s }) => { wg.rotation.y = s * (-0.35 + flap); wg.rotation.z = s * 0.1; });
    halo.rotation.y = t;
    wandHeart.rotation.y = t * 2;
    modo.update(t, dt, mode);
    if (mode !== 'still') fxA.update(dt);
  }
  return { root: r.root, fx: r.fx, update, rig: r };
}

/* ---------------------------------------------------------------- Sram Modo */
function buildModoSram(o = {}) {
  const P = palette({ skin: 0xe9d8c4, body: 0x3c2f4f, body2: 0x2b2238, legs: 0x241c30, legs2: 0x302640, metal: 0x6b6280, metal2: 0x4a4260, cape: 0x1e1626, glow: 0xb07cff, eye: 0xff3b6b, horn: 0x1a1420, boots: 0x1a1420 });
  const r = rigHumanoid(o.hero ? 'HerosSram' : 'ModoSram', P, o.hero ? { bulk: 1.15, scale: 0.78 } : { bulk: 1.25, scale: 1.55 });
  const modo = o.hero ? heroDress(r, P) : addModo(r, P, { horns: { rz: -0.5, bz: 0.1, bx: -0.45, len: 0.2, segs: 5, r: 0.07 }, crown: false });
  // Masque crâne + capuche
  const bone = mat(0xf2ead8);
  r.head.add(at(box(0.42, 0.34, 0.06, bone), 0, 0.22, 0.2));
  for (const s of [-1, 1]) r.head.add(at(box(0.12, 0.1, 0.02, P.dark), s * 0.1, 0.24, 0.235));
  r.eyes.forEach((e) => { e.position.z = 0.25; e.scale.set(0.6, 0.9, 1); });
  for (let i = -2; i <= 2; i++) r.head.add(at(box(0.04, 0.06, 0.02, P.dark), i * 0.06, 0.1, 0.235));
  r.head.add(at(box(0.5, 0.1, 0.48, P.body2), 0, 0.44, -0.02));
  for (const s of [-1, 1]) r.head.add(at(box(0.06, 0.46, 0.46, P.body2), s * 0.24, 0.2, -0.02));
  r.head.add(at(box(0.5, 0.46, 0.06, P.body2), 0, 0.2, -0.23));
  // Chaînes en bandoulière
  for (let i = 0; i < 7; i++) r.torso.add(at(torus(0.05, 0.016, 5, 10, P.metal), -0.28 + i * 0.09, 0.62 - i * 0.08, 0.25, 0, i % 2 ? Math.PI / 2 : 0, 0));
  // Deux dagues courbes
  function dagger() {
    const g = new THREE.Group();
    g.add(at(cyl(0.03, 0.03, 0.18, 6, P.legs), 0, 0, 0));
    g.add(at(box(0.22, 0.04, 0.06, P.gold), 0, 0.1, 0));
    g.add(at(box(0.08, 0.5, 0.02, P.metal), 0, 0.36, 0, 0, 0, 0.1));
    g.add(at(cone(0.04, 0.16, 4, P.metal), -0.03, 0.66, 0, 0, 0, 0.2));
    g.add(at(box(0.02, 0.4, 0.025, P.glow), 0.02, 0.36, 0, 0, 0, 0.1));
    return g;
  }
  for (const arm of [r.armL, r.armR]) { const d = joint('dague', arm.hand, 0, -0.08, 0); d.rotation.x = Math.PI / 2 + 0.6; d.add(dagger()); }
  const fxA = r.fxApi;
  const purple = mat(0xb07cff, 0.7), smoke = mat(0x3a2f4a);
  function trap(pos) {
    const g = new THREE.Group();
    g.add(at(box(0.5, 0.08, 0.5, P.metal2), 0, 0.04, 0));
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; g.add(at(cone(0.05, 0.25, 4, P.metal), Math.cos(a) * 0.18, 0.18, Math.sin(a) * 0.18)); }
    g.add(at(crystal(0.06, 0.2, purple, 4), 0, 0.2, 0));
    g.position.copy(pos);
    return g;
  }
  function update(mode, t, dt) {
    animBase(r, mode, t);
    r.armL.shoulder.rotation.x = -0.35; r.armR.shoulder.rotation.x = -0.35;
    r.armL.elbow.rotation.x = -0.9; r.armR.elbow.rotation.x = -0.9;
    if (mode === 'ability') {
      // Disparaît dans l'ombre, pose 3 pièges, réapparaît, les pièges explosent
      const { k, cross } = phase(t, dt, 3.2);
      const fade = k < 0.4 ? 1 - ease(k / 0.4) : k < 1.2 ? 0 : k < 1.5 ? ease((k - 1.2) / 0.3) : 1;
      r.body.scale.setScalar(r.S * Math.max(0.001, fade));
      r.torso.rotation.x = 0.3 * (1 - fade);
      if (cross(0.15) || cross(1.25)) fxA.puff(new V3(r.root.position.x, 0.4, r.root.position.z), smoke, 14, 1, 1.4);
      if (cross(0.6)) [[-1.4, 2.2], [0, 3], [1.4, 2.2]].forEach(([x, z], i) => {
        const tr = trap(front(r, z, x, 0));
        fxA.obj(tr, 1.6 - i * 0.1, (p, d, kk) => { p.m.scale.setScalar(Math.min(1, (1 - kk) * 8)); p.m.rotation.y += d * 2; }, (p) => {
          fxA.ring(p.m.position.clone().setY(0.06), purple, 2.4, 0.6);
          fxA.burst(p.m.position.clone().setY(0.2), [purple, P.metal], 12, 3, 3.5);
          fxA.puff(p.m.position, smoke, 6, 0.8, 0.8);
        });
      });
      if (k > 1.5 && k < 2.2) { const s = Math.sin((k - 1.5) / 0.7 * Math.PI); r.armL.shoulder.rotation.set(-1.6 * s, 0.6 * s, 0); r.armR.shoulder.rotation.set(-1.6 * s, -0.6 * s, 0); }
    }
    modo.update(t, dt, mode);
    if (mode !== 'still') fxA.update(dt);
  }
  return { root: r.root, fx: r.fx, update, rig: r };
}

/* ---------------------------------------------------------------- Xélor Modo */
function buildModoXelor(o = {}) {
  const P = palette({ skin: 0xefe8d8, body: 0x2d5a8c, body2: 0x22406a, legs: 0x1f3550, legs2: 0x29466a, metal: 0xd9c27a, metal2: 0xa8924a, cape: 0x22406a, glow: 0x7ab8ff, eye: 0xffd84a, horn: 0xd9c27a });
  const r = rigHumanoid(o.hero ? 'HerosXelor' : 'ModoXelor', P, o.hero ? { bulk: 1.15, scale: 0.78 } : { bulk: 1.25, scale: 1.55 });
  const modo = o.hero ? heroDress(r, P) : addModo(r, P, { horns: { rz: -0.7, bz: -0.05, bx: -0.3, len: 0.2, segs: 3, r: 0.06 }, crownY: 0.44 });
  // Bandelettes de momie
  const band = mat(0xc9bfa8);
  for (let i = 0; i < 4; i++) r.head.add(at(box(0.42, 0.035, 0.4, band), 0, 0.06 + i * 0.1, 0, 0, 0, (i % 2 ? 1 : -1) * 0.08));
  r.eyes[1].visible = false;
  // Grande horloge dans le dos
  const clock = joint('horloge', r.torso, 0, 0.55, -0.42);
  clock.add(at(cyl(0.62, 0.62, 0.06, 32, mat(0xf3ead2)), 0, 0, 0, Math.PI / 2));
  clock.add(torus(0.64, 0.06, 6, 36, P.gold));
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; clock.add(at(box(0.04, i % 3 ? 0.08 : 0.14, 0.03, P.dark), Math.cos(a) * 0.52, Math.sin(a) * 0.52, -0.05, 0, 0, a + Math.PI / 2)); }
  const hourHand = joint('aiguille_h', clock, 0, 0, -0.07), minHand = joint('aiguille_m', clock, 0, 0, -0.08);
  hourHand.add(at(box(0.05, 0.32, 0.02, P.dark), 0, 0.14, 0));
  minHand.add(at(box(0.035, 0.48, 0.02, P.glow), 0, 0.22, 0));
  // Bâton-sablier
  const staffHold = joint('baton_prise', r.armR.hand, 0, -0.06, 0);
  staffHold.rotation.x = 0.2;
  const staff = new THREE.Group();
  staff.position.z = 0.13;
  staffHold.add(staff);
  staff.add(at(cyl(0.04, 0.05, 2, 6, P.gold), 0, 0.5, 0));
  const glass = joint('sablier', staff, 0, 1.65, 0);
  glass.add(at(cone(0.16, 0.24, 6, mat(0x9fd0ff, 0.2, 0.6)), 0, 0.12, 0, Math.PI));
  glass.add(at(cone(0.16, 0.24, 6, mat(0x9fd0ff, 0.2, 0.6)), 0, -0.12, 0));
  glass.add(at(cone(0.1, 0.12, 6, mat(0xffd84a, 0.4)), 0, -0.17, 0));
  for (const y of [0.25, -0.25]) glass.add(at(cyl(0.19, 0.19, 0.04, 8, P.gold), 0, y, 0));
  for (const a of [0, TAU / 3, 2 * TAU / 3]) glass.add(at(cyl(0.015, 0.015, 0.5, 4, P.gold), Math.cos(a) * 0.17, 0, Math.sin(a) * 0.17));
  // Engrenages en orbite
  const gears = [];
  for (let i = 0; i < 3; i++) {
    const g = joint('engrenage_' + i, r.body);
    const gr = joint('roue', g);
    gr.add(torus(0.2, 0.05, 6, 16, P.metal));
    for (let k = 0; k < 10; k++) { const a = (k / 10) * TAU; gr.add(at(box(0.07, 0.08, 0.06, P.metal), Math.cos(a) * 0.26, Math.sin(a) * 0.26, 0, 0, 0, a)); }
    gr.add(at(cyl(0.06, 0.06, 0.08, 8, P.glow), 0, 0, 0, Math.PI / 2));
    gears.push({ g, gr, a: (i / 3) * TAU });
  }
  const fxA = r.fxApi;
  const blue = mat(0x7ab8ff, 0.6);
  let speed = 1;
  function update(mode, t, dt) {
    animBase(r, mode, t);
    speed = 1;
    if (mode === 'ability') {
      // Arrêt du temps : aiguilles affolées, onde bleue, sablier retourné
      const { k, cross } = phase(t, dt, 3);
      const up = k < 0.5 ? ease(k / 0.5) : k < 2 ? 1 : 1 - ease(clamp01((k - 2) / 0.6));
      r.armR.shoulder.rotation.x = -2.7 * up;
      r.armL.shoulder.rotation.set(-0.8 * up, 0, 0.18 + 0.7 * up);
      glass.rotation.z = up * Math.PI;
      speed = 1 + up * 14;
      if (cross(0.6)) {
        const sphere = mesh(new THREE.SphereGeometry(1, 20, 14), mat(0x7ab8ff, 0.4, 0.18));
        sphere.castShadow = false;
        sphere.position.set(r.root.position.x, 1.6, r.root.position.z);
        fxA.obj(sphere, 1.4, (p, d, kk) => { p.m.scale.setScalar(0.5 + (1 - kk) * 4.5); });
        fxA.ring(new V3(r.root.position.x, 0.05, r.root.position.z), blue, 7, 1.2);
        fxA.ring(new V3(r.root.position.x, 2.4, r.root.position.z), blue, 5, 1, true);
      }
      if (k > 0.6 && k < 2) fxA.mote(new V3(r.root.position.x + (Math.random() - 0.5) * 3, 0.2 + Math.random() * 3, r.root.position.z + (Math.random() - 0.5) * 3), mat(0xffd84a, 0.5), 0.8, -0.6, CUBE_GEO, 0.5);
    }
    if (mode !== 'still') {
      minHand.rotation.z = -t * 0.8 * speed;
      hourHand.rotation.z = -t * 0.07 * speed;
      gears.forEach((g, i) => {
        const a = g.a + t * 0.5;
        g.g.position.set(Math.cos(a) * 1.5, 1.8 + Math.sin(t + i) * 0.2, Math.sin(a) * 1.5);
        g.gr.rotation.z = t * (i % 2 ? -1 : 1) * 1.2 * speed;
        g.g.rotation.y = -a;
      });
    }
    modo.update(t, dt, mode);
    if (mode !== 'still') fxA.update(dt);
  }
  return { root: r.root, fx: r.fx, update, rig: r };
}

/* ---------------------------------------------------------------- Osamodas Modo */
function buildModoOsamodas(o = {}) {
  const P = palette({ skin: 0xd8b48a, body: 0x4e9bb0, body2: 0x2f6070, legs: 0x2c4a52, legs2: 0x355a64, metal: 0xd8c8a8, metal2: 0xa8987a, cape: 0x2f6070, glow: 0x7cf0ff, eye: 0x7cf0ff, horn: 0xe8dcc0 });
  const r = rigHumanoid(o.hero ? 'HerosOsamodas' : 'ModoOsamodas', P, o.hero ? { bulk: 1.15, scale: 0.78 } : { bulk: 1.4, scale: 1.55 });
  // Grandes cornes de bélier enroulées
  const modo = o.hero ? heroDress(r, P) : addModo(r, P, { horns: { rz: -1.7, bz: 0.9, bx: 0.25, len: 0.15, segs: 7, r: 0.09, y: 0.3 } });
  // Crinière de fourrure
  const fur = mat(0xf6d38a), fur2 = mat(0xd9b06a);
  for (let i = 0; i < 9; i++) { const a = (i / 8) * Math.PI; r.torso.add(at(sph(0.13, 6, 4, i % 2 ? fur : fur2), Math.cos(a) * 0.42, 0.66 + Math.sin(a) * 0.05, -0.05 - Math.sin(a) * 0.12)); }
  // Fouet articulé
  const whipRoot = joint('fouet', r.armR.hand, 0, -0.1, 0);
  whipRoot.rotation.x = 0.7;
  whipRoot.add(at(cyl(0.04, 0.04, 0.3, 6, P.legs), 0, -0.1, 0));
  const whip = [];
  let wp = joint('fouet_0', whipRoot, 0, -0.25, 0);
  for (let i = 0; i < 9; i++) {
    wp.add(at(cyl(0.025 - i * 0.002, 0.03 - i * 0.002, 0.09, 5, i % 2 ? mat(0x6a4a2a) : mat(0x8a6a3a)), 0, -0.045, 0));
    whip.push(wp);
    wp = joint('fouet_' + (i + 1), wp, 0, -0.09, 0);
  }
  wp.add(at(cone(0.04, 0.12, 4, P.glow), 0, -0.04, 0, Math.PI));
  const fxA = r.fxApi;
  const teal = mat(0x7cf0ff, 0.6);
  function update(mode, t, dt) {
    animBase(r, mode, t);
    whip.forEach((s, i) => { s.rotation.x = mode === 'still' ? 0.1 : Math.sin(t * 2 - i * 0.5) * 0.12; });
    if (mode === 'ability') {
      // Claquement de fouet puis invocation de 3 bouftous
      const { k, cross } = phase(t, dt, 3.2);
      const wind = k < 0.4 ? ease(k / 0.4) : k < 0.6 ? 1 - ease((k - 0.4) / 0.2) * 2 : k < 1 ? -1 + ease((k - 0.6) / 0.4) : 0;
      r.armR.shoulder.rotation.x = -2.4 * Math.max(0, wind) - 0.6 * Math.max(0, -wind);
      whip.forEach((s, i) => { s.rotation.x = wind * 0.35 * Math.sin(k * 14 - i * 0.6); });
      r.torso.rotation.y = -0.4 * wind;
      if (cross(0.55)) { const p = front(r, 2.8, -0.4, 0.5); fxA.burst(p, teal, 10, 3, 2); fxA.ring(p, teal, 1.2, 0.4, true); }
      if (cross(0.8)) [[-1.4, 2.4], [0, 3.2], [1.4, 2.4]].forEach(([x, z], i) => {
        const b = buildBouftou(1.6);
        const home = front(r, z, x, 0);
        b.position.copy(home);
        fxA.puff(home, mat(0xe8e2d6), 6, 0.6, 0.8);
        fxA.obj(b, 1.9, (p, d, kk) => {
          const age = p.max - p.life;
          p.m.scale.setScalar(1.6 * Math.min(1, age * 4) * Math.min(1, p.life * 4));
          p.m.position.y = Math.abs(Math.sin(age * 9 + i)) * 0.3;
          p.m.position.x = home.x + Math.sin(age * 2 + i) * 0.6;
          p.m.rotation.y = Math.cos(age * 2 + i) * 0.8;
        }, (p) => fxA.puff(p.m.position, mat(0xe8e2d6), 6, 0.6, 0.8));
      });
    }
    modo.update(t, dt, mode);
    if (mode !== 'still') fxA.update(dt);
  }
  return { root: r.root, fx: r.fx, update, rig: r };
}

/* ---------------------------------------------------------------- Sacrieur Modo */
function buildModoSacrieur(o = {}) {
  const P = palette({ skin: 0xc1121f, body: 0xc1121f, body2: 0x7a0c14, legs: 0x1a1a2a, legs2: 0x24243a, metal: 0x4a4a5a, metal2: 0x34343e, cape: 0x5a0f14, glow: 0xff2a3a, eye: 0xffd6a5, horn: 0x1a1414, boots: 0x1a1414 });
  const r = rigHumanoid(o.hero ? 'HerosSacrieur' : 'ModoSacrieur', P, o.hero ? { bulk: 1.15, scale: 0.78 } : { bulk: 1.5, scale: 1.6 });
  const modo = o.hero ? heroDress(r, P) : addModo(r, P, { horns: { rz: -1.25, bz: 0.15, bx: -0.15, len: 0.2, segs: 4, r: 0.08 } });
  // Tatouages noirs
  const ink = mat(0x1a0a0e);
  for (const [x, y, rz] of [[-0.18, 0.5, 0.5], [0.18, 0.5, -0.5], [0, 0.18, 0], [-0.25, 0.25, 0.2], [0.25, 0.25, -0.2]]) r.torso.add(at(box(0.05, 0.22, 0.02, ink), x, y, 0.255, 0, 0, rz));
  for (const arm of [r.armL, r.armR]) for (let i = 0; i < 3; i++) arm.shoulder.add(at(box(0.2, 0.03, 0.2, ink), 0, -0.08 - i * 0.1, 0));
  // Chaînes autour des bras
  for (const arm of [r.armL, r.armR]) for (let i = 0; i < 5; i++) arm.elbow.add(at(torus(0.05, 0.018, 5, 10, P.metal), 0.1, -0.05 - i * 0.07, 0.06, 0, i % 2 ? Math.PI / 2 : 0, 0));
  // Cristaux de sang flottants
  const shards = [];
  for (let i = 0; i < 5; i++) { const c = crystal(0.06, 0.3, P.glow, 4); r.body.add(c); shards.push(c); }
  const fxA = r.fxApi;
  const red = mat(0xff2a3a, 0.7), darkRed = mat(0x7a0c14);
  function update(mode, t, dt) {
    animBase(r, mode, t);
    r.armL.elbow.rotation.x = -0.6; r.armR.elbow.rotation.x = -0.6;
    if (mode === 'ability') {
      // Punition : le corps enfle, pics de sang qui jaillissent en cercles
      const { k, cross } = phase(t, dt, 3);
      const rage = k < 0.6 ? ease(k / 0.6) : k < 1.8 ? 1 : 1 - ease(clamp01((k - 1.8) / 0.6));
      r.torso.scale.set(1 + 0.15 * rage, 1 + 0.08 * rage, 1 + 0.15 * rage);
      r.armL.shoulder.rotation.set(-0.3 * rage, 0, 0.18 + 0.9 * rage);
      r.armR.shoulder.rotation.set(-0.3 * rage, 0, -0.18 - 0.9 * rage);
      r.armL.elbow.rotation.x = -0.6 - 1.2 * rage; r.armR.elbow.rotation.x = -0.6 - 1.2 * rage;
      r.head.rotation.x = -0.4 * rage;
      r.hips.position.y = 1.05 - 0.08 * rage;
      for (const [x, n, rad] of [[0.7, 10, 1.4], [0.95, 14, 2.3], [1.2, 18, 3.2]]) if (cross(x)) {
        fxA.ring(new V3(r.root.position.x, 0.05, r.root.position.z), red, rad * 2.2, 0.6);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU + rad;
          const sp = new THREE.Group();
          sp.add(at(cone(0.12, 0.9, 4, darkRed), 0, 0.45, 0));
          sp.add(at(cone(0.05, 0.3, 4, red), 0, 0.85, 0));
          sp.position.set(r.root.position.x + Math.cos(a) * rad, 0, r.root.position.z + Math.sin(a) * rad);
          sp.rotation.set(Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3);
          fxA.obj(sp, 1, (p, d, kk) => { const age = p.max - p.life; p.m.scale.set(1, Math.min(1, age * 8) * Math.min(1, kk * 3), 1); });
        }
      }
    }
    if (mode !== 'still') shards.forEach((c, i) => { const a = (i / 5) * TAU + t * 0.9; c.position.set(Math.cos(a) * 0.8, 1.9 + Math.sin(t * 2 + i) * 0.15, Math.sin(a) * 0.8); c.rotation.y = t * 2; });
    modo.update(t, dt, mode);
    if (mode !== 'still') fxA.update(dt);
  }
  return { root: r.root, fx: r.fx, update, rig: r };
}

/* ---------------------------------------------------------------- Enutrof Modo */
function buildModoEnutrof(o = {}) {
  const P = palette({ skin: 0xf0c8a0, body: 0x9a7a3a, body2: 0x6a4a1f, legs: 0x5a4228, legs2: 0x6a5032, metal: 0xa0a0a8, metal2: 0x7a7a82, cape: 0x6a4a1f, glow: 0xffd84a, eye: 0xffe9a0, horn: 0xd8c8a8 });
  const r = rigHumanoid(o.hero ? 'HerosEnutrof' : 'ModoEnutrof', P, o.hero ? { bulk: 1.15, scale: 0.78 } : { bulk: 1.45, scale: 1.5 });
  const modo = o.hero ? heroDress(r, P) : addModo(r, P, { horns: { rz: -1.0, bz: 0.3, len: 0.14, y: 0.5 }, crown: false });
  // Barbe blanche en cascade
  const beard = mat(0xf2f2f2), beard2 = mat(0xdcdcdc);
  for (let i = 0; i < 5; i++) r.head.add(at(box(0.4 - i * 0.06, 0.12, 0.08, i % 2 ? beard2 : beard), 0, 0.06 - i * 0.1, 0.2 - i * 0.01));
  r.head.add(at(box(0.3, 0.06, 0.06, beard), 0, 0.15, 0.21));
  // Grand chapeau
  r.head.add(at(cyl(0.42, 0.42, 0.05, 16, P.body2), 0, 0.44, 0));
  r.head.add(at(cyl(0.22, 0.25, 0.3, 12, P.body2), 0, 0.6, 0));
  r.head.add(at(torus(0.24, 0.03, 6, 16, P.gold), 0, 0.5, 0, Math.PI / 2));
  // Lanterne à la ceinture
  const lantern = joint('lanterne', r.hips, 0.42, 0, 0.1);
  lantern.add(at(box(0.14, 0.18, 0.14, mat(0xffd84a, 0.9)), 0, -0.12, 0));
  lantern.add(at(box(0.18, 0.03, 0.18, P.metal), 0, -0.02, 0));
  lantern.add(at(box(0.18, 0.03, 0.18, P.metal), 0, -0.22, 0));
  // Pelle géante
  const hold = joint('pelle_prise', r.armR.hand, 0, -0.06, 0);
  hold.rotation.x = 0.15;
  const shovel = new THREE.Group();
  hold.add(shovel);
  shovel.position.z = 0.1;
  shovel.add(at(cyl(0.045, 0.05, 1.7, 6, mat(0x7a5a32)), 0, 0.3, 0));
  shovel.add(at(box(0.5, 0.5, 0.06, P.metal), 0, -0.75, 0.04, 0.2));
  shovel.add(at(box(0.54, 0.05, 0.08, P.gold), 0, -0.5, 0, 0.2));
  shovel.add(at(cone(0.25, 0.18, 4, P.metal), 0, -1.06, 0.1, Math.PI + 0.2, Math.PI / 4));
  shovel.add(at(box(0.3, 0.06, 0.06, P.gold), 0, 1.15, 0));
  // Kamas en orbite
  const coins = [];
  const goldM = mat(0xf2c14e, 0.4);
  for (let i = 0; i < 10; i++) { const c = new THREE.Mesh(COIN_GEO, goldM); c.scale.setScalar(1.4); c.castShadow = true; r.body.add(c); coins.push(c); }
  const fxA = r.fxApi;
  function update(mode, t, dt) {
    animBase(r, mode, t);
    r.armR.shoulder.rotation.x = -0.3;
    if (mode === 'ability') {
      // Coup de pelle : fontaine de kamas et poussière
      const { k, cross } = phase(t, dt, 2.8);
      const up = k < 0.6 ? ease(k / 0.6) : 0;
      const slam = k >= 0.6 && k < 0.8 ? ease((k - 0.6) / 0.2) : k >= 0.8 && k < 1.8 ? 1 : k >= 1.8 ? 1 - ease(clamp01((k - 1.8) / 0.5)) : 0;
      r.armR.shoulder.rotation.x = -0.3 - 2.7 * up - 1.2 * slam;
      r.armL.shoulder.rotation.x = -1.8 * up - 1.2 * slam;
      r.torso.rotation.x = -0.2 * up + 0.5 * slam;
      r.hips.position.y = 1.05 - 0.1 * slam;
      if (cross(0.8)) {
        const g = front(r, 2.2, -0.3, 0.05);
        fxA.ring(g, goldM, 4, 0.7);
        fxA.burst(g.clone().setY(0.2), goldM, 26, 2.8, 6, COIN_GEO, 1.6);
        fxA.puff(g, mat(0xc8b490), 10, 1, 1.2);
      }
    }
    if (mode !== 'still') coins.forEach((c, i) => { const a = (i / 10) * TAU + t * 1.1; c.position.set(Math.cos(a) * 1.05, 1.2 + Math.sin(t * 2 + i) * 0.1 + (i % 2) * 0.25, Math.sin(a) * 1.05); c.rotation.set(Math.PI / 2, 0, a + t * 3); });
    modo.update(t, dt, mode);
    if (mode !== 'still') fxA.update(dt);
  }
  return { root: r.root, fx: r.fx, update, rig: r };
}

/* ---------------------------------------------------------------- Roublard Modo */
function buildModoRoublard(o = {}) {
  const P = palette({ skin: 0xf0c090, body: 0xc27b2a, body2: 0x8a5418, legs: 0x3a2a1a, legs2: 0x4a3622, metal: 0x6a6a72, metal2: 0x4a4a52, cape: 0x4a2e18, glow: 0xff8a2a, eye: 0xffe08a, horn: 0x2a1a12 });
  const r = rigHumanoid(o.hero ? 'HerosRoublard' : 'ModoRoublard', P, o.hero ? { bulk: 1.15, scale: 0.78 } : { bulk: 1.35, scale: 1.55 });
  const modo = o.hero ? heroDress(r, P) : addModo(r, P, { horns: { rz: -0.9, bz: 0.2, bx: -0.3, len: 0.14 }, crown: false });
  // Bandana rouge + lunettes
  const bandana = mat(0xc03030);
  r.head.add(at(box(0.44, 0.12, 0.42, bandana), 0, 0.38, 0));
  r.head.add(at(box(0.1, 0.28, 0.04, bandana), -0.08, 0.26, -0.24, 0.3, 0, 0.3));
  for (const s of [-1, 1]) r.head.add(at(torus(0.07, 0.025, 6, 12, P.metal), s * 0.09, 0.22, 0.2));
  r.eyes.forEach((e) => { e.position.z = 0.205; });
  // Bandoulière de bombes
  const bomb = mat(0x22222a);
  for (let i = 0; i < 5; i++) {
    const g = joint('bombe', r.torso, -0.28 + i * 0.14, 0.62 - i * 0.12, 0.25);
    g.add(sph(0.08, 8, 6, bomb));
    g.add(at(cyl(0.012, 0.012, 0.08, 4, mat(0x8a6a3a)), 0, 0.09, 0));
    g.add(at(box(0.03, 0.03, 0.03, P.glow), 0, 0.14, 0));
  }
  // Tromblon
  const gunHold = joint('tromblon', r.armR.hand, 0, -0.08, 0.05);
  gunHold.rotation.x = 2.6; // canon vers l'avant quand l'avant-bras est levé
  gunHold.add(at(box(0.12, 0.4, 0.14, mat(0x6a4a2a)), 0, -0.1, -0.02));
  gunHold.add(at(cyl(0.06, 0.06, 0.8, 8, P.metal), 0, 0.45, 0.04));
  gunHold.add(at(cone(0.15, 0.24, 8, P.gold), 0, 0.9, 0.04, Math.PI));
  gunHold.add(at(torus(0.08, 0.02, 6, 12, P.gold), 0, 0.3, 0.04, Math.PI / 2));
  const fxA = r.fxApi;
  const orange = mat(0xff8a2a, 0.7), smoke = mat(0x5a5048);
  function bombMesh() { const g = new THREE.Group(); g.add(sph(0.22, 10, 8, bomb)); g.add(at(cyl(0.03, 0.03, 0.18, 4, mat(0x8a6a3a)), 0, 0.24, 0)); g.add(at(box(0.07, 0.07, 0.07, P.glow), 0, 0.35, 0)); return g; }
  function update(mode, t, dt) {
    animBase(r, mode, t);
    r.armR.shoulder.rotation.x = -0.6; r.armR.elbow.rotation.x = -0.6;
    if (mode === 'ability') {
      // Lance 3 bombes en cloche qui explosent à l'impact
      const { k, cross } = phase(t, dt, 3);
      for (const [x, i] of [[0.4, 0], [0.75, 1], [1.1, 2]]) {
        const s = k > x - 0.25 && k < x + 0.1 ? Math.sin(clamp01((k - x + 0.25) / 0.35) * Math.PI) : 0;
        if (s) { r.armL.shoulder.rotation.x = -2.6 * s; r.torso.rotation.y = 0.3 * s; }
        if (cross(x)) {
          const start = wpos(r.armL.hand).add(new V3(0, 0.3, 0));
          const target = front(r, 2.5 + i * 0.8, (i - 1) * 1.4, 0);
          const T = 0.8, g = 12;
          const v = target.clone().sub(start).divideScalar(T);
          v.y = (target.y - start.y) / T + 0.5 * g * T;
          fxA.proj(bombMesh(), start, v, { g, life: 3, spin: 6, ground: 0.2, trail: smoke, trailSize: 0.6, end: (p) => {
            const pos = p.m.position.clone().setY(0.05);
            fxA.ring(pos, orange, 3.2, 0.6);
            fxA.burst(pos.clone().setY(0.3), [orange, mat(0xffd84a, 0.8)], 16, 3.5, 4);
            fxA.puff(pos, smoke, 10, 1.1, 1.2);
          } });
        }
      }
    }
    modo.update(t, dt, mode);
    if (mode !== 'still') fxA.update(dt);
  }
  return { root: r.root, fx: r.fx, update, rig: r };
}

/* ---------------------------------------------------------------- Écaflip Modo */
function buildModoEcaflip(o = {}) {
  const P = palette({ skin: 0xfff1e6, body: 0xc9472f, body2: 0x8a2a1a, legs: 0x3a1f1a, legs2: 0x4a2a22, metal: 0xd8d8e0, metal2: 0xa8a8b4, cape: 0x7a1a14, glow: 0xffcf3a, eye: 0x7dff6a, horn: 0xf2c14e });
  const r = rigHumanoid(o.hero ? 'HerosEcaflip' : 'ModoEcaflip', P, o.hero ? { bulk: 1.15, scale: 0.78 } : { bulk: 1.3, scale: 1.55 });
  const modo = o.hero ? heroDress(r, P) : addModo(r, P, { horns: { rz: -0.6, bz: 0.35, len: 0.1, segs: 3, x: 0.12, y: 0.4 }, crownY: 0.41 });
  // Oreilles de chat, moustaches, museau
  const furO = mat(0xf48c06);
  for (const s of [-1, 1]) {
    r.head.add(at(cone(0.12, 0.3, 4, furO), s * 0.15, 0.52, 0, 0, Math.PI / 4, s * -0.2));
    r.head.add(at(cone(0.06, 0.18, 4, mat(0xffb3c1)), s * 0.15, 0.52, 0.04, 0, Math.PI / 4, s * -0.2));
    for (let i = 0; i < 2; i++) r.head.add(at(box(0.22, 0.012, 0.012, P.dark), s * 0.2, 0.12 + i * 0.04, 0.2, 0, 0, s * (0.1 - i * 0.2)));
  }
  r.head.add(at(box(0.08, 0.05, 0.04, mat(0xff8fab)), 0, 0.15, 0.21));
  r.eyes.forEach((e) => e.scale.set(0.8, 1.6, 1));
  // Queue articulée
  const tail = [];
  let tp = joint('queue', r.hips, 0, 0, -0.2);
  for (let i = 0; i < 7; i++) {
    tp.add(at(cyl(0.05 - i * 0.004, 0.055 - i * 0.004, 0.16, 6, i === 6 ? mat(0xfff1e6) : furO), 0, 0.08, 0));
    tail.push(tp);
    tp = joint('queue_' + i, tp, 0, 0.16, 0);
  }
  // Dés et cartes en orbite
  function die(s = 1) {
    const g = new THREE.Group();
    g.add(box(0.3, 0.3, 0.3, mat(0xffffff)));
    const pip = mat(0xd00000);
    for (const [x, y, z] of [[0, 0, 0.155], [0.155, 0.07, 0.07], [0.155, -0.07, -0.07], [-0.155, 0, 0], [0, 0.155, 0], [0, -0.155, 0.07]]) g.add(at(box(0.05, 0.05, 0.05, pip), x, y, z));
    g.scale.setScalar(s);
    return g;
  }
  const dice = [die(1.2), die(1)];
  dice.forEach((d) => r.body.add(d));
  const cards = [];
  for (let i = 0; i < 6; i++) { const c = box(0.18, 0.26, 0.01, i % 2 ? mat(0xffffff) : mat(0xc9472f)); r.body.add(c); cards.push(c); }
  const fxA = r.fxApi;
  const goldM = mat(0xffcf3a, 0.7);
  function update(mode, t, dt) {
    animBase(r, mode, t);
    if (mode !== 'still') tail.forEach((s, i) => { s.rotation.x = -0.5 + (i === 0 ? -0.6 : 0.15); s.rotation.z = Math.sin(t * 2.5 - i * 0.5) * 0.25; });
    if (mode === 'ability') {
      // Roulette : lance un dé géant qui rebondit et explose en cartes
      const { k, cross } = phase(t, dt, 3);
      const s = k < 0.6 ? Math.sin(clamp01(k / 0.6) * Math.PI) : 0;
      r.armR.shoulder.rotation.x = -2.6 * s;
      r.torso.rotation.y = -0.4 * s;
      if (cross(0.45)) {
        const start = wpos(r.armR.hand).add(new V3(0, 0.4, 0));
        const target = front(r, 3.6, 0, 0.6);
        const T = 0.7, g = 14;
        const v = target.clone().sub(start).divideScalar(T);
        v.y = (target.y - start.y) / T + 0.5 * g * T;
        fxA.proj(die(2.4), start, v, { g, life: 3, spin: 9, ground: 0.6, end: (p) => {
          const pos = p.m.position.clone();
          fxA.ring(pos.clone().setY(0.05), goldM, 4, 0.7);
          for (let i = 0; i < 14; i++) {
            const c = box(0.22, 0.32, 0.012, i % 2 ? mat(0xffffff) : mat(0xc9472f));
            const a = (i / 14) * TAU;
            fxA.proj(c, pos, new V3(Math.cos(a) * 3.5, 3 + Math.random() * 2, Math.sin(a) * 3.5), { g: 6, life: 1.1, spin: 8 });
          }
          const d = die(2.4);
          d.position.copy(pos);
          d.rotation.set(0, 0.6, 0);
          fxA.obj(d, 1.2, (pp, dd, kk) => { pp.m.scale.setScalar(2.4 * Math.min(1, kk * 3)); });
        } });
      }
    }
    if (mode !== 'still') {
      dice.forEach((d, i) => { const a = t * 0.7 + i * Math.PI; d.position.set(Math.cos(a) * 1.3, 2.3 + Math.sin(t * 1.5 + i) * 0.15, Math.sin(a) * 1.3); d.rotation.set(t * (1 + i), t * 0.7, 0); });
      cards.forEach((c, i) => { const a = (i / 6) * TAU - t * 1.2; c.position.set(Math.cos(a) * 0.95, 1.35 + Math.sin(t * 2 + i) * 0.1, Math.sin(a) * 0.95); c.rotation.y = -a + Math.PI / 2; });
    }
    modo.update(t, dt, mode);
    if (mode !== 'still') fxA.update(dt);
  }
  return { root: r.root, fx: r.fx, update, rig: r };
}

/* ---------------------------------------------------------------- Pandawa Modo */
function buildModoPandawa(o = {}) {
  const P = palette({ skin: 0xf4f4f4, body: 0xf4f4f4, body2: 0xdedede, legs: 0x1e1e1e, legs2: 0x2a2a2a, metal: 0x7a5a3a, metal2: 0x5a4028, cape: 0x3e8a5a, glow: 0x9ef01a, eye: 0xffffff, horn: 0x3e8a5a, boots: 0x1e1e1e });
  const r = rigHumanoid(o.hero ? 'HerosPandawa' : 'ModoPandawa', P, o.hero ? { bulk: 1.15, scale: 0.78 } : { bulk: 1.6, scale: 1.55 });
  const modo = o.hero ? heroDress(r, P) : addModo(r, P, { horns: { rz: -1.0, bz: 0.25, len: 0.13, segs: 4 } });
  // Tête de panda : taches noires, oreilles
  const black = mat(0x1e1e1e);
  for (const s of [-1, 1]) {
    r.head.add(at(box(0.13, 0.11, 0.02, black), s * 0.09, 0.22, 0.2));
    r.head.add(at(sph(0.08, 6, 5, black), s * 0.18, 0.42, -0.02));
  }
  r.eyes.forEach((e) => { e.position.z = 0.215; e.scale.set(0.6, 1, 1); });
  r.head.add(at(box(0.08, 0.05, 0.04, black), 0, 0.14, 0.2));
  for (const arm of [r.armL, r.armR]) arm.shoulder.children[0].material = black;
  // Gros ventre + ceinture verte
  r.torso.add(at(sph(0.36, 10, 8, P.body), 0, 0.22, 0.12));
  r.torso.add(at(box(0.8, 0.1, 0.5, mat(0x3e8a5a)), 0, 0.05, 0.02));
  // Tonneau dans le dos
  const barrel = joint('tonneau', r.torso, 0, 0.4, -0.4);
  barrel.add(at(cyl(0.26, 0.26, 0.6, 10, P.metal), 0, 0, 0));
  for (const y of [-0.22, 0, 0.22]) barrel.add(at(torus(0.27, 0.025, 6, 16, P.metal2), 0, y, 0, Math.PI / 2));
  // Bâton de bambou
  const hold = joint('bambou', r.armR.hand, 0, -0.06, 0);
  hold.rotation.x = 0.2;
  const bamboo = new THREE.Group();
  bamboo.position.z = 0.13;
  hold.add(bamboo);
  for (let i = 0; i < 5; i++) { bamboo.add(at(cyl(0.05, 0.05, 0.4, 6, mat(0x7ab33a)), 0, -0.4 + i * 0.42, 0)); bamboo.add(at(cyl(0.06, 0.06, 0.04, 6, mat(0x5a8a2a)), 0, -0.2 + i * 0.42, 0)); }
  bamboo.add(at(cone(0.12, 0.3, 4, mat(0x7ab33a)), 0.08, 1.7, 0, 0, 0, -0.6));
  const fxA = r.fxApi;
  const green = mat(0x9ef01a, 0.6), bubble = mat(0xc8ffb0, 0.3, 0.45);
  function update(mode, t, dt) {
    animBase(r, mode, t);
    if (mode === 'ability') {
      // Saut et plat-ventre : onde verte, bulles et feuilles
      const { k, cross } = phase(t, dt, 3);
      const crouch = k < 0.35 ? ease(k / 0.35) : 0;
      const air = k >= 0.35 && k < 0.95 ? Math.sin((k - 0.35) / 0.6 * Math.PI) : 0;
      const land = k >= 0.95 && k < 1.6 ? 1 - ease((k - 0.95) / 0.65) : 0;
      r.body.position.y = air * 1.6;
      r.hips.position.y = 1.05 - 0.2 * crouch - 0.15 * land;
      r.legL.knee.rotation.x = r.legR.knee.rotation.x = 1.0 * crouch + 0.6 * land + 0.4 * air;
      r.legL.hip.rotation.x = r.legR.hip.rotation.x = -0.6 * crouch - 0.4 * land;
      r.armL.shoulder.rotation.set(-1.2 * air, 0, 0.18 + 1.2 * air);
      r.armR.shoulder.rotation.set(-1.2 * air, 0, -0.18 - 1.2 * air);
      r.torso.rotation.x = 0.3 * land;
      if (cross(0.95)) {
        const g = new V3(r.root.position.x, 0.05, r.root.position.z);
        fxA.ring(g, green, 6, 0.8);
        fxA.ring(g.clone().setY(0.1), mat(0xffffff, 0.3), 4, 0.6);
        fxA.burst(g.clone().setY(0.2), [green, mat(0x7ab33a)], 20, 4, 3);
        fxA.puff(g, mat(0xd8cfc0), 12, 1, 2.4);
        for (let i = 0; i < 16; i++) fxA.mote(new V3(r.root.position.x + (Math.random() - 0.5) * 3, 0.2, r.root.position.z + (Math.random() - 0.5) * 3), bubble, 1.6, 1 + Math.random(), BUBBLE_GEO, 1 + Math.random());
      }
    }
    modo.update(t, dt, mode);
    if (mode !== 'still') fxA.update(dt);
  }
  return { root: r.root, fx: r.fx, update, rig: r };
}

/* ---------------------------------------------------------------- Sadida Modo */
function buildModoSadida(o = {}) {
  const P = palette({ skin: 0x6b4a2a, body: 0x5f7f2a, body2: 0x3f5f1a, legs: 0x4a3a1e, legs2: 0x5a4826, metal: 0x8a6a3a, metal2: 0x6a4a28, cape: 0x3f5f1a, glow: 0xc8ff7a, eye: 0xffe066, horn: 0x6a4a28 });
  const r = rigHumanoid(o.hero ? 'HerosSadida' : 'ModoSadida', P, o.hero ? { bulk: 1.15, scale: 0.78 } : { bulk: 1.4, scale: 1.6 });
  // Bois branchus en guise de cornes
  const modo = o.hero ? heroDress(r, P) : addModo(r, P, { horns: { rz: -0.4, bz: 0.2, bx: -0.15, len: 0.2, segs: 5, r: 0.06 }, crown: false });
  for (const s of [-1, 1]) for (let i = 0; i < 2; i++) r.head.add(at(cone(0.03, 0.24, 4, P.horn), s * (0.3 + i * 0.1), 0.62 + i * 0.12, -0.05, -0.2, 0, s * -1.1));
  // Couronne de feuilles
  const leaf = mat(0x7ab33a), leaf2 = mat(0x5a9a2a);
  for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; r.head.add(at(cone(0.08, 0.26, 4, i % 2 ? leaf : leaf2), Math.cos(a) * 0.22, 0.42, Math.sin(a) * 0.21, Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6)); }
  // Écorce : stries sur le torse, lianes autour des bras
  for (let i = 0; i < 4; i++) r.torso.add(at(box(0.04, 0.4, 0.02, mat(0x3a2a14)), -0.2 + i * 0.13, 0.35, 0.255));
  for (const arm of [r.armL, r.armR]) for (let i = 0; i < 3; i++) arm.shoulder.add(at(torus(0.12, 0.02, 5, 12, leaf), 0, -0.1 - i * 0.11, 0, Math.PI / 2 + 0.3, 0, 0));
  // Bâton à poupée vaudou
  const hold = joint('baton_poupee', r.armR.hand, 0, -0.06, 0);
  hold.rotation.x = 0.2;
  const staff = new THREE.Group();
  staff.position.z = 0.13;
  hold.add(staff);
  staff.add(at(cyl(0.05, 0.06, 2, 6, P.metal), 0, 0.5, 0));
  const doll = joint('poupee', staff, 0, 1.65, 0);
  doll.add(at(box(0.2, 0.24, 0.14, mat(0xc8a878)), 0, 0, 0));
  doll.add(at(box(0.18, 0.16, 0.14, mat(0xc8a878)), 0, 0.2, 0));
  for (const s of [-1, 1]) { doll.add(at(box(0.04, 0.04, 0.02, P.glow), s * 0.05, 0.22, 0.075)); doll.add(at(box(0.08, 0.14, 0.08, mat(0xc8a878)), s * 0.14, 0.02, 0, 0, 0, s * 0.5)); }
  doll.add(at(box(0.02, 0.2, 0.15, mat(0x8a2a1a)), 0, 0, 0));
  const fxA = r.fxApi;
  const thorn = mat(0x2f4a14), tip = mat(0xc8ff7a, 0.6), leafFx = mat(0x7ab33a, 0.2);
  function update(mode, t, dt) {
    animBase(r, mode, t);
    if (mode === 'ability') {
      // Ronces : trois vagues d'épines qui jaillissent en s'éloignant
      const { k, cross } = phase(t, dt, 3.2);
      const up = k < 0.5 ? ease(k / 0.5) : k < 1.8 ? 1 : 1 - ease(clamp01((k - 1.8) / 0.6));
      r.armL.shoulder.rotation.set(-2.6 * up, 0, 0.18 + 0.4 * up);
      r.armR.shoulder.rotation.set(-2.6 * up, 0, -0.18 - 0.4 * up);
      r.head.rotation.x = -0.4 * up;
      for (const [x, d] of [[0.6, 1.8], [0.85, 2.8], [1.1, 3.8]]) if (cross(x)) {
        for (let i = -3; i <= 3; i++) {
          const g = new THREE.Group();
          const h = 0.9 + Math.random() * 0.6;
          g.add(at(cone(0.16, h, 5, thorn), 0, h / 2, 0));
          for (let b = 0; b < 3; b++) g.add(at(cone(0.04, 0.2, 4, thorn), (b % 2 ? 1 : -1) * 0.1, h * (0.3 + b * 0.2), 0, 0, 0, (b % 2 ? -1 : 1) * 1.1));
          g.add(at(cone(0.05, 0.16, 4, tip), 0, h + 0.05, 0));
          const pos = front(r, d, i * 0.55 * (d / 2.5), 0);
          g.position.copy(pos);
          g.rotation.set((Math.random() - 0.5) * 0.4, Math.random() * 3, (Math.random() - 0.5) * 0.4);
          fxA.obj(g, 1.3, (p, dd, kk) => { const age = p.max - p.life; p.m.scale.set(1, Math.min(1, age * 7) * Math.min(1, kk * 3), 1); });
          if (i % 2 === 0) fxA.burst(pos.clone().setY(0.2), leafFx, 3, 1.5, 2.5);
        }
      }
    }
    doll.rotation.y = mode === 'still' ? 0 : Math.sin(t * 2) * 0.4;
    modo.update(t, dt, mode);
    if (mode !== 'still') fxA.update(dt);
  }
  return { root: r.root, fx: r.fx, update, rig: r };
}
