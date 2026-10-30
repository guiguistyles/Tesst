'use strict';
// Interface : menus, sauvegarde, HUD et liaison avec le moteur.

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// ------------------------------------------------------------ Sauvegarde
const SAVE_KEY = 'zaapsurvie2-save';
const Save = {
  data: null,
  load() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { /* stockage indisponible */ }
    this.data = Object.assign({ kamas: 0, unlocked: [], cleared: [], dofus: [], upgrades: {}, best: {} }, d || {});
    for (const id in CLASSES) if (!CLASSES[id].cost && !this.data.unlocked.includes(id)) this.data.unlocked.push(id);
    this.data.dofus = this.data.dofus.filter((id) => DOFUS[id]); // Dofus retirés du jeu
  },
  store() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); } catch (e) { /* ignoré */ }
  },
};

let selectedClass = null;
let selectedZone = 0;
let inGame = false;

// ------------------------------------------------------------ Navigation
function show(name) {
  $$('.screen').forEach((s) => s.classList.toggle('active', s.id === 'screen-' + name));
  if (name === 'menu') renderMenu();
  if (name === 'class') renderClasses();
  if (name === 'zaap') renderZaaps();
  if (name === 'shop') renderShop();
  if (name === 'dofus') renderDofus();
  refreshKamas();
  startMenuLoop();
}

function refreshKamas() {
  $$('[data-kamas]').forEach((el) => { el.textContent = Save.data.kamas.toLocaleString('fr-FR'); });
}

// ------------------------------------------------------------ Planches des menus
// Même manifeste que le moteur (js/sprites.js) ; les images restent en cache pour la partie.
const MenuSprites = {
  sheets: {},
  get(name) {
    if (this.sheets[name] !== undefined) return this.sheets[name] && this.sheets[name].img.complete ? this.sheets[name] : null;
    const m = typeof SPRITE_SHEETS !== 'undefined' && SPRITE_SHEETS[name];
    if (!m) { this.sheets[name] = null; return null; }
    const img = new Image();
    img.src = m.src;
    this.sheets[name] = { ...m, img };
    return null;
  },
  // dir : 0 = est, 2 = face à l'écran ; t : secondes ; renvoie false tant que la planche charge
  draw(ctx, name, x, y, dir, t, k, once) {
    const s = this.get(name);
    if (!s) return false;
    const col = once ? Math.min(s.frames - 1, Math.floor(t * s.fps)) : Math.floor(t * s.fps) % s.frames;
    const row = ((dir % 8) + 8) % 8, res = s.res || 1;
    const w = (s.frameW * k) / res, h = (s.frameH * k) / res;
    ctx.drawImage(s.img, col * s.frameW, row * s.frameH, s.frameW, s.frameH, x - w * s.anchorX, y - h * s.anchorY, w, h);
    return true;
  },
  duration(name) { const s = SPRITE_SHEETS[name]; return s ? s.frames / s.fps : 1; },
};

function fitCanvas(cv) {
  const dpr = Math.min(devicePixelRatio || 1, 2), r = cv.getBoundingClientRect();
  const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w: r.width, h: r.height };
}

