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
  if (name === 'class') renderClasses();
  if (name === 'zaap') renderZaaps();
  if (name === 'shop') renderShop();
  if (name === 'dofus') renderDofus();
  refreshKamas();
}

function refreshKamas() {
  $$('[data-kamas]').forEach((el) => { el.textContent = Save.data.kamas.toLocaleString('fr-FR'); });
}

function initials(name) { return name.slice(0, 2); }

function renderClasses() {
  const g = $('#class-grid');
  g.innerHTML = '';
  for (const id in CLASSES) {
    const c = CLASSES[id];
    const owned = Save.data.unlocked.includes(id);
    const best = Save.data.best[id];
    const el = document.createElement('button');
    el.className = 'card' + (owned ? '' : ' locked');
    el.innerHTML = `
      <div class="row">
        <div class="avatar" style="background:${c.color}">${initials(c.name)}</div>
        <div><h3>${c.name}</h3><p>${c.hp} PV · vitesse ${c.speed}</p></div>
      </div>
      <p>${c.desc}</p>
      <div class="spell-chips">${c.spells.map((s) => `<span class="chip">${SPELLS[s].name}</span>`).join('')}</div>
      <div class="meta">
        <span>${best ? 'Record : ' + best + ' zone(s)' : ''}</span>
        ${owned ? '<span>Choisir →</span>' : `<span class="kamas-pill"><b class="k">K</b> ${c.cost.toLocaleString('fr-FR')}</span>`}
      </div>`;
    el.addEventListener('click', () => {
      if (!owned) {
        if (Save.data.kamas < c.cost) { flash(el); return; }
        if (!confirm(`Débloquer ${c.name} pour ${c.cost} kamas ?`)) return;
        Save.data.kamas -= c.cost;
        Save.data.unlocked.push(id);
        Save.store();
        renderClasses();
        refreshKamas();
        return;
      }
      selectedClass = id;
      show('zaap');
    });
    g.appendChild(el);
  }
}

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
  $('#lvl-tip').textContent = data.spells < 4
    ? `Sorts : ${data.spells}/8. Chaque nouveau sort ajoute des dégâts.`
    : 'Montez vos meilleurs sorts au niveau 5.';
  const rr = $('#btn-reroll'), bn = $('#btn-ban');
  rr.disabled = data.rerolls <= 0; rr.querySelector('em').textContent = '×' + data.rerolls;
  bn.disabled = data.bans <= 0; bn.querySelector('em').textContent = '×' + data.bans;
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
