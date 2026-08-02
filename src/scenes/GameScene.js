import Phaser from "phaser";
import { loadImage } from "../ui/loader";
import { loadKrishna, createKrishnaAnimations, KRISHNA_KEY } from "../ui/krishna";

import wallTile from "../assets/backgrounds/wall_tile.jpg";
import roomBase from "../assets/backgrounds/room_base.jpg";
import butterPot from "../assets/items/butter_pot.png";
import butterDrop from "../assets/items/butter_drop.png";
import krishnaSitting from "../assets/ui/krishna_happy_butter.png";
import platformImg from "../assets/platforms/platform.png";
import platformWood from "../assets/platforms/platform_wood.png";
import platformStone from "../assets/platforms/platform_stone.png";
import platformCracked from "../assets/platforms/platform_cracked.png";
import platformCloud from "../assets/platforms/platform_cloud.png";
import sparkImg from "../assets/fx/spark.png";
import hintSwipeImg from "../assets/ui/hint_swipe.png";
import hintHandImg from "../assets/ui/hint_hand.png";
import pauseButtonImg from "../assets/ui/pause_button.png";
import homeButtonImg from "../assets/ui/home_button.png";
import replayButtonImg from "../assets/ui/replay_button.png";
import playButtonImg from "../assets/ui/play_button.png";
import getStars from "../ui/StarReward";
import AudioManager from "../managers/AudioManager";
import LevelManager from "../managers/LevelManager";
import Levels from "../data/levels";
import { fitWidth, fitHeight, GAME_WIDTH, GAME_HEIGHT, WORLD_HEIGHT, FLOOR_Y } from "../ui/layout";

//-------------------------
// Movement tuning
//-------------------------

const GRAVITY = 1700;
const JUMP_VELOCITY = -900;

// Ground run. Krishna is ~180px tall, so this reads as a brisk walk.
const RUN_SPEED = 300;

// Diagonal jumps need more horizontal push than a ground run. Measured with
// tools/probe.mjs rather than derived: drag and early landings mean a jump
// carries ~0.7x what the textbook projectile figure suggests.
const AIR_SPEED = 480;

const SWIPE_MIN_DISTANCE = 40;
const SWIPE_MAX_TIME = 500;

// How long a swipe keeps steering Krishna
const SWIPE_RUN_DURATION = 320;
const SWIPE_AIR_DURATION = 1200;

//-------------------------
// Sizes, in on-screen px
//-------------------------

const PLATFORM_WIDTH = 300;

// Each kind of ledge gets its own art, so what a platform does is readable
// before you land on it rather than after. These used to be one texture under
// three tints, which mostly read as "the same plank, oddly coloured".
const PLATFORM_TEXTURE = {
    normal: "platform",
    moving: "platform-cloud",
    crumbling: "platform-cracked"
};

// A moving platform still has to sit inside the landing band described in
// levels.js, so it can only stray so far from its nominal x.
const MOVING_RANGE = 60;
const MOVING_DURATION = 2200;

// Crumbling ledge: how long it holds once stood on, and how long until it
// comes back so a level can never become unwinnable. The delay has to exceed
// a jump arc (~1s) plus reaction time, or the ledge is gone before the player
// can act and the level reads as broken rather than hard.
const CRUMBLE_DELAY = 1400;
const CRUMBLE_RESPAWN = 2600;

// Each butter drop buys this many seconds, which feeds the star rating
const DROP_BONUS = 3;

// Forgiveness. Without these a swipe a few frames early or late is simply
// eaten, which reads as the controls ignoring you.
const COYOTE_MS = 120;
const JUMP_BUFFER_MS = 180;

// The frame is a little taller than the drawing inside it, so this is not
// Krishna's apparent height - it works out at about 216px on screen.
const KRISHNA_HEIGHT = 230;

// Transparent rows underneath the feet in every standing frame, measured off
// the sheet. Without allowing for them the collision pad sits flush with the
// bottom of the frame, which is below the drawing, and Krishna hovers a few
// pixels over every surface he stands on.
const FOOT_INSET = 3;

// The collision box is a small pad under the feet, given in on-screen px so
// it survives the art being re-exported at a different size. Sized to match
// what the level layouts in levels.js were measured against.
const BODY_WIDTH = 52;
const BODY_HEIGHT = 22;

const BUTTER_HEIGHT = 130;
const DROP_HEIGHT = 52;

// Below this Krishna is drifting to a stop under drag, not running
const RUN_ANIM_THRESHOLD = 30;

// How long he sits eating before the result screen takes over. Long enough
// to register as an ending, short enough not to be in the way on a replay.
const WIN_OUTRO_MS = 1900;

