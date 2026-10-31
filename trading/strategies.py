"""Les stratégies des bots traders.

Chaque stratégie regarde l'historique des prix et répond :
  True  -> « je veux être acheté »
  False -> « je veux tout vendre »
  None  -> « je ne change rien »
Pas de levier, pas de vente à découvert : un bot est soit 100 % en euros, soit 100 % investi.
"""
import random

# ---------------------------------------------------------------- indicateurs

def sma(xs, n):
    return sum(xs[-n:]) / n


def ema(xs, n):
    k = 2 / (n + 1)
    e = xs[max(0, len(xs) - 4 * n)]
    for x in xs[max(0, len(xs) - 4 * n) + 1:]:
        e = x * k + e * (1 - k)
    return e


def ema_series(xs, n):
    k = 2 / (n + 1)
    out, e = [], xs[0]
    for x in xs:
        e = x * k + e * (1 - k)
        out.append(e)
    return out


def rsi(xs, n):
    gains = losses = 0.0
    for i in range(len(xs) - n, len(xs)):
        d = xs[i] - xs[i - 1]
        if d > 0:
            gains += d
        else:
            losses -= d
    if losses == 0:
        return 100.0
    return 100 - 100 / (1 + gains / losses)


def stdev(xs, n):
    m = sma(xs, n)
    return (sum((x - m) ** 2 for x in xs[-n:]) / n) ** 0.5


def atr(highs, lows, closes, n):
    trs = [max(highs[i] - lows[i], abs(highs[i] - closes[i - 1]), abs(lows[i] - closes[i - 1]))
           for i in range(len(closes) - n, len(closes))]
    return sum(trs) / n


# ---------------------------------------------------------------- stratégies

def s_hold(c, h, l, p, ctx):
    return True


def s_random(c, h, l, p, ctx):
    if ctx["rng"].random() < p["switch"]:
        return not ctx["in_position"]
    return None


def s_sma_cross(c, h, l, p, ctx):
    return sma(c, p["fast"]) > sma(c, p["slow"])


def s_ema_cross(c, h, l, p, ctx):
    return ema(c, p["fast"]) > ema(c, p["slow"])


def s_rsi_reversion(c, h, l, p, ctx):
    r = rsi(c, p["period"])
    if r < p["low"]:
        return True
    if r > p["high"]:
        return False
    return None


def s_bb_reversion(c, h, l, p, ctx):
    m, sd = sma(c, p["period"]), stdev(c, p["period"])
    if c[-1] < m - p["k"] * sd:
        return True
    if c[-1] > m:
        return False
    return None


def s_bb_breakout(c, h, l, p, ctx):
    m, sd = sma(c, p["period"]), stdev(c, p["period"])
    if c[-1] > m + p["k"] * sd:
        return True
    if c[-1] < m:
        return False
    return None


def s_donchian(c, h, l, p, ctx):
    if c[-1] > max(h[-p["entry"] - 1:-1]):
        return True
    if c[-1] < min(l[-p["exit"] - 1:-1]):
        return False
    return None


def s_macd(c, h, l, p, ctx):
    xs = c[-4 * p["slow"]:]
    line = [a - b for a, b in zip(ema_series(xs, p["fast"]), ema_series(xs, p["slow"]))]
    return line[-1] > ema_series(line, p["signal"])[-1]


def s_momentum(c, h, l, p, ctx):
    r = c[-1] / c[-1 - p["lookback"]] - 1
    if r > p["thr"]:
        return True
    if r < -p["thr"]:
        return False
    return None


def s_dip_buyer(c, h, l, p, ctx):
    if not ctx["in_position"] and c[-1] <= max(c[-p["lookback"]:]) * (1 - p["drop"]):
        return True
    if ctx["in_position"] and c[-1] >= ctx["entry_price"] * (1 + p["gain"]):
        return False
    return None


