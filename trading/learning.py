"""Les bots « apprentis » (🎓) : ils tirent des leçons de leurs propres trades.

Trois mécanismes, réservés aux bots qui ont `learner: True` :

1. Mémoire des situations perdantes. À chaque entrée, le bot note la situation du marché
   (tendance : hausse / baisse / plat ; agitation : calme / agité) et le sens de son pari.
   Quand le pari se ferme, il range le résultat dans cette case. Si une case accumule
   au moins LEARN_MIN_TRADES trades, moins d'un tiers de gagnants et une perte totale,
   le bot n'entre plus dans cette situation pendant LEARN_BLOCK_DAYS jours. Ensuite il
   retente sa chance avec une mémoire à moitié effacée (le marché change).

2. Stop-loss qui s'ajuste. Après un stop-loss, le bot regarde les heures suivantes :
   si le prix repart dans le bon sens et regagne au moins la moitié du terrain perdu,
   le stop était trop serré et il l'élargit. Si au contraire il ferme souvent un pari sur une grosse perte
   (presque la taille du stop) sans que le stop ait servi, il le resserre.

3. Filtre anti-frais. Un aller-retour coûte environ 1 % (frais et écart de prix). Le bot
   n'entre pas si le mouvement qu'il peut espérer sur sa durée habituelle de détention,
   estimé avec l'agitation récente du marché, ne couvre pas ce coût.
"""
import math

from . import config

LEARN_MIN_TRADES = 4      # trades minimum dans une situation avant d'en tirer une leçon
LEARN_MAX_WINRATE = 0.34  # en dessous : la situation est jugée perdante
LEARN_BLOCK_DAYS = 3      # durée pendant laquelle le bot évite une situation perdante
STOP_WATCH_H = 4          # heures d'observation après un stop-loss
STOP_WIDEN = 1.15         # élargissement d'un stop trop serré
STOP_TIGHTEN = 0.92       # resserrement après une grosse perte sans stop
STOP_RANGE = (0.5, 2.0)   # le stop reste entre la moitié et le double de son réglage de naissance
ROUND_TRIP = 2 * (config.FEE + config.SLIPPAGE)
REGIME_WINDOW = 96        # 24 h de bougies de 15 minutes

TREND_LABEL = {"hausse": "en hausse", "baisse": "en baisse", "plat": "plat"}


def _returns(closes):
    return [closes[j] / closes[j - 1] - 1 for j in range(1, len(closes)) if closes[j - 1]]


def _std(xs):
    if len(xs) < 2:
        return 0.0
    m = sum(xs) / len(xs)
    return (sum((x - m) ** 2 for x in xs) / len(xs)) ** 0.5


def regime(closes, risk_scale):
    """Situation du marché : (tendance, agitation), d'après les dernières bougies."""
    recent = closes[-REGIME_WINDOW:]
    avg = sum(recent) / len(recent)
    drift = closes[-1] / avg - 1
    thr = 0.01 * risk_scale
    trend = "hausse" if drift > thr else "baisse" if drift < -thr else "plat"
    vol_now = _std(_returns(recent))
    vol_ref = _std(_returns(closes))
    agit = "agité" if vol_ref and vol_now > 1.15 * vol_ref else "calme"
    return trend, agit


def key(direction, reg):
    trend, agit = reg
    return f"{'↑' if direction > 0 else '↓'} {trend} {agit}"


def describe(k):
    arrow, trend, agit = k.split(" ")
    pari = "à la hausse" if arrow == "↑" else "à la baisse"
    return f"parier {pari} quand le marché est {TREND_LABEL[trend]} et {agit}"


def ensure(bot):
    bot.setdefault("memory", {})
    bot.setdefault("stop_base", bot["stop_loss"])
    bot.setdefault("learn", {"blocked_regime": 0, "blocked_fees": 0, "stop_widened": 0, "stop_tightened": 0})
    bot.setdefault("learn_news", [])


def allowed(bot, k, ts):
    """Le bot accepte-t-il d'entrer dans cette situation ?"""
    m = bot["memory"].get(k)
    if not m:
        return True
    if m.get("blocked_until", 0) > ts:
        return False
    if m.get("blocked_until"):  # fin de la punition : seconde chance, mémoire à moitié effacée
        m["n"], m["w"], m["pnl"], m["blocked_until"] = m["n"] // 2, m["w"] // 2, m["pnl"] / 2, 0
        bot["learn_news"].append(f"🎓 {bot['name']} retente sa chance : {describe(k)}")
    return True


