#!/usr/bin/env bash
#
# Shared setup for the Android builds. Source it, do not run it.
#
# Two things here are not the machine's defaults and every Android build
# fails without both:
#
#   JAVA_HOME   Gradle 8.x cannot read Java 25 bytecode - it stops with
#               "Unsupported class file major version 69". The Codespace has
#               a 21 alongside the 25, so the build is pinned to it.
#
#   ANDROID_SDK The SDK is not installed in the image. It lives under $HOME
#               because it is 3GB and must never be committed, and because
#               anywhere under /tmp is wiped between sessions - which shows
#               up later as a build that worked yesterday and cannot find
#               its SDK today. ANDROID_SDK_DIR overrides it.

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
    echo "      'platforms;android-36' 'build-tools;36.0.0'" >&2
    exit 1
fi

export JAVA_HOME ANDROID_HOME
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$PATH"

echo "sdk.dir=$ANDROID_HOME" > "$ROOT/android/local.properties"