// ------------------------------------------------------------ Scène du menu d'accueil
// Crépuscule sur des îles flottantes : un zaap au centre, trois héros autour, des monstres d'Astrub qui passent.
const MenuScene = (() => {
  const rnd = (a, b) => a + Math.random() * (b - a);
  const stars = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random() * 0.55, r: rnd(0.4, 1.4), p: rnd(0, 6) }));
  const isles = Array.from({ length: 5 }, (_, i) => ({ x: rnd(0, 1), y: rnd(0.18, 0.5), s: rnd(0.5, 1.2) * (i < 2 ? 0.6 : 1), v: rnd(4, 10), p: rnd(0, 6), far: i < 2 }));
  const motes = [];
  const walkers = [];
  let heroes = [], last = 0, nextWalker = 1;

  function pickHeroes() {
    const ids = Object.keys(CLASSES).filter((id) => SPRITE_CLASSES_UI(id));
    const fav = Save.data.lastClass && ids.includes(Save.data.lastClass) ? [Save.data.lastClass] : [];
    const rest = ids.filter((id) => !fav.includes(id)).sort(() => Math.random() - 0.5);
    const pick = [...fav, ...rest].slice(0, 3);
    heroes = pick.map((id, i) => ({ id, slot: [0, -1, 1][i], attack: -1, next: rnd(2, 6) }));
  }

  function isle(ctx, x, y, s, col, top) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(-60, 0);
    ctx.quadraticCurveTo(-55, -10, -30, -12); ctx.quadraticCurveTo(0, -18, 35, -11); ctx.quadraticCurveTo(58, -8, 60, 0);
    ctx.lineTo(40, 14); ctx.lineTo(28, 30); ctx.lineTo(12, 26); ctx.lineTo(2, 52); ctx.lineTo(-10, 28); ctx.lineTo(-26, 34); ctx.lineTo(-40, 14);
    ctx.closePath(); ctx.fill();
    if (top) {
      ctx.fillStyle = top;
      ctx.beginPath(); ctx.ellipse(0, -9, 56, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(-24, -20, 12, 0, Math.PI * 2); ctx.arc(-12, -26, 14, 0, Math.PI * 2); ctx.arc(30, -18, 9, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // Portail : anneau de pierre à huit blocs, tourbillon de lumière, socle à marches.
  function zaap(ctx, x, y, R, t) {
    ctx.save(); ctx.translate(x, y);
    const g = ctx.createRadialGradient(0, -R, R * 0.2, 0, -R, R * 2.4);
    g.addColorStop(0, 'rgba(140,220,255,.45)'); g.addColorStop(1, 'rgba(140,220,255,0)');
    ctx.fillStyle = g; ctx.fillRect(-R * 2.6, -R * 3.6, R * 5.2, R * 5);
    // socle
    ctx.fillStyle = '#4a3a52'; ctx.beginPath(); ctx.ellipse(0, 4, R * 1.25, R * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7a6878'; ctx.beginPath(); ctx.ellipse(0, 0, R * 1.15, R * 0.26, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#9c8a94'; ctx.beginPath(); ctx.ellipse(0, -4, R * 0.9, R * 0.18, 0, 0, Math.PI * 2); ctx.fill();
    // tourbillon
    ctx.translate(0, -R * 1.05);
    const v = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.78);
    v.addColorStop(0, '#ffffff'); v.addColorStop(0.35, '#a8ecff'); v.addColorStop(0.8, '#3a7ad8'); v.addColorStop(1, 'rgba(40,60,160,.6)');
    ctx.fillStyle = v; ctx.beginPath(); ctx.arc(0, 0, R * 0.8, 0, Math.PI * 2); ctx.fill();
    ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      ctx.strokeStyle = `rgba(255,255,255,${0.25 + 0.1 * i})`; ctx.lineWidth = R * 0.05;
      const a = t * (1.2 + i * 0.25) + i * 1.3, rr = R * (0.2 + i * 0.11);
      ctx.beginPath(); ctx.arc(0, 0, rr, a, a + 1.6); ctx.stroke();
    }
    // anneau de pierre
    for (let i = 0; i < 8; i++) {
      const a0 = (i / 8) * Math.PI * 2 + 0.06, a1 = ((i + 1) / 8) * Math.PI * 2 - 0.06;
      ctx.beginPath(); ctx.arc(0, 0, R, a0, a1); ctx.arc(0, 0, R * 0.8, a1, a0, true); ctx.closePath();
      ctx.fillStyle = i % 2 ? '#b8a07a' : '#c8b088'; ctx.fill();
      ctx.strokeStyle = '#5a4630'; ctx.lineWidth = 2; ctx.stroke();
      // rune lumineuse
      const am = (a0 + a1) / 2, glow = 0.5 + 0.5 * Math.sin(t * 2 + i);
      ctx.fillStyle = `rgba(120,230,255,${0.4 + 0.6 * glow})`;
      ctx.beginPath(); ctx.arc(Math.cos(am) * R * 0.9, Math.sin(am) * R * 0.9, R * 0.035, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function draw(cv, t, dt) {
    const { ctx, w, h } = fitCanvas(cv);
    const wide = w > 860;
    const fx = wide ? w * 0.68 : w * 0.5, gy = h * (wide ? 0.8 : 0.9);
    const R = Math.min(wide ? 90 : 58, h * (wide ? 0.12 : 0.08));
    // ciel
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#120c28'); sky.addColorStop(0.45, '#3a2156'); sky.addColorStop(0.75, '#9a4a5e'); sky.addColorStop(1, '#e89a62');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
    for (const s of stars) {
      ctx.globalAlpha = 0.35 + 0.35 * Math.sin(t * 1.5 + s.p);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // lune
    const mx = w * (wide ? 0.86 : 0.8), my = h * 0.16, mr = Math.min(w, h) * 0.06;
    const mg = ctx.createRadialGradient(mx, my, mr * 0.8, mx, my, mr * 3.5);
    mg.addColorStop(0, 'rgba(255,230,190,.35)'); mg.addColorStop(1, 'rgba(255,230,190,0)');
    ctx.fillStyle = mg; ctx.fillRect(mx - mr * 4, my - mr * 4, mr * 8, mr * 8);
    ctx.fillStyle = '#ffe9c4'; ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(200,160,130,.35)'; ctx.beginPath(); ctx.arc(mx - mr * 0.3, my - mr * 0.2, mr * 0.22, 0, Math.PI * 2); ctx.arc(mx + mr * 0.35, my + mr * 0.3, mr * 0.15, 0, Math.PI * 2); ctx.fill();
    // îles flottantes (parallaxe lente)
    for (const s of isles) {
      const x = ((s.x * (w + 300) + t * s.v) % (w + 300)) - 150, y = s.y * h + Math.sin(t * 0.6 + s.p) * 6;
      isle(ctx, x, y, s.s * Math.min(1.3, w / 900), s.far ? '#3a2650' : '#2a1a3c', s.far ? '#4a3a62' : '#30402c');
    }
    // plateau
    const grd = ctx.createLinearGradient(0, gy - h * 0.12, 0, h);
    grd.addColorStop(0, '#5f8f3e'); grd.addColorStop(1, '#2e4a22');
    ctx.fillStyle = '#2a1c30';
    ctx.beginPath(); ctx.ellipse(fx, gy + h * 0.06, w * 0.62, h * 0.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.ellipse(fx, gy, w * 0.6, h * 0.16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,200,120,.12)';
    ctx.beginPath(); ctx.ellipse(fx, gy - h * 0.03, w * 0.45, h * 0.08, 0, 0, Math.PI * 2); ctx.fill();
    // brins d'herbe fixes (pseudo-aléatoires)
    ctx.strokeStyle = 'rgba(30,60,20,.55)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 60; i++) {
      const a = (i * 2.399) % (Math.PI * 2), d = ((i * 0.618) % 1) * 0.95;
      const x = fx + Math.cos(a) * w * 0.55 * d, y = gy + Math.sin(a) * h * 0.14 * d;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 2, y - 7); ctx.moveTo(x, y); ctx.lineTo(x + 3, y - 6); ctx.stroke();
    }
    // monstres qui traversent au loin
    nextWalker -= dt;
    if (nextWalker <= 0) {
      nextWalker = rnd(2.5, 5);
      const dir = Math.random() < 0.5 ? 1 : -1, kind = ['bouftou', 'tofu', 'piou', 'boufton_noir'][Math.floor(Math.random() * 4)];
      walkers.push({ kind, dir, x: dir > 0 ? fx - w * 0.6 : fx + w * 0.6, y: gy + rnd(-h * 0.07, h * 0.06), v: rnd(50, 80), t: 0 });
    }
    const actors = [];
    for (let i = walkers.length - 1; i >= 0; i--) {
      const m = walkers[i];
      m.x += m.dir * m.v * dt; m.t += dt;
      if (Math.abs(m.x - fx) > w * 0.62) { walkers.splice(i, 1); continue; }
      actors.push({ y: m.y, draw: () => MenuSprites.draw(ctx, m.kind, m.x, m.y, m.dir > 0 ? 0 : 4, m.t, 0.75) });
    }
    // héros
    const hk = R / 62;
    for (const hero of heroes) {
      const x = fx + hero.slot * R * 1.9, y = gy + (hero.slot ? R * 0.35 : R * 0.55);
      hero.next -= dt;
      if (hero.attack < 0 && hero.next <= 0) hero.attack = 0;
      let name = hero.id + '_idle', tt = t + hero.slot;
      if (hero.attack >= 0) {
        hero.attack += dt; name = hero.id + '_attack'; tt = hero.attack;
        if (hero.attack > MenuSprites.duration(name)) { hero.attack = -1; hero.next = rnd(3, 7); }
      }
      const dir = hero.slot < 0 ? 1 : hero.slot > 0 ? 3 : 2;
      actors.push({ y, draw: () => {
        ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(x, y, 22 * hk, 7 * hk, 0, 0, Math.PI * 2); ctx.fill();
        MenuSprites.draw(ctx, name, x, y, dir, tt, hk * 1.15, hero.attack >= 0);
      } });
    }
    actors.push({ y: gy - R * 0.05, draw: () => zaap(ctx, fx, gy - R * 0.05, R, t) });
    actors.sort((a, b) => a.y - b.y).forEach((a) => a.draw());
    // poussières de lumière
    if (motes.length < 40 && Math.random() < dt * 14) motes.push({ x: fx + rnd(-R, R), y: gy - R, vy: rnd(-30, -12), vx: rnd(-8, 8), life: rnd(2, 4), age: 0 });
    for (let i = motes.length - 1; i >= 0; i--) {
      const p = motes[i]; p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.age > p.life) { motes.splice(i, 1); continue; }
      ctx.globalAlpha = Math.sin((p.age / p.life) * Math.PI) * 0.9;
      ctx.fillStyle = '#c8f4ff'; ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // vignette (plus sombre côté menu sur grand écran)
    const vg = ctx.createRadialGradient(fx, h * 0.6, h * 0.2, fx, h * 0.6, Math.max(w, h) * 0.85);
    vg.addColorStop(0, 'rgba(10,6,20,0)'); vg.addColorStop(1, 'rgba(10,6,20,.75)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
    if (wide) {
      const lg = ctx.createLinearGradient(0, 0, w * 0.5, 0);
      lg.addColorStop(0, 'rgba(14,8,28,.75)'); lg.addColorStop(1, 'rgba(14,8,28,0)');
      ctx.fillStyle = lg; ctx.fillRect(0, 0, w * 0.5, h);
    }
  }

  return {
    reset: pickHeroes,
    frame(t, dt) { const cv = $('#menu-scene'); if (cv) draw(cv, t, dt); },
  };
})();

function SPRITE_CLASSES_UI(id) { return typeof SPRITE_SHEETS !== 'undefined' && SPRITE_SHEETS[id + '_idle']; }

// Une seule boucle d'animation pour les écrans du menu ; elle s'arrête pendant la partie.
let menuRaf = 0, menuLast = 0;
function menuLoop(now) {
  menuRaf = 0;
  const active = document.querySelector('.screen.active');
  if (!active || inGame) return;
  const t = now / 1000, dt = Math.min(0.05, menuLast ? t - menuLast : 0);
  menuLast = t;
  if (active.id === 'screen-menu') MenuScene.frame(t, dt);
  if (active.id === 'screen-class') ClassScreen.frame(t, dt);
  menuRaf = requestAnimationFrame(menuLoop);
}
function startMenuLoop() { if (!menuRaf) { menuLast = 0; menuRaf = requestAnimationFrame(menuLoop); } }

function renderMenu() {
  const opened = ZONES.filter((_, i) => zoneUnlocked(i)).length;
  const dof = Save.data.dofus.length;
  $('#menu-progress').innerHTML = `
    <span><b>${opened}</b>/${ZONES.length} mondes</span>
    <span><b>${dof}</b>/${Object.keys(DOFUS).length} Dofus</span>
    <span><b>${Save.data.cleared.length}</b> gardien${Save.data.cleared.length > 1 ? 's' : ''} vaincu${Save.data.cleared.length > 1 ? 's' : ''}</span>`;
  MenuScene.reset();
}

// ------------------------------------------------------------ Choix de classe
const SPELL_TYPES = {
  projectile: 'Projectile', melee: 'Mêlée', nova: 'Zone', aura: 'Aura', orbit: 'Orbite', strike: 'Frappe', summon: 'Invocation',
  trap: 'Piège', glyph: 'Glyphe', heal: 'Soin', shield: 'Bouclier', buff: 'Boost', dash: 'Mouvement',
};

const ClassScreen = (() => {
  let current = null, dir = 2, attackT = -1, nextAttack = 2.5, drag = null;
  const tiles = {};

  function select(id) {
    current = id; attackT = -1; nextAttack = 1.6; dir = 2;
    const c = CLASSES[id];
    const owned = Save.data.unlocked.includes(id);
    $$('#class-grid .class-tile').forEach((t) => t.classList.toggle('on', t.dataset.id === id));
    const tileEl = $(`#class-grid .class-tile[data-id="${id}"]`);
    if (tileEl) tileEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const d = $('#class-detail');
    d.style.setProperty('--cls', c.color);
    d.style.setProperty('--cls2', c.accent);
    $('#cd-role').textContent = c.role || '';
    $('#cd-name').textContent = c.name;
    $('#cd-desc').textContent = c.desc;
    const maxHp = Math.max(...Object.values(CLASSES).map((x) => x.hp));
    const maxSp = Math.max(...Object.values(CLASSES).map((x) => x.speed));
    const best = Save.data.best[id];
    $('#cd-stats').innerHTML = `
      <div class="stat"><span>Vitalité</span><div class="bar"><i style="width:${(c.hp / maxHp) * 100}%"></i></div><b>${c.hp}</b></div>
      <div class="stat"><span>Vitesse</span><div class="bar spd"><i style="width:${(c.speed / maxSp) * 100}%"></i></div><b>${c.speed}</b></div>
      ${best ? `<div class="stat rec">Record : monde ${best} atteint</div>` : ''}`;
    const sg = $('#cd-spells');
    sg.innerHTML = c.spells.map((sid, i) => {
      const sp = SPELLS[sid];
      return `<button class="spell-ic${i === 0 ? ' first' : ''}" data-spell="${sid}" style="--sc:${sp.color}" title="${sp.name}">${sp.icon}</button>`;
    }).join('');
    const info = (sid) => {
      const sp = SPELLS[sid];
      $$('#cd-spells .spell-ic').forEach((b) => b.classList.toggle('on', b.dataset.spell === sid));
      $('#cd-spell-info').innerHTML = `<b>${sp.name}</b> <em>${SPELL_TYPES[sp.type] || ''}${sid === c.spells[0] ? ' · sort de départ' : ''}</em><p>${sp.desc}</p>`;
    };
    sg.querySelectorAll('.spell-ic').forEach((b) => {
      b.addEventListener('mouseenter', () => info(b.dataset.spell));
      b.addEventListener('click', () => info(b.dataset.spell));
    });
    info(c.spells[0]);
    const pick = $('#btn-pick');
    pick.innerHTML = owned ? `Jouer ${c.name} →` : `Débloquer <b class="k">K</b> ${c.cost.toLocaleString('fr-FR')}`;
  }

  function confirmPick() {
    const id = current, c = CLASSES[id];
    if (!Save.data.unlocked.includes(id)) {
      if (Save.data.kamas < c.cost) { flash($('#btn-pick')); return; }
      if (!confirm(`Débloquer ${c.name} pour ${c.cost} kamas ?`)) return;
      Save.data.kamas -= c.cost;
      Save.data.unlocked.push(id);
      Save.store();
      render();
      refreshKamas();
      return;
    }
    selectedClass = id;
    Save.data.lastClass = id;
    Save.store();
    show('zaap');
  }

  function render() {
    const g = $('#class-grid');
    g.innerHTML = '';
    for (const id in CLASSES) {
      const c = CLASSES[id];
      const owned = Save.data.unlocked.includes(id);
      const el = document.createElement('button');
      el.className = 'class-tile' + (owned ? '' : ' locked');
      el.dataset.id = id;
      el.style.setProperty('--cls', c.color);
      el.innerHTML = `<canvas></canvas><span>${c.name}</span>${owned ? '' : '<i class="lock">🔒</i>'}`;
      el.addEventListener('click', () => (current === id ? confirmPick() : select(id)));
      tiles[id] = el.querySelector('canvas');
      g.appendChild(el);
    }
    const start = current && CLASSES[current] ? current : Save.data.lastClass && CLASSES[Save.data.lastClass] ? Save.data.lastClass : Object.keys(CLASSES)[0];
    select(start);
  }

  function stage(t, dt) {
    const cv = $('#class-preview');
    const { ctx, w, h } = fitCanvas(cv);
    ctx.clearRect(0, 0, w, h);
    const c = CLASSES[current];
    const cx = w / 2, gy = h * 0.82, s = Math.min(w / 220, h / 230);
    // cercle de runes sous le personnage
    ctx.save(); ctx.translate(cx, gy); ctx.scale(1, 0.32);
    const gl = ctx.createRadialGradient(0, 0, 10, 0, 0, 120 * s);
    gl.addColorStop(0, c.color + 'cc'); gl.addColorStop(1, c.color + '00');
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(0, 0, 120 * s, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(t * 0.4);
    ctx.strokeStyle = c.accent; ctx.globalAlpha = 0.7; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 80 * s, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, 68 * s, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * 68 * s, Math.sin(a) * 68 * s); ctx.lineTo(Math.cos(a + 0.12) * 80 * s, Math.sin(a + 0.12) * 80 * s); ctx.stroke();
    }
    ctx.restore();
    // personnage : repos, puis une attaque de temps en temps
    if (!drag) nextAttack -= dt;
    if (attackT < 0 && nextAttack <= 0) attackT = 0;
    let name = current + '_idle', tt = t;
    if (attackT >= 0) {
      attackT += dt; name = current + '_attack'; tt = attackT;
      if (attackT > MenuSprites.duration(name)) { attackT = -1; nextAttack = 4; }
    }
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(cx, gy, 34 * s, 10 * s, 0, 0, Math.PI * 2); ctx.fill();
    MenuSprites.draw(ctx, name, cx, gy, Math.round(dir), tt, 2.1 * s, attackT >= 0);
  }

  function tile(id, t) {
    const cv = tiles[id];
    if (!cv || !cv.isConnected) return;
    const { ctx, w, h } = fitCanvas(cv);
    ctx.clearRect(0, 0, w, h);
    const on = id === current;
    MenuSprites.draw(ctx, id + (on ? '_run' : '_idle'), w / 2, h * 0.94, 2, t, h / 72);
  }

  function bind() {
    const cv = $('#class-preview');
    cv.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, d: dir }; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', (e) => { if (drag) dir = ((drag.d - (e.clientX - drag.x) / 40) % 8 + 8) % 8; });
    const end = () => { drag = null; dir = Math.round(dir) % 8; };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    $('#turn-left').addEventListener('click', () => { dir = (Math.round(dir) + 1) % 8; });
    $('#turn-right').addEventListener('click', () => { dir = (Math.round(dir) + 7) % 8; });
    $('#btn-pick').addEventListener('click', confirmPick);
    addEventListener('keydown', (e) => {
      if (!$('#screen-class').classList.contains('active')) return;
      const ids = Object.keys(CLASSES), i = ids.indexOf(current);
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') select(ids[(i + 1) % ids.length]);
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') select(ids[(i + ids.length - 1) % ids.length]);
      else if (e.key === 'Enter') confirmPick();
      else return;
      e.preventDefault();
    });
  }

  return {
    render, bind,
    frame(t, dt) {
      if (!current) return;
      stage(t, dt);
      for (const id in tiles) tile(id, t);
    },
  };
})();

function renderClasses() { ClassScreen.render(); }

function zoneUnlocked(i) { return i === 0 || Save.data.cleared.includes(i - 1); }

function renderZaaps() {
  const l = $('#zaap-list');
  l.innerHTML = '';
  ZONES.forEach((z, i) => {
    const open = zoneUnlocked(i);
    const cleared = Save.data.cleared.includes(i);
    const owned = z.dofus.filter((d) => Save.data.dofus.includes(d)).length;
    const el = document.createElement('button');
    el.className = 'zaap' + (open ? '' : ' locked');
    el.innerHTML = `
      <div class="zaap-icon" style="background:${z.ground}"></div>
      <div>
        <h3>${z.name}</h3>
        <p>${open ? z.sub + ' · Gardien : ' + MONSTERS[z.boss].name : 'Battez le gardien de la zone précédente pour activer ce zaap.'}</p>
        <div class="tags">
          <span class="tag">Difficulté ${'★'.repeat(i + 1)}</span>
          ${cleared ? '<span class="tag ok">✔ Terminée</span>' : ''}
          <span class="tag">Dofus ${owned}/${z.dofus.length}</span>
        </div>
      </div>`;
    if (open) el.addEventListener('click', () => { selectedZone = i; startGame(); });
    l.appendChild(el);
  });
}

function renderShop() {
  const g = $('#shop-grid');
  g.innerHTML = '';
  for (const id in SHOP) {
    const u = SHOP[id];
    const lvl = Save.data.upgrades[id] || 0;
    const maxed = lvl >= u.max;
    const cost = u.cost * (lvl + 1);
    const el = document.createElement('button');
    el.className = 'card' + (maxed ? ' locked' : '');
    el.innerHTML = `
      <h3>${u.name}</h3>
      <p>${u.desc}</p>
      <div class="pips">${Array.from({ length: u.max }, (_, i) => `<span class="pip ${i < lvl ? 'on' : ''}"></span>`).join('')}</div>
      <div class="meta"><span>Niv. ${lvl}/${u.max}</span>
        ${maxed ? '<span>Max</span>' : `<span class="kamas-pill"><b class="k">K</b> ${cost.toLocaleString('fr-FR')}</span>`}</div>`;
    el.addEventListener('click', () => {
      if (maxed) return;
      if (Save.data.kamas < cost) { flash(el); return; }
      Save.data.kamas -= cost;
      Save.data.upgrades[id] = lvl + 1;
      Save.store();
      renderShop();
      refreshKamas();
    });
    g.appendChild(el);
  }
}

function renderDofus() {
  const g = $('#dofus-grid');
  g.innerHTML = '';
  ZONES.forEach((z) => {
    for (const id of z.dofus) {
      const d = DOFUS[id];
      const has = Save.data.dofus.includes(id);
      const el = document.createElement('div');
      el.className = 'card' + (has ? '' : ' missing locked');
      el.innerHTML = `
        <div class="row">
          <div class="dofus-egg" style="background:${d.color};--glow:${d.color}"></div>
          <div><h3>${has ? d.name : '???'}</h3><p>${has ? d.desc : 'Lâché par ' + MONSTERS[z.boss].name}</p></div>
        </div>
        <div class="meta"><span>${z.name}</span><span>${has ? '✔ Obtenu' : ''}</span></div>`;
      g.appendChild(el);
    }
  });
}

function flash(el) {
  el.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }], { duration: 250 });
}

