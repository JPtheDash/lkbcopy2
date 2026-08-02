"""
Builds every Android launcher icon and splash screen from the game's own art.

    python3 tools/build_android_icons.py

Capacitor scaffolds a project carrying its own logo as both the launcher icon
and the splash, and `npx cap sync` never replaces them. Shipping that to Play
puts the framework's mark on the home screen instead of the game's.

Adaptive icons are 108x108dp but only the middle 72x72dp is guaranteed to
survive the launcher's mask - a circle on one phone, a squircle on the next -
so the drawing is fitted inside that and the rest is background the mask is
free to eat.

Everything here is derived, so re-running after the art changes is safe.
"""

import os

from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
ART = os.path.join(ROOT, "src", "assets")
RES = os.path.join(ROOT, "android", "app", "src", "main", "res")
STORE = os.path.join(ROOT, "dist-store")

# The head and hair, measured off krishna_hero.png. Below this the neck
# narrows and the drawing stops reading as a face at icon sizes.
HEAD_BOX = (0, 0, 436, 405)

# Legacy square icon, in px per density bucket
LEGACY = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}

# Adaptive layers are 108dp, so each bucket is its legacy size x 108/48
ADAPTIVE = {name: round(px * 108 / 48) for name, px in LEGACY.items()}

# How much of the 108dp canvas the drawing may occupy. The guaranteed-safe
# area is 72/108; staying inside that leaves the art whole under every mask.
SAFE = 66 / 108

# Warm terracotta, so the blue figure separates from it at 48px
GRADIENT = ((255, 214, 138), (232, 145, 43), (122, 52, 12))

SPLASH_BG = (42, 20, 3)


def radial(size, colours):
    """A round gradient, bright in the middle and deep at the corners."""

    inner, mid, outer = colours
    img = Image.new("RGB", (size, size), outer)
    px = img.load()

    centre = (size - 1) / 2
    far = centre * 1.42

    for y in range(size):
        for x in range(size):
            d = min(1.0, (((x - centre) ** 2 + (y - centre) ** 2) ** 0.5) / far)

            if d < 0.5:
                t = d / 0.5
                a, b = inner, mid
            else:
                t = (d - 0.5) / 0.5
                a, b = mid, outer

            px[x, y] = tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))

    return img


def head():
    """Krishna's head, cropped to its own opaque bounds."""

    hero = Image.open(
        os.path.join(ART, "characters", "krishna_hero.png")
    ).convert("RGBA")

    crop = hero.crop(HEAD_BOX)

    return crop.crop(crop.split()[3].getbbox())


def place(subject, canvas_size, fraction):
    """Fit the subject into the middle of a transparent square canvas."""

    room = canvas_size * fraction
    scale = min(room / subject.width, room / subject.height)

    art = subject.resize(
        (max(1, round(subject.width * scale)), max(1, round(subject.height * scale))),
        Image.LANCZOS
    )

    layer = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    layer.alpha_composite(
        art,
        ((canvas_size - art.width) // 2, (canvas_size - art.height) // 2)
    )

    return layer


def circle_mask(img):
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).ellipse((0, 0, img.width - 1, img.height - 1), fill=255)

    out = img.copy()
    out.putalpha(mask)

    return out


def write(img, *path):
    target = os.path.join(RES, *path)
    os.makedirs(os.path.dirname(target), exist_ok=True)
    img.save(target, "PNG", optimize=True)
    return target


