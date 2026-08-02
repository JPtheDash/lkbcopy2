import Phaser from "phaser";
import { loadImage } from "../ui/loader";
import { loadKrishna, createKrishnaAnimations, KRISHNA_KEY } from "../ui/krishna";
import AudioManager from "../managers/AudioManager";
import homeBackground from "../assets/backgrounds/home_background.jpg";
import logo from "../assets/ui/logo.png";
import playButtonImg from "../assets/ui/play_button.png";
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
import { fitWidth, fitHeight, GAME_WIDTH, GAME_HEIGHT } from "../ui/layout";

export default class HomeScene extends Phaser.Scene {

    constructor() {
        super("HomeScene");
    }

    preload() {

        AudioManager.preload(this);

        loadImage(this, "homeBg", homeBackground);
        loadImage(this, "butterPot", butterPot);
        loadImage(this, "logo", logo);
        loadKrishna(this);
        loadImage(this, "playButton", playButtonImg);
        loadImage(this, "settingsButton", settingsButton);
        loadImage(this, "settingsPanel", settingsPanel);
        loadImage(this, "settingsRow", settingsRow);
        loadImage(this, "toggleOn", toggleOn);
        loadImage(this, "toggleOff", toggleOff);
        loadImage(this, "iconMusic", iconMusic);
        loadImage(this, "iconSound", iconSound);
        loadImage(this, "iconLanguage", iconLanguage);

    }

    create() {

        AudioManager.startMusic(this, "menu");

        // Background
        this.add.image(GAME_WIDTH/2, GAME_HEIGHT/2, "homeBg")
            .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
            .setDepth(-100);

        // Warm scrim so the white UI text stays readable on the art
        this.add.rectangle(
            GAME_WIDTH/2, GAME_HEIGHT/2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.25
        ).setDepth(-99);

        // Logo
        this.logo = fitWidth(
            this.add.image(GAME_WIDTH/2, 210, "logo"),
            430
        ).setDepth(2);

        this.tweens.add({
            targets: this.logo,
            y: 198,
            duration: 1800,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut"
        });

        // Butter pot
        this.butterPot = fitHeight(
            this.add.image(160, 470, "butterPot"),
            120
        ).setDepth(1);

        this.tweens.add({
            targets: this.butterPot,
            angle: 8,
            duration: 900,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut"
        });

        // Krishna, breathing rather than posed
        createKrishnaAnimations(this);

        fitHeight(
            this.add.sprite(GAME_WIDTH/2, 660, KRISHNA_KEY, 0),
            470
        ).play("krishna-idle");

        // Play button
        this.playButton = fitWidth(
            this.add.image(GAME_WIDTH/2, 940, "playButton"),
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

            this.scene.start("LevelSelectScene");

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
