import Levels from "../data/levels";
import SaveManager from "./SaveManager";

export default class LevelManager {

    static getLevels() {

        const save = SaveManager.load();

        return Levels.map(level => {

            return {

                ...level,

                unlocked: level.id <= save.unlockedLevel,

                stars: save.stars[level.id] || 0

            };

        });

    }

    static getLevel(id) {

        return Levels.find(level => level.id === id) || Levels[0];

    }

    static getCount() {

        return Levels.length;

    }

}
