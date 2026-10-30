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
// shape : sheep | bird | larva | spider | bug | boar | tree | skull | rock | penguin | jelly
const MONSTERS = {
  // Astrub
  bouftou:      { name: 'Bouftou', hp: 10, speed: 60, dmg: 5, xp: 1, r: 14, shape: 'sheep', body: '#f2efe6', detail: '#6b4a2a', sprite: 'bouftou' },
  tofu:         { name: 'Tofu', hp: 6, speed: 105, dmg: 4, xp: 1, r: 9, shape: 'bird', body: '#ffd23f', detail: '#e07a1f', sprite: 'tofu' },
  piou:         { name: 'Piou Rouge', hp: 7, speed: 90, dmg: 4, xp: 1, r: 9, shape: 'bird', body: '#ff5b5b', detail: '#ffcc33', sprite: 'piou' },
  larve_bleue:  { name: 'Larve Bleue', hp: 18, speed: 45, dmg: 6, xp: 2, r: 13, shape: 'larva', body: '#4fa3ff', detail: '#1f5fa8', sprite: 'larve_bleue' },
  tofu_royal:   { name: 'Tofu Royal', hp: 380, speed: 95, dmg: 12, xp: 30, r: 26, shape: 'bird', body: '#ffcc00', detail: '#d06010', boss: 1, sprite: 'tofu_royal' },
  bouftou_royal:{ name: 'Bouftou Royal', hp: 1100, speed: 75, dmg: 18, xp: 80, r: 36, shape: 'sheep', body: '#fffbe8', detail: '#4a2f1a', boss: 2, sprite: 'bouftou_royal' },
  // Amakna
  sanglier:     { name: 'Sanglier', hp: 22, speed: 70, dmg: 8, xp: 2, r: 15, shape: 'boar', body: '#7a5236', detail: '#f0e6d0' },
  arakne:       { name: 'Arakne', hp: 12, speed: 100, dmg: 6, xp: 1, r: 11, shape: 'spider', body: '#3a3a3a', detail: '#d33' },
  moskito:      { name: 'Moskito', hp: 9, speed: 125, dmg: 5, xp: 1, r: 9, shape: 'bug', body: '#8a6a9a', detail: '#e0e0ff' },
  prespic:      { name: 'Prespic', hp: 28, speed: 55, dmg: 9, xp: 3, r: 14, shape: 'boar', body: '#5a4a3a', detail: '#d8c8a0', ranged: { range: 260, cd: 3, speed: 200, color: '#c8b080' } },
  black_wabbit: { name: 'Black Wabbit', hp: 900, speed: 100, dmg: 16, xp: 40, r: 26, shape: 'jelly', body: '#2a2a2a', detail: '#ff3030', boss: 1 },
  dragon_cochon:{ name: 'Dragon Cochon', hp: 3200, speed: 80, dmg: 24, xp: 120, r: 38, shape: 'boar', body: '#e090a0', detail: '#7a2030', boss: 2 },
  // Forêt des Abraknydes
  abraknyde:    { name: 'Abraknyde', hp: 40, speed: 50, dmg: 11, xp: 3, r: 16, shape: 'tree', body: '#6a4a2a', detail: '#3f7a2f' },
  chafer:       { name: 'Chafer', hp: 22, speed: 85, dmg: 9, xp: 2, r: 12, shape: 'skull', body: '#e8e4d8', detail: '#222' },
  chafer_archer:{ name: 'Chafer Archer', hp: 18, speed: 70, dmg: 8, xp: 3, r: 12, shape: 'skull', body: '#d8d0b8', detail: '#552', ranged: { range: 320, cd: 2.4, speed: 260, color: '#e8e0c0' } },
  fantome:      { name: 'Fantôme Pandore', hp: 16, speed: 115, dmg: 8, xp: 2, r: 11, shape: 'jelly', body: '#c8d8ff', detail: '#334' },
  abrak_ancestral:{ name: 'Abraknyde Ancestral', hp: 2200, speed: 70, dmg: 22, xp: 60, r: 32, shape: 'tree', body: '#4a321a', detail: '#2f5a1f', boss: 1 },
  chene_mou:    { name: 'Le Chêne Mou', hp: 6500, speed: 65, dmg: 30, xp: 200, r: 46, shape: 'tree', body: '#5a3a1a', detail: '#7aa040', boss: 2 },
  // Montagne des Craqueleurs
  craqueleur:   { name: 'Craqueleur', hp: 70, speed: 45, dmg: 15, xp: 4, r: 18, shape: 'rock', body: '#8a8a8a', detail: '#5a5a5a' },
  bwork:        { name: 'Bwork', hp: 45, speed: 80, dmg: 13, xp: 3, r: 14, shape: 'boar', body: '#6a8a3a', detail: '#f0e0b0' },
  gelee:        { name: 'Gelée Bleue', hp: 35, speed: 65, dmg: 10, xp: 2, r: 13, shape: 'jelly', body: '#4f8fff', detail: '#1a3a7a' },
  bwork_mage:   { name: 'Bwork Mage', hp: 40, speed: 60, dmg: 12, xp: 4, r: 14, shape: 'boar', body: '#5a3a8a', detail: '#ffb0ff', ranged: { range: 300, cd: 2.2, speed: 240, color: '#d070ff' } },
  craq_roc:     { name: 'Craqueleur des Plaines', hp: 4500, speed: 75, dmg: 28, xp: 90, r: 34, shape: 'rock', body: '#a08a6a', detail: '#6a5a3a', boss: 1 },
  craq_legend:  { name: 'Craqueleur Légendaire', hp: 12000, speed: 70, dmg: 38, xp: 300, r: 50, shape: 'rock', body: '#6a6a7a', detail: '#ffcc40', boss: 2 },
  // Frigost
  mansot:       { name: 'Mansot', hp: 70, speed: 85, dmg: 15, xp: 3, r: 13, shape: 'penguin', body: '#2a3a5a', detail: '#f0f0f0' },
  boufmouth:    { name: 'Boufmouth', hp: 110, speed: 60, dmg: 18, xp: 4, r: 16, shape: 'sheep', body: '#c8e0ff', detail: '#3a5a8a' },
  sapik:        { name: 'Sapik', hp: 90, speed: 55, dmg: 17, xp: 4, r: 15, shape: 'tree', body: '#4a3a2a', detail: '#d0f0ff' },
  fecorce:      { name: 'Fécorce', hp: 60, speed: 75, dmg: 14, xp: 4, r: 13, shape: 'tree', body: '#3a2a1a', detail: '#7ab0d0', ranged: { range: 320, cd: 2, speed: 260, color: '#a0e0ff' } },
  mansot_royal: { name: 'Mansot Royal', hp: 8000, speed: 90, dmg: 34, xp: 120, r: 34, shape: 'penguin', body: '#1a2a4a', detail: '#ffd84a', boss: 1 },
  obsidiantre:  { name: 'Obsidiantre', hp: 22000, speed: 75, dmg: 48, xp: 400, r: 52, shape: 'rock', body: '#1a1a2a', detail: '#a040ff', boss: 2 },
};

