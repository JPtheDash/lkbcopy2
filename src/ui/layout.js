// The art is cropped to its opaque content by tools/optimize_assets.py, so a
// sprite's centre is its art's centre and these sizes are exact on-screen
// pixels. Size things with fitWidth/fitHeight rather than raw setScale -
// a scale factor means nothing once an asset is re-exported at a new size.

export const GAME_WIDTH = 720;
export const GAME_HEIGHT = 1280;

// A level is two screens tall and the camera follows Krishna up it.
export const WORLD_HEIGHT = 2560;
export const FLOOR_Y = WORLD_HEIGHT - 40;

export function fitWidth(image, width){

    image.setScale(width / image.width);

    return image;

}

export function fitHeight(image, height){

    image.setScale(height / image.height);

    return image;

}
