import Phaser from "phaser";
import { loadImage } from "../ui/loader";
import AudioManager from "../managers/AudioManager";

import homeBackground from "../assets/backgrounds/home_background.jpg";
import levelButton from "../assets/ui/level_button.png";
import levelButtonLocked from "../assets/ui/level_button_locked.png";
import lockIcon from "../assets/ui/lock.png";
import feather from "../assets/items/feather.png";
import homeButtonImg from "../assets/ui/home_button.png";
import levelBanner from "../assets/ui/level_banner.png";

import LevelManager from "../managers/LevelManager";
import { fitWidth, fitHeight, GAME_WIDTH, GAME_HEIGHT , coverScreen} from "../ui/layout";

const COLUMNS = 3;
const BUTTON_WIDTH = 130;
const SPACING_X = 200;

// Ten levels is four rows, and at the 230 this started at they did not fit -
// the list was left with 110px of scroll, which is the worst amount to have:
// enough that the bottom row is cut off, too little to look deliberate.
//
// 190 fits all four rows on the design height with nothing left over. A row
// is the button plus its stars, about 165 tall, so this still leaves a clear
// gap between one row's stars and the next row's button.
const SPACING_Y = 190;

// The list scrolls, because it has to. Twenty-three levels is eight rows and
// no phone shows eight rows of these buttons - at the old fixed layout
// everything past level 12 was drawn below the bottom of the screen, where it
// could be neither seen nor tapped.
//
// Scrolling rather than paging: the buttons already carry the level number
// and a star count, so what a player is doing here is looking for a specific
// one, and a page boundary hides half the list behind a control they have to
// find first.
//
// The strip the rows live in, between the banner and the home button. Rows
// are clipped to it rather than drawn over the furniture.
const VIEW_TOP = 270;
const VIEW_BOTTOM_GAP = 230;

// The first row's centre. A row is the button plus its stars underneath, so
// it hangs about 100px below its own centre - that, not the button's radius,
// is what has to clear the top of the strip.
const ROW_DROP = 100;
const START_Y = VIEW_TOP + ROW_DROP;

// Past this a press is a drag, not a tap. Every level button would otherwise
// fire the moment a finger touched it on the way to scrolling the list.
const DRAG_SLOP = 12;

// How far a wheel notch moves the list. Only reachable on desktop, where the
// list is also being read with a mouse rather than dragged.
const WHEEL_STEP = 0.6;

// The three feathers under each button.
//
// Sized by height, because the feather art is 84x146 - portrait, where the
// star it replaces was 165x149. Fitting it to the star's 34px WIDTH would
// have drawn it 59 tall, which runs a row's feathers into the next row's
// button at the 190 these rows are spaced at.
//
// 44 tall puts the trio between y+62 and y+106, clear of the button's own
// bottom edge at y+55 and still 84px short of the row below.
const FEATHER_HEIGHT = 44;
const FEATHER_GAP = 34;
const FEATHER_DROP = 84;

export default class LevelSelectScene extends Phaser.Scene {

    constructor() {
        super("LevelSelectScene");
    }

    preload() {

        AudioManager.preload(this);

        loadImage(this, "background", homeBackground);
        loadImage(this, "levelButton", levelButton);
        loadImage(this, "levelButtonLocked", levelButtonLocked);
        loadImage(this, "lock", lockIcon);
        loadImage(this, "feather", feather);
        loadImage(this, "homeButton", homeButtonImg);
        loadImage(this, "levelBanner", levelBanner);

    }

