import SettingRow, { CONTROL_RIGHT } from "./SettingRow";
import confirmDialog from "./ConfirmDialog";
import { fitWidth, GAME_WIDTH, GAME_HEIGHT } from "./layout";
import SaveManager from "../managers/SaveManager";
import AudioManager from "../managers/AudioManager";

// The panel's width on screen. Everything else here is a fraction of the art
// rather than a pixel count, so a re-export at a different size still lands.
const PANEL_WIDTH = 560;

// Where the carved ribbon sits in settings_panel.png, as a fraction of the
// art's height. The ribbon runs from y=101 to y=195 of the 1296-tall texture,
// so its centre is 11.4% down - NOT the 24% that a hand-picked -310 worked
// out to, which hung the word low enough that the g's descender dropped
// through the ribbon's bottom edge onto the wood.
const TITLE_BAND = 0.1142;

// The ribbon's flat writing area, as a fraction of the panel's width. The
// scrolled ends curl inward and are not writing surface.
const TITLE_ROOM = 0.52;

export default class SettingsPanel {

    constructor(scene) {

        this.scene = scene;
        this.isOpen = false;

        // =========================
        // Overlay
        // =========================
        // Sized to the canvas, not to the old fixed 1280: on a tall phone a
        // 1280-high scrim left the bottom of the screen undimmed, so the play
        // button stayed bright behind a modal panel.
        this.overlay = scene.add.rectangle(
            GAME_WIDTH/2,
            GAME_HEIGHT/2,
            GAME_WIDTH,
            GAME_HEIGHT,
            0x000000,
            0.55
        );

        this.overlay.setDepth(99);
        this.overlay.setVisible(false);
        this.overlay.setInteractive();

        this.overlay.on("pointerdown", () => {
            this.close();
        });

        // =========================
        // Main Container
        // =========================
        this.container = scene.add.container(GAME_WIDTH/2, GAME_HEIGHT/2);

        this.container.setDepth(100);
        this.container.setVisible(false);

        // =========================
        // Panel
        // =========================
        this.panel = scene.add.image(
            0,
            0,
            "settingsPanel"
        );

        fitWidth(this.panel, PANEL_WIDTH);

        this.container.add(this.panel);

        // =========================
        // Title
        // =========================
        // Arial, like every other piece of text in the game. Without a
        // fontFamily the browser picks, and on this WebView it picked a
        // monospace face - so the one word naming the panel was the only
        // thing in the whole app not set in the game's own typeface.
        this.title = scene.add.text(
            0,
            -this.panel.displayHeight/2 + this.panel.displayHeight * TITLE_BAND,
            "Settings",
            {
                fontFamily: "Arial",
                fontSize: "40px",
                fontStyle: "bold",
                color: "#5A2D0C"
            }
        ).setOrigin(0.5);

        // Shrunk to the ribbon if it ever outgrows it, the same way the level
        // and world headings are. This word does not need it in English; a
        // translation of it will.
        const titleRoom = this.panel.displayWidth * TITLE_ROOM;

        if(this.title.width > titleRoom){

            this.title.setScale(titleRoom / this.title.width);

        }

        this.container.add(this.title);

        // =========================
        // Music
        // =========================
        this.musicRow = new SettingRow(
            scene,
            this.container,
            {
                y: -205,
                label: "Music",
                icon: "iconMusic",
                type: "toggle",
                value: SaveManager.isMusicOn(),
                onChange: on => {

                    AudioManager.setMusicOn(on);

                    if(on){

                        AudioManager.startMusic(scene);

                    }

                }
            }
        );

        // =========================
        // Sound
        // =========================
        this.soundRow = new SettingRow(
            scene,
            this.container,
            {
                y: -85,
                label: "Sound",
                icon: "iconSound",
                type: "toggle",
                value: SaveManager.isSoundOn(),
                onChange: on => {

                    SaveManager.setSoundOn(on);

                    if(on){

                        AudioManager.play(scene,"click");

                    }

                }
            }
        );

        // =========================
        // Language
        // =========================
        this.languageRow = new SettingRow(
            scene,
            this.container,
            {
                y: 35,
                label: "Language",
                icon: "iconLanguage"
            }
        );

        // Sits where the toggles sit, so the three controls share a right
        // edge instead of each ending wherever its own text happened to run
        this.languageValue = scene.add.text(
            CONTROL_RIGHT,
            35,
            "English",
            {
                fontFamily: "Arial",
                fontSize: "28px",
                color: "#1E5AA8",
                fontStyle: "bold"
            }
        ).setOrigin(1, 0.5);

        this.languageValue.setInteractive({
            useHandCursor: true
        });

        this.languageValue.on("pointerdown", () => {

            console.log("Language selection coming later.");

        });

        this.container.add(this.languageValue);

        // =========================
        // About
        // =========================
        this.aboutRow = new SettingRow(
            scene,
            this.container,
            {
                y: 155,
                label: "About",
                onPress: () => this.showAbout()
            }
        );

        this.aboutArrow = scene.add.text(
            CONTROL_RIGHT,
            155,
            ">",
            {
                fontFamily: "Arial",
                fontSize: "40px",
                fontStyle: "bold",
                color: "#FFE9A8",
                stroke: "#5A2D0C",
                strokeThickness: 4
            }
        ).setOrigin(1, 0.5);

        this.container.add(this.aboutArrow);

        // =========================
        // Start again
        // =========================
        // Without this there is no way back to a new game from inside the
        // game. Progress lives in the WebView's own storage, so undoing it
        // meant clearing the app's data from Android's settings - which also
        // takes the sound and music settings with it, and which nobody would
        // guess at.
        this.resetRow = new SettingRow(
            scene,
            this.container,
            {
                y: 275,
                label: "Start again",
                onPress: () => this.confirmReset()
            }
        );

        this.resetArrow = scene.add.text(
            CONTROL_RIGHT,
            275,
            ">",
            {
                fontFamily: "Arial",
                fontSize: "40px",
                fontStyle: "bold",
                color: "#FFE9A8",
                stroke: "#5A2D0C",
                strokeThickness: 4
            }
        ).setOrigin(1, 0.5);

        this.container.add(this.resetArrow);

        // =========================
        // Close Button
        // =========================
        // The carved button the level-complete screen uses for Next, rather
        // than a coloured text box - which was the one thing on this panel
        // that did not look like it came from the same game.
        this.closeButton = fitWidth(
            scene.add.image(0, 380, "nextButton"),
            260
        ).setInteractive({ useHandCursor: true });

        this.closeLabel = scene.add.text(
            0,
            380,
            "CLOSE",
            {
                fontFamily: "Arial",
                fontSize: "36px",
                fontStyle: "bold",
                color: "#FFF3C4",
                stroke: "#5A2D0C",
                strokeThickness: 6
            }
        ).setOrigin(0.5);

        this.closeButton.on("pointerdown", () => {

            AudioManager.play(scene, "click");

            this.close();

        });

        this.container.add(this.closeButton);
        this.container.add(this.closeLabel);

    }

