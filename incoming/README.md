# Drop art here

Put image files in this folder, then run:

    python3 tools/install_assets.py

It measures each one (size, alpha channel, how much of the frame is actually
opaque) and reports. Nothing moves until you add `--install`.

    python3 tools/install_assets.py --install

Names it recognises, and where each ends up:

| file | goes to |
|---|---|
| `krishna_sheet.png` | `src/assets/characters/` |
| `room_tall.jpg` | `src/assets/backgrounds/` |
| `platform_wood.png` `platform_stone.png` `platform_cloud.png` `platform_cracked.png` | `src/assets/platforms/` |
| `butter_drop.png` `feather.png` `hazard_pot.png` | `src/assets/items/` |
| `spark.png` `dust.png` `star_burst.png` | `src/assets/fx/` |
| `world_vrindavan.png` `world_yamuna.png` `world_mathura.png` | `src/assets/ui/` |
| `ribbon_perfect.png` `hint_swipe.png` `hint_hand.png` | `src/assets/ui/` |
| `icon_music.png` `icon_sound.png` `icon_language.png` | `src/assets/ui/` |

Matching is loose - `Platform Wood.PNG` lands as `platform_wood.png`. For a
download that kept its generated name:

    python3 tools/install_assets.py --install --map "Gemini_Generated_Image_4f2.png=krishna_sheet.png"

Everything except `room_tall.jpg` needs a real alpha channel. Art exported onto
a grey or white backdrop draws as a solid rectangle in the game; the report
flags that before it costs you a debugging session.

## Rebuilding

`incoming/originals/` holds the delivered art, untouched. It is not in git -
39MB of source images. Refill it from the Drive folder:

    pip install gdown
    cd incoming/originals
    gdown --folder "https://drive.google.com/drive/folders/1yRIuqKW46B9Vn9wd4D2nkF9QLTLPPTP0"

Then rebuild everything that ships:

    python3 tools/build_assets.py
