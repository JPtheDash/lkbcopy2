// Scenes share art - Krishna and the play button appear on several screens -
// and Phaser logs "Texture key already in use" when a second scene loads a
// key the first already cached. Harmless, but it fills the console with
// errors and hides real ones, so every scene loads through this instead.

export function loadImage(scene, key, url){

    if(!scene.textures.exists(key)){

        scene.load.image(key, url);

    }

}

export function loadSheet(scene, key, url, frameWidth, frameHeight){

    if(!scene.textures.exists(key)){

        scene.load.spritesheet(key, url, { frameWidth, frameHeight });

    }

}

export function loadAudio(scene, key, url){

    if(!scene.cache.audio.exists(key)){

        scene.load.audio(key, url);

    }

}
