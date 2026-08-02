// Stars are awarded on how many seconds are left on the clock, not on what
// fraction of the timer that is. Twenty seconds spare means the same thing to
// a player whether the level allowed sixty or forty-five - it is the margin
// they can feel, and a fraction of an unseen total is not.
//
// This is why every level's timer has to leave room for three stars to be
// possible: a level whose timer is 20s can never award them, because
// finishing with 20s left would mean finishing instantly. Timers in
// levels.js are set from measured completion times with that in mind.

const THREE = 20;
const TWO = 10;
const ONE = 1;

export default function getStars(timeLeft){

    if(timeLeft >= THREE){

        return 3;

    }

    if(timeLeft >= TWO){

        return 2;

    }

    if(timeLeft >= ONE){

        return 1;

    }

    return 0;

}
