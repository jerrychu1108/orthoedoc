# Orthopaedic OT Assessment App — Maintenance Brief

A built, working Progressive Web App used by the orthopaedic OT team at Queen
Elizabeth Hospital to record patient assessments at the bedside. This file describes
the code as it stands, for someone about to change it.

- **No build step, no framework, no backend, no dependencies.** Edit the files and
  reload. ES modules, loaded natively by the browser — which is why the app must be
  served over `http://` and never opened as `file://`.
- **All patient data lives in `localStorage`** under `ortho.assessments.v1`, on the
  device. Nothing is sent anywhere.
- **Installable as a standalone PWA** — the service worker gives offline support.
- **Two assessment forms** share one render/summary pipeline. Each has section tabs,
  chip-based inputs, and a generated note that is copy-pasted into hospital records.

---

## Files

```
index.html          — <div id="root">, manifest link, SW registration; loads
                      src/main.js as <script type="module">
src/                — all app code, as ES modules (see the map below)
styles.css          — all styling, themed from CSS variables
README.md           — how to open, host, update and hand over the app
serve.js            — local dev server (`node serve.js`); not needed to host it
Preview.command     — double-click in Finder to serve the app and open a browser
sw.js               — cache-first service worker; bump CACHE_NAME on every edit
manifest.json       — PWA manifest
icon-192.png        — home-screen icons
icon-512.png
.claude/launch.json — preview server config (Node inline server, port 3456)
tests/              — dependency-free harnesses; `node tests/run.js`
tests/lib/harness.js — the shared stub rig they all load the app through
ortho day template.txt — the paper template ortho_day reproduces (RTF; provenance only,
                         read by nothing)
```

### Inside `src/`

```
main.js          — the entry point; the only file that starts the app
index.js         — a barrel re-exporting everything, for callers wanting the app whole
render.js        — render(), and goHome / goForm / goSummary
util.js          — dates, objField, pickLabels, joinList, tidyLine. Imports nothing
dom.js           — el(), the inputs, fieldBlock, formCard
state.js         — State, Storage, the migrations, and every write to a record
backup.js        — export and import
score.js         — the shared instrument item lists, the arithmetic, the rating grid
schema/engine.js — seeding, showIf, clearHiddenSchemaAnswers, the widgets
schema/report.js — formatSchemaAnswer, applyTemplate, buildSchemaSummary
forms/registry.js— FORM_TYPES, and resolving a form from a record
forms/ortho-day.js — the coded form: its labels, renderers and summary builder
forms/ghf.js     — the schema form: its sections, item lists and computed values
views/home.js · views/form.js · views/summary.js
```

Roughly bottom-up: `util.js` imports nothing, and nothing imports the views. Two edges
are worth knowing about:

- **`render.js` and the views import each other.** Deliberate, and safe because
  `render` and the navigators are *function declarations* — hoisted before any module
  body runs, and only ever called from an event handler long after the whole graph has
  evaluated. Turning them into `const` arrow functions would replace that hoisting with
  a temporal dead zone and break the app at load time.
- **The engine never imports a form.** `forms/registry.js` is the only file that names
  one. A form's sections, parts and computed values reach the engine through thunks on
  its `FORM_TYPES` entry, so adding a form touches the registry and nothing else.

---

## State and the render loop

```js
const State = {
  view: "home",            // "home" | "form" | "summary"
  assessments: Storage.load(),
  currentId: null,
  saveTimer: null,         // debounce handle
  section: 0,              // active section index, for any form with section tabs
  expanded: {},            // { [subKey]: true } — open collapsible subsections
  odEventMonthOnly: false, // month-precision event date picker, before a date is entered
  summaryEditing: {}       // { [partKey]: true } — summary parts open for editing
};
```

`render()` clears `#root` and dispatches on `State.view`:

- `"home"` → `renderHome()` — three cards: the hospital header, an inline
  **Create New Case** row (ward/bed, date with a Today link, form `<select>`, Create),
  and **History**.
