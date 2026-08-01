import Levels from "../data/levels";
import SaveManager from "./SaveManager";

export default class LevelManager {

    static getLevels() {

        const stars = SaveManager.loadStars();

        return Levels.map(level => {

            return {

                ...level,

                unlocked:
                    level.id === 1 ||
                    stars[level.id - 1] > 0

            };

        });

    }

}