/**
 * Asks the player to type something.
 *
 * WHY THIS ONE THING IS HTML
 * --------------------------
 * Everything else in this game is drawn in Phaser on purpose - see
 * ConfirmDialog, which exists because a native confirm() freezes the
 * WebView's thread and stops the game loop mid-frame.
 *
 * Typing is the exception. A real <input> is what summons the phone's own
 * keyboard, with its autocorrect, its emoji, its long-press accents and the
 * language the player actually set. Drawing our own keyboard would mean
 * building all of that badly, in one font, in English.
 *
 * So it is HTML, but it is HTML styled to look like the rest of the game, and
 * it is torn down completely when it closes - nothing is left over the canvas
 * to swallow the next tap.
 *
 * @returns the trimmed text, or null if the player backed out
 */

let open = false;

export default function textPrompt({
    heading = "",
    placeholder = "",
    initial = "",
    maxLength = 70,
    confirmText = "OK",
    cancelText = "CANCEL"
} = {}){

    // One at a time. Two of these would fight over the keyboard focus.
    if(open){ return Promise.resolve(null); }

    open = true;

    return new Promise(resolve => {

        const veil = document.createElement("div");

        // Anchored near the TOP, not centred. On a phone the keyboard takes
        // the bottom half of the screen the moment the field is focused, and
        // a vertically centred panel lands underneath it - the player is then
        // typing into something they cannot see.
        veil.style.cssText = `
            position: fixed;
            inset: 0;
            z-index: 2000;
            display: flex;
            align-items: flex-start;
            justify-content: center;
            padding: 8vh 16px 16px;
            background: rgba(12, 6, 1, 0.78);
            font-family: Arial, Helvetica, sans-serif;
            -webkit-tap-highlight-color: transparent;
        `;

        const panel = document.createElement("div");

        panel.style.cssText = `
            width: min(520px, 100%);
            box-sizing: border-box;
            background: #3A1D06;
            border: 4px solid #E8912B;
            border-radius: 18px;
            padding: 22px;
            box-shadow: 0 12px 40px rgba(0, 0, 0, 0.55);
        `;

        const title = document.createElement("div");

        title.textContent = heading;
        title.style.cssText = `
            color: #FFD54A;
            font-size: 22px;
            font-weight: bold;
            text-align: center;
            margin-bottom: 16px;
            line-height: 1.35;
        `;

        const field = document.createElement("input");

        field.type = "text";
        field.value = initial;
        field.placeholder = placeholder;
        field.maxLength = maxLength;

        // enterkeyhint puts "Done" on the phone's return key rather than a
        // newline arrow, which in a one-line field does nothing.
        field.setAttribute("enterkeyhint", "done");
        field.setAttribute("autocomplete", "off");
        field.setAttribute("autocapitalize", "sentences");

        field.style.cssText = `
            width: 100%;
            box-sizing: border-box;
            font-family: inherit;
            font-size: 20px;
            font-weight: bold;
            color: #3A1D06;
            background: #FFF3C4;
            border: 3px solid #B96A16;
            border-radius: 12px;
            padding: 14px 16px;
            outline: none;
        `;

        const counter = document.createElement("div");

        counter.style.cssText = `
            color: #C8B79A;
            font-size: 13px;
            text-align: right;
            margin-top: 8px;
        `;

        const buttons = document.createElement("div");

        buttons.style.cssText = `
            display: flex;
            gap: 12px;
            margin-top: 18px;
        `;

        const button = (label, primary) => {

            const b = document.createElement("button");

            b.textContent = label;
            b.type = "button";
            b.style.cssText = `
                flex: 1;
                font-family: inherit;
                font-size: 19px;
                font-weight: bold;
                letter-spacing: 0.5px;
                padding: 15px 10px;
                border-radius: 12px;
                border: 3px solid ${primary ? "#FFD54A" : "#8A6A44"};
                background: ${primary ? "#B96A16" : "transparent"};
                color: ${primary ? "#FFF3C4" : "#D8C7A8"};
                cursor: pointer;
            `;

            return b;

        };

        const cancel = cancelText ? button(cancelText, false) : null;
        const confirm = button(confirmText, true);

        const refresh = () => {
            counter.textContent = `${field.value.length} / ${maxLength}`;
        };

        refresh();

        field.addEventListener("input", refresh);

        panel.appendChild(title);
        panel.appendChild(field);
        panel.appendChild(counter);

        if(cancel){ buttons.appendChild(cancel); }

        buttons.appendChild(confirm);
        panel.appendChild(buttons);
        veil.appendChild(panel);
        document.body.appendChild(veil);

        //---------------------------------

        let settled = false;

        const close = value => {

            if(settled){ return; }

            settled = true;
            open = false;

            document.removeEventListener("keydown", onKey, true);

            // Blurred before removal so the phone's keyboard is dismissed by
            // the field losing focus rather than by the element vanishing
            // underneath it, which leaves the keyboard up over the game.
            field.blur();
            veil.remove();

            resolve(value);

        };

        const submit = () => {

            const text = field.value.trim();

            close(text.length ? text : null);

        };

        const onKey = event => {

            if(event.key === "Enter"){

                event.preventDefault();
                submit();

            }
            else if(event.key === "Escape"){

                event.preventDefault();
                close(null);

            }

        };

        confirm.addEventListener("click", submit);

        if(cancel){

            cancel.addEventListener("click", () => close(null));

        }

        // Tapping the darkened area behind the panel backs out, the same way
        // it does on the settings panel. Checked against the veil itself so a
        // tap on the panel does not close it.
        veil.addEventListener("pointerdown", event => {

            if(event.target === veil){ close(null); }

        });

        document.addEventListener("keydown", onKey, true);

        // A tick late: focusing an element in the same frame it is added does
        // not raise the keyboard on some Android WebViews.
        setTimeout(() => {
            field.focus();
            field.select();
        }, 60);

    });

}
