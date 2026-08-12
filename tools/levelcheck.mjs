/**
 * Checks the level table against the rules written into levels.js, without
 * launching a browser.
 *
 *   node tools/levelcheck.mjs
 *
 * tools/probe.mjs already measures every level against a real jump and
 * tools/hidetest.mjs measures cover spacing against the real hiding code.
 * Both need the game running and take minutes. This one reads the table
 * directly and takes a second, so the rules that are pure arithmetic get
 * checked on every edit rather than only when someone remembers to boot the
 * browser tools.
 *
 * WHAT IT WOULD HAVE CAUGHT
 * -------------------------
 * A hazard sharing a ledge with real cover. Hiding means standing still
 * behind the pot until Yashoda leaves, so a sliding ledge carries you out
 * from behind it and a crumbling one drops you mid-hide - the pot is drawn,
 * the prompt appears, and it does not save you. Nothing in the game reports
 * that; it just feels broken.
 *
 * And a fake laid on a real pot's index, which reads as one more decision and
 * is actually a deletion: `real: !fakes.includes(i)` means the fake replaces
 * the pot rather than joining it, which can leave a ledge two jumps from
 * anywhere safe.
 */

import { readFileSync } from "fs";

// levels.js imports one constant from the UI layer, and that module reads
// `window`. Rather than stub a DOM, the import is swapped for the value it
// resolves to - FLOOR_Y is WORLD_HEIGHT - 40, both plain constants.
const layout = readFileSync(
    new URL("../src/ui/layout.js", import.meta.url), "utf8"
);

const WORLD_HEIGHT = Number(/WORLD_HEIGHT = (\d+)/.exec(layout)[1]);
const FLOOR_Y = WORLD_HEIGHT - 40;

const source = readFileSync(
    new URL("../src/data/levels.js", import.meta.url), "utf8"
).replace(
    /^import \{[^}]*\} from "\.\.\/ui\/layout";$/m,
    `const FLOOR_Y = ${FLOOR_Y};`
);

const { default: Levels, TOP_LIMIT, Worlds, LEVELS_PER_WORLD } = await import(
    "data:text/javascript;base64," + Buffer.from(source).toString("base64")
);

// How long one of Yashoda's visits occupies the level, beyond the warning and
// the watch themselves: she walks off screen, and nothing may be scheduled
// until she has settled. Read from MotherWatch rather than copied, so tuning
// her walk cannot leave this checking against numbers that no longer apply.
const watchSource = readFileSync(
    new URL("../src/game/MotherWatch.js", import.meta.url), "utf8"
);

const WALK_TAIL_MS = Number(/WALK_TAIL_MS = (\d+)/.exec(watchSource)[1]);
const SETTLE_MS = Number(/SETTLE_MS = (\d+)/.exec(watchSource)[1]);

// Matches SMALL_WIDTH in levels.js. Read from the source for the same reason
// FLOOR_Y is: a copy here would quietly stop matching.
const SMALL_WIDTH = Number(/SMALL_WIDTH = (\d+)/.exec(source)[1]);

const problems = [];

