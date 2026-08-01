import Phaser from "phaser";
import homeBackground from "../assets/backgrounds/home_background.png";
import logo from "../assets/ui/logo.png";
import playButtonImg from "../assets/ui/play_button.png";
import krishnaIdle from "../assets/characters/krishna_idle.png";
import butterPot from "../assets/items/butter_pot.png";
import settingsButton from "../assets/ui/settings_button.png";
import settingsPanel from "../assets/ui/settings_panel.png";
import settingsRow from "../assets/ui/settings_row.png";
import toggleOn from "../assets/ui/toggle_on.png";
import toggleOff from "../assets/ui/toggle_off.png";
import SettingsPanel from "../ui/SettingsPanel";

export default class HomeScene extends Phaser.Scene {
    constructor() {
        super("HomeScene");
    }

    preload() {
        this.load.image("homeBg", homeBackground);
        this.load.image("butterPot", butterPot);
        this.load.image("logo", logo);
        this.load.image("krishna", krishnaIdle);
        this.load.image("playButton", playButtonImg);
        this.load.image("settingsButton", settingsButton);
        this.load.image("settingsPanel", settingsPanel);
        this.load.image("settingsRow", settingsRow);
        this.load.image("toggleOn", toggleOn);
        this.load.image("toggleOff", toggleOff);

    }

    create() {

        this.settingsOpen = false;

        // Background
        this.background = this.add.image(360, 640, "homeBg");
        this.background.setDisplaySize(720, 1280);
        this.background.setDepth(-100);

        // Logo
        this.logo = this.add.image(360, 220, "logo");
        this.logo.setScale(0.45);
        this.logo.setDepth(2);

        this.tweens.add({
            targets: this.logo,
            y: 210,
            duration: 1800,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut"
        });

        this.rope = this.add.graphics();

        this.rope.lineStyle(6, 0xC8A46A, 1);

        //butter pot
        this.butterPot = this.add.image(
            180,
            340,
            "butterPot"
        );

        this.butterPot.setScale(0.25);
        this.butterPot.setDepth(1);

        this.tweens.add({
            targets: this.butterPot,
            angle: 8,
            duration: 900,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut"
        });

        //Krishna
        this.krishna = this.add.image(
            360,
            670,
            "krishna"
        );
        // this.tweens.add({
        //     targets: this.krishna,
        //     y: 1000,
        //     duration: 1200,
        //     yoyo: true,
        //     repeat: -1,
        //     ease: "Sine.easeInOut"
        // });

        this.krishna.setScale(0.50);

        // Play Button
        this.playButton = this.add.image(
            360,
            950,
            "playButton"
        );

        this.playButton.setScale(0.42);
        this.playButton.setInteractive({ useHandCursor: true });

        this.tweens.add({
            targets: this.playButton,
            scaleX: 0.44,
            scaleY: 0.44,
            duration: 900,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut"
        });

        this.playButton.on("pointerdown", () => {
            this.scene.start("LevelSelectScene");
        });

        //setting
        this.settingsButton = this.add.image(
            650,
            1180,
            "settingsButton"
        );

        this.settingsButton.setScale(0.18);

        this.settingsButton.setInteractive({ useHandCursor: true });

        this.tweens.add({
            targets: this.settingsButton,
            angle: 360,
            duration: 10000,
            repeat: -1,
            ease: "Linear"
        });

        this.settingsPanel = new SettingsPanel(this);
        this.settingsButton.on("pointerdown", () => {

            this.settingsPanel.open();

        });

    }

}