// ---------------------------------------------------------------- Zones (zaaps)
const ZONES = [
  {
    id: 'astrub', name: 'Astrub', sub: 'Cité d’Astrub',
    ground: '#6a9b45', ground2: '#5f8f3e', deco: ['#4b7a30', '#e8d070', '#ff9ab0'], decoType: 'grass',
    monsters: ['bouftou', 'tofu', 'piou', 'larve_bleue'], mini: 'tofu_royal', boss: 'bouftou_royal',
    hpMul: 1, dmgMul: 1, kamas: 1, dofus: ['cawotte', 'emeraude'],
  },
  {
    id: 'amakna', name: 'Amakna', sub: 'Champs et forêts d’Amakna',
    ground: '#8aa548', ground2: '#7d9840', deco: ['#c8a040', '#4a7a2a', '#e8e090'], decoType: 'field',
    monsters: ['arakne', 'sanglier', 'moskito', 'prespic'], mini: 'black_wabbit', boss: 'dragon_cochon',
    hpMul: 1.8, dmgMul: 1.3, kamas: 1.5, dofus: ['kaliptus', 'dokoko'],
  },
  {
    id: 'abraknydes', name: 'Forêt des Abraknydes', sub: 'Forêt maléfique',
    ground: '#3f5a32', ground2: '#36502b', deco: ['#2a3f22', '#5a4a3a', '#7a9a50'], decoType: 'forest',
    monsters: ['chafer', 'abraknyde', 'fantome', 'chafer_archer'], mini: 'abrak_ancestral', boss: 'chene_mou',
    hpMul: 3, dmgMul: 1.7, kamas: 2.2, dofus: ['pourpre', 'ocre'],
  },
  {
    id: 'craqueleurs', name: 'Montagne des Craqueleurs', sub: 'Plaines de Cania',
    ground: '#9a8a6a', ground2: '#8d7d5f', deco: ['#6a6a6a', '#b0a080', '#5a5040'], decoType: 'rock',
    monsters: ['gelee', 'bwork', 'craqueleur', 'bwork_mage'], mini: 'craq_roc', boss: 'craq_legend',
    hpMul: 5, dmgMul: 2.2, kamas: 3, dofus: ['turquoise', 'ivoire'],
  },
  {
    id: 'frigost', name: 'Frigost', sub: 'Île de Frigost',
    ground: '#dfe9f2', ground2: '#d2dfeb', deco: ['#a8c4dc', '#2f4a3a', '#ffffff'], decoType: 'snow',
    monsters: ['mansot', 'boufmouth', 'sapik', 'fecorce'], mini: 'mansot_royal', boss: 'obsidiantre',
    hpMul: 8, dmgMul: 2.8, kamas: 4, dofus: ['ebene', 'vulbis'],
  },
];

