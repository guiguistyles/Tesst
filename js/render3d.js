'use strict';
// Rendu 3D du jeu (Three.js r128). La logique reste dans game.js : ce module
// ne fait que dessiner l'état de la partie. Pour tenir des centaines de
// monstres, tout ce qui est nombreux est dessiné par lots (InstancedMesh) :
// un lot par type de monstre, un pour les projectiles, un pour les cristaux…

const Render3D = (() => {
  const U = 32;                  // pixels de jeu par mètre
  const TILE = 3;                // taille d'une case du damier au sol (m)
  const TILES = 26;              // cases de chaque côté du joueur
  const TILT = THREE.MathUtils.degToRad(52); // inclinaison de la caméra (vue 3/4 fixe)
  const FOV = 30;

  let ready = false, renderer, scene, camera, sun, canvas;
  let W = 1, H = 1, zoom = 1;
  let zoneIdx = -1;
  let time = 0;

  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler();
  const tmpP = new THREE.Vector3(), tmpS = new THREE.Vector3(), tmpC = new THREE.Color(), WHITE = new THREE.Color(0xffffff);

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
      add(x, y, z, ry, sx, sy, sz, color, rx = 0) {
        if (this.n >= cap) return;
        tmpE.set(rx, ry, 0);
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

  let monsters;            // Map id -> lot
  let projB, eprojB, xpB, coinB, miscB, sparkB, minionB, orbitB, trapB, shadowB;
  let ground, tiles, deco;
  let player = null;
  const pools = {};        // anneaux, arcs, disques (effets peu nombreux)

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
    projB = batch(new THREE.BoxGeometry(1, 1, 1), glow(), 400, false);
    eprojB = batch(new THREE.SphereGeometry(1, 8, 6), glow(), 300, false);
    xpB = batch(new THREE.OctahedronGeometry(1, 0), solid(), 500, false);
    coinB = batch(new THREE.CylinderGeometry(1, 1, 0.25, 10), solid(), 200, false);
    miscB = batch(up(new THREE.BoxGeometry(1, 1, 1)), solid(), 40);
    sparkB = batch(new THREE.BoxGeometry(1, 1, 1), glow(), 600, false);
    minionB = batch(up(new THREE.BoxGeometry(1, 1, 1)), solid(), 20);
    orbitB = batch(new THREE.ConeGeometry(1, 1, 4), glow(), 20, false);
    trapB = batch(up(new THREE.ConeGeometry(1, 1, 5)), solid(), 30);
    shadowB = null;
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

  function monsterBatch(id) {
    let b = monsters.get(id);
    if (!b) {
      b = batch(up(new THREE.BoxGeometry(1, 1, 1)), solid(), 420);
      monsters.set(id, b);
    }
    return b;
  }

  /** Effets peu nombreux : réserve de maillages réutilisés image après image. */
  function pool(name, make) {
    const p = pools[name] || (pools[name] = { items: [], used: 0, make });
    return {
      get() {
        let m = p.items[p.used];
        if (!m) { m = p.make(); scene.add(m); p.items.push(m); }
        p.used++;
        m.visible = true;
        return m;
      },
    };
  }
  function beginPools() { for (const k in pools) pools[k].used = 0; }
  function endPools() { for (const k in pools) { const p = pools[k]; for (let i = p.used; i < p.items.length; i++) p.items[i].visible = false; } }
  const ringPool = pool.bind(null, 'ring', () => new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 6, 32), glow(0.9)));
  const discPool = pool.bind(null, 'disc', () => new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.04, 40), glow(0.3)));
  const arcGeos = new Map();
  /** Géométrie d'arc de mêlée, mise en cache par ouverture d'angle. */
  function arcGeo(arc) {
    const key = arc.toFixed(2);
    if (!arcGeos.has(key)) arcGeos.set(key, new THREE.CircleGeometry(1, 16, -arc / 2, arc));
    return arcGeos.get(key);
  }
  const arcPool = pool.bind(null, 'arc', () => { const m = new THREE.Mesh(new THREE.CircleGeometry(1, 20, 0, 1), glow(0.5)); m.material.side = THREE.DoubleSide; return m; });

  // ---------------------------------------------------------------- Joueur (silhouette provisoire, remplacée à l'étape 2)
  function buildPlayer(cls) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(up(new THREE.BoxGeometry(0.55, 0.85, 0.4)), new THREE.MeshStandardMaterial({ color: cls.color, flatShading: true }));
    body.position.y = 0.45;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.4), new THREE.MeshStandardMaterial({ color: 0xf3d1a8, flatShading: true }));
    head.position.y = 1.55;
    const hat = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.12, 0.44), new THREE.MeshStandardMaterial({ color: cls.accent, flatShading: true }));
    hat.position.y = 1.8;
    const eyes = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.02), new THREE.MeshBasicMaterial({ color: 0x1e1214 }));
    eyes.position.set(0, 1.58, 0.21);
    const legs = new THREE.Mesh(up(new THREE.BoxGeometry(0.4, 0.45, 0.3)), new THREE.MeshStandardMaterial({ color: 0x3a2a1a, flatShading: true }));
    for (const m of [body, head, hat, legs]) m.castShadow = true;
    g.add(body, head, hat, eyes, legs);
    const shield = new THREE.Mesh(new THREE.SphereGeometry(1.1, 16, 10), glow(0.25));
    shield.material.color.set(0x9fd8ff);
    shield.position.y = 1;
    g.add(shield);
    scene.add(g);
    return { g, body, head, shield, mats: [body.material, head.material, hat.material, legs.material], base: [cls.color, 0xf3d1a8, cls.accent, 0x3a2a1a] };
  }

  // ---------------------------------------------------------------- Début / fin de partie
  function begin(S) {
    if (!ready) return;
    zoneIdx = S.zoneIdx;
    const z = S.zone;
    ground.material.color.set(z.ground);
    tiles.material.color.set(z.ground2);
    const sky = new THREE.Color(z.ground).lerp(new THREE.Color(0xffffff), 0.55);
    scene.background = sky;
    scene.fog = new THREE.Fog(sky, 30, 60);
    if (player) scene.remove(player.g);
    player = buildPlayer(CLASSES[S.cls]);
    time = 0;
  }
  function end() {
    if (!ready) return;
    if (player) { scene.remove(player.g); player = null; }
  }

  // ---------------------------------------------------------------- Caméra
  function placeCamera(px, pz) {
    // Distance calculée pour montrer à peu près la même surface que la vue 2D
    const halfH = (H / 2 / zoom) / U, halfW = (W / 2 / zoom) / U;
    const t = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const d = Math.max(halfH * 0.95 / t, (halfW * 0.82) / (t * camera.aspect)) * 0.72;
    // Le brouillard cache le haut de l'écran, là où les monstres apparaissent
    scene.fog.near = d * 1.05;
    scene.fog.far = d * 1.75;
    camera.position.set(px, Math.sin(TILT) * d, pz + Math.cos(TILT) * d);
    camera.lookAt(px, 0, pz);
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
      r = Math.max(r, Math.min(d, scene.fog ? scene.fog.far * 0.8 : 60));
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

    // Joueur
    if (player) {
      const bob = Math.abs(Math.sin(p.walk)) * 0.08;
      player.g.position.set(px, bob, pz);
      player.g.rotation.y = Math.atan2(p.dirX, p.dirY);
      const hurt = p.hurt > 0;
      player.mats.forEach((m, i) => m.color.set(hurt ? 0xffffff : player.base[i]));
      player.shield.visible = p.shield > 0;
    }

    // Monstres : un lot par type
    for (const b of monsters.values()) b.n = 0;
    for (const e of S.enemies) {
      if (e.dead) continue;
      const d = e.def, b = monsterBatch(e.id);
      const w = (e.r * 2) / U, h = (e.r * (e.boss ? 2.6 : 2.2)) / U;
      const hop = Math.abs(Math.sin(time * 8 + e.seed)) * 0.12 * h;
      const ry = Math.atan2(p.x - e.x, p.y - e.y);
      tmpC.set(e.flash > 0 ? 0xffffff : d.body);
      b.add(e.x / U, hop, e.y / U, ry, w, h * (1 + Math.sin(time * 8 + e.seed) * 0.05), w * 0.9, tmpC);
    }
    for (const b of monsters.values()) b.commit();

    // Invocations (doubles, bouftous, pelles…)
    for (const sp of S.spells) {
      const def = SPELLS[sp.id];
      for (const m of sp.minions || []) {
        const s = (sp.s.size * 2) / U;
        minionB.add(m.x / U, Math.abs(Math.sin(m.walk)) * 0.1, m.y / U, m.face > 0 ? Math.PI / 2 : -Math.PI / 2, s, s * 1.2, s, tmpC.set(def.color));
      }
      // Épées en orbite
      if (def.type === 'orbit') {
        const s = sp.s, n = Math.round(s.count), R = s.radius * S.stats.area;
        for (let i = 0; i < n; i++) {
          const a = sp.angle + (i / n) * Math.PI * 2;
          orbitB.add((p.x + Math.cos(a) * R) / U, 0.8, (p.y + Math.sin(a) * R) / U, -a, 0.18, (s.size * 2.6) / U, 0.18, tmpC.set(def.color), Math.PI / 2);
        }
      }
      // Auras permanentes
      if (def.type === 'aura') {
        const r = (sp.s.radius * S.stats.area) / U;
        const m = discPool().get();
        m.material.color.set(def.color);
        m.material.opacity = 0.16 + 0.05 * Math.sin(time * 3);
        m.position.set(px, 0.03, pz);
        m.scale.set(r, 1, r);
      }
    }
    minionB.commit();
    orbitB.commit();

    // Zones au sol : glyphes, frappes annoncées, pièges
    for (const g of S.glyphs) {
      const m = discPool().get();
      m.material.color.set(g.color);
      m.material.opacity = 0.32 * Math.min(1, g.life / 0.4);
      m.position.set(g.x / U, 0.04, g.y / U);
      m.scale.set(g.r / U, 1, g.r / U);
    }
    for (const s of S.strikes) {
      const k = 1 - s.t / s.life;
      const r = ringPool().get();
      r.material.color.set(s.color);
      r.material.opacity = 0.5 + 0.5 * k;
      r.position.set(s.x / U, 0.06, s.y / U);
      r.rotation.set(Math.PI / 2, 0, 0);
      r.scale.setScalar(s.r / U);
      const d = discPool().get();
      d.material.color.set(s.color);
      d.material.opacity = 0.25 * k;
      d.position.set(s.x / U, 0.05, s.y / U);
      d.scale.set((s.r / U) * k, 1, (s.r / U) * k);
    }
    for (const t of S.traps) {
      const blink = t.fuse && Math.sin(time * 14) > 0;
      trapB.add(t.x / U, 0, t.y / U, time, t.fuse ? 0.32 : 0.3, t.fuse ? 0.32 : 0.18, t.fuse ? 0.32 : 0.3, tmpC.set(blink ? 0xffffff : t.fuse ? 0x22222a : t.color));
    }
    trapB.commit();

    // Projectiles
    for (const pr of S.projs) {
      const s = pr.size / U;
      projB.add(pr.x / U, 0.75, pr.y / U, Math.atan2(pr.vx, pr.vy), s * 1.2, s * 1.2, s * 4, tmpC.set(pr.color));
    }
    projB.commit();
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
        const col = { heal: 0xc88a3a, magnet: 0xe03030, chest: 0x9a6a2a, dofus: g.id ? DOFUS[g.id].color : 0xffffff }[g.kind] || 0xffffff;
        const s = g.kind === 'chest' ? 0.7 : g.kind === 'dofus' ? 0.45 : 0.35;
        miscB.add(g.x / U, g.kind === 'chest' ? 0 : bob - 0.2, g.y / U, time, s, g.kind === 'dofus' ? s * 1.3 : s * 0.7, s, tmpC.set(col));
      }
    }
    xpB.commit(); coinB.commit(); miscB.commit();

    // Effets : anneaux, arcs de mêlée, étincelles
    for (const f of S.fx) {
      const k = f.t / f.life;
      if (f.type === 'ring') {
        const r = ringPool().get();
        r.material.color.set(f.color);
        r.material.opacity = 0.9 * (1 - k);
        r.position.set(f.x / U, 0.08, f.y / U);
        r.rotation.set(Math.PI / 2, 0, 0);
        r.scale.setScalar((f.r / U) * (0.4 + 0.6 * Math.min(1, k * 1.6)));
        if (f.fill) {
          const d = discPool().get();
          d.material.color.set(f.color);
          d.material.opacity = 0.22 * (1 - k);
          d.position.set(f.x / U, 0.05, f.y / U);
          d.scale.set(r.scale.x, 1, r.scale.x);
        }
      } else if (f.type === 'arc') {
        const a = arcPool().get();
        a.material.color.set(f.color);
        a.material.opacity = 0.55 * (1 - k);
        a.geometry = arcGeo(f.arc);
        a.position.set(f.x / U, 0.5, f.y / U);
        a.rotation.set(-Math.PI / 2, 0, -f.a);
        a.scale.setScalar(f.r / U);
      } else if (f.type === 'spark') {
        sparkB.add(f.x / U, 0.4 + (1 - k) * 0.4, f.y / U, f.t * 6, 0.1, 0.1, 0.1, tmpC.set(f.color));
      }
    }
    sparkB.commit();

    endPools();
    renderer.render(scene, camera);
  }

  return { supported, init, resize, begin, end, render, project, viewRadius, U };
})();
