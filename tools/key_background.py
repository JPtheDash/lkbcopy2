"""
Removes the backdrop that generated art arrives painted onto.

    python3 tools/key_background.py src/assets/platforms/platform_wood.png ...
    python3 tools/key_background.py --tolerance 24 src/assets/ui/icon_music.png
    python3 tools/key_background.py --checker src/assets/characters/krishna_sheet.png
    python3 tools/key_background.py --edges --close 21 src/assets/characters/krishna_hero.png

The backdrops here are not a single flat colour - the sprite sheet sits on a
grey that ramps from 200 to 251 across the frame, and a fixed "delete
everything near this RGB" threshold either leaves a band behind or bites into
the art. So the fill compares each pixel against the neighbour it spread from
rather than against the seed. A smooth ramp stays connected no matter how far
it drifts, while the hard edge where the art starts stops it.

Only pixels reachable from the border are removed, so an enclosed patch of
backdrop-coloured art - a grey stone, a white highlight - survives.

Flags, each for a way the art was delivered:

  --tolerance N  how far the fill may drift between neighbours. The default
                 suits a flat plate; drop it to 6-8 for a gradient.
  --checker      the export baked in the editor's transparency chequerboard,
                 so the backdrop has to be classified by colour before the
                 fill can cross its cell edges.
  --edges        the backdrop is a gradient with a glow painted into it, and
                 drifts as far as the art does. Stops the fill at steep
                 changes instead of trusting colour alone.
  --close N      the art is a mesh of separate strokes with backdrop showing
                 between them - hair, foliage - and the gaps need bridging or
                 the fill pours in through them.
  --largest      the picture is of one object, so anything left over that is
                 not joined to it is keying residue and goes.
  --restore      start again from the delivered file in incoming/originals/.
                 Keying is destructive, so every retry needs this.
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

# How big a step between neighbouring pixels counts as a drawn edge rather
# than the backdrop's own drift, and how hard to blur before measuring it.
#
# These are low because the boundary that matters least often has the most
# contrast. Krishna's hair is black against a near-black corner of the
# backdrop, and at a threshold in the teens that boundary is invisible - the
# fill walks in and eats the hair, and no amount of closing afterwards puts
# the silhouette back. Blurring hard enough to kill JPEG ringing smears the
# same faint boundary away, so the blur stays light and the threshold sits
# just above the noise that survives it.
EDGE_BLUR = 0.6
EDGE_THRESHOLD = 5

# What a leftover scrap of backdrop looks like next to the art.
#
# The ceiling is this high because the scrap is rarely grey: the hero art has
# a coloured glow painted around the figure, so the rind carries it - blue
# down one side at 0.20 to 0.32 saturation, warm down the other at 0.35. A
# neutral-only test took a tenth of it and left the rest as a staircase of
# haze, invisible on the dark backgrounds the art is normally seen against
# and obvious the moment it went on a store banner over a pale sky.
#
# It stays under what the art itself measures - skin around 0.64, gold and
# feather past 0.9 - and the luminance window guards the two things that are
# desaturated on purpose: hair below 55, pearls and highlights above 190.
RIND_SATURATION = 0.55
RIND_LUM = (55, 190)

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


def edge_walls(im, threshold=EDGE_THRESHOLD):
    """
    Pixels where the picture changes faster than a backdrop ever does.

    Comparing each pixel with the neighbour the fill arrived from follows a
    smooth ramp, which is the whole point on a gradient backdrop - but it also
    walks straight across the anti-aliased boundary into the art, because that
    boundary is a ramp too, just a short one. On the hero art it crossed the
    two-pixel blend at the edge of Krishna's hair and dissolved all of it.

    So the ramp gets a second test it cannot pass: how steep it is. The
    backdrop drifts, the ink outline steps, and only the step is a wall.

    Note this also keys out soft glows and vignettes - anything painted onto
    the backdrop without a hard edge - which is what we want, since they were
    lighting on the old backdrop and belong to nothing once it is gone.
    """

    import numpy as np

    # Without a blur first, JPEG ringing along the outline reads as edges
    # several pixels out into the backdrop and walls the fill off early,
    # leaving a rind of grey around the art.
    a = np.asarray(
        im.filter(ImageFilter.GaussianBlur(EDGE_BLUR)).convert("RGB"),
        dtype=np.int16
    )

    step = np.zeros(a.shape[:2], dtype=np.int16)
    step[:, :-1] = np.abs(a[:, 1:] - a[:, :-1]).max(axis=2)
    step[:-1, :] = np.maximum(
        step[:-1, :], np.abs(a[1:, :] - a[:-1, :]).max(axis=2)
    )

    # A step belongs to both pixels either side of it, or the fill slips
    # through the near side of every outline.
    both = step.copy()
    both[:, 1:] = np.maximum(both[:, 1:], step[:, :-1])
    both[1:, :] = np.maximum(both[1:, :], step[:-1, :])

    return bytearray((both > threshold).astype(np.uint8).ravel())


def background_mask(im, tolerance, allowed=None, compare=None):
    """
    Flood the backdrop inwards from every border pixel.

    With `allowed` the fill spreads through pre-classified backdrop pixels
    instead of comparing colours as it goes; without it, each pixel is judged
    against the neighbour it spread from, which follows a smooth ramp.

    `compare` forces both tests at once. The edge mode needs that: the walls
    stop the fill at the outline, and the colour test is the backstop for
    wherever the outline turns out to have a gap in it.

    Either way the fill only starts at the border, so a patch of art that
    happens to match the backdrop - a white highlight, a grey stone - keeps
    its pixels as long as nothing connects it to the edge.
    """

    if compare is None:
        compare = allowed is None

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

            if allowed is not None and not allowed[i]:
                continue

            if compare:
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


def close_gaps(kept, w, h, size):
    """
    Bridge gaps in the kept mask that are narrower than `size`.

    Krishna's hair is drawn as a mesh of separate locks with backdrop visible
    between them. Every one of those gaps reaches the outside, so the fill
    pours in through them and leaves the hair as a sparse lattice of strands -
    on a white page it reads as a grey wig. No colour or edge test can help,
    because the pixels between the locks genuinely are backdrop.

    A dilate-then-erode closes anything thinner than the window while leaving
    the silhouette where it was. The window has to stay well under the real
    gaps in the pose - between the legs, and between each arm and the body -
    or those close up too and he ends up a solid slab.

    The window is an octagon rather than PIL's square, built by following the
    square with repeated 3x3 passes - a square leaves its own corners behind
    as right-angled notches cut into the side of the hair, which at the size
    this is closed at are plainly visible on screen.
    """

    mask = Image.frombytes(
        "L", (w, h), bytes(255 if k else 0 for k in kept)
    )

    square = max(3, (size // 2) | 1)
    diamond = max(1, (size - square) // 2)

    out = mask.filter(ImageFilter.MaxFilter(square))
    for _ in range(diamond):
        out = out.filter(ImageFilter.MaxFilter(3))

    out = out.filter(ImageFilter.MinFilter(square))
    for _ in range(diamond):
        out = out.filter(ImageFilter.MinFilter(3))

    return bytearray(1 if p else 0 for p in out.get_flattened_data())


def strip_rind(im, kept, w, h):
    """
    Peel off backdrop still clinging to the outline.

    The steepness test stops the fill at anything that changes fast, and JPEG
    ringing around the art changes fast - so the fill can halt a few pixels
    early and leave a rind of backdrop grey welded to the silhouette. It is
    invisible against the dark backgrounds the art is normally composited on
    and unmissable on a pale one, which is a bad way to find out.

    The tell is that it still looks like backdrop: neutral, and mid-toned.
    Every part of the art it borders is either strongly coloured - blue skin,
    gold, green - or much darker than the backdrop ever gets, so spreading
    inward from the transparent region through neutral mid-tones only takes
    the rind. Highlights survive: they are far brighter than RIND_LUM allows,
    and enclosed ones like the whites of the eyes are never reached at all.
    """

    px = im.convert("RGB").load()
    lo, hi = RIND_LUM

    def backdroplike(i):

        if not kept[i]:
            return False

        r, g, b = px[i % w, i // w]

        top, bottom = max(r, g, b), min(r, g, b)

        if top and (top - bottom) / top > RIND_SATURATION:
            return False

        return lo <= (r + g + b) / 3 <= hi

    out = bytearray(kept)
    seen = bytearray(w * h)
    queue = deque()

    # Seed from everything already judged backdrop
    for i in range(w * h):
        if not kept[i]:
            seen[i] = 1
            queue.append(i)

    while queue:

        i = queue.popleft()
        x, y = i % w, i // w

        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):

            if not (0 <= nx < w and 0 <= ny < h):
                continue

            j = ny * w + nx

            if seen[j] or not backdroplike(j):
                continue

            seen[j] = 1
            out[j] = 0
            queue.append(j)

    return out


def keep_largest(kept, w, h):
    """
    Throw away everything not joined to the main shape.

    Closing pulls the hair together but leaves the tips of a few outlying
    locks stranded as their own blobs, floating beside the head. They are far
    too big for despeckle to call them flecks and far too obviously wrong to
    keep, and on a single-figure cutout there is only ever one right answer
    for what to keep: the figure.
    """

    solid = bytearray(kept)
    best = []

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

        if len(blob) > len(best):
            best = blob

    out = bytearray(w * h)

    for i in best:
        out[i] = 1

    return out


def fill_holes(kept, w, h, max_area):
    """
    Make opaque any transparent pocket that is sealed inside the art.

    Closing bridges the gaps between Krishna's locks of hair, but a few
    pockets deeper in the mass are wider than the window and survive as square
    punctures. They cannot reach the outside, so nothing about them is
    backdrop - they are just places the fill got to before the closing sealed
    the way back out.

    Only sealed pockets, and only small ones: the gap between an arm and the
    body reaches the border and is never considered, and `max_area` keeps a
    genuinely enclosed piece of backdrop - the triangle inside the butter
    pot's rope - from being painted over.
    """

    clear = bytearray(0 if k else 1 for k in kept)
    out = bytearray(kept)

    for start in range(w * h):

        if not clear[start]:
            continue

        pocket = []
        queue = deque([start])
        clear[start] = 0
        sealed = True

        while queue:

            i = queue.popleft()
            pocket.append(i)
            x, y = i % w, i // w

            if x in (0, w - 1) or y in (0, h - 1):
                sealed = False

            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if 0 <= nx < w and 0 <= ny < h:
                    j = ny * w + nx
                    if clear[j]:
                        clear[j] = 0
                        queue.append(j)

        if sealed and len(pocket) <= max_area:
            for i in pocket:
                out[i] = 1

    return out


def key(path, tolerance=DEFAULT_TOLERANCE, checker=False, edges=False,
        close=0, largest=False):

    im = Image.open(path).convert("RGB")
    w, h = im.size

    bands = checker_bands(im) if checker else None

    if checker and bands is None:
        raise SystemExit(f"{path}: no checkerboard found, drop --checker")

    if edges:
        # Walls stop the fill; the colour test still runs alongside them as a
        # backstop. Nothing is grown into the art afterwards - one pixel of
        # growth here would take the outline off with it, and the outline is
        # what the whole mode is protecting.
        mask = background_mask(
            im,
            tolerance,
            bytearray(0 if wall else 1 for wall in edge_walls(im)),
            compare=True
        )
    elif bands:
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

    if close:
        # Closing first, then despeckling again: bridging the strands merges
        # them into the body, so flecks that were big enough to survive on
        # their own are re-judged as part of the whole shape.
        kept = despeckle(
            bytes(255 if k else 0 for k in close_gaps(kept, w, h, close)), w, h
        )

    # A picture of one thing keeps only that thing. despeckle's floor is 64px
    # and what a chequerboard leaves behind can be bigger: mother_angry came
    # out with a 202px scrap of backdrop floating beside her, which no size
    # threshold would have caught without eating something real elsewhere.
    #
    # Always done after closing, never instead of it - closing is what joins a
    # mesh into the one blob this then keeps.
    if largest or close:

        kept = keep_largest(kept, w, h)

    if close:

        # A pocket several window-widths across was never something closing
        # was meant to reach, so it is left alone as real backdrop.
        kept = fill_holes(kept, w, h, (close * 4) ** 2)

    # Last, and it has to be last: closing dilates the silhouette outward, so
    # stripping the rind before it simply hands those pixels back. Running it
    # after fill_holes is safe because a sealed pocket is not reachable from
    # the outside, which is the only place this spreads from.
    if edges:
        kept = strip_rind(im, kept, w, h)

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

    edges = "--edges" in args
    if edges:
        args.remove("--edges")

    largest = "--largest" in args
    if largest:
        args.remove("--largest")

    close = 0
    if "--close" in args:
        i = args.index("--close")
        close = int(args[i + 1])
        del args[i:i + 2]

        # MaxFilter/MinFilter centre their window on a pixel, so it has to be
        # odd for the dilate and the erode to cancel out
        if close % 2 == 0:
            close += 1

    if not args:
        print(__doc__)
        return 1

    for name in args:

        path = Path(name)

        if restore and (ORIGINALS / path.name).exists():
            shutil.copy2(ORIGINALS / path.name, path)

        out, pct, bands = key(path, tolerance, checker, edges, close, largest)

        # Keying is destructive and the tolerance usually needs a second try,
        # so park the delivered file outside src/ where it neither ships nor
        # gets re-keyed on the next run.
        backup = ORIGINALS / path.name
        if not backup.exists():
            ORIGINALS.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, backup)

        out.save(path)

        how = (f"checker {bands[0]}/{bands[1]}" if bands
               else f"edges, tolerance {tolerance}" if edges
               else f"tolerance {tolerance}")
        print(f"{path.name}: {pct:.0f}% opaque after keying ({how})")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
