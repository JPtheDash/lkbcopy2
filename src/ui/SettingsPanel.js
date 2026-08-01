import SettingRow from "./SettingRow";

export default class SettingsPanel {

    constructor(scene) {

        this.scene = scene;
        this.isOpen = false;

        // =========================
        // Overlay
        // =========================
        this.overlay = scene.add.rectangle(
            360,
            640,
            720,
            1280,
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
        this.container = scene.add.container(360, 640);

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

        this.panel.setScale(0.55);

        this.container.add(this.panel);

        // =========================
        // Title
        // =========================
        this.title = scene.add.text(
            0,
            -310,
            "Settings",
            {
                fontSize: "44px",
                fontStyle: "bold",
                color: "#5A2D0C"
            }
        ).setOrigin(0.5);

        this.container.add(this.title);

        // =========================
        // Music
        // =========================
        this.musicRow = new SettingRow(
            scene,
            this.container,
            {
                y: -170,
                label: "Music",
                type: "toggle"
            }
        );

        // =========================
        // Sound
        // =========================
        this.soundRow = new SettingRow(
            scene,
            this.container,
            {
                y: -40,
                label: "Sound",
                type: "toggle"
            }
        );

        // =========================
        // Language
        // =========================
        this.languageRow = new SettingRow(
            scene,
            this.container,
            {
                y: 90,
                label: "Language"
            }
        );

        this.languageValue = scene.add.text(
            180,
            90,
            "English",
            {
                fontSize: "28px",
                color: "#1E5AA8",
                fontStyle: "bold"
            }
        ).setOrigin(0.5);

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
                y: 220,
                label: "About"
            }
        );

        this.aboutArrow = scene.add.text(
            190,
            220,
            ">",
            {
                fontSize: "40px",
                fontStyle: "bold",
                color: "#5A2D0C"
            }
        ).setOrigin(0.5);

        this.aboutArrow.setInteractive({
            useHandCursor: true
        });

        this.aboutArrow.on("pointerdown", () => {

            alert(
                "Little Krishna's Butter Hunt\n\nVersion 1.0"
            );

        });

        this.container.add(this.aboutArrow);

        // =========================
        // Close Button
        // =========================
        this.closeButton = scene.add.text(
            0,
            350,
            "Close",
            {
                fontSize: "34px",
                fontStyle: "bold",
                color: "#8B0000",
                backgroundColor: "#c29024ff",
                padding: {
                    left: 20,
                    right: 20,
                    top: 10,
                    bottom: 10
                }
            }
        ).setOrigin(0.5);

        this.closeButton.setInteractive({
            useHandCursor: true
        });

        this.closeButton.on("pointerdown", () => {

            this.close();

        });

        this.container.add(this.closeButton);

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