def s_trend_rsi(c, h, l, p, ctx):
    up = c[-1] > sma(c, p["trend"])
    r = rsi(c, p["period"])
    if up and r < p["low"]:
        return True
    if r > p["high"] or not up:
        return False
    return None


def s_zscore(c, h, l, p, ctx):
    sd = stdev(c, p["period"])
    if sd == 0:
        return None
    z = (c[-1] - sma(c, p["period"])) / sd
    if z < -p["z"]:
        return True
    if z > 0:
        return False
    return None


def s_vol_breakout(c, h, l, p, ctx):
    if c[-1] - c[-2] > p["k"] * atr(h, l, c, p["period"]):
        return True
    if c[-1] < sma(c, p["period"]):
        return False
    return None


def s_news(c, h, l, p, ctx):
    s = ctx["sentiment"]
    if s > p["thr"]:
        return True
    if s < -p["thr"]:
        return False
    return None


def s_news_trend(c, h, l, p, ctx):
    s, up = ctx["sentiment"], c[-1] > sma(c, p["trend"])
    if s > p["thr"] and up:
        return True
    if s < -p["thr"] or not up:
        return False
    return None


STRATEGIES = {
    # clé: (fonction, nom lisible, explication)
    "hold": (s_hold, "Acheter et garder", "Achète au début et ne bouge plus. C'est le témoin à battre."),
    "random": (s_random, "Pile ou face", "Achète/vend au hasard. Témoin : si un bot ne fait pas mieux, il n'a pas de talent."),
    "sma_cross": (s_sma_cross, "Croisement de moyennes", "Achète quand la moyenne courte passe au-dessus de la longue."),
    "ema_cross": (s_ema_cross, "Croisement EMA", "Comme le croisement de moyennes, mais plus réactif."),
    "rsi_reversion": (s_rsi_reversion, "Chasseur RSI", "Achète quand le marché est « survendu », revend quand il est « suracheté »."),
    "bb_reversion": (s_bb_reversion, "Retour Bollinger", "Achète quand le prix sort par le bas de sa zone normale."),
    "bb_breakout": (s_bb_breakout, "Cassure Bollinger", "Achète quand le prix explose par le haut de sa zone normale."),
    "donchian": (s_donchian, "Cassure de plus haut", "Achète au-dessus du plus haut récent, vend sous le plus bas récent."),
    "macd": (s_macd, "MACD", "Suit l'accélération de la tendance."),
    "momentum": (s_momentum, "Élan", "Achète ce qui monte fort, vend ce qui baisse fort."),
    "dip_buyer": (s_dip_buyer, "Acheteur de creux", "Achète après une chute et revend après un rebond."),
    "trend_rsi": (s_trend_rsi, "Tendance + RSI", "Achète les petites baisses, seulement quand la tendance de fond monte."),
    "zscore": (s_zscore, "Écart statistique", "Achète quand le prix est anormalement bas par rapport à sa moyenne."),
    "vol_breakout": (s_vol_breakout, "Explosion de volatilité", "Achète une bougie anormalement grande vers le haut."),
    "news": (s_news, "Lecteur d'actus", "Achète quand les nouvelles sont positives, vend quand elles sont négatives."),
    "news_trend": (s_news_trend, "Actus + tendance", "Actus positives ET tendance haussière pour acheter."),
}

CONTROLS = {"hold", "random"}  # les témoins sont immortels et ne se clonent pas

# Contraintes des paramètres : (min, max, entier ?)
BOUNDS = {
    "fast": (3, 100, True), "slow": (10, 250, True), "signal": (3, 30, True),
    "period": (5, 100, True), "low": (5, 45, False), "high": (55, 95, False),
    "k": (0.5, 4.0, False), "entry": (5, 200, True), "exit": (3, 150, True),
    "lookback": (2, 200, True), "thr": (0.001, 0.8, False), "drop": (0.01, 0.3, False),
    "gain": (0.005, 0.3, False), "trend": (20, 250, True), "z": (0.5, 4.0, False),
    "switch": (0.005, 0.3, False),
}

