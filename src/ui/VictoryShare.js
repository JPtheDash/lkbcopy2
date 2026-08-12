/**
 * What a player sees when they finish a world: the card they earned, a way to
 * write on it, and a way to send it.
 *
 * The card is previewed rather than sent blind. It is the only thing the game
 * ever puts in front of people who do not have the game, and a player is
 * being asked to put their name on it - so they get to see exactly what goes
 * out before it does.
 *
 * Built the way ConfirmDialog is: plain objects in an array, every one pinned
 * with setScrollFactor(0), and no Container. Phaser hit-tests a container's
 * children against the camera's scroll, so buttons inside one stop responding
 * the moment a scene has scrolled away from its origin - which the level
 * list, one of the two places this opens from, does.
 */

import AudioManager from "../managers/AudioManager";
import { GAME_WIDTH, GAME_HEIGHT } from "./layout";
import { drawShareCard, cardImages, MESSAGE_LIMIT } from "./ShareCard";
import shareVictory from "./shareVictory";
import textPrompt from "./textPrompt";

const DEPTH = 950;

// Each redraw gets its own texture key. Phaser will not overwrite a live
// texture, and swapping the key is a great deal simpler than reaching into
// the canvas behind one and refreshing it in place.
let serial = 0;


export default function openVictoryShare(scene, result){

    // One at a time, and not a second one behind the first
    if(scene.__victoryOpen){ return; }

    scene.__victoryOpen = true;

    const cx = GAME_WIDTH/2;
    const parts = [];
    let cardKey = null;
    let preview = null;
    let message = "";

    const keep = item => {

        item.setScrollFactor(0).setDepth(DEPTH);
        parts.push(item);

        return item;

    };

    //---------------------------------
    // Ground
    //---------------------------------

    keep(
        scene.add
            .rectangle(cx, GAME_HEIGHT/2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.78)
            .setInteractive()
    );

    keep(scene.add.text(cx, 130, `${result.worldName} COMPLETE`, {
        fontFamily: "Arial",
        fontSize: "52px",
        fontStyle: "bold",
        color: "#FFD54A",
        stroke: "#2A1403",
        strokeThickness: 8
    }).setOrigin(0.5));

    keep(scene.add.text(cx, 186, "Share it with your friends", {
        fontFamily: "Arial",
        fontSize: "28px",
        color: "#FFF3C4"
    }).setOrigin(0.5));

    //---------------------------------
    // The card
    //---------------------------------

    // Sized from the room actually left between the heading and the buttons,
    // because the canvas is as tall as the phone rather than a fixed 1280.
    const buttonsY = GAME_HEIGHT - 210;
    const room = buttonsY - 250;
    const cardSize = Math.min(GAME_WIDTH - 120, room - 40);
    const cardY = 240 + cardSize/2;

    const images = cardImages(scene);

    const redraw = () => {

        const canvas = drawShareCard(images, { ...result, message });

        const key = `victoryCard${++serial}`;

        scene.textures.addCanvas(key, canvas);

        if(preview){

            preview.setTexture(key);

        }
        else{

            preview = keep(scene.add.image(cx, cardY, key));

        }

        preview.setDisplaySize(cardSize, cardSize);

        // Only once nothing is pointing at it any more
        if(cardKey && scene.textures.exists(cardKey)){

            scene.textures.remove(cardKey);

        }

        cardKey = key;

    };

    redraw();

    //---------------------------------
    // Buttons
    //---------------------------------

    const status = keep(scene.add.text(cx, buttonsY - 62, "", {
        fontFamily: "Arial",
        fontSize: "24px",
        color: "#BFE8A0"
    }).setOrigin(0.5));

    const button = (x, width, label, colour, onPress) => {

        const box = keep(
            scene.add
                .rectangle(x, buttonsY, width, 84, colour, 1)
                .setStrokeStyle(4, 0xFFD54A)
                .setInteractive({ useHandCursor: true })
        );

        const text = keep(scene.add.text(x, buttonsY, label, {
            fontFamily: "Arial",
            fontSize: "30px",
            fontStyle: "bold",
            color: "#FFF3C4"
        }).setOrigin(0.5));

        box.on("pointerdown", () => {

            AudioManager.play(scene, "click");

            onPress();

        });

        return { box, text };

    };

    button(cx - 176, 300, "ADD MESSAGE", 0x5A2D0C, async () => {

        const typed = await textPrompt({
            heading: "Put your name, or say something.\nIt goes on the card.",
            placeholder: "e.g. Arjun cleared it!",
            initial: message,
            maxLength: MESSAGE_LIMIT,
            confirmText: "PUT IT ON",
            cancelText: "CANCEL"
        });

        // null is "backed out", which must not wipe what they had already
        // written. Clearing it is done by emptying the field and confirming.
        if(typed === null){ return; }

        message = typed;

        redraw();

    });

    const shareButton = button(cx + 176, 300, "SHARE", 0xB96A16, async () => {

        shareButton.text.setText("...");

        const outcome = await shareVictory(
            drawShareCard(images, { ...result, message }),
            { ...result, message }
        );

        shareButton.text.setText("SHARE");

        // Backing out of the share sheet is not a failure and is not worth
        // saying anything about - the player just changed their mind.
        if(outcome === "cancelled"){ return; }

        status.setText({
            shared: "Sent!",
            // Not "link copied too" - the clipboard write is deliberately
            // fired and forgotten (see shareVictory), so whether it landed is
            // not known here and must not be claimed.
            saved: "Saved to your downloads.",
            failed: "Could not share that - try again?"
        }[outcome] || "");

        status.setColor(outcome === "failed" ? "#FFB4A0" : "#BFE8A0");

    });

    //---------------------------------
    // Out
    //---------------------------------

    const close = keep(scene.add.text(cx, GAME_HEIGHT - 108, "CLOSE", {
        fontFamily: "Arial",
        fontSize: "28px",
        fontStyle: "bold",
        color: "#D8C7A8"
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }));

    const dismiss = () => {

        parts.forEach(part => part.destroy());

        if(cardKey && scene.textures.exists(cardKey)){

            scene.textures.remove(cardKey);

        }

        scene.__victoryOpen = false;
        scene.__victoryClose = null;

    };

    close.on("pointerdown", () => {

        AudioManager.play(scene, "click");

        dismiss();

    });

    // Android's back button closes this rather than leaving the scene behind
    // it - the panel is the frontmost thing on screen, so it is what "back"
    // means while it is up.
    scene.__victoryClose = dismiss;

}
