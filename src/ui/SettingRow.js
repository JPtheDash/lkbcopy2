import ToggleSwitch from "./ToggleSwitch";
import { fitWidth } from "./layout";

export default class SettingRow {

    constructor(scene, container, config) {

        this.scene = scene;

        this.container = container;

        this.row = scene.add.image(
            0,
            config.y,
            "settingsRow"
        );

        fitWidth(this.row, 470);

        container.add(this.row);

        // Rows that have art for their subject lead with it. The icon carries
        // the meaning at a glance and the words confirm it, which also gives
        // the language row something readable to someone who cannot yet read
        // the language it is set to.
        if(config.icon && scene.textures.exists(config.icon)){

            this.icon = fitWidth(
                scene.add.image(-168, config.y, config.icon),
                58
            );

            container.add(this.icon);

        }

        this.label = scene.add.text(

            this.icon ? -128 : -185,

            config.y,

            config.label,

            {

                fontSize: "30px",

                fontStyle: "bold",

                color: "#4A2A08"

            }

        ).setOrigin(0,0.5);

        container.add(this.label);

        if(config.type === "toggle") {

            this.control = new ToggleSwitch(

                scene,

                150,

                config.y,

                config.value !== undefined ? config.value : true,

                config.onChange

            );

            container.add(this.control.image);

        }

    }

}