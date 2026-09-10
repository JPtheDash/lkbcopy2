/**
 * The picture shared from the Ganesh Utsav event, mirroring the campaign's
 * ShareCard but built around the Ganesha idol instead of Krishna.
 *
 * A fixed 1080 square (what WhatsApp/Instagram work to), drawn on a plain 2D
 * canvas so it is the same shape on every phone and carries none of the HUD.
 */

import { STORE_URL } from "./ShareCard";

const SIZE = 1080;
const GOLD = "#FFD54A";
const CREAM = "#FFF3C4";
const DARK = "#2A1403";
const STORE_LABEL = "play.google.com";

export { STORE_URL };

function cover(ctx, image, w, h){
    const scale = Math.max(w / image.width, h / image.height);
    const dw = image.width * scale;
    const dh = image.height * scale;
    ctx.drawImage(image, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

function drawByHeight(ctx, image, cx, bottom, height){
    const w = image.width * (height / image.height);
    ctx.drawImage(image, cx - w / 2, bottom - height, w, height);
}

function centred(ctx, text, y, { size, colour = CREAM, thickness = 8 }){
    ctx.font = `bold ${size}px Arial, Helvetica, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = thickness;
    ctx.lineJoin = "round";
    ctx.strokeStyle = DARK;
    ctx.strokeText(text, SIZE / 2, y);
    ctx.fillStyle = colour;
    ctx.fillText(text, SIZE / 2, y);
}

/**
 * Paints the event card. Images are looked up from the scene's textures; any
 * that are missing are simply skipped so a card is always produced.
 */
export function drawGaneshShareCard(scene){

    const pick = key => (
        scene.textures.exists(key)
            ? scene.textures.get(key).getSourceImage()
            : undefined
    );

    const bg = pick("ganeshBg");
    const logo = pick("logo");
    const idol = pick("ganeshaIdol");

    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = DARK;
    ctx.fillRect(0, 0, SIZE, SIZE);
    if(bg){ cover(ctx, bg, SIZE, SIZE); }

    // Warm veil, heavier at the foot for the small print
    const veil = ctx.createLinearGradient(0, 0, 0, SIZE);
    veil.addColorStop(0, "rgba(30, 14, 2, 0.45)");
    veil.addColorStop(0.55, "rgba(30, 14, 2, 0.32)");
    veil.addColorStop(1, "rgba(30, 14, 2, 0.9)");
    ctx.fillStyle = veil;
    ctx.fillRect(0, 0, SIZE, SIZE);

    const TOP = 26;
    let logoBottom = TOP + 60;
    if(logo){
        const lw = SIZE * 0.44;
        const lh = logo.height * (lw / logo.width);
        ctx.drawImage(logo, (SIZE - lw) / 2, TOP, lw, lh);
        logoBottom = TOP + lh;
    }

    centred(ctx, "Happy Ganesh Chaturthi!", logoBottom + 54, {
        size: 60, colour: GOLD, thickness: 10
    });

    // The idol, glowing, as the centrepiece
    const idolBottom = 812;
    if(idol){
        const cx = SIZE / 2;
        const g = ctx.createRadialGradient(cx, idolBottom - 230, 40, cx, idolBottom - 230, 360);
        g.addColorStop(0, "rgba(255, 210, 120, 0.55)");
        g.addColorStop(1, "rgba(255, 210, 120, 0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, logoBottom + 80, SIZE, 620);

        const height = Math.max(360, idolBottom - (logoBottom + 120));
        drawByHeight(ctx, idol, cx, idolBottom, height);
    }

    centred(ctx, "I offered a modak to Lord Ganesha!", 872, {
        size: 36, colour: CREAM, thickness: 6
    });

    centred(ctx, "PLAY FREE ON GOOGLE PLAY", SIZE - 68, {
        size: 38, colour: GOLD, thickness: 8
    });
    centred(ctx, STORE_LABEL, SIZE - 30, {
        size: 26, colour: "#E4D5B4", thickness: 5
    });

    return canvas;
}
