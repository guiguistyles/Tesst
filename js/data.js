'use strict';
// Données du jeu : classes, sorts, caractéristiques, monstres, zones (zaaps) et Dofus.
// Les valeurs de vitesse sont en pixels/seconde, les recharges (cd) en secondes.

const GAME_TITLE = 'ZaapSurvie 2.0';
const RUN_DURATION = 600; // 10 minutes
const MAX_PASSIVES = 6;

// ---------------------------------------------------------------- Classes
const CLASSES = {
  iop: {
    name: 'Iop', color: '#d9482b', accent: '#ffcf5a', hat: 'spikes',
    hp: 130, speed: 165, cost: 0,
    desc: 'Guerrier impulsif. Frappe tout ce qui bouge au corps à corps.',
    spells: ['pression', 'epee_celeste', 'colere_iop', 'epee_jugement', 'bond', 'puissance', 'intimidation', 'tempete_puissance'],
  },
  cra: {
    name: 'Crâ', color: '#3f8f4e', accent: '#e8d9a0', hat: 'hood',
    hp: 95, speed: 175, cost: 0,
    desc: 'Archer à distance. Crible les ennemis de flèches.',
    spells: ['fleche_magique', 'fleche_explosive', 'fleche_recul', 'fleche_dispersion', 'fleche_glacee', 'fleche_empoisonnee', 'tir_puissant', 'fleche_harcelante'],
  },
  feca: {
    name: 'Féca', color: '#3a6fc4', accent: '#f2f2f2', hat: 'helm',
    hp: 125, speed: 155, cost: 0,
    desc: 'Protecteur. Glyphes et armures pour tenir la ligne.',
    spells: ['attaque_naturelle', 'bulle', 'glyphe_enflamme', 'armure_terrestre', 'glyphe_immobilisation', 'flamiche', 'glyphe_agressif', 'foudroiement'],
  },
  eniripsa: {
    name: 'Eniripsa', color: '#e07bb5', accent: '#ffffff', hat: 'wings',
    hp: 100, speed: 170, cost: 0,
    desc: 'Soigneuse. Ses mots blessent autant qu’ils guérissent.',
    spells: ['mot_blessant', 'mot_soignant', 'mot_interdit', 'mot_frayeur', 'mot_stimulant', 'mot_prevention', 'mot_epine', 'mot_amitie'],
  },
  sram: {
    name: 'Sram', color: '#5b4a7a', accent: '#d8d0e8', hat: 'skull',
    hp: 100, speed: 185, cost: 0,
    desc: 'Assassin. Pièges, poisons et coups sournois.',
    spells: ['coup_sournois', 'piege_sournois', 'poison_insidieux', 'double', 'piege_masse', 'piege_empoisonne', 'attaque_mortelle', 'peur'],
  },
  xelor: {
    name: 'Xélor', color: '#2d5a8c', accent: '#f0c94a', hat: 'bandage',
    hp: 105, speed: 160, cost: 0,
    desc: 'Maître du temps. Ralentit et punit ses adversaires.',
    spells: ['aiguille', 'ralentissement', 'poussiere_temporelle', 'frappe_xelor', 'sablier_xelor', 'rayon_obscur', 'cadran_xelor', 'fuite'],
  },
  osamodas: {
    name: 'Osamodas', color: '#4e9bb0', accent: '#f6d38a', hat: 'horns',
    hp: 110, speed: 165, cost: 0,
    desc: 'Invocateur. Se bat entouré de ses créatures.',
    spells: ['fouet', 'invoc_bouftou', 'invoc_tofu', 'corbeau_noir', 'invoc_sanglier', 'invoc_craqueleur', 'cri_ours', 'soin_animal'],
  },
  sacrieur: {
    name: 'Sacrieur', color: '#a8202a', accent: '#2b2b2b', hat: 'tattoo',
    hp: 150, speed: 160, cost: 800,
    desc: 'Berserker. Plus il souffre, plus il frappe fort.',
    spells: ['pied_sacrieur', 'assaut', 'absorption', 'attirance', 'epee_volante', 'punition', 'dissolution', 'folie_sanguinaire'],
  },
  enutrof: {
    name: 'Enutrof', color: '#9a7a3a', accent: '#d9d9d9', hat: 'beard',
    hp: 115, speed: 150, cost: 1500,
    desc: 'Chasseur de trésors. Chaque victime rapporte des kamas.',
    spells: ['lancer_pieces', 'pelle_animee', 'pelle_jugement', 'maladresse_masse', 'lancer_pelle', 'pelle_fantomatique', 'remblai', 'force_age'],
  },
  roublard: {
    name: 'Roublard', color: '#c27b2a', accent: '#3a2a1a', hat: 'bandana',
    hp: 105, speed: 175, cost: 2500,
    desc: 'Artificier. Bombes et tromblon pour tout faire sauter.',
    spells: ['tromblon', 'bombe_explosive', 'pulsar', 'kaboom', 'dagues_boomerang', 'arquebuse', 'roublabot', 'botte'],
  },
};

// ---------------------------------------------------------------- Sorts
// type : projectile | melee | nova | aura | orbit | strike | summon | trap | glyph | heal | shield | buff | dash
// up : 4 améliorations (niveaux 2 à 5). m = multiplie, a = ajoute.
// Chaque classe a 8 sorts : le premier est connu d'entrée, les autres arrivent par les cartes de niveau.
// Progressions types, pour les sorts qui n'ont pas de progression propre.
const UP = {
  projectile: [{ d: '+1 projectile', a: { count: 1 } }, { d: '+30% dégâts', m: { dmg: 1.3 } }, { d: '-20% recharge', m: { cd: 0.8 } }, { d: '+1 projectile, +30% dégâts', a: { count: 1 }, m: { dmg: 1.3 } }],
  nova: [{ d: '+30% dégâts', m: { dmg: 1.3 } }, { d: '+20% zone', m: { radius: 1.2 } }, { d: '-25% recharge', m: { cd: 0.75 } }, { d: '+60% dégâts', m: { dmg: 1.6 } }],
  strike: [{ d: '+1 cible', a: { count: 1 } }, { d: '+40% dégâts', m: { dmg: 1.4 } }, { d: '+30% zone', m: { radius: 1.3 } }, { d: '+2 cibles', a: { count: 2 } }],
  trap: [{ d: '+2 pièges max', a: { count: 2 } }, { d: '+40% dégâts', m: { dmg: 1.4 } }, { d: '-25% recharge', m: { cd: 0.75 } }, { d: '+30% zone, +30% dégâts', m: { radius: 1.3, dmg: 1.3 } }],
  glyph: [{ d: '+30% zone', m: { radius: 1.3 } }, { d: '+40% dégâts', m: { dmg: 1.4 } }, { d: '+50% durée', m: { duration: 1.5 } }, { d: '-30% recharge', m: { cd: 0.7 } }],
  aura: [{ d: '+25% zone', m: { radius: 1.25 } }, { d: '+100% dégâts', m: { dmg: 2 } }, { d: 'Ralentit davantage', a: { slow: 0.15 } }, { d: '+25% zone, +50% dégâts', m: { radius: 1.25, dmg: 1.5 } }],
  summon: [{ d: '+40% dégâts', m: { dmg: 1.4 } }, { d: '+1 invocation', a: { count: 1 } }, { d: '+30% vitesse', m: { speed: 1.3 } }, { d: '+1 invocation, +30% dégâts', a: { count: 1 }, m: { dmg: 1.3 } }],
  orbit: [{ d: '+1 lame', a: { count: 1 } }, { d: '+40% dégâts', m: { dmg: 1.4 } }, { d: '+20% rayon, +25% vitesse', m: { radius: 1.2, speed: 1.25 } }, { d: '+2 lames', a: { count: 2 } }],
  heal: [{ d: '+4 soins', a: { heal: 4 } }, { d: '-20% recharge', m: { cd: 0.8 } }, { d: '+6 soins', a: { heal: 6 } }, { d: 'Soins doublés', m: { heal: 2 } }],
  shield: [{ d: '+15 bouclier', a: { shield: 15 } }, { d: '-20% recharge', m: { cd: 0.8 } }, { d: '+20 bouclier', a: { shield: 20 } }, { d: 'Bouclier doublé', m: { shield: 2 } }],
  buff: [{ d: '+2 s de durée', a: { dur: 2 } }, { d: '+15% de bonus', a: { pow: 0.15 } }, { d: '-25% recharge', m: { cd: 0.75 } }, { d: '+3 s, +15% de bonus', a: { dur: 3, pow: 0.15 } }],
  dash: [{ d: '+40% dégâts', m: { dmg: 1.4 } }, { d: '+30% zone', m: { radius: 1.3 } }, { d: '-25% recharge', m: { cd: 0.75 } }, { d: '+60% dégâts', m: { dmg: 1.6 } }],
  melee: [{ d: '+30% dégâts', m: { dmg: 1.3 } }, { d: '+25% portée', m: { range: 1.25 } }, { d: 'Frappe aussi derrière vous', a: { double: 1 } }, { d: '+50% dégâts', m: { dmg: 1.5 } }],
};

