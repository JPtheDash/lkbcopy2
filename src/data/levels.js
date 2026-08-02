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

/**
 * Builds a zig-zag ladder of platforms from the bottom upward, finishing with
 * one centred platform under the butter.
 */
function climb({ from, gap, count, near, far, topX, moving = [], crumbling = [] }){

    const platforms = [];

    for(let i = 0; i < count; i++){

        platforms.push({
            x: i % 2 === 0 ? near : far,
            y: from - i * gap,
            type: moving.includes(i)
                ? "moving"
                : crumbling.includes(i) ? "crumbling" : "static"
        });

    }

    // The last platform sits under the butter and is always solid ground
    platforms.push({ x: topX, y: from - count * gap, type: "static" });

    return platforms;

}

const Levels = [

    // Level 1 teaches the basic climb - nothing moves, nothing falls away.
    {
        id: 1,
        timer: 90,
        spawn: [110, 2420],
        butter: [345, 180],
        drops: [3, 7],
        platforms: climb({
            from: 2360, gap: 170, count: 12,
            near: 500, far: 170, topX: 345
        })
    },

    // Introduces platforms that slide.
    {
        id: 2,
        timer: 80,
        spawn: [610, 2420],
        butter: [375, 190],
        drops: [2, 6, 9],
        platforms: climb({
            from: 2360, gap: 168, count: 12,
            near: 220, far: 550, topX: 375,
            moving: [4, 8]
        })
    },

    // Adds ledges that fall away once he lands on them.
    {
        id: 3,
        timer: 75,
        spawn: [105, 2420],
        butter: [340, 175],
        drops: [3, 8],
        platforms: climb({
            from: 2360, gap: 170, count: 12,
            near: 510, far: 165, topX: 340,
            moving: [5], crumbling: [3, 9]
        })
    },

    {
        id: 4,
        timer: 70,
        spawn: [100, 2420],
        butter: [330, 165],
        drops: [1, 5, 10],
        platforms: climb({
            from: 2360, gap: 172, count: 12,
            near: 520, far: 160, topX: 330,
            moving: [2, 7], crumbling: [4, 10]
        })
    },

    {
        id: 5,
        timer: 65,
        spawn: [620, 2420],
        butter: [360, 170],
        drops: [2, 6, 10],
        platforms: climb({
            from: 2360, gap: 175, count: 12,
            near: 200, far: 560, topX: 360,
            moving: [3, 6, 9], crumbling: [5, 11]
        })
    }

];

export default Levels;
