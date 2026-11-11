'use strict';
// Aventure « Le Réveil des Zaaps » : une carte ouverte par zone (zaap, personnage,
// camps de monstres, repaire du boss intermédiaire, entrée du donjon), un donjon par
// zone avec le gardien au fond, l'histoire en quêtes et l'équipement lâché par les monstres.
// Coordonnées en pixels de jeu (32 px = 1 m), origine à l'ouest de chaque carte.

const WORLD = (() => {
  const MAP_W = 4800, MAP_H = 1300;   // carte de zone : 150 m × 81 m
  const DJ_W = 3000, DJ_H = 380;      // donjon : long couloir de 94 m × 24 m
  // Niveaux des monstres de chaque zone (min, max). Le donjon est un peu au-dessus.
  const LEVELS = [[1, 8], [10, 18], [20, 28], [30, 38], [40, 50]];

  function rng(seed) {
    let t = seed >>> 0;
    return () => { t += 0x6d2b79f5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
  }

  const NPCS = [
    { name: 'Oriel', title: 'Gardien des zaaps', look: 'xelor' },
    { name: 'Margot', title: 'Fermière d’Amakna', look: 'eniripsa' },
    { name: 'Sylvain', title: 'Druide de la forêt', look: 'sadida' },
    { name: 'Brakk', title: 'Mineur des Craqueleurs', look: 'enutrof' },
    { name: 'Neva', title: 'Exploratrice de Frigost', look: 'cra' },
  ];
  const DUNGEONS = ['Bergerie du Bouftou Royal', 'Porcherie du Dragon Cochon', 'Cœur pourri du Chêne Mou', 'Antre du Craqueleur Légendaire', 'Caverne d’obsidienne'];

  const zones = ZONES.map((z, i) => {
    const r = rng(1000 + i * 77);
    const [l0, l1] = LEVELS[i];
    const m = {
      key: 'z' + i, kind: 'zone', zone: i, name: z.name, w: MAP_W, h: MAP_H, lvl: LEVELS[i], decoType: z.decoType,
      zaap: { x: 300, y: 0 },
      npc: { ...NPCS[i], x: 540, y: -30 },
      lair: { id: z.mini, kind: 'mini', x: MAP_W * 0.55, y: i % 2 ? 720 : -720, respawn: 150, lvl: l1 + 1 },
      door: { x: MAP_W - 260, y: 0 },
      camps: [],
    };
    // Camps de monstres : plus on va vers l'est (vers le donjon), plus ils sont forts
    const avoid = [m.zaap, m.npc, m.lair, m.door];
    let tries = 0;
    while (m.camps.length < 26 && tries++ < 3000) {
      const x = 260 + r() * (MAP_W - 520), y = -MAP_H + 200 + r() * (MAP_H * 2 - 400);
      if (avoid.some((a) => Math.hypot(a.x - x, a.y - y) < 560)) continue;
      if (m.camps.some((c) => Math.hypot(c.x - x, c.y - y) < 360)) continue;
      const main = z.monsters[(r() * z.monsters.length) | 0], second = z.monsters[(r() * z.monsters.length) | 0];
      const n = 3 + ((r() * 3) | 0);
      const ids = [];
      for (let k = 0; k < n; k++) ids.push(k < n - 1 ? main : second);
      const lvl = Math.min(l1, l0 + Math.floor((x / MAP_W) * (l1 - l0 + 1) + r() * 1.5));
      m.camps.push({ x, y, ids, lvl });
    }
    // Donjon : quatre salles de monstres puis le gardien
    const d = {
      key: 'd' + i, kind: 'dungeon', zone: i, name: DUNGEONS[i], w: DJ_W, h: DJ_H, lvl: [l1, l1 + 3],
      exit: { x: 170, y: 0 },
      boss: { id: z.boss, kind: 'boss', x: DJ_W - 330, y: 0, respawn: Infinity, lvl: l1 + 4 },
      camps: [],
    };
    [700, 1150, 1600, 2050].forEach((x, k) => {
      const ids = [];
      const n = 5 + (k > 1 ? 1 : 0);
      for (let j = 0; j < n; j++) ids.push(z.monsters[(j + k) % z.monsters.length]);
      d.camps.push({ x, y: k % 2 ? 110 : -110, ids, lvl: l1 + 1 + (k >> 1) });
    });
    m.dungeon = d;
    return m;
  });

  /* ---------------------------------------------------------------- Histoire */
  // goal : { kill: id, n } ou { boss: id }. La première quête de chaque zone se reçoit en parlant au personnage.
  const Q = (zone, title, goal, intro, done, xp, kamas) => ({ zone, title, goal, intro, done, xp, kamas });
  const QUESTS = [
    Q(0, 'Premiers pas', { kill: 'bouftou', n: 8 },
      ['Ah, enfin quelqu’un ! Je suis Oriel, le dernier gardien des zaaps.',
       'Une brume noire monte des glaces de Frigost. Elle éteint nos zaaps un à un et rend les créatures folles.',
       'Les bouftous d’Astrub attaquent déjà les voyageurs. Montre-moi ce que tu vaux : chasse 8 bouftous.'],
      ['Joli travail ! Garde l’équipement que tu trouves sur les monstres, il te sera utile.'], 60, 40),
    Q(0, 'Le roi des tofus', { boss: 'tofu_royal' },
      ['Le Tofu Royal s’est terré dans son nid, au milieu de la plaine. Ses yeux brillent de brume.',
       'Va le calmer avant qu’il n’entraîne tous les tofus avec lui.'],
      ['Le Tofu Royal est retombé dans un profond sommeil. La brume recule un peu.'], 140, 80),
    Q(0, 'La Bergerie maudite', { boss: 'bouftou_royal' },
      ['La brume vient du Bouftou Royal. Il s’est retranché au fond de sa bergerie, tout à l’est d’Astrub.',
       'Entre dans le donjon et bats-le : la route d’Amakna s’ouvrira.'],
      ['Le Bouftou Royal est tombé ! La route d’Amakna est ouverte. Margot, à la ferme, a besoin d’aide.'], 260, 150),

    Q(1, 'Invasion d’araknes', { kill: 'arakne', n: 10 },
      ['Tu viens d’Astrub ? Oriel m’a parlé de toi. Moi c’est Margot.',
       'Ici les bêtes sont bien plus coriaces qu’à Astrub. Les araknes envahissent mes champs : débarrasse-moi de 10 d’entre elles !'],
      ['Mes champs respirent enfin. Merci, l’ami !'], 200, 110),
    Q(1, 'Le Black Wabbit', { boss: 'black_wabbit' },
      ['Le Black Wabbit a pris possession d’un terrier, au cœur de la plaine. Il vole toutes mes cawottes !'],
      ['Mes cawottes sont sauvées ! Il reste le pire…'], 320, 180),
    Q(1, 'La Porcherie', { boss: 'dragon_cochon' },
      ['Un Dragon Cochon corrompu s’est installé dans la vieille porcherie, à l’est. C’est lui qui scelle la route de la forêt.'],
      ['Le Dragon Cochon est vaincu ! La forêt des Abraknydes s’ouvre. Sylvain le druide t’y attend.'], 480, 260),

    Q(2, 'Les os qui marchent', { kill: 'chafer', n: 12 },
      ['La forêt souffre… Je suis Sylvain. La brume réveille les chafers enterrés sous les racines.',
       'Renvoie 12 chafers à leur repos éternel.'],
      ['Les morts se taisent. Mais les arbres, eux, grondent encore.'], 380, 200),
    Q(2, 'L’Abraknyde Ancestral', { boss: 'abrak_ancestral' },
      ['Le plus vieil arbre de la forêt, l’Abraknyde Ancestral, est devenu fou. Apaise-le.'],
      ['L’Ancestral s’est rendormi. Il ne reste que le Chêne Mou.'], 560, 300),
    Q(2, 'Le Cœur pourri', { boss: 'chene_mou' },
      ['Au fond de la forêt, le Chêne Mou pourrit sous la brume. Ses racines forment un donjon : descends-y.'],
      ['La forêt est libérée ! Monte vers les Craqueleurs, Brakk le mineur te guidera.'], 760, 400),

    Q(3, 'Pierres vivantes', { kill: 'craqueleur', n: 10 },
      ['Hé, toi ! Brakk, mineur. Les craqueleurs se sont réveillés et écrasent mes galeries.',
       'Casse-m’en 10 et on causera.'],
      ['Ha ! Voilà du solide.'], 620, 320),
    Q(3, 'Le Craqueleur des Plaines', { boss: 'craq_roc' },
      ['Un Craqueleur géant sème la panique dans la plaine de Cania. Arrête-le.'],
      ['Il ne bougera plus. Reste le Légendaire, dans son antre…'], 840, 420),
    Q(3, 'L’Antre du Légendaire', { boss: 'craq_legend' },
      ['Le Craqueleur Légendaire garde le col vers Frigost, au fond de son antre. La brume en a fait une montagne de colère.'],
      ['Le col est ouvert ! Frigost t’attend. Neva l’exploratrice campe près du zaap.'], 1100, 560),

    Q(4, 'Le froid mordant', { kill: 'mansot', n: 12 },
      ['Brr… Je suis Neva. La brume naît ici, sous la glace. Les mansots sont devenus agressifs.',
       'Ouvre-nous un passage : 12 mansots.'],
      ['Le chemin se dégage. Je sens la brume plus épaisse à l’est.'], 900, 460),
    Q(4, 'Le Mansot Royal', { boss: 'mansot_royal' },
      ['Le Mansot Royal règne sur la banquise et protège la source de la brume. Fais-le tomber.'],
      ['Plus rien ne protège l’Obsidiantre…'], 1200, 600),
    Q(4, 'La Caverne d’obsidienne', { boss: 'obsidiantre' },
      ['L’Obsidiantre, cœur d’obsidienne né de la brume, se dresse au fond de sa caverne.',
       'Si tu le brises, tous les zaaps se rallumeront.'],
      ['La brume se dissipe ! Partout, les zaaps se rallument. Le Monde des Douze te doit beaucoup, héros.',
       'Tu peux continuer à explorer : les monstres et les gardiens reviennent toujours…'], 2000, 1200),
  ];

  /** Zone accessible : la première, ou celle dont le gardien précédent est vaincu. */
  function unlocked(i, bossKilled) { return i === 0 || !!bossKilled[ZONES[i - 1].boss]; }

  /* ---------------------------------------------------------------- Équipement */
  const SLOTS = {
    arme: { label: 'Arme', names: ['Épée', 'Hache', 'Marteau', 'Bâton', 'Dague', 'Arc'], main: 'dmg', sub: 'crit' },
    coiffe: { label: 'Coiffe', names: ['Coiffe', 'Chapeau', 'Casque'], main: 'hp', sub: 'armor' },
    cape: { label: 'Cape', names: ['Cape', 'Capuche'], main: 'speed', sub: 'cd' },
    amulette: { label: 'Amulette', names: ['Amulette', 'Collier'], main: 'cd', sub: 'dmg' },
    anneau: { label: 'Anneau', names: ['Anneau', 'Bague'], main: 'crit', sub: 'dmg' },
    bottes: { label: 'Bottes', names: ['Bottes', 'Sandales'], main: 'speed', sub: 'hp' },
  };
  const SETS = ['du Bouftou', 'du Sanglier', 'de l’Abraknyde', 'du Craqueleur', 'du Mansot'];
  const STATS = {
    dmg: { base: 0.05, label: 'dégâts' }, hp: { base: 0.06, label: 'vie' }, speed: { base: 0.02, label: 'vitesse' },
    crit: { base: 0.012, label: 'critique' }, cd: { base: 0.02, label: 'recharge', minus: true }, armor: { base: 0.015, label: 'résistance' },
  };
  const RARITY = [
    { id: 'commun', name: 'Commun', color: '#d0d0d0', mul: 1, w: 62 },
    { id: 'rare', name: 'Rare', color: '#4fc3f7', mul: 1.35, w: 27 },
    { id: 'epique', name: 'Épique', color: '#b46cff', mul: 1.75, w: 9 },
    { id: 'legendaire', name: 'Légendaire', color: '#ffb347', mul: 2.3, w: 2 },
  ];

  /** Objet tiré au hasard : sa force dépend du niveau du monstre et de sa rareté. minRarity : 0 à 3. */
  function makeItem(lvl, zone, minRarity = 0) {
    const ids = Object.keys(SLOTS), slot = ids[(Math.random() * ids.length) | 0], s = SLOTS[slot];
    let roll = Math.random() * 100, ri = 0;
    for (; ri < RARITY.length - 1; ri++) { if (roll < RARITY[ri].w) break; roll -= RARITY[ri].w; }
    ri = Math.max(ri, minRarity);
    const rar = RARITY[ri];
    const k = (0.6 + lvl / 8) * rar.mul;
    const stats = {};
    const val = (st, f) => Math.round(STATS[st].base * k * f * (0.85 + Math.random() * 0.3) * 1000) / 1000;
    stats[s.main] = val(s.main, 1);
    stats[s.sub] = (stats[s.sub] || 0) + val(s.sub, 0.5);
    if (ri >= 2) { const extra = Object.keys(STATS)[(Math.random() * 6) | 0]; stats[extra] = (stats[extra] || 0) + val(extra, 0.4); }
    // Plafonds pour éviter les excès (recharge et critique)
    if (stats.cd) stats.cd = Math.min(stats.cd, 0.3);
    if (stats.crit) stats.crit = Math.min(stats.crit, 0.25);
    const name = s.names[(Math.random() * s.names.length) | 0] + ' ' + SETS[Math.min(4, zone)];
    return { slot, name, rarity: rar.id, color: rar.color, lvl, stats, power: itemPower(stats) };
  }
  function itemPower(stats) { let p = 0; for (const k in stats) p += stats[k] / STATS[k].base; return Math.round(p * 10) / 10; }
  function itemDesc(it) {
    return Object.keys(it.stats).map((k) => `${STATS[k].minus ? '−' : '+'}${Math.round(it.stats[k] * 1000) / 10}% ${STATS[k].label}`).join(' · ');
  }

  return { zones, QUESTS, NPCS, LEVELS, unlocked, SLOTS, RARITY, makeItem, itemDesc };
})();