const SPELLS = {
  // Iop
  pression: {
    name: 'Pression', icon: 'Pr', color: '#ffb347', type: 'melee',
    desc: 'Frappe en arc devant vous.',
    base: { dmg: 15, cd: 1.0, range: 75, arc: 2.0, knock: 25 },
    up: [
      { d: '+40% dégâts', m: { dmg: 1.4 } },
      { d: '+25% portée', m: { range: 1.25 } },
      { d: 'Frappe aussi derrière vous', a: { double: 1 } },
      { d: '+50% dégâts, -20% recharge', m: { dmg: 1.5, cd: 0.8 } },
    ],
  },
  epee_celeste: {
    name: 'Épée Céleste', icon: 'EC', color: '#ffe680', type: 'nova',
    desc: 'Onde de choc autour de vous.',
    base: { dmg: 18, cd: 3.0, radius: 95, knock: 30 },
    up: [
      { d: '+30% dégâts', m: { dmg: 1.3 } },
      { d: '+25% zone', m: { radius: 1.25 } },
      { d: '-25% recharge', m: { cd: 0.75 } },
      { d: '+60% dégâts', m: { dmg: 1.6 } },
    ],
  },
  colere_iop: {
    name: 'Colère de Iop', icon: 'Co', color: '#ff5533', type: 'strike',
    desc: 'Une épée géante s’abat sur un ennemi.',
    base: { dmg: 90, cd: 6.0, radius: 75, count: 1, range: 420, delay: 0.7 },
    up: [
      { d: '+1 frappe', a: { count: 1 } },
      { d: '+40% dégâts', m: { dmg: 1.4 } },
      { d: '-20% recharge', m: { cd: 0.8 } },
      { d: '+2 frappes', a: { count: 2 } },
    ],
  },
  epee_jugement: {
    name: 'Épée du Jugement', icon: 'EJ', color: '#c9d6ff', type: 'orbit',
    desc: 'Des épées tournoient autour de vous.',
    base: { dmg: 10, count: 2, radius: 85, speed: 3.2, size: 12 },
    up: [
      { d: '+1 épée', a: { count: 1 } },
      { d: '+40% dégâts', m: { dmg: 1.4 } },
      { d: '+20% rayon, +25% vitesse', m: { radius: 1.2, speed: 1.25 } },
      { d: '+2 épées', a: { count: 2 } },
    ],
  },
  // Crâ
  fleche_magique: {
    name: 'Flèche Magique', icon: 'FM', color: '#8fd3ff', type: 'projectile',
    desc: 'Tire une flèche sur l’ennemi le plus proche.',
    base: { dmg: 12, cd: 0.75, count: 1, pierce: 0, speed: 560, range: 520, size: 5 },
    up: [
      { d: '+1 flèche', a: { count: 1 } },
      { d: '+30% dégâts', m: { dmg: 1.3 } },
      { d: '+1 flèche', a: { count: 1 } },
      { d: 'Transperce 2 ennemis', a: { pierce: 2 } },
    ],
  },
  fleche_explosive: {
    name: 'Flèche Explosive', icon: 'FE', color: '#ff7a2f', type: 'projectile',
    desc: 'Flèche qui explose à l’impact.',
    base: { dmg: 16, cd: 2.2, count: 1, pierce: 0, speed: 400, range: 480, size: 7, explode: 60 },
    up: [
      { d: '+30% zone d’explosion', m: { explode: 1.3 } },
      { d: '+40% dégâts', m: { dmg: 1.4 } },
      { d: '-20% recharge', m: { cd: 0.8 } },
      { d: '+1 flèche', a: { count: 1 } },
    ],
  },
  fleche_recul: {
    name: 'Flèche de Recul', icon: 'FR', color: '#d6f5a0', type: 'projectile',
    desc: 'Flèche perforante qui repousse.',
    base: { dmg: 10, cd: 1.8, count: 1, pierce: 5, speed: 640, range: 520, size: 6, knock: 110 },
    up: [
      { d: '+30% dégâts', m: { dmg: 1.3 } },
      { d: '+1 flèche', a: { count: 1 } },
      { d: 'Transperce +5', a: { pierce: 5 } },
      { d: '+50% dégâts', m: { dmg: 1.5 } },
    ],
  },
  fleche_dispersion: {
    name: 'Flèche de Dispersion', icon: 'FD', color: '#b6e3ff', type: 'strike',
    desc: 'Des flèches tombent sur plusieurs ennemis.',
    base: { dmg: 28, cd: 3.5, radius: 45, count: 4, range: 380, delay: 0.45 },
    up: [
      { d: '+2 cibles', a: { count: 2 } },
      { d: '+30% dégâts', m: { dmg: 1.3 } },
      { d: '+30% zone', m: { radius: 1.3 } },
      { d: '+3 cibles, -15% recharge', a: { count: 3 }, m: { cd: 0.85 } },
    ],
  },
  // Féca
  bulle: {
    name: 'Bulle', icon: 'Bu', color: '#7fc8ff', type: 'projectile',
    desc: 'Une bulle qui éclate sur l’ennemi.',
    base: { dmg: 13, cd: 0.95, count: 1, pierce: 0, speed: 330, range: 450, size: 8, explode: 40 },
    up: [
      { d: '+30% dégâts', m: { dmg: 1.3 } },
      { d: '+1 bulle', a: { count: 1 } },
      { d: '+40% explosion', m: { explode: 1.4 } },
      { d: '+1 bulle, +30% dégâts', a: { count: 1 }, m: { dmg: 1.3 } },
    ],
  },
  glyphe_enflamme: {
    name: 'Glyphe Enflammé', icon: 'GE', color: '#ff8a3d', type: 'glyph',
    desc: 'Pose un glyphe brûlant sous vos pieds.',
    base: { dmg: 7, cd: 4.0, radius: 85, duration: 3.5, tick: 0.4 },
    up: [
      { d: '+30% zone', m: { radius: 1.3 } },
      { d: '+40% dégâts', m: { dmg: 1.4 } },
      { d: '+50% durée', m: { duration: 1.5 } },
      { d: '-30% recharge', m: { cd: 0.7 } },
    ],
  },
  armure_terrestre: {
    name: 'Armure Terrestre', icon: 'AT', color: '#c49a5a', type: 'shield',
    desc: 'Un bouclier absorbe les dégâts.',
    base: { shield: 25, cd: 9.0 },
    up: [
      { d: '+15 bouclier', a: { shield: 15 } },
      { d: '-20% recharge', m: { cd: 0.8 } },
      { d: '+20 bouclier', a: { shield: 20 } },
      { d: 'Bouclier doublé', m: { shield: 2 } },
    ],
  },
  glyphe_immobilisation: {
    name: 'Glyphe d’Immobilisation', icon: 'GI', color: '#e8e2ff', type: 'aura',
    desc: 'Zone permanente qui ralentit et blesse.',
    base: { dmg: 3, tick: 0.5, radius: 95, slow: 0.3 },
    up: [
      { d: '+25% zone', m: { radius: 1.25 } },
      { d: '+100% dégâts', m: { dmg: 2 } },
      { d: 'Ralentit davantage', a: { slow: 0.15 } },
      { d: '+25% zone, +50% dégâts', m: { radius: 1.25, dmg: 1.5 } },
    ],
  },
  // Eniripsa
  mot_blessant: {
    name: 'Mot Blessant', icon: 'MB', color: '#ff9ad5', type: 'projectile',
    desc: 'Un mot qui fait mal.',
    base: { dmg: 12, cd: 0.85, count: 1, pierce: 1, speed: 480, range: 500, size: 6 },
    up: [
      { d: '+1 projectile', a: { count: 1 } },
      { d: '+30% dégâts', m: { dmg: 1.3 } },
      { d: 'Transperce +2', a: { pierce: 2 } },
      { d: '+1 projectile, +30% dégâts', a: { count: 1 }, m: { dmg: 1.3 } },
    ],
  },
  mot_soignant: {
    name: 'Mot Soignant', icon: 'MS', color: '#9cffb0', type: 'heal',
    desc: 'Rend régulièrement des points de vie.',
    base: { heal: 6, cd: 5.0 },
    up: [
      { d: '+4 soins', a: { heal: 4 } },
      { d: '-20% recharge', m: { cd: 0.8 } },
      { d: '+6 soins', a: { heal: 6 } },
      { d: 'Soins doublés', m: { heal: 2 } },
    ],
  },
  mot_interdit: {
    name: 'Mot Interdit', icon: 'MI', color: '#ff5fa2', type: 'nova',
    desc: 'Explosion de magie autour de vous.',
    base: { dmg: 22, cd: 3.2, radius: 110, knock: 20 },
    up: [
      { d: '+30% dégâts', m: { dmg: 1.3 } },
      { d: '+20% zone', m: { radius: 1.2 } },
      { d: '-25% recharge', m: { cd: 0.75 } },
      { d: '+60% dégâts', m: { dmg: 1.6 } },
    ],
  },
  mot_frayeur: {
    name: 'Mot de Frayeur', icon: 'MF', color: '#e0c3ff', type: 'nova',
    desc: 'Repousse violemment les ennemis.',
    base: { dmg: 8, cd: 5.0, radius: 140, knock: 160 },
    up: [
      { d: '+25% zone', m: { radius: 1.25 } },
      { d: '-20% recharge', m: { cd: 0.8 } },
      { d: '+100% dégâts', m: { dmg: 2 } },
      { d: 'Recul +50%', m: { knock: 1.5 } },
    ],
  },
  // Sram
  piege_sournois: {
    name: 'Piège Sournois', icon: 'PS', color: '#b07cff', type: 'trap',
    desc: 'Pose des pièges qui explosent au contact.',
    base: { dmg: 32, cd: 1.4, count: 3, radius: 60, life: 15 },
    up: [
      { d: '+2 pièges max', a: { count: 2 } },
      { d: '+40% dégâts', m: { dmg: 1.4 } },
      { d: '-25% recharge', m: { cd: 0.75 } },
      { d: '+30% zone, +30% dégâts', m: { radius: 1.3, dmg: 1.3 } },
    ],
  },
  coup_sournois: {
    name: 'Coup Sournois', icon: 'CS', color: '#d0b0ff', type: 'melee',
    desc: 'Coup rapide avec de fortes chances de critique.',
    base: { dmg: 14, cd: 0.7, range: 60, arc: 1.5, knock: 10, crit: 0.25 },
    up: [
      { d: '+30% dégâts', m: { dmg: 1.3 } },
      { d: '+15% critique', a: { crit: 0.15 } },
      { d: '-20% recharge', m: { cd: 0.8 } },
      { d: 'Frappe aussi derrière vous', a: { double: 1 } },
    ],
  },
  poison_insidieux: {
    name: 'Poison Insidieux', icon: 'PI', color: '#7dff6a', type: 'projectile',
    desc: 'Dague empoisonnée : dégâts sur la durée.',
    base: { dmg: 4, cd: 1.3, count: 2, pierce: 0, speed: 500, range: 480, size: 5, poison: 8, poisonDur: 3 },
    up: [
      { d: '+1 dague', a: { count: 1 } },
      { d: 'Poison +50%', m: { poison: 1.5 } },
      { d: 'Poison dure +2s', a: { poisonDur: 2 } },
      { d: '+2 dagues', a: { count: 2 } },
    ],
  },
  double: {
    name: 'Double', icon: 'Do', color: '#8a6bb8', type: 'summon',
    desc: 'Invoque votre double qui attaque les ennemis.',
    base: { dmg: 12, count: 1, speed: 230, size: 12 },
    up: [
      { d: '+40% dégâts', m: { dmg: 1.4 } },
      { d: '+1 double', a: { count: 1 } },
      { d: '+30% vitesse', m: { speed: 1.3 } },
      { d: '+1 double, +30% dégâts', a: { count: 1 }, m: { dmg: 1.3 } },
    ],
  },
  // Xélor
  aiguille: {
    name: 'Aiguille', icon: 'Ai', color: '#ffd84a', type: 'projectile',
    desc: 'Lance des aiguilles rapides.',
    base: { dmg: 11, cd: 0.65, count: 1, pierce: 0, speed: 620, range: 520, size: 4 },
    up: [
      { d: '+1 aiguille', a: { count: 1 } },
      { d: '+30% dégâts', m: { dmg: 1.3 } },
      { d: '-20% recharge', m: { cd: 0.8 } },
      { d: '+2 aiguilles', a: { count: 2 } },
    ],
  },
  ralentissement: {
    name: 'Ralentissement', icon: 'Ra', color: '#9ab8ff', type: 'aura',
    desc: 'Les ennemis proches sont ralentis.',
    base: { dmg: 2, tick: 0.5, radius: 115, slow: 0.45 },
    up: [
      { d: '+25% zone', m: { radius: 1.25 } },
      { d: 'Ralentit davantage', a: { slow: 0.15 } },
      { d: '+150% dégâts', m: { dmg: 2.5 } },
      { d: '+25% zone', m: { radius: 1.25 } },
    ],
  },
  poussiere_temporelle: {
    name: 'Poussière Temporelle', icon: 'PT', color: '#f0e0a0', type: 'nova',
    desc: 'Onde temporelle autour de vous.',
    base: { dmg: 20, cd: 2.8, radius: 100, knock: 15 },
    up: [
      { d: '+30% dégâts', m: { dmg: 1.3 } },
      { d: '+20% zone', m: { radius: 1.2 } },
      { d: '-25% recharge', m: { cd: 0.75 } },
      { d: '+60% dégâts', m: { dmg: 1.6 } },
    ],
  },
  frappe_xelor: {
    name: 'Frappe de Xélor', icon: 'FX', color: '#ffe066', type: 'strike',
    desc: 'L’aiguille du cadran frappe des ennemis.',
    base: { dmg: 40, cd: 3.0, radius: 50, count: 2, range: 380, delay: 0.5 },
    up: [
      { d: '+1 cible', a: { count: 1 } },
      { d: '+40% dégâts', m: { dmg: 1.4 } },
      { d: '+2 cibles', a: { count: 2 } },
      { d: '-25% recharge', m: { cd: 0.75 } },
    ],
  },
  // Osamodas
  fouet: {
    name: 'Fouet', icon: 'Fo', color: '#f6d38a', type: 'melee',
    desc: 'Coup de fouet à longue portée.',
    base: { dmg: 13, cd: 1.0, range: 95, arc: 1.2, knock: 30 },
    up: [
      { d: '+30% dégâts', m: { dmg: 1.3 } },
      { d: '+25% portée', m: { range: 1.25 } },
      { d: 'Frappe aussi derrière vous', a: { double: 1 } },
      { d: '+50% dégâts', m: { dmg: 1.5 } },
    ],
  },
  invoc_bouftou: {
    name: 'Invocation de Bouftou', icon: 'IB', color: '#f2efe6', type: 'summon', look: 'sheep',
    desc: 'Un bouftou fidèle charge vos ennemis.',
    base: { dmg: 12, count: 1, speed: 190, size: 13 },
    up: [
      { d: '+1 bouftou', a: { count: 1 } },
      { d: '+40% dégâts', m: { dmg: 1.4 } },
      { d: '+1 bouftou', a: { count: 1 } },
      { d: '+50% dégâts', m: { dmg: 1.5 } },
    ],
  },
  invoc_tofu: {
    name: 'Invocation de Tofu', icon: 'IT', color: '#ffd23f', type: 'summon', look: 'bird',
    desc: 'Des tofus rapides harcèlent vos ennemis.',
    base: { dmg: 6, count: 2, speed: 280, size: 9 },
    up: [
      { d: '+1 tofu', a: { count: 1 } },
      { d: '+40% dégâts', m: { dmg: 1.4 } },
      { d: '+2 tofus', a: { count: 2 } },
      { d: '+50% dégâts', m: { dmg: 1.5 } },
    ],
  },
  corbeau_noir: {
    name: 'Corbeau Noir', icon: 'CN', color: '#5a5a7a', type: 'projectile',
    desc: 'Un corbeau fond sur les ennemis.',
    base: { dmg: 15, cd: 1.5, count: 1, pierce: 2, speed: 450, range: 500, size: 7 },
    up: [
      { d: '+1 corbeau', a: { count: 1 } },
      { d: '+30% dégâts', m: { dmg: 1.3 } },
      { d: 'Transperce +3', a: { pierce: 3 } },
      { d: '+1 corbeau', a: { count: 1 } },
    ],
  },
  // Sacrieur
  pied_sacrieur: {
    name: 'Pied du Sacrieur', icon: 'PS', color: '#ff3b3b', type: 'melee',
    desc: 'Plus vous êtes blessé, plus il fait mal.',
    base: { dmg: 16, cd: 0.9, range: 70, arc: 2.4, knock: 20, rage: 1 },
    up: [
      { d: '+30% dégâts', m: { dmg: 1.3 } },
      { d: '+20% portée', m: { range: 1.2 } },
      { d: 'Frappe aussi derrière vous', a: { double: 1 } },
      { d: '+50% dégâts', m: { dmg: 1.5 } },
    ],
  },
  assaut: {
    name: 'Assaut', icon: 'As', color: '#ff7070', type: 'nova',
    desc: 'Déchaîne votre sang autour de vous.',
    base: { dmg: 16, cd: 2.4, radius: 85, knock: 25, rage: 1 },
    up: [
      { d: '+30% dégâts', m: { dmg: 1.3 } },
      { d: '+25% zone', m: { radius: 1.25 } },
      { d: '-20% recharge', m: { cd: 0.8 } },
      { d: '+50% dégâts', m: { dmg: 1.5 } },
    ],
  },
  absorption: {
    name: 'Absorption', icon: 'Ab', color: '#ff9a9a', type: 'heal',
    desc: 'Récupère de la vie périodiquement.',
    base: { heal: 5, cd: 4.0 },
    up: [
      { d: '+4 soins', a: { heal: 4 } },
      { d: '-20% recharge', m: { cd: 0.8 } },
      { d: '+6 soins', a: { heal: 6 } },
      { d: 'Soins doublés', m: { heal: 2 } },
    ],
  },
  attirance: {
    name: 'Attirance', icon: 'At', color: '#c04050', type: 'nova',
    desc: 'Attire les ennemis lointains vers vous.',
    base: { dmg: 8, cd: 4.5, radius: 230, knock: -90 },
    up: [
      { d: '+20% zone', m: { radius: 1.2 } },
      { d: '+100% dégâts', m: { dmg: 2 } },
      { d: '-20% recharge', m: { cd: 0.8 } },
      { d: '+100% dégâts', m: { dmg: 2 } },
    ],
  },
  // Enutrof
  lancer_pieces: {
    name: 'Lancer de Pièces', icon: 'LP', color: '#ffd700', type: 'projectile',
    desc: 'Les ennemis tués lâchent toujours des kamas.',
    base: { dmg: 12, cd: 0.8, count: 1, pierce: 0, speed: 500, range: 500, size: 6, gold: 1 },
    up: [
      { d: '+1 pièce', a: { count: 1 } },
      { d: '+30% dégâts', m: { dmg: 1.3 } },
      { d: '+1 pièce', a: { count: 1 } },
      { d: 'Transperce +2', a: { pierce: 2 } },
    ],
  },
  pelle_animee: {
    name: 'Pelle Animée', icon: 'PA', color: '#b08a50', type: 'summon', look: 'shovel',
    desc: 'Une pelle vivante combat à vos côtés.',
    base: { dmg: 14, count: 1, speed: 200, size: 11 },
    up: [
      { d: '+40% dégâts', m: { dmg: 1.4 } },
      { d: '+1 pelle', a: { count: 1 } },
      { d: '+30% vitesse', m: { speed: 1.3 } },
      { d: '+1 pelle', a: { count: 1 } },
    ],
  },
  pelle_jugement: {
    name: 'Pelle du Jugement', icon: 'PJ', color: '#e0b060', type: 'nova',
    desc: 'Coup de pelle circulaire.',
    base: { dmg: 20, cd: 2.8, radius: 90, knock: 30 },
    up: [
      { d: '+30% dégâts', m: { dmg: 1.3 } },
      { d: '+25% zone', m: { radius: 1.25 } },
      { d: '-25% recharge', m: { cd: 0.75 } },
      { d: '+50% dégâts', m: { dmg: 1.5 } },
    ],
  },
  maladresse_masse: {
    name: 'Maladresse de Masse', icon: 'MM', color: '#a0ff70', type: 'aura',
    desc: 'Aura qui ronge et ralentit les ennemis.',
    base: { dmg: 4, tick: 0.5, radius: 90, slow: 0.2 },
    up: [
      { d: '+25% zone', m: { radius: 1.25 } },
      { d: '+100% dégâts', m: { dmg: 2 } },
      { d: 'Ralentit davantage', a: { slow: 0.15 } },
      { d: '+50% dégâts', m: { dmg: 1.5 } },
    ],
  },
  // Roublard
  bombe_explosive: {
    name: 'Bombe Explosive', icon: 'BE', color: '#ff6a2a', type: 'trap',
    desc: 'Pose des bombes qui explosent à retardement.',
    base: { dmg: 30, cd: 1.6, count: 3, radius: 75, life: 2.2, fuse: 1 },
    up: [
      { d: '+30% zone', m: { radius: 1.3 } },
      { d: '+40% dégâts', m: { dmg: 1.4 } },
      { d: '+2 bombes max, -20% recharge', a: { count: 2 }, m: { cd: 0.8 } },
      { d: '+50% dégâts', m: { dmg: 1.5 } },
    ],
  },
  tromblon: {
    name: 'Tromblon', icon: 'Tr', color: '#ffcc80', type: 'projectile',
    desc: 'Tir en éventail à courte portée.',
    base: { dmg: 9, cd: 1.1, count: 3, pierce: 0, speed: 520, range: 320, size: 4, spread: 0.55 },
    up: [
      { d: '+2 plombs', a: { count: 2 } },
      { d: '+30% dégâts', m: { dmg: 1.3 } },
      { d: 'Transperce 1', a: { pierce: 1 } },
      { d: '+2 plombs, +30% dégâts', a: { count: 2 }, m: { dmg: 1.3 } },
    ],
  },
  pulsar: {
    name: 'Pulsar', icon: 'Pu', color: '#ffa040', type: 'nova',
    desc: 'Explosion autour de vous.',
    base: { dmg: 20, cd: 3.0, radius: 100, knock: 40 },
    up: [
      { d: '+30% dégâts', m: { dmg: 1.3 } },
      { d: '+20% zone', m: { radius: 1.2 } },
      { d: '-25% recharge', m: { cd: 0.75 } },
      { d: '+60% dégâts', m: { dmg: 1.6 } },
    ],
  },
  kaboom: {
    name: 'Kaboom', icon: 'Kb', color: '#ff3d00', type: 'strike',
    desc: 'Des explosions frappent les ennemis.',
    base: { dmg: 45, cd: 4.0, radius: 70, count: 2, range: 400, delay: 0.6 },
    up: [
      { d: '+1 explosion', a: { count: 1 } },
      { d: '+40% dégâts', m: { dmg: 1.4 } },
      { d: '+30% zone', m: { radius: 1.3 } },
      { d: '+2 explosions', a: { count: 2 } },
    ],
  },

  // ------------------------------------------------ Sorts ajoutés (8 par classe)
  // buff : pow = bonus de dégâts, spd = bonus de vitesse, dur = durée (s).
  // dash : bond vers le groupe d'ennemis le plus proche, dégâts en zone à l'arrivée.
  // Iop
  bond: { name: 'Bond', icon: 'Bo', color: '#ffa94d', type: 'dash', desc: 'Bondit au milieu des ennemis et les écrase.', base: { dmg: 26, cd: 5, radius: 80, range: 260, knock: 40 }, up: UP.dash },
  puissance: { name: 'Puissance', icon: 'Pu', color: '#ff6b3d', type: 'buff', desc: 'Gonfle vos dégâts pendant quelques secondes.', base: { pow: 0.35, dur: 4, cd: 12 }, up: UP.buff },
  intimidation: { name: 'Intimidation', icon: 'In', color: '#ffd0a0', type: 'nova', desc: 'Un cri qui repousse les ennemis proches.', base: { dmg: 10, cd: 4, radius: 90, knock: 140 }, up: UP.nova },
  tempete_puissance: { name: 'Tempête de Puissance', icon: 'TP', color: '#ffe14d', type: 'strike', desc: 'Des éclairs frappent les ennemis autour de vous.', base: { dmg: 30, cd: 2.6, radius: 40, count: 3, range: 320, delay: 0.25 }, up: UP.strike },
  // Crâ
  fleche_glacee: { name: 'Flèche Glacée', icon: 'FG', color: '#a8e6ff', type: 'projectile', desc: 'Flèche qui ralentit sa cible.', base: { dmg: 11, cd: 1.4, count: 1, pierce: 1, speed: 520, range: 520, size: 6, slow: 0.5 }, up: UP.projectile },
  fleche_empoisonnee: { name: 'Flèche Empoisonnée', icon: 'FP', color: '#8dff6a', type: 'projectile', desc: 'Empoisonne : dégâts sur la durée.', base: { dmg: 5, cd: 1.6, count: 1, pierce: 0, speed: 520, range: 520, size: 5, poison: 10, poisonDur: 3 }, up: UP.projectile },
  tir_puissant: { name: 'Tir Puissant', icon: 'TP', color: '#ffb84d', type: 'buff', desc: 'Concentration : +dégâts pendant quelques secondes.', base: { pow: 0.4, dur: 4, cd: 13 }, up: UP.buff },
  fleche_harcelante: { name: 'Flèche Harcelante', icon: 'FH', color: '#d9f7ff', type: 'projectile', desc: 'Petites flèches tirées en rafale.', base: { dmg: 6, cd: 0.45, count: 1, pierce: 0, speed: 700, range: 480, size: 3 }, up: UP.projectile },
  // Féca
  attaque_naturelle: { name: 'Attaque Naturelle', icon: 'AN', color: '#9ef01a', type: 'projectile', desc: 'Volée de pétales qui explosent à l’impact.', base: { dmg: 11, cd: 1.1, count: 2, pierce: 0, speed: 420, range: 460, size: 6, explode: 32 }, up: UP.projectile },
  flamiche: { name: 'Flamiche', icon: 'Fl', color: '#ff7b2f', type: 'projectile', desc: 'Petite flamme rapide.', base: { dmg: 9, cd: 0.6, count: 1, pierce: 0, speed: 600, range: 460, size: 4 }, up: UP.projectile },
  glyphe_agressif: { name: 'Glyphe Agressif', icon: 'GA', color: '#ff4f6d', type: 'glyph', desc: 'Glyphe court mais très douloureux.', base: { dmg: 14, cd: 6, radius: 70, duration: 2.5, tick: 0.35 }, up: UP.glyph },
  foudroiement: { name: 'Foudroiement', icon: 'Fo', color: '#c7b8ff', type: 'strike', desc: 'La foudre tombe sur un groupe d’ennemis.', base: { dmg: 55, cd: 5, radius: 70, count: 1, range: 400, delay: 0.5 }, up: UP.strike },
  // Eniripsa
  mot_stimulant: { name: 'Mot Stimulant', icon: 'St', color: '#ffc4ec', type: 'buff', desc: '+dégâts et +vitesse pendant quelques secondes.', base: { pow: 0.25, spd: 0.15, dur: 4, cd: 12 }, up: UP.buff },
  mot_prevention: { name: 'Mot de Prévention', icon: 'Pv', color: '#d6f5ff', type: 'shield', desc: 'Un bouclier préventif.', base: { shield: 20, cd: 8 }, up: UP.shield },
  mot_epine: { name: 'Mot d’Épine', icon: 'Ep', color: '#b6ff9a', type: 'aura', desc: 'Les ennemis proches se piquent à vos épines.', base: { dmg: 4, tick: 0.5, radius: 80, slow: 0 }, up: UP.aura },
  mot_amitie: { name: 'Mot d’Amitié', icon: 'Am', color: '#ffd6f0', type: 'summon', look: 'jelly', desc: 'Un petit compagnon fidèle attaque vos ennemis.', base: { dmg: 9, count: 1, speed: 220, size: 10 }, up: UP.summon },
  // Sram
  piege_masse: { name: 'Piège de Masse', icon: 'PM', color: '#c08bff', type: 'trap', desc: 'Grand piège qui explose sur une large zone.', base: { dmg: 26, cd: 2.4, count: 2, radius: 95, life: 15 }, up: UP.trap },
  piege_empoisonne: { name: 'Piège Empoisonné', icon: 'PE', color: '#86ff5a', type: 'glyph', desc: 'Une flaque de poison sous vos pieds.', base: { dmg: 6, cd: 4.5, radius: 75, duration: 4, tick: 0.4 }, up: UP.glyph },
  attaque_mortelle: { name: 'Attaque Mortelle', icon: 'AM', color: '#e05cff', type: 'strike', desc: 'Frappe dévastatrice sur un ennemi.', base: { dmg: 120, cd: 6, radius: 35, count: 1, range: 360, delay: 0.3 }, up: UP.strike },
  peur: { name: 'Peur', icon: 'Pe', color: '#9a7ac8', type: 'nova', desc: 'Fait fuir les ennemis proches.', base: { dmg: 6, cd: 5, radius: 120, knock: 170 }, up: UP.nova },
  // Xélor
  sablier_xelor: { name: 'Sablier de Xélor', icon: 'SX', color: '#ffe9a0', type: 'projectile', desc: 'Sablier qui ralentit et blesse.', base: { dmg: 16, cd: 1.8, count: 1, pierce: 1, speed: 380, range: 480, size: 8, slow: 0.4 }, up: UP.projectile },
  rayon_obscur: { name: 'Rayon Obscur', icon: 'RO', color: '#7b6cff', type: 'projectile', desc: 'Rayon qui transperce tout sur son passage.', base: { dmg: 20, cd: 2.4, count: 1, pierce: 8, speed: 900, range: 560, size: 6 }, up: UP.projectile },
  cadran_xelor: { name: 'Cadran de Xélor', icon: 'CX', color: '#ffd84a', type: 'glyph', desc: 'Un cadran au sol fait tourner le temps contre vos ennemis.', base: { dmg: 8, cd: 6, radius: 95, duration: 4, tick: 0.5 }, up: UP.glyph },
  fuite: { name: 'Fuite', icon: 'Fu', color: '#c9e4ff', type: 'buff', desc: 'Accélère vos déplacements un court instant.', base: { pow: 0, spd: 0.35, dur: 3, cd: 9 }, up: [{ d: '+2 s de durée', a: { dur: 2 } }, { d: '+15% vitesse', a: { spd: 0.15 } }, { d: '-25% recharge', m: { cd: 0.75 } }, { d: '+20% dégâts pendant la fuite', a: { pow: 0.2 } }] },
  // Osamodas
  invoc_sanglier: { name: 'Invocation de Sanglier', icon: 'IS', color: '#7a5236', type: 'summon', look: 'boar', desc: 'Un sanglier robuste fonce dans la mêlée.', base: { dmg: 18, count: 1, speed: 170, size: 14 }, up: UP.summon },
  invoc_craqueleur: { name: 'Invocation de Craqueleur', icon: 'IC', color: '#8a8a8a', type: 'summon', look: 'rock', desc: 'Un craqueleur lent mais qui frappe fort.', base: { dmg: 30, count: 1, speed: 120, size: 16 }, up: UP.summon },
  cri_ours: { name: 'Cri de l’Ours', icon: 'CO', color: '#c89a6a', type: 'nova', desc: 'Rugissement qui repousse et blesse.', base: { dmg: 16, cd: 4, radius: 105, knock: 90 }, up: UP.nova },
  soin_animal: { name: 'Soin Animal', icon: 'SA', color: '#9cffb0', type: 'heal', desc: 'Soigne régulièrement.', base: { heal: 6, cd: 5 }, up: UP.heal },
  // Sacrieur
  epee_volante: { name: 'Épée Volante', icon: 'EV', color: '#ff8080', type: 'orbit', desc: 'Des épées de sang tournent autour de vous.', base: { dmg: 12, count: 2, radius: 75, speed: 3.6, size: 11 }, up: UP.orbit },
  punition: { name: 'Punition', icon: 'Pn', color: '#b3001b', type: 'strike', desc: 'Frappe énorme, plus forte quand vous êtes blessé.', base: { dmg: 70, cd: 5, radius: 60, count: 1, range: 300, delay: 0.4, rage: 1 }, up: UP.strike },
  dissolution: { name: 'Dissolution', icon: 'Di', color: '#ff5a5a', type: 'aura', desc: 'Votre sang ronge les ennemis proches.', base: { dmg: 5, tick: 0.5, radius: 75, slow: 0.1, rage: 1 }, up: UP.aura },
  folie_sanguinaire: { name: 'Folie Sanguinaire', icon: 'FS', color: '#ff2a2a', type: 'buff', desc: 'Rage : +dégâts et +vitesse.', base: { pow: 0.3, spd: 0.1, dur: 5, cd: 14 }, up: UP.buff },
  // Enutrof
  lancer_pelle: { name: 'Lancer de Pelle', icon: 'Pl', color: '#c8a060', type: 'projectile', desc: 'Pelle lancée qui traverse les ennemis.', base: { dmg: 18, cd: 1.6, count: 1, pierce: 4, speed: 420, range: 460, size: 8, knock: 40 }, up: UP.projectile },
  pelle_fantomatique: { name: 'Pelle Fantomatique', icon: 'PF', color: '#cfe7ff', type: 'orbit', desc: 'Des pelles spectrales tournent autour de vous.', base: { dmg: 11, count: 2, radius: 80, speed: 2.8, size: 12 }, up: UP.orbit },
  remblai: { name: 'Remblai', icon: 'Re', color: '#a8865a', type: 'nova', desc: 'Soulève la terre tout autour.', base: { dmg: 22, cd: 3.4, radius: 95, knock: 50 }, up: UP.nova },
  force_age: { name: 'Force de l’Âge', icon: 'FA', color: '#e6d39a', type: 'buff', desc: 'L’expérience parle : +dégâts temporaires.', base: { pow: 0.35, dur: 5, cd: 14 }, up: UP.buff },
  // Roublard
  dagues_boomerang: { name: 'Dagues Boomerang', icon: 'DB', color: '#ffd9a0', type: 'projectile', desc: 'Dagues qui transpercent plusieurs ennemis.', base: { dmg: 10, cd: 1.3, count: 2, pierce: 3, speed: 520, range: 420, size: 5 }, up: UP.projectile },
  arquebuse: { name: 'Arquebuse', icon: 'Aq', color: '#ffb366', type: 'projectile', desc: 'Tir lourd à longue portée.', base: { dmg: 42, cd: 2.6, count: 1, pierce: 2, speed: 820, range: 620, size: 6, knock: 60 }, up: UP.projectile },
  roublabot: { name: 'Roublabot', icon: 'Rb', color: '#9aa4b0', type: 'summon', look: 'rock', desc: 'Un petit robot qui cogne pour vous.', base: { dmg: 16, count: 1, speed: 180, size: 13 }, up: UP.summon },
  botte: { name: 'Botte', icon: 'Bt', color: '#d9a066', type: 'melee', desc: 'Coup de pied qui repousse loin.', base: { dmg: 16, cd: 1.6, range: 70, arc: 1.6, knock: 120 }, up: UP.melee },
};

