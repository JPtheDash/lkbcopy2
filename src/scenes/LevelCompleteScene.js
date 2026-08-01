import Phaser from "phaser";

import happyKrishna from "../assets/ui/krishna_happy_butter.png";
import starEmpty from "../assets/ui/star_empty.png";
import nextButton from "../assets/ui/next_button.png";
import starFull from "../assets/ui/star_full.png";
import homeBackground from "../assets/backgrounds/home_background.png";
import SaveManager from "../managers/SaveManager";

export default class LevelCompleteScene extends Phaser.Scene{

    constructor(){

        super("LevelCompleteScene");

    }

    preload(){

        this.load.image("happyKrishna",happyKrishna);
        this.load.image("starEmpty",starEmpty);
        this.load.image("starFull",starFull);
        this.load.image("nextButton",nextButton);
        this.load.image("homeBackground", homeBackground);

    }

   create(data){

    this.add.image(
        360,
        640,
        "homeBackground"
    )
    .setDisplaySize(720,1280)
    .setDepth(-10);

    SaveManager.saveStars(
    data.level,
    data.stars
);

    this.add.rectangle(
        360,
        640,
        720,
        1280,
        0x000000,
        0.65
    );

    this.add.text(
        360,
        90,
        "LEVEL COMPLETE!",
        {
            fontSize:"56px",
            color:"#FFD54A",
            fontStyle:"bold"
        }
    ).setOrigin(0.5);

    //---------------------------------
    // Happy Krishna
    //---------------------------------

    const krishna = this.add.image(
        360,
        340,
        "happyKrishna"
    )
    .setScale(0.55);

    this.tweens.add({

        targets: krishna,

        y: 348,

        duration:800,

        yoyo:true,

        repeat:-1,

        ease:"Sine.easeInOut"

    });

    //---------------------------------
    // Time Left
    //---------------------------------

    this.add.text(

        360,

        885,

        `Time Left : ${data.timeLeft}s`,

        {

            fontSize:"34px",

            color:"#FFFFFF"

        }

    ).setOrigin(0.5);

    //---------------------------------
    // Stars
    //---------------------------------

    const delay = 450;

    for(let i=0;i<3;i++){

        const x = 240 + i * 120;
        const y = 700;

        this.add.image(
            x,
            y,
            "starEmpty"
        ).setScale(0.26);

        if(i < data.stars){

            const star = this.add.image(
                x,
                y,
                "starFull"
            );

            star.setScale(0);

            this.time.delayedCall(

                i * delay,

                ()=>{

                    this.tweens.add({

                        targets:star,

                        scale:0.42,

                        duration:350,

                        ease:"Back.Out",

                        onComplete:()=>{

                            this.tweens.add({

                                targets:star,

                                angle:10,

                                duration:100,

                                yoyo:true,

                                repeat:1

                            });

                        }

                    });

                }

            );

        }

    }

    //---------------------------------
    // Next Button
    //---------------------------------

    const next = this.add.image(

        360,

        1080,

        "nextButton"

    )
    .setScale(0.45);

    next.setInteractive();

    this.add.text(

        360,

        1070,

        "NEXT",

        {

            fontSize:"34px",

            color:"#FFFFFF",

            fontStyle:"bold"

        }

    ).setOrigin(0.5);

    this.tweens.add({

        targets:next,

        scale:0.50,

        duration:700,

        yoyo:true,

        repeat:-1,

        ease:"Sine.easeInOut"

    });

    next.on("pointerdown",()=>{

        this.scene.start("GameScene");

    });

}


}