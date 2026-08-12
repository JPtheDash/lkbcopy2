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

// HOW MANY RUNGS A LEVEL MAY HAVE
// -------------------------------
// BOTTOM to TOP_LIMIT is 2100px and that is the whole budget, so:
//
//     count x gap <= 2100
//
// With the 175 gap the first eight levels use, twelve rungs spends every
// pixel of it - which is why level 8 has twelve and no level had more. A
// longer ladder is not bought with a taller world, it is bought by stepping
// smaller:
//
//     12 rungs x 175      13 x 161      15 x 140      18 x 116
//
// A smaller gap does not make a jump easier or harder in itself - the jump
// has no throttle and always rises ~230px. What changes is only how much of
// the arc is spent above the target, and every one of these is checked by
// tools/probe.mjs against the real engine rather than against this comment.

// Hiding pots sit clear of the spot Krishna lands on, so hiding means going
// to one rather than already standing at it. That scramble is the mechanic.
//
// Neither the end of the plank nor the distance along it is set here: both
// are picked per attempt by createHideSpot(), which is the only place that
// knows how wide the plank and the pot actually came out on screen. The level
// says only WHICH ledges carry a pot, and whether it is a real one.

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
//
// FROM LEVEL 9 THE TIMERS RISE AGAIN, AND THAT IS NOT A MISTAKE
// -------------------------------------------------------------
// The first eight levels all climb twelve rungs or fewer, so their timers can
// fall while the work stays the same size. Past that the ladder itself grows -
// eighteen rungs by level 23 - and a climb that takes eight seconds longer
// needs those eight seconds or it is not hard, it is impossible.
//
// So the timer follows the work and the SLACK is what carries the difficulty:
// 22 seconds through the middle of the game, 21 for the last three. It cannot
// fall below 20 in any level, because that is the three-star threshold in
// StarReward.js and a level that cannot be three-starred is a level nobody
// will replay.
//
// Every value here is measured, not chosen. tools/playtest.mjs prints the
// bot's climb time for each level; the timer is that plus each of Yashoda's
// visits, plus the slack:
//
//     timer = climb + visits x (warning + watch) + slack
// The climb term comes from a fit across all 23 measured runs:
//
//     climb ~ 1.20 x platforms + 2.0 seconds
//
// which is deliberately a little above every measured point rather than
// through the middle of them. A climb estimate that reads low does not make
// the level harder, it silently spends the slack that three stars needs.
const TIMERS = [
    // 1-8, the original eight, from their own measurements
    60, 56, 53, 52, 51, 50, 49, 49,

    // 9-11, longer ladders
    52, 52, 53,

    // 12-14, sparse cover. 12 is the shortest timer in the game because it
    // is a short ladder with only two visits - the sparse cover is the whole
    // of its difficulty.
    47, 52, 51,

    // 15-17, long and sparse together
    54, 54, 56,

    // 18-20, a fourth visit
    59, 58, 59,

    // 21-23
    59, 60, 60,

    // 24-27, the longest ladders
    61, 61, 63, 64,

    // 28-30, a fifth visit
    67, 69, 69
];

// How many levels a world holds. Three worlds of ten, matching the three
// pieces of world art in assets/ui.
export const LEVELS_PER_WORLD = 10;

