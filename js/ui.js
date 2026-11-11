'use strict';
// Interface : menus, sauvegarde, HUD et liaison avec le moteur.

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Math.floor(n).toLocaleString('fr-FR');

// Abréviations des caractéristiques (HUD et cartes de niveau)
const PASSIVE_ABBR = {
  vitalite: 'VIT', force: 'FOR', agilite: 'AGI', intelligence: 'INT', sagesse: 'SAG',
  chance: 'CHA', prospection: 'PRO', pa: 'PA', resistance: 'RES', soin: 'SOI',
};

// ------------------------------------------------------------ Sauvegarde
const SAVE_KEY = 'zaapsurvie2-save';
const Save = {
  data: null,
  load() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { /* stockage indisponible */ }
    this.data = Object.assign({ kamas: 0, unlocked: [], cleared: [], dofus: [], upgrades: {}, best: {}, lastClass: null }, d || {});
    for (const id in CLASSES) if (!CLASSES[id].cost && !this.data.unlocked.includes(id)) this.data.unlocked.push(id);
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
  if (name === 'menu') renderHome();
  if (name === 'class') renderClasses();
  if (name === 'zaap') renderZaaps();
  if (name === 'shop') renderShop();
  if (name === 'dofus') renderDofus();
  refreshKamas();
}

function refreshKamas() {
  $$('[data-kamas]').forEach((el) => { el.textContent = fmt(Save.data.kamas); });
}

const initials = (name) => name.slice(0, 2);
function avatar(c, size) {
  return `<div class="avatar" style="background:${c.color};width:${size}px;height:${size}px;font-size:${Math.round(size * 0.36)}px">${initials(c.name)}</div>`;
}

function renderHome() {
  const d = Save.data;
  const open = ZONES.filter((_, i) => zoneUnlocked(i)).length;
  $('#st-zones').textContent = `${open} / ${ZONES.length}`;
  $('#st-dofus').textContent = `${d.dofus.length} / ${Object.keys(DOFUS).length}`;
  $('#st-classes').textContent = `${d.unlocked.length} / ${Object.keys(CLASSES).length}`;
}

// ------------------------------------------------------------ Classes
function renderClasses() {
  if (!selectedClass || !CLASSES[selectedClass]) selectedClass = Save.data.lastClass && CLASSES[Save.data.lastClass] ? Save.data.lastClass : 'iop';
  const g = $('#class-grid');
  g.innerHTML = '';
  for (const id in CLASSES) {
    const c = CLASSES[id];
    const owned = Save.data.unlocked.includes(id);
    const sel = id === selectedClass;
    const el = document.createElement('button');
    el.className = 'class-card' + (owned ? '' : ' locked') + (sel ? ' selected' : '');
    el.innerHTML = `${avatar(c, 64)}<span class="name">${c.name}</span>
      <span class="tag">${sel ? 'Sélectionné' : owned ? 'Disponible' : fmt(c.cost) + ' kamas'}</span>`;
    el.addEventListener('click', () => { selectedClass = id; renderClasses(); });
    el.addEventListener('dblclick', () => { if (owned) goZaap(); });
    g.appendChild(el);
  }
  renderClassDetail();
}

function renderClassDetail() {
  const id = selectedClass, c = CLASSES[id];
  const owned = Save.data.unlocked.includes(id);
  const best = Save.data.best[id];
  const [role, ...rest] = c.desc.split('. ');
  const spells = c.spells.map((s) => {
    const d = SPELLS[s];
    return `<div class="spell-row"><div class="sicon" style="background:${d.color}">${d.icon}</div><div><b>${d.name}</b><small>${d.desc}</small></div></div>`;
  }).join('');
  let action;
  if (owned) action = '<button class="btn primary" id="btn-choose">Choisir mon zaap</button>';
  else {
    const missing = c.cost - Save.data.kamas;
    action = `<button class="btn primary" id="btn-unlock" ${missing > 0 ? 'disabled' : ''}>Débloquer · ${fmt(c.cost)} kamas</button>
      ${missing > 0 ? `<div class="note">Il te manque ${fmt(missing)} kamas</div>` : ''}`;
  }
  $('#class-detail').innerHTML = `
    <div class="head">${avatar(c, 84)}<div><div class="title">${c.name}</div><div class="role">${role}</div></div></div>
    <p>${rest.join('. ') || c.desc}</p>
    <div class="mini-stats">
      <div><span>Vie</span><b>${c.hp}</b></div>
      <div><span>Vitesse</span><b>${c.speed}</b></div>
      <div><span>Record</span><b>${best ? 'Zone ' + best : '—'}</b></div>
    </div>
    <div class="eyebrow">Sorts</div>
    <div class="spell-list">${spells}</div>
    ${action}`;
  const choose = $('#btn-choose');
  if (choose) choose.addEventListener('click', goZaap);
  const unlock = $('#btn-unlock');
  if (unlock) unlock.addEventListener('click', () => {
    if (Save.data.kamas < c.cost) return;
    Save.data.kamas -= c.cost;
    Save.data.unlocked.push(id);
    Save.store();
    refreshKamas();
    renderClasses();
  });
}