// The background is a tile fixed to the camera whose offset is driven by the
// camera's own scroll, so it parallaxes forever without needing art as tall
// as the level.
const BG_PARALLAX = 0.55;

export default class GameScene extends Phaser.Scene {

    constructor() {
        super("GameScene");
    }

    preload() {

        loadImage(this, "wall", wallTile);
        loadImage(this, "roomBase", roomBase);
        loadKrishna(this);

        loadImage(this, "platform", platformImg);
        loadImage(this, "platform-wood", platformWood);
        loadImage(this, "platform-stone", platformStone);
        loadImage(this, "platform-cracked", platformCracked);
        loadImage(this, "platform-cloud", platformCloud);
        loadImage(this, "butter", butterPot);
        loadImage(this, "butterDrop", butterDrop);
        loadImage(this, "krishnaSitting", krishnaSitting);
        loadImage(this, "spark", sparkImg);
        loadImage(this, "hintSwipe", hintSwipeImg);
        loadImage(this, "hintHand", hintHandImg);

        loadImage(this, "pauseButton", pauseButtonImg);
        loadImage(this, "homeButton", homeButtonImg);
        loadImage(this, "replayButton", replayButtonImg);
        loadImage(this, "playButton", playButtonImg);

        AudioManager.preload(this);

    }

    create(data) {

        AudioManager.startMusic(this, "game");

        this.level = data.level || 1;

        const levelConfig = LevelManager.getLevel(this.level);

        this.isPaused = false;
        this.isGameOver = false;
        this.wasGrounded = true;

        //-------------------------
        // Background
        //-------------------------

        // Plain plaster covering the height of the climb. Tiling the whole
        // room repeated its floor and window every 720px; this patch is
        // mirrored on both axes so the repeat is invisible.
        this.background = this.add
            .tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, "wall")
            .setOrigin(0, 0)
            .setScrollFactor(0)
            .setDepth(-12);

        // The real room, drawn once at the bottom. Its top edge is already
        // faded into the plaster colour by tools/optimize_assets.py.
        const base = this.add.image(GAME_WIDTH/2, 0, "roomBase")
            .setDepth(-11);

        fitWidth(base, GAME_WIDTH);
        base.setY(WORLD_HEIGHT - base.displayHeight/2);

        // Depth haze so the top of the climb reads as further away
        this.add.rectangle(
            GAME_WIDTH/2, WORLD_HEIGHT/2, GAME_WIDTH, WORLD_HEIGHT, 0x2a1403, 0.18
        ).setDepth(-10);

        //-------------------------
        // World bounds and camera
        //-------------------------

        this.physics.world.setBounds(0, 0, GAME_WIDTH, WORLD_HEIGHT);
        this.cameras.main.setBounds(0, 0, GAME_WIDTH, WORLD_HEIGHT);

        //-------------------------
        // Floor
        //-------------------------

        this.floor = this.physics.add.staticGroup();

        this.floor.create(GAME_WIDTH/2, FLOOR_Y + 40, null)
            .setDisplaySize(GAME_WIDTH, 80)
            .setVisible(false)
            .refreshBody();

        //-------------------------
        // Platforms
        //-------------------------

        // The art is cropped to the plank itself, so the collision strip is
        // derived from the sprite instead of hand-tuned magic offsets.
        this.platformBodies = this.physics.add.staticGroup();

        // Exposed for the tools in tools/
        this.__levelPlatforms = levelConfig.platforms;
        this.__allLevels = Levels;

        this.platforms = levelConfig.platforms.map(
            (spec, index) => this.createPlatform(spec, index)
        );

        //-------------------------
        // Butter drops
        //-------------------------

        this.drops = this.physics.add.staticGroup();

        (levelConfig.drops || []).forEach(index => {

            const spec = levelConfig.platforms[index];

            if(!spec){

                return;

            }

            // Its own art, not a shrunken butter pot - the pot is the goal
            // and a small copy of it on a ledge reads as the level's exit.
            const drop = this.drops.create(spec.x, spec.y - 105, "butterDrop");

            fitHeight(drop, DROP_HEIGHT);
            drop.refreshBody();

            this.tweens.add({
                targets: drop,
                y: drop.y - 10,
                duration: 900,
                yoyo: true,
                repeat: -1,
                ease: "Sine.easeInOut"
            });

        });

        //-------------------------
        // Krishna
        //-------------------------

        this.krishna = this.physics.add.sprite(
            levelConfig.spawn[0],
            levelConfig.spawn[1],
            KRISHNA_KEY
        );

        fitHeight(this.krishna, KRISHNA_HEIGHT);

        // The physics body is invisible and its scale is never touched again.
        // Squashing the sprite used to resize the body, which broke floor
        // contact and re-triggered a landing every single frame.
        this.krishna.setVisible(false);

