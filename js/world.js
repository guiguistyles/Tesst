'use strict';
// Aventure « Le Réveil des Zaaps » : une carte ouverte par zone (zaap, personnage,
// camps de monstres, repaire du boss intermédiaire, entrée du donjon), un donjon par
// zone avec le gardien au fond, l'histoire en quêtes et l'équipement lâché par les monstres.
// Coordonnées en pixels de jeu (32 px = 1 m), origine à l'ouest de chaque carte.

const WORLD = (() => {
  const MAP_W = 4800, MAP_H = 1300;   // carte de zone : 150 m × 81 m
  const DJ_W = 3000, DJ_H = 380;      // donjon : long couloir de 94 m × 24 m
  // Niveaux des monstres de chaque zone (min, max). Le donjon est un peu au-dessus.
  // Chaque monde couvre 40 niveaux, 10 par île
  const LEVELS = [[1, 40], [40, 80], [80, 120], [120, 160], [160, 200]];

  function rng(seed) {
    let t = seed >>> 0;
    return () => { t += 0x6d2b79f5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
  }

  const NPCS = [
    { name: 'Oriel', title: 'Gardien des zaaps', look: 'xelor' },
    { name: 'Margot', title: 'Fermière d’Amakna', look: 'eniripsa' },
    { name: 'Sylvain', title: 'Druide de la forêt', look: 'sadida' },
    { name: 'Brakk', title: 'Mineur des Craqueleurs', look: 'enutrof' },
    { name: 'Neva', title: 'Exploratrice de Frigost', look: 'cra' },
  ];
  const DUNGEONS = ['Bergerie du Bouftou Royal', 'Porcherie du Dragon Cochon', 'Cœur pourri du Chêne Mou', 'Antre du Craqueleur Légendaire', 'Caverne d’obsidienne'];

  /* ---------------------------------------------------------------- Terrain */
  // Chemins, plans d'eau (infranchissables sauf la glace), ponts et hameau autour du zaap.
  const WATER_KIND = {
    water: { fill: '#4f9fd8', rim: '#d8c890', solid: true },
    swamp: { fill: '#4d6b3c', rim: '#34452a', solid: true },
    chasm: { fill: '#1a1420', rim: '#6a5a4a', solid: true },
    ice: { fill: '#d4ebf8', rim: '#a8c8e0', solid: false },
    hole: { fill: '#2f6aa8', rim: '#e8f4fc', solid: true },
  };
  const ROAD_COL = { grass: ['#c2a46c', '#a88a56'], field: ['#c8aa70', '#aa8c58'], forest: ['#7d6444', '#5f4a32'], rock: ['#b0a080', '#8c7c60'], snow: ['#c6d2dc', '#a8b6c2'] };

  function segDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l));
    return Math.hypot(px - ax - dx * t, py - ay - dy * t);
  }
  /** Distance au chemin le plus proche. */
  function roadDist(m, x, y) {
    let d = Infinity;
    for (const r of m.roads || []) for (let i = 1; i < r.length; i++) d = Math.min(d, segDist(x, y, r[i - 1][0], r[i - 1][1], r[i][0], r[i][1]));
    if (m.plaza) d = Math.min(d, Math.max(0, Math.hypot(x - m.plaza.x, y - m.plaza.y) - m.plaza.r));
    return d;
  }
  /** Le point est-il dans l'eau (ou un gouffre, ou sur un pont), avec une marge ? */
  function inWater(m, x, y, pad = 0, solidOnly = true) {
    if (!solidOnly) for (const b of m.bridges || []) if (Math.abs(x - b.x) < b.len / 2 + pad + 40 && Math.abs(y - b.y) < 60 + pad) return b;
    for (const w of m.water || []) {
      if (solidOnly && !WATER_KIND[w.kind].solid) continue;
      const nx = (x - w.x) / (w.rx + pad), ny = (y - w.y) / (w.ry + pad);
      if (nx * nx + ny * ny < 1) return w;
    }
    return null;
  }
  /** Obstacles (eau, maisons) : renvoie la position corrigée d'un cercle de rayon r. */
  function collide(m, x, y, r) {
    for (const w of m.water || []) {
      if (!WATER_KIND[w.kind].solid) continue;
      const ax = w.rx + r, ay = w.ry + r;
      if (Math.abs(x - w.x) > ax || Math.abs(y - w.y) > ay) continue;
      const nx = (x - w.x) / ax, ny = (y - w.y) / ay, d = nx * nx + ny * ny;
      if (d >= 1) continue;
      if (d < 1e-6) { x = w.x + ax; continue; }   // pile au centre : on sort par l'est
      const k = 1 / Math.sqrt(d); x = w.x + (x - w.x) * k; y = w.y + (y - w.y) * k;
    }
    for (const hs of m.houses || []) {
      const dx = x - hs.x, dy = y - hs.y, d = Math.hypot(dx, dy), R = hs.r + r;
      if (d < R && d > 0.01) { x = hs.x + (dx / d) * R; y = hs.y + (dy / d) * R; }
    }
    // Arbres, rochers et autres éléments solides du décor
    if (m.solids) {
      const cell = solidGrid(m).get(Math.floor(x / 200) * 1000 + Math.floor(y / 200));
      if (cell) for (const o of cell) {
        const dx = x - o.x, dy = y - o.y, d = Math.hypot(dx, dy), R = o.r + r;
        if (d < R && d > 0.01) { x = o.x + (dx / d) * R; y = o.y + (dy / d) * R; }
      }
    }
    return [x, y];
  }
  /** Ordonnée du chemin principal à une abscisse donnée. */
  function roadY(road, x) {
    for (let i = 1; i < road.length; i++) {
      const [ax, ay] = road[i - 1], [bx, by] = road[i];
      if (x >= ax && x <= bx) return ay + (by - ay) * ((x - ax) / (bx - ax || 1));
    }
    return 0;
  }
  /** Chemin lissé (courbe de Catmull-Rom) passant par des points de contrôle. */
  function smoothPath(ctrl, step = 60) {
    const out = [];
    for (let i = 0; i < ctrl.length - 1; i++) {
      const p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(ctrl.length - 1, i + 2)];
      const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
      for (let k = 0; k < n; k++) {
        const t = k / n, t2 = t * t, t3 = t2 * t;
        const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
      }
    }
    out.push(ctrl[ctrl.length - 1]);
    return out;
  }

  function genTerrain(m, r) {
    const W = m.w, H = m.h, type = m.decoType;
    // Chemin principal : du zaap jusqu'à l'entrée du donjon, en serpentant
    const ctrl = [[m.zaap.x, 0]];
    const n = 7;
    for (let k = 1; k < n; k++) ctrl.push([m.zaap.x + ((m.door.x - 180 - m.zaap.x) * k) / n, (r() - 0.5) * 620]);
    ctrl.push([m.door.x - 180, 0], [m.door.x, 0]);
    const main = smoothPath(ctrl);
    m.roads = [main];
    // Embranchement vers le repaire du boss intermédiaire
    const ly = roadY(main, m.lair.x);
    m.roads.push(smoothPath([[m.lair.x - 160, ly], [m.lair.x - 60, (ly + m.lair.y) / 2], [m.lair.x, m.lair.y - Math.sign(m.lair.y) * 170]]));
    m.plaza = { x: m.zaap.x + 60, y: 0, r: 230 };
    m.water = [];
    m.bridges = [];
    const places = [[m.zaap.x, m.zaap.y, 520], [m.npc.x, m.npc.y, 300], [m.lair.x, m.lair.y, 380], [m.door.x, m.door.y, 460]];
    const freeSpot = (x, y, rad) => !places.some(([px, py, pr]) => Math.hypot(px - x, py - y) < pr + rad) &&
      roadDist(m, x, y) > rad + 70 && !m.water.some((w) => Math.hypot(w.x - x, w.y - y) < Math.max(w.rx, w.ry) + rad + 80);
    const addLakes = (count, kind, rmin, rmax) => {
      let t = 0, c = 0;
      while (c < count && t++ < 400) {
        const rx = rmin + r() * (rmax - rmin), ry = rx * (0.55 + r() * 0.35);
        const x = 600 + r() * (W - 1200), y = -H + rx + 80 + r() * (H * 2 - 2 * rx - 160);
        if (!freeSpot(x, y, rx)) continue;
        m.water.push({ x, y, rx, ry, kind });
        // Petites flaques autour des grands plans d'eau
        if (kind !== 'chasm' && r() < 0.6) m.water.push({ x: x + rx * 0.9, y: y + ry * 0.5, rx: rx * 0.35, ry: ry * 0.35, kind });
        c++;
      }
    };
    if (type === 'field') {
      // Une rivière traverse Amakna du nord au sud : deux ponts permettent de la franchir
      const rx0 = W * 0.33;
      const cross = roadY(main, rx0);
      const by = (cross > 0 ? -1 : 1) * H * 0.62;
      for (let y = -H - 120; y <= H + 120; y += 55) {
        const x = rx0 + Math.sin(y / 260) * 90 + Math.sin(y / 97) * 25;
        if (Math.abs(y - cross) < 120 || Math.abs(y - by) < 100) continue;
        m.water.push({ x, y, rx: 95, ry: 70, kind: 'water' });
      }
      m.bridges.push({ x: rx0 + Math.sin(cross / 260) * 90 + Math.sin(cross / 97) * 25, y: cross, len: 280, a: 0 });
      m.bridges.push({ x: rx0 + Math.sin(by / 260) * 90 + Math.sin(by / 97) * 25, y: by, len: 280, a: 0 });
      addLakes(1, 'water', 160, 230);
    } else if (type === 'grass') addLakes(3, 'water', 150, 260);
    else if (type === 'forest') addLakes(6, 'swamp', 110, 200);
    else if (type === 'rock') addLakes(4, 'chasm', 140, 260);
    else if (type === 'snow') { addLakes(1, 'ice', 420, 520); addLakes(3, 'hole', 90, 150); }
    // Hameau autour du zaap
    m.houses = [[-200, -330, 0.15], [170, -390, -0.2], [-250, 320, -0.1], [190, 360, 0.25], [440, -360, 0.1]].map(([dx, dy, rot], k) => ({
      x: m.zaap.x + dx, y: m.zaap.y + dy, r: 85, rot, roof: ['#b5482e', '#3f6fb0', '#7a4a9a', '#b5482e', '#3f8a5a'][k],
    }));
    m.well = { x: m.zaap.x - 110, y: 150 };
  }

  /* ---------------------------------------------------------------- Archipels */
  // Chaque monde est un archipel flottant : une île centrale (zaap, hameau, personnage)
  // et quatre îles reliées par des ponts, chacune peuplée d'une seule famille de monstres.
  const ISLES = [
    { x: 1250, y: 0, rx: 900, ry: 680 },       // 0 : île centrale
    { x: 3650, y: -1380, rx: 1250, ry: 900 },  // 1
    { x: 3650, y: 1380, rx: 1250, ry: 900 },   // 2
    { x: 6450, y: 0, rx: 1350, ry: 1000 },     // 3 (repaire du boss intermédiaire)
    { x: 9150, y: 0, rx: 1350, ry: 1050 },     // 4 (entrée du donjon)
  ];
  const LINKS = [[0, 1], [0, 2], [1, 3], [2, 3], [3, 4]];
  // Sous-zones : nom, monstres, plans d'eau
  const SUBZONES = [
    [{ name: 'Calanque d’Astrub', ids: ['pichon'], lake: 'water' }, { name: 'Tainéla', ids: ['bouftou'] },
     { name: 'Champs d’Astrub', ids: ['tofu', 'piou'] }, { name: 'Forêt d’Astrub', ids: ['larve_bleue', 'bouftou'] }],
    [{ name: 'Bois d’Amakna', ids: ['arakne'] }, { name: 'Marais d’Amakna', ids: ['moskito'], lake: 'swamp' },
     { name: 'Champs de cawottes', ids: ['prespic', 'arakne'] }, { name: 'Territoire des sangliers', ids: ['sanglier'] }],
    [{ name: 'Bois des fantômes', ids: ['fantome'] }, { name: 'Tour des archers', ids: ['chafer_archer'] },
     { name: 'Bosquet ancien', ids: ['abraknyde'], lake: 'swamp' }, { name: 'Cimetière des chafers', ids: ['chafer', 'chafer_archer'] }],
    [{ name: 'Lacs de gelée', ids: ['gelee'], lake: 'water' }, { name: 'Village bwork', ids: ['bwork'] },
     { name: 'Tour des mages bworks', ids: ['bwork_mage', 'bwork'] }, { name: 'Mines des craqueleurs', ids: ['craqueleur'], lake: 'chasm' }],
    [{ name: 'Banquise des mansots', ids: ['mansot'], lake: 'ice' }, { name: 'Pâturages gelés', ids: ['boufmouth'], lake: 'hole' },
     { name: 'Forêt des sapiks', ids: ['sapik'] }, { name: 'Bois pétrifiés', ids: ['fecorce', 'sapik'] }],
  ];
  // Repaire du boss intermédiaire : île de sa famille
  const LAIR_ISLE = [3, 3, 3, 3, 1];

  /** Bord irrégulier d'une île (multiplicateur du rayon selon l'angle). */
  function wob(isl, a) { return 1 + 0.07 * Math.sin(3 * a + isl.s) + 0.045 * Math.sin(5 * a + isl.s * 2.1) + 0.03 * Math.sin(9 * a + isl.s * 0.7); }
  /** Distance « normalisée » au centre d'une île (1 = bord). */
  function isleE(isl, x, y) {
    const dx = (x - isl.x) / isl.rx, dy = (y - isl.y) / isl.ry;
    return Math.sqrt(dx * dx + dy * dy) / wob(isl, Math.atan2(dy, dx));
  }
  function edgePoint(isl, a, k = 1) { const w = wob(isl, a) * k; return [isl.x + Math.cos(a) * isl.rx * w, isl.y + Math.sin(a) * isl.ry * w]; }
  /** Île sous un point (ou null). */
  function isleAt(m, x, y, pad = 0) {
    if (!m.isles) return null;
    for (const isl of m.isles) if (isleE(isl, x, y) < 1 - pad / Math.min(isl.rx, isl.ry)) return isl;
    return null;
  }
  function onBridge(m, x, y, pad = 0) {
    for (const b of m.spans || []) if (segDist(x, y, b.ax, b.ay, b.bx, b.by) < b.w / 2 - pad) return b;
    return null;
  }
  /** Le point est-il sur la terre ferme (île ou pont) ? */
  function walkable(m, x, y, r = 0) {
    if (!m.isles) return true;
    return !!(isleAt(m, x, y, r) || onBridge(m, x, y, r * 0.4));
  }
  /** Déplacement : glisse le long du bord au lieu de tomber dans le vide. */
  function walk(m, ox, oy, nx, ny, r) {
    if (walkable(m, nx, ny, r)) return [nx, ny];
    if (walkable(m, nx, oy, r)) return [nx, oy];
    if (walkable(m, ox, ny, r)) return [ox, ny];
    return [ox, oy];
  }

  function genIslands(m, r, zi) {
    const sub = SUBZONES[zi];
    m.isles = ISLES.map((d, k) => ({ ...d, s: r() * 6.28, k, name: k ? sub[k - 1].name : m.name, ids: k ? sub[k - 1].ids : [], lake: k ? sub[k - 1].lake : null }));
    const [l0, l1] = m.lvl, span = (l1 - l0 + 1) / 4;
    // 10 niveaux par île : Astrub 1-10, 10-20, 20-30, 30-40 ; Amakna 40-50…
    m.isles.forEach((isl, k) => { if (k) isl.lvl = [Math.max(1, zi * 40 + (k - 1) * 10), zi * 40 + k * 10]; });
    // Ponts entre les îles (d'un bord à l'autre)
    m.spans = LINKS.map(([a, b]) => {
      const A = m.isles[a], B = m.isles[b];
      const ang = Math.atan2(B.y - A.y, B.x - A.x);
      const [ax, ay] = edgePoint(A, ang, 0.9), [bx, by] = edgePoint(B, ang + Math.PI, 0.9);
      return { ax, ay, bx, by, w: 140, a, b };
    });
    const hub = m.isles[0];
    m.zaap = { x: hub.x - 230, y: 0 };
    m.npc = { ...m.npc, x: m.zaap.x + 210, y: -40 };
    const li = m.isles[LAIR_ISLE[zi]];
    m.lair = { ...m.lair, x: li.x + 60, y: li.y + (li.y < 0 ? -li.ry * 0.3 : li.ry * 0.3) };
    const di = m.isles[4];
    m.door = { x: di.x + di.rx * 0.62, y: di.y };
    // Chemins : du zaap à chaque pont, puis jusqu'au cœur de chaque île
    const ctr = (isl) => [isl.x, isl.y];
    m.roads = [];
    for (const b of m.spans) {
      const A = m.isles[b.a], B = m.isles[b.b];
      const from = b.a === 0 ? [m.zaap.x + 120, 0] : ctr(A);
      const mid1 = [(from[0] + b.ax) / 2 + (r() - 0.5) * 120, (from[1] + b.ay) / 2 + (r() - 0.5) * 120];
      const mid2 = [(b.bx + B.x) / 2 + (r() - 0.5) * 120, (b.by + B.y) / 2 + (r() - 0.5) * 120];
      m.roads.push(smoothPath([from, mid1, [b.ax, b.ay], [b.bx, b.by], mid2, ctr(B)]));
    }
    m.roads.push(smoothPath([ctr(di), [di.x + di.rx * 0.3, di.y + 40], [m.door.x - 60, m.door.y]]));
    m.plaza = { x: m.zaap.x + 80, y: 0, r: 230 };
    // Plans d'eau propres à certaines îles
    m.water = [];
    m.bridges = [];
    for (const isl of m.isles) {
      if (!isl.lake) continue;
      const n = isl.lake === 'ice' ? 1 : isl.lake === 'chasm' ? 2 : 3;
      for (let k = 0, t = 0; k < n && t < 600; t++) {
        const big = isl.lake === 'ice' ? 0.42 : isl.lake === 'water' && k === 0 ? 0.33 : 0.18;
        const rx = isl.rx * big * (0.8 + r() * 0.3), ry = rx * (0.6 + r() * 0.25);
        const a = r() * 6.28, d = 0.2 + r() * 0.4;
        const x = isl.x + Math.cos(a) * isl.rx * d, y = isl.y + Math.sin(a) * isl.ry * d;
        if (isleE(isl, x, y) + Math.max(rx / isl.rx, ry / isl.ry) > 0.85 || roadDist(m, x, y) < Math.max(rx, ry) + 50) continue;
        if (Math.hypot(m.lair.x - x, m.lair.y - y) < rx + 300 || Math.hypot(m.door.x - x, m.door.y - y) < rx + 300) continue;
        if (m.water.some((w) => Math.hypot(w.x - x, w.y - y) < w.rx + rx + 80)) continue;
        m.water.push({ x, y, rx, ry, kind: isl.lake });
        k++;
      }
    }
    // Hameau autour du zaap
    m.houses = [[-200, -330, 0.15], [170, -370, -0.2], [-250, 320, -0.1], [190, 350, 0.25], [-420, -40, 0.1]].map(([dx, dy, rot], k) => ({
      x: m.zaap.x + dx, y: m.zaap.y + dy, r: 85, rot, roof: ['#b5482e', '#3f6fb0', '#7a4a9a', '#b5482e', '#3f8a5a'][k],
    }));
    m.well = { x: m.zaap.x - 110, y: 170 };
    // Camps : six ou sept par île, de la famille de l'île
    m.camps = [];
    for (const isl of m.isles) {
      if (!isl.k) continue;
      for (let c = 0, t = 0; c < 18 && t < 1500; t++) {
        const a = r() * 6.28, d = 0.15 + r() * 0.68;
        const x = isl.x + Math.cos(a) * isl.rx * d, y = isl.y + Math.sin(a) * isl.ry * d;
        if (isleE(isl, x, y) > 0.82 || roadDist(m, x, y) < 110 || inWater(m, x, y, 120, false)) continue;
        if (Math.hypot(m.lair.x - x, m.lair.y - y) < 420 || Math.hypot(m.door.x - x, m.door.y - y) < 380) continue;
        if (m.camps.some((o) => Math.hypot(o.x - x, o.y - y) < 300)) continue;
        const ids = [], n = 3 + ((r() * 3) | 0);
        for (let q = 0; q < n; q++) ids.push(isl.ids[q === n - 1 ? (r() * isl.ids.length) | 0 : 0]);
        m.camps.push({ x, y, ids, lvl: isl.lvl[0] + Math.floor(r() * (isl.lvl[1] - isl.lvl[0] + 1)), isle: isl.k });
        c++;
      }
    }
    m.w = 10650; m.h = 2550;
    const li2 = m.isles[LAIR_ISLE[zi]];
    m.lair.lvl = li2.lvl[1] + 3;
  }

  /* ---------------------------------------------------------------- Décor (partagé par le moteur et les rendus) */
  // [modèle, part, échelle min, échelle max]
  const DECOR_SET = {
    grass: [['tree', 0.35, 0.9, 1.3], ['bush', 0.65, 0.8, 1.3]],
    field: [['wheat', 0.55, 0.9, 1.4], ['tree', 0.2, 0.9, 1.2], ['bush', 0.25, 0.8, 1.2]],
    forest: [['oak', 0.55, 0.9, 1.5], ['mushroom', 0.25, 0.8, 1.5], ['bush', 0.2, 0.8, 1.2]],
    rock: [['rock', 0.6, 0.7, 1.8], ['spire', 0.4, 0.8, 1.5]],
    snow: [['pine', 0.55, 0.9, 1.5], ['ice', 0.45, 0.7, 1.4]],
  };
  const BORDER_SET = { grass: 'tree', field: 'tree', forest: 'oak', rock: 'spire', snow: 'pine' };
  const LOW_BORDER = { grass: 'bush', field: 'wheat', forest: 'mushroom', rock: 'rock', snow: 'ice' };
  // Rayon de collision (m) à l'échelle 1 ; 0 = on passe au travers (buissons, blé, herbe)
  const SOLID_R = { tree: 0.6, oak: 0.8, pine: 0.55, spire: 0.7, rock: 0.85, ice: 0.45, boulder: 0.95, log: 0.85, hay: 0.95, gem: 0.55, snowman: 0.55, shroom: 0.45 };

  function genDecor(m, r) {
    const type = m.decoType, set = DECOR_SET[type] || DECOR_SET.grass;
    const out = [];
    const avoid = [[m.zaap.x, m.zaap.y, 300], [m.npc.x, m.npc.y, 200], [m.lair.x, m.lair.y, 300], [m.door.x, m.door.y, 330], [m.well.x, m.well.y, 90]];
    for (const c of m.camps) avoid.push([c.x, c.y, 170]);
    for (const hs of m.houses) avoid.push([hs.x, hs.y, 160]);
    const blocked = (x, y, road = 70, isle = 60) => avoid.some(([ax, ay, rr]) => Math.hypot(ax - x, ay - y) < rr) ||
      !isleAt(m, x, y, isle) || inWater(m, x, y, 40, false) || roadDist(m, x, y) < road;
    const add = (kind, x, y, s) => out.push({ kind, x, y, s, ry: r() * Math.PI * 2 });
    const pick = () => { let k = r(); for (const d of set) { if (k < d[1]) return d; k -= d[1]; } return set[0]; };
    // Éléments isolés
    for (let cx = 0; cx < m.w; cx += 150) for (let cy = -m.h; cy < m.h; cy += 150) {
      if (r() > 0.42) continue;
      const x = cx + r() * 150, y = cy + r() * 150;
      if (blocked(x, y)) continue;
      const d = pick();
      add(d[0], x, y, d[2] + r() * (d[3] - d[2]));
    }
    // Bosquets serrés
    const big = set[0][0], small = (set.find((d) => ['bush', 'mushroom', 'ice', 'spire', 'wheat'].includes(d[0])) || set[set.length - 1])[0];
    const kk = type === 'rock' ? 0.55 : 1;
    for (let c = 0, t = 0; c < (type === 'forest' ? 80 : 50) && t < 1200; t++) {
      const cx = 400 + r() * (m.w - 800), cy = (r() * 2 - 1) * (m.h - 150);
      if (avoid.some(([ax, ay, rr]) => Math.hypot(ax - cx, ay - cy) < rr + 120) || roadDist(m, cx, cy) < 200 || inWater(m, cx, cy, 160, false) || !isleAt(m, cx, cy, 150)) continue;
      c++;
      const n = 7 + ((r() * 8) | 0);
      for (let k = 0; k < n; k++) {
        const a = r() * Math.PI * 2, rr = Math.sqrt(r()) * 210, x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
        if (blocked(x, y, 80, 50)) continue;
        add(rr < 150 ? big : small, x, y, (rr < 150 ? 1 + r() * 0.6 : 0.8 + r() * 0.4) * kk);
      }
    }
    // Bord des îles : grands arbres au nord, décor bas au sud (côté caméra)
    const tall = BORDER_SET[type] || 'tree', low = LOW_BORDER[type] || 'bush';
    for (const isl of m.isles) {
      const per = Math.PI * (isl.rx + isl.ry);
      for (let d = 0; d < per; d += 75) {
        const a = (d / per) * Math.PI * 2 + r() * 0.03;
        const [x, y] = edgePoint(isl, a, 0.86 + r() * 0.08);
        if (roadDist(m, x, y) < 120 || avoid.some(([ax, ay, rr]) => Math.hypot(ax - x, ay - y) < rr) || inWater(m, x, y, 40, false)) continue;
        if (Math.sin(a) < 0.2) add(tall, x, y, 1.1 + r() * 0.6);
        else if (r() < 0.7) add(low, x, y, 0.8 + r() * 0.4);
      }
    }
    // Accessoires propres à la zone
    const props = (kind, n, smin, smax, c) => {
      for (let k = 0, got = 0; k < n * 60 && got < n; k++) {
        const x = 300 + r() * (m.w - 600), y = (r() * 1.8 - 0.9) * m.h;
        if (blocked(x, y, 90, 40) || inWater(m, x, y, 110, false) || m.camps.some((cc) => Math.hypot(cc.x - x, cc.y - y) < 140)) continue;
        if (out.some((o) => SOLID_R[o.kind] && Math.hypot(o.x - x, o.y - y) < 60)) continue;
        out.push({ kind, x, y, s: smin + r() * (smax - smin), ry: r() * Math.PI * 2, c: c && c() });
        got++;
      }
    };
    if (type === 'forest') { props('log', 26, 0.9, 1.3); props('shroom', 30, 0.6, 1.5); }
    else if (type === 'rock') { props('boulder', 60, 0.35, 0.85, () => (r() < 0.5 ? '#9a8a6a' : '#7a6e5a')); props('gem', 22, 0.7, 1.3); }
    else if (type === 'snow') {
      props('mound', 50, 0.4, 0.9, () => '#f4f8fc');
      out.push({ kind: 'snowman', x: m.zaap.x + 260, y: 200, s: 1, ry: -0.4 }, { kind: 'snowman', x: m.zaap.x - 300, y: -120, s: 0.85, ry: 0.5 });
    } else { props('hay', type === 'field' ? 26 : 10, 0.8, 1.2); props('boulder', 12, 0.4, 0.9, () => '#9a948a'); }
    m.decor = out;
    // Obstacles : décor solide + zaap, puits, moulin, rochers de l'entrée du donjon
    const hub = m.isles[0];
    m.mill = (type === 'field' || type === 'grass') ? { x: hub.x - hub.rx * 0.35, y: -hub.ry * 0.62 } : null;
    m.solids = out.filter((o) => SOLID_R[o.kind]).map((o) => ({ x: o.x, y: o.y, r: SOLID_R[o.kind] * o.s * 32 }));
    m.solids.push({ x: m.zaap.x, y: m.zaap.y, r: 68 }, { x: m.well.x, y: m.well.y, r: 30 }, { x: m.door.x, y: m.door.y - 70, r: 95 });
    if (m.mill) m.solids.push({ x: m.mill.x, y: m.mill.y, r: 50 });
  }

  /** Grille des obstacles d'une carte (cases de 200 px), construite à la demande. */
  function solidGrid(m) {
    if (m._grid) return m._grid;
    const grid = new Map();
    for (const s of m.solids || []) {
      for (let gx = Math.floor((s.x - s.r) / 200); gx <= Math.floor((s.x + s.r) / 200); gx++)
        for (let gy = Math.floor((s.y - s.r) / 200); gy <= Math.floor((s.y + s.r) / 200); gy++) {
          const k = gx * 1000 + gy;
          if (!grid.has(k)) grid.set(k, []);
          grid.get(k).push(s);
        }
    }
    m._grid = grid;
    return grid;
  }

  const zones = ZONES.map((z, i) => {
    const r = rng(1000 + i * 77);
    const [l0, l1] = LEVELS[i];
    const m = {
      key: 'z' + i, kind: 'zone', zone: i, name: z.name, w: MAP_W, h: MAP_H, lvl: LEVELS[i], decoType: z.decoType,
      zaap: { x: 300, y: 0 },
      npc: { ...NPCS[i], x: 540, y: -30 },
      lair: { id: z.mini, kind: 'mini', x: MAP_W * 0.55, y: i % 2 ? 720 : -720, respawn: 150, lvl: l1 + 1 },
      door: { x: MAP_W - 260, y: 0 },
      camps: [],
    };
    genIslands(m, r, i);
    genDecor(m, rng(5000 + i * 31));
    // Donjon : quatre salles de monstres puis le gardien
    const d = {
      key: 'd' + i, kind: 'dungeon', zone: i, name: DUNGEONS[i], w: DJ_W, h: DJ_H, lvl: [l1 + 1, l1 + 4],
      exit: { x: 170, y: 0 },
      boss: { id: z.boss, kind: 'boss', x: DJ_W - 330, y: 0, respawn: Infinity, lvl: l1 + 5 },
      camps: [],
    };
    [700, 1150, 1600, 2050].forEach((x, k) => {
      const ids = [];
      const n = 5 + (k > 1 ? 1 : 0);
      for (let j = 0; j < n; j++) ids.push(z.monsters[(j + k) % z.monsters.length]);
      d.camps.push({ x, y: k % 2 ? 110 : -110, ids, lvl: l1 + 1 + (k >> 1) });
    });
    m.dungeon = d;
    return m;
  });

  /* ---------------------------------------------------------------- Histoire */
  // goal : { kill: id, n } ou { boss: id }. La première quête de chaque zone se reçoit en parlant au personnage.
  const Q = (zone, title, goal, intro, done, xp, kamas) => ({ zone, title, goal, intro, done, xp, kamas });
  const QUESTS = [
    Q(0, 'Premiers pas', { kill: 'pichon', n: 10 },
      ['Ah, enfin quelqu’un ! Je suis Oriel, le dernier gardien des zaaps.',
       'Une brume noire monte des glaces de Frigost. Elle éteint nos zaaps un à un et rend les créatures folles.',
       'Les pichons de la Calanque d’Astrub attaquent déjà les pêcheurs. Montre-moi ce que tu vaux : chasse 10 pichons. La calanque est l’île au nord-est, de l’autre côté du pont.'],
      ['Joli travail ! Garde l’équipement que tu trouves sur les monstres, il te sera utile.'], 60, 40),
    Q(0, 'Le roi des tofus', { boss: 'tofu_royal' },
      ['Le Tofu Royal s’est terré dans son nid, au cœur des Champs d’Astrub. Ses yeux brillent de brume.',
       'Va le calmer avant qu’il n’entraîne tous les tofus avec lui.'],
      ['Le Tofu Royal est retombé dans un profond sommeil. La brume recule un peu.'], 140, 80),
    Q(0, 'La Bergerie maudite', { boss: 'bouftou_royal' },
      ['La brume vient du Bouftou Royal. Il s’est retranché au fond de sa bergerie, cachée dans la Forêt d’Astrub, tout à l’est.',
       'Entre dans le donjon et bats-le : la route d’Amakna s’ouvrira.'],
      ['Le Bouftou Royal est tombé ! La route d’Amakna est ouverte. Margot, à la ferme, a besoin d’aide.'], 260, 150),

    Q(1, 'Invasion d’araknes', { kill: 'arakne', n: 10 },
      ['Tu viens d’Astrub ? Oriel m’a parlé de toi. Moi c’est Margot.',
       'Ici les bêtes sont bien plus coriaces qu’à Astrub. Les araknes envahissent mes champs : débarrasse-moi de 10 d’entre elles !'],
      ['Mes champs respirent enfin. Merci, l’ami !'], 200, 110),
    Q(1, 'Le Black Wabbit', { boss: 'black_wabbit' },
      ['Le Black Wabbit a pris possession d’un terrier, au cœur de la plaine. Il vole toutes mes cawottes !'],
      ['Mes cawottes sont sauvées ! Il reste le pire…'], 320, 180),
    Q(1, 'La Porcherie', { boss: 'dragon_cochon' },
      ['Un Dragon Cochon corrompu s’est installé dans la vieille porcherie, à l’est. C’est lui qui scelle la route de la forêt.'],
      ['Le Dragon Cochon est vaincu ! La forêt des Abraknydes s’ouvre. Sylvain le druide t’y attend.'], 480, 260),

    Q(2, 'Les âmes perdues', { kill: 'fantome', n: 12 },
      ['La forêt souffre… Je suis Sylvain. La brume réveille les esprits du Bois des fantômes.',
       'Renvoie 12 fantômes à leur repos éternel.'],
      ['Les esprits se taisent. Mais les arbres, eux, grondent encore.'], 380, 200),
    Q(2, 'L’Abraknyde Ancestral', { boss: 'abrak_ancestral' },
      ['Le plus vieil arbre de la forêt, l’Abraknyde Ancestral, est devenu fou. Apaise-le.'],
      ['L’Ancestral s’est rendormi. Il ne reste que le Chêne Mou.'], 560, 300),
    Q(2, 'Le Cœur pourri', { boss: 'chene_mou' },
      ['Au fond de la forêt, le Chêne Mou pourrit sous la brume. Ses racines forment un donjon : descends-y.'],
      ['La forêt est libérée ! Monte vers les Craqueleurs, Brakk le mineur te guidera.'], 760, 400),

    Q(3, 'Gelées en folie', { kill: 'gelee', n: 10 },
      ['Hé, toi ! Brakk, mineur. Les gelées des lacs débordent et bouchent le chemin des mines.',
       'Éclate-m’en 10 et on causera.'],
      ['Ha ! Voilà du solide.'], 620, 320),
    Q(3, 'Le Craqueleur des Plaines', { boss: 'craq_roc' },
      ['Un Craqueleur géant sème la panique dans la plaine de Cania. Arrête-le.'],
      ['Il ne bougera plus. Reste le Légendaire, dans son antre…'], 840, 420),
    Q(3, 'L’Antre du Légendaire', { boss: 'craq_legend' },
      ['Le Craqueleur Légendaire garde le col vers Frigost, au fond de son antre. La brume en a fait une montagne de colère.'],
      ['Le col est ouvert ! Frigost t’attend. Neva l’exploratrice campe près du zaap.'], 1100, 560),

    Q(4, 'Le froid mordant', { kill: 'mansot', n: 12 },
      ['Brr… Je suis Neva. La brume naît ici, sous la glace. Les mansots sont devenus agressifs.',
       'Ouvre-nous un passage : 12 mansots.'],
      ['Le chemin se dégage. Je sens la brume plus épaisse à l’est.'], 900, 460),
    Q(4, 'Le Mansot Royal', { boss: 'mansot_royal' },
      ['Le Mansot Royal règne sur la banquise et protège la source de la brume. Fais-le tomber.'],
      ['Plus rien ne protège l’Obsidiantre…'], 1200, 600),
    Q(4, 'La Caverne d’obsidienne', { boss: 'obsidiantre' },
      ['L’Obsidiantre, cœur d’obsidienne né de la brume, se dresse au fond de sa caverne.',
       'Si tu le brises, tous les zaaps se rallumeront.'],
      ['La brume se dissipe ! Partout, les zaaps se rallument. Le Monde des Douze te doit beaucoup, héros.',
       'Tu peux continuer à explorer : les monstres et les gardiens reviennent toujours…'], 2000, 1200),
  ];

  /** Zone accessible : la première, ou celle dont le gardien précédent est vaincu. */
  function unlocked(i, bossKilled) { return i === 0 || !!bossKilled[ZONES[i - 1].boss]; }

  /* ---------------------------------------------------------------- Équipement */
  const SLOTS = {
    arme: { label: 'Arme', names: ['Épée', 'Hache', 'Marteau', 'Bâton', 'Dague', 'Arc'], main: 'dmg', sub: 'crit' },
    coiffe: { label: 'Coiffe', names: ['Coiffe', 'Chapeau', 'Casque'], main: 'hp', sub: 'armor' },
    cape: { label: 'Cape', names: ['Cape', 'Capuche'], main: 'speed', sub: 'cd' },
    amulette: { label: 'Amulette', names: ['Amulette', 'Collier'], main: 'cd', sub: 'dmg' },
    anneau: { label: 'Anneau', names: ['Anneau', 'Bague'], main: 'crit', sub: 'dmg' },
    bottes: { label: 'Bottes', names: ['Bottes', 'Sandales'], main: 'speed', sub: 'hp' },
  };
  const SETS = ['du Bouftou', 'du Sanglier', 'de l’Abraknyde', 'du Craqueleur', 'du Mansot'];
  const STATS = {
    dmg: { base: 0.05, label: 'dégâts' }, hp: { base: 0.06, label: 'vie' }, speed: { base: 0.02, label: 'vitesse' },
    crit: { base: 0.012, label: 'critique' }, cd: { base: 0.02, label: 'recharge', minus: true }, armor: { base: 0.015, label: 'résistance' },
  };
  const RARITY = [
    { id: 'commun', name: 'Commun', color: '#d0d0d0', mul: 1, w: 62 },
    { id: 'rare', name: 'Rare', color: '#4fc3f7', mul: 1.35, w: 27 },
    { id: 'epique', name: 'Épique', color: '#b46cff', mul: 1.75, w: 9 },
    { id: 'legendaire', name: 'Légendaire', color: '#ffb347', mul: 2.3, w: 2 },
  ];

  /** Objet tiré au hasard : sa force dépend du niveau du monstre et de sa rareté. minRarity : 0 à 3. */
  function makeItem(lvl, zone, minRarity = 0) {
    const ids = Object.keys(SLOTS), slot = ids[(Math.random() * ids.length) | 0], s = SLOTS[slot];
    let roll = Math.random() * 100, ri = 0;
    for (; ri < RARITY.length - 1; ri++) { if (roll < RARITY[ri].w) break; roll -= RARITY[ri].w; }
    ri = Math.max(ri, minRarity);
    const rar = RARITY[ri];
    const k = (0.6 + lvl / 8) * rar.mul;
    const stats = {};
    const val = (st, f) => Math.round(STATS[st].base * k * f * (0.85 + Math.random() * 0.3) * 1000) / 1000;
    stats[s.main] = val(s.main, 1);
    stats[s.sub] = (stats[s.sub] || 0) + val(s.sub, 0.5);
    if (ri >= 2) { const extra = Object.keys(STATS)[(Math.random() * 6) | 0]; stats[extra] = (stats[extra] || 0) + val(extra, 0.4); }
    // Plafonds pour éviter les excès (recharge et critique)
    if (stats.cd) stats.cd = Math.min(stats.cd, 0.3);
    if (stats.crit) stats.crit = Math.min(stats.crit, 0.25);
    const name = s.names[(Math.random() * s.names.length) | 0] + ' ' + SETS[Math.min(4, zone)];
    return { slot, name, rarity: rar.id, color: rar.color, lvl, stats, power: itemPower(stats) };
  }
  function itemPower(stats) { let p = 0; for (const k in stats) p += stats[k] / STATS[k].base; return Math.round(p * 10) / 10; }
  function itemDesc(it) {
    return Object.keys(it.stats).map((k) => `${STATS[k].minus ? '−' : '+'}${Math.round(it.stats[k] * 1000) / 10}% ${STATS[k].label}`).join(' · ');
  }

  /* ---------------------------------------------------------------- Caractéristiques et talents */
  const CARACS = {
    vitalite: { name: 'Vitalité', short: 'VIT', color: '#e8574a', help: '+1 point de vie par point' },
    sagesse: { name: 'Sagesse', short: 'SAG', color: '#b46cff', help: '+1 % d’expérience par point' },
    force: { name: 'Force', short: 'FOR', color: '#b07a3a', elem: 'terre', help: '+1 % de dégâts Terre par point' },
    intelligence: { name: 'Intelligence', short: 'INT', color: '#ff7a3a', elem: 'feu', help: '+1 % de dégâts Feu et de soins par point' },
    chance: { name: 'Chance', short: 'CHA', color: '#3aa8e8', elem: 'eau', help: '+1 % de dégâts Eau par point, +1 % de butin pour 10' },
    agilite: { name: 'Agilité', short: 'AGI', color: '#4fc36a', elem: 'air', help: '+1 % de dégâts Air par point, esquive et critiques' },
  };
  const ELEMENTS = {
    terre: { name: 'Terre', stat: 'force', color: '#b07a3a' },
    feu: { name: 'Feu', stat: 'intelligence', color: '#ff7a3a' },
    eau: { name: 'Eau', stat: 'chance', color: '#3aa8e8' },
    air: { name: 'Air', stat: 'agilite', color: '#4fc36a' },
  };
  // Élément de chaque sort : il ne monte qu'avec la caractéristique de cet élément
  const SPELL_ELEM = {
    pression: 'terre', epee_celeste: 'air', colere_iop: 'terre', epee_jugement: 'feu',
    fleche_magique: 'air', fleche_explosive: 'feu', fleche_recul: 'air', pluie_fleches: 'feu',
    bulle: 'eau', glyphe_enflamme: 'feu', armure_terrestre: 'terre', glyphe_aveuglement: 'eau',
    mot_blessant: 'feu', mot_soignant: 'feu', mot_interdit: 'feu', mot_frayeur: 'air',
    piege_sournois: 'feu', coup_sournois: 'air', poison_insidieux: 'air', double: 'air',
    aiguille: 'feu', ralentissement: 'eau', poussiere_temporelle: 'feu', frappe_xelor: 'eau',
    fouet: 'air', invoc_bouftou: 'terre', invoc_tofu: 'air', corbeau_noir: 'air',
    chatiment: 'terre', assaut: 'terre', transfert_vie: 'feu', attirance: 'air',
    lancer_pieces: 'eau', pelle_animee: 'terre', pelle_jugement: 'terre', corruption: 'eau',
    bombe_explosive: 'feu', tromblon: 'feu', pulsar: 'eau', kaboom: 'feu',
    pile_ou_face: 'eau', griffe_joueuse: 'air', roulette: 'feu', bond_felin: 'terre',
    poing_enflamme: 'feu', flasque_explosive: 'feu', gueule_de_bois: 'terre', lait_bambou: 'eau',
    ronces: 'terre', poison_paralysant: 'air', ronces_agressives: 'terre', tremblement: 'terre',
  };
  const STAT_PER_LEVEL = 5;
  /** Coût du prochain point dans une caractéristique déjà à la valeur v (paliers de Dofus Rétro). */
  function caracCost(id, v) {
    if (id === 'vitalite') return 1;
    if (id === 'sagesse') return 3;
    return v < 100 ? 1 : v < 200 ? 2 : v < 300 ? 3 : 4;
  }
  function caracSpent(c) {
    let s = 0;
    for (const id in CARACS) for (let v = 0; v < (c[id] || 0); v++) s += caracCost(id, v);
    return s;
  }
  // Talents : 1 point par niveau. Le premier sort est offert ; les suivants s'ouvrent après
  // un nombre de points dépensés dans l'arbre ; chaque rang demande un niveau minimum.
  const SPELL_GATE = [0, 5, 15, 30];
  const RANK_LEVEL = [0, 1, 5, 20, 45, 80];
  const TALENT_PASSIVES = {
    pa: { name: 'Points d’action', short: 'PA', color: '#f2c14e', desc: '−3 % de recharge des sorts', max: 15 },
    resistance: { name: 'Résistance', short: 'RES', color: '#9aa8b8', desc: '−3 % de dégâts subis', max: 15 },
    soin: { name: 'Récupération', short: 'REC', color: '#7dff9a', desc: '+0,5 PV par seconde', max: 15 },
    prospection: { name: 'Ramassage', short: 'RAM', color: '#ffd84a', desc: '+15 % de rayon de ramassage', max: 15 },
    envergure: { name: 'Envergure', short: 'ENV', color: '#ff9a5a', desc: '+4 % de taille des zones', max: 15 },
    celerite: { name: 'Célérité', short: 'CEL', color: '#4fc3c7', desc: '+2 % de vitesse de déplacement', max: 15 },
  };
  /** Niveau minimum pour entrer dans le donjon de chaque zone. */
  const DUNGEON_LEVEL = [35, 75, 115, 155, 195];
  const CHAR = { CARACS, ELEMENTS, SPELL_ELEM, STAT_PER_LEVEL, caracCost, caracSpent, SPELL_GATE, RANK_LEVEL, TALENT_PASSIVES, DUNGEON_LEVEL };

  /* ---------------------------------------------------------------- Dessin de la carte */
  /**
   * Dessine le terrain d'une carte (sol, chemins, eau, ponts, maisons) dans un canevas
   * de Wd × Hd pixels. Renvoie les fonctions de conversion X(x), Y(y).
   */
  function drawMap(g, m, Wd, Hd) {
    const sx = Wd / m.w, sy = Hd / (m.h * 2), s = Math.min(sx, sy);
    const X = (x) => x * sx, Y = (y) => (y + m.h) * sy;
    const z = ZONES[m.zone];
    if (m.kind === 'dungeon') {
      g.fillStyle = '#3a3346'; g.fillRect(0, 0, Wd, Hd);
      g.fillStyle = '#241d30'; g.fillRect(0, 0, Wd, Math.max(2, Hd * 0.05));
      return { X, Y, s };
    }
    // Ciel, puis chaque île (falaise décalée dessous) et les ponts
    g.fillStyle = m.decoType === 'snow' ? '#c8def0' : '#9fd2f2'; g.fillRect(0, 0, Wd, Hd);
    const islePath = (isl, dy = 0) => {
      g.beginPath();
      for (let k = 0; k <= 72; k++) { const a = (k / 72) * Math.PI * 2, w = wob(isl, a); const x = X(isl.x + Math.cos(a) * isl.rx * w), y = Y(isl.y + Math.sin(a) * isl.ry * w) + dy; k ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.closePath();
    };
    for (const isl of m.isles) { g.fillStyle = '#6a5240'; islePath(isl, Math.max(2, 50 * sy)); g.fill(); }
    g.lineCap = 'butt';
    for (const b of m.spans) {
      g.strokeStyle = '#8a5a2a'; g.lineWidth = Math.max(2, b.w * s * 0.8);
      g.beginPath(); g.moveTo(X(b.ax), Y(b.ay)); g.lineTo(X(b.bx), Y(b.by)); g.stroke();
    }
    g.save();
    g.beginPath();
    for (const isl of m.isles) for (let k = 0; k <= 72; k++) { const a = (k / 72) * Math.PI * 2, w = wob(isl, a); const x = X(isl.x + Math.cos(a) * isl.rx * w), y = Y(isl.y + Math.sin(a) * isl.ry * w); k ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.fillStyle = z.ground; g.fill();
    g.clip();
    g.fillStyle = z.ground2;
    const r = rng(9000 + m.zone);
    for (let k = 0; k < 140; k++) { g.beginPath(); g.arc(r() * Wd, r() * Hd, (6 + r() * 16) * s * 6, 0, Math.PI * 2); g.fill(); }
    const [rc, re] = ROAD_COL[m.decoType] || ROAD_COL.grass;
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const [col, wd] of [[re, 96], [rc, 70]]) {
      g.strokeStyle = col; g.lineWidth = Math.max(1.5, wd * s);
      for (const road of m.roads) { g.beginPath(); road.forEach(([x, y], i) => (i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y)))); g.stroke(); }
      g.fillStyle = col;
      g.beginPath(); g.ellipse(X(m.plaza.x), Y(m.plaza.y), (m.plaza.r + (wd - 70) / 2) * sx, (m.plaza.r + (wd - 70) / 2) * sy, 0, 0, Math.PI * 2); g.fill();
    }
    for (const pass of ['rim', 'fill']) for (const w of m.water) {
      const k = WATER_KIND[w.kind], pad = pass === 'rim' ? 16 : 0;
      g.fillStyle = k[pass];
      g.beginPath(); g.ellipse(X(w.x), Y(w.y), (w.rx + pad) * sx, (w.ry + pad) * sy, 0, 0, Math.PI * 2); g.fill();
    }
    for (const b of m.bridges) {
      g.fillStyle = '#8a5a2a';
      g.fillRect(X(b.x - b.len / 2), Y(b.y - 50), b.len * sx, 100 * sy);
      g.fillStyle = '#b07a3a';
      g.fillRect(X(b.x - b.len / 2), Y(b.y - 36), b.len * sx, 72 * sy);
    }
    for (const hs of m.houses) {
      g.fillStyle = '#e8dcc0'; g.fillRect(X(hs.x - 70), Y(hs.y - 55), 140 * sx, 110 * sy);
      g.fillStyle = hs.roof; g.fillRect(X(hs.x - 80), Y(hs.y - 65), 160 * sx, 70 * sy);
    }
    g.restore();
    return { X, Y, s };
  }

  return { zones, QUESTS, NPCS, LEVELS, unlocked, SOLID_R, SLOTS, RARITY, makeItem, itemDesc, isleAt, isleE, wob, edgePoint, walkable, walk, onBridge,
    WATER_KIND, ROAD_COL, roadDist, inWater, collide, drawMap, ...CHAR };
})();
