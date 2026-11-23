#!/usr/bin/env python3
"""Build upload packages of the game for web game portals.

Usage:
    python3 tools/build_portals.py [--gd-game-id YOUR_GD_GAME_ID]

Writes dist/<portal>/index.html and dist/<portal>.zip for:
    crazygames, poki, gamedistribution
Each build is index.html with that portal's SDK <script> and
window.AD_PLATFORM injected before the game's own code.
"""
import argparse
import pathlib
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "index.html"
DIST = ROOT / "dist"

HEADS = {
    "crazygames": (
        '<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>\n'
        "<script>window.AD_PLATFORM='crazygames';</script>\n"
    ),
    "poki": (
        '<script src="https://game-cdn.poki.com/scripts/v2/poki-sdk.js"></script>\n'
        "<script>window.AD_PLATFORM='poki';</script>\n"
    ),
    "gamedistribution": (
        "<script>\n"
        "window.AD_PLATFORM='gd';\n"
        'window["GD_OPTIONS"]={"gameId":"%GD_GAME_ID%","onEvent":function(e){if(window.__gdEvent)window.__gdEvent(e);}};\n'
        "(function(d,s,id){var js,fjs=d.getElementsByTagName(s)[0];if(d.getElementById(id))return;"
        "js=d.createElement(s);js.id=id;js.src='https://html5.api.gamedistribution.com/main.min.js';"
        "fjs.parentNode.insertBefore(js,fjs);}(document,'script','gamedistribution-jssdk'));\n"
        "</script>\n"
    ),
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--gd-game-id", default="REPLACE_WITH_GD_GAME_ID")
    args = ap.parse_args()
    src = SRC.read_text(encoding="utf-8")
    anchor = "<style>"
    assert src.count(anchor) == 1, "index.html must contain exactly one <style> tag"
    for name, head in HEADS.items():
        head = head.replace("%GD_GAME_ID%", args.gd_game_id)
        out_dir = DIST / name
        out_dir.mkdir(parents=True, exist_ok=True)
        html = src.replace(anchor, head + anchor, 1)
        (out_dir / "index.html").write_text(html, encoding="utf-8")
        with zipfile.ZipFile(DIST / f"{name}.zip", "w", zipfile.ZIP_DEFLATED) as z:
            z.write(out_dir / "index.html", "index.html")
        print(f"built dist/{name}.zip")


if __name__ == "__main__":
    main()
