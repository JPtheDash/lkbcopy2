"""
Prepares the art for the game.

Three problems with the source art, all fixed here:

1. It is enormous - 1024-1536px wide for things drawn at 60-460px, ~63MB total.
2. Every image is mostly empty space. `settings_button` fills 40% of its
   canvas, `star_full` 42%. Sizes in code therefore meant nothing.
3. The content is not centred in its canvas - `logo` sits 89px high,
   `play_button` 68px high. Placing a sprite at (x, y) did not put its art
   at (x, y), which is where the alignment drift came from.

So each image is cropped to its opaque content, then resized to 1.5x the
width it is actually drawn at. After this the sprite's centre IS the art's
centre, and `fitWidth(img, w)` in src/ui/layout.js gives an exact size.

Originals are recoverable with `git checkout -- src/assets`.

    python3 tools/optimize_assets.py
"""

import os

from PIL import Image, ImageStat

ROOT = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "src", "assets"
)

# Fully opaque, so JPEG beats PNG by an order of magnitude. Not cropped.
BACKGROUNDS = {
    "backgrounds/home_background.png": 1080,

    # Not loaded by a scene - it is the source build_climb_background() cuts
    # wall_tile and room_base out of. Kept, but not at 2MB.
    "backgrounds/room_tall.png": 900,
    "backgrounds/room_background.png": 900,
}

# file -> (widest on-screen width in px, quantize?)
# Stored at 1.5x that for high density screens.
ASSETS = {
    "items/butter_pot.png": (40, False),
    "platforms/platform.png": (300, False),
    "ui/krishna_happy_butter.png": (200, False),

    "platforms/platform_wood.png": (300, False),
    "platforms/platform_stone.png": (300, False),
    "platforms/platform_cracked.png": (300, False),
    "platforms/platform_cloud.png": (300, False),

    "items/butter_drop.png": (52, False),
    "items/feather.png": (56, False),
    "items/hazard_pot.png": (72, False),
    "fx/spark.png": (44, False),

    "ui/logo.png": (430, True),
    "ui/settings_panel.png": (560, True),
    "ui/level_banner.png": (520, True),
    "ui/star_panel.png": (480, True),
    "ui/settings_row.png": (470, True),
    "ui/next_button.png": (300, True),
    "ui/play_button.png": (280, True),
    "ui/level_button.png": (120, True),
    "ui/level_button_locked.png": (120, True),
    "ui/star_full.png": (110, True),
    "ui/star_empty.png": (110, True),
    "ui/home_button.png": (95, True),
    "ui/replay_button.png": (95, True),
    "ui/pause_button.png": (80, True),
    "ui/settings_button.png": (75, True),
    "ui/toggle_on.png": (95, True),
    "ui/toggle_off.png": (95, True),
    "ui/lock.png": (60, True),

    "ui/ribbon_perfect.png": (420, True),
    "ui/hint_swipe.png": (220, True),
    "ui/hint_hand.png": (90, True),
    "ui/icon_music.png": (70, True),
    "ui/icon_sound.png": (70, True),
    "ui/icon_language.png": (70, True),

    # Not referenced by a scene yet. Kept small so they stop bloating the
    # repo; still here if a later screen wants them.
    "ui/world_vrindavan.png": (400, True),
    "ui/world_yamuna.png": (400, True),
    "ui/world_mathura.png": (400, True),
    "ui/world_panel.png": (400, True),
    "ui/locked_world.png": (400, True),
    "ui/progress_bar.png": (400, True),
    "ui/sound_button.png": (80, True),
    "ui/left_button.png": (110, True),
    "ui/right_button.png": (110, True),
    "ui/jump_button.png": (110, True),
}

ALPHA_THRESHOLD = 30
QUALITY_SCALE = 1.5

# Krishna's sheet. The tallest pose measures 418px, so the cell leaves a
# little room over that; halving gives the 150x220 frames the game slices -
# keep these in step with KRISHNA_FRAME in src/scenes/GameScene.js.
SHEET_FRAMES = 8
SHEET_CELL_H = 440
SHEET_FOOT_MARGIN = 5
FRAME_W = 150


def crop_to_content(im):
    """Trim fully transparent margins so the canvas centre is the art centre."""
    alpha = im.split()[3]
    mask = alpha.point(lambda p: 255 if p > ALPHA_THRESHOLD else 0)
    box = mask.getbbox()

    if not box:
        return im

    return im.crop(box)


