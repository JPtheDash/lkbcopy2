"""
Composes the 1024x500 feature graphic Play shows at the top of the listing.

    python3 tools/build_feature_graphic.py

Play is strict about the size - exactly 1024x500, no transparency - and loose
about everything else, which is the trap. The graphic gets cropped on some
surfaces and has UI laid over it on others, so anything that has to be read
stays inside a margin rather than running to the edge.

Built from the game's own art: the home screen's background, the title logo,
Krishna, and the pot he is climbing for.
"""

import os

from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
ART = os.path.join(ROOT, "src", "assets")
OUT = os.path.join(ROOT, "dist-store", "play-feature-graphic.png")

SIZE = (1024, 500)

# Keep anything that must survive a crop inside this much of each edge
MARGIN = 60

BRAND_DARK = (42, 20, 3)


def load(*parts):
    return Image.open(os.path.join(ART, *parts)).convert("RGBA")


def background():
    """
    The home screen's village, cropped to the banner's shape.

    Taken from the middle of the picture rather than the top: the upper third
    is mostly sky, which at 500px tall would leave the banner looking empty.
    """

    art = load("backgrounds", "home_background.jpg")

    # Widen to the banner's aspect by cutting a band out of the square
    band_h = round(art.width * SIZE[1] / SIZE[0])
    top = round((art.height - band_h) * 0.42)

    band = art.crop((0, top, art.width, top + band_h))

    return band.resize(SIZE, Image.LANCZOS)


def fit_height(img, height):
    scale = height / img.height
    return img.resize(
        (max(1, round(img.width * scale)), height), Image.LANCZOS
    )


def main():

    os.makedirs(os.path.dirname(OUT), exist_ok=True)

    canvas = background()

    # The village art is busy and the logo has to sit on top of it, so the
    # left half is darkened under a gradient rather than the whole banner -
    # a flat scrim over everything makes the art look like a mistake.
    scrim = Image.new("RGBA", SIZE, (0, 0, 0, 0))
    draw = ImageDraw.Draw(scrim)

    for x in range(SIZE[0]):
        # Solid at the left edge, gone by two thirds across
        t = max(0.0, 1 - x / (SIZE[0] * 0.66))
        draw.line([(x, 0), (x, SIZE[1])], fill=BRAND_DARK + (round(205 * t),))

    canvas.alpha_composite(scrim)

    # Krishna on the right, standing on the bottom edge. Cropped at the ankles
    # by the frame rather than floated above it, which is what makes him look
    # like part of the scene instead of a sticker on it.
    krishna = fit_height(load("characters", "krishna_hero.png"), 560)

    glow = Image.new("RGBA", SIZE, (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse(
        (SIZE[0] - 430, 40, SIZE[0] - 30, 440), fill=(255, 190, 90, 70)
    )
    canvas.alpha_composite(glow.filter(ImageFilter.GaussianBlur(60)))

    canvas.alpha_composite(
        krishna, (SIZE[0] - MARGIN - krishna.width + 40, SIZE[1] - 470)
    )

    # The pot he is climbing for, hanging into the frame from the top
    pot = fit_height(load("items", "butter_pot.png"), 300)
    canvas.alpha_composite(pot, (round(SIZE[0] * 0.56), -70))

    # Title, left, inside the margin on every side
    logo = load("ui", "logo.png")
    logo_w = round(SIZE[0] * 0.42)
    logo = logo.resize(
        (logo_w, max(1, round(logo.height * logo_w / logo.width))),
        Image.LANCZOS
    )

    canvas.alpha_composite(
        logo, (MARGIN, (SIZE[1] - logo.height) // 2 - 30)
    )

    # Play rejects transparency in this one
    canvas.convert("RGB").save(OUT, "PNG", optimize=True)

    print(f"{OUT}  {SIZE[0]}x{SIZE[1]}  "
          f"{os.path.getsize(OUT) // 1024}KB")


if __name__ == "__main__":
    main()
