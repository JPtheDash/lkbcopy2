// `unlocked` and earned stars are not stored here - they come from the
// player's save and are attached by LevelManager.
//
// The camera follows Krishna up the level from the floor at FLOOR_Y to the
// last ledge, with the butter pot hanging above that on a rope. Heights are
// derived from the floor rather than written out, so making the world taller
// moves the climb with it.
//
// LANDING DISTANCE, not reach, is what decides the layout
// -------------------------------------------------------
// Platforms are one-way, so Krishna passes up through them and can only land
// while descending. A diagonal jump therefore always carries him a fixed
// distance sideways before he can touch down - he cannot land short, because
// the jump has no throttle.
//
//   jump rises      ~230px  ->  vertical gaps stay at or under 175
//   jump lands      ~388px  ->  x steps sit close to that, never past it
//
// A step much shorter than the landing distance is as unplayable as one past
// it: he sails over the ledge. Both bounds are checked by tools/probe.mjs
// against the width of the platform each jump aims at.
//
// Platform types:
//   static     plain ledge
//   moving     slides side to side; keep MOVING_RANGE small or the landing
//              band above stops being reliable
//   crumbling  falls away shortly after Krishna lands, then returns
//
// `drops` are platform indices that get a butter drop floating above them.
// Collecting one adds time, which feeds straight into the star rating.
//
// tools/playtest.mjs plays every level to the butter and fails if any of this
// stops being true. Run it after editing.

import { FLOOR_Y } from "../ui/layout";

// Where a jump comes down, measured by tools/probe.mjs. Steps are built from
// this rather than chosen by eye.
const STEP = 380;

// A platform has to keep its centre this far from the screen edge to stay
// fully on a 720px screen, which is what caps how far apart two ledges can be
// - and therefore how far a jump is allowed to carry.
const EDGE_MARGIN = 170;

// A narrower ledge for the harder levels. The landing band is the platform's
// own width centred on where the jump comes down, so a smaller ledge is a
// smaller target for the same jump - which is the difficulty, and also the
// reason these cannot simply be sprinkled everywhere.
const SMALL_WIDTH = 260;

// How far the pot hangs above the top platform, measured to the pot itself
// rather than to the top of its rope. Krishna is 230 tall, so this keeps it
// within reach of someone standing on that ledge - which is the point, since
// the level cannot be won until he is standing on it.
const BUTTER_RISE = 200;

// The last ledge may not sit above this line. Above it there is no room left
// for the pot and the rope it hangs from without both running up behind the
// HUD, and the rope is the only thing that explains the swing.
//
// This is a ceiling on the levels, not something they are built down from:
// every ladder starts at the same height above the floor, so a level with
// more rungs finishes higher, and the world is sized so that the longest
// climb in the table lands exactly here. tools/probe.mjs checks it.
export const TOP_LIMIT = 620;

// The first rung, one jump above the floor. Shared by every level so that a
// climb always begins the same way, however long it turns out to be.
const BOTTOM = FLOOR_Y - 160;

// Hiding pots sit at the end of the ledge Krishna does NOT land on, so hiding
// means turning round and running back rather than already standing there.
// That scramble is the whole mechanic, so the level fixes which SIDE the pot
// stands on and nothing else. How far along it sits is picked per attempt by
// createHideSpot(), which is the only place that knows how wide the plank and
// the pot actually came out on screen.

//-------------------------------------------------------------------
// Timers
//
// A climb is roughly one jump per platform at about a second each, plus
// whatever is spent hiding. These bands leave progressively less room for
// hesitation rather than less room to physically finish.
//-------------------------------------------------------------------

// Measured, not chosen. tools/playtest.mjs reports how long each climb takes
// (8.9s to 17.0s) and each of Yashoda's visits costs its warning plus its
// watch, so a level needs roughly:
//
//   climb + visits x (warning + watch) + 20s of slack
//
// The 20 is what makes three stars reachable, since stars are awarded on
// seconds left rather than on a fraction of the timer - see StarReward.js.
// The timers still fall as the levels progress; what falls faster is the
// slack on top of the work, because the later levels have more to do.
//
// Worked through, the slack at bot pace is 47, 40, 35, 30, 28, 26, 22 and 22
// seconds - all above the 20 three stars needs, and falling steadily. A
// player is quicker than the bot, which settles after every jump, and butter
// drops add three seconds each on top, so this is the pessimistic case.
//
// Levels 7 and 8 sat at 47 and could not reach three stars at all: a third
// visit costs another 3.5s, which took their slack to 19.6.
const TIMERS = [60, 56, 53, 52, 51, 50, 49, 49];

/**
 * Builds a zig-zag ladder of platforms from the bottom upward, finishing with
 * one solid platform under the butter.
 *
 * The top platform continues the zig-zag rather than sitting wherever the
 * butter looks best. It used to take its own `topX`, which put it around
 * 175px from the platform below - well under what a jump carries before it
 * can touch down, so Krishna sailed straight over the last ledge on every
 * level and the climb could not be finished.
 */