// ---------------------------------------------------------------- Dofus (bonus permanents)
const DOFUS = {
  cawotte:   { name: 'Dofus Cawotte',   color: '#ff8c1a', desc: '+1 PV régénéré/s' },
  emeraude:  { name: 'Dofus Émeraude',  color: '#2ecc71', desc: '+15% PV max' },
  kaliptus:  { name: 'Dofus Kaliptus',  color: '#7fbf3f', desc: '+30% ramassage, +10% XP' },
  dokoko:    { name: 'Dofus Dokoko',    color: '#c8a070', desc: '+20% kamas' },
  pourpre:   { name: 'Dofus Pourpre',   color: '#a2286a', desc: '+12% dégâts' },
  ocre:      { name: 'Dofus Ocre',      color: '#d4a017', desc: '-8% temps de recharge' },
  turquoise: { name: 'Dofus Turquoise', color: '#1fc4c4', desc: '+7% coups critiques' },
  ivoire:    { name: 'Dofus Ivoire',    color: '#f4f0e0', desc: '-10% dégâts subis' },
  ebene:     { name: 'Dofus Ébène',     color: '#2a2a3a', desc: '+8% vitesse, +8% dégâts' },
  vulbis:    { name: 'Dofus Vulbis',    color: '#b8e0ff', desc: '+6% à tout' },
};

