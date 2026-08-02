import Phaser from "phaser";
import HomeScene from "./scenes/HomeScene";
import GameScene from "./scenes/GameScene";
import LevelCompleteScene from "./scenes/LevelCompleteScene";
import LevelSelectScene from "./scenes/LevelSelectScene";

// Headless Chromium falls back to software WebGL and crawls at ~8fps, which
// makes automated play tests useless. ?renderer=canvas lets the tools in
// tools/ ask for the canvas renderer instead. Normal players never hit this.
const forceCanvas =
    typeof window !== "undefined" &&
    window.location.search.includes("renderer=canvas");

const config = {

    type: forceCanvas ? Phaser.CANVAS : Phaser.AUTO,

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

const game = new Phaser.Game(config);

// Handle for tools/screenshot.mjs to drive scenes directly
window.__game = game;