    create(data) {

        // Reached from the world screen, but also from the back button and
        // from the end of a run, which do not always carry the world with
        // them. Falling back to the furthest world reached puts a player
        // where they were rather than back at Vrindavan.
        this.world = data?.world || LevelManager.currentWorld();

        AudioManager.startMusic(this, "menu");

        this.makeDimFeather();

        coverScreen(this.add.image(0, 0, "background"));

        this.add.rectangle(
            GAME_WIDTH/2, GAME_HEIGHT/2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.5
        );

        // The heading sat as bare text on the sky, which read as a caption
        // rather than as part of the game. It gets the same carved banner the
        // level-complete screen puts its title on, so the two screens agree.
        const banner = fitWidth(
            this.add.image(GAME_WIDTH/2, 170, "levelBanner"),
            560
        );

        // The plaque is not centred in its own picture - the hanging rings at
        // the top are part of the art - so the caption is placed against the
        // banner rather than against the screen.
        // The world's own name, not "SELECT LEVEL". This screen is now one
        // world's ten levels rather than the whole game, and the name is what
        // says which ten - otherwise every world looks identical here.
        const world = LevelManager.getWorlds()
            .find(w => w.id === this.world);

        const heading = this.add.text(
            GAME_WIDTH/2,
            banner.y - banner.displayHeight * 0.03,
            world ? world.name : "SELECT LEVEL",
            {
                fontFamily: "Arial",
                fontSize: "48px",
                fontStyle: "bold",
                color: "#FFD54A",
                stroke: "#5A2D0C",
                strokeThickness: 6
            }
        ).setOrigin(0.5);

        // Two words do not fit the carved panel at the size one word does, and
        // "SELECT LEVEL" ran straight over the scrollwork at both ends. Rather
        // than pick a font size that happens to suit this string, it is shrunk
        // to fit the wood - which also holds if the text is ever translated.
        const room = banner.displayWidth * 0.56;

        if(heading.width > room){

            heading.setScale(room / heading.width);

        }

        const levels = LevelManager.getLevelsInWorld(this.world);

        // Everything that scrolls, kept in a plain array with the y it was
        // built at. Rows are moved by rewriting y from that base rather than
        // by nudging the current one, so a clamped scroll cannot accumulate
        // rounding and leave the grid a pixel out of line with itself.
        this.rows = [];

        this.viewBottom = GAME_HEIGHT - VIEW_BOTTOM_GAP;

        // Centre each row on the screen rather than measuring from an edge,
        // so a partly filled last row still sits centred.
        levels.forEach((level,index)=>{

            const col = index % COLUMNS;
            const row = Math.floor(index / COLUMNS);

            const inRow = Math.min(levels.length - row * COLUMNS, COLUMNS);

            const rowWidth = (inRow - 1) * SPACING_X;

            const x = GAME_WIDTH/2 - rowWidth/2 + col * SPACING_X;
            const y = START_Y + row * SPACING_Y;

            const button = fitWidth(
                this.add.image(
                    x,
                    y,
                    level.unlocked ? "levelButton" : "levelButtonLocked"
                ),
                BUTTON_WIDTH
            );

            this.scrolls(button);

            if(level.unlocked){

                this.scrolls(this.add.text(
                    x,
                    y - 4,
                    level.id,
                    {
                        fontFamily: "Arial",
                        fontSize: "44px",
                        fontStyle: "bold",
                        color: "#FFFFFF",
                        stroke: "#000000",
                        strokeThickness: 4
                    }
                ).setOrigin(0.5));

                button.setInteractive({ useHandCursor: true });

                // On release, not on press. A list that scrolls cannot start
                // a level the instant a finger lands on a button, or every
                // drag that happens to begin on one launches it.
                button.on("pointerup",()=>{

                    if(this.dragging){ return; }

                    AudioManager.play(this,"click");

                    this.scene.start("GameScene", { level: level.id });

                });

                // Best result so far, three slots under the button.
                //
                // `level.stars` is what the save file calls it and what
                // StarReward.js returns. The name is left alone deliberately
                // - renaming it would have to rewrite every save already on a
                // player's phone, and what is stored is a count from 0 to 3
                // either way. Only what it is drawn as has changed.
                for(let i=0;i<3;i++){

                    const earned = i < level.stars;

                    const quill = fitHeight(
                        this.add.image(
                            x - FEATHER_GAP + i * FEATHER_GAP,
                            y + FEATHER_DROP,
                            "feather"
                        ),
                        FEATHER_HEIGHT
                    );

                    if(!earned){

                        quill.setTexture("featherDim");

                    }

                    this.scrolls(quill);

                }

            }
            else{

                // The locked button art carries no padlock of its own
                this.scrolls(fitWidth(
                    this.add.image(x, y, "lock"),
                    52
                ));

            }

        });

        this.setUpScrolling(levels);

        //---------------------------------
        // Back to home
        //---------------------------------

        const home = fitWidth(
            this.add.image(GAME_WIDTH/2, GAME_HEIGHT - 150, "homeButton"),
            110
        ).setInteractive({ useHandCursor: true });

        // Up one screen, to the worlds, not all the way out to the home
        // screen - this is now the second level of a three-deep menu.
        home.on("pointerdown",()=>{

            AudioManager.play(this,"click");

            this.scene.start("WorldSelectScene");

        });

    }

