# Arène des bots de trading (simulation)

64 bots répartis en **4 équipes** reçoivent chacun **50 € virtuels** et tradent sur les **vrais prix du marché**,
sans jamais toucher de vrai argent. Dans chaque équipe, 14 stratégies différentes et 2 témoins.
Ceux qui perdent meurent, ceux qui gagnent se clonent. Au bout de 30 jours, on regarde qui a gagné.

## Les équipes

| Équipe | Marchés | Source des prix |
|---|---|---|
| Cryptos principales | Bitcoin, Ethereum, Solana | Kraken (en euros) |
| Altcoins | XRP, Cardano, Dogecoin, Polkadot, Chainlink, Avalanche | Kraken (en euros) |
| Actions | S&P 500 (SPY), Nasdaq 100 (QQQ), Apple, Nvidia, Microsoft, Tesla | Yahoo Finance (en dollars) |
| Matières premières | Pétrole WTI, pétrole Brent, or, argent | Yahoo Finance (en dollars) |

- Le stop-loss et les seuils s'adaptent à l'équipe : plus larges pour les altcoins, qui bougent beaucoup, plus serrés pour les actions.
- Un clone ou un remplaçant reste **dans l'équipe** de son parent, et peut changer de marché à l'intérieur de l'équipe.
- Une équipe compte au plus 18 bots.
- Pour les marchés en dollars, on raisonne en pourcentage et on ignore le taux de change.
- Les actions et matières premières ne cotent qu'aux heures de bourse : leurs bots ne bougent ni la nuit ni le week-end.

## L'équipe

| Bot | Fichier | Rôle |
|---|---|---|
| 📈 L'Analyste | `market.py` | Récupère les prix toutes les heures (Kraken et Yahoo Finance, Coinbase en secours) et résume la tendance |
| 📰 La Veille | `news.py` | Lit l'actualité (CoinDesk, Cointelegraph, Decrypt, CNBC, OilPrice) et note l'humeur de chaque marché de -1 à +1 |
| 💱 Les Traders | `strategies.py` + `engine.py` | 64 bots en 4 équipes qui achètent et vendent en argent virtuel |
| 🛡 Le Gardien | `guardian.py` | Stop-loss, pause en cas de grosse perte, blocage si les données sont douteuses, arrêt d'urgence |

## Les règles de vie

- Chaque bot démarre avec **100 PV** et **50 €**.
- Vente avec profit : **+10 PV par euro gagné**. Vente à perte : **-20 PV par euro perdu**.
- Stop-loss déclenché : **-5 PV** de plus et 6 h de pause.
- Perte de plus de 10 % en 24 h : le Gardien vend tout, **-10 PV**, et pause de 24 h.
- **0 PV**, le bot meurt, sauf s'il est en bénéfice. **Moins de 35 €**, il est éliminé (ruiné).
- **200 PV**, il se clone : l'enfant reprend ses réglages, légèrement modifiés.
- Chaque mort est remplacée dans son équipe : 70 % du temps par un descendant d'un des 5 meilleurs de l'équipe
  (ayant au moins un trade terminé), 30 % du temps par une stratégie neuve.
- Les **témoins** (« Acheter et garder » et « Pile ou face ») sont immortels. Ils servent de référence :
  un bot qui ne bat pas le hasard n'a aucun talent.

Le réalisme est intégré : 0,4 % de frais et 0,1 % d'écart de prix sur chaque ordre, pas de levier, pas de vente à découvert.

## Où voir les résultats

- `dashboard/RESULTATS.md` : le classement en direct, lisible directement sur GitHub.
- `dashboard/backtest/RESULTATS.md` : le rejeu des 5 derniers jours (Kraken ne donne que 720 bougies de 15 minutes).
- `dashboard/index.html` : le tableau de bord complet, avec graphiques, cimetière et actus. À télécharger et ouvrir dans un navigateur.

## Comment ça tourne

GitHub Actions lance un passage **toutes les 15 minutes** (`.github/workflows/trading-bots.yml`).
Les bots décident sur des **bougies de 15 minutes**. Chaque passage traite toutes les bougies manquées et enregistre l'état dans `state/arena.json`.

> ⚠️ GitHub n'exécute les tâches programmées que sur la **branche principale** (`main`).
> Une fois ce code fusionné dans `main`, l'arène tourne seule. Avant ça, elle ne fait qu'un passage à chaque push.

Commandes manuelles (onglet **Actions**, puis **Arène des bots**, puis **Run workflow**) :
- `tick` : un passage normal
- `backtest` : rejouer les 5 derniers jours
- `reset` : tout recommencer à zéro

**Arrêt d'urgence** : créer un fichier `state/STOP`. Le Gardien vend tout et bloque les achats.

En local (Python 3.10+, aucune dépendance) :

```bash
python -m trading.main backtest              # rejeu du passé
python -m trading.main tick                  # un passage en direct
python -m trading.main backtest --synthetic  # test avec des prix inventés, sans internet
```

## À savoir avant de mettre du vrai argent

- Un bon résultat sur 30 jours peut être de la **chance**. Il faut comparer aux témoins et regarder la « pire chute ».
- Les bots « actus » ne peuvent pas être testés sur le passé (il n'y a pas d'historique des actus). Ils ne se jugent qu'en direct.
- Passer en réel demanderait un compte sur une plateforme autorisée en France et une clé d'API. C'est volontairement **non branché**.
