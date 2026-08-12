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
        const statusY = GAME_HEIGHT - 130;
        const shareY = GAME_HEIGHT - 196;
        const messageY = GAME_HEIGHT - 288;

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
        // Share
        //---------------------------------
        //
        // One button. The six apps used to sit on this page in two rows,
        // which made choosing where to send it the loudest thing on a screen
        // whose subject is the card - and asked the player to pick an app
        // before they had decided to share at all. They live behind this now.

        this.button(
            cx, shareY, 480, 92, "SHARE", 0xB96A16,
            () => this.openChooser(), "36px"
        );

        this.status = this.add.text(cx, statusY, "", {
            fontFamily: "Arial",
            fontSize: "22px",
            color: "#C8B79A"
        }).setOrigin(0.5);

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

    /**
     * The list of places to send it, opened by the Share button.
     *
     * Drawn over this scene rather than made a scene of its own: it is a
     * choice about the page behind it, and the card has to stay visible while
     * it is up so the player can see what they are sending.
     *
     * Built in a plain array with setDepth rather than a Container, for the
     * reason ConfirmDialog gives: Phaser hit-tests a container's children
     * against camera scroll, which breaks buttons inside one.
     */
    openChooser(){

        if(this.chooser){ return; }

        const cx = GAME_WIDTH/2;
        const parts = [];
        const DEPTH = 800;

        const keep = item => {

            item.setDepth(DEPTH);
            parts.push(item);

            return item;

        };

        keep(
            this.add
                .rectangle(cx, GAME_HEIGHT/2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.8)
                .setInteractive()
                .on("pointerdown", () => this.closeChooser())
        );

        // Measured up from the bottom so the sheet sits under the card rather
        // than over it - the point of a chooser is not to hide the thing
        // being chosen for.
        const closeY = GAME_HEIGHT - 70;
        const rowTwoY = GAME_HEIGHT - 168;
        const rowOneY = GAME_HEIGHT - 250;
        const pictureY = GAME_HEIGHT - 350;
        const titleY = GAME_HEIGHT - 424;

        // A solid ground under the sheet, not just the dimming. At 0.8 the
        // page's own ADD YOUR NAME and WORLDS buttons still showed through
        // from directly behind the app row, so the sheet looked like it was
        // printed on top of the page rather than laid over it.
        keep(
            this.add.rectangle(
                cx, (titleY - 30 + GAME_HEIGHT)/2,
                GAME_WIDTH, GAME_HEIGHT - (titleY - 30),
                0x140901, 0.96
            ).setInteractive()
        );

        keep(this.add.text(cx, titleY, "Send it to", {
            fontFamily: "Arial",
            fontSize: "30px",
            fontStyle: "bold",
            color: "#FFD54A"
        }).setOrigin(0.5));

        // First, and widest, because it is the only one that carries the
        // picture - see shareTargets.js for why a link cannot.
        const picture = this.button(
            cx, pictureY, 480, 82, "SHARE THE PICTURE", 0x2E7D32,
            () => { this.closeChooser(); this.sharePicture(); }, "30px"
        );

        keep(picture.box);
        keep(picture.text);

        const gap = 16;
        const width = (GAME_WIDTH - 80 - gap * 2) / 3;

        TARGETS.forEach((target, i) => {

            const row = Math.floor(i / 3);
            const col = i % 3;

            const made = this.button(
                40 + width/2 + col * (width + gap),
                row === 0 ? rowOneY : rowTwoY,
                width, 66, target.label, target.colour,
                () => { this.closeChooser(); this.useTarget(target); },
                "24px"
            );

            keep(made.box);
            keep(made.text);

        });

        const close = this.button(
            cx, closeY, 240, 60, "CLOSE", 0x3A2A18,
            () => this.closeChooser(), "24px"
        );

        keep(close.box);
        keep(close.text);

        this.chooser = parts;

    }

    //------------------------------------------------

    closeChooser(){

        if(!this.chooser){ return; }

        this.chooser.forEach(part => part.destroy());
        this.chooser = null;

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

        this.status.setText(message || "");
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

        // The chooser is the frontmost thing while it is up, so back closes
        // that rather than walking out of the page underneath it.
        if(this.chooser){

            this.closeChooser();

            return;

        }

        this.leave("WorldSelectScene");

    }

}
