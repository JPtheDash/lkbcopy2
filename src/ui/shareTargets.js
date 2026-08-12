/**
 * The named apps on the share page, and what each of them can actually take.
 *
 * WHAT IS AND IS NOT POSSIBLE HERE - THIS IS THE WHOLE DESIGN
 * ----------------------------------------------------------
 * A share URL can carry text and a link. It cannot carry a picture. There is
 * no WhatsApp or Facebook address that says "post THIS image" - the image has
 * to be handed over as a file, and the only thing that can hand a file to
 * another app is the operating system's own share sheet.
 *
 * So there are two kinds of button on that page and they do genuinely
 * different things:
 *
 *   picture   goes out through the share sheet, carrying the card. Every one
 *             of these apps appears in that sheet and every one of them
 *             receives the image properly.
 *
 *   link      opens that one app directly with the message and the store
 *             link already written. Faster, and lands exactly where the
 *             player wanted - but it is words only.
 *
 * Instagram is the reason this is not a free choice. Instagram accepts no
 * shared text at all, and has no share URL of any kind: a post is a picture
 * or it is nothing. So its button is a picture button whatever the others do,
 * and pretending otherwise would put players in an empty Instagram box
 * wondering where their card went.
 *
 * The https:// forms are used rather than the app schemes (whatsapp://,
 * tg://). Android hands an https link to the app when it is installed and to
 * a browser when it is not; an app scheme with nothing registered to it
 * navigates the WebView to a dead URL, which takes the game down with it.
 */

import { STORE_URL } from "./ShareCard";
import { shareText } from "./shareVictory";

export const TARGETS = [
    { id: "whatsapp",  label: "WhatsApp",  colour: 0x25D366, mode: "link" },
    { id: "instagram", label: "Instagram", colour: 0xD8306C, mode: "picture" },
    { id: "facebook",  label: "Facebook",  colour: 0x1877F2, mode: "link" },
    { id: "x",         label: "X",         colour: 0x1A1A1A, mode: "link" },
    { id: "telegram",  label: "Telegram",  colour: 0x229ED9, mode: "link" },
    { id: "copy",      label: "Copy text", colour: 0x6B4A22, mode: "copy" }
];


/** The boast without the link on the end, for the sites that take it apart. */
function boastOnly(result){

    return shareText(result).split("\n\nPlay it free:")[0];

}


export function targetUrl(id, result){

    const full = encodeURIComponent(shareText(result));
    const boast = encodeURIComponent(boastOnly(result));
    const store = encodeURIComponent(STORE_URL);

    switch(id){

        case "whatsapp":
            return `https://wa.me/?text=${full}`;

        case "telegram":
            return `https://t.me/share/url?url=${store}&text=${boast}`;

        case "x":
            return `https://twitter.com/intent/tweet?text=${boast}&url=${store}`;

        // Facebook takes the link and builds its own preview from the
        // listing. It has ignored any text passed alongside since 2017, so
        // sending one would only be a message the player never sees posted.
        case "facebook":
            return `https://www.facebook.com/sharer/sharer.php?u=${store}`;

        default:
            return null;

    }

}


/**
 * Opens one of the link targets.
 *
 * _blank rather than assigning location, because Capacitor sends a _blank
 * window out to the system browser while an assignment navigates the WebView
 * the game is running in - which closes the game to open Facebook.
 */
export function openTarget(id, result){

    const url = targetUrl(id, result);

    if(!url){ return false; }

    const opened = window.open(url, "_blank", "noopener,noreferrer");

    return !!opened;

}


/** @returns "copied" | "failed" */
export async function copyText(result){

    const text = shareText(result);

    try{

        if(navigator.clipboard && navigator.clipboard.writeText){

            await navigator.clipboard.writeText(text);

            return "copied";

        }

    }
    catch{

        // Falls through to the textarea below, which works in WebViews that
        // refuse the async clipboard without a user-gesture heuristic we
        // cannot satisfy from a Phaser pointer event.

    }

    try{

        const scratch = document.createElement("textarea");

        scratch.value = text;
        scratch.setAttribute("readonly", "");
        scratch.style.cssText = "position:fixed;top:-1000px;opacity:0;";

        document.body.appendChild(scratch);
        scratch.select();

        const ok = document.execCommand("copy");

        scratch.remove();

        return ok ? "copied" : "failed";

    }
    catch{

        return "failed";

    }

}
