import Phaser from "phaser";
import { loadImage } from "../ui/loader";
import AudioManager from "../managers/AudioManager";
import homeBackground from "../assets/backgrounds/home_background.jpg";
import krishnaHero from "../assets/characters/krishna_hero.png";
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

        // Logo
        this.logo = fitWidth(
            this.add.image(GAME_WIDTH/2, titleY, "logo"),
            430
        ).setDepth(2);

        this.tweens.add({
            targets: this.logo,
            y: titleY - 12,
            duration: 1800,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut"
        });

        // Butter pot, hung from the top of its rope so that swinging it turns
        // it about the point it hangs from - the same pivot the prize uses in
        // a level. Turned about its middle, the rope's fixing swings too and
        // the whole thing reads as a pot being waved rather than hanging.
        this.butterPot = fitHeight(
            this.add.image(150, 380, "butterPot").setOrigin(0.5, 0),
            200
        ).setDepth(1);

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

        this.tweens.add({
            targets: this.krishna,
            scaleY: this.krishna.scaleY * 1.018,
            duration: 1700,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut"
        });

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
