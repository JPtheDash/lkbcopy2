import SaveManager from "./SaveManager";
import { loadAudio } from "../ui/loader";

import jumpSfx from "../assets/audio/jump.wav";
import landSfx from "../assets/audio/land.wav";
import collectSfx from "../assets/audio/collect.wav";
import starSfx from "../assets/audio/star.wav";
import winSfx from "../assets/audio/win.wav";
import loseSfx from "../assets/audio/lose.wav";
import clickSfx from "../assets/audio/click.wav";
import musicTrack from "../assets/audio/music.ogg";

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

const MUSIC_KEY = "bgm";
const MUSIC_VOLUME = 0.35;

export default class AudioManager {

    static preload(scene){

        Object.entries(SOUNDS).forEach(([key,url])=>{

            loadAudio(scene, `sfx-${key}`, url);

        });

        loadAudio(scene, MUSIC_KEY, musicTrack);

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
    // The track is owned by the global sound manager rather than a scene, so
    // it keeps playing across scene changes instead of restarting on every
    // screen. Call startMusic from any scene that can be entered directly.
    //------------------------------------------------

    static startMusic(scene){

        if(!scene.cache.audio.exists(MUSIC_KEY)){

            return;

        }

        if(!this.music){

            this.music = scene.sound.add(MUSIC_KEY,{
                loop: true,
                volume: MUSIC_VOLUME
            });

        }

        if(!SaveManager.isMusicOn()){

            return;

        }

        if(!this.music.isPlaying){

            this.music.play();

        }

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
