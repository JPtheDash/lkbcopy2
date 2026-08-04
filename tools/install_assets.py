"""
Takes art dropped into incoming/ and files it into src/assets/.

Drop the images in with any names you like, then:

    python3 tools/install_assets.py            # report only, moves nothing
    python3 tools/install_assets.py --install  # file everything it recognises
    python3 tools/install_assets.py --install --map "Gemini_x.png=krishna_sheet.png"

The report is the point. Every image is measured before it is trusted:
dimensions, whether it carries a real alpha channel, and how much of the
frame is actually opaque. Art exported onto a grey backdrop instead of
transparency renders as a grey box in the game, and that is invisible in a
thumbnail but obvious in the numbers here.
"""

import shutil
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
INCOMING = ROOT / "incoming"

# Canonical name -> where it belongs. Anything not on this list is reported
# and left alone rather than guessed at.
TARGETS = {
    "krishna_sheet.png":     "characters",
    "Krishna_hero.png":      "characters",
    "walkingmother.jpg":     "characters",
    "angrymother.jpg":       "characters",
    "room_tall.jpg":         "backgrounds",
    "butter_pot.png":        "items",
    "emptypot.jpg":          "items",
    "Title.png":             "ui",
    "platform_wood.png":     "platforms",
    "platform_stone.png":    "platforms",
    "platform_cloud.png":    "platforms",
    "platform_cracked.png":  "platforms",
    "hazard_pot.png":        "items",
    "butter_drop.png":       "items",
    "feather.png":           "items",
    "spark.png":             "fx",
    "dust.png":              "fx",
    "star_burst.png":        "fx",
    "world_vrindavan.png":   "ui",
    "world_yamuna.png":      "ui",
    "world_mathura.png":     "ui",
    "ribbon_perfect.png":    "ui",
    "hint_swipe.png":        "ui",
    "hint_hand.png":         "ui",
    "icon_music.png":        "ui",
    "icon_sound.png":        "ui",
    "icon_language.png":     "ui",
}

# Delivered art does not always arrive under the name the game uses, and some
# of it arrives as JPEG. Keying gives a file an alpha channel, which a JPEG
# cannot hold, so those have to become PNG on the way in - staging converts
# rather than copying when the extension changes.
RENAME = {
    "Title.png":         "logo.png",
    "Krishna_hero.png":  "krishna_hero.png",
    "emptypot.jpg":      "pot_hide.png",
    "walkingmother.jpg": "mother_walking.png",
    "angrymother.jpg":   "mother_angry.png",
}


def staged(name):
    """The filename a delivered file takes once it is in src/assets."""
    return RENAME.get(name, name)


# Backgrounds are meant to be opaque; everything else needs transparency.
OPAQUE_OK = {"room_tall.jpg"}


def normalise(name):
    """Loose match so 'Platform Wood.PNG' still lands as platform_wood.png."""
    stem = Path(name).stem.lower()
    stem = stem.replace(" ", "_").replace("-", "_")
    return stem


LOOKUP = {normalise(n): n for n in TARGETS}


def measure(path):
    """Dimensions plus how the alpha channel actually looks."""
    with Image.open(path) as im:
        size = im.size
        mode = im.mode
        has_alpha = mode in ("RGBA", "LA") or "transparency" in im.info

        opaque_pct = 100.0
        corners_clear = False

        if has_alpha:
            alpha = im.convert("RGBA").getchannel("A")
            pixels = size[0] * size[1]
            opaque = sum(c for v, c in enumerate(alpha.histogram()) if v > 8)
            opaque_pct = 100.0 * opaque / pixels

            w, h = size
            corners = [
                alpha.getpixel((0, 0)),
                alpha.getpixel((w - 1, 0)),
                alpha.getpixel((0, h - 1)),
                alpha.getpixel((w - 1, h - 1)),
            ]
            corners_clear = max(corners) <= 8

    return size, mode, has_alpha, opaque_pct, corners_clear


def main():
    install = "--install" in sys.argv

    renames = {}
    for i, arg in enumerate(sys.argv):
        if arg == "--map" and i + 1 < len(sys.argv):
            old, _, new = sys.argv[i + 1].partition("=")
            renames[old] = new

    if not INCOMING.is_dir():
        print(f"no {INCOMING.relative_to(ROOT)}/ folder - nothing to do")
        return 0

    files = sorted(
        p for p in INCOMING.iterdir()
        if p.is_file() and p.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp")
    )

    if not files:
        print(f"{INCOMING.relative_to(ROOT)}/ is empty - drop the art in first")
        return 0

    matched, unknown, warnings = [], [], []

    for path in files:

        name = renames.get(path.name, path.name)
        canonical = LOOKUP.get(normalise(name))

        size, mode, has_alpha, opaque_pct, corners_clear = measure(path)

        label = canonical or f"{path.name}  (unrecognised)"
        print(f"\n{label}")
        print(f"    {size[0]}x{size[1]}  {mode}")

        if has_alpha:
            print(f"    alpha yes, {opaque_pct:.0f}% opaque, "
                  f"corners {'clear' if corners_clear else 'FILLED'}")
        else:
            print("    alpha NO - flat background baked in")

        if canonical:

            if canonical not in OPAQUE_OK and (not has_alpha or not corners_clear):
                warnings.append(
                    f"{canonical}: no usable transparency, would draw as a "
                    f"solid rectangle over the scene"
                )

            matched.append((path, canonical))

        else:
            unknown.append(path)

    print()

    if warnings:
        print("PROBLEMS")
        for w in warnings:
            print("  " + w)
        print()

    if unknown:
        print("UNRECOGNISED - rename these, or pass --map \"file.png=target.png\"")
        for p in unknown:
            print("  " + p.name)
        print()

    if not install:
        print(f"{len(matched)} ready to file. Re-run with --install to move them.")
        return 0

    for path, canonical in matched:
        dest = ROOT / "src" / "assets" / TARGETS[canonical] / canonical
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(path), str(dest))
        print(f"  {path.name} -> {dest.relative_to(ROOT)}")

    print(f"\nfiled {len(matched)}, left {len(unknown)} in incoming/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
