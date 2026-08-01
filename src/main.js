import Phaser from "phaser";
import HomeScene from "./scenes/HomeScene";
import GameScene from "./scenes/GameScene";
import LevelCompleteScene from "./scenes/LevelCompleteScene";
import LevelSelectScene from "./scenes/LevelSelectScene";

const config = {

    type: Phaser.AUTO,

    width: 720,
    height: 1280,

    parent: "game-container",

    backgroundColor: "#000000",

    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },

   physics:{
    default:"arcade",
    arcade:{
        gravity:{
            y:0
        },
        debug:false
    }
},

    scene: [

    HomeScene,

    LevelSelectScene,

    GameScene,

    LevelCompleteScene

]
};

new Phaser.Game(config);