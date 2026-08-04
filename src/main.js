import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "./ui/layout";
import { attachAppLifecycle, exitApp } from "./managers/AppLifecycle";
import confirmDialog from "./ui/ConfirmDialog";
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

    // The height comes from the phone, so FIT has nothing left to letterbox.
    // See canvasHeight() in ui/layout.js.
    width: GAME_WIDTH,
    height: GAME_HEIGHT,

    parent: "game-container",

    // Shows only if the aspect is beyond what canvasHeight() will follow, and
    // then it is the room's plaster rather than black.
    backgroundColor: "#2a1403",

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

// Silences the game when it leaves the screen, and answers the back button.
// Scenes that want their own back behaviour define onBackButton(); anything
// that does not falls through to here, which asks before leaving.
attachAppLifecycle(game, {

    onExitRequest: scene => {

        if(!scene){

            exitApp();

            return;

        }

        confirmDialog(scene, {
            message: "Leave the game?",
            confirmText: "EXIT",
            cancelText: "STAY",
            onConfirm: exitApp
        });

    }

});