// ---------------------------------------------------------------- Caractéristiques (passifs de partie)
const PASSIVES = {
  vitalite:     { name: 'Vitalité',     icon: '❤', color: '#ff6b6b', desc: '+20% PV max', max: 5 },
  force:        { name: 'Force',        icon: '⚔', color: '#c8763a', desc: '+10% dégâts', max: 5 },
  agilite:      { name: 'Agilité',      icon: '➶', color: '#5fcf6f', desc: '+8% vitesse de déplacement', max: 5 },
  intelligence: { name: 'Intelligence', icon: '✦', color: '#ff8a3d', desc: '+10% taille des zones', max: 5 },
  sagesse:      { name: 'Sagesse',      icon: '✎', color: '#b48cff', desc: '+12% expérience', max: 5 },
  chance:       { name: 'Chance',       icon: '☘', color: '#58b8ff', desc: '+5% coups critiques', max: 5 },
  prospection:  { name: 'Prospection',  icon: '◎', color: '#ffd84a', desc: '+30% de chances d’obtenir des équipements', max: 5 },
  pa:           { name: 'Points d’Action', icon: '★', color: '#4fc3f7', desc: '-7% temps de recharge', max: 5 },
  soin:         { name: 'Soins',        icon: '✚', color: '#7dff9a', desc: '+0,5 PV régénérés/s', max: 5 },
};

