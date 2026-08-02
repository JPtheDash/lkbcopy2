#!/usr/bin/env bash
#
# Builds an installable Android APK, for putting on a phone directly.
#
#   tools/build_apk.sh [release]
#
# This is not what goes to Google Play - Play takes an .aab, which
# tools/build_aab.sh produces. An APK is what you sideload to test.

set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/android_env.sh"

cd "$ROOT"

echo "== web build =="
npm run build

echo "== sync into the android project =="
npx cap sync android

echo "== gradle =="
cd android

if [ "${1:-debug}" = "release" ]; then
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

DEST="$ROOT/dist-apk/little-krishna-butter-hunt.apk"
mkdir -p "$(dirname "$DEST")"
cp "android/$APK" "$DEST"

echo
echo "APK: $DEST  ($(( $(stat -c%s "$DEST") / 1024 / 1024 ))MB)"
