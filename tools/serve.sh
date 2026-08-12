#!/usr/bin/env bash
#
# Puts the game - or the built .aab/.apk - on a public URL you can open on a
# phone.
#
#   tools/serve.sh            the game, from the vite dev server
#   tools/serve.sh builds     a download page for dist-store/ and dist-apk/
#   tools/serve.sh stop       take both down again
#
# WHY THIS IS NOT JUST `npx vite`
# -------------------------------
# A Codespace only reaches the outside world through its tunnel, and the
# tunnel will not accept a port it has not already registered. Asking for one
# it does not know gets:
#
#   error updating port N to public: error getting tunnel port: 404 Not Found
#
# Registration is done by the VS Code client when it notices a process start
# listening, which does not happen for a server started from a background
# shell like this one. So a fresh port can never be published from here.
#
# What the tunnel does keep is every port it registered earlier in the
# Codespace's life, listening or not - a list of empty, already-registered
# slots. This script finds one nothing is using and starts the server on that,
# instead of starting the server where it likes and trying to publish the port
# afterwards. That inversion is the entire trick.
#
# WHY IT HAS TO BE RE-RUN
# -----------------------
# A Codespace restart wipes /tmp, kills every background process, and empties
# the tunnel's public ports. The URL changes each time because the free slot
# is not the same one twice. Nothing here is worth keeping alive by hand - it
# is cheaper to re-run this.
#
# Files live under $HOME rather than /tmp for the same reason: /tmp does not
# survive the restart, and a download page whose files vanished underneath it
# still answers, with 404s.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE="$HOME/.lkbh-serve"

mkdir -p "$STATE"

MODE="${1:-game}"

if [ -z "${CODESPACE_NAME:-}" ]; then
    echo "Not in a Codespace - just run 'npm run dev'." >&2
    exit 1
fi

#-------------------------------------------------------------------
# Stop
#-------------------------------------------------------------------

if [ "$MODE" = "stop" ]; then

    for pidfile in "$STATE"/*.pid; do
        [ -e "$pidfile" ] || continue
        pid=$(cat "$pidfile")
        # The whole process group: vite spawns children that outlive it and
        # keep the port bound, which then looks like a busy slot forever.
        kill -- -"$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true
        rm -f "$pidfile"
    done

    echo "stopped"
    exit 0

fi

#-------------------------------------------------------------------
# Find a slot
#-------------------------------------------------------------------

# Every port the tunnel already knows about, whatever its current visibility.
held=$(gh codespace ports -c "$CODESPACE_NAME" 2>/dev/null \
       | awk '{print $1}' | grep -E '^[0-9]+$' || true)

if [ -z "$held" ]; then
    echo "The tunnel has no registered ports at all." >&2
    echo "Open the PORTS panel in VS Code and forward one by hand." >&2
    exit 1
fi

# Anything already listening, so two runs of this script cannot land on the
# same port and silently serve the wrong thing.
busy=$(ss -ltn 2>/dev/null \
       | awk 'NR>1 { n=split($4, a, ":"); print a[n] }' | sort -u)

PORT=""

for candidate in $held; do
    if ! printf '%s\n' "$busy" | grep -qx "$candidate"; then
        PORT="$candidate"
        break
    fi
done

if [ -z "$PORT" ]; then
    echo "Every port the tunnel holds is already in use." >&2
    echo "Run 'tools/serve.sh stop' first." >&2
    exit 1
fi

#-------------------------------------------------------------------
# Start
#-------------------------------------------------------------------

cd "$ROOT"

if [ "$MODE" = "builds" ]; then

    DIR="$STATE/builds"
    rm -rf "$DIR"
    mkdir -p "$DIR"

    found=0

    # Symlinked rather than copied, so the page serves whatever the last
    # build produced instead of a snapshot taken when this script last ran.
    for f in "$ROOT/dist-store/little-krishna-butter-hunt.aab" \
             "$ROOT/dist-apk/little-krishna-butter-hunt-release.apk" \
             "$ROOT/dist-apk/little-krishna-butter-hunt-debug.apk"; do
        if [ -f "$f" ]; then
            ln -sf "$f" "$DIR/$(basename "$f")"
            found=$((found + 1))
        fi
    done

    if [ "$found" = 0 ]; then
        echo "Nothing built yet - run tools/build_aab.sh and tools/build_apk.sh." >&2
        exit 1
    fi

    ( cd "$DIR" && sha256sum ./*.aab ./*.apk 2>/dev/null > SHA256SUMS.txt ) || true

    python3 "$ROOT/tools/build_download_page.py" "$DIR"

    setsid nohup python3 -m http.server "$PORT" --directory "$DIR" \
        > "$STATE/builds.log" 2>&1 < /dev/null &

    echo $! > "$STATE/builds.pid"

    LABEL="builds"

else

    # --strictPort so it fails loudly rather than hopping to the next port,
    # which would leave it listening somewhere the tunnel cannot reach.
    setsid nohup npx vite --port "$PORT" --strictPort \
        > "$STATE/game.log" 2>&1 < /dev/null &

    echo $! > "$STATE/game.pid"

    LABEL="game"

fi

#-------------------------------------------------------------------
# Wait for it, then publish
#-------------------------------------------------------------------

for _ in $(seq 1 30); do
    if curl -sS -o /dev/null --max-time 2 "http://localhost:$PORT/" 2>/dev/null; then
        break
    fi
    sleep 1
done

if ! curl -sS -o /dev/null --max-time 5 "http://localhost:$PORT/" 2>/dev/null; then
    echo "Server never came up on $PORT - see $STATE/$LABEL.log" >&2
    exit 1
fi

gh codespace ports visibility "$PORT:public" -c "$CODESPACE_NAME" > /dev/null

URL="https://$CODESPACE_NAME-$PORT.app.github.dev"

# Checked from outside rather than assumed. A private port answers with a
# GitHub login page, not the game, and both are HTTP 200 to a browser - so
# this looks for the real status through the tunnel.
code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 30 "$URL/" || echo 000)

echo
echo "$LABEL: $URL"
echo "  tunnel says HTTP $code"
echo "  stop with: tools/serve.sh stop"