// ---------------------------------------------------------------- Monstres
// shape : sheep | bird | larva | spider | bug | boar | tree | skull | rock | penguin | jelly (dessin de repli)
// sprite : planche animée (tools/sprites). Les 9 mondes et leurs monstres reprennent ceux de ZaapRush.
const MONSTERS = {
  // Astrub
  bouftou:      { name: 'Bouftou', hp: 10, speed: 60, dmg: 5, xp: 1, r: 14, shape: 'sheep', body: '#f2efe6', detail: '#6b4a2a', sprite: 'bouftou' },
  tofu:         { name: 'Tofu', hp: 6, speed: 105, dmg: 4, xp: 1, r: 9, shape: 'bird', body: '#ffd23f', detail: '#e07a1f', sprite: 'tofu' },
  piou:         { name: 'Piou Rouge', hp: 7, speed: 90, dmg: 4, xp: 1, r: 9, shape: 'bird', body: '#ff5b5b', detail: '#ffcc33', sprite: 'piou' },
  boufton_noir: { name: 'Boufton Noir', hp: 14, speed: 70, dmg: 6, xp: 2, r: 12, shape: 'sheep', body: '#4a4a52', detail: '#1a1a1e', sprite: 'boufton_noir' },
  tofu_royal:   { name: 'Tofu Royal', hp: 380, speed: 95, dmg: 12, xp: 30, r: 26, shape: 'bird', body: '#ffcc00', detail: '#d06010', boss: 1, sprite: 'tofu_royal' },
  bouftou_royal:{ name: 'Bouftou Royal', hp: 1100, speed: 75, dmg: 18, xp: 80, r: 36, shape: 'sheep', body: '#fffbe8', detail: '#4a2f1a', boss: 2, sprite: 'bouftou_royal' },
  // Île des Wabbits
  wabbit:       { name: 'Wabbit', hp: 14, speed: 95, dmg: 6, xp: 1, r: 12, shape: 'penguin', body: '#f0e8d8', detail: '#ff8a3d' },
  larve_bleue:  { name: 'Larve Bleue', hp: 22, speed: 45, dmg: 7, xp: 2, r: 13, shape: 'larva', body: '#4fa3ff', detail: '#1f5fa8', sprite: 'larve_bleue' },
  moskito:      { name: 'Moskito', hp: 10, speed: 125, dmg: 5, xp: 1, r: 9, shape: 'bug', body: '#8a6a9a', detail: '#e0e0ff' },
  crabe:        { name: 'Crabe', hp: 24, speed: 60, dmg: 8, xp: 2, r: 13, shape: 'spider', body: '#e0533a', detail: '#ffd0b0' },
  black_wabbit: { name: 'Black Wabbit', hp: 741, speed: 100, dmg: 16, xp: 40, r: 26, shape: 'jelly', body: '#2a2a2a', detail: '#ff3030', boss: 1 },
  wa_wabbit:    { name: 'Wa Wabbit', hp: 2150, speed: 80, dmg: 20, xp: 100, r: 36, shape: 'penguin', body: '#e8e0f8', detail: '#8a4ad0', boss: 2 },
  // Forêt des Abraknydes
  arakne:       { name: 'Arakne', hp: 14, speed: 100, dmg: 6, xp: 1, r: 11, shape: 'spider', body: '#3a3a3a', detail: '#d33' },
  abrakne:      { name: 'Abrakne', hp: 20, speed: 95, dmg: 8, xp: 2, r: 12, shape: 'spider', body: '#3f5a2f', detail: '#c8e070' },
  abraknyde:    { name: 'Abraknyde', hp: 40, speed: 50, dmg: 11, xp: 3, r: 16, shape: 'tree', body: '#6a4a2a', detail: '#3f7a2f' },
  abraknyde_sombre: { name: 'Abraknyde Sombre', hp: 48, speed: 55, dmg: 12, xp: 3, r: 16, shape: 'tree', body: '#3a2a1a', detail: '#2a4a2a' },
  abrak_ancestral:{ name: 'Abraknyde Ancestral', hp: 1290, speed: 60, dmg: 22, xp: 60, r: 32, shape: 'tree', body: '#4a321a', detail: '#2f5a1f', boss: 1 },
  chene_mou:    { name: 'Le Chêne Mou', hp: 3730, speed: 45, dmg: 26, xp: 160, r: 46, shape: 'tree', body: '#5a3a1a', detail: '#7aa040', boss: 2 },
  // Litneg (plaines de Cania)
  sanglier:     { name: 'Sanglier des Plaines', hp: 30, speed: 75, dmg: 10, xp: 2, r: 15, shape: 'boar', body: '#7a5236', detail: '#f0e6d0' },
  mulou:        { name: 'Mulou', hp: 36, speed: 90, dmg: 12, xp: 3, r: 15, shape: 'boar', body: '#7a7a82', detail: '#f0f0f0' },
  chafer:       { name: 'Chafer', hp: 28, speed: 85, dmg: 10, xp: 2, r: 12, shape: 'skull', body: '#e8e4d8', detail: '#222' },
  chafer_archer:{ name: 'Chafer Archer', hp: 24, speed: 70, dmg: 9, xp: 3, r: 12, shape: 'skull', body: '#d8d0b8', detail: '#552', ranged: { range: 320, cd: 2.4, speed: 260, color: '#e8e0c0' } },
  kruorre:      { name: 'Kruorre', hp: 1250, speed: 70, dmg: 26, xp: 80, r: 32, shape: 'rock', body: '#8a2a2a', detail: '#ffb060', boss: 1 },
  meulou:       { name: 'Meulou', hp: 3620, speed: 85, dmg: 30, xp: 220, r: 40, shape: 'boar', body: '#5a5a66', detail: '#ffffff', boss: 2 },
  // Montagne des Koalaks
  koalak_immature:{ name: 'Koalak Immature', hp: 40, speed: 70, dmg: 12, xp: 3, r: 13, shape: 'boar', body: '#a0703a', detail: '#f0d8b0' },
  warko_violet: { name: 'Warko Violet', hp: 34, speed: 100, dmg: 11, xp: 3, r: 12, shape: 'bug', body: '#8a4ab0', detail: '#ffd84a' },
  guerrier_koalak:{ name: 'Guerrier Koalak', hp: 60, speed: 65, dmg: 15, xp: 4, r: 15, shape: 'boar', body: '#7a4a2a', detail: '#e0c090', ranged: { range: 280, cd: 2.8, speed: 240, color: '#c08a4a' } },
  momie_koalak: { name: 'Momie Koalak', hp: 70, speed: 50, dmg: 14, xp: 4, r: 14, shape: 'skull', body: '#e0d6b0', detail: '#5a4a2a' },
  koulosse:     { name: 'Koulosse', hp: 2150, speed: 55, dmg: 30, xp: 110, r: 38, shape: 'rock', body: '#8a6a4a', detail: '#3a2a1a', boss: 1 },
  skeunk:       { name: 'Skeunk', hp: 6230, speed: 85, dmg: 34, xp: 280, r: 36, shape: 'jelly', body: '#2f4a2f', detail: '#f0f0f0', boss: 2 },
  // Labyrinthe du Minotoror
  minoskito:    { name: 'Minoskito', hp: 40, speed: 130, dmg: 12, xp: 3, r: 10, shape: 'bug', body: '#5a3a2a', detail: '#ffb0a0' },
  scaratos:     { name: 'Scaratos', hp: 70, speed: 70, dmg: 15, xp: 4, r: 14, shape: 'spider', body: '#2f4a5a', detail: '#9ad0ff' },
  kramelehon:   { name: 'Kramelehon', hp: 60, speed: 60, dmg: 14, xp: 4, r: 14, shape: 'larva', body: '#5aa05a', detail: '#2a5a2a' },
  gamino:       { name: 'Gamino', hp: 90, speed: 75, dmg: 17, xp: 5, r: 15, shape: 'boar', body: '#8a5a3a', detail: '#f0e0c0' },
  minotoror:    { name: 'Minotoror', hp: 2750, speed: 80, dmg: 36, xp: 140, r: 36, shape: 'boar', body: '#6a3a2a', detail: '#e0c8a0', boss: 1 },
  minotot:      { name: 'Minotot', hp: 7970, speed: 80, dmg: 40, xp: 340, r: 44, shape: 'boar', body: '#4a1a1a', detail: '#ffd84a', boss: 2 },
  // Sanctuaire des Dragoeufs
  dragoeuf_dore:{ name: 'Dragoeuf Doré', hp: 80, speed: 85, dmg: 16, xp: 4, r: 12, shape: 'bird', body: '#e8b83a', detail: '#8a5a10' },
  dragoeuf_saphir:{ name: 'Dragoeuf Saphir', hp: 80, speed: 85, dmg: 16, xp: 4, r: 12, shape: 'bird', body: '#3a7ad0', detail: '#d0e8ff' },
  dragoeuf_noir:{ name: 'Dragoeuf Noir', hp: 110, speed: 75, dmg: 19, xp: 5, r: 13, shape: 'bird', body: '#2a2a32', detail: '#ff6a3a' },
  dragoeuf_volant:{ name: 'Dragoeuf Volant', hp: 70, speed: 120, dmg: 15, xp: 5, r: 12, shape: 'bug', body: '#c84a2a', detail: '#ffd84a', ranged: { range: 300, cd: 2.2, speed: 280, color: '#ff8a3a' } },
  ignelicrobur: { name: 'Ignélicrobur', hp: 3590, speed: 90, dmg: 40, xp: 170, r: 34, shape: 'bug', body: '#e0401a', detail: '#ffe060', boss: 1 },
  crocabulia:   { name: 'Crocabulia', hp: 10390, speed: 80, dmg: 46, xp: 420, r: 46, shape: 'boar', body: '#2a5a3a', detail: '#ffcc40', boss: 2 },
  // Sanctuaire de Qu'Tan
  petit_demon:  { name: 'Petit Démon Rapide', hp: 90, speed: 140, dmg: 18, xp: 5, r: 11, shape: 'jelly', body: '#c8303a', detail: '#ffd84a' },
  chafer_maudit:{ name: 'Chafer Maudit', hp: 140, speed: 80, dmg: 22, xp: 6, r: 13, shape: 'skull', body: '#b8a8d8', detail: '#2a1a3a' },
  chafer_archer_maudit:{ name: 'Chafer Archer Maudit', hp: 110, speed: 70, dmg: 20, xp: 6, r: 13, shape: 'skull', body: '#a898c8', detail: '#3a1a4a', ranged: { range: 330, cd: 2.2, speed: 280, color: '#c070ff' } },
  sorcier_demon:{ name: 'Sorcier Démon', hp: 120, speed: 65, dmg: 22, xp: 7, r: 14, shape: 'jelly', body: '#5a2a7a', detail: '#ff70ff', ranged: { range: 320, cd: 2.4, speed: 260, color: '#ff60d0' } },
  chafer_lamicel:{ name: 'Chafer Lamicel', hp: 4830, speed: 85, dmg: 44, xp: 200, r: 32, shape: 'skull', body: '#d8c8ff', detail: '#7a2aff', boss: 1 },
  qutan:        { name: 'Qu’Tan', hp: 13980, speed: 85, dmg: 52, xp: 500, r: 46, shape: 'jelly', body: '#3a1a4a', detail: '#ff3a6a', boss: 2 },
  // Belvédère d'Ilyzaelle
  disciple_turorte:{ name: 'Disciple de Turorte', hp: 130, speed: 85, dmg: 22, xp: 6, r: 13, shape: 'penguin', body: '#f4f0e8', detail: '#d0a020' },
  garde_havou:  { name: 'Garde d’Havou', hp: 200, speed: 60, dmg: 26, xp: 7, r: 16, shape: 'rock', body: '#c8d0e0', detail: '#4a6aa0' },
  tireur_elite: { name: 'Tireur d’Élite', hp: 120, speed: 75, dmg: 22, xp: 7, r: 13, shape: 'penguin', body: '#d8e0f0', detail: '#3a5a8a', ranged: { range: 360, cd: 2, speed: 300, color: '#9ad0ff' } },
  mage_celeste: { name: 'Mage Céleste', hp: 120, speed: 70, dmg: 24, xp: 7, r: 13, shape: 'jelly', body: '#a8d8ff', detail: '#ffffff', ranged: { range: 320, cd: 2.2, speed: 270, color: '#d0f0ff' } },
  palidane:     { name: 'Palidane', hp: 5950, speed: 95, dmg: 48, xp: 230, r: 32, shape: 'penguin', body: '#ffe8a0', detail: '#a07010', boss: 1 },
  ilyzaelle:    { name: 'Ilyzaelle', hp: 17220, speed: 100, dmg: 56, xp: 600, r: 40, shape: 'jelly', body: '#f0f4ff', detail: '#ffcc40', boss: 2 },
};

