"""Réglages globaux de l'arène de bots (simulation, argent virtuel)."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STATE_PATH = ROOT / "state" / "arena.json"
KILL_SWITCH = ROOT / "state" / "STOP"          # créer ce fichier = arrêt d'urgence
DASHBOARD_DIR = ROOT / "dashboard"

# Marchés suivis : symbole -> paire Kraken (en euros)
ASSETS = {"BTC": "XBTEUR", "ETH": "ETHEUR", "SOL": "SOLEUR"}
COINBASE_PAIRS = {"BTC": "BTC-EUR", "ETH": "ETH-EUR", "SOL": "SOL-EUR"}

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
MAX_DATA_AGE_H = 3        # données de plus de 3 h = trop vieilles, pas d'achat
MAX_POPULATION = 40

MAX_EVENTS = 300
MAX_TRADES_KEPT = 40
MAX_EQUITY_POINTS = 400
