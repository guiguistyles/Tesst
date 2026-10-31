"""Bot n°2 - la Veille : lit l'actualité crypto et mesure l'humeur (sentiment).

Sources : flux RSS publics et gratuits. (L'API de Twitter/X est payante.)
Le score va de -1 (très négatif) à +1 (très positif).
"""
import re
import time
import urllib.request
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime

FEEDS = [
    "https://www.coindesk.com/arc/outboundfeeds/rss/",
    "https://cointelegraph.com/rss",
    "https://decrypt.co/feed",
]

KEYWORDS = {
    "BTC": ["bitcoin", "btc"],
    "ETH": ["ethereum", "ether", "eth"],
    "SOL": ["solana", "sol"],
}
GENERIC = ["crypto", "cryptocurrency", "market", "markets", "sec", "fed", "etf"]

POSITIVE = {
    "surge", "surges", "soar", "soars", "rally", "rallies", "gain", "gains", "jump", "jumps",
    "record", "high", "highs", "bull", "bullish", "approve", "approved", "approval", "adoption",
    "inflow", "inflows", "rise", "rises", "rebound", "breakout", "upgrade", "partnership",
    "buy", "buys", "accumulate", "growth", "boost", "optimism", "win", "launch",
}
NEGATIVE = {
    "crash", "crashes", "plunge", "plunges", "drop", "drops", "fall", "falls", "slump", "dump",
    "bear", "bearish", "hack", "hacked", "exploit", "lawsuit", "sue", "sues", "ban", "bans",
    "fraud", "scam", "outflow", "outflows", "liquidation", "liquidations", "sell-off", "selloff",
    "fear", "decline", "declines", "loss", "losses", "warning", "risk", "collapse", "investigation",
    "fine", "fined", "low", "lows", "tumble", "tumbles",
}
WORD = re.compile(r"[a-z][a-z\-]+")


def _fetch(url, timeout=15):
    req = urllib.request.Request(url, headers={"User-Agent": "arena-bots/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read(2_000_000)


def _items(raw):
    root = ET.fromstring(raw)
    for it in root.iter("item"):
        title = (it.findtext("title") or "").strip()
        desc = re.sub(r"<[^>]+>", " ", it.findtext("description") or "")
        ts = None
        pub = it.findtext("pubDate")
        if pub:
            try:
                ts = parsedate_to_datetime(pub).timestamp()
            except (TypeError, ValueError):
                ts = None
        yield title, desc, ts, (it.findtext("link") or "").strip()


def score_text(text):
    words = WORD.findall(text.lower())
    pos = sum(w in POSITIVE for w in words)
    neg = sum(w in NEGATIVE for w in words)
    return 0.0 if pos + neg == 0 else (pos - neg) / (pos + neg)


def gather(log=print, max_age_h=24):
    now = time.time()
    sums = {a: 0.0 for a in KEYWORDS}
    weights = {a: 0.0 for a in KEYWORDS}
    headlines, ok = [], 0
    for url in FEEDS:
        try:
            raw = _fetch(url)
            ok += 1
        except Exception as e:  # noqa: BLE001
            log(f"[Veille] Flux indisponible {url}: {e}")
            continue
        try:
            items = list(_items(raw))
        except ET.ParseError as e:
            log(f"[Veille] Flux illisible {url}: {e}")
            continue
        for title, desc, ts, link in items:
            if ts and now - ts > max_age_h * 3600:
                continue
            text = f"{title} {desc}"
            low = text.lower()
            s = score_text(text)
            touched = []
            for asset, kws in KEYWORDS.items():
                if any(re.search(rf"\b{k}\b", low) for k in kws):
                    sums[asset] += s
                    weights[asset] += 1.0
                    touched.append(asset)
            if not touched and any(re.search(rf"\b{k}\b", low) for k in GENERIC):
                for asset in KEYWORDS:  # actu générale : compte à moitié pour tous
                    sums[asset] += 0.5 * s
                    weights[asset] += 0.5
            headlines.append({"title": title[:160], "score": round(s, 2), "assets": touched, "link": link})
    scores = {a: round(sums[a] / weights[a], 3) if weights[a] else 0.0 for a in KEYWORDS}
    headlines.sort(key=lambda h: abs(h["score"]), reverse=True)
    return {"ok": ok > 0, "ts": int(now), "scores": scores, "headlines": headlines[:10]}


def neutral():
    return {"ok": False, "ts": int(time.time()), "scores": {a: 0.0 for a in KEYWORDS}, "headlines": []}