// ---------------------------------------------------------------- Mondes (zaaps), dans l'ordre de ZaapRush
// Le premier kill du boss final (vague 40) ouvre le monde suivant ; chaque boss final tente le Dofus du monde.
// Chaque monde se rejoue depuis le niveau 1 : hpMul / dmgMul recalent les monstres sur une progression
// d'environ ×1,25 (PV) et ×1,2 (dégâts) par monde.
const ZONES = [
  { id: 'astrub', name: 'Astrub', sub: 'Cité d’Astrub', ground: '#6a9b45', ground2: '#5f8f3e', deco: ['#4b7a30', '#e8d070', '#ff9ab0'], decoType: 'grass',
    monsters: ['bouftou', 'tofu', 'piou', 'boufton_noir'], mini: 'tofu_royal', boss: 'bouftou_royal', hpMul: 1, dmgMul: 1, kamas: 1, dofus: ['dofawa'] },
  { id: 'wabbit', name: 'Île des Wabbits', sub: 'Les terres du Wa Wabbit', ground: '#8fbf5a', ground2: '#84b351', deco: ['#5a8a3a', '#ff8a3d', '#f0e6c0'], decoType: 'field',
    monsters: ['wabbit', 'larve_bleue', 'moskito', 'crabe'], mini: 'black_wabbit', boss: 'wa_wabbit', hpMul: 0.8, dmgMul: 0.92, kamas: 1.4, dofus: ['cawotte'] },
  { id: 'abraknydes', name: 'Forêt des Abraknydes', sub: 'Forêt maléfique', ground: '#3f5a32', ground2: '#36502b', deco: ['#2a3f22', '#5a4a3a', '#7a9a50'], decoType: 'forest',
    monsters: ['arakne', 'abrakne', 'abraknyde', 'abraknyde_sombre'], mini: 'abrak_ancestral', boss: 'chene_mou', hpMul: 0.62, dmgMul: 0.78, kamas: 1.8, dofus: ['turquoise'] },
  { id: 'litneg', name: 'Litneg', sub: 'Plaines de Cania', ground: '#b0a55a', ground2: '#a3984f', deco: ['#8a7a3a', '#d8c870', '#6a8a3a'], decoType: 'field',
    monsters: ['sanglier', 'mulou', 'chafer', 'chafer_archer'], mini: 'kruorre', boss: 'meulou', hpMul: 0.85, dmgMul: 0.84, kamas: 2.3, dofus: ['emeraude'] },
  { id: 'koalaks', name: 'Montagne des Koalaks', sub: 'Canyon sauvage', ground: '#b0704a', ground2: '#a36542', deco: ['#7a4a2a', '#d8a070', '#5a6a3a'], decoType: 'rock',
    monsters: ['koalak_immature', 'warko_violet', 'guerrier_koalak', 'momie_koalak'], mini: 'koulosse', boss: 'skeunk', hpMul: 0.6, dmgMul: 0.77, kamas: 2.8, dofus: ['kaliptus'] },
  { id: 'minotoror', name: 'Labyrinthe du Minotoror', sub: 'Île du Minotoror', ground: '#8a8a7a', ground2: '#7f7f70', deco: ['#5a5a50', '#b0a890', '#4a6a3a'], decoType: 'rock',
    monsters: ['minoskito', 'scaratos', 'kramelehon', 'gamino'], mini: 'minotoror', boss: 'minotot', hpMul: 0.58, dmgMul: 0.83, kamas: 3.4, dofus: ['pourpre'] },
  { id: 'dragoeufs', name: 'Sanctuaire des Dragoeufs', sub: 'Terres volcaniques', ground: '#5a3a2a', ground2: '#503325', deco: ['#3a2418', '#ff7a2a', '#8a5a3a'], decoType: 'rock',
    monsters: ['dragoeuf_dore', 'dragoeuf_saphir', 'dragoeuf_noir', 'dragoeuf_volant'], mini: 'ignelicrobur', boss: 'crocabulia', hpMul: 0.54, dmgMul: 0.9, kamas: 4, dofus: ['vulbis'] },
  { id: 'qutan', name: 'Sanctuaire de Qu’Tan', sub: 'Terres démoniaques', ground: '#3a2a40', ground2: '#332539', deco: ['#241a2a', '#a040c0', '#5a3a5a'], decoType: 'forest',
    monsters: ['petit_demon', 'chafer_maudit', 'chafer_archer_maudit', 'sorcier_demon'], mini: 'chafer_lamicel', boss: 'qutan', hpMul: 0.48, dmgMul: 0.88, kamas: 4.6, dofus: ['ebene'] },
  { id: 'ilyzaelle', name: 'Belvédère d’Ilyzaelle', sub: 'Les hauteurs célestes', ground: '#dfe6f2', ground2: '#d2dbea', deco: ['#a8b8d8', '#ffd84a', '#ffffff'], decoType: 'snow',
    monsters: ['disciple_turorte', 'garde_havou', 'tireur_elite', 'mage_celeste'], mini: 'palidane', boss: 'ilyzaelle', hpMul: 0.46, dmgMul: 0.9, kamas: 5.2, dofus: ['ivoire'] },
];

