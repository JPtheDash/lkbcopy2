// The art is cropped to its opaque content by tools/optimize_assets.py, so a
// sprite's centre is its art's centre and these sizes are exact on-screen
// pixels. Size things with fitWidth/fitHeight rather than raw setScale -
// a scale factor means nothing once an asset is re-exported at a new size.

export const GAME_WIDTH = 720;
export const GAME_HEIGHT = 1280;

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