def build_icons(subject):

    made = 0

    for bucket, size in LEGACY.items():

        # Legacy icons are a flat picture - no mask is applied to them, so the
        # background has to be baked in and the art kept a little larger than
        # the adaptive safe area, which nothing is going to crop.
        flat = radial(size, GRADIENT).convert("RGBA")
        flat.alpha_composite(place(subject, size, 0.76))

        write(flat, f"mipmap-{bucket}", "ic_launcher.png")
        write(circle_mask(flat), f"mipmap-{bucket}", "ic_launcher_round.png")
        made += 2

    for bucket, size in ADAPTIVE.items():

        write(radial(size, GRADIENT).convert("RGBA"),
              f"mipmap-{bucket}", "ic_launcher_background.png")

        write(place(subject, size, SAFE),
              f"mipmap-{bucket}", "ic_launcher_foreground.png")

        made += 2

    # No monochrome layer, deliberately. Android 13's themed icons draw that
    # layer as one flat colour, and this subject cannot survive it: as a
    # silhouette the hair, face and feather merge into one blob, and keying
    # the alpha off luminance instead just makes a photo negative with white
    # hair. A launcher with no monochrome layer to use falls back to the
    # full-colour icon, which is the better of the two outcomes.
    for bucket in ADAPTIVE:
        stale = os.path.join(RES, f"mipmap-{bucket}", "ic_launcher_monochrome.png")
        if os.path.exists(stale):
            os.remove(stale)

    return made


def build_adaptive_xml():
    """Point the adaptive icon at the layers built above."""

    xml = (
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
        '    <background android:drawable="@mipmap/ic_launcher_background"/>\n'
        '    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n'
        '</adaptive-icon>\n'
    )

    for name in ("ic_launcher.xml", "ic_launcher_round.xml"):
        path = os.path.join(RES, "mipmap-anydpi-v26", name)
        with open(path, "w") as f:
            f.write(xml)

    # Capacitor's own background was a vector of its logo's grid pattern, and
    # nothing refers to it once the adaptive icon points at the bitmap above.
    stale = os.path.join(RES, "drawable", "ic_launcher_background.xml")
    if os.path.exists(stale):
        os.remove(stale)


def build_splash(subject):
    """
    Redraw every splash bucket at the size Capacitor scaffolded it.

    The drawable is used as a plain window background, so it is stretched to
    whatever shape the phone is. Anything but a centred mark on a flat field
    distorts, which is why this is the logo and nothing else.
    """

    logo = Image.open(os.path.join(ART, "ui", "logo.png")).convert("RGBA")

    made = 0

    for folder in sorted(os.listdir(RES)):

        splash = os.path.join(RES, folder, "splash.png")

        if not os.path.exists(splash):
            continue

        with Image.open(splash) as existing:
            size = existing.size

        canvas = Image.new("RGBA", size, SPLASH_BG + (255,))

        # A third of the short edge, so it stays clear of the corners in
        # either orientation
        width = round(min(size) * 0.55)
        scale = width / logo.width

        mark = logo.resize(
            (width, max(1, round(logo.height * scale))), Image.LANCZOS
        )

        canvas.alpha_composite(
            mark, ((size[0] - mark.width) // 2, (size[1] - mark.height) // 2)
        )

        canvas.convert("RGB").save(splash, "PNG", optimize=True)
        made += 1

    return made


def build_store_icon(subject):
    """
    The 512x512 listing icon Play asks for.

    It has to be square and fully opaque - Play rounds the corners itself, and
    an icon that arrives already rounded gets them rounded twice.
    """

    os.makedirs(STORE, exist_ok=True)

    icon = radial(512, GRADIENT).convert("RGBA")
    icon.alpha_composite(place(subject, 512, 0.78))

    path = os.path.join(STORE, "play-icon-512.png")
    icon.convert("RGB").save(path, "PNG", optimize=True)

    return path


def main():

    subject = head()
    print(f"subject: Krishna's head, {subject.width}x{subject.height}")

    print(f"icons:   {build_icons(subject)} files across "
          f"{len(LEGACY)} densities")

    build_adaptive_xml()
    print("         adaptive-icon xml rewritten, Capacitor's background removed")

    print(f"splash:  {build_splash(subject)} buckets redrawn")
    print(f"store:   {build_store_icon(subject)}")


if __name__ == "__main__":
    main()
