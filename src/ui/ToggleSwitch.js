import Phaser from "phaser";

export default class ToggleSwitch {

    constructor(scene, x, y, initialState = true) {

        this.scene = scene;
        this.state = initialState;

        this.image = scene.add.image(
            x,
            y,
            this.state ? "toggleOn" : "toggleOff"
        );

        this.image.setScale(0.18);

        this.image.setInteractive({
            useHandCursor: true
        });

        this.image.on("pointerdown", () => {

            this.toggle();

        });

    }

    toggle() {

        this.state = !this.state;

        this.image.setTexture(
            this.state
                ? "toggleOn"
                : "toggleOff"
        );

    }

    getValue() {

        return this.state;

    }

}