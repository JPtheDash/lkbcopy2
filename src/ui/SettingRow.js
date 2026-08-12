import ToggleSwitch from "./ToggleSwitch";
import { fitWidth } from "./layout";

// The row art is 470 wide and centred, so it runs from -235 to +235 with a
// moulded gem at each end. Measured off settings_row.png, those gems sit at
// +/-204 and are about 19 wide at this size, so anything reaching past ~190
// collides with one - which is what put "English" through the right-hand gem.
//
// Labels share a left edge, controls share a right edge. Aligning controls by
// their centres instead would step their right-hand ends about wherever each
// one's own width happened to fall.
export const ROW_WIDTH = 470;
export const ICON_X = -168;
export const LABEL_X = -120;
export const CONTROL_RIGHT = 168;

export default class SettingRow {

    constructor(scene, container, config) {

        this.scene = scene;

        this.container = container;

        this.row = scene.add.image(
            0,
            config.y,
            "settingsRow"
        );

        fitWidth(this.row, ROW_WIDTH);

        container.add(this.row);

        // Rows that have art for their subject lead with it. The icon carries
        // the meaning at a glance and the words confirm it, which also gives
        // the language row something readable to someone who cannot yet read
        // the language it is set to.
        if(config.icon && scene.textures.exists(config.icon)){

            this.icon = fitWidth(
                scene.add.image(ICON_X, config.y, config.icon),
                58
            );

            container.add(this.icon);

        }

        // Every label starts on the same line, whether or not the row has an
        // icon. It used to shift out to -185 without one, so About sat a
        // finger's width left of Music, Sound and Language and the column of
        // text visibly stepped.
        this.label = scene.add.text(

            LABEL_X,

            config.y,

            config.label,

            {

                // Named, not left to the browser. Unset, this row's text came
                // out in whatever face the WebView defaults to - a monospace
                // one here - while the buttons around it were Arial.
                fontFamily: "Arial",

                fontSize: "30px",

                fontStyle: "bold",

                color: "#4A2A08"

            }

        ).setOrigin(0,0.5);

        container.add(this.label);

        if(config.type === "toggle") {

            this.control = new ToggleSwitch(

                scene,

                0,

                config.y,

                config.value !== undefined ? config.value : true,

                config.onChange

            );

            // Placed by its right edge once it knows how wide it drew itself
            this.control.image.x =
                CONTROL_RIGHT - this.control.image.displayWidth/2;

            container.add(this.control.image);

        }

        // The whole row answers a tap, not just the small mark at its end.
        // Reaching for a 24px chevron on a phone is a poor target when there
        // is a 470px bar sitting under it doing nothing.
        if(config.onPress){

            this.row.setInteractive({ useHandCursor: true });

            this.row.on("pointerdown", config.onPress);

        }

    }

}