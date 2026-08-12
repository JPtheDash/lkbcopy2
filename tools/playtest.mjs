/**
 * Plays each level from the floor to the butter using real swipes, and fails
 * if any level cannot actually be completed.
 *
 * The probe checks a single jump's envelope; this checks the whole climb,
 * which is where level design mistakes actually bite.
 *
 *   node tools/playtest.mjs
 */

import { launch, newPage, GAME_URL } from "./browser.mjs";
import { mkdirSync } from "fs";

const URL = GAME_URL;
const OUT = process.argv[2] || "/tmp/playtest";

mkdirSync(OUT, { recursive: true });

const errors = [];

// A whole browser per level. The lean profile runs single-process and
// accumulates enough memory over a five-level run that a later page boots
// without ever reaching window.__game, which reads as a broken game rather
// than the harness running out of room.
let browser = await launch();
let page = await newPage(browser, errors);

async function freshPage() {
    await browser.close();
    browser = await launch();
    page = await newPage(browser, errors);
}

/** The game object appears a tick after load, so nothing may touch it first. */
async function bootGame() {
    await page.goto(URL, { waitUntil: "networkidle" });
    await page.waitForFunction("window.__game && window.__game.scene", null,
                               { timeout: 20000 });
    await page.waitForTimeout(600);
}

const state = () => page.evaluate(() => {
    const g = window.__game;

    // The page can lose the game entirely - a renderer that runs out of
    // memory takes window.__game with it. Reporting that as a level that
    // could not be finished beats a stack trace out of the harness, which
    // looks like the game is broken rather than the machine it ran on.
    if (!g) {
        return { gone: true, complete: false, crashed: true };
    }

    const s = g.scene.getScene("GameScene");

    if (!s || !s.scene.isActive() || !s.krishna || !s.krishna.body) {
        return { gone: true, complete: g.scene.isActive("LevelCompleteScene") };
    }

    return {
        x: Math.round(s.krishna.x),
        y: Math.round(s.krishna.y),
        feet: Math.round(s.krishna.body.bottom),
        grounded: s.krishna.body.blocked.down || s.krishna.body.touching.down,
        timeLeft: s.timeLeft,
        over: s.isGameOver
    };
});

const GROUNDED = `(() => {
    const s = window.__game.scene.getScene("GameScene");
    if (!s || !s.scene.isActive() || !s.krishna || !s.krishna.body) return null;
    return s.krishna.body.blocked.down || s.krishna.body.touching.down;
})()`;

/**
 * Swipe, wait for Krishna to actually leave the ground, then wait until he is
 * standing again.
 *
 * Waiting only for "grounded" is wrong: he is still touching the floor on the
 * frame the jump is issued, so the wait returns instantly and the next swipe
 * fires mid-air, where it is silently rejected. That cascades into a bot that
 * never climbs and looks exactly like a broken game.
 */
async function swipeAndSettle(dx, dy) {

    await page.evaluate(([x, y]) => {
        const s = window.__game.scene.getScene("GameScene");
        if (s && s.krishna && s.krishna.body) s.handleSwipe(x, y);
    }, [dx, dy]);

    let launched = true;

    try {
        await page.waitForFunction(`${GROUNDED} !== true`, null, { timeout: 1200 });
    } catch {
        launched = false;   // jump was refused - he never left the floor
    }

    try {
        await page.waitForFunction(`${GROUNDED} !== false`, null, { timeout: 6000 });
    } catch {
        /* hung in the air - caller reports it */
    }

    await page.waitForTimeout(150);

    return launched;
}

let failed = 0;

// Levels the harness could not walk at all, kept apart from levels it walked
// and could not finish. Only the second kind is a level design problem.
let crashed = 0;

// Walks whatever the level table holds rather than a hard-coded 5, so adding
// a level cannot quietly go untested. The table is only attached once a
// GameScene has run, so one has to be started before it can be counted.
await bootGame();

await page.evaluate(() => {
    const g = window.__game;
    g.scene.getScenes(true).forEach(s => s.scene.stop());
    g.scene.start("GameScene", { level: 1, noMother: true });
});

await page.waitForFunction(
    () => window.__game.scene.getScene("GameScene").__allLevels,
    null,
    { timeout: 15000 }
);

const LEVEL_COUNT = await page.evaluate(
    () => window.__game.scene.getScene("GameScene").__allLevels.length
);

// LEVELS=16 or LEVELS=16-18 walks part of the table.
//
// A full run takes about ten minutes and boots thirty browsers, and this
// machine is short enough of memory that one of them occasionally dies
// mid-level - which is not a result, and which used to mean re-walking all
// thirty to re-test the one that was lost.
const [FIRST, LAST] = (() => {

    const pick = process.env.LEVELS;

    if (!pick) return [1, LEVEL_COUNT];

    const [a, b = a] = pick.split("-").map(Number);

    return [Math.max(1, a), Math.min(LEVEL_COUNT, b)];

})();