    //------------------------------------------------

    /**
     * Bakes the "not earned yet" feather as its own texture.
     *
     * WHY THIS IS NOT setTint()
     * -------------------------
     * Phaser's Canvas renderer ignores tint. The game runs on Phaser.AUTO, so
     * a device that cannot give it WebGL falls back to Canvas - and there a
     * tinted feather draws at full colour, which would show every level in
     * the game as three-feathered whatever the player had actually done.
     *
     * The stars this replaced never had the problem, because they shipped as
     * two separate pictures. This does the same thing, just built at load
     * rather than drawn twice by hand.
     *
     * "source-atop" is what keeps it honest: it paints only where the feather
     * already has pixels, so the quill's own shape and soft edges survive.
     * Filling the rectangle outright would hand back a grey card.
     */
    makeDimFeather(){

        if(this.textures.exists("featherDim")){ return; }

        const source = this.textures.get("feather").getSourceImage();

        const canvas = this.textures.createCanvas(
            "featherDim", source.width, source.height
        );

        const ctx = canvas.getContext();

        ctx.drawImage(source, 0, 0);

        ctx.globalCompositeOperation = "source-atop";
        ctx.fillStyle = "rgba(46, 44, 38, 0.78)";
        ctx.fillRect(0, 0, source.width, source.height);
        ctx.globalCompositeOperation = "source-over";

        canvas.refresh();

    }

    //------------------------------------------------

    /**
     * Marks a game object as part of the scrolling grid.
     *
     * Its y at build time is kept alongside it, because scrolling rewrites y
     * from that base rather than adding to whatever y currently is - the
     * clamp at the end of a drag would otherwise be lost by the next drag and
     * the rows would creep out of alignment with each other.
     */
    scrolls(item){

        this.rows.push({ item, baseY: item.y });

        return item;

    }

    //------------------------------------------------

