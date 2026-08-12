import Phaser from "phaser";
import { loadImage } from "../ui/loader";
import AudioManager from "../managers/AudioManager";
import LevelManager from "../managers/LevelManager";
import SaveManager from "../managers/SaveManager";

import happyKrishna from "../assets/ui/krishna_happy_butter.png";
import potEmpty from "../assets/items/pot_hide.png";
import potFull from "../assets/items/pot_full.png";
import nextButton from "../assets/ui/next_button.png";
import replayButtonImg from "../assets/ui/replay_button.png";
import homeButtonImg from "../assets/ui/home_button.png";
import levelBanner from "../assets/ui/level_banner.png";
import starPanel from "../assets/ui/star_panel.png";
import ribbonPerfect from "../assets/ui/ribbon_perfect.png";
import homeBackground from "../assets/backgrounds/home_background.jpg";

// Only used by the share card, which is drawn on its own canvas rather than
// on the scene - but the pictures still have to be through Phaser's loader
// before that canvas can draw them.
import feather from "../assets/items/feather.png";
import logo from "../assets/ui/logo.png";

import openVictoryShare from "../ui/VictoryShare";

import { fitWidth, fitHeight, GAME_WIDTH, GAME_HEIGHT , coverScreen} from "../ui/layout";

const STAR_DELAY = 400;

// Wider than the 92 the stars were drawn at. A pot is a rounder, busier shape
// than a star and the butter on top is most of what tells the two apart, so it
// needs the extra size to still read at a glance.
const POT_WIDTH = 104;

// Room for three of those plus the gaps between them and the panel's own
// carved border. A star is mostly empty space around its points and sat
// happily on a 460 panel; a pot is solid to its edges and was overhanging.
const POT_GAP = 126;
const PANEL_WIDTH = 560;

// The shine. Phaser's own Shine effect is WebGL-only and the game falls back
// to Canvas on some devices, so this is done with a second copy of the pot
// drawn in ADD blend mode over the first, breathing in and out. Additive
// blending is supported by both renderers, and because the copy is the same
// picture it can only brighten what is already there - no highlight can land
// off the pot or across its outline.
const GLAZE_MS = 1500;

// The last pot lands at 3 x STAR_DELAY, and the perfect-run ribbon 620ms
// after that. This waits out both, so the share card arrives as the next
// thing rather than on top of the reward.
const WORLD_CELEBRATION_DELAY = 2300;

export default class LevelCompleteScene extends Phaser.Scene{

    constructor(){
        super("LevelCompleteScene");
    }

    preload(){

        AudioManager.preload(this);

        loadImage(this, "happyKrishna", happyKrishna);
        loadImage(this, "potEmpty", potEmpty);
        loadImage(this, "potFull", potFull);
        loadImage(this, "nextButton", nextButton);
        loadImage(this, "replayButton", replayButtonImg);
        loadImage(this, "homeButton", homeButtonImg);
        loadImage(this, "levelBanner", levelBanner);
        loadImage(this, "starPanel", starPanel);
        loadImage(this, "ribbon", ribbonPerfect);
        loadImage(this, "homeBackground", homeBackground);
        loadImage(this, "feather", feather);
        loadImage(this, "logo", logo);

    }

