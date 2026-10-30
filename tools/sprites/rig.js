'use strict';
// Mini moteur de « poupées » 3D pour dessiner des planches de sprites en 8 directions.
// Un modèle est une liste de primitives (sphères, membres, polygones) en coordonnées locales :
//   f = vers l'avant, s = vers la droite du personnage, z = vers le haut (en pixels de la case).
// Chaque image tourne le modèle autour de l'axe vertical, le projette en vue isométrique
// et dessine les primitives de l'arrière vers l'avant (algorithme du peintre).

const Rig = (() => {
  const SIN_A = 0.55, COS_A = Math.sqrt(1 - SIN_A * SIN_A); // élévation de la caméra (~33°)
  const LIGHT = { x: -0.45, y: -0.55 };                      // lumière en haut à gauche

  // Directions des lignes de la planche : 0 = est, puis sens horaire à l'écran (2 = sud, face caméra).
  const DIRS = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => (i * Math.PI) / 4);

  function hex(c) {
    const n = parseInt(c.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mix(a, b, t) {
    const A = hex(a), B = hex(b);
    return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
  }
  const light = (c, t) => mix(c, '#ffffff', t);
  const dark = (c, t) => mix(c, '#000000', t);

  function project(p, th, ox, oy) {
    const c = Math.cos(th), s = Math.sin(th);
    const wx = p.f * c - p.s * s, wy = p.f * s + p.s * c;
    return { x: ox + wx, y: oy + wy * SIN_A - p.z * COS_A, d: wy * COS_A + p.z * SIN_A };
  }

  // Rendu « dessin animé » : aplats de couleur plutôt que dégradés lisses.
  // Chaque volume a son ton de base, une ombre en croissant en bas à droite (opposée à la lumière),
  // un petit reflet en haut à gauche et un contour sombre teinté.
  const SHADE = { x: -LIGHT.x, y: -LIGHT.y };
  const outline = (col, o) => o.lineColor || dark(col, 0.6);

  function sphere(ctx, q, r, col, o) {
    const line = o.line ?? 1.3;
    if (line) {
      ctx.fillStyle = outline(col, o);
      ctx.beginPath(); ctx.arc(q.x, q.y, r + line, 0, Math.PI * 2); ctx.fill();
    }
    ctx.save();
    ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, Math.PI * 2);
    if (r < 2.4) { ctx.fillStyle = col; ctx.fill(); ctx.restore(); return; }
    ctx.fillStyle = dark(col, o.shade ?? 0.24); ctx.fill();
    ctx.clip();
    // ton de base décalé vers la lumière : il laisse un croissant d'ombre de l'autre côté
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(q.x - SHADE.x * r * 0.32, q.y - SHADE.y * r * 0.32, r * 0.97, 0, Math.PI * 2); ctx.fill();
    if (o.hi !== 0) {
      ctx.fillStyle = light(col, o.hi ?? 0.5); ctx.globalAlpha = 0.85;
      ctx.beginPath(); ctx.ellipse(q.x + LIGHT.x * r * 0.5, q.y + LIGHT.y * r * 0.5, r * 0.3, r * 0.18, -0.6, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function limb(ctx, a, b, w, col, o) {
    const seg = (dx, dy) => { ctx.beginPath(); ctx.moveTo(a.x + dx, a.y + dy); ctx.lineTo(b.x + dx, b.y + dy); ctx.stroke(); };
    ctx.lineCap = 'round';
    const line = o.line ?? 1.3;
    if (line) { ctx.strokeStyle = outline(col, o); ctx.lineWidth = w + line * 2; seg(0, 0); }
    ctx.strokeStyle = dark(col, 0.24); ctx.lineWidth = w; seg(0, 0);                 // ombre
    ctx.strokeStyle = col; ctx.lineWidth = w * 0.72; seg(-SHADE.x * w * 0.14, -SHADE.y * w * 0.14); // ton de base
    if (w > 3) { ctx.strokeStyle = light(col, 0.45); ctx.lineWidth = w * 0.22; ctx.globalAlpha = 0.8; seg(LIGHT.x * w * 0.24, LIGHT.y * w * 0.24); ctx.globalAlpha = 1; }
  }

  function poly(ctx, pts, col, o) {
    const path = () => { ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.closePath(); };
    ctx.lineJoin = 'round';
    const line = o.line ?? 1.3;
    if (line) { ctx.strokeStyle = outline(col, o); ctx.lineWidth = line * 2; path(); ctx.stroke(); }
    path(); ctx.fillStyle = dark(col, 0.2); ctx.fill();
    ctx.save(); path(); ctx.clip();
    ctx.translate(-SHADE.x * 1.6, -SHADE.y * 1.6); path(); ctx.fillStyle = col; ctx.fill();
    ctx.restore();
  }

  // Nuage de sphères (laine, fourrure) : un seul contour extérieur, puis chaque boucle,
  // de l'arrière vers l'avant, avec son propre croissant d'ombre et un petit reflet.
  function blob(ctx, qs, rs, col, o) {
    const line = o.line ?? 1.4, lc = outline(col, o);
    const union = (grow) => { ctx.beginPath(); qs.forEach((q, i) => { ctx.moveTo(q.x + rs[i] + grow, q.y); ctx.arc(q.x, q.y, rs[i] + grow, 0, Math.PI * 2); }); };
    ctx.fillStyle = lc; union(line); ctx.fill();
    ctx.save();
    union(0); ctx.fillStyle = dark(col, 0.26); ctx.fill(); ctx.clip();
    const order = qs.map((q, i) => i).sort((a, b) => qs[a].d - qs[b].d);
    for (const i of order) {
      const q = qs[i], r = rs[i];
      ctx.fillStyle = dark(col, 0.2);
      ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(q.x - SHADE.x * r * 0.3, q.y - SHADE.y * r * 0.3, r * 0.9, 0, Math.PI * 2); ctx.fill();
    }
    for (const i of order) {
      if (qs[i].d < o.minD) continue;
      const q = qs[i], r = rs[i];
      ctx.fillStyle = light(col, 0.55); ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.ellipse(q.x + LIGHT.x * r * 0.45, q.y + LIGHT.y * r * 0.45, r * 0.28, r * 0.16, -0.6, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  // Une arête courbe (arc, corde) : suite de points reliés, sans remplissage.
  function curve(ctx, pts, w, col, o) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const path = () => { ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); };
    if (o.line !== 0) { ctx.strokeStyle = o.lineColor || dark(col, 0.55); ctx.lineWidth = w + (o.line ?? 1.2) * 2; path(); ctx.stroke(); }
    ctx.strokeStyle = col; ctx.lineWidth = w; path(); ctx.stroke();
  }

  // Dessine un modèle (liste de primitives) tourné de th, ancré en (ox, oy).
  function draw(ctx, prims, th, ox, oy) {
    // o.normal = direction locale {f, s} vers laquelle l'élément est tourné : il n'est dessiné
    // que s'il fait face à la caméra (au-delà de o.minFacing, -0.3 par défaut).
    const visible = (o) => !o.normal || o.normal.f * Math.sin(th) + o.normal.s * Math.cos(th) >= (o.minFacing ?? -0.3);
    const items = prims.filter((p) => visible(p.o || {})).map((p) => {
      const o = p.o || {};
      if (p.t === 'sphere') { const q = project(p.c, th, ox, oy); return { d: q.d + (o.bias || 0), run: () => sphere(ctx, q, p.r, p.col, o) }; }
      if (p.t === 'limb') {
        const a = project(p.a, th, ox, oy), b = project(p.b, th, ox, oy);
        return { d: (a.d + b.d) / 2 + (o.bias || 0), run: () => limb(ctx, a, b, p.w, p.col, o) };
      }
      const qs = p.pts.map((v) => project(v, th, ox, oy));
      const d = qs.reduce((t, q) => t + q.d, 0) / qs.length + (o.bias || 0);
      if (p.t === 'blob') {
        const mean = qs.reduce((t, q) => t + q.d, 0) / qs.length;
        return { d, run: () => blob(ctx, qs, p.rs, p.col, { ...o, minD: mean - 2 }) };
      }
      return { d, run: () => (p.t === 'poly' ? poly(ctx, qs, p.col, o) : curve(ctx, qs, p.w, p.col, o)) };
    });
    items.sort((a, b) => a.d - b.d);
    for (const it of items) it.run();
  }

  // Rend une planche : lignes = 8 directions, colonnes = images de l'animation.
  // spec.res : facteur de résolution (2 = planche deux fois plus fine, pour les écrans haute densité).
  function sheet(spec) {
    const { frameW: fw, frameH: fh, frames, anchorX, anchorY, model } = spec, res = spec.res || 1;
    const cv = document.createElement('canvas');
    cv.width = fw * frames * res; cv.height = fh * DIRS.length * res;
    const ctx = cv.getContext('2d');
    DIRS.forEach((th, row) => {
      for (let i = 0; i < frames; i++) {
        ctx.save();
        ctx.scale(res, res);
        ctx.beginPath(); ctx.rect(i * fw, row * fh, fw, fh); ctx.clip();
        draw(ctx, model(i / frames), th, i * fw + fw * anchorX, row * fh + fh * anchorY);
        ctx.restore();
      }
    });
    return cv;
  }

  // Petits utilitaires pour construire les modèles.
  const P = (f, s, z) => ({ f, s, z });
  const add = (a, b) => P(a.f + b.f, a.s + b.s, a.z + b.z);
  const S = (c, r, col, o) => ({ t: 'sphere', c, r, col, o });
  const L = (a, b, w, col, o) => ({ t: 'limb', a, b, w, col, o });
  const Poly = (pts, col, o) => ({ t: 'poly', pts, col, o });
  const Curve = (pts, w, col, o) => ({ t: 'curve', pts, w, col, o });
  const Blob = (pts, rs, col, o) => ({ t: 'blob', pts, rs, col, o });

  // Agrandit tout un modèle (positions, rayons, épaisseurs) d'un facteur k.
  function scale(prims, k) {
    const sp = (p) => P(p.f * k, p.s * k, p.z * k);
    return prims.map((p) => {
      const q = { ...p, o: p.o && { ...p.o, bias: (p.o.bias || 0) * k } };
      if (p.c) q.c = sp(p.c);
      if (p.a) { q.a = sp(p.a); q.b = sp(p.b); }
      if (p.pts) q.pts = p.pts.map(sp);
      if (p.r) q.r = p.r * k;
      if (p.w) q.w = p.w * k;
      if (p.rs) q.rs = p.rs.map((r) => r * k);
      return q;
    });
  }

  return { sheet, draw, mix, light, dark, P, add, S, L, Poly, Curve, Blob, scale, DIRS };
})();
