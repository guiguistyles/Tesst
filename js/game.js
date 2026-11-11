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
  // Mode test « vague N » : ?vague=30&vitesse=3 ou #vague30 / #vague30x3 (le lien d'un artefact ne garde que le #)
  const TEST = (() => {
    const q = location.search.match(/[?&]vague=(\d+)/), v = location.search.match(/[?&]vitesse=(\d+)/);
    const h = location.hash.match(/^#vague(\d+)(?:x(\d))?$/);
    const wave = q ? +q[1] : h ? +h[1] : 0;
    // ?sort=epee_celeste ou #sort-epee-celeste : donne ce sort dès le départ (s'il est de la classe)
    const sq = location.search.match(/[?&]sort=([a-z_]+)/), sh = location.hash.match(/^#sort-([a-z-]+)$/);
    const spell = sq ? sq[1] : sh ? sh[1].replace(/-/g, '_') : null;
    return { wave, spell, speed: Math.min(4, Math.max(1, v ? +v[1] : h && h[2] ? +h[2] : 1)) };
  })();
  const GOD_MODE = /[?&]debug\b/.test(location.search) || TEST.wave > 0 || !!TEST.spell; // invincibilité pour les tests
  // Tests de fluidité : ?stress / #stress remplit l'écran de monstres, ?fps / #fps affiche le compteur
  const STRESS = /[?&]stress\b/.test(location.search) || location.hash === '#stress';
  const SHOW_FPS = STRESS || TEST.wave > 0 || /[?&]fps\b/.test(location.search) || location.hash === '#fps';
  let r3 = null;          // moteur 3D actif (Render3D) ou null pour le rendu 2D
  let canvas3d = null;
  let fps = 0, fpsAcc = 0, fpsFrames = 0, renderMs = 0;
  const BOSS_TIMES = [
    { t: 180, kind: 'mini', hp: 1 },
    { t: 360, kind: 'mini', hp: 1.8 },
    { t: 480, kind: 'boss', hp: 1 },
  ];

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
  function init(c, callbacks, c3) {
    canvas = c;
    canvas3d = c3 || null;
    ctx = c.getContext('2d');
    cb = callbacks;
    resize();
    addEventListener('resize', resize);
    addEventListener('keydown', (e) => {
      keys[e.code] = true;
      if ((e.code === 'Escape' || e.code === 'KeyP') && S && !S.over) cb.onPauseKey();
      if ((e.code === 'KeyE' || e.code === 'Enter') && S && !paused && !S.choosing) interact();
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

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    zoom = clamp(Math.min(W, H) / 640, 0.62, 1.15);
    if (r3) r3.resize(W, H, dpr, zoom);
    r3RadiusAt = -1;
  }

  /** Choisit le rendu : '3d' si WebGL est disponible, sinon '2d'. Renvoie le mode réellement actif. */
  function setRenderMode(mode) {
    if (mode === '3d' && canvas3d && typeof Render3D !== 'undefined' && Render3D.init(canvas3d)) {
      r3 = Render3D;
      r3.resize(W, H, dpr, zoom);
      if (S) r3.begin(S);
      r3RadiusAt = -1;
    } else {
      if (r3) r3.end();
      r3 = null;
    }
    if (canvas3d) canvas3d.style.display = r3 ? 'block' : 'none';
    return r3 ? '3d' : '2d';
  }

  // ------------------------------------------------------------ Statistiques
  function metaStats(save) {
    const st = { dmg: 1, cd: 1, area: 1, crit: 0.05, xp: 1, pickup: 85, regen: 0, armor: 0, speed: 1, kamas: 1, hp: 1 };
    const u = save.upgrades;
    st.hp *= 1 + 0.06 * (u.vitalite || 0);
    st.dmg *= 1 + 0.05 * (u.force || 0);
    st.speed *= 1 + 0.03 * (u.agilite || 0);
    st.xp *= 1 + 0.06 * (u.sagesse || 0);
    st.kamas *= 1 + 0.1 * (u.prospection || 0);
    st.cd *= 1 - 0.03 * (u.pa || 0);
    for (const id of save.dofus) {
      switch (id) {
        case 'cawotte': st.regen += 1; break;
        case 'emeraude': st.hp *= 1.15; break;
        case 'kaliptus': st.pickup *= 1.3; st.xp *= 1.1; break;
        case 'dokoko': st.kamas *= 1.2; break;
        case 'pourpre': st.dmg *= 1.12; break;
        case 'ocre': st.cd *= 0.92; break;
        case 'turquoise': st.crit += 0.07; break;
        case 'ivoire': st.armor += 0.1; break;
        case 'ebene': st.speed *= 1.08; st.dmg *= 1.08; break;
        case 'vulbis': st.dmg *= 1.06; st.hp *= 1.06; st.speed *= 1.06; st.area *= 1.06; st.xp *= 1.06; break;
      }
    }
    return st;
  }

  function recomputeStats() {
    const st = Object.assign({}, S.meta);
    if (S.mode === 'world' && S.carac) return recomputeWorldStats(st);
    const P = S.passives;
    st.hp *= 1 + 0.2 * (P.vitalite || 0);
    st.dmg *= 1 + 0.1 * (P.force || 0);
    st.speed *= 1 + 0.08 * (P.agilite || 0);
    st.area *= 1 + 0.1 * (P.intelligence || 0);
    st.xp *= 1 + 0.12 * (P.sagesse || 0);
    st.crit += 0.05 * (P.chance || 0);
    st.pickup *= 1 + 0.3 * (P.prospection || 0);
    st.cd *= Math.pow(0.93, P.pa || 0);
    st.armor = 1 - (1 - st.armor) * Math.pow(0.94, P.resistance || 0);
    st.regen += 0.5 * (P.soin || 0);
    applyEquip(st);
    S.stats = st;
    const newMax = Math.round(CLASSES[S.cls].hp * st.hp);
    if (S.p.maxHp) S.p.hp += Math.max(0, newMax - S.p.maxHp);
    S.p.maxHp = newMax;
    S.p.hp = Math.min(S.p.hp, newMax);
  }

  function spellStats(sp) {
    const def = SPELLS[sp.id];
    const s = Object.assign({}, def.base);
    for (let i = 0; i < sp.lvl - 1; i++) {
      const u = def.up[i];
      if (u.m) for (const k in u.m) s[k] = (s[k] || 0) * u.m[k];
      if (u.a) for (const k in u.a) s[k] = (s[k] || 0) + u.a[k];
    }
    // Aventure : le sort ne monte qu'avec la caractéristique de son élément
    if (S && S.mode === 'world' && S.carac) {
      const el = WORLD.ELEMENTS[WORLD.SPELL_ELEM[sp.id] || 'terre'];
      if (s.dmg) s.dmg *= 1 + (S.carac[el.stat] || 0) / 100;
      if (s.heal) s.heal *= 1 + (S.carac.intelligence || 0) / 100;
      if (s.shield) s.shield *= 1 + (S.carac.force || 0) / 200 + (S.carac.vitalite || 0) / 400;
    }
    return s;
  }

  function addSpell(id) {
    const sp = { id, lvl: 1, timer: 0.3, angle: 0, minions: [] };
    sp.s = spellStats(sp);
    S.spells.push(sp);
  }

  // ------------------------------------------------------------ Démarrage / arrêt
  function start(clsId, zoneIdx, save, adv = null) {
    const cls = CLASSES[clsId];
    S = {
      mode: adv ? 'world' : 'arena',
      cls: clsId, zone: ZONES[zoneIdx], zoneIdx, save,
      t: 0, kills: 0, kamas: 0, level: 1, xp: 0, xpNext: xpFor(1),
      p: { x: 0, y: 0, r: 14, hp: 0, maxHp: 0, face: 1, dirX: 1, dirY: 0, shield: 0, hurt: 0, inv: 0, walk: 0,
           revive: save.upgrades.resurrection ? 1 : 0 },
      meta: metaStats(save), stats: null, passives: {}, spells: [],
      enemies: [], projs: [], eprojs: [], gems: [], fx: [], texts: [], traps: [], glyphs: [], strikes: [],
      spawnAcc: 0, nextWave: 60, bossIdx: 0, boss: null, pending: 0, choosing: false,
      found: [], rerolls: 2, banishes: 1, banned: new Set(), over: false, endTimer: -1, victory: false, grid: new Map(),
    };
    S.xpNext = xpFor(1);
    recomputeStats();
    S.p.hp = S.p.maxHp;
    if (r3) r3.begin(S);
    r3RadiusAt = -1;
    addSpell(cls.spells[0]);
    if (adv) initWorld(adv);
    else if (TEST.wave) jumpToWave(TEST.wave);
    if (TEST.spell && cls.spells.includes(TEST.spell) && !S.spells.some((q) => q.id === TEST.spell)) addSpell(TEST.spell);
    paused = false;
    lastT = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
    if (!adv) cb.onBanner(S.zone.name, 'Survivez et vainquez ' + MONSTERS[S.zone.boss].name + ' !');
  }

  function stop() { cancelAnimationFrame(raf); if (r3) r3.end(); S = null; }
  function setPaused(v) { paused = v; if (!v) lastT = performance.now(); }

  /**
   * Mode test : démarre à la vague N (une horde par minute, donc à N minutes de jeu),
   * avec le héros monté de niveau automatiquement et le gardien de la zone déjà là.
   */
  function jumpToWave(n) {
    S.t = n * 60;
    S.nextWave = S.t + 2;
    // ?boss=mini (tests) : commence avec le boss intermédiaire au lieu du gardien
    S.bossIdx = /[?&]boss=mini\b/.test(location.search) ? 0 : BOSS_TIMES.findIndex((b) => b.kind === 'boss');
    const levels = Math.min(60, 8 + n);
    for (let i = 0; i < levels; i++) {
      S.level++;
      S.pending++;
      const c = genChoices();
      choose(c[(Math.random() * c.length) | 0]);
    }
    S.xpNext = xpFor(S.level);
    S.p.hp = S.p.maxHp;
  }

  // L'aventure dure bien plus qu'une partie d'arène : la courbe d'expérience y est plus longue
  function xpFor(lvl) {
    if (S && S.mode === 'world') return Math.floor(8 + lvl * 6 + Math.pow(lvl, 1.75));
    return Math.floor(3 + lvl * 2.5 + Math.pow(lvl, 1.6));
  }


  // ============================================================ Caractéristiques et talents (aventure)
  function applyEquip(st) {
    for (const slot in S.equip || {}) {
      const it = S.equip[slot].stats;
      st.dmg *= 1 + (it.dmg || 0);
      st.hp *= 1 + (it.hp || 0);
      st.speed *= 1 + (it.speed || 0);
      st.crit += it.crit || 0;
      st.cd *= 1 - (it.cd || 0);
      st.armor = 1 - (1 - st.armor) * (1 - (it.armor || 0));
    }
  }

  function recomputeWorldStats(st) {
    const C = S.carac, T = S.talents.passives;
    st.xp *= 1 + (C.sagesse || 0) / 100;
    st.dodge = Math.min(0.3, (C.agilite || 0) / 1200);
    st.crit += (C.agilite || 0) / 2000;
    st.loot = 1 + Math.floor((C.chance || 0) / 10) / 100;
    st.cd *= Math.pow(0.95, T.pa || 0);
    st.armor = 1 - (1 - st.armor) * Math.pow(0.94, T.resistance || 0);
    st.regen += 0.6 * (T.soin || 0);
    st.pickup *= 1 + 0.3 * (T.prospection || 0);
    st.area *= 1 + 0.08 * (T.envergure || 0);
    st.speed *= 1 + 0.05 * (T.celerite || 0);
    applyEquip(st);
    S.stats = st;
    // Vie : base de la classe, +6 par niveau, +1 par point de Vitalité
    const newMax = Math.round((CLASSES[S.cls].hp + (S.level - 1) * 6 + (C.vitalite || 0)) * st.hp);
    if (S.p.maxHp) S.p.hp += Math.max(0, newMax - S.p.maxHp);
    S.p.maxHp = newMax;
    S.p.hp = Math.min(S.p.hp, newMax);
  }

  /** Multiplicateur d'expérience selon l'écart de niveau avec le monstre. */
  function xpGap(e) {
    if (!e.lvl) return 1;
    const d = e.lvl - S.level;
    if (d <= -5) return Math.max(0.1, 1 - 0.15 * (-d - 4));
    if (d > 0) return 1 + Math.min(0.5, 0.05 * d);
    return 1;
  }

  function worldLevelUp() {
    const n = S.pending;
    S.pending = 0;
    recomputeStats();
    S.p.hp = S.p.maxHp;
    cb.onBanner(`Niveau ${S.level} !`, `+${WORLD.STAT_PER_LEVEL * n} caractéristiques · +${n} point${n > 1 ? 's' : ''} de talent`);
    if (cb.onPoints) cb.onPoints();
    cb.onSave();
  }

  function talentSpent() {
    const T = S.talents;
    let n = 0;
    CLASSES[S.cls].spells.forEach((id, i) => { const r = T.spells[id] || 0; n += i === 0 ? Math.max(0, r - 1) : r; });
    for (const k in T.passives) n += T.passives[k];
    return n;
  }
  const talentPoints = () => S.level - 1 - talentSpent();
  const caracPoints = () => (S.level - 1) * WORLD.STAT_PER_LEVEL - WORLD.caracSpent(S.carac);

  /** Peut-on monter ce talent ? Renvoie la raison sinon. */
  function talentCheck(kind, id) {
    const T = S.talents;
    if (kind === 'spell') {
      const idx = CLASSES[S.cls].spells.indexOf(id), r = T.spells[id] || 0;
      if (idx < 0) return 'Sort inconnu';
      if (r >= 5) return 'Rang maximum';
      if (r === 0 && talentSpent() < WORLD.SPELL_GATE[idx]) return `Dépense ${WORLD.SPELL_GATE[idx]} points dans l’arbre`;
      if (S.level < WORLD.RANK_LEVEL[r + 1]) return `Niveau ${WORLD.RANK_LEVEL[r + 1]} requis`;
    } else {
      const def = WORLD.TALENT_PASSIVES[id], r = T.passives[id] || 0;
      if (!def) return 'Talent inconnu';
      if (r >= def.max) return 'Rang maximum';
    }
    if (talentPoints() < 1) return 'Plus de point de talent';
    return '';
  }

  /** Remet la barre de sorts en accord avec les talents. */
  function syncSpells() {
    const order = CLASSES[S.cls].spells, T = S.talents;
    const keep = [];
    for (const id of order) {
      const r = T.spells[id] || 0;
      if (!r) continue;
      let sp = S.spells.find((q) => q.id === id);
      if (!sp) { addSpell(id); sp = S.spells[S.spells.length - 1]; }
      sp.lvl = r;
      sp.s = spellStats(sp);
      keep.push(sp);
    }
    S.spells = keep;
  }
  function refreshSpells() { for (const sp of S.spells) sp.s = spellStats(sp); }

  function talentUp(kind, id) {
    if (!S || S.mode !== 'world') return null;
    const why = talentCheck(kind, id);
    if (why) return why;
    const bag = kind === 'spell' ? S.talents.spells : S.talents.passives;
    bag[id] = (bag[id] || 0) + 1;
    if (kind === 'spell') { syncSpells(); if (bag[id] === 1) cb.onBanner('Nouveau sort : ' + SPELLS[id].name, 'Il se lance tout seul'); }
    recomputeStats();
    refreshSpells();
    cb.onSave();
    return '';
  }

  /** Remise à zéro des talents (le premier sort reste au rang 1). */
  function resetTalents() {
    if (!S || S.mode !== 'world') return;
    S.talents = { spells: { [CLASSES[S.cls].spells[0]]: 1 }, passives: {} };
    syncSpells();
    recomputeStats();
    refreshSpells();
    cb.onSave();
  }

  /** Ajoute jusqu'à n points dans une caractéristique (selon les points restants et les paliers). */
  function addCarac(id, n = 1) {
    if (!S || S.mode !== 'world' || !WORLD.CARACS[id]) return;
    for (let k = 0; k < n; k++) {
      const v = S.carac[id] || 0, c = WORLD.caracCost(id, v);
      if (caracPoints() < c) break;
      S.carac[id] = v + 1;
    }
    recomputeStats();
    refreshSpells();
  }
  function resetCarac() {
    if (!S || S.mode !== 'world') return;
    S.carac = {};
    recomputeStats();
    refreshSpells();
    cb.onSave();
  }

  /** Données des fenêtres Caractéristiques et Talents. */
  function charInfo() {
    if (!S || S.mode !== 'world') return null;
    const checks = {};
    for (const id of CLASSES[S.cls].spells) checks['spell:' + id] = talentCheck('spell', id);
    for (const id in WORLD.TALENT_PASSIVES) checks['passive:' + id] = talentCheck('passive', id);
    return {
      cls: S.cls, level: S.level, carac: Object.assign({}, S.carac), caracPts: caracPoints(),
      talents: { spells: Object.assign({}, S.talents.spells), passives: Object.assign({}, S.talents.passives) },
      talentPts: talentPoints(), spent: talentSpent(), checks,
      maxHp: S.p.maxHp, dodge: S.stats.dodge || 0, crit: S.stats.crit, xp: S.stats.xp, loot: S.stats.loot || 1,
      spellDmg: Object.fromEntries(S.spells.map((sp) => [sp.id, sp.s.dmg || sp.s.heal || sp.s.shield || 0])),
    };
  }

  // ============================================================ Aventure (une carte par zone + donjons)
  /** Démarre (ou reprend) l'aventure avec la sauvegarde du héros. */
  function startWorld(clsId, save, adv) { start(clsId, Math.min(4, adv.zone || 0), save, adv); }

  /** Restaure le héros (niveau, sorts, caractéristiques, équipement) et charge sa zone. */
  function initWorld(adv) {
    S.level = adv.level || 1;
    S.xp = adv.xp || 0;
    S.xpNext = xpFor(S.level);
    S.passives = {};
    S.equip = Object.assign({}, adv.equip || {});
    // Caractéristiques et talents (une ancienne sauvegarde repart avec tous ses points à répartir)
    S.carac = Object.assign({}, adv.carac || {});
    const first = CLASSES[S.cls].spells[0];
    S.talents = adv.talents
      ? { spells: Object.assign({}, adv.talents.spells), passives: Object.assign({}, adv.talents.passives) }
      : { spells: { [first]: 1 }, passives: {} };
    if (!S.talents.spells[first]) S.talents.spells[first] = 1;
    if (caracPoints() < 0) S.carac = {};
    if (talentPoints() < 0) S.talents = { spells: { [first]: 1 }, passives: {} };
    recomputeStats();
    S.spells = [];
    syncSpells();
    S.p.hp = S.p.maxHp;
    S.world = {
      quest: adv.quest || 0, qProgress: adv.qProgress || 0, qAccepted: !!adv.qAccepted,
      bossKilled: Object.assign({}, adv.bossKilled || {}),
      map: null, camps: [], lairs: [], dead: 0, combatT: 10, playTime: adv.playTime || 0,
    };
    const m = WORLD.zones[Math.min(4, adv.zone || 0)];
    const pos = adv.pos && adv.pos.x > 0 && adv.pos.x < m.w && Math.abs(adv.pos.y) < m.h ? adv.pos : null;
    loadMap(m, pos);
  }

  /** Charge une carte (zone ou donjon) : vide les alentours et place le héros. */
  function loadMap(m, pos) {
    const w = S.world;
    // Le butin resté au sol est ramassé avant de partir
    for (const g of S.gems) if (g.kind !== 'heal' && g.kind !== 'magnet') collect(g);
    S.gems = [];
    for (const e of S.enemies) e.dead = true;
    S.enemies = []; S.eprojs = []; S.projs = []; S.strikes = []; S.traps = []; S.glyphs = [];
    S.boss = null;
    w.map = m;
    S.zone = ZONES[m.zone];
    S.zoneIdx = m.zone;
    w.camps = m.camps.map((def) => ({ def, members: [], respawnAt: 0 }));
    w.lairs = (m.kind === 'zone' ? [m.lair] : [m.boss]).map((def) => ({ def, e: null, nextAt: 0 }));
    const at = pos || (m.kind === 'zone' ? { x: m.zaap.x + 140, y: 40 } : { x: m.exit.x + 170, y: 0 });
    S.p.x = at.x; S.p.y = at.y;
    r3RadiusAt = -1;
    if (m.kind === 'zone') cb.onBanner(m.name, `Monstres niv. ${m.lvl[0]} à ${m.lvl[1]}`);
    else cb.onBanner(m.name, 'Le gardien vous attend au fond du donjon…');
  }

  function updateWorld(dt) {
    const w = S.world, p = S.p, m = w.map;
    w.playTime += dt;
    if (w.dead > 0) {
      w.dead -= dt;
      if (w.dead <= 0) respawnAtZaap();
      return;
    }
    const dungeon = m.kind === 'dungeon';
    // Camps : en zone, les monstres apparaissent à l'approche et disparaissent quand on s'éloigne ;
    // dans le donjon, toutes les salles sont peuplées dès l'entrée et ne se repeuplent pas.
    for (const c of w.camps) {
      const d = Math.hypot(c.def.x - p.x, c.def.y - p.y);
      if (!c.members.length && S.t >= c.respawnAt && (dungeon || (d < 1500 && d > 420))) {
        c.def.ids.forEach((id, i) => {
          const a = (i / c.def.ids.length) * Math.PI * 2;
          const e = spawnEnemy(id, c.def.x + Math.cos(a) * 60, c.def.y + Math.sin(a) * 60, 1, null, c.def.lvl + (Math.random() < 0.35 ? 1 : 0));
          e.camp = c; e.hx = e.x; e.hy = e.y;
          c.members.push(e);
        });
      } else if (!dungeon && c.members.length && d > 2200 && !c.members.some((e) => e.aggro)) {
        for (const e of c.members) e.dead = true;
        c.members = [];
      }
    }
    // Boss intermédiaire (repaire de la zone) ou gardien (fond du donjon)
    let fight = null;
    for (const l of w.lairs) {
      const d = Math.hypot(l.def.x - p.x, l.def.y - p.y);
      if (!l.e && S.t >= l.nextAt && d < 1300) {
        const e = spawnEnemy(l.def.id, l.def.x, l.def.y, 1, null, l.def.lvl);
        e.kind = l.def.kind; e.lair = l; e.hx = e.x; e.hy = e.y;
        l.e = e;
      } else if (l.e && !dungeon && d > 2300 && !l.e.aggro) {
        l.e.dead = true;
        l.e = null;
      }
      if (l.e && l.e.aggro && !l.e.dead) fight = l.e;
    }
    S.boss = fight;
  }

  /** Comportement d'un monstre : rôde près de son camp, attaque à l'approche, abandonne s'il est entraîné trop loin. */
  function worldAggro(e, dist, dt) {
    if (!e.aggro) {
      if (dist < (e.boss ? 520 : 340) || e.hp < e.maxHp) {
        e.aggro = true;
        if (e.camp) {
          // Le groupe entier donne l'alerte, et les groupes voisins viennent aider
          for (const m of e.camp.members) m.aggro = true;
          for (const c of S.world.camps) {
            if (c === e.camp || !c.members.length || Math.hypot(c.def.x - e.camp.def.x, c.def.y - e.camp.def.y) > 430) continue;
            for (const m of c.members) m.aggro = true;
          }
        }
      } else {
        e.wt = (e.wt || 0) - dt;
        if (e.wt <= 0) {
          e.wt = rand(1.5, 4);
          const a = rand(0, Math.PI * 2), r = rand(0, 90);
          e.wx = e.hx + Math.cos(a) * r; e.wy = e.hy + Math.sin(a) * r;
        }
        const wx = e.wx - e.x, wy = e.wy - e.y, wl = Math.hypot(wx, wy);
        if (wl > 6) { e.x += (wx / wl) * e.speed * 0.35 * dt; e.y += (wy / wl) * e.speed * 0.35 * dt; }
        return false;
      }
    } else if (dist > 1100 || Math.hypot(e.x - e.hx, e.y - e.hy) > 1500) {
      // Le joueur s'est enfui : le monstre rentre, soigné
      e.aggro = false;
      e.hp = e.maxHp;
      e.wx = e.hx; e.wy = e.hy; e.wt = 3;
      return false;
    }
    S.world.combatT = 0;
    return true;
  }

  function worldKill(e) {
    const w = S.world, dungeon = w.map.kind === 'dungeon';
    if (e.camp) {
      e.camp.members = e.camp.members.filter((m) => m !== e);
      if (!e.camp.members.length) e.camp.respawnAt = dungeon ? Infinity : S.t + 60;
    }
    if (e.lair) {
      e.lair.e = null;
      e.lair.nextAt = S.t + e.lair.def.respawn;
    }
    // Équipement : rare sur les monstres, assuré sur les boss (meilleure rareté)
    if (e.boss) {
      const n = e.kind === 'boss' ? 2 : 1;
      for (let i = 0; i < n; i++) S.gems.push({ kind: 'item', item: WORLD.makeItem(e.lvl, S.zoneIdx, 1), x: e.x + rand(-40, 40), y: e.y + rand(-40, 40), v: 0 });
    } else if (Math.random() < (dungeon ? 0.07 : 0.035) * (S.stats.loot || 1)) {
      S.gems.push({ kind: 'item', item: WORLD.makeItem(e.lvl, S.zoneIdx), x: e.x, y: e.y, v: 0 });
    }
    let first = false;
    if (e.boss) {
      first = !w.bossKilled[e.id];
      w.bossKilled[e.id] = true;
      if (e.kind === 'boss') {
        const owned = S.save.dofus.concat(S.found);
        const free = S.zone.dofus.filter((d) => !owned.includes(d));
        if (free.length && (first || Math.random() < 0.1)) S.gems.push({ kind: 'dofus', id: pick(free), x: e.x, y: e.y, v: 0 });
      } else S.gems.push({ kind: 'chest', x: e.x, y: e.y, v: 0 });
    }
    // Quête
    const q = WORLD.QUESTS[w.quest];
    let done = null;
    if (q && w.qAccepted && ((q.goal.kill === e.id && ++w.qProgress >= q.goal.n) || q.goal.boss === e.id)) done = completeQuest();
    if (e.kind === 'boss') guardianChoice(e, done, first);
    else if (done) cb.onDialog(done);
    if (done || e.boss) cb.onSave();
  }

  /** Gardien vaincu au fond du donjon : passer à la zone suivante ou rester. */
  function guardianChoice(e, done, first) {
    const zi = S.zoneIdx, next = WORLD.zones[zi + 1];
    const d = done || { npc: WORLD.NPCS[zi], title: e.def.name + ' est vaincu !', lines: ['Le donjon est libéré. Le gardien reviendra la prochaine fois que tu entreras.'] };
    d.lines = d.lines.slice();
    if (next) {
      if (first) d.lines.push(`La route ${/^[AEIOUÉ]/.test(next.name) ? 'd’' : 'de '}${next.name} est ouverte.`);
      d.lines.push(`Là-bas, les monstres sont de niveau ${next.lvl[0]} à ${next.lvl[1]} : bien plus durs à tuer, mais leur équipement est meilleur.`);
      d.choices = [
        { id: 'next', label: `Aller vers ${next.name}`, sub: `Monstres niv. ${next.lvl[0]}–${next.lvl[1]}`, main: true },
        { id: 'stay', label: 'Rester ici', sub: `Continuer à t’équiper : ${S.zone.name}` },
      ];
    } else {
      d.choices = [{ id: 'stay', label: 'Sortir du donjon', main: true }];
    }
    cb.onDialog(d);
  }

  /** Réponse au choix de fin de donjon. */
  function worldChoice(id) {
    if (!S || S.mode !== 'world') return;
    const zi = S.zoneIdx;
    if (id === 'next' && WORLD.zones[zi + 1]) loadMap(WORLD.zones[zi + 1]);
    else loadMap(WORLD.zones[zi], { x: WORLD.zones[zi].door.x - 170, y: 40 });
    cb.onSave();
  }

  function questText(q, w) {
    if (!q) return 'Explore librement le Monde des Douze';
    if (!w.qAccepted) return 'Parle à ' + WORLD.NPCS[q.zone].name + ' (' + ZONES[q.zone].name + ')';
    if (q.goal.kill) return `Vaincre des ${MONSTERS[q.goal.kill].name.toLowerCase()}s : ${w.qProgress} / ${q.goal.n}`;
    if (q.goal.boss === ZONES[q.zone].boss) return 'Vaincre ' + MONSTERS[q.goal.boss].name + ' au fond du donjon';
    return 'Vaincre ' + MONSTERS[q.goal.boss].name;
  }

  /** Termine la quête en cours, donne la récompense et renvoie le dialogue à afficher. */
  function completeQuest() {
    const w = S.world, q = WORLD.QUESTS[w.quest];
    gainXp(q.xp);
    S.kamas += q.kamas;
    w.quest++;
    w.qProgress = 0;
    const next = WORLD.QUESTS[w.quest];
    // Les quêtes d'une même zone s'enchaînent ; la suivante se reçoit auprès du personnage de la nouvelle zone
    w.qAccepted = !!next && next.zone === q.zone;
    return { npc: WORLD.NPCS[q.zone], title: 'Quête terminée : ' + q.title, reward: `+${q.xp} XP · +${q.kamas} kamas`,
      lines: [...q.done, ...(w.qAccepted ? next.intro : [])], next: w.qAccepted ? next.title : null };
  }

  /** Lieu à portée du héros (pour le bouton d'action). */
  function nearby() {
    const p = S.p, m = S.world.map, near = (o, r = 130) => Math.hypot(o.x - p.x, o.y - p.y) < r;
    if (m.kind === 'zone') {
      if (near(m.npc)) return { kind: 'npc', label: 'Parler à ' + m.npc.name };
      if (near(m.zaap)) return { kind: 'zaap', label: 'Utiliser le zaap' };
      if (near(m.door, 170)) return { kind: 'door', label: `Entrer dans le donjon (niv. ${WORLD.DUNGEON_LEVEL[m.zone]})` };
    } else if (near(m.exit, 150)) return { kind: 'exit', label: 'Quitter le donjon' };
    return null;
  }

  /** Touche E / bouton d'action. */
  function interact() {
    if (!S || S.mode !== 'world' || S.over) return;
    const n = nearby();
    if (!n) return;
    const w = S.world, m = w.map, q = WORLD.QUESTS[w.quest];
    if (n.kind === 'npc') {
      const npc = m.npc;
      if (q && q.zone === m.zone && !w.qAccepted) {
        w.qAccepted = true;
        cb.onDialog({ npc, title: 'Nouvelle quête : ' + q.title, lines: q.intro });
        cb.onSave();
      } else if (q && q.zone === m.zone) {
        cb.onDialog({ npc, title: q.title, lines: ['Tu n’as pas encore fini ? ' + questText(q, w) + '.'] });
      } else if (q && q.zone < m.zone) {
        cb.onDialog({ npc, title: npc.name, lines: ['Tu es en avance ! ' + WORLD.NPCS[q.zone].name + ' a encore besoin de toi à ' + ZONES[q.zone].name + '.'] });
      } else {
        cb.onDialog({ npc, title: npc.name, lines: [!q ? 'Grâce à toi, la brume a disparu. Merci, héros !' : 'Merci pour ton aide ! D’autres ont besoin de toi plus loin.'] });
      }
    } else if (n.kind === 'zaap') {
      cb.onZaap(WORLD.zones.map((z, i) => ({ idx: i, name: z.name, lvl: z.lvl, here: i === m.zone, open: WORLD.unlocked(i, w.bossKilled) })));
    } else if (n.kind === 'door') {
      const need = WORLD.DUNGEON_LEVEL[m.zone];
      if (S.level < need) { cb.onBanner('Donjon trop dangereux', `Il faut être niveau ${need} pour entrer`); return; }
      loadMap(m.dungeon);
    } else if (n.kind === 'exit') {
      const z = WORLD.zones[m.zone];
      loadMap(z, { x: z.door.x - 170, y: 40 });
      cb.onSave();
    }
  }

  /** Voyage par zaap vers une zone débloquée. */
  function travel(i) {
    if (!S || S.mode !== 'world' || !WORLD.zones[i] || !WORLD.unlocked(i, S.world.bossKilled)) return;
    loadMap(WORLD.zones[i]);
    cb.onSave();
  }

  function respawnAtZaap() {
    loadMap(WORLD.zones[S.zoneIdx]);
    S.p.hp = S.p.maxHp;
    S.over = false;
    cb.onSave();
  }

  /** Données pour l'interface (quête, action possible, mini-carte). */
  function worldHud() {
    const w = S.world, q = WORLD.QUESTS[w.quest], n = nearby(), m = w.map;
    return {
      zone: m.kind === 'zone' ? m.name : 'Donjon · ' + m.name, quest: q ? q.title : 'Le Monde des Douze est sauvé', goal: questText(q, w),
      action: n ? n.label : null, px: S.p.x, py: S.p.y, map: m, level: S.level,
      npcAlert: q && !w.qAccepted && q.zone === m.zone && m.kind === 'zone',
      camps: w.camps.filter((c) => c.members.length || S.t >= c.respawnAt).map((c) => c.def),
      bosses: w.lairs.filter((l) => S.t >= l.nextAt).map((l) => l.def),
      pts: [caracPoints(), talentPoints()], open: WORLD.zones.map((z, i) => WORLD.unlocked(i, w.bossKilled)),
    };
  }

  /** Équipement porté (pour l'écran de pause). */
  function equipment() { return S && S.equip ? S.equip : {}; }

  /** Sauvegarde du héros et de sa progression (sans le butin, voir takeLoot). */
  function worldSnapshot() {
    if (!S || S.mode !== 'world') return null;
    const w = S.world, m = w.map, z = WORLD.zones[S.zoneIdx];
    // Dans un donjon, on reprendra devant son entrée
    const pos = m.kind === 'zone' ? { x: Math.round(S.p.x), y: Math.round(S.p.y) } : { x: z.door.x - 170, y: 40 };
    return {
      cls: S.cls, level: S.level, xp: S.xp, equip: Object.assign({}, S.equip), carac: Object.assign({}, S.carac),
      talents: { spells: Object.assign({}, S.talents.spells), passives: Object.assign({}, S.talents.passives) },
      spells: S.spells.map((sp) => ({ id: sp.id, lvl: sp.lvl })), zone: S.zoneIdx, pos,
      quest: w.quest, qProgress: w.qProgress, qAccepted: w.qAccepted, bossKilled: Object.assign({}, w.bossKilled),
      playTime: Math.round(w.playTime),
    };
  }
  /** Kamas et Dofus gagnés depuis la dernière sauvegarde (remis à zéro). */
  function takeLoot() {
    if (!S) return { kamas: 0, found: [] };
    const loot = { kamas: Math.floor(S.kamas), found: S.found.slice() };
    S.kamas -= loot.kamas;
    S.found = [];
    return loot;
  }

  /** Objet ramassé : équipé s'il est meilleur que celui porté, sinon revendu. */
  function pickItem(it) {
    const cur = S.equip[it.slot];
    if (!cur || it.power > cur.power) {
      S.equip[it.slot] = it;
      recomputeStats();
      cb.onToast(`Équipé : ${it.name}`, it.color, WORLD.itemDesc(it));
    } else {
      const k = Math.ceil(it.power * 3 * S.zone.kamas);
      S.kamas += k;
      cb.onToast(`${it.name} revendu`, '#bdb3d6', `+${k} kamas (moins bon que ton équipement)`);
    }
  }

  // ------------------------------------------------------------ Boucle
  function loop(now) {
    raf = requestAnimationFrame(loop);
    let dt = (now - lastT) / 1000;
    lastT = now;
    // L'horodatage de la première image peut précéder le démarrage : jamais de pas négatif
    if (dt < 0) dt = 0;
    if (dt > 0.05) dt = 0.05;
    if (!S) return;
    // Mode test accéléré : plusieurs pas de simulation par image
    if (!paused && !S.choosing) for (let i = 0; i < TEST.speed && !S.choosing; i++) update(dt);
    draw(dt);
    if (SHOW_FPS) {
      fpsAcc += dt; fpsFrames++;
      if (fpsAcc >= 0.5) { fps = fpsFrames / fpsAcc; fpsAcc = 0; fpsFrames = 0; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(0,0,0,.6)';
      ctx.fillRect(8, H - 58, 196, 46);
      ctx.fillStyle = '#fff';
      ctx.fillText(`${fps.toFixed(0)} img/s · ${r3 ? '3D' : '2D'} · ${S.enemies.length} monstres`, 16, H - 38);
      ctx.fillText(`rendu : ${renderMs.toFixed(1)} ms/image`, 16, H - 20);
    }
    hudTimer -= dt;
    if (hudTimer <= 0) { hudTimer = 0.1; cb.onHud(hudData()); }
  }

  function hudData() {
    return {
      hp: S.p.hp, maxHp: S.p.maxHp, shield: S.p.shield, xp: S.xp, xpNext: S.xpNext, level: S.level,
      t: S.t, kills: S.kills, kamas: Math.floor(S.kamas), spells: S.spells, passives: S.mode === 'world' && S.talents ? S.talents.passives : S.passives,
      cls: S.cls, rerolls: S.rerolls, banishes: S.banishes,
      cds: S.spells.map((sp) => (sp.s.cd ? clamp(sp.timer / (sp.s.cd * S.stats.cd), 0, 1) : 0)),
      boss: S.boss && !S.boss.dead && (S.mode !== 'world' || S.boss.aggro) ? { name: S.boss.def.name + (S.boss.lvl ? ' · niv. ' + S.boss.lvl : ''), hp: S.boss.hp, maxHp: S.boss.maxHp } : null,
      world: S.mode === 'world' ? worldHud() : null,
    };
  }

  function update(dt) {
    S.t += dt;
    updatePlayer(dt);
    buildGrid();
    if (S.mode === 'world') updateWorld(dt); else spawn(dt);
    updateSpells(dt);
    updateEnemies(dt);
    updateProjectiles(dt);
    updateZones(dt);
    updateGems(dt);
    updateFx(dt);

    if (S.mode === 'world' && S.pending > 0) worldLevelUp();
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
      const sp = CLASSES[S.cls].speed * S.stats.speed;
      p.x += mx * sp * dt; p.y += my * sp * dt;
      const n = Math.hypot(mx, my);
      p.dirX = mx / n; p.dirY = my / n;
      if (Math.abs(mx) > 0.1) p.face = mx > 0 ? 1 : -1;
      p.walk += dt * 10;
    }
    if (S.mode === 'world') {
      // Bords de la carte
      const m = S.world.map;
      p.x = clamp(p.x, 40, m.w - 40);
      p.y = clamp(p.y, -m.h + 40, m.h - 40);
      // Eau, gouffres et maisons
      if (m.kind === 'zone') [p.x, p.y] = WORLD.collide(m, p.x, p.y, p.r);
      // Hors combat depuis 6 s : la vie remonte
      S.world.combatT += dt;
      if (S.world.combatT > 6 && p.hp > 0) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.04 * dt);
    }
    p.hurt = Math.max(0, p.hurt - dt);
    p.inv = Math.max(0, p.inv - dt);
    if (S.stats.regen && p.hp > 0) p.hp = Math.min(p.maxHp, p.hp + S.stats.regen * dt);
  }

  function damagePlayer(d) {
    const p = S.p;
    if (S.over || p.hp <= 0 || GOD_MODE) return;
    if (S.stats.dodge && Math.random() < S.stats.dodge) {
      if (p.inv <= 0) addText(p.x, p.y - 30, 'Esquive', '#8fd9a0');
      p.inv = Math.max(p.inv, 0.2);
      return;
    }
    d *= 1 - S.stats.armor;
    if (p.shield > 0) {
      const a = Math.min(p.shield, d);
      p.shield -= a; d -= a;
    }
    if (d <= 0) return;
    p.hp -= d;
    p.hurt = 0.15;
    if (p.hp <= 0) {
      if (p.revive > 0) {
        p.revive--;
        p.hp = p.maxHp * 0.5;
        S.fx.push({ type: 'ring', x: p.x, y: p.y, r: 220, t: 0, life: 0.6, color: '#fff6a0' });
        for (const e of S.enemies) if (!e.boss) knock(e, p.x, p.y, 200);
        cb.onBanner('Résurrection !', '');
      } else if (S.mode === 'world') {
        p.hp = 0;
        S.over = true;
        S.world.dead = 2;
        cb.onBanner('K.O. !', 'Retour au zaap de la zone…');
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
  // Distance d'apparition des monstres : juste hors de l'écran (calculée par la caméra en 3D)
  let r3Radius = 0, r3RadiusAt = -1;
  function viewRadius() {
    if (r3 && S) {
      if (S.t - r3RadiusAt > 0.5 || r3RadiusAt < 0) { r3Radius = r3.viewRadius(S.p.x, S.p.y); r3RadiusAt = S.t; }
      return r3Radius;
    }
    return Math.hypot(W, H) / 2 / zoom + 50;
  }

  function spawnEnemy(id, x, y, hpMul = 1, zone = null, lvl = 0) {
    const def = MONSTERS[id], z = zone || S.zone;
    const world = S.mode === 'world';
    const scale = def.boss || world ? 1 : 1 + S.t / 200;
    if (x === undefined) {
      const a = rand(0, Math.PI * 2), R = viewRadius();
      x = S.p.x + Math.cos(a) * R; y = S.p.y + Math.sin(a) * R;
    }
    // Aventure : chaque niveau au-dessus du minimum de la zone rend le monstre plus solide
    const lk = world ? Math.max(0, lvl - WORLD.LEVELS[S.zoneIdx][0]) : 0;
    const hp = def.hp * z.hpMul * scale * hpMul * (1 + 0.07 * lk);
    const e = {
      id, def, x, y, r: def.r, hp, maxHp: hp, speed: def.speed * rand(0.9, 1.1),
      dmg: def.dmg * z.dmgMul * (world ? 1 + 0.04 * lk : 1 + S.t / 400), xp: def.xp * (world ? (def.boss ? 1 + lvl * 0.15 : 2 + lvl * 0.6) : 1), boss: def.boss || 0, lvl,
      kvx: 0, kvy: 0, slow: 0, slowT: 0, poison: 0, poisonT: 0, poisonAcc: 0, atk: 0, flash: 0,
      seed: Math.random() * 10, shot: rand(1, 2), hitT: {}, ab: 3, charge: 0, cx: 0, cy: 0,
    };
    if (world && lvl) {
      // Monstre bien plus fort que le héros : il frappe plus fort et encaisse mieux
      const gap = lvl - S.level;
      if (gap >= 5) { e.dmg *= 1 + Math.min(0.6, 0.04 * gap); e.tough = Math.max(0.5, 1 - 0.04 * gap); }
    }
    S.enemies.push(e);
    return e;
  }

  function spawn(dt) {
    if (S.over || S.victory) return;
    const z = S.zone, t = S.t;
    const avail = z.monsters.slice(0, Math.min(z.monsters.length, 1 + Math.floor(t / 40)));
    const rate = 0.9 + t / 28;
    S.spawnAcc += rate * dt;
    if (STRESS) S.spawnAcc = Math.max(S.spawnAcc, MAX_ENEMIES - S.enemies.length);
    while (S.spawnAcc >= 1) {
      S.spawnAcc -= 1;
      if (S.enemies.length < MAX_ENEMIES) spawnEnemy(pick(avail));
    }
    if (t >= S.nextWave) {
      S.nextWave += 60;
      const id = pick(avail), n = Math.floor(14 + t / 18), R = viewRadius() - 20;
      for (let i = 0; i < n && S.enemies.length < MAX_ENEMIES + 40; i++) {
        const a = (i / n) * Math.PI * 2;
        spawnEnemy(id, S.p.x + Math.cos(a) * R, S.p.y + Math.sin(a) * R);
      }
      cb.onBanner('Une horde approche !', '');
    }
    const b = BOSS_TIMES[S.bossIdx];
    if (b && t >= b.t) {
      S.bossIdx++;
      const id = b.kind === 'boss' ? z.boss : z.mini;
      const e = spawnEnemy(id, undefined, undefined, b.hp);
      e.kind = b.kind;
      S.boss = e;
      cb.onBanner(MONSTERS[id].name, b.kind === 'boss' ? 'Le gardien de la zone apparaît !' : 'Un boss apparaît !');
    }
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
    let d = base * S.stats.dmg * (e.tough || 1);
    if (o.rage) d *= 1 + (1 - S.p.hp / S.p.maxHp) * 1.5;
    if (o.gamble) d *= rand(0.3, 2.5); // Écaflip : dégâts aléatoires
    const crit = Math.random() < S.stats.crit + (o.crit || 0);
    if (crit) d *= 2;
    d *= rand(0.9, 1.1);
    e.hp -= d;
    e.flash = 0.08;
    addText(e.x + rand(-6, 6), e.y - e.r, Math.round(d), crit ? '#ffdd33' : '#ffffff', crit);
    if (o.knock) knock(e, o.sx ?? S.p.x, o.sy ?? S.p.y, o.knock);
    if (o.poison) { e.poison = Math.max(e.poison, o.poison * S.stats.dmg); e.poisonT = Math.max(e.poisonT, o.poisonDur); }
    if (o.slow) { e.slow = Math.max(e.slow, o.slow); e.slowT = 0.7; }
    if (o.gold) e.gold = true;
    if (e.hp <= 0) kill(e);
  }

  function aoe(x, y, r, dmg, o, color) {
    query(x, y, r, (e) => hitEnemy(e, dmg, Object.assign({ sx: x, sy: y }, o)));
    S.fx.push({ type: 'ring', x, y, r, t: 0, life: 0.35, color: color || '#fff' });
  }

  function kill(e) {
    e.dead = true;
    S.kills++;
    const z = S.zone;
    gainXp(S.mode === 'world' ? e.xp * xpGap(e) : e.xp, e.x, e.y);
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
      if (S.mode === 'world') {
        // butin géré par worldKill
      } else if (e.kind === 'boss') {
        const owned = S.save.dofus.concat(S.found);
        const free = z.dofus.filter((d) => !owned.includes(d));
        if (free.length) S.gems.push({ kind: 'dofus', id: pick(free), x: e.x, y: e.y, v: 0 });
        else S.gems.push({ kind: 'kamas', x: e.x, y: e.y, v: Math.ceil(250 * z.kamas) });
        S.victory = true;
        S.endTimer = 3.5;
        for (const g of S.gems) g.mag = true;
        for (const o of S.enemies) if (!o.dead && o !== e) { o.dead = true; gainXp(o.xp, o.x, o.y); }
        cb.onBanner('Victoire !', e.def.name + ' est vaincu');
      } else {
        S.gems.push({ kind: 'chest', x: e.x, y: e.y, v: 0 });
      }
    }
    if (S.mode === 'world') worldKill(e);
  }

  /** Étiquettes de l'aventure : nom du personnage, niveau des groupes de monstres. */
  function worldLabels(proj) {
    const w = S.world, m = w.map, p = S.p;
    ctx.textAlign = 'center';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.75)';
    const label = (txt, x, y, h, color, font) => {
      const q = proj(x, y, h);
      ctx.font = font; ctx.fillStyle = color;
      ctx.strokeText(txt, q.x, q.y); ctx.fillText(txt, q.x, q.y);
    };
    if (m.kind === 'zone' && Math.abs(m.npc.x - p.x) < 1400) label(m.npc.name, m.npc.x, m.npc.y, 2.55, '#f2c14e', 'bold 13px system-ui, sans-serif');
    if (m.kind === 'zone' && Math.abs(m.door.x - p.x) < 1400) label('Donjon : ' + m.dungeon.name, m.door.x, m.door.y, 3.6, '#ffd0a0', 'bold 13px system-ui, sans-serif');
    for (const c of w.camps) {
      const alive = c.members.filter((e) => !e.dead);
      if (!alive.length || alive.some((e) => e.aggro)) continue;
      if (Math.hypot(c.def.x - p.x, c.def.y - p.y) > 1100) continue;
      const lv = c.def.lvl, diff = lv - S.level;
      const col = diff >= 6 ? '#ff5a4a' : diff >= 3 ? '#ffb347' : diff <= -4 ? '#8fd9a0' : '#ffffff';
      label('Niv. ' + lv, alive[0].x, alive[0].y, 1.9, col, 'bold 12px system-ui, sans-serif');
    }
  }

  /**
   * L'expérience est gagnée dès que le monstre meurt (plus de cristal à ramasser).
   * Un petit cristal vole jusqu'au héros pour montrer le gain.
   */
  function gainXp(v, x, y) {
    S.xp += v * S.stats.xp;
    while (S.xp >= S.xpNext) { S.xp -= S.xpNext; S.level++; S.xpNext = xpFor(S.level); S.pending++; }
    if (x !== undefined && S.fx.length < 260) S.fx.push({ type: 'xp', x, y, t: 0, life: 0.38, v });
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
      S.aim = null;
      const done = cast(sp, def, s);
      sp.timer = done ? s.cd * S.stats.cd : 0.15;
      // Dernier sort lancé : le rendu 3D s'en sert pour le geste du héros et les effets
      if (done) S.lastCast = { id: sp.id, type: def.type, t: S.t, aim: S.aim, n: (S.lastCast ? S.lastCast.n : 0) + 1 };
    }
  }

  function cast(sp, def, s) {
    const p = S.p, area = S.stats.area;
    switch (def.type) {
      case 'projectile': {
        const targets = nearest(p.x, p.y, s.range, s.spread ? 1 : Math.round(s.count));
        if (!targets.length) return false;
        S.aim = Math.atan2(targets[0].y - p.y, targets[0].x - p.x);
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
            poisonDur: s.poisonDur || 0, gold: s.gold, gamble: s.gamble, color: def.color, id: sp.id, hit: new Set(),
          });
        }
        return true;
      }
      case 'melee': {
        const range = s.range * area;
        const t = nearest(p.x, p.y, range * 1.6, 1)[0];
        if (!t) return false;
        const a = Math.atan2(t.y - p.y, t.x - p.x);
        S.aim = a;
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
          S.strikes.push({ x: e.x, y: e.y, r: s.radius * area, dmg: s.dmg, t: s.delay, life: s.delay, color: def.color, gamble: s.gamble, id: sp.id, spin: Math.random() * 6 });
          if (i === 0) S.aim = Math.atan2(e.y - p.y, e.x - p.x);
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
      case 'glyph':
        S.glyphs.push({ x: p.x, y: p.y, r: s.radius * area, dmg: s.dmg, tick: s.tick, tt: 0, life: s.duration, max: s.duration, color: def.color, id: sp.id });
        return true;
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
        S.fx.push({ type: 'ring', x: p.x, y: p.y, r: 34, t: 0, life: 0.4, color: def.color });
        return true;
    }
    return true;
  }

  function auraTick(sp) {
    const s = sp.s, p = S.p;
    query(p.x, p.y, s.radius * S.stats.area, (e) => hitEnemy(e, s.dmg, { slow: s.slow }));
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
        hitEnemy(e, s.dmg, { knock: 25, sx: p.x, sy: p.y, gamble: s.gamble });
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
      if (S.mode === 'world' && !worldAggro(e, dist, dt)) continue;

      if (e.boss) {
        e.ab -= dt;
        if (e.charge > 0) {
          e.charge -= dt;
          e.x += e.cx * sp * 3.2 * dt; e.y += e.cy * sp * 3.2 * dt;
          sp = 0;
        } else if (e.ab <= 0) {
          e.ab = e.boss === 2 ? 4.5 : 5.5;
          e.abAt = S.t; // le rendu 3D lance l'animation d'attaque du boss
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

      if (dist < e.r + p.r && e.atk <= 0 && p.inv <= 0) {
        e.atk = 0.8;
        p.inv = 0.3; // courte invincibilité après un coup au contact
        damagePlayer(e.dmg);
      }
      // éloigne les monstres trop loin derrière le joueur
      if (S.mode !== 'world' && !e.boss && dist > viewRadius() * 1.6) {
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
    if (S.mode === 'world' && S.world.map.kind === 'zone') {
      const m = S.world.map;
      for (const e of S.enemies) if (!e.dead) [e.x, e.y] = WORLD.collide(m, e.x, e.y, e.r * 0.8);
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
        hitEnemy(e, pr.dmg, { knock: pr.knock, poison: pr.poison, poisonDur: pr.poisonDur, gold: pr.gold, gamble: pr.gamble, sx: pr.x - pr.vx, sy: pr.y - pr.vy });
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
    aoe(pr.x, pr.y, pr.explode, pr.dmg, { knock: 20, gold: pr.gold, gamble: pr.gamble }, pr.color);
  }

  function updateZones(dt) {
    for (const g of S.glyphs) {
      g.life -= dt; g.tt -= dt;
      if (g.tt <= 0) { g.tt = g.tick; query(g.x, g.y, g.r, (e) => hitEnemy(e, g.dmg, {})); }
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
      if (s.t <= 0) { aoe(s.x, s.y, s.r, s.dmg, { knock: 30, gamble: s.gamble }, s.color); s.done = true; }
    }
    S.strikes = S.strikes.filter((s) => !s.done);
  }

  // ------------------------------------------------------------ Ramassage
  function updateGems(dt) {
    const p = S.p, pr = S.stats.pickup;
    for (const g of S.gems) {
      const dd = Math.sqrt(d2(g.x, g.y, p.x, p.y));
      if (!g.mag && (g.kind === 'xp' || g.kind === 'kamas') && dd < pr) g.mag = true;
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
      case 'xp': gainXp(g.v); break;
      case 'kamas': S.kamas += g.v * S.stats.kamas; break;
      case 'heal': {
        const h = p.maxHp * 0.3; p.hp = Math.min(p.maxHp, p.hp + h);
        addText(p.x, p.y - 30, '+' + Math.round(h), '#7dff9a', true);
        break;
      }
      case 'magnet': for (const o of S.gems) if (o.kind === 'xp' || o.kind === 'kamas') o.mag = true; break;
      case 'chest':
        if (S.mode === 'world') {
          // Aventure : le coffre donne de l'équipement au lieu d'améliorations
          S.kamas += 30 * S.zone.kamas * S.stats.kamas;
          pickItem(WORLD.makeItem(S.level + 2, S.zoneIdx, 1));
          break;
        }
        S.pending += 2;
        S.kamas += 30 * S.zone.kamas * S.stats.kamas;
        cb.onBanner('Coffre !', '+2 améliorations');
        break;
      case 'item': pickItem(g.item); break;
      case 'dofus':
        S.found.push(g.id);
        cb.onBanner(DOFUS[g.id].name + ' !', DOFUS[g.id].desc);
        break;
    }
  }

  // ------------------------------------------------------------ Niveaux
  function genChoices() {
    const opts = [];
    for (const id of CLASSES[S.cls].spells) {
      if (S.banned.has(id)) continue;
      const own = S.spells.find((s) => s.id === id);
      const def = SPELLS[id];
      if (!own) opts.push({ kind: 'spell', id, lvl: 1, w: 3, name: def.name, icon: def.icon, color: def.color, desc: def.desc });
      else if (own.lvl < 5) opts.push({ kind: 'spell', id, lvl: own.lvl + 1, w: 2.5, name: def.name, icon: def.icon, color: def.color, desc: def.up[own.lvl - 1].d });
    }
    const nPass = Object.keys(S.passives).length;
    for (const id in PASSIVES) {
      const l = S.passives[id] || 0, def = PASSIVES[id];
      if (S.banned.has(id) || l >= def.max || (!l && nPass >= MAX_PASSIVES)) continue;
      opts.push({ kind: 'passive', id, lvl: l + 1, w: 1, name: def.name, icon: def.icon, color: def.color, desc: def.desc });
    }
    const out = [];
    while (out.length < 3 && opts.length) {
      let tot = opts.reduce((a, o) => a + o.w, 0), r = Math.random() * tot, i = 0;
      while ((r -= opts[i].w) > 0) i++;
      out.push(opts.splice(i, 1)[0]);
    }
    if (!out.length) {
      out.push({ kind: 'heal', name: 'Pain d’Amakna', icon: '🍞', color: '#e0b060', desc: 'Rend 50% des PV', lvl: 0 });
      out.push({ kind: 'kamas', name: 'Bourse', icon: 'K', color: '#ffd84a', desc: '+50 kamas', lvl: 0 });
    }
    return out;
  }

  function choose(c) {
    if (c.kind === 'spell') {
      const own = S.spells.find((s) => s.id === c.id);
      if (own) { own.lvl++; own.s = spellStats(own); } else addSpell(c.id);
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
      victory: S.victory, t: S.t, kills: S.kills, level: S.level,
      kamas: Math.floor(S.kamas), found: S.found.slice(), zoneIdx: S.zoneIdx, cls: S.cls,
    };
    cancelAnimationFrame(raf);
    draw(0);
    S.ended = true;
    cb.onEnd(res);
  }

  // ------------------------------------------------------------ Effets
  function updateFx(dt) {
    for (const f of S.fx) {
      f.t += dt;
      if (f.type === 'spark') { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 300 * dt; }
    }
    S.fx = S.fx.filter((f) => f.t < f.life);
    for (const t of S.texts) { t.t += dt; t.y -= 40 * dt; }
    S.texts = S.texts.filter((t) => t.t < t.life);
  }

  // ============================================================ Rendu
  function draw(dt) {
    const t0 = performance.now();
    if (r3) { r3.render(S, dt); renderOverlay3D(); } else render();
    renderMs = renderMs * 0.9 + (performance.now() - t0) * 0.1;
  }

  /** En 3D : le canvas 2D, transparent par-dessus, garde les chiffres de dégâts et les indicateurs. */
  function renderOverlay3D() {
    const p = S.p;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.textAlign = 'center';
    for (const t of S.texts) {
      const q = r3.project(t.x, t.y, 1.4 + (t.t / t.life) * 0.6);
      ctx.globalAlpha = 1 - t.t / t.life;
      ctx.font = (t.big ? 'bold 18px ' : 'bold 13px ') + 'system-ui, sans-serif';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.7)';
      ctx.strokeText(t.txt, q.x, q.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.txt, q.x, q.y);
    }
    ctx.globalAlpha = 1;
    // Barre de vie au-dessus des monstres blessés
    for (const e of S.enemies) {
      if (e.boss || e.hp >= e.maxHp || e.dead) continue;
      const q = r3.project(e.x, e.y, (e.r * 2.4) / r3.U + 0.15);
      if (q.x < -20 || q.x > W + 20 || q.y < -20 || q.y > H + 20) continue;
      const w = Math.max(16, e.r * 1.4);
      ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(q.x - w / 2, q.y, w, 3);
      ctx.fillStyle = '#ff4a4a'; ctx.fillRect(q.x - w / 2, q.y, w * Math.max(0, e.hp / e.maxHp), 3);
    }
    // Flèche vers le boss quand il est hors de l'écran
    if (S.boss && !S.boss.dead) {
      const q = r3.project(S.boss.x, S.boss.y, 1);
      if (q.x < 0 || q.x > W || q.y < 0 || q.y > H) {
        const c = r3.project(p.x, p.y, 1);
        const a = Math.atan2(q.y - c.y, q.x - c.x);
        const ex = clamp(q.x, 24, W - 24), ey = clamp(q.y, 24, H - 24);
        ctx.save(); ctx.translate(ex, ey); ctx.rotate(a);
        ctx.fillStyle = '#ff3b3b';
        ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -10); ctx.lineTo(-8, 10); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }
    if (S.mode === 'world') worldLabels((x, y, h) => r3.project(x, y, h));
    screenOverlay(p);
  }

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
      isoEllipse(g.x, g.y, g.r); ctx.fill();
      ctx.globalAlpha = 0.8 * a;
      ctx.strokeStyle = g.color; ctx.lineWidth = 3;
      isoEllipse(g.x, g.y, g.r); ctx.stroke();
      isoEllipse(g.x, g.y, g.r * 0.6); ctx.stroke();
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
      } else if (f.type === 'xp') {
        // Cristal d'expérience qui file vers le héros
        const e = k * k, x = f.x + (p.x - f.x) * e, y = f.y + (p.y - 20 - f.y) * e - Math.sin(k * Math.PI) * 30, s = f.v >= 10 ? 6 : f.v >= 3 ? 5 : 4;
        ctx.globalAlpha = 1;
        ctx.fillStyle = f.v >= 10 ? '#ff5fa2' : f.v >= 3 ? '#4fd1ff' : '#7dff6a';
        ctx.beginPath(); ctx.moveTo(x, y - s * 1.4); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s * 1.4); ctx.lineTo(x - s, y); ctx.closePath(); ctx.fill();
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

    if (S.mode === 'world') {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      worldLabels((x, y, h) => ({ x: (x - p.x) * zoom + W / 2, y: (y - p.y - h * 22) * zoom + H / 2 }));
    }
    screenOverlay(p);
  }

  /** Joystick tactile et vignette rouge de dégâts, communs aux rendus 2D et 3D. */
  function screenOverlay(p) {
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
    if (S.mode !== 'world') return drawZoneGround(S.zone, x0, y0, x1, y1);
    const m = S.world.map, z = S.zone, dungeon = m.kind === 'dungeon';
    // Hors de la carte : falaise sombre
    ctx.fillStyle = dungeon ? '#0e0a16' : shade(z.ground, 0.45);
    ctx.fillRect(x0 - 10, y0 - 10, x1 - x0 + 20, y1 - y0 + 20);
    const bx0 = Math.max(x0 - 10, 0), bx1 = Math.min(x1 + 10, m.w);
    const by0 = Math.max(y0 - 10, -m.h), by1 = Math.min(y1 + 10, m.h);
    if (bx1 > bx0 && by1 > by0) {
      ctx.save();
      ctx.beginPath(); ctx.rect(bx0, by0, bx1 - bx0, by1 - by0); ctx.clip();
      if (dungeon) {
        ctx.fillStyle = '#3a3346';
        ctx.fillRect(bx0, by0, bx1 - bx0, by1 - by0);
        ctx.fillStyle = '#332c3e';
        const T = 64;
        for (let gy = Math.floor(by0 / T) * T; gy < by1; gy += T)
          for (let gx = Math.floor(bx0 / T) * T; gx < bx1; gx += T) if (((gx + gy) / T) & 1) ctx.fillRect(gx, gy, T, T);
      } else {
        ctx.fillStyle = z.ground;
        ctx.fillRect(bx0, by0, bx1 - bx0, by1 - by0);
        drawZoneGround(z, bx0, by0, bx1, by1);
      }
      ctx.restore();
    }
    if (dungeon) {
      // Murs et torches du donjon
      ctx.fillStyle = '#241d30';
      ctx.fillRect(x0 - 10, -m.h - 60, x1 - x0 + 20, 60);
      ctx.fillRect(x0 - 10, m.h, x1 - x0 + 20, 30);
      ctx.fillStyle = '#ff9a3a';
      for (let tx = Math.floor(x0 / 300) * 300 + 150; tx < x1; tx += 300) { ctx.beginPath(); ctx.arc(tx, -m.h - 20, 6 + Math.sin(S.t * 9 + tx) * 1.5, 0, Math.PI * 2); ctx.fill(); }
    }
    drawWorldPlaces();
  }

  /** Chemins, plans d'eau et ponts (rendu 2D). */
  function drawTerrain2D(m, x0, y0, x1, y1) {
    const [rc, re] = WORLD.ROAD_COL[m.decoType] || WORLD.ROAD_COL.grass;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const [col, wd] of [[re, 96], [rc, 74]]) {
      ctx.strokeStyle = col; ctx.lineWidth = wd;
      for (const road of m.roads) { ctx.beginPath(); road.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); }
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(m.plaza.x, m.plaza.y, m.plaza.r + (wd - 74) / 2, 0, Math.PI * 2); ctx.fill();
    }
    // Pavés de la place du zaap
    ctx.strokeStyle = 'rgba(0,0,0,.08)'; ctx.lineWidth = 2;
    for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.arc(m.plaza.x, m.plaza.y, (m.plaza.r * k) / 4, 0, Math.PI * 2); ctx.stroke(); }
    for (const pass of ['rim', 'fill', 'shine']) for (const w of m.water) {
      if (w.x + w.rx + 30 < x0 || w.x - w.rx - 30 > x1 || w.y + w.ry + 30 < y0 || w.y - w.ry - 30 > y1) continue;
      const k = WORLD.WATER_KIND[w.kind];
      if (pass === 'shine') {
        if (w.kind === 'chasm') continue;
        ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(w.x - w.rx * 0.2, w.y - w.ry * 0.25 + Math.sin(S.t * 1.5 + w.x) * 3, w.rx * 0.35, w.ry * 0.12, 0, 0, Math.PI * 2); ctx.stroke();
        continue;
      }
      ctx.fillStyle = pass === 'rim' ? k.rim : k.fill;
      const pad = pass === 'rim' ? 16 : 0;
      ctx.beginPath(); ctx.ellipse(w.x, w.y, w.rx + pad, w.ry + pad, 0, 0, Math.PI * 2); ctx.fill();
    }
    for (const b of m.bridges) {
      ctx.fillStyle = '#6a4220'; ctx.fillRect(b.x - b.len / 2, b.y - 52, b.len, 104);
      ctx.fillStyle = '#a8743a';
      for (let px = b.x - b.len / 2 + 4; px < b.x + b.len / 2 - 4; px += 22) ctx.fillRect(px, b.y - 42, 18, 84);
      ctx.fillStyle = '#5a3818'; ctx.fillRect(b.x - b.len / 2, b.y - 52, b.len, 8); ctx.fillRect(b.x - b.len / 2, b.y + 44, b.len, 8);
    }
  }

  /** Maisons et puits du hameau (rendu 2D, par-dessus le décor). */
  function drawVillage2D(m) {
    for (const hs of m.houses) {
      ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(hs.x - 66, hs.y + 30, 140, 22);
      ctx.fillStyle = '#e8dcc0'; ctx.fillRect(hs.x - 62, hs.y - 40, 124, 80);
      ctx.fillStyle = '#5a3a20'; ctx.fillRect(hs.x - 14, hs.y, 28, 40);
      ctx.fillStyle = '#9ad0f0'; ctx.fillRect(hs.x - 48, hs.y - 22, 22, 18); ctx.fillRect(hs.x + 26, hs.y - 22, 22, 18);
      ctx.fillStyle = hs.roof;
      ctx.beginPath(); ctx.moveTo(hs.x - 78, hs.y - 36); ctx.lineTo(hs.x, hs.y - 100); ctx.lineTo(hs.x + 78, hs.y - 36); ctx.closePath(); ctx.fill();
    }
    const w = m.well;
    ctx.fillStyle = '#8a8090'; ctx.beginPath(); ctx.ellipse(w.x, w.y, 30, 18, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2f6aa8'; ctx.beginPath(); ctx.ellipse(w.x, w.y, 20, 11, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#6a4220'; ctx.fillRect(w.x - 28, w.y - 50, 6, 50); ctx.fillRect(w.x + 22, w.y - 50, 6, 50);
    ctx.fillStyle = '#b5482e'; ctx.beginPath(); ctx.moveTo(w.x - 38, w.y - 46); ctx.lineTo(w.x, w.y - 70); ctx.lineTo(w.x + 38, w.y - 46); ctx.closePath(); ctx.fill();
  }

  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    return `rgb(${((n >> 16) & 255) * k | 0},${((n >> 8) & 255) * k | 0},${(n & 255) * k | 0})`;
  }

  function drawPortal(x, y, color) {
    ctx.fillStyle = '#5a4a6a'; isoEllipse(x, y, 62); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 4; isoEllipse(x, y, 52); ctx.stroke();
    ctx.fillStyle = '#7a6a8a'; ctx.fillRect(x - 40, y - 70, 10, 70); ctx.fillRect(x + 30, y - 70, 10, 70);
    ctx.beginPath(); ctx.ellipse(x, y - 70, 40, 18, 0, Math.PI, 0); ctx.lineWidth = 9; ctx.strokeStyle = '#7a6a8a'; ctx.stroke();
    ctx.globalAlpha = 0.45 + 0.2 * Math.sin(S.t * 3);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(x, y - 38, 28, 36, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  /** Zaap, personnage, repaire, entrée et sortie du donjon (rendu 2D). */
  function drawWorldPlaces() {
    const w = S.world, m = w.map;
    if (m.kind === 'zone') {
      drawVillage2D(m);
      drawPortal(m.zaap.x, m.zaap.y, '#4fc3c7');
      const n = m.npc, q = WORLD.QUESTS[w.quest];
      ctx.fillStyle = 'rgba(0,0,0,.25)'; isoEllipse(n.x, n.y, 14); ctx.fill();
      ctx.fillStyle = CLASSES[n.look] ? CLASSES[n.look].color : '#c9a'; ctx.fillRect(n.x - 9, n.y - 30, 18, 26);
      ctx.fillStyle = '#f2d2b0'; ctx.beginPath(); ctx.arc(n.x, n.y - 38, 9, 0, Math.PI * 2); ctx.fill();
      if (q && !w.qAccepted && q.zone === m.zone) {
        ctx.font = 'bold 26px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#f2c14e';
        ctx.fillText('!', n.x, n.y - 78 + Math.sin(S.t * 4) * 4);
      }
      ctx.globalAlpha = 0.3; ctx.strokeStyle = '#f2c14e'; ctx.lineWidth = 6;
      isoEllipse(m.lair.x, m.lair.y, 190); ctx.stroke();
      ctx.globalAlpha = 1;
      // Entrée du donjon : arche de pierre et torches
      const d = m.door;
      ctx.fillStyle = '#5a5060'; ctx.beginPath(); ctx.ellipse(d.x, d.y - 30, 120, 90, 0, Math.PI, 0); ctx.fill();
      ctx.fillRect(d.x - 120, d.y - 30, 240, 30);
      ctx.fillStyle = '#120c18'; ctx.beginPath(); ctx.ellipse(d.x, d.y - 4, 50, 70, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#ff9a3a';
      for (const sx of [-70, 70]) { ctx.beginPath(); ctx.arc(d.x + sx, d.y - 60 + Math.sin(S.t * 9 + sx) * 2, 7, 0, Math.PI * 2); ctx.fill(); }
    } else {
      drawPortal(m.exit.x, m.exit.y, '#b46cff');
      ctx.globalAlpha = 0.35; ctx.strokeStyle = '#ff5a3a'; ctx.lineWidth = 6;
      isoEllipse(m.boss.x, m.boss.y, 250); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  function drawZoneGround(z, x0, y0, x1, y1) {
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
    const terrain = S.mode === 'world' && S.world.map.kind === 'zone' ? S.world.map : null;
    if (terrain) drawTerrain2D(terrain, x0, y0, x1, y1);

    const C = 150;
    const c0 = Math.floor(x0 / C) - 1, c1 = Math.ceil(x1 / C) + 1;
    const r0 = Math.floor(y0 / C) - 1, r1 = Math.ceil(y1 / C) + 1;
    for (let cy = r0; cy <= r1; cy++) {
      for (let cx = c0; cx <= c1; cx++) {
        const h = hash(cx, cy, z.idx !== undefined ? z.idx + 1 : S.zoneIdx + 1);
        if (h > 0.55) continue;
        const x = cx * C + hash(cx, cy, 7) * C, y = cy * C + hash(cx, cy, 13) * C;
        if (terrain && (WORLD.inWater(terrain, x, y, 30, false) || WORLD.roadDist(terrain, x, y) < 60)) continue;
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
      case 'xp': {
        const s = g.v >= 10 ? 7 : g.v >= 3 ? 5.5 : 4.5;
        ctx.fillStyle = g.v >= 10 ? '#ff5fa2' : g.v >= 3 ? '#4fd1ff' : '#7dff6a';
        ctx.beginPath(); ctx.moveTo(x, y - s * 1.4); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s * 1.4); ctx.lineTo(x - s, y); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.6)';
        ctx.beginPath(); ctx.moveTo(x, y - s * 1.4); ctx.lineTo(x + s * 0.4, y - s * 0.2); ctx.lineTo(x - s * 0.3, y); ctx.closePath(); ctx.fill();
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
      case 'item': {
        const c = g.item.color;
        ctx.save();
        ctx.shadowColor = c; ctx.shadowBlur = 14;
        ctx.fillStyle = '#3a2a4a'; ctx.fillRect(x - 9, y - 18, 18, 18);
        ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.strokeRect(x - 9, y - 18, 18, 18);
        ctx.restore();
        ctx.globalAlpha = 0.35; ctx.fillStyle = c; ctx.fillRect(x - 2, y - 60, 4, 42); ctx.globalAlpha = 1;
        break;
      }
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
    const by = y - bob;
    // jambes
    ctx.fillStyle = '#3a2a1a';
    const lg = Math.sin(p.walk) * 3;
    ctx.fillRect(x - 6 + lg, y - 8, 5, 8);
    ctx.fillRect(x + 1 - lg, y - 8, 5, 8);
    // corps
    const hurt = p.hurt > 0;
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
      case 'ears':
        ctx.fillStyle = c;
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + s * 4, y - 9); ctx.lineTo(x + s * 12, y - 22); ctx.lineTo(x + s * 12, y - 4); ctx.fill(); }
        ctx.fillStyle = b; ctx.beginPath(); ctx.arc(x, y - 6, 10, Math.PI, 0); ctx.fill();
        break;
      case 'panda':
        ctx.fillStyle = '#222';
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(x + s * 9, y - 9, 4.5, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y - 6, 10, Math.PI, 0); ctx.fill();
        break;
      case 'leaves':
        ctx.fillStyle = c;
        for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.ellipse(x + i * 7, y - 12 - (i ? 0 : 4), 4, 9, i * 0.5, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = b; ctx.beginPath(); ctx.arc(x, y - 5, 10, Math.PI, 0); ctx.fill();
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
    if (def.look === 'sheep' || def.look === 'bird') {
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
    switch (d.shape) {
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

  function reroll() {
    if (!S || S.rerolls <= 0) return null;
    S.rerolls--;
    return genChoices();
  }

  function banish(c) {
    if (!S || S.banishes <= 0 || !c.id) return null;
    S.banishes--;
    S.banned.add(c.id);
    return genChoices();
  }

  const counts = () => (S ? { rerolls: S.rerolls, banishes: S.banishes, level: S.level } : null);

  const renderMode = () => (r3 ? '3d' : '2d');
  /** Mesures de fluidité (affichées avec ?fps) : images/s, coût du rendu, nombre de monstres. */
  const perf = () => ({ fps, renderMs, enemies: S ? S.enemies.length : 0 });

  return { init, start, stop, setPaused, choose, reroll, banish, counts, setRenderMode, renderMode, perf, startWorld, interact, travel, worldChoice, worldSnapshot, takeLoot, equipment, addCarac, resetCarac, talentUp, resetTalents, charInfo, peek: () => S, _hit: (e, d) => hitEnemy(e, d, {}) };
})();
