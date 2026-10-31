"""Tableau de bord : une page HTML + un résumé Markdown lisible directement sur GitHub."""
import html
from datetime import datetime, timezone

from . import config
from .strategies import STRATEGIES


def _dt(ts):
    return datetime.fromtimestamp(ts, timezone.utc).strftime("%d/%m %H:%M") if ts else "-"


def _pct(x):
    return f"{x * 100:+.1f} %"


def ranking(state):
    return sorted(state["bots"], key=lambda b: (b["alive"], b["equity"]), reverse=True)


def _spark(points, w=140, h=34):
    vals = [p[1] for p in points]
    if len(vals) < 2:
        return ""
    lo, hi = min(vals + [config.CAPITAL]), max(vals + [config.CAPITAL])
    span = (hi - lo) or 1
    pts = " ".join(f"{i * w / (len(vals) - 1):.1f},{h - (v - lo) / span * h:.1f}" for i, v in enumerate(vals))
    base = h - (config.CAPITAL - lo) / span * h
    cls = "up" if vals[-1] >= config.CAPITAL else "down"
    return (f'<svg class="spark" viewBox="0 0 {w} {h}" width="{w}" height="{h}" aria-hidden="true">'
            f'<line x1="0" x2="{w}" y1="{base:.1f}" y2="{base:.1f}" class="base"/>'
            f'<polyline points="{pts}" class="{cls}"/></svg>')


def _row(rank, b):
    e = html.escape
    gain = b["equity"] / config.CAPITAL - 1
    st = b["stats"]
    win = f"{st['wins'] / st['trades'] * 100:.0f} %" if st["trades"] else "-"
    hp = max(0.0, b["hp"])
    hpw = min(100.0, hp / config.HP_CLONE * 100)
    tag = ' <span class="tag">témoin</span>' if b["control"] else ""
    pos = "investi" if b["qty"] > 0 else "en euros"
    params = ", ".join(f"{k}={v}" for k, v in b["params"].items()) or "-"
    return (f'<tr><td>{rank}</td><td><b>{e(b["name"])}</b>{tag}<div class="sub">{e(params)} · '
            f'stop {b["stop_loss"] * 100:.0f} % · gén. {b["generation"]}</div></td>'
            f'<td class="num"><b>{b["equity"]:.2f} €</b><div class="sub {"up" if gain >= 0 else "down"}">{_pct(gain)}</div></td>'
            f'<td>{_spark(b["equity_hist"])}</td>'
            f'<td><div class="hp"><div style="width:{hpw:.0f}%"></div></div><div class="sub">{"∞" if b["control"] else f"{hp:.0f} PV"}</div></td>'
            f'<td class="num">{st["trades"]}<div class="sub">{win} gagnants</div></td>'
            f'<td class="num">{b["max_drawdown"] * 100:.1f} %</td><td>{pos}</td></tr>')


CSS = """
:root{--bg:#f7f7f5;--card:#fff;--fg:#1d1d1b;--mut:#6b6b66;--line:#e4e4df;--up:#1a7f4b;--down:#c0392b;--acc:#3b5bdb}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#141413;--card:#1e1e1c;--fg:#ededea;--mut:#9a9a94;--line:#33332f;--up:#4cc38a;--down:#ff6b5b;--acc:#7c9cff}}
:root[data-theme="dark"]{--bg:#141413;--card:#1e1e1c;--fg:#ededea;--mut:#9a9a94;--line:#33332f;--up:#4cc38a;--down:#ff6b5b;--acc:#7c9cff}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.45 system-ui,-apple-system,Segoe UI,sans-serif}
main{max-width:1150px;margin:0 auto;padding:24px 16px 60px}h1{margin:0 0 4px;font-size:26px}h2{margin:32px 0 10px;font-size:18px}
.lead{color:var(--mut);margin:0 0 20px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px}.big{font-size:22px;font-weight:700}
.sub{color:var(--mut);font-size:12px}.up{color:var(--up)}.down{color:var(--down)}
.wrap{overflow-x:auto;background:var(--card);border:1px solid var(--line);border-radius:12px}
table{border-collapse:collapse;width:100%;min-width:820px}th,td{padding:9px 10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:middle}
th{font-size:12px;color:var(--mut);font-weight:600}.num{text-align:right;white-space:nowrap}
.hp{width:90px;height:8px;border-radius:4px;background:var(--line);overflow:hidden}.hp div{height:100%;background:var(--up)}
.spark polyline{fill:none;stroke-width:1.6}.spark polyline.up{stroke:var(--up)}.spark polyline.down{stroke:var(--down)}
.spark .base{stroke:var(--line);stroke-dasharray:3 3}.tag{font-size:11px;border:1px solid var(--line);border-radius:6px;padding:1px 6px;color:var(--mut);margin-left:4px}
ul.ev{list-style:none;padding:0;margin:0}ul.ev li{padding:6px 0;border-bottom:1px solid var(--line);font-size:14px}
.warn{border-left:4px solid var(--down)}a{color:var(--acc)}
"""