// ---------------------------------------------------------------- Dofus (bonus permanents, un par monde comme dans ZaapRush)
const DOFUS = {
  dofawa:    { name: 'Dofawa',          color: '#f2d27a', desc: '+12% PV max' },
  cawotte:   { name: 'Dofus Cawotte',   color: '#ff8c1a', desc: '+20% XP' },
  turquoise: { name: 'Dofus Turquoise', color: '#1fc4c4', desc: '+50% dégâts critiques' },
  emeraude:  { name: 'Dofus Émeraude',  color: '#2ecc71', desc: '+35% PV max' },
  kaliptus:  { name: 'Dofus Kaliptus',  color: '#7fbf3f', desc: '+50% de chances d’équipement' },
  pourpre:   { name: 'Dofus Pourpre',   color: '#a2286a', desc: '+25% dégâts' },
  vulbis:    { name: 'Dofus Vulbis',    color: '#b8e0ff', desc: '20% de chances d’avoir 4 cartes, 5% d’esquive' },
  ebene:     { name: 'Dofus Ébène',     color: '#2a2a3a', desc: '+25% dégâts des sorts (hors sort de départ)' },
  ivoire:    { name: 'Dofus Ivoire',    color: '#f4f0e0', desc: '+20% taille des sorts' },
};

// ---------------------------------------------------------------- Équipements (valables pour la partie)
// Lâchés par les monstres listés dans `from` (la Prospection augmente les chances).
// Les objets `rare` tombent à coup sûr sur le boss final de leur zone (et très rarement sur ses monstres).
// Bonus : hp, dmg, speed, xp, area, kamas (en +%), cd (en -% de recharge), crit (en +points), regen (PV/s).
const SLOTS = {
  coiffe: { name: 'Coiffe', icon: '⛑' }, cape: { name: 'Cape', icon: '🧣' }, amulette: { name: 'Amulette', icon: '📿' },
  anneau: { name: 'Anneau', icon: '💍' }, ceinture: { name: 'Ceinture', icon: '🎗' }, bottes: { name: 'Bottes', icon: '👢' },
  arme: { name: 'Arme', icon: '🗡' },
};

