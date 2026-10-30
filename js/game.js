'use strict';
// Moteur de jeu : boucle, entrées, sorts, monstres, rendu canvas.

const Game = (() => {
  let canvas, ctx, W = 0, H = 0, dpr = 1, zoom = 1;
  let S = null;          // état de la partie en cours
  let raf = 0, lastT = 0, paused = false, cb = {};
  let hudTimer = 0;
  const keys = Object.create(null);
  const joy = { id: null, sx: 0, sy: 0, x: 0, y: 0 };

  const MAX_ENEMIES = 380;
  // Classes dessinées avec des planches de sprites (k = échelle d'affichage).
  // Classes dessinées avec des planches de sprites (course, attente, attaque ; k = échelle d'affichage).
  const SPRITE_CLASSES = Object.fromEntries(Object.keys(CLASSES).map((id) =>
    [id, { run: id + '_run', idle: id + '_idle', attack: id + '_attack', k: 0.8 }]));
  // Sorts qui déclenchent l'animation d'attaque du personnage.
  const ATTACK_TYPES = new Set(['projectile', 'melee', 'nova', 'strike', 'trap', 'glyph', 'dash']);
  const GOD_MODE = /[?&]debug\b/.test(location.search); // invincibilité pour les tests
  // ?debug&wave=N : commence la partie à la vague N (tests du boss final)
  const START_WAVE = GOD_MODE ? Math.max(1, +(location.search.match(/[?&]wave=(\d+)/) || [])[1] || 1) : 1;
  // Rythme façon ZaapRush : une vague toutes les 22 s, boss intermédiaires aux vagues 14 et 27,
  // boss final à la vague 40 puis toutes les 15 vagues (+15 % de PV à chaque retour).
  const WAVE_LEN = 22, FINAL_WAVE = 40, BOSS_RETURN = 15, BOSS_HP_STEP = 0.15;
  const MINI_WAVES = [{ wave: 14, hp: 1 }, { wave: 27, hp: 1.8 }];
  const DOFUS_CHANCE = [0.01, 0.005]; // 1 % + 0,5 % par boss final battu sans le Dofus

  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const d2 = (ax, ay, bx, by) => (ax - bx) * (ax - bx) + (ay - by) * (ay - by);

  function hash(x, y, s) {
    let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 982451653)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  // ------------------------------------------------------------ Initialisation
  function init(c, callbacks) {
    canvas = c;
    ctx = c.getContext('2d');
    cb = callbacks;
    resize();
    addEventListener('resize', resize);
    addEventListener('keydown', (e) => {
      keys[e.code] = true;
      if ((e.code === 'Escape' || e.code === 'KeyP') && S && !S.over) cb.onPauseKey();
    });
    addEventListener('keyup', (e) => { keys[e.code] = false; });
    addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && S && !S.over && !paused) cb.onPauseKey();
    });

    canvas.addEventListener('pointerdown', (e) => {
      if (joy.id !== null) return;
      joy.id = e.pointerId; joy.sx = joy.x = e.clientX; joy.sy = joy.y = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerId !== joy.id) return;
      joy.x = e.clientX; joy.y = e.clientY;
    });
    const end = (e) => { if (e.pointerId === joy.id) joy.id = null; };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
  }

  // ------------------------------------------------------------ Sprites
  // Planches générées par tools/sprites (js/sprites.js). Tant qu'une planche n'est pas chargée,
  // le dessin vectoriel d'origine sert de repli.
  const sheets = {}, loading = {};
  // Renvoie la planche si elle est chargée ; sinon lance son chargement et renvoie null.
  function sheet(name) {
    if (sheets[name]) return sheets[name];
    if (!loading[name] && typeof SPRITE_SHEETS !== 'undefined' && SPRITE_SHEETS[name]) {
      loading[name] = true;
      const m = SPRITE_SHEETS[name], img = new Image();
      img.onload = () => { sheets[name] = { ...m, img }; };
      img.src = m.src;
    }
    return null;
  }

  // Précharge les planches utiles à une partie (monstres de la zone, classe jouée).
  function preloadSprites(zone, clsId) {
    const names = [...zone.monsters, zone.mini, zone.boss].map((id) => MONSTERS[id].sprite).filter(Boolean);
    const c = SPRITE_CLASSES[clsId];
    if (c) names.push(c.run, c.idle, c.attack);
    for (const n of names) { sheet(n); sheet(n + '_attack'); }
    if (c) sheet(c.attack);
  }

  // angle : direction regardée (repère écran), time : secondes d'animation, k : échelle d'affichage.
  function drawSprite(name, x, y, angle, time, k, flash) {
    const s = sheet(name);
    if (!s) return false;
    const row = ((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8;
    const col = Math.floor(time * s.fps) % s.frames;
    const w = (s.frameW * k) / (s.res || 1), h = (s.frameH * k) / (s.res || 1); // une planche fine (res) s'affiche à la même taille
    if (flash) ctx.filter = 'brightness(3) saturate(0)';
    ctx.drawImage(s.img, col * s.frameW, row * s.frameH, s.frameW, s.frameH, x - w * s.anchorX, y - h * s.anchorY, w, h);
    if (flash) ctx.filter = 'none';
    return true;
  }

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    zoom = clamp(Math.min(W, H) / 640, 0.62, 1.15);
  }

  // ------------------------------------------------------------ Statistiques
  function metaStats(save) {
    const st = { dmg: 1, cd: 1, area: 1, crit: 0.05, critDmg: 2, xp: 1, pickup: 85, regen: 0, armor: 0, speed: 1, kamas: 1, hp: 1,
      drop: 1, card4: 0, dodge: 0, spellDmg: 1 };
    const u = save.upgrades;
    st.hp *= 1 + 0.06 * (u.vitalite || 0);
    st.dmg *= 1 + 0.05 * (u.force || 0);
    st.speed *= 1 + 0.03 * (u.agilite || 0);
    st.xp *= 1 + 0.06 * (u.sagesse || 0);
    st.kamas *= 1 + 0.1 * (u.prospection || 0);
    st.cd *= 1 - 0.03 * (u.pa || 0);
    // Dofus : effets repris de ZaapRush, adaptés aux statistiques du jeu
    for (const id of save.dofus) {
      switch (id) {
        case 'dofawa': st.hp *= 1.12; break;
        case 'cawotte': st.xp *= 1.2; break;
        case 'turquoise': st.critDmg += 0.5; break;
        case 'emeraude': st.hp *= 1.35; break;
        case 'kaliptus': st.drop *= 1.5; break;
        case 'pourpre': st.dmg *= 1.25; break;
        case 'vulbis': st.card4 += 0.2; st.dodge += 0.05; break;
        case 'ebene': st.spellDmg *= 1.25; break;
        case 'ivoire': st.area *= 1.2; break;
      }
    }
    return st;
  }

  function recomputeStats() {
    const st = Object.assign({}, S.meta);
    const P = S.passives;
    st.hp *= 1 + 0.2 * (P.vitalite || 0);
    st.dmg *= 1 + 0.1 * (P.force || 0);
    st.speed *= 1 + 0.08 * (P.agilite || 0);
    st.area *= 1 + 0.1 * (P.intelligence || 0);
    st.xp *= 1 + 0.12 * (P.sagesse || 0);
    st.crit += 0.05 * (P.chance || 0);
    st.drop *= 1 + 0.3 * (P.prospection || 0);
    st.cd *= Math.pow(0.93, P.pa || 0);
    st.regen += 0.5 * (P.soin || 0);
    for (const b of equipBonuses()) {
      for (const k in b) {
        if (k === 'crit' || k === 'regen') st[k] += b[k];
        else if (k === 'cd') st.cd *= 1 - b[k];
        else st[k] *= 1 + b[k];
      }
    }
    S.stats = st;
    const newMax = Math.round(CLASSES[S.cls].hp * st.hp);
    if (S.p.maxHp) S.p.hp += Math.max(0, newMax - S.p.maxHp);
    S.p.maxHp = newMax;
    S.p.hp = Math.min(S.p.hp, newMax);
  }

  // ------------------------------------------------------------ Équipements (pour la partie)
  // Objets lâchés par chaque monstre : communs d'un côté, rares de l'autre.
  const DROPS = {};
  for (const [id, it] of Object.entries(ITEMS)) {
    for (const m of it.from) {
      DROPS[m] = DROPS[m] || { common: [], rare: [] };
      DROPS[m][it.rare ? 'rare' : 'common'].push(id);
    }
  }
  const DROP_CHANCE = 0.012, RARE_CHANCE = 0.0008;

  // Bonus des objets portés, puis des panoplies (cumulés par palier atteint).
  function equipBonuses() {
    const out = [], count = {};
    for (const id of Object.values(S.items)) {
      const it = ITEMS[id];
      out.push(it.bonus);
      if (it.set) count[it.set] = (count[it.set] || 0) + 1;
    }
    for (const [set, n] of Object.entries(count)) {
      for (const [need, b] of Object.entries(SETS[set].bonus)) if (n >= +need) out.push(b);
    }
    return out;
  }

  const itemScore = (id) => Object.entries(ITEMS[id].bonus)
    .reduce((t, [k, v]) => t + v * (k === 'crit' ? 2 : k === 'regen' ? 0.2 : 1), ITEMS[id].rare ? 0.05 : 0);

  // Objet ramassé : équipé s'il vaut mieux que celui de l'emplacement, sinon revendu en kamas.
  function equipItem(id) {
    const it = ITEMS[id], cur = S.items[it.slot];
    if (cur && (cur === id || itemScore(cur) > itemScore(id))) {
      const k = Math.ceil(15 * S.zone.kamas);
      S.kamas += k;
      addText(S.p.x, S.p.y - 40, it.name + ' : +' + k + ' K', '#ffd84a', true);
      return;
    }
    S.items[it.slot] = id;
    recomputeStats();
    let sub = bonusText(it.bonus);
    if (it.set) {
      const n = Object.values(S.items).filter((o) => ITEMS[o].set === it.set).length;
      if (SETS[it.set].bonus[n]) sub += ' · ' + SETS[it.set].name + ' (' + n + ') : ' + bonusText(SETS[it.set].bonus[n]);
    }
    banner(it.name, sub);
  }

  // Bandeau d'annonce. Un bandeau important (boss vaincu, zaap, Dofus) reste 3 s à l'écran :
  // pendant ce temps, les annonces ordinaires passent en texte flottant.
  function banner(title, sub, important) {
    if (!important && S.t < (S.bannerLock || 0)) { addText(S.p.x, S.p.y - 50, title, '#ffe7a0', true); return; }
    if (important) S.bannerLock = S.t + 3;
    cb.onBanner(title, sub);
  }

  function dropItems(e) {
    const pool = DROPS[e.id], z = S.zone;
    let id = null;
    if (e.kind === 'boss') {
      // le boss final lâche toujours une pièce rare de sa zone
      const rares = z.monsters.flatMap((m) => (DROPS[m] ? DROPS[m].rare : []));
      if (rares.length) id = pick(rares);
    } else if (pool && !e.boss) {
      if (pool.rare.length && Math.random() < RARE_CHANCE * S.stats.drop) id = pick(pool.rare);
      else if (pool.common.length && Math.random() < DROP_CHANCE * S.stats.drop) id = pick(pool.common);
    }
    if (id) S.gems.push({ kind: 'item', id, x: e.x, y: e.y, v: 0 });
  }

  function spellStats(sp) {
    const def = SPELLS[sp.id];
    const s = Object.assign({}, def.base);
    if (s.dmg && sp.id !== CLASSES[S.cls].spells[0]) s.dmg *= S.meta.spellDmg; // Dofus Ébène
    const apply = (u) => {
      if (u.m) for (const k in u.m) s[k] = (s[k] || 0) * u.m[k];
      if (u.a) for (const k in u.a) s[k] = (s[k] || 0) + u.a[k];
    };
    // un rang par carte « Améliorer » choisie, puis les valeurs de la branche d'Éveil
    for (const k in sp.picks) {
      const st = RANK_STEPS[k], n = sp.picks[k];
      if (st.m) s[k] = (s[k] || 0) * Math.pow(st.m, n);
      if (st.a) s[k] = (s[k] || 0) + st.a * n;
    }
    if (sp.branch) apply(branchesOf(def).find((b) => b.key === sp.branch));
    return s;
  }

  function addSpell(id) {
    const sp = { id, lvl: 1, picks: {}, timer: 0.3, angle: 0, minions: [] };
    sp.s = spellStats(sp);
    S.spells.push(sp);
  }

  // ------------------------------------------------------------ Démarrage / arrêt
  function start(clsId, zoneIdx, save) {
    const cls = CLASSES[clsId];
    S = {
      cls: clsId, zone: ZONES[zoneIdx], zoneIdx, save,
      t: 0, kills: 0, kamas: 0, level: 1, xp: 0, xpNext: xpFor(1),
      p: { x: 0, y: 0, r: 14, hp: 0, maxHp: 0, face: 1, dirX: 1, dirY: 0, shield: 0, hurt: 0, inv: 0, walk: 0,
           revive: save.upgrades.resurrection ? 1 : 0 },
      meta: metaStats(save), stats: null, passives: {}, spells: [],
      enemies: [], projs: [], eprojs: [], gems: [], fx: [], texts: [], traps: [], glyphs: [], strikes: [],
      buffs: [], items: {}, rerolls: 2, bans: 1, banned: new Set(),
      spawnAcc: 0, nextHorde: 60, wave: 1, miniIdx: 0, nextFinal: FINAL_WAVE, bossKills: 0, boss: null, pending: 0, choosing: false,
      found: [], over: false, endTimer: -1, victory: false, grid: new Map(),
    };
    if (START_WAVE > 1) {
      S.t = (START_WAVE - 1) * WAVE_LEN; S.wave = START_WAVE; S.nextHorde = S.t + 60;
      S.miniIdx = MINI_WAVES.filter((m) => m.wave < START_WAVE).length;
    }
    recomputeStats();
    preloadSprites(S.zone, clsId);
    S.p.hp = S.p.maxHp;
    addSpell(cls.spells[0]);
    paused = false;
    lastT = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
    cb.onBanner(S.zone.name, 'Survivez et vainquez ' + MONSTERS[S.zone.boss].name + ' !');
  }

  function stop() { cancelAnimationFrame(raf); S = null; }
  function setPaused(v) { paused = v; if (!v) lastT = performance.now(); }

  function xpFor(lvl) { return Math.floor(3 + lvl * 2.5 + Math.pow(lvl, 1.6)); }

  // ------------------------------------------------------------ Boucle
  function loop(now) {
    raf = requestAnimationFrame(loop);
    let dt = (now - lastT) / 1000;
    lastT = now;
    if (dt > 0.05) dt = 0.05;
    if (!S) return;
    if (!paused && !S.choosing) update(dt);
    render();
    hudTimer -= dt;
    if (hudTimer <= 0) { hudTimer = 0.1; cb.onHud(hudData()); }
  }

  function hudData() {
    return {
      hp: S.p.hp, maxHp: S.p.maxHp, shield: S.p.shield, xp: S.xp, xpNext: S.xpNext, level: S.level,
      t: S.t, wave: S.wave, kills: S.kills, kamas: Math.floor(S.kamas), spells: S.spells, passives: S.passives, items: S.items,
      boss: S.boss && !S.boss.dead ? { name: S.boss.def.name, hp: S.boss.hp, maxHp: S.boss.maxHp } : null,
    };
  }

  function update(dt) {
    S.t += dt;
    updatePlayer(dt);
    buildGrid();
    spawn(dt);
    updateSpells(dt);
    updateEnemies(dt);
    updateProjectiles(dt);
    updateZones(dt);
    updateGems(dt);
    updateFx(dt);

    if (S.pending > 0 && !S.choosing && !S.over) {
      S.choosing = true;
      cb.onLevelUp(genChoices());
    }
    if (S.endTimer >= 0) {
      S.endTimer -= dt;
      if (S.endTimer < 0) finish();
    }
  }

  // ------------------------------------------------------------ Joueur
  function updatePlayer(dt) {
    const p = S.p;
    let mx = 0, my = 0;
    if (keys.KeyW || keys.ArrowUp) my -= 1;
    if (keys.KeyS || keys.ArrowDown) my += 1;
    if (keys.KeyA || keys.ArrowLeft) mx -= 1;
    if (keys.KeyD || keys.ArrowRight) mx += 1;
    if (joy.id !== null) {
      const jx = joy.x - joy.sx, jy = joy.y - joy.sy, l = Math.hypot(jx, jy);
      if (l > 8) { const k = Math.min(1, l / 50) / l; mx = jx * k; my = jy * k; }
    }
    const l = Math.hypot(mx, my);
    if (l > 1) { mx /= l; my /= l; }
    if (l > 0.05) {
      const sp = CLASSES[S.cls].speed * S.stats.speed * (1 + buffPow('spd'));
      p.x += mx * sp * dt; p.y += my * sp * dt;
      const n = Math.hypot(mx, my);
      p.dirX = mx / n; p.dirY = my / n;
      if (Math.abs(mx) > 0.1) p.face = mx > 0 ? 1 : -1;
      p.walk += dt * 10;
    }
    p.moving = l > 0.05;
    p.hurt = Math.max(0, p.hurt - dt);
    p.inv = Math.max(0, p.inv - dt);
    if (S.stats.regen && p.hp > 0) p.hp = Math.min(p.maxHp, p.hp + S.stats.regen * dt);
  }

  function damagePlayer(d) {
    const p = S.p;
    if (S.over || p.hp <= 0 || GOD_MODE) return;
    if (S.stats.dodge && Math.random() < S.stats.dodge) { addText(p.x, p.y - 30, 'Esquive', '#b8e0ff'); return; }
    d *= 1 - S.stats.armor;
    if (p.shield > 0) {
      const a = Math.min(p.shield, d);
      p.shield -= a; d -= a;
    }
    if (d <= 0) return;
    let lost = 0;
    for (const g of S.glyphs) if (g.stack && lost < 3) { g.life = 0; lost++; }
    p.hp -= d;
    p.hurt = 0.15;
    if (p.hp <= 0) {
      if (p.revive > 0) {
        p.revive--;
        p.hp = p.maxHp * 0.5;
        S.fx.push({ type: 'ring', x: p.x, y: p.y, r: 220, t: 0, life: 0.6, color: '#fff6a0' });
        for (const e of S.enemies) if (!e.boss) knock(e, p.x, p.y, 200);
        cb.onBanner('Résurrection !', '');
      } else {
        p.hp = 0;
        S.over = true;
        S.endTimer = 1.2;
      }
    }
  }

  // ------------------------------------------------------------ Grille spatiale
  const CELL = 64;
  function buildGrid() {
    const g = S.grid;
    g.clear();
    for (const e of S.enemies) {
      const k = ((e.x / CELL) | 0) + ',' + ((e.y / CELL) | 0);
      let c = g.get(k);
      if (!c) g.set(k, (c = []));
      c.push(e);
    }
  }
  function query(x, y, r, fn) {
    const x0 = Math.floor((x - r) / CELL) - 1, x1 = Math.floor((x + r) / CELL) + 1;
    const y0 = Math.floor((y - r) / CELL) - 1, y1 = Math.floor((y + r) / CELL) + 1;
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const c = S.grid.get(cx + ',' + cy);
        if (!c) continue;
        for (const e of c) {
          if (e.dead) continue;
          const rr = r + e.r;
          if (d2(x, y, e.x, e.y) <= rr * rr) fn(e);
        }
      }
    }
  }
  // Centres de n groupes d'ennemis à portée : les ennemis qui ont le plus de voisins dans un rayon r,
  // en évitant de poser deux zones l'une sur l'autre.
  function crowdSpots(x, y, range, r, n) {
    const cands = nearest(x, y, range, 20);
    const scored = cands.map((c) => ({ c, k: cands.filter((o) => d2(c.x, c.y, o.x, o.y) <= r * r).length })).sort((a, b) => b.k - a.k);
    const out = [];
    for (const { c } of scored) {
      if (out.length >= n) break;
      if (out.every((o) => d2(o.x, o.y, c.x, c.y) > r * r)) out.push({ x: c.x, y: c.y });
    }
    return out;
  }

  function nearest(x, y, range, n) {
    const out = [];
    const r2 = range * range;
    for (const e of S.enemies) {
      if (e.dead) continue;
      const dd = d2(x, y, e.x, e.y);
      if (dd <= r2) out.push([dd, e]);
    }
    out.sort((a, b) => a[0] - b[0]);
    return out.slice(0, n).map((o) => o[1]);
  }

  // ------------------------------------------------------------ Apparition des monstres
  function viewRadius() { return Math.hypot(W, H) / 2 / zoom + 50; }

  function spawnEnemy(id, x, y, hpMul = 1) {
    const def = MONSTERS[id], z = S.zone;
    const scale = def.boss ? 1 : 1 + S.t / 300;
    if (x === undefined) {
      const a = rand(0, Math.PI * 2), R = viewRadius();
      x = S.p.x + Math.cos(a) * R; y = S.p.y + Math.sin(a) * R;
    }
    const hp = def.hp * z.hpMul * scale * hpMul;
    const e = {
      id, def, x, y, r: def.r, hp, maxHp: hp, speed: def.speed * rand(0.9, 1.1),
      dmg: def.dmg * z.dmgMul * (1 + S.t / 550), xp: def.xp, boss: def.boss || 0,
      kvx: 0, kvy: 0, slow: 0, slowT: 0, poison: 0, poisonT: 0, poisonAcc: 0, atk: 0, flash: 0,
      seed: Math.random() * 10, shot: rand(1, 2), hitT: {}, ab: 3, charge: 0, cx: 0, cy: 0,
    };
    S.enemies.push(e);
    return e;
  }

  function spawn(dt) {
    if (S.over) return;
    const z = S.zone, t = S.t;
    const wave = 1 + Math.floor(t / WAVE_LEN);
    if (wave !== S.wave) S.wave = wave;
    const avail = z.monsters.slice(0, Math.min(z.monsters.length, 1 + Math.floor(t / 40)));
    // le boss final arrive presque seul : les apparitions ralentissent tant qu'il est en vie
    const finalAlive = S.boss && !S.boss.dead && S.boss.kind === 'boss';
    const rate = (0.9 + t / 45) * (finalAlive ? 0.3 : 1);
    S.spawnAcc += rate * dt;
    while (S.spawnAcc >= 1) {
      S.spawnAcc -= 1;
      if (S.enemies.length < MAX_ENEMIES) spawnEnemy(pick(avail));
    }
    if (t >= S.nextHorde && !finalAlive) {
      S.nextHorde += 60;
      const id = pick(avail), n = Math.floor(14 + t / 25), R = viewRadius() - 20;
      for (let i = 0; i < n && S.enemies.length < MAX_ENEMIES + 40; i++) {
        const a = (i / n) * Math.PI * 2;
        spawnEnemy(id, S.p.x + Math.cos(a) * R, S.p.y + Math.sin(a) * R);
      }
      cb.onBanner('Une horde approche !', '');
    }
    const mini = MINI_WAVES[S.miniIdx];
    if (mini && wave >= mini.wave && !(S.boss && !S.boss.dead)) {
      S.miniIdx++;
      spawnBoss(z.mini, 'mini', mini.hp, 'Un boss apparaît !');
    }
    if (wave >= S.nextFinal && !(S.boss && !S.boss.dead)) {
      S.nextFinal += BOSS_RETURN;
      const hp = 1.6 * (1 + BOSS_HP_STEP * S.bossKills);
      spawnBoss(z.boss, 'boss', hp, S.bossKills ? `Il revient, plus fort (vague ${wave})` : `Le boss final de la zone (vague ${wave}) !`);
    }
  }

  function spawnBoss(id, kind, hp, sub) {
    const e = spawnEnemy(id, undefined, undefined, hp);
    e.kind = kind;
    S.boss = e;
    cb.onBanner(MONSTERS[id].name, sub);
  }

  // Tirage du Dofus de zone sur le boss final : 1 % + 0,5 % par échec précédent (compteur par zone,
  // sauvegardé, remis à zéro quand le Dofus tombe). La Prospection n'y change rien.
  function rollDofus(e) {
    const z = S.zone, save = S.save;
    const owned = save.dofus.concat(S.found);
    const free = z.dofus.filter((d) => !owned.includes(d));
    if (!free.length) return;
    save.dofusPity = save.dofusPity || {};
    const misses = save.dofusPity[z.id] || 0, [base, step] = z.dofusChance || DOFUS_CHANCE;
    const chance = base + step * misses;
    if (Math.random() < chance) {
      save.dofusPity[z.id] = 0;
      S.gems.push({ kind: 'dofus', id: pick(free), x: e.x, y: e.y, v: 0, mag: true });
    } else {
      save.dofusPity[z.id] = misses + 1;
      addText(e.x, e.y - 60, `Pas de Dofus (prochaine chance : ${((base + step * (misses + 1)) * 100).toFixed(1)} %)`, '#c8b8ff', true);
    }
    cb.onProgress();
  }

  // ------------------------------------------------------------ Dégâts infligés
  function knock(e, sx, sy, k) {
    const dx = e.x - sx, dy = e.y - sy, l = Math.hypot(dx, dy) || 1;
    const f = e.boss ? 0.12 : 1;
    e.kvx += (dx / l) * k * 7 * f;
    e.kvy += (dy / l) * k * 7 * f;
  }

  function hitEnemy(e, base, o) {
    if (e.dead) return;
    let d = base * S.stats.dmg * (1 + buffPow('pow'));
    if (o.rage) d *= 1 + (1 - S.p.hp / S.p.maxHp) * 1.5;
    const crit = Math.random() < S.stats.crit + (o.crit || 0) + (S.p.shieldCrit && S.p.shield > 0 ? 0.4 : 0);
    if (crit) d *= S.stats.critDmg;
    d *= rand(0.9, 1.1);
    e.hp -= d;
    e.flash = 0.08;
    addText(e.x + rand(-6, 6), e.y - e.r, Math.round(d), crit ? '#ffdd33' : '#ffffff', crit);
    if (o.knock) knock(e, o.sx ?? S.p.x, o.sy ?? S.p.y, o.knock);
    if (o.poison) { e.poison = Math.max(e.poison, o.poison * S.stats.dmg); e.poisonT = Math.max(e.poisonT, o.poisonDur); }
    if (o.slow) { e.slow = Math.max(e.slow, o.slow); e.slowT = 0.7; }
    if (o.gold) e.gold = true;
    if (e.hp <= 0) {
      kill(e);
      if (o.glyph && o.glyph.fx === 'imprint') {
        const marks = S.glyphs.filter((g) => g.imprint);
        if (marks.length >= 20) marks[0].life = 0;
        S.glyphs.push({ imprint: true, x: e.x, y: e.y, r: o.glyph.r * 0.45, dmg: o.glyph.dmg * 0.6, tick: o.glyph.tick, tt: 0, life: 30, max: 30, color: o.glyph.color });
      }
    }
  }

  function aoe(x, y, r, dmg, o, color) {
    query(x, y, r, (e) => hitEnemy(e, dmg, Object.assign({ sx: x, sy: y }, o)));
    S.fx.push({ type: 'ring', x, y, r, t: 0, life: 0.35, color: color || '#fff' });
  }

  function kill(e) {
    e.dead = true;
    S.kills++;
    const z = S.zone;
    gainXp(e.x, e.y, e.xp);
    dropItems(e);
    if (e.gold || Math.random() < 0.07) {
      S.gems.push({ kind: 'kamas', x: e.x + rand(-6, 6), y: e.y + rand(-6, 6), v: Math.ceil(rand(1, 4) * z.kamas) });
    }
    if (Math.random() < 0.004) S.gems.push({ kind: 'heal', x: e.x, y: e.y, v: 0 });
    else if (Math.random() < 0.0015) S.gems.push({ kind: 'magnet', x: e.x, y: e.y, v: 0 });
    for (let i = 0; i < 6; i++) {
      S.fx.push({ type: 'spark', x: e.x, y: e.y, vx: rand(-90, 90), vy: rand(-120, 30), t: 0, life: 0.4, color: e.def.body });
    }
    if (e.boss) {
      for (let i = 0; i < 12; i++) {
        S.gems.push({ kind: 'kamas', x: e.x + rand(-50, 50), y: e.y + rand(-50, 50), v: Math.ceil(rand(5, 12) * z.kamas) });
      }
      if (S.boss === e) S.boss = null;
      if (e.kind === 'boss') {
        // la partie continue : le boss reviendra toutes les 15 vagues
        S.bossKills++;
        S.gems.push({ kind: 'kamas', x: e.x, y: e.y, v: Math.ceil(100 * z.kamas) });
        rollDofus(e);
        if (!S.victory) {
          S.victory = true;
          cb.onZoneCleared(S.zoneIdx);
          const next = ZONES[S.zoneIdx + 1];
          banner(e.def.name + ' est vaincu !', next ? 'Zaap débloqué : ' + next.name : 'Toutes les zones sont terminées', true);
        } else banner(e.def.name + ' est vaincu !', 'Il reviendra à la vague ' + S.nextFinal, true);
      } else {
        S.gems.push({ kind: 'chest', x: e.x, y: e.y, v: 0 });
      }
    }
  }

  // L'XP d'un monstre tué va directement au personnage (petite étincelle qui file vers lui).
  function gainXp(x, y, v) {
    S.xp += v * S.stats.xp;
    while (S.xp >= S.xpNext) { S.xp -= S.xpNext; S.level++; S.xpNext = xpFor(S.level); S.pending++; }
    if (S.fx.length < 220) S.fx.push({ type: 'xpfly', x, y, sx: x, sy: y, t: 0, life: 0.45 });
  }

  // Somme des bonus temporaires actifs (sorts de type buff) pour une clé (pow ou spd).
  function buffPow(k) {
    let v = 0;
    for (const b of S.buffs) v += b[k];
    return v;
  }

  function addText(x, y, txt, color, big) {
    if (S.texts.length > 60 && !big) return;
    S.texts.push({ x, y, txt, color, big, t: 0, life: 0.7 });
  }

  // ------------------------------------------------------------ Sorts
  function updateSpells(dt) {
    if (S.over) return;
    for (const sp of S.spells) {
      const def = SPELLS[sp.id], s = sp.s;
      if (def.type === 'orbit') { updateOrbit(sp, dt); continue; }
      if (def.type === 'summon') { updateSummons(sp, dt); continue; }
      sp.timer -= dt;
      if (sp.timer > 0) continue;
      if (def.type === 'aura') { sp.timer = s.tick; auraTick(sp); continue; }
      const ok = cast(sp, def, s);
      if (ok && ATTACK_TYPES.has(def.type)) attackAnim();
      sp.timer = ok ? s.cd * S.stats.cd : 0.15;
    }
  }

  // Lance l'animation d'attaque du personnage vers l'ennemi le plus proche (au plus une à la fois).
  function attackAnim() {
    const p = S.p, c = SPRITE_CLASSES[S.cls], a = c && sheet(c.attack);
    if (!a || S.t - (p.atkT0 ?? -9) < a.frames / a.fps) return;
    const t = nearest(p.x, p.y, 700, 1)[0];
    p.atkT0 = S.t;
    p.atkAng = t ? Math.atan2(t.y - p.y, t.x - p.x) : Math.atan2(p.dirY, p.dirX);
  }

  function cast(sp, def, s) {
    const p = S.p, area = S.stats.area;
    switch (def.type) {
      case 'projectile': {
        const targets = nearest(p.x, p.y, s.range, s.spread ? 1 : Math.round(s.count));
        if (!targets.length) return false;
        const n = Math.round(s.count);
        for (let i = 0; i < n; i++) {
          let a;
          if (s.spread) {
            const base = Math.atan2(targets[0].y - p.y, targets[0].x - p.x);
            a = base + (n > 1 ? (i / (n - 1) - 0.5) * s.spread * 2 : 0);
          } else {
            const t = targets[i % targets.length];
            a = Math.atan2(t.y - p.y, t.x - p.x) + (i >= targets.length ? rand(-0.25, 0.25) : 0);
          }
          S.projs.push({
            x: p.x, y: p.y - 6, vx: Math.cos(a) * s.speed, vy: Math.sin(a) * s.speed,
            life: s.range / s.speed + 0.1, size: s.size, dmg: s.dmg, pierce: Math.round(s.pierce || 0),
            explode: s.explode ? s.explode * area : 0, knock: s.knock || 0, poison: s.poison || 0,
            poisonDur: s.poisonDur || 0, slow: s.slow || 0, crit: s.crit || 0, fx: sp.fx, gold: s.gold, color: def.color, hit: new Set(),
          });
        }
        return true;
      }
      case 'melee': {
        const range = s.range * area;
        const t = nearest(p.x, p.y, range * 1.6, 1)[0];
        if (!t) return false;
        const a = Math.atan2(t.y - p.y, t.x - p.x);
        const dirs = s.double ? [a, a + Math.PI] : [a];
        for (const da of dirs) {
          query(p.x, p.y, range, (e) => {
            let diff = Math.atan2(e.y - p.y, e.x - p.x) - da;
            diff = Math.atan2(Math.sin(diff), Math.cos(diff));
            if (Math.abs(diff) <= s.arc / 2 + 0.25) hitEnemy(e, s.dmg, { knock: s.knock, crit: s.crit, rage: s.rage });
          });
          S.fx.push({ type: 'arc', x: p.x, y: p.y, a: da, arc: s.arc, r: range, t: 0, life: 0.2, color: def.color });
        }
        return true;
      }
      case 'nova': {
        const r = s.radius * area;
        if (!nearest(p.x, p.y, r * 1.3, 1).length) return false;
        query(p.x, p.y, r, (e) => hitEnemy(e, s.dmg, { knock: s.knock, rage: s.rage }));
        S.fx.push({ type: 'ring', x: p.x, y: p.y, r, t: 0, life: 0.4, color: def.color, fill: true });
        return true;
      }
      case 'strike': {
        const cands = nearest(p.x, p.y, s.range, 60);
        if (!cands.length) return false;
        const n = Math.round(s.count);
        for (let i = 0; i < n; i++) {
          // la première frappe vise le boss s’il est à portée
          const e = i === 0 && S.boss && cands.includes(S.boss) ? S.boss : pick(cands);
          S.strikes.push({ x: e.x, y: e.y, r: s.radius * area, dmg: s.dmg, rage: s.rage, fx: sp.fx, t: s.delay, life: s.delay, color: def.color });
        }
        return true;
      }
      case 'trap': {
        const mine = S.traps.filter((t) => t.src === sp);
        if (mine.length >= Math.round(s.count)) return true;
        let x = p.x + rand(-20, 20), y = p.y + rand(-20, 20);
        if (s.fuse) {
          const t = nearest(p.x, p.y, 260, 1)[0];
          if (t) { x = t.x + rand(-15, 15); y = t.y + rand(-15, 15); }
        }
        S.traps.push({ src: sp, x, y, r: s.radius * area, dmg: s.dmg, life: s.life, arm: 0.3, fuse: s.fuse, color: def.color });
        return true;
      }
      case 'glyph': {
        // posés dans la zone autour du personnage, sur les groupes d'ennemis les plus denses
        const r = s.radius * area, spots = crowdSpots(p.x, p.y, s.range || 260, r, Math.round(s.count || 1));
        if (!spots.length) return false;
        const stack = sp.fx === 'stack';
        for (const at of spots) {
          const mine = S.glyphs.filter((g) => g.src === sp && g.stack);
          if (stack && mine.length >= 14) {
            // Accumulation pleine : chaque lancer renforce tous les glyphes
            sp.stackBonus = (sp.stackBonus || 0) + 1;
            addText(p.x, p.y - 44, 'Glyphes +' + sp.stackBonus, def.color);
            break;
          }
          S.glyphs.push({ src: sp, stack, fx: sp.fx, x: at.x, y: at.y, r, dmg: s.dmg, tick: s.tick, tt: 0, life: s.duration, max: s.duration, color: def.color });
          S.fx.push({ type: 'ring', x: at.x, y: at.y, r, t: 0, life: 0.35, color: def.color });
        }
        if (sp.fx === 'follow') S.glyphs.push({ src: sp, follow: true, x: p.x, y: p.y, r: r * 0.6, dmg: s.dmg, tick: s.tick, tt: 0, life: s.duration, max: s.duration, color: def.color });
        return true;
      }
      case 'heal': {
        const h = Math.min(s.heal, p.maxHp - p.hp);
        if (h <= 0) return false;
        p.hp += h;
        addText(p.x, p.y - 30, '+' + Math.round(h), '#7dff9a', true);
        S.fx.push({ type: 'ring', x: p.x, y: p.y, r: 40, t: 0, life: 0.4, color: '#7dff9a' });
        return true;
      }
      case 'shield':
        p.shield = Math.max(p.shield, s.shield);
        p.shieldCrit = sp.fx === 'shieldCrit';
        S.fx.push({ type: 'ring', x: p.x, y: p.y, r: 34, t: 0, life: 0.4, color: def.color });
        if (sp.fx === 'shieldNova') aoe(p.x, p.y, 120 * area, s.shield * 0.8, { knock: 120 }, def.color); // Sursaut
        return true;
      case 'buff': {
        // ne se lance qu'en combat
        if (!nearest(p.x, p.y, 360, 1).length) return false;
        S.buffs.push({ pow: s.pow || 0, spd: s.spd || 0, t: s.dur, color: def.color });
        S.fx.push({ type: 'ring', x: p.x, y: p.y, r: 46, t: 0, life: 0.5, color: def.color, fill: true });
        addText(p.x, p.y - 44, def.name, def.color, true);
        return true;
      }
      case 'dash': {
        const t = nearest(p.x, p.y, s.range, 1)[0];
        if (!t) return false;
        const dx = t.x - p.x, dy = t.y - p.y, l = Math.hypot(dx, dy) || 1, go = Math.max(0, l - 18);
        S.fx.push({ type: 'trail', x: p.x, y: p.y, x2: p.x + (dx / l) * go, y2: p.y + (dy / l) * go, t: 0, life: 0.3, color: def.color });
        p.x += (dx / l) * go; p.y += (dy / l) * go;
        p.dirX = dx / l; p.dirY = dy / l;
        p.inv = Math.max(p.inv, 0.35);
        const r = s.radius * area;
        query(p.x, p.y, r, (e) => hitEnemy(e, s.dmg, { knock: s.knock }));
        S.fx.push({ type: 'ring', x: p.x, y: p.y, r, t: 0, life: 0.4, color: def.color, fill: true });
        return true;
      }
    }
    return true;
  }

  function auraTick(sp) {
    const s = sp.s, p = S.p;
    query(p.x, p.y, s.radius * S.stats.area, (e) => hitEnemy(e, s.dmg, { slow: s.slow, rage: s.rage }));
  }

  function updateOrbit(sp, dt) {
    const s = sp.s, p = S.p, n = Math.round(s.count), R = s.radius * S.stats.area;
    sp.angle += s.speed * dt;
    for (let i = 0; i < n; i++) {
      const a = sp.angle + (i / n) * Math.PI * 2;
      const x = p.x + Math.cos(a) * R, y = p.y + Math.sin(a) * R;
      query(x, y, s.size, (e) => {
        if ((e.hitT[sp.id] || 0) > S.t) return;
        e.hitT[sp.id] = S.t + 0.45;
        hitEnemy(e, s.dmg, { knock: 25, sx: p.x, sy: p.y });
      });
    }
  }

  function updateSummons(sp, dt) {
    const s = sp.s, p = S.p, n = Math.round(s.count);
    while (sp.minions.length < n) sp.minions.push({ x: p.x + rand(-30, 30), y: p.y + rand(-30, 30), atk: 0, face: 1, walk: 0 });
    sp.minions.forEach((m, i) => {
      m.atk -= dt;
      if (d2(m.x, m.y, p.x, p.y) > 480 * 480) { m.x = p.x; m.y = p.y; }
      const t = nearest(m.x, m.y, 320, 1)[0];
      let tx, ty;
      if (t) { tx = t.x; ty = t.y; } else {
        const a = S.t * 0.8 + (i / n) * Math.PI * 2;
        tx = p.x + Math.cos(a) * 50; ty = p.y + Math.sin(a) * 50;
      }
      const dx = tx - m.x, dy = ty - m.y, l = Math.hypot(dx, dy);
      if (l > 4) {
        m.x += (dx / l) * s.speed * dt; m.y += (dy / l) * s.speed * dt;
        m.face = dx > 0 ? 1 : -1; m.walk += dt * 10;
      }
      if (t && m.atk <= 0 && l < s.size + t.r + 4) {
        m.atk = 0.55;
        hitEnemy(t, s.dmg, { knock: 30, sx: m.x, sy: m.y });
      }
    });
  }

  // ------------------------------------------------------------ Monstres
  function updateEnemies(dt) {
    const p = S.p;
    for (const e of S.enemies) {
      if (e.dead) continue;
      e.flash = Math.max(0, e.flash - dt);
      e.atk -= dt;
      if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slow = 0; }
      if (e.poisonT > 0) {
        e.poisonT -= dt;
        const d = e.poison * dt;
        e.hp -= d; e.poisonAcc += d;
        if (e.poisonAcc >= 4) { addText(e.x, e.y - e.r, Math.round(e.poisonAcc), '#7dff6a'); e.poisonAcc = 0; }
        if (e.hp <= 0) { kill(e); continue; }
      }
      const dx = p.x - e.x, dy = p.y - e.y, dist = Math.hypot(dx, dy) || 1;
      const ux = dx / dist, uy = dy / dist;
      let sp = e.speed * (1 - Math.min(0.8, e.slow));

      if (e.boss) {
        e.ab -= dt;
        if (e.charge > 0) {
          e.charge -= dt;
          e.x += e.cx * sp * 3.2 * dt; e.y += e.cy * sp * 3.2 * dt;
          sp = 0;
        } else if (e.ab <= 0) {
          e.ab = e.boss === 2 ? 4.5 : 5.5;
          if (e.boss === 2 && Math.random() < 0.5) {
            const n = 14;
            for (let i = 0; i < n; i++) {
              const a = (i / n) * Math.PI * 2 + S.t;
              S.eprojs.push({ x: e.x, y: e.y, vx: Math.cos(a) * 180, vy: Math.sin(a) * 180, life: 4, dmg: e.dmg * 0.6, color: e.def.detail });
            }
          } else {
            e.charge = 0.7; e.cx = ux; e.cy = uy;
            S.fx.push({ type: 'ring', x: e.x, y: e.y, r: e.r * 1.8, t: 0, life: 0.3, color: '#ff4040' });
          }
        }
      }
      if (e.def.ranged) {
        const rg = e.def.ranged;
        if (dist < rg.range * 0.85) sp = dist < rg.range * 0.6 ? -sp * 0.5 : 0;
        e.shot -= dt;
        if (e.shot <= 0 && dist < rg.range) {
          e.shot = rg.cd * rand(0.8, 1.2);
          S.eprojs.push({ x: e.x, y: e.y, vx: ux * rg.speed, vy: uy * rg.speed, life: rg.range / rg.speed + 0.5, dmg: e.dmg * 0.8, color: rg.color });
        }
      }
      e.x += ux * sp * dt + e.kvx * dt;
      e.y += uy * sp * dt + e.kvy * dt;
      const decay = Math.exp(-10 * dt);
      e.kvx *= decay; e.kvy *= decay;

      if (dist < e.r + p.r + 12 && !(S.t - (e.atkAnim ?? -9) < 0.9)) e.atkAnim = S.t; // animation d'attaque
      if (dist < e.r + p.r && e.atk <= 0 && p.inv <= 0) {
        e.atk = 0.8;
        p.inv = 0.3; // courte invincibilité après un coup au contact
        damagePlayer(e.dmg);
      }
      // éloigne les monstres trop loin derrière le joueur
      if (!e.boss && dist > viewRadius() * 1.6) {
        const a = Math.atan2(dy, dx) + rand(-0.6, 0.6), R = viewRadius();
        e.x = p.x + Math.cos(a) * R; e.y = p.y + Math.sin(a) * R;
      }
    }
    // séparation
    for (const e of S.enemies) {
      if (e.dead) continue;
      query(e.x, e.y, e.r, (o) => {
        if (o === e) return;
        const dx = e.x - o.x, dy = e.y - o.y, dd = Math.hypot(dx, dy) || 0.01, min = e.r + o.r;
        if (dd < min) {
          const push = (min - dd) * 0.25;
          const we = e.boss ? 0.05 : 1, wo = o.boss ? 0.05 : 1;
          e.x += (dx / dd) * push * we; e.y += (dy / dd) * push * we;
          o.x -= (dx / dd) * push * wo; o.y -= (dy / dd) * push * wo;
        }
      });
    }
    S.enemies = S.enemies.filter((e) => !e.dead);
  }

  // ------------------------------------------------------------ Projectiles
  function updateProjectiles(dt) {
    for (const pr of S.projs) {
      pr.x += pr.vx * dt; pr.y += pr.vy * dt; pr.life -= dt;
      if (pr.life <= 0) { if (pr.explode) explodeProj(pr); continue; }
      query(pr.x, pr.y, pr.size, (e) => {
        if (pr.life <= 0 || pr.hit.has(e)) return;
        if (pr.explode) { explodeProj(pr); return; }
        pr.hit.add(e);
        hitEnemy(e, pr.dmg, { knock: pr.knock, poison: pr.poison, poisonDur: pr.poisonDur, slow: pr.slow, crit: pr.crit, gold: pr.gold, sx: pr.x - pr.vx, sy: pr.y - pr.vy });
        if (--pr.pierce < 0) pr.life = 0;
      });
    }
    S.projs = S.projs.filter((p) => p.life > 0);

    const p = S.p;
    for (const ep of S.eprojs) {
      ep.x += ep.vx * dt; ep.y += ep.vy * dt; ep.life -= dt;
      if (d2(ep.x, ep.y, p.x, p.y) < (p.r + 6) * (p.r + 6)) { damagePlayer(ep.dmg); ep.life = 0; }
    }
    S.eprojs = S.eprojs.filter((p) => p.life > 0);
  }

  function explodeProj(pr) {
    pr.life = 0;
    // Aspiration : l'explosion attire vers son centre au lieu de repousser
    aoe(pr.x, pr.y, pr.explode, pr.dmg, { knock: pr.fx === 'pull' ? -70 : 20, gold: pr.gold }, pr.color);
    if (pr.fx === 'split' && !pr.child) {
      // Ricochet : 3 petites bulles partent vers de nouvelles cibles
      for (const t of nearest(pr.x, pr.y, 300, 4).slice(1, 4)) {
        const a = Math.atan2(t.y - pr.y, t.x - pr.x), sp = 340;
        S.projs.push({ ...pr, child: true, x: pr.x, y: pr.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1,
          size: pr.size * 0.6, dmg: pr.dmg * 0.5, explode: pr.explode * 0.6, hit: new Set() });
      }
    }
  }

  function updateZones(dt) {
    for (const g of S.glyphs) {
      if (!g.stack) g.life -= dt; // Accumulation : les glyphes restent
      g.tt -= dt;
      if (g.follow) { g.x = S.p.x; g.y = S.p.y; }
      // Accumulation pleine : +8 % de dommages et +2 % de taille par lancer (taille +40 % au plus)
      const bonus = g.stack ? g.src.stackBonus || 0 : 0;
      const r = g.r * Math.min(1.4, 1 + 0.02 * bonus), dmg = g.dmg * (1 + 0.08 * bonus);
      g.drawR = r;
      if (g.tt <= 0) {
        g.tt = g.tick;
        query(g.x, g.y, r, (e) => {
          // Foyer : moitié intérieure du glyphe à dommages doublés
          const core = g.fx === 'core' && d2(e.x, e.y, g.x, g.y) < (r / 2) * (r / 2);
          hitEnemy(e, core ? dmg * 2 : dmg, { glyph: g });
        });
      }
      // Détonation : le glyphe explose à la fin de sa durée
      if (g.fx === 'burst' && g.life <= 0 && !g.burst) { g.burst = true; aoe(g.x, g.y, r, dmg * 4, { knock: 40 }, g.color); }
    }
    S.glyphs = S.glyphs.filter((g) => g.life > 0);

    for (const t of S.traps) {
      t.life -= dt; t.arm -= dt;
      if (t.fuse) { if (t.life <= 0) { aoe(t.x, t.y, t.r, t.dmg, { knock: 40 }, t.color); t.done = true; } continue; }
      if (t.arm <= 0) {
        let trig = false;
        query(t.x, t.y, t.r * 0.35, () => { trig = true; });
        if (trig) { aoe(t.x, t.y, t.r, t.dmg, { knock: 30 }, t.color); t.done = true; }
      }
    }
    S.traps = S.traps.filter((t) => !t.done && t.life > 0);

    for (const s of S.strikes) {
      s.t -= dt;
      if (s.t <= 0) {
        aoe(s.x, s.y, s.r, s.dmg, { knock: 30, rage: s.rage }, s.color); s.done = true;
        if (s.fx === 'chain') {
          // Chaîne : la foudre rebondit sur 3 ennemis proches
          for (const t of nearest(s.x, s.y, 220, 4).slice(0, 3)) {
            hitEnemy(t, s.dmg * 0.5, { rage: s.rage });
            S.fx.push({ type: 'trail', x: s.x, y: s.y + 14, x2: t.x, y2: t.y + 14, t: 0, life: 0.25, color: s.color });
          }
        }
      }
    }
    S.strikes = S.strikes.filter((s) => !s.done);
  }

  // ------------------------------------------------------------ Ramassage
  function updateGems(dt) {
    const p = S.p, pr = S.stats.pickup;
    for (const g of S.gems) {
      const dd = Math.sqrt(d2(g.x, g.y, p.x, p.y));
      if (!g.mag && (g.kind === 'kamas' || g.kind === 'item') && dd < pr) g.mag = true;
      if (!g.mag && dd < p.r + 16) g.mag = true;
      if (g.mag) {
        g.sp = (g.sp || 150) + 900 * dt;
        const k = Math.min(1, (g.sp * dt) / (dd || 1));
        g.x += (p.x - g.x) * k; g.y += (p.y - g.y) * k;
      }
      if (dd < p.r + 6) { collect(g); g.done = true; }
    }
    S.gems = S.gems.filter((g) => !g.done);
  }

  function collect(g) {
    const p = S.p;
    switch (g.kind) {
      case 'kamas': S.kamas += g.v * S.stats.kamas; break;
      case 'item': equipItem(g.id); break;
      case 'heal': {
        const h = p.maxHp * 0.3; p.hp = Math.min(p.maxHp, p.hp + h);
        addText(p.x, p.y - 30, '+' + Math.round(h), '#7dff9a', true);
        break;
      }
      case 'magnet': for (const o of S.gems) if (o.kind === 'kamas') o.mag = true; break;
      case 'chest':
        S.pending += 2;
        S.kamas += 30 * S.zone.kamas * S.stats.kamas;
        cb.onBanner('Coffre !', '+2 améliorations');
        break;
      case 'dofus':
        S.found.push(g.id);
        cb.onDofus(g.id);
        banner(DOFUS[g.id].name + ' !', DOFUS[g.id].desc, true);
        break;
    }
  }

  // ------------------------------------------------------------ Niveaux
  // Cartes de niveau, façon ZaapRush : on vise une carte de chaque nature
  // (améliorer un sort, nouveau sort, caractéristique), puis on complète au hasard.
  const TYPE_LABEL = {
    projectile: 'Projectile', melee: 'Mêlée', nova: 'Zone', aura: 'Aura', orbit: 'Orbite', strike: 'Frappe',
    summon: 'Invocation', trap: 'Piège', glyph: 'Glyphe', heal: 'Soin', shield: 'Bouclier', buff: 'Bonus', dash: 'Bond',
  };

  function genChoices() {
    const ups = [], news = [], stats = [];
    const ok = (o) => !S.banned.has(o.kind + ':' + o.id);
    for (const id of CLASSES[S.cls].spells) {
      const own = S.spells.find((s) => s.id === id), def = SPELLS[id];
      const base = { kind: 'spell', id, name: def.name, icon: def.icon, color: def.color, type: TYPE_LABEL[def.type], max: MAX_RANK };
      if (!own) news.push({ ...base, lvl: 1, tag: 'Nouveau sort', desc: def.desc });
      else if (own.lvl === AWAKEN_RANK) ups.push({ ...base, kind: 'awaken', lvl: AWAKEN_RANK + 1, tag: 'Éveil', desc: 'Choix définitif entre 3 branches : ' + branchesOf(def).map((b) => b.name).join(', ') + '.' });
      else if (own.lvl < MAX_RANK) {
        const lines = rankLines(def).filter((k) => (own.picks[k] || 0) < RANK_STEPS[k].max);
        if (lines.length) { const line = pick(lines); ups.push({ ...base, line, lvl: own.lvl + 1, tag: 'Améliorer', desc: 'Rang : ' + RANK_STEPS[line].text }); }
      }
    }
    const nPass = Object.keys(S.passives).length;
    for (const id in PASSIVES) {
      const l = S.passives[id] || 0, def = PASSIVES[id];
      if (l >= def.max || (!l && nPass >= MAX_PASSIVES)) continue;
      const c = { kind: 'passive', id, lvl: l + 1, max: def.max, name: def.name, icon: def.icon, color: def.color, desc: def.desc, type: 'Caractéristique' };
      c.tag = l ? 'Améliorer' : 'Débloquer';
      (l ? ups : stats).push(c);
    }
    const pools = [ups, news, stats].map((a) => a.filter(ok));
    const out = [], n = Math.random() < S.stats.card4 ? 4 : 3; // Dofus Vulbis : parfois 4 cartes
    for (const i of [0, 1, 2].sort(() => Math.random() - 0.5)) {
      const pool = pools[i];
      if (pool.length && out.length < n) out.push(pool.splice((Math.random() * pool.length) | 0, 1)[0]);
    }
    const rest = pools.flat();
    while (out.length < n && rest.length) out.push(rest.splice((Math.random() * rest.length) | 0, 1)[0]);
    if (!out.length) {
      out.push({ kind: 'heal', name: 'Pain d’Amakna', icon: '🍞', color: '#e0b060', desc: 'Rend 50% des PV', lvl: 0, tag: 'Bonus' });
      out.push({ kind: 'kamas', name: 'Bourse', icon: 'K', color: '#ffd84a', desc: '+50 kamas', lvl: 0, tag: 'Bonus' });
    }
    // carte conseillée : un nouveau sort tant qu'on en a moins de 4, sinon le sort le plus avancé
    const nSpells = S.spells.length;
    let best = nSpells < 4 ? out.find((c) => c.kind === 'spell' && c.lvl === 1) : null;
    if (!best) best = out.filter((c) => c.kind === 'spell' && c.lvl > 1).sort((a, b) => b.lvl - a.lvl)[0];
    if (!best) best = out.find((c) => c.kind === 'spell') || out[0];
    best.advised = true;
    out.forEach((c, i) => { c.slot = i; });
    return { cards: out, rerolls: S.rerolls, bans: S.bans, spells: nSpells };
  }

  function reroll() {
    if (!S || S.rerolls <= 0) return null;
    S.rerolls--;
    return genChoices();
  }

  // Bannir une carte : elle ne reviendra plus de la partie, et on retire.
  function ban(c) {
    if (!S || S.bans <= 0 || !c.id) return null;
    S.bans--;
    S.banned.add(c.kind + ':' + c.id);
    return genChoices();
  }

  // Carte d'Éveil : on ne la valide pas tout de suite, on propose ses 3 branches (sans relance ni bannissement).
  function awakenChoices(id) {
    const def = SPELLS[id];
    return {
      awaken: true, rerolls: S.rerolls, bans: S.bans, spells: S.spells.length,
      cards: branchesOf(def).map((b, i) => ({ kind: 'branch', id, branch: b.key, slot: i, name: b.name, desc: b.desc, tag: 'Éveil',
        icon: def.icon, color: def.color, type: def.name, lvl: AWAKEN_RANK + 1, max: MAX_RANK })),
    };
  }

  function choose(c) {
    if (c.kind === 'awaken') { cb.onLevelUp(awakenChoices(c.id)); return; }
    if (c.kind === 'branch') {
      const own = S.spells.find((s) => s.id === c.id);
      own.branch = c.branch; own.lvl = AWAKEN_RANK + 1; own.s = spellStats(own);
      own.fx = (branchesOf(SPELLS[c.id]).find((b) => b.key === c.branch) || {}).fx || null;
      banner(SPELLS[c.id].name + ' s’éveille', c.name + ' : ' + c.desc, true);
    } else if (c.kind === 'spell') {
      const own = S.spells.find((s) => s.id === c.id);
      // au rang 5, un sort ne monte plus que par son Éveil ; rang 10 au plus
      if (own && own.lvl !== AWAKEN_RANK && own.lvl < MAX_RANK) {
        const line = c.line || rankLines(SPELLS[c.id]).find((k) => (own.picks[k] || 0) < RANK_STEPS[k].max);
        if (line) own.picks[line] = (own.picks[line] || 0) + 1;
        own.lvl++; own.s = spellStats(own);
      } else if (!own) addSpell(c.id);
    } else if (c.kind === 'passive') {
      S.passives[c.id] = (S.passives[c.id] || 0) + 1;
      recomputeStats();
    } else if (c.kind === 'heal') {
      S.p.hp = Math.min(S.p.maxHp, S.p.hp + S.p.maxHp * 0.5);
    } else if (c.kind === 'kamas') {
      S.kamas += 50;
    }
    S.pending--;
    S.choosing = false;
    lastT = performance.now();
  }

  function finish() {
    const res = {
      victory: S.victory, t: S.t, wave: S.wave, bossKills: S.bossKills, kills: S.kills, level: S.level,
      kamas: Math.floor(S.kamas), found: S.found.slice(), zoneIdx: S.zoneIdx, cls: S.cls,
    };
    cancelAnimationFrame(raf);
    render();
    S.ended = true;
    cb.onEnd(res);
  }

  // ------------------------------------------------------------ Effets
  function updateFx(dt) {
    for (const b of S.buffs) b.t -= dt;
    S.buffs = S.buffs.filter((b) => b.t > 0);
    for (const f of S.fx) {
      f.t += dt;
      if (f.type === 'spark') { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 300 * dt; }
    }
    S.fx = S.fx.filter((f) => f.t < f.life);
    for (const t of S.texts) { t.t += dt; t.y -= 40 * dt; }
    S.texts = S.texts.filter((t) => t.t < t.life);
  }

  // ============================================================ Rendu
  function render() {
    if (!S) return;
    const p = S.p;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = S.zone.ground;
    ctx.fillRect(0, 0, W, H);
    const ox = W / 2 - p.x * zoom, oy = H / 2 - p.y * zoom;
    ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, dpr * ox, dpr * oy);
    const hw = W / 2 / zoom, hh = H / 2 / zoom;
    const vx0 = p.x - hw, vx1 = p.x + hw, vy0 = p.y - hh, vy1 = p.y + hh;

    drawGround(vx0, vy0, vx1, vy1);

    // zones au sol
    for (const g of S.glyphs) {
      const a = Math.min(1, g.life / 0.4);
      ctx.globalAlpha = 0.25 * a;
      ctx.fillStyle = g.color;
      const gr = g.drawR || g.r; // taille renforcée par l'Accumulation
      isoEllipse(g.x, g.y, gr); ctx.fill();
      ctx.globalAlpha = 0.8 * a;
      ctx.strokeStyle = g.color; ctx.lineWidth = 3;
      isoEllipse(g.x, g.y, gr); ctx.stroke();
      isoEllipse(g.x, g.y, gr * 0.6); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    for (const sp of S.spells) {
      if (SPELLS[sp.id].type !== 'aura') continue;
      const r = sp.s.radius * S.stats.area;
      ctx.globalAlpha = 0.12 + 0.04 * Math.sin(S.t * 3);
      ctx.fillStyle = SPELLS[sp.id].color;
      isoEllipse(p.x, p.y, r); ctx.fill();
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = SPELLS[sp.id].color; ctx.lineWidth = 2;
      isoEllipse(p.x, p.y, r); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    for (const t of S.traps) {
      const blink = t.fuse ? (Math.sin(S.t * (8 + (2.5 - t.life) * 10)) > 0 ? 1 : 0.5) : 1;
      ctx.fillStyle = t.color;
      ctx.globalAlpha = t.fuse ? 0.15 : 0.18;
      isoEllipse(t.x, t.y, t.r * (t.fuse ? 1 : 0.35)); ctx.fill();
      ctx.globalAlpha = blink;
      if (t.fuse) {
        ctx.fillStyle = '#2a2a2a';
        ctx.beginPath(); ctx.arc(t.x, t.y - 6, 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = t.color;
        ctx.beginPath(); ctx.arc(t.x + 5, t.y - 16, 3, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.strokeStyle = t.color; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(t.x - 10, t.y); ctx.lineTo(t.x, t.y - 6); ctx.lineTo(t.x + 10, t.y); ctx.lineTo(t.x, t.y + 6); ctx.closePath();
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    for (const s of S.strikes) {
      const k = 1 - s.t / s.life;
      ctx.strokeStyle = s.color; ctx.lineWidth = 2;
      ctx.globalAlpha = 0.5 + 0.5 * k;
      isoEllipse(s.x, s.y, s.r); ctx.stroke();
      ctx.globalAlpha = 0.25 * k;
      ctx.fillStyle = s.color;
      isoEllipse(s.x, s.y, s.r * k); ctx.fill();
      ctx.globalAlpha = 1;
    }

    // ramassables
    for (const g of S.gems) {
      if (g.x < vx0 - 20 || g.x > vx1 + 20 || g.y < vy0 - 20 || g.y > vy1 + 20) continue;
      drawGem(g);
    }

    // entités triées par profondeur
    const list = [];
    for (const e of S.enemies) {
      if (e.x < vx0 - 80 || e.x > vx1 + 80 || e.y < vy0 - 80 || e.y > vy1 + 80) continue;
      list.push(e);
    }
    for (const sp of S.spells) for (const m of sp.minions) list.push({ minion: m, sp, y: m.y });
    list.push({ player: true, y: p.y });
    list.sort((a, b) => a.y - b.y);
    for (const o of list) {
      if (o.player) drawPlayer();
      else if (o.minion) drawMinion(o.minion, o.sp);
      else drawMonster(o, o.x, o.y, o.r, o.flash > 0, p.x < o.x ? -1 : 1);
    }

    // orbites
    for (const sp of S.spells) {
      if (SPELLS[sp.id].type !== 'orbit') continue;
      const s = sp.s, n = Math.round(s.count), R = s.radius * S.stats.area;
      for (let i = 0; i < n; i++) {
        const a = sp.angle + (i / n) * Math.PI * 2;
        const x = p.x + Math.cos(a) * R, y = p.y + Math.sin(a) * R - 10;
        ctx.save();
        ctx.translate(x, y); ctx.rotate(a + Math.PI / 2);
        ctx.fillStyle = SPELLS[sp.id].color;
        ctx.strokeStyle = '#3a3a5a'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, -s.size * 1.4); ctx.lineTo(4, s.size * 0.5); ctx.lineTo(-4, s.size * 0.5); ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#8a6a3a';
        ctx.fillRect(-6, s.size * 0.5, 12, 3);
        ctx.fillRect(-1.5, s.size * 0.5, 3, 8);
        ctx.restore();
      }
    }

    // projectiles
    for (const pr of S.projs) {
      const a = Math.atan2(pr.vy, pr.vx);
      ctx.save();
      ctx.translate(pr.x, pr.y);
      ctx.rotate(a);
      ctx.fillStyle = pr.color;
      ctx.shadowColor = pr.color; ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.ellipse(0, 0, pr.size * 1.8, pr.size * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    for (const ep of S.eprojs) {
      ctx.fillStyle = ep.color;
      ctx.strokeStyle = '#300'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(ep.x, ep.y, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }

    // effets
    for (const f of S.fx) {
      const k = f.t / f.life;
      ctx.globalAlpha = 1 - k;
      if (f.type === 'ring') {
        const r = f.r * (0.4 + 0.6 * Math.min(1, k * 1.6));
        if (f.fill) { ctx.fillStyle = f.color; ctx.globalAlpha = 0.25 * (1 - k); isoEllipse(f.x, f.y, r); ctx.fill(); ctx.globalAlpha = 1 - k; }
        ctx.strokeStyle = f.color; ctx.lineWidth = 4 * (1 - k) + 1;
        isoEllipse(f.x, f.y, r); ctx.stroke();
      } else if (f.type === 'arc') {
        ctx.fillStyle = f.color;
        ctx.globalAlpha = 0.45 * (1 - k);
        ctx.beginPath();
        ctx.moveTo(f.x, f.y - 8);
        ctx.arc(f.x, f.y - 8, f.r, f.a - f.arc / 2, f.a + f.arc / 2);
        ctx.closePath(); ctx.fill();
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(f.x, f.y - 8, f.r * (0.7 + 0.3 * k), f.a - f.arc / 2, f.a + f.arc / 2); ctx.stroke();
      } else if (f.type === 'spark') {
        ctx.fillStyle = f.color;
        ctx.fillRect(f.x - 2, f.y - 2, 4, 4);
      } else if (f.type === 'trail') {
        ctx.strokeStyle = f.color; ctx.lineWidth = 10 * (1 - k); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(f.x, f.y - 14); ctx.lineTo(f.x2, f.y2 - 14); ctx.stroke();
      } else if (f.type === 'xpfly') {
        // l'étincelle d'XP file du monstre vers le personnage
        const e = k * k, x = f.sx + (p.x - f.sx) * e, y = f.sy + (p.y - 20 - f.sy) * e - Math.sin(k * Math.PI) * 30;
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#7fd4ff'; ctx.beginPath(); ctx.arc(x, y, 3.5 * (1 - k * 0.5), 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x - 1, y - 1, 1.3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // textes
    ctx.textAlign = 'center';
    for (const t of S.texts) {
      ctx.globalAlpha = 1 - t.t / t.life;
      ctx.font = (t.big ? 'bold 17px ' : 'bold 12px ') + 'system-ui, sans-serif';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.7)';
      ctx.strokeText(t.txt, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.txt, t.x, t.y);
    }
    ctx.globalAlpha = 1;

    // indicateur de boss hors écran
    if (S.boss && !S.boss.dead) {
      const b = S.boss;
      if (b.x < vx0 || b.x > vx1 || b.y < vy0 || b.y > vy1) {
        const a = Math.atan2(b.y - p.y, b.x - p.x);
        const ex = clamp(p.x + Math.cos(a) * 1e4, vx0 + 24, vx1 - 24);
        const ey = clamp(p.y + Math.sin(a) * 1e4, vy0 + 24, vy1 - 24);
        ctx.save(); ctx.translate(ex, ey); ctx.rotate(a);
        ctx.fillStyle = '#ff3b3b';
        ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -10); ctx.lineTo(-8, 10); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }

    // joystick tactile
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (joy.id !== null) {
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(joy.sx, joy.sy, 50, 0, Math.PI * 2); ctx.fill();
      const jx = joy.x - joy.sx, jy = joy.y - joy.sy, l = Math.hypot(jx, jy), k = l > 50 ? 50 / l : 1;
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(joy.sx + jx * k, joy.sy + jy * k, 22, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // vignette de dégâts
    if (p.hurt > 0 || p.hp / p.maxHp < 0.25) {
      const a = Math.max(p.hurt * 3, p.hp / p.maxHp < 0.25 ? 0.25 + 0.1 * Math.sin(S.t * 6) : 0);
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
      g.addColorStop(0, 'rgba(200,0,0,0)');
      g.addColorStop(1, `rgba(200,0,0,${clamp(a, 0, 0.6)})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function isoEllipse(x, y, r) {
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.62, 0, 0, Math.PI * 2);
  }

  // ------------------------------------------------------------ Sol isométrique
  function drawGround(x0, y0, x1, y1) {
    const z = S.zone;
    const TW = 96, TH = 48;
    ctx.fillStyle = z.ground2;
    const k0 = Math.floor(x0 / TW) - 1, k1 = Math.ceil(x1 / TW) + 1;
    const m0 = Math.floor(y0 / TH) - 1, m1 = Math.ceil(y1 / TH) + 1;
    ctx.beginPath();
    for (let m = m0; m <= m1; m++) {
      for (let k = k0; k <= k1; k++) {
        const cx = k * TW, cy = m * TH;
        ctx.moveTo(cx, cy - TH / 2); ctx.lineTo(cx + TW / 2, cy); ctx.lineTo(cx, cy + TH / 2); ctx.lineTo(cx - TW / 2, cy); ctx.closePath();
      }
    }
    ctx.fill();

    const C = 150;
    const c0 = Math.floor(x0 / C) - 1, c1 = Math.ceil(x1 / C) + 1;
    const r0 = Math.floor(y0 / C) - 1, r1 = Math.ceil(y1 / C) + 1;
    for (let cy = r0; cy <= r1; cy++) {
      for (let cx = c0; cx <= c1; cx++) {
        const h = hash(cx, cy, S.zoneIdx + 1);
        if (h > 0.55) continue;
        const x = cx * C + hash(cx, cy, 7) * C, y = cy * C + hash(cx, cy, 13) * C;
        drawDeco(z, x, y, h / 0.55, hash(cx, cy, 21));
      }
    }
  }

  function drawDeco(z, x, y, h, h2) {
    const c = z.deco;
    const big = h < 0.12;
    switch (z.decoType) {
      case 'grass': case 'field':
        if (big && z.decoType === 'grass') { tree(x, y, c[0], 1); break; }
        ctx.strokeStyle = z.decoType === 'field' ? c[0] : c[0];
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = -2; i <= 2; i++) { ctx.moveTo(x + i * 3, y); ctx.lineTo(x + i * 4, y - 8 - Math.abs(i) * -1 - h2 * 6); }
        ctx.stroke();
        if (h2 < 0.35) {
          ctx.fillStyle = h2 < 0.17 ? c[1] : c[2];
          ctx.beginPath(); ctx.arc(x + 8, y - 4, 3, 0, Math.PI * 2); ctx.fill();
        }
        break;
      case 'forest':
        if (h < 0.4) tree(x, y, c[0], 1.2 + h2 * 0.5);
        else {
          ctx.fillStyle = c[1];
          ctx.beginPath(); ctx.ellipse(x, y, 10, 5, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = c[2];
          ctx.beginPath(); ctx.arc(x - 6, y - 4, 4, 0, Math.PI * 2); ctx.arc(x + 5, y - 3, 3, 0, Math.PI * 2); ctx.fill();
        }
        break;
      case 'rock':
        ctx.fillStyle = c[0];
        ctx.beginPath();
        const s = big ? 22 : 8 + h2 * 6;
        ctx.moveTo(x - s, y); ctx.lineTo(x - s * 0.6, y - s * 0.8); ctx.lineTo(x + s * 0.4, y - s); ctx.lineTo(x + s, y - s * 0.2); ctx.lineTo(x + s * 0.7, y + s * 0.3); ctx.closePath();
        ctx.fill();
        ctx.fillStyle = c[1];
        ctx.beginPath(); ctx.moveTo(x - s * 0.6, y - s * 0.8); ctx.lineTo(x + s * 0.4, y - s); ctx.lineTo(x, y - s * 0.4); ctx.closePath(); ctx.fill();
        break;
      case 'snow':
        if (big || h < 0.25) {
          const sc = 1 + h2 * 0.4;
          ctx.fillStyle = c[1];
          ctx.beginPath(); ctx.moveTo(x, y - 46 * sc); ctx.lineTo(x + 18 * sc, y - 6); ctx.lineTo(x - 18 * sc, y - 6); ctx.closePath(); ctx.fill();
          ctx.fillStyle = c[2];
          ctx.beginPath(); ctx.moveTo(x, y - 46 * sc); ctx.lineTo(x + 8 * sc, y - 30 * sc); ctx.lineTo(x - 8 * sc, y - 30 * sc); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#5a4030'; ctx.fillRect(x - 3, y - 6, 6, 8);
        } else {
          ctx.fillStyle = c[0];
          ctx.beginPath(); ctx.ellipse(x, y, 14, 5, 0, 0, Math.PI * 2); ctx.fill();
        }
        break;
    }
  }

  function tree(x, y, col, sc) {
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ctx.beginPath(); ctx.ellipse(x, y + 2, 22 * sc, 9 * sc, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#6a4a2a'; ctx.fillRect(x - 4 * sc, y - 18 * sc, 8 * sc, 20 * sc);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(x, y - 32 * sc, 20 * sc, 0, Math.PI * 2);
    ctx.arc(x - 14 * sc, y - 22 * sc, 13 * sc, 0, Math.PI * 2);
    ctx.arc(x + 14 * sc, y - 22 * sc, 13 * sc, 0, Math.PI * 2);
    ctx.fill();
  }

  // ------------------------------------------------------------ Objets au sol
  function drawGem(g) {
    const bob = Math.sin(S.t * 4 + g.x * 0.1) * 2;
    const x = g.x, y = g.y + bob;
    switch (g.kind) {
      case 'item': {
        // petit parchemin d'équipement, doré pour un objet rare
        const it = ITEMS[g.id], rare = it.rare;
        ctx.fillStyle = rare ? 'rgba(255,200,60,.35)' : 'rgba(120,200,255,.3)';
        ctx.beginPath(); ctx.arc(x, y - 6, 15 + Math.sin(S.t * 5) * 2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = rare ? '#ffd84a' : '#d8ecff'; ctx.strokeStyle = rare ? '#8a5a10' : '#2a4a7a'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect(x - 10, y - 16, 20, 20, 5); ctx.fill(); ctx.stroke();
        ctx.font = '13px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(SLOTS[it.slot].icon, x, y - 5);
        break;
      }
      case 'kamas':
        ctx.fillStyle = '#c8962a';
        ctx.beginPath(); ctx.ellipse(x, y, 7, 6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffd84a';
        ctx.beginPath(); ctx.ellipse(x, y - 1, 6, 5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#a0701a'; ctx.font = 'bold 7px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('K', x, y + 1.5);
        break;
      case 'heal':
        ctx.fillStyle = '#c88a3a';
        ctx.beginPath(); ctx.ellipse(x, y, 13, 7, -0.3, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#8a5a1a'; ctx.lineWidth = 1.5;
        for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(x + i * 5 - 2, y - 4); ctx.lineTo(x + i * 5 + 2, y + 2); ctx.stroke(); }
        break;
      case 'magnet':
        ctx.strokeStyle = '#e03030'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(x, y - 2, 8, Math.PI, 0); ctx.stroke();
        ctx.strokeStyle = '#ddd';
        ctx.beginPath(); ctx.moveTo(x - 8, y - 2); ctx.lineTo(x - 8, y + 5); ctx.moveTo(x + 8, y - 2); ctx.lineTo(x + 8, y + 5); ctx.stroke();
        break;
      case 'chest':
        ctx.fillStyle = '#7a4a1a'; ctx.fillRect(x - 14, y - 10, 28, 18);
        ctx.fillStyle = '#9a6a2a'; ctx.fillRect(x - 14, y - 16, 28, 8);
        ctx.fillStyle = '#ffd84a'; ctx.fillRect(x - 3, y - 10, 6, 7);
        ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 2; ctx.strokeRect(x - 14, y - 16, 28, 24);
        break;
      case 'dofus': {
        const c = DOFUS[g.id].color;
        ctx.save();
        ctx.shadowColor = c; ctx.shadowBlur = 20 + 8 * Math.sin(S.t * 5);
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.ellipse(x, y - 8, 11, 14, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        ctx.fillStyle = 'rgba(255,255,255,.55)';
        ctx.beginPath(); ctx.ellipse(x - 4, y - 13, 3, 5, -0.4, 0, Math.PI * 2); ctx.fill();
        break;
      }
    }
  }

  // ------------------------------------------------------------ Personnages
  function shadow(x, y, r) {
    ctx.fillStyle = 'rgba(0,0,0,.22)';
    ctx.beginPath(); ctx.ellipse(x, y + 2, r * 1.05, r * 0.45, 0, 0, Math.PI * 2); ctx.fill();
  }

  function eyes(x, y, s, dir, color = '#fff') {
    const off = dir * s * 0.35;
    for (const ex of [-s * 0.45, s * 0.45]) {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(x + ex + off, y, s * 0.32, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#111';
      ctx.beginPath(); ctx.arc(x + ex + off + dir * s * 0.1, y, s * 0.16, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawPlayer() {
    const p = S.p, cls = CLASSES[S.cls];
    const bob = Math.abs(Math.sin(p.walk)) * 3;
    const x = p.x, y = p.y, f = p.face;
    shadow(x, y, 15);
    if (p.shield > 0) {
      ctx.globalAlpha = 0.25 + 0.1 * Math.sin(S.t * 5);
      ctx.fillStyle = '#9fd8ff';
      ctx.beginPath(); ctx.arc(x, y - 18, 30, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.7; ctx.strokeStyle = '#d0f0ff'; ctx.lineWidth = 2; ctx.stroke();
      ctx.globalAlpha = 1;
    }
    const hurt = p.hurt > 0;
    const sprite = SPRITE_CLASSES[S.cls];
    if (sprite) {
      const angle = Math.atan2(p.dirY, p.dirX), atk = sheet(sprite.attack), since = S.t - (p.atkT0 ?? -9);
      if (atk && since < atk.frames / atk.fps) {
        if (drawSprite(sprite.attack, x, y + 1, p.atkAng, since, sprite.k, hurt)) return;
      } else if (p.moving ? drawSprite(sprite.run, x, y + 1, angle, p.walk / 10, sprite.k, hurt)
                          : drawSprite(sprite.idle, x, y + 1, angle, S.t, sprite.k, hurt)) return;
    }
    const by = y - bob;
    // jambes
    ctx.fillStyle = '#3a2a1a';
    const lg = Math.sin(p.walk) * 3;
    ctx.fillRect(x - 6 + lg, y - 8, 5, 8);
    ctx.fillRect(x + 1 - lg, y - 8, 5, 8);
    // corps
    ctx.fillStyle = hurt ? '#fff' : cls.color;
    ctx.beginPath();
    ctx.moveTo(x - 12, by - 6); ctx.quadraticCurveTo(x - 13, by - 26, x, by - 28); ctx.quadraticCurveTo(x + 13, by - 26, x + 12, by - 6); ctx.closePath();
    ctx.fill();
    ctx.fillStyle = cls.accent;
    ctx.fillRect(x - 12, by - 12, 24, 3);
    // tête
    const skin = S.cls === 'sacrieur' ? '#c8484a' : '#f3d1a8';
    ctx.fillStyle = hurt ? '#fff' : skin;
    ctx.beginPath(); ctx.arc(x, by - 36, 11, 0, Math.PI * 2); ctx.fill();
    drawHat(cls, x, by - 36, f);
    eyes(x, by - 35, 8, f * 0.6, '#fff');
  }

  function drawHat(cls, x, y, f) {
    const c = cls.accent, b = cls.color;
    switch (cls.hat) {
      case 'spikes':
        ctx.fillStyle = c;
        ctx.beginPath();
        for (let i = -2; i <= 2; i++) { ctx.moveTo(x + i * 5 - 4, y - 6); ctx.lineTo(x + i * 6 - f * 3, y - 22 + Math.abs(i) * 3); ctx.lineTo(x + i * 5 + 4, y - 6); }
        ctx.fill();
        break;
      case 'hood':
        ctx.fillStyle = b;
        ctx.beginPath(); ctx.moveTo(x - 13, y + 2); ctx.quadraticCurveTo(x - 12, y - 16, x - f * 12, y - 22); ctx.quadraticCurveTo(x + 12, y - 14, x + 13, y + 2);
        ctx.quadraticCurveTo(x, y - 8, x - 13, y + 2); ctx.fill();
        break;
      case 'helm':
        ctx.fillStyle = '#c8d0e0';
        ctx.beginPath(); ctx.arc(x, y - 3, 12, Math.PI, 0); ctx.fill();
        ctx.fillStyle = b; ctx.fillRect(x - 2, y - 18, 4, 8);
        break;
      case 'wings':
        ctx.fillStyle = '#fff';
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(x + s * 13, y - 6, 4, 9, s * 0.6, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = b; ctx.beginPath(); ctx.arc(x, y - 7, 10, Math.PI, 0); ctx.fill();
        break;
      case 'skull':
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.arc(x, y - 6, 10, Math.PI, 0); ctx.fill();
        ctx.fillStyle = b; ctx.fillRect(x - 11, y - 7, 22, 3);
        break;
      case 'bandage':
        ctx.strokeStyle = '#efe8d8'; ctx.lineWidth = 3;
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x - 11, y - 8 + i * 6); ctx.lineTo(x + 11, y - 10 + i * 6); ctx.stroke(); }
        ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y - 12, 4, 0, Math.PI * 2); ctx.fill();
        break;
      case 'horns':
        ctx.fillStyle = c;
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + s * 6, y - 8); ctx.quadraticCurveTo(x + s * 16, y - 14, x + s * 12, y - 22); ctx.lineTo(x + s * 9, y - 9); ctx.fill(); }
        ctx.fillStyle = '#5a3a2a'; ctx.beginPath(); ctx.arc(x, y - 6, 10, Math.PI, 0); ctx.fill();
        break;
      case 'tattoo':
        ctx.fillStyle = '#2b2b2b'; ctx.beginPath(); ctx.arc(x, y - 6, 10, Math.PI, 0); ctx.fill();
        ctx.strokeStyle = '#2b2b2b'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x - 8, y + 4); ctx.lineTo(x - 4, y + 7); ctx.stroke();
        break;
      case 'beard':
        ctx.fillStyle = '#e8e8e8';
        ctx.beginPath(); ctx.moveTo(x - 9, y + 2); ctx.quadraticCurveTo(x, y + 22, x + 9, y + 2); ctx.fill();
        ctx.fillStyle = '#6a4a2a'; ctx.beginPath(); ctx.ellipse(x, y - 8, 15, 4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x, y - 10, 8, Math.PI, 0); ctx.fill();
        break;
      case 'bandana':
        ctx.fillStyle = '#c03030'; ctx.beginPath(); ctx.arc(x, y - 5, 11, Math.PI, 0); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x - f * 10, y - 6); ctx.lineTo(x - f * 20, y - 2); ctx.lineTo(x - f * 18, y - 9); ctx.fill();
        break;
    }
  }

  function drawMinion(m, sp) {
    const def = SPELLS[sp.id];
    const bob = Math.abs(Math.sin(m.walk)) * 2;
    ctx.strokeStyle = 'rgba(111,220,111,.85)'; ctx.lineWidth = 2;
    isoEllipse(m.x, m.y + 2, sp.s.size + 4); ctx.stroke();
    if (def.look && def.look !== 'shovel') { // n'importe quelle forme de monstre
      drawMonster({ def: { shape: def.look, body: def.color, detail: '#6b4a2a' }, seed: 0, boss: 0, hp: 1, maxHp: 1 }, m.x, m.y - bob, sp.s.size, false, m.face, true);
      return;
    }
    shadow(m.x, m.y, sp.s.size);
    if (def.look === 'shovel') {
      ctx.save(); ctx.translate(m.x, m.y - 14 - bob); ctx.rotate(Math.sin(S.t * 8) * 0.3);
      ctx.fillStyle = '#8a6a3a'; ctx.fillRect(-2, -14, 4, 22);
      ctx.fillStyle = '#b0b8c0'; ctx.beginPath(); ctx.ellipse(0, 12, 7, 9, 0, 0, Math.PI * 2); ctx.fill();
      eyes(0, 10, 6, m.face);
      ctx.restore();
      return;
    }
    // double du Sram
    ctx.globalAlpha = 0.6;
    const cls = CLASSES[S.cls];
    ctx.fillStyle = cls.color;
    ctx.beginPath(); ctx.arc(m.x, m.y - 14 - bob, 11, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(m.x, m.y - 30 - bob, 8, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    eyes(m.x, m.y - 30 - bob, 6, m.face);
  }

  function drawMonster(e, x, y, r, flash, dir, friendly) {
    const d = e.def;
    const t = S.t + e.seed;
    const bob = Math.sin(t * 8) * r * 0.06;
    const body = flash ? '#ffffff' : d.body, det = flash ? '#ffffff' : d.detail;
    shadow(x, y, r);
    const cy = y - r + bob;
    let sprited = false;
    const walk = d.sprite && !friendly && sheet(d.sprite);
    if (walk) {
      const ang = Math.atan2(S.p.y - y, S.p.x - x), k = r / walk.fit;
      const atk = sheet(d.sprite + '_attack'), since = S.t - (e.atkAnim ?? -9);
      sprited = atk && since < atk.frames / atk.fps
        ? drawSprite(d.sprite + '_attack', x, y + 1, ang, since, k, flash)
        : drawSprite(d.sprite, x, y + 1, ang, t, k, flash);
    }
    if (!sprited) switch (d.shape) {
      case 'sheep': {
        ctx.fillStyle = body;
        ctx.beginPath();
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2;
          ctx.moveTo(x + Math.cos(a) * r * 0.7 + r * 0.38, cy + Math.sin(a) * r * 0.6);
          ctx.arc(x + Math.cos(a) * r * 0.7, cy + Math.sin(a) * r * 0.6, r * 0.38, 0, Math.PI * 2);
        }
        ctx.arc(x, cy, r * 0.75, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = det;
        ctx.beginPath(); ctx.ellipse(x + dir * r * 0.55, cy + r * 0.05, r * 0.42, r * 0.38, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = det; ctx.lineWidth = r * 0.16;
        for (const s of [-1, 1]) {
          ctx.beginPath(); ctx.arc(x + dir * r * 0.3 + s * r * 0.45, cy - r * 0.55, r * 0.25, Math.PI * 0.9, Math.PI * 2.4); ctx.stroke();
        }
        eyes(x + dir * r * 0.55, cy, r * 0.42, dir);
        break;
      }
      case 'bird': {
        ctx.fillStyle = body;
        ctx.beginPath(); ctx.arc(x, cy, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = det;
        ctx.beginPath(); ctx.moveTo(x + dir * r * 0.8, cy - r * 0.15); ctx.lineTo(x + dir * r * 1.5, cy + r * 0.05); ctx.lineTo(x + dir * r * 0.8, cy + r * 0.3); ctx.fill();
        const flap = Math.sin(t * 20) * 0.4;
        ctx.beginPath(); ctx.ellipse(x - dir * r * 0.5, cy + r * 0.1, r * 0.5, r * 0.25, -dir * (0.6 + flap), 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x - r * 0.2, cy - r * 0.9); ctx.lineTo(x, cy - r * 1.4); ctx.lineTo(x + r * 0.2, cy - r * 0.9); ctx.fill();
        eyes(x + dir * r * 0.3, cy - r * 0.2, r * 0.5, dir);
        break;
      }
      case 'larva': {
        ctx.fillStyle = body;
        for (let i = 2; i >= 0; i--) {
          const sx = x - dir * i * r * 0.6, sy = cy + r * 0.3 + Math.sin(t * 6 + i) * 2;
          ctx.beginPath(); ctx.arc(sx, sy, r * (0.75 - i * 0.1), 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = det;
          ctx.beginPath(); ctx.arc(sx, sy - r * 0.2, r * 0.12, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = body;
        }
        eyes(x + dir * r * 0.2, cy + r * 0.1, r * 0.45, dir);
        break;
      }
      case 'spider': {
        ctx.strokeStyle = body; ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
          for (const s of [-1, 1]) {
            const k = Math.sin(t * 14 + i) * 3;
            ctx.beginPath(); ctx.moveTo(x, cy + r * 0.3);
            ctx.lineTo(x + s * r * 1.1, cy - r * 0.3 + i * r * 0.35 + k);
            ctx.lineTo(x + s * r * 1.5, cy + r * 0.6 + i * r * 0.2);
            ctx.stroke();
          }
        }
        ctx.fillStyle = body;
        ctx.beginPath(); ctx.arc(x, cy + r * 0.2, r * 0.8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = det;
        ctx.beginPath(); ctx.arc(x, cy, r * 0.25, 0, Math.PI * 2); ctx.fill();
        eyes(x + dir * r * 0.3, cy + r * 0.35, r * 0.35, dir, '#ff4040');
        break;
      }
      case 'bug': {
        const flap = Math.sin(t * 30);
        ctx.fillStyle = 'rgba(230,230,255,.6)';
        ctx.beginPath(); ctx.ellipse(x - r * 0.5, cy - r * 0.8, r * 0.4, r * 0.9 * Math.abs(flap) + 2, -0.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(x + r * 0.5, cy - r * 0.8, r * 0.4, r * 0.9 * Math.abs(flap) + 2, 0.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = body;
        ctx.beginPath(); ctx.ellipse(x, cy, r * 0.9, r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = det; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x + dir * r * 0.8, cy); ctx.lineTo(x + dir * r * 1.6, cy + r * 0.3); ctx.stroke();
        eyes(x + dir * r * 0.3, cy - r * 0.1, r * 0.45, dir);
        break;
      }
      case 'boar': {
        ctx.fillStyle = body;
        ctx.beginPath(); ctx.ellipse(x, cy + r * 0.1, r * 1.1, r * 0.85, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(x + dir * r * 0.9, cy + r * 0.2, r * 0.4, r * 0.35, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = det;
        ctx.beginPath();
        ctx.moveTo(x + dir * r * 0.8, cy + r * 0.45); ctx.quadraticCurveTo(x + dir * r * 1.3, cy + r * 0.4, x + dir * r * 1.2, cy - r * 0.1);
        ctx.lineTo(x + dir * r * 1.05, cy + r * 0.3); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,.25)';
        ctx.beginPath(); ctx.moveTo(x - r * 0.6, cy - r * 0.6); ctx.lineTo(x - r * 0.2, cy - r * 1.1); ctx.lineTo(x + r * 0.1, cy - r * 0.7); ctx.fill();
        eyes(x + dir * r * 0.45, cy - r * 0.15, r * 0.4, dir);
        break;
      }
      case 'tree': {
        ctx.fillStyle = body;
        ctx.beginPath();
        ctx.moveTo(x - r * 0.6, y); ctx.lineTo(x - r * 0.45, cy - r * 0.3); ctx.lineTo(x + r * 0.45, cy - r * 0.3); ctx.lineTo(x + r * 0.6, y);
        ctx.fill();
        ctx.strokeStyle = body; ctx.lineWidth = r * 0.18;
        const sw = Math.sin(t * 4) * r * 0.15;
        ctx.beginPath(); ctx.moveTo(x - r * 0.4, cy); ctx.lineTo(x - r * 1.1, cy - r * 0.4 + sw); ctx.moveTo(x + r * 0.4, cy); ctx.lineTo(x + r * 1.1, cy - r * 0.4 - sw); ctx.stroke();
        ctx.fillStyle = det;
        ctx.beginPath();
        ctx.arc(x, cy - r * 0.9, r * 0.8, 0, Math.PI * 2);
        ctx.arc(x - r * 0.6, cy - r * 0.5, r * 0.5, 0, Math.PI * 2);
        ctx.arc(x + r * 0.6, cy - r * 0.5, r * 0.5, 0, Math.PI * 2);
        ctx.fill();
        eyes(x + dir * r * 0.15, cy + r * 0.2, r * 0.4, dir, '#ffe060');
        break;
      }
      case 'skull': {
        ctx.fillStyle = body;
        ctx.beginPath(); ctx.arc(x, cy - r * 0.1, r * 0.85, 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(x - r * 0.5, cy + r * 0.4, r, r * 0.45);
        ctx.fillStyle = det;
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(x + s * r * 0.33 + dir * r * 0.1, cy - r * 0.05, r * 0.24, 0, Math.PI * 2); ctx.fill(); }
        for (let i = -1; i <= 1; i++) ctx.fillRect(x + i * r * 0.3 - 1, cy + r * 0.5, 2, r * 0.35);
        ctx.fillStyle = '#ff3030';
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(x + s * r * 0.33 + dir * r * 0.1, cy - r * 0.05, r * 0.08, 0, Math.PI * 2); ctx.fill(); }
        break;
      }
      case 'rock': {
        ctx.fillStyle = body;
        ctx.beginPath();
        ctx.moveTo(x - r, y - r * 0.1); ctx.lineTo(x - r * 0.8, cy - r * 0.7); ctx.lineTo(x - r * 0.1, cy - r * 1.05);
        ctx.lineTo(x + r * 0.7, cy - r * 0.8); ctx.lineTo(x + r, y - r * 0.3); ctx.lineTo(x + r * 0.5, y); ctx.lineTo(x - r * 0.5, y);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = det; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x - r * 0.3, cy - r * 0.9); ctx.lineTo(x - r * 0.1, cy - r * 0.3); ctx.lineTo(x - r * 0.4, cy + r * 0.2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + r * 0.5, cy - r * 0.5); ctx.lineTo(x + r * 0.3, cy + r * 0.1); ctx.stroke();
        eyes(x + dir * r * 0.25, cy - r * 0.15, r * 0.4, dir, d.boss ? det : '#ffd060');
        break;
      }
      case 'penguin': {
        ctx.fillStyle = body;
        ctx.beginPath(); ctx.ellipse(x, cy, r * 0.8, r * 1.05, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = flash ? '#fff' : '#f0f0f0';
        ctx.beginPath(); ctx.ellipse(x + dir * r * 0.15, cy + r * 0.2, r * 0.5, r * 0.75, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffa020';
        ctx.beginPath(); ctx.moveTo(x + dir * r * 0.5, cy - r * 0.45); ctx.lineTo(x + dir * r * 1.05, cy - r * 0.35); ctx.lineTo(x + dir * r * 0.5, cy - r * 0.2); ctx.fill();
        eyes(x + dir * r * 0.25, cy - r * 0.5, r * 0.4, dir);
        break;
      }
      default: { // jelly
        const w = 1 + Math.sin(t * 6) * 0.06;
        ctx.fillStyle = body;
        ctx.beginPath();
        ctx.moveTo(x - r * w, y - r * 0.1);
        ctx.quadraticCurveTo(x - r * w, cy - r * 1.1 / w, x, cy - r * 1.05 / w);
        ctx.quadraticCurveTo(x + r * w, cy - r * 1.1 / w, x + r * w, y - r * 0.1);
        ctx.quadraticCurveTo(x, y + r * 0.1, x - r * w, y - r * 0.1);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.45)';
        ctx.beginPath(); ctx.ellipse(x - r * 0.4, cy - r * 0.5, r * 0.18, r * 0.3, -0.5, 0, Math.PI * 2); ctx.fill();
        eyes(x + dir * r * 0.2, cy - r * 0.1, r * 0.45, dir, det === '#ff3030' ? '#ff3030' : '#fff');
      }
    }
    if (e.boss && !friendly) {
      // couronne
      const ty = cy - r * (d.shape === 'tree' ? 1.75 : 1.15);
      ctx.fillStyle = '#ffd84a'; ctx.strokeStyle = '#a07010'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x - r * 0.4, ty); ctx.lineTo(x - r * 0.45, ty - r * 0.35); ctx.lineTo(x - r * 0.2, ty - r * 0.15); ctx.lineTo(x, ty - r * 0.42);
      ctx.lineTo(x + r * 0.2, ty - r * 0.15); ctx.lineTo(x + r * 0.45, ty - r * 0.35); ctx.lineTo(x + r * 0.4, ty); ctx.closePath();
      ctx.fill(); ctx.stroke();
      if (e.charge > 0) {
        ctx.strokeStyle = 'rgba(255,60,60,.8)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(x, cy, r * 1.3, 0, Math.PI * 2); ctx.stroke();
      }
    }
    if (!friendly && !e.boss && e.hp < e.maxHp) {
      ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(x - r, y + 5, r * 2, 3);
      ctx.fillStyle = '#ff4a4a'; ctx.fillRect(x - r, y + 5, r * 2 * Math.max(0, e.hp / e.maxHp), 3);
    }
    if (!friendly && e.poisonT > 0) {
      ctx.fillStyle = 'rgba(125,255,106,.8)';
      ctx.beginPath(); ctx.arc(x + Math.sin(t * 3) * r * 0.5, cy - r - 4 - (t * 20) % 10, 2.5, 0, Math.PI * 2); ctx.fill();
    }
  }

  return { init, start, stop, setPaused, choose, reroll, ban };
})();
