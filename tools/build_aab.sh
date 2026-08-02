#!/usr/bin/env bash
#
# Builds the signed Android App Bundle that Google Play accepts.
#
#   tools/build_aab.sh
#
# Play has not accepted APKs for new apps since 2021 - the upload has to be an
# .aab, from which Play generates a per-device APK itself. That is also why
# this cannot be installed on a phone directly; use tools/build_apk.sh for
# that, or bundletool to cut a testable APK set out of the bundle.
#
# Signing comes from android/keystore/keystore.properties, which .gitignore
# excludes. Without it Gradle still produces a bundle, but an unsigned one
# that Play will reject - so this stops rather than handing over an artifact
# that looks finished and is not.

set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/android_env.sh"

KEYSTORE="$ROOT/android/keystore/keystore.properties"

if [ ! -f "$KEYSTORE" ]; then
    echo "No signing key at $KEYSTORE" >&2
    echo >&2
    echo "Play rejects a bundle signed with the debug key. Create one with:" >&2
    echo "  keytool -genkeypair -v -keystore android/keystore/upload-keystore.jks \\" >&2
    echo "      -alias upload -keyalg RSA -keysize 4096 -validity 10000" >&2
    echo "then write storeFile/storePassword/keyAlias/keyPassword into" >&2
    echo "android/keystore/keystore.properties." >&2
    exit 1
fi

cd "$ROOT"

echo "== web build =="
npm run build

echo "== sync into the android project =="
npx cap sync android

echo "== gradle =="
cd android
./gradlew bundleRelease --no-daemon

cd "$ROOT"

BUNDLE="android/app/build/outputs/bundle/release/app-release.aab"
DEST="$ROOT/dist-store/little-krishna-butter-hunt.aab"

mkdir -p "$(dirname "$DEST")"
cp "$BUNDLE" "$DEST"

echo
echo "== verifying =="

# An unsigned bundle still builds and still copies, and the difference is not
# visible until Play refuses it - so it is checked here instead.
if ! "$JAVA_HOME/bin/jarsigner" -verify "$DEST" > /dev/null 2>&1; then
    echo "BUNDLE IS NOT SIGNED - Play will reject it" >&2
    exit 1
fi

"$JAVA_HOME/bin/keytool" -printcert -jarfile "$DEST" \
    | grep -E "Owner:|Valid from:|Signature algorithm" | sed 's/^/  /'

echo
echo "AAB: $DEST  ($(( $(stat -c%s "$DEST") / 1024 / 1024 ))MB)"