console.log(
    FIRST === 1 && LAST === LEVEL_COUNT
        ? `walking ${LEVEL_COUNT} levels\n`
        : `walking levels ${FIRST}-${LAST} of ${LEVEL_COUNT}\n`
);

for (let level = FIRST; level <= LAST; level++) {

    if (level > FIRST) await freshPage();

    await bootGame();

    await page.evaluate(l => {
        const g = window.__game;
        g.scene.getScenes(true).forEach(s => s.scene.stop());
        g.scene.start("GameScene", { level: l, noMother: true });
    }, level);

    await page.waitForTimeout(1000);

    // Give the timer plenty of room - we are testing reachability, not speed
    await page.evaluate(() => {
        const s = window.__game.scene.getScene("GameScene");
        s.timeLeft = 9999;
    });

    const targets = await page.evaluate(() => {
        const s = window.__game.scene.getScene("GameScene");
        // Level data holds {x, y, type}; flatten to pairs for the climb loop.
        //
        // The pot is aimed at where the pot is, not at s.butter's own origin -
        // that origin is the top of the rope it hangs from, a long way above
        // the pot and off to one side of it as it swings.
        const pot = s.potPoint();

        return s.__levelPlatforms
            .map(p => [p.x, p.y])
            .sort((a, b) => b[1] - a[1])
            .concat([[pot.x, pot.y]]);
    });

    // Climb adaptively: always aim at the nearest platform above, rather than
    // walking a fixed list. Krishna does not always land where the list
    // expects, and a fixed list silently desynchronises from where he is.
    const startY = (await state()).y;
    const startedAt = Date.now();

    let best = startY;
    let stalls = 0;
    let steps = 0;
    let complete = false;

    for (let move = 0; move < 40 && !complete; move++) {

        const cur = await state();

        // state() has already worked this out, and safely: asking the page
        // again here read window.__game without a guard, and the one case
        // that gets you here is the case where the game object is gone. A
        // renderer that runs out of memory therefore did not report a lost
        // level, it threw out of the harness and abandoned the whole run.
        if (cur.gone) {
            complete = cur.complete;
            break;
        }

        // Nearest thing above him: a platform, or the butter at the very top.
        //
        // Measured from his feet, not from his origin. The origin is the
        // centre of the sprite frame, so its distance to the ground depends
        // on how tall the character art is - tuning a margin against it means
        // the bot silently starts skipping platforms the next time the
        // character is resized, which looks exactly like a broken level.
        const above = targets
            .filter(([, py]) => py < cur.feet - 40)
            .sort((a, b) => b[1] - a[1])[0];

        const [tx] = above || targets[targets.length - 1];

        const dx = tx - cur.x;

        await swipeAndSettle(
            Math.abs(dx) < 70 ? 0 : (dx > 0 ? 80 : -80),
            -80
        );

        const now = await state();
        if (now.gone) {
            complete = now.complete;
            break;
        }

        if (now.y < best - 60) {
            best = now.y;
            steps++;
            stalls = 0;
        } else {
            stalls++;
        }

        // Genuinely wedged rather than just fumbling one jump
        if (stalls >= 8) break;
    }

    const end = await state();
    const climbed = end.gone ? startY - best : startY - end.y;

    if (complete) {
        // How long the climb itself takes, so timers can be set from measured
        // completion time rather than guessed. The bot pauses to settle after
        // every jump, so this reads as a slow player rather than a fast one.
        const took = (Date.now() - startedAt) / 1000;

        console.log(
            `level ${level}: COMPLETED  (${steps} platforms, ` +
            `climbed ${climbed}px, ${took.toFixed(1)}s)`
        );
    } else if (end.crashed) {
        // The page lost the game object entirely, which is the machine
        // running out of memory rather than anything about this level.
        // Counted separately so a tired Codespace cannot be read as a design
        // fault - the level was never actually walked.
        crashed++;
        console.log(
            `level ${level}: SKIPPED - the page crashed (out of memory), ` +
            `nothing measured`
        );
    } else {
        failed++;
        if (!end.gone) await page.screenshot({ path: `${OUT}/stuck-level${level}.png` });
        console.log(
            `level ${level}: FAILED - climbed ${climbed}px over ${steps} platforms` +
            (end.gone ? "" : `, stalled at y=${end.y}  -> ${OUT}/stuck-level${level}.png`)
        );
    }
}

await browser.close();

if (errors.length) {
    console.error("\nCONSOLE ERRORS:");
    [...new Set(errors)].forEach(e => console.error("  " + e));
}

if (crashed) {
    console.error(
        `\n${crashed} level(s) never walked - the page ran out of memory. ` +
        `Close what else is running and try again; this is not a result.`
    );
}

if (failed || crashed || errors.length) {
    console.error(`\n${failed} level(s) not completable`);
    process.exit(1);
}

console.log("\nall levels completable");
