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
 * She crosses the room, in two poses: walking while she is looking round it,
 * and arms-folded and glaring the moment she catches him. She used to be a
 * sweeping shadow and a banner, because there was no art for her; the shadow
 * stays as the gloom she brings with her.
 *
 * She walks the whole way across - in past the left edge and out past the
 * right - rather than arriving at a spot and standing on it. Standing still
 * read as appearing rather than walking, because the fade-in was doing the
 * work the movement should have been doing.
 */

// She has to be visible for a moment before she can catch anyone, or being
// caught has no cause the player can see.
const ARRIVE_MS = 420;

// Gap after she leaves before the next warning can be scheduled
const SETTLE_MS = 900;

const SHADOW_COLOUR = 0x1a0c02;
const SHADOW_ALPHA = 0.62;

// She is an adult beside a boy drawn at 216, and she has to read from across
// a scrolling room.
const MOTHER_HEIGHT = 470;

// She stops dead where she caught sight of him, which on a crossing can be
// right at an edge with half of her off the screen. This is how far in she is
// brought to glare, as a fraction of the width - the angry drawing is the
// entire reason the beat exists, so it has to be looked at.
const CAUGHT_MARGIN = 0.26;

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

        // Stood on the bottom of the screen rather than centred on it, so she
        // is on the floor of the room whatever height the phone gives us.
        if(this.scene.textures.exists("motherWalking")){

            // Parked off the left edge, which is where every crossing starts
            // from. arrive() places her properly; this only has to be
            // somewhere she cannot be seen sitting before her first visit.
            this.figure = this.scene.add
                .image(-GAME_WIDTH, GAME_HEIGHT, "motherWalking")
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

    /**
     * Swap which drawing of her is showing, and size it.
     *
     * The scale is recomputed every time rather than kept, because the two
     * poses are not drawn at the same size in their source files - walking
     * crops to 393x648 and arms-folded to 450x486. Reusing one scale would
     * make her jump a head shorter at the very moment she is meant to loom.
     */
    setPose(key){

        if(!this.figure || !this.scene.textures.exists(key)){

            return;

        }

        this.figure.setTexture(key);
        this.figure.setScale(MOTHER_HEIGHT / this.figure.height);

    }

    //------------------------------------------------

    /**
     * She has him. Called by the scene the frame he is seen, before the game
     * over screen lands, so there is a beat of her actually being angry.
     */
    showCaught(){

        if(!this.figure){

            return;

        }

        this.state = "caught";

        // Stops her mid-stride, wherever across the room she had got to
        this.scene.tweens.killTweensOf(this.figure);

        this.setPose("motherAngry");

        this.figure.setAlpha(1);

        // Read after the pose swap, which recomputes it
        const resting = this.figure.scale;

        // She holds the spot she saw him from rather than sliding to a mark,
        // so the stop is what reads as the reaction. Clamped only when that
        // spot is close enough to an edge to cut her in half.
        const x = Phaser.Math.Clamp(
            this.figure.x,
            GAME_WIDTH * CAUGHT_MARGIN,
            GAME_WIDTH * (1 - CAUGHT_MARGIN)
        );

        // Swells as she turns, so the change of pose reads as a reaction
        // rather than as one picture being swapped for another
        this.scene.tweens.add({
            targets: this.figure,
            scale: resting * 1.16,
            x,
            duration: 260,
            ease: "Back.Out"
        });

        this.scene.tweens.add({
            targets: this.shadow,
            alpha: 1,
            duration: 200
        });

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

            // Walks the room from left to right along the floor, rather than
            // rising up through it - she is coming through, not surfacing.
            this.setPose("motherWalking");

            const half = this.figure.displayWidth/2;

            // Already at full opacity, starting off the edge. Fading her up
            // is what made her read as appearing: she was solid before she
            // had gone anywhere, so the walk looked like decoration on top of
            // a pop rather than the thing bringing her in.
            this.figure
                .setAngle(0)
                .setAlpha(1)
                .setY(GAME_HEIGHT)
                .setX(-half);

            // Linear, and spanning exactly the window she is dangerous for.
            // An eased tween would have her drifting to a halt in the middle
            // of the floor, which is the standing-still this replaced; and
            // tying the crossing to `watch` keeps "she is on screen" and "she
            // can catch you" the same statement, so nothing has to be
            // rebalanced against the timings playtest.mjs measured.
            this.scene.tweens.add({
                targets: this.figure,
                x: GAME_WIDTH + half,
                duration: this.watch,
                ease: "Linear"
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