// ------------------------------------------------------------ Partie
function startGame() {
  $$('.screen').forEach((s) => s.classList.remove('active'));
  ['#ov-end', '#ov-pause', '#ov-levelup'].forEach((s) => $(s).classList.add('hidden'));
  $('#hud').classList.remove('hidden');
  inGame = true;
  unlockedMsg = '';
  Game.start(selectedClass, selectedZone, Save.data);
}

function quitToMenu() {
  Game.stop();
  inGame = false;
  $('#hud').classList.add('hidden');
  ['#ov-end', '#ov-pause', '#ov-levelup'].forEach((s) => $(s).classList.add('hidden'));
  show('menu');
}

function fmtTime(t) {
  const m = Math.floor(t / 60), s = Math.floor(t % 60);
  return m + ':' + String(s).padStart(2, '0');
}

let lastSpellsKey = '';
function onHud(h) {
  $('#hp-fill').style.width = (100 * Math.max(0, h.hp) / h.maxHp) + '%';
  $('#sh-fill').style.width = Math.min(100, (100 * h.shield) / h.maxHp) + '%';
  $('#hp-txt').textContent = Math.ceil(Math.max(0, h.hp)) + ' / ' + h.maxHp;
  $('#xp-fill').style.width = (100 * h.xp / h.xpNext) + '%';
  $('#lvl').textContent = 'Niv. ' + h.level;
  $('#timer').textContent = 'Vague ' + h.wave;
  $('#timer').title = fmtTime(h.t);
  $('#kills').textContent = h.kills;
  $('#hud-kamas').textContent = h.kamas;
  const bb = $('#boss-bar');
  if (h.boss) {
    bb.classList.remove('hidden');
    $('#boss-name').textContent = h.boss.name;
    $('#boss-fill').style.width = (100 * Math.max(0, h.boss.hp) / h.boss.maxHp) + '%';
  } else bb.classList.add('hidden');

  const key = h.spells.map((s) => s.id + s.lvl).join() + JSON.stringify(h.passives) + JSON.stringify(h.items);
  if (key !== lastSpellsKey) {
    lastSpellsKey = key;
    $('#hud-spells').innerHTML = buildSlots(h.spells, h.passives, h.items);
  }
}

