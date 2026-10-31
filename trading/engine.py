"""Bot n°3 - le Trader (exécution des ordres virtuels) + le cycle de vie des bots."""
import random
from bisect import bisect_right

from . import config, guardian
from .strategies import CONTROLS, STRATEGIES, initial_population, min_history, mutate


# ---------------------------------------------------------------- création

STATE_VERSION = 3  # 3 : bougies de 15 minutes


def team_assets():
    return {g: config.assets_of(g) for g in config.GROUPS}


def init_state(ts, seed=42):
    state = {"version": STATE_VERSION, "created_ts": ts, "last_tick_ts": ts, "seed": seed, "next_id": 0,
             "bots": [], "events": [], "market": {}, "news": {}, "guardian": {}}
    for group, strat, asset, params, sl, tp in initial_population(team_assets()):
        new_bot(state, strat, asset, dict(params), sl, tp, ts)
    log_event(state, ts, "start", None,
              f"{len(state['bots'])} bots créés en {len(config.GROUPS)} équipes, avec {config.CAPITAL:.0f} € virtuels chacun")
    return state


def new_bot(state, strategy, asset, params, stop_loss, take_profit, ts, parent=None, generation=0):
    state["next_id"] += 1
    bid = state["next_id"]
    bot = {
        "id": bid, "name": f"#{bid:02d} {STRATEGIES[strategy][1]} ({asset})",
        "group": config.group_of(asset), "strategy": strategy, "asset": asset, "params": params,
        "stop_loss": stop_loss, "take_profit": take_profit,
        "control": strategy in CONTROLS, "parent": parent, "generation": generation,
        "alive": True, "born_ts": ts, "died_ts": None, "death_cause": None,
        "hp": config.HP_START, "cash": config.CAPITAL, "qty": 0.0,
        "entry_price": 0.0, "entry_cost": 0.0, "entry_ts": None,
        "last_ts": ts, "paused_until": 0, "children": 0,
        "day_anchor_ts": ts, "day_anchor_equity": config.CAPITAL,
        "peak_equity": config.CAPITAL, "max_drawdown": 0.0, "equity": config.CAPITAL,
        "stats": {"trades": 0, "wins": 0, "losses": 0, "realized": 0.0, "fees": 0.0,
                  "best": 0.0, "worst": 0.0, "stops": 0},
        "trades": [], "equity_hist": [[ts, config.CAPITAL]],
    }
    state["bots"].append(bot)
    return bot


def log_event(state, ts, kind, bot, msg):
    state["events"].append({"ts": ts, "type": kind, "bot": bot["id"] if bot else None, "msg": msg})
    del state["events"][:-config.MAX_EVENTS]


# ---------------------------------------------------------------- ordres virtuels

def equity(bot, price):
    return bot["cash"] + bot["qty"] * price


def buy(bot, price, ts):
    fill = price * (1 + config.SLIPPAGE)
    fee = bot["cash"] * config.FEE
    bot["qty"] = (bot["cash"] - fee) / fill
    bot["entry_cost"], bot["entry_price"], bot["entry_ts"] = bot["cash"], price, ts
    bot["cash"] = 0.0
    bot["stats"]["fees"] += fee


def sell(bot, price, ts, reason):
    fill = price * (1 - config.SLIPPAGE)
    gross = bot["qty"] * fill
    fee = gross * config.FEE
    proceeds = gross - fee
    pnl = proceeds - bot["entry_cost"]
    st = bot["stats"]
    st["trades"] += 1
    st["fees"] += fee
    st["realized"] += pnl
    st["wins" if pnl > 0 else "losses"] += 1
    st["best"], st["worst"] = max(st["best"], pnl), min(st["worst"], pnl)
    bot["trades"].append({"in": bot["entry_ts"], "out": ts, "buy": round(bot["entry_price"], 6),
                          "sell": round(price, 6), "cost": round(bot["entry_cost"], 4),
                          "pnl": round(pnl, 4), "why": reason})
    del bot["trades"][:-config.MAX_TRADES_KEPT]
    bot["cash"], bot["qty"], bot["entry_cost"], bot["entry_price"], bot["entry_ts"] = proceeds, 0.0, 0.0, 0.0, None
    return pnl


