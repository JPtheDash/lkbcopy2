export default function getStars(timeLeft){

    if(timeLeft >= 20){

        return 3;

    }

    if(timeLeft >= 10){

        return 2;

    }

    return 1;

}