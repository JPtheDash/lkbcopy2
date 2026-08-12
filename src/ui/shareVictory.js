/**
 * Sends the victory card wherever the player wants it.
 *
 * THREE PATHS, BECAUSE THIS GAME RUNS IN TWO PLACES
 * -------------------------------------------------
 * On a phone it is a WebView inside a Capacitor app, and `navigator.share` is
 * not available there - a WebView is not a browser tab and does not get the
 * Web Share API. Sharing has to go out through the native plugin, which wants
 * a file:// URL rather than a blob, so the picture is written to the app's
 * cache first.
 *
 * In a desktop or mobile browser the plugin has no native half to call, so
 * the Web Share API is used directly where it exists - and it mostly does not
 * on desktop, which is the third path: save the picture and put the link on
 * the clipboard, so the player can still send it by hand.
 *
 * Every path ends the same way as far as the caller is concerned: it either
 * worked, or the player backed out, or it genuinely failed. Nothing here
 * throws at the game.
 */

import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { Filesystem, Directory } from "@capacitor/filesystem";

import { STORE_URL } from "./ShareCard";

const FILE_NAME = "butter-hunt-victory.png";

/** What travels with the picture. The link is here, where it is tappable. */
export function shareText(result){

    const boast = result.message
        ? `${result.message}\n\n`
        : "";

    return (
        `${boast}I cleared ${result.worldName} in Little Krishna's Butter ` +
        `Hunt with ${result.feathers}/${result.maxFeathers} feathers!\n\n` +
        `Play it free: ${STORE_URL}`
    );

}


function toBlob(canvas){

    return new Promise(resolve => {

        // toBlob rather than toDataURL: a 1080px PNG is about 1.5MB, and as
        // a data URL that is a 2MB string built in one go on the main thread.
        if(canvas.toBlob){

            canvas.toBlob(resolve, "image/png");

            return;

        }

        resolve(null);

    });

}


/** The base64 body of the PNG, without the `data:` preamble the plugin rejects. */
function toBase64(canvas){

    return canvas.toDataURL("image/png").split(",")[1];

}


/**
 * @returns "shared" | "cancelled" | "saved" | "failed"
 */
export default async function shareVictory(canvas, result){

    const text = shareText(result);
    const title = "Little Krishna's Butter Hunt";

    //---------------------------------
    // On a phone
    //---------------------------------

    if(Capacitor.isNativePlatform()){

        try{

            // Cache, not Documents: this is a picture the player is passing
            // on, not one they are keeping, and Cache needs no storage
            // permission on any Android version.
            const written = await Filesystem.writeFile({
                path: FILE_NAME,
                data: toBase64(canvas),
                directory: Directory.Cache
            });

            await Share.share({
                title,
                text,
                files: [written.uri],
                dialogTitle: "Share your victory"
            });

            return "shared";

        }
        catch(error){

            if(isCancellation(error)){ return "cancelled"; }

            // Falling back to text alone rather than giving up. Some Android
            // targets refuse an image they cannot handle, and a boast with a
            // working link still does the job the card was for.
            try{

                await Share.share({ title, text, dialogTitle: "Share your victory" });

                return "shared";

            }
            catch(textError){

                return isCancellation(textError) ? "cancelled" : "failed";

            }

        }

    }

    //---------------------------------
    // In a browser that can share files
    //---------------------------------

    const blob = await toBlob(canvas);

    if(blob && navigator.canShare){

        const file = new File([blob], FILE_NAME, { type: "image/png" });

        if(navigator.canShare({ files: [file] })){

            try{

                await navigator.share({ files: [file], text, title });

                return "shared";

            }
            catch(error){

                if(isCancellation(error)){ return "cancelled"; }

            }

        }

    }

    //---------------------------------
    // Anywhere else
    //---------------------------------

    return saveAndCopy(blob, text);

}


/**
 * The desktop ending: put the picture in the downloads folder and the words
 * on the clipboard, which between them is everything the share sheet would
 * have done, just by hand.
 */
async function saveAndCopy(blob, text){

    if(!blob){ return "failed"; }

    try{

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = FILE_NAME;

        document.body.appendChild(link);
        link.click();
        link.remove();

        // Freed on a later turn of the loop - revoking it immediately can
        // cancel the download in some browsers before it has started.
        setTimeout(() => URL.revokeObjectURL(url), 60000);

        // NOT awaited. In a window that does not currently have focus,
        // writeText returns a promise that can sit unsettled indefinitely
        // rather than rejecting - and awaiting it left the Share button
        // showing "..." for ever, with no error anywhere to explain it.
        //
        // The picture is what this path is for; the text is a courtesy.
        if(navigator.clipboard && navigator.clipboard.writeText){

            navigator.clipboard.writeText(text).catch(() => {});

        }

        return "saved";

    }
    catch{

        return "failed";

    }

}


/**
 * Backing out of a share sheet is reported as an error by both the Web Share
 * API and the plugin, and it is not one - the player looked at their options
 * and chose none. Told apart from a real failure so the game does not say
 * something went wrong when nothing did.
 */
function isCancellation(error){

    if(!error){ return false; }

    if(error.name === "AbortError"){ return true; }

    return /abort|cancel|dismiss/i.test(String(error.message || error));

}
