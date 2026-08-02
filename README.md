# Build artifacts — temporary, delete after downloading

Orphan branch: no shared history with `main`, nothing in it but these files,
so deleting the branch takes them with it.

| file | for |
|---|---|
| `little-krishna-butter-hunt.aab` | Google Play Console |
| `little-krishna-butter-hunt-release.apk` | sideloading onto a phone |
| `SHA256SUMS.txt` | checking the downloads |

Package name `com.dijytal.littlekrishnasbutterhunt`, signed with the upload
key, target API 36.

## What changed in this build

- music stops when the app is backgrounded or closed, and the level's
  countdown pauses with it
- back opens the pause menu in a level, goes up a screen in the menus, and
  only asks "Leave the game?" on the home screen
- the canvas takes its height from the phone, so there are no black bars
- the title art reads "Little" rather than "Litttle"

## Delete this when you have them

    git push origin --delete artifact-transfer

or on GitHub: *branches* → the bin icon next to `artifact-transfer`. The
repository is public, so anyone can download these until you do.

If a download arrives named `.txt`, the bytes are fine and it only needs
renaming — check it against the size and hash. Play rejects anything not
ending in `.aab`, so the rename is required either way.