- `"form"` → `renderForm()` — dispatches on `a.formType`.
- `"summary"` → `renderSummary()` — one box per part, each with Copy, Edit and
  Revert. `goHome()`, `goForm(id)` and `goSummary()` move between them.

`saveSoon()` debounces writes to `localStorage` by 400 ms. There is no save button.

---

## Form-type registry

```js
const FORM_TYPES = [
  { id: "ortho_day", name: "Ortho Day Rehab FU", category: "Ortho", icon: "🦴",
    desc: "…", kind: "coded",  sections: () => OD_SECTIONS,  parts: () => SUMMARY_PARTS },
  { id: "ghf_initial", name: "Geriatric Hip Fracture Initial", category: "Ortho",
    icon: "🦵", desc: "…", kind: "schema",
    sections: () => GHF_SECTIONS, parts: () => GHF_PARTS }
];
```

`sections` and `parts` are **thunks** — the data they name is declared later in the
file, so a thunk defers the lookup to render time. `category` prefixes the form in the
Create dropdown (`[Ortho] …`) and tags its cases in History. `icon` is used by the form
topbar.

### Two ways to build a form

`kind` picks the path. **Write new forms as `schema`.**

- **`kind: "schema"`** — the form is a data array of sections holding questions that
  describe how they render *and* how they read in the note. To add one: write the
  section array, add a `FORM_TYPES` entry, done. No dispatcher changes, no
  `blankAssessment()` edit (records seed by walking the schema), no new renderer.
- **`kind: "coded"`** — hand-written `renderXxxForm(a, content)` + `buildXxxSummary(a)`,
  plus branches in `renderForm()`, `buildSummary()` and the section-tab helper.
  `ortho_day` is the only one, and is **deliberately frozen**: the team relies on it,
  so extensions derive new constants (`GHF_MBI_ITEMS` from `MBI_ITEMS`) rather than
  changing what it reads.

---

## The schema

```js
{ id: "ghf_livesWith", type: "multi", label: "Lives with",
  options: [ "Live alone",
             { value: "with", label: "Live with", detail: true,
               detailPlaceholder: "spouse / child", detailJoiner: " " },
             { value: "oahr", label: "OAHR", sub: ["Private", "Subvented"] } ],
  exclusive: "nil",
  showIf: { questionId: "ghf_limitedInfo", notEquals: "limited" },
  report: "Lives with: {answer}" }
```

**Types:** `heading` (opens a new card) · `text` · `textarea` · `date` · `number` ·
`yesno` · `single` · `multi` · `range` (ordered scale, at most two *adjacent* picks,
reads back as "Fair to Good") · `composite` (labelled parts on one line) · `score` ·
`computed`.

**Question keys the engine reads:**

| Key | Effect |
|---|---|
| `showIf` | One condition, or a list of them all of which must hold. Four operators: `equals`, `notEquals`, `anyOf`, `notAnyOf` |
| `report` | Note template; default `"{label}: {answer}"` |
| `hideInReport` | Answered on the card, never printed |
| `hideLabel` | Widget without its caption |
| `reportOnly` | Printed in the note, never rendered on the card |
| `blankBefore` | A blank line above this question's block |
| `boxes` | Paper tick-box style: every option printed `[x]`/`[ ]` |
| `breakdown` | `{ perLine, sep }` — a score's per-item entries beneath its total |
| `wrapSemicolons` | Split a long line at `; `, indenting to the caption |
| `collapseWhenAllEqual` | `Balance: Sitting, Standing: Not tested` |
| `joinWith`, `joinLast` | Separators for a multi-select's picks |
| `itemSuffix` | Appended to every pick — `" done"` on the Treatment list |
| `exclusive` | Value(s) that cannot coexist with the rest ("Nil", "NAD") |
| `quickFill` | Full score / Zero score buttons on a `score` or `number` |
| `notAssessed` | Adds a non-numeric "Not assessed" slot to each score item |
| `groups` | Renders a score grid as named blocks, each with its own rating |
| `hideTotal` | A score whose raw sum is not the result |
| `items`, `bands` | Score items; `bands` is data — first band not exceeded wins |
| `flatJoin` | This line's separator in a flattened part (`". "` before a comment) |
| `maxLength` | Live character counter on a `textarea` |
| `prefix`, `suffix`, `max`, `month`, `rerender` | Per-type extras |
| `layout`, `rowHeaders`, `colHeaders` | `composite` grid form |