function buildSlots(spells, passives, items = {}) {
  let html = '';
  for (const s of spells) {
    const d = SPELLS[s.id];
    html += `<div class="slot" style="background:${d.color}" title="${d.name}">${d.icon}<i>${s.lvl}</i></div>`;
  }
  for (const id in passives) {
    const d = PASSIVES[id];
    html += `<div class="slot passive" style="border-color:${d.color}" title="${d.name}">${d.icon}<i>${passives[id]}</i></div>`;
  }
  for (const slot in items) {
    const it = ITEMS[items[slot]];
    html += `<div class="slot item${it.rare ? ' rare' : ''}" title="${it.name} : ${bonusText(it.bonus)}">${SLOTS[slot].icon}</div>`;
  }
  return html;
}

// Écran de niveau : 3 cartes (améliorer / nouveau sort / caractéristique), Relancer et Bannir.
let banMode = false;
function onLevelUp(data) {
  banMode = false;
  const box = $('#choices');
  box.innerHTML = '';
  box.classList.toggle('four', data.cards.length === 4);
  data.cards.forEach((c, i) => {
    const el = document.createElement('button');
    const isPassive = c.kind !== 'spell';
    const pips = c.max ? Array.from({ length: c.max }, (_, k) => `<i class="${k < c.lvl ? 'on' : ''}"></i>`).join('') : '';
    el.className = `choice tag-${(c.tag || '').normalize('NFD').replace(/[^a-z]/gi, '').toLowerCase()}${c.advised ? ' advised' : ''}`;
    el.innerHTML = `
      ${c.advised ? '<span class="advice">Conseillé</span>' : ''}
      <span class="num">${i + 1}</span>
      <span class="tag">${c.tag || ''}</span>
      <div class="ico ${isPassive ? 'passive' : ''}" style="background:${c.color};border-color:${c.color}">${c.icon}</div>
      <b>${c.name}</b>
      <small class="type">${c.type || ''}</small>
      <p>${c.desc}</p>
      ${pips ? `<div class="pips">${pips}<em>${c.lvl}/${c.max}</em></div>` : ''}`;
    el.addEventListener('click', () => {
      if (banMode) { const next = Game.ban(c); if (next) onLevelUp(next); return; }
      pickChoice(c);
    });
    el.dataset.idx = i + 1;
    box.appendChild(el);
  });
  $('#lvl-tip').textContent = data.awaken
    ? 'Éveil : choisissez une branche. Ce choix est définitif.'
    : data.spells < 4
      ? `Sorts : ${data.spells}/8. Chaque nouveau sort ajoute des dégâts.`
      : 'Au rang 5, un sort s’éveille : il choisit une branche, puis monte jusqu’au rang 10.';
  $('#ov-levelup h2').textContent = data.awaken ? 'Éveil du sort' : 'Niveau supérieur !';
  const rr = $('#btn-reroll'), bn = $('#btn-ban');
  rr.disabled = data.awaken || data.rerolls <= 0; rr.querySelector('em').textContent = '×' + data.rerolls;
  bn.disabled = data.awaken || data.bans <= 0; bn.querySelector('em').textContent = '×' + data.bans;
  bn.classList.remove('active');
  $('#ov-levelup').classList.remove('hidden');
}