def render(state, title="Arène des bots", subtitle="Simulation en argent virtuel"):
    e = html.escape
    bots = ranking(state)
    alive = [b for b in bots if b["alive"]]
    dead = sorted([b for b in bots if not b["alive"]], key=lambda b: -(b["died_ts"] or 0))
    best = next((b for b in alive if not b["control"]), None)
    hold = [b for b in alive if b["strategy"] == "hold"]
    beat_hold = [b for b in alive if not b["control"] and hold and b["equity"] > max(h["equity"] for h in hold)]
    reached = [b for b in bots if b["equity"] >= 2 * config.CAPITAL]
    days = (state["last_tick_ts"] - state["created_ts"]) / 86400

    cards = [
        ("Durée", f"{days:.1f} j", f"depuis le {_dt(state['created_ts'])}"),
        ("Bots vivants", str(len(alive)), f"{len(dead)} au cimetière"),
        ("Meilleur bot", f"{best['equity']:.2f} €" if best else "-", e(best["name"]) if best else ""),
        ("Battent « acheter et garder »", f"{len(beat_hold)}", "sur les bots non-témoins"),
        ("Objectif 100 € atteint", f"{len(reached)}", "bots ayant doublé"),
    ]
    out = [f'<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
           f'<title>{e(title)}</title><style>{CSS}</style></head><body><main>',
           f'<h1>{e(title)}</h1><p class="lead">{e(subtitle)} · {config.CAPITAL:.0f} € virtuels par bot · mis à jour le {_dt(state["last_tick_ts"])} UTC</p>',
           '<div class="grid">']
    for t, v, s in cards:
        out.append(f'<div class="card"><div class="sub">{t}</div><div class="big">{v}</div><div class="sub">{s}</div></div>')
    out.append("</div>")

    if state.get("market"):
        out.append('<h2>📈 L\'Analyste : état des marchés</h2><div class="grid">')
        for a, m in state["market"].items():
            if not m:
                continue
            cls = "up" if m["chg_24h"] >= 0 else "down"
            out.append(f'<div class="card"><div class="sub">{a}/EUR · tendance {m["trend"]}</div><div class="big">{m["price"]:,.2f} €</div>'
                       f'<div class="sub"><span class="{cls}">{_pct(m["chg_24h"])} 24 h</span> · {_pct(m["chg_7d"])} 7 j · volatilité {m["vol_daily"] * 100:.1f} %/j</div></div>')
        out.append("</div>")

    news = state.get("news") or {}
    if news:
        out.append('<h2>📰 La Veille : humeur de l\'actualité</h2>')
        if not news.get("ok"):
            out.append('<p class="sub">Actualités indisponibles à ce passage : sentiment neutre utilisé.</p>')
        else:
            out.append('<div class="grid">' + "".join(
                f'<div class="card"><div class="sub">{a}</div><div class="big {"up" if s > 0 else "down" if s < 0 else ""}">{s:+.2f}</div></div>'
                for a, s in news["scores"].items()) + "</div><ul class='ev'>")
            for h in news.get("headlines", [])[:6]:
                out.append(f'<li><span class="{"up" if h["score"] > 0 else "down" if h["score"] < 0 else ""}">{h["score"]:+.2f}</span> '
                           f'<a href="{e(h["link"])}" rel="noopener">{e(h["title"])}</a></li>')
            out.append("</ul>")

    g = state.get("guardian") or {}
    if g.get("messages"):
        out.append('<h2>🛡 Le Gardien</h2><div class="card warn"><ul class="ev">' +
                   "".join(f"<li>{e(m)}</li>" for m in g["messages"]) + "</ul></div>")

    out.append('<h2>🏆 Classement des bots vivants</h2><div class="wrap"><table><thead><tr><th>#</th><th>Bot</th>'
               '<th class="num">Capital</th><th>Évolution</th><th>Vie</th><th class="num">Trades</th><th class="num">Pire chute</th><th>Position</th></tr></thead><tbody>')
    out += [_row(i + 1, b) for i, b in enumerate(alive)]
    out.append("</tbody></table></div>")

    out.append(f'<h2>☠ Cimetière ({len(dead)})</h2>')
    if dead:
        out.append('<div class="wrap"><table><thead><tr><th>Bot</th><th>Mort le</th><th>Cause</th><th class="num">Capital final</th><th class="num">Trades</th></tr></thead><tbody>')
        for b in dead[:60]:
            out.append(f'<tr><td>{e(b["name"])}</td><td>{_dt(b["died_ts"])}</td><td>{e(b["death_cause"] or "")}</td>'
                       f'<td class="num">{b["equity"]:.2f} €</td><td class="num">{b["stats"]["trades"]}</td></tr>')
        out.append("</tbody></table></div>")
    else:
        out.append('<p class="sub">Personne n\'est mort pour l\'instant.</p>')

    out.append('<h2>📜 Journal</h2><div class="card"><ul class="ev">')
    for ev in reversed(state["events"][-40:]):
        out.append(f'<li><span class="sub">{_dt(ev["ts"])}</span> · {e(ev["msg"])}</li>')
    out.append("</ul></div>")

    out.append('<h2>📚 Les stratégies</h2><div class="card"><ul class="ev">' + "".join(
        f"<li><b>{e(n)}</b> : {e(d)}</li>" for _, (_, n, d) in STRATEGIES.items()) + "</ul></div>")
    out.append('<p class="sub" style="margin-top:24px">Simulation pédagogique en argent fictif. Les résultats passés ne prédisent pas les résultats futurs.</p>')
    out.append("</main></body></html>")
    return "".join(out)


