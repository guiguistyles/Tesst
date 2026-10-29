'use strict';
// Exporte les planches dessinées par generate.html vers assets/sprites/ et écrit js/sprites.js.
// Usage : node tools/sprites/build.js   (nécessite Playwright et Chromium)
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'assets/sprites');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('file://' + path.join(__dirname, 'generate.html'));
  const sheets = await page.evaluate(() => Object.fromEntries(Object.entries(MODELS).map(([name, spec]) => {
    const { model, ...meta } = spec;
    return [name, { ...meta, data: SHEETS[name].toDataURL('image/png') }];
  })));
  await browser.close();

  fs.mkdirSync(OUT, { recursive: true });
  const manifest = {};
  for (const [name, s] of Object.entries(sheets)) {
    const file = `${name}.png`;
    fs.writeFileSync(path.join(OUT, file), Buffer.from(s.data.split(',')[1], 'base64'));
    const { data, ...meta } = s;
    manifest[name] = { src: `assets/sprites/${file}`, directions: 8, ...meta };
    console.log(`${file}  ${s.frameW}×${s.frameH} × ${s.frames} images × 8 directions`);
  }
  const js = `'use strict';\n// Généré par tools/sprites/build.js — ne pas modifier à la main.\n` +
    `// Lignes : 8 directions (0 = est, puis sens horaire ; 2 = vers le bas de l'écran).\n` +
    `const SPRITE_SHEETS = ${JSON.stringify(manifest, null, 2)};\n`;
  fs.writeFileSync(path.join(ROOT, 'js/sprites.js'), js);
})();
