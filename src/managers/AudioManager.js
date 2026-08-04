import SaveManager from "./SaveManager";
import { loadAudio } from "../ui/loader";

import jumpSfx from "../assets/audio/jump.wav";
import landSfx from "../assets/audio/land.wav";
import collectSfx from "../assets/audio/collect.wav";
import starSfx from "../assets/audio/star.wav";
import winSfx from "../assets/audio/win.wav";
import loseSfx from "../assets/audio/lose.wav";
import clickSfx from "../assets/audio/click.wav";
import menuTrack from "../assets/audio/menu_music.ogg";
import gameTrack from "../assets/audio/game_music.ogg";

const SOUNDS = {
    jump: jumpSfx,
    land: landSfx,
    collect: collectSfx,
    star: starSfx,
    win: winSfx,
    lose: loseSfx,
    click: clickSfx
};

const VOLUME = {
    jump: 0.5,
    land: 0.4,
    collect: 0.7,
    star: 0.6,
    win: 0.7,
    lose: 0.6,
    click: 0.45
};

// Two tracks: one for the menus, one for the climb. Named rather than
// numbered so a scene asks for the mood it wants, not for a file.
const MUSIC = {
    menu: { key: "bgm-menu", url: menuTrack },
    game: { key: "bgm-game", url: gameTrack }
};

const MUSIC_VOLUME = 0.35;

// Long enough to hear as a change of scene, short enough that starting a
// level does not begin with silence.
const MUSIC_FADE_MS = 600;

export default class AudioManager {

    static preload(scene){

        Object.entries(SOUNDS).forEach(([key,url])=>{

            loadAudio(scene, `sfx-${key}`, url);

        });

        Object.values(MUSIC).forEach(({key,url})=>{

            loadAudio(scene, key, url);

        });

    }

    static play(scene,key){

        if(!SaveManager.isSoundOn()){

            return;

        }

        if(!scene.cache.audio.exists(`sfx-${key}`)){

            return;

        }

        scene.sound.play(`sfx-${key}`,{
            volume: VOLUME[key] ?? 0.5
        });

    }

    //------------------------------------------------
    // Music
    //
    // Tracks are owned by the global sound manager rather than by a scene, so
    // moving between screens does not restart the music. Every scene names
    // the track it wants on entry; asking for the one already playing is a
    // no-op, so walking the menus does not retrigger it.
    //------------------------------------------------

    static startMusic(scene, track = this.wantedTrack || "menu"){

        const wanted = MUSIC[track];

        if(!wanted || !scene.cache.audio.exists(wanted.key)){

            return;

        }

        this.wantedTrack = track;

        if(!SaveManager.isMusicOn()){

            return;

        }

        if(this.music && this.playing === track){

            if(!this.music.isPlaying){

                this.music.play();

            }

            return;

        }

        // Cutting from one track straight to the other is jarring at the top
        // of a level, so the outgoing one is faded and only then stopped.
        if(this.music && this.music.isPlaying){

            const outgoing = this.music;

            scene.tweens.add({
                targets: outgoing,
                volume: 0,
                duration: MUSIC_FADE_MS,
                onComplete: ()=> outgoing.stop()
            });

        }

        this.music = scene.sound.add(wanted.key,{
            loop: true,
            volume: 0
        });

        this.playing = track;

        this.music.play();

        scene.tweens.add({
            targets: this.music,
            volume: MUSIC_VOLUME,
            duration: MUSIC_FADE_MS
        });

    }

    static setMusicOn(on){

        SaveManager.setMusicOn(on);

        if(!this.music){

            return;

        }

        if(on){

            if(!this.music.isPlaying){

                this.music.play();

            }

        }
        else{

            this.music.stop();

        }

    }

}