    /**
     * What "About" opens.
     *
     * Drawn in the game rather than through alert(), which blocks the
     * WebView's thread - the game freezes behind it and on Android it is
     * dressed with the page's own hostname, which on a packaged app reads as
     * something has gone wrong.
     */
    /**
     * Asks before wiping, because this cannot be undone.
     *
     * The dialog says what actually goes - every level and every feather -
     * rather than "are you sure?", which tells a player nothing about what
     * they are agreeing to.
     */
    confirmReset() {

        AudioManager.play(this.scene, "click");

        confirmDialog(this.scene, {
            message:
                "Start again?\n\nEvery level goes back to\nlocked, and every\nfeather is lost.",
            confirmText: "START AGAIN",
            cancelText: "KEEP",
            height: 420,
            fontSize: "34px",
            onConfirm: () => {

                SaveManager.reset();

                this.close();

                // Back to the front of the game. Staying put would leave the
                // screen behind this panel showing the progress that has just
                // been deleted, which reads as the reset not having worked.
                this.scene.scene.start("HomeScene");

            }
        });

    }

    showAbout() {

        AudioManager.play(this.scene, "click");

        confirmDialog(this.scene, {
            message:
                "Little Krishna's\nButter Hunt\n\n" +
                "Version 1.0\n\n" +
                "Climb for the butter,\nand hide from Mother.",
            confirmText: "OK",
            cancelText: null,
            height: 480,
            fontSize: "34px"
        });

    }

    open() {

        if (this.isOpen) return;

        this.isOpen = true;

        this.overlay.setVisible(true);

        this.container.setVisible(true);

        this.container.setScale(0.2);

        this.scene.tweens.add({

            targets: this.container,

            scale: 1,

            duration: 250,

            ease: "Back.Out"

        });

    }

    close() {

        if (!this.isOpen) return;

        this.isOpen = false;

        this.scene.tweens.add({

            targets: this.container,

            scale: 0.2,

            duration: 180,

            ease: "Back.In",

            onComplete: () => {

                this.container.setVisible(false);

                this.overlay.setVisible(false);

            }

        });

    }

}