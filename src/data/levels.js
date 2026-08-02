// `unlocked` and earned stars are not stored here - they come from the
// player's save and are attached by LevelManager.
//
// A level is two screens tall (WORLD_HEIGHT 2560) and the camera follows
// Krishna up it. The floor is at y=2520, the butter sits above the top
// platform.
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

// How far the butter floats above the top platform. Krishna is 230 tall, so
// this keeps it within reach of someone standing there.
const BUTTER_RISE = 140;

// Hiding pots sit at the end of the ledge Krishna does NOT land on, so hiding
// means turning round and running back rather than already standing there.
// That scramble is the whole mechanic.
const HIDE_OFFSET = 95;

//-------------------------------------------------------------------
// Timers
//
// A climb is roughly one jump per platform at about a second each, plus
// whatever is spent hiding. These bands leave progressively less room for
// hesitation rather than less room to physically finish.
//-------------------------------------------------------------------

const EASY = 60;
const MEDIUM = 45;
const HARD = 30;
const EXPERT = 20;

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
    from, gap, count, near, far,
    small = [], moving = [], crumbling = [], fakes = []
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
            y: from - i * gap,

            // The last one is always solid ground - finishing a climb on a
            // ledge that slides or falls away is a coin toss, not a skill.
            type: i === count
                ? "static"
                : moving.includes(i)
                    ? "moving"
                    : crumbling.includes(i) ? "crumbling" : "static",

            ...(small.includes(i) ? { width: SMALL_WIDTH } : {}),

            hide: {
                x: x - travel * HIDE_OFFSET,
                real: !fakes.includes(i)
            }
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
        spawn: [first.x > 360 ? first.x - STEP : first.x + STEP, 2420],
        butter: [top.x, top.y - BUTTER_RISE]
    };

}

// Two mirrored ladders, both stepping STEP across and both keeping every
// platform centre inside EDGE_MARGIN of the screen.
const RIGHT_FIRST = { near: 720 - EDGE_MARGIN, far: 720 - EDGE_MARGIN - STEP };
const LEFT_FIRST = { near: EDGE_MARGIN, far: EDGE_MARGIN + STEP };

const Levels = [

    // Teaches the climb and the hiding pot. Short, slow, nothing moves, and
    // Yashoda only looks in once.
    level({
        id: 1, timer: EASY, drops: [3],
        from: 2360, gap: 170, count: 8, ...RIGHT_FIRST,
        mother: { visits: 1, warning: 2800, watch: 1200 }
    }),

    // A longer climb, so the butter sits higher, and less time to reach it.
    level({
        id: 2, timer: EASY - 5, drops: [2, 6],
        from: 2360, gap: 168, count: 10, ...LEFT_FIRST,
        mother: { visits: 1, warning: 2600, watch: 1300 }
    }),

    // She walks in faster - the same warning, less of it.
    level({
        id: 3, timer: MEDIUM + 5, drops: [3, 8],
        from: 2360, gap: 170, count: 10, ...RIGHT_FIRST,
        mother: { visits: 1, warning: 2000, watch: 1400 }
    }),

    // Two separate moments to hide, spread across the climb.
    level({
        id: 4, timer: MEDIUM, drops: [1, 5, 9],
        from: 2360, gap: 172, count: 11, ...RIGHT_FIRST,
        crumbling: [4],
        mother: { visits: 2, warning: 2000, watch: 1400 }
    }),

    // Ledges that slide, on top of two visits.
    level({
        id: 5, timer: MEDIUM - 5, drops: [2, 6, 10],
        from: 2360, gap: 175, count: 11, ...LEFT_FIRST,
        moving: [3, 7], crumbling: [5],
        mother: { visits: 2, warning: 1900, watch: 1500 }
    }),

    // Some pots are not hiding places at all. Never two in a row, so there is
    // always a real one within a single jump.
    level({
        id: 6, timer: HARD + 5, drops: [2, 7],
        from: 2360, gap: 175, count: 12, ...RIGHT_FIRST,
        moving: [4, 9], crumbling: [6],
        fakes: [3, 8],
        mother: { visits: 2, warning: 1900, watch: 1500 }
    }),

    // Everything at once, and she stops keeping to a rhythm.
    level({
        id: 7, timer: HARD, drops: [3, 8],
        from: 2360, gap: 175, count: 12, ...LEFT_FIRST,
        small: [5, 10], moving: [2, 7], crumbling: [4],
        fakes: [6, 11],
        mother: { visits: 3, warning: 1800, watch: 1500, jitter: 3000 }
    }),

    level({
        id: 8, timer: EXPERT, drops: [4, 9],
        from: 2360, gap: 175, count: 12, ...RIGHT_FIRST,
        small: [3, 6, 10], moving: [2, 8], crumbling: [5],
        fakes: [4, 9],
        mother: { visits: 3, warning: 1600, watch: 1600, jitter: 3500 }
    })

];

export default Levels;