def process(rel, visual_w, quantize):
    path = os.path.join(ROOT, rel)

    if not os.path.exists(path):
        print("  missing", rel)
        return 0, 0

    before = os.path.getsize(path)

    im = Image.open(path).convert("RGBA")
    was = im.size

    im = crop_to_content(im)

    target_w = round(visual_w * QUALITY_SCALE)

    if im.width > target_w:
        target_h = max(1, round(im.height * target_w / im.width))
        im = im.resize((target_w, target_h), Image.LANCZOS)

    if quantize:
        # FASTOCTREE is the only method that preserves the alpha channel
        im = im.quantize(colors=256, method=Image.FASTOCTREE).convert("RGBA")

    im.save(path, "PNG", optimize=True)
    after = os.path.getsize(path)

    print(f"  {rel:38} {before//1024:6}KB -> {after//1024:5}KB   "
          f"{was[0]}x{was[1]} -> {im.width}x{im.height}")

    return before, after


def to_jpeg(rel, target_w):
    png_path = os.path.join(ROOT, rel)
    jpg_path = png_path[:-4] + ".jpg"
    source = png_path if os.path.exists(png_path) else jpg_path

    if not os.path.exists(source):
        print("  missing", rel)
        return 0, 0

    before = os.path.getsize(source)

    im = Image.open(source).convert("RGB")

    if im.width > target_w:
        target_h = max(1, round(im.height * target_w / im.width))
        im = im.resize((target_w, target_h), Image.LANCZOS)

    im.save(jpg_path, "JPEG", quality=82, optimize=True, progressive=True)

    if os.path.exists(png_path):
        os.remove(png_path)

    after = os.path.getsize(jpg_path)

    print(f"  {rel:38} {before//1024:6}KB -> {after//1024:5}KB   "
          f"jpg {im.width}x{im.height}")

    return before, after


def flattest_patch(im, w, h, step=20):
    """
    Locate the calmest window of the given size.

    The tile has to come from plaster with nothing in it - a lantern, a niche
    or a strip of border pattern caught in the crop repeats up the whole
    climb. Scoring every candidate by standard deviation finds that spot
    without hard-coding coordinates that break the moment the art changes.
    """

    best = None

    for y in range(0, max(1, im.height - h), step):
        for x in range(0, max(1, im.width - w), step):

            spread = sum(ImageStat.Stat(im.crop((x, y, x + w, y + h))).stddev) / 3

            if best is None or spread < best[0]:
                best = (spread, x, y)

    _, x, y = best

    return x, y, x + w, y + h


def process_sheet():
    """
    Shrink the Krishna sheet without disturbing its grid.

    Every other image here is cropped to its own opaque content, which is
    exactly what a sprite sheet must not have done to it - the frames stop
    being the same size and Phaser can no longer cut them apart. So the sheet
    is trimmed as one piece: the same rows removed from every cell, down to a
    fixed 300x440 source cell with the feet resting near the bottom edge.

    Halving that gives the 150x220 cells the game slices. Because the trim is
    anchored on the baseline rather than on each frame's own bounds, sizing
    the sprite with fitHeight puts Krishna's feet in the same place in every
    frame.
    """

    path = os.path.join(ROOT, "characters", "krishna_sheet.png")

    if not os.path.exists(path):
        print("  krishna_sheet.png missing, skipping sheet")
        return 0, 0

    before = os.path.getsize(path)

    im = Image.open(path).convert("RGBA")
    was = im.size

    if im.width % SHEET_FRAMES:
        print(f"  krishna_sheet.png width {im.width} is not {SHEET_FRAMES} cells")
        return before, before

    mask = im.split()[3].point(lambda p: 255 if p > ALPHA_THRESHOLD else 0)
    box = mask.getbbox()

    if not box:
        print("  krishna_sheet.png is empty")
        return before, before

    _, top, _, bottom = box

    # A few pixels of air under the feet, then take the cell height upwards
    # from there so the tallest pose still fits.
    floor = min(im.height, bottom + SHEET_FOOT_MARGIN)
    cell_top = floor - SHEET_CELL_H

    if cell_top > top:
        # Keeping the margin would cut the top off the tallest pose, so give
        # the art the room and lose the margin instead.
        print(f"  krishna_sheet.png: {bottom - top}px of art plus a "
              f"{SHEET_FOOT_MARGIN}px margin does not fit a {SHEET_CELL_H}px "
              f"cell, dropping the margin")
        cell_top = top
        floor = min(im.height, cell_top + SHEET_CELL_H)

    im = im.crop((0, max(0, cell_top), im.width, floor))

    cell_w = was[0] // SHEET_FRAMES
    scale = FRAME_W / cell_w

    im = im.resize(
        (FRAME_W * SHEET_FRAMES, round(im.height * scale)), Image.LANCZOS
    )

    im.save(path, "PNG", optimize=True)
    after = os.path.getsize(path)

    print(f"  {'characters/krishna_sheet.png':38} {before//1024:6}KB -> "
          f"{after//1024:5}KB   {was[0]}x{was[1]} -> {im.width}x{im.height}"
          f"   cells {FRAME_W}x{im.height}")

    return before, after


