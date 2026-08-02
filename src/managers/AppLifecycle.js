import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

/**
 * The two things a packaged Android app has to do that a web page does not:
 * go quiet when it is not on screen, and answer the back button.
 *
 * Both are wired once, against the running Phaser game, rather than per
 * scene - a scene that happens to be mid-transition when the phone is
 * pocketed would otherwise miss the event entirely.
 */

let game = null;
let confirmExit = null;

/**
 * Silence everything, and remember whether it was playing.
 *
 * Music was still audible after the game was sent to the background: it is
 * owned by the global sound manager, which no scene shuts down, and Phaser's
 * own pause-on-blur never fires because an Android WebView does not blur when
 * its activity stops. So the platform has to say so, and it does.
 */
/** Whichever scene is on top, which is the one that should be told. */
function frontScene(){

    if(!game){

        return null;

    }

    const visible = game.scene.getScenes(true).filter(s => s.scene.isVisible());

    return visible[visible.length - 1] || null;

}

function goQuiet(){

    if(!game){

        return;

    }

    game.sound.pauseAll();

    // Halting the whole game loop looked tidier and did nothing: this build
    // of Phaser's TimeStep has no `paused` flag at all, so the guard around
    // it was reading undefined and frames kept advancing regardless. The
    // scene is asked to pause itself instead, through the same path its own
    // pause button uses - which is the one that is actually exercised.
    const scene = frontScene();

    if(scene && typeof scene.onAppBackground === "function"){

        scene.onAppBackground();

    }

}

function comeBack(){

    if(!game){

        return;

    }

    game.sound.resumeAll();

}

/**
 * Android's back button.
 *
 * Without a handler Capacitor closes the app on the first press, which is
 * how a level got thrown away by a mis-tap. Now every scene may answer for
 * itself, and only the home screen - where back really does mean leave -
 * asks whether that is meant.
 */
function onBack(){

    if(!game){

        return;

    }

    const scene = frontScene();

    if(scene && typeof scene.onBackButton === "function"){

        scene.onBackButton();

        return;

    }

    if(confirmExit){

        confirmExit(scene);

    }

}

export function attachAppLifecycle(phaserGame, { onExitRequest } = {}){

    game = phaserGame;
    confirmExit = onExitRequest;

    // The browser still gets the visibility change, which covers running the
    // game in a tab and costs nothing in the app.
    document.addEventListener("visibilitychange", ()=>{

        if(document.hidden){

            goQuiet();

        }
        else{

            comeBack();

        }

    });

    if(!Capacitor.isNativePlatform()){

        return;

    }

    App.addListener("appStateChange", ({ isActive })=>{

        if(isActive){

            comeBack();

        }
        else{

            goQuiet();

        }

    });

    // Fires when the activity is actually going away, which is the last
    // chance to stop the audio thread rather than merely pause it.
    App.addListener("pause", ()=> game && game.sound.stopAll());

    App.addListener("backButton", onBack);

}

export function exitApp(){

    if(game){

        game.sound.stopAll();

    }

    if(Capacitor.isNativePlatform()){

        App.exitApp();

    }

}
