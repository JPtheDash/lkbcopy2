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
     * A world opens only when the world before it has been cleared in full -
     * all ten levels finished, not merely reached.
     *
     * That was already true before this said so, but only as a side effect:
     * levels unlock one at a time, so the id of a later world's first level
     * could not come up until every level before it had been beaten, and the
     * rule was read off `levels[0].unlocked`. Anything that ever advanced
     * `unlockedLevel` by more than one - a skip after repeated failures, a
     * jump straight to a world, a reordered table - would have opened a world
     * on an unfinished one, silently and with nothing to catch it. Stating
     * the rule where it is enforced costs a few lines and cannot drift.
     *
     * `cleared` is levels with at least one feather, and a win is never worth
     * less than one (see StarReward), so "cleared" and "finished" are the
     * same set. Old saves need no migration for the same reason.
     */
    static getWorlds() {

        // Carried forward rather than looked up, so each world is judged on
        // the one before it in a single pass.
        let previousDone = true;

        return Worlds.map(world => {

            const levels = this.getLevelsInWorld(world.id);

            const cleared = levels.filter(l => l.stars > 0).length;

            const unlocked = previousDone && levels.length > 0;

            previousDone = cleared >= levels.length;

            return {

                ...world,

                count: levels.length,

                unlocked,

                // Both go on the card: cleared says how far through you are,
                // stars says how well it went.
                cleared,

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
