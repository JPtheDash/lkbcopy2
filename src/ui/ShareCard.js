/**
 * Draws the picture a player shares when they finish a world.
 *
 * This is the only thing in the game that gets seen by people who do not have
 * the game, so it has to stand on its own: who did what, in which world, and
 * where to get it. A screenshot of the level-complete screen would say none
 * of those things to a stranger.
 *
 * Drawn on a plain 2D canvas rather than by screenshotting Phaser. The game
 * canvas is whatever shape the phone is - see canvasHeight() in layout.js -
 * so grabbing it would hand every player a differently proportioned card, and
 * it would carry the HUD and buttons along with it. A fixed square is also
 * what the places these get sent to actually want.
 */

// Square, and big enough to survive a messaging app's re-compression. 1080 is
// what Instagram and WhatsApp both work to; anything larger is thrown away by
// them and anything much smaller comes back soft.
const SIZE = 1080;

// The listing this app will live at. Built from the applicationId in
// android/app/build.gradle, which is what Play keys a listing on - so this
// URL is correct before the app is published and stays correct after, and
// there is no separate id to keep in step.
export const APP_ID = "com.dijytal.littlekrishnasbutterhunt";
export const STORE_URL =
    `https://play.google.com/store/apps/details?id=${APP_ID}`;

// Shown on the card instead of the full link, which is 73 characters and
// reads as a database key rather than as somewhere to go. The real URL goes
// in the share TEXT, where it is tappable - a link painted into a picture
// cannot be tapped by anyone.
const STORE_LABEL = "play.google.com";

export const MESSAGE_LIMIT = 70;

const GOLD = "#FFD54A";
const CREAM = "#FFF3C4";
const DARK = "#2A1403";


/** Cover-fit, the same rule the game's backgrounds use. */
function cover(ctx, image, w, h){

    const scale = Math.max(w / image.width, h / image.height);
    const dw = image.width * scale;
    const dh = image.height * scale;

    ctx.drawImage(image, (w - dw)/2, (h - dh)/2, dw, dh);

}


/** Fits to a height, keeping the picture's own proportions. */
function drawByHeight(ctx, image, cx, bottom, height){

    const w = image.width * (height / image.height);

    ctx.drawImage(image, cx - w/2, bottom - height, w, height);

    return w;

}


function roundedRect(ctx, x, y, w, h, r){

    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y,     x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x,     y + h, r);
    ctx.arcTo(x,     y + h, x,     y,     r);
    ctx.arcTo(x,     y,     x + w, y,     r);
    ctx.closePath();

}


/**
 * Breaks a message onto at most `maxLines` lines that each fit `maxWidth`.
 *
 * Word-wrapped, then character-wrapped for anything that is one long word -
 * a name pasted in without spaces would otherwise run off both edges of the
 * card rather than wrapping.
 */
function wrap(ctx, text, maxWidth, maxLines){

    const lines = [];
    let line = "";

    for(const word of text.split(/\s+/)){

        const candidate = line ? `${line} ${word}` : word;

        if(ctx.measureText(candidate).width <= maxWidth){

            line = candidate;

            continue;

        }

        if(line){ lines.push(line); }

        // A single word wider than the card, cut where it stops fitting
        let rest = word;

        while(ctx.measureText(rest).width > maxWidth && rest.length > 1){

            let cut = rest.length;

            while(cut > 1 && ctx.measureText(rest.slice(0, cut)).width > maxWidth){
                cut--;
            }

            lines.push(rest.slice(0, cut));
            rest = rest.slice(cut);

        }

        line = rest;

        if(lines.length >= maxLines){ break; }

    }

    if(line && lines.length < maxLines){ lines.push(line); }

    return lines.slice(0, maxLines);

}