function goZaap() {
  Save.data.lastClass = selectedClass;
  Save.store();
  selectedZone = -1;
  show('zaap');
}

// ------------------------------------------------------------ Zaaps
function zoneUnlocked(i) { return i === 0 || Save.data.cleared.includes(i - 1); }
function zoneState(i) { return Save.data.cleared.includes(i) ? 'done' : zoneUnlocked(i) ? 'open' : 'lock'; }

function renderZaaps() {
  if (selectedZone < 0 || !ZONES[selectedZone]) {
    // par défaut : la zone activée la plus avancée
    selectedZone = 0;
    ZONES.forEach((_, i) => { if (zoneUnlocked(i)) selectedZone = i; });
  }
  const c = CLASSES[selectedClass];
  $('#zaap-class').innerHTML = `${avatar(c, 32)}${c.name}`;
  const nodes = $('#zaap-nodes');
  nodes.innerHTML = '';
  ZONES.forEach((z, i) => {
    const el = document.createElement('button');
    el.className = `zaap-node ${zoneState(i)}` + (i === selectedZone ? ' selected' : '');
    el.style.left = z.x + '%';
    el.style.top = z.y + '%';
    el.setAttribute('aria-label', z.name);
    el.innerHTML = `<div class="ring"><div class="core"></div></div><span class="label">${z.name}</span>`;
    el.addEventListener('click', () => { selectedZone = i; renderZaaps(); });
    el.addEventListener('dblclick', () => { if (zoneUnlocked(i)) startGame(); });
    nodes.appendChild(el);
  });
  renderZaapDetail();
}

function renderZaapDetail() {
  const i = selectedZone, z = ZONES[i], st = zoneState(i);
  const label = { open: 'Zaap activé', done: 'Zone terminée', lock: 'Zaap verrouillé' }[st];
  const dofus = z.dofus.map((id) => {
    const has = Save.data.dofus.includes(id);
    return `<div class="dofus-egg small ${has ? '' : 'off'}" style="background:${DOFUS[id].color}" title="${DOFUS[id].name}"></div>`;
  }).join('');
  const owned = z.dofus.filter((d) => Save.data.dofus.includes(d)).length;
  $('#zaap-detail').innerHTML = `
    <div class="eyebrow" style="color:${st === 'lock' ? 'var(--muted)' : '#7fe1e4'}">${label} · Difficulté ${i + 1}</div>
    <div class="title">${z.name}</div>
    <p>${z.sub}. Tenez 8 minutes pour affronter le gardien.</p>
    <div class="eyebrow">Monstres</div>
    <div class="chips">${z.monsters.map((m) => `<span>${MONSTERS[m].name}</span>`).join('')}</div>
    <div class="guardian">
      <div class="ico"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f2c14e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 18l2-9 4 4 2-7 2 7 4-4 2 9z"/></svg></div>
      <div><span>Gardien</span><b>${MONSTERS[z.boss].name}</b></div>
    </div>
    <div class="dofus-line">${dofus}<span>Dofus ${owned} / ${z.dofus.length}</span></div>
    ${st === 'lock'
      ? `<button class="btn teal" disabled>Verrouillé</button><div class="note">Battez le gardien de ${ZONES[i - 1].name} pour activer ce zaap.</div>`
      : '<button class="btn teal" id="btn-travel">Traverser le zaap</button>'}`;
  const travel = $('#btn-travel');
  if (travel) travel.addEventListener('click', startGame);
}

