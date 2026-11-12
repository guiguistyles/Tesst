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
    spells: ['pression', 'epee_celeste', 'colere_iop', 'epee_jugement', 'bond', 'intimidation', 'couper', 'puissance'],
  },
  cra: {
    name: 'Crâ', color: '#3f8f4e', accent: '#e8d9a0', hat: 'hood',
    hp: 95, speed: 175, cost: 0,
    desc: 'Archer à distance. Crible les ennemis de flèches.',
    spells: ['fleche_magique', 'fleche_explosive', 'fleche_recul', 'pluie_fleches', 'fleche_glacee', 'fleche_empoisonnee', 'tir_puissant', 'fleche_dispersion'],
  },
  feca: {
    name: 'Féca', color: '#3a6fc4', accent: '#f2f2f2', hat: 'helm',
    hp: 125, speed: 155, cost: 0,
    desc: 'Protecteur. Glyphes et armures pour tenir la ligne.',
    spells: ['bulle', 'glyphe_enflamme', 'armure_terrestre', 'glyphe_aveuglement', 'attaque_nuageuse', 'attaque_naturelle', 'glyphe_agressif', 'treve'],
  },
  eniripsa: {
    name: 'Eniripsa', color: '#e07bb5', accent: '#ffffff', hat: 'wings',
    hp: 100, speed: 170, cost: 0,
    desc: 'Soigneuse. Ses mots blessent autant qu’ils guérissent.',
    spells: ['mot_blessant', 'mot_soignant', 'mot_interdit', 'mot_frayeur', 'mot_drainant', 'mot_stimulant', 'mot_regeneration', 'mot_tournoyant'],
  },
  sram: {
    name: 'Sram', color: '#5b4a7a', accent: '#d8d0e8', hat: 'skull',
    hp: 100, speed: 185, cost: 0,
    desc: 'Assassin. Pièges, poisons et coups sournois.',
    spells: ['piege_sournois', 'coup_sournois', 'poison_insidieux', 'double', 'sournoiserie', 'piege_mortel', 'invisibilite', 'peur'],
  },
  xelor: {
    name: 'Xélor', color: '#2d5a8c', accent: '#f0c94a', hat: 'bandage',
    hp: 105, speed: 160, cost: 0,
    desc: 'Maître du temps. Ralentit et punit ses adversaires.',
    spells: ['aiguille', 'ralentissement', 'poussiere_temporelle', 'frappe_xelor', 'gelure', 'rayon_obscur', 'sablier', 'vol_du_temps'],
  },
  osamodas: {
    name: 'Osamodas', color: '#4e9bb0', accent: '#f6d38a', hat: 'horns',
    hp: 110, speed: 165, cost: 0,
    desc: 'Invocateur. Se bat entouré de ses créatures.',
    spells: ['fouet', 'invoc_bouftou', 'invoc_tofu', 'corbeau_noir', 'invoc_prespic', 'griffe_cinglante', 'cri_ours', 'soin_animal'],
  },
  sacrieur: {
    name: 'Sacrieur', color: '#a8202a', accent: '#2b2b2b', hat: 'tattoo',
    hp: 150, speed: 160, cost: 800,
    desc: 'Berserker. Plus il souffre, plus il frappe fort.',
    spells: ['chatiment', 'assaut', 'transfert_vie', 'attirance', 'absorption', 'folie_sanguinaire', 'dissolution', 'punition'],
  },
  enutrof: {
    name: 'Enutrof', color: '#9a7a3a', accent: '#d9d9d9', hat: 'beard',
    hp: 115, speed: 150, cost: 1500,
    desc: 'Chasseur de trésors. Chaque victime rapporte des kamas.',
    spells: ['lancer_pieces', 'pelle_animee', 'pelle_jugement', 'corruption', 'pelle_fantomatique', 'coffre_anime', 'acceleration', 'remblai'],
  },
  roublard: {
    name: 'Roublard', color: '#c27b2a', accent: '#3a2a1a', hat: 'bandana',
    hp: 105, speed: 175, cost: 2500,
    desc: 'Artificier. Bombes et tromblon pour tout faire sauter.',
    spells: ['bombe_explosive', 'tromblon', 'pulsar', 'kaboom', 'bombe_eau', 'tornabombe', 'dagues_boomerang', 'remission'],
  },
  ecaflip: {
    name: 'Écaflip', color: '#c9472f', accent: '#f6d6a0', hat: 'ears',
    hp: 110, speed: 175, cost: 3000,
    desc: 'Joueur. Ses coups sont imprévisibles : parfois faibles, parfois énormes.',
    spells: ['pile_ou_face', 'griffe_joueuse', 'roulette', 'bond_felin', 'trefle', 'tout_ou_rien', 'langue_rapeuse', 'topkaj'],
  },
  pandawa: {
    name: 'Pandawa', color: '#3e8a5a', accent: '#f4f4f4', hat: 'panda',
    hp: 140, speed: 155, cost: 3500,
    desc: 'Bagarreur. Lait de bambou, flasques et coups de poing enflammés.',
    spells: ['poing_enflamme', 'flasque_explosive', 'gueule_de_bois', 'lait_bambou', 'karcham', 'chamrak', 'pandatak', 'ebriete'],
  },
  sadida: {
    name: 'Sadida', color: '#5f7f2a', accent: '#c8e07a', hat: 'leaves',
    hp: 105, speed: 165, cost: 4000,
    desc: 'Druide. Ronces, poisons et tremblements de terre.',
    spells: ['ronces', 'poison_paralysant', 'ronces_agressives', 'tremblement', 'feu_de_brousse', 'la_folle', 'ronces_multiples', 'vent_empoisonne'],
  },
};