function climb({
    gap, count, near, far,
    small = [], moving = [], crumbling = [], fakes = [], hideEvery = 2
}){

    const platforms = [];

    const xAt = i => (i % 2 === 0 ? near : far);

    for(let i = 0; i <= count; i++){

        const x = xAt(i);

        // Which way he was travelling when he arrived, so the pot goes behind
        // him rather than under his feet
        const travel = Math.sign(x - xAt(i - 1)) || 1;

        platforms.push({
            x,
            y: BOTTOM - i * gap,

            // The last one is always solid ground - finishing a climb on a
            // ledge that slides or falls away is a coin toss, not a skill.
            type: i === count
                ? "static"
                : moving.includes(i)
                    ? "moving"
                    : crumbling.includes(i) ? "crumbling" : "static",

            ...(small.includes(i) ? { width: SMALL_WIDTH } : {}),

            // Real cover sits on every hideEvery-th ledge. A pot on all of
            // them made the room look like a pottery shelf and made hiding
            // automatic - you were usually standing next to one already.
            //
            // Fakes go on the ledges in between, and are additions rather
            // than replacements. Turning a real pot into a fake would leave
            // its ledge two jumps from anywhere safe, which a warning does
            // not allow time for; as extra pots they cost nothing but the
            // decision, which is the point of them.
            ...(i % hideEvery === 0 || fakes.includes(i) ? {
                hide: {
                    side: -travel,
                    real: !fakes.includes(i)
                }
            } : {})
        });

    }

    return platforms;

}

/**
 * One level.
 *
 * The butter and the spawn are both derived from the platforms rather than
 * written out beside them, so a layout change cannot leave the goal floating
 * out of reach or drop Krishna a jump away from his first ledge.
 */
function level({ id, timer, drops = [], mother, ...shape }){

    const platforms = climb(shape);

    const top = platforms[platforms.length - 1];
    const first = platforms[0];

    return {
        id,
        timer,
        drops,
        platforms,
        mother,
        spawn: [first.x > 360 ? first.x - STEP : first.x + STEP, FLOOR_Y - 100],
        butter: [top.x, top.y - BUTTER_RISE]
    };

}

// Two mirrored ladders, both stepping STEP across and both keeping every
// platform centre inside EDGE_MARGIN of the screen.
const RIGHT_FIRST = { near: 720 - EDGE_MARGIN, far: 720 - EDGE_MARGIN - STEP };
const LEFT_FIRST = { near: EDGE_MARGIN, far: EDGE_MARGIN + STEP };

const Levels = [

    // Teaches the climb and the pot. Six ledges, nothing moves, nothing falls
    // away, and Yashoda looks in once with a long warning.
    level({
        id: 1, timer: TIMERS[0], drops: [2],
        gap: 170, count: 6, ...RIGHT_FIRST,
        mother: { visits: 1, warning: 3200, watch: 1000 }
    }),

    // A longer climb, so the butter sits higher.
    level({
        id: 2, timer: TIMERS[1], drops: [2, 6],
        gap: 168, count: 8, ...LEFT_FIRST,
        mother: { visits: 1, warning: 2800, watch: 1200 }
    }),

    // She walks in faster - the same warning, less of it.
    level({
        id: 3, timer: TIMERS[2], drops: [3, 7],
        gap: 170, count: 10, ...RIGHT_FIRST,
        mother: { visits: 1, warning: 2300, watch: 1300 }
    }),

    // Two separate moments to hide, and the first ledge that falls away.
    level({
        id: 4, timer: TIMERS[3], drops: [1, 5, 9],
        gap: 172, count: 10, ...RIGHT_FIRST,
        crumbling: [5],
        mother: { visits: 2, warning: 2200, watch: 1300 }
    }),

    // Ledges that slide, on top of two visits.
    level({
        id: 5, timer: TIMERS[4], drops: [2, 6, 10],
        gap: 175, count: 11, ...LEFT_FIRST,
        moving: [3, 7], crumbling: [5],
        mother: { visits: 2, warning: 2100, watch: 1400 }
    }),

    // Some pots are not hiding places at all. Cover sits on every second
    // ledge, so a fake one has to leave the next pot up or down real -
    // fakes are kept four apart, never two pots in a row.
    level({
        id: 6, timer: TIMERS[5], drops: [2, 7],
        gap: 175, count: 12, ...RIGHT_FIRST,
        moving: [3, 9], crumbling: [7],
        fakes: [5, 11],
        mother: { visits: 2, warning: 2000, watch: 1400 }
    }),

    // Everything at once, and she stops keeping to a rhythm.
    level({
        id: 7, timer: TIMERS[6], drops: [3, 8],
        gap: 175, count: 12, ...LEFT_FIRST,
        small: [5, 11], moving: [3, 9], crumbling: [7],
        fakes: [5, 11],
        mother: { visits: 3, warning: 2000, watch: 1400, jitter: 3000 }
    }),

    level({
        id: 8, timer: TIMERS[7], drops: [4, 9],
        gap: 175, count: 12, ...RIGHT_FIRST,
        small: [3, 5, 11], moving: [7, 9], crumbling: [1],
        fakes: [3, 11],
        mother: { visits: 3, warning: 2000, watch: 1500, jitter: 3500 }
    })

];

export default Levels;