    /**
     * Clips the grid to the strip between the banner and the home button,
     * and makes it draggable.
     */
    setUpScrolling(levels){

        //---------------------------------
        // Clip
        //---------------------------------

        // Without this the rows are drawn straight over the banner at the top
        // and the home button at the bottom as they pass under them.
        const shape = this.make.graphics({ add: false });

        shape.fillStyle(0xffffff);
        shape.fillRect(
            0, VIEW_TOP, GAME_WIDTH, this.viewBottom - VIEW_TOP
        );

        const mask = shape.createGeometryMask();

        this.rows.forEach(({ item }) => item.setMask(mask));

        //---------------------------------
        // How far it may travel
        //---------------------------------

        const lastRow = Math.floor((levels.length - 1) / COLUMNS);

        // The bottom of the last row, stars included, against the bottom of
        // the strip. Nothing to scroll if the whole grid already fits.
        const contentBottom = START_Y + lastRow * SPACING_Y + ROW_DROP;

        this.maxScroll = Math.max(0, contentBottom - this.viewBottom);

        //---------------------------------
        // Start where the player left off
        //---------------------------------

        // Opening at the top means someone on level 20 drags the list every
        // single time they want to play. The furthest level they have reached
        // is what they came for, so the list opens there - clamped, so the
        // early levels still open at the top.
        const furthest = levels.filter(l => l.unlocked).length - 1;

        const targetY = START_Y + Math.floor(furthest / COLUMNS) * SPACING_Y;

        this.scrollY = Phaser.Math.Clamp(
            (VIEW_TOP + this.viewBottom) / 2 - targetY, -this.maxScroll, 0
        );

        this.applyScroll();

        if(this.maxScroll <= 0){ return; }

        //---------------------------------
        // Drag
        //---------------------------------

        // The whole strip takes the drag, not just the gaps between buttons -
        // a finger landing on a button and moving has to scroll the list, or
        // the list feels stuck wherever the buttons are.
        this.dragging = false;

        let travelled = 0;

        this.input.on("pointerdown", () => {
            travelled = 0;
            this.dragging = false;
        });

        this.input.on("pointermove", pointer => {

            if(!pointer.isDown){ return; }

            const dy = pointer.y - pointer.prevPosition.y;

            travelled += Math.abs(dy);

            // Below the slop it is still a tap. The flag is what the level
            // buttons check on release to decide whether they were pressed or
            // merely dragged across.
            if(travelled > DRAG_SLOP){ this.dragging = true; }

            if(!this.dragging){ return; }

            this.scrollY = Phaser.Math.Clamp(
                this.scrollY + dy, -this.maxScroll, 0
            );

            this.applyScroll();

        });

        // Cleared a frame late, so that the button's own pointerup - which
        // fires first - still sees that a drag was in progress.
        this.input.on("pointerup", () => {
            this.time.delayedCall(0, () => { this.dragging = false; });
        });

        this.input.on("wheel", (pointer, over, dx, dy) => {

            this.scrollY = Phaser.Math.Clamp(
                this.scrollY - dy * WHEEL_STEP, -this.maxScroll, 0
            );

            this.applyScroll();

        });

        //---------------------------------
        // Something to show there is more
        //---------------------------------

        const trackHeight = this.viewBottom - VIEW_TOP;

        // 8 wide, not the 4 this started at. The game is drawn 720 across and
        // shown on a phone about 360 wide, so everything here is halved on the
        // way to the screen - a 4px bar arrives as two physical pixels, which
        // is thin enough that it reads as an artefact rather than a control.
        const BAR = 8;
        const BAR_X = GAME_WIDTH - 22;

        this.add.rectangle(
            BAR_X, VIEW_TOP + trackHeight/2, BAR, trackHeight,
            0x000000, 0.3
        );

        // As tall a slice of the track as the strip is of the whole grid
        const visible = trackHeight / (trackHeight + this.maxScroll);

        this.thumb = this.add.rectangle(
            BAR_X, VIEW_TOP, BAR, trackHeight * visible,
            0xFFD54A, 0.85
        ).setOrigin(0.5, 0);

        this.applyScroll();

    }

    //------------------------------------------------

    /** Moves every row to where the current scroll puts it. */
    applyScroll(){

        this.rows.forEach(({ item, baseY }) => item.setY(baseY + this.scrollY));

        if(this.thumb){

            const track = this.viewBottom - VIEW_TOP - this.thumb.height;

            this.thumb.setY(
                VIEW_TOP + track * (-this.scrollY / this.maxScroll)
            );

        }

    }

    //------------------------------------------------

    /**
     * Android's back button goes up a screen - to the worlds, since that is
     * where this one was opened from - rather than closing the app. Only the
     * home screen, where there is nowhere further up, asks about leaving.
     */
    onBackButton(){

        this.scene.start("WorldSelectScene");

    }

}
