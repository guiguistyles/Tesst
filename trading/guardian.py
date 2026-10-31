"""Bot n°4 - le Gardien : vérifie que tout se passe bien et a le dernier mot.

Il peut toujours autoriser une VENTE (réduire le risque), mais il bloque les ACHATS
quand quelque chose cloche. Il coupe aussi les pertes et élimine les bots ruinés.
"""
import math

from . import config


def kill_switch_on():
    return config.KILL_SWITCH.exists()


def market_status(data, now_ts, live):
    """Pour chaque marché : (ok, raison). ok=False -> aucun achat sur ce marché."""
    status = {}
    for asset in config.ASSETS:
        candles = data.get(asset) or []
        if len(candles) < 200:
            status[asset] = (False, "pas assez de données")
        elif live and now_ts - (candles[-1]["t"] + 3600) > config.MAX_DATA_AGE_H[config.group_of(asset)] * 3600:
            status[asset] = (False, "données trop anciennes")
        else:
            status[asset] = (True, "ok")
    return status


def suspicious_candle(prev_close, close):
    return prev_close <= 0 or abs(close / prev_close - 1) > config.MAX_CANDLE_JUMP


def exit_check(bot, price):
    """Stop-loss / prise de bénéfice imposés par le Gardien."""
    if bot["qty"] <= 0:
        return None
    if price <= bot["entry_price"] * (1 - bot["stop_loss"]):
        return "stop-loss"
    if bot.get("take_profit") and price >= bot["entry_price"] * (1 + bot["take_profit"]):
        return "prise de bénéfice"
    return None


def daily_loss_breached(bot, ts, equity):
    """True si le bot a perdu plus de DAILY_LOSS_LIMIT sur les dernières 24 h."""
    if ts - bot["day_anchor_ts"] >= 86400:
        bot["day_anchor_ts"], bot["day_anchor_equity"] = ts, equity
        return False
    return equity < bot["day_anchor_equity"] * (1 - config.DAILY_LOSS_LIMIT)


def invariants(bot):
    problems = []
    for k in ("cash", "qty", "hp"):
        v = bot[k]
        if not isinstance(v, (int, float)) or math.isnan(v) or math.isinf(v):
            problems.append(f"{k} invalide ({v})")
    if bot["cash"] < -1e-6:
        problems.append("solde négatif")
    if bot["qty"] < -1e-12:
        problems.append("quantité négative (vente à découvert interdite)")
    if bot["cash"] > 1e-6 and bot["qty"] > 1e-12:
        problems.append("à la fois en euros et investi (incohérent)")
    return problems