// The worlds, in order. `art` is the texture key the scenes load; the name is
// written across the wooden plate the card art leaves empty at its foot.
//
// A world is unlocked when its first level is - which needs no new save data,
// because levels already unlock one at a time and world 2 starts at level 11.
// Finishing level 10 therefore opens Yamuna, with nothing extra written down
// and nothing to migrate for anyone already part-way through.
// `theme` names a row in src/data/themes.js - the background, the three
// ledge pictures and the butter that world is drawn with. The LEVELS are
// identical in shape whatever the theme: same ladder, same jump, same rules.
//
// Mathura is on the house set until its own art arrives. It is written down
// rather than left to a default so that the day the palace pieces land, the
// change is this one word.
export const Worlds = [
    { id: 1, name: "VRINDAVAN", art: "worldVrindavan", theme: "house" },
    { id: 2, name: "YAMUNA",    art: "worldYamuna",    theme: "river" },
    { id: 3, name: "MATHURA",   art: "worldMathura",   theme: "house" }
];

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
    small = [], moving = [], crumbling = [], fakes = [], hideEvery = 3
}){

    const platforms = [];

    const xAt = i => (i % 2 === 0 ? near : far);

    for(let i = 0; i <= count; i++){

        const x = xAt(i);

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

            // Real cover sits on every third ledge, and that is the SPARSEST
            // a pot can be while the game stays survivable.
            //
            // Every rung has to be within one jump of a hiding place, because
            // a warning gives time for one jump and no more - tools/
            // hidetest.mjs measures exactly this and fails the level
            // otherwise. One pot covers the rung it stands on and the rung
            // either side of it, so three rungs each, so every third rung.
            // Four would leave a ledge two jumps from anywhere safe.
            //
            // It used to be every SECOND rung, which put a pot on about half
            // the ledges in the game and made the room look like a pottery
            // shelf - you were usually standing next to one already, so
            // hiding was a thing that happened rather than a thing you did.
            //
            // Fakes go on the ledges in between, and are additions rather
            // than replacements. Turning a real pot into a fake would leave
            // its ledge two jumps from anywhere safe, which a warning does
            // not allow time for; as extra pots they cost nothing but the
            // decision, which is the point of them.
            // Which END of the plank the pot stands at is NOT set here. It
            // used to be, as -travel - the end he did not arrive from - and
            // that read as varied while being nothing of the kind: cover is
            // on every second rung, the ladder zig-zags, so every rung
            // carrying a pot is arrived at from the same direction and every
            // pot in the game stood at the same end. createHideSpot() in
            // GameScene picks it per attempt instead.
            // The top rung ALWAYS carries cover, whatever hideEvery works out
            // to. It is the one rung a climb cannot avoid standing on - the
            // level does not end until he is up there reaching for the pot -
            // and it is also where a ladder that does not divide by three
            // leaves its remainder. Covering it makes any count safe at
            // hideEvery 3: the widest gap left anywhere is then two bare
            // rungs, so nothing is ever more than one jump from a pot.
            ...(i % hideEvery === 0 || i === count || fakes.includes(i) ? {
                hide: {
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
        moving: [2, 7], crumbling: [5],
        mother: { visits: 2, warning: 2100, watch: 1400 }
    }),

    // Some pots are not hiding places at all. Cover sits on every second
    // ledge, so a fake one has to leave the next pot up or down real -
    // fakes are kept four apart, never two pots in a row.
    level({
        id: 6, timer: TIMERS[5], drops: [2, 7],
        gap: 175, count: 12, ...RIGHT_FIRST,
        moving: [2, 10], crumbling: [7],
        fakes: [5, 11],
        mother: { visits: 2, warning: 2000, watch: 1400 }
    }),

    // Everything at once, and she stops keeping to a rhythm.
    level({
        id: 7, timer: TIMERS[6], drops: [3, 8],
        gap: 175, count: 12, ...LEFT_FIRST,
        small: [5, 11], moving: [2, 10], crumbling: [7],
        fakes: [5, 11],
        mother: { visits: 3, warning: 2000, watch: 1400, jitter: 3000 }
    }),

    level({
        id: 8, timer: TIMERS[7], drops: [4, 9],
        gap: 175, count: 12, ...RIGHT_FIRST,
        small: [2, 5, 11], moving: [7, 8], crumbling: [1],
        fakes: [4, 11],
        mother: { visits: 3, warning: 2000, watch: 1500, jitter: 3500 }
    }),

    //===============================================================
    // 9 onwards
    //
    // ONE RULE RUNS THROUGH ALL OF THEM: nothing hostile shares a ledge with
    // real cover. No moving ledge, no crumbling ledge, no narrow ledge, and
    // no fake pot ever lands on an index that carries a real pot.
    //
    // Hiding means standing still behind the pot until she leaves. A ledge
    // that slides takes you out from behind it; a ledge that falls away drops
    // you mid-hide; and a fake laid over a real pot's index does not add a
    // decision, it deletes a hiding place - which is how a ledge ends up two
    // jumps from cover and the level becomes unsurvivable rather than hard.
    //
    // Cover is on every third rung and on the top one, so every index in the
    // arrays below avoids multiples of three and avoids `count`. The pattern
    // in them is not decoration; it is that rule. They were laid out against
    // an older rule that put cover on every SECOND rung, so several of them
    // had to move when it changed - which levelcheck.mjs caught, one line per
    // collision, rather than leaving them to be found by a player who hid
    // behind a pot on a ledge that then slid out from under them.
    //===============================================================

    //---------------------------------------------------------------
    // 9-11: the ladder gets longer
    //
    // Twelve rungs was the ceiling at a 175 gap. These step smaller to buy
    // more of them, so there is simply more climb to be caught on - the same
    // game, held for longer.
    //---------------------------------------------------------------

    level({
        id: 9, timer: TIMERS[8], drops: [3, 8, 12],
        gap: 161, count: 13, ...RIGHT_FIRST,
        small: [7], moving: [2, 8], crumbling: [5],
        fakes: [11],
        mother: { visits: 3, warning: 2000, watch: 1500, jitter: 3000 }
    }),

    level({
        id: 10, timer: TIMERS[9], drops: [4, 10],
        gap: 161, count: 13, ...LEFT_FIRST,
        small: [5, 8], moving: [2, 11], crumbling: [7],
        fakes: [1],
        mother: { visits: 3, warning: 1950, watch: 1500, jitter: 3000 }
    }),

    // Two crumbling rungs, and the second is near the top - the first level
    // where the ledge that falls away is one you needed on the way to the pot
    // rather than one you could have hurried past.
    level({
        id: 11, timer: TIMERS[10], drops: [4, 9, 13],
        gap: 150, count: 14, ...RIGHT_FIRST,
        small: [5, 11], moving: [2, 10], crumbling: [7, 13],
        fakes: [1],
        mother: { visits: 3, warning: 1950, watch: 1550, jitter: 3200 }
    }),

    //---------------------------------------------------------------
    // 12-14: fewer places to run to
    //
    // Cover is on every third rung throughout the game, so what these three
    // do is take away the things that soften it - the fakes, the narrow
    // ledges, a visit - and leave the bare walk to a pot as the difficulty.
    //---------------------------------------------------------------

    // Everything else is eased off - two visits, the longest warning since
    // level 3, no fakes and no narrow ledges - so that what you notice is the
    // thing that changed. A level that introduces one idea should not also be
    // the level that introduces three.
    level({
        id: 12, timer: TIMERS[11], drops: [2, 7, 11],
        gap: 175, count: 12, ...LEFT_FIRST,
        moving: [4], crumbling: [8],
        mother: { visits: 2, warning: 2300, watch: 1400 }
    }),

    level({
        id: 13, timer: TIMERS[12], drops: [5, 11],
        gap: 161, count: 13, ...RIGHT_FIRST,
        small: [7], moving: [4, 10], crumbling: [8],
        fakes: [2],
        mother: { visits: 3, warning: 2200, watch: 1450, jitter: 2500 }
    }),

    level({
        id: 14, timer: TIMERS[13], drops: [3, 9],
        gap: 175, count: 12, ...LEFT_FIRST,
        small: [4, 10], moving: [2, 8], crumbling: [5],
        fakes: [7],
        mother: { visits: 3, warning: 2100, watch: 1500, jitter: 3000 }
    }),

    //---------------------------------------------------------------
    // 15-17: long and thin at once
    //---------------------------------------------------------------

    level({
        id: 15, timer: TIMERS[14], drops: [4, 10, 14],
        gap: 140, count: 15, ...RIGHT_FIRST,
        small: [5, 11], moving: [2, 10, 13], crumbling: [7],
        fakes: [1],
        mother: { visits: 3, warning: 2000, watch: 1500, jitter: 3000 }
    }),

    // Fifteen rungs, which divides by three exactly - so the top rung would
    // carry cover even without the rule that always gives it some.
    level({
        id: 16, timer: TIMERS[15], drops: [5, 11],
        gap: 140, count: 15, ...LEFT_FIRST,
        small: [7, 13], moving: [4, 10], crumbling: [8, 14],
        fakes: [2],
        mother: { visits: 3, warning: 2050, watch: 1550, jitter: 3200 }
    }),

    level({
        id: 17, timer: TIMERS[16], drops: [4, 10, 14],
        gap: 131, count: 16, ...RIGHT_FIRST,
        small: [5, 8, 13], moving: [2, 11], crumbling: [7, 14],
        fakes: [1],
        mother: { visits: 3, warning: 1950, watch: 1600, jitter: 3500 }
    }),

    //---------------------------------------------------------------
    // 18-20: a fourth visit
    //
    // Yashoda looks in four times. That is 14 seconds of the timer spent
    // standing still, on a climb that already takes over twenty.
    //
    // JITTER HAS A CEILING, AND IT FALLS AS VISITS RISE
    // -------------------------------------------------
    // Visits are spread evenly over the timer, so more of them sit closer
    // together, and jitter slides each one off its slot by up to that many
    // milliseconds either way. Push two into each other and the second is
    // thrown away: MotherWatch.warn() returns early unless it is idle.
    //
    // Nothing reports that. The level simply plays with one fewer visit than
    // it says it has, sometimes, which is the worst kind of difficulty -
    // invisible and inconsistent. tools/levelcheck.mjs works the ceiling out
    // per level and fails anything over it.
    //---------------------------------------------------------------

    level({
        id: 18, timer: TIMERS[17], drops: [4, 8, 12],
        gap: 131, count: 16, ...LEFT_FIRST,
        small: [2, 8, 14], moving: [5, 13], crumbling: [7, 11],
        fakes: [1],
        mother: { visits: 4, warning: 2000, watch: 1500, jitter: 3000 }
    }),

    level({
        id: 19, timer: TIMERS[18], drops: [5, 11],
        gap: 140, count: 15, ...RIGHT_FIRST,
        small: [7, 13], moving: [2, 10], crumbling: [4, 14],
        fakes: [8],
        mother: { visits: 4, warning: 2100, watch: 1500, jitter: 3000 }
    }),

    // Only two butter drops on the longest ladder so far. The drops are the
    // one part of the timer a player can add to, so taking them away is a
    // squeeze that costs no fairness - the level is still finishable at the
    // bot's pace with time to spare.
    level({
        id: 20, timer: TIMERS[19], drops: [4, 10],
        gap: 131, count: 16, ...LEFT_FIRST,
        small: [5, 11, 14], moving: [2, 10], crumbling: [7, 13],
        fakes: [1],
        mother: { visits: 4, warning: 1900, watch: 1600, jitter: 3000 }
    }),

    //---------------------------------------------------------------
    // 21-23: everything at once
    //
    // Seventeen and eighteen rungs, which is as tall as the budget goes at a
    // gap a jump can still clear. The last three run on 21 seconds of slack
    // rather than 22 - one second off the three-star margin, and no more,
    // because 20 is the point at which three stars stops being possible.
    //---------------------------------------------------------------

    level({
        id: 21, timer: TIMERS[20], drops: [4, 10, 16],
        gap: 123, count: 17, ...RIGHT_FIRST,
        small: [5, 11, 14], moving: [2, 10, 13], crumbling: [7],
        fakes: [1],
        mother: { visits: 4, warning: 1900, watch: 1600, jitter: 3000 }
    }),

    level({
        id: 22, timer: TIMERS[21], drops: [5, 11, 17],
        gap: 116, count: 18, ...LEFT_FIRST,
        small: [7, 13], moving: [2, 10, 16], crumbling: [4, 14],
        fakes: [8],
        mother: { visits: 4, warning: 1850, watch: 1650, jitter: 3000 }
    }),

    // Everything the game has, all switched on at once.
    level({
        id: 23, timer: TIMERS[22], drops: [6, 13],
        gap: 116, count: 18, ...RIGHT_FIRST,
        small: [5, 11, 17], moving: [2, 8, 14], crumbling: [4, 10, 16],
        fakes: [7],
        mother: { visits: 4, warning: 1800, watch: 1700, jitter: 3200 }
    }),

    //---------------------------------------------------------------
    // 24-27: the ladder runs out of room
    //
    // Nineteen rungs to twenty-two, which is the end of the budget: at a 95
    // gap, twenty-two rungs spends all 2100px. Past here a level cannot be
    // made longer at all, only harder, which is what 28-30 do.
    //
    // The warning stops falling at 1800 and stays there. Below it the banner
    // and the sight of her coming through the door arrive too close together
    // to be two separate pieces of information, and the level stops being
    // read and starts being memorised.
    //---------------------------------------------------------------

    level({
        id: 24, timer: TIMERS[23], drops: [4, 10, 16],
        gap: 110, count: 19, ...LEFT_FIRST,
        small: [5, 11, 17], moving: [2, 10, 16], crumbling: [7, 13],
        fakes: [1],
        mother: { visits: 4, warning: 1850, watch: 1650, jitter: 3200 }
    }),

    level({
        id: 25, timer: TIMERS[24], drops: [5, 11, 17],
        gap: 110, count: 19, ...RIGHT_FIRST,
        small: [7, 13], moving: [2, 10, 16], crumbling: [4, 14],
        fakes: [8],
        mother: { visits: 4, warning: 1850, watch: 1650, jitter: 3200 }
    }),

    level({
        id: 26, timer: TIMERS[25], drops: [4, 10, 16],
        gap: 105, count: 20, ...LEFT_FIRST,
        small: [5, 11, 17], moving: [2, 10, 16], crumbling: [7, 13, 19],
        fakes: [1],
        mother: { visits: 4, warning: 1800, watch: 1700, jitter: 3400 }
    }),

    // Twenty-one rungs, another that divides by three exactly.
    level({
        id: 27, timer: TIMERS[26], drops: [5, 11, 17],
        gap: 100, count: 21, ...RIGHT_FIRST,
        small: [7, 13, 19], moving: [2, 10, 16], crumbling: [4, 14, 20],
        fakes: [8],
        mother: { visits: 4, warning: 1800, watch: 1700, jitter: 3400 }
    }),

    //---------------------------------------------------------------
    // 28-30: a fifth visit
    //
    // The jitter comes DOWN here, which looks backwards on the hardest
    // levels in the game and is not. Five visits over the same timer sit
    // closer together than four, so there is less room to slide each one
    // before it collides with its neighbour and gets thrown away. Past the
    // ceiling the level would play with four visits some of the time - not
    // harder, just inconsistent.
    //---------------------------------------------------------------

    level({
        id: 28, timer: TIMERS[27], drops: [4, 10, 16],
        gap: 100, count: 21, ...LEFT_FIRST,
        small: [5, 11, 17], moving: [2, 10, 16, 19], crumbling: [7, 13],
        fakes: [1],
        mother: { visits: 5, warning: 1800, watch: 1650, jitter: 2600 }
    }),

    level({
        id: 29, timer: TIMERS[28], drops: [4, 10, 16],
        gap: 95, count: 22, ...RIGHT_FIRST,
        small: [5, 11, 17, 20], moving: [2, 10, 16], crumbling: [7, 13, 19],
        fakes: [1],
        mother: { visits: 5, warning: 1800, watch: 1700, jitter: 2800 }
    }),

    // The last one. The longest ladder the world has room for, cover on every
    // third rung, five visits, and only two butter drops to buy time back.
    level({
        id: 30, timer: TIMERS[29], drops: [5, 11],
        gap: 95, count: 22, ...LEFT_FIRST,
        small: [7, 13, 19], moving: [2, 10, 16], crumbling: [4, 14, 20],
        fakes: [8],
        mother: { visits: 5, warning: 1800, watch: 1700, jitter: 2800 }
    })

];

export default Levels;