// ---------------------------------------------------------------- Équipements (valables pour la partie)
// Lâchés par les monstres listés dans `from` (la Prospection augmente les chances).
// Les objets `rare` tombent à coup sûr sur le boss intermédiaire de leur zone.
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
  anneau_larve:      { name: 'Anneau de Larve', slot: 'anneau', from: ['larve_bleue'], bonus: { cd: 0.04 } },
  // Astrub — Panoplie du Bouftou Royal (rare)
  royal_coiffe:      { name: 'Coiffe du Bouftou Royal', slot: 'coiffe', set: 'royal', rare: true, from: ['bouftou'], bonus: { hp: 0.18 } },
  royal_cape:        { name: 'Cape du Bouftou Royal', slot: 'cape', set: 'royal', rare: true, from: ['bouftou'], bonus: { dmg: 0.10 } },
  royal_bottes:      { name: 'Boufbottes Royales', slot: 'bottes', set: 'royal', rare: true, from: ['bouftou'], bonus: { speed: 0.10 } },
  royal_amulette:    { name: 'Amulette du Bouftou Royal', slot: 'amulette', set: 'royal', rare: true, from: ['bouftou'], bonus: { xp: 0.15, dmg: 0.04 } },
  royal_anneau:      { name: 'Anneau du Bouftou Royal', slot: 'anneau', set: 'royal', rare: true, from: ['bouftou'], bonus: { crit: 0.05 } },
  royal_ceinture:    { name: 'Ceinture du Bouftou Royal', slot: 'ceinture', set: 'royal', rare: true, from: ['bouftou'], bonus: { regen: 0.6 } },
  royal_epee:        { name: 'Épée du Bouftou Royal', slot: 'arme', set: 'royal', rare: true, from: ['bouftou'], bonus: { dmg: 0.15 } },
  // Amakna
  coiffe_sanglier:   { name: 'Coiffe du Sanglier', slot: 'coiffe', from: ['sanglier'], bonus: { hp: 0.10, dmg: 0.03 } },
  anneau_arakne:     { name: 'Anneau d’Arakne', slot: 'anneau', from: ['arakne'], bonus: { crit: 0.04 } },
  bottes_moskito:    { name: 'Bottes de Moskito', slot: 'bottes', from: ['moskito'], bonus: { speed: 0.08 } },
  cape_prespic:      { name: 'Cape du Prespic', slot: 'cape', from: ['prespic'], bonus: { dmg: 0.07 } },
  cape_black_wabbit: { name: 'Cape du Black Wabbit', slot: 'cape', rare: true, from: ['arakne', 'sanglier'], bonus: { dmg: 0.12, crit: 0.03 } },
  // Forêt des Abraknydes
  baton_abraknyde:   { name: 'Bâton d’Abraknyde', slot: 'arme', from: ['abraknyde'], bonus: { dmg: 0.10 } },
  casque_chafer:     { name: 'Casque du Chafer', slot: 'coiffe', from: ['chafer'], bonus: { hp: 0.12 } },
  amulette_fantome:  { name: 'Amulette du Fantôme', slot: 'amulette', from: ['fantome'], bonus: { xp: 0.12, cd: 0.03 } },
  arc_chafer:        { name: 'Arc du Chafer Archer', slot: 'arme', from: ['chafer_archer'], bonus: { dmg: 0.08, crit: 0.03 } },
  ceinture_ancestrale: { name: 'Ceinture Ancestrale', slot: 'ceinture', rare: true, from: ['abraknyde'], bonus: { regen: 0.8, hp: 0.08 } },
  // Montagne des Craqueleurs
  bottes_craqueleur: { name: 'Bottes du Craqueleur', slot: 'bottes', from: ['craqueleur'], bonus: { hp: 0.12 } },
  ceinture_bwork:    { name: 'Ceinture du Bwork', slot: 'ceinture', from: ['bwork'], bonus: { dmg: 0.06, hp: 0.06 } },
  anneau_gelee:      { name: 'Anneau de Gelée', slot: 'anneau', from: ['gelee'], bonus: { regen: 0.5 } },
  amulette_bwork_mage: { name: 'Amulette du Bwork Mage', slot: 'amulette', from: ['bwork_mage'], bonus: { area: 0.10 } },
  coiffe_craq_legend:{ name: 'Coiffe du Craqueleur Légendaire', slot: 'coiffe', rare: true, from: ['craqueleur'], bonus: { hp: 0.20 } },
  // Frigost
  cape_mansot:       { name: 'Cape du Mansot', slot: 'cape', from: ['mansot'], bonus: { speed: 0.08, crit: 0.02 } },
  amulette_boufmouth:{ name: 'Amulette du Boufmouth', slot: 'amulette', from: ['boufmouth'], bonus: { hp: 0.12, xp: 0.08 } },
  anneau_sapik:      { name: 'Anneau du Sapik', slot: 'anneau', from: ['sapik'], bonus: { crit: 0.05 } },
  bottes_fecorce:    { name: 'Bottes de Fécorce', slot: 'bottes', from: ['fecorce'], bonus: { speed: 0.10 } },
  coiffe_mansot_royal: { name: 'Coiffe du Mansot Royal', slot: 'coiffe', rare: true, from: ['mansot'], bonus: { dmg: 0.12, hp: 0.12 } },
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
