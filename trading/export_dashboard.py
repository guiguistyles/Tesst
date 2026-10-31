"""Prépare les données du tableau de bord (fichiers JSON de lignes) à partir de l'état de l'arène.

  python -m trading.export_dashboard <dossier_de_sortie>

Produit bots.json, equity.json, market.json et events.json. Chaque ligne porte une colonne
`run` : « direct » (simulation en cours) ou « rejeu » (rejeu du passé).
"""
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from . import config
from .strategies import STRATEGIES

RUNS = {"direct": config.STATE_PATH, "rejeu": config.STATE_PATH.parent / "backtest.json"}
MAX_POINTS = 120


def iso(ts):
    return datetime.fromtimestamp(ts, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ") if ts else None


def bot_row(run, b):
    st = b["stats"]
    return {
        "run": run, "bot_id": b["id"], "name": b["name"], "strategy": STRATEGIES[b["strategy"]][1],
        "asset": b["asset"], "status": "vivant" if b["alive"] else "mort",
        "control": b["control"], "equity": round(b["equity"], 2),
        "gain_pct": round(b["equity"] / config.CAPITAL - 1, 4),
        "hp": None if b["control"] else round(max(0.0, b["hp"]), 1),
        "trades": st["trades"], "wins": st["wins"],
        "max_drawdown": round(b["max_drawdown"], 4),
        "position": "investi" if b["qty"] > 0 else "en euros",
        "generation": b["generation"], "parent": b["parent"],
        "born_at": iso(b["born_ts"]), "died_at": iso(b["died_ts"]), "death_cause": b["death_cause"],
    }


def export(out_dir):
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    bots, equity, market, events = [], [], [], []
    for run, path in RUNS.items():
        if not path.exists():
            continue
        s = json.loads(path.read_text(encoding="utf-8"))
        for b in s["bots"]:
            bots.append(bot_row(run, b))
            if not b["alive"]:
                continue
            pts = b["equity_hist"]
            step = max(1, len(pts) // MAX_POINTS)
            sample = pts[::step]
            if sample[-1] != pts[-1]:
                sample.append(pts[-1])
            equity += [{"run": run, "bot_id": b["id"], "name": b["name"], "at": iso(t), "equity": e} for t, e in sample]
        news = (s.get("news") or {}).get("scores", {})
        for asset, m in (s.get("market") or {}).items():
            if m:
                market.append({"run": run, "asset": asset, "price": round(m["price"], 4),
                               "chg_24h": round(m["chg_24h"], 4), "chg_7d": round(m["chg_7d"], 4),
                               "vol_daily": round(m["vol_daily"], 4), "trend": m["trend"],
                               "sentiment": news.get(asset) if run == "direct" and s.get("news", {}).get("ok") else None,
                               "updated_at": iso(s["last_tick_ts"]), "started_at": iso(s["created_ts"])})
        for i, ev in enumerate(reversed(s["events"][-40:])):
            events.append({"run": run, "n": i, "at": iso(ev["ts"]), "type": ev["type"], "message": ev["msg"]})
    for name, rows in (("bots", bots), ("equity", equity), ("market", market), ("events", events)):
        (out_dir / f"{name}.json").write_text(json.dumps(rows, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print(f"{name}.json : {len(rows)} lignes")


if __name__ == "__main__":
    export(sys.argv[1] if len(sys.argv) > 1 else "dashboard/data")