def render_md(state, title):
    bots = ranking(state)
    lines = [f"# {title}", "", f"_Mis à jour le {_dt(state['last_tick_ts'])} UTC · {config.CAPITAL:.0f} € virtuels par bot · argent fictif_", "",
             "| # | Bot | Capital | Gain | PV | Trades | Pire chute | Statut |", "|---|---|---:|---:|---:|---:|---:|---|"]
    for i, b in enumerate(bots, 1):
        status = "vivant" if b["alive"] else f"☠ {b['death_cause']}"
        hp = "∞" if b["control"] else f"{max(0, b['hp']):.0f}"
        lines.append(f"| {i} | {b['name']}{' (témoin)' if b['control'] else ''} | {b['equity']:.2f} € | {_pct(b['equity'] / config.CAPITAL - 1)} | "
                     f"{hp} | {b['stats']['trades']} | {b['max_drawdown'] * 100:.1f} % | {status} |")
    lines += ["", "## Derniers événements", ""] + [f"- {_dt(ev['ts'])} · {ev['msg']}" for ev in reversed(state["events"][-15:])]
    return "\n".join(lines) + "\n"


def write(state, out_dir, title, subtitle):
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "index.html").write_text(render(state, title, subtitle), encoding="utf-8")
    (out_dir / "RESULTATS.md").write_text(render_md(state, title), encoding="utf-8")
