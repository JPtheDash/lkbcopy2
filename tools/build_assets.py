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

from PIL import Image

from install_assets import TARGETS, staged

ROOT = Path(__file__).resolve().parent.parent
ORIGINALS = ROOT / "incoming" / "originals"
TOOLS = Path(__file__).resolve().parent

# Art that arrived with its backdrop painted on. Everything else already has
# a real alpha channel and must not be keyed - a second pass eats the edges.
#
#   checker  the export baked in the editor's transparency chequerboard
#   flood    a flat white studio backdrop
#   edges    a soft grey gradient, with a glow painted around the art - the
#            fill has to be stopped by how sharply the picture changes, not
#            by colour, because the backdrop drifts as far as the art does
#
# Keyed by the DELIVERED name, not the staged one. Anything absent from this
# list already carries a usable alpha channel - Title.png and Krishna_hero.png
# both arrived properly cut out, and keying an already-keyed file a second
# time eats its edges.
KEYING = {
    "krishna_sheet.png": "checker",
    "icon_music.png": "checker",
    "icon_sound.png": "checker",
    "icon_language.png": "checker",

    # Delivered as JPEG with the editor's chequerboard rendered into the
    # pixels - 23px cells around 200/239 grey, measured off the files
    "emptypot.jpg": "checker",
    "filledpot.jpg": "checker",
    "walkingmother.jpg": "checker",
    "angrymother.jpg": "checker",

    # A PNG, but with the chequerboard painted in rather than a real alpha
    # channel - every pixel in it arrived fully opaque.
    "KrishnaCaught.png": "checker",

    # The Yamuna set, delivered the same way - 1408x768 and 100% opaque, with
    # the editor's chequerboard rendered into the pixels.
    "TreeBranchPlatform.png": "checker",
    "FloatingLogPlatform.png": "checker",
    "HangingVinePlatform.png": "checker",
    "YamunaButterTarget.png": "checker",
    "KrishnaHanging.png": "checker",

    "platform_wood.png": "flood",
    "platform_stone.png": "flood",
    "platform_cracked.png": "flood",
    "world_vrindavan.png": "flood",
    "world_yamuna.png": "flood",
    "world_mathura.png": "flood",

    "butter_pot.png": "edges",
}

# Art drawn as a mesh of separate strokes rather than one solid shape, and how
# wide a gap to bridge in it - hair, foliage, anything the fill can pour
# through the gaps of.
#
# Empty now that the hero arrives pre-cut. Kept because the next delivery of
# a hand-keyed character will need it again, and because the reason it exists
# is not obvious from the code that uses it.
CLOSING = {}

# Pictures of exactly one thing. Whatever survives keying without being joined
# to that thing is residue - mother_angry.jpg came out with a 202px scrap of
# chequerboard floating beside her, well over despeckle's 64px floor.
#
# KrishnaCaught.png is deliberately NOT on this list, even though it is keyed
# the same way: it is a whole tableau, and the pot hanging on its rope and the
# ones on the floor are separate blobs from the two figures. Keeping only the
# largest would throw all of them away.
SINGLE_SUBJECT = {
    "emptypot.jpg",
    "filledpot.jpg",
    "walkingmother.jpg",
    "angrymother.jpg",
    "TreeBranchPlatform.png",
    "FloatingLogPlatform.png",
    "HangingVinePlatform.png",
    "YamunaButterTarget.png",
    "KrishnaHanging.png",
}

# Art with a pocket of backdrop SEALED inside it by the drawing itself. The
# fill only ever spreads inwards from the border, so it cannot reach these:
# the vine curls round into a cradle, and the butter pot's rope makes a
# triangle with the pot's own rim. Both came out with a patch of chequerboard
# in the middle of the picture.
#
# Unlike SCENES these need no --halo - nothing is walling the fill out of the
# rest of the image, so only the sealed pools are left to deal with. 0 means
# cut the chequered pools and leave flat ones alone, which is all that is
# wanted here.
SEALED = {
    "HangingVinePlatform.png",
    "YamunaButterTarget.png",
}

