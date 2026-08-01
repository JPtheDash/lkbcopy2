const SAVE_KEY = "littleKrishnaSave";

export default class SaveManager{

    static load(){

        const save = localStorage.getItem(SAVE_KEY);

        if(save){

            return JSON.parse(save);

        }

        return{

            unlockedLevel:1,

            stars:{}

        };

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