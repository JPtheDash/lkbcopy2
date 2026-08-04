import Phaser from "phaser";
import { loadImage } from "../ui/loader";
import AudioManager from "../managers/AudioManager";

import homeBackground from "../assets/backgrounds/home_background.jpg";
import levelButton from "../assets/ui/level_button.png";
import levelButtonLocked from "../assets/ui/level_button_locked.png";
import lockIcon from "../assets/ui/lock.png";
import starFull from "../assets/ui/star_full.png";
import starEmpty from "../assets/ui/star_empty.png";
import homeButtonImg from "../assets/ui/home_button.png";
import levelBanner from "../assets/ui/level_banner.png";

import LevelManager from "../managers/LevelManager";
import { fitWidth, GAME_WIDTH, GAME_HEIGHT , coverScreen} from "../ui/layout";

const COLUMNS = 3;
const BUTTON_WIDTH = 130;
const SPACING_X = 200;
const SPACING_Y = 230;
const START_Y = 470;

export default class LevelSelectScene extends Phaser.Scene {

    constructor() {
        super("LevelSelectScene");
    }

    preload() {

        AudioManager.preload(this);

        loadImage(this, "background", homeBackground);
        loadImage(this, "levelButton", levelButton);
        loadImage(this, "levelButtonLocked", levelButtonLocked);
        loadImage(this, "lock", lockIcon);
        loadImage(this, "starFull", starFull);
        loadImage(this, "starEmpty", starEmpty);
        loadImage(this, "homeButton", homeButtonImg);
        loadImage(this, "levelBanner", levelBanner);

    }

    create() {

        AudioManager.startMusic(this, "menu");

        coverScreen(this.add.image(0, 0, "background"));

        this.add.rectangle(
            GAME_WIDTH/2, GAME_HEIGHT/2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.5
        );

        // The heading sat as bare text on the sky, which read as a caption
        // rather than as part of the game. It gets the same carved banner the
        // level-complete screen puts its title on, so the two screens agree.
        const banner = fitWidth(
            this.add.image(GAME_WIDTH/2, 170, "levelBanner"),
            560
        );

        // The plaque is not centred in its own picture - the hanging rings at
        // the top are part of the art - so the caption is placed against the
        // banner rather than against the screen.
        const heading = this.add.text(
            GAME_WIDTH/2,
            banner.y - banner.displayHeight * 0.03,
            "SELECT LEVEL",
            {
                fontFamily: "Arial",
                fontSize: "48px",
                fontStyle: "bold",
                color: "#FFD54A",
                stroke: "#5A2D0C",
                strokeThickness: 6
            }
        ).setOrigin(0.5);

        // Two words do not fit the carved panel at the size one word does, and
        // "SELECT LEVEL" ran straight over the scrollwork at both ends. Rather
        // than pick a font size that happens to suit this string, it is shrunk
        // to fit the wood - which also holds if the text is ever translated.
        const room = banner.displayWidth * 0.56;

        if(heading.width > room){

            heading.setScale(room / heading.width);

        }

        const levels = LevelManager.getLevels();

        // Centre each row on the screen rather than measuring from an edge,
        // so a partly filled last row still sits centred.
        levels.forEach((level,index)=>{

            const col = index % COLUMNS;
            const row = Math.floor(index / COLUMNS);

            const inRow = Math.min(levels.length - row * COLUMNS, COLUMNS);

            const rowWidth = (inRow - 1) * SPACING_X;

            const x = GAME_WIDTH/2 - rowWidth/2 + col * SPACING_X;
            const y = START_Y + row * SPACING_Y;

            const button = fitWidth(
                this.add.image(
                    x,
                    y,
                    level.unlocked ? "levelButton" : "levelButtonLocked"
                ),
                BUTTON_WIDTH
            );

            if(level.unlocked){

                this.add.text(
                    x,
                    y - 4,
                    level.id,
                    {
                        fontFamily: "Arial",
                        fontSize: "44px",
                        fontStyle: "bold",
                        color: "#FFFFFF",
                        stroke: "#000000",
                        strokeThickness: 4
                    }
                ).setOrigin(0.5);

                button.setInteractive({ useHandCursor: true });

                button.on("pointerdown",()=>{

                    AudioManager.play(this,"click");

                    this.scene.start("GameScene", { level: level.id });

                });

                // Best result so far, three slots under the button
                for(let i=0;i<3;i++){

                    const earned = i < level.stars;

                    const star = fitWidth(
                        this.add.image(
                            x - 38 + i * 38,
                            y + 84,
                            earned ? "starFull" : "starEmpty"
                        ),
                        34
                    );

                    // The empty art is nearly as bright as the full one, so
                    // knock it back to read as "not earned yet"
                    if(!earned){

                        star.setTint(0xb9b0a2).setAlpha(0.95);

                    }

                }

            }
            else{

                // The locked button art carries no padlock of its own
                fitWidth(
                    this.add.image(x, y, "lock"),
                    52
                );

            }

        });

        //---------------------------------
        // Back to home
        //---------------------------------

        const home = fitWidth(
            this.add.image(GAME_WIDTH/2, GAME_HEIGHT - 150, "homeButton"),
            110
        ).setInteractive({ useHandCursor: true });

        home.on("pointerdown",()=>{

            AudioManager.play(this,"click");

            this.scene.start("HomeScene");

        });

    }

    //------------------------------------------------

    /**
     * Android's back button goes up a screen, to the home screen, rather
     * than closing the app. Only the home screen, where there is
     * nowhere further up, asks about leaving.
     */
    onBackButton(){

        this.scene.start("HomeScene");

    }

}
