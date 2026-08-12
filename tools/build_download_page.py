"""
Writes the index page for tools/serve.sh builds.

    python3 tools/build_download_page.py <dir>

Everything on the page is measured from the files in that directory rather
than written down here: sizes, checksums, and the versionCode and versionName
read out of the APK's own manifest. A hand-written page goes stale the first
time a build is cut and nobody notices, and the whole point of the page is to
say which build you are about to install.
"""

import hashlib
import re
import subprocess
import sys
from pathlib import Path

# What each artifact is for. The .aab being uninstallable is the one thing
# people lose time to, so it is said on the page rather than assumed.
BLURB = {
    "little-krishna-butter-hunt.aab":
        "for the Play Console. <strong>Cannot be installed on a phone</strong> "
        "&mdash; Play generates the per-device APK from it.",
    "little-krishna-butter-hunt-release.apk":
        "install this on a phone. The same build type Play ships, signed with "
        "the upload key.",
    "little-krishna-butter-hunt-debug.apk":
        "debuggable, throwaway key. Only worth it for a quicker loop.",
}

ORDER = list(BLURB)


def version(path):
    """versionCode/versionName out of the APK, via whichever aapt2 is around."""

    if path.suffix != ".apk":
        return None

    tools = sorted(Path.home().glob("android-sdk/build-tools/*/aapt2"))

    if not tools:
        return None

    try:
        out = subprocess.run(
            [str(tools[-1]), "dump", "badging", str(path)],
            capture_output=True, text=True, timeout=60
        ).stdout
    except (OSError, subprocess.SubprocessError):
        return None

    code = re.search(r"versionCode='(\d+)'", out)
    name = re.search(r"versionName='([^']*)'", out)

    if not code or not name:
        return None

    return f"version {name.group(1)}, versionCode {code.group(1)}"


def digest(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


CSS = """
:root { color-scheme: dark; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  max-width: 40rem; margin: 0 auto; padding: 2rem 1.25rem 4rem;
  line-height: 1.55; background: #12100e; color: #eee5d8;
}
h1 { font-size: 1.4rem; margin: 0 0 .25rem; color: #FFD54A; }
.sub { margin: 0 0 2rem; opacity: .6; font-size: .9rem; }
a.dl {
  display: block; text-decoration: none; color: inherit;
  border: 1px solid #3a332a; border-radius: 10px;
  padding: .9rem 1.1rem; margin-bottom: .85rem; background: #1c1813;
}
a.dl:hover { border-color: #FFD54A; background: #221d16; }
.name { font-weight: 600; font-size: 1.05rem; word-break: break-all; }
.meta { opacity: .68; font-size: .84rem; margin-top: .25rem; }
.hash { font-family: ui-monospace, Menlo, Consolas, monospace;
        font-size: .68rem; opacity: .42; margin-top: .4rem;
        word-break: break-all; }
.note { font-size: .85rem; opacity: .72; margin-top: 2rem;
        border-top: 1px solid #2a251e; padding-top: 1.2rem; }
"""


def main():

    if len(sys.argv) < 2:
        raise SystemExit("usage: build_download_page.py <dir>")

    folder = Path(sys.argv[1])

    cards, stamp = [], None

    for name in ORDER:

        path = folder / name

        if not path.exists():
            continue

        # resolve() because serve.sh symlinks these at the real build output
        real = path.resolve()
        mb = real.stat().st_size / 1024 / 1024

        stamp = stamp or version(real)

        cards.append(
            f'<a class="dl" href="{name}" download>'
            f'<div class="name">{name}</div>'
            f'<div class="meta">{mb:.1f} MB &middot; {BLURB[name]}</div>'
            f'<div class="hash">{digest(real)}</div>'
            f'</a>'
        )

    page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Little Krishna's Butter Hunt &mdash; builds</title>
<style>{CSS}</style>
</head>
<body>

<h1>Little Krishna's Butter Hunt</h1>
<p class="sub">{stamp or "builds"}</p>

{chr(10).join(cards)}

<p class="note">
The two APKs are signed by <strong>different keys</strong>, and Android will
not install one over the other &mdash; swapping between them means
uninstalling first. Skip that and it fails with a bare &ldquo;app not
installed&rdquo;, which looks like a broken build and is not one.
</p>

<p class="note">
Android blocks sideloading by default. The browser will ask to allow installs
from itself once, then the download opens normally.
</p>

</body>
</html>
"""

    (folder / "index.html").write_text(page)

    print(f"  download page: {len(cards)} build(s)")


if __name__ == "__main__":
    main()
