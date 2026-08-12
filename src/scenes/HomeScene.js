import Phaser from "phaser";
import { loadImage } from "../ui/loader";
import AudioManager from "../managers/AudioManager";
import homeBackground from "../assets/backgrounds/home_background.jpg";
import krishnaHero from "../assets/characters/krishna_hero.png";
import logo from "../assets/ui/logo.png";
import playButtonImg from "../assets/ui/play_button.png";
import nextButtonImg from "../assets/ui/next_button.png";
import butterPot from "../assets/items/butter_pot.png";
import settingsButton from "../assets/ui/settings_button.png";
import settingsPanel from "../assets/ui/settings_panel.png";
import settingsRow from "../assets/ui/settings_row.png";
import toggleOn from "../assets/ui/toggle_on.png";
import toggleOff from "../assets/ui/toggle_off.png";
import iconMusic from "../assets/ui/icon_music.png";
import iconSound from "../assets/ui/icon_sound.png";
import iconLanguage from "../assets/ui/icon_language.png";
import SettingsPanel from "../ui/SettingsPanel";
import { fitWidth, fitHeight, GAME_WIDTH, GAME_HEIGHT , coverScreen} from "../ui/layout";

export default class HomeScene extends Phaser.Scene {

    constructor() {
        super("HomeScene");
    }

    preload() {

        AudioManager.preload(this);

        loadImage(this, "homeBg", homeBackground);
        loadImage(this, "butterPot", butterPot);
        loadImage(this, "logo", logo);
        loadImage(this, "krishnaHero", krishnaHero);
        loadImage(this, "playButton", playButtonImg);

        // The settings panel dresses its Close button with this
        loadImage(this, "nextButton", nextButtonImg);
        loadImage(this, "settingsButton", settingsButton);
        loadImage(this, "settingsPanel", settingsPanel);
        loadImage(this, "settingsRow", settingsRow);
        loadImage(this, "toggleOn", toggleOn);
        loadImage(this, "toggleOff", toggleOff);
        loadImage(this, "iconMusic", iconMusic);
        loadImage(this, "iconSound", iconSound);
        loadImage(this, "iconLanguage", iconLanguage);

    }

    /**
     * A soft dark pool, drawn once and reused.
     *
     * Stacked translucent circles rather than a real gradient, because Phaser
     * Graphics has no radial fill - the same trick GameScene uses to light
     * the prize, inverted to shade instead.
     */
    makeGlowPatch() {

        if(this.textures.exists("glowPatch")){

            return;

        }

        const size = 128;
        const rings = 26;

        const g = this.add.graphics();

        for(let i = rings; i > 0; i--){

            g.fillStyle(0x1d0e02, 0.05);
            g.fillCircle(size/2, size/2, (size/2) * (i / rings));

        }

        g.generateTexture("glowPatch", size, size);
        g.destroy();

    }

