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
    this.data = Object.assign({ kamas: 0, unlocked: [], cleared: [], dofus: [], upgrades: {}, best: {}, lastClass: null, gfx: '2d', adventures: {} }, d || {});
    if (!this.data.adventures) this.data.adventures = {};
    for (const id in CLASSES) if (!CLASSES[id].cost && !this.data.unlocked.includes(id)) this.data.unlocked.push(id);
  },
  store() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); } catch (e) { /* ignoré */ }
  },
};

let selectedClass = null;
let selectedZone = 0;
let inGame = false;
let playMode = 'world';   // 'world' (aventure) ou 'arena' (vagues)
let worldGame = false;
let saveTimer = 0;

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
    el.addEventListener('dblclick', () => { if (owned) (playMode === 'world' ? startAdventure : goZaap)(); });
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
  const adv = Save.data.adventures[id];
  if (owned && playMode === 'world') {
    action = adv
      ? `<button class="btn primary" id="btn-adv">Continuer · niv. ${adv.level} · ${esc(ZONES[advZone(adv)].name)}</button>
         <button class="btn small danger" id="btn-adv-new">Recommencer l’aventure</button>`
      : '<button class="btn primary" id="btn-adv">Commencer l’aventure</button>';
  } else if (owned) action = '<button class="btn primary" id="btn-choose">Choisir mon zaap</button>';
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
      ${playMode === 'world'
        ? `<div><span>Aventure</span><b>${adv ? 'Niv. ' + adv.level : '—'}</b></div>`
        : `<div><span>Record</span><b>${best ? 'Zone ' + best : '—'}</b></div>`}
    </div>
    <div class="eyebrow">Sorts</div>
    <div class="spell-list">${spells}</div>
    ${action}`;
  const choose = $('#btn-choose');
  if (choose) choose.addEventListener('click', goZaap);
  const go = $('#btn-adv');
  if (go) go.addEventListener('click', startAdventure);
  const reset = $('#btn-adv-new');
  if (reset) reset.addEventListener('click', () => {
    if (!reset.dataset.armed) { reset.dataset.armed = '1'; reset.textContent = 'Confirmer : effacer ce héros'; return; }
    delete Save.data.adventures[id];
    Save.store();
    renderClasses();
  });
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
function enterHud(world) {
  $$('.screen').forEach((s) => s.classList.remove('active'));
  ['#ov-end', '#ov-pause', '#ov-levelup', '#ov-dialog', '#ov-travel', '#ov-char', '#ov-map'].forEach((s) => $(s).classList.add('hidden'));
  worldGame = world;
  $('#hud').classList.toggle('world', world);
  ['#quest', '#minimap', '#hud-side'].forEach((s) => $(s).classList.toggle('hidden', !world));
  $('#timer').classList.toggle('hidden', world);
  $('#btn-act').classList.add('hidden');
}

/** Lance (ou reprend) l'aventure du héros sélectionné. */
function startAdventure() {
  if (!Save.data.unlocked.includes(selectedClass)) return;
  Save.data.lastClass = selectedClass;
  const adv = Save.data.adventures[selectedClass] || { cls: selectedClass, level: 1 };
  // Ancienne sauvegarde (monde continu) : on la ramène au zaap de sa zone
  if (adv.zone === undefined) { adv.zone = advZone(adv); adv.pos = null; }
  enterHud(true);
  const c = CLASSES[selectedClass];
  $('#hud-portrait').style.background = c.color;
  $('#hud-ini').textContent = initials(c.name);
  lastSlotsKey = '';
  $('#hud').classList.remove('hidden');
  inGame = true;
  Game.startWorld(selectedClass, Save.data, adv);
  saveAdventure();
  clearInterval(saveTimer);
  saveTimer = setInterval(() => { if (inGame && worldGame) saveAdventure(); }, 15000);
}

/** Enregistre le héros, son avancée et le butin (kamas, Dofus) gagné depuis la dernière sauvegarde. */
function saveAdventure() {
  if (!worldGame) return;
  const snap = Game.worldSnapshot();
  if (!snap) return;
  const loot = Game.takeLoot();
  const d = Save.data;
  d.kamas += loot.kamas;
  for (const id of loot.found) if (!d.dofus.includes(id)) d.dofus.push(id);
  d.adventures[snap.cls] = snap;
  // Les zones libérées dans l'aventure ouvrent aussi les zaaps de l'arène
  for (let i = 0; i < 5; i++) if (snap.bossKilled[ZONES[i].boss] && !d.cleared.includes(i)) d.cleared.push(i);
  Save.store();
}

function startGame() {
  if (!zoneUnlocked(selectedZone)) return;
  enterHud(false);
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
  if (worldGame) saveAdventure();
  clearInterval(saveTimer);
  worldGame = false;
  Game.stop();
  inGame = false;
  $('#hud').classList.add('hidden');
  ['#ov-end', '#ov-pause', '#ov-levelup', '#ov-dialog', '#ov-travel', '#ov-char', '#ov-map'].forEach((s) => $(s).classList.add('hidden'));
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
  if (h.world) onWorldHud(h.world);
}

// ------------------------------------------------------------ Aventure : quête, action, mini-carte
let lastQuestKey = '';
function onWorldHud(w) {
  const qk = w.zone + w.quest + w.goal;
  if (qk !== lastQuestKey) {
    lastQuestKey = qk;
    $('#q-zone').textContent = w.zone;
    $('#q-title').textContent = w.quest;
    $('#q-goal').textContent = w.goal;
  }
  const act = $('#btn-act');
  act.classList.toggle('hidden', !w.action);
  if (w.action && act.textContent !== w.action + ' (E)') act.textContent = w.action + ' (E)';
  lastWorld = w;
  const [cp, tp] = w.pts;
  const bc = $('#btn-char .badge'), bt = $('#btn-tal .badge');
  bc.textContent = cp; bc.classList.toggle('hidden', cp <= 0);
  bt.textContent = tp; bt.classList.toggle('hidden', tp <= 0);
  drawMinimap(w);
}

// ------------------------------------------------------------ Aventure : personnage, talents, carte
const mapCache = new Map();
/** Terrain d'une carte dessiné une fois puis réutilisé (mini-carte et grande carte). */
function mapImage(m, Wd, Hd) {
  const key = m.key + ':' + Wd + 'x' + Hd;
  if (!mapCache.has(key)) {
    const c = document.createElement('canvas');
    c.width = Wd; c.height = Hd;
    WORLD.drawMap(c.getContext('2d'), m, Wd, Hd);
    mapCache.set(key, c);
  }
  return mapCache.get(key);
}
const lvlColor = (lv, me) => { const d = lv - me; return d >= 6 ? '#ff5a4a' : d >= 3 ? '#ffb347' : d <= -5 ? '#9a9a9a' : d <= -3 ? '#8fd9a0' : '#ffffff'; };

let charTab = 'carac', lastWorld = null;
function openChar(tab) {
  if (!inGame || !worldGame) return;
  charTab = tab || charTab;
  renderChar();
  $('#ov-char').classList.remove('hidden');
  Game.setPaused(true);
}
function closeChar() {
  if ($('#ov-char').classList.contains('hidden')) return;
  $('#ov-char').classList.add('hidden');
  lastSlotsKey = '';
  saveAdventure();
  Game.setPaused(false);
}
function renderChar() {
  const info = Game.charInfo();
  if (!info) return;
  $$('#char-tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === charTab));
  $('#char-body').innerHTML = charTab === 'carac' ? caracHtml(info) : talentHtml(info);
  $$('#char-body [data-carac]').forEach((b) => b.addEventListener('click', () => { Game.addCarac(b.dataset.carac, +b.dataset.n); renderChar(); }));
  $$('#char-body [data-talent]').forEach((b) => b.addEventListener('click', () => {
    const [kind, id] = b.dataset.talent.split(':');
    const why = Game.talentUp(kind, id);
    if (why) shake(b);
    renderChar();
  }));
  const rc = $('#btn-reset-carac');
  if (rc) rc.addEventListener('click', () => { Game.resetCarac(); renderChar(); });
  const rt = $('#btn-reset-tal');
  if (rt) rt.addEventListener('click', () => {
    const cost = talentResetCost(info.level);
    if (cost) {
      saveAdventure();
      if (Save.data.kamas < cost) { shake(rt); return; }
      if (!rt.dataset.armed) { rt.dataset.armed = '1'; rt.textContent = `Confirmer (${fmt(cost)} kamas)`; return; }
      Save.data.kamas -= cost;
      Save.store();
    }
    Game.resetTalents();
    renderChar();
  });
}
const talentResetCost = (lvl) => (lvl < 30 ? 0 : lvl * 100);

function caracHtml(info) {
  const rows = Object.entries(WORLD.CARACS).map(([id, c]) => {
    const v = info.carac[id] || 0, cost = WORLD.caracCost(id, v);
    const can = info.caracPts >= cost;
    return `<div class="carac-row">
      <span class="c-ico" style="background:${c.color}">${c.short}</span>
      <div class="c-name"><b>${c.name}</b><small>${c.help}</small></div>
      <span class="c-val">${v}</span>
      <span class="c-cost" title="Coût du prochain point">${cost} pt${cost > 1 ? 's' : ''} → +1</span>
      <button class="btn small" data-carac="${id}" data-n="1" ${can ? '' : 'disabled'}>+1</button>
      <button class="btn small" data-carac="${id}" data-n="10" ${can ? '' : 'disabled'}>+10</button>
    </div>`;
  }).join('');
  const uses = CLASSES[info.cls].spells.map((sid) => {
    const el = WORLD.ELEMENTS[WORLD.SPELL_ELEM[sid]], own = info.talents.spells[sid];
    return `<span class="use ${own ? '' : 'off'}"><i style="background:${el.color}"></i>${SPELLS[sid].name} · ${el.name} → ${WORLD.CARACS[el.stat].name}</span>`;
  }).join('');
  return `
    <div class="pts-line"><span>Points à répartir</span><b>${info.caracPts}</b><small>${WORLD.STAT_PER_LEVEL} points par niveau · Force, Intelligence, Chance et Agilité coûtent 1 point jusqu’à 100, puis 2, 3 et 4 · Sagesse 3 pour 1</small></div>
    ${rows}
    <div class="eyebrow">Ce que tes sorts utilisent</div>
    <div class="uses">${uses}</div>
    <div class="sum">
      <span>Vie max <b>${fmt(info.maxHp)}</b></span>
      <span>Esquive <b>${(info.dodge * 100).toFixed(1)} %</b></span>
      <span>Critique <b>${(info.crit * 100).toFixed(1)} %</b></span>
      <span>Expérience <b>×${info.xp.toFixed(2)}</b></span>
      <span>Butin <b>×${info.loot.toFixed(2)}</b></span>
    </div>
    <button class="btn small" id="btn-reset-carac">Remettre les caractéristiques à zéro (gratuit)</button>`;
}

function talentHtml(info) {
  const cls = CLASSES[info.cls];
  const spells = cls.spells.map((sid, i) => {
    const d = SPELLS[sid], el = WORLD.ELEMENTS[WORLD.SPELL_ELEM[sid]];
    const r = info.talents.spells[sid] || 0, why = info.checks['spell:' + sid];
    const gate = WORLD.SPELL_GATE[i];
    const label = r ? (r >= 5 ? 'Rang max' : `Rang ${r + 1}`) : 'Débloquer';
    return `<div class="tal-node ${r ? '' : 'locked'}">
      <div class="sicon" style="background:${d.color}">${d.icon}</div>
      <div class="t-main"><b>${d.name}</b><small><i class="el" style="background:${el.color}"></i>${el.name}${gate ? ` · s’ouvre après ${gate} points` : ' · sort de départ'}</small>
        <div class="pips">${Array.from({ length: 5 }, (_, k) => `<span class="pip ${k < r ? 'on' : ''}"></span>`).join('')}</div>
        <small class="why">${why && r < 5 ? esc(why) : r < 5 && r ? `Rang ${r + 1} : niveau ${WORLD.RANK_LEVEL[r + 1]}` : ''}</small></div>
      <button class="btn small ${why ? '' : 'primary'}" data-talent="spell:${sid}" ${why ? 'disabled' : ''}>${label}</button>
    </div>`;
  }).join('');
  const passives = Object.entries(WORLD.TALENT_PASSIVES).map(([id, p]) => {
    const r = info.talents.passives[id] || 0, why = info.checks['passive:' + id];
    return `<div class="tal-node">
      <span class="c-ico" style="background:${p.color}">${p.short}</span>
      <div class="t-main"><b>${p.name}</b><small>${p.desc} par rang</small>
        <div class="pips">${Array.from({ length: p.max }, (_, k) => `<span class="pip ${k < r ? 'on' : ''}"></span>`).join('')}</div></div>
      <button class="btn small ${why ? '' : 'primary'}" data-talent="passive:${id}" ${why ? 'disabled' : ''}>${r >= p.max ? 'Max' : '+1'}</button>
    </div>`;
  }).join('');
  const cost = talentResetCost(info.level);
  return `
    <div class="pts-line"><span>Points de talent</span><b>${info.talentPts}</b><small>1 point par niveau · ${info.spent} dépensés · chaque rang de sort demande un niveau minimum</small></div>
    <div class="tal-cols">
      <div><div class="eyebrow">Voie des sorts</div>${spells}</div>
      <div><div class="eyebrow">Voie des passifs</div>${passives}</div>
    </div>
    <button class="btn small" id="btn-reset-tal">Réinitialiser les talents (${cost ? fmt(cost) + ' kamas' : 'gratuit jusqu’au niveau 30'})</button>`;
}

let mapZone = -1;
function openMap() {
  if (!inGame || !worldGame || !lastWorld) return;
  mapZone = lastWorld.map.zone;
  renderMap();
  $('#ov-map').classList.remove('hidden');
  Game.setPaused(true);
}
function closeMap() {
  if ($('#ov-map').classList.contains('hidden')) return;
  $('#ov-map').classList.add('hidden');
  Game.setPaused(false);
}
function renderMap() {
  const w = lastWorld, here = w.map;
  const tabs = $('#map-tabs');
  tabs.innerHTML = '';
  WORLD.zones.forEach((z, i) => {
    const b = document.createElement('button');
    b.className = 'btn small' + (i === mapZone ? ' active' : '');
    b.disabled = !w.open[i];
    b.innerHTML = `${esc(z.name)}<small>${w.open[i] ? `niv. ${z.lvl[0]}–${z.lvl[1]}` : 'verrouillée'}</small>`;
    b.addEventListener('click', () => { mapZone = i; renderMap(); });
    tabs.appendChild(b);
  });
  const m = here.zone === mapZone ? here : WORLD.zones[mapZone];
  const cv = $('#map-canvas'), g = cv.getContext('2d');
  const Wd = 1200, Hd = Math.round(Wd * (m.h * 2) / m.w);
  cv.width = Wd; cv.height = Hd;
  g.drawImage(mapImage(m, Wd, Hd), 0, 0);
  const sx = Wd / m.w, sy = Hd / (m.h * 2), X = (x) => x * sx, Y = (y) => (y + m.h) * sy;
  const label = (txt, x, y, col) => {
    g.font = 'bold 22px Nunito, system-ui, sans-serif'; g.textAlign = 'center';
    g.lineWidth = 5; g.strokeStyle = 'rgba(20,12,30,.85)'; g.strokeText(txt, x, y); g.fillStyle = col; g.fillText(txt, x, y);
  };
  for (const c of m.camps) {
    g.fillStyle = lvlColor(c.lvl, w.level); g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 2;
    g.beginPath(); g.arc(X(c.x), Y(c.y), 7, 0, Math.PI * 2); g.fill(); g.stroke();
  }
  // Nom et niveau de chaque île
  for (const isl of m.isles || []) {
    if (!isl.k) continue;
    const ty = Y(isl.y - isl.ry * 0.62);
    label(isl.name, X(isl.x), ty, '#fff6d0');
    g.font = 'bold 17px Nunito, system-ui, sans-serif';
    const sub = `niv. ${isl.lvl[0]}–${isl.lvl[1]} · ${[...new Set(isl.ids)].map((id) => MONSTERS[id].name).join(', ')}`;
    g.lineWidth = 4; g.strokeStyle = 'rgba(20,12,30,.85)'; g.strokeText(sub, X(isl.x), ty + 22); g.fillStyle = lvlColor(isl.lvl[1], w.level); g.fillText(sub, X(isl.x), ty + 22);
  }
  if (m.kind === 'zone') {
    g.fillStyle = '#f2a03a'; g.beginPath(); g.arc(X(m.lair.x), Y(m.lair.y), 13, 0, Math.PI * 2); g.fill();
    label(MONSTERS[m.lair.id].name, X(m.lair.x), Y(m.lair.y) + 36, '#ffd0a0');
    g.fillStyle = '#4fc3c7'; g.fillRect(X(m.zaap.x) - 11, Y(m.zaap.y) - 11, 22, 22);
    label('Zaap', X(m.zaap.x), Y(m.zaap.y) + 40, '#bff4f6');
    g.fillStyle = '#120c18'; g.strokeStyle = '#ffd0a0'; g.lineWidth = 3;
    g.fillRect(X(m.door.x) - 14, Y(m.door.y) - 14, 28, 28); g.strokeRect(X(m.door.x) - 14, Y(m.door.y) - 14, 28, 28);
    label(`Donjon (niv. ${WORLD.DUNGEON_LEVEL[m.zone]})`, X(m.door.x) - 20, Y(m.door.y) + 42, '#ffd0a0');
    g.fillStyle = '#f2c14e'; g.beginPath(); g.arc(X(m.npc.x), Y(m.npc.y), 9, 0, Math.PI * 2); g.fill();
    label(m.npc.name + (w.npcAlert && here === m ? ' !' : ''), X(m.npc.x), Y(m.npc.y) - 16, '#f2c14e');
  } else {
    g.fillStyle = '#b46cff'; g.fillRect(X(m.exit.x) - 11, Y(m.exit.y) - 11, 22, 22);
    g.fillStyle = '#ff4a3a'; g.beginPath(); g.arc(X(m.boss.x), Y(m.boss.y), 15, 0, Math.PI * 2); g.fill();
    label(MONSTERS[m.boss.id].name, X(m.boss.x), Y(m.boss.y) - 24, '#ffd0d0');
  }
  if (m === here) {
    g.fillStyle = '#fff'; g.strokeStyle = '#1e1530'; g.lineWidth = 5;
    g.beginPath(); g.arc(X(w.px), Y(w.py), 11, 0, Math.PI * 2); g.stroke(); g.fill();
    label('Toi', X(w.px), Y(w.py) + 34, '#ffffff');
  }
  $('#map-note').textContent = m === here ? (here.kind === 'zone' ? `${here.name} · monstres niv. ${here.lvl[0]} à ${here.lvl[1]}` : `Donjon : ${here.name}`)
    : 'Tu n’es pas dans cette zone : passe par un zaap pour t’y rendre.';
}

function drawMinimap(w) {
  const cv = $('#minimap'), g = cv.getContext('2d'), m = w.map;
  // Taille du canevas selon les proportions de la carte (zone ou donjon)
  const Wd = 360, Hd = Math.round(Wd * (m.h * 2) / m.w);
  if (cv.height !== Hd) cv.height = Hd;
  const sx = Wd / m.w, sy = Hd / (m.h * 2);
  const X = (x) => x * sx, Y = (y) => (y + m.h) * sy;
  g.drawImage(mapImage(m, Wd, Hd), 0, 0);
  for (const c of w.camps) {
    g.fillStyle = lvlColor(c.lvl, w.level);
    g.beginPath(); g.arc(X(c.x), Y(c.y), 3, 0, Math.PI * 2); g.fill();
  }
  for (const b of w.bosses) {
    g.fillStyle = b.kind === 'boss' ? '#ff4a3a' : '#f2a03a';
    g.beginPath(); g.arc(X(b.x), Y(b.y), b.kind === 'boss' ? 7 : 5.5, 0, Math.PI * 2); g.fill();
  }
  if (m.kind === 'zone') {
    g.fillStyle = '#4fc3c7'; g.fillRect(X(m.zaap.x) - 5, Y(m.zaap.y) - 5, 10, 10);
    g.fillStyle = '#120c18'; g.fillRect(X(m.door.x) - 7, Y(m.door.y) - 7, 14, 14);
    g.strokeStyle = '#ffd0a0'; g.lineWidth = 2; g.strokeRect(X(m.door.x) - 7, Y(m.door.y) - 7, 14, 14);
    if (w.npcAlert) {
      g.fillStyle = '#f2c14e'; g.font = 'bold 24px system-ui, sans-serif'; g.textAlign = 'center';
      g.fillText('!', X(m.npc.x), Y(m.npc.y) + 8);
    }
  } else {
    g.fillStyle = '#b46cff'; g.fillRect(X(m.exit.x) - 5, Y(m.exit.y) - 5, 10, 10);
  }
  g.fillStyle = '#fff'; g.strokeStyle = '#1e1530'; g.lineWidth = 3;
  g.beginPath(); g.arc(X(w.px), Y(w.py), 6, 0, Math.PI * 2); g.stroke(); g.fill();
}

function advZone(adv) { return adv.zone !== undefined ? adv.zone : Math.min(4, Math.floor(((adv.pos && adv.pos.x) || 0) / 3200)); }

/** Petite notification (objet équipé ou revendu). */
function onToast(title, color, sub) {
  const box = $('#toasts');
  const el = document.createElement('div');
  el.className = 'toast';
  el.style.borderColor = color;
  el.innerHTML = `<b style="color:${color}">${esc(title)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}`;
  box.prepend(el);
  while (box.children.length > 4) box.lastChild.remove();
  setTimeout(() => el.classList.add('out'), 3200);
  setTimeout(() => el.remove(), 3700);
}

/** Équipement porté, affiché dans le menu pause. */
function equipHtml() {
  const eq = Game.equipment();
  const rows = Object.keys(WORLD.SLOTS).map((slot) => {
    const it = eq[slot];
    return `<div class="eq-row"><span class="eq-slot">${WORLD.SLOTS[slot].label}</span>${it
      ? `<div><b style="color:${it.color}">${esc(it.name)}</b><small>Niv. ${it.lvl} · ${esc(WORLD.itemDesc(it))}</small></div>`
      : '<div><small>Aucun</small></div>'}</div>`;
  }).join('');
  return `<div class="equip"><div class="eyebrow">Équipement</div>${rows}</div>`;
}

function onDialog(d) {
  const look = CLASSES[d.npc.look];
  const av = $('#dlg-avatar');
  av.style.background = look ? look.color : '#7a6a9a';
  av.textContent = d.npc.name.slice(0, 2);
  $('#dlg-name').textContent = d.npc.name;
  $('#dlg-role').textContent = d.npc.title;
  $('#dlg-title').textContent = d.title;
  $('#dlg-lines').innerHTML = d.lines.map((l) => `<p>${esc(l)}</p>`).join('') + (d.next ? `<p class="next">Nouvelle quête : <b>${esc(d.next)}</b></p>` : '');
  const r = $('#dlg-reward');
  r.classList.toggle('hidden', !d.reward);
  r.textContent = d.reward || '';
  // Fin de donjon : choix de la suite
  const box = $('#dlg-choices');
  box.innerHTML = '';
  dialogChoice = !!d.choices;
  $('#btn-dlg').classList.toggle('hidden', dialogChoice);
  for (const c of d.choices || []) {
    const b = document.createElement('button');
    b.className = 'btn ' + (c.main ? 'primary' : 'teal');
    b.innerHTML = `${esc(c.label)}${c.sub ? `<small>${esc(c.sub)}</small>` : ''}`;
    b.addEventListener('click', () => { dialogChoice = false; dialogAt = 0; closeDialog(); Game.worldChoice(c.id); });
    box.appendChild(b);
  }
  $('#ov-dialog').classList.remove('hidden');
  dialogAt = performance.now();
  Game.setPaused(true);
}
let dialogAt = 0, dialogChoice = false;
function closeDialog(fromKey = false) {
  if (dialogChoice) return;   // il faut choisir une des options
  // la touche qui a ouvert le dialogue ne doit pas le refermer aussitôt
  if ($('#ov-dialog').classList.contains('hidden') || (fromKey && performance.now() - dialogAt < 300)) return;
  $('#ov-dialog').classList.add('hidden');
  Game.setPaused(false);
}

function onZaap(list) {
  const box = $('#travel-list');
  box.innerHTML = '';
  for (const z of list) {
    const b = document.createElement('button');
    b.className = 'btn' + (z.here || !z.open ? '' : ' teal');
    b.disabled = z.here || !z.open;
    b.innerHTML = `${esc(z.name)}${z.here ? ' (ici)' : ''}<small>${z.open ? `Monstres niv. ${z.lvl[0]}–${z.lvl[1]}` : 'Bats le gardien précédent pour y accéder'}</small>`;
    b.addEventListener('click', () => { closeTravel(); Game.travel(z.idx); });
    box.appendChild(b);
  }
  $('#ov-travel').classList.remove('hidden');
  Game.setPaused(true);
}
function closeTravel() {
  $('#ov-travel').classList.add('hidden');
  Game.setPaused(false);
}

function spellSlots(spells) {
  return spells.map((s) => {
    const d = SPELLS[s.id];
    return `<div class="slot" style="background:${d.color}" title="${d.name}">${d.icon}<div class="cd"></div><i>${s.lvl}</i></div>`;
  }).join('');
}

function passiveSlots(passives) {
  return Object.keys(passives).filter((id) => passives[id]).map((id) => {
    const tp = worldGame && WORLD.TALENT_PASSIVES[id], def = tp || PASSIVES[id];
    return `<div class="pslot" style="border-color:${def.color}" title="${def.name}">${tp ? tp.short : PASSIVE_ABBR[id]} ${passives[id]}</div>`;
  }).join('');
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
  if (!inGame || ['#ov-levelup', '#ov-end', '#ov-dialog', '#ov-travel', '#ov-char', '#ov-map'].some((s) => !$(s).classList.contains('hidden'))) return;
  const ov = $('#ov-pause');
  const willPause = ov.classList.contains('hidden');
  const q = $('#btn-quit');
  delete q.dataset.armed;
  q.textContent = worldGame ? 'Sauvegarder et quitter' : 'Abandonner';
  if (willPause) $('#pause-build').innerHTML = $('#hud-spells').innerHTML + $('#hud-passives').innerHTML + (worldGame ? equipHtml() : '');
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
function applyGfx(mode) {
  const got = Game.setRenderMode(mode);
  $('#btn-gfx').textContent = 'Graphismes : ' + got.toUpperCase();
  return got;
}

function boot() {
  Save.load();
  document.title = GAME_TITLE;
  Game.init($('#game'), { onHud, onLevelUp, onBanner, onEnd, onPauseKey: togglePause, onDialog, onZaap, onSave: saveAdventure, onToast }, $('#game3d'));
  // Rendu 2D ou 3D : choix sauvegardé, ou forcé par ?gfx=3d / ?gfx=2d dans l'adresse
  const forced = (location.search.match(/[?&]gfx=(2d|3d)/) || [])[1];
  applyGfx(forced || Save.data.gfx);
  $('#btn-gfx').addEventListener('click', () => {
    const want = Game.renderMode() === '3d' ? '2d' : '3d';
    const got = applyGfx(want);
    Save.data.gfx = got;
    Save.store();
    if (want === '3d' && got !== '3d') onBanner('3D indisponible', 'Ton navigateur ne gère pas WebGL : le jeu reste en 2D.');
  });

  $$('[data-go]').forEach((b) => b.addEventListener('click', () => show(b.dataset.go)));
  $('#btn-adventure').addEventListener('click', () => { playMode = 'world'; show('class'); });
  $('#btn-arena').addEventListener('click', () => { playMode = 'arena'; show('class'); });
  $('#btn-act').addEventListener('click', () => Game.interact());
  $('#btn-dlg').addEventListener('click', () => closeDialog());
  $('#btn-travel-close').addEventListener('click', closeTravel);
  addEventListener('keydown', (e) => {
    if (!$('#ov-dialog').classList.contains('hidden') && ['Enter', 'Space', 'KeyE', 'Escape'].includes(e.code)) { e.preventDefault(); closeDialog(true); }
    else if (!$('#ov-travel').classList.contains('hidden') && e.code === 'Escape') closeTravel();
    else if (!$('#ov-char').classList.contains('hidden')) {
      if (e.code === 'Escape' || (e.code === 'KeyC' && charTab === 'carac') || (e.code === 'KeyT' && charTab === 'talents')) closeChar();
      else if (e.code === 'KeyC' || e.code === 'KeyT') { charTab = e.code === 'KeyC' ? 'carac' : 'talents'; renderChar(); }
    } else if (!$('#ov-map').classList.contains('hidden')) { if (e.code === 'Escape' || e.code === 'KeyM') closeMap(); }
    else if (inGame && worldGame && Game.charInfo() && [...$$('.overlay')].every((o) => o.classList.contains('hidden'))) {
      if (e.code === 'KeyC') openChar('carac');
      else if (e.code === 'KeyT') openChar('talents');
      else if (e.code === 'KeyM') openMap();
    }
  });
  $('#btn-char').addEventListener('click', () => openChar('carac'));
  $('#btn-tal').addEventListener('click', () => openChar('talents'));
  $('#btn-map').addEventListener('click', openMap);
  $('#btn-char-close').addEventListener('click', closeChar);
  $('#btn-map-close').addEventListener('click', closeMap);
  $$('#char-tabs button').forEach((b) => b.addEventListener('click', () => { charTab = b.dataset.tab; renderChar(); }));
  addEventListener('pagehide', () => { if (inGame && worldGame) saveAdventure(); });
  $('#btn-pause').addEventListener('click', togglePause);
  $('#btn-resume').addEventListener('click', togglePause);
  // confirmation en deux clics (les boîtes confirm() sont bloquées dans certains cadres)
  $('#btn-quit').addEventListener('click', () => {
    const q = $('#btn-quit');
    if (q.dataset.armed || worldGame) quitToMenu();
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
