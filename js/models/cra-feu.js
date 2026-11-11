'use strict';
/* ZaapRush 2.0 — modèles 3D (Three.js r128, primitives uniquement).
   Fichier partagé par la visionneuse (models/viewer.html) et le jeu. */
// Cra Feu légendaire.

/* =====================================================================
   1. CRA FEU — LÉGENDAIRE
   Archer drapé de cramoisi, arc enflammé, cristaux de feu en orbite,
   aura solaire. Ability : bander l'arc et tirer une flèche de feu.
   ===================================================================== */
function buildCraFeu() {
  // Palette : 3 couleurs principales + accent feu émissif
  const C = {
    crimson: mat(0x9b1d14), crimsonDark: mat(0x6e130d), leather: mat(0x3b2418), leatherLight: mat(0x5c3a24),
    gold: mat(0xe0a526), goldDark: mat(0xa8741a), skin: mat(0xf1c27d), hood: mat(0xb3361b),
    fire: mat(0xff6a10, 0.55), fireHot: mat(0xffb020, 0.7), ember: mat(0xff4a12, 0.6),
    eye: mat(0xffc040, 0.9), dark: mat(0x1e1214), halo: mat(0xff8a2a, 0.35, 0.12), haloRing: mat(0xffa830, 0.6),
  };

  const root = new THREE.Group();
  root.name = 'CraFeu';
  const fx = new THREE.Group();
  fx.name = 'CraFeu_fx';

  /* ---------- Aura solaire derrière le personnage ---------- */
  const aura = joint('aura', root, 0, 1.45, -0.55);
  aura.add(at(cyl(1.25, 1.25, 0.02, 40, C.halo), 0, 0, 0, Math.PI / 2));
  aura.add(torus(1.3, 0.035, 6, 48, C.haloRing));
  aura.add(torus(0.95, 0.02, 6, 40, C.haloRing));
  const runeRing = joint('runes', aura);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    const rune = box(0.07, 0.14, 0.02, C.fireHot);
    rune.position.set(Math.cos(a) * 1.12, Math.sin(a) * 1.12, 0.02);
    rune.rotation.z = a;
    runeRing.add(rune);
  }
  const flameRing = joint('flammes_aura', aura);
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * TAU;
    const f = cone(0.06, 0.26 + (i % 2) * 0.12, 4, i % 2 ? C.fire : C.fireHot);
    f.position.set(Math.cos(a) * 1.42, Math.sin(a) * 1.42, 0);
    f.rotation.z = a - Math.PI / 2;
    flameRing.add(f);
  }

  /* ---------- Bassin (racine du corps) ---------- */
  const hips = joint('hanches', root, 0, 1.05, 0);
  hips.add(box(0.5, 0.24, 0.32, C.leather));
  hips.add(at(box(0.56, 0.08, 0.36, C.leatherLight), 0, 0.1, 0));
  hips.add(at(box(0.12, 0.1, 0.04, C.gold), 0, 0.1, 0.19));
  hips.add(at(torus(0.05, 0.015, 6, 12, C.gold), 0, 0.1, 0.215));
  // Pans de tunique (jupe)
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + Math.PI / 6;
    const flap = joint('pan_' + i, hips, Math.sin(a) * 0.24, 0.02, Math.cos(a) * 0.16);
    flap.rotation.y = a;
    flap.add(at(box(0.2, 0.34, 0.03, i % 2 ? C.crimsonDark : C.crimson), 0, -0.17, 0));
    flap.add(at(box(0.2, 0.035, 0.035, C.gold), 0, -0.33, 0));
  }

  /* ---------- Torse ---------- */
  const torso = joint('torse', hips, 0, 0.16, 0);
  torso.add(at(box(0.56, 0.56, 0.34, C.crimson), 0, 0.28, 0));
  torso.add(at(box(0.6, 0.06, 0.38, C.gold), 0, 0.02, 0));
  torso.add(at(box(0.08, 0.5, 0.36, C.crimsonDark), 0, 0.28, 0.005));
  // Emblème : cristal de feu sur la poitrine
  const emblem = crystal(0.07, 0.2, C.fireHot, 4);
  at(emblem, 0, 0.33, 0.19);
  torso.add(emblem);
  torso.add(at(torus(0.11, 0.018, 6, 16, C.gold), 0, 0.33, 0.175));
  // Col en anneaux dorés
  torso.add(at(torus(0.17, 0.035, 6, 18, C.gold), 0, 0.58, 0, Math.PI / 2));
  torso.add(at(torus(0.14, 0.03, 6, 18, C.goldDark), 0, 0.62, 0, Math.PI / 2));

  // Épaulières à piques
  for (const s of [-1, 1]) {
    const pad = joint(s > 0 ? 'epauliere_g' : 'epauliere_d', torso, s * 0.34, 0.52, 0);
    pad.add(at(sph(0.16, 6, 4, C.goldDark), 0, 0, 0));
    pad.add(at(box(0.26, 0.06, 0.3, C.gold), 0, 0.06, 0, 0, 0, s * -0.3));
    for (let k = 0; k < 3; k++) {
      pad.add(at(cone(0.035, 0.18, 4, C.gold), s * (0.04 + k * 0.05), 0.13 + (k === 1 ? 0.04 : 0), (k - 1) * 0.09, 0, 0, s * -0.5));
    }
  }

  // Carquois dans le dos, flèches à pointe de feu
  const quiver = joint('carquois', torso, 0.1, 0.32, -0.22);
  quiver.rotation.z = -0.35;
  quiver.add(cyl(0.09, 0.08, 0.62, 8, C.leatherLight));
  quiver.add(at(torus(0.095, 0.018, 6, 12, C.gold), 0, 0.22, 0, Math.PI / 2));
  quiver.add(at(torus(0.09, 0.018, 6, 12, C.gold), 0, -0.24, 0, Math.PI / 2));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU;
    const ax = Math.cos(a) * 0.04, az = Math.sin(a) * 0.04;
    quiver.add(at(cyl(0.008, 0.008, 0.3, 4, C.leather), ax, 0.42, az));
    quiver.add(at(box(0.05, 0.08, 0.004, C.crimsonDark), ax, 0.5, az));
    quiver.add(at(cone(0.022, 0.07, 4, C.fire), ax, 0.6, az));
  }

  // Cape en 3 segments chaînés (pour l'ondulation)
  const capes = [];
  let capeParent = joint('cape', torso, 0, 0.55, -0.19);
  for (let i = 0; i < 3; i++) {
    const seg = joint('cape_' + i, capeParent, 0, i ? -0.3 : 0, 0);
    seg.add(at(box(0.5 - i * 0.03, 0.3, 0.03, i % 2 ? C.crimsonDark : C.crimson), 0, -0.15, 0));
    capes.push(seg);
    capeParent = seg;
  }
  for (let k = -2; k <= 2; k++) capes[2].add(at(cone(0.04, 0.14, 4, k % 2 ? C.fire : C.fireHot), k * 0.1, -0.36, 0, Math.PI));

  /* ---------- Tête ---------- */
  const neck = joint('cou', torso, 0, 0.6, 0);
  neck.add(at(cyl(0.08, 0.09, 0.1, 8, C.skin), 0, 0.03, 0));
  const head = joint('tete', neck, 0, 0.1, 0);
  head.add(at(box(0.34, 0.34, 0.32, C.skin), 0, 0.17, 0));
  // Yeux brillants, sourcils, bouche
  for (const s of [-1, 1]) {
    head.add(at(box(0.08, 0.045, 0.02, C.eye), s * 0.08, 0.19, 0.165));
    head.add(at(box(0.1, 0.025, 0.02, C.dark), s * 0.08, 0.24, 0.166, 0, 0, s * 0.25));
  }
  head.add(at(box(0.08, 0.02, 0.02, C.dark), 0, 0.09, 0.165));
  // Mèches de cheveux enflammées
  for (const s of [-1, 1]) for (let k = 0; k < 2; k++) {
    head.add(at(box(0.05, 0.16 - k * 0.04, 0.05, k ? C.fire : C.ember), s * (0.17 + k * 0.02), 0.12, 0.1 - k * 0.06));
  }
  // Capuche : coque + pointe vers l'arrière + liseré doré
  const hood = joint('capuche', head, 0, 0.17, 0);
  hood.add(at(box(0.42, 0.08, 0.4, C.hood), 0, 0.2, -0.01));
  for (const s of [-1, 1]) hood.add(at(box(0.05, 0.4, 0.4, C.hood), s * 0.2, 0.01, -0.01));
  hood.add(at(box(0.42, 0.42, 0.06, C.hood), 0, 0.01, -0.19));
  hood.add(at(cone(0.15, 0.45, 4, C.hood), 0, 0.2, -0.36, -1.9, Math.PI / 4));
  hood.add(at(box(0.44, 0.04, 0.04, C.gold), 0, 0.24, 0.19));
  for (const s of [-1, 1]) hood.add(at(box(0.04, 0.42, 0.04, C.gold), s * 0.22, 0.03, 0.19));
  // Couronne de flammes
  const crown = joint('couronne', hood, 0, 0.26, 0.15);
  for (let k = -2; k <= 2; k++) crown.add(at(cone(0.035, 0.14 + (2 - Math.abs(k)) * 0.05, 4, Math.abs(k) % 2 ? C.fire : C.fireHot), k * 0.075, 0.07, 0));
  // Plume
  hood.add(at(cone(0.04, 0.32, 4, C.fireHot), 0.2, 0.25, -0.08, -0.6, 0, -0.5));

  /* ---------- Bras (épaule > coude > main) ---------- */
  function buildArm(side) {
    const s = side === 'g' ? 1 : -1;
    const shoulder = joint('bras_' + side, torso, s * 0.36, 0.48, 0);
    shoulder.add(at(box(0.15, 0.36, 0.15, C.crimson), 0, -0.18, 0));
    shoulder.add(at(torus(0.09, 0.02, 6, 12, C.gold), 0, -0.3, 0, Math.PI / 2));
    const elbow = joint('coude_' + side, shoulder, 0, -0.36, 0);
    elbow.add(at(box(0.13, 0.32, 0.13, C.skin), 0, -0.16, 0));
    // Brassard doré à anneaux et piques
    elbow.add(at(box(0.16, 0.16, 0.16, C.goldDark), 0, -0.18, 0));
    elbow.add(at(torus(0.1, 0.02, 6, 12, C.gold), 0, -0.1, 0, Math.PI / 2));
    elbow.add(at(torus(0.1, 0.02, 6, 12, C.gold), 0, -0.26, 0, Math.PI / 2));
    elbow.add(at(cone(0.03, 0.12, 4, C.gold), s * 0.1, -0.18, 0, 0, 0, s * -Math.PI / 2));
    const hand = joint('main_' + side, elbow, 0, -0.34, 0);
    hand.add(at(box(0.12, 0.12, 0.12, C.leather), 0, -0.04, 0));
    return { shoulder, elbow, hand };
  }
  const armL = buildArm('g');
  const armR = buildArm('d');

  /* ---------- Jambes (hanche > genou > botte) ---------- */
  function buildLeg(side) {
    const s = side === 'g' ? 1 : -1;
    const hip = joint('jambe_' + side, hips, s * 0.14, -0.1, 0);
    hip.add(at(box(0.18, 0.44, 0.18, C.leather), 0, -0.22, 0));
    const knee = joint('genou_' + side, hip, 0, -0.44, 0);
    knee.add(at(box(0.16, 0.36, 0.16, C.leatherLight), 0, -0.18, 0));
    knee.add(at(box(0.2, 0.1, 0.06, C.gold), 0, 0.02, 0.09));
    knee.add(at(cone(0.04, 0.12, 4, C.gold), 0, 0.02, 0.15, Math.PI / 2));
    const boot = joint('botte_' + side, knee, 0, -0.38, 0);
    boot.add(at(box(0.2, 0.14, 0.3, C.crimsonDark), 0, -0.02, 0.05));
    boot.add(at(cone(0.07, 0.14, 4, C.crimsonDark), 0, -0.04, 0.24, Math.PI / 2, Math.PI / 4));
    boot.add(at(torus(0.11, 0.025, 6, 12, C.gold), 0, 0.07, 0, Math.PI / 2));
    boot.add(at(cone(0.03, 0.1, 4, C.gold), s * 0.12, 0.02, -0.04, 0, 0, s * -Math.PI / 2));
    return { hip, knee, boot };
  }
  const legL = buildLeg('g');
  const legR = buildLeg('d');

  /* ---------- Arc enflammé (tenu dans la main gauche) ---------- */
  // bowHold garde l'arc vertical quel que soit l'angle du bras
  const bowHold = joint('arc_prise', armL.hand, 0, -0.05, 0);
  const bow = joint('arc', bowHold, 0, 0, 0);
  const R = 0.72, ARC = Math.PI * 0.74;
  const limbs = joint('arc_branches', bow, 0, 0, -R * 0.55);
  // Arc principal : un tore partiel tourné pour que sa courbe pointe vers l'avant (+Z)
  limbs.add(at(torus(R, 0.035, 5, 18, C.leather, ARC), 0, 0, 0, 0, -Math.PI / 2, -ARC / 2));
  limbs.add(at(torus(R + 0.04, 0.018, 5, 18, C.fire, ARC), 0, 0, 0, 0, -Math.PI / 2, -ARC / 2));
  // Flammes et anneaux le long de l'arc
  for (let i = 0; i < 9; i++) {
    const a = -ARC / 2 + (i / 8) * ARC;
    const y = Math.sin(a) * (R + 0.07), z = Math.cos(a) * (R + 0.07);
    // Flamme orientée vers l'extérieur de la courbe
    limbs.add(at(cone(0.03, 0.1 + (i % 2) * 0.06, 4, i % 2 ? C.fire : C.fireHot), 0, y, z, Math.atan2(Math.cos(a), Math.sin(a))));
  }
  for (const k of [-1, 1]) limbs.add(at(torus(0.05, 0.015, 6, 10, C.gold), 0, Math.sin(k * 0.35) * R, Math.cos(k * 0.35) * R, 0, 0, 0));
  // Poignée + cristal
  bow.add(at(cyl(0.045, 0.045, 0.2, 6, C.leatherLight), 0, 0, R * 0.45));
  bow.add(at(torus(0.05, 0.014, 6, 10, C.gold), 0, 0.08, R * 0.45, Math.PI / 2));
  bow.add(at(torus(0.05, 0.014, 6, 10, C.gold), 0, -0.08, R * 0.45, Math.PI / 2));
  const bowGem = crystal(0.05, 0.14, C.fireHot, 4);
  at(bowGem, 0, 0, R * 0.45 + 0.06, Math.PI / 2);
  bow.add(bowGem);
  // Extrémités en flammes
  const tipY = Math.sin(ARC / 2) * R, tipZ = Math.cos(ARC / 2) * R - R * 0.55;
  for (const k of [-1, 1]) bow.add(at(cone(0.05, 0.18, 4, C.fireHot), 0, k * (tipY + 0.06), tipZ, k > 0 ? 0 : Math.PI));
  // Corde : deux segments reliés à l'encoche (mis à jour à chaque image)
  const strMat = mat(0xff8c2a, 0.5);
  const strTop = cyl(0.016, 0.016, 1, 4, strMat, 'corde_haut');
  const strBot = cyl(0.016, 0.016, 1, 4, strMat, 'corde_bas');
  bow.add(strTop, strBot);
  const nockRestZ = tipZ;
  function setString(pull) {
    const nz = nockRestZ - pull * 0.45;
    for (const [seg, ty] of [[strTop, tipY], [strBot, -tipY]]) {
      // Le cylindre (axe Y) est tourné autour de X pour relier l'encoche à l'extrémité
      const dy = ty, dz = tipZ - nz;
      seg.scale.set(1, Math.hypot(dy, dz), 1);
      seg.position.set(0, ty / 2, (tipZ + nz) / 2);
      seg.rotation.set(Math.atan2(dz, dy), 0, 0);
    }
    return nz;
  }
  // Flèche encochée (visible pendant l'Ability)
  const arrow = joint('fleche', bow, 0, 0, 0);
  function makeArrow(parent) {
    const a = joint('fleche_mesh', parent);
    a.add(at(cyl(0.012, 0.012, 0.8, 4, C.leather), 0, 0, 0.4, Math.PI / 2));
    a.add(at(cone(0.04, 0.12, 4, C.fireHot), 0, 0, 0.84, Math.PI / 2));
    for (const r of [0, Math.PI / 2]) a.add(at(box(0.004, 0.07, 0.12, C.crimson), 0, 0, 0.05, 0, 0, r));
    for (let k = 0; k < 3; k++) a.add(at(cone(0.025, 0.1, 4, k % 2 ? C.fire : C.fireHot), 0, 0.03 * (k - 1), 0.74 - k * 0.04, -Math.PI / 2 + 0.4 * (k - 1)));
    return a;
  }
  makeArrow(arrow);
  arrow.visible = false;

  /* ---------- Cristaux de feu en orbite ---------- */
  const orbit = joint('cristaux_orbite', root, 0, 1.5, 0);
  const crystals = [];
  for (let i = 0; i < 6; i++) {
    const g = joint('cristal_' + i, orbit);
    const c = crystal(0.07 + (i % 2) * 0.03, 0.3 + (i % 3) * 0.08, i % 2 ? C.fire : C.fireHot, 4);
    g.add(c);
    if (i % 2 === 0) g.add(at(torus(0.1, 0.012, 6, 14, C.gold), 0, 0, 0, Math.PI / 2));
    crystals.push({ g, c, a: (i / 6) * TAU, r: 0.95 + (i % 2) * 0.18, h: (i % 3 - 1) * 0.35 });
  }

  /* ---------- Braises qui montent (effet, non exporté) ---------- */
  const embers = [];
  for (let i = 0; i < 28; i++) {
    const e = box(0.035, 0.035, 0.035, i % 3 ? C.fire : C.fireHot);
    e.castShadow = false;
    fx.add(e);
    embers.push({ m: e, life: Math.random() * 2, x: 0, z: 0, y: 0, vx: 0, vz: 0 });
  }
  function resetEmber(p) {
    const a = Math.random() * TAU, r = 0.3 + Math.random() * 0.9;
    p.x = Math.cos(a) * r; p.z = Math.sin(a) * r; p.y = Math.random() * 0.4;
    p.vx = (Math.random() - 0.5) * 0.1; p.vz = (Math.random() - 0.5) * 0.1; p.life = 1.4 + Math.random() * 1.2;
  }
  embers.forEach(resetEmber);

  /* ---------- Projectiles et traînées de l'Ability ---------- */
  const shots = [];
  const trail = [];
  const trailGeo = new THREE.BoxGeometry(0.11, 0.11, 0.11);
  function spawnTrail(pos, scale) {
    const m = new THREE.Mesh(trailGeo, Math.random() < 0.5 ? C.fire : C.fireHot);
    m.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 0.08, (Math.random() - 0.5) * 0.08, (Math.random() - 0.5) * 0.08));
    m.rotation.set(Math.random() * 3, Math.random() * 3, 0);
    m.scale.setScalar(scale);
    fx.add(m);
    trail.push({ m, life: 0.65, max: 0.65, s: scale });
  }
  function spawnImpact(pos) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.04, 6, 24), C.fireHot);
    ring.position.copy(pos); ring.rotation.x = Math.PI / 2;
    fx.add(ring);
    trail.push({ m: ring, life: 0.6, max: 0.6, ring: true });
    for (let i = 0; i < 10; i++) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.25, 4), i % 2 ? C.fire : C.fireHot);
      f.position.copy(pos);
      const a = (i / 10) * TAU;
      f.userData.v = new THREE.Vector3(Math.cos(a) * 2, 1.5 + Math.random(), Math.sin(a) * 2);
      fx.add(f);
      trail.push({ m: f, life: 0.6, max: 0.6, spark: true, s: 1 });
    }
  }
  function fire() {
    const a = joint('fleche_tiree', fx);
    makeArrow(a);
    arrow.updateWorldMatrix(true, false);
    arrow.getWorldPosition(a.position);
    const q = new THREE.Quaternion();
    arrow.getWorldQuaternion(q);
    a.quaternion.copy(q);
    const dir = new THREE.Vector3(0, 0, 1).applyQuaternion(q).normalize();
    shots.push({ g: a, dir, life: 0.75 });
  }

  /* ---------- Animation ---------- */
  let lastCycle = -1;
  const tmp = new THREE.Vector3();
  function update(mode, t, dt) {
    const still = mode === 'still';
    // Remise à zéro des articulations
    for (const j of [hips, torso, head, armL.shoulder, armL.elbow, armR.shoulder, armR.elbow, legL.hip, legL.knee, legR.hip, legR.knee, bowHold])
      j.rotation.set(0, 0, 0);
    hips.position.y = 1.05;
    torso.scale.set(1, 1, 1);
    arrow.visible = false;
    let pull = 0;
    let shoot = false;

    // Bras gauche (arc) légèrement en avant, bras droit détendu
    armL.shoulder.rotation.set(-0.25, 0, 0.12);
    armL.elbow.rotation.x = -0.35;
    armR.shoulder.rotation.set(0.1, 0, -0.12);
    armR.elbow.rotation.x = -0.25;

    if (mode === 'idle') {
      const b = Math.sin(t * 2);
      torso.scale.y = 1 + b * 0.025;          // respiration
      hips.position.y = 1.05 + b * 0.015;
      head.rotation.y = Math.sin(t * 0.7) * 0.18;
      head.rotation.x = Math.sin(t * 1.3) * 0.04;
      armR.shoulder.rotation.x = 0.1 + Math.sin(t * 2) * 0.05;
      armL.shoulder.rotation.z = 0.12 + Math.sin(t * 2 + 1) * 0.03;
    } else if (mode === 'move') {
      const w = t * 7;
      const sw = Math.sin(w);
      legL.hip.rotation.x = sw * 0.6;
      legR.hip.rotation.x = -sw * 0.6;
      legL.knee.rotation.x = Math.max(0, -Math.cos(w)) * 0.9;
      legR.knee.rotation.x = Math.max(0, Math.cos(w)) * 0.9;
      armR.shoulder.rotation.x = sw * 0.55;
      armL.shoulder.rotation.x = -0.25 - sw * 0.35;
      hips.position.y = 1.05 + Math.abs(Math.cos(w)) * 0.06 - 0.03;
      torso.rotation.y = sw * 0.12;
      torso.rotation.x = 0.08;
      head.rotation.y = -sw * 0.08;
    } else if (mode === 'ability') {
      // Cycle de 2,6 s : bander (0–0,9), tir, maintien, retour
      const T = 2.6, k = t % T, cycle = Math.floor(t / T);
      const raise = k < 0.35 ? ease(k / 0.35) : k < 1.6 ? 1 : 1 - ease(clamp01((k - 1.6) / 0.6));
      pull = k < 0.35 ? 0 : k < 0.9 ? ease((k - 0.35) / 0.55) : 0;
      // Torse de profil, bras gauche tendu vers l'avant, bras droit qui tire la corde
      hips.rotation.y = -0.9 * raise;
      head.rotation.y = 0.9 * raise;
      torso.rotation.x = -0.05 * raise;
      armL.shoulder.rotation.set(lerp(-0.25, -1.55, raise), 0, lerp(0.12, 0, raise));
      armL.elbow.rotation.x = lerp(-0.35, 0, raise);
      armR.shoulder.rotation.set(lerp(0.1, -1.5, raise), lerp(0, -0.55, raise), lerp(-0.12, -0.25, raise));
      armR.elbow.rotation.x = lerp(-0.25, -2.0 + pull * -0.35, raise);
      legL.hip.rotation.x = -0.25 * raise;
      legR.hip.rotation.x = 0.25 * raise;
      arrow.visible = raise > 0.6 && k < 0.9;
      if (cycle !== lastCycle && k >= 0.9) { lastCycle = cycle; shoot = true; }
    }
    // L'arc reste vertical : on compense l'angle du bras gauche
    bowHold.rotation.x = -(armL.shoulder.rotation.x + armL.elbow.rotation.x);
    const nz = setString(pull);
    arrow.position.set(0, 0, nz);
    // Tir après la remise à la verticale de l'arc, pour partir dans le bon axe
    if (shoot) fire();

    // Cape qui ondule
    capes.forEach((c, i) => {
      c.rotation.x = still ? 0.05 : 0.08 + Math.sin(t * 2.4 - i * 0.8) * (mode === 'move' ? 0.25 : 0.08) + (mode === 'move' ? 0.35 : 0);
    });
    if (still) {
      for (const p of embers) p.m.visible = false;
      return;
    }

    // Aura, runes, cristaux en orbite
    runeRing.rotation.z = t * 0.4;
    flameRing.rotation.z = -t * 0.25;
    flameRing.children.forEach((f, i) => { f.scale.y = 1 + Math.sin(t * 6 + i) * 0.25; });
    crown.children.forEach((f, i) => { f.scale.y = 1 + Math.sin(t * 8 + i * 1.7) * 0.3; });
    emblem.rotation.y = t * 1.5;
    bowGem.rotation.z = t * 2;
    crystals.forEach((c, i) => {
      const a = c.a + t * 0.6;
      c.g.position.set(Math.cos(a) * c.r, c.h + Math.sin(t * 1.6 + i) * 0.12, Math.sin(a) * c.r);
      c.c.rotation.y = t * 1.8 + i;
      c.g.rotation.z = Math.sin(t + i) * 0.2;
    });

    // Braises
    for (const p of embers) {
      p.m.visible = true;
      p.life -= dt;
      if (p.life <= 0) resetEmber(p);
      p.y += dt * 0.7; p.x += p.vx * dt; p.z += p.vz * dt;
      p.m.position.set(root.position.x + p.x, root.position.y + p.y, root.position.z + p.z);
      p.m.rotation.x += dt * 2;
      p.m.scale.setScalar(Math.min(1, p.life));
    }

    // Flèches tirées et traînées de flammes
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i];
      s.life -= dt;
      s.g.position.addScaledVector(s.dir, dt * 4.5);
      tmp.copy(s.g.position);
      spawnTrail(tmp, 1.5);
      spawnTrail(tmp.addScaledVector(s.dir, -0.12), 1.1);
      spawnTrail(tmp.addScaledVector(s.dir, -0.12), 0.8);
      if (s.life <= 0) {
        spawnImpact(s.g.position.clone().addScaledVector(s.dir, 0.8));
        fx.remove(s.g);
        shots.splice(i, 1);
      }
    }
    for (let i = trail.length - 1; i >= 0; i--) {
      const p = trail[i];
      p.life -= dt;
      const k = p.life / p.max;
      if (p.ring) p.m.scale.setScalar(1 + (1 - k) * 6);
      else if (p.spark) { p.m.position.addScaledVector(p.m.userData.v, dt); p.m.userData.v.y -= 6 * dt; p.m.scale.setScalar(k); }
      else { p.m.scale.setScalar(p.s * k); p.m.position.y += dt * 0.6; }
      if (p.life <= 0) { fx.remove(p.m); trail.splice(i, 1); }
    }
  }

  return { root, fx, update };
}
