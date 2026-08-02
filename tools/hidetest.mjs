/**
 * Checks the survival mechanic: that hiding saves you and being seen does not.
 *
 * tools/playtest.mjs turns Yashoda off, because it measures whether a climb is
 * physically possible and a bot with no instinct for hiding would report
 * perfectly good levels as broken. So nothing there covers the mechanic at
 * all - this does.
 *
 *   node tools/hidetest.mjs
 */

import { launch, newPage, GAME_URL } from "./browser.mjs";

const URL = GAME_URL;

let browser = await launch();
let page = await newPage(browser, []);

const failures = [];

async function boot(level) {
    await page.goto(URL, { waitUntil: "networkidle" });
    await page.waitForFunction("window.__game && window.__game.scene", null,
                               { timeout: 20000 });
    await page.waitForTimeout(500);

    await page.evaluate(l => {
        const g = window.__game;
        g.scene.getScenes(true).forEach(s => s.scene.stop());
        g.scene.start("GameScene", { level: l });
    }, level);

    await page.waitForFunction(
        () => {
            const s = window.__game.scene.getScene("GameScene");
            return s && s.platforms && s.mother;
        },
        null,
        { timeout: 15000 }
    );

    await page.waitForTimeout(600);
}

/**
 * Stand Krishna somewhere, let Yashoda walk in, and report whether he was
 * caught. `where` picks the spot: a real pot, a fake one, or open ground.
 */
async function trial(level, where) {

    await boot(level);

    const placed = await page.evaluate(w => {

        const s = window.__game.scene.getScene("GameScene");

        const want = p => p.hide && (w === "fake" ? !p.hide.real : p.hide.real);

        // Somewhere he can actually stand still: a plain ledge, so a
        // crumbling or sliding one cannot move him out of frame mid-test
        const target = s.platforms.find(p => want(p) && p.type === "static");

        if (!target) return null;

        const top = target.body.body.top;
        const x = w === "open"
            ? target.plank.x + 130      // on the ledge, well clear of the pot
            : target.hide.pot.x;

        // Well clear of the ledge, then let him fall onto it. setPosition
        // moves the sprite centre and his collision pad sits ~112px below
        // that, so dropping him just above the plank actually starts him
        // underneath it - and platforms are one-way, so he falls to the floor
        // and the trial silently measures the wrong place.
        s.krishna.setPosition(x, top - 220);
        s.krishna.body.setVelocity(0, 0);

        return { x: Math.round(x), platform: target.index, top: Math.round(top) };
    }, where);

    if (!placed) {
        failures.push(`level ${level}: no ${where} spot on a static ledge`);
        return;
    }

    // Let him settle onto the ledge before she looks in
    await page.waitForTimeout(1400);

    const landed = await page.evaluate(t => {
        const s = window.__game.scene.getScene("GameScene");
        return Math.abs(s.krishna.body.bottom - t) < 8;
    }, placed.top);

    if (!landed) {
        failures.push(`level ${level}, ${where}: never settled on the target ledge`);
        console.log(`  level ${level} ${where}: SETUP FAILED - not on the ledge`);
        return;
    }

    const hidden = await page.evaluate(
        () => window.__game.scene.getScene("GameScene").isHidden()
    );

    await page.evaluate(() => {
        window.__game.scene.getScene("GameScene").mother.arrive();
    });

    await page.waitForTimeout(700);

    const caught = await page.evaluate(
        () => window.__game.scene.getScene("GameScene").isGameOver
    );

    const shouldBeCaught = where !== "real";
    const ok = caught === shouldBeCaught;

    console.log(
        `  level ${level} ${where.padEnd(4)} -> isHidden ${String(hidden).padEnd(5)} ` +
        `caught ${String(caught).padEnd(5)} ${ok ? "ok" : "WRONG"}`
    );

    if (!ok) {
        failures.push(
            `level ${level}, ${where} spot: expected caught=${shouldBeCaught}, got ${caught}`
        );
    }
}

console.log("hiding behind a real pot should save you:");
await trial(1, "real");
await trial(4, "real");

console.log("\nstanding in the open should not:");
await trial(1, "open");
await trial(4, "open");

console.log("\na fake pot should not either:");
await trial(6, "fake");
await trial(8, "fake");

// A level that introduces fakes has to leave a real pot within one jump, or
// a warning can arrive with nowhere to go.
console.log("\nno two fake pots in a row:");

const runs = await page.evaluate(() => {
    const levels = window.__game.scene.getScene("GameScene").__allLevels;
    return levels.map(l => {
        let worst = 0, run = 0;
        l.platforms.forEach(p => {
            run = p.hide && !p.hide.real ? run + 1 : 0;
            worst = Math.max(worst, run);
        });
        return { id: l.id, worst };
    });
});

runs.forEach(r => {
    const ok = r.worst < 2;
    console.log(`  level ${r.id}: longest run of fakes ${r.worst} ${ok ? "ok" : "TOO MANY"}`);
    if (!ok) failures.push(`level ${r.id} has ${r.worst} fake pots in a row`);
});

await browser.close();

if (failures.length) {
    console.error("\nFAIL");
    failures.forEach(f => console.error("  " + f));
    process.exit(1);
}

console.log("\nhiding works, being seen ends the level");
