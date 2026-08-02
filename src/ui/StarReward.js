// Stars are awarded on how many seconds are left when Krishna takes the pot,
// not on what fraction of the timer that is. Twenty seconds spare means the
// same thing to a player whether the level allowed sixty or forty-five - it
// is the margin they can feel, and a fraction of an unseen total is not.
//
// The clock is read in GameScene.win(), on the frame he reaches the pot, so
// the outro he plays afterwards costs him nothing.
//
// This is why every level's timer has to leave room for three stars to be
// possible: a level whose timer is 20s can never award them, because
// finishing with 20s left would mean finishing instantly. Timers in
// levels.js are set from measured completion times with that in mind.

const THREE = 20;
const TWO = 15;

export default function getStars(timeLeft){

    if(timeLeft >= THREE){

        return 3;

    }

    if(timeLeft >= TWO){

        return 2;

    }

    // Everything below fifteen is one star, which covers the under-ten case
    // too. Reaching the pot at all is worth something, so a win is never
    // worth nothing.
    return 1;

}
