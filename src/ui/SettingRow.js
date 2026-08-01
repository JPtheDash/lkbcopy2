import Phaser from "phaser";
import ToggleSwitch from "./ToggleSwitch";

export default class SettingRow {

    constructor(scene, container, config) {

        this.scene = scene;

        this.container = container;

        this.row = scene.add.image(
            0,
            config.y,
            "settingsRow"
        );

        this.row.setScale(0.42);

        container.add(this.row);

        this.label = scene.add.text(

            -210,

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

                190,

                config.y,

                true

            );

            container.add(this.control.image);

        }

    }

}