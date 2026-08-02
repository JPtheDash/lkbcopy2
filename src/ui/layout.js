// The art is cropped to its opaque content by tools/optimize_assets.py, so a
// sprite's centre is its art's centre and these sizes are exact on-screen
// pixels. Size things with fitWidth/fitHeight rather than raw setScale -
// a scale factor means nothing once an asset is re-exported at a new size.

export const GAME_WIDTH = 720;

// The design height, and what every layout was measured against. Kept as the
// floor rather than as the canvas: nothing may be laid out in less room than
// this, but a phone with more room gets it.
export const DESIGN_HEIGHT = 1280;

/**
 * The canvas is as tall as the phone, not a fixed 9:16.
 *
 * At a fixed 720x1280 with Scale.FIT, a modern 20:9 phone scaled the canvas
 * to its width and left 240px of black above and below - a fifth of the
 * screen, and the first thing anyone notices. Matching the device's own
 * aspect leaves nothing to letterbox.
 *
 * Width stays at 720 so every size in the game keeps meaning what it meant;
 * only the height moves, and scenes anchor to it rather than to 1280.
 *
 * Clamped at both ends. Below the design height there is not enough room for
 * the layouts, and beyond the upper bound - a tablet held in portrait, or a
 * desktop window dragged tall - the art runs out and the HUD drifts to the
 * far corners of a very long strip.
 */
function canvasHeight(){

    if(typeof window === "undefined"){

        return DESIGN_HEIGHT;

    }

    const aspect = window.innerHeight / window.innerWidth;

    return Math.round(
        Math.min(Math.max(GAME_WIDTH * aspect, DESIGN_HEIGHT), 1900)
    );

}

export const GAME_HEIGHT = canvasHeight();

/**
 * Scale an image to cover the whole canvas, cropping the overflow.
 *
 * setDisplaySize(GAME_WIDTH, GAME_HEIGHT) would stretch a background to
 * whatever shape the phone is, which on a tall screen visibly distorts the
 * art. Covering keeps it in proportion and loses the edges instead.
 */
export function coverScreen(image){

    const scale = Math.max(
        GAME_WIDTH / image.width, GAME_HEIGHT / image.height
    );

    image.setScale(scale).setPosition(GAME_WIDTH/2, GAME_HEIGHT/2);

    return image;

}

// The camera follows Krishna up the level. The world is taller than the
// longest climb needs, because the prize hangs from a rope above the last
// ledge and that rope has to have somewhere to hang from: at the old height
// the top of a twelve-ledge climb sat at y=260, which put the pot up behind
// the HUD strip with its rope running off the top of the world.
export const WORLD_HEIGHT = 2920;
export const FLOOR_Y = WORLD_HEIGHT - 40;

export function fitWidth(image, width){

    image.setScale(width / image.width);

    return image;

}

export function fitHeight(image, height){

    image.setScale(height / image.height);

    return image;

}
