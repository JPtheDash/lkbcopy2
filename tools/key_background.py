"""
Removes the backdrop that generated art arrives painted onto.

    python3 tools/key_background.py src/assets/platforms/platform_wood.png ...
    python3 tools/key_background.py --tolerance 24 src/assets/ui/icon_music.png

The backdrops here are not a single flat colour - the sprite sheet sits on a
grey that ramps from 200 to 251 across the frame, and a fixed "delete
everything near this RGB" threshold either leaves a band behind or bites into
the art. So the fill compares each pixel against the neighbour it spread from
rather than against the seed. A smooth ramp stays connected no matter how far
it drifts, while the hard edge where the art starts stops it.

Only pixels reachable from the border are removed, so an enclosed patch of
backdrop-coloured art - a grey stone, a white highlight - survives.
"""

import shutil
import sys
from collections import deque
from pathlib import Path

from PIL import Image, ImageFilter

DEFAULT_TOLERANCE = 16

ROOT = Path(__file__).resolve().parent.parent
ORIGINALS = ROOT / "incoming" / "originals"

# A checker cell is one flat grey, so its own noise is a couple of levels -
# but where the art blends into it the tone picks up a slight cast, so allow
# a little more than the cells alone would need.
NEUTRAL_TOLERANCE = 10
BAND_WIDTH = 8

# Smaller than an 8x8 patch and it is keying residue, not something drawn
OPAQUE = 200
MIN_BLOB = 64


def checker_bands(im, samples=20000):
    """
    Find the two greys of a transparency checkerboard baked into an export.

    Some of this art shipped with the editor's checkerboard rendered into the
    pixels - 199/253 grey in 13px cells on the sprite sheet, 84/127 in 10px
    cells on the icons. Every cell edge is a hard step, so a plain flood fill
    stops dead at the first one. Classifying by colour first turns the whole
    backdrop into one region that the fill can then cross.
    """

    px = im.convert("RGB").load()
    w, h = im.size

    # Sample the border ring only - the middle is art
    counts = {}
    step = max(1, (2 * (w + h)) // samples)

    for x in range(0, w, step):
        for y in (0, 1, 2, h - 3, h - 2, h - 1):
            r, g, b = px[x, y]
            if max(r, g, b) - min(r, g, b) <= NEUTRAL_TOLERANCE:
                counts[r] = counts.get(r, 0) + 1

    if not counts:
        return None

    ranked = sorted(counts, key=counts.get, reverse=True)
    dark = ranked[0]

    # The second band has to be a genuinely different grey, not a neighbour
    # of the first one inside the same cell's noise.
    light = next((v for v in ranked if abs(v - dark) > 4 * BAND_WIDTH), None)

    if light is None:
        return None

    return sorted((dark, light))


def checker_candidates(im, bands):
    """
    Pixels that look like backdrop: neutral, and no lighter or darker than
    the checkerboard's own two greys.

    Matching only the two bands is not enough. Where the art casts a soft
    shadow onto the backdrop the checker greys blend towards each other, and
    those in-between tones - 221 on a 199/255 board - belong to neither band.
    They ring the character, so a band-only test walls the fill out of every
    pocket the silhouette forms and leaves flat grey blocks behind.

    Accepting the whole span closes those pockets. Neutral art inside the
    range survives anyway as long as it is enclosed, because the fill still
    only starts from the border - eye whites and highlights are never reached.
    """

    low = min(bands) - BAND_WIDTH
    high = max(bands) + BAND_WIDTH

    w, h = im.size
    px = im.convert("RGB").load()
    ok = bytearray(w * h)

    for y in range(h):
        base = y * w
        for x in range(w):
            r, g, b = px[x, y]
            if max(r, g, b) - min(r, g, b) > NEUTRAL_TOLERANCE:
                continue
            if low <= r <= high:
                ok[base + x] = 1

    return ok


def background_mask(im, tolerance, allowed=None):
    """
    Flood the backdrop inwards from every border pixel.

    With `allowed` the fill spreads through pre-classified backdrop pixels
    instead of comparing colours as it goes; without it, each pixel is judged
    against the neighbour it spread from, which follows a smooth ramp.

    Either way the fill only starts at the border, so a patch of art that
    happens to match the backdrop - a white highlight, a grey stone - keeps
    its pixels as long as nothing connects it to the edge.
    """

    w, h = im.size
    px = im.convert("RGB").load()

    # Flat arrays keyed by y*w+x - a set of tuples is several times slower
    # and this runs over a couple of million pixels per sheet.
    seen = bytearray(w * h)
    queue = deque()

    def seed(x, y):
        i = y * w + x
        if seen[i] or (allowed is not None and not allowed[i]):
            return
        seen[i] = 1
        queue.append((x, y))

    for x in range(w):
        seed(x, 0)
        seed(x, h - 1)
    for y in range(h):
        seed(0, y)
        seed(w - 1, y)

    while queue:

        x, y = queue.popleft()
        r, g, b = px[x, y]

        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):

            if not (0 <= nx < w and 0 <= ny < h):
                continue

            i = ny * w + nx
            if seen[i]:
                continue

            if allowed is not None:
                if not allowed[i]:
                    continue
            else:
                nr, ng, nb = px[nx, ny]
                if max(abs(nr - r), abs(ng - g), abs(nb - b)) > tolerance:
                    continue

            seen[i] = 1
            queue.append((nx, ny))

    return seen


