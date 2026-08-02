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