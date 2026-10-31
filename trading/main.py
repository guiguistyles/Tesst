"""Point d'entrée.

  python -m trading.main tick        # un passage : prix + actus + décisions des bots (à lancer toutes les 2 h)
  python -m trading.main backtest    # rejoue les 30 derniers jours pour avoir un premier classement
  python -m trading.main reset       # repart de zéro
Ajouter --synthetic pour tester avec des prix inventés (sans internet).
"""
import argparse
import json
import time

from . import config, dashboard, engine, guardian, market, news


def load_state():
    if config.STATE_PATH.exists():
        return json.loads(config.STATE_PATH.read_text(encoding="utf-8"))
    return None


def save_state(state):
    config.STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = config.STATE_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    tmp.replace(config.STATE_PATH)


def _latest_ts(data):
    ts = [c[-1]["t"] for c in data.values() if c]
    return min(ts) if ts else None  # on avance au rythme du marché le moins à jour


def tick(synthetic=False):
    now = int(time.time())
    data = market.load_all(synthetic)
    ts = _latest_ts(data)
    if ts is None:
        print("[Gardien] Aucune donnée de marché : on ne fait rien ce passage.")
        return 1
    state = load_state()
    if state is None:
        state = engine.init_state(ts)
        print(f"Arène créée : {len(state['bots'])} bots. La simulation commence maintenant.")
    if ts <= state["last_tick_ts"]:
        print("Pas de nouvelle bougie depuis le dernier passage.")
    sentiment = news.neutral() if synthetic else news.gather()
    status = guardian.market_status(data, now, live=not synthetic)
    msgs = [f"{a} : achats bloqués ({r})" for a, (ok, r) in status.items() if not ok]
    if guardian.kill_switch_on():
        msgs.insert(0, "ARRÊT D'URGENCE actif (fichier state/STOP) : toutes les positions sont vendues, aucun achat.")
    if not sentiment["ok"] and not synthetic:
        msgs.append("Actualités indisponibles : les bots « actus » restent neutres.")

    engine.run_until(state, data, ts, sentiment["scores"], status)
    state["market"] = {a: market.analyze(c) for a, c in data.items()}
    state["news"] = sentiment
    state["guardian"] = {"messages": msgs, "ts": now}
    save_state(state)
    dashboard.write(state, config.DASHBOARD_DIR, "Arène des bots", "Simulation en direct, argent virtuel")
    alive = [b for b in state["bots"] if b["alive"]]
    best = max(alive, key=lambda b: b["equity"])
    print(f"OK : {len(alive)} bots vivants, meilleur = {best['name']} à {best['equity']:.2f} €")
    for m in msgs:
        print("[Gardien]", m)
    return 0


def backtest(synthetic=False, days=None, step_h=2):
    data = market.load_all(synthetic)
    if not data or any(len(c) < 300 for c in data.values()):
        print("Pas assez d'historique pour rejouer le passé.")
        return 1
    n = min(len(c) for c in data.values())
    data = {a: c[-n:] for a, c in data.items()}
    warmup = 200 if days is None else max(200, n - days * 24)  # les stratégies ont besoin d'historique
    start_ts = data["BTC"][warmup - 1]["t"]
    state = engine.init_state(start_ts)
    series = engine._series(data)
    status = {a: (True, "ok") for a in data}
    neutral = {a: 0.0 for a in data}
    times = [c["t"] for c in data["BTC"]]
    for i in range(warmup, n, step_h):
        engine.run_until(state, data, times[min(i + step_h - 1, n - 1)], neutral, status, series=series)
    state["market"] = {a: market.analyze(c) for a, c in data.items()}
    state["guardian"] = {"messages": ["Rejeu du passé : les bots « actus » n'ont pas d'actualités historiques, ils restent neutres."]}
    out = config.DASHBOARD_DIR / "backtest"
    sub = f"Rejeu des {(n - warmup) / 24:.0f} derniers jours{' (prix inventés)' if synthetic else ''}"
    dashboard.write(state, out, "Arène des bots : rejeu du passé", sub)
    print(dashboard.render_md(state, "Rejeu du passé"))
    return 0


def main():
    ap = argparse.ArgumentParser(description="Arène de bots de trading (simulation)")
    ap.add_argument("mode", choices=["tick", "backtest", "reset"])
    ap.add_argument("--synthetic", action="store_true", help="prix inventés, sans internet")
    ap.add_argument("--days", type=int, default=None)
    a = ap.parse_args()
    if a.mode == "reset":
        if config.STATE_PATH.exists():
            config.STATE_PATH.unlink()
        print("Arène remise à zéro.")
        return 0
    if a.mode == "backtest":
        return backtest(a.synthetic, a.days)
    return tick(a.synthetic)


if __name__ == "__main__":
    raise SystemExit(main())
