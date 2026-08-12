import Phaser from "phaser";
import { loadImage } from "../ui/loader";
import AudioManager from "../managers/AudioManager";
import LevelManager from "../managers/LevelManager";

import homeBackground from "../assets/backgrounds/home_background.jpg";
import worldPanel from "../assets/ui/world_panel.png";
import worldVrindavan from "../assets/ui/world_vrindavan.png";
import worldYamuna from "../assets/ui/world_yamuna.png";
import worldMathura from "../assets/ui/world_mathura.png";
import lockedWorld from "../assets/ui/locked_world.png";
import feather from "../assets/items/feather.png";
import homeButtonImg from "../assets/ui/home_button.png";

// For the share card, which draws on its own canvas but still needs its
// pictures to have come through Phaser's loader first.
import happyKrishna from "../assets/ui/krishna_happy_butter.png";
import logo from "../assets/ui/logo.png";


import { fitWidth, fitHeight, GAME_WIDTH, GAME_HEIGHT, coverScreen } from "../ui/layout";

// A peacock feather, not a star. Ten levels at three each is thirty of them,
// and a feather is the thing this particular boy is known for wearing - a
// gold star is what any game gives you.
//
// Sized by HEIGHT, unlike the star it replaces. The star art was 165x149 and
// sat in a square; the feather is 84x146, so fitting it to a width would have
// made it two and a half times as tall as the badge it lives in.
const FEATHER_HEIGHT = 30;

// The three cards are all 600 wide as delivered but not the same height -
// 345, 373 and 373 - so they are sized on width and their heights are read
// back rather than assumed. Sizing them on height instead would show the
// three at three different widths, which reads as three different frames.
const CARD_WIDTH = 430;

// The wooden plate the card art leaves empty at its foot, as a fraction of
// the card's height. Measured off all three pieces: the plate runs from about
// 82% to the bottom edge on each of them, so one number serves all three.
const PLATE = 0.885;

// The locked card is a hanging sign rather than a framed picture, and its
// chains take up the top of the image. Narrower than a world card, both so
// the sign itself comes out about the same size as one and to leave room
// above and below it for the two captions that cannot sit on the board.
const LOCKED_WIDTH = 330;

export default class WorldSelectScene extends Phaser.Scene {

    constructor() {
        super("WorldSelectScene");
    }

    preload() {

        AudioManager.preload(this);

        loadImage(this, "background", homeBackground);
        loadImage(this, "worldPanel", worldPanel);
        loadImage(this, "worldVrindavan", worldVrindavan);
        loadImage(this, "worldYamuna", worldYamuna);
        loadImage(this, "worldMathura", worldMathura);
        loadImage(this, "lockedWorld", lockedWorld);
        loadImage(this, "feather", feather);
        loadImage(this, "homeButton", homeButtonImg);
        loadImage(this, "happyKrishna", happyKrishna);
        loadImage(this, "logo", logo);

    }

    create() {

        AudioManager.startMusic(this, "menu");

        coverScreen(this.add.image(0, 0, "background"));

        this.add.rectangle(
            GAME_WIDTH/2, GAME_HEIGHT/2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.5
        );

        //---------------------------------
        // Heading
        //---------------------------------

        const banner = fitWidth(
            this.add.image(GAME_WIDTH/2, 120, "worldPanel"),
            420
        );

        this.add.text(
            GAME_WIDTH/2,
            banner.y,
            "SELECT WORLD",
            {
                fontFamily: "Arial",
                fontSize: "40px",
                fontStyle: "bold",
                color: "#FFD54A",
                stroke: "#5A2D0C",
                strokeThickness: 6
            }
        ).setOrigin(0.5);

        //---------------------------------
        // The three cards
        //---------------------------------

        const worlds = LevelManager.getWorlds();

        // Laid out from the room left between the banner and the home button
        // rather than from fixed y values, because the canvas is as tall as
        // the phone - see canvasHeight() in ui/layout.js. On a long screen
        // the cards spread out; on the design height they just fit.
        const top = banner.y + banner.displayHeight/2 + 20;
        const bottom = GAME_HEIGHT - 210;

        const slot = (bottom - top) / worlds.length;

        worlds.forEach((world, index) => {

            const y = top + slot * (index + 0.5);

            if(world.unlocked){

                this.card(world, y);

            }
            else{

                this.locked(world, y);

            }

        });

        //---------------------------------
        // Back to home
        //---------------------------------

        const home = fitWidth(
            this.add.image(GAME_WIDTH/2, GAME_HEIGHT - 110, "homeButton"),
            110
        ).setInteractive({ useHandCursor: true });

        home.on("pointerdown", () => {

            AudioManager.play(this, "click");

            this.scene.start("HomeScene");

        });

    }

    //------------------------------------------------

