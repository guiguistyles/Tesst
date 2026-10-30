'use strict';
// Exporte les planches dessinées par generate.html vers assets/sprites/ et écrit js/sprites.js.
// Usage : node tools/sprites/build.js [nom ...]   (nécessite Playwright et Chromium)
// Sans argument, toutes les planches sont régénérées. Signale les images coupées par le bord de leur case.
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'assets/sprites');
const only = process.argv.slice(2);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('file://' + path.join(__dirname, 'generate.html') + '?noview');
  const sheets = await page.evaluate((only) => Object.fromEntries(Object.entries(MODELS).map(([name, spec]) => {
    const { model, ...meta } = spec;
    if (only.length && !only.includes(name)) return [name, { ...meta, skip: true }];
    const cv = Rig.sheet(spec), ctx = cv.getContext('2d');
    // cases dont un pixel opaque touche le bord : l'image déborde
    const clipped = [];
    const px = ctx.getImageData(0, 0, cv.width, cv.height).data;
    const alpha = (x, y) => px[(y * cv.width + x) * 4 + 3];
    for (let row = 0; row < 8; row++) {
      for (let i = 0; i < spec.frames; i++) {
        const x0 = i * spec.frameW, y0 = row * spec.frameH, x1 = x0 + spec.frameW - 1, y1 = y0 + spec.frameH - 1;
        let hit = '';
        for (let x = x0; x <= x1 && !hit; x++) { if (alpha(x, y0) > 40) hit = 'haut'; else if (alpha(x, y1) > 40) hit = 'bas'; }
        for (let y = y0; y <= y1 && !hit; y++) { if (alpha(x0, y) > 40) hit = 'gauche'; else if (alpha(x1, y) > 40) hit = 'droite'; }
        if (hit && !clipped.includes(`dir ${row} ${hit}`)) clipped.push(`dir ${row} ${hit}`);
      }
    }
    return [name, { ...meta, clipped, data: cv.toDataURL('image/webp', 0.92) }];
  })), only);
  await browser.close();

  fs.mkdirSync(OUT, { recursive: true });
  const manifest = {};
  for (const [name, s] of Object.entries(sheets)) {
    const file = `${name}.webp`;
    const { data, clipped, skip, ...meta } = s;
    manifest[name] = { src: `assets/sprites/${file}`, directions: 8, ...meta };
    if (skip) continue;
    fs.writeFileSync(path.join(OUT, file), Buffer.from(data.split(',')[1], 'base64'));
    const kb = Math.round(fs.statSync(path.join(OUT, file)).size / 1024);
    console.log(`${file.padEnd(28)} ${s.frameW}×${s.frameH} × ${s.frames} images × 8 directions  ${kb} Ko` +
      (clipped.length ? `  ⚠ coupé : ${clipped.join(', ')}` : ''));
  }
  const js = `'use strict';\n// Généré par tools/sprites/build.js — ne pas modifier à la main.\n` +
    `// Lignes : 8 directions (0 = est, puis sens horaire ; 2 = vers le bas de l'écran).\n` +
    `// fit : rayon (pixels de case) qui correspond au rayon r d'un monstre dans le jeu.\n` +
    `const SPRITE_SHEETS = ${JSON.stringify(manifest, null, 2)};\n`;
  fs.writeFileSync(path.join(ROOT, 'js/sprites.js'), js);
})();
