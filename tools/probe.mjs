/**
 * Measures what a jump actually does, so level layouts are validated against
 * the real engine instead of arithmetic on paper.
 *
 * Two things this has to get right, both learned the hard way:
 *   - Sample on the scene's update event. Polling with setTimeout inside
 *     page.evaluate races Phaser's rAF loop and swings by 200px per run.
 *   - Fire the swipe from inside a grounded frame. A jump issued while
 *     Krishna is still falling is silently rejected and reads as "0px rise".
 *
 *   node tools/probe.mjs
 */

import { launch, newPage, GAME_URL } from "./browser.mjs";

const URL = GAME_URL;

const errors = [];

const browser = await launch();
const page = await newPage(browser, errors);

/** Fresh page per measurement - restarting a scene in place is racy. */
async function measure(level, dx, dy, clearPlatforms = false, alignUnderPlatform = false) {

    await page.goto(URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(900);

    await page.evaluate(l => {
        const g = window.__game;
        g.scene.getScenes(true).forEach(s => s.scene.stop());
        g.scene.start("GameScene", { level: l });
    }, level);

    await page.waitForTimeout(1000);

    if(clearPlatforms){

        // Otherwise the arc ends on whatever platform happens to sit above
        // the spawn, and we measure that gap rather than the jump's range.
        await page.evaluate(() => {
            const s = window.__game.scene.getScene("GameScene");
            s.platformBodies.children.each(c => { c.body.enable = false; });
        });

    }

    if(alignUnderPlatform){

        // Stand him under the lowest platform, otherwise a straight-up jump
        // has nothing to land on and the test measures the wrong thing.
        await page.evaluate(() => {
            const s = window.__game.scene.getScene("GameScene");
            const lowest = [...s.__levelPlatforms].sort((a, b) => b.y - a.y)[0];
            s.krishna.setX(lowest.x);
            s.krishna.body.setVelocity(0, 0);
        });

        await page.waitForTimeout(700);

    }

    await page.evaluate(([x, y]) => {

        const s = window.__game.scene.getScene("GameScene");
        const k = s.krishna;

        const probe = { fired: false, startX: 0, startY: 0, minY: 0, maxX: 0, minX: 0 };

        probe.handler = () => {

            const grounded = k.body.blocked.down || k.body.touching.down;

            if(!probe.fired){

                // Only launch on a frame where the jump will be accepted
                if(!grounded) return;

                probe.startX = probe.maxX = probe.minX = k.x;
                probe.startY = probe.minY = k.y;
                probe.fired = true;

                s.handleSwipe(x, y);

                return;

            }

            probe.minY = Math.min(probe.minY, k.y);
            probe.maxX = Math.max(probe.maxX, k.x);
            probe.minX = Math.min(probe.minX, k.x);
            probe.endY = k.y;
            probe.grounded = grounded;
            probe.frames = (probe.frames || 0) + 1;

            // Arc is over once he is back on something. Waiting for this
            // instead of a fixed timeout keeps the numbers frame-rate
            // independent.
            if(grounded && probe.frames > 3) probe.done = true;

        };

        s.events.on("update", probe.handler);
        window.__probe = probe;

    }, [dx, dy]);

    await page.waitForFunction(
        () => window.__probe && (window.__probe.done || window.__probe.frames > 400),
        null,
        { timeout: 30000 }
    );

    return page.evaluate(() => {
        const s = window.__game.scene.getScene("GameScene");
        const p = window.__probe;
        s.events.off("update", p.handler);
        return {
            fired: p.fired,
            rise: Math.round(p.startY - p.minY),
            reach: Math.round(Math.max(p.maxX - p.startX, p.startX - p.minX)),
            settledHigher: Math.round(p.startY - p.endY),
            grounded: p.grounded
        };
    });
}

const straight = await measure(1, 0, -80, false, true);
console.log("straight-up  rise", straight.rise, "px, ended", straight.settledHigher,
            "px higher, grounded:", straight.grounded);

const diag = await measure(1, 80, -80, true);
console.log("diagonal     rise", diag.rise, "px, free-air reach", diag.reach, "px");

const demand = await page.evaluate(() => {
    const levels = window.__game.scene.getScene("GameScene").__allLevels;
    return levels.map(l => {
        let maxDy = 0, maxDx = 0;
        const pts = [[l.spawn[0], 2470], ...l.platforms.map(p => [p.x, p.y]), l.butter];
        for (let i = 1; i < pts.length; i++) {
            maxDy = Math.max(maxDy, pts[i - 1][1] - pts[i][1]);
            maxDx = Math.max(maxDx, Math.abs(pts[i][0] - pts[i - 1][0]));
        }
        return { id: l.id, maxDy, maxDx };
    });
});

console.log("\nlevel demands vs the diagonal envelope:");

let bad = 0;

demand.forEach(d => {
    const okRise = d.maxDy <= diag.rise;
    const okReach = d.maxDx <= diag.reach;
    if (!okRise || !okReach) bad++;
    console.log(
        `  level ${d.id}: rise ${d.maxDy} ${okRise ? "ok" : "TOO HIGH"}, ` +
        `reach ${d.maxDx} ${okReach ? "ok" : "TOO FAR"}`
    );
});

await browser.close();

const problems = [];

if (!straight.fired || straight.settledHigher < 80) {
    problems.push("straight-up jump does not get Krishna onto the platform above");
}

if (bad) problems.push(`${bad} level(s) demand more than a jump delivers`);

if (problems.length) {
    console.error("\nFAIL");
    problems.forEach(p => console.error("  " + p));
    process.exit(1);
}

if (errors.length) {
    console.error("\nCONSOLE ERRORS:");
    [...new Set(errors)].forEach(e => console.error("  " + e));
    process.exit(1);
}

console.log("\nall levels within jump envelope");