function centredText(ctx, text, y, {
    size = 48, colour = CREAM, stroke = DARK, weight = "bold", thickness = 8
}){

    ctx.font = `${weight} ${size}px Arial, Helvetica, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    if(stroke){

        ctx.lineWidth = thickness;
        ctx.lineJoin = "round";
        ctx.strokeStyle = stroke;
        ctx.strokeText(text, SIZE/2, y);

    }

    ctx.fillStyle = colour;
    ctx.fillText(text, SIZE/2, y);

}


/**
 * Paints the card.
 *
 * @param images   { background, logo, krishna, feather } as loaded pictures
 * @param result   { worldName, message, feathers, maxFeathers }
 * @returns the canvas, for a caller to turn into a blob or a data URL
 */
export function drawShareCard(images, result){

    const canvas = document.createElement("canvas");

    canvas.width = SIZE;
    canvas.height = SIZE;

    const ctx = canvas.getContext("2d");

    //---------------------------------
    // Ground
    //---------------------------------

    ctx.fillStyle = DARK;
    ctx.fillRect(0, 0, SIZE, SIZE);

    if(images.background){

        cover(ctx, images.background, SIZE, SIZE);

    }

    // Warm scrim, heavier at the foot where the small print goes. Without it
    // the meadow in the background art is the same brightness as the cream
    // text laid over it.
    const veil = ctx.createLinearGradient(0, 0, 0, SIZE);
    veil.addColorStop(0,    "rgba(30, 14, 2, 0.55)");
    veil.addColorStop(0.55, "rgba(30, 14, 2, 0.40)");
    veil.addColorStop(1,    "rgba(30, 14, 2, 0.88)");

    ctx.fillStyle = veil;
    ctx.fillRect(0, 0, SIZE, SIZE);

    //---------------------------------
    // The game's own name
    //---------------------------------

    // The title art, not typed out. It is the thing a player will recognise
    // in a feed, and it already says the game's name in the game's own hand.
    //
    // Everything below is measured DOWN FROM ITS FOOT rather than placed at
    // chosen heights. logo.png is 645x401 - two thirds as tall as it is wide,
    // not the strip its name suggests - so at the 62% width this started at
    // it reached y=450, and the world's name was printed straight across the
    // middle of it.
    const TOP_MARGIN = 26;

    let logoBottom = TOP_MARGIN + 70;

    if(images.logo){

        const logoWidth = SIZE * 0.46;
        const logoHeight = images.logo.height * (logoWidth / images.logo.width);

        ctx.drawImage(
            images.logo, (SIZE - logoWidth)/2, TOP_MARGIN, logoWidth, logoHeight
        );

        logoBottom = TOP_MARGIN + logoHeight;

    }
    else{

        centredText(ctx, "Little Krishna's Butter Hunt", TOP_MARGIN + 40, {
            size: 52
        });

    }

    //---------------------------------
    // What was done
    //---------------------------------

    centredText(ctx, `${result.worldName} COMPLETE`, logoBottom + 48, {
        size: 62, colour: GOLD, thickness: 10
    });

    centredText(ctx, `All ${result.levels} levels cleared`, logoBottom + 98, {
        size: 34, colour: CREAM, thickness: 6
    });

    //---------------------------------
    // Krishna with the butter
    //---------------------------------

    const KRISHNA_BOTTOM = 742;

    if(images.krishna){

        // Whatever room is left between the captions and the score. Floored,
        // so a taller logo shrinks him rather than turning him upside down.
        const height = Math.max(170, KRISHNA_BOTTOM - (logoBottom + 128));

        drawByHeight(ctx, images.krishna, SIZE/2, KRISHNA_BOTTOM, height);

    }

    //---------------------------------
    // Feathers earned
    //---------------------------------

    const scoreY = 796;
    const scoreText = `${result.feathers} / ${result.maxFeathers}`;

    ctx.font = "bold 44px Arial, Helvetica, sans-serif";

    const featherWidth = images.feather
        ? images.feather.width * (52 / images.feather.height)
        : 0;

    const scoreWidth = ctx.measureText(scoreText).width;
    const unit = featherWidth + 14 + scoreWidth;

    ctx.fillStyle = "rgba(20, 9, 1, 0.55)";
    roundedRect(ctx, SIZE/2 - unit/2 - 30, scoreY - 42, unit + 60, 84, 42);
    ctx.fill();

    if(images.feather){

        drawByHeight(
            ctx, images.feather,
            SIZE/2 - unit/2 + featherWidth/2, scoreY + 26, 52
        );

    }

    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 7;
    ctx.lineJoin = "round";
    ctx.strokeStyle = DARK;
    ctx.strokeText(scoreText, SIZE/2 - unit/2 + featherWidth + 14, scoreY);
    ctx.fillStyle = CREAM;
    ctx.fillText(scoreText, SIZE/2 - unit/2 + featherWidth + 14, scoreY);

    //---------------------------------
    // What the player wanted to say
    //---------------------------------

    const message = (result.message || "").trim();

    if(message){

        ctx.font = "bold 40px Arial, Helvetica, sans-serif";

        const lines = wrap(ctx, message, SIZE - 190, 2);

        // Sized to the lines actually used, so a short name does not sit in
        // a box built for two lines of text.
        const boxTop = 840;
        const boxHeight = 26 + lines.length * 50;

        ctx.fillStyle = "rgba(20, 9, 1, 0.5)";
        roundedRect(ctx, 70, boxTop, SIZE - 140, boxHeight, 22);
        ctx.fill();

        lines.forEach((line, i) => {

            centredText(ctx, line, boxTop + 40 + i * 50, {
                size: 40, colour: "#FFFFFF", thickness: 6
            });

        });

    }

    //---------------------------------
    // Where to get it
    //---------------------------------

    // Last, and lowest. It is the reason the card exists but not the reason
    // anyone looks at it, and a card that leads with an advert gets sent by
    // nobody.
    centredText(ctx, "PLAY FREE ON GOOGLE PLAY", SIZE - 70, {
        size: 38, colour: GOLD, thickness: 8
    });

    centredText(ctx, STORE_LABEL, SIZE - 32, {
        size: 26, colour: "#E4D5B4", thickness: 5
    });

    return canvas;

}


/**
 * Collects the pictures the card needs out of a scene's texture manager.
 *
 * Anything missing comes back undefined and the card draws without it, so a
 * scene that has not loaded the logo still produces a shareable picture
 * rather than throwing on the one screen a player reached by winning.
 */
export function cardImages(scene){

    const pick = key => (
        scene.textures.exists(key)
            ? scene.textures.get(key).getSourceImage()
            : undefined
    );

    return {
        background: pick("homeBackground") || pick("background") || pick("homeBg"),
        logo: pick("logo"),
        krishna: pick("happyKrishna"),
        feather: pick("feather")
    };

}