def build_climb_background():
    """
    Derives the two pieces the scrolling level needs from the room art.

    Tiling the whole room up a two-screen level repeated its wooden floor and
    its window every 720px, which read as cheap wallpaper. Instead:

      wall_tile.jpg  a nearly flat patch of plaster, mirrored on both axes so
                     it tiles with no visible seam. This covers the height of
                     the climb.
      room_base.jpg  the real room, with its top edge faded into the plaster
                     colour so it meets the tile invisibly. Drawn once at the
                     bottom of the level.

    Sourced from room_tall.jpg, which is already the screen's aspect ratio and
    has a large sweep of clean plaster to lift the tile from.
    """
    room_path = os.path.join(ROOT, "backgrounds", "room_tall.jpg")

    if not os.path.exists(room_path):
        print("  room_tall.jpg missing, skipping climb background")
        return

    room = Image.open(room_path).convert("RGB")

    # --- wall tile -------------------------------------------------------
    # The flattest 180x140 window in the art, measured rather than guessed
    patch = room.crop(flattest_patch(room, 180, 140))

    mirrored = Image.new("RGB", (patch.width * 2, patch.height * 2))
    mirrored.paste(patch, (0, 0))
    mirrored.paste(patch.transpose(Image.FLIP_LEFT_RIGHT), (patch.width, 0))
    bottom = mirrored.crop((0, 0, patch.width * 2, patch.height)) \
                     .transpose(Image.FLIP_TOP_BOTTOM)
    mirrored.paste(bottom, (0, patch.height))

    tile = mirrored.resize((256, 200), Image.LANCZOS)
    tile_path = os.path.join(ROOT, "backgrounds", "wall_tile.jpg")
    tile.save(tile_path, "JPEG", quality=88, optimize=True)

    wall_rgb = tuple(round(c) for c in ImageStat.Stat(patch).mean)

    # --- room base -------------------------------------------------------
    # room_tall is already the screen's aspect ratio, so it is used whole
    base = room.resize((720, round(room.height * 720 / room.width)), Image.LANCZOS)

    # Cross-fade the top 90px into the plaster so the seam disappears
    fade = 90
    solid = Image.new("RGB", (base.width, fade), wall_rgb)
    mask = Image.linear_gradient("L").resize((base.width, fade))
    base.paste(solid, (0, 0), mask.transpose(Image.FLIP_TOP_BOTTOM))

    base_path = os.path.join(ROOT, "backgrounds", "room_base.jpg")
    base.save(base_path, "JPEG", quality=84, optimize=True, progressive=True)

    print(f"  wall_tile.jpg   {tile.size[0]}x{tile.size[1]}  "
          f"{os.path.getsize(tile_path)//1024}KB   plaster {wall_rgb}")
    print(f"  room_base.jpg   {base.size[0]}x{base.size[1]}  "
          f"{os.path.getsize(base_path)//1024}KB")


def main():
    total_before = total_after = 0

    # Derived first, while room_tall.jpg is still at full resolution - the
    # tile is lifted from a 180px window and enlarged, so it wants the sharp
    # original rather than the shipping copy.
    build_climb_background()
    print()

    for rel, w in BACKGROUNDS.items():
        b, a = to_jpeg(rel, w)
        total_before += b
        total_after += a

    for rel, (w, q) in ASSETS.items():
        b, a = process(rel, w, q)
        total_before += b
        total_after += a

    b, a = process_sheet()
    total_before += b
    total_after += a

    print()
    print(f"TOTAL {total_before/1024/1024:.1f}MB -> {total_after/1024/1024:.1f}MB"
          f"  ({100 - total_after * 100 / max(total_before, 1):.0f}% smaller)")


if __name__ == "__main__":
    main()
