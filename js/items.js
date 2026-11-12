'use strict';
// Équipement de l'aventure, façon Dofus : chaque famille de monstres lâche sa panoplie.
// Les objets donnent des caractéristiques (jets aléatoires dans une plage), l'arme a ses
// propres dégâts dans un élément, et porter plusieurs pièces d'une panoplie donne un bonus.

const ITEMS = (() => {
  // Emplacements d'équipement (les anneaux se portent par deux)
  const SLOTS = {
    arme: { label: 'Arme' }, coiffe: { label: 'Coiffe' }, cape: { label: 'Cape' }, amulette: { label: 'Amulette' },
    anneau1: { label: 'Anneau', type: 'anneau' }, anneau2: { label: 'Anneau', type: 'anneau' }, ceinture: { label: 'Ceinture' }, bottes: { label: 'Bottes' },
  };
  const TYPE_LABEL = { arme: 'Arme', coiffe: 'Coiffe', cape: 'Cape', amulette: 'Amulette', anneau: 'Anneau', ceinture: 'Ceinture', bottes: 'Bottes' };
  // Lignes de caractéristiques (nom affiché, suffixe)
  const LINES = {
    vitalite: { name: 'Vitalité' }, sagesse: { name: 'Sagesse' }, force: { name: 'Force' }, intelligence: { name: 'Intelligence' },
    chance: { name: 'Chance' }, agilite: { name: 'Agilité' }, puissance: { name: 'Puissance' }, dommages: { name: 'Dommages' },
    critique: { name: 'Critique', pct: true }, resistance: { name: 'Résistance', pct: true }, vitesse: { name: 'Vitesse', pct: true },
    pa: { name: 'Recharge des sorts', pct: true, minus: true }, prospection: { name: 'Prospection' },
  };
  const ELEM_OF = { force: 'terre', intelligence: 'feu', chance: 'eau', agilite: 'air' };
  const RARITY = [
    { id: 'commun', name: 'Commun', color: '#d0d0d0', mul: 1, w: 70 },
    { id: 'rare', name: 'Rare', color: '#4fc3f7', mul: 1.1, w: 22 },
    { id: 'epique', name: 'Épique', color: '#b46cff', mul: 1.2, w: 7 },
    { id: 'legendaire', name: 'Légendaire', color: '#ffb347', mul: 1.3, w: 1 },
  ];

  /*
   * Panoplies : niveau, caractéristiques principales, pièces (type: nom), arme (nom, élément, forme).
   * Les niveaux suivent les îles (Astrub 1-40, Amakna 40-80, Abraknydes 80-120, Craqueleurs 120-160, Frigost 160-200).
   */
  const P = (id, name, lvl, stats, pieces, weapon, monsters) => ({ id, name, lvl, stats, pieces, weapon, monsters });
  const SETS = [
    // Astrub
    P('pichon', 'Panoplie du Pichon', 6, ['chance', 'vitalite'], { coiffe: 'Bob du Pichon', cape: 'Cape à écailles', anneau: 'Anneau du Pichon', bottes: 'Palmes du Pichon' }, null, ['pichon']),
    P('bouftou', 'Panoplie du Bouftou', 15, ['force', 'vitalite'], { coiffe: 'Coiffe du Bouftou', cape: 'Cape du Bouftou', amulette: 'Amulette du Bouftou', anneau: 'Anneau du Bouftou', ceinture: 'Ceinture du Bouftou', bottes: 'Bottes du Bouftou' }, { name: 'Marteau du Bouftou', elem: 'force', kind: 'marteau' }, ['bouftou']),
    P('tofu', 'Panoplie du Tofu', 25, ['agilite', 'vitalite'], { coiffe: 'Coiffe du Tofu', cape: 'Cape du Tofu', amulette: 'Amulette du Tofu', ceinture: 'Ceinture du Tofu', bottes: 'Bottes du Tofu' }, { name: 'Dague du Tofu', elem: 'agilite', kind: 'dague' }, ['tofu']),
    P('piou', 'Panoplie du Piou', 23, ['intelligence', 'sagesse'], { coiffe: 'Chapeau du Piou', cape: 'Cape du Piou', anneau: 'Anneau du Piou', ceinture: 'Ceinture du Piou', bottes: 'Sandales du Piou' }, { name: 'Bâton du Piou', elem: 'intelligence', kind: 'baton' }, ['piou']),
    P('larve', 'Panoplie Larvesque', 36, ['chance', 'intelligence'], { coiffe: 'Coiffe Larvesque', cape: 'Cape Larvesque', amulette: 'Amulette Larvesque', anneau: 'Anneau Larvesque', bottes: 'Bottes Larvesques' }, { name: 'Baguette Larvesque', elem: 'chance', kind: 'baton' }, ['larve_bleue']),
    P('tofu_royal', 'Panoplie du Tofu Royal', 33, ['agilite', 'puissance'], { coiffe: 'Couronne du Tofu Royal', cape: 'Cape du Tofu Royal', anneau: 'Anneau du Tofu Royal', bottes: 'Bottes du Tofu Royal' }, { name: 'Arc du Tofu Royal', elem: 'agilite', kind: 'arc' }, ['tofu_royal']),
    P('bouftou_royal', 'Panoplie du Bouftou Royal', 42, ['force', 'vitalite'], { coiffe: 'Coiffe du Bouftou Royal', cape: 'Cape du Bouftou Royal', amulette: 'Amulette du Bouftou Royal', anneau: 'Anneau du Bouftou Royal', ceinture: 'Ceinture du Bouftou Royal', bottes: 'Bottes du Bouftou Royal' }, { name: 'Marteau du Bouftou Royal', elem: 'force', kind: 'marteau' }, ['bouftou_royal']),
    // Amakna
    P('arakne', 'Panoplie de l’Arakne', 45, ['agilite', 'vitalite'], { coiffe: 'Coiffe de l’Arakne', amulette: 'Amulette Araknide', anneau: 'Anneau de l’Arakne', bottes: 'Bottes de l’Arakne' }, { name: 'Dague Araknide', elem: 'agilite', kind: 'dague' }, ['arakne']),
    P('moskito', 'Panoplie du Moskito', 55, ['intelligence', 'agilite'], { coiffe: 'Coiffe du Moskito', cape: 'Ailes du Moskito', anneau: 'Anneau du Moskito', ceinture: 'Ceinture du Moskito' }, { name: 'Dard du Moskito', elem: 'intelligence', kind: 'dague' }, ['moskito']),
    P('prespic', 'Panoplie du Prespic', 65, ['force', 'sagesse'], { coiffe: 'Coiffe du Prespic', cape: 'Cape du Prespic', amulette: 'Amulette du Prespic', bottes: 'Bottes du Prespic' }, { name: 'Pique du Prespic', elem: 'force', kind: 'lance' }, ['prespic']),
    P('sanglier', 'Panoplie du Sanglier', 75, ['force', 'vitalite'], { coiffe: 'Hure du Sanglier', cape: 'Cape du Sanglier', ceinture: 'Ceinture du Sanglier', bottes: 'Bottes du Sanglier' }, { name: 'Hache du Sanglier', elem: 'force', kind: 'hache' }, ['sanglier']),
    P('wabbit', 'Panoplie du Black Wabbit', 73, ['chance', 'puissance'], { coiffe: 'Oreilles du Black Wabbit', cape: 'Cape du Black Wabbit', amulette: 'Amulette Wabbit', anneau: 'Anneau Wabbit' }, { name: 'Cawotte tranchante', elem: 'chance', kind: 'dague' }, ['black_wabbit']),
    P('dragon_cochon', 'Panoplie du Dragon Cochon', 83, ['intelligence', 'vitalite'], { coiffe: 'Groin du Dragon Cochon', cape: 'Ailes du Dragon Cochon', amulette: 'Amulette du Dragon Cochon', anneau: 'Anneau du Dragon Cochon', ceinture: 'Ceinture du Dragon Cochon', bottes: 'Bottes du Dragon Cochon' }, { name: 'Bâton du Dragon Cochon', elem: 'intelligence', kind: 'baton' }, ['dragon_cochon']),
    // Forêt des Abraknydes
    P('fantome', 'Panoplie du Fantôme', 85, ['intelligence', 'chance'], { coiffe: 'Capuche spectrale', cape: 'Linceul du Fantôme', amulette: 'Amulette spectrale', anneau: 'Anneau du Fantôme' }, { name: 'Faux du Fantôme', elem: 'chance', kind: 'hache' }, ['fantome']),
    P('archer', 'Panoplie du Chafer Archer', 95, ['agilite', 'vitalite'], { coiffe: 'Casque du Chafer Archer', cape: 'Carquois en os', anneau: 'Anneau du Chafer Archer', bottes: 'Bottes du Chafer Archer' }, { name: 'Arc du Chafer', elem: 'agilite', kind: 'arc' }, ['chafer_archer']),
    P('abraknyde', 'Panoplie de l’Abraknyde', 105, ['force', 'vitalite'], { coiffe: 'Coiffe de l’Abraknyde', cape: 'Cape de l’Abraknyde', amulette: 'Amulette de l’Abraknyde', ceinture: 'Ceinture de l’Abraknyde', bottes: 'Bottes de l’Abraknyde' }, { name: 'Bâton de l’Abraknyde', elem: 'force', kind: 'baton' }, ['abraknyde']),
    P('chafer', 'Panoplie du Chafer', 115, ['force', 'agilite'], { coiffe: 'Crâne du Chafer', cape: 'Cape du Chafer', anneau: 'Anneau du Chafer', ceinture: 'Ceinture du Chafer', bottes: 'Bottes du Chafer' }, { name: 'Épée du Chafer', elem: 'force', kind: 'epee' }, ['chafer']),
    P('ancestral', 'Panoplie de l’Abraknyde Ancestral', 113, ['force', 'puissance'], { coiffe: 'Couronne Ancestrale', cape: 'Écorce Ancestrale', amulette: 'Amulette Ancestrale', bottes: 'Racines Ancestrales' }, { name: 'Branche Ancestrale', elem: 'force', kind: 'marteau' }, ['abrak_ancestral']),
    P('chene_mou', 'Panoplie du Chêne Mou', 125, ['intelligence', 'vitalite'], { coiffe: 'Coiffe du Chêne Mou', cape: 'Cape du Chêne Mou', amulette: 'Amulette du Chêne Mou', anneau: 'Anneau du Chêne Mou', ceinture: 'Ceinture du Chêne Mou', bottes: 'Bottes du Chêne Mou' }, { name: 'Bâton du Chêne Mou', elem: 'intelligence', kind: 'baton' }, ['chene_mou']),
    // Montagne des Craqueleurs
    P('gelee', 'Panoplie de la Gelée', 125, ['chance', 'vitalite'], { coiffe: 'Coiffe Gélatineuse', cape: 'Cape Gélatineuse', anneau: 'Anneau Gélatineux', bottes: 'Bottes Gélatineuses' }, { name: 'Baguette Gélatineuse', elem: 'chance', kind: 'baton' }, ['gelee']),
    P('bwork', 'Panoplie Bwork', 135, ['force', 'vitalite'], { coiffe: 'Casque Bwork', cape: 'Cape Bwork', amulette: 'Amulette Bwork', ceinture: 'Ceinture Bwork', bottes: 'Bottes Bwork' }, { name: 'Hache Bwork', elem: 'force', kind: 'hache' }, ['bwork']),
    P('bwork_mage', 'Panoplie du Bwork Mage', 145, ['intelligence', 'sagesse'], { coiffe: 'Chapeau du Bwork Mage', cape: 'Cape du Bwork Mage', amulette: 'Amulette du Bwork Mage', anneau: 'Anneau du Bwork Mage' }, { name: 'Bâton du Bwork Mage', elem: 'intelligence', kind: 'baton' }, ['bwork_mage']),
    P('craqueleur', 'Panoplie du Craqueleur', 155, ['force', 'vitalite'], { coiffe: 'Coiffe du Craqueleur', cape: 'Cape du Craqueleur', amulette: 'Amulette du Craqueleur', anneau: 'Anneau du Craqueleur', ceinture: 'Ceinture du Craqueleur', bottes: 'Bottes du Craqueleur' }, { name: 'Marteau du Craqueleur', elem: 'force', kind: 'marteau' }, ['craqueleur', 'craq_roc']),
    P('craq_legend', 'Panoplie du Craqueleur Légendaire', 165, ['force', 'puissance'], { coiffe: 'Coiffe Légendaire', cape: 'Cape Légendaire', amulette: 'Amulette Légendaire', anneau: 'Anneau Légendaire', ceinture: 'Ceinture Légendaire', bottes: 'Bottes Légendaires' }, { name: 'Marteau Légendaire', elem: 'force', kind: 'marteau' }, ['craq_legend']),
    // Frigost
    P('mansot', 'Panoplie du Mansot', 165, ['chance', 'vitalite'], { coiffe: 'Bonnet du Mansot', cape: 'Cape du Mansot', anneau: 'Anneau du Mansot', bottes: 'Bottes du Mansot' }, { name: 'Harpon du Mansot', elem: 'chance', kind: 'lance' }, ['mansot']),
    P('boufmouth', 'Panoplie du Boufmouth', 175, ['force', 'vitalite'], { coiffe: 'Coiffe du Boufmouth', cape: 'Toison du Boufmouth', amulette: 'Amulette du Boufmouth', ceinture: 'Ceinture du Boufmouth', bottes: 'Bottes du Boufmouth' }, { name: 'Marteau du Boufmouth', elem: 'force', kind: 'marteau' }, ['boufmouth']),
    P('sapik', 'Panoplie du Sapik', 185, ['intelligence', 'sagesse'], { coiffe: 'Coiffe du Sapik', cape: 'Cape du Sapik', amulette: 'Amulette du Sapik', anneau: 'Anneau du Sapik' }, { name: 'Bâton du Sapik', elem: 'intelligence', kind: 'baton' }, ['sapik']),
    P('fecorce', 'Panoplie du Fécorce', 195, ['agilite', 'vitalite'], { coiffe: 'Coiffe du Fécorce', cape: 'Cape du Fécorce', anneau: 'Anneau du Fécorce', ceinture: 'Ceinture du Fécorce', bottes: 'Bottes du Fécorce' }, { name: 'Arc du Fécorce', elem: 'agilite', kind: 'arc' }, ['fecorce']),
    P('mansot_royal', 'Panoplie du Mansot Royal', 173, ['chance', 'puissance'], { coiffe: 'Couronne du Mansot Royal', cape: 'Cape du Mansot Royal', amulette: 'Amulette du Mansot Royal', bottes: 'Bottes du Mansot Royal' }, { name: 'Sceptre du Mansot Royal', elem: 'chance', kind: 'baton' }, ['mansot_royal']),
    P('obsidiantre', 'Panoplie Obsidienne', 200, ['puissance', 'vitalite'], { coiffe: 'Coiffe Obsidienne', cape: 'Cape Obsidienne', amulette: 'Amulette Obsidienne', anneau: 'Anneau Obsidien', ceinture: 'Ceinture Obsidienne', bottes: 'Bottes Obsidiennes' }, { name: 'Marteau Obsidien', elem: 'force', kind: 'marteau' }, ['obsidiantre']),
  ];
  const SET_BY_ID = Object.fromEntries(SETS.map((s) => [s.id, s]));
  const SET_OF_MONSTER = {};
  for (const s of SETS) for (const mid of s.monsters) SET_OF_MONSTER[mid] = s;

  // Formes d'armes : portée (px), cadence (s), facteur de dégâts
  const WEAPONS = {
    marteau: { label: 'Marteau', range: 90, cd: 1.3, k: 1.25, arc: true },
    hache: { label: 'Hache', range: 90, cd: 1.2, k: 1.15, arc: true },
    epee: { label: 'Épée', range: 85, cd: 1.0, k: 1.0, arc: true },
    dague: { label: 'Dague', range: 70, cd: 0.7, k: 0.65 },
    lance: { label: 'Lance', range: 120, cd: 1.1, k: 1.0 },
    baton: { label: 'Bâton', range: 100, cd: 1.0, k: 0.95, arc: true },
    arc: { label: 'Arc', range: 340, cd: 1.0, k: 0.9, shot: true },
  };

  // Profils des pièces : quelles lignes et dans quelles proportions
  const PROFILE = {
    coiffe: { main: 1, vitalite: 1, sagesse: 0.5 },
    cape: { main: 1, vitalite: 0.8, puissance: 0.6 },
    amulette: { main: 0.9, vitalite: 0.7, critique: 1 },
    anneau: { main: 0.8, dommages: 1, critique: 0.6 },
    ceinture: { main: 0.6, vitalite: 1.2, resistance: 1 },
    bottes: { main: 0.9, vitalite: 0.7, vitesse: 1 },
    arme: { main: 0.6, critique: 0.8 },
  };
  /** Plage [min, max] d'une ligne pour un objet de niveau lvl. */
  function lineRange(line, lvl, f) {
    let base;
    switch (line) {
      case 'vitalite': base = 8 + lvl * 1.3; break;
      case 'sagesse': base = 3 + lvl * 0.22; break;
      case 'puissance': base = 2 + lvl * 0.2; break;
      case 'dommages': base = 1 + lvl * 0.07; break;
      case 'critique': base = 1 + lvl * 0.015; break;
      case 'resistance': base = 1 + lvl * 0.02; break;
      case 'vitesse': base = 1 + lvl * 0.015; break;
      case 'pa': base = 2 + lvl * 0.02; break;
      case 'prospection': base = 2 + lvl * 0.15; break;
      default: base = 4 + lvl * 0.5;   // caractéristique élémentaire
    }
    base *= f;
    return [Math.max(1, Math.round(base * 0.7)), Math.max(1, Math.round(base))];
  }

  /** Modèle (gabarit) d'une pièce : ses lignes et leurs plages. */
  function template(set, type) {
    const prof = PROFILE[type], lines = {};
    const [main, second] = set.stats;
    for (const k in prof) {
      if (k === 'main') {
        lines[main] = lineRange(main, set.lvl, prof.main);
        if (second && second !== main) lines[second] = lineRange(second, set.lvl, prof.main * 0.6);
      } else if (!lines[k]) lines[k] = lineRange(k, set.lvl, prof[k]);
    }
    const name = type === 'arme' ? set.weapon.name : set.pieces[type];
    return { set: set.id, type, name, lvl: set.lvl, lines };
  }

  /** Objet lâché : gabarit + jet aléatoire de chaque ligne + rareté. */
  function roll(set, type, minRarity = 0) {
    const tpl = template(set, type);
    let r = Math.random() * 100, ri = 0;
    for (; ri < RARITY.length - 1; ri++) { if (r < RARITY[ri].w) break; r -= RARITY[ri].w; }
    ri = Math.max(ri, minRarity);
    const rar = RARITY[ri];
    const lines = {};
    for (const k in tpl.lines) {
      const [a, b] = tpl.lines[k];
      lines[k] = Math.max(1, Math.round((a + Math.random() * (b - a)) * rar.mul));
    }
    const it = { id: Math.random().toString(36).slice(2, 10), set: set.id, type, slot: type, name: tpl.name, lvl: tpl.lvl, rarity: rar.id, color: rar.color, lines };
    if (type === 'arme') {
      const w = WEAPONS[set.weapon.kind], base = (6 + set.lvl * 0.9) * w.k;
      it.weapon = { kind: set.weapon.kind, elem: set.weapon.elem, min: Math.round(base * 0.75 * rar.mul), max: Math.round(base * 1.25 * rar.mul) };
    }
    it.elem = mainElem(it);
    it.power = power(it);
    return it;
  }
  /** Élément principal d'un objet (pour le filtre de l'inventaire). */
  function mainElem(it) {
    if (it.weapon) return ELEM_OF[it.weapon.elem];
    let best = null, v = 0;
    for (const k in ELEM_OF) if ((it.lines[k] || 0) > v) { v = it.lines[k]; best = ELEM_OF[k]; }
    if (!best && it.lines.puissance) return 'multi';
    return best || 'neutre';
  }
  function power(it) {
    const W = { vitalite: 0.25, sagesse: 0.5, force: 1, intelligence: 1, chance: 1, agilite: 1, puissance: 1, dommages: 5, critique: 6, resistance: 6, vitesse: 5, pa: 6, prospection: 0.3 };
    let p = 0;
    for (const k in it.lines) p += it.lines[k] * (W[k] || 1);
    if (it.weapon) p += (it.weapon.min + it.weapon.max) * 1.5;
    return Math.round(p);
  }

  /** Butin d'un monstre (null si rien). Les boss lâchent toujours une pièce rare ou mieux. */
  function drop(monsterId, boss, lootMul = 1) {
    const set = SET_OF_MONSTER[monsterId];
    if (!set) return null;
    if (!boss && Math.random() > 0.05 * lootMul) return null;
    const types = [...Object.keys(set.pieces), ...(set.weapon ? ['arme'] : [])];
    return roll(set, types[(Math.random() * types.length) | 0], boss ? 1 : 0);
  }

  // Bonus de panoplie : selon le nombre de pièces portées (2, 3, 4…)
  function setBonus(set, n) {
    if (n < 2) return {};
    const [main, second] = set.stats, k = (n - 1) * (4 + set.lvl * 0.12);
    const b = { [main]: Math.round(k), vitalite: Math.round(k * 1.2) };
    if (second && second !== 'vitalite') b[second] = Math.round(k * 0.6);
    if (n >= 4) b.dommages = Math.round(1 + set.lvl * 0.03 * (n - 3));
    if (n >= 5) b.critique = n - 3;
    return b;
  }

  function lineText(k, v) {
    const L = LINES[k];
    return `${L.minus ? '−' : '+'}${v}${L.pct ? ' %' : ''} ${L.name}`;
  }

  return { SLOTS, TYPE_LABEL, LINES, ELEM_OF, RARITY, SETS, SET_BY_ID, SET_OF_MONSTER, WEAPONS, roll, drop, setBonus, lineText, template };
})();