// ------------------------------------------------------------ Boutique et Dofus
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
        ${maxed ? '<span>Max</span>' : `<span class="kamas-pill"><b class="k">K</b> ${fmt(cost)}</span>`}</div>`;
    el.addEventListener('click', () => {
      if (maxed) return;
      if (Save.data.kamas < cost) { shake(el); return; }
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

function shake(el) {
  el.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }], { duration: 250 });
}

// ------------------------------------------------------------ Partie
function startGame() {
  if (!zoneUnlocked(selectedZone)) return;
  $$('.screen').forEach((s) => s.classList.remove('active'));
  ['#ov-end', '#ov-pause', '#ov-levelup'].forEach((s) => $(s).classList.add('hidden'));
  const c = CLASSES[selectedClass];
  const portrait = $('#hud-portrait');
  portrait.style.background = c.color;
  $('#hud-ini').textContent = initials(c.name);
  lastSlotsKey = '';
  $('#hud').classList.remove('hidden');
  inGame = true;
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

let lastSlotsKey = '';
function onHud(h) {
  $('#hp-fill').style.width = (100 * Math.max(0, h.hp) / h.maxHp) + '%';
  $('#sh-fill').style.width = Math.min(100, (100 * h.shield) / h.maxHp) + '%';
  $('#hp-txt').textContent = Math.ceil(Math.max(0, h.hp)) + ' / ' + h.maxHp;
  $('#xp-fill').style.width = (100 * h.xp / h.xpNext) + '%';
  $('#lvl').textContent = h.level;
  $('#timer').textContent = fmtTime(h.t);
  $('#kills').textContent = fmt(h.kills);
  $('#hud-kamas').textContent = fmt(h.kamas);
  const bb = $('#boss-bar');
  if (h.boss) {
    bb.classList.remove('hidden');
    $('#boss-name').textContent = h.boss.name;
    $('#boss-fill').style.width = (100 * Math.max(0, h.boss.hp) / h.boss.maxHp) + '%';
  } else bb.classList.add('hidden');

  const key = h.spells.map((s) => s.id + s.lvl).join() + JSON.stringify(h.passives);
  if (key !== lastSlotsKey) {
    lastSlotsKey = key;
    $('#hud-spells').innerHTML = spellSlots(h.spells);
    $('#hud-passives').innerHTML = passiveSlots(h.passives);
  }
  $$('#hud-spells .cd').forEach((el, i) => { el.style.height = Math.round((h.cds[i] || 0) * 100) + '%'; });
}

function spellSlots(spells) {
  return spells.map((s) => {
    const d = SPELLS[s.id];
    return `<div class="slot" style="background:${d.color}" title="${d.name}">${d.icon}<div class="cd"></div><i>${s.lvl}</i></div>`;
  }).join('');
}

function passiveSlots(passives) {
  return Object.keys(passives).map((id) =>
    `<div class="pslot" style="border-color:${PASSIVES[id].color}" title="${PASSIVES[id].name}">${PASSIVE_ABBR[id]} ${passives[id]}</div>`).join('');
}

// ------------------------------------------------------------ Montée de niveau
let currentChoices = [];
let banMode = false;

function onLevelUp(choices) {
  banMode = false;
  renderChoices(choices);
  $('#ov-levelup').classList.remove('hidden');
}

function renderChoices(choices) {
  currentChoices = choices;
  const n = Game.counts() || { rerolls: 0, banishes: 0, level: 1 };
  $('#lu-level').textContent = 'Niveau ' + n.level;
  const box = $('#choices');
  box.classList.toggle('banning', banMode);
  $('#ban-hint').classList.toggle('hidden', !banMode);
  box.innerHTML = '';
  choices.forEach((c, i) => {
    let kind, kindColor, badge, badgeBg, max = 5;
    if (c.kind === 'spell') {
      kind = c.lvl === 1 ? 'Nouveau sort' : 'Sort';
      kindColor = c.lvl === 1 ? '#7fe1e4' : '#ffb347';
      badge = c.lvl === 1 ? 'Nouveau' : 'Niv. ' + c.lvl;
      badgeBg = c.lvl === 1 ? '#7fe1e4' : '#f2c14e';
    } else if (c.kind === 'passive') {
      kind = 'Caractéristique'; kindColor = '#8fd9a0';
      badge = 'Niv. ' + c.lvl; badgeBg = '#8fd9a0'; max = PASSIVES[c.id].max;
    } else {
      kind = 'Bonus'; kindColor = '#f2c14e'; badge = ''; badgeBg = 'transparent';
    }
    const isPassive = c.kind === 'passive';
    const icon = isPassive ? PASSIVE_ABBR[c.id] : esc(c.icon);
    const pips = c.lvl ? `<div class="pips">${Array.from({ length: max }, (_, k) => `<span class="pip ${k < c.lvl ? 'on' : ''}"></span>`).join('')}</div>` : '';
    const el = document.createElement('button');
    el.className = 'choice';
    el.dataset.idx = i + 1;
    el.innerHTML = `
      <div class="top"><span class="kind" style="color:${kindColor}">${kind.toUpperCase()}</span>${badge ? `<span class="badge" style="background:${badgeBg}">${badge}</span>` : ''}</div>
      <div class="ico ${isPassive ? 'passive' : ''}" style="background:${c.color};border-color:${c.color}">${icon}</div>
      <div class="name">${esc(c.name)}</div>
      ${pips}
      <div class="desc">${esc(c.desc)}</div>
      <div class="key">Touche ${i + 1}</div>`;
    el.addEventListener('click', () => pickChoice(c));
    box.appendChild(el);
  });
  const rr = $('#btn-reroll'), bn = $('#btn-banish');
  rr.querySelector('span').textContent = `Relancer (${n.rerolls})`;
  rr.disabled = n.rerolls <= 0;
  bn.querySelector('span').textContent = banMode ? 'Annuler' : `Bannir (${n.banishes})`;
  bn.disabled = n.banishes <= 0 && !banMode;
  bn.classList.toggle('active', banMode);
}

function pickChoice(c) {
  if (banMode) {
    if (!c.id) return;
    banMode = false;
    const next = Game.banish(c);
    if (next) renderChoices(next);
    return;
  }
  $('#ov-levelup').classList.add('hidden');
  Game.choose(c);
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
  const q = $('#btn-quit');
  delete q.dataset.armed;
  q.textContent = 'Abandonner';
  if (willPause) $('#pause-build').innerHTML = $('#hud-spells').innerHTML + $('#hud-passives').innerHTML;
  ov.classList.toggle('hidden', !willPause);
  Game.setPaused(willPause);
}

function onEnd(r) {
  inGame = false;
  const z = ZONES[r.zoneIdx];
  const d = Save.data;
  d.kamas += r.kamas;
  for (const id of r.found) if (!d.dofus.includes(id)) d.dofus.push(id);
  let unlockedMsg = '';
  if (r.victory && !d.cleared.includes(r.zoneIdx)) {
    d.cleared.push(r.zoneIdx);
    if (ZONES[r.zoneIdx + 1]) unlockedMsg = 'Nouveau zaap activé : ' + ZONES[r.zoneIdx + 1].name;
  }
  if (r.victory) d.best[r.cls] = Math.max(d.best[r.cls] || 0, r.zoneIdx + 1);
  Save.store();

  $('#end-title').textContent = r.victory ? 'Victoire !' : 'Vous êtes mort…';
  const loot = r.found.map((id) => `<div class="dofus-egg" style="background:${DOFUS[id].color};--glow:${DOFUS[id].color}" title="${DOFUS[id].name}"></div><b>${DOFUS[id].name}</b>`).join('');
  $('#end-stats').innerHTML = `
    ${loot ? `<div class="loot">${loot}</div>` : ''}
    <div class="stats">
      <span>Zone</span><span>${z.name}</span>
      <span>Classe</span><span>${CLASSES[r.cls].name}</span>
      <span>Temps survécu</span><span>${fmtTime(r.t)}</span>
      <span>Niveau atteint</span><span>${r.level}</span>
      <span>Monstres vaincus</span><span>${fmt(r.kills)}</span>
      <span>Kamas gagnés</span><span><b class="k">K</b> ${fmt(r.kamas)}</span>
    </div>
    ${unlockedMsg ? `<p class="hint" style="color:var(--gold)">${unlockedMsg}</p>` : ''}`;
  $('#ov-levelup').classList.add('hidden');
  $('#ov-pause').classList.add('hidden');
  $('#ov-end').classList.remove('hidden');
}

// ------------------------------------------------------------ Démarrage
function boot() {
  Save.load();
  document.title = GAME_TITLE;
  Game.init($('#game'), { onHud, onLevelUp, onBanner, onEnd, onPauseKey: togglePause });

  $$('[data-go]').forEach((b) => b.addEventListener('click', () => show(b.dataset.go)));
  $('#btn-pause').addEventListener('click', togglePause);
  $('#btn-resume').addEventListener('click', togglePause);
  // confirmation en deux clics (les boîtes confirm() sont bloquées dans certains cadres)
  $('#btn-quit').addEventListener('click', () => {
    const q = $('#btn-quit');
    if (q.dataset.armed) quitToMenu();
    else { q.dataset.armed = '1'; q.textContent = 'Confirmer l’abandon (kamas perdus)'; }
  });
  $('#btn-again').addEventListener('click', startGame);
  $('#btn-menu').addEventListener('click', quitToMenu);

  $('#btn-reroll').addEventListener('click', () => {
    banMode = false;
    const next = Game.reroll();
    if (next) renderChoices(next);
  });
  $('#btn-banish').addEventListener('click', () => {
    banMode = !banMode;
    renderChoices(currentChoices);
  });
  $('#btn-skip').addEventListener('click', () => {
    banMode = false;
    $('#ov-levelup').classList.add('hidden');
    Game.choose({ kind: 'kamas' });
  });

  // raccourcis 1/2/3 pour les choix de niveau
  addEventListener('keydown', (e) => {
    if ($('#ov-levelup').classList.contains('hidden')) return;
    const el = $(`#choices .choice[data-idx="${e.key}"]`);
    if (el) el.click();
  });

  show('menu');
}

boot();