const ITEMS = {
  // Astrub — Panoplie du Bouftou
  bouftou_coiffe:    { name: 'Coiffe du Bouftou', slot: 'coiffe', set: 'bouftou', from: ['bouftou'], bonus: { hp: 0.10 } },
  bouftou_cape:      { name: 'Cape du Bouftou', slot: 'cape', set: 'bouftou', from: ['bouftou'], bonus: { dmg: 0.06 } },
  boufbottes:        { name: 'Boufbottes', slot: 'bottes', set: 'bouftou', from: ['bouftou'], bonus: { speed: 0.06 } },
  bouftou_amulette:  { name: 'Amulette du Bouftou', slot: 'amulette', set: 'bouftou', from: ['bouftou'], bonus: { xp: 0.10 } },
  bouftou_ceinture:  { name: 'Ceinture du Bouftou', slot: 'ceinture', set: 'bouftou', from: ['bouftou'], bonus: { regen: 0.3 } },
  bouftou_anneau:    { name: 'Anneau du Bouftou', slot: 'anneau', set: 'bouftou', from: ['bouftou'], bonus: { crit: 0.03 } },
  bouftou_marteau:   { name: 'Marteau du Bouftou', slot: 'arme', set: 'bouftou', from: ['bouftou'], bonus: { dmg: 0.08 } },
  // Astrub — autres monstres
  cape_tofu:         { name: 'Cape du Tofu', slot: 'cape', from: ['tofu'], bonus: { speed: 0.08 } },
  pantoufles_tofu:   { name: 'Pantoufles du Tofu', slot: 'bottes', from: ['tofu'], bonus: { speed: 0.05, crit: 0.02 } },
  coiffe_piou:       { name: 'Coiffe de Piou', slot: 'coiffe', from: ['piou'], bonus: { crit: 0.04 } },
  // Astrub — Panoplie du Bouftou Royal (rare)
  royal_coiffe:      { name: 'Coiffe du Bouftou Royal', slot: 'coiffe', set: 'royal', rare: true, from: ['bouftou'], bonus: { hp: 0.18 } },
  royal_cape:        { name: 'Cape du Bouftou Royal', slot: 'cape', set: 'royal', rare: true, from: ['bouftou'], bonus: { dmg: 0.10 } },
  royal_bottes:      { name: 'Boufbottes Royales', slot: 'bottes', set: 'royal', rare: true, from: ['bouftou'], bonus: { speed: 0.10 } },
  royal_amulette:    { name: 'Amulette du Bouftou Royal', slot: 'amulette', set: 'royal', rare: true, from: ['bouftou'], bonus: { xp: 0.15, dmg: 0.04 } },
  royal_anneau:      { name: 'Anneau du Bouftou Royal', slot: 'anneau', set: 'royal', rare: true, from: ['bouftou'], bonus: { crit: 0.05 } },
  royal_ceinture:    { name: 'Ceinture du Bouftou Royal', slot: 'ceinture', set: 'royal', rare: true, from: ['bouftou'], bonus: { regen: 0.6 } },
  royal_epee:        { name: 'Épée du Bouftou Royal', slot: 'arme', set: 'royal', rare: true, from: ['bouftou'], bonus: { dmg: 0.15 } },
  // Île des Wabbits
  oreilles_wabbit:   { name: 'Oreilles de Wabbit', slot: 'coiffe', from: ['wabbit'], bonus: { speed: 0.06, xp: 0.05 } },
  anneau_larve:      { name: 'Anneau de Larve', slot: 'anneau', from: ['larve_bleue'], bonus: { cd: 0.04 } },
  bottes_moskito:    { name: 'Bottes de Moskito', slot: 'bottes', from: ['moskito'], bonus: { speed: 0.08 } },
  bouclier_crabe:    { name: 'Carapace de Crabe', slot: 'ceinture', from: ['crabe'], bonus: { hp: 0.10 } },
  couronne_wa:       { name: 'Couronne du Wa Wabbit', slot: 'coiffe', rare: true, from: ['wabbit'], bonus: { xp: 0.15, hp: 0.10 } },
  // Forêt des Abraknydes
  anneau_arakne:     { name: 'Anneau d’Arakne', slot: 'anneau', from: ['arakne', 'abrakne'], bonus: { crit: 0.04 } },
  baton_abraknyde:   { name: 'Bâton d’Abraknyde', slot: 'arme', from: ['abraknyde'], bonus: { dmg: 0.10 } },
  cape_sombre:       { name: 'Cape Sombre', slot: 'cape', from: ['abraknyde_sombre'], bonus: { dmg: 0.06, hp: 0.06 } },
  ceinture_ancestrale: { name: 'Ceinture Ancestrale', slot: 'ceinture', rare: true, from: ['abraknyde', 'abraknyde_sombre'], bonus: { regen: 0.8, hp: 0.08 } },
  // Litneg
  cape_sanglier:     { name: 'Cape du Sanglier', slot: 'cape', from: ['sanglier'], bonus: { hp: 0.10, dmg: 0.03 } },
  coiffe_mulou:      { name: 'Coiffe du Mulou', slot: 'coiffe', from: ['mulou'], bonus: { dmg: 0.08 } },
  casque_chafer:     { name: 'Casque du Chafer', slot: 'coiffe', from: ['chafer'], bonus: { hp: 0.12 } },
  arc_chafer:        { name: 'Arc du Chafer Archer', slot: 'arme', from: ['chafer_archer'], bonus: { dmg: 0.08, crit: 0.03 } },
  hache_meulou:      { name: 'Hache du Meulou', slot: 'arme', rare: true, from: ['mulou'], bonus: { dmg: 0.16 } },
  // Montagne des Koalaks
  bottes_koalak:     { name: 'Bottes du Koalak', slot: 'bottes', from: ['koalak_immature'], bonus: { speed: 0.08, hp: 0.04 } },
  amulette_warko:    { name: 'Amulette du Warko', slot: 'amulette', from: ['warko_violet'], bonus: { area: 0.10 } },
  ceinture_koalak:   { name: 'Ceinture du Guerrier Koalak', slot: 'ceinture', from: ['guerrier_koalak'], bonus: { dmg: 0.06, hp: 0.06 } },
  bandelettes:       { name: 'Bandelettes de Momie', slot: 'cape', from: ['momie_koalak'], bonus: { regen: 0.6 } },
  coiffe_skeunk:     { name: 'Coiffe du Skeunk', slot: 'coiffe', rare: true, from: ['koalak_immature', 'guerrier_koalak'], bonus: { dmg: 0.10, crit: 0.04 } },
  // Labyrinthe du Minotoror
  anneau_minoskito:  { name: 'Anneau du Minoskito', slot: 'anneau', from: ['minoskito'], bonus: { crit: 0.05 } },
  carapace_scaratos: { name: 'Carapace du Scaratos', slot: 'cape', from: ['scaratos'], bonus: { hp: 0.14 } },
  amulette_kramelehon:{ name: 'Amulette du Kramelehon', slot: 'amulette', from: ['kramelehon'], bonus: { xp: 0.12, cd: 0.03 } },
  marteau_gamino:    { name: 'Marteau du Gamino', slot: 'arme', from: ['gamino'], bonus: { dmg: 0.12 } },
  cornes_minotot:    { name: 'Cornes du Minotot', slot: 'coiffe', rare: true, from: ['gamino'], bonus: { dmg: 0.14, hp: 0.10 } },
  // Sanctuaire des Dragoeufs
  coquille_doree:    { name: 'Coquille Dorée', slot: 'amulette', from: ['dragoeuf_dore'], bonus: { xp: 0.10, crit: 0.03 } },
  bottes_saphir:     { name: 'Bottes Saphir', slot: 'bottes', from: ['dragoeuf_saphir'], bonus: { speed: 0.10 } },
  cape_dragoeuf:     { name: 'Cape du Dragoeuf Noir', slot: 'cape', from: ['dragoeuf_noir'], bonus: { dmg: 0.10 } },
  aile_volante:      { name: 'Aile de Dragoeuf Volant', slot: 'ceinture', from: ['dragoeuf_volant'], bonus: { cd: 0.05 } },
  croc_crocabulia:   { name: 'Croc de Crocabulia', slot: 'arme', rare: true, from: ['dragoeuf_noir'], bonus: { dmg: 0.18 } },
  // Sanctuaire de Qu'Tan
  anneau_demon:      { name: 'Anneau Démoniaque', slot: 'anneau', from: ['petit_demon'], bonus: { crit: 0.06 } },
  casque_maudit:     { name: 'Casque Maudit', slot: 'coiffe', from: ['chafer_maudit'], bonus: { hp: 0.16 } },
  arc_maudit:        { name: 'Arc Maudit', slot: 'arme', from: ['chafer_archer_maudit'], bonus: { dmg: 0.12, crit: 0.03 } },
  grimoire_demon:    { name: 'Grimoire du Sorcier', slot: 'amulette', from: ['sorcier_demon'], bonus: { area: 0.12, cd: 0.03 } },
  ceinture_qutan:    { name: 'Ceinture de Qu’Tan', slot: 'ceinture', rare: true, from: ['chafer_maudit'], bonus: { dmg: 0.12, regen: 0.8 } },
  // Belvédère d'Ilyzaelle
  cape_turorte:      { name: 'Cape de Turorte', slot: 'cape', from: ['disciple_turorte'], bonus: { hp: 0.12, xp: 0.06 } },
  bouclier_havou:    { name: 'Ceinture d’Havou', slot: 'ceinture', from: ['garde_havou'], bonus: { hp: 0.18 } },
  bottes_elite:      { name: 'Bottes d’Élite', slot: 'bottes', from: ['tireur_elite'], bonus: { speed: 0.10, crit: 0.03 } },
  amulette_celeste:  { name: 'Amulette Céleste', slot: 'amulette', from: ['mage_celeste'], bonus: { area: 0.14 } },
  diademe_ilyzaelle: { name: 'Diadème d’Ilyzaelle', slot: 'coiffe', rare: true, from: ['disciple_turorte'], bonus: { dmg: 0.15, area: 0.10 } },
};

