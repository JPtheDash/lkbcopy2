#!/usr/bin/env bash
#
# Builds the installable Android APK.
#
#   tools/build_apk.sh [release]
#
# Two things here are not the machine's defaults and the build fails without
# both:
#
#   JAVA_HOME   Gradle 8.x cannot read Java 25 bytecode - it stops with
#               "Unsupported class file major version 69". The Codespace has
#               a 21 alongside the 25, so the build is pinned to it.
#
#   ANDROID_SDK The SDK is not installed in the image. It lives under the
#               scratch directory because it is 3GB and must never be
#               committed; ANDROID_SDK_DIR overrides where to find it.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

JAVA_HOME="${JAVA_HOME_21:-/usr/local/sdkman/candidates/java/21.0.10-ms}"
ANDROID_HOME="${ANDROID_SDK_DIR:-$HOME/android-sdk}"

if [ ! -x "$JAVA_HOME/bin/java" ]; then
    echo "No JDK 21 at $JAVA_HOME - set JAVA_HOME_21" >&2
    exit 1
fi

if [ ! -d "$ANDROID_HOME/platform-tools" ]; then
    echo "No Android SDK at $ANDROID_HOME - set ANDROID_SDK_DIR, or install:" >&2
    echo "  sdkmanager --sdk_root=\$ANDROID_SDK_DIR platform-tools \\" >&2
    echo "      'platforms;android-35' 'build-tools;35.0.0'" >&2
    exit 1
fi

export JAVA_HOME ANDROID_HOME
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$PATH"

cd "$ROOT"

echo "== web build =="
npm run build

echo "== sync into the android project =="
npx cap sync android

echo "sdk.dir=$ANDROID_HOME" > android/local.properties

echo "== gradle =="
cd android

if [ "${1:-debug}" = "release" ]; then
    ./gradlew assembleRelease --no-daemon
    APK="app/build/outputs/apk/release/app-release-unsigned.apk"
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
