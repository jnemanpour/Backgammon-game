#!/usr/bin/env python3
"""Inline style.css + the JS modules into a single self-contained play.html.

This lets the game be opened from a single file (file://, htmlpreview, email
attachment) with no web server or module loading. Run: python3 web/build_play.py
"""
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))


def read(name):
    with open(os.path.join(HERE, name), encoding="utf-8") as f:
        return f.read()


html = read("index.html")
css = read("style.css")
for js in ["engine.js", "ai.js", "teach.js", "ui.js"]:
    html = html.replace(
        f'<script src="{js}"></script>',
        f"<script>\n{read(js)}\n</script>",
    )
html = html.replace(
    '<link rel="stylesheet" href="style.css" />',
    f"<style>\n{css}\n</style>",
)
html = html.replace("<title>Backgammon</title>",
                    "<title>Backgammon</title>\n  <!-- self-contained build; edit web/*.js and rerun build_play.py -->")

out = os.path.join(HERE, "play.html")
with open(out, "w", encoding="utf-8") as f:
    f.write(html)

# sanity: no external script/link refs remain
leftover = re.findall(r'(src|href)="(?!data:)[^"]+\.(?:js|css)"', html)
print("wrote", out, f"({len(html)} bytes)")
print("remaining external refs:", leftover or "none")

# Publish to /docs for GitHub Pages ("Deploy from a branch -> /docs").
#
# IMPORTANT: docs/index.html is written as the SELF-CONTAINED build (CSS + JS
# inlined). Serving one file avoids the classic stale-cache bug where the CDN
# hands back a new index.html with an old style.css, producing a half-styled
# page. With everything inlined there is no separate asset to go stale — a
# single reload always yields a consistent version.
docs = os.path.normpath(os.path.join(HERE, "..", "docs"))
os.makedirs(docs, exist_ok=True)
for name in ("index.html", "play.html"):
    with open(os.path.join(docs, name), "w", encoding="utf-8") as f:
        f.write(html)
open(os.path.join(docs, ".nojekyll"), "w").close()  # serve files as-is

# Remove the now-unused modular copies so docs/ has no stale, unreferenced assets.
for name in ("engine.js", "ai.js", "teach.js", "ui.js", "style.css"):
    p = os.path.join(docs, name)
    if os.path.exists(p):
        os.remove(p)
print("published self-contained docs/index.html and docs/play.html")
