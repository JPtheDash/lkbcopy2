import { defineConfig } from "vite";

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
    preview: { ...server, port: 4173 }
});