def expected_move(bot, closes):
    """Mouvement de prix qu'on peut espérer pendant la durée de détention habituelle du bot."""
    holds = [(t["out"] - t["in"]) / config.CANDLE for t in bot["trades"][-10:] if t.get("in") and t.get("out")]
    hold = sum(holds) / len(holds) if holds else 16
    hold = min(400, max(4, hold))
    return _std(_returns(closes[-REGIME_WINDOW:])) * math.sqrt(hold)


def fee_ok(bot, closes):
    return expected_move(bot, closes) >= ROUND_TRIP


def on_close(bot, pnl, reason, ts, cost):
    """Range le résultat d'un pari dans la mémoire du bot ; ajuste le stop après une grosse perte."""
    k = bot.pop("entry_regime", None)
    if k:
        m = bot["memory"].setdefault(k, {"n": 0, "w": 0, "pnl": 0.0, "blocked_until": 0})
        m["n"] += 1
        m["w"] += 1 if pnl > 0 else 0
        m["pnl"] = round(m["pnl"] + pnl, 4)
        if (m["n"] >= LEARN_MIN_TRADES and m["w"] / m["n"] < LEARN_MAX_WINRATE and m["pnl"] < 0
                and m.get("blocked_until", 0) <= ts):
            m["blocked_until"] = ts + LEARN_BLOCK_DAYS * 86400
            bot["learn_news"].append(
                f"🎓 {bot['name']} a compris qu'il perd à {describe(k)} ({m['w']} gagnant(s) sur {m['n']}) : "
                f"il évite cette situation pendant {LEARN_BLOCK_DAYS} jours")
    cost = cost or config.CAPITAL
    move_lost = -pnl / cost - ROUND_TRIP  # perte due au prix, frais exclus
    if reason == "signal" and pnl < 0 and move_lost > 0.6 * bot["stop_loss"]:
        _set_stop(bot, bot["stop_loss"] * STOP_TIGHTEN, "stop_tightened")


def _set_stop(bot, value, counter):
    lo, hi = bot["stop_base"] * STOP_RANGE[0], bot["stop_base"] * STOP_RANGE[1]
    new = round(min(hi, max(lo, 0.01, value)), 4)
    if new != bot["stop_loss"]:
        bot["stop_loss"] = new
        bot["learn"][counter] += 1


def watch_stop(bot, entry_price, direction, ts):
    bot["stop_watch"] = {"entry": entry_price, "dir": direction, "stop": bot["stop_loss"],
                         "until": ts + STOP_WATCH_H * 3600}


def check_stop(bot, price, ts):
    """Après un stop-loss : le prix a-t-il regagné la moitié du terrain ? Alors le stop était trop serré."""
    w = bot.get("stop_watch")
    if not w:
        return
    if w["dir"] * (price / w["entry"] - 1) > -w["stop"] / 2:  # le prix a regagné au moins la moitié du stop
        before = bot["stop_loss"]
        _set_stop(bot, before * STOP_WIDEN, "stop_widened")
        if bot["stop_loss"] != before:
            bot["learn_news"].append(
                f"🎓 {bot['name']} a vu le prix repartir juste après son stop-loss : "
                f"il l'élargit de {before * 100:.1f} % à {bot['stop_loss'] * 100:.1f} %")
        bot["stop_watch"] = None
    elif ts > w["until"]:
        bot["stop_watch"] = None


def lessons(bot, ts):
    """Résumé lisible de ce que le bot a appris (pour le tableau de bord)."""
    if not bot.get("learner"):
        return None
    parts = [describe(k) for k, m in bot.get("memory", {}).items() if m.get("blocked_until", 0) > ts]
    out = []
    if parts:
        out.append("évite : " + " ; ".join(parts))
    base = bot.get("stop_base", bot["stop_loss"])
    if abs(bot["stop_loss"] - base) > 1e-9:
        out.append(f"stop-loss {base * 100:.1f} % → {bot['stop_loss'] * 100:.1f} %")
    lr = bot.get("learn", {})
    skipped = lr.get("blocked_regime", 0) + lr.get("blocked_fees", 0)
    if skipped:
        out.append(f"{skipped} entrées évitées ({lr.get('blocked_fees', 0)} à cause des frais)")
    return " · ".join(out) if out else "observe encore"