        this.krishna.setCollideWorldBounds(true);
        this.krishna.setBounce(0);
        this.krishna.setGravityY(GRAVITY);
        this.krishna.setDragX(1200);
        this.krishna.setMaxVelocity(AIR_SPEED, 1200);

        // Collision box is a small pad at Krishna's feet. Arcade sizes bodies
        // in source pixels and then scales them, so divide the on-screen size
        // back out - otherwise the box changes whenever the art does.
        const tw = this.krishna.width;
        const th = this.krishna.height;
        const bw = BODY_WIDTH / this.krishna.scaleX;
        const bh = BODY_HEIGHT / this.krishna.scaleY;

        // Lifted by the empty rows under the feet, so what rests on a
        // platform is the drawing rather than the bottom edge of the frame.
        this.krishna.body.setSize(bw, bh);
        this.krishna.body.setOffset((tw - bw)/2, th - bh - FOOT_INSET);

        this.spawnY = this.krishna.y;

        // What the player actually sees. Follows the body, and owns every
        // cosmetic transform.
        this.krishnaArt = fitHeight(
            this.add.sprite(this.krishna.x, this.krishna.y, KRISHNA_KEY, 0),
            KRISHNA_HEIGHT
        );

        createKrishnaAnimations(this);
        this.krishnaArt.play("krishna-idle");

        // Remembered so the squash tween can spring back to it
        this.krishnaScale = this.krishnaArt.scaleX;

        // Follow with a deadzone so small hops do not jiggle the whole screen,
        // and bias the view upward - the player needs to see where to jump.
        this.cameras.main.startFollow(this.krishna, true, 0.12, 0.14);
        this.cameras.main.setDeadzone(GAME_WIDTH, 260);
        this.cameras.main.setFollowOffset(0, 180);

        //-------------------------
        // Butter
        //-------------------------

        this.makeGlowTexture();

        // The prize is what the whole climb is aimed at, so it is lit from
        // behind and drawn large enough to read from the bottom of the level.
        this.butterGlow = this.add.image(
            levelConfig.butter[0], levelConfig.butter[1], "glow"
        )
            .setBlendMode(Phaser.BlendModes.ADD)
            .setDisplaySize(BUTTER_HEIGHT * 2.6, BUTTER_HEIGHT * 2.6)
            .setDepth(-1);

        this.butter = this.physics.add.staticImage(
            levelConfig.butter[0],
            levelConfig.butter[1],
            "butter"
        );

        fitHeight(this.butter, BUTTER_HEIGHT);

        this.butter.refreshBody();

        this.tweens.add({
            targets: [this.butter, this.butterGlow],
            y: levelConfig.butter[1] - 12,
            duration: 1100,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut"
        });

        // Breathing light, offset from the bob so the two never beat together
        this.tweens.add({
            targets: this.butterGlow,
            alpha: { from: 0.55, to: 1 },
            scale: this.butterGlow.scale * 1.12,
            duration: 900,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut"
        });

        //-------------------------
        // Physics
        //-------------------------

        this.physics.add.collider(this.krishna, this.floor);
        this.physics.add.collider(this.krishna, this.platformBodies);

        // Deliberately NOT a physics overlap. Krishna's body is a small pad at
        // his feet so he stands on thin platforms correctly, which means a
        // butter pot at head height could never be touched - the level was
        // unwinnable. Pick-ups test the visible character instead.

        //-------------------------
        // HUD
        //-------------------------

        // Platforms scroll behind the HUD, so give it a strip to sit on
        this.add.rectangle(GAME_WIDTH/2, 0, GAME_WIDTH, 108, 0x2a1403, 0.45)
            .setOrigin(0.5, 0)
            .setScrollFactor(0)
            .setDepth(199);

        this.totalTime = levelConfig.timer;
        this.timeLeft = this.totalTime;

        this.timerText = this.add.text(
            GAME_WIDTH - 30,
            30,
            this.formatTime(this.timeLeft),
            {
                fontFamily: "Arial",
                fontSize: "34px",
                fontStyle: "bold",
                color: "#FFFFFF",
                backgroundColor: "#C0392B",
                padding: { left: 14, right: 14, top: 8, bottom: 8 }
            }
        );

        this.timerText
            .setOrigin(1, 0)
            .setDepth(200)
            .setScrollFactor(0);

        this.levelText = this.add.text(
            GAME_WIDTH/2,
            38,
            `LEVEL ${this.level}`,
            {
                fontFamily: "Arial",
                fontSize: "30px",
                fontStyle: "bold",
                color: "#FFFFFF",
                stroke: "#000000",
                strokeThickness: 4
            }
        ).setOrigin(0.5, 0).setDepth(200).setScrollFactor(0);

