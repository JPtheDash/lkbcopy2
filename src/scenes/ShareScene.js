import Phaser from "phaser";
import { loadImage } from "../ui/loader";
import AudioManager from "../managers/AudioManager";
import LevelManager from "../managers/LevelManager";

import homeBackground from "../assets/backgrounds/home_background.jpg";
import happyKrishna from "../assets/ui/krishna_happy_butter.png";
import feather from "../assets/items/feather.png";
import logo from "../assets/ui/logo.png";

import { fitWidth, GAME_WIDTH, GAME_HEIGHT, coverScreen } from "../ui/layout";
import { drawShareCard, cardImages, MESSAGE_LIMIT } from "../ui/ShareCard";
import shareVictory from "../ui/shareVictory";
import { TARGETS, openTarget, copyText } from "../ui/shareTargets";
import textPrompt from "../ui/textPrompt";

/**
 * Where finishing a world lands you.
 *
 * A SCENE, NOT A PANEL OVER THE LAST ONE
 * --------------------------------------
 * This started as an overlay dropped onto the level-complete screen, which
 * made the biggest thing a player had done in the game look like a
 * notification about it - something arriving on top of the screen they were
 * already on, to be dismissed. Finishing ten levels earns its own page.
 *
 * It also fixes a real problem the overlay had: the level-complete screen
 * kept its own NEXT, REPLAY and HOME buttons live underneath, so the screen
 * had five places to go while asking the player to do one thing.
 */

// Each redraw needs its own texture key - Phaser will not overwrite a live
// texture, and swapping keys is far simpler than reaching into the canvas
// behind one to refresh it in place.
let serial = 0;

const CARD_MARGIN = 100;

export default class ShareScene extends Phaser.Scene {

    constructor(){
        super("ShareScene");
    }

    preload(){

        AudioManager.preload(this);

        loadImage(this, "homeBackground", homeBackground);
        loadImage(this, "happyKrishna", happyKrishna);
        loadImage(this, "feather", feather);
        loadImage(this, "logo", logo);

    }

    create(data){

        AudioManager.startMusic(this, "menu");

        // Which world was finished. Passed in by the level-complete screen or
        // by the world card; falls back to the furthest reached so the scene
        // cannot be entered with nothing to show.
        this.worldId = data && data.world ? data.world : LevelManager.currentWorld();

        const world = LevelManager.getWorlds().find(w => w.id === this.worldId)
                   || LevelManager.getWorlds()[0];

        this.result = {
            worldName: world.name,
            levels: world.count,
            feathers: world.stars,
            maxFeathers: world.maxStars,
            message: ""
        };

        this.images = cardImages(this);
        this.cardKey = null;

        coverScreen(this.add.image(0, 0, "homeBackground")).setDepth(-10);

        this.add.rectangle(
            GAME_WIDTH/2, GAME_HEIGHT/2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.72
        );

        this.layout();

        AudioManager.play(this, "win");

    }

    //------------------------------------------------

    layout(){

        const cx = GAME_WIDTH/2;

        this.add.text(cx, 92, `${this.result.worldName} COMPLETE`, {
            fontFamily: "Arial",
            fontSize: "50px",
            fontStyle: "bold",
            color: "#FFD54A",
            stroke: "#2A1403",
            strokeThickness: 8
        }).setOrigin(0.5);

        this.add.text(cx, 142, `All ${this.result.levels} levels cleared`, {
            fontFamily: "Arial",
            fontSize: "26px",
            color: "#FFF3C4"
        }).setOrigin(0.5);

        //---------------------------------
        // Everything is measured up from the bottom
        //---------------------------------
        //
        // The canvas is as tall as the phone rather than a fixed 1280 - see
        // canvasHeight() in ui/layout.js - so the controls are anchored to
        // the bottom edge and the card takes whatever is left in the middle.
        // Laid out downwards from the heading instead, a long screen would
        // strand the buttons halfway up it.

        const navY = GAME_HEIGHT - 62;
        const rowTwoY = GAME_HEIGHT - 148;
        const rowOneY = GAME_HEIGHT - 226;
        const rowLabelY = GAME_HEIGHT - 274;
        const shareY = GAME_HEIGHT - 344;
        const messageY = GAME_HEIGHT - 426;

        //---------------------------------
        // The card
        //---------------------------------

        const roomTop = 176;
        const roomBottom = messageY - 56;

        const size = Math.min(
            GAME_WIDTH - CARD_MARGIN * 2, roomBottom - roomTop
        );

        this.cardY = roomTop + (roomBottom - roomTop)/2;
        this.cardSize = size;

        this.redraw();

        //---------------------------------
        // Write on it
        //---------------------------------

        this.button(
            cx, messageY, 380, 74, "ADD YOUR NAME", 0x5A2D0C,
            () => this.askForMessage()
        );

        //---------------------------------
        // The picture, through the system's own sheet
        //---------------------------------

        this.button(
            cx, shareY, 480, 88, "SHARE THE PICTURE", 0xB96A16,
            () => this.sharePicture(), "34px"
        );

        this.status = this.add.text(cx, rowLabelY, "or send it straight to", {
            fontFamily: "Arial",
            fontSize: "22px",
            color: "#C8B79A"
        }).setOrigin(0.5);

        //---------------------------------
        // The named apps
        //---------------------------------

        const gap = 16;
        const width = (GAME_WIDTH - 80 - gap * 2) / 3;

        TARGETS.forEach((target, i) => {

            const row = Math.floor(i / 3);
            const col = i % 3;

            const x = 40 + width/2 + col * (width + gap);
            const y = row === 0 ? rowOneY : rowTwoY;

            this.button(
                x, y, width, 62, target.label, target.colour,
                () => this.useTarget(target), "24px"
            );

        });

        //---------------------------------
        // Out
        //---------------------------------

        this.button(cx - 116, navY, 208, 62, "WORLDS", 0x3A2A18,
                    () => this.leave("WorldSelectScene"), "24px");

        this.button(cx + 116, navY, 208, 62, "HOME", 0x3A2A18,
                    () => this.leave("HomeScene"), "24px");

    }

