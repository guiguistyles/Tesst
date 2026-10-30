'use strict';
// Généré par tools/sprites/build.js — ne pas modifier à la main.
// Lignes : 8 directions (0 = est, puis sens horaire ; 2 = vers le bas de l'écran).
// fit : rayon (unités de dessin) qui correspond au rayon r d'un monstre ; res : planche dessinée res fois plus fine.
const SPRITE_SHEETS = {
  "bouftou": {
    "src": "assets/sprites/bouftou.webp",
    "directions": 8,
    "res": 2,
    "frameW": 190,
    "frameH": 150,
    "frames": 18,
    "fps": 24,
    "anchorX": 0.5,
    "anchorY": 0.82,
    "fit": 17.5
  },
  "bouftou_attack": {
    "src": "assets/sprites/bouftou_attack.webp",
    "directions": 8,
    "res": 2,
    "frameW": 200,
    "frameH": 152,
    "frames": 31,
    "fps": 50,
    "anchorX": 0.5,
    "anchorY": 0.76,
    "fit": 17.5
  },
  "bouftou_royal": {
    "src": "assets/sprites/bouftou_royal.webp",
    "directions": 8,
    "res": 2,
    "frameW": 334,
    "frameH": 300,
    "frames": 30,
    "fps": 24,
    "anchorX": 0.5,
    "anchorY": 0.84,
    "fit": 30.6
  },
  "bouftou_royal_attack": {
    "src": "assets/sprites/bouftou_royal_attack.webp",
    "directions": 8,
    "res": 2,
    "frameW": 332,
    "frameH": 334,
    "frames": 25,
    "fps": 40,
    "anchorX": 0.5,
    "anchorY": 0.82,
    "fit": 30.6
  },
  "boufton_noir": {
    "src": "assets/sprites/boufton_noir.webp",
    "directions": 8,
    "res": 2,
    "frameW": 160,
    "frameH": 128,
    "frames": 18,
    "fps": 26,
    "anchorX": 0.5,
    "anchorY": 0.8,
    "fit": 14
  },
  "boufton_noir_attack": {
    "src": "assets/sprites/boufton_noir_attack.webp",
    "directions": 8,
    "res": 2,
    "frameW": 172,
    "frameH": 132,
    "frames": 31,
    "fps": 50,
    "anchorX": 0.5,
    "anchorY": 0.78,
    "fit": 14
  },
  "tofu": {
    "src": "assets/sprites/tofu.webp",
    "directions": 8,
    "res": 2,
    "frameW": 100,
    "frameH": 104,
    "frames": 12,
    "fps": 24,
    "anchorX": 0.5,
    "anchorY": 0.86,
    "fit": 10
  },
  "tofu_attack": {
    "src": "assets/sprites/tofu_attack.webp",
    "directions": 8,
    "res": 2,
    "frameW": 314,
    "frameH": 228,
    "frames": 32,
    "fps": 52,
    "anchorX": 0.5,
    "anchorY": 0.75,
    "fit": 10
  },
  "tofu_royal": {
    "src": "assets/sprites/tofu_royal.webp",
    "directions": 8,
    "res": 2,
    "frameW": 360,
    "frameH": 342,
    "frames": 27,
    "fps": 24,
    "anchorX": 0.5,
    "anchorY": 0.82,
    "fit": 31
  },
  "piou": {
    "src": "assets/sprites/piou.webp",
    "directions": 8,
    "res": 2,
    "frameW": 88,
    "frameH": 74,
    "frames": 8,
    "fps": 24,
    "anchorX": 0.5,
    "anchorY": 0.86,
    "fit": 8.2
  },
  "piou_attack": {
    "src": "assets/sprites/piou_attack.webp",
    "directions": 8,
    "res": 2,
    "frameW": 100,
    "frameH": 84,
    "frames": 21,
    "fps": 35,
    "anchorX": 0.5,
    "anchorY": 0.68,
    "fit": 8.2
  },
  "larve_bleue": {
    "src": "assets/sprites/larve_bleue.webp",
    "directions": 8,
    "frameW": 59,
    "frameH": 39,
    "frames": 16,
    "fps": 24,
    "anchorX": 0.5,
    "anchorY": 0.72,
    "fit": 14
  },
  "larve_bleue_attack": {
    "src": "assets/sprites/larve_bleue_attack.webp",
    "directions": 8,
    "frameW": 66,
    "frameH": 54,
    "frames": 27,
    "fps": 45,
    "anchorX": 0.5,
    "anchorY": 0.7,
    "fit": 14
  },
  "iop_run": {
    "src": "assets/sprites/iop_run.webp",
    "directions": 8,
    "frameW": 78,
    "frameH": 92,
    "frames": 30,
    "fps": 40,
    "anchorX": 0.5,
    "anchorY": 0.84
  },
  "iop_idle": {
    "src": "assets/sprites/iop_idle.webp",
    "directions": 8,
    "frameW": 56,
    "frameH": 90,
    "frames": 21,
    "fps": 20,
    "anchorX": 0.5,
    "anchorY": 0.84
  },
  "iop_attack": {
    "src": "assets/sprites/iop_attack.webp",
    "directions": 8,
    "frameW": 120,
    "frameH": 112,
    "frames": 24,
    "fps": 40,
    "anchorX": 0.5,
    "anchorY": 0.78
  },
  "cra_run": {
    "src": "assets/sprites/cra_run.webp",
    "directions": 8,
    "frameW": 78,
    "frameH": 92,
    "frames": 30,
    "fps": 40,
    "anchorX": 0.5,
    "anchorY": 0.84
  },
  "cra_idle": {
    "src": "assets/sprites/cra_idle.webp",
    "directions": 8,
    "frameW": 56,
    "frameH": 90,
    "frames": 21,
    "fps": 20,
    "anchorX": 0.5,
    "anchorY": 0.84
  },
  "cra_attack": {
    "src": "assets/sprites/cra_attack.webp",
    "directions": 8,
    "frameW": 120,
    "frameH": 112,
    "frames": 24,
    "fps": 40,
    "anchorX": 0.5,
    "anchorY": 0.78
  },
  "feca_run": {
    "src": "assets/sprites/feca_run.webp",
    "directions": 8,
    "frameW": 78,
    "frameH": 92,
    "frames": 30,
    "fps": 40,
    "anchorX": 0.5,
    "anchorY": 0.84
  },
  "feca_idle": {
    "src": "assets/sprites/feca_idle.webp",
    "directions": 8,
    "frameW": 56,
    "frameH": 90,
    "frames": 21,
    "fps": 20,
    "anchorX": 0.5,
    "anchorY": 0.84
  },
  "feca_attack": {
    "src": "assets/sprites/feca_attack.webp",
    "directions": 8,
    "frameW": 120,
    "frameH": 112,
    "frames": 24,
    "fps": 40,
    "anchorX": 0.5,
    "anchorY": 0.78
  },
  "eniripsa_run": {
    "src": "assets/sprites/eniripsa_run.webp",
    "directions": 8,
    "frameW": 78,
    "frameH": 92,
    "frames": 30,
    "fps": 40,
    "anchorX": 0.5,
    "anchorY": 0.84
  },
  "eniripsa_idle": {
    "src": "assets/sprites/eniripsa_idle.webp",
    "directions": 8,
    "frameW": 56,
    "frameH": 90,
    "frames": 21,
    "fps": 20,
    "anchorX": 0.5,
    "anchorY": 0.84
  },
  "eniripsa_attack": {
    "src": "assets/sprites/eniripsa_attack.webp",
    "directions": 8,
    "frameW": 120,
    "frameH": 112,
    "frames": 24,
    "fps": 40,
    "anchorX": 0.5,
    "anchorY": 0.78
  },
  "sram_run": {
    "src": "assets/sprites/sram_run.webp",
    "directions": 8,
    "frameW": 78,
    "frameH": 92,
    "frames": 30,
    "fps": 40,
    "anchorX": 0.5,
    "anchorY": 0.84
  },
  "sram_idle": {
    "src": "assets/sprites/sram_idle.webp",
    "directions": 8,
    "frameW": 56,
    "frameH": 90,
    "frames": 21,
    "fps": 20,
    "anchorX": 0.5,
    "anchorY": 0.84
  },
  "sram_attack": {
    "src": "assets/sprites/sram_attack.webp",
    "directions": 8,
    "frameW": 120,
    "frameH": 112,
    "frames": 24,
    "fps": 40,
    "anchorX": 0.5,
    "anchorY": 0.78
  },
  "xelor_run": {
    "src": "assets/sprites/xelor_run.webp",
    "directions": 8,
    "frameW": 78,
    "frameH": 92,
    "frames": 30,
    "fps": 40,
    "anchorX": 0.5,
    "anchorY": 0.84
  },
  "xelor_idle": {
    "src": "assets/sprites/xelor_idle.webp",
    "directions": 8,
    "frameW": 56,
    "frameH": 90,
    "frames": 21,
    "fps": 20,
    "anchorX": 0.5,
    "anchorY": 0.84
  },
  "xelor_attack": {
    "src": "assets/sprites/xelor_attack.webp",
    "directions": 8,
    "frameW": 120,
    "frameH": 112,
    "frames": 24,
    "fps": 40,
    "anchorX": 0.5,
    "anchorY": 0.78
  },
  "osamodas_run": {
    "src": "assets/sprites/osamodas_run.webp",
    "directions": 8,
    "frameW": 78,
    "frameH": 92,
    "frames": 30,
    "fps": 40,
    "anchorX": 0.5,
    "anchorY": 0.84
  },
  "osamodas_idle": {
    "src": "assets/sprites/osamodas_idle.webp",
    "directions": 8,
    "frameW": 56,
    "frameH": 90,
    "frames": 21,
    "fps": 20,
    "anchorX": 0.5,
    "anchorY": 0.84
  },
  "osamodas_attack": {
    "src": "assets/sprites/osamodas_attack.webp",
    "directions": 8,
    "frameW": 120,
    "frameH": 112,
    "frames": 24,
    "fps": 40,
    "anchorX": 0.5,
    "anchorY": 0.78
  },
  "sacrieur_run": {
    "src": "assets/sprites/sacrieur_run.webp",
    "directions": 8,
    "frameW": 78,
    "frameH": 92,
    "frames": 30,
    "fps": 40,
    "anchorX": 0.5,
    "anchorY": 0.84
  },
  "sacrieur_idle": {
    "src": "assets/sprites/sacrieur_idle.webp",
    "directions": 8,
    "frameW": 56,
    "frameH": 90,
    "frames": 21,
    "fps": 20,
    "anchorX": 0.5,
    "anchorY": 0.84
  },
  "sacrieur_attack": {
    "src": "assets/sprites/sacrieur_attack.webp",
    "directions": 8,
    "frameW": 120,
    "frameH": 112,
    "frames": 24,
    "fps": 40,
    "anchorX": 0.5,
    "anchorY": 0.78
  },
  "enutrof_run": {
    "src": "assets/sprites/enutrof_run.webp",
    "directions": 8,
    "frameW": 78,
    "frameH": 92,
    "frames": 30,
    "fps": 40,
    "anchorX": 0.5,
    "anchorY": 0.84
  },
  "enutrof_idle": {
    "src": "assets/sprites/enutrof_idle.webp",
    "directions": 8,
    "frameW": 56,
    "frameH": 90,
    "frames": 21,
    "fps": 20,
    "anchorX": 0.5,
    "anchorY": 0.84
  },
  "enutrof_attack": {
    "src": "assets/sprites/enutrof_attack.webp",
    "directions": 8,
    "frameW": 120,
    "frameH": 112,
    "frames": 24,
    "fps": 40,
    "anchorX": 0.5,
    "anchorY": 0.78
  },
  "roublard_run": {
    "src": "assets/sprites/roublard_run.webp",
    "directions": 8,
    "frameW": 78,
    "frameH": 92,
    "frames": 30,
    "fps": 40,
    "anchorX": 0.5,
    "anchorY": 0.84
  },
  "roublard_idle": {
    "src": "assets/sprites/roublard_idle.webp",
    "directions": 8,
    "frameW": 56,
    "frameH": 90,
    "frames": 21,
    "fps": 20,
    "anchorX": 0.5,
    "anchorY": 0.84
  },
  "roublard_attack": {
    "src": "assets/sprites/roublard_attack.webp",
    "directions": 8,
    "frameW": 120,
    "frameH": 112,
    "frames": 24,
    "fps": 40,
    "anchorX": 0.5,
    "anchorY": 0.78
  }
};
