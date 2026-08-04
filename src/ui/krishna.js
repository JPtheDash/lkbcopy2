// Krishna's sprite sheet, in one place.
//
// Two scenes draw him, and they used to load the same "krishna" texture key
// from different files - one a sheet, one a single image. Whichever scene ran
// first won, so arriving at the home screen from a level showed all eight
// frames side by side. Loading and animation both live here now, so there is
// only one description of what that key contains.

import { loadSheet } from "./loader";

import krishnaSheet from "../assets/characters/krishna_sheet.png";

export const KRISHNA_KEY = "krishna";

// Cut by tools/optimize_assets.py - keep in step with FRAME_W and
// SHEET_CELL_H there.
export const KRISHNA_FRAME = { width: 150, height: 220 };

// The drawing does not fill its frame, so a sprite sized to 100 stands about
// 94 tall. Anything positioning him by height needs to allow for that.
export const KRISHNA_ART_RATIO = 0.94;

const ANIMS = [
    // Two near-identical standing poses, held long enough to read as
    // breathing rather than as a twitch
    { key: "krishna-idle", frames: [0, 1], rate: 2, repeat: -1 },
    { key: "krishna-run", frames: [2, 3, 4, 5], rate: 12, repeat: -1 },

    // Single poses - which one shows is decided by which way he is
    // travelling, so neither of them animates
    { key: "krishna-jump", frames: [6], rate: 1, repeat: 0 },
    { key: "krishna-fall", frames: [7], rate: 1, repeat: 0 }
];

export function loadKrishna(scene){

    loadSheet(
        scene, KRISHNA_KEY, krishnaSheet,
        KRISHNA_FRAME.width, KRISHNA_FRAME.height
    );

}

/**
 * Definitions live on the global animation manager, so they outlive the scene
 * that made them and must not be added twice.
 */
export function createKrishnaAnimations(scene){

    ANIMS.forEach(({ key, frames, rate, repeat })=>{

        if(scene.anims.exists(key)){

            return;

        }

        scene.anims.create({
            key,
            frames: frames.map(frame => ({ key: KRISHNA_KEY, frame })),
            frameRate: rate,
            repeat
        });

    });

}