        this.gameTimer = this.time.addEvent({

            delay: 1000,

            loop: true,

            callback: () => {

                this.timeLeft--;

                this.timerText.setText(this.formatTime(this.timeLeft));

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
        // Pause
        //-------------------------

        this.pauseButton = fitWidth(
            this.add.image(52, 48, "pauseButton"),
            64
        )
            .setDepth(200)
            .setScrollFactor(0)
            .setInteractive({ useHandCursor: true });

        this.pauseButton.on("pointerdown", () => {

            AudioManager.play(this,"click");

            this.togglePause();

        });

        this.buildPauseOverlay();

        //-------------------------
        // Input - swipe, plus arrow keys on desktop
        //-------------------------

        this.cursors = this.input.keyboard.createCursorKeys();

        this.swipeStart = null;

        // Forgiveness windows
        this.lastGroundedAt = 0;
        this.bufferedJumpAt = 0;
        this.bufferedJumpX = 0;

        // Horizontal push a swipe is currently applying
        this.swipeMoveX = 0;
        this.swipeMoveUntil = 0;
        this.swipeJump = false;
        this.swipeJumpAt = 0;

        this.input.on("pointerdown", pointer => {

            // Ignore touches that begin on a UI button
            if(this.input.hitTestPointer(pointer).length > 0){

                this.swipeStart = null;

                return;

            }

            this.swipeStart = {
                x: pointer.x,
                y: pointer.y,
                time: this.time.now
            };

        });

        const endSwipe = pointer => {

            if(!this.swipeStart){

                return;

            }

            const dx = pointer.x - this.swipeStart.x;
            const dy = pointer.y - this.swipeStart.y;
            const elapsed = this.time.now - this.swipeStart.time;

            this.swipeStart = null;

            if(elapsed > SWIPE_MAX_TIME){

                return;

            }

            if(Math.hypot(dx,dy) < SWIPE_MIN_DISTANCE){

                return;

            }

            this.handleSwipe(dx,dy);

        };

        this.input.on("pointerup", endSwipe);
        this.input.on("pointerupoutside", endSwipe);

        this.createHint();

    }

    //------------------------------------------------

    /**
     * Shows the swipe gesture on level 1 until the player performs one.
     *
     * A swipe is the only control in the game and nothing on screen implies
     * it - there are no buttons left to press. So the first level draws the
     * arc with a hand travelling along it, and stops as soon as the gesture
     * lands, which is the only evidence that it was understood.
     */
    createHint(){

        if(this.level !== 1){

            return;

        }

        // Pinned to the camera, not to the level. The gesture is made against
        // the screen, so anchoring it to Krishna put it wherever he happened
        // to be standing and slid it away the moment he moved.
        const x = GAME_WIDTH/2;
        const y = GAME_HEIGHT - 300;

        // The arc is the brighter of the two pieces, so it has to be held
        // back - at full strength the hand disappears into it exactly when it
        // crosses it, which is the moment the hint is trying to show.
        const arc = fitWidth(
            this.add.image(x, y - 70, "hintSwipe"), 200
        ).setAlpha(0.5).setDepth(119);

        // Drawn pointing right; turned to point the way the swipe goes
        const hand = fitWidth(
            this.add.image(x - 70, y + 30, "hintHand"), 110
        ).setRotation(-0.5).setDepth(121);

        this.hint = [arc, hand];

        this.hint.forEach(part => part.setScrollFactor(0));

        // The hand traces the arc: out and up, matching the diagonal jump the
        // level opens with.
        this.hintTween = this.tweens.add({
            targets: hand,
            x: x + 60,
            y: y - 130,
            duration: 1100,
            hold: 250,
            repeat: -1,
            repeatDelay: 500,
            ease: "Sine.easeInOut"
        });

    }

    dismissHint(){

        if(!this.hint){

            return;

        }

        const parts = this.hint;

        this.hint = null;
        this.hintTween?.stop();

        this.tweens.add({
            targets: parts,
            alpha: 0,
            duration: 250,
            onComplete: () => parts.forEach(part => part.destroy())
        });

    }

    //------------------------------------------------

    createPlatform(spec, index){

        const { x, y, type } = spec;

        const plank = fitWidth(
            this.add.image(x, y, PLATFORM_TEXTURE[type] || PLATFORM_TEXTURE.normal),
            PLATFORM_WIDTH
        );

        const surfaceOffset = -plank.displayHeight/2 + 10;

        const body = this.platformBodies
            .create(x, y + surfaceOffset, null)
            .setDisplaySize(PLATFORM_WIDTH * 0.92, 20)
            .setVisible(false);

        body.refreshBody();

        // One-way: Krishna passes up through a platform and lands on top of
        // it. Without this the underside blocks straight-up jumps.
        body.body.checkCollision.down = false;
        body.body.checkCollision.left = false;
        body.body.checkCollision.right = false;

        const platform = {
            index,
            type,
            plank,
            body,
            surfaceOffset,
            homeX: x,
            dx: 0,
            crumbling: false
        };

        if(type === "moving"){

            // Swing centred on the designed position rather than starting
            // there. Running from x to x + MOVING_RANGE put the ledge an
            // average of half a range right of where the level was laid out,
            // and a whole range out at the extreme - which on the wider
            // levels pushed the jump onto it to within a few pixels of the
            // measured envelope, while the ledge was moving away.
            plank.x = x - MOVING_RANGE/2;

            this.tweens.add({
                targets: plank,
                x: x + MOVING_RANGE/2,
                duration: MOVING_DURATION,
                yoyo: true,
                repeat: -1,
                ease: "Sine.easeInOut"
            });

        }

        return platform;

    }

    //------------------------------------------------

    /** True when Krishna is standing on this particular platform. */
    isStandingOn(platform){

        if(!platform.body.body.enable){

            return false;

        }

        const feet = this.krishna.body.bottom;
        const top = platform.body.body.top;

        return (
            Math.abs(feet - top) < 8 &&
            this.krishna.body.right > platform.body.body.left &&
            this.krishna.body.left < platform.body.body.right
        );

    }

    //------------------------------------------------

    crumble(platform){

        if(platform.crumbling){

            return;

        }

        platform.crumbling = true;

        this.tweens.add({
            targets: platform.plank,
            angle: { from: -1.5, to: 1.5 },
            duration: 70,
            yoyo: true,
            repeat: Math.round(CRUMBLE_DELAY / 140)
        });

        this.time.delayedCall(CRUMBLE_DELAY, () => {

            platform.body.body.enable = false;

            this.tweens.add({
                targets: platform.plank,
                alpha: 0,
                y: platform.plank.y + 60,
                duration: 260,
                onComplete: () => {

                    // Always comes back, so a level can never be left
                    // unwinnable by a ledge the player already used.
                    this.time.delayedCall(CRUMBLE_RESPAWN, () => {

                        platform.plank.setAngle(0);
                        platform.plank.y = platform.plank.y - 60;
                        platform.body.body.enable = true;
                        platform.crumbling = false;

                        this.tweens.add({
                            targets: platform.plank,
                            alpha: 1,
                            duration: 220
                        });

                    });

                }
            });

        });

    }

    //------------------------------------------------

    collectDrop(drop){

        const { x, y } = drop;

        drop.destroy();

        this.timeLeft += DROP_BONUS;

        AudioManager.play(this,"collect");

        this.burst(x, y);

        const label = this.add.text(
            drop.x,
            drop.y,
            `+${DROP_BONUS}s`,
            {
                fontFamily: "Arial",
                fontSize: "30px",
                fontStyle: "bold",
                color: "#FFD54A",
                stroke: "#000000",
                strokeThickness: 4
            }
        ).setOrigin(0.5).setDepth(150);

        this.tweens.add({
            targets: label,
            y: label.y - 70,
            alpha: 0,
            duration: 750,
            onComplete: () => label.destroy()
        });

    }

    //------------------------------------------------

    /**
     * A soft radial falloff, built once and reused as an additive halo.
     *
     * Drawn as a stack of translucent circles rather than loaded as art: a
     * gradient PNG large enough not to band would cost more than the rest of
     * the level's textures put together, and this is a handful of fills.
     */
    makeGlowTexture(){

        if(this.textures.exists("glow")){

            return;

        }

        const size = 128;
        const rings = 24;

        const g = this.add.graphics();

        for(let i = rings; i > 0; i--){

            g.fillStyle(0xffd98a, 0.055);
            g.fillCircle(size/2, size/2, (size/2) * (i / rings));

        }

        g.generateTexture("glow", size, size);
        g.destroy();

    }

    //------------------------------------------------

    /**
     * A short scatter of sparks, so picking something up registers at the
     * point of contact rather than only in the timer at the top of the screen.
     */
    burst(x, y, count = 7){

        for(let i = 0; i < count; i++){

            const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
            const distance = 40 + Math.random() * 45;

            const spark = fitWidth(
                this.add.image(x, y, "spark"),
                14 + Math.random() * 12
            ).setDepth(140);

            this.tweens.add({
                targets: spark,
                x: x + Math.cos(angle) * distance,
                y: y - Math.abs(Math.sin(angle)) * distance * 0.6
                     + Math.sin(angle) * distance * 0.4,
                alpha: 0,
                scale: spark.scale * 0.3,
                angle: Phaser.Math.Between(-180, 180),
                duration: 420 + Math.random() * 220,
                ease: "Quad.easeOut",
                onComplete: () => spark.destroy()
            });

        }

    }

    //------------------------------------------------

    handleSwipe(dx,dy){

        if(this.isPaused || this.isGameOver){

            return;

        }

        // 0 = right, 90 = up, 180 = left, -90 = down
        const angle = Phaser.Math.RadToDeg(Math.atan2(-dy,dx));

        // Downward swipes are unused for now
        if(angle < -22.5 && angle > -157.5){

            return;

        }

        let moveX = 0;
        let jump = false;

        if(angle >= 67.5 && angle <= 112.5){

            // Straight up
            jump = true;

        }
        else if(angle > 22.5 && angle < 67.5){

            // Up + right
            jump = true;
            moveX = AIR_SPEED;

        }
        else if(angle > 112.5 && angle < 157.5){

            // Up + left
            jump = true;
            moveX = -AIR_SPEED;

        }
        else if(angle >= -22.5 && angle <= 22.5){

            moveX = RUN_SPEED;

        }
        else{

            moveX = -RUN_SPEED;

        }

        this.dismissHint();

        const grounded =
            this.krishna.body.blocked.down ||
            this.krishna.body.touching.down;

        // Coyote time: a jump a few frames after walking off still counts
        const canJump =
            grounded ||
            this.time.now - this.lastGroundedAt < COYOTE_MS;

        if(jump && canJump){

            this.jump();

        }
        else if(jump){

            // Buffered: fire it the moment he touches down
            this.bufferedJumpAt = this.time.now;
            this.bufferedJumpX = moveX;

        }
        else{

            this.swipeJump = false;

        }

        if(moveX !== 0){

            this.swipeMoveX = moveX;

            this.swipeMoveUntil =
                this.time.now +
                (jump ? SWIPE_AIR_DURATION : SWIPE_RUN_DURATION);

            this.krishnaArt.flipX = moveX < 0;

        }

    }

    //------------------------------------------------

    jump(){

        this.krishna.setVelocityY(JUMP_VELOCITY);

        AudioManager.play(this,"jump");

        this.swipeJump = true;
        this.swipeJumpAt = this.time.now;

        // Stretch tall on take-off
        this.squash(0.88, 1.14, 110);

    }

    //------------------------------------------------

    land(){

        AudioManager.play(this,"land");

        // Squash flat, then spring back
        this.squash(1.18, 0.84, 130);

    }

    //------------------------------------------------

    squash(scaleX, scaleY, duration){

        const base = this.krishnaScale;

        this.tweens.killTweensOf(this.krishnaArt);

        this.krishnaArt.setScale(base * scaleX, base * scaleY);

        this.tweens.add({
            targets: this.krishnaArt,
            scaleX: base,
            scaleY: base,
            duration,
            ease: "Back.Out"
        });

    }

    //------------------------------------------------

    checkButter(){

        if(this.isGameOver){

            return;

        }

        const reach = this.krishnaArt.getBounds();

        // Drops use the same visible-character test as the butter pot, for
        // the same reason: his physics body is a pad at his feet.
        this.drops.getChildren().slice().forEach(drop => {

            if(Phaser.Geom.Intersects.RectangleToRectangle(reach, drop.getBounds())){

                this.collectDrop(drop);

            }

        });

        if(Phaser.Geom.Intersects.RectangleToRectangle(
            reach,
            this.butter.getBounds()
        )){

            this.win();

        }

    }

    //------------------------------------------------

    /**
     * Reaching the butter used to cut straight to the result screen, which
     * landed mid-jump - the level ended on the frame he touched the pot, so
     * it read as the game closing on him rather than as him winning.
     *
     * Now he takes the pot, sits down with it and eats, and only then does
     * the screen change. The scoring is settled the moment he touches it;
     * everything after that is the payoff.
     */
    win(){

        if(this.isGameOver){

            return;

        }

        this.isGameOver = true;

        this.physics.pause();
        this.gameTimer.remove();
        this.dismissHint();
        this.pauseButton.setVisible(false);

        AudioManager.play(this,"collect");

        const result = {
            stars: getStars(this.timeLeft, this.totalTime),
            timeLeft: this.timeLeft,
            level: this.level
        };

        // Hold him in frame - the camera is still biased upward for climbing
        this.cameras.main.stopFollow();

        this.cameras.main.pan(
            this.krishna.x, this.krishna.y, 500, "Sine.easeInOut"
        );

        const restY = this.krishna.body.bottom;

        // The pot leaves its perch and comes to him
        this.tweens.add({
            targets: [this.butter, this.butterGlow],
            x: this.krishna.x,
            y: restY - KRISHNA_HEIGHT * 0.35,
            duration: 450,
            ease: "Quad.easeIn"
        });

        this.time.delayedCall(450, ()=>{

            this.butter.destroy();
            this.butterGlow.destroy();

            this.burst(this.krishna.x, restY - KRISHNA_HEIGHT * 0.35, 12);
            AudioManager.play(this,"star");

            this.sitAndEat(restY, result);

        });

    }

    //------------------------------------------------

    /**
     * Swaps the standing sprite for the sitting pose and lets him eat.
     *
     * The sitting art is a different drawing, not a frame of the run sheet,
     * so it is anchored on the ground line he is standing on rather than on
     * his centre - otherwise he sinks into the platform as he sits.
     */
    sitAndEat(restY, result){

        this.krishnaArt.setVisible(false);

        const sitting = fitHeight(
            this.add.image(this.krishna.x, restY, "krishnaSitting"),
            KRISHNA_HEIGHT * 0.92
        ).setDepth(this.krishnaArt.depth);

        sitting.setY(restY - sitting.displayHeight/2);

        const resting = sitting.scale;

        sitting.setScale(resting * 0.6);

        this.tweens.add({
            targets: sitting,
            scale: resting,
            duration: 320,
            ease: "Back.Out",
            onComplete: ()=>{

                // Three small dips - eating, rather than a single pose held
                // until the screen changes
                this.tweens.add({
                    targets: sitting,
                    scaleY: resting * 0.94,
                    duration: 180,
                    yoyo: true,
                    repeat: 2,
                    ease: "Sine.easeInOut"
                });

                this.time.delayedCall(260, ()=> AudioManager.play(this,"collect"));

            }
        });

        this.time.delayedCall(WIN_OUTRO_MS, ()=>{

            this.scene.start("LevelCompleteScene", result);

        });

    }

    //------------------------------------------------

    iconButton(x,y,key,width,onClick){

        const b = fitWidth(this.add.image(x,y,key), width)
            .setInteractive({ useHandCursor: true });

        b.on("pointerdown",()=>{

            AudioManager.play(this,"click");

            onClick();

        });

        return b;

    }

    //------------------------------------------------

    buildPauseOverlay(){

        // Interactive so it swallows taps meant for the game beneath
        const dim = this.add
            .rectangle(GAME_WIDTH/2, GAME_HEIGHT/2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7)
            .setInteractive();

        const title = this.add.text(
            GAME_WIDTH/2,
            420,
            "PAUSED",
            {
                fontFamily: "Arial",
                fontSize: "64px",
                color: "#FFD54A",
                fontStyle: "bold"
            }
        ).setOrigin(0.5);

        const resume = this.iconButton(
            GAME_WIDTH/2, 620, "playButton", 240,
            () => this.togglePause()
        );

        const replay = this.iconButton(
            GAME_WIDTH/2 - 90, 830, "replayButton", 95,
            () => this.scene.restart({ level: this.level })
        );

        const home = this.iconButton(
            GAME_WIDTH/2 + 90, 830, "homeButton", 95,
            () => this.scene.start("HomeScene")
        );

        this.pauseOverlay = this.add.container(
            0, 0, [dim, title, resume, replay, home]
        );

        // Built in screen coordinates, so it must not scroll with the level
        this.pauseOverlay
            .setDepth(300)
            .setVisible(false)
            .setScrollFactor(0, 0, true);

    }

    //------------------------------------------------

    togglePause(){

        if(this.isGameOver){

            return;

        }

        this.isPaused = !this.isPaused;

        if(this.isPaused){

            this.physics.pause();
            this.gameTimer.paused = true;

        }
        else{

            this.physics.resume();
            this.gameTimer.paused = false;

        }

        this.pauseOverlay.setVisible(this.isPaused);

    }

    //------------------------------------------------

    formatTime(seconds){

        const m = Math.floor(seconds/60).toString().padStart(2,"0");
        const s = (seconds%60).toString().padStart(2,"0");

        return `${m}:${s}`;

    }

    //------------------------------------------------

    gameOver(){

        this.isGameOver = true;

        this.physics.pause();
        this.gameTimer.remove();

        this.pauseButton.setVisible(false);

        AudioManager.play(this,"lose");

        this.add
            .rectangle(GAME_WIDTH/2, GAME_HEIGHT/2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7)
            .setDepth(300)
            .setScrollFactor(0)
            .setInteractive();

        this.add.text(
            GAME_WIDTH/2,
            520,
            "TIME'S UP!",
            {
                fontFamily: "Arial",
                fontSize: "60px",
                color: "#FFFFFF",
                fontStyle: "bold"
            }
        ).setOrigin(0.5).setDepth(301).setScrollFactor(0);

        this.iconButton(
            GAME_WIDTH/2 - 90, 720, "replayButton", 95,
            () => this.scene.restart({ level: this.level })
        ).setDepth(301).setScrollFactor(0);

        this.iconButton(
            GAME_WIDTH/2 + 90, 720, "homeButton", 95,
            () => this.scene.start("HomeScene")
        ).setDepth(301).setScrollFactor(0);

    }

    //------------------------------------------------

    update(){

        if(this.isPaused || this.isGameOver){

            return;

        }

        const now = this.time.now;

        const grounded =
            this.krishna.body.blocked.down ||
            this.krishna.body.touching.down;

        // Expire the swipe push on timeout, or as soon as a swipe-jump
        // touches back down
        if(this.swipeMoveX !== 0){

            const landed =
                this.swipeJump &&
                grounded &&
                now > this.swipeJumpAt + 120;

            if(now > this.swipeMoveUntil || landed){

                this.swipeMoveX = 0;
                this.swipeJump = false;

            }

        }

        if(this.cursors.left.isDown){

            this.swipeMoveX = 0;
            this.krishna.setVelocityX(-RUN_SPEED);
            this.krishnaArt.flipX = true;

        }
        else if(this.cursors.right.isDown){

            this.swipeMoveX = 0;
            this.krishna.setVelocityX(RUN_SPEED);
            this.krishnaArt.flipX = false;

        }
        else if(this.swipeMoveX !== 0){

            this.krishna.setVelocityX(this.swipeMoveX);

        }
        else{

            this.krishna.setVelocityX(0);

        }

        if(Phaser.Input.Keyboard.JustDown(this.cursors.up) && grounded){

            this.jump();

        }

        //-------------------------
        // Moving platforms
        //-------------------------

        this.platforms.forEach(p => {

            if(p.type !== "moving"){

                return;

            }

            const previous = p.body.x;

            p.body.setPosition(p.plank.x, p.plank.y + p.surfaceOffset);
            p.body.body.updateFromGameObject();

            p.dx = p.body.x - previous;

            // Arcade does not carry riders, so move Krishna by hand or he
            // slides off anything that moves under him.
            if(p.dx !== 0 && grounded && this.isStandingOn(p)){

                this.krishna.x += p.dx;

            }

        });

        //-------------------------
        // Crumbling ledges
        //-------------------------

        if(grounded){

            this.lastGroundedAt = now;

            const under = this.platforms.find(
                p => p.type === "crumbling" && this.isStandingOn(p)
            );

            if(under){

                this.crumble(under);

            }

        }

        // Touchdown after any time in the air
        if(grounded && this.wasGrounded === false){

            this.land();

            // A jump asked for just before landing still counts
            if(now - this.bufferedJumpAt < JUMP_BUFFER_MS){

                this.bufferedJumpAt = 0;

                this.jump();

                if(this.bufferedJumpX !== 0){

                    this.swipeMoveX = this.bufferedJumpX;
                    this.swipeMoveUntil = now + SWIPE_AIR_DURATION;
                    this.krishnaArt.flipX = this.bufferedJumpX < 0;

                }

            }

        }

        this.wasGrounded = grounded;

        this.krishnaArt.setPosition(this.krishna.x, this.krishna.y);

        this.checkButter();

        // Parallax: the backdrop drifts slower than the level itself
        this.background.tilePositionY =
            this.cameras.main.scrollY * BG_PARALLAX;

        //-------------------------
        // Pose
        //-------------------------

        const vx = this.krishna.body.velocity.x;
        const vy = this.krishna.body.velocity.y;

        // Rising and falling get their own pose, so the jump reads as an arc
        // rather than one held frame.
        if(!grounded){

            this.krishnaArt.play(
                vy < 0 ? "krishna-jump" : "krishna-fall", true
            );

        }
        else{

            this.krishnaArt.play(
                Math.abs(vx) > RUN_ANIM_THRESHOLD ? "krishna-run" : "krishna-idle",
                true
            );

        }

        // A small lean on top of the animation. This used to carry the whole
        // illusion of movement and was correspondingly heavy; now that the
        // legs actually move, the same amount of tilt looks like falling over.
        let targetTilt = 0;

        if(!grounded){

            targetTilt = (vx / AIR_SPEED) * 0.10
                + Phaser.Math.Clamp(vy / 1600, -0.05, 0.07);

        }
        else if(Math.abs(vx) > RUN_ANIM_THRESHOLD){

            targetTilt = (vx / RUN_SPEED) * 0.04;

        }

        // flipX mirrors the sprite, so the lean has to mirror with it
        if(this.krishnaArt.flipX){

            targetTilt = -targetTilt;

        }

        this.krishnaArt.rotation = Phaser.Math.Linear(
            this.krishnaArt.rotation,
            targetTilt,
            0.18
        );

    }

}
