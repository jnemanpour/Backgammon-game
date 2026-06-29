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

# Sync the runtime files into /docs so GitHub Pages can serve them via the
# "Deploy from a branch -> /docs" option (no Actions/enable step required).
import shutil
docs = os.path.normpath(os.path.join(HERE, "..", "docs"))
os.makedirs(docs, exist_ok=True)
runtime = ["index.html", "engine.js", "ai.js", "teach.js", "ui.js", "style.css", "play.html"]
for name in runtime:
    shutil.copyfile(os.path.join(HERE, name), os.path.join(docs, name))
open(os.path.join(docs, ".nojekyll"), "w").close()  # serve files as-is
print("synced site -> docs/:", ", ".join(runtime))
