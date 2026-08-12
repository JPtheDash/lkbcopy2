/**
 * What each world is made of.
 *
 * Vrindavan is a kitchen: wooden shelves indoors, butter on a beam. Yamuna is
 * the riverbank: branches to stand on, a log that drifts, a vine that gives
 * way, and the pot hung from a tree. The levels themselves are identical in
 * shape - the same ladder, the same jump, the same rules - so a world is
 * entirely a matter of what its pieces are drawn as.
 *
 * Keeping that in one table rather than in the scene means adding a world is
 * adding a row here plus its art, and it means the scene never has to ask
 * which world it is in while it is drawing.
 *
 * THE BUTTER IS NOT JUST A PICTURE
 * -------------------------------
 * The prize carries geometry with it, because these two are drawn very
 * differently. Vrindavan's is a tall picture that is mostly rope with a pot
 * at the bottom; Yamuna's is a branch across the top with a pot slung under
 * it on a short rope. So each says where its own pot begins, how wide the pot
 * is against the whole picture, and how far it swings - and GameScene reads
 * those instead of holding one set of numbers that can only suit one of them.
 */

import roomTall from "../assets/backgrounds/room_tall.jpg";
import yamunaTall from "../assets/backgrounds/yamuna_tall.jpg";

import platformImg from "../assets/platforms/platform.png";
import platformCracked from "../assets/platforms/platform_cracked.png";
import platformCloud from "../assets/platforms/platform_cloud.png";

import platformBranch from "../assets/platforms/platform_branch.png";
import platformLog from "../assets/platforms/platform_log.png";
import platformVine from "../assets/platforms/platform_vine.png";

import butterPot from "../assets/items/butter_pot.png";
import butterPotYamuna from "../assets/items/butter_pot_yamuna.png";

import krishnaHanging from "../assets/characters/krishna_hanging.png";

export const THEMES = {

    //---------------------------------------------------------------
    // The house. Wooden shelves, and the butter on a kitchen beam.
    //---------------------------------------------------------------
    house: {

        // Cut into a tile and a base by tools/optimize_assets.py, and drawn
        // as a scrolling tile fixed to the camera rather than as one picture
        // - the room is taller than any phone and repeats cleanly.
        climb: { key: "roomTall", url: roomTall, tiled: true },

        // Keyed by the type names levels.js actually writes - "static", not
        // "normal". Keyed by "normal" these silently fell through to the
        // fallback table, and Yamuna's plain ledges came out as kitchen
        // shelves while its log and vine went in correctly.
        // `surface` is how far down its own picture the part you STAND ON
        // begins, as a fraction of the picture's height. These shelves are
        // solid from their top row, so it is 0 for all three.
        platforms: {
            static:    { key: "platform",         url: platformImg,     surface: 0 },
            moving:    { key: "platform-cloud",   url: platformCloud,   surface: 0 },
            crumbling: { key: "platform-cracked", url: platformCracked, surface: 0.06 }
        },

        butter: {
            key: "butter",
            url: butterPot,

            // 238x496, and the top 55% of it is the rope it hangs by.
            height: 330,
            bodyTop: 0.55,

            // The pot fills the picture's width at its widest, so half the
            // picture's width is the pot's own radius.
            radius: 0.5,

            // A pendulum on a long rope. Slow and shallow: the pot has to be
            // catchable by someone standing under it.
            swing: 13
        }

    },

    //---------------------------------------------------------------
    // The riverbank. Branches, a drifting log, a vine that lets go.
    //---------------------------------------------------------------
    river: {

        // One painting, cover-fitted, not a tile: it is a specific place with
        // a horizon in it, and a horizon cannot be repeated up a wall.
        climb: { key: "yamunaTall", url: yamunaTall, tiled: false },

        // A branch is the solid ground, the log drifts because a log on water
        // does, and the vine is what gives way when it is stood on. The
        // mapping is not arbitrary: what each ledge DOES should be readable
        // from what it is, before you land on it.
        // These are NOT solid from the top, and that is the whole reason
        // `surface` exists. The branch has twigs and leaves above it, the log
        // has sprigs, and the vine is a long curl that only becomes something
        // to stand on two thirds of the way down. Measured off the art:
        //
        //   branch  44% down its picture
        //   log     22%
        //   vine    63%
        //
        // Taken as solid from the top - which is what the scene did before
        // this existed - the vine put Krishna 227px above the thing he was
        // standing on, in mid air.
        //
        // `attach` roots a ledge to the nearest side of the screen: the art
        // is flipped to face inward and stretched until its outer end runs
        // off the edge, so a branch reads as growing out of the tree the
        // background already puts there rather than floating in the air.
        //
        // The branch and the vine attach because both grow from something.
        // The log does not - it is floating on the river, which is also why
        // it is the ledge that drifts - so it is only turned to face inward.
        platforms: {
            static:    { key: "platform-branch", url: platformBranch, surface: 0.44,
                         attach: true },
            moving:    { key: "platform-log",    url: platformLog,    surface: 0.22,
                         attach: false, face: true },
            crumbling: { key: "platform-vine",   url: platformVine,   surface: 0.63,
                         attach: true }
        },

        // A vine is not a floor. Standing on one on the balls of his feet was
        // the one thing in this world that still read as a kitchen shelf, so
        // on a vine he takes hold of it instead and hangs.
        //
        // `grip` is where his hand is in the picture, measured off the art as
        // fractions of its width and height - the hand is what has to meet
        // the vine, and it is neither the middle nor the top-left corner of
        // the drawing.
        hang: {
            key: "krishnaHanging",
            url: krishnaHanging,
            grip: { x: 0.70, y: 0.02 },

            // Drawn at full stretch, one arm up, so the same boy occupies
            // more picture than the standing frames do.
            height: 300
        },

        butter: {
            key: "butter-yamuna",
            url: butterPotYamuna,

            // 238x272: a branch across the top quarter, then a short rope,
            // then the pot from 40% down. Sized so the POT comes out the same
            // size as Vrindavan's rather than the whole picture - the picture
            // includes a branch that the other one does not have, so matching
            // total heights would draw this pot half as big again.
            //
            //   Vrindavan pot = 330 x (1 - 0.55) = 148
            //   here          = 148 / (1 - 0.40) = 247
            height: 247,
            bodyTop: 0.40,

            // The pot is 157 of the picture's 238 across, so its radius is a
            // third of the width and not the half that Vrindavan's is. Left
            // at 0.5 the grab circle would have covered the whole branch, and
            // the butter would have been collectable from the far end of it.
            radius: 0.33,

            // It does not swing. This pot is lashed tight to a branch on a
            // rope a fraction of the length of the other one's, and a short
            // rope does not swing - a pendulum arm this short only rotates
            // the pot on the spot, which reads as a wobble rather than a
            // hang. The branch is part of the same drawing too, so any
            // rotation would swing the tree along with the butter.
            swing: 0
        }

    }

};

export const DEFAULT_THEME = "house";

export function themeFor(world){

    return THEMES[(world && world.theme) || DEFAULT_THEME] || THEMES[DEFAULT_THEME];

}