function pickChoice(c) {
  $('#ov-levelup').classList.add('hidden');
  Game.choose(c);
}

function rerollChoices() {
  const next = Game.reroll();
  if (next) onLevelUp(next);
}

function toggleBan() {
  if ($('#btn-ban').disabled) return;
  banMode = !banMode;
  $('#btn-ban').classList.toggle('active', banMode);
  $('#lvl-tip').textContent = banMode ? 'Cliquez la carte à bannir pour le reste de la partie.' : '';
}

let bannerTimer = 0;
function onBanner(title, sub) {
  const b = $('#banner');
  b.classList.add('hidden');
  void b.offsetWidth; // relance l’animation
  $('#banner-title').textContent = title;
  $('#banner-sub').textContent = sub || '';
  b.classList.remove('hidden');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => b.classList.add('hidden'), 2600);
}

function togglePause() {
  if (!inGame || !$('#ov-levelup').classList.contains('hidden') || !$('#ov-end').classList.contains('hidden')) return;
  const ov = $('#ov-pause');
  const willPause = ov.classList.contains('hidden');
  if (willPause) $('#pause-build').innerHTML = $('#hud-spells').innerHTML;
  ov.classList.toggle('hidden', !willPause);
  Game.setPaused(willPause);
}

// Premier kill du boss final (vague 40) : le zaap suivant s'ouvre pour de bon, sauvegardé tout de suite.
let unlockedMsg = '';
function onZoneCleared(zoneIdx) {
  const d = Save.data;
  if (!d.cleared.includes(zoneIdx)) {
    d.cleared.push(zoneIdx);
    if (ZONES[zoneIdx + 1]) unlockedMsg = 'Nouveau zaap activé : ' + ZONES[zoneIdx + 1].name;
  }
  d.best[selectedClass] = Math.max(d.best[selectedClass] || 0, zoneIdx + 1);
  Save.store();
}

