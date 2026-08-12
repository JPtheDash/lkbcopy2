import Levels, { Worlds, LEVELS_PER_WORLD } from "../data/levels";
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

    //------------------------------------------------

    /**
     * Which world a level belongs to, counting from 1.
     *
     * Derived from the id rather than stored on the level, so the two cannot
     * disagree - a world is exactly a slice of the table, and
     * tools/levelcheck.mjs enforces that the ids run 1..n in order.
     */
    static worldOf(levelId) {

        return Math.floor((levelId - 1) / LEVELS_PER_WORLD) + 1;

    }

    //------------------------------------------------

    /** The ten levels of one world, with unlock state and stars attached. */
    static getLevelsInWorld(worldId) {

        const first = (worldId - 1) * LEVELS_PER_WORLD;

        return this.getLevels().slice(first, first + LEVELS_PER_WORLD);

    }

    //------------------------------------------------

    /**
     * The worlds, with how far the player has got in each.
     *
     * A world is unlocked when its first level is. That needs nothing new in
     * the save: levels already unlock one at a time, so finishing level 10
     * unlocks level 11, which is world 2's first - and anyone part-way
     * through an older save lands in the right place with no migration.
     */
    static getWorlds() {

        return Worlds.map(world => {

            const levels = this.getLevelsInWorld(world.id);

            return {

                ...world,

                count: levels.length,

                unlocked: levels.length > 0 && levels[0].unlocked,

                // Both go on the card: cleared says how far through you are,
                // stars says how well it went.
                cleared: levels.filter(l => l.stars > 0).length,

                stars: levels.reduce((sum, l) => sum + l.stars, 0),

                maxStars: levels.length * 3

            };

        });

    }

    //------------------------------------------------

    /**
     * Which world the world screen should open on - the furthest one reached,
     * so a player is not made to look past worlds they have finished.
     */
    static currentWorld() {

        const unlocked = this.getWorlds().filter(w => w.unlocked);

        return unlocked.length ? unlocked[unlocked.length - 1].id : 1;

    }

}
