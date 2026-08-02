// Stars are awarded on the fraction of the level's timer left, so the
// thresholds hold for every level regardless of its length.

export default function getStars(timeLeft,totalTime){

    const fraction = totalTime > 0
        ? timeLeft / totalTime
        : 0;

    if(fraction >= 0.6){

        return 3;

    }

    if(fraction >= 0.3){

        return 2;

    }

    return 1;

}