    create() {

        AudioManager.startMusic(this, "menu");

        this.makeGlowPatch();

        // The canvas is as tall as the phone rather than a fixed 1280, so
        // these are anchored instead of written out: the title hangs from the
        // top, the play button sits above the bottom, and Krishna stands on
        // the button. On a long screen the extra height opens up between the
        // title and him - which is village - rather than stranding the whole
        // composition in the upper two thirds.
        const titleY = 210;
        const playY = GAME_HEIGHT - 265;
        const krishnaFeet = playY - 80;

        // Background
        coverScreen(this.add.image(0, 0, "homeBg"))
            .setDepth(-100);

        // Warm scrim so the white UI text stays readable on the art
        this.add.rectangle(
            GAME_WIDTH/2, GAME_HEIGHT/2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.25
        ).setDepth(-99);

        // The title is the loudest thing on the screen, so it gets the width
        // to be one. At 430 it sat inside the painted tree in the background
        // and the two dark, gold-flecked shapes read as one busy mess.
        this.logo = fitWidth(
            this.add.image(GAME_WIDTH/2, titleY, "logo"),
            560
        ).setDepth(3);

        // A soft dark pool behind it, so the sign separates from whatever the
        // background happens to put there. The background is cover-fitted and
        // moves with the phone's shape, so it cannot be relied on to be sky.
        this.logoGlow = this.add.image(GAME_WIDTH/2, titleY, "glowPatch")
            .setDisplaySize(this.logo.displayWidth * 1.25,
                            this.logo.displayHeight * 1.6)
            .setDepth(2)
            .setAlpha(0.5);

        this.tweens.add({
            targets: [this.logo, this.logoGlow],
            y: titleY - 12,
            duration: 1800,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut"
        });

        // Hung off the top right corner of the sign, where the peacock
        // feather is, so it reads as tied to the title rather than floating
        // in the sky on its own.
        //
        // Anchored at the top of its rope: rotating about the middle would
        // swing the rope's fixing too, and it would look like a pot being
        // waved rather than one hanging.
        this.butterPot = fitHeight(
            this.add.image(
                this.logo.x + this.logo.displayWidth * 0.46,
                titleY - this.logo.displayHeight * 0.54,
                "butterPot"
            ).setOrigin(0.5, 0),
            230
        ).setDepth(4);

        this.tweens.add({
            targets: this.butterPot,
            angle: 7,
            duration: 1400,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut"
        });

        // The title character is his own drawing rather than a frame lifted
        // out of the run sheet: the sheet's frames are built to read at 216px
        // in the middle of a level, and blown up to fill a title screen they
        // are visibly soft. This one is drawn for the size it is shown at.
        //
        // Stood on his feet rather than centred, so that the breathing below
        // settles him onto the ground instead of bobbing him off it.
        this.krishna = fitHeight(
            this.add.image(GAME_WIDTH/2, krishnaFeet, "krishnaHero").setOrigin(0.5, 1),
            580
        );

        // WHAT MAKES HIM STAND UP
        //
        // He was drawn cut out, with no ground under him, and the background
        // behind his feet is receding meadow - so nothing in the picture said
        // where he was, and he read as pasted on top of it rather than
        // standing in it. His feet were already planted correctly; the
        // missing thing was the shadow they cast.
        //
        // Squashed flat and sat just under his heels, the same soft dark
        // patch the title sign uses. Wider than he is at the ankle but well
        // inside his shoulders, because a shadow as wide as the whole figure
        // reads as a pool he is hovering over rather than contact.
        //
        // BELOW the feet line, not straddling it. Centred on his feet the
        // patch ran from 29px above them to 17 below, which put the dark
        // middle of the gradient behind his legs where it cannot be seen -
        // only the faint outer edge reached the ground, and the figure went
        // on looking exactly as unplanted as before.
        //
        // Added before him so it lies under his feet rather than across them.
        this.krishnaShadow = this.add.image(
            GAME_WIDTH/2, krishnaFeet + 10, "glowPatch"
        )
            .setDisplaySize(this.krishna.displayWidth * 0.66, 52)
            .setAlpha(0.7)
            .setDepth(this.krishna.depth - 1);

        this.children.moveBelow(this.krishnaShadow, this.krishna);

        this.tweens.add({
            targets: this.krishna,
            scaleY: this.krishna.scaleY * 1.018,
            duration: 1700,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut"
        });

        // The shadow does NOT breathe with him. His feet do not leave the
        // ground, so the contact patch they make cannot change size - and a
        // shadow that pulses under a standing figure is the exact thing that
        // reads as hovering.

        // Low enough to clear his feet: at the old fixed 940 its top edge cut
        // across his ankles once he was drawn full height.
        this.playButton = fitWidth(
            this.add.image(GAME_WIDTH/2, playY, "playButton"),
            280
        ).setInteractive({ useHandCursor: true });

        this.tweens.add({
            targets: this.playButton,
            scale: this.playButton.scale * 1.06,
            duration: 900,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut"
        });

        this.playButton.on("pointerdown", () => {

            AudioManager.play(this,"click");

            this.scene.start("WorldSelectScene");

        });

        // Settings
        this.settingsButton = fitWidth(
            this.add.image(GAME_WIDTH - 80, GAME_HEIGHT - 90, "settingsButton"),
            75
        ).setInteractive({ useHandCursor: true });

        this.tweens.add({
            targets: this.settingsButton,
            angle: 360,
            duration: 10000,
            repeat: -1,
            ease: "Linear"
        });

        this.settingsPanel = new SettingsPanel(this);

        this.settingsButton.on("pointerdown", () => {

            AudioManager.play(this,"click");

            this.settingsPanel.open();

        });

    }

}