# ---------------------------------------------------------------- population de départ

# Les 14 stratégies « joueuses » : (stratégie, réglages, stop-loss de base, prise de bénéfice)
TEMPLATES = [
    ("sma_cross", {"fast": 10, "slow": 50}, 0.05, None),
    ("ema_cross", {"fast": 12, "slow": 26}, 0.04, None),
    ("rsi_reversion", {"period": 14, "low": 30, "high": 70}, 0.05, None),
    ("bb_reversion", {"period": 20, "k": 2.0}, 0.05, None),
    ("bb_breakout", {"period": 20, "k": 2.0}, 0.04, 0.08),
    ("donchian", {"entry": 48, "exit": 24}, 0.06, None),
    ("macd", {"fast": 12, "slow": 26, "signal": 9}, 0.05, None),
    ("momentum", {"lookback": 24, "thr": 0.02}, 0.04, None),
    ("dip_buyer", {"lookback": 48, "drop": 0.04, "gain": 0.03}, 0.06, None),
    ("trend_rsi", {"trend": 200, "period": 14, "low": 35, "high": 70}, 0.04, None),
    ("zscore", {"period": 48, "z": 2.0}, 0.06, None),
    ("vol_breakout", {"period": 24, "k": 2.0}, 0.05, 0.08),
    ("news", {"thr": 0.15}, 0.05, None),
    ("news_trend", {"thr": 0.10, "trend": 100}, 0.05, None),
]

# Les marchés ne bougent pas autant : le stop-loss et les seuils s'adaptent à chaque équipe.
RISK_SCALE = {"crypto": 1.0, "altcoins": 1.5, "actions": 0.6, "matieres": 0.7}


def initial_population(groups):
    """groups : {équipe: [marchés]}. Renvoie [(équipe, stratégie, marché, réglages, stop, tp)]."""
    out = []
    for group, assets in groups.items():
        k = RISK_SCALE[group]
        out.append((group, "hold", assets[0], {}, 1.0, None))
        out.append((group, "random", assets[min(1, len(assets) - 1)], {"switch": 0.04}, 1.0, None))
        for i, (strat, params, sl, tp) in enumerate(TEMPLATES):
            p = dict(params)
            for key in ("thr", "drop", "gain"):
                if key in p and strat not in ("news", "news_trend"):
                    p[key] = round(p[key] * k, 4)
            out.append((group, strat, assets[i % len(assets)], p,
                        round(sl * k, 4), None if tp is None else round(tp * k, 4)))
    return out


def mutate(params, stop_loss, take_profit, asset, rng, assets):
    """Copie légèrement modifiée des réglages d'un bot (pour clones et remplaçants)."""
    newp = {}
    for k, v in params.items():
        lo, hi, is_int = BOUNDS.get(k, (v * 0.5, v * 2, isinstance(v, int)))
        nv = v * rng.uniform(0.75, 1.25)
        nv = min(hi, max(lo, nv))
        newp[k] = int(round(nv)) if is_int else round(nv, 4)
    if "fast" in newp and "slow" in newp and newp["fast"] >= newp["slow"]:
        newp["fast"] = max(BOUNDS["fast"][0], newp["slow"] // 2)
    if "low" in newp and "high" in newp and newp["low"] >= newp["high"]:
        newp["low"], newp["high"] = 30, 70
    sl = round(min(0.2, max(0.02, stop_loss * rng.uniform(0.8, 1.25))), 4)
    tp = None if take_profit is None else round(min(0.4, max(0.02, take_profit * rng.uniform(0.8, 1.25))), 4)
    if rng.random() < 0.2:
        asset = rng.choice(list(assets))
    return newp, sl, tp, asset


def min_history(params):
    """Nombre de bougies nécessaires avant que la stratégie puisse décider."""
    return max([30] + [v + 2 for v in params.values() if isinstance(v, int)])