**Option keys:** `detail` (+`detailOnly`, `detailJoiner`, `detailSuffix`,
`detailPlaceholder`) for a text box that appears once the chip is on — `detailOnly`
prints what was typed *instead of* the label; `sub` (+`subOnly`, `subJoiner`,
`subSuffix`, `subJoin`) for a second level of chips; `reportLabel` where the note's
wording differs from the chip's; `report` for an option that rewrites its whole line;
`itemSuffix` to override or opt out of the question's; `cascadeTo` to copy this answer
into the questions it names.

Extras are stored under derived keys — `detailKey(q, value)`, `subKey(q, value)` — and
cleared whenever their chip is unpicked.

**Score-item keys:** `key`, `label`, `max`, `scale`, `extras` (device chips that zero
an item), `onlyWhen` (visibility guard), `excludeFromMax`, `substitutes` (this item
takes the named one's place in the note once rated — Wheelchair for Mobility).

**Section keys:** `part` (which summary part it feeds), `reportTitle` (sub-heading in
the note), `flatPart` (`{ key, join }` — also feed a second part as one line),
`collapsed` (its cards start shut and open on a tap — for a block that is usually not
indicated; a card that already holds answers opens itself, since `State.expanded` is
cleared on every case open and a shut card over real answers reads as lost work),
`hint` (a line under the card title saying when the block is worth opening — it sits in
the **header**, so unlike a question's `hint`, which shares the name but renders in the
body, it stays readable while the card is shut), `questions`. A section nobody answered is omitted entirely, heading included.

**Part keys:** `key`, `title`, `limit` (character count beneath the box, red when
over), `oneLine` (the editor refuses Enter and turns a pasted break into the
separator), `header` (a fixed title above the generated note — printed only when the
part has content, so an untouched assessment stays empty rather than showing a title
over nothing).

**The stale-value rule:** a hidden question's answer is **cleared from the record**,
not merely hidden. `clearHiddenSchemaAnswers()` sweeps every section on each render,
since a trigger and its dependants can sit on different tabs. Anything reading another
question's answer must respect this — `applyTemplate`'s `{q:…}` and `answerOf()` both
check `showQuestion` first.

---

## Computed fields

A question with `compute: "name"` takes its value from a function rather than an
answer. The functions are **the form's own**, declared beside its sections and named
in `FORM_TYPES` by a `computed` thunk:

```js
{ id: "ghf_initial", …, sections: () => GHF_SECTIONS, parts: () => GHF_PARTS,
  computed: () => GHF_COMPUTED }
```

`computedValue(a, q)` resolves the table from the record's own form type, so the engine
never names a form and a new form brings its own functions instead of adding to a
shared table. They are derived on every read and never stored, so they cannot drift out
of step with the answers they read.

`GHF_COMPUTED` holds seven:

| Name | Gives |
|---|---|
| `mocaBand` | The HK-MoCA percentile band from the age × education norms |
| `mocaCutoff` | That row's 16th-percentile threshold |
| `hdrsLevel` | `Level 4 (Moderate High)` from the three factor ratings |
| `hdrsFactors` | One line per HDRS factor, elements bracketed after it |
| `orientation` | `Oriented to time; Disoriented to place and person` — both sides of the finding, from one set of ticks |
| `adlSummary` | The OT comment's premorbid and current ADL lines |
| `cognitiveSummary` | The OT comment's AMT / CDT / MoCA line |

Only genuinely tabular or formulaic logic belongs here. Keep the table small: a rule
expressible as a `report` template or a band table should live in the schema instead.

`answerOf(a, id)` reads another question as the note would print it — resolving the
sections from the record, and returning `""` for a question the form is hiding, so a
value behind a failed condition can never leak into a summary built from other
answers.

---

## Reporting

`report` is a template: `{answer}`, `{label}`, `{partId}` for a composite part,
`{q:otherId}` for another question's answer. Write it for the **fullest** case —
`tidyLine()` clears away what an empty placeholder leaves behind:

- an empty `( )` disappears, along with the space before it;
- inside a `; `-joined or wide-gap-joined line, a fragment ending in `:` is dropped;
- a trailing `,` or `;` is trimmed.

So bracket an optional cross-reference (`"Pain: {answer} ({q:ghf_nprs})"`) and the
brackets vanish with it; give the referenced field a `prefix` so its caption travels
with its value.

`buildSchemaSummary` fills one buffer per part. A section with `flatPart` also pushes
its lines, joined into one string, into a second part — this is how the **Green Box**
carries the whole OT comment on a single line for the ward's 250-character handover
field, while the same block prints in full under `COMMON ASSESSMENT NOTES`.

---

## Storage and migrations

`Storage.load()` carries **nine** one-off migrations, each commented with the date
after which it can be removed. They exist because records already on ward devices were
written against an older schema. When a field is renamed or re-homed, either add one or
decide explicitly that old values are dropped — and say which in the commit message.

Retired fields are left unread on old records rather than deleted; a value that no
longer matches an option simply stops printing.

**Export and import** are the only way data leaves or re-enters a device — the History
card's two buttons. `exportAssessments()` writes every case as one JSON file behind an
`{ app: "ortho-ot", schema: 1 }` envelope; `importAssessments(text)` refuses anything
without that envelope and otherwise **merges by id**, keeping whichever side has the
later `updatedAt`. It never deletes: replace would be one mis-tap from wiping a shared
ward iPad. Imports are written through `Storage.save()` and re-read through
`Storage.load()`, so a file predating a migration is migrated on the way in.

---

## Theming

Everything derives from CSS variables in `styles.css`:

```css
:root {
  --primary: #c0392b;        /* brick red — also index.html and manifest.json */
  --primary-dark: #a03227;
  --primary-light: #fbeae8;
  --success: #27ae60;  --warning: #e67e22;  --danger: #e74c3c;
  /* …text, border, chip and card tokens… */
}
```

Chip highlights, card titles, active tabs and buttons all come from `--primary` /
`--primary-light`. **Do not add form-specific colours** — it fragments the palette.

---

## Service worker cache

`sw.js` line 1:

```js
const CACHE_NAME = "ortho-v__";   // bump the number on every src/ or styles.css edit
```

Cache-first: users will not see an edit until the cache name changes. During
development, one line clears everything:

```js
(async()=>{ for(const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); for(const k of await caches.keys()) await caches.delete(k); location.reload(); })()
```

---

## Local development

```
node serve.js --open   # http://localhost:3456, and opens a browser
```

Or double-click `Preview.command` in Finder, which runs exactly that.

The Claude Code preview tool works too (`.claude/launch.json`, `preview_start
"ortho-pwa"`, same port).

**`index.html` cannot be opened as `file://`.** It is not that the service worker fails
to register — the app does not load at all, because browsers refuse ES modules from a
`file://` page. A blank page means no server, not a bug.

**The service worker is not registered on `localhost`.** `index.html` guards the
registration on hostname. Without it, the first local preview installs a cache-first
worker that then serves the previous version of every file, and an edit looks like it
did nothing. The guard cannot fire on a real host, so deployed behaviour is unchanged —
do not remove it to "test the service worker locally". Deploy and test it there.

---

## Verifying a change

```
node tests/run.js
```

Eight dependency-free harnesses live in `tests/`, and every one must pass before a
change ships:

| File | Covers |
|---|---|
| `note-blocks.js` | The team's specified note blocks, byte-for-byte: Functional Assessment, Fall Assessment, HDRS, the Green Box line; plus the Mobility/Wheelchair substitution, quick fill, and that Ortho Day Rehab is unaffected |
| `recommendation.js` | Treatment / Treatment plan / Recommendation — the `done` suffix, sub-chip joins, blank lines, and that retired options are unreachable |
| `home.js` | The home page: card order, the form dropdown, Create, the Today link, History rows, date formats |
| `claude-md.js` | This file — that every identifier it names exists, and every key the engine reads is documented here |
| `backup.js` | Export and import: the envelope, refusing foreign files, merge-by-`updatedAt`, migrations on the way in, and a lossless round trip |
| `golden.js` | The **whole** note for both form types, byte-for-byte, against `golden.txt`. The others pin the blocks the team specified; this pins everything else. Regenerate with `node tests/golden.js --write` and read the diff |
| `form-ui.js` | How the form's cards behave rather than what the note says: a `collapsed` section starting shut, opening on a tap, opening itself once answered, and staying shut when deliberately shut. Also that `ortho_day`'s checklists, which share `collapsibleCard`, still default closed |
| `boot.js` | Imports `src/main.js` — the real entry point — and walks every view and every section tab of every form. The only harness that loads the whole module graph, so a missing export or an uninitialised cyclic binding fails here first |

Each calls `load()` from `tests/lib/harness.js`, which installs the `document`,
`localStorage`, `Blob` and `URL` stubs on `globalThis` and then imports `src/index.js`
for real. A test seeds a record through `seedSchemaFields` and reads it back through
`buildSchemaSummary`:

```js
const { load, ok, report } = require("./lib/harness");
(async () => {
  const app = await load();          // a real import of the real module graph
  const a = { formType: "ghf_initial" };
  app.seedSchemaFields(a, app.GHF_SECTIONS);
  …
  report();
})();
```

The harnesses stay CommonJS and reach the app through a dynamic `import()`, so there
is no build step and no `package.json`. `tests/lib/` is a directory, so `run.js` — which
runs every `.js` beside it — does not mistake the shared rig for a harness.

Three things make this worth the trouble:

1. **Assert the team's own note blocks byte-for-byte.** When they specify a format,
   pin the exact string. A near-miss in spacing or punctuation is exactly the kind of
   thing that slips through a visual check.
2. **Drive the real handlers.** A DOM stub that records `kids`, `className` and
   `handlers` lets a test find a chip by its text and click it, so cascade rules,
   exclusivity and quick-fill are exercised as written rather than re-implemented in
   the test.

When a harness disagrees with the code, check which is wrong before changing either —
several times the expectation was at fault, not the app.

These live in the repo because an earlier round kept them in a scratch directory and
lost them three times.

---

## Guardrails

- **Bump `CACHE_NAME` on every deploy.** Easy to forget; users will not see the update.
- **`el()` silently skips `null` children.** That is the whole trick behind conditional
  rendering — use ternaries returning `null`, never `if` blocks.
- **Object-typed fields need `typeof` guards.** Older records may hold `""` where the
  schema now expects `{}`. Read through `objField()`.
- **Leave `ortho_day` alone** unless the change is explicitly for it.
- **Prefer a small generic flag to a special case.** Report templates have no
  conditionals by design; when a format needs one, the answer has usually been a new
  option or question key that other forms can use too.

## Reference implementations

Two sibling apps, useful when a UI pattern here is unclear:

- `/Users/jerry/Documents/Work/Paedi web app/` — paediatric OT (teal; most patterns
  originated here)
- `/Users/jerry/Downloads/ot-pwa/` — hip fracture (dark blue, older and simpler)
