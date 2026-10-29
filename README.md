# ZaapSurvie 2.0

Jeu de survie par vagues (façon *Vampire Survivors*) dans l'univers de **Dofus 2**, inspiré de ZaapRush (version Dofus Rétro).
Jeu de fan non officiel, sans lien avec Ankama. Tous les graphismes sont dessinés en code, sans aucun asset Ankama.

## Lancer le jeu

Aucune dépendance ni compilation : ouvrez `index.html` dans un navigateur, ou servez le dossier :

```bash
python3 -m http.server 8000   # puis http://localhost:8000
```

Ajoutez `?debug` à l'URL pour jouer en mode invincible pendant les tests.

## Contenu

- **10 classes** : Iop, Crâ, Féca, Eniripsa, Sram, Xélor, Osamodas, plus Sacrieur, Enutrof et Roublard à débloquer avec des kamas. Chaque classe a 4 sorts propres, améliorables jusqu'au niveau 5.
- **10 caractéristiques** à choisir en montant de niveau : Vitalité, Force, Agilité, Intelligence, Sagesse, Chance, Prospection, PA, Résistance, Soins.
- **5 zaaps / zones** à débloquer l'une après l'autre : Astrub, Amakna, Forêt des Abraknydes, Montagne des Craqueleurs, Frigost. Chacune a ses monstres, deux boss intermédiaires (3:00 et 6:00) et un gardien (8:00).
- **10 Dofus** à récolter sur les gardiens. Chacun donne un bonus permanent.
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

Pour équilibrer ou ajouter du contenu, modifiez `js/data.js` : un sort se décrit par un `type` (projectile, melee, nova, aura, orbit, strike, summon, trap, glyph, heal, shield), des stats de `base` et 4 améliorations `up`.