def apply_hp(bot, pnl):
    if bot["control"]:
        return
    bot["hp"] += pnl * (config.HP_PER_EURO_GAIN if pnl > 0 else config.HP_PER_EURO_LOSS)
    bot["hp"] = round(bot["hp"], 2)


# ---------------------------------------------------------------- simulation

def _series(data):
    out = {}
    for asset, candles in data.items():
        out[asset] = {"t": [c["t"] for c in candles], "c": [c["c"] for c in candles],
                      "h": [c["h"] for c in candles], "l": [c["l"] for c in candles]}
    return out


def advance(state, data, ts_limit, sentiment, status, log=print, series=None):
    """Fait vivre chaque bot bougie par bougie jusqu'à ts_limit."""
    series = series or _series(data)
    stop = guardian.kill_switch_on()
    for bot in state["bots"]:
        if not bot["alive"]:
            continue
        s = series.get(bot["asset"])
        if not s or not s["t"]:
            continue  # marché indisponible : on rattrapera au prochain passage
        fn = STRATEGIES[bot["strategy"]][0]
        need = min_history(bot["params"])
        start, end = bisect_right(s["t"], bot["last_ts"]), bisect_right(s["t"], ts_limit)
        can_buy_market = status.get(bot["asset"], (False, ""))[0] and not stop
        for i in range(start, end):
            ts, price = s["t"][i], s["c"][i]
            if stop and bot["qty"] > 0:
                apply_hp(bot, sell(bot, price, ts, "arrêt d'urgence"))
            reason = guardian.exit_check(bot, price)
            if reason:
                pnl = sell(bot, price, ts, reason)
                apply_hp(bot, pnl)
                if reason == "stop-loss":
                    bot["stats"]["stops"] += 1
                    bot["paused_until"] = ts + 6 * 3600  # 6 h de calme après un stop-loss
                    if not bot["control"]:
                        bot["hp"] -= config.HP_STOPLOSS_PENALTY
            elif ts >= bot["paused_until"] and i + 1 >= need:
                lo = max(0, i + 1 - config.WINDOW)
                ctx = {"in_position": bot["qty"] > 0, "entry_price": bot["entry_price"],
                       "sentiment": sentiment.get(bot["asset"], 0.0),
                       "rng": random.Random(f"{state['seed']}-{bot['id']}-{ts}")}
                want = fn(s["c"][lo:i + 1], s["h"][lo:i + 1], s["l"][lo:i + 1], bot["params"], ctx)
                if want is True and bot["qty"] == 0:
                    if can_buy_market and not guardian.suspicious_candle(s["c"][i - 1], price):
                        buy(bot, price, ts)
                elif want is False and bot["qty"] > 0:
                    apply_hp(bot, sell(bot, price, ts, "signal"))
            eq = equity(bot, price)
            bot["equity"] = eq
            bot["peak_equity"] = max(bot["peak_equity"], eq)
            bot["max_drawdown"] = max(bot["max_drawdown"], 1 - eq / bot["peak_equity"])
            if not bot["control"] and guardian.daily_loss_breached(bot, ts, eq):
                if bot["qty"] > 0:
                    apply_hp(bot, sell(bot, price, ts, "pause du Gardien"))
                bot["hp"] -= config.HP_PAUSE_PENALTY
                bot["paused_until"] = ts + 86400
                bot["day_anchor_ts"], bot["day_anchor_equity"] = ts, equity(bot, price)
                log_event(state, ts, "pause", bot, f"{bot['name']} : -10 % en 24 h, mis en pause 24 h par le Gardien")
            problems = guardian.invariants(bot)
            if problems:
                log_event(state, ts, "alerte", bot, f"Gardien : {bot['name']} incohérent ({', '.join(problems)}), éliminé")
                kill(state, bot, ts, price, "anomalie détectée par le Gardien")
                break
            if not bot["control"] and eq <= config.RUIN_EQUITY:
                kill(state, bot, ts, price, f"ruiné (moins de {config.RUIN_EQUITY:.0f} €)")
                break
            bot["last_ts"] = ts
        if bot["alive"] and bot["equity_hist"][-1][0] != bot["last_ts"]:
            point = [bot["last_ts"], round(bot["equity"], 2)]
            hist = bot["equity_hist"]
            # un point par heure au plus : le dernier point de l'heure en cours est remplacé
            if len(hist) > 1 and hist[-1][0] // 3600 == point[0] // 3600:
                hist[-1] = point
            else:
                hist.append(point)
            del bot["equity_hist"][:-config.MAX_EQUITY_POINTS]


