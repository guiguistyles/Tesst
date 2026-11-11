'use strict';
// Rendu 3D du jeu (Three.js r128). La logique reste dans game.js : ce module
// ne fait que dessiner l'état de la partie. Pour tenir des centaines de
// monstres, tout ce qui est nombreux est dessiné par lots (InstancedMesh) :
// un lot par type de monstre, par forme de projectile, pour les cristaux…
// Les effets peu nombreux (objets qui tombent du ciel, glyphes, pièges,
// invocations) utilisent des réserves de modèles construits avec js/models.

const Render3D = (() => {
  const U = 32;                  // pixels de jeu par mètre
  const TILE = 3;                // taille d'une case du damier au sol (m)
  const TILES = 26;              // cases de chaque côté du joueur
  const TILT = THREE.MathUtils.degToRad(52); // inclinaison de la caméra (vue 3/4 fixe)
  const FOV = 30;

  let ready = false, renderer, scene, camera, sun, canvas;
  let W = 1, H = 1, zoom = 1;
  let time = 0;

  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler();
  const tmpP = new THREE.Vector3(), tmpS = new THREE.Vector3(), tmpC = new THREE.Color(), WHITE = new THREE.Color(0xffffff);
  const lerpN = (a, b, k) => a + (b - a) * k;
  const smooth = (k) => k * k * (3 - 2 * k);

  // ---------------------------------------------------------------- Lots d'instances
  /** Lot d'objets identiques : on remplit `n` instances par image puis commit(). */
  function batch(geo, material, cap, shadow = true) {
    const m = new THREE.InstancedMesh(geo, material, cap);
    m.castShadow = shadow;
    m.receiveShadow = false;
    m.frustumCulled = false;
    for (let i = 0; i < cap; i++) m.setColorAt(i, WHITE);
    m.count = 0;
    scene.add(m);
    return {
      mesh: m, n: 0, cap,
      add(x, y, z, ry, sx, sy, sz, color, rx = 0, rz = 0) {
        if (this.n >= cap) return;
        // Ordre YXZ : inclinaisons dans le repère du modèle, puis orientation
        tmpE.set(rx, ry, rz, 'YXZ');
        tmpQ.setFromEuler(tmpE);
        tmpM.compose(tmpP.set(x, y, z), tmpQ, tmpS.set(sx, sy, sz));
        m.setMatrixAt(this.n, tmpM);
        m.setColorAt(this.n, color);
        this.n++;
      },
      commit() {
        m.count = this.n;
        m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
        this.n = 0;
      },
    };
  }
  const solid = () => new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.8 });
  const glow = (opacity = 1) => new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });
  const up = (g) => { g.translate(0, 0.5, 0); return g; };
  /** Géométrie orientée vers +Z (pointe en avant), pour les projectiles. */
  const forward = (g) => { g.rotateX(Math.PI / 2); return g; };

  let monsters;            // Map id -> lot
  let monsterMat;          // matériau à couleurs par sommet des monstres fusionnés
  const pose = {};
  let projStyles;          // Map forme -> lot
  let eprojB, xpB, coinB, miscB, sparkB, partB;
  let ground, tiles;
  let hero = null;
  let shieldBubble;
  const pools = {};        // modèles réutilisés (effets peu nombreux)
  const parts = [];        // particules de traînée, soins, éclats
  const vfx = [];          // effets de sorts en plusieurs temps (Épée Céleste, impacts…)
  let shake = 0;           // secousse de la caméra (m), qui retombe toute seule
  // Boss du jeu : modèles complets articulés (js/models/bestiaire.js), un par boss présent
  const BOSS_BUILD = {
    tofu_royal: 'buildTofuRoyal', bouftou_royal: 'buildBouftouRoyal', black_wabbit: 'buildBlackWabbit', dragon_cochon: 'buildDragonCochon',
    abrak_ancestral: 'buildAbraknydeAncestral', chene_mou: 'buildCheneMou', craq_roc: 'buildCraqueleurPlaines', craq_legend: 'buildCraqueleurLegendaire',
    mansot_royal: 'buildMansotRoyal', obsidiantre: 'buildObsidiantre',
  };
  const BOSS_ABILITY_TIME = { black_wabbit: 2.8, dragon_cochon: 2.8, abrak_ancestral: 3.2, chene_mou: 3.2 };
  const bossLive = new Map();   // ennemi -> { inst, id, abT, abAt, yaw, x, z }
  const bossFree = {};          // id -> modèles prêts à resservir
  let prevStrikes = new Set();

  // ---------------------------------------------------------------- Formes des projectiles et des sorts
  const PROJ_STYLE = {
    fleche_magique: 'arrow', fleche_explosive: 'arrow', fleche_recul: 'arrow', corbeau_noir: 'arrow',
    aiguille: 'needle', poison_paralysant: 'needle', poison_insidieux: 'dagger',
    mot_blessant: 'orb', lancer_pieces: 'coin', pile_ou_face: 'coin', tromblon: 'pellet', bulle: 'bubble', flasque_explosive: 'flask',
  };
  const STRIKE_STYLE = { colere_iop: 'sword', pluie_fleches: 'arrow', frappe_xelor: 'hand', roulette: 'die', kaboom: 'bomb', ronces: 'thorn' };
  const HERO_BUILD = {
    iop: 'buildModoIop', cra: 'buildModoCra', feca: 'buildModoFeca', eniripsa: 'buildModoEniripsa', sram: 'buildModoSram',
    xelor: 'buildModoXelor', osamodas: 'buildModoOsamodas', sacrieur: 'buildModoSacrieur', enutrof: 'buildModoEnutrof',
    roublard: 'buildModoRoublard', ecaflip: 'buildModoEcaflip', pandawa: 'buildModoPandawa', sadida: 'buildModoSadida',
  };
  // Geste du héros et durée (s) selon le type de sort lancé
  const GESTURE_FOR = { epee_celeste: 'strike', colere_iop: 'strike', pelle_jugement: 'strike', tremblement: 'nova' };
  const GESTURE_TIME = { melee: 0.3, projectile: 0.28, strike: 0.5, nova: 0.45, heal: 0.6, shield: 0.5, trap: 0.4, glyph: 0.5 };

  // ---------------------------------------------------------------- Initialisation
  function supported() {
    try {
      const c = document.createElement('canvas');
      return !!(window.THREE && window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch (e) { return false; }
  }

  function init(c) {
    if (ready) return true;
    if (!supported()) return false;
    canvas = c;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(FOV, 1, 0.5, 400);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8478, 0.6));
    sun = new THREE.DirectionalLight(0xffffff, 0.6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 80 });
    sun.shadow.bias = -0.0008;
    scene.add(sun, sun.target);
    scene.fog = new THREE.Fog(0xffffff, 30, 60);

    // Sol : grand plan + damier de losanges qui suit le joueur case par case
    ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0x6a9b45, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    const n = (TILES * 2 + 1) ** 2;
    tiles = new THREE.InstancedMesh(new THREE.BoxGeometry(TILE / Math.SQRT2, 0.02, TILE / Math.SQRT2), new THREE.MeshStandardMaterial({ color: 0x5f8f3e, roughness: 1 }), n);
    tiles.receiveShadow = true;
    let i = 0;
    tmpQ.setFromEuler(tmpE.set(0, Math.PI / 4, 0));
    for (let a = -TILES; a <= TILES; a++) for (let b = -TILES; b <= TILES; b++) {
      tmpM.compose(tmpP.set(a * TILE, 0.01, b * TILE), tmpQ, tmpS.set(1, 1, 1));
      tiles.setMatrixAt(i++, tmpM);
    }
    scene.add(tiles);

    monsters = new Map();
    monsterMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.8 });
    projStyles = new Map();
    eprojB = batch(new THREE.SphereGeometry(1, 8, 6), glow(), 300, false);
    xpB = batch(new THREE.OctahedronGeometry(1, 0), solid(), 500, false);
    coinB = batch(new THREE.CylinderGeometry(1, 1, 0.25, 10), solid(), 200, false);
    miscB = batch(up(new THREE.BoxGeometry(1, 1, 1)), solid(), 40);
    sparkB = batch(new THREE.BoxGeometry(1, 1, 1), glow(), 600, false);
    partB = batch(new THREE.BoxGeometry(1, 1, 1), glow(), 900, false);
    shieldBubble = new THREE.Mesh(new THREE.SphereGeometry(1.15, 18, 12), glow(0.22));
    shieldBubble.material.color.set(0x9fd8ff);
    scene.add(shieldBubble);
    ready = true;
    return true;
  }

  function resize(w, h, dpr, z) {
    W = w; H = h; zoom = z;
    if (!ready) return;
    renderer.setPixelRatio(Math.min(dpr, 1.5));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  /** Lot d'un type de monstre : son modèle fusionné (js/models/monstres.js), ou un cube s'il n'en a pas encore. */
  function monsterBatch(id) {
    let b = monsters.get(id);
    if (!b) {
      const def = typeof MONSTER_MODELS !== 'undefined' && MONSTER_MODELS[id];
      let geo = null;
      if (def) { try { geo = mergeModel(def.build()); } catch (e) { geo = null; } }
      b = batch(geo || up(new THREE.BoxGeometry(1, 1, 1)), geo ? monsterMat : solid(), 420);
      b.model = !!geo;
      b.anim = def ? def.anim : 'walk';
      b.h = geo ? geo.boundingBox.max.y : 1;
      monsters.set(id, b);
    }
    return b;
  }

  function projBatch(style) {
    let b = projStyles.get(style);
    if (b) return b;
    const geo = {
      arrow: forward(new THREE.ConeGeometry(0.5, 1, 4)),
      needle: forward(new THREE.ConeGeometry(0.3, 1, 4)),
      dagger: forward(new THREE.ConeGeometry(0.5, 1, 2)),
      coin: new THREE.CylinderGeometry(0.5, 0.5, 0.15, 10),
      bubble: new THREE.SphereGeometry(0.5, 10, 8),
      pellet: new THREE.SphereGeometry(0.5, 6, 4),
      flask: new THREE.SphereGeometry(0.5, 8, 6),
      orb: new THREE.SphereGeometry(0.5, 8, 6),
    }[style] || new THREE.SphereGeometry(0.5, 8, 6);
    b = batch(geo, style === 'bubble' ? glow(0.55) : glow(), 400, false);
    projStyles.set(style, b);
    return b;
  }

  // ---------------------------------------------------------------- Réserves de modèles (effets peu nombreux)
  function pool(name, make) {
    const p = pools[name] || (pools[name] = { items: [], used: 0, make });
    let m = p.items[p.used];
    if (!m) { m = p.make(); scene.add(m); p.items.push(m); }
    p.used++;
    m.visible = true;
    return m;
  }
  function beginPools() { for (const k in pools) pools[k].used = 0; }
  function endPools() { for (const k in pools) { const p = pools[k]; for (let i = p.used; i < p.items.length; i++) p.items[i].visible = false; } }

  const ring = () => pool('ring', () => new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 6, 32), glow(0.9)));
  const disc = () => pool('disc', () => new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.04, 40), glow(0.3)));
  const wave = () => pool('wave', () => { const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 32, 1, true), glow(0.35)); m.material.side = THREE.DoubleSide; return m; });
  const arcGeos = new Map(), slashGeos = new Map();
  /** Géométries d'arc de mêlée (secteur au sol et lame de lumière), mises en cache par angle. */
  function arcGeo(arc) {
    const key = arc.toFixed(2);
    if (!arcGeos.has(key)) arcGeos.set(key, new THREE.CircleGeometry(1, 16, -arc / 2, arc));
    return arcGeos.get(key);
  }
  function slashGeo(arc) {
    const key = arc.toFixed(2);
    if (!slashGeos.has(key)) slashGeos.set(key, new THREE.TorusGeometry(1, 0.05, 4, 20, arc));
    return slashGeos.get(key);
  }
  const arc = () => pool('arc', () => { const m = new THREE.Mesh(arcGeo(1), glow(0.5)); m.material.side = THREE.DoubleSide; return m; });
  const slash = () => pool('slash', () => new THREE.Mesh(slashGeo(1), glow(0.9)));

  /** Glyphe au sol : disque, anneaux et runes qui tournent. */
  function makeGlyph() {
    const g = new THREE.Group();
    g.userData.disc = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.03, 40), glow(0.25));
    g.userData.ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.04, 6, 40), glow(0.85));
    g.userData.ring.rotation.x = Math.PI / 2;
    g.userData.inner = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.03, 6, 32), glow(0.85));
    g.userData.inner.rotation.x = Math.PI / 2;
    g.add(g.userData.disc, g.userData.ring, g.userData.inner);
    g.userData.runes = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.22), glow(0.9));
      r.position.set(Math.cos(a) * 0.84, 0.03, Math.sin(a) * 0.84);
      r.rotation.y = -a;
      g.add(r);
      g.userData.runes.push(r);
    }
    return g;
  }
  function tintGlyph(g, color, opacity) {
    g.userData.disc.material.color.set(color);
    g.userData.disc.material.opacity = 0.25 * opacity;
    for (const m of [g.userData.ring, g.userData.inner, ...g.userData.runes]) { m.material.color.set(color); m.material.opacity = 0.85 * opacity; }
  }

  // Objets qui tombent du ciel (frappes) ou jaillissent du sol, construits avec js/models
  let modelPalette = null;
  const pal = () => modelPalette || (modelPalette = palette({}));
  const STRIKE_MAKE = {
    sword() { const g = new THREE.Group(); const s = buildSword(pal(), 1.5, mat(0xff7a2a, 0.9)); s.rotation.x = Math.PI; s.position.y = 2.1; g.add(s); g.scale.setScalar(1.9); return g; },
    arrow() {
      const g = new THREE.Group();
      g.add(at(cyl(0.03, 0.03, 1.2, 4, mat(0x5c3a24)), 0, 0.8, 0));
      g.add(at(cone(0.08, 0.25, 4, mat(0xb6e3ff, 0.6)), 0, 0.1, 0, Math.PI));
      for (const r of [0, Math.PI / 2]) g.add(at(box(0.01, 0.2, 0.14, mat(0x3f8f4e)), 0, 1.3, 0, 0, r, 0));
      return g;
    },
    hand() {
      const g = new THREE.Group();
      g.add(at(box(0.16, 1.8, 0.06, mat(0xf2c14e, 0.3)), 0, 1, 0));
      g.add(at(cone(0.16, 0.4, 4, mat(0xffe066, 0.7)), 0, -0.05, 0, Math.PI));
      g.add(at(torus(0.22, 0.05, 6, 16, mat(0xf2c14e, 0.3)), 0, 1.9, 0));
      return g;
    },
    die() {
      const g = new THREE.Group();
      g.add(at(box(0.7, 0.7, 0.7, mat(0xffffff)), 0, 0.35, 0));
      const pip = mat(0xd00000);
      for (const [x, y, z] of [[0, 0.35, 0.36], [0.36, 0.5, 0.15], [0.36, 0.2, -0.15], [-0.36, 0.35, 0], [0, 0.71, 0], [0.15, 0.35, -0.36]]) g.add(at(box(0.1, 0.1, 0.1, pip), x, y, z));
      return g;
    },
    bomb() {
      const g = new THREE.Group();
      g.add(at(sph(0.4, 10, 8, mat(0x22222a)), 0, 0.4, 0));
      g.add(at(cyl(0.04, 0.04, 0.25, 4, mat(0x8a6a3a)), 0, 0.9, 0));
      g.add(at(box(0.12, 0.12, 0.12, mat(0xff8a2a, 0.8)), 0, 1.05, 0));
      return g;
    },
    thorn() {
      const g = new THREE.Group();
      g.add(at(cone(0.22, 1.4, 5, mat(0x2f4a14)), 0, 0.7, 0));
      for (let i = 0; i < 3; i++) g.add(at(cone(0.05, 0.3, 4, mat(0x2f4a14)), (i % 2 ? 1 : -1) * 0.14, 0.35 + i * 0.3, 0, 0, 0, (i % 2 ? -1 : 1) * 1.1));
      g.add(at(cone(0.07, 0.24, 4, mat(0xc8ff7a, 0.6)), 0, 1.45, 0));
      return g;
    },
    orb() { const g = new THREE.Group(); g.add(at(sph(0.35, 10, 8, mat(0xffffff, 0.6)), 0, 0.35, 0)); return g; },
  };
  // Pièges : pièges à pointes (Sram) et bombes à mèche (Roublard)
  function makeSpikeTrap() {
    const g = new THREE.Group();
    g.add(at(box(0.6, 0.08, 0.6, mat(0x4a4260)), 0, 0.04, 0));
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.add(at(cone(0.06, 0.3, 4, mat(0x9a92b0)), Math.cos(a) * 0.2, 0.2, Math.sin(a) * 0.2)); }
    g.userData.gem = at(crystal(0.07, 0.24, mat(0xb07cff, 0.7), 4), 0, 0.25, 0);
    g.add(g.userData.gem);
    return g;
  }
  function makeFuseBomb() {
    const g = new THREE.Group();
    g.add(at(sph(0.3, 10, 8, mat(0x22222a)), 0, 0.3, 0));
    g.add(at(cyl(0.03, 0.03, 0.2, 4, mat(0x8a6a3a)), 0, 0.66, 0));
    g.userData.spark = at(box(0.1, 0.1, 0.1, mat(0xffd84a, 0.9)), 0, 0.8, 0);
    g.add(g.userData.spark);
    return g;
  }
  // Invocations et objets en orbite
  const MINION_MAKE = {
    invoc_bouftou: () => buildBouftou(1.3),
    invoc_tofu: () => { const g = miniTofu(); g.scale.setScalar(1.5); return g; },
    pelle_animee: () => {
      const g = new THREE.Group();
      g.add(at(cyl(0.04, 0.04, 0.9, 6, mat(0x7a5a32)), 0, 0.75, 0));
      g.add(at(box(0.36, 0.42, 0.05, mat(0xb0b8c0)), 0, 0.25, 0));
      for (const s of [-1, 1]) g.add(at(box(0.07, 0.07, 0.02, mat(0x1e1214)), s * 0.07, 0.3, 0.03));
      return g;
    },
    double: () => {
      const g = new THREE.Group();
      const m = new THREE.MeshStandardMaterial({ color: 0x5b4a7a, flatShading: true, transparent: true, opacity: 0.55 });
      g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.35), m), 0, 0.75, 0));
      g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.36), m), 0, 1.35, 0));
      g.add(at(box(0.25, 0.05, 0.02, mat(0xff3b6b, 0.8)), 0, 1.38, 0.19));
      return g;
    },
  };
  const ORBIT_MAKE = {
    epee_jugement: () => { const g = new THREE.Group(); const s = buildSword(pal(), 0.9); s.rotation.z = -Math.PI / 2; g.add(s); g.scale.setScalar(0.55); return g; },
    griffe_joueuse: () => { const g = new THREE.Group(); for (let i = -1; i <= 1; i++) g.add(at(cone(0.06, 0.45, 4, mat(0xf4a3ff, 0.6)), 0, i * 0.12, 0, 0, 0, -Math.PI / 2 + i * 0.2)); return g; },
  };

  // ---------------------------------------------------------------- Particules (traînées, soins, éclats)
  function part(x, y, z, color, o = {}) {
    if (parts.length > 850) return;
    parts.push({ x, y, z, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0, g: o.g || 0, life: o.life || 0.4, max: o.life || 0.4, s: o.s || 0.12, grow: o.grow || 0, color, spin: Math.random() * 6 });
  }
  function updateParts(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dt;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      p.vy -= p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.03) { p.y = 0.03; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; }
      const k = p.life / p.max;
      const s = p.s * Math.min(1, k * 1.5) * (1 + (1 - k) * p.grow);
      partB.add(p.x, p.y, p.z, p.spin + time * 4, s, s, s, tmpC.set(p.color));
    }
    partB.commit();
  }

  // ---------------------------------------------------------------- Héros
  function buildHero(clsId) {
    const cls = CLASSES[clsId];
    let inst = null;
    const fn = HERO_BUILD[clsId] && window[HERO_BUILD[clsId]];
    try { if (typeof fn === 'function') inst = fn({ hero: true }); } catch (e) { inst = null; }
    if (!inst || !inst.rig) {
      // Silhouette de secours si le modèle n'est pas disponible
      const g = new THREE.Group();
      g.add(at(box(0.55, 0.85, 0.4, mat(cls.color)), 0, 0.9, 0));
      g.add(at(box(0.42, 0.42, 0.4, mat(0xf3d1a8)), 0, 1.55, 0));
      inst = { root: g, fx: new THREE.Group(), update() {}, rig: null };
    }
    scene.add(inst.root, inst.fx);
    return { inst, r: inst.rig, t: 0, castN: 0, castT: 99, castType: null, aim: null, yaw: 0, lastWalk: 0 };
  }

  /** Geste d'attaque ou de sort, appliqué par-dessus l'animation de marche ou de repos. */
  function gesture(r, type, k) {
    const s = Math.sin(k * Math.PI), e = smooth(k);
    switch (type) {
      case 'melee':
        r.armR.shoulder.rotation.x = lerpN(-2.5, 0.3, e);
        r.armR.shoulder.rotation.y = -0.6 * s;
        r.armR.elbow.rotation.x = -0.2;
        r.torso.rotation.y = 0.7 * (0.5 - e);
        break;
      case 'projectile':
        r.armR.shoulder.rotation.x = -1.55 * s - 0.1;
        r.armR.elbow.rotation.x = -0.4 * (1 - s);
        r.armL.shoulder.rotation.x = -1.2 * s;
        r.torso.rotation.y = -0.25 * s;
        break;
      case 'strike':
        r.armR.shoulder.rotation.x = -2.9 * s;
        r.armL.shoulder.rotation.x = -2.5 * s;
        r.head.rotation.x = -0.4 * s;
        break;
      case 'nova':
        r.armL.shoulder.rotation.z = 0.18 + 1.6 * s;
        r.armR.shoulder.rotation.z = -0.18 - 1.6 * s;
        r.hips.position.y = 1.05 - 0.1 * s;
        break;
      case 'heal': case 'shield':
        r.armL.shoulder.rotation.set(-2.3 * s, 0, 0.18 + 0.6 * s);
        r.armR.shoulder.rotation.set(-2.3 * s, 0, -0.18 - 0.6 * s);
        r.head.rotation.x = -0.3 * s;
        break;
      case 'trap': case 'glyph':
        r.torso.rotation.x = 0.5 * s;
        r.armR.shoulder.rotation.x = -1.2 * s;
        r.hips.position.y = 1.05 - 0.15 * s;
        r.legL.knee.rotation.x = r.legR.knee.rotation.x = 0.6 * s;
        break;
    }
  }

  function updateHero(S, dt) {
    const p = S.p, h = hero;
    const moving = p.walk !== h.lastWalk;
    h.lastWalk = p.walk;
    h.t += dt;
    h.inst.update(moving ? 'move' : 'idle', h.t, dt);
    // Nouveau sort lancé : geste + effet propre au type
    const lc = S.lastCast;
    if (lc && lc.n !== h.castN) {
      h.castN = lc.n;
      h.castT = 0;
      h.castType = GESTURE_FOR[lc.id] || lc.type;
      h.aim = lc.aim;
      onCast(S, lc);
    }
    h.castT += dt;
    const dur = GESTURE_TIME[h.castType] || 0.3;
    const casting = h.castT < dur;
    if (casting && h.r) gesture(h.r, h.castType, h.castT / dur);
    // Le héros regarde sa cible pendant un sort, sinon la direction de marche
    const want = casting && h.aim != null ? Math.atan2(Math.cos(h.aim), Math.sin(h.aim)) : Math.atan2(p.dirX, p.dirY);
    let d = want - h.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    h.yaw += d * Math.min(1, dt * (casting ? 25 : 12));
    const shake = p.hurt > 0 ? Math.sin(time * 90) * 0.06 : 0;
    h.inst.root.position.set(p.x / U + shake, 0, p.y / U);
    h.inst.root.rotation.y = h.yaw;
    shieldBubble.visible = p.shield > 0;
    if (shieldBubble.visible) {
      shieldBubble.position.set(p.x / U, 1, p.y / U);
      shieldBubble.material.opacity = 0.18 + 0.06 * Math.sin(time * 5);
    }
  }

  /** Effets ponctuels au lancement d'un sort (soin, bouclier, onde…). */
  function onCast(S, lc) {
    const p = S.p, x = p.x / U, z = p.y / U;
    const col = SPELLS[lc.id] ? SPELLS[lc.id].color : '#ffffff';
    if (lc.type === 'heal') {
      for (let i = 0; i < 14; i++) {
        const a = Math.random() * Math.PI * 2, r = 0.3 + Math.random() * 0.8;
        part(x + Math.cos(a) * r, 0.3 + Math.random() * 0.6, z + Math.sin(a) * r, '#7dff9a', { vy: 1.2 + Math.random(), life: 0.9, s: 0.14 });
      }
    } else if (lc.type === 'shield') {
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        part(x + Math.cos(a) * 1.1, 0.2, z + Math.sin(a) * 1.1, col, { vy: 1.8, life: 0.6, s: 0.1 });
      }
    } else if (lc.id === 'epee_celeste') {
      const sp = S.spells.find((q) => q.id === lc.id);
      vfxEpeeCeleste(x, z, sp ? (sp.s.radius * S.stats.area) / U : 3, hero ? hero.yaw : 0);
    } else if (lc.type === 'glyph' || lc.type === 'nova') {
      const sp = S.spells.find((q) => q.id === lc.id);
      const r = sp && sp.s.radius ? (sp.s.radius * S.stats.area) / U : 2.5;
      burst(x, 0.3, z, [col, '#ffffff'], 16, { speed: r * 1.6, up: 2.5, s: 0.1, life: 0.55 });
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        part(x + Math.cos(a) * r * 0.9, 0.1, z + Math.sin(a) * r * 0.9, col, { vy: 2.4, life: 0.45, s: 0.1 });
      }
    }
  }

  // ---------------------------------------------------------------- Effets de sorts détaillés
  // Géométries partagées par les effets (créées une fois)
  const G = {};
  const geo = (k, make) => G[k] || (G[k] = make());
  const RING_G = () => geo('ring', () => new THREE.TorusGeometry(1, 0.06, 6, 40));
  const TUBE_G = () => geo('tube', () => new THREE.CylinderGeometry(1, 1, 1, 18, 1, true));
  const DISC_G = () => geo('disc', () => new THREE.CylinderGeometry(1, 1, 0.03, 40));
  const CRACK_G = () => geo('crack', () => { const g = new THREE.BoxGeometry(1, 0.05, 0.12); g.translate(0.5, 0, 0); return g; });

  /** Maillage lumineux propre à un effet (sa transparence s'anime), retiré à la fin de l'effet. */
  function fxMesh(g, color, opacity, list) {
    const m = new THREE.Mesh(g, glow(opacity));
    m.material.color.set(color);
    m.material.transparent = true;
    m.material.depthWrite = false;
    if (g === TUBE_G()) m.material.side = THREE.DoubleSide;
    scene.add(m);
    list.push(m);
    return m;
  }
  function dropMeshes(list) { for (const m of list) { scene.remove(m); m.material.dispose(); } list.length = 0; }
  // Modèles réutilisés d'un effet à l'autre (épées célestes, épée plantée…)
  const free = {};
  function take(name, make) { const l = free[name] || (free[name] = []); const m = l.pop() || make(); m.visible = true; scene.add(m); return m; }
  function give(name, m) { scene.remove(m); (free[name] || (free[name] = [])).push(m); }
  /** Effet en plusieurs temps : tick(k, t) de 0 à life secondes, puis cleanup(). */
  function addVfx(life, tick, cleanup) { vfx.push({ t: 0, life, tick, cleanup }); }
  function updateVfx(dt) {
    for (let i = vfx.length - 1; i >= 0; i--) {
      const v = vfx[i];
      v.t += dt;
      v.tick(Math.min(1, v.t / v.life), v.t);
      if (v.t >= v.life) { v.cleanup && v.cleanup(); vfx.splice(i, 1); }
    }
  }
  function burst(x, y, z, colors, n, o = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = (o.speed || 3) * (0.5 + Math.random() * 0.7);
      part(x, y, z, colors[i % colors.length], { vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: (o.up || 3) * (0.5 + Math.random()), g: o.g ?? 9, life: (o.life || 0.7) * (0.7 + Math.random() * 0.5), s: o.s || 0.1, grow: o.grow || 0 });
    }
  }
  /** Anneau qui s'élargit au sol, onde verticale optionnelle. */
  function shockwave(x, z, r, color, life = 0.6, withWall = true) {
    const meshes = [];
    const rg = fxMesh(RING_G(), color, 0.95, meshes);
    rg.rotation.x = Math.PI / 2;
    rg.position.set(x, 0.08, z);
    const wall = withWall ? fxMesh(TUBE_G(), color, 0.4, meshes) : null;
    addVfx(life, (k) => {
      const rr = r * (0.2 + smooth(k) * 1.1);
      rg.scale.setScalar(rr);
      rg.material.opacity = 0.95 * (1 - k);
      if (wall) { wall.scale.set(rr, 0.9 * (1 - k) + 0.05, rr); wall.position.set(x, 0.45 * (1 - k), z); wall.material.opacity = 0.4 * (1 - k); }
    }, () => dropMeshes(meshes));
  }

  const makeCelesteSword = () => (typeof buildEpeeCeleste === 'function' ? buildEpeeCeleste() : buildSword(pal(), 2.6));
  const SPHERE_G = () => geo('sphere', () => new THREE.SphereGeometry(1, 20, 14));
  const STREAK_G = () => geo('streak', () => new THREE.BoxGeometry(1, 1, 1));

  /**
   * IOP — Épée Céleste : une grande épée de lumière tombe du ciel devant le héros.
   * 1. le ciel s'ouvre (rayon + glyphe) et l'épée se matérialise tout en haut ;
   * 2. elle plonge en accélérant, avec une traînée de lumière ;
   * 3. impact : éclair en dôme, rayons au sol, ondes de choc, étincelles et plumes, secousse ;
   * 4. elle reste plantée en pulsant puis se dissout en lumière vers le ciel.
   */
  function vfxEpeeCeleste(hx, hz, r, yaw) {
    const x = hx + Math.sin(yaw) * 1.1, z = hz + Math.cos(yaw) * 1.1;
    const meshes = [];
    const sword = take('epee_celeste', makeCelesteSword);
    sword.rotation.set(0, yaw + Math.PI / 2, 0);
    const glyph = take('celeste_glyphe', makeGlyph);
    glyph.position.set(hx, 0.05, hz);
    glyph.scale.set(r, 1, r);
    const beam = fxMesh(TUBE_G(), '#bfefff', 0, meshes);
    const beamCore = fxMesh(TUBE_G(), '#ffffff', 0, meshes);
    const streak = fxMesh(STREAK_G(), '#dff8ff', 0, meshes);
    const dome = fxMesh(SPHERE_G(), '#fff6c8', 0, meshes);
    const rays = [];
    const T_FALL = 0.4, T_HIT = 0.58, LIFE = 1.55;
    const SKY = 7.5; // assez bas pour voir l'épée se former dans le champ de la caméra
    let hit = false;
    addVfx(LIFE, (k, t) => {
      // 1–2 : apparition puis chute
      let y;
      if (t < T_FALL) y = SKY - t * 1.5;
      else if (t < T_HIT) { const f = (t - T_FALL) / (T_HIT - T_FALL); y = (SKY - T_FALL * 1.5) * (1 - f * f); }
      else y = -0.5 - Math.max(0, t - 1.15) * 0.8;
      const appear = Math.min(1, t / 0.2);
      const dissolve = t > 1.15 ? Math.max(0.01, 1 - (t - 1.15) / (LIFE - 1.15)) : 1;
      sword.position.set(x, y, z);
      const SZ = 1.4; // l'épée fait environ 5,5 m
      sword.scale.set(SZ * appear * (t > 1.15 ? 1 + (1 - dissolve) * 0.3 : 1), SZ * appear * dissolve, SZ * appear * (t > 1.15 ? 1 + (1 - dissolve) * 0.3 : 1));
      sword.rotation.y = yaw + Math.PI / 2 + (t < T_FALL ? (T_FALL - t) * 4 : 0);
      // Rayon de lumière qui tombe du ciel sur le point d'impact
      const beamK = t < T_HIT ? Math.min(1, t / 0.25) : Math.max(0, 1 - (t - T_HIT) / 0.35);
      beam.position.set(x, SKY / 2 + 1, z);
      beam.scale.set(0.9 * beamK + 0.05, SKY + 2, 0.9 * beamK + 0.05);
      beam.material.opacity = 0.28 * beamK;
      beamCore.position.copy(beam.position);
      beamCore.scale.set(0.22 * beamK + 0.02, SKY + 2, 0.22 * beamK + 0.02);
      beamCore.material.opacity = 0.7 * beamK;
      // Glyphe doré au sol (zone du sort)
      tintGlyph(glyph, t < T_HIT ? '#ffe680' : '#bfefff', t < T_HIT ? Math.min(1, t * 4) : Math.max(0, 1 - (t - T_HIT) / 0.8));
      glyph.rotation.y = t * 2.2;
      // Traînée de la chute
      if (t >= T_FALL - 0.05 && t < T_HIT) {
        streak.material.opacity = 0.55;
        streak.position.set(x, y + 4.5, z);
        streak.scale.set(0.7, 6.5, 0.16);
        streak.rotation.y = yaw + Math.PI / 2;
        for (let i = 0; i < 6; i++) part(x + (Math.random() - 0.5) * 0.5, y + 0.5 + Math.random() * 4, z + (Math.random() - 0.5) * 0.5, i % 2 ? '#ffffff' : '#9fe8ff', { life: 0.3, s: 0.1, vy: 2 });
      } else streak.material.opacity = 0;
      if (t < T_FALL && Math.random() < 0.8) part(x + (Math.random() - 0.5) * 1.2, y + 1 + Math.random() * 3, z + (Math.random() - 0.5) * 1.2, '#fff2a8', { life: 0.4, s: 0.08 });
      // 3 : impact
      if (!hit && t >= T_HIT) {
        hit = true;
        shake = Math.max(shake, 0.32);
        shockwave(x, z, r * 1.45, '#fff2a8', 0.7);
        shockwave(x, z, r * 0.9, '#9fe8ff', 0.5, false);
        burst(x, 0.4, z, ['#ffffff', '#fff2a8', '#9fe8ff', '#ffd84a'], 30, { speed: r * 1.6, up: 4, s: 0.11, life: 0.8 });
        // Plumes de lumière qui retombent doucement
        for (let i = 0; i < 14; i++) {
          const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 2;
          part(x, 1.5 + Math.random(), z, '#ffffff', { vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: 1.5 + Math.random(), g: 1.6, life: 1.3, s: 0.12 });
        }
        for (let i = 0; i < 12; i++) {
          const c = fxMesh(CRACK_G(), i % 2 ? '#fff2a8' : '#bfefff', 0.95, meshes);
          c.position.set(x, 0.07, z);
          c.rotation.y = (i / 12) * Math.PI * 2;
          rays.push({ c, len: r * (1 + (i % 3) * 0.25) });
        }
      }
      if (hit) {
        const h = Math.min(1, (t - T_HIT) / 0.45);
        dome.position.set(x, 0, z);
        dome.scale.setScalar(Math.max(0.01, r * 1.15 * smooth(Math.min(1, (t - T_HIT) / 0.25))));
        dome.material.opacity = 0.5 * (1 - h);
        rays.forEach(({ c, len }) => { c.scale.set(len * smooth(Math.min(1, (t - T_HIT) / 0.2)), 1, 1.5); c.material.opacity = 0.95 * Math.max(0, 1 - (t - T_HIT) / 0.7); });
        // 4 : épée plantée qui pulse puis se dissout vers le ciel
        if (t < 1.15 && Math.random() < 0.5) part(x + (Math.random() - 0.5) * 0.6, 0.5 + Math.random() * 3, z + (Math.random() - 0.5) * 0.6, '#bfefff', { vy: 0.8, life: 0.5, s: 0.07 });
        if (t > 1.15) for (let i = 0; i < 4; i++) part(x + (Math.random() - 0.5) * 0.7, Math.random() * 4, z + (Math.random() - 0.5) * 0.7, i % 2 ? '#ffffff' : '#fff2a8', { vy: 3 + Math.random() * 2, life: 0.6, s: 0.1 });
      }
    }, () => { give('epee_celeste', sword); give('celeste_glyphe', glyph); dropMeshes(meshes); });
  }

  /** IOP — Colère de Iop, annonce : rayon du ciel et glyphe rouge sous la cible. */
  function vfxColereAnnonce(s) {
    const meshes = [];
    const x = s.x / U, z = s.y / U, r = s.r / U;
    const beam = fxMesh(TUBE_G(), '#ff7a2a', 0.0, meshes);
    const core = fxMesh(TUBE_G(), '#fff2a8', 0.0, meshes);
    const g = take('colere_glyphe', makeGlyph);
    tintGlyph(g, '#ff3b1a', 0);
    g.position.set(x, 0.05, z);
    g.scale.set(r * 1.1, 1, r * 1.1);
    addVfx(s.life, (k, t) => {
      beam.position.set(x, 7, z);
      beam.scale.set(r * (0.9 - 0.5 * k), 14, r * (0.9 - 0.5 * k));
      beam.material.opacity = 0.32 * k;
      core.position.set(x, 7, z);
      core.scale.set(r * 0.18 * (1 - k * 0.5), 14, r * 0.18 * (1 - k * 0.5));
      core.material.opacity = 0.6 * k;
      tintGlyph(g, '#ff3b1a', Math.min(1, k * 2));
      g.rotation.y = t * 3;
      if (Math.random() < 0.6) part(x + (Math.random() - 0.5) * r, 0.1, z + (Math.random() - 0.5) * r, '#ff7a2a', { vy: 3, life: 0.4, s: 0.08 });
    }, () => { give('colere_glyphe', g); dropMeshes(meshes); });
  }

  /** IOP — Colère de Iop, impact : cratère, fissures de lave, débris, poussière, épée plantée, secousse. */
  function vfxColereImpact(x, z, r) {
    shake = Math.max(shake, 0.4);
    shockwave(x, z, r * 2.2, '#ff7a2a', 0.7);
    shockwave(x, z, r * 1.4, '#ffd84a', 0.5, false);
    const meshes = [];
    const cracks = [];
    for (let i = 0; i < 10; i++) {
      const c = fxMesh(CRACK_G(), i % 2 ? '#ff5a1a' : '#ffb020', 0.95, meshes);
      c.position.set(x, 0.06, z);
      c.rotation.y = (i / 10) * Math.PI * 2 + Math.random() * 0.3;
      cracks.push({ c, len: r * (1 + Math.random() * 0.8) });
    }
    const crater = fxMesh(DISC_G(), '#3a2a1a', 0.6, meshes);
    crater.position.set(x, 0.04, z);
    crater.scale.set(r * 0.9, 1, r * 0.9);
    burst(x, 0.3, z, ['#6a4a2a', '#4a3a2a', '#8a6a4a'], 22, { speed: 4, up: 6, s: 0.2, life: 1.1 });
    burst(x, 0.3, z, ['#ff7a2a', '#ffd84a', '#ff3b1a'], 24, { speed: 3, up: 4, s: 0.12, g: 2, life: 0.8 });
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2, rr = r * (0.4 + Math.random() * 0.8);
      part(x + Math.cos(a) * rr, 0.2, z + Math.sin(a) * rr, i % 2 ? '#b8ab98' : '#d8cfc0', { vy: 0.6 + Math.random() * 0.6, life: 1.2, s: 0.3, grow: 2 });
    }
    // L'épée géante reste plantée puis s'enfonce
    const stuck = take('epee_plantee', STRIKE_MAKE.sword);
    stuck.position.set(x, -0.4, z);
    stuck.rotation.set(0.12, Math.random() * 3, -0.1);
    stuck.scale.setScalar(1);
    addVfx(1.2, (k) => {
      cracks.forEach(({ c, len }) => { c.scale.set(len * Math.min(1, k * 5), 1, 1 + k); c.material.opacity = 0.95 * (1 - k); });
      crater.material.opacity = 0.6 * (1 - k);
      stuck.position.y = -0.4 - k * k * 2.5;
      stuck.scale.setScalar(Math.max(0.01, 1 - Math.max(0, k - 0.6) * 2.5));
    }, () => { give('epee_plantee', stuck); dropMeshes(meshes); });
  }

  function onStrikeStart(s) {
    if (s.id === 'colere_iop') vfxColereAnnonce(s);
  }
  /** Impact d'une frappe : un effet différent par type d'objet tombé. */
  function onStrikeImpact(s) {
    const x = s.x / U, z = s.y / U, r = s.r / U;
    switch (STRIKE_STYLE[s.id] || 'orb') {
      case 'sword': vfxColereImpact(x, z, r); break;
      case 'arrow':
        shockwave(x, z, r, s.color, 0.4, false);
        burst(x, 0.2, z, [s.color, '#ffffff'], 6, { speed: 1.5, up: 2, s: 0.07, life: 0.5 });
        break;
      case 'hand':
        shockwave(x, z, r * 1.3, '#7ab8ff', 0.6);
        burst(x, 0.3, z, ['#ffe066', '#7ab8ff'], 12, { speed: 2.5, up: 3, s: 0.08 });
        break;
      case 'die':
        shockwave(x, z, r * 1.2, '#ffcf3a', 0.5, false);
        burst(x, 0.5, z, ['#ffffff', '#c9472f'], 16, { speed: 3.5, up: 5, s: 0.16, g: 7, life: 1 });
        shake = Math.max(shake, 0.1);
        break;
      case 'bomb':
        shake = Math.max(shake, 0.2);
        shockwave(x, z, r * 1.4, '#ff8a2a', 0.6);
        burst(x, 0.3, z, ['#ff8a2a', '#ffd84a', '#ff3d00'], 20, { speed: 3, up: 5, s: 0.14, g: 3, life: 0.7 });
        for (let i = 0; i < 10; i++) part(x + (Math.random() - 0.5) * r, 0.3, z + (Math.random() - 0.5) * r, '#5a5048', { vy: 0.8 + Math.random(), life: 1.1, s: 0.25, grow: 2 });
        break;
      case 'thorn':
        burst(x, 0.4, z, ['#7ab33a', '#c8ff7a', '#2f4a14'], 10, { speed: 2, up: 3, s: 0.1 });
        break;
      default:
        shockwave(x, z, r, s.color, 0.5, false);
        burst(x, 0.3, z, [s.color], 8, { speed: 2, up: 2.5, s: 0.08 });
    }
  }

  // ---------------------------------------------------------------- Boss du jeu
  const bossBuilder = (id) => (BOSS_BUILD[id] && typeof window[BOSS_BUILD[id]] === 'function' ? window[BOSS_BUILD[id]] : null);
  function takeBoss(id) {
    const l = bossFree[id] || (bossFree[id] = []);
    const inst = l.pop() || bossBuilder(id)();
    scene.add(inst.root, inst.fx);
    return inst;
  }
  function giveBoss(id, inst) {
    scene.remove(inst.root, inst.fx);
    (bossFree[id] || (bossFree[id] = [])).push(inst);
  }
  /** Construit et compile à l'avance les deux boss de la zone (pas d'à-coup à leur arrivée). */
  function prewarmBosses(zone) {
    const insts = [];
    for (const id of [zone.mini, zone.boss]) if (bossBuilder(id) && !(bossFree[id] && bossFree[id].length)) {
      const inst = takeBoss(id);
      inst.root.position.set(0, -200, 0);
      inst.update('move', 0, 0);
      insts.push([id, inst]);
    }
    if (insts.length) renderer.compile(scene, camera);
    for (const [id, inst] of insts) giveBoss(id, inst);
  }
  /**
   * Un boss par image : position et orientation du jeu, marche, et animation d'attaque
   * lancée quand le jeu déclenche une charge ou un tir en cercle (e.abAt).
   */
  function updateBoss(e, dt, p) {
    let rec = bossLive.get(e);
    if (!rec) {
      rec = { inst: takeBoss(e.id), id: e.id, abT: 99, abAt: e.abAt, yaw: Math.atan2(p.x - e.x, p.y - e.y) };
      bossLive.set(e, rec);
      shockwave(e.x / U, e.y / U, 3, '#ff3b3b', 0.8);
      burst(e.x / U, 0.5, e.y / U, ['#ff3b3b', '#ffd84a', '#ffffff'], 24, { speed: 4, up: 5, s: 0.14 });
      shake = Math.max(shake, 0.25);
    }
    if (e.abAt !== rec.abAt) { rec.abAt = e.abAt; rec.abT = 0; }
    rec.abT += dt;
    const T = BOSS_ABILITY_TIME[e.id] || 3;
    const attacking = rec.abT < T;
    // Face au joueur, ou dans l'axe de sa charge
    const want = e.charge > 0 ? Math.atan2(e.cx, e.cy) : Math.atan2(p.x - e.x, p.y - e.y);
    let d = want - rec.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    rec.yaw += d * Math.min(1, dt * 5);
    const root = rec.inst.root;
    root.position.set(e.x / U, 0, e.y / U);
    root.rotation.y = rec.yaw;
    root.scale.setScalar(e.flash > 0 ? 1.05 : 1);
    rec.x = e.x / U; rec.z = e.y / U;
    rec.inst.update(attacking ? 'ability' : 'move', attacking ? rec.abT : time, dt);
  }
  /** Retire les boss qui ne sont plus là ; grande explosion à la mort. */
  function releaseBosses(seen, all = false) {
    for (const [e, rec] of bossLive) {
      if (!all && seen.has(e)) continue;
      if (!all && e.dead) {
        shake = Math.max(shake, 0.45);
        shockwave(rec.x, rec.z, 6, '#ffd84a', 1);
        shockwave(rec.x, rec.z, 4, '#ffffff', 0.7, false);
        burst(rec.x, 1, rec.z, ['#ffd84a', '#ffffff', '#ff8a2a'], 40, { speed: 5, up: 7, s: 0.16, life: 1.2 });
        for (let i = 0; i < 16; i++) part(rec.x + (Math.random() - 0.5) * 3, 0.3, rec.z + (Math.random() - 0.5) * 3, '#d8cfc0', { vy: 1 + Math.random(), life: 1.4, s: 0.35, grow: 2 });
      }
      giveBoss(rec.id, rec.inst);
      bossLive.delete(e);
    }
  }


  // ---------------------------------------------------------------- Monde ouvert
  // Sol coloré par zone, décor fixe, zaaps, personnages, repaires et barrière.
  let W3 = null;
  const zoneCol = new Map();
  function zcol(hex) { if (!zoneCol.has(hex)) zoneCol.set(hex, new THREE.Color(hex)); return zoneCol.get(hex); }

  /** Modèles de décor (fusionnés en une géométrie à couleurs de sommets). */
  const DECOR = {
    tree(c) {
      const g = new THREE.Group();
      g.add(at(cyl(0.18, 0.26, 1.4, 6, mat(0x6a4a2a)), 0, 0.7, 0));
      g.add(at(sph(0.95, 7, 5, mat(c[0])), 0, 1.9, 0));
      g.add(at(sph(0.62, 7, 5, mat(0x5c9a3a)), 0.42, 2.35, 0.18));
      g.add(at(sph(0.55, 7, 5, mat(c[0])), -0.45, 2.2, -0.25));
      return g;
    },
    bush(c) {
      const g = new THREE.Group();
      g.add(at(sph(0.5, 6, 4, mat(c[0])), 0, 0.32, 0));
      g.add(at(sph(0.36, 6, 4, mat(0x6aa040)), 0.38, 0.26, 0.1));
      g.add(at(sph(0.1, 5, 4, mat(c[2] || 0xff9ab0)), 0.1, 0.78, 0.2));
      return g;
    },
    wheat(c) {
      const g = new THREE.Group();
      for (let i = 0; i < 7; i++) {
        const a = i * 2.4, r = 0.12 + (i % 3) * 0.14;
        g.add(at(cone(0.06, 0.9 + (i % 2) * 0.25, 4, mat(c[0])), Math.cos(a) * r, 0.5, Math.sin(a) * r, 0.1 * Math.cos(a), 0, 0.1 * Math.sin(a)));
      }
      return g;
    },
    oak(c) {
      const g = new THREE.Group();
      g.add(at(cyl(0.3, 0.45, 2.2, 6, mat(0x4a3424)), 0, 1.1, 0));
      g.add(at(cyl(0.1, 0.16, 1.1, 5, mat(0x4a3424)), 0.5, 2.2, 0, 0, 0, -0.8));
      g.add(at(sph(1.3, 7, 5, mat(c[0])), 0, 3, 0));
      g.add(at(sph(0.9, 7, 5, mat(0x3a5a2a)), 0.9, 2.7, 0.3));
      g.add(at(sph(0.8, 7, 5, mat(c[0])), -0.8, 2.6, -0.4));
      return g;
    },
    mushroom() {
      const g = new THREE.Group();
      g.add(at(cyl(0.1, 0.14, 0.4, 6, mat(0xe8dcc0)), 0, 0.2, 0));
      g.add(at(sph(0.3, 7, 4, mat(0xb03a3a)), 0, 0.4, 0));
      g.add(at(cyl(0.07, 0.1, 0.26, 6, mat(0xe8dcc0)), 0.3, 0.13, 0.12));
      g.add(at(sph(0.2, 7, 4, mat(0x8a5ab0)), 0.3, 0.27, 0.12));
      return g;
    },
    rock(c) {
      const g = new THREE.Group();
      g.add(at(mesh(new THREE.DodecahedronGeometry(0.8, 0), mat(c[0])), 0, 0.45, 0, 0.3, 0.5, 0.1));
      g.add(at(mesh(new THREE.DodecahedronGeometry(0.45, 0), mat(c[1])), 0.75, 0.25, 0.3, 0.8, 0.2, 0));
      return g;
    },
    spire(c) {
      const g = new THREE.Group();
      g.add(at(cone(0.7, 2.6, 5, mat(c[2])), 0, 1.3, 0));
      g.add(at(cone(0.45, 1.6, 5, mat(c[0])), 0.7, 0.8, 0.2, 0, 0, -0.2));
      return g;
    },
    pine(c) {
      const g = new THREE.Group();
      g.add(at(cyl(0.14, 0.2, 0.8, 5, mat(0x5a4030)), 0, 0.4, 0));
      for (let i = 0; i < 3; i++) {
        g.add(at(cone(1.0 - i * 0.25, 1.2, 7, mat(c[1])), 0, 1.1 + i * 0.7, 0));
        g.add(at(cone(0.55 - i * 0.14, 0.45, 7, mat(0xffffff)), 0, 1.45 + i * 0.7, 0));
      }
      return g;
    },
    ice(c) {
      const g = new THREE.Group();
      g.add(at(crystal(0.35, 1.8, mat(c[0], 0.25)), 0, 0.7, 0, 0.1, 0, 0.1));
      g.add(at(crystal(0.25, 1.1, mat(0xd8f0ff, 0.25)), 0.45, 0.4, 0.15, 0, 0, -0.35));
      g.add(at(sph(0.6, 6, 4, mat(0xffffff)), -0.2, 0, 0.2));
      return g;
    },
  };
  // Décor de chaque type de zone : [modèle, part, échelle min, échelle max]
  const DECOR_SET = {
    grass: [['tree', 0.35, 0.9, 1.3], ['bush', 0.65, 0.8, 1.3]],
    field: [['wheat', 0.55, 0.9, 1.4], ['tree', 0.2, 0.9, 1.2], ['bush', 0.25, 0.8, 1.2]],
    forest: [['oak', 0.55, 0.9, 1.5], ['mushroom', 0.25, 0.8, 1.5], ['bush', 0.2, 0.8, 1.2]],
    rock: [['rock', 0.6, 0.7, 1.8], ['spire', 0.4, 0.8, 1.5]],
    snow: [['pine', 0.55, 0.9, 1.5], ['ice', 0.45, 0.7, 1.4]],
  };
  const BORDER_SET = { grass: 'tree', field: 'tree', forest: 'oak', rock: 'spire', snow: 'pine' };
  const LOW_BORDER = { grass: 'bush', field: 'wheat', forest: 'mushroom', rock: 'rock', snow: 'ice' };

  function buildZaap() {
    const g = new THREE.Group();
    const stone = mat(0x8a7aa0), dark = mat(0x5a4a70), gold = mat(0xc8a060);
    g.add(at(cyl(2.1, 2.3, 0.3, 10, dark), 0, 0.15, 0));
    g.add(at(cyl(1.7, 1.9, 0.2, 10, stone), 0, 0.38, 0));
    g.add(at(torus(1.45, 0.24, 6, 18, gold), 0, 2.0, 0));
    g.add(at(box(0.5, 1.2, 0.5, stone), -1.5, 0.9, 0));
    g.add(at(box(0.5, 1.2, 0.5, stone), 1.5, 0.9, 0));
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.add(at(crystal(0.12, 0.4, mat(0x7fe1e4, 0.8)), Math.cos(a) * 1.45, 2.0 + Math.sin(a) * 1.45, 0)); }
    const portal = new THREE.Mesh(new THREE.CircleGeometry(1.25, 24), new THREE.MeshBasicMaterial({ color: 0x4fc3c7, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }));
    portal.position.set(0, 2.0, 0);
    g.add(portal);
    const swirl = new THREE.Mesh(new THREE.RingGeometry(0.3, 1.1, 24, 1, 0, Math.PI * 1.2), new THREE.MeshBasicMaterial({ color: 0xd8ffff, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
    swirl.position.set(0, 2.0, 0.01);
    g.add(swirl);
    return { root: g, portal, swirl };
  }

  function buildMark() {
    const g = new THREE.Group();
    const m = new THREE.MeshBasicMaterial({ color: 0xf2c14e });
    g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.6, 0.22), m), 0, 0.45, 0));
    g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), m), 0, 0, 0));
    return g;
  }

  function buildDoor() {
    const g = new THREE.Group();
    const rock = mat(0x6a6070), dark = mat(0x4a4258);
    g.add(at(mesh(new THREE.DodecahedronGeometry(3.2, 0), rock), 0, 1.2, -1.6, 0, 0.3, 0));
    g.add(at(mesh(new THREE.DodecahedronGeometry(2.2, 0), dark), -2.6, 0.8, -0.6, 0.4, 0, 0));
    g.add(at(mesh(new THREE.DodecahedronGeometry(2.0, 0), dark), 2.7, 0.7, -0.5, 0, 0.7, 0));
    g.add(at(torus(1.6, 0.42, 6, 14, mat(0x8a7aa0), Math.PI), 0, 0, 0.9));
    const hole = new THREE.Mesh(new THREE.CircleGeometry(1.45, 20, 0, Math.PI), new THREE.MeshBasicMaterial({ color: 0x0c0812 }));
    hole.position.set(0, 0, 0.85);
    g.add(hole);
    const torches = [];
    for (const sx of [-2.2, 2.2]) {
      g.add(at(cyl(0.08, 0.1, 1.6, 5, mat(0x5a4030)), sx, 0.8, 1.1));
      const f = at(crystal(0.18, 0.5, mat(0xff9a3a, 1.2)), sx, 1.8, 1.1);
      g.add(f);
      torches.push(f);
    }
    return { root: g, torches };
  }

  function disposeGroup(g) {
    const shared = new Set(MATS.values());
    g.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material && !shared.has(o.material) && o !== W3.wt) o.material.dispose && o.material.dispose();
    });
  }

  /** Construit la carte courante (zone ou donjon) : décor, lieux, murs. */
  function buildMap3D(m) {
    if (!W3) {
      const n = (TILES * 2 + 1) ** 2 * 2;
      const wt = new THREE.InstancedMesh(new THREE.BoxGeometry(TILE / Math.SQRT2, 0.02, TILE / Math.SQRT2), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }), n);
      wt.receiveShadow = true;
      wt.frustumCulled = false;
      const offs = [];
      let i = 0;
      tmpQ.setFromEuler(tmpE.set(0, Math.PI / 4, 0));
      for (let par = 0; par < 2; par++) for (let a = -TILES; a <= TILES; a++) for (let b = -TILES; b <= TILES; b++) {
        const ox = a * TILE + par * TILE / 2, oz = b * TILE + par * TILE / 2;
        tmpM.compose(tmpP.set(ox, 0.01, oz), tmpQ, tmpS.set(1.02, 1, 1.02));
        wt.setMatrixAt(i, tmpM);
        wt.setColorAt(i, WHITE);
        offs.push(ox, oz, par);
        i++;
      }
      scene.add(wt);
      W3 = { wt, offs, group: null, key: null, anchor: null, sky: new THREE.Color(), first: true };
    }
    if (W3.group) { scene.remove(W3.group); disposeGroup(W3.group); }
    const group = new THREE.Group();
    scene.add(group);
    Object.assign(W3, { group, key: m.key, map: m, anchor: null, first: true, zaap: null, npc: null, mark: null, door: null, torches: [] });
    const z = ZONES[m.zone], dungeon = m.kind === 'dungeon';
    let seed = 777 + m.zone * 31 + (dungeon ? 5 : 0);
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const place = new Map();
    const push = (kind, x, zz, sc) => {
      if (!place.has(kind)) place.set(kind, []);
      place.get(kind).push(x, zz, sc, rnd() * Math.PI * 2);
    };
    const W = m.w, H = m.h;
    if (!dungeon) {
      const avoid = [[m.zaap.x, m.zaap.y, 300], [m.npc.x, m.npc.y, 200], [m.lair.x, m.lair.y, 300], [m.door.x, m.door.y, 330]];
      for (const c of m.camps) avoid.push([c.x, c.y, 170]);
      const set = DECOR_SET[z.decoType] || DECOR_SET.grass, CELL = 150;
      for (let cx = 0; cx < W; cx += CELL) for (let cy = -H; cy < H; cy += CELL) {
        if (rnd() > 0.3) continue;
        const x = cx + rnd() * CELL, y = cy + rnd() * CELL;
        if (avoid.some(([ax, ay, r]) => Math.hypot(ax - x, ay - y) < r)) continue;
        let k = rnd(), pk = set[0];
        for (const d of set) { if (k < d[1]) { pk = d; break; } k -= d[1]; }
        push(pk[0], x / U, y / U, pk[2] + rnd() * (pk[3] - pk[2]));
      }
      // Lisière : rangées serrées tout autour de la carte
      // Au nord : grands arbres ; au sud (côté caméra) : décor bas pour ne pas masquer l'action
      const kind = BORDER_SET[z.decoType] || 'tree', low = LOW_BORDER[z.decoType] || 'bush';
      for (let x = -120; x < W + 120; x += 70) for (let row = 0; row < 3; row++) {
        push(kind, (x + rnd() * 40) / U, -(H + 30 + row * 75 + rnd() * 40) / U, 1.3 + rnd() * 0.9 + row * 0.25);
        push(low, (x + rnd() * 40) / U, (H + 40 + row * 60 + rnd() * 30) / U, 0.9 + rnd() * 0.5);
      }
      for (const ex of [-40, W + 40]) for (let y = -H; y < H; y += 70) for (let row = 0; row < 3; row++)
        push(kind, (ex + Math.sign(ex - 1) * row * 75 + rnd() * 30) / U, (y + rnd() * 40) / U, 1.4 + rnd() * 0.8);
    } else {
      // Donjon : éboulis le long des murs
      for (let x = 300; x < W - 150; x += 120) if (rnd() < 0.45) push('rock', x / U, (rnd() < 0.5 ? -1 : 1) * (H - 30 - rnd() * 50) / U, 0.5 + rnd() * 0.6);
    }
    const decorMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85 });
    const deco = dungeon ? ['#4a4258', '#3a3346', '#5a5068'] : z.deco;
    for (const [kind, arr] of place) {
      const src = DECOR[kind](deco.map((c) => new THREE.Color(c).getHex()));
      const bb = new THREE.Box3().setFromObject(src);
      const rad = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) / 2 || 1;
      const geo = mergeModel(src).scale(rad, rad, rad);
      const cnt = arr.length / 4;
      const im = new THREE.InstancedMesh(geo, decorMat, cnt);
      im.castShadow = true;
      for (let j = 0; j < cnt; j++) {
        const sc = arr[j * 4 + 2];
        tmpQ.setFromEuler(tmpE.set(0, arr[j * 4 + 3], 0));
        tmpM.compose(tmpP.set(arr[j * 4], 0, arr[j * 4 + 1]), tmpQ, tmpS.set(sc, sc, sc));
        im.setMatrixAt(j, tmpM);
      }
      im.frustumCulled = false;
      group.add(im);
    }

    const ringAt = (x, y, r, color) => {
      const rg = new THREE.Mesh(new THREE.RingGeometry(r / U, (r + 12) / U, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, depthWrite: false }));
      rg.rotation.x = -Math.PI / 2;
      rg.position.set(x / U, 0.04, y / U);
      group.add(rg);
    };
    const stones = (x, y, R, n, h, col) => {
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        group.add(at(box(0.5, h, 0.5, mat(col)), x / U + Math.cos(a) * R / U, h / 2, y / U + Math.sin(a) * R / U, 0, a, 0));
      }
    };
    if (!dungeon) {
      const zp = buildZaap();
      zp.root.position.set(m.zaap.x / U, 0, m.zaap.y / U);
      group.add(zp.root);
      W3.zaap = zp;
      const fn = HERO_BUILD[m.npc.look] && window[HERO_BUILD[m.npc.look]];
      try { if (typeof fn === 'function') W3.npc = fn({ hero: true }); } catch (e) { W3.npc = null; }
      if (W3.npc) {
        W3.npc.root.position.set(m.npc.x / U, 0, m.npc.y / U);
        W3.npc.root.rotation.y = 0.3;
        group.add(W3.npc.root, W3.npc.fx);
      }
      W3.mark = buildMark();
      W3.mark.position.set(m.npc.x / U, 2.9, m.npc.y / U);
      group.add(W3.mark);
      ringAt(m.lair.x, m.lair.y, 180, 0xf2c14e);
      stones(m.lair.x, m.lair.y, 215, 6, 1.1, 0x7a6a50);
      const dr = buildDoor();
      dr.root.position.set(m.door.x / U, 0, m.door.y / U - 0.4);
      group.add(dr.root);
      W3.door = dr;
      W3.torches = dr.torches;
    } else {
      // Murs : haut au nord (fond de l'écran), bas au sud pour ne pas masquer l'action
      const wall = mat(0x2e2640), wallTop = mat(0x463c5a);
      const L = W / U + 4, hz = H / U;
      group.add(at(box(L, 4, 1.6, wall), W / U / 2, 2, -hz - 0.8));
      group.add(at(box(L, 0.3, 1.8, wallTop), W / U / 2, 4.1, -hz - 0.8));
      group.add(at(box(L, 0.8, 1.2, wall), W / U / 2, 0.4, hz + 0.6));
      group.add(at(box(1.6, 4, hz * 2 + 2, wall), -0.8, 2, 0));
      group.add(at(box(1.6, 4, hz * 2 + 2, wall), W / U + 0.8, 2, 0));
      for (let x = 150; x < W; x += 300) {
        group.add(at(box(1, 4.4, 1, wallTop), x / U, 2.2, -hz + 0.1));
        const f = at(crystal(0.2, 0.55, mat(0xff9a3a, 1.2)), x / U, 3.1, -hz + 0.75);
        group.add(at(cyl(0.06, 0.08, 0.7, 5, mat(0x5a4030)), x / U, 2.7, -hz + 0.65, 0.5, 0, 0));
        group.add(f);
        W3.torches.push(f);
      }
      const ex = buildZaap();
      ex.portal.material.color.set(0xb46cff);
      ex.root.position.set(m.exit.x / U, 0, m.exit.y / U);
      group.add(ex.root);
      W3.zaap = ex;
      ringAt(m.boss.x, m.boss.y, 250, 0xff5a3a);
      stones(m.boss.x, m.boss.y, 290, 8, 1.6, 0x6a3a3a);
    }
  }

  /** Recolore le damier quand le joueur change de case. */
  function paintTiles(ax, az) {
    const { wt, offs, map: m } = W3;
    const z = ZONES[m.zone], dungeon = m.kind === 'dungeon';
    const g1 = dungeon ? zcol('#3a3346') : zcol(z.ground), g2 = dungeon ? zcol('#332c3e') : zcol(z.ground2);
    for (let i = 0, j = 0; i < offs.length; i += 3, j++) {
      const x = (ax + offs[i]) * U, y = (az + offs[i + 1]) * U, par = offs[i + 2];
      if (Math.abs(y) > m.h + 20 || x < -20 || x > m.w + 20) tmpC.copy(dungeon ? zcol('#0e0a16') : g1).multiplyScalar(dungeon ? 1 : 0.55);
      else tmpC.copy(par ? g2 : g1);
      wt.setColorAt(j, tmpC);
    }
    wt.instanceColor.needsUpdate = true;
  }

  function updateWorld3D(S, dt, px, pz) {
    const w = S.world;
    if (!w || !w.map) return;
    const m = w.map;
    if (!W3 || W3.key !== m.key) buildMap3D(m);
    const ax = Math.round(px / TILE) * TILE, az = Math.round(pz / TILE) * TILE;
    W3.wt.position.set(ax, 0, az);
    const key = ax + ',' + az;
    if (key !== W3.anchor) { W3.anchor = key; paintTiles(ax, az); }
    // Ciel et brouillard
    const dungeon = m.kind === 'dungeon';
    const target = dungeon ? tmpC.set(0x1c1626) : tmpC.set(S.zone.ground).lerp(WHITE, 0.55);
    if (W3.first) { W3.sky.copy(target); W3.first = false; } else W3.sky.lerp(target, Math.min(1, dt * 2));
    scene.background.copy(W3.sky);
    scene.fog.color.copy(W3.sky);
    ground.material.color.set(dungeon ? 0x0e0a16 : S.zone.ground).multiplyScalar(dungeon ? 1 : 0.55);
    const zp = W3.zaap;
    if (zp) {
      zp.portal.material.opacity = 0.5 + 0.15 * Math.sin(time * 3);
      zp.swirl.rotation.z = -time * 2.5;
      if (Math.random() < 0.3 && Math.abs(zp.root.position.x - px) < 30) part(zp.root.position.x + (Math.random() - 0.5) * 2, 0.6, zp.root.position.z + (Math.random() - 0.5) * 0.4, dungeon ? '#c49aff' : '#7fe1e4', { vy: 1.6, life: 0.9, s: 0.1 });
    }
    if (W3.npc && Math.abs(m.npc.x / U - px) < 40) W3.npc.update('idle', time, dt);
    if (W3.mark) {
      const q = WORLD.QUESTS[w.quest];
      W3.mark.visible = !!q && !w.qAccepted && q.zone === m.zone;
      if (W3.mark.visible) { W3.mark.position.y = 2.9 + Math.sin(time * 3) * 0.15; W3.mark.rotation.y = time * 1.5; }
    }
    for (const f of W3.torches) {
      f.scale.setScalar(0.85 + 0.2 * Math.sin(time * 11 + f.position.x * 3));
      if (Math.random() < 0.08) {
        f.getWorldPosition(tmpP);
        if (Math.abs(tmpP.x - px) < 25) part(tmpP.x, tmpP.y + 0.2, tmpP.z, Math.random() < 0.5 ? '#ffb347' : '#ff7a2a', { vy: 1.2, life: 0.5, s: 0.08 });
      }
    }
  }

  // ---------------------------------------------------------------- Début / fin de partie
  function begin(S) {
    if (!ready) return;
    const z = S.zone;
    ground.material.color.set(z.ground);
    tiles.material.color.set(z.ground2);
    const sky = new THREE.Color(z.ground).lerp(new THREE.Color(0xffffff), 0.55);
    scene.background = sky;
    scene.fog.color.copy(sky);
    end();
    const world = S.mode === 'world';
    if (W3) { W3.wt.visible = world; if (W3.group) W3.group.visible = world; W3.key = null; W3.first = true; }
    tiles.visible = !world;
    hero = buildHero(S.cls);
    parts.length = 0;
    for (const v of vfx) v.cleanup && v.cleanup();
    vfx.length = 0;
    prevStrikes = new Set();
    shake = 0;
    time = 0;
    releaseBosses(new Set(), true);
    prewarm(S.cls);
    prewarmBosses(S.zone);
  }

  /**
   * Prépare dès le début de partie tous les modèles d'effets de la classe et compile
   * leurs shaders, pour éviter un à-coup au premier lancement de chaque sort.
   */
  function prewarm(clsId) {
    beginPools();
    for (const id of CLASSES[clsId].spells) {
      const def = SPELLS[id];
      if (def.type === 'projectile') projBatch(PROJ_STYLE[id] || 'orb');
      if (def.type === 'strike') { const st = STRIKE_STYLE[id] || 'orb'; pool('strike_' + st, STRIKE_MAKE[st]); }
      if (def.type === 'summon') for (let i = 0; i < 3; i++) pool('minion_' + id, MINION_MAKE[id] || MINION_MAKE.double);
      if (def.type === 'orbit') for (let i = 0; i < 6; i++) pool('orbit_' + id, ORBIT_MAKE[id] || ORBIT_MAKE.epee_jugement);
      if (def.type === 'aura') pool('aura', makeGlyph);
      if (def.type === 'glyph') pool('glyph', makeGlyph);
      if (def.type === 'trap') for (let i = 0; i < 5; i++) pool(def.base.fuse ? 'bomb' : 'spike', def.base.fuse ? makeFuseBomb : makeSpikeTrap);
    }
    ring(); disc(); wave(); arc(); slash();
    endPools();
    const warm = [];
    if (CLASSES[clsId].spells.includes('epee_celeste')) warm.push(['epee_celeste', take('epee_celeste', makeCelesteSword)], ['celeste_glyphe', take('celeste_glyphe', makeGlyph)]);
    renderer.compile(scene, camera);
    for (const [name, m] of warm) give(name, m);
    for (const k in pools) for (const m of pools[k].items) m.visible = false;
  }
  function end() {
    if (!ready) return;
    if (hero) { scene.remove(hero.inst.root, hero.inst.fx); hero = null; }
    shieldBubble.visible = false;
    releaseBosses(new Set(), true);
  }

  // ---------------------------------------------------------------- Caméra
  function placeCamera(px, pz) {
    // Distance calculée pour montrer à peu près la même surface que la vue 2D
    const halfH = (H / 2 / zoom) / U, halfW = (W / 2 / zoom) / U;
    const t = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const d = Math.max(halfH * 0.95 / t, (halfW * 0.82) / (t * camera.aspect)) * 0.62;
    // Le brouillard cache le haut de l'écran, là où les monstres apparaissent
    scene.fog.near = d * 1.05;
    scene.fog.far = d * 1.75;
    camera.position.set(px, Math.sin(TILT) * d, pz + Math.cos(TILT) * d);
    camera.lookAt(px, 0, pz);
    if (shake > 0) camera.position.add(tmpP.set((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake));
    sun.position.set(px + 14, 30, pz + 10);
    sun.target.position.set(px, 0, pz);
    ground.position.set(px, 0, pz);
    tiles.position.set(Math.round(px / TILE) * TILE, 0, Math.round(pz / TILE) * TILE);
  }

  const ray = new THREE.Raycaster(), groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), ndc = new THREE.Vector2(), hit = new THREE.Vector3();
  /**
   * Rayon (en pixels de jeu) du terrain visible autour du joueur : distance du coin
   * d'écran le plus éloigné, au sol. Les monstres apparaissent juste au-delà.
   */
  function viewRadius(px, py) {
    placeCamera(px / U, py / U);
    camera.updateMatrixWorld();
    let r = 0;
    for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      ndc.set(x, y);
      ray.setFromCamera(ndc, camera);
      // Coins du haut : le rayon peut filer vers l'horizon, on borne au brouillard
      const d = ray.ray.intersectPlane(groundPlane, hit) ? Math.hypot(hit.x - px / U, hit.z - py / U) : Infinity;
      r = Math.max(r, Math.min(d, scene.fog.far * 0.8));
    }
    return r * U + 40;
  }

  /** Coordonnées écran d'un point du jeu (x, y en pixels de jeu, h en mètres). */
  function project(x, y, h = 0) {
    tmpP.set(x / U, h, y / U).project(camera);
    return { x: (tmpP.x + 1) / 2 * W, y: (1 - tmpP.y) / 2 * H, front: tmpP.z < 1 };
  }

  // ---------------------------------------------------------------- Rendu d'une image
  function render(S, dt) {
    if (!ready || !S) return;
    time += dt;
    const p = S.p;
    const px = p.x / U, pz = p.y / U;
    placeCamera(px, pz);
    beginPools();
    if (S.mode === 'world') { updateWorld3D(S, dt, px, pz); W3.wt.visible = true; }
    if (hero) updateHero(S, dt);

    // Monstres : un lot par type ; les monstres ordinaires ont leur modèle, les boss restent des blocs (étape 4)
    for (const b of monsters.values()) b.n = 0;
    const seenBosses = new Set();
    for (const e of S.enemies) {
      if (e.dead) continue;
      if (e.boss && bossBuilder(e.id)) { seenBosses.add(e); updateBoss(e, dt, p); continue; }
      const d = e.def, b = monsterBatch(e.id);
      if (b.model) {
        const R = (e.r / U) * 1.25;
        monsterPose(b.anim, time, e.seed, pose);
        // Teinte par instance : blanc quand touché, vert empoisonné, bleu ralenti
        if (e.flash > 0) tmpC.setRGB(2.6, 2.6, 2.6);
        else if (e.poisonT > 0) tmpC.setRGB(0.7, 1.45, 0.7);
        else if (e.slowT > 0) tmpC.setRGB(0.75, 0.9, 1.4);
        else tmpC.setRGB(1, 1, 1);
        b.add(e.x / U, pose.y * b.h * R, e.y / U, Math.atan2(p.x - e.x, p.y - e.y) + pose.yaw, R * pose.sx, R * pose.sy, R * pose.sz, tmpC, pose.rx, pose.rz);
        continue;
      }
      const w = (e.r * 2) / U, h = (e.r * (e.boss ? 2.6 : 2.2)) / U;
      const hop = Math.abs(Math.sin(time * 8 + e.seed)) * 0.12 * h;
      const ry = Math.atan2(p.x - e.x, p.y - e.y);
      tmpC.set(e.flash > 0 ? 0xffffff : d.body);
      b.add(e.x / U, hop, e.y / U, ry, w, h * (1 + Math.sin(time * 8 + e.seed) * 0.05), w * 0.9, tmpC);
    }
    for (const b of monsters.values()) b.commit();
    releaseBosses(seenBosses);

    for (const sp of S.spells) {
      const def = SPELLS[sp.id];
      // Invocations : bouftous, tofus, pelle animée, double
      for (const m of sp.minions || []) {
        const make = MINION_MAKE[sp.id] || MINION_MAKE.double;
        const g = pool('minion_' + sp.id, make);
        g.position.set(m.x / U, Math.abs(Math.sin(m.walk)) * 0.15, m.y / U);
        g.rotation.y = m.face > 0 ? Math.PI / 2 : -Math.PI / 2;
      }
      // Objets en orbite (épées, griffes)
      if (def.type === 'orbit') {
        const s = sp.s, n = Math.round(s.count), R = (s.radius * S.stats.area) / U;
        for (let i = 0; i < n; i++) {
          const a = sp.angle + (i / n) * Math.PI * 2;
          const g = pool('orbit_' + sp.id, ORBIT_MAKE[sp.id] || ORBIT_MAKE.epee_jugement);
          g.position.set(px + Math.cos(a) * R, 0.9, pz + Math.sin(a) * R);
          g.rotation.set(0, -a - Math.PI / 2, 0);
          if (Math.random() < 0.3) part(g.position.x, 0.9, g.position.z, def.color, { life: 0.25, s: 0.08 });
        }
      }
      // Auras permanentes : glyphe qui suit le héros
      if (def.type === 'aura') {
        const r = (sp.s.radius * S.stats.area) / U;
        const g = pool('aura', makeGlyph);
        tintGlyph(g, def.color, 0.6 + 0.15 * Math.sin(time * 3));
        g.position.set(px, 0.03, pz);
        g.scale.set(r, 1, r);
        g.rotation.y = time * 0.6;
      }
    }

    // Glyphes posés au sol
    for (const gl of S.glyphs) {
      const g = pool('glyph', makeGlyph);
      const k = Math.min(1, gl.life / 0.4) * Math.min(1, (gl.max - gl.life) * 6);
      tintGlyph(g, gl.color, k);
      g.position.set(gl.x / U, 0.04, gl.y / U);
      g.scale.set(gl.r / U, 1, gl.r / U);
      g.rotation.y = -time * 0.9;
      if (Math.random() < 0.4) { const a = Math.random() * Math.PI * 2, rr = Math.random() * gl.r / U; part(gl.x / U + Math.cos(a) * rr, 0.1, gl.y / U + Math.sin(a) * rr, gl.color, { vy: 1.2, life: 0.6, s: 0.09 }); }
    }

    // Frappes : début (annonce) et impact détectés par apparition / disparition dans la liste
    const nowStrikes = new Set(S.strikes);
    for (const s of nowStrikes) if (!prevStrikes.has(s)) onStrikeStart(s);
    for (const s of prevStrikes) if (!nowStrikes.has(s)) onStrikeImpact(s);
    prevStrikes = nowStrikes;
    // Frappes : cercle d'alerte au sol puis objet qui tombe du ciel (ou jaillit du sol)
    for (const s of S.strikes) {
      const k = 1 - s.t / s.life;
      const r = ring();
      r.material.color.set(s.color);
      r.material.opacity = 0.5 + 0.5 * k;
      r.position.set(s.x / U, 0.06, s.y / U);
      r.rotation.set(Math.PI / 2, 0, 0);
      r.scale.setScalar(s.r / U);
      const d = disc();
      d.material.color.set(s.color);
      d.material.opacity = 0.25 * k;
      d.position.set(s.x / U, 0.05, s.y / U);
      d.scale.set((s.r / U) * k, 1, (s.r / U) * k);
      const style = STRIKE_STYLE[s.id] || 'orb';
      const o = pool('strike_' + style, STRIKE_MAKE[style]);
      if (style === 'thorn') {
        o.position.set(s.x / U, 0, s.y / U);
        o.scale.set(1, Math.max(0.01, smooth(k)), 1);
        o.rotation.set(0, s.spin, 0);
      } else {
        const fall = Math.pow(1 - k, 1.7);
        o.position.set(s.x / U, fall * 7, s.y / U);
        o.scale.setScalar(1);
        o.rotation.set(style === 'die' || style === 'bomb' ? time * 6 : 0, s.spin + (style === 'die' ? time * 4 : 0), 0);
        const trailCol = style === 'sword' ? (Math.random() < 0.5 ? '#ff7a2a' : '#ffd84a') : s.color;
        for (let i = 0; i < (style === 'sword' ? 3 : 1); i++) if (Math.random() < 0.7) part(s.x / U + (Math.random() - 0.5) * 0.4, fall * 7 + 0.5 + Math.random() * 2, s.y / U + (Math.random() - 0.5) * 0.4, trailCol, { life: 0.35, s: style === 'sword' ? 0.18 : 0.12, vy: 0.6 });
      }
    }

    // Pièges : plaques à pointes ou bombes à mèche qui clignotent
    for (const t of S.traps) {
      const g = t.fuse ? pool('bomb', makeFuseBomb) : pool('spike', makeSpikeTrap);
      g.position.set(t.x / U, 0, t.y / U);
      if (t.fuse) {
        const blink = Math.sin(time * (10 + (2.5 - t.life) * 12)) > 0;
        g.userData.spark.visible = blink;
        g.scale.setScalar(1 + (t.life < 0.5 ? (0.5 - t.life) * 0.6 : 0));
        if (blink && Math.random() < 0.5) part(t.x / U, 0.85, t.y / U, '#ffd84a', { vy: 1.5, life: 0.25, s: 0.06 });
      } else {
        g.userData.gem.rotation.y = time * 3;
        g.scale.setScalar(t.arm > 0 ? 1 - t.arm : 1);
      }
    }

    // Projectiles : forme selon le sort + traînée lumineuse
    for (const pr of S.projs) {
      const style = PROJ_STYLE[pr.id] || 'orb';
      const b = projBatch(style);
      const s = pr.size / U;
      const ry = Math.atan2(pr.vx, pr.vy);
      const x = pr.x / U, z = pr.y / U;
      tmpC.set(pr.color);
      if (style === 'arrow' || style === 'needle' || style === 'dagger') b.add(x, 0.8, z, ry, s * 2.2, s * 2.2, s * 6, tmpC);
      else if (style === 'coin') b.add(x, 0.8, z, ry, s * 3, s * 3, s * 3, tmpC.set('#ffd84a'), time * 14);
      else b.add(x, 0.8, z, ry, s * 3, s * 3, s * 3, tmpC);
      if (Math.random() < 0.8) part(x - Math.sin(ry) * s * 3, 0.8, z - Math.cos(ry) * s * 3, pr.color, { life: 0.28, s: s * 1.4 });
    }
    for (const b of projStyles.values()) b.commit();
    for (const ep of S.eprojs) eprojB.add(ep.x / U, 0.7, ep.y / U, 0, 0.2, 0.2, 0.2, tmpC.set(ep.color));
    eprojB.commit();

    // Objets au sol
    for (const g of S.gems) {
      const bob = 0.35 + Math.sin(time * 4 + g.x * 0.1) * 0.06;
      if (g.kind === 'xp') {
        const s = g.v >= 10 ? 0.2 : g.v >= 3 ? 0.15 : 0.12;
        xpB.add(g.x / U, bob, g.y / U, time * 2, s * 0.7, s * 1.3, s * 0.7, tmpC.set(g.v >= 10 ? 0xff5fa2 : g.v >= 3 ? 0x4fd1ff : 0x7dff6a));
      } else if (g.kind === 'kamas') coinB.add(g.x / U, bob, g.y / U, time * 3, 0.18, 0.18, 0.18, tmpC.set(0xffd84a), Math.PI / 2);
      else {
        const col = { heal: 0xc88a3a, magnet: 0xe03030, chest: 0x9a6a2a, dofus: g.id ? DOFUS[g.id].color : 0xffffff, item: g.item ? g.item.color : 0xffffff }[g.kind] || 0xffffff;
        const s = g.kind === 'chest' ? 0.7 : g.kind === 'dofus' ? 0.45 : 0.35;
        // Équipement au sol : colonne de lumière de la couleur de sa rareté
        if (g.kind === 'item' && Math.random() < 0.5) part(g.x / U + (Math.random() - 0.5) * 0.3, 0.3, g.y / U + (Math.random() - 0.5) * 0.3, g.item.color, { vy: 2.4, life: 0.7, s: 0.1 });
        miscB.add(g.x / U, g.kind === 'chest' ? 0 : bob - 0.2, g.y / U, time, s, g.kind === 'dofus' ? s * 1.3 : s * 0.7, s, tmpC.set(col));
      }
    }
    coinB.commit(); miscB.commit();

    // Effets : anneaux et ondes de choc, coups de mêlée, étincelles
    for (const f of S.fx) {
      const k = f.t / f.life;
      if (f.type === 'ring') {
        const rr = (f.r / U) * (0.4 + 0.6 * Math.min(1, k * 1.6));
        const r = ring();
        r.material.color.set(f.color);
        r.material.opacity = 0.9 * (1 - k);
        r.position.set(f.x / U, 0.08, f.y / U);
        r.rotation.set(Math.PI / 2, 0, 0);
        r.scale.setScalar(rr);
        if (f.fill) {
          const d = disc();
          d.material.color.set(f.color);
          d.material.opacity = 0.22 * (1 - k);
          d.position.set(f.x / U, 0.05, f.y / U);
          d.scale.set(rr, 1, rr);
          // Onde de choc verticale qui s'élargit
          const w = wave();
          w.material.color.set(f.color);
          w.material.opacity = 0.35 * (1 - k);
          w.position.set(f.x / U, 0.4 * (1 - k), f.y / U);
          w.scale.set(rr, 0.8 * (1 - k) + 0.05, rr);
        }
      } else if (f.type === 'arc') {
        const a = arc();
        a.geometry = arcGeo(f.arc);
        a.material.color.set(f.color);
        a.material.opacity = 0.45 * (1 - k);
        a.position.set(f.x / U, 0.1, f.y / U);
        a.rotation.set(-Math.PI / 2, 0, -f.a);
        a.scale.setScalar(f.r / U);
        // Lame de lumière qui balaie l'arc à hauteur de taille
        const sl = slash();
        sl.geometry = slashGeo(f.arc * Math.min(1, 0.3 + k * 1.4));
        sl.material.color.set('#ffffff');
        sl.material.opacity = 0.9 * (1 - k);
        sl.position.set(f.x / U, 0.9, f.y / U);
        sl.rotation.set(-Math.PI / 2, 0, -f.a - f.arc / 2);
        sl.scale.setScalar((f.r / U) * 0.85);
        if (k < 0.6 && Math.random() < 0.9) {
          const aa = f.a + (Math.random() - 0.5) * f.arc, rr = (f.r / U) * (0.6 + Math.random() * 0.4);
          part(f.x / U + Math.cos(aa) * rr, 0.6 + Math.random() * 0.6, f.y / U + Math.sin(aa) * rr, Math.random() < 0.5 ? '#ffffff' : f.color, { vy: 1, life: 0.3, s: 0.08 });
        }
      } else if (f.type === 'xp') {
        // Cristal d'expérience qui file vers le héros
        const e = k * k;
        const s = f.v >= 10 ? 0.2 : f.v >= 3 ? 0.15 : 0.12;
        xpB.add(lerpN(f.x, p.x, e) / U, 0.5 + Math.sin(k * Math.PI) * 1.2 + e * 0.5, lerpN(f.y, p.y, e) / U, time * 6, s * 0.7, s * 1.3, s * 0.7, tmpC.set(f.v >= 10 ? 0xff5fa2 : f.v >= 3 ? 0x4fd1ff : 0x7dff6a));
      } else if (f.type === 'spark') {
        sparkB.add(f.x / U, 0.4 + (1 - k) * 0.4, f.y / U, f.t * 6, 0.1, 0.1, 0.1, tmpC.set(f.color));
      }
    }
    sparkB.commit();
    xpB.commit();

    shake = Math.max(0, shake - dt * 1.4);
    updateVfx(dt);
    updateParts(dt);
    endPools();
    renderer.render(scene, camera);
  }

  return { supported, init, resize, begin, end, render, project, viewRadius, U };
})();
