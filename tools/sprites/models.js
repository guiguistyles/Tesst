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
  // Pseudo-aléatoire stable pour varier la taille des boucles.
  const jitter = (i) => { const x = Math.sin(i * 12.9898) * 43758.5453; return x - Math.floor(x); };
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const ease = (v) => v * v * (3 - 2 * v);
  // Attaque générique en 3 temps : armer (recul), frapper (élan), revenir. Renvoie -1..1.
  function lunge(t) {
    if (t < 0.35) return -ease(t / 0.35) * 0.45;
    if (t < 0.55) return -0.45 + ease((t - 0.35) / 0.2) * 1.45;
    return 1 - ease((t - 0.55) / 0.45);
  }

  // ---------------------------------------------------------------- Bouftou
  const BOUFTOU = { wool: '#f2e6c6', woolLine: '#9c825a', face: '#5a7090', horn: '#6d7f9c', hoof: '#2b3446' };
  const ROYAL = { wool: '#fffaf0', woolLine: '#b39a6a', face: '#5a3a24', horn: '#d9a82e', hoof: '#2a1a10' };
  const WOOL_PTS = cloud(34, 18, 14, 11);
  const WOOL_R = WOOL_PTS.map((q, i) => 7 + jitter(i) * 2.6);
  const TUFT_PTS = [P(-1, 0, 11), P(-3, -4.5, 9.5), P(-3, 4.5, 9.5), P(1.5, -2.5, 10), P(1.5, 2.5, 10)];
  const TUFT_R = [5, 4.2, 4.2, 3.6, 3.6];

  // o.pal : couleurs, o.attack : t est alors l'avancement du coup de tête.
  // o.pal : couleurs, o.attack : t est alors l'avancement du coup de tête,
  // o.horns (défaut vrai), o.eye : taille des yeux, o.collar : couleur d'un collier.
  function bouftouModel(t, o) {
    const C = o.pal, ph = t * TAU, out = [], eye = o.eye || 1;
    let bob = 1.4 + 1.4 * Math.cos(2 * ph), pitch = Math.sin(2 * ph) * 0.8, push = 0, gait = 1;
    // la toison s'écrase quand elle retombe et s'étire en remontant ; la tête suit avec un léger retard
    let squash = 0.07 * Math.cos(2 * ph), lag = Math.cos(2 * ph - 0.9) * 1.2;
    if (o.attack) { const l = lunge(t); push = l * 9; pitch = -l * 4; bob = 1 + Math.max(0, -l) * 3; gait = 0.25; squash = -0.08 * l; lag = -l * 1.5; }
    const body = P(-2 + push * 0.6, 0, 22 + bob);
    // pattes : trot en diagonale
    for (const [f, s, k] of [[8, 7, 0], [-10, -7, 0], [8, -7, 1], [-10, 7, 1]]) {
      const a = ph + k * Math.PI;
      const swing = 5 * Math.sin(a) * gait, lift = Math.max(0, Math.cos(a)) * 4 * gait;
      const hip = P(f + push * 0.5, s, 13 + bob), foot = P(f + swing + push * 0.2, s, 2.5 + lift);
      out.push(L(hip, foot, 5.5, C.face, { bias: -100 })); // toujours sous la laine
      out.push(S(foot, 3.2, C.hoof, { line: 1, bias: -99 }));
    }
    // corps en laine (un seul nuage) et queue qui remue
    const wool = WOOL_PTS.map((q) => add(body, P(q.f * (1 - squash * 0.5), q.s * (1 - squash * 0.5), q.z * (1 + squash) + q.f * pitch * 0.05)));
    out.push(Blob([...wool, add(body, P(-19, 2.5 * Math.sin(2 * ph), 4 + lag * 0.6))], [...WOOL_R, 5.5], C.wool, { lineColor: C.woolLine }));
    // tête
    const head = P(18 + push, 0, 22 + bob + pitch + lag * 0.5);
    out.push(S(head, 11.5, C.face));
    out.push(S(add(head, P(8, 0, -4.5)), 6.5, Rig.light(C.face, 0.18), { bias: 0.5 })); // museau
    for (const s of [-1, 1]) {
      out.push(S(add(head, P(8, s * 5.4, 2.5)), 3.9 * eye, '#ffffff', { line: 1, lineColor: '#22293a', hi: 0, bias: 1 }));
      out.push(S(add(head, P(8 + 3.2 * eye, s * 5.1, 2.3)), 2.1 * eye, '#14181f', { line: 0, bias: 2 }));
      out.push(S(add(head, P(8 + 2.4 * eye, s * 5.8, 3.6)), 0.8 * eye, '#ffffff', { line: 0, bias: 3 })); // reflet
      out.push(S(add(head, P(14.3, s * 2, -5)), 0.9, Rig.dark(C.face, 0.5), { line: 0, bias: 2 })); // narines
      if (o.horns !== false) {
        // cornes enroulées vers le bas, sur les côtés du crâne
        for (let k = 0; k < 9; k++) {
          const a = k / 8, ang = a * 1.6 * Math.PI, rho = 6 * (1 - a * 0.5);
          out.push(S(add(head, P(-5 + rho * Math.sin(ang), s * (10 + a * 2.5), 4 + rho * Math.cos(ang))), 3.1 * (1 - a * 0.4), C.horn, { line: 1, lineColor: Rig.dark(C.horn, 0.5) }));
        }
      } else out.push(S(add(head, P(-4, s * 8.5, 7)), 2.4, C.horn, { line: 1 })); // petites bosses
    }
    if (o.collar) {
      // collier : moitié avant devant le cou, moitié arrière derrière
      for (const front of [false, true]) {
        const pts = [];
        for (let k = 0; k <= 12; k++) { const a = (front ? -0.5 : 0.5) * Math.PI + (k / 12) * Math.PI; pts.push(add(head, P(-6 + Math.cos(a) * 9, Math.sin(a) * 9, -7))); }
        out.push(Curve(pts, 2.6, o.collar, front ? { line: 1, bias: 3, normal: { f: 1, s: 0 }, minFacing: -0.9 } : { line: 1, bias: -0.5 }));
      }
      out.push(S(add(head, P(3, 0, -10)), 2.6, o.collar, { line: 1, bias: 3.5, normal: { f: 1, s: 0 } })); // grelot
    }
    // mèche de laine sur le front, qui rebondit
    out.push(Blob(TUFT_PTS.map((q) => add(head, add(q, P(0, 0, lag * 0.8)))), TUFT_R, C.wool, { lineColor: C.woolLine, bias: 1 }));
    return out;
  }
  const BOUFTON_NOIR = { wool: '#55555f', woolLine: '#22222a', face: '#c9b49a', horn: '#9a8a74', hoof: '#2a2a30' };
  const bouftou = (t) => bouftouModel(t, { pal: BOUFTOU });
  const bouftouAttack = (t) => bouftouModel(t, { pal: BOUFTOU, attack: true });
  const royal = (t) => Rig.scale(bouftouModel(t, { pal: ROYAL, collar: '#e8b830' }), 1.75);
  const royalAttack = (t) => Rig.scale(bouftouModel(t, { pal: ROYAL, collar: '#e8b830', attack: true }), 1.75);
  const boufton = (t) => Rig.scale(bouftouModel(t, { pal: BOUFTON_NOIR, horns: false, eye: 1.2 }), 0.8);
  const bouftonAttack = (t) => Rig.scale(bouftouModel(t, { pal: BOUFTON_NOIR, horns: false, eye: 1.2, attack: true }), 0.8);

  // ---------------------------------------------------------------- Tofu, Piou
  const TOFU = { body: '#ffd23f', belly: '#fff3b0', beak: '#f08a1f', tuft: '#f08a1f', wing: '#f2b51f' };
  const PIOU = { body: '#ff5b5b', belly: '#ffd0c8', beak: '#ffcc33', tuft: '#ffcc33', wing: '#e04444' };
  const TOFU_ROYAL = { body: '#ffbf1f', belly: '#fff0a0', beak: '#d0601a', tuft: '#d0601a', wing: '#e8a010' };

  // Petit oiseau rond : sautille en marchant, picore en attaquant.
  function birdModel(t, o) {
    const C = o.pal, out = [];
    let hop = 7 * Math.abs(Math.sin(Math.PI * t)), squash = 1 - 0.12 * Math.max(0, Math.cos(TAU * t)), push = 0, tilt = 0;
    let flap = Math.sin(TAU * t * 2);
    if (o.attack) { const l = lunge(t); push = l * 10; tilt = Math.max(0, l) * 5; hop = Math.max(0, -l) * 3; squash = 1; flap = Math.sin(TAU * t * 4); }
    // étirement en l'air, écrasement à l'atterrissage ; houppette et queue suivent avec retard
    const stretch = o.attack ? 0 : 0.08 * Math.sin(Math.PI * t) - 0.06 * Math.max(0, Math.cos(TAU * t)), lag = o.attack ? -push * 0.2 : -Math.cos(TAU * t) * 1.5;
    const c = P(push, 0, 13 * squash + hop);
    out.push(S(c, 12 * (1 + stretch * 0.3), C.body));
    out.push(S(add(c, P(5.5, 0, -2.5)), 7.5, C.belly, { line: 0, bias: 0.5 })); // ventre
    for (const s of [-1, 1]) {
      // ailes
      out.push(L(add(c, P(-1, s * 9.5, 2)), add(c, P(-6, s * (14 + Math.abs(flap) * 2), 3 + flap * 6)), 6, C.wing));
      // yeux
      out.push(S(add(c, P(8.2, s * 4.4, 4 - tilt * 0.4)), 3.6, '#ffffff', { line: 1, lineColor: '#3a2a10', hi: 0.05, bias: 1 }));
      out.push(S(add(c, P(10.8, s * 4.2, 4 - tilt * 0.4)), 1.9, '#14181f', { line: 0, bias: 2 }));
      out.push(S(add(c, P(10.3, s * 4.8, 5.2 - tilt * 0.4)), 0.7, '#ffffff', { line: 0, bias: 3 }));
      // petits pieds
      out.push(S(P(3 + push * 0.6, s * 4.5, 1.6), 2.4, C.beak, { line: 1, bias: -60 }));
    }
    // bec : petite pointe ronde
    out.push(S(add(c, P(11.6, 0, -0.5 - tilt * 0.6)), 3.4, C.beak, { line: 1, bias: 2 }));
    out.push(S(add(c, P(14.4, 0, -1 - tilt)), 2.1, C.beak, { line: 1, bias: 2.5 }));
    // houppette et queue
    out.push(S(add(c, P(-1 + lag * 0.4, 0, 13 + lag)), 3.4, C.tuft));
    out.push(S(add(c, P(-4 + lag * 0.5, -2.4, 12 + lag * 0.8)), 2.6, C.tuft));
    out.push(S(add(c, P(-4 + lag * 0.5, 2.4, 12 + lag * 0.8)), 2.6, C.tuft));
    out.push(S(add(c, P(-12.5, 0, 3 - lag * 0.6)), 3.2, C.tuft));
    out.push(S(add(c, P(-14.5, 0, 6 - lag)), 2.4, C.tuft));
    return out;
  }
  const tofu = (t) => birdModel(t, { pal: TOFU });
  const tofuAttack = (t) => birdModel(t, { pal: TOFU, attack: true });
  const piou = (t) => Rig.scale(birdModel(t, { pal: PIOU }), 0.78);
  const piouAttack = (t) => Rig.scale(birdModel(t, { pal: PIOU, attack: true }), 0.78);
  const tofuRoyal = (t) => Rig.scale(birdModel(t, { pal: TOFU_ROYAL }), 3.1);

  // ---------------------------------------------------------------- Larve Bleue
  const LARVA = ['#4fa3ff', '#3a86e0'];
  function larvaModel(t, o) {
    const out = [], n = 5, R = [7.5, 7, 6.8, 6.2, 5.2];
    let rear = 0, strike = 0;
    if (o.attack) { const l = lunge(t); rear = Math.max(0, -l) * 22; strike = Math.max(0, l) * 9; }
    for (let i = 0; i < n; i++) {
      const w = TAU * t - i * 1.1;
      const lift = i === 0 ? rear : i === 1 ? rear * 0.45 : 0;
      const c = P(11 - i * 6.6 + (i < 2 ? strike : strike * 0.3), Math.sin(w) * 2.6 * (o.attack ? 0.3 : 1), R[i] + Math.max(0, Math.sin(w)) * 1.6 + lift);
      out.push(S(c, R[i], LARVA[i % 2]));
      if (i === 0) {
        for (const s of [-1, 1]) {
          out.push(S(add(c, P(5.2, s * 3.2, 2.5)), 2.5, '#ffffff', { line: 1, lineColor: '#123a6a', bias: 1 }));
          out.push(S(add(c, P(7, s * 3.1, 2.4)), 1.3, '#0b1420', { line: 0, bias: 2 }));
          out.push(S(add(c, P(7.4, s * 1.8, -2.4)), 1.4, '#1a2a4a', { bias: 1.5 })); // mandibules
          out.push(L(add(c, P(1, s * 2.6, 6)), add(c, P(-2, s * 5.5, 12)), 1.4, '#1a2a4a'));
          out.push(S(add(c, P(-2, s * 5.5, 12)), 1.6, '#ffd84a', { line: 1 }));
        }
      }
    }
    return out;
  }
  const larve = (t) => larvaModel(t, {});
  const larveAttack = (t) => larvaModel(t, { attack: true });

  // ---------------------------------------------------------------- Aventuriers (classes)
  const SKIN = '#f3d1a8', WOOD = '#8a5a2a', LEATHER = '#7a4b2a', STEEL = '#d8dde6';
  // Tenue de chaque classe : couleurs, coiffe (head), arme (weapon) et type d'attaque (atk).
  const LOOKS = {
    iop:      { tunic: '#d9482b', pants: '#4a3a5a', boot: '#3a2a1a', cape: '#a8301c', hair: '#ffcf5a', head: 'spikes', weapon: 'sword', atk: 'swing' },
    cra:      { tunic: '#3f8f4e', pants: '#2f4a35', boot: '#6b4528', cape: '#2b6638', hair: '#c9783a', hood: '#367f45', head: 'hood', weapon: 'bow', atk: 'shoot', quiver: true },
    feca:     { tunic: '#3a6fc4', pants: '#e8e2d0', boot: '#6b4528', cape: '#eef0f4', hair: '#7a4a2a', helm: '#c8d0e0', head: 'helm', weapon: 'staff', orb: '#7fc8ff', atk: 'cast' },
    eniripsa: { tunic: '#e07bb5', pants: '#fff4fa', boot: '#c05090', hair: '#ffe0f0', head: 'wings', weapon: 'wand', orb: '#ff9ad5', atk: 'cast' },
    sram:     { tunic: '#5b4a7a', pants: '#2a2238', boot: '#1a1424', cape: '#3a2e52', hood: '#3a2e52', mask: '#efe8dc', head: 'skull', weapon: 'dagger', atk: 'swing' },
    xelor:    { tunic: '#2d5a8c', pants: '#1e3a5c', boot: '#1a2a3a', cape: '#1e3a5c', wrap: '#e8dfc8', head: 'bandage', weapon: 'clock', orb: '#f0c94a', atk: 'cast' },
    osamodas: { tunic: '#4e9bb0', pants: '#3a3a5a', boot: '#5a3a24', cape: '#2f6f82', hair: '#2a2a3a', horn: '#f6d38a', head: 'horns', weapon: 'whip', atk: 'swing' },
    sacrieur: { tunic: '#2b2b2b', pants: '#4a1a1a', boot: '#1a1a1a', skin: '#c8484a', hair: '#1a1a1a', head: 'tattoo', weapon: 'fists', atk: 'swing' },
    enutrof:  { tunic: '#9a7a3a', pants: '#5a4a2a', boot: '#3a2a1a', hat: '#6a4a2a', beard: '#f2f2f2', head: 'beard', weapon: 'shovel', atk: 'swing' },
    roublard: { tunic: '#c27b2a', pants: '#3a2a1a', boot: '#2a1a10', hair: '#2a1a10', band: '#c03030', head: 'bandana', weapon: 'bomb', atk: 'cast' },
  };

  // Direction dans le plan avant/haut : w = 0 vers le bas, π/2 vers l'avant, π vers le haut.
  const dirv = (w, len) => P(Math.sin(w) * len, 0, -Math.cos(w) * len);

  // Jambe : angle de balancier a (vers l'avant), flexion du genou b.
  function leg(out, L_, hip, a, b) {
    const knee = add(hip, P(12 * Math.sin(a), 0, -12 * Math.cos(a)));
    const foot = add(knee, P(12 * Math.sin(a - b), 0, -12 * Math.cos(a - b)));
    if (foot.z < 1.5) foot.z = 1.5;
    out.push(L(hip, knee, 6.5, L_.pants));
    out.push(L(knee, foot, 6, L_.boot));
    out.push(L(foot, add(foot, P(3.5, 0, -0.5)), 5, L_.boot));
  }

  // Bras : épaule, angle a, flexion du coude b ; renvoie la main et l'angle de l'avant-bras.
  function arm(out, L_, sh, a, b, side) {
    const el = add(sh, P(9 * Math.sin(a), side * 1.5, -9 * Math.cos(a)));
    const hand = add(el, P(8 * Math.sin(a + b), side * 0.5, -8 * Math.cos(a + b)));
    out.push(L(sh, el, 5.5, L_.tunic));
    out.push(L(el, hand, 5, L_.tunic));
    out.push(S(hand, L_.weapon === 'fists' ? 3.8 : 2.9, L_.weapon === 'fists' ? '#e8e0d0' : (L_.skin || SKIN), { line: 1 }));
    return { hand, w: a + b };
  }

  // ------------------------------------------------ armes (tenues dans la main gauche)
  function weapon(out, L_, h, pose) {
    const { hand } = h, w = pose.weaponW ?? h.w + 1.9;
    switch (L_.weapon) {
      case 'sword': {
        out.push(L(add(hand, dirv(w, -3)), add(hand, dirv(w, 22)), 3.4, STEEL, { bias: 0.4 }));
        out.push(L(add(hand, P(0, -3.5, 0)), add(hand, P(0, 3.5, 0)), 2.6, '#e0b040', { bias: 0.5 }));
        break;
      }
      case 'dagger':
        out.push(L(add(hand, dirv(w, -1)), add(hand, dirv(w, 10)), 2.6, STEEL, { bias: 0.4 }));
        break;
      case 'bow': {
        const pts = [], str = [];
        for (let k = -6; k <= 6; k++) { const u = k / 6; pts.push(add(hand, P(4.5 * (1 - u * u) + (pose.bowLean || 0) * u, -0.8, u * 15))); }
        const pull = pose.pull || 0;
        str.push(pts[0], add(hand, P(-0.5 - pull, -0.8, 0)), pts[pts.length - 1]);
        out.push(Curve(pts, 2.6, WOOD, { line: 1, bias: 0.3 }));
        out.push(Curve(str, 0.8, '#f0e6c8', { line: 0, bias: 0.2 }));
        if (pose.arrow) out.push(L(add(hand, P(-0.5 - pull, -0.8, 0)), add(hand, P(9, -0.8, 0)), 1.4, '#e8d9a0', { bias: 0.6 }));
        break;
      }
      case 'staff': case 'clock': case 'wand': {
        const len = L_.weapon === 'wand' ? 11 : 24, ww = L_.weapon === 'wand' ? w : (pose.weaponW ?? Math.PI * 0.92);
        const tip = add(hand, dirv(ww, len));
        out.push(L(add(hand, dirv(ww, L_.weapon === 'wand' ? -2 : -12)), tip, L_.weapon === 'wand' ? 2 : 2.6, L_.weapon === 'wand' ? '#fff4fa' : WOOD, { bias: 0.3 }));
        if (L_.weapon === 'clock') {
          out.push(S(tip, 5.2, L_.orb, { bias: 0.6 }));
          out.push(S(add(tip, P(1.5, 0, 0)), 1.6, '#2d2010', { line: 0, bias: 1 }));
        } else out.push(S(tip, L_.weapon === 'wand' ? 3 : 3.8, L_.orb, { bias: 0.6, hi: 0.6 }));
        if (pose.glow) out.push(S(tip, 3 + pose.glow * 7, Rig.light(L_.orb, 0.5), { line: 0, bias: 2, hi: 0.8 }));
        break;
      }
      case 'whip': {
        const pts = [hand];
        for (let k = 1; k <= 8; k++) {
          const u = k / 8;
          pts.push(add(hand, add(dirv(w + (pose.crack || 0) * u, u * 24), P(0, 0, -u * u * 6 + Math.sin(u * 6 + (pose.wave || 0)) * 1.5))));
        }
        out.push(Curve(pts, 1.6, '#6b4528', { line: 1, bias: 0.3 }));
        break;
      }
      case 'shovel': {
        const tip = add(hand, dirv(w, 18));
        out.push(L(add(hand, dirv(w, -8)), tip, 2.4, WOOD, { bias: 0.3 }));
        out.push(L(tip, add(tip, dirv(w, 6)), 7, '#9aa4b0', { bias: 0.4 }));
        break;
      }
      case 'bomb': {
        const at = pose.bombAt || add(hand, P(1, 0, 2));
        if (pose.bombAt !== null) {
          out.push(S(at, 4.6, '#26262e', { bias: 0.6, hi: 0.5 }));
          out.push(L(add(at, P(-1, 0, 4)), add(at, P(-2.5, 0, 7)), 1.2, '#c8a060', { bias: 0.7 }));
          out.push(S(add(at, P(-2.5, 0, 7.5)), 1.4, '#ffd84a', { line: 0, bias: 0.8 }));
        }
        break;
      }
    }
  }

  // ------------------------------------------------ têtes
  // Recette commune : crâne, coiffe (cheveux / capuche / casque) dessinée derrière,
  // puis visage et yeux légèrement décalés vers l'avant pour rester visibles de profil.
  function face(out, L_, head, o = {}) {
    const front = { f: 1, s: 0 };
    out.push(S(add(head, P(5, 0, -0.5)), 8, o.faceCol || L_.skin || SKIN, { bias: 20, normal: front }));
    for (const s of [-1, 1]) {
      if (o.eyes === 'glow' && s < 0) continue;
      const col = o.eyes === 'glow' ? '#ffd84a' : o.eyes === 'socket' ? '#100c18' : '#1e1a16', n = { f: 0.75, s: s * 0.66 };
      out.push(S(add(head, P(11.3, s * 3.4, 0.5)), o.eyes === 'socket' ? 2.3 : 1.8, col, { line: 0, bias: 21, normal: n, minFacing: -0.05 }));
      if (!o.eyes) out.push(S(add(head, P(11.8, s * 3.6, 1.4)), 0.6, '#ffffff', { line: 0, bias: 22, normal: n, minFacing: -0.05 }));
    }
    if (!o.noMouth) out.push(Curve([add(head, P(12, -1.6, -3.4)), add(head, P(12.6, 0, -3.8)), add(head, P(12, 1.6, -3.4))], 0.9, '#9a5a40', { line: 0, bias: 21, normal: front }));
  }
  // éléments posés sur le visage (mèche, barbe, bandeau…) : visibles seulement de face ou de profil
  const onFace = (o = {}) => ({ line: 1, bias: 20.5, normal: { f: 1, s: 0 }, ...o });
  const cap = (out, head, col, extra = [], extraR = []) => out.push(Blob(
    [P(-4, 0, 2.5), ...extra].map((q) => add(head, q)), [11.5, ...extraR], col, { lineColor: Rig.dark(col, 0.55), line: 1.2 }));

  function headgear(out, L_, head) {
    switch (L_.head) {
      case 'hood':
        cap(out, head, L_.hood, [P(-9, 0, 10), P(-12.5, 0, 12.5), P(-15, 0, 13), P(-17, 0, 12.5)], [6, 4.2, 3, 2.2]);
        face(out, L_, head);
        out.push(Blob([P(9, -3, 5), P(10, 0, 5.8), P(9, 3, 5)].map((q) => add(head, q)), [3, 3.2, 3], L_.hair, onFace()));
        for (const s of [-1, 1]) out.push(L(add(head, P(-1, s * 8.5, 0)), add(head, P(-3.5, s * 13.5, 4)), 2.6, SKIN)); // oreilles pointues
        break;
      case 'spikes':
        cap(out, head, L_.hair);
        // mèches pointues effilées, dressées vers le haut et l'arrière
        for (const [f, s, z, len] of [[0.1, 0, 1, 12], [-0.6, 0.55, 0.6, 10], [-0.6, -0.55, 0.6, 10], [-1, 0, 0.45, 11], [0.35, 0.45, 0.8, 8], [0.35, -0.45, 0.8, 8]]) {
          const b = add(head, P(-3 + f * 8, s * 8, 6 + z * 6)), tip = add(b, P(f * len, s * len, z * len));
          out.push(Poly([add(b, P(-4, 0, 0)), add(b, P(0, -4, 0)), tip, add(b, P(0, 4, 0)), add(b, P(4, 0, 0))], L_.hair, { line: 1, bias: 0.5 }));
        }
        face(out, L_, head);
        out.push(Blob([P(8.5, -3.5, 5.5), P(9.5, 0, 6.5), P(8.5, 3.5, 5.5)].map((q) => add(head, q)), [3, 3.4, 3], L_.hair, onFace()));
        break;
      case 'helm':
        cap(out, head, L_.helm, [P(-2, 0, 6)], [10.5]);
        out.push(L(add(head, P(-10, 0, 9)), add(head, P(3, 0, 14)), 3.2, '#3a6fc4', { bias: 1 })); // crête
        face(out, L_, head);
        out.push(Curve([add(head, P(7.5, -8, 4.5)), add(head, P(10.5, 0, 6)), add(head, P(7.5, 8, 4.5))], 2.6, L_.helm, onFace()));
        break;
      case 'wings':
        cap(out, head, L_.hair, [P(-8, 0, -3)], [8]);
        for (const s of [-1, 1]) {
          out.push(L(add(head, P(-3, s * 9, 4)), add(head, P(-9, s * 16, 12)), 4.2, '#ffffff'));
          out.push(L(add(head, P(-3, s * 9, 2)), add(head, P(-11, s * 14, 6)), 3.4, '#ffffff'));
        }
        face(out, L_, head);
        out.push(Blob([P(9, -3.2, 5.2), P(10, 0, 6), P(9, 3.2, 5.2)].map((q) => add(head, q)), [3, 3.2, 3], L_.hair, onFace()));
        break;
      case 'skull':
        cap(out, head, L_.hood, [P(-9, 0, 9), P(-13, 0, 10)], [6, 3.6]);
        face(out, L_, head, { faceCol: L_.mask, eyes: 'socket', noMouth: true });
        out.push(Curve([add(head, P(12, -2, -3.5)), add(head, P(12.4, 0, -4)), add(head, P(12, 2, -3.5))], 1.2, '#2a2238', { line: 0, bias: 21, normal: { f: 1, s: 0 } }));
        break;
      case 'bandage':
        cap(out, head, L_.wrap, [P(-6, 0, -2)], [9]);
        face(out, L_, head, { faceCol: L_.wrap, eyes: 'glow', noMouth: true });
        for (const z of [3.5, -1.5]) out.push(Curve([add(head, P(6, -7.5, z + 1)), add(head, P(12, 0, z)), add(head, P(6, 7.5, z - 1))], 1, Rig.dark(L_.wrap, 0.3), { line: 0, bias: 21, normal: { f: 1, s: 0 } }));
        break;
      case 'horns':
        cap(out, head, L_.hair);
        for (const s of [-1, 1]) {
          for (let k = 0; k < 7; k++) {
            const a = k / 6;
            out.push(S(add(head, P(1 - a * 7, s * (8 + a * 5), 7 + a * 9 - a * a * 3)), 2.8 * (1 - a * 0.5), L_.horn, { line: 1 }));
          }
        }
        face(out, L_, head);
        break;
      case 'tattoo':
        cap(out, head, L_.hair, [P(-6, 0, 6)], [7]);
        face(out, L_, head);
        out.push(Curve([add(head, P(10, -5.5, 4)), add(head, P(11.2, -4, 0)), add(head, P(10, -5.5, -3))], 1.1, '#1a0a0a', { line: 0, bias: 21, normal: { f: 0.6, s: -0.8 } }));
        break;
      case 'beard':
        cap(out, head, L_.hat, [P(-1, 0, 11)], [8]);
        // bord du chapeau : moitié avant dessinée devant le visage, moitié arrière derrière la tête
        for (const front of [false, true]) {
          const pts = [];
          for (let k = 0; k <= 16; k++) {
            const a = (front ? -0.5 : 0.5) * Math.PI + (k / 16) * Math.PI;
            pts.push(add(head, P(-1 + Math.cos(a) * 12.5, Math.sin(a) * 12.5, 6)));
          }
          out.push(Curve(pts, 4.2, L_.hat, front ? { line: 1, bias: 20.2, normal: { f: 1, s: 0 }, minFacing: -0.9 } : { line: 1, bias: -0.5 }));
        }
        face(out, L_, head, { noMouth: true });
        out.push(Blob([P(9, 0, -6), P(8, -4, -4.5), P(8, 4, -4.5), P(9.5, 0, -10.5)].map((q) => add(head, q)), [5, 4, 4, 3.6], L_.beard, onFace({ bias: 21.5 })));
        break;
      case 'bandana':
        cap(out, head, L_.band, [P(-11, 0, 3)], [4]);
        for (const s of [-1, 1]) out.push(L(add(head, P(-12, s * 1.5, 3)), add(head, P(-17, s * 4, -1)), 3, L_.band));
        face(out, L_, head);
        out.push(Curve([add(head, P(8.5, -8, 4.5)), add(head, P(11, 0, 6)), add(head, P(8.5, 8, 4.5))], 2.6, L_.band, onFace()));
        break;
    }
  }

  // ------------------------------------------------ corps complet
  function body(out, L_, o) {
    const { bob, lean, breathe, armL, armR, capeSway, pose = {} } = o;
    const pelvis = P(lean * 0.3, 0, 26 + bob), chest = P(1 + lean, 0, 40 + bob + breathe);
    if (L_.cape) out.push(Poly([add(chest, P(-4, -7, 3)), add(chest, P(-4, 7, 3)), add(pelvis, P(-7 - capeSway, 9, -6)), add(pelvis, P(-7 - capeSway, -9, -6))], L_.cape, { bias: -1.5 }));
    if (L_.quiver) {
      out.push(L(add(pelvis, P(-7, 2.5, 11)), add(chest, P(-8.5, -2.5, 10)), 5, LEATHER, { bias: -2 }));
      out.push(S(add(chest, P(-9, -3, 13)), 1.9, '#d64545', { line: 1, bias: -2 }));
      out.push(S(add(chest, P(-8, -1.4, 13.6)), 1.9, '#fafafa', { line: 1, bias: -2 }));
      out.push(S(add(chest, P(-9.8, -4.4, 12.2)), 1.9, '#d64545', { line: 1, bias: -2 }));
    }
    out.push(S(add(pelvis, P(0, 0, 1)), 8.5, L_.tunic));
    out.push(L(pelvis, chest, 15, L_.tunic));
    out.push(S(add(pelvis, P(5.6, 0, 3.5)), 2.3, '#e8d9a0', { line: 1, bias: 1 })); // boucle de ceinture
    const hL = arm(out, L_, add(chest, P(0, -8.5, 1)), armL[0], armL[1], -1);
    const hR = arm(out, L_, add(chest, P(0, 8.5, 1)), armR[0], armR[1], 1);
    weapon(out, L_, hL, { ...pose, bowLean: armL[2] || 0, rightHand: hR.hand });
    headgear(out, L_, add(chest, P(1, 0, 15)));
    return { hL, hR };
  }

  function runModel(L_) {
    return (t) => {
      const ph = t * TAU, out = [];
      const bob = 2.2 * Math.abs(Math.sin(ph));
      for (const [s, k] of [[-4.5, 0], [4.5, 1]]) {
        const a = ph + k * Math.PI;
        leg(out, L_, P(0, s, 25 + bob), 0.75 * Math.sin(a), 0.25 + 1.0 * Math.max(0, Math.cos(a)));
      }
      const sw = 0.6 * Math.sin(ph);
      const armL = L_.weapon === 'bow' ? [0.9 + sw * 0.4, 0.5, -1.5] : [0.5 + sw * 0.5, 0.6];
      body(out, L_, { bob, lean: 3, breathe: 0, capeSway: 2.5 + 2 * Math.abs(Math.cos(ph)), armL, armR: [-sw, 0.9] });
      return out;
    };
  }

  function idleModel(L_) {
    return (t) => {
      const ph = t * TAU, out = [];
      for (const s of [-4.5, 4.5]) leg(out, L_, P(0, s, 25), 0.02 * Math.sign(s), 0.05);
      body(out, L_, {
        bob: -0.4 + 0.4 * Math.sin(ph), lean: 0, breathe: 0.7 * Math.sin(ph), capeSway: 0.6 * Math.sin(ph + 1),
        armL: L_.weapon === 'bow' ? [0.25, 0.25, 0] : [0.35, 0.5], armR: [-0.08 + 0.05 * Math.sin(ph), 0.3],
      });
      return out;
    };
  }

  // Attaque en 3 temps (armer, frapper/lancer, revenir), selon le type de la classe.
  function attackModel(L_) {
    return (t) => {
      const out = [];
      const wind = ease(clamp01(t / 0.35)), hit = ease(clamp01((t - 0.35) / 0.2)), back = ease(clamp01((t - 0.55) / 0.45));
      const step = (hit - back) * 4;
      for (const [s, k] of [[-4.5, 1], [4.5, -1]]) leg(out, L_, P(0, s, 25), k * (0.15 + step * 0.06), 0.1);
      let armL, armR = [-0.2, 0.4], pose = {}, lean = step * 0.8;
      if (L_.atk === 'swing') {
        const a = 0.4 + wind * 2.5 - hit * 1.9 - back * 0.6 * 0;
        armL = [a - back * (a - 0.5), 0.3];
        pose.weaponW = (armL[0] + 0.3) + 1.5 - hit * 0.4;
        if (L_.weapon === 'whip') { pose.crack = -1.4 * wind + hit * 2.2; pose.wave = t * 12; }
      } else if (L_.atk === 'shoot') {
        armL = [1.45, 0.05, 0];
        const pull = 6 * wind * (1 - hit);
        pose.pull = pull; pose.arrow = t < 0.55;
        armR = [1.3 - wind * 0.6 + hit * 0.6, 0.3 + wind * 1.3 - hit * 1.3];
      } else {
        const a = 0.35 + wind * 1.9 - back * 1.9;
        armL = [a, 0.2];
        pose.glow = Math.max(0, wind - back) * (t > 0.3 ? 1 : 0.3);
        pose.weaponW = Math.PI * 0.92 - wind * 0.9 + back * 0.9;
        if (L_.weapon === 'bomb') {
          // la bombe part au moment du lancer puis disparaît
          if (t > 0.42 && t < 0.8) { const u = (t - 0.42) / 0.38; pose.bombAt = P(14 + u * 26, -6, 44 + Math.sin(u * Math.PI) * 12 - u * 22); }
          else if (t >= 0.8) pose.bombAt = null;
        }
      }
      body(out, L_, { bob: -step * 0.4, lean, breathe: 0, capeSway: 1 + step, armL, armR, pose });
      return out;
    };
  }

  const CLASS_SHEETS = {};
  for (const [id, L_] of Object.entries(LOOKS)) {
    CLASS_SHEETS[id + '_run'] = { res: 2, frameW: 78, frameH: 92, frames: 30, fps: 40, anchorX: 0.5, anchorY: 0.84, model: runModel(L_) };
    CLASS_SHEETS[id + '_idle'] = { res: 2, frameW: 56, frameH: 90, frames: 21, fps: 20, anchorX: 0.5, anchorY: 0.84, model: idleModel(L_) };
    CLASS_SHEETS[id + '_attack'] = { res: 2, frameW: 120, frameH: 112, frames: 24, fps: 40, anchorX: 0.5, anchorY: 0.78, model: attackModel(L_) };
  }

  // fit : rayon (en pixels de case) qui correspond au rayon r du monstre dans le jeu.
  return {
    bouftou:  { res: 2, frameW: 95, frameH: 75, frames: 18, fps: 24, anchorX: 0.5, anchorY: 0.82, fit: 17.5, model: bouftou },
    bouftou_attack: { res: 2, frameW: 100, frameH: 76, frames: 31, fps: 50, anchorX: 0.5, anchorY: 0.76, fit: 17.5, model: bouftouAttack },
    bouftou_royal: { res: 2, frameW: 167, frameH: 150, frames: 30, fps: 24, anchorX: 0.5, anchorY: 0.84, fit: 30.6, model: royal },
    bouftou_royal_attack: { res: 2, frameW: 166, frameH: 167, frames: 25, fps: 40, anchorX: 0.5, anchorY: 0.82, fit: 30.6, model: royalAttack },
    boufton_noir: { res: 2, frameW: 80, frameH: 64, frames: 18, fps: 26, anchorX: 0.5, anchorY: 0.8, fit: 14, model: boufton },
    boufton_noir_attack: { res: 2, frameW: 86, frameH: 66, frames: 31, fps: 50, anchorX: 0.5, anchorY: 0.78, fit: 14, model: bouftonAttack },
    tofu: { res: 2, frameW: 50, frameH: 52, frames: 12, fps: 24, anchorX: 0.5, anchorY: 0.86, fit: 10, model: tofu },
    tofu_attack: { res: 2, frameW: 157, frameH: 114, frames: 32, fps: 52, anchorX: 0.5, anchorY: 0.75, fit: 10, model: tofuAttack },
    tofu_royal: { res: 2, frameW: 180, frameH: 171, frames: 27, fps: 24, anchorX: 0.5, anchorY: 0.82, fit: 31, model: tofuRoyal },
    piou: { res: 2, frameW: 44, frameH: 37, frames: 8, fps: 24, anchorX: 0.5, anchorY: 0.86, fit: 8.2, model: piou },
    piou_attack: { res: 2, frameW: 50, frameH: 42, frames: 21, fps: 35, anchorX: 0.5, anchorY: 0.68, fit: 8.2, model: piouAttack },
    larve_bleue: { frameW: 59, frameH: 39, frames: 16, fps: 24, anchorX: 0.5, anchorY: 0.72, fit: 14, model: larve },
    larve_bleue_attack: { frameW: 66, frameH: 54, frames: 27, fps: 45, anchorX: 0.5, anchorY: 0.7, fit: 14, model: larveAttack },
    ...CLASS_SHEETS,
  };
})();