for (const level of Levels) {

    const where = `level ${level.id}`;

    level.platforms.forEach((p, i) => {

        const covered = p.hide && p.hide.real;

        if (!covered) return;

        if (p.type !== "static") {
            problems.push(
                `${where}: rung ${i} carries real cover on a ${p.type} ledge - ` +
                `hiding there cannot work, he is moved or dropped mid-hide`
            );
        }

        if (p.width === SMALL_WIDTH) {
            problems.push(
                `${where}: rung ${i} carries real cover on a ${SMALL_WIDTH}px ` +
                `ledge, which leaves too little room to stand clear of the pot`
            );
        }

    });

    // Every rung must be able to reach cover without crossing a bare rung
    // twice. hidetest.mjs measures the same thing against the running game;
    // this is the cheap version of it.
    const real = level.platforms
        .map((p, i) => (p.hide && p.hide.real ? i : -1))
        .filter(i => i >= 0);

    if (!real.length) {
        problems.push(`${where}: no real cover anywhere`);
    } else {
        level.platforms.forEach((p, i) => {
            const nearest = Math.min(...real.map(r => Math.abs(r - i)));
            if (nearest > 1) {
                problems.push(
                    `${where}: rung ${i} is ${nearest} jumps from real cover`
                );
            }
        });
    }

    // The climb has to leave room above the last rung for the pot and rope
    const top = level.platforms[level.platforms.length - 1].y;

    if (top < TOP_LIMIT) {
        problems.push(
            `${where}: last rung at y=${top} is above the y=${TOP_LIMIT} ceiling`
        );
    }

    // A drop floating over a rung that does not exist is silently dropped by
    // the scene, so the level quietly loses the seconds it was balanced with.
    level.drops.forEach(d => {
        if (d < 0 || d >= level.platforms.length) {
            problems.push(
                `${where}: butter drop on rung ${d}, but there are only ` +
                `${level.platforms.length}`
            );
        }
    });

    // The timer has to leave room for three stars or the level can never be
    // fully cleared. 20s is the threshold in StarReward.js.
    if (level.timer < 20) {
        problems.push(`${where}: timer ${level.timer}s can never award 3 stars`);
    }

    // Jitter cannot be allowed to push one visit into the one before it.
    //
    // MotherWatch spreads visits evenly over the timer and then slides each
    // by up to `jitter` either way. Two that meet do not overlap - the second
    // is discarded, because warn() returns unless it is idle - so the level
    // quietly plays with one fewer visit, some of the time. That is
    // unreportable from inside the game and invisible from outside it.
    const { visits, warning, watch, jitter = 0 } = level.mother;

    if (jitter > 0 && visits > 1) {

        const slot = level.timer * 1000 / (visits + 1);
        const occupied = warning + watch + WALK_TAIL_MS + SETTLE_MS;
        const ceiling = Math.max(0, (slot - occupied) / 2);

        if (jitter > ceiling) {
            problems.push(
                `${where}: jitter ${jitter}ms over the ${Math.round(ceiling)}ms ` +
                `ceiling - ${visits} visits in ${level.timer}s leaves ` +
                `${Math.round(slot)}ms per slot and each visit takes ` +
                `${occupied}ms, so visits would collide and be dropped`
            );
        }

    }

}

//---------------------------------------------------------------
// Worlds
//---------------------------------------------------------------

// A world with fewer levels than the rest would leave a ragged grid, and one
// past the end of the table would show a world of locked buttons that can
// never open.
const expected = Worlds.length * LEVELS_PER_WORLD;

if (Levels.length !== expected) {
    problems.push(
        `${Levels.length} levels, but ${Worlds.length} worlds x ` +
        `${LEVELS_PER_WORLD} is ${expected}`
    );
}

Levels.forEach((level, i) => {
    if (level.id !== i + 1) {
        problems.push(
            `level at position ${i + 1} calls itself ${level.id} - ids have to ` +
            `run 1..n in order, because a world is a slice of this array`
        );
    }
});

console.log(`checked ${Levels.length} levels`);

const cover = Levels.map(l => {
    const real = l.platforms.filter(p => p.hide && p.hide.real).length;
    const fake = l.platforms.filter(p => p.hide && !p.hide.real).length;
    return `  ${String(l.id).padStart(2)}: ${l.platforms.length} rungs, ` +
           `${real} pots, ${fake} fake, ${l.drops.length} drops, ` +
           `${l.timer}s, ${l.mother.visits} visit(s)`;
});

console.log(cover.join("\n"));

if (problems.length) {
    console.error("\nFAIL");
    problems.forEach(p => console.error("  " + p));
    process.exit(1);
}

console.log("\nevery level obeys the table's own rules");
