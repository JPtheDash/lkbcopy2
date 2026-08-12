const SAVE_KEY = "littleKrishnaSave";

export default class SaveManager{

    static load(){

        const save = localStorage.getItem(SAVE_KEY);

        if(save){

            return JSON.parse(save);

        }

        return{

            unlockedLevel:1,

            stars:{},

            sound:true

        };

    }

    static isSoundOn(){

        // Defaults to on for saves written before the setting existed
        return this.load().sound !== false;

    }

    static setSoundOn(on){

        const data=this.load();

        data.sound=on;

        this.save(data);

    }

    static isMusicOn(){

        return this.load().music !== false;

    }

    static setMusicOn(on){

        const data=this.load();

        data.music=on;

        this.save(data);

    }

    /**
     * Back to a brand new game: level 1 open, nothing else, no feathers.
     *
     * The whole entry is removed rather than overwritten with defaults, so
     * load() rebuilds it from one place. Written twice, the defaults here and
     * the defaults in load() would be free to drift apart, and a reset would
     * quietly restore whichever of the two was older.
     *
     * Sound and music are deliberately NOT part of this. They are how the
     * player has set the game up, not something they achieved, and wiping
     * them turns "start again" into a small unpleasant surprise.
     */
    static reset(){

        const { sound, music } = this.load();

        localStorage.removeItem(SAVE_KEY);

        const fresh = this.load();

        fresh.sound = sound;
        fresh.music = music;

        this.save(fresh);

    }

    static save(data){

        localStorage.setItem(

            SAVE_KEY,

            JSON.stringify(data)

        );

    }

    static saveStars(level,stars){

        const data=this.load();

        const previous=data.stars[level] || 0;

        if(stars>previous){

            data.stars[level]=stars;

        }

        if(level>=data.unlockedLevel){

            data.unlockedLevel=level+1;

        }

        this.save(data);

    }

}