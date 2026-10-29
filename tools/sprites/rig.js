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

  function sphere(ctx, q, r, col, o) {
    const g = ctx.createRadialGradient(q.x + LIGHT.x * r * 0.7, q.y + LIGHT.y * r * 0.7, r * 0.1, q.x, q.y, r * 1.05);
    g.addColorStop(0, light(col, o.hi ?? 0.35));
    g.addColorStop(0.55, col);
    g.addColorStop(1, dark(col, o.shade ?? 0.3));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, Math.PI * 2); ctx.fill();
    if (o.line !== 0) {
      ctx.strokeStyle = o.lineColor || dark(col, 0.55);
      ctx.lineWidth = o.line ?? 1.2;
      ctx.stroke();
    }
  }

  function limb(ctx, a, b, w, col, o) {
    ctx.lineCap = 'round';
    if (o.line !== 0) {
      ctx.strokeStyle = o.lineColor || dark(col, 0.55);
      ctx.lineWidth = w + (o.line ?? 1.2) * 2;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    ctx.strokeStyle = col; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.strokeStyle = light(col, 0.3); ctx.lineWidth = w * 0.35; ctx.globalAlpha = 0.8;
    const k = w * 0.18;
    ctx.beginPath(); ctx.moveTo(a.x + LIGHT.x * k, a.y + LIGHT.y * k); ctx.lineTo(b.x + LIGHT.x * k, b.y + LIGHT.y * k); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function poly(ctx, pts, col, o) {
    ctx.beginPath();
    pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    ctx.closePath();
    const ys = pts.map((q) => q.y), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const g = ctx.createLinearGradient(0, y0, 0, y1 + 0.01);
    g.addColorStop(0, light(col, o.hi ?? 0.2)); g.addColorStop(1, dark(col, o.shade ?? 0.25));
    ctx.fillStyle = g; ctx.fill();
    if (o.line !== 0) { ctx.strokeStyle = o.lineColor || dark(col, 0.55); ctx.lineWidth = o.line ?? 1.2; ctx.lineJoin = 'round'; ctx.stroke(); }
  }

  // Nuage de sphères (laine, fourrure) : un seul contour extérieur, un éclairage d'ensemble
  // et une petite boucle par sphère pour la texture.
  function blob(ctx, qs, rs, col, o) {
    const line = o.line ?? 1.3, lc = o.lineColor || dark(col, 0.5);
    ctx.fillStyle = lc;
    ctx.beginPath(); qs.forEach((q, i) => { ctx.moveTo(q.x + rs[i] + line, q.y); ctx.arc(q.x, q.y, rs[i] + line, 0, Math.PI * 2); }); ctx.fill();
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    qs.forEach((q, i) => { x0 = Math.min(x0, q.x - rs[i]); y0 = Math.min(y0, q.y - rs[i]); x1 = Math.max(x1, q.x + rs[i]); y1 = Math.max(y1, q.y + rs[i]); });
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, R = Math.max(x1 - x0, y1 - y0) / 2;
    const g = ctx.createRadialGradient(cx + LIGHT.x * R * 0.6, cy + LIGHT.y * R * 0.6, R * 0.1, cx, cy, R * 1.1);
    g.addColorStop(0, light(col, 0.45)); g.addColorStop(0.5, col); g.addColorStop(1, dark(col, 0.22));
    ctx.fillStyle = g;
    ctx.beginPath(); qs.forEach((q, i) => { ctx.moveTo(q.x + rs[i], q.y); ctx.arc(q.x, q.y, rs[i], 0, Math.PI * 2); }); ctx.fill();
    // boucles : ombre sous chaque sphère visible, reflet au-dessus
    const order = qs.map((q, i) => i).sort((a, b) => qs[a].d - qs[b].d);
    ctx.lineCap = 'round';
    for (const i of order) {
      if (qs[i].d < o.minD) continue;
      const q = qs[i], r = rs[i];
      ctx.strokeStyle = dark(col, 0.18); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(q.x, q.y, r * 0.78, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
      ctx.strokeStyle = light(col, 0.6); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(q.x - r * 0.15, q.y - r * 0.15, r * 0.45, Math.PI * 1.1, Math.PI * 1.6); ctx.stroke();
    }
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
    const items = prims.map((p) => {
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
  function sheet(spec) {
    const { frameW: fw, frameH: fh, frames, anchorX, anchorY, model } = spec;
    const cv = document.createElement('canvas');
    cv.width = fw * frames; cv.height = fh * DIRS.length;
    const ctx = cv.getContext('2d');
    DIRS.forEach((th, row) => {
      for (let i = 0; i < frames; i++) {
        ctx.save();
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

  return { sheet, draw, mix, light, dark, P, add, S, L, Poly, Curve, Blob, DIRS };
})();
