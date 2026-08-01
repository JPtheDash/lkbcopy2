import Phaser from "phaser";

import krishnaIdle from "../assets/characters/krishna_idle.png";
import roomBackground from "../assets/backgrounds/room_background.png";
import butterPot from "../assets/items/butter_pot.png";
import platformImg from "../assets/platforms/platform.png";
import leftButtonImg from "../assets/ui/left_button.png";
import rightButtonImg from "../assets/ui/right_button.png";
import jumpButtonImg from "../assets/ui/jump_button.png";
import getStars from "../ui/StarReward";

export default class GameScene extends Phaser.Scene {

    constructor() {
        super("GameScene");
    }

    preload() {

        this.load.image("room", roomBackground);
        this.load.image("krishna", krishnaIdle);
        this.load.image("platform", platformImg);
        this.load.image("butter", butterPot);

        this.load.image("leftButton", leftButtonImg);
        this.load.image("rightButton", rightButtonImg);
        this.load.image("jumpButton", jumpButtonImg);

    }

    create(data) {

        //-------------------------
        // Background
        //-------------------------
         this.level = data.level || 1;

        this.add.image(360,640,"room")
            .setDisplaySize(720,1280)
            .setDepth(-10);

        //-------------------------
        // FLOOR
        //-------------------------

        this.floor = this.physics.add.staticGroup();

        this.floor.create(360,1240,null)
            .setDisplaySize(720,80)
            .refreshBody();

        //-------------------------
        // Platforms
        //-------------------------

        this.platforms = [];

const positions = [
    [170,1040],
    [550,880],
    [180,700],
    [540,520],
    [360,320]
];

positions.forEach(([x,y])=>{

    const p = this.physics.add.staticImage(
        x,
        y,
        "platform"
    );

    p.setScale(0.32);

    p.refreshBody();

    // VERY THIN collision strip
  p.body.setSize(460, 24);
  p.body.setOffset(16, 120);
  this.platforms.push(p);

});

        //-------------------------
        // Krishna
        //-------------------------

        this.krishna = this.physics.add.sprite(
    120,
    1090,
    "krishna"
);

this.krishna.setScale(0.42);

this.krishna.setCollideWorldBounds(true);

this.krishna.setBounce(0);

this.krishna.setGravityY(1800);

this.krishna.setDragX(1000);

this.krishna.setMaxVelocity(400,1000);

// IMPORTANT
// Move collision body to the feet
this.krishna.body.setSize(300, 120);
this.krishna.body.setOffset(360, 810);
        //-------------------------
        // Butter
        //-------------------------

        this.butter = this.physics.add.staticImage(
            360,
            170,
            "butter"
        );

        this.butter.setScale(.22);

        this.butter.refreshBody();

        //-------------------------
        // Physics
        //-------------------------

        this.physics.add.collider(
            this.krishna,
            this.floor
        );

        this.platforms.forEach(platform=>{

    this.physics.add.collider(
        this.krishna,
        platform
    );

});

        this.physics.add.overlap(
            this.krishna,
            this.butter,
            ()=>{

                this.physics.pause();

this.gameTimer.remove();

const stars = getStars(this.timeLeft);

this.physics.pause();

this.scene.start(
    "LevelCompleteScene",
    {
        stars,
        timeLeft: this.timeLeft,
        level: this.level
    }
);

            }
        );

        //------------------------------------------------
// TIMER
//------------------------------------------------

this.timeLeft = 30;

this.timerText = this.add.text(
    620,
    35,
    "00:30",
    {
        fontFamily: "Arial",
        fontSize: "34px",
        fontStyle: "bold",
        color: "#FFFFFF",
        backgroundColor: "#C0392B",
        padding: {
            left: 14,
            right: 14,
            top: 8,
            bottom: 8
        }
    }
);

this.timerText
    .setOrigin(0.5, 0)
    .setDepth(200)
    .setScrollFactor(0);

this.gameTimer = this.time.addEvent({

    delay: 1000,

    loop: true,

    callback: () => {

        this.timeLeft--;

        const seconds = this.timeLeft
            .toString()
            .padStart(2, "0");

        this.timerText.setText(`00:${seconds}`);

        if (this.timeLeft <= 10) {

            this.timerText.setColor("#FFFF00");

        }

        if (this.timeLeft <= 5) {

            this.timerText.setColor("#FF4444");

            this.tweens.add({

                targets: this.timerText,

                scale: 1.15,

                duration: 120,

                yoyo: true

            });

        }

        if (this.timeLeft <= 0) {

            this.gameOver();

        }

    }

});

        //-------------------------
        // Keyboard
        //-------------------------

        this.cursors =
            this.input.keyboard.createCursorKeys();

        //-------------------------
        // Mobile Controls
        //-------------------------

        this.leftPressed=false;
        this.rightPressed=false;
        this.jumpPressed=false;

        this.createButton(
            95,
            "leftButton",
            ()=>this.leftPressed=true,
            ()=>this.leftPressed=false
        );

        this.createButton(
            225,
            "rightButton",
            ()=>this.rightPressed=true,
            ()=>this.rightPressed=false
        );

        this.createButton(
            620,
            "jumpButton",
            ()=>this.jumpPressed=true,
            ()=>this.jumpPressed=false
        );
        

    }

    //------------------------------------------------

    makePlatform(x,y){

        // Decorative image
        this.add.image(
            x,
            y,
            "platform"
        ).setScale(0.32);

        // Invisible collision box
        const body=this.platforms.create(
            x,
            y-6,
            null
        );

        body.setDisplaySize(
            280,
            18
        );

        body.refreshBody();

    }

    //------------------------------------------------

    createButton(x,key,down,up){

        const b=this.add.image(
            x,
            1160,
            key
        );

        b.setScale(.18);

        b.setScrollFactor(0);

        b.setDepth(100);

        b.setInteractive();

        b.on("pointerdown",down);

        b.on("pointerup",up);

        b.on("pointerout",up);

    }

    //------------------------------------------------
    //------------------------------------------------

gameOver(){

    this.physics.pause();

    this.gameTimer.remove();

    this.add.rectangle(
        360,
        640,
        720,
        1280,
        0x000000,
        0.6
    );

    this.add.text(
        360,
        520,
        "TIME'S UP!",
        {
            fontSize: "60px",
            color: "#FFFFFF",
            fontStyle: "bold"
        }
    ).setOrigin(0.5);

    const restart = this.add.text(
        360,
        700,
        "Play Again",
        {
            fontSize: "38px",
            color: "#FFFFFF",
            backgroundColor: "#D35400",
            padding: {
                left: 22,
                right: 22,
                top: 10,
                bottom: 10
            }
        }
    ).setOrigin(0.5);

    restart.setInteractive({ useHandCursor: true });

    restart.on("pointerdown", () => {

        this.scene.restart();

    });

}

    update(){

        const speed=340;

        if(this.cursors.left.isDown || this.leftPressed){

            this.krishna.setVelocityX(-speed);

            this.krishna.flipX=true;

        }

        else if(this.cursors.right.isDown || this.rightPressed){

            this.krishna.setVelocityX(speed);

            this.krishna.flipX=false;

        }

        else{

            this.krishna.setVelocityX(0);

        }

       const grounded =
    this.krishna.body.blocked.down ||
    this.krishna.body.touching.down;

if(
    (Phaser.Input.Keyboard.JustDown(this.cursors.up) || this.jumpPressed)
    &&
    grounded
){
    this.krishna.setVelocityY(-1000);
}

//this.jump=false;

        this.jumpPressed=false;

    }

}