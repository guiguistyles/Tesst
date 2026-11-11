'use strict';
// Monde ouvert « Le Réveil des Zaaps » : carte continue des 5 zones, lieux
// (zaaps, personnages, repaires de boss, camps de monstres) et histoire en quêtes.
// Coordonnées en pixels de jeu (32 px = 1 m). Les zones se suivent d'ouest en est.

const WORLD = (() => {
  const ZONE_W = 3200;            // largeur d'une zone (≈ 100 m)
  const HALF_H = 1100;            // demi-hauteur du monde (≈ 34 m de chaque côté)
  const zones = ZONES.map((z, i) => ({ ...z, idx: i, x0: i * ZONE_W, x1: (i + 1) * ZONE_W }));

  // Graine déterministe : le monde est identique à chaque partie
  function rng(seed) {
    let t = seed >>> 0;
    return () => { t += 0x6d2b79f5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
  }

  // Personnages de l'histoire (apparence empruntée à un héros de classe)
  const NPCS = [
    { name: 'Oriel', title: 'Gardien des zaaps', look: 'xelor' },
    { name: 'Margot', title: 'Fermière d’Amakna', look: 'eniripsa' },
    { name: 'Sylvain', title: 'Druide de la forêt', look: 'sadida' },
    { name: 'Brakk', title: 'Mineur des Craqueleurs', look: 'enutrof' },
    { name: 'Neva', title: 'Exploratrice de Frigost', look: 'cra' },
  ];

  // Lieux fixes de chaque zone
  zones.forEach((z, i) => {
    z.zaap = { x: z.x0 + 260, y: 0 };
    z.npc = { ...NPCS[i], x: z.x0 + 500, y: -30, zone: i };
    z.lair = { id: z.mini, x: z.x0 + ZONE_W * 0.55, y: i % 2 ? 620 : -620, respawn: 120 };
    z.arena = { id: z.boss, x: z.x1 - 420, y: 0, respawn: 300 };
    // Camps de monstres, placés à l'écart des lieux importants
    const r = rng(1000 + i * 77);
    z.camps = [];
    const avoid = [z.zaap, z.npc, z.lair, z.arena];
    let tries = 0;
    while (z.camps.length < 22 && tries++ < 2000) {
      const x = z.x0 + 220 + r() * (ZONE_W - 440), y = -HALF_H + 180 + r() * (HALF_H * 2 - 360);
      if (avoid.some((a) => Math.hypot(a.x - x, a.y - y) < 520)) continue;
      if (z.camps.some((c) => Math.hypot(c.x - x, c.y - y) < 330)) continue;
      const main = z.monsters[(r() * z.monsters.length) | 0], second = z.monsters[(r() * z.monsters.length) | 0];
      const n = 3 + ((r() * 3) | 0) + (i > 2 ? 1 : 0);
      const ids = [];
      for (let k = 0; k < n; k++) ids.push(k < n - 1 ? main : second);
      z.camps.push({ x, y, ids, zone: i });
    }
  });

  /* ---------------------------------------------------------------- Histoire */
  // goal : { kill: id, n } ou { boss: id }. Le premier quête de chaque zone se reçoit en parlant au personnage.
  const Q = (zone, title, goal, intro, done, xp, kamas) => ({ zone, title, goal, intro, done, xp, kamas });
  const QUESTS = [
    Q(0, 'Premiers pas', { kill: 'bouftou', n: 8 },
      ['Ah, enfin quelqu’un ! Je suis Oriel, le dernier gardien des zaaps.',
       'Une brume noire monte des glaces de Frigost. Elle éteint nos zaaps un à un et rend les créatures folles.',
       'Les bouftous d’Astrub attaquent déjà les voyageurs. Montre-moi ce que tu vaux : chasse 8 bouftous.'],
      ['Joli travail ! Mais la brume a touché plus haut…'], 60, 40),
    Q(0, 'Le roi des tofus', { boss: 'tofu_royal' },
      ['Le Tofu Royal s’est terré dans son nid, plus loin dans la plaine. Ses yeux brillent de brume.',
       'Va le calmer avant qu’il n’entraîne tous les tofus avec lui.'],
      ['Le Tofu Royal est retombé dans un profond sommeil. La brume recule un peu.'], 140, 80),
    Q(0, 'Le Bouftou Royal', { boss: 'bouftou_royal' },
      ['La brume vient du Bouftou Royal, au bout d’Astrub. Tant qu’il garde le passage, le chemin d’Amakna reste scellé.',
       'Bats-le et la barrière tombera.'],
      ['La barrière d’Amakna s’est dissipée ! Rejoins Margot à la ferme, elle a besoin d’aide.'], 260, 150),

    Q(1, 'Invasion d’araknes', { kill: 'arakne', n: 10 },
      ['Tu viens d’Astrub ? Oriel m’a parlé de toi. Moi c’est Margot.',
       'Depuis que la brume est là, les araknes envahissent mes champs. Débarrasse-moi de 10 d’entre elles !'],
      ['Mes champs respirent enfin. Merci, l’ami !'], 200, 110),
    Q(1, 'Le Black Wabbit', { boss: 'black_wabbit' },
      ['Le Black Wabbit a pris possession d’un terrier, au cœur de la plaine. Il vole toutes mes cawottes !'],
      ['Mes cawottes sont sauvées ! Il reste le pire…'], 320, 180),
    Q(1, 'Le Dragon Cochon', { boss: 'dragon_cochon' },
      ['Un Dragon Cochon corrompu crache du feu au bout d’Amakna. C’est lui qui scelle la route de la forêt.'],
      ['Le Dragon Cochon est vaincu ! La forêt des Abraknydes s’ouvre. Sylvain le druide t’y attend.'], 480, 260),

    Q(2, 'Les os qui marchent', { kill: 'chafer', n: 12 },
      ['La forêt souffre… Je suis Sylvain. La brume réveille les chafers enterrés sous les racines.',
       'Renvoie 12 chafers à leur repos éternel.'],
      ['Les morts se taisent. Mais les arbres, eux, grondent encore.'], 380, 200),
    Q(2, 'L’Abraknyde Ancestral', { boss: 'abrak_ancestral' },
      ['Le plus vieil arbre de la forêt, l’Abraknyde Ancestral, est devenu fou. Apaise-le.'],
      ['L’Ancestral s’est rendormi. Il ne reste que le Chêne Mou.'], 560, 300),
    Q(2, 'Le Chêne Mou', { boss: 'chene_mou' },
      ['Au fond de la forêt, le Chêne Mou pourrit sous la brume. Il bloque le chemin des montagnes.'],
      ['La forêt est libérée ! Monte vers les Craqueleurs, Brakk le mineur te guidera.'], 760, 400),

    Q(3, 'Pierres vivantes', { kill: 'craqueleur', n: 10 },
      ['Hé, toi ! Brakk, mineur. Les craqueleurs se sont réveillés et écrasent mes galeries.',
       'Casse-m’en 10 et on causera.'],
      ['Ha ! Voilà du solide.'], 620, 320),
    Q(3, 'Le Craqueleur des Plaines', { boss: 'craq_roc' },
      ['Un Craqueleur géant sème la panique dans la plaine de Cania. Arrête-le.'],
      ['Il ne bougera plus. Reste le Légendaire, là-haut…'], 840, 420),
    Q(3, 'Le Craqueleur Légendaire', { boss: 'craq_legend' },
      ['Le Craqueleur Légendaire garde le col vers Frigost. La brume en a fait une montagne de colère.'],
      ['Le col est ouvert ! Frigost t’attend. Neva l’exploratrice campe près du zaap.'], 1100, 560),

    Q(4, 'Le froid mordant', { kill: 'mansot', n: 12 },
      ['Brr… Je suis Neva. La brume naît ici, sous la glace. Les mansots sont devenus agressifs.',
       'Ouvre-nous un passage : 12 mansots.'],
      ['Le chemin se dégage. Je sens la brume plus épaisse au nord.'], 900, 460),
    Q(4, 'Le Mansot Royal', { boss: 'mansot_royal' },
      ['Le Mansot Royal règne sur la banquise et protège la source de la brume. Fais-le tomber.'],
      ['Plus rien ne protège l’Obsidiantre…'], 1200, 600),
    Q(4, 'L’Obsidiantre', { boss: 'obsidiantre' },
      ['L’Obsidiantre, cœur d’obsidienne né de la brume, se dresse au bout du monde.',
       'Si tu le brises, tous les zaaps se rallumeront.'],
      ['La brume se dissipe ! Partout, les zaaps se rallument. Le Monde des Douze te doit beaucoup, héros.',
       'Tu peux continuer à explorer : les camps et les gardiens reviennent toujours…'], 2000, 1200),
  ];

  /** Zone à une abscisse donnée. */
  function zoneAt(x) { return zones[Math.max(0, Math.min(zones.length - 1, Math.floor(x / ZONE_W)))]; }
  /** Nombre de zones accessibles selon l'avancée de l'histoire (une barrière tombe après chaque gardien). */
  function unlockedZones(questIdx) { return Math.min(zones.length, 1 + Math.floor(questIdx / 3)); }

  return { ZONE_W, HALF_H, WIDTH: ZONE_W * zones.length, zones, QUESTS, NPCS, zoneAt, unlockedZones };
})();