// ---------------------------------------------------------------- Sorts
// type : projectile | melee | nova | aura | orbit | strike | summon | trap | glyph | heal | shield
// up : 4 améliorations (niveaux 2 à 5). m = multiplie, a = ajoute.
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
  pluie_fleches: {
    name: 'Pluie de Flèches', icon: 'PF', color: '#b6e3ff', type: 'strike',
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
  glyphe_aveuglement: {
    name: 'Glyphe d’Aveuglement', icon: 'GA', color: '#e8e2ff', type: 'aura',
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
  chatiment: {
    name: 'Châtiment', icon: 'Ch', color: '#ff3b3b', type: 'melee',
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
  transfert_vie: {
    name: 'Transfert de Vie', icon: 'TV', color: '#ff9a9a', type: 'heal',
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
  corruption: {
    name: 'Corruption', icon: 'Cr', color: '#a0ff70', type: 'aura',
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
  // Écaflip
  pile_ou_face: {
    name: 'Pile ou Face', icon: 'PF', color: '#ffcf6a', type: 'projectile',
    desc: 'Lance une pièce : dégâts entre 30% et 250%.',
    base: { dmg: 14, cd: 0.8, count: 1, pierce: 0, speed: 520, range: 500, size: 6, gamble: 1 },
    up: [
      { d: '+1 pièce', a: { count: 1 } },
      { d: '+30% dégâts', m: { dmg: 1.3 } },
      { d: '+1 pièce', a: { count: 1 } },
      { d: 'Transperce 2', a: { pierce: 2 } },
    ],
  },
  griffe_joueuse: {
    name: 'Griffe Joueuse', icon: 'GJ', color: '#f4a3ff', type: 'orbit',
    desc: 'Des griffes tournent autour de vous.',
    base: { dmg: 9, count: 2, radius: 75, speed: 3.6, size: 11, gamble: 1 },
    up: [
      { d: '+1 griffe', a: { count: 1 } },
      { d: '+40% dégâts', m: { dmg: 1.4 } },
      { d: '+25% rayon et vitesse', m: { radius: 1.25, speed: 1.25 } },
      { d: '+2 griffes', a: { count: 2 } },
    ],
  },
  roulette: {
    name: 'Roulette', icon: 'Ro', color: '#c77dff', type: 'strike',
    desc: 'La roulette frappe des ennemis au hasard.',
    base: { dmg: 34, cd: 3.2, radius: 55, count: 3, range: 400, delay: 0.5, gamble: 1 },
    up: [
      { d: '+2 cibles', a: { count: 2 } },
      { d: '+30% dégâts', m: { dmg: 1.3 } },
      { d: '+30% zone', m: { radius: 1.3 } },
      { d: '+3 cibles', a: { count: 3 } },
    ],
  },
  bond_felin: {
    name: 'Bond du Félin', icon: 'BF', color: '#ffb703', type: 'nova',
    desc: 'Bond qui repousse tout autour de vous.',
    base: { dmg: 18, cd: 3.0, radius: 95, knock: 70 },
    up: [
      { d: '+30% dégâts', m: { dmg: 1.3 } },
      { d: '+25% zone', m: { radius: 1.25 } },
      { d: '-25% recharge', m: { cd: 0.75 } },
      { d: '+60% dégâts', m: { dmg: 1.6 } },
    ],
  },
  // Pandawa
  poing_enflamme: {
    name: 'Poing Enflammé', icon: 'PE', color: '#ff7a3d', type: 'melee',
    desc: 'Coup de poing brûlant devant vous.',
    base: { dmg: 16, cd: 0.9, range: 70, arc: 1.8, knock: 35 },
    up: [
      { d: '+30% dégâts', m: { dmg: 1.3 } },
      { d: '+25% portée', m: { range: 1.25 } },
      { d: 'Frappe aussi derrière vous', a: { double: 1 } },
      { d: '+50% dégâts', m: { dmg: 1.5 } },
    ],
  },
  flasque_explosive: {
    name: 'Flasque Explosive', icon: 'FE', color: '#e0b060', type: 'projectile',
    desc: 'Une flasque qui explose à l’impact.',
    base: { dmg: 18, cd: 2.0, count: 1, pierce: 0, speed: 360, range: 420, size: 8, explode: 65 },
    up: [
      { d: '+30% explosion', m: { explode: 1.3 } },
      { d: '+40% dégâts', m: { dmg: 1.4 } },
      { d: '+1 flasque', a: { count: 1 } },
      { d: '-25% recharge', m: { cd: 0.75 } },
    ],
  },
  gueule_de_bois: {
    name: 'Gueule de Bois', icon: 'GB', color: '#b0d080', type: 'aura',
    desc: 'Les ennemis proches titubent et ralentissent.',
    base: { dmg: 3, tick: 0.5, radius: 100, slow: 0.35 },
    up: [
      { d: '+25% zone', m: { radius: 1.25 } },
      { d: '+100% dégâts', m: { dmg: 2 } },
      { d: 'Ralentit davantage', a: { slow: 0.15 } },
      { d: '+25% zone', m: { radius: 1.25 } },
    ],
  },
  lait_bambou: {
    name: 'Lait de Bambou', icon: 'LB', color: '#f4f4e0', type: 'heal',
    desc: 'Rend régulièrement des points de vie.',
    base: { heal: 7, cd: 5.0 },
    up: [
      { d: '+4 soins', a: { heal: 4 } },
      { d: '-20% recharge', m: { cd: 0.8 } },
      { d: '+6 soins', a: { heal: 6 } },
      { d: 'Soins doublés', m: { heal: 2 } },
    ],
  },
  // Sadida
  ronces: {
    name: 'Ronces', icon: 'Rn', color: '#8fbf4a', type: 'strike',
    desc: 'Des ronces jaillissent sous les ennemis.',
    base: { dmg: 24, cd: 1.6, radius: 45, count: 2, range: 400, delay: 0.35 },
    up: [
      { d: '+1 ronce', a: { count: 1 } },
      { d: '+30% dégâts', m: { dmg: 1.3 } },
      { d: '+2 ronces', a: { count: 2 } },
      { d: '+30% zone', m: { radius: 1.3 } },
    ],
  },
  poison_paralysant: {
    name: 'Poison Paralysant', icon: 'PP', color: '#7dff6a', type: 'projectile',
    desc: 'Empoisonne la cible sur la durée.',
    base: { dmg: 5, cd: 1.2, count: 1, pierce: 1, speed: 480, range: 480, size: 6, poison: 9, poisonDur: 3 },
    up: [
      { d: '+1 projectile', a: { count: 1 } },
      { d: 'Poison +50%', m: { poison: 1.5 } },
      { d: 'Poison dure +2s', a: { poisonDur: 2 } },
      { d: '+2 projectiles', a: { count: 2 } },
    ],
  },
  ronces_agressives: {
    name: 'Ronces Agressives', icon: 'RA', color: '#5fa03a', type: 'glyph',
    desc: 'Un buisson de ronces blesse les ennemis autour de vous.',
    base: { dmg: 8, cd: 4.0, radius: 90, duration: 3.5, tick: 0.4 },
    up: [
      { d: '+30% zone', m: { radius: 1.3 } },
      { d: '+40% dégâts', m: { dmg: 1.4 } },
      { d: '+50% durée', m: { duration: 1.5 } },
      { d: '-30% recharge', m: { cd: 0.7 } },
    ],
  },
  tremblement: {
    name: 'Tremblement', icon: 'Tb', color: '#c8a060', type: 'nova',
    desc: 'La terre tremble autour de vous.',
    base: { dmg: 22, cd: 3.4, radius: 120, knock: 20 },
    up: [
      { d: '+30% dégâts', m: { dmg: 1.3 } },
      { d: '+20% zone', m: { radius: 1.2 } },
      { d: '-25% recharge', m: { cd: 0.75 } },
      { d: '+60% dégâts', m: { dmg: 1.6 } },
    ],
  },
  // ---------------------------------------------------------------- Nouveaux sorts (inspirés des sorts de Dofus)
  // Iop
  bond: { name: 'Bond', icon: 'Bo', color: '#ffcf5a', type: 'dash', desc: 'Bondit sur l’ennemi le plus proche et frappe autour de l’impact.',
    base: { dmg: 22, cd: 5, range: 300, radius: 70 },
    up: [{ d: '+40% dégâts', m: { dmg: 1.4 } }, { d: '+25% portée', m: { range: 1.25 } }, { d: '-25% recharge', m: { cd: 0.75 } }, { d: '+50% zone', m: { radius: 1.5 } }] },
  intimidation: { name: 'Intimidation', icon: 'In', color: '#ff8a3a', type: 'melee', desc: 'Repousse violemment les ennemis devant vous.',
    base: { dmg: 12, cd: 2.5, range: 80, arc: 1.6, knock: 140 },
    up: [{ d: '+50% dégâts', m: { dmg: 1.5 } }, { d: '+40% recul', m: { knock: 1.4 } }, { d: 'Frappe aussi derrière vous', a: { double: 1 } }, { d: '-30% recharge', m: { cd: 0.7 } }] },
  couper: { name: 'Couper', icon: 'Cp', color: '#ff6a3a', type: 'line', desc: 'Tranche en ligne droite tout ce qui se trouve devant vous.',
    base: { dmg: 26, cd: 3, range: 260, width: 50 },
    up: [{ d: '+40% dégâts', m: { dmg: 1.4 } }, { d: '+30% longueur', m: { range: 1.3 } }, { d: '-25% recharge', m: { cd: 0.75 } }, { d: '+60% dégâts', m: { dmg: 1.6 } }] },
  puissance: { name: 'Puissance', icon: 'Pu', color: '#ff3b3b', type: 'buff', desc: 'Augmente vos dégâts pendant quelques secondes.',
    base: { cd: 16, dur: 6, pct: 0.3 },
    up: [{ d: '+2 s', a: { dur: 2 } }, { d: '+15% dégâts', a: { pct: 0.15 } }, { d: '-20% recharge', m: { cd: 0.8 } }, { d: '+20% dégâts', a: { pct: 0.2 } }] },
  // Crâ
  fleche_glacee: { name: 'Flèche Glacée', icon: 'FG', color: '#a8e4ff', type: 'projectile', desc: 'Une flèche qui ralentit sa cible.',
    base: { dmg: 14, cd: 1.4, count: 1, pierce: 0, speed: 420, range: 400, size: 6, slow: 0.45 },
    up: [{ d: '+40% dégâts', m: { dmg: 1.4 } }, { d: '+1 flèche', a: { count: 1 } }, { d: 'Transperce 1 ennemi', a: { pierce: 1 } }, { d: '+50% dégâts', m: { dmg: 1.5 } }] },
  fleche_empoisonnee: { name: 'Flèche Empoisonnée', icon: 'FE', color: '#8cd94f', type: 'projectile', desc: 'Empoisonne la cible pendant plusieurs secondes.',
    base: { dmg: 6, cd: 2, count: 1, pierce: 0, speed: 400, range: 400, size: 6, poison: 7, poisonDur: 4 },
    up: [{ d: '+50% poison', m: { poison: 1.5 } }, { d: '+1 flèche', a: { count: 1 } }, { d: '+2 s de poison', a: { poisonDur: 2 } }, { d: '+60% poison', m: { poison: 1.6 } }] },
  tir_puissant: { name: 'Tir Puissant', icon: 'TP', color: '#ffd84a', type: 'buff', desc: 'Concentration : vos dégâts augmentent fortement.',
    base: { cd: 18, dur: 7, pct: 0.35 },
    up: [{ d: '+2 s', a: { dur: 2 } }, { d: '+15% dégâts', a: { pct: 0.15 } }, { d: '-20% recharge', m: { cd: 0.8 } }, { d: '+25% dégâts', a: { pct: 0.25 } }] },
  fleche_dispersion: { name: 'Flèche de Dispersion', icon: 'FD', color: '#ffb347', type: 'projectile', desc: 'Une gerbe de flèches en éventail.',
    base: { dmg: 10, cd: 2.2, count: 5, pierce: 0, speed: 430, range: 330, size: 5, spread: 0.5 },
    up: [{ d: '+2 flèches', a: { count: 2 } }, { d: '+40% dégâts', m: { dmg: 1.4 } }, { d: 'Transperce 1 ennemi', a: { pierce: 1 } }, { d: '-25% recharge', m: { cd: 0.75 } }] },
  // Féca
  attaque_nuageuse: { name: 'Attaque Nuageuse', icon: 'AN', color: '#bfe4ff', type: 'projectile', desc: 'Un nuage qui traverse les ennemis.',
    base: { dmg: 13, cd: 1.6, count: 1, pierce: 3, speed: 260, range: 380, size: 12 },
    up: [{ d: '+40% dégâts', m: { dmg: 1.4 } }, { d: '+2 traversées', a: { pierce: 2 } }, { d: '+1 nuage', a: { count: 1 } }, { d: '+50% dégâts', m: { dmg: 1.5 } }] },
  attaque_naturelle: { name: 'Attaque Naturelle', icon: 'At', color: '#ff9a3a', type: 'nova', desc: 'Une explosion de flammes autour de vous.',
    base: { dmg: 20, cd: 3.5, radius: 90, knock: 20 },
    up: [{ d: '+40% dégâts', m: { dmg: 1.4 } }, { d: '+25% zone', m: { radius: 1.25 } }, { d: '-25% recharge', m: { cd: 0.75 } }, { d: '+50% dégâts', m: { dmg: 1.5 } }] },
  glyphe_agressif: { name: 'Glyphe Agressif', icon: 'GA', color: '#ff5a8a', type: 'glyph', desc: 'Glyphe qui blesse tout ennemi qui y entre.',
    base: { dmg: 9, cd: 5, radius: 100, duration: 4, tick: 0.5 },
    up: [{ d: '+40% dégâts', m: { dmg: 1.4 } }, { d: '+25% zone', m: { radius: 1.25 } }, { d: '+2 s', a: { duration: 2 } }, { d: '+50% dégâts', m: { dmg: 1.5 } }] },
  treve: { name: 'Trêve', icon: 'Tr', color: '#9affc8', type: 'heal', desc: 'Un instant de répit qui soigne.',
    base: { heal: 30, cd: 9 },
    up: [{ d: '+40% soin', m: { heal: 1.4 } }, { d: '-20% recharge', m: { cd: 0.8 } }, { d: '+50% soin', m: { heal: 1.5 } }, { d: '-25% recharge', m: { cd: 0.75 } }] },
  // Eniripsa
  mot_drainant: { name: 'Mot Drainant', icon: 'MD', color: '#ff7ac8', type: 'drain', desc: 'Vole la vie d’un ennemi pour vous soigner.',
    base: { dmg: 16, cd: 2.4, range: 320, steal: 0.4 },
    up: [{ d: '+40% dégâts', m: { dmg: 1.4 } }, { d: '+20% vol de vie', a: { steal: 0.2 } }, { d: '-25% recharge', m: { cd: 0.75 } }, { d: '+50% dégâts', m: { dmg: 1.5 } }] },
  mot_stimulant: { name: 'Mot Stimulant', icon: 'MS', color: '#ffd84a', type: 'buff', desc: 'Stimule vos dégâts et votre vitesse.',
    base: { cd: 15, dur: 6, pct: 0.2, speed: 0.15 },
    up: [{ d: '+2 s', a: { dur: 2 } }, { d: '+10% dégâts', a: { pct: 0.1 } }, { d: '+10% vitesse', a: { speed: 0.1 } }, { d: '-25% recharge', m: { cd: 0.75 } }] },
  mot_regeneration: { name: 'Mot de Régénération', icon: 'MR', color: '#7dff9a', type: 'heal', desc: 'Un soin puissant à longue recharge.',
    base: { heal: 45, cd: 12 },
    up: [{ d: '+40% soin', m: { heal: 1.4 } }, { d: '-20% recharge', m: { cd: 0.8 } }, { d: '+50% soin', m: { heal: 1.5 } }, { d: '-25% recharge', m: { cd: 0.75 } }] },
  mot_tournoyant: { name: 'Mot Tournoyant', icon: 'MT', color: '#ff9ad8', type: 'melee', desc: 'Frappe tout autour de vous.',
    base: { dmg: 14, cd: 2.2, range: 85, arc: 6.28, knock: 30 },
    up: [{ d: '+40% dégâts', m: { dmg: 1.4 } }, { d: '+25% portée', m: { range: 1.25 } }, { d: '-25% recharge', m: { cd: 0.75 } }, { d: '+50% dégâts', m: { dmg: 1.5 } }] },
  // Sram
  sournoiserie: { name: 'Sournoiserie', icon: 'So', color: '#c88aff', type: 'melee', desc: 'Coup rapide et précis, souvent critique.',
    base: { dmg: 12, cd: 0.8, range: 70, arc: 1.4, knock: 10, crit: 0.15 },
    up: [{ d: '+40% dégâts', m: { dmg: 1.4 } }, { d: '+15% critique', a: { crit: 0.15 } }, { d: '-20% recharge', m: { cd: 0.8 } }, { d: '+50% dégâts', m: { dmg: 1.5 } }] },
  piege_mortel: { name: 'Piège Mortel', icon: 'PM', color: '#8a2a8a', type: 'trap', desc: 'Un piège dévastateur posé sous vos pieds.',
    base: { dmg: 70, cd: 6, count: 1, radius: 85, life: 12 },
    up: [{ d: '+40% dégâts', m: { dmg: 1.4 } }, { d: '+1 piège', a: { count: 1 } }, { d: '+25% zone', m: { radius: 1.25 } }, { d: '+60% dégâts', m: { dmg: 1.6 } }] },
  invisibilite: { name: 'Invisibilité', icon: 'Iv', color: '#9a9ad8', type: 'buff', desc: 'Disparaissez : vitesse et dégâts augmentés.',
    base: { cd: 18, dur: 5, pct: 0.25, speed: 0.3 },
    up: [{ d: '+2 s', a: { dur: 2 } }, { d: '+15% dégâts', a: { pct: 0.15 } }, { d: '-20% recharge', m: { cd: 0.8 } }, { d: '+20% vitesse', a: { speed: 0.2 } }] },
  peur: { name: 'Peur', icon: 'Pe', color: '#6a4a9a', type: 'nova', desc: 'Effraie les ennemis et les repousse au loin.',
    base: { dmg: 8, cd: 5, radius: 110, knock: 180 },
    up: [{ d: '+25% zone', m: { radius: 1.25 } }, { d: '+60% dégâts', m: { dmg: 1.6 } }, { d: '-25% recharge', m: { cd: 0.75 } }, { d: '+30% recul', m: { knock: 1.3 } }] },
  // Xélor
  gelure: { name: 'Gelure', icon: 'Ge', color: '#6ad8ff', type: 'projectile', desc: 'Gèle et ralentit fortement la cible.',
    base: { dmg: 12, cd: 1.6, count: 1, pierce: 0, speed: 380, range: 380, size: 7, slow: 0.6 },
    up: [{ d: '+40% dégâts', m: { dmg: 1.4 } }, { d: '+1 projectile', a: { count: 1 } }, { d: '-20% recharge', m: { cd: 0.8 } }, { d: '+50% dégâts', m: { dmg: 1.5 } }] },
  rayon_obscur: { name: 'Rayon Obscur', icon: 'RO', color: '#7a5aff', type: 'line', desc: 'Un rayon d’ombre qui traverse les ennemis alignés.',
    base: { dmg: 22, cd: 3, range: 320, width: 40 },
    up: [{ d: '+40% dégâts', m: { dmg: 1.4 } }, { d: '+25% longueur', m: { range: 1.25 } }, { d: '+30% largeur', m: { width: 1.3 } }, { d: '+50% dégâts', m: { dmg: 1.5 } }] },
  sablier: { name: 'Sablier de Xélor', icon: 'Sa', color: '#ffd27a', type: 'strike', desc: 'Un sablier géant s’écrase sur la cible.',
    base: { dmg: 60, cd: 5, radius: 70, count: 1, range: 400, delay: 0.6 },
    up: [{ d: '+40% dégâts', m: { dmg: 1.4 } }, { d: '+1 sablier', a: { count: 1 } }, { d: '-20% recharge', m: { cd: 0.8 } }, { d: '+1 sablier', a: { count: 1 } }] },
  vol_du_temps: { name: 'Vol du Temps', icon: 'VT', color: '#b48cff', type: 'drain', desc: 'Dérobe le temps (et la vie) d’un ennemi.',
    base: { dmg: 14, cd: 2.5, range: 320, steal: 0.35 },
    up: [{ d: '+40% dégâts', m: { dmg: 1.4 } }, { d: '+15% vol de vie', a: { steal: 0.15 } }, { d: '-25% recharge', m: { cd: 0.75 } }, { d: '+50% dégâts', m: { dmg: 1.5 } }] },
  // Osamodas
  invoc_prespic: { name: 'Invocation de Prespic', icon: 'IP', color: '#c8a070', type: 'summon', desc: 'Un prespic qui charge vos ennemis.',
    base: { dmg: 14, count: 1, speed: 150, size: 12 },
    up: [{ d: '+1 prespic', a: { count: 1 } }, { d: '+40% dégâts', m: { dmg: 1.4 } }, { d: '+30% vitesse', m: { speed: 1.3 } }, { d: '+1 prespic', a: { count: 1 } }] },
  griffe_cinglante: { name: 'Griffe Cinglante', icon: 'GC', color: '#e07a3a', type: 'melee', desc: 'Lacère les ennemis devant vous.',
    base: { dmg: 18, cd: 1.2, range: 80, arc: 1.8, knock: 20 },
    up: [{ d: '+40% dégâts', m: { dmg: 1.4 } }, { d: '+25% portée', m: { range: 1.25 } }, { d: '-20% recharge', m: { cd: 0.8 } }, { d: '+50% dégâts', m: { dmg: 1.5 } }] },
  cri_ours: { name: 'Cri de l’Ours', icon: 'CO', color: '#a0703a', type: 'buff', desc: 'Un cri qui galvanise : dégâts et vitesse.',
    base: { cd: 16, dur: 6, pct: 0.25, speed: 0.1 },
    up: [{ d: '+2 s', a: { dur: 2 } }, { d: '+15% dégâts', a: { pct: 0.15 } }, { d: '-20% recharge', m: { cd: 0.8 } }, { d: '+20% dégâts', a: { pct: 0.2 } }] },
  soin_animal: { name: 'Soin Animal', icon: 'SA', color: '#7dff9a', type: 'heal', desc: 'Un soin naturel.',
    base: { heal: 32, cd: 9 },
    up: [{ d: '+40% soin', m: { heal: 1.4 } }, { d: '-20% recharge', m: { cd: 0.8 } }, { d: '+50% soin', m: { heal: 1.5 } }, { d: '-25% recharge', m: { cd: 0.75 } }] },
  // Sacrieur
  absorption: { name: 'Absorption', icon: 'Ab', color: '#d02a3a', type: 'drain', desc: 'Absorbe la vie de l’ennemi.',
    base: { dmg: 18, cd: 2.2, range: 200, steal: 0.5 },
    up: [{ d: '+40% dégâts', m: { dmg: 1.4 } }, { d: '+20% vol de vie', a: { steal: 0.2 } }, { d: '+30% portée', m: { range: 1.3 } }, { d: '+50% dégâts', m: { dmg: 1.5 } }] },
  folie_sanguinaire: { name: 'Folie Sanguinaire', icon: 'FS', color: '#ff2a2a', type: 'buff', desc: 'La rage du sang : dégâts fortement augmentés.',
    base: { cd: 20, dur: 7, pct: 0.45 },
    up: [{ d: '+2 s', a: { dur: 2 } }, { d: '+15% dégâts', a: { pct: 0.15 } }, { d: '-20% recharge', m: { cd: 0.8 } }, { d: '+25% dégâts', a: { pct: 0.25 } }] },
  dissolution: { name: 'Dissolution', icon: 'Di', color: '#c84a6a', type: 'nova', desc: 'Une vague de sang autour de vous.',
    base: { dmg: 24, cd: 3.5, radius: 95, knock: 30, rage: 1 },
    up: [{ d: '+40% dégâts', m: { dmg: 1.4 } }, { d: '+25% zone', m: { radius: 1.25 } }, { d: '-25% recharge', m: { cd: 0.75 } }, { d: '+50% dégâts', m: { dmg: 1.5 } }] },
  punition: { name: 'Punition', icon: 'Pn', color: '#ff4a4a', type: 'strike', desc: 'Un châtiment qui s’abat sur l’ennemi le plus fort.',
    base: { dmg: 95, cd: 7, radius: 60, count: 1, range: 380, delay: 0.5 },
    up: [{ d: '+40% dégâts', m: { dmg: 1.4 } }, { d: '-20% recharge', m: { cd: 0.8 } }, { d: '+1 frappe', a: { count: 1 } }, { d: '+60% dégâts', m: { dmg: 1.6 } }] },
  // Enutrof
  pelle_fantomatique: { name: 'Pelle Fantomatique', icon: 'PF', color: '#b8c8e0', type: 'projectile', desc: 'Une pelle spectrale qui transperce.',
    base: { dmg: 15, cd: 1.6, count: 1, pierce: 2, speed: 320, range: 380, size: 10 },
    up: [{ d: '+40% dégâts', m: { dmg: 1.4 } }, { d: '+2 traversées', a: { pierce: 2 } }, { d: '+1 pelle', a: { count: 1 } }, { d: '+50% dégâts', m: { dmg: 1.5 } }] },
  coffre_anime: { name: 'Coffre Animé', icon: 'CA', color: '#d8a830', type: 'summon', desc: 'Un coffre qui mord vos ennemis.',
    base: { dmg: 16, count: 1, speed: 110, size: 13 },
    up: [{ d: '+40% dégâts', m: { dmg: 1.4 } }, { d: '+1 coffre', a: { count: 1 } }, { d: '+30% vitesse', m: { speed: 1.3 } }, { d: '+50% dégâts', m: { dmg: 1.5 } }] },
  acceleration: { name: 'Accélération', icon: 'Ac', color: '#4fc3c7', type: 'buff', desc: 'Accélère vos mouvements et vos dégâts.',
    base: { cd: 14, dur: 6, pct: 0.15, speed: 0.3 },
    up: [{ d: '+2 s', a: { dur: 2 } }, { d: '+15% vitesse', a: { speed: 0.15 } }, { d: '-20% recharge', m: { cd: 0.8 } }, { d: '+15% dégâts', a: { pct: 0.15 } }] },
  remblai: { name: 'Remblai', icon: 'Re', color: '#a08060', type: 'nova', desc: 'La terre se soulève et repousse les ennemis.',
    base: { dmg: 18, cd: 4, radius: 100, knock: 90 },
    up: [{ d: '+40% dégâts', m: { dmg: 1.4 } }, { d: '+25% zone', m: { radius: 1.25 } }, { d: '-25% recharge', m: { cd: 0.75 } }, { d: '+50% dégâts', m: { dmg: 1.5 } }] },
  // Roublard
  bombe_eau: { name: 'Bombe à Eau', icon: 'BE', color: '#4fa8ff', type: 'trap', desc: 'Une bombe aquatique qui explose sur un ennemi.',
    base: { dmg: 36, cd: 3, count: 2, radius: 80, life: 2.5, fuse: 1 },
    up: [{ d: '+40% dégâts', m: { dmg: 1.4 } }, { d: '+1 bombe', a: { count: 1 } }, { d: '+25% zone', m: { radius: 1.25 } }, { d: '+50% dégâts', m: { dmg: 1.5 } }] },
  tornabombe: { name: 'Tornabombe', icon: 'TB', color: '#9ae8a0', type: 'trap', desc: 'Une bombe tourbillonnante à grande zone.',
    base: { dmg: 28, cd: 4, count: 1, radius: 110, life: 2.5, fuse: 1 },
    up: [{ d: '+25% zone', m: { radius: 1.25 } }, { d: '+40% dégâts', m: { dmg: 1.4 } }, { d: '+1 bombe', a: { count: 1 } }, { d: '+50% dégâts', m: { dmg: 1.5 } }] },
  dagues_boomerang: { name: 'Dagues Boomerang', icon: 'DB', color: '#d8d8e8', type: 'projectile', desc: 'Des dagues qui transpercent tout.',
    base: { dmg: 11, cd: 1.3, count: 2, pierce: 3, speed: 400, range: 300, size: 7 },
    up: [{ d: '+1 dague', a: { count: 1 } }, { d: '+40% dégâts', m: { dmg: 1.4 } }, { d: '+2 traversées', a: { pierce: 2 } }, { d: '+50% dégâts', m: { dmg: 1.5 } }] },
  remission: { name: 'Rémission', icon: 'Rm', color: '#7dff9a', type: 'heal', desc: 'Récupère de la vie.',
    base: { heal: 30, cd: 10 },
    up: [{ d: '+40% soin', m: { heal: 1.4 } }, { d: '-20% recharge', m: { cd: 0.8 } }, { d: '+50% soin', m: { heal: 1.5 } }, { d: '-25% recharge', m: { cd: 0.75 } }] },
  // Ecaflip
  trefle: { name: 'Trèfle', icon: 'Tf', color: '#5adc6a', type: 'buff', desc: 'La chance vous sourit : dégâts augmentés.',
    base: { cd: 16, dur: 7, pct: 0.3 },
    up: [{ d: '+2 s', a: { dur: 2 } }, { d: '+15% dégâts', a: { pct: 0.15 } }, { d: '-20% recharge', m: { cd: 0.8 } }, { d: '+20% dégâts', a: { pct: 0.2 } }] },
  tout_ou_rien: { name: 'Tout ou Rien', icon: 'TR', color: '#ffd84a', type: 'strike', desc: 'Énormes dégâts… ou presque rien.',
    base: { dmg: 110, cd: 6, radius: 70, count: 1, range: 380, delay: 0.5, gamble: 1 },
    up: [{ d: '+40% dégâts', m: { dmg: 1.4 } }, { d: '-20% recharge', m: { cd: 0.8 } }, { d: '+1 frappe', a: { count: 1 } }, { d: '+50% dégâts', m: { dmg: 1.5 } }] },
  langue_rapeuse: { name: 'Langue Râpeuse', icon: 'LR', color: '#ff8aa8', type: 'drain', desc: 'Un coup de langue qui vole un peu de vie.',
    base: { dmg: 13, cd: 1.8, range: 160, steal: 0.35 },
    up: [{ d: '+40% dégâts', m: { dmg: 1.4 } }, { d: '+15% vol de vie', a: { steal: 0.15 } }, { d: '-25% recharge', m: { cd: 0.75 } }, { d: '+50% dégâts', m: { dmg: 1.5 } }] },
  topkaj: { name: 'Topkaj', icon: 'Tk', color: '#ff7a5a', type: 'melee', desc: 'Griffure enflammée au corps à corps.',
    base: { dmg: 20, cd: 1.4, range: 75, arc: 1.6, knock: 25, gamble: 1 },
    up: [{ d: '+40% dégâts', m: { dmg: 1.4 } }, { d: '+25% portée', m: { range: 1.25 } }, { d: '-20% recharge', m: { cd: 0.8 } }, { d: '+50% dégâts', m: { dmg: 1.5 } }] },
  // Pandawa
  karcham: { name: 'Karcham', icon: 'Ka', color: '#6ab06a', type: 'dash', desc: 'Fonce sur un ennemi et le projette.',
    base: { dmg: 24, cd: 5, range: 280, radius: 80 },
    up: [{ d: '+40% dégâts', m: { dmg: 1.4 } }, { d: '+25% portée', m: { range: 1.25 } }, { d: '-25% recharge', m: { cd: 0.75 } }, { d: '+40% zone', m: { radius: 1.4 } }] },
  chamrak: { name: 'Chamrak', icon: 'Ch', color: '#c8e070', type: 'nova', desc: 'Une ruade qui secoue tout autour.',
    base: { dmg: 22, cd: 3.5, radius: 95, knock: 50 },
    up: [{ d: '+40% dégâts', m: { dmg: 1.4 } }, { d: '+25% zone', m: { radius: 1.25 } }, { d: '-25% recharge', m: { cd: 0.75 } }, { d: '+50% dégâts', m: { dmg: 1.5 } }] },
  pandatak: { name: 'Pandatak', icon: 'Pk', color: '#ff9a4a', type: 'line', desc: 'Une charge enflammée en ligne droite.',
    base: { dmg: 28, cd: 3.5, range: 240, width: 55 },
    up: [{ d: '+40% dégâts', m: { dmg: 1.4 } }, { d: '+30% longueur', m: { range: 1.3 } }, { d: '-25% recharge', m: { cd: 0.75 } }, { d: '+50% dégâts', m: { dmg: 1.5 } }] },
  ebriete: { name: 'Ébriété', icon: 'Eb', color: '#d8a8ff', type: 'buff', desc: 'L’ivresse décuple votre force.',
    base: { cd: 17, dur: 7, pct: 0.35 },
    up: [{ d: '+2 s', a: { dur: 2 } }, { d: '+15% dégâts', a: { pct: 0.15 } }, { d: '-20% recharge', m: { cd: 0.8 } }, { d: '+20% dégâts', a: { pct: 0.2 } }] },
  // Sadida
  feu_de_brousse: { name: 'Feu de Brousse', icon: 'FB', color: '#ff6a2a', type: 'glyph', desc: 'Les herbes s’enflamment autour de vous.',
    base: { dmg: 10, cd: 5, radius: 110, duration: 4, tick: 0.5 },
    up: [{ d: '+40% dégâts', m: { dmg: 1.4 } }, { d: '+25% zone', m: { radius: 1.25 } }, { d: '+2 s', a: { duration: 2 } }, { d: '+50% dégâts', m: { dmg: 1.5 } }] },
  la_folle: { name: 'La Folle', icon: 'LF', color: '#e08ac8', type: 'summon', desc: 'Une poupée folle qui harcèle vos ennemis.',
    base: { dmg: 15, count: 1, speed: 140, size: 11 },
    up: [{ d: '+1 poupée', a: { count: 1 } }, { d: '+40% dégâts', m: { dmg: 1.4 } }, { d: '+30% vitesse', m: { speed: 1.3 } }, { d: '+50% dégâts', m: { dmg: 1.5 } }] },
  ronces_multiples: { name: 'Ronces Multiples', icon: 'RM', color: '#4f9a3a', type: 'strike', desc: 'Des ronces jaillissent sous plusieurs ennemis.',
    base: { dmg: 30, cd: 4, radius: 55, count: 3, range: 380, delay: 0.5 },
    up: [{ d: '+2 ronces', a: { count: 2 } }, { d: '+40% dégâts', m: { dmg: 1.4 } }, { d: '-20% recharge', m: { cd: 0.8 } }, { d: '+50% dégâts', m: { dmg: 1.5 } }] },
  vent_empoisonne: { name: 'Vent Empoisonné', icon: 'VE', color: '#9ad84f', type: 'aura', desc: 'Un vent toxique qui ronge les ennemis proches.',
    base: { dmg: 6, tick: 0.6, radius: 90, slow: 0.15 },
    up: [{ d: '+40% dégâts', m: { dmg: 1.4 } }, { d: '+25% zone', m: { radius: 1.25 } }, { d: '+15% ralentissement', a: { slow: 0.15 } }, { d: '+50% dégâts', m: { dmg: 1.5 } }] },
};

// ---------------------------------------------------------------- Caractéristiques (passifs de partie)
const PASSIVES = {
  vitalite:     { name: 'Vitalité',     icon: '❤', color: '#ff6b6b', desc: '+20% PV max', max: 5 },
  force:        { name: 'Force',        icon: '⚔', color: '#c8763a', desc: '+10% dégâts', max: 5 },
  agilite:      { name: 'Agilité',      icon: '➶', color: '#5fcf6f', desc: '+8% vitesse de déplacement', max: 5 },
  intelligence: { name: 'Intelligence', icon: '✦', color: '#ff8a3d', desc: '+10% taille des zones', max: 5 },
  sagesse:      { name: 'Sagesse',      icon: '✎', color: '#b48cff', desc: '+12% expérience', max: 5 },
  chance:       { name: 'Chance',       icon: '☘', color: '#58b8ff', desc: '+5% coups critiques', max: 5 },
  prospection:  { name: 'Prospection',  icon: '◎', color: '#ffd84a', desc: '+30% rayon de ramassage', max: 5 },
  pa:           { name: 'Points d’Action', icon: '★', color: '#4fc3f7', desc: '-7% temps de recharge', max: 5 },
  resistance:   { name: 'Résistance',   icon: '⛨', color: '#a0a0b0', desc: '-6% dégâts subis', max: 5 },
  soin:         { name: 'Soins',        icon: '✚', color: '#7dff9a', desc: '+0,5 PV régénérés/s', max: 5 },
};

// ---------------------------------------------------------------- Monstres
// shape : sheep | bird | larva | spider | bug | boar | tree | skull | rock | penguin | jelly
const MONSTERS = {
  // Astrub
  bouftou:      { name: 'Bouftou', hp: 10, speed: 60, dmg: 5, xp: 1, r: 14, shape: 'sheep', body: '#f2efe6', detail: '#6b4a2a' },
  tofu:         { name: 'Tofu', hp: 6, speed: 105, dmg: 4, xp: 1, r: 9, shape: 'bird', body: '#ffd23f', detail: '#e07a1f' },
  piou:         { name: 'Piou Rouge', hp: 7, speed: 90, dmg: 4, xp: 1, r: 9, shape: 'bird', body: '#ff5b5b', detail: '#ffcc33' },
  pichon:       { name: 'Pichon', hp: 9, speed: 85, dmg: 4, xp: 1, r: 10, shape: 'jelly', body: '#5ab0e8', detail: '#1f5f9a' },
  larve_bleue:  { name: 'Larve Bleue', hp: 18, speed: 45, dmg: 6, xp: 2, r: 13, shape: 'larva', body: '#4fa3ff', detail: '#1f5fa8' },
  tofu_royal:   { name: 'Tofu Royal', hp: 380, speed: 95, dmg: 12, xp: 30, r: 26, shape: 'bird', body: '#ffcc00', detail: '#d06010', boss: 1 },
  bouftou_royal:{ name: 'Bouftou Royal', hp: 1100, speed: 75, dmg: 18, xp: 80, r: 36, shape: 'sheep', body: '#fffbe8', detail: '#4a2f1a', boss: 2 },
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
    id: 'astrub', x: 14, y: 70, name: 'Astrub', sub: 'Cité d’Astrub',
    ground: '#6a9b45', ground2: '#5f8f3e', deco: ['#4b7a30', '#e8d070', '#ff9ab0'], decoType: 'grass',
    monsters: ['bouftou', 'tofu', 'piou', 'larve_bleue', 'pichon'], mini: 'tofu_royal', boss: 'bouftou_royal',
    hpMul: 1, dmgMul: 1, kamas: 1, dofus: ['cawotte', 'emeraude'],
  },
  {
    id: 'amakna', x: 34, y: 52, name: 'Amakna', sub: 'Champs et forêts d’Amakna',
    ground: '#8aa548', ground2: '#7d9840', deco: ['#c8a040', '#4a7a2a', '#e8e090'], decoType: 'field',
    monsters: ['arakne', 'sanglier', 'moskito', 'prespic'], mini: 'black_wabbit', boss: 'dragon_cochon',
    hpMul: 1.8, dmgMul: 1.3, kamas: 1.5, dofus: ['kaliptus', 'dokoko'],
  },
  {
    id: 'abraknydes', x: 50, y: 34, name: 'Forêt des Abraknydes', sub: 'Forêt maléfique',
    ground: '#3f5a32', ground2: '#36502b', deco: ['#2a3f22', '#5a4a3a', '#7a9a50'], decoType: 'forest',
    monsters: ['chafer', 'abraknyde', 'fantome', 'chafer_archer'], mini: 'abrak_ancestral', boss: 'chene_mou',
    hpMul: 3, dmgMul: 1.7, kamas: 2.2, dofus: ['pourpre', 'ocre'],
  },
  {
    id: 'craqueleurs', x: 74, y: 52, name: 'Montagne des Craqueleurs', sub: 'Plaines de Cania',
    ground: '#9a8a6a', ground2: '#8d7d5f', deco: ['#6a6a6a', '#b0a080', '#5a5040'], decoType: 'rock',
    monsters: ['gelee', 'bwork', 'craqueleur', 'bwork_mage'], mini: 'craq_roc', boss: 'craq_legend',
    hpMul: 5, dmgMul: 2.2, kamas: 3, dofus: ['turquoise', 'ivoire'],
  },
  {
    id: 'frigost', x: 80, y: 14, name: 'Frigost', sub: 'Île de Frigost',
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
