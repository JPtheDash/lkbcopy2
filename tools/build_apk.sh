#!/usr/bin/env bash
#
# Builds an installable Android APK, for putting on a phone directly.
#
#   tools/build_apk.sh [release]
#
# This is not what goes to Google Play - Play takes an .aab, which
# tools/build_aab.sh produces. An APK is what you sideload to test.
#
#   debug     signed with the throwaway debug key, and debuggable
#   release   the same build type Play gets, signed with the upload key
#
# The release one is the truer test, but the two are signed by different keys
# and Android will not install one over the other - swapping between them
# means uninstalling first, which reads as "app not installed" if you do not
# know to expect it. They are named apart here so it is always clear which is
# on the phone.

set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/android_env.sh"

cd "$ROOT"

echo "== web build =="
npm run build

echo "== sync into the android project =="
npx cap sync android

echo "== gradle =="
cd android

VARIANT="${1:-debug}"

if [ "$VARIANT" = "release" ]; then
    ./gradlew assembleRelease --no-daemon

    # Named -unsigned only when no signing key was found. With one present
    # Gradle drops the suffix, so both have to be looked for or a release
    # build fails at the copy with a confusing "no such file".
    APK="app/build/outputs/apk/release/app-release.apk"
    [ -f "$APK" ] || APK="app/build/outputs/apk/release/app-release-unsigned.apk"
else
    ./gradlew assembleDebug --no-daemon
    APK="app/build/outputs/apk/debug/app-debug.apk"
fi

cd "$ROOT"

DEST="$ROOT/dist-apk/little-krishna-butter-hunt-$VARIANT.apk"
mkdir -p "$(dirname "$DEST")"
cp "android/$APK" "$DEST"

echo
echo "== verifying =="

if [ "$VARIANT" = "release" ]; then

    case "$APK" in
        *-unsigned.apk)
            echo "Release APK is UNSIGNED - no key at android/keystore/." >&2
            echo "Android will refuse to install it." >&2
            exit 1
            ;;
    esac

    "$JAVA_HOME/bin/keytool" -printcert -jarfile "$DEST" \
        | grep -E "Owner:|Valid from:" | sed 's/^/  /'
fi

echo
echo "APK: $DEST  ($(( $(stat -c%s "$DEST") / 1024 / 1024 ))MB)"