// Un Dofus ramassé est gardé même si la partie est abandonnée ensuite.
function onDofus(id) {
  if (!Save.data.dofus.includes(id)) Save.data.dofus.push(id);
  Save.store();
}

function onEnd(r) {
  inGame = false;
  const z = ZONES[r.zoneIdx];
  const d = Save.data;
  d.kamas += r.kamas;
  for (const id of r.found) if (!d.dofus.includes(id)) d.dofus.push(id);
  Save.store();
  const msg = unlockedMsg;
  unlockedMsg = '';

  $('#end-title').textContent = r.victory ? 'Zone vaincue !' : 'Vous êtes mort…';
  const loot = r.found.map((id) => `<div class="dofus-egg" style="background:${DOFUS[id].color};--glow:${DOFUS[id].color}" title="${DOFUS[id].name}"></div><b>${DOFUS[id].name}</b>`).join('');
  $('#end-stats').innerHTML = `
    ${loot ? `<div class="loot">${loot}</div>` : ''}
    <div class="stats">
      <span>Zone</span><span>${z.name}</span>
      <span>Classe</span><span>${CLASSES[r.cls].name}</span>
      <span>Vague atteinte</span><span>${r.wave} (${fmtTime(r.t)})</span>
      <span>Boss final vaincu</span><span>${r.bossKills ? '×' + r.bossKills : '—'}</span>
      <span>Niveau atteint</span><span>${r.level}</span>
      <span>Monstres vaincus</span><span>${r.kills}</span>
      <span>Kamas gagnés</span><span><b class="k">K</b> ${r.kamas}</span>
    </div>
    ${msg ? `<p class="hint" style="color:var(--gold)">${msg}</p>` : ''}`;
  $('#ov-levelup').classList.add('hidden');
  $('#ov-pause').classList.add('hidden');
  $('#ov-end').classList.remove('hidden');
}