    //------------------------------------------------

    button(x, y, width, height, label, colour, onPress, fontSize = "28px"){

        const box = this.add
            .rectangle(x, y, width, height, colour, 1)
            .setStrokeStyle(3, 0xFFD54A)
            .setInteractive({ useHandCursor: true });

        const text = this.add.text(x, y, label, {
            fontFamily: "Arial",
            fontSize,
            fontStyle: "bold",
            color: "#FFF3C4"
        }).setOrigin(0.5);

        // Shrunk to its button rather than allowed to run over the ends -
        // "Copy text" and "Instagram" are not the same width, and the six app
        // buttons all have to be the same size as each other.
        const room = width - 20;

        if(text.width > room){

            text.setScale(room / text.width);

        }

        box.on("pointerdown", () => {

            AudioManager.play(this, "click");

            onPress();

        });

        return { box, text };

    }

    //------------------------------------------------

    /** Repaints the card and puts it back on screen. */
    redraw(){

        const canvas = drawShareCard(this.images, this.result);

        const key = `shareCard${++serial}`;

        this.textures.addCanvas(key, canvas);

        if(this.preview){

            this.preview.setTexture(key);

        }
        else{

            this.preview = this.add.image(GAME_WIDTH/2, this.cardY, key);

        }

        this.preview.setDisplaySize(this.cardSize, this.cardSize);

        // Only once nothing is pointing at it any more
        if(this.cardKey && this.textures.exists(this.cardKey)){

            this.textures.remove(this.cardKey);

        }

        this.cardKey = key;

    }

    //------------------------------------------------

    async askForMessage(){

        const typed = await textPrompt({
            heading: "Put your name, or say something.\nIt goes on the card.",
            placeholder: "e.g. Arjun cleared it!",
            initial: this.result.message,
            maxLength: MESSAGE_LIMIT,
            confirmText: "PUT IT ON",
            cancelText: "CANCEL"
        });

        // null is "backed out", which must not wipe what was already written.
        // Clearing it is done by emptying the field and confirming.
        if(typed === null){ return; }

        this.result.message = typed;

        this.redraw();

    }

    //------------------------------------------------

    async sharePicture(){

        const outcome = await shareVictory(
            drawShareCard(this.images, this.result), this.result
        );

        // Backing out of the share sheet is not a failure and is not worth
        // saying anything about - the player just changed their mind.
        this.say({
            shared: "",
            cancelled: "",
            saved: "Saved to your downloads.",
            failed: "Could not share that - try again?"
        }[outcome] ?? "", outcome === "failed");

    }

    //------------------------------------------------

    async useTarget(target){

        if(target.mode === "copy"){

            const done = await copyText(this.result);

            this.say(
                done === "copied" ? "Copied - paste it anywhere." : "Could not copy.",
                done !== "copied"
            );

            return;

        }

        // Instagram takes no shared text and has no share address of any
        // kind, so its button is the picture route whatever the row it sits
        // in. See shareTargets.js.
        //
        // Said out loud, because this button does not do what the five around
        // it do: they open one app, this one opens the phone's list of them.
        // A player who tapped Instagram and got a list needs to know that is
        // the way to Instagram and not a misfire.
        if(target.mode === "picture"){

            this.say(`Choose ${target.label} from the list`);

            await this.sharePicture();

            return;

        }

        if(!openTarget(target.id, this.result)){

            this.say(`Could not open ${target.label}.`, true);

        }

    }

    //------------------------------------------------

    say(message, bad = false){

        this.status.setText(message || "or send it straight to");
        this.status.setColor(bad ? "#FFB4A0" : "#C8B79A");

    }

    //------------------------------------------------

    leave(scene){

        if(this.cardKey && this.textures.exists(this.cardKey)){

            this.textures.remove(this.cardKey);

        }

        this.scene.start(scene);

    }

    //------------------------------------------------

    onBackButton(){

        this.leave("WorldSelectScene");

    }

}