def despeckle(alpha, w, h, min_blob=MIN_BLOB):
    """
    Drop opaque islands too small to be real art.

    Keying leaves a scatter of stray flecks, and every one of them is a
    disaster downstream: the next step crops each image to its opaque bounds,
    so a single fleck in a corner pins the crop to the full canvas and the
    art ends up scaled to a fraction of its intended size on screen.
    """

    solid = bytearray(1 if a > OPAQUE else 0 for a in alpha)
    keep = bytearray(w * h)

    for start in range(w * h):

        if not solid[start]:
            continue

        blob = []
        queue = deque([start])
        solid[start] = 0

        while queue:

            i = queue.popleft()
            blob.append(i)
            x, y = i % w, i // w

            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if 0 <= nx < w and 0 <= ny < h:
                    j = ny * w + nx
                    if solid[j]:
                        solid[j] = 0
                        queue.append(j)

        if len(blob) >= min_blob:
            for i in blob:
                keep[i] = 1

    return keep


def grow(mask, w, h, rounds=1):
    """Push the mask one pixel into the art to swallow the blended fringe."""

    for _ in range(rounds):

        out = bytearray(mask)

        for y in range(h):
            base = y * w
            for x in range(w):
                if mask[base + x]:
                    continue
                if ((x and mask[base + x - 1])
                        or (x + 1 < w and mask[base + x + 1])
                        or (y and mask[base - w + x])
                        or (y + 1 < h and mask[base + w + x])):
                    out[base + x] = 1

        mask = out

    return mask


def key(path, tolerance=DEFAULT_TOLERANCE, checker=False):

    im = Image.open(path).convert("RGB")
    w, h = im.size

    bands = checker_bands(im) if checker else None

    if checker and bands is None:
        raise SystemExit(f"{path}: no checkerboard found, drop --checker")

    if bands:
        # Neighbouring cells are separated by a one-pixel blend that belongs
        # to neither band, so the raw classification is a grid of squares
        # walled off from each other and the fill never leaves the border.
        # Growing it by one bridges the seams - and takes the matching fringe
        # off the outline of the art, which no colour test would have caught.
        mask = background_mask(
            im, tolerance, grow(checker_candidates(im, bands), w, h)
        )
    else:
        mask = background_mask(im, tolerance)

    kept = despeckle(bytes(0 if m else 255 for m in mask), w, h)

    alpha = Image.frombytes("L", (w, h), bytes(255 if k else 0 for k in kept))

    # A hard mask leaves a stair-stepped outline once the sprite is scaled
    # down. One pass of blur softens the boundary without eating the shape.
    alpha = alpha.filter(ImageFilter.GaussianBlur(0.6))

    out = im.convert("RGBA")
    out.putalpha(alpha)

    opaque = sum(kept)
    return out, 100.0 * opaque / (w * h), bands


def main():

    args = [a for a in sys.argv[1:]]
    tolerance = DEFAULT_TOLERANCE

    if "--tolerance" in args:
        i = args.index("--tolerance")
        tolerance = int(args[i + 1])
        del args[i:i + 2]

    # Tuning is iterative - every retry has to start from the delivered file,
    # or the second pass keys an already-keyed image and eats the edges.
    restore = "--restore" in args
    if restore:
        args.remove("--restore")

    checker = "--checker" in args
    if checker:
        args.remove("--checker")

    if not args:
        print(__doc__)
        return 1

    for name in args:

        path = Path(name)

        if restore and (ORIGINALS / path.name).exists():
            shutil.copy2(ORIGINALS / path.name, path)

        out, pct, bands = key(path, tolerance, checker)

        # Keying is destructive and the tolerance usually needs a second try,
        # so park the delivered file outside src/ where it neither ships nor
        # gets re-keyed on the next run.
        backup = ORIGINALS / path.name
        if not backup.exists():
            ORIGINALS.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, backup)

        out.save(path)

        how = f"checker {bands[0]}/{bands[1]}" if bands else f"tolerance {tolerance}"
        print(f"{path.name}: {pct:.0f}% opaque after keying ({how})")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