// ------------------------------------------------------------ Démarrage
function boot() {
  Save.load();
  document.title = GAME_TITLE;
  Game.init($('#game'), { onHud, onLevelUp, onBanner, onEnd, onZoneCleared, onDofus, onProgress: () => Save.store(), onPauseKey: togglePause });

  $$('[data-go]').forEach((b) => b.addEventListener('click', () => show(b.dataset.go)));
  ClassScreen.bind();
  $('#btn-pause').addEventListener('click', togglePause);
  $('#btn-resume').addEventListener('click', togglePause);
  $('#btn-quit').addEventListener('click', () => {
    if (confirm('Abandonner la partie ? Les kamas ramassés sont perdus.')) quitToMenu();
  });
  $('#btn-again').addEventListener('click', startGame);
  $('#btn-menu').addEventListener('click', quitToMenu);

  // raccourcis : 1/2/3 pour les cartes, R pour relancer, B pour bannir
  $('#btn-reroll').addEventListener('click', rerollChoices);
  $('#btn-ban').addEventListener('click', toggleBan);
  addEventListener('keydown', (e) => {
    if ($('#ov-levelup').classList.contains('hidden')) return;
    if (e.code === 'KeyR') return rerollChoices();
    if (e.code === 'KeyB') return toggleBan();
    const el = $(`#choices .choice[data-idx="${e.key}"]`);
    if (el) el.click();
  });

  show('menu');
}

boot();
