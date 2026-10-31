"""Réglages globaux de l'arène de bots (simulation, argent virtuel)."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STATE_PATH = ROOT / "state" / "arena.json"
KILL_SWITCH = ROOT / "state" / "STOP"          # créer ce fichier = arrêt d'urgence
DASHBOARD_DIR = ROOT / "dashboard"

# Les équipes : chaque groupe de bots est spécialisé sur un type de marché.
GROUPS = {
    "crypto": "Cryptos principales",
    "altcoins": "Altcoins",
    "actions": "Actions",
    "matieres": "Matières premières",
}

# Marchés suivis : symbole -> (équipe, source, code chez la source, nom lisible, devise)
# Les prix des actions et matières premières sont en dollars : les bots raisonnent en %,
# on ignore donc le taux de change (simplification).
MARKETS = {
    "BTC": ("crypto", "kraken", "XBTEUR", "Bitcoin", "EUR"),
    "ETH": ("crypto", "kraken", "ETHEUR", "Ethereum", "EUR"),
    "SOL": ("crypto", "kraken", "SOLEUR", "Solana", "EUR"),
    "XRP": ("altcoins", "kraken", "XRPEUR", "XRP", "EUR"),
    "ADA": ("altcoins", "kraken", "ADAEUR", "Cardano", "EUR"),
    "DOGE": ("altcoins", "kraken", "XDGEUR", "Dogecoin", "EUR"),
    "DOT": ("altcoins", "kraken", "DOTEUR", "Polkadot", "EUR"),
    "LINK": ("altcoins", "kraken", "LINKEUR", "Chainlink", "EUR"),
    "AVAX": ("altcoins", "kraken", "AVAXEUR", "Avalanche", "EUR"),
    "SPY": ("actions", "yahoo", "SPY", "S&P 500 (ETF SPY)", "USD"),
    "QQQ": ("actions", "yahoo", "QQQ", "Nasdaq 100 (ETF QQQ)", "USD"),
    "AAPL": ("actions", "yahoo", "AAPL", "Apple", "USD"),
    "NVDA": ("actions", "yahoo", "NVDA", "Nvidia", "USD"),
    "MSFT": ("actions", "yahoo", "MSFT", "Microsoft", "USD"),
    "TSLA": ("actions", "yahoo", "TSLA", "Tesla", "USD"),
    "WTI": ("matieres", "yahoo", "CL=F", "Pétrole WTI", "USD"),
    "BRENT": ("matieres", "yahoo", "BZ=F", "Pétrole Brent", "USD"),
    "OR": ("matieres", "yahoo", "GC=F", "Or", "USD"),
    "ARGENT": ("matieres", "yahoo", "SI=F", "Argent", "USD"),
}
ASSETS = list(MARKETS)
COINBASE_PAIRS = {"BTC": "BTC-EUR", "ETH": "ETH-EUR", "SOL": "SOL-EUR"}


def group_of(asset):
    return MARKETS[asset][0]


def assets_of(group):
    return [a for a, m in MARKETS.items() if m[0] == group]


CAPITAL = 50.0          # argent virtuel de départ de chaque bot (€)
FEE = 0.004             # frais par ordre (0,4 %, proche d'une plateforme réelle)
SLIPPAGE = 0.001        # écart de prix à l'exécution (0,1 %)
WINDOW = 300            # nb de bougies (1 h) d'historique données aux stratégies

# --- Points de vie ---
HP_START = 100
HP_CLONE = 200            # au-dessus : le bot se clone
HP_AFTER_CLONE = 120      # PV restants au parent après clonage
HP_PER_EURO_GAIN = 10     # +10 PV par euro gagné sur une vente
HP_PER_EURO_LOSS = 20     # -20 PV par euro perdu (les pertes coûtent double)
HP_STOPLOSS_PENALTY = 5   # pénalité en plus quand le Gardien coupe une position
HP_PAUSE_PENALTY = 10     # pénalité quand le Gardien met le bot en pause

# --- Gardien ---
RUIN_EQUITY = 35.0        # sous 35 € (-30 %), le bot est éliminé
DAILY_LOSS_LIMIT = 0.10   # -10 % en 24 h -> vente forcée + pause 24 h
MAX_CANDLE_JUMP = 0.25    # bougie à ±25 % en 1 h = donnée suspecte, pas d'achat
MAX_DATA_AGE_H = {"crypto": 3, "altcoins": 3, "actions": 96, "matieres": 96}  # bourses fermées le week-end
MAX_PER_GROUP = 18        # population maximum d'une équipe (clones compris)

MAX_EVENTS = 300
MAX_TRADES_KEPT = 40
MAX_EQUITY_POINTS = 400