# Scenes, where something in the picture walls the backdrop off from the
# border and the fill - which only ever spreads inwards from the edge - cannot
# get to it. The value is the smallest pool worth cutting out.
#
# In KrishnaCaught.png the two figures, the hanging pot and the stool between
# them enclose most of the middle of the chequerboard. 1200 is well above the
# pale details that must survive (pearls, the butter, an eye white) and well
# below the lake, which runs to tens of thousands of pixels.
# Scenes get two extra passes, and the numbers are (pool floor, glow floor).
#
# KrishnaCaught.png is mounted on a soft cream glow that rings the whole
# tableau. The glow is warm - up to 69 levels between channels where it is
# strongest - so no colour test calls it backdrop, and it walled the fill out
# of everything inside it: the fill reached 59% of the picture and stopped.
#
# 150 is the floor on the darkest channel. It has to be this low because the
# glow washes the board behind the figures down to 159, and it can be this low
# safely because nothing pale is reachable without crossing the art's own
# linework: Mother's arm is 20, her face 93, the stool 29. The butter is 175
# and survives on being enclosed, not on being bright.
#
# The pool floor is 0, meaning only chequered pools are cut and flat ones are
# left alone. Once the glow is crossed the flat pools are reachable from the
# border and get filled anyway, so the size rule has nothing left to do except
# damage: Krishna's pale highlights join into one 7990px pool that no size
# rule can tell from backdrop, and it punched holes through his face.
# The box is the pocket between Krishna's side and Mother's forearm, sealed on
# all four sides by the two of them. Nothing automatic reaches it: the fill has
# no path in, the pattern test cannot judge it because every window there is
# mostly arm, and its cells are darker than Krishna's own skin so no threshold
# gets at it either. Inside the box the neighbours are known and hand-checked,
# which is what makes a saturation test safe there and nowhere else.
SCENES = {
    "KrishnaCaught.png": (0, 150, [(692, 250, 812, 508)]),
}

# Art delivered with a soft glow painted round it on top of the chequerboard,
# but which is otherwise a single object.
#
# The glow is warm, so no colour test calls it backdrop, and because it is
# joined to the art --largest keeps it rather than dropping it: the filled pot
# came out inside a ragged oval of cream and chequerboard. The value is the
# floor on the darkest channel that the fill may cross.
#
# 150 clears the glow and leaves the butter, which survives on being enclosed
# by the rim rather than on being dark. Anything higher starts leaving cells
# of chequerboard round the top - at 175 they are plainly visible.
GLOW = {
    "filledpot.jpg": 150,
}

# Low enough that the fill stops at the art, high enough to cross the
# backdrop's own noise. Measured at 0.6 levels between neighbours on the
# white plates, so anything from 4 to 8 gives the same result.
FLOOD_TOLERANCE = 6

# The edge mode already has the steepness test doing the real work, so the
# colour test alongside it is only a backstop for gaps in an outline and can
# sit looser than the flood plates need.
EDGE_TOLERANCE = 8


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

    count = 0

    for name, folder in TARGETS.items():

        source = ORIGINALS / name

        if not source.exists():
            print(f"  no original for {name}, leaving whatever is in src/",
                  flush=True)
            continue

        dest = ROOT / "src" / "assets" / folder / staged(name)
        dest.parent.mkdir(parents=True, exist_ok=True)

        if source.suffix.lower() == dest.suffix.lower():
            shutil.copy2(source, dest)
        else:
            # Only ever JPEG becoming PNG, and it has to happen here: keying
            # writes an alpha channel back to this same path, and a JPEG
            # cannot carry one - the transparency would be silently discarded
            # and the art would ship as a rectangle of backdrop.
            with Image.open(source) as im:
                im.convert("RGBA").save(dest)

            print(f"  {name} -> {dest.name} (converted)", flush=True)

        count += 1

    print(f"staged {count} originals\n", flush=True)


def key():

    # Grouped by the flags they need, so files sharing settings still go
    # through in one call and anything with its own closing gets its own.
    batches = {}

    for name, mode in KEYING.items():

        flags = {
            "checker": ("--checker",),
            "flood": ("--tolerance", str(FLOOD_TOLERANCE)),
            "edges": ("--edges", "--tolerance", str(EDGE_TOLERANCE)),
        }[mode]

        if name in CLOSING:
            flags += ("--close", str(CLOSING[name]))

        if name in SINGLE_SUBJECT:
            flags += ("--largest",)

        if name in GLOW:
            flags += ("--halo", str(GLOW[name]))

        if name in SEALED:
            flags += ("--islands", "0")

        if name in SCENES:
            pools, glow, pockets = SCENES[name]
            flags += ("--islands", str(pools), "--halo", str(glow))
            for box in pockets:
                flags += ("--erase", ",".join(str(v) for v in box))

        batches.setdefault(flags, []).append(
            ROOT / "src" / "assets" / TARGETS[name] / staged(name)
        )

    for flags, files in batches.items():
        run(TOOLS / "key_background.py", *flags, *files)

    print(flush=True)


def main():
    stage()
    key()
    run(TOOLS / "build_krishna_sheet.py")
    print(flush=True)
    run(TOOLS / "optimize_assets.py")


if __name__ == "__main__":
    main()
