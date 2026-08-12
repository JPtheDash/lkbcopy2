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
 *
 * The crossing is longer than the window she can catch anyone in: she is
 * already stepping in before it opens and still walking out after it closes.
 * That is what lets her walk at a believable pace without making her any more
 * or less dangerous than the levels were balanced for.
 */

// She has to be visible for a moment before she can catch anyone, or being
// caught has no cause the player can see.
const ARRIVE_MS = 420;

// How long she is stepping in for before she starts looking, and how long she
// takes to walk out afterwards.
//
// Both sit OUTSIDE the watch window, which is what slows her down without
// touching the difficulty: crossing in `watch` alone put her at a full pixel
// per millisecond, which is a run rather than a walk. Spreading the same
// journey over lead + watch + tail more than halves that, and the window she
// can actually catch anyone in is still exactly `watch`, so none of the
// timings playtest.mjs measured have to be rebalanced.
//
// The lead is short and the tail is long on purpose. Being on screen but
// harmless is only intuitive if she is visibly still arriving or visibly
// leaving; 400ms puts barely a shoulder of her past the edge before she is
// dangerous, while the tail is time spent walking away.
const WALK_LEAD_MS = 400;
const WALK_TAIL_MS = 800;

// The stride. There is one drawing of her walking, not a sheet, so the walk
// has to come from how the drawing is moved rather than from frames.
//
// A body rises and falls once per step, and rocks towards whichever foot is
// down. Both are small on purpose: at this size the shapes read from across
// the room, and anything bigger stops looking like walking and starts looking
// like limping. STEP_MS is one half-step, so a full cycle is two of them.
const STEP_MS = 260;
const STEP_RISE = 9;
const STEP_ROCK = 1.8;

// Gap after she leaves before the next warning can be scheduled
const SETTLE_MS = 900;

const SHADOW_COLOUR = 0x1a0c02;
const SHADOW_ALPHA = 0.62;

// She is an adult beside a boy drawn at 216, and she has to read from across
// a scrolling room.
const MOTHER_HEIGHT = 470;

// How much of her is left BELOW the bottom edge of the screen.
//
// There is one drawing of her, not a walk cycle, and her bare feet are drawn
// mid-stride - one flat, one lifted. Everything above the hem can be made to
// look like walking by bobbing it, because that is genuinely what a walking
// body does. Feet cannot: a foot frozen in one shape while the whole figure
// slides across the room is the single thing that gives it away, and it made
// her read as gliding rather than walking.
//
// So the screen edge crops them. 122 is a quarter of her height, which takes
// the feet, the ankles and the bottom of the sari, and leaves her cut off by
// the floor the way a figure walking close to the camera would be.
const SINK = 122;

// Where her feet would be if you could see them.
const STANDS_AT = () => GAME_HEIGHT + SINK;

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
                .image(-GAME_WIDTH, STANDS_AT(), "motherWalking")
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

        // She sets off before she is dangerous, so that the banner is backed
        // up by actually seeing her come through the door.
        this.after(Math.max(0, this.warning - WALK_LEAD_MS), ()=> this.enter());

        this.after(this.warning, ()=> this.arrive());

    }

    //------------------------------------------------

    /**
     * Starts the walk across the room. Not the same moment as arrive(): this
     * is her coming in, that is her starting to look.
     */
    enter(){

        if(this.scene.isGameOver || !this.figure){

            return;

        }

        this.setPose("motherWalking");

        const half = this.figure.displayWidth/2;

        this.scene.tweens.killTweensOf(this.figure);

        // Already at full opacity, starting off the edge. Fading her up is
        // what made her read as appearing: she was solid before she had gone
        // anywhere, so the walk looked like decoration on top of a pop.
        this.figure
            .setAngle(0)
            .setAlpha(1)
            .setY(STANDS_AT())
            .setX(-half);

        // Linear. An eased tween drifts to a halt in the middle of the floor,
        // which is the standing-still this replaced.
        this.scene.tweens.add({
            targets: this.figure,
            x: GAME_WIDTH + half,
            duration: WALK_LEAD_MS + this.watch + WALK_TAIL_MS,
            ease: "Linear",
            onComplete: ()=>{

                this.figure.setAlpha(0);
                this.stopStride();

            }
        });

        this.startStride();

    }

    //------------------------------------------------

    /**
     * The walk itself: a rise and fall, and a rock from foot to foot.
     *
     * Separate tweens from the one carrying her across, so that the crossing
     * stays perfectly linear underneath - a walk is a steady journey with a
     * body bobbing on top of it, not a journey that speeds up and slows down.
     * Sine easing because a stride has no corners in it.
     */
    startStride(){

        this.stopStride();

        const floor = STANDS_AT();

        this.figure.setY(floor).setAngle(0);

        this.stride = [

            this.scene.tweens.add({
                targets: this.figure,
                y: floor - STEP_RISE,
                duration: STEP_MS,
                yoyo: true,
                repeat: -1,
                ease: "Sine.easeInOut"
            }),

            // Twice the period of the rise: she rocks once per full stride,
            // not once per step, or she wobbles like a metronome.
            this.scene.tweens.add({
                targets: this.figure,
                angle: { from: -STEP_ROCK, to: STEP_ROCK },
                duration: STEP_MS * 2,
                yoyo: true,
                repeat: -1,
                ease: "Sine.easeInOut"
            })

        ];

    }

    //------------------------------------------------

    stopStride(){

        this.stride?.forEach(t => t.remove());
        this.stride = null;

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
    showCaught(withFigure = true){

        if(!this.figure){

            return;

        }

        this.state = "caught";

        // Stops her mid-stride, wherever across the room she had got to
        this.scene.tweens.killTweensOf(this.figure);

        // Both feet down and upright. Without this she freezes at whatever
        // point of the stride she happened to be at - mid-bob and tilted -
        // and glares from there, which reads as a dropped frame.
        this.stopStride();
        this.figure.setY(STANDS_AT()).setAngle(0);

        // The scene has a tableau with both of them in it, so she is dropped
        // rather than left standing next to a picture of herself. The gloom
        // stays - it is what the tableau is read against.
        if(!withFigure){

            this.figure.setAlpha(0);

            this.scene.tweens.add({
                targets: this.shadow,
                alpha: 1,
                duration: 200
            });

            return;

        }

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

        // The walk itself was started by enter(), a beat ago, and deliberately
        // is not restarted here - she is already part of the way in.
        if(this.figure && this.figure.alpha === 0){

            // enter() never ran, which happens if a visit is forced straight
            // to arrive(). Put her on screen rather than leave her invisible
            // and uncatchable-looking.
            this.enter();

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

        // Only the gloom lifts. She is still walking, and has the tail of the
        // crossing left to see herself out on - fading her here would have her
        // dissolve in the middle of the floor.
        this.scene.tweens.add({
            targets: this.shadow,
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
        this.stopStride();
        this.state = "done";

    }

}
