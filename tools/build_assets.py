"""
Rebuilds every shipped asset from the delivered art in one command.

    python3 tools/build_assets.py

The art needs four separate passes before the game can use it, each with
settings that took measuring to find, and every pass overwrites its input. Run
them by hand in the wrong order - or twice - and you get sprites keyed against
already-keyed pixels or a sheet cropped to a fraction of its size. So the
whole chain starts from incoming/originals/ each time and is safe to re-run.

    stage      copy the delivered files to their homes under src/assets
    key        cut the backdrop off the ones that shipped without alpha
    sheet      align Krishna's frames onto shared baselines
    optimize   crop, resize and compress everything for the build

incoming/originals/ is not in git - it is 39MB of source art. Refill it from
the Drive folder in incoming/README.md, then run this.
"""

import shutil
import subprocess
import sys
from pathlib import Path

from install_assets import TARGETS

ROOT = Path(__file__).resolve().parent.parent
ORIGINALS = ROOT / "incoming" / "originals"
TOOLS = Path(__file__).resolve().parent

# Art that arrived with its backdrop painted on. Everything else already has
# a real alpha channel and must not be keyed - a second pass eats the edges.
#
#   checker  the export baked in the editor's transparency chequerboard
#   flood    a flat white studio backdrop
KEYING = {
    "krishna_sheet.png": "checker",
    "icon_music.png": "checker",
    "icon_sound.png": "checker",
    "icon_language.png": "checker",

    "platform_wood.png": "flood",
    "platform_stone.png": "flood",
    "platform_cracked.png": "flood",
    "world_vrindavan.png": "flood",
    "world_yamuna.png": "flood",
    "world_mathura.png": "flood",
}

# Low enough that the fill stops at the art, high enough to cross the
# backdrop's own noise. Measured at 0.6 levels between neighbours on the
# white plates, so anything from 4 to 8 gives the same result.
FLOOD_TOLERANCE = 6


def run(*args):
    result = subprocess.run(
        [sys.executable, *[str(a) for a in args]], cwd=ROOT
    )
    if result.returncode:
        raise SystemExit(f"failed: {' '.join(str(a) for a in args)}")


def stage():
    """Put the delivered files back, undoing every later pass."""

    if not ORIGINALS.is_dir():
        raise SystemExit(
            f"{ORIGINALS.relative_to(ROOT)}/ is missing - see incoming/README.md"
        )

    staged = 0

    for name, folder in TARGETS.items():

        source = ORIGINALS / name

        if not source.exists():
            print(f"  no original for {name}, leaving whatever is in src/",
                  flush=True)
            continue

        dest = ROOT / "src" / "assets" / folder / name
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, dest)
        staged += 1

    print(f"staged {staged} originals\n", flush=True)


def key():

    for mode in ("checker", "flood"):

        files = [
            ROOT / "src" / "assets" / TARGETS[n] / n
            for n, m in KEYING.items() if m == mode
        ]

        if not files:
            continue

        flag = ["--checker"] if mode == "checker" else [
            "--tolerance", FLOOD_TOLERANCE
        ]

        run(TOOLS / "key_background.py", *flag, *files)

    print(flush=True)


def main():
    stage()
    key()
    run(TOOLS / "build_krishna_sheet.py")
    print(flush=True)
    run(TOOLS / "optimize_assets.py")


if __name__ == "__main__":
    main()