    /** An open world: the picture, its name on the plate, and its feathers. */
    card(world, y){

        const art = fitWidth(
            this.add.image(GAME_WIDTH/2, y, world.art),
            CARD_WIDTH
        ).setInteractive({ useHandCursor: true });

        const height = art.displayHeight;

        // Measured from the top of the art, so the name follows the picture
        // whatever height that particular card came out at.
        const plateY = y - height/2 + height * PLATE;

        const name = this.add.text(
            GAME_WIDTH/2,
            plateY,
            world.name,
            {
                fontFamily: "Arial",
                fontSize: "30px",
                fontStyle: "bold",
                color: "#FFE9A8",
                stroke: "#3A1D06",
                strokeThickness: 5
            }
        ).setOrigin(0.5);

        // The plate is not as wide as the card - the frame's scrollwork eats
        // into both ends - so a long name is shrunk to the wood rather than
        // running over the carving.
        const room = art.displayWidth * 0.62;

        if(name.width > room){

            name.setScale(room / name.width);

        }

        // The feather count goes INSIDE the picture, not in the gap above the
        // card. Above the card is also just below the card before it, and at
        // this spacing Yamuna's score landed on Vrindavan's nameplate - so
        // the game reported one world's progress on another's.
        //
        // Top right specifically: all three pictures are sky there, and the
        // frame's lotus crest owns the top middle.
        const score = this.add.text(
            0,
            0,
            `${world.stars} / ${world.maxStars}`,
            {
                fontFamily: "Arial",
                fontSize: "24px",
                fontStyle: "bold",
                color: "#FFFFFF"
            }
        ).setOrigin(0, 0.5);

        const feather = fitHeight(
            this.add.image(0, 0, "feather"),
            FEATHER_HEIGHT
        );

        const unitWidth = feather.displayWidth + 6 + score.width;

        // Far enough in from the corner to clear the frame. The frame's
        // corners are rounded, so the picture is narrower near the top than
        // it is across the middle - a badge placed by the card's half-width
        // sits on the carving rather than on the picture.
        const centreX = GAME_WIDTH/2 + art.displayWidth * 0.19;
        const centreY = y - height * 0.24;

        // A pill behind them, because "24 / 30" in white on a sunset is
        // legible on one card and not on the next. The badge makes it read
        // the same on all three.
        this.add.rectangle(
            centreX, centreY, unitWidth + 24, 34, 0x1a0c02, 0.55
        ).setOrigin(0.5);

        feather.setPosition(
            centreX - unitWidth/2 + feather.displayWidth/2, centreY
        );
        score.setPosition(
            centreX - unitWidth/2 + feather.displayWidth + 6, centreY
        );

        art.on("pointerdown", () => {

            AudioManager.play(this, "click");

            this.scene.start("LevelSelectScene", { world: world.id });

        });

        //---------------------------------
        // Share, once the world is done
        //---------------------------------

        // The card is offered the moment a world is finished, on the
        // level-complete screen. This is the way BACK to it: that offer comes
        // once, and a player who was not ready to write their name at that
        // exact moment should not have lost the chance for good.
        //
        // Top left, mirroring the feather count at top right - the same strip
        // of sky, and the two badges balance rather than crowd one corner.
        if(world.cleared >= world.count){

            this.shareBadge(world, GAME_WIDTH/2 - art.displayWidth * 0.19,
                            y - height * 0.24);

        }

        this.tweens.add({
            targets: art,
            scale: art.scale * 1.02,
            duration: 1600,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut"
        });

    }

    //------------------------------------------------

    /** The badge that reopens the share card for a finished world. */
    shareBadge(world, x, y){

        const label = this.add.text(0, 0, "SHARE", {
            fontFamily: "Arial",
            fontSize: "22px",
            fontStyle: "bold",
            color: "#FFF3C4"
        }).setOrigin(0.5);

        // The pill is what takes the tap, not the word. A 22px caption is a
        // poor target on a phone; the pill around it is a comfortable one.
        //
        // Added BEFORE the label so it sits under it. Phaser's input is
        // top-only, so whichever of the two ends up on top is the one that
        // answers - and the card behind them both is left alone either way.
        const pill = this.add.rectangle(
            x, y, label.width + 34, 34, 0xB96A16, 0.92
        ).setStrokeStyle(2, 0xFFD54A).setInteractive({ useHandCursor: true });

        label.setPosition(x, y);

        // Back above the pill, which was added after it
        this.children.bringToTop(label);

        pill.on("pointerdown", () => {

            AudioManager.play(this, "click");

            this.scene.start("ShareScene", { world: world.id });

        });

    }

    //------------------------------------------------

    /** A world not reached yet: the padlocked sign, and what opens it. */
    locked(world, y){

        const sign = fitWidth(
            this.add.image(GAME_WIDTH/2, y, "lockedWorld"),
            LOCKED_WIDTH
        );

        const height = sign.displayHeight;

        // Both captions go OUTSIDE the sign. The board carries a heart
        // padlock across the whole middle of it - that is the art's subject,
        // not a background - so centred text on the board lands on the lock
        // and neither can be read.
        this.add.text(
            GAME_WIDTH/2,
            y - height/2 - 18,
            world.name,
            {
                fontFamily: "Arial",
                fontSize: "28px",
                fontStyle: "bold",
                color: "#C8B79A",
                stroke: "#2A1704",
                strokeThickness: 5
            }
        ).setOrigin(0.5);

        // Which level opens it, rather than a bare padlock. "Clear level 20"
        // is something a player can go and do; a lock on its own only says
        // no, and leaves them to work out what it wants.
        const opensAt = (world.id - 1) * world.count;

        this.add.text(
            GAME_WIDTH/2,
            y + height/2 + 16,
            `CLEAR LEVEL ${opensAt}`,
            {
                fontFamily: "Arial",
                fontSize: "24px",
                fontStyle: "bold",
                color: "#FFE9A8",
                stroke: "#3A1D06",
                strokeThickness: 5
            }
        ).setOrigin(0.5);

    }

    //------------------------------------------------

    /**
     * Android's back button goes up a screen, to the home screen, rather
     * than closing the app. Only the home screen, where there is
     * nowhere further up, asks about leaving.
     */
    onBackButton(){

        if(this.__victoryClose){

            this.__victoryClose();

            return;

        }

        this.scene.start("HomeScene");

    }

}