// Bonus de panoplie : débloqués à partir du nombre de pièces indiqué (bonus cumulés).
const SETS = {
  bouftou: { name: 'Panoplie du Bouftou', bonus: { 3: { hp: 0.10 }, 5: { dmg: 0.10 }, 7: { crit: 0.05 } } },
  royal: { name: 'Panoplie du Bouftou Royal', bonus: { 3: { dmg: 0.10 }, 5: { hp: 0.15 }, 7: { crit: 0.07, area: 0.10 } } },
};

// Texte lisible d'un ensemble de bonus d'équipement.
const BONUS_TEXT = {
  hp: (v) => `+${Math.round(v * 100)}% PV`, dmg: (v) => `+${Math.round(v * 100)}% dégâts`, speed: (v) => `+${Math.round(v * 100)}% vitesse`,
  xp: (v) => `+${Math.round(v * 100)}% XP`, area: (v) => `+${Math.round(v * 100)}% zones`, kamas: (v) => `+${Math.round(v * 100)}% kamas`,
  cd: (v) => `-${Math.round(v * 100)}% recharge`, crit: (v) => `+${Math.round(v * 100)}% critique`, regen: (v) => `+${v} PV/s`,
};
function bonusText(b) { return Object.entries(b).map(([k, v]) => BONUS_TEXT[k](v)).join(', '); }

// ---------------------------------------------------------------- Boutique (améliorations permanentes)
const SHOP = {
  vitalite:   { name: 'Vitalité',     desc: '+6% PV max',            max: 5, cost: 150 },
  force:      { name: 'Force',        desc: '+5% dégâts',            max: 5, cost: 200 },
  agilite:    { name: 'Agilité',      desc: '+3% vitesse',           max: 5, cost: 150 },
  sagesse:    { name: 'Sagesse',      desc: '+6% expérience',        max: 5, cost: 180 },
  prospection:{ name: 'Prospection',  desc: '+10% kamas',            max: 5, cost: 120 },
  pa:         { name: 'Points d’Action', desc: '-3% recharge',      max: 5, cost: 250 },
  resurrection:{ name: 'Résurrection', desc: 'Revivre une fois par partie (50% PV)', max: 1, cost: 1200 },
};
