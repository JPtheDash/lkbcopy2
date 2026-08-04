import Phaser from "phaser";
import AudioManager from "../managers/AudioManager";
import { GAME_WIDTH, GAME_HEIGHT } from "./layout";

/**
 * A yes/no box, drawn in the game rather than by the system.
 *
 * A native confirm() blocks the WebView's thread, which stops Phaser's loop
 * mid-frame and leaves the game visibly frozen behind the dialog. Drawing it
 * ourselves also means it looks like the rest of the game.
 *
 * Every part is pinned with setScrollFactor(0) and held in a plain array
 * rather than a Container: Phaser hit-tests container children against the
 * camera's scroll, so buttons inside one stop responding as soon as a level
 * scrolls away from the origin.
 */

const DEPTH = 900;

export default function confirmDialog(scene, {
    message = "Are you sure?",
    confirmText = "YES",

    // Pass null for a one-button box - the About panel is telling you
    // something rather than asking, and a "NO" beside it would be nonsense.
    cancelText = "NO",

    onConfirm = () => {},
    onCancel = () => {},
    height = 320,
    fontSize = "42px"
} = {}){

    // One at a time. Two presses of back should not stack two dialogs.
    if(scene.__confirmOpen){

        return;

    }

    scene.__confirmOpen = true;

    const cx = GAME_WIDTH/2;
    const cy = GAME_HEIGHT/2;

    const parts = [];

    const dim = scene.add
        .rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.65)
        .setInteractive();

    parts.push(dim);

    const panel = scene.add
        .rectangle(cx, cy, 560, height, 0x2a1403, 0.97)
        .setStrokeStyle(5, 0xE8912B);

    parts.push(panel);

    const buttonY = cy + height/2 - 90;

    const text = scene.add
        .text(cx, cy - height/2 + 60, message, {
            fontFamily: "Arial",
            fontSize: fontSize,
            fontStyle: "bold",
            color: "#FFE9A8",
            align: "center",
            wordWrap: { width: 480 }
        })
        .setOrigin(0.5, 0);

    parts.push(text);

    const close = () => {

        scene.__confirmOpen = false;

        parts.forEach(part => part.destroy());

    };

    const button = (x, label, colour, action) => {

        const box = scene.add
            .rectangle(x, buttonY, 220, 92, colour)
            .setStrokeStyle(4, 0xFFE9A8)
            .setInteractive({ useHandCursor: true });

        const caption = scene.add
            .text(x, buttonY, label, {
                fontFamily: "Arial",
                fontSize: "38px",
                fontStyle: "bold",
                color: "#FFFFFF"
            })
            .setOrigin(0.5);

        box.on("pointerdown", ()=>{

            AudioManager.play(scene, "click");

            close();

            action();

        });

        parts.push(box, caption);

    };

    if(cancelText){

        button(cx - 130, cancelText, 0x7A4A18, onCancel);
        button(cx + 130, confirmText, 0xA8341A, onConfirm);

    }
    else{

        // One button, centred - nothing to weigh it against
        button(cx, confirmText, 0xA8341A, onConfirm);

    }

    parts.forEach(part => part.setScrollFactor(0).setDepth(DEPTH));

    // Grow in, so it reads as arriving rather than as the screen jumping
    parts.forEach(part => part.setAlpha(0));

    scene.tweens.add({
        targets: parts,
        alpha: 1,
        duration: 160,
        ease: "Quad.easeOut"
    });

    return { close };

}
