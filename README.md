# Ortho OT Assessment

A Progressive Web App used by the orthopaedic OT team at Queen Elizabeth Hospital to
record patient assessments at the bedside, and to generate the notes that are copied
into hospital records.

**All patient data stays on the device.** Assessments are held in the browser's
`localStorage` and are never sent anywhere — there is no backend, no account, no
network call. The only way data leaves or enters a device is the Export and Import
buttons on the home page.

---

## Opening it

**Double-click `Preview.command`.** A Terminal window opens, and the app opens in your
browser at <http://localhost:3456>. Leave that window open while you work; closing it
stops the server.

Or, if you'd rather type it:

```
node serve.js --open      # or just: node serve.js
node serve.js 8080        # a different port, if 3456 is taken
```

Double-clicking it twice is harmless — the second one notices a server is already
running and just opens the browser.

### Why `index.html` cannot be opened directly

Double-clicking `index.html` gives a blank page. This is expected, and not something to
fix.

The app is built from ES modules, and browsers refuse to load modules from a `file://`
page — such a page has no origin, so the security rules governing module loading cannot
be satisfied. Chrome, Safari and Firefox all block it. Serving the folder is the answer,
which is what `Preview.command` does in one click.

While previewing locally the service worker is deliberately not registered, so every
reload shows your latest edit with nothing to clear.

**Anywhere else:** any static web host will do. There is no build step, no dependencies
and nothing to run server-side — the folder *is* the app.

---

## Hosting it

Copy the whole folder onto any web server that serves static files. Every path in it is
relative, so it works both at the root of a domain (`https://example.org/`) and in a
sub-folder (`https://intranet/ortho/`) with no changes.

### What it needs from the server

Nothing is installed and nothing runs server-side. There is no backend, no database, no
API, no build step and no dependencies — the folder is served as-is, exactly like a set
of static pages.

| | |
|---|---|
| **HTTPS** | Required. Service workers — what makes the app work offline and installable — are refused on plain `http://` anywhere except `localhost`. A self-signed certificate is fine if the devices trust it. |
| **`.js` → `application/javascript`** | Required. The app is built from ES modules; a wrong or missing type stops it loading entirely. Every current web server does this by default. |
| **`.json` → `application/json`** | Needed for `manifest.json`, which makes the app installable. Worth checking on older IIS, which has been known to 404 unmapped extensions rather than serve them. Without it the app still runs, but "Add to Home Screen" gives a plain bookmark. |
| **`sw.js` served from the app's own folder** | It is already there; it just must not be moved, relocated to a CDN, or renamed. Its location sets the scope it is allowed to control. |
| **No rewrite rules** | The app is a single page and asks for real files by name. A catch-all "serve index.html for everything" rule will break it. |

### On information governance

No patient data is transmitted or stored on the server. Assessments are held in the
browser's `localStorage` on the device that recorded them, and the app makes no network
calls of any kind after the files have loaded — there is nothing to intercept and
nothing held centrally. The server only ever serves the same fixed set of files to
everyone.

The consequence is that **the device is the only copy.** See the section below on
exporting.

### What can be left out

`tests/`, `CLAUDE.md`, `README.md`, `serve.js`, `Preview.command` and `.claude/` are
for maintaining the app and are not needed to run it. They are harmless if copied, and worth keeping
wherever the source is kept, because they are what makes the app maintainable later.

### Installing on a ward iPad

Open the URL in Safari, then **Share → Add to Home Screen**.

Do this rather than leaving it as a Safari tab or a bookmark. Apart from giving a
full-screen app, it is what protects the stored assessments: Safari clears
script-writable storage for sites that have not been interacted with for seven days,
and a home-screen web app is kept separately from that. Treat a bookmark as temporary.

---

## Handing over the repository

Send the **git repository**, not a copy of the working files. The history is where the
reasoning lives — why each note is formatted the way it is, which migrations exist and
when they can go, what was tried and rejected. A flat folder is the code with all of
that stripped out, and whoever maintains it next has to guess.

Three routes, best first.

**1. Push to a hospital git server.** If IT runs GitLab, Azure DevOps, GitHub
Enterprise or similar, this is the right home:

```
git remote add origin <the URL they give you>
git push -u origin main
```

**2. Send one bundle file.** A `.bundle` is the entire repository — every commit, every
branch — in a single file that can be emailed or copied onto a share:

```
git bundle create ortho-ot.bundle --all
```

They clone from it exactly as from a server, and can add a real remote afterwards:

```
git clone ortho-ot.bundle ortho-web-app
```

The whole history is about 300 KB.

**3. Compress the folder.** Finder's **Compress** includes the hidden `.git` directory,
so the zip carries the history too. Verify before sending: if `.git` is missing, they
receive files with no history and no way to see how anything came to be.

Whichever route, tell them `CLAUDE.md` is the maintenance brief and `node tests/run.js`
must pass before anything ships.

---

## The thing most likely to lose data

**Stored assessments belong to the exact web address they were recorded at.**

This is how browsers work, not a choice this app makes. `localStorage` is scoped to an
origin, so cases recorded at one address are invisible at another. Moving the app —
from a trial host to the intranet, from one domain to another, even from `http` to
`https` — leaves every case behind. The device still holds them; the app at the new
address simply cannot see them.

**Before any move:**

1. On each device, open the app at the **old** address.
2. **Export** from the History card. A `.json` file is saved to Files.
3. Open the app at the **new** address and **Import** that file.

Import merges by case, keeps whichever copy was edited more recently, and never
deletes — so importing the same file twice is safe, and importing onto a device that
already has cases cannot lose them.

The same applies to anything that clears website data, and to a device being reset or
replaced. **Export regularly during the trial**, not only when moving.

---

## Updating it

Deploy the folder again — but **first** change the version in `sw.js`:

```js
const CACHE_NAME = "ortho-v69";   // bump this number
```

The service worker serves files from its cache before the network, which is what makes
the app work offline. Devices will keep showing the old version until this number
changes. Forgetting it is the single easiest way to deploy a fix that nobody receives.

---

## Working on it

See [CLAUDE.md](CLAUDE.md) — the maintenance brief: how the code is arranged, how forms
are defined, and what to be careful of.

Before any change ships:

```
node tests/run.js
```

Seven harnesses, no dependencies, no framework. They pin the team's specified note
formats byte-for-byte, so a change that alters a note fails loudly rather than
quietly.
