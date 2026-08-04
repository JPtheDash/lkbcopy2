"""
Turns the delivered Krishna sheet into frames Phaser can animate without jitter.

    python3 tools/build_krishna_sheet.py [--frames 8] [--report]

The sheet arrives as 8 cells of 300x448, but the drawing inside each cell is a
different size and sits in a different place - one frame's feet are 12px higher
than the next, one is 20px further left. Phaser draws every frame at the same
origin, so playing them back makes Krishna bob and slide around instead of
running.

So this measures the real content box of each cell, then repaints the sheet
with every frame horizontally centred on its own mass and standing on a shared
baseline. What the animation shows after that is the drawing changing, not the
drawing moving.
"""

import sys
from pathlib import Path

from PIL import Image

from key_background import OPAQUE, despeckle

ROOT = Path(__file__).resolve().parent.parent
SHEET = ROOT / "src" / "assets" / "characters" / "krishna_sheet.png"

# Each pose is a single connected blob of about 45,000 pixels and the largest
# thing that is not a pose is 669, so anything under a couple of thousand is
# leftover checkerboard rather than art.
MIN_BLOB = 2000

# Vertical alignment is per animation, not across the whole sheet. Sharing one
# baseline everywhere would drag the tucked-up jump poses down until their
# raised feet sat on the ground line, which reads as Krishna sinking on
# take-off. Frames only ever cross-fade within a group, so a group keeping its
# own baseline is invisible - a frame bobbing inside a group is not.
GROUPS = {
    "idle": (0, 1),
    "run": (2, 3, 4, 5),
    "jump": (6, 7),
}


def content_box(keep, w, x0, x1, h):
    """Bounding box of kept pixels inside one cell, or None if the cell is empty."""

    left, right, top, bottom = x1, x0, h, 0

    for y in range(h):
        base = y * w
        for x in range(x0, x1):
            if keep[base + x]:
                left = min(left, x)
                right = max(right, x)
                top = min(top, y)
                bottom = max(bottom, y)

    if right < left:
        return None

    return left, top, right, bottom


def main():

    frames = 8
    if "--frames" in sys.argv:
        frames = int(sys.argv[sys.argv.index("--frames") + 1])

    min_blob = MIN_BLOB
    if "--min-blob" in sys.argv:
        min_blob = int(sys.argv[sys.argv.index("--min-blob") + 1])

    im = Image.open(SHEET).convert("RGBA")
    w, h = im.size
    cell = w // frames

    alpha = im.getchannel("A").tobytes()
    keep = despeckle(alpha, w, h, min_blob)

    boxes = []
    for f in range(frames):
        box = content_box(keep, w, f * cell, (f + 1) * cell, h)
        boxes.append(box)

    print(f"{SHEET.name}  {w}x{h}  ->  {frames} cells of {cell}x{h}\n")

    for f, box in enumerate(boxes):
        if box is None:
            print(f"  frame {f}: EMPTY")
            continue
        l, t, r, b = box
        print(f"  frame {f}: {r-l+1:3d}x{b-t+1:3d}  "
              f"centre x {(l+r)/2 - f*cell - cell/2:+6.1f}  baseline y {b:3d}")

    if "--report" in sys.argv:
        return 0

    live = [(f, b) for f, b in enumerate(boxes) if b]

    if not live:
        print("\nnothing to align")
        return 1

    # Applying the despeckle to the pixels as well as the mask, so the
    # leftover checker squares do not reappear once the sheet is scaled.
    cleaned = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    src = im.load()
    dst = cleaned.load()

    for y in range(h):
        base = y * w
        for x in range(w):
            if keep[base + x]:
                dst[x, y] = src[x, y]

    # Each group stands on its own lowest frame. Picking the lowest rather
    # than the average means every correction lifts art, so nothing is ever
    # pushed off the bottom of the cell.
    baselines = {}
    for group, members in GROUPS.items():
        bottoms = [boxes[f][3] for f in members if f < len(boxes) and boxes[f]]
        if bottoms:
            baselines[group] = max(bottoms)

    group_of = {f: g for g, members in GROUPS.items() for f in members}

    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    shifts = []

    for f, (l, t, r, b) in live:

        art = cleaned.crop((l, t, r + 1, b + 1))

        group = group_of.get(f)
        baseline = baselines.get(group, b)

        # Centre on the cell, stand on the group's baseline
        x = f * cell + (cell - art.width) // 2
        y = min(baseline, h - 1) - art.height + 1

        out.paste(art, (x, y), art)

        shifts.append(
            f"{f}:{x - l:+d}x{y - t:+d}y"
        )

    out.save(SHEET)

    print("\nbaselines: " + "  ".join(f"{g} y={y}" for g, y in baselines.items()))
    print("corrections: " + "  ".join(shifts))
    print(f"rewrote {SHEET.relative_to(ROOT)}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
