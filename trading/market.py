"""Bot n°1 - l'Analyste de marché : récupère les prix et résume la situation."""
import json
import math
import random
import time
import urllib.request

from . import config

UA = {"User-Agent": "arena-bots/1.0 (simulation)"}


def _get_json(url, timeout=20):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode())


def fetch_kraken(pair):
    data = _get_json(f"https://api.kraken.com/0/public/OHLC?pair={pair}&interval=60")
    if data.get("error"):
        raise RuntimeError(f"Kraken: {data['error']}")
    key = next(k for k in data["result"] if k != "last")
    rows = data["result"][key][:-1]  # la dernière bougie n'est pas encore fermée
    return [{"t": int(r[0]), "o": float(r[1]), "h": float(r[2]), "l": float(r[3]),
             "c": float(r[4]), "v": float(r[6])} for r in rows]


def fetch_coinbase(product):
    rows = _get_json(f"https://api.exchange.coinbase.com/products/{product}/candles?granularity=3600")
    now = time.time()
    out = [{"t": int(r[0]), "l": float(r[1]), "h": float(r[2]), "o": float(r[3]),
            "c": float(r[4]), "v": float(r[5])} for r in rows if r[0] + 3600 <= now]
    return sorted(out, key=lambda c: c["t"])


def synthetic(asset, n=720, end_ts=None, seed=None):
    """Prix inventés (marche aléatoire) pour tester sans internet."""
    rng = random.Random(seed if seed is not None else asset)
    start = {"BTC": 60000.0, "ETH": 2500.0, "SOL": 140.0}.get(asset, 100.0)
    vol = {"BTC": 0.006, "ETH": 0.008, "SOL": 0.011}.get(asset, 0.01)
    end_ts = end_ts or int(time.time()) // 3600 * 3600 - 3600
    price, out = start, []
    drift = rng.uniform(-0.0003, 0.0003)
    for i in range(n):
        if i % 120 == 0:
            drift = rng.uniform(-0.0004, 0.0004)  # régimes de tendance
        o = price
        price = max(0.01, price * math.exp(drift + rng.gauss(0, vol)))
        h = max(o, price) * (1 + abs(rng.gauss(0, vol / 3)))
        l = min(o, price) * (1 - abs(rng.gauss(0, vol / 3)))
        out.append({"t": end_ts - (n - 1 - i) * 3600, "o": o, "h": h, "l": l, "c": price, "v": 1.0})
    return out


def load_all(use_synthetic=False, log=print):
    data = {}
    for asset, pair in config.ASSETS.items():
        if use_synthetic:
            data[asset] = synthetic(asset)
            continue
        try:
            data[asset] = fetch_kraken(pair)
        except Exception as e:  # noqa: BLE001
            log(f"[Analyste] Kraken indisponible pour {asset} ({e}), essai Coinbase")
            try:
                data[asset] = fetch_coinbase(config.COINBASE_PAIRS[asset])
            except Exception as e2:  # noqa: BLE001
                log(f"[Analyste] Aucune donnée pour {asset} ({e2})")
    return data


def analyze(candles):
    """Résumé lisible de l'état d'un marché."""
    if len(candles) < 200:
        return {}
    closes = [c["c"] for c in candles]
    last = closes[-1]
    rets = [closes[i] / closes[i - 1] - 1 for i in range(len(closes) - 168, len(closes))]
    vol = (sum(r * r for r in rets) / len(rets)) ** 0.5 * math.sqrt(24)
    sma50 = sum(closes[-50:]) / 50
    sma200 = sum(closes[-200:]) / 200
    if last > sma50 > sma200:
        trend = "haussière"
    elif last < sma50 < sma200:
        trend = "baissière"
    else:
        trend = "indécise"
    return {
        "price": last,
        "chg_24h": last / closes[-25] - 1,
        "chg_7d": last / closes[-169] - 1,
        "vol_daily": vol,
        "trend": trend,
        "last_ts": candles[-1]["t"],
    }
