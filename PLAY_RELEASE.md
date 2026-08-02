# Releasing to Google Play

    tools/build_aab.sh

Produces `dist-store/little-krishna-butter-hunt.aab`, signed, and refuses to
hand over an unsigned one. Play has not accepted APKs for new apps since 2021 —
it takes the bundle and generates a per-device APK itself, which is why the
`.aab` cannot be installed on a phone. Use `tools/build_apk.sh` for that.

Store artwork comes from `tools/build_android_icons.py` (launcher icons,
splash, the 512px listing icon) and `tools/build_store_shots.py` (phone
screenshots, from the real game via `tools/screenshot.mjs`). Nothing in
`dist-store/` is committed; all of it rebuilds from the game's own art.

## The signing key

`android/keystore/` holds the upload key and its passwords, and is excluded by
`.gitignore`. **Back it up somewhere private before doing anything else.**

With Play App Signing — on by default for new apps — Google holds the real
release key and this is only the *upload* key, so if it is lost Google can
reset it. Without Play App Signing, losing this file means never being able to
update the app under this listing again.

To use a different key, replace the `.jks` and edit
`android/keystore/keystore.properties`. Nothing else refers to it.

## Every upload needs a new versionCode

`versionCode` is in `android/app/build.gradle` and Play rejects a bundle whose
code it has already seen. Raise it by one each time; `versionName` is the
string players see and can say whatever you like.

## What the build already satisfies

| | |
|---|---|
| Format | `.aab`, signed, `debuggable=false` |
| `applicationId` | `com.jpthedash.littlekrishnabutterhunt` — a real domain, not `com.example.*` |
| Target API | 36, above Play's current floor |
| Min API | 24 |
| Permissions | `INTERNET` only. No ad ID, no location, no storage |
| Cleartext HTTP | off — the game is entirely local |
| Native code | none, so the 16 KB page-size rule does not apply |
| Download size | 8.6–9.3 MB depending on device, against a 200 MB limit |
| Icon | adaptive, five densities, checked under circle/squircle/square masks |

## What only you can do, in the Play Console

None of this lives in the bundle.

- **Play App Signing** — accept it when creating the app. It is what makes a
  lost upload key recoverable.
- **Privacy policy URL.** Required for every app, and required to be reachable
  at a public URL. The game collects nothing, but the policy still has to exist
  and say so.
- **Data safety form.** Declare no collection and no sharing. Progress is kept
  in the device's own WebView storage and never leaves the phone.
- **Content rating questionnaire.** Answer it honestly; a game like this
  normally lands at Everyone / PEGI 3.
- **Target audience and content.** This is where it matters most: if you
  declare children as a target audience the app enters the **Families
  programme**, which brings extra rules on ads, analytics SDKs and the content
  itself. The game ships with no ads and no SDKs, which is the easy position to
  be in — adding an ad network later would put those rules in play.
- **Store listing.** Title, short and full description, plus:
  - app icon — `dist-store/play-icon-512.png`
  - phone screenshots — `dist-store/screenshots/` (Play wants at least two)
  - **feature graphic, 1024×500** — not generated here; it is a designed
    banner rather than something derived from the game, so it wants a real
    pass rather than a script's.
- **Countries, pricing, and a closed or internal test track** before
  production. Play now requires new personal developer accounts to run a
  closed test with testers before they can promote to production.

## One judgement call in the build

`minifyEnabled` is off. The game is JavaScript inside a WebView, so R8 has
almost nothing of ours to shrink — it would only strip Capacitor's bridge
classes, which JavaScript reaches by reflection and R8 therefore reads as
unused. The saving is a fraction of a bundle that is nearly all art and audio;
the failure mode is a white screen on launch that no build-time check catches.
