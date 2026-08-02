"""
Turns the raw game screenshots into Play Store listing screenshots.

    node tools/screenshot.mjs /tmp/shots
    python3 tools/build_store_shots.py

Play wants at least two phone screenshots per listing, 16:9 or 9:16, between
320px and 3840px on a side. The game renders at 720x1280, which is already
9:16 but under the size a listing wants to be seen at, so each is scaled to
1080x1920 - a whole 1.5x, which keeps the pixel art crisp rather than
resampled.

The raw captures include the ones taken for testing that make no sense on a
storefront, so the set is chosen rather than swept up.
"""

import os

from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
STORE = os.path.join(ROOT, "dist-store", "screenshots")

SIZE = (1080, 1920)

# Raw capture -> the order it should appear in the listing. The home screen
# leads because it is the one a shopper sees as the thumbnail.
WANTED = [
    ("1-home.png", "01-title"),
    ("3-game-level1.png", "02-climbing"),
    ("4-game-level5.png", "03-later-level"),
    ("4b-game-top.png", "04-the-prize"),
    ("5-level-complete.png", "05-stars"),
    ("2-level-select.png", "06-levels"),
]


def main(raw="/tmp/shots"):

    os.makedirs(STORE, exist_ok=True)

    made = 0
    missing = []

    for source, name in WANTED:

        path = os.path.join(raw, source)

        if not os.path.exists(path):
            missing.append(source)
            continue

        shot = Image.open(path).convert("RGB")

        if shot.size != SIZE:
            shot = shot.resize(SIZE, Image.LANCZOS)

        out = os.path.join(STORE, f"{name}.png")
        shot.save(out, "PNG", optimize=True)

        print(f"  {name}.png  {shot.width}x{shot.height}  "
              f"{os.path.getsize(out) // 1024}KB")
        made += 1

    if missing:
        print(f"\n  missing from {raw}: {', '.join(missing)}")
        print("  run: node tools/screenshot.mjs " + raw)

    print(f"\n{made} screenshots in dist-store/screenshots/")

    if made < 2:
        raise SystemExit("Play needs at least two phone screenshots")


if __name__ == "__main__":
    import sys
    main(sys.argv[1] if len(sys.argv) > 1 else "/tmp/shots")
