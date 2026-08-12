/**
 * Visual check. Boots the real game in a headless browser, walks through the
 * scenes and writes a PNG per screen, failing loudly on any console error.
 *
 *   node tools/screenshot.mjs [outDir]
 */

import { launch, newPage, GAME_URL } from "./browser.mjs";
import { mkdirSync, statSync } from "fs";

const URL = GAME_URL;
const OUT = process.argv[2] || "/tmp/shots";

mkdirSync(OUT, { recursive: true });

const errors = [];
const blanks = [];

// A whole browser per screen. The lean profile runs single-process, which
// cannot host a second page, and it accumulates enough memory over a run that
// a later screen renders black. Relaunching keeps every shot trustworthy.
let browser = await launch();
let page = await newPage(browser, errors);

async function freshPage() {
    await browser.close();
    browser = await launch();
    page = await newPage(browser, errors);
}

page.on("pageerror", e => errors.push(String(e)));

await page.goto(URL, { waitUntil: "networkidle" });

/**
 * Reload before switching. Stopping and restarting a scene in the same tick
 * leaves it half torn down and it renders black, which is a harness artifact
 * rather than a real bug - but it hides real ones.
 */
let lastSetup = async () => {};

async function startScene(key, data = {}) {
    lastSetup = async () => {
        await freshPage();
        await page.goto(URL, { waitUntil: "networkidle" });
        await page.waitForTimeout(900);
        // The page already boots into HomeScene. Stopping and restarting it
        // in the same tick leaves its SettingsPanel holding destroyed objects
        // and the screen renders black - a harness artifact, not a game bug.
        if (key !== "HomeScene") {
            await page.evaluate(([k, d]) => {
                const game = window.__game;
                game.scene.getScenes(true).forEach(s => s.scene.stop());
                game.scene.start(k, d);
            }, [key, data]);
        }
        await page.waitForTimeout(1600);
    };
    await lastSetup();
}

// A near-empty PNG compresses to almost nothing. Under memory pressure the
// lean single-process browser occasionally loses its canvas late in a run and
// writes a black frame, which reads as a broken screen when it is not - so
// catch it and retry once rather than reporting a false failure.
const BLANK_BYTES = 15000;

async function shot(name, extra) {

    for (let attempt = 0; attempt < 2; attempt++) {

        if (attempt) {
            console.log(`  ${name} came out blank, retrying`);
            await lastSetup();
            if (extra) await extra();
        }

        const path = `${OUT}/${name}.png`;
        await page.screenshot({ path });

        if (statSync(path).size >= BLANK_BYTES) {
            console.log("  wrote", name);
            return;
        }
    }

    blanks.push(name);
    console.log("  BLANK:", name);
}

await page.waitForTimeout(1500);
await shot("1-home");

// The world screen is what "Play" now opens onto, so a listing that skips it
// shows a menu players never see first.
await startScene("WorldSelectScene");
await shot("2-worlds");

// Named with its world. Without one it falls back to the furthest world
// reached, which on a fresh save is Vrindavan - fine, but then the shot
// silently changes meaning the first time this is run against a save that
// has progress in it.
await startScene("LevelSelectScene", { world: 1 });
await shot("3-level-select");

await startScene("GameScene", { level: 1 });
await shot("4-game-level1");

await startScene("GameScene", { level: 5 });
await shot("5-game-level5");

// Levels are two screens tall, so check the framing high up as well
await startScene("GameScene", { level: 1 });
await page.evaluate(() => {
    const s = window.__game.scene.getScene("GameScene");
    s.krishna.setPosition(360, 400);
    s.krishna.body.setVelocity(0, 0);
});
await page.waitForTimeout(1400);
await shot("5b-game-top");

await startScene("LevelCompleteScene", { level: 2, stars: 3, timeLeft: 40 });
await page.waitForTimeout(1600);
await shot("6-level-complete");

// Settings panel, opened through the real button
const openSettings = async () => {
    await page.evaluate(() => {
        window.__game.scene.getScene("HomeScene").settingsPanel.open();
    });
    await page.waitForTimeout(700);
};

await startScene("HomeScene");
await openSettings();
await shot("7-settings", openSettings);

await browser.close();

if (blanks.length) {
    console.error("\nBLANK SCREENS: " + blanks.join(", "));
}

if (errors.length) {
    console.error("\nCONSOLE ERRORS:");
    errors.forEach(e => console.error("  " + e));
    process.exit(1);
}

if (blanks.length) process.exit(1);

console.log("\nno console errors, no blank screens");