def kill(state, bot, ts, price, cause):
    if bot["qty"] > 0:
        sell(bot, price, ts, "liquidation")
    bot["equity"] = bot["cash"]
    bot["alive"], bot["died_ts"], bot["death_cause"], bot["last_ts"] = False, ts, cause, ts
    bot["equity_hist"].append([ts, round(bot["equity"], 2)])
    log_event(state, ts, "mort", bot, f"☠ {bot['name']} est mort : {cause} (finit à {bot['equity']:.2f} €)")


def _last_price(series, asset, ts):
    s = series.get(asset)
    if not s or not s["t"]:
        return None
    i = bisect_right(s["t"], ts) - 1
    return s["c"][i] if i >= 0 else None


def _spawn_from(state, parent, ts, rng):
    params, sl, tp, asset = mutate(parent["params"], parent["stop_loss"], parent["take_profit"],
                                   parent["asset"], rng, config.assets_of(parent["group"]))
    child = new_bot(state, parent["strategy"], asset, params, sl, tp, ts,
                    parent=parent["id"], generation=parent["generation"] + 1)
    parent["children"] += 1
    return child


def lifecycle(state, data, ts, log=print, series=None):
    """Morts, clones et remplaçants."""
    series = series or _series(data)
    rng = random.Random(f"{state['seed']}-life-{ts}")
    for bot in state["bots"]:
        if bot["alive"] and not bot["control"] and bot["hp"] <= 0:
            price = _last_price(series, bot["asset"], ts)
            if price is None:
                continue
            if equity(bot, price) >= config.CAPITAL:
                bot["hp"] = max(bot["hp"], 1)  # un bot en bénéfice ne peut pas mourir
                continue
            kill(state, bot, ts, price, "points de vie à zéro")

    def alive(group):
        return [b for b in state["bots"] if b["alive"] and b["group"] == group]

    for bot in sorted([b for b in state["bots"] if b["alive"]], key=lambda b: -b["hp"]):
        if (not bot["control"] and bot["hp"] >= config.HP_CLONE
                and len(alive(bot["group"])) < config.MAX_PER_GROUP):
            bot["hp"] = config.HP_AFTER_CLONE
            child = _spawn_from(state, bot, ts, rng)
            log_event(state, ts, "clone", bot, f"🧬 {bot['name']} a atteint {config.HP_CLONE} PV et se clone : {child['name']}")

    templates = initial_population(team_assets())
    for dead in [b for b in state["bots"] if not b["alive"] and not b.get("replaced")]:
        dead["replaced"] = True
        group = dead["group"]
        if len(alive(group)) >= config.MAX_PER_GROUP:
            continue
        # Le remplaçant reste dans l'équipe du mort.
        # 70 % : descendant d'un des 5 meilleurs de l'équipe ; 30 % : stratégie neuve (exploration)
        # Seuls les bots qui ont fait leurs preuves (au moins un trade terminé) ont des descendants.
        top = sorted([b for b in alive(group) if not b["control"] and b["stats"]["trades"] > 0],
                     key=lambda b: (b["equity"], b["hp"]), reverse=True)[:5]
        if top and rng.random() < 0.7:
            parent = rng.choice(top)
            child = _spawn_from(state, parent, ts, rng)
            log_event(state, ts, "naissance", child,
                      f"🐣 {child['name']} remplace {dead['name']} (descendant de {parent['name']}, un des meilleurs de l'équipe)")
        else:
            _, strat, asset, params, sl, tp = rng.choice(
                [t for t in templates if t[0] == group and t[1] not in CONTROLS])
            child = new_bot(state, strat, asset, dict(params), sl, tp, ts)
            log_event(state, ts, "naissance", child, f"🐣 {child['name']} remplace {dead['name']}")


def run_until(state, data, ts_limit, sentiment, status, log=print, series=None):
    series = series or _series(data)
    advance(state, data, ts_limit, sentiment, status, log, series)
    lifecycle(state, data, ts_limit, log, series)
    state["last_tick_ts"] = ts_limit
