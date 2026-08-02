import { fitWidth } from "./layout";

export default class ToggleSwitch {

    constructor(scene, x, y, initialState = true, onChange = null) {

        this.scene = scene;
        this.state = initialState;
        this.onChange = onChange;

        this.image = scene.add.image(
            x,
            y,
            this.state ? "toggleOn" : "toggleOff"
        );

        fitWidth(this.image, 92);

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

        if(this.onChange){

            this.onChange(this.state);

        }

    }

}