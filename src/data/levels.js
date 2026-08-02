// `unlocked` and earned stars are not stored here - they come from the
// player's save and are attached by LevelManager.
//
// A level is two screens tall (WORLD_HEIGHT 2560) and the camera follows
// Krishna up it. The floor is at y=2520, the butter sits near the top.
//
// LANDING DISTANCE, not reach, is what decides the layout
// -------------------------------------------------------
// Platforms are one-way, so Krishna passes up through them and can only land
// while descending. A diagonal jump therefore always carries him about 390px
// sideways before he can touch down - he cannot land short, because the jump
// has no throttle.
//
// A 300px platform catches him anywhere in roughly 250..530px from the
// take-off point, so x steps live in that band. Steps of 240 (what this file
// once had) meant he sailed over every platform and the levels were
// literally uncompletable.
//
//   jump rises        ~230px  ->  vertical gaps stay at or under 175
//   lands sideways    ~390px  ->  x steps stay in 300..430
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

// A narrower ledge for the harder levels. The landing band is the platform's
// own width centred on where the jump comes down, so a smaller ledge is a
// smaller target for the same jump - which is the difficulty, and also the
// reason these cannot simply be sprinkled everywhere.
//
// A jump lands ~452px sideways and these levels step 345-360, so the ledge
// has to be wide enough to still catch a landing ~100px short of its centre.
// 200 was not - it missed level 3 by 7px, silently, until the probe started
// checking steps against the width of the ledge they aim at.
const SMALL_WIDTH = 260;

// How far the butter floats above the top platform. Krishna is 230 tall, so
// this keeps it within reach of someone standing there.
const BUTTER_RISE = 140;

/**
 * Builds a zig-zag ladder of platforms from the bottom upward, finishing with
 * one solid platform under the butter.
 *
 * The top platform continues the zig-zag rather than sitting wherever the
 * butter looks best. It used to take its own `topX`, which on every level
 * put it around 175px from the platform below - well under the ~390px a jump
 * carries before it can touch down, so Krishna sailed straight over the last
 * ledge and the climb could not be finished. Deriving it from the same
 * alternation makes the final step identical to every other one.
 */
function climb({ from, gap, count, near, far, small = [], moving = [], crumbling = [] }){

    const platforms = [];

    const xAt = i => (i % 2 === 0 ? near : far);

    for(let i = 0; i <= count; i++){

        platforms.push({
            x: xAt(i),
            y: from - i * gap,

            // The last one is always solid ground - finishing a climb on a
            // ledge that slides or falls away is a coin toss, not a skill.
            type: i === count
                ? "static"
                : moving.includes(i)
                    ? "moving"
                    : crumbling.includes(i) ? "crumbling" : "static",

            ...(small.includes(i) ? { width: SMALL_WIDTH } : {})
        });

    }

    return platforms;

}

/**
 * Where the butter hangs: above the top platform, close enough that standing
 * on that platform reaches it.
 */
function butterOver(platforms){

    const top = platforms[platforms.length - 1];

    return [top.x, top.y - BUTTER_RISE];

}

/**
 * One level. The butter is derived from the platforms rather than written
 * out beside them, so the two cannot drift apart.
 */
function level({ id, timer, spawn, drops, ...shape }){

    const platforms = climb(shape);

    return { id, timer, spawn, drops, platforms, butter: butterOver(platforms) };

}

const Levels = [

    // Level 1 teaches the basic climb - nothing moves, nothing falls away.
    level({
        id: 1, timer: 90, spawn: [155, 2420], drops: [3, 7],
        from: 2360, gap: 170, count: 12, near: 540, far: 170
    }),

    // Introduces platforms that slide.
    level({
        id: 2, timer: 80, spawn: [565, 2420], drops: [2, 6, 9],
        from: 2360, gap: 168, count: 12, near: 180, far: 555,
        moving: [4, 8]
    }),

    // Adds ledges that fall away once he lands on them, and the first
    // narrow ones.
    level({
        id: 3, timer: 75, spawn: [160, 2420], drops: [3, 8],
        from: 2360, gap: 170, count: 12, near: 545, far: 165,
        moving: [5], crumbling: [3, 9], small: [6]
    }),

    level({
        id: 4, timer: 70, spawn: [165, 2420], drops: [1, 5, 10],
        from: 2360, gap: 172, count: 12, near: 550, far: 165,
        moving: [2, 7], crumbling: [4, 10], small: [6, 9]
    }),

    level({
        id: 5, timer: 65, spawn: [555, 2420], drops: [2, 6, 10],
        from: 2360, gap: 175, count: 12, near: 170, far: 550,
        moving: [3, 6, 9], crumbling: [5, 11], small: [4, 8, 10]
    })

];

export default Levels;
