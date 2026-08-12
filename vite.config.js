import { defineConfig } from "vite";
import { readFileSync } from "fs";

// The version the About box shows, taken from the Android project rather than
// typed in twice. build.gradle's versionName is what Play displays, so it is
// the true one; the copy in the dialog said 1.0 through two releases because
// nothing tied them together.
//
// Falls back rather than throwing: the web build has to keep working on a
// checkout without the android folder.
function appVersion() {

    try {

        const gradle = readFileSync("android/app/build.gradle", "utf8");

        return /versionName\s+"([^"]+)"/.exec(gradle)[1];

    } catch {

        return "dev";

    }

}

// Testing happens on a phone or tablet, which reaches this Codespace through
// a forwarded hostname rather than localhost. Vite rejects a Host header it
// does not recognise - the page comes back as "Blocked request. This host is
// not allowed" instead of the game, which looks exactly like a dead server.
//
// The leading dot matches any subdomain, so this keeps working when the
// Codespace is rebuilt under a different name.
const FORWARDED_HOSTS = [".app.github.dev", ".githubpreview.dev"];

const server = {
    // Listen on every interface, or the port forwarder has nothing to reach
    host: true,
    port: 5173,
    allowedHosts: FORWARDED_HOSTS
};

export default defineConfig({
    server,
    preview: { ...server, port: 4173 },
    define: {
        __APP_VERSION__: JSON.stringify(appVersion())
    }
});
