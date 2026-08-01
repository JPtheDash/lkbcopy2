import Phaser from "phaser";

import homeBackground from "../assets/backgrounds/home_background.png";
import levelButton from "../assets/ui/level_button.png";
import lockIcon from "../assets/ui/lock.png";

import LevelManager from "../managers/LevelManager";

export default class LevelSelectScene extends Phaser.Scene {

    constructor() {

        super("LevelSelectScene");

    }

    preload() {

        this.load.image(
            "background",
            homeBackground
        );

        this.load.image(
            "levelButton",
            levelButton
        );

        this.load.image(
            "lock",
            lockIcon
        );

    }

    create() {

        this.add.image(
            360,
            640,
            "background"
        ).setDisplaySize(
            720,
            1280
        );

        this.add.rectangle(
            360,
            640,
            720,
            1280,
            0x000000,
            0.45
        );

        this.add.text(

            360,

            90,

            "SELECT LEVEL",

            {

                fontSize:"54px",

                fontStyle:"bold",

                color:"#FFD54A"

            }

        ).setOrigin(.5);

        const levels =
            LevelManager.getLevels();

        const startX = 190;
        const startY = 260;

        const spacingX = 170;
        const spacingY = 190;

        levels.forEach((level,index)=>{

            const col = index % 3;

            const row = Math.floor(index/3);

            const x =
                startX +
                col * spacingX;

            const y =
                startY +
                row * spacingY;

            const button = this.add.image(

                x,

                y,

                "levelButton"

            ).setScale(.30);

            this.add.text(

                x,

                y-6,

                level.id,

                {

                    fontSize:"42px",

                    fontStyle:"bold",

                    color:"#FFFFFF"

                }

            ).setOrigin(.5);

            if(level.unlocked){

                button.setInteractive();

                button.on("pointerdown",()=>{

                    this.scene.start(
                        "GameScene",
                        {
                            level:level.id
                        }
                    );

                });

            }

            else{

                this.add.image(

                    x,

                    y,

                    "lock"

                ).setScale(.20);

            }

        });

    }

}