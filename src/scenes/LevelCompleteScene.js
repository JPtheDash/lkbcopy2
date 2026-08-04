import Phaser from "phaser";
import { loadImage } from "../ui/loader";
import AudioManager from "../managers/AudioManager";
import LevelManager from "../managers/LevelManager";
import SaveManager from "../managers/SaveManager";

import happyKrishna from "../assets/ui/krishna_happy_butter.png";
import starEmpty from "../assets/ui/star_empty.png";
import starFull from "../assets/ui/star_full.png";
import nextButton from "../assets/ui/next_button.png";
import replayButtonImg from "../assets/ui/replay_button.png";
import homeButtonImg from "../assets/ui/home_button.png";
import levelBanner from "../assets/ui/level_banner.png";
import starPanel from "../assets/ui/star_panel.png";
import ribbonPerfect from "../assets/ui/ribbon_perfect.png";
import homeBackground from "../assets/backgrounds/home_background.jpg";

import { fitWidth, fitHeight, GAME_WIDTH, GAME_HEIGHT , coverScreen} from "../ui/layout";

const STAR_DELAY = 400;

export default class LevelCompleteScene extends Phaser.Scene{

    constructor(){
        super("LevelCompleteScene");
    }

    preload(){

        AudioManager.preload(this);

        loadImage(this, "happyKrishna", happyKrishna);
        loadImage(this, "starEmpty", starEmpty);
        loadImage(this, "starFull", starFull);
        loadImage(this, "nextButton", nextButton);
        loadImage(this, "replayButton", replayButtonImg);
        loadImage(this, "homeButton", homeButtonImg);
        loadImage(this, "levelBanner", levelBanner);
        loadImage(this, "starPanel", starPanel);
        loadImage(this, "ribbon", ribbonPerfect);
        loadImage(this, "homeBackground", homeBackground);

    }

    create(data){

        // Back out of the climb's music now the level is over
        AudioManager.startMusic(this, "menu");

        coverScreen(this.add.image(0, 0, "homeBackground"))
            .setDepth(-10);

        this.add.rectangle(
            GAME_WIDTH/2, GAME_HEIGHT/2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6
        );

        SaveManager.saveStars(data.level, data.stars);

        AudioManager.play(this,"win");

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
        // Stars
        //---------------------------------

        const panelY = 770;

        fitWidth(
            this.add.image(GAME_WIDTH/2, panelY, "starPanel"),
            460
        );

        // Sit above the small stars painted into the panel art
        const starY = panelY - 30;

        for(let i=0;i<3;i++){

            const x = GAME_WIDTH/2 - 120 + i * 120;

            fitWidth(
                this.add.image(x, starY, "starEmpty"),
                92
            ).setTint(0xb9b0a2).setAlpha(0.95);

            if(i < data.stars){

                const star = fitWidth(
                    this.add.image(x, starY, "starFull"),
                    92
                );

                const full = star.scale;

                star.setScale(0);

                this.time.delayedCall(i * STAR_DELAY, ()=>{

                    AudioManager.play(this,"star");

                    this.tweens.add({

                        targets: star,

                        scale: full,

                        duration: 350,

                        ease: "Back.Out",

                        onComplete: ()=>{

                            this.tweens.add({
                                targets: star,
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

                this.scene.start("LevelSelectScene");

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
     * Android's back button goes up a screen, to the level list, rather
     * than closing the app. Only the home screen, where there is
     * nowhere further up, asks about leaving.
     */
    onBackButton(){

        this.scene.start("LevelSelectScene");

    }

}
