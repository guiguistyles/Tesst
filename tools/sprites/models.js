'use strict';
// Modèles de ZaapSurvie dessinés avec Rig. Chaque modèle reçoit t ∈ [0, 1[ (avancement du cycle).
// Formats des planches calqués sur ceux de ZaapRush (taille de case, nombre d'images, ancrage),
// mais dessins originaux.

const MODELS = (() => {
  const { P, add, S, L, Poly, Curve, Blob } = Rig;
  const TAU = Math.PI * 2;

  // Points répartis régulièrement sur un ellipsoïde (spirale de Fibonacci).
  function cloud(n, rf, rs, rz) {
    const pts = [], g = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) {
      const z = 1 - (2 * (i + 0.5)) / n, r = Math.sqrt(1 - z * z), a = i * g;
      pts.push(P(Math.cos(a) * r * rf, Math.sin(a) * r * rs, z * rz));
    }
    return pts;
  }

  // ---------------------------------------------------------------- Bouftou
  const WOOL = '#f2e6c6', WOOL_LINE = '#9c825a', FACE = '#5a7090', HORN = '#6d7f9c', HOOF = '#2b3446';
  // Pseudo-aléatoire stable pour varier la taille des boucles.
  const jitter = (i) => { const x = Math.sin(i * 12.9898) * 43758.5453; return x - Math.floor(x); };
  const WOOL_PTS = cloud(34, 18, 14, 11);
  const WOOL_R = WOOL_PTS.map((q, i) => 7 + jitter(i) * 2.6);
  const TUFT_PTS = [P(-1, 0, 11), P(-3, -4.5, 9.5), P(-3, 4.5, 9.5), P(1.5, -2.5, 10), P(1.5, 2.5, 10)];
  const TUFT_R = [5, 4.2, 4.2, 3.6, 3.6];

  function bouftou(t) {
    const ph = t * TAU;
    const bob = 1.4 + 1.4 * Math.cos(2 * ph);
    const pitch = Math.sin(2 * ph) * 0.8;
    const out = [];
    const body = P(-2, 0, 22 + bob);
    // pattes : trot en diagonale
    for (const [f, s, k] of [[8, 7, 0], [-10, -7, 0], [8, -7, 1], [-10, 7, 1]]) {
      const a = ph + k * Math.PI;
      const swing = 5 * Math.sin(a), lift = Math.max(0, Math.cos(a)) * 4;
      const hip = P(f, s, 13 + bob), foot = P(f + swing, s, 2.5 + lift);
      out.push(L(hip, foot, 5.5, FACE, { bias: -100 })); // toujours sous la laine
      out.push(S(foot, 3.2, HOOF, { line: 1, bias: -99 }));
    }
    // corps en laine (un seul nuage) et queue
    out.push(Blob(
      [...WOOL_PTS.map((q) => add(body, add(q, P(0, 0, q.f * pitch * 0.05)))), add(body, P(-19, 0, 4))],
      [...WOOL_R, 5.5], WOOL, { lineColor: WOOL_LINE }));
    // tête
    const head = P(18, 0, 22 + bob + pitch);
    out.push(S(head, 11.5, FACE));
    out.push(S(add(head, P(8, 0, -4.5)), 6.5, Rig.light(FACE, 0.18), { bias: 0.5 })); // museau
    for (const s of [-1, 1]) {
      out.push(S(add(head, P(8, s * 5.4, 2.5)), 3.9, '#ffffff', { line: 1, lineColor: '#22293a', hi: 0.05, bias: 1 }));
      out.push(S(add(head, P(11.2, s * 5.1, 2.3)), 2.1, '#14181f', { line: 0, bias: 2 }));
      out.push(S(add(head, P(10.4, s * 5.8, 3.6)), 0.8, '#ffffff', { line: 0, bias: 3 })); // reflet
      out.push(S(add(head, P(14.3, s * 2, -5)), 0.9, '#2b3446', { line: 0, bias: 2 })); // narines
      // cornes enroulées vers le bas, sur les côtés du crâne
      for (let k = 0; k < 9; k++) {
        const a = k / 8, ang = a * 1.6 * Math.PI, rho = 6 * (1 - a * 0.5);
        out.push(S(add(head, P(-5 + rho * Math.sin(ang), s * (10 + a * 2.5), 4 + rho * Math.cos(ang))), 3.1 * (1 - a * 0.4), HORN, { line: 1, lineColor: '#2b3446' }));
      }
    }
    // mèche de laine sur le front
    out.push(Blob(TUFT_PTS.map((q) => add(head, q)), TUFT_R, WOOL, { lineColor: WOOL_LINE, bias: 1 }));
    return out;
  }

  // ---------------------------------------------------------------- Crâ
  const TUNIC = '#3f8f4e', HOOD = '#367f45', CAPE = '#2b6638', PANTS = '#2f4a35', BOOT = '#6b4528';
  const SKIN = '#f3d1a8', TRIM = '#e8d9a0', WOOD = '#8a5a2a', LEATHER = '#7a4b2a';

  // Jambe : angle de balancier a (vers l'avant), flexion du genou b.
  function leg(out, hip, a, b) {
    const knee = add(hip, P(12 * Math.sin(a), 0, -12 * Math.cos(a)));
    const foot = add(knee, P(12 * Math.sin(a - b), 0, -12 * Math.cos(a - b)));
    if (foot.z < 1.5) foot.z = 1.5;
    out.push(L(hip, knee, 6.5, PANTS));
    out.push(L(knee, foot, 6, BOOT));
    out.push(L(foot, add(foot, P(3.5, 0, -0.5)), 5, BOOT));
  }

  // Bras : épaule, angle a, flexion du coude b ; renvoie la main.
  function arm(out, sh, a, b, side) {
    const el = add(sh, P(9 * Math.sin(a), side * 1.5, -9 * Math.cos(a)));
    const hand = add(el, P(8 * Math.sin(a + b), side * 0.5, -8 * Math.cos(a + b)));
    out.push(L(sh, el, 5.5, TUNIC));
    out.push(L(el, hand, 5, TUNIC));
    out.push(S(hand, 2.9, SKIN, { line: 1 }));
    return hand;
  }

  function bow(out, hand, lean) {
    const pts = [], str = [];
    for (let k = -6; k <= 6; k++) {
      const u = k / 6;
      pts.push(add(hand, P(4.5 * (1 - u * u) + lean * u, -0.8, u * 15)));
    }
    str.push(pts[0], add(hand, P(-0.5, -0.8, 0)), pts[pts.length - 1]);
    out.push(Curve(pts, 2.6, WOOD, { line: 1, bias: 0.3 }));
    out.push(Curve(str, 0.8, '#f0e6c8', { line: 0, bias: 0.2 }));
  }

  function craBody(out, o) {
    const { bob, lean, breathe, armL, armR, capeSway } = o;
    const pelvis = P(lean * 0.3, 0, 26 + bob), chest = P(1 + lean, 0, 40 + bob + breathe);
    // cape et carquois dans le dos
    out.push(Poly([add(chest, P(-4, -7, 3)), add(chest, P(-4, 7, 3)), add(pelvis, P(-7 - capeSway, 9, -6)), add(pelvis, P(-7 - capeSway, -9, -6))], CAPE, { bias: -1.5 }));
    out.push(L(add(pelvis, P(-7, 2.5, 11)), add(chest, P(-8.5, -2.5, 10)), 5, LEATHER, { bias: -2 }));
    out.push(S(add(chest, P(-9, -3, 13)), 1.9, '#d64545', { line: 1, bias: -2 }));
    out.push(S(add(chest, P(-8, -1.4, 13.6)), 1.9, '#fafafa', { line: 1, bias: -2 }));
    out.push(S(add(chest, P(-9.8, -4.4, 12.2)), 1.9, '#d64545', { line: 1, bias: -2 }));
    // torse
    out.push(S(add(pelvis, P(0, 0, 1)), 8.5, TUNIC));
    out.push(L(pelvis, chest, 15, TUNIC));
    out.push(S(add(pelvis, P(5.6, 0, 3.5)), 2.3, TRIM, { line: 1, bias: 1 })); // boucle de ceinture
    // bras (gauche = côté arc)
    const shL = add(chest, P(0, -8.5, 1)), shR = add(chest, P(0, 8.5, 1));
    const handL = arm(out, shL, armL[0], armL[1], -1);
    arm(out, shR, armR[0], armR[1], 1);
    bow(out, handL, armL[2] || 0);
    // tête et capuche
    const head = add(chest, P(1, 0, 15));
    // capuche : une seule silhouette, pointe rabattue vers l'arrière
    out.push(Blob(
      [P(-4, 0, 2.5), P(-9, 0, 10), P(-12.5, 0, 12.5), P(-15, 0, 13), P(-17, 0, 12.5)].map((q) => add(head, q)),
      [11.5, 6, 4.2, 3, 2.2], HOOD, { lineColor: Rig.dark(HOOD, 0.55), line: 1.2 }));
    out.push(S(add(head, P(5, 0, -0.5)), 8, SKIN, { bias: 7 })); // visage
    out.push(Blob([P(9, -3, 5), P(10, 0, 5.8), P(9, 3, 5)].map((q) => add(head, q)), [3, 3.2, 3], '#c9783a', { line: 1, bias: 7.5 })); // mèche
    for (const s of [-1, 1]) {
      out.push(L(add(head, P(-1, s * 8.5, 0)), add(head, P(-3.5, s * 13.5, 4)), 2.6, SKIN)); // oreilles pointues
      out.push(S(add(head, P(11.3, s * 3.4, 0.5)), 1.8, '#1e1a16', { line: 0, bias: 8 }));
      out.push(S(add(head, P(11.8, s * 3.6, 1.4)), 0.6, '#ffffff', { line: 0, bias: 9 }));
    }
    out.push(Curve([add(head, P(12, -1.6, -3.4)), add(head, P(12.6, 0, -3.8)), add(head, P(12, 1.6, -3.4))], 0.9, '#9a5a40', { line: 0, bias: 8 }));
  }

  function craRun(t) {
    const ph = t * TAU, out = [];
    const bob = 2.2 * Math.abs(Math.sin(ph));
    for (const [s, k] of [[-4.5, 0], [4.5, 1]]) {
      const a = ph + k * Math.PI;
      leg(out, P(0, s, 25 + bob), 0.75 * Math.sin(a), 0.25 + 1.0 * Math.max(0, Math.cos(a)));
    }
    const sw = 0.6 * Math.sin(ph);
    craBody(out, {
      bob, lean: 3, breathe: 0, capeSway: 2.5 + 2 * Math.abs(Math.cos(ph)),
      armL: [0.9 + sw * 0.4, 0.5, -1.5], // bras de l'arc tenu vers l'avant
      armR: [-sw, 0.9],
    });
    return out;
  }

  function craIdle(t) {
    const ph = t * TAU, out = [];
    const breathe = 0.7 * Math.sin(ph);
    for (const s of [-4.5, 4.5]) leg(out, P(0, s, 25), 0.02 * Math.sign(s), 0.05);
    craBody(out, {
      bob: -0.4 + 0.4 * Math.sin(ph), lean: 0, breathe, capeSway: 0.6 * Math.sin(ph + 1),
      armL: [0.25, 0.25, 0],
      armR: [-0.08 + 0.05 * Math.sin(ph), 0.3],
    });
    return out;
  }

  return {
    bouftou:  { frameW: 95, frameH: 75, frames: 18, fps: 24, anchorX: 0.5, anchorY: 0.86, model: bouftou },
    cra_run:  { frameW: 78, frameH: 92, frames: 30, fps: 40, anchorX: 0.5, anchorY: 0.88, model: craRun },
    cra_idle: { frameW: 41, frameH: 88, frames: 21, fps: 20, anchorX: 0.5122, anchorY: 0.9091, model: craIdle },
  };
})();