    create(data){

        // Kept for onBackButton, which runs long after create() has returned
        // and has no other way to know which world to go back to.
        this.level = data.level;

        // Back out of the climb's music now the level is over
        AudioManager.startMusic(this, "menu");

        coverScreen(this.add.image(0, 0, "homeBackground"))
            .setDepth(-10);

        this.add.rectangle(
            GAME_WIDTH/2, GAME_HEIGHT/2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6
        );

        SaveManager.saveStars(data.level, data.stars);

        AudioManager.play(this,"win");

        // Whether this result finished a world can only be asked after the
        // save above has taken it in - `cleared` is counted from the save,
        // not from what was just handed to this scene.
        this.maybeCelebrateWorld(data.level);

        //---------------------------------
        // Banner
        //---------------------------------

        fitWidth(
            this.add.image(GAME_WIDTH/2, 150, "levelBanner"),
            500
        );

        this.add.text(
            GAME_WIDTH/2,
            140,
            `LEVEL ${data.level}`,
            {
                fontFamily: "Arial",
                fontSize: "50px",
                color: "#FFD54A",
                fontStyle: "bold",
                stroke: "#000000",
                strokeThickness: 5
            }
        ).setOrigin(0.5);

        //---------------------------------
        // Happy Krishna
        //---------------------------------

        const krishna = fitHeight(
            this.add.image(GAME_WIDTH/2, 450, "happyKrishna"),
            330
        );

        this.tweens.add({
            targets: krishna,
            y: 440,
            duration: 1200,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut"
        });

        //---------------------------------
        // The score, in pots
        //---------------------------------
        //
        // See glaze() below for how the pots are made to catch the light.
        //
        // Three pots rather than three stars: what the run is scored on is how
        // much butter was got away with, so an empty pot for one not earned
        // and a full one for one that was says it in the game's own terms.

        const panelY = 770;

        fitWidth(
            this.add.image(GAME_WIDTH/2, panelY, "starPanel"),
            PANEL_WIDTH
        );

        // Centred on the wooden field, which sits a little above the middle of
        // the art because the frame hangs lower than it rises.
        //
        // Not centred on the three stars carved into the bottom border, which
        // was tried: those are ornament, cut into the frame the same way the
        // gems and the peacock feathers are, and covering them only dragged
        // the pots down out of the field and over the edge.
        const potY = panelY - 12;

        for(let i=0;i<3;i++){

            const x = GAME_WIDTH/2 - POT_GAP + i * POT_GAP;

            // Dulled and knocked back, so an unearned pot reads as an empty
            // slot rather than as another piece of pottery on the shelf.
            const empty = fitWidth(
                this.add.image(x, potY, "potEmpty"),
                POT_WIDTH
            ).setTint(0x9b8f7e).setAlpha(0.9);

            this.glaze(empty, "potEmpty", 0.18);

            if(i < data.stars){

                const pot = fitWidth(
                    this.add.image(x, potY, "potFull"),
                    POT_WIDTH
                );

                const full = pot.scale;

                pot.setScale(0);

                this.time.delayedCall(i * STAR_DELAY, ()=>{

                    AudioManager.play(this,"star");

                    this.tweens.add({

                        targets: pot,

                        scale: full,

                        duration: 350,

                        ease: "Back.Out",

                        onComplete: ()=>{

                            // Only now, once the pot is at its full size.
                            // Glazing it up front left a bright ghost of the
                            // pot sitting on the panel before the pot itself
                            // had been awarded.
                            const shine = this.glaze(pot, "potFull", 0.34);

                            // The shine is a separate object lying on top, so
                            // it has to be rocked with the pot or it slides
                            // off it for the length of the wobble.
                            this.tweens.add({
                                targets: [pot, shine],
                                angle: 10,
                                duration: 100,
                                yoyo: true,
                                repeat: 1
                            });

                        }

                    });

                });

            }

        }

        //---------------------------------
        // Perfect run
        //---------------------------------

        // Three stars is the ceiling, so it gets something the other results
        // do not - it lands after the last star, as the payoff for the run
        // rather than as another label on the screen.
        if(data.stars >= 3){

            const RIBBON_WIDTH = 400;

            const ribbon = fitWidth(
                this.add.image(GAME_WIDTH/2, panelY + 115, "ribbon"),
                RIBBON_WIDTH
            ).setAlpha(0);

            // The writing band is not in the middle of the picture: the art is
            // 630x178 and the red runs from y=36 to y=109, so its centre sits
            // 16.5px above the image's own, with the curled tails filling the
            // rest. Text centred on the image therefore reads low, half off
            // the band. Measured off the art so it survives a re-export.
            const BAND_OFFSET = -16.5 * (RIBBON_WIDTH / 630);

            const caption = this.add.text(
                GAME_WIDTH/2,
                ribbon.y + BAND_OFFSET,
                "PERFECT!",
                {
                    fontFamily: "Arial",
                    fontSize: "40px",
                    color: "#FFF3C4",
                    fontStyle: "bold",
                    stroke: "#7A1010",
                    strokeThickness: 6
                }
            ).setOrigin(0.5).setAlpha(0);

            // fitWidth leaves the ribbon at whatever scale gave it 400px, so
            // each target springs back to its own resting scale rather than
            // to a shared 1 - which would snap the ribbon to full texture
            // size the moment the tween started.
            this.time.delayedCall(3 * STAR_DELAY + 200, ()=>{

                AudioManager.play(this,"star");

                [ribbon, caption].forEach(target => {

                    const resting = target.scale;

                    this.tweens.add({
                        targets: target,
                        alpha: 1,
                        scale: { from: resting * 0.7, to: resting },
                        duration: 420,
                        ease: "Back.Out"
                    });

                });

            });

        }

        //---------------------------------
        // Next
        //---------------------------------

        const next = fitWidth(
            this.add.image(GAME_WIDTH/2, 1005, "nextButton"),
            300
        ).setInteractive({ useHandCursor: true });

        this.add.text(
            GAME_WIDTH/2,
            1000,
            "NEXT",
            {
                fontFamily: "Arial",
                fontSize: "38px",
                color: "#FFFFFF",
                fontStyle: "bold",
                stroke: "#5A2D0C",
                strokeThickness: 5
            }
        ).setOrigin(0.5);

        this.tweens.add({
            targets: next,
            scale: next.scale * 1.06,
            duration: 700,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut"
        });

        next.on("pointerdown",()=>{

            AudioManager.play(this,"click");

            const nextLevel = data.level + 1;

            // Past the last level there is nothing to advance to
            if(nextLevel > LevelManager.getCount()){

                this.scene.start("WorldSelectScene");

                return;

            }

            // Crossing into a new world goes to the world screen rather than
            // straight into the next level. Clearing level 10 is what opens
            // Yamuna, and dropping the player into level 11 means the only
            // sign of it is that the background changed - the thing they just
            // earned goes past unseen.
            if(LevelManager.worldOf(nextLevel) !== LevelManager.worldOf(data.level)){

                this.scene.start("WorldSelectScene");

                return;

            }

            this.scene.start("GameScene",{ level: nextLevel });

        });

        //---------------------------------
        // Replay / Home
        //---------------------------------

        const replay = fitWidth(
            this.add.image(GAME_WIDTH/2 - 110, 1130, "replayButton"),
            120
        ).setInteractive({ useHandCursor: true });

        replay.on("pointerdown",()=>{

            AudioManager.play(this,"click");

            this.scene.start("GameScene",{ level: data.level });

        });

        const home = fitWidth(
            this.add.image(GAME_WIDTH/2 + 110, 1130, "homeButton"),
            120
        ).setInteractive({ useHandCursor: true });

        home.on("pointerdown",()=>{

            AudioManager.play(this,"click");

            this.scene.start("HomeScene");

        });

    }

