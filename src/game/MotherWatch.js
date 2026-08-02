import Phaser from "phaser";
import AudioManager from "../managers/AudioManager";
import { GAME_WIDTH, GAME_HEIGHT } from "../ui/layout";

/**
 * Yashoda looking in on the room.
 *
 * The rhythm is: a warning, a gap to react in, then she is there. She checks
 * once on arrival and keeps checking for as long as she stays, so ducking
 * behind a pot and immediately leaving does not count - the player has to
 * stay put and lose the climbing time.
 *
 * She is drawn as a shadow falling across the room rather than as a figure.
 * That is deliberate: there is no art for her, and a sweeping shadow reads as
 * "someone is at the door" without pretending to be a character. If a
 * `yashoda` texture is ever loaded, it is used instead and the shadow becomes
 * the light she casts.
 */

// She has to be visible for a moment before she can catch anyone, or being
// caught has no cause the player can see.
const ARRIVE_MS = 420;

// Gap after she leaves before the next warning can be scheduled
const SETTLE_MS = 900;

const SHADOW_COLOUR = 0x1a0c02;
const SHADOW_ALPHA = 0.62;

export default class MotherWatch {

    /**
     * @param scene   the GameScene; needs isHidden(), caughtByMother() and a
     *                krishna to point the camera shake at
     * @param config  from the level: { visits, warning, watch, jitter }
     */
    constructor(scene, config = {}){

        this.scene = scene;

        this.visits = config.visits ?? 1;
        this.warning = config.warning ?? 2400;
        this.watch = config.watch ?? 1300;

        // Levels late in the game stop announcing themselves on a timetable
        this.jitter = config.jitter ?? 0;

        this.done = 0;
        this.state = "idle";
        this.timers = [];

        this.build();

    }

    //------------------------------------------------

    build(){

        const parts = [];

        // Darkens the room while she is in it
        this.shadow = this.scene.add
            .rectangle(
                GAME_WIDTH/2, GAME_HEIGHT/2,
                GAME_WIDTH, GAME_HEIGHT,
                SHADOW_COLOUR, SHADOW_ALPHA
            )
            .setAlpha(0);

        parts.push(this.shadow);

        if(this.scene.textures.exists("yashoda")){

            this.figure = this.scene.add
                .image(GAME_WIDTH/2, GAME_HEIGHT, "yashoda")
                .setOrigin(0.5, 1)
                .setAlpha(0);

            parts.push(this.figure);

        }

        this.banner = this.scene.add
            .text(
                GAME_WIDTH/2, 300,
                "MOTHER IS COMING!",
                {
                    fontFamily: "Arial",
                    fontSize: "46px",
                    fontStyle: "bold",
                    color: "#FFE9A8",
                    stroke: "#7A1010",
                    strokeThickness: 8,
                    align: "center"
                }
            )
            .setOrigin(0.5)
            .setAlpha(0);

        parts.push(this.banner);

        this.parts = parts;

        // Pinned to the camera individually rather than held in a Container:
        // Phaser hit-tests and positions container children against camera
        // scroll, which puts anything inside one in the wrong place once the
        // level starts scrolling.
        this.parts.forEach(part => part.setScrollFactor(0).setDepth(280));

    }

    //------------------------------------------------

    start(){

        if(this.visits < 1){

            return;

        }

        // Spread the visits over the level rather than bunching them at the
        // start, and never open with one before the player has moved.
        const span = (this.scene.totalTime || 60) * 1000;
        const slot = span / (this.visits + 1);

        for(let i = 0; i < this.visits; i++){

            const at = slot * (i + 1)
                + (this.jitter ? Phaser.Math.Between(-this.jitter, this.jitter) : 0);

            this.after(Math.max(2500, at), ()=> this.warn());

        }

    }

    //------------------------------------------------

    /** A timer that is remembered, so stop() can cancel everything cleanly. */
    after(delay, fn){

        const timer = this.scene.time.delayedCall(delay, fn);

        this.timers.push(timer);

        return timer;

    }

    //------------------------------------------------

    warn(){

        if(this.scene.isGameOver || this.state !== "idle"){

            return;

        }

        this.state = "warning";

        AudioManager.play(this.scene, "lose");

        this.scene.showHideSpots(true);

        this.banner.setAlpha(1).setScale(0.7);

        this.scene.tweens.add({
            targets: this.banner,
            scale: 1,
            duration: 260,
            ease: "Back.Out"
        });

        // Pulse so it reads as urgent for the whole reaction window rather
        // than appearing once and sitting there
        this.scene.tweens.add({
            targets: this.banner,
            alpha: 0.45,
            duration: 260,
            yoyo: true,
            repeat: -1
        });

        this.after(this.warning, ()=> this.arrive());

    }

    //------------------------------------------------

    arrive(){

        if(this.scene.isGameOver){

            return;

        }

        this.state = "watching";

        this.scene.tweens.killTweensOf(this.banner);
        this.banner.setAlpha(0);

        this.scene.tweens.add({
            targets: this.shadow,
            alpha: 1,
            duration: ARRIVE_MS,
            ease: "Sine.easeIn"
        });

        if(this.figure){

            this.figure.setAlpha(0).setY(GAME_HEIGHT + 120);

            this.scene.tweens.add({
                targets: this.figure,
                alpha: 1,
                y: GAME_HEIGHT,
                duration: ARRIVE_MS,
                ease: "Quad.easeOut"
            });

        }

        this.scene.cameras.main.shake(220, 0.004);

        this.after(this.watch, ()=> this.leave());

    }

    //------------------------------------------------

    leave(){

        if(this.scene.isGameOver){

            return;

        }

        this.state = "leaving";

        this.scene.showHideSpots(false);

        this.scene.tweens.add({
            targets: [this.shadow, this.figure].filter(Boolean),
            alpha: 0,
            duration: 340,
            onComplete: ()=>{

                this.state = "idle";
                this.done++;

            }
        });

        AudioManager.play(this.scene, "star");

        this.after(SETTLE_MS, ()=>{

            if(this.state === "leaving"){

                this.state = "idle";

            }

        });

    }

    //------------------------------------------------

    /**
     * Called every frame by the scene. Only meaningful while she is actually
     * in the room - the check runs continuously so that leaving cover early
     * is caught too, not just being out in the open when she walks in.
     */
    update(){

        if(this.state !== "watching" || this.scene.isGameOver){

            return;

        }

        if(!this.scene.isHidden()){

            this.scene.caughtByMother();

        }

    }

    //------------------------------------------------

    stop(){

        this.timers.forEach(t => t.remove(false));
        this.timers = [];
        this.state = "done";

    }

}
