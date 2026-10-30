# ZaapSurvie 2.0

Jeu de survie par vagues (façon *Vampire Survivors*) dans l'univers de **Dofus 2**, inspiré de ZaapRush (version Dofus Rétro).
Jeu de fan non officiel, sans lien avec Ankama.

## Lancer le jeu

Aucune dépendance ni compilation : ouvrez `index.html` dans un navigateur, ou servez le dossier :

```bash
python3 -m http.server 8000   # puis http://localhost:8000
```

Ajoutez `?debug` à l'URL pour jouer en mode invincible pendant les tests, et `&wave=39` pour commencer directement à une vague donnée (par exemple juste avant le boss final).

## Contenu

- **10 classes** : Iop, Crâ, Féca, Eniripsa, Sram, Xélor, Osamodas, plus Sacrieur, Enutrof et Roublard à débloquer avec des kamas. Chaque classe a **8 sorts** tirés de son kit Dofus 2 (Pression, Bond, Colère de Iop…). Comme dans ZaapRush, un sort monte jusqu'au **rang 10** : au rang 5, la seule carte proposée pour ce sort est son **Éveil**, un choix définitif entre 3 branches (par exemple Salve, Cadence ou Perce-cœur pour un sort de projectiles), puis il continue jusqu'au rang 10. Les branches sont dans `BRANCHES` (`js/data.js`). Le premier est connu d'entrée, les autres arrivent par les cartes de niveau.
- **Cartes de niveau** façon ZaapRush : à chaque niveau, 3 cartes de natures différentes (améliorer un sort, nouveau sort, caractéristique), une carte conseillée, *Relancer* (×2) et *Bannir* (×1) par partie. Raccourcis 1/2/3, R et B.
- **XP directe** : chaque monstre tué donne son expérience tout de suite, sans rien à ramasser.
- **9 caractéristiques** proposées par les cartes : Vitalité, Force, Agilité, Intelligence, Sagesse, Chance, Prospection (+30% de chances d'équipement), PA, Soins.
- **Équipements pour la partie** : les monstres lâchent des objets (coiffe, cape, amulette, anneau, ceinture, bottes, arme), comme la panoplie du Bouftou sur les Bouftous, avec 4 à 5 objets par monde. L'objet s'équipe tout seul s'il vaut mieux que celui porté, sinon il est revendu en kamas. Les panoplies donnent un bonus à 3, 5 et 7 pièces. Le boss final lâche toujours un objet rare de son monde (panoplie du Bouftou Royal à Astrub). Les objets sont définis dans `ITEMS` et `SETS` (`js/data.js`).
- **9 mondes**, les mêmes que ZaapRush et dans le même ordre : Astrub, Île des Wabbits, Forêt des Abraknydes, Litneg, Montagne des Koalaks, Labyrinthe du Minotoror, Sanctuaire des Dragoeufs, Sanctuaire de Qu'Tan, Belvédère d'Ilyzaelle. Chacun a ses monstres, un boss intermédiaire et un boss final (Bouftou Royal, Wa Wabbit, Chêne Mou, Meulou, Skeunk, Minotot, Crocabulia, Qu'Tan, Ilyzaelle). Comme dans ZaapRush, chaque monde se rejoue depuis le niveau 1 et la partie avance par **vagues de 22 s** : boss intermédiaires aux vagues 14 et 27, **boss final à la vague 40**, qui revient ensuite toutes les 15 vagues (+15 % de PV à chaque retour). La partie continue jusqu'à la mort. Le premier kill du boss final ouvre pour de bon le monde suivant.
- **9 Dofus, un par monde comme dans ZaapRush** : Dofawa (Astrub, +12 % PV), Cawotte (Wabbits, +20 % XP), Turquoise (Abraknydes, +50 % dégâts critiques), Émeraude (Litneg, +35 % PV), Kaliptus (Koalaks, +50 % de chances d'équipement), Pourpre (Minotoror, +25 % dégâts), Vulbis (Dragoeufs, 20 % de chances d'avoir 4 cartes et 5 % d'esquive), Ébène (Qu'Tan, +25 % dégâts des sorts hors sort de départ), Ivoire (Ilyzaelle, +20 % taille des sorts). Ce sont des drops légendaires : chaque boss final battu tente le Dofus de son monde avec **1 % de chance + 0,5 % par échec précédent** (compteur par monde, sauvegardé, remis à zéro quand le Dofus tombe). La Prospection ne change pas cette chance.
- **Boutique** d'améliorations permanentes payées en kamas, et Résurrection.
- PC (ZQSD / WASD / flèches, Échap pour la pause) et mobile (joystick tactile).
- Sauvegarde automatique dans le navigateur (`localStorage`).

## Structure

| Fichier | Rôle |
|---|---|
| `index.html` | Écrans, HUD et overlays |
| `css/style.css` | Styles (responsive) |
| `js/data.js` | Données : classes, sorts, monstres, zones, Dofus, boutique |
| `js/game.js` | Moteur : boucle, sorts, monstres, collisions, rendu canvas |
| `js/ui.js` | Menus, sauvegarde, HUD, liaison avec le moteur |

## Sprites

Les 10 classes et les monstres d'Astrub (Bouftou, Tofu, Piou, Larve Bleue, Tofu Royal, Bouftou Royal) utilisent des planches de sprites animées en 8 directions, générées en code par `tools/sprites/`. Chaque classe a une course, une attente et une attaque (coup d'arme, tir à l'arc ou incantation selon la classe) ; chaque monstre a une marche et une attaque, jouée au contact. Les formats de case reprennent ceux de ZaapRush.

| Fichier | Rôle |
|---|---|
| `tools/sprites/rig.js` | Mini moteur de « poupées » 3D : sphères, membres, nuages de laine, projetés en vue isométrique avec ombrage et contours |
| `tools/sprites/models.js` | Les modèles et leurs animations : monstres, et un aventurier générique habillé par classe (`LOOKS` : tenue, coiffe, arme, type d'attaque) |
| `tools/sprites/generate.html` | Aperçu des planches dans le navigateur |
| `tools/sprites/build.js` | Exporte les planches en WebP dans `assets/sprites/` et écrit `js/sprites.js` ; signale les images coupées par le bord de leur case (`node tools/sprites/build.js [nom…]`, nécessite Playwright) |

Un monstre utilise une planche avec `sprite: '<nom>'` dans `js/data.js` (et `<nom>_attack` si elle existe) ; les classes via `SPRITE_CLASSES` dans `js/game.js`. Les planches se chargent à la demande ; sans planche chargée, le dessin vectoriel sert de repli. Aperçus : `docs/sprites-classes.png` et `docs/sprites-monstres.png`.

Pour équilibrer ou ajouter du contenu, modifiez `js/data.js` : un sort se décrit par un `type` (projectile, melee, nova, aura, orbit, strike, summon, trap, glyph, heal, shield, buff, dash), des stats de `base` et 4 améliorations `up`.