    //------------------------------------------------

    /**
     * Offers the share card, if this result was the one that finished a world.
     *
     * Finishing the LAST level of a world is not the test - levels can be
     * replayed and taken in any unlocked order, so the tenth level cleared is
     * often not level ten. What counts is that none of the world's ten are
     * still unplayed.
     */
    maybeCelebrateWorld(levelId){

        const worldId = LevelManager.worldOf(levelId);

        const world = LevelManager.getWorlds().find(w => w.id === worldId);

        if(!world || world.cleared < world.count){ return; }

        // After the pots and the ribbon have landed. Dropping this over the
        // top of the result would cover the thing the player just earned with
        // a request to go and tell people about it.
        this.time.delayedCall(WORLD_CELEBRATION_DELAY, () => {

            openVictoryShare(this, {
                worldName: world.name,
                levels: world.count,
                feathers: world.stars,
                maxFeathers: world.maxStars
            });

        });

    }

    //------------------------------------------------

    /**
     * Makes a pot catch the light, by laying a second copy of it over the
     * first in ADD blend mode and breathing that copy in and out.
     *
     * Additive rather than a drawn highlight because the copy is the same
     * picture: it can only brighten pixels the pot already has, so the shine
     * cannot spill past the rim or sit on the wrong part of the shape, and it
     * needs no mask. Both renderers support ADD, which Phaser's own Shine
     * effect does not - that one is WebGL only, and the game falls back to
     * Canvas on some devices.
     *
     * @param pot    the pot already placed and sized
     * @param key    its texture, so the copy matches exactly
     * @param peak   how bright the shine gets - the full pot is given more
     *               than the empty one, since it is the one worth looking at
     */
    glaze(pot, key, peak){

        const shine = this.add.image(pot.x, pot.y, key)
            .setScale(pot.scale)
            .setBlendMode(Phaser.BlendModes.ADD)
            .setAlpha(0);

        // The empty pots are dulled, and a shine that ignored that would make
        // an unearned slot the brightest thing on the panel.
        if(pot.tintTopLeft !== 0xffffff){

            shine.setTint(pot.tintTopLeft);

        }

        this.tweens.add({
            targets: shine,
            alpha: peak,
            duration: GLAZE_MS,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut"
        });

        return shine;

    }

    //------------------------------------------------

    /**
     * Android's back button goes up a screen, to the level list, rather
     * than closing the app. Only the home screen, where there is
     * nowhere further up, asks about leaving.
     */
    onBackButton(){

        // The share card is the frontmost thing while it is up, so back
        // closes that instead of walking out of the screen underneath it.
        if(this.__victoryClose){

            this.__victoryClose();

            return;

        }

        this.scene.start("LevelSelectScene", {
            world: LevelManager.worldOf(this.level)
        });

    }

}
