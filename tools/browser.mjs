/**
 * Shared browser setup for the tools in this folder.
 *
 * Two things these flags buy us, both learned by hitting them:
 *
 *  - Memory. A Codespace shares ~8GB with the VS Code server and its language
 *    extensions, which routinely leaves under 1GB. A default Chromium launch
 *    gets OOM-killed mid-navigation and surfaces as a bare "Page crashed"
 *    that looks exactly like a game bug.
 *  - Frame rate. Headless WebGL falls back to software rendering at ~9fps.
 *    Phaser clamps its physics delta, so the game runs in slow motion and any
 *    wall-clock measurement is wrong. ?renderer=canvas gives ~83fps.
 */

import { chromium } from "playwright";

export const GAME_URL =
    process.env.GAME_URL || "http://localhost:5173/?renderer=canvas";

const LEAN_ARGS = [
    "--disable-dev-shm-usage",
    "--no-zygote",
    "--single-process",
    "--disable-gpu",
    "--renderer-process-limit=1",
    "--js-flags=--max-old-space-size=256",
    "--disable-extensions",
    "--disable-background-networking",
    "--disable-frame-rate-limit",
    "--disable-gpu-vsync",
    "--mute-audio"
];

export async function launch() {
    return chromium.launch({ args: LEAN_ARGS });
}

export async function newPage(browser, errors = []) {

    const page = await browser.newPage({ viewport: { width: 360, height: 640 } });

    page.on("pageerror", e => errors.push(String(e)));
    page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
    page.on("crash", () => errors.push("PAGE CRASHED (usually out of memory)"));

    return page;
}
