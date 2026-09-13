// CLAUDE.md steers future sessions, so every factual claim in it has to be true of
// the code, and every key the engine reads has to be mentioned in it.
const fs = require("fs"), path = require("path");
const { appSource } = require("./lib/harness");
const DIR = path.join(__dirname, "..") + path.sep;
const doc = fs.readFileSync(DIR + "CLAUDE.md", "utf8");
// Every file the app is built from, so these checks follow the code as it moves
// into src/ rather than passing against a file that no longer holds it.
const app = appSource();
const css = fs.readFileSync(DIR + "styles.css", "utf8");
const sw  = fs.readFileSync(DIR + "sw.js", "utf8");

let fail = 0;
const ok = (name, cond, extra) => {
  console.log((cond ? "  ok   " : "  FAIL ") + name);
  if (!cond) { fail++; if (extra !== undefined) console.log("        " + extra); }
};
const uniq = a => [...new Set(a)];
const harvest = (re, src) => uniq([...src.matchAll(re)].map(m => m[1]));

console.log("1. Every identifier the doc names exists in app.js");
{
  const named = ["State", "Storage", "FORM_TYPES", "GHF_COMPUTED", "GHF_SECTIONS",
    "GHF_PARTS", "SUMMARY_PARTS", "OD_SECTIONS", "MBI_ITEMS", "GHF_MBI_ITEMS",
    "seedSchemaFields", "buildSchemaSummary", "clearHiddenSchemaAnswers",
    "applyTemplate", "tidyLine", "answerOf", "objField", "saveSoon", "renderHome",
    "renderForm", "renderSummary", "goHome", "goForm", "goSummary", "detailKey",
    "subKey", "showQuestion", "blankAssessment"];
  const missing = named.filter(n => doc.includes(n) && !app.includes(n));
  ok("all present", !missing.length, missing.join());

  const state = harvest(/^  (\w+):/gm, app.slice(app.indexOf("const State = {")).slice(0, 700));
  const undoc = state.filter(f => !doc.includes(f));
  ok("every State field documented", !undoc.length, undoc.join());

  const computed = harvest(/^  (\w+)\(a\) \{/gm,
    app.slice(app.indexOf("const GHF_COMPUTED")).split("\n};")[0]);
  ok("six computed fields, all documented", computed.length === 6 &&
     computed.every(c => doc.includes(c)), computed.join());
}

console.log("\n2. Every key the engine reads is mentioned in the doc");
{
  const skip = new Set(["assessments", "idx", "setIdx", "tabs", "extraClass", "split",
    "mobility", "detailKey", "type", "id", "label", "options", "parts", "hint",
    "placeholder", "compute", "value", "key", "title", "questions"]);
  [["q", /\bq\.([a-zA-Z]+)/g], ["o", /\bo\.([a-zA-Z]+)/g], ["it", /\bit\.([a-zA-Z]+)/g],
   ["sec", /\bsec\.([a-zA-Z]+)/g], ["part", /\bpart\.([a-zA-Z]+)/g]
  ].forEach(([tag, re]) => {
    const keys = harvest(re, app).filter(k => !skip.has(k));
    const undoc = keys.filter(k => !doc.includes("`" + k + "`") && !doc.includes(k));
    ok(tag + ".* keys all documented (" + keys.length + ")", !undoc.length, undoc.join());
  });
}

console.log("\n3. Files named in the doc exist, and serve.py is not named");
{
  ["index.html", "src/main.js", "src/index.js", "styles.css", "sw.js", "manifest.json",
   "icon-192.png", "icon-512.png", ".claude/launch.json",
   "ortho day template.txt"].forEach(f =>
    ok(f + " named and present", doc.includes(f) && fs.existsSync(DIR + f)));
  ok("serve.py not named", !doc.includes("serve.py"));
  ok("and does not exist", !fs.existsSync(DIR + "serve.py"));
  ok(".DS_Store gone from the working tree", !fs.existsSync(DIR + ".DS_Store"));
}

console.log("\n3b. The service worker caches every file the app is built from");
{
  const listed = [...sw.matchAll(/"([^"]+\.js)"/g)].map(m => m[1])
    .filter(f => f !== "sw.js");
  const onDisk = [];
  const walk = d => fs.readdirSync(DIR + d, { withFileTypes: true }).forEach(e => {
    if (e.isDirectory()) walk(d + e.name + "/");
    else if (e.name.endsWith(".js")) onDisk.push(d + e.name);
  });
  if (fs.existsSync(DIR + "app.js")) onDisk.push("app.js");
  if (fs.existsSync(DIR + "src")) walk("src/");
  const missing = onDisk.filter(f => !listed.includes(f));
  const ghost = listed.filter(f => !onDisk.includes(f));
  // A file the app imports but the worker never caches works online and fails on the
  // ward, which is the one place it has to work.
  ok("every source file is cached (" + onDisk.length + ")", !missing.length, missing.join());
  ok("and nothing cached is missing", !ghost.length, ghost.join());
}

console.log("\n3c. index.html does not register the service worker on localhost");
{
  const html = fs.readFileSync(DIR + "index.html", "utf8");
  // Without this guard, a local preview installs a cache-first worker and then serves
  // the previous version of every file, so an edit looks like it did nothing. It is a
  // development-only guard, and it must stay development-only: if it ever matched a
  // real host, the deployed app would silently stop working offline.
  ok("registration is guarded on hostname",
     /serviceWorker' in navigator &&[\s\S]{0,200}?hostname !== 'localhost'/.test(html));
  ok("127.0.0.1 too", html.includes("hostname !== '127.0.0.1'"));
  ok("and nothing else is excluded",
     (html.match(/hostname !== '[^']+'/g) || []).length === 2,
     (html.match(/hostname !== '[^']+'/g) || []).join(", "));
  ok("the rule is documented", /not registered on `localhost`/.test(doc));
}

console.log("\n4. Quoted values match the code");
{
  ok("--primary is #c0392b", /--primary:\s*#c0392b/.test(css) && doc.includes("#c0392b"));
  // The number changes every deploy, so the doc documents the rule, not the value —
  // and must not name a specific version, which would silently go stale.
  ok("the bump rule is documented", /bump the number on every/.test(doc));
  const named = doc.match(/ortho-v\d+/);
  ok("no specific cache version named", !named, named && named[0]);
  ok("storage key", app.includes('"ortho.assessments.v1"') &&
     doc.includes("ortho.assessments.v1"));
  const migrations = (app.match(/Removable once/g) || []).length;
  ok("migration count is " + migrations, doc.includes("**eight**") && migrations === 8,
     String(migrations));
  const types = harvest(/case "([a-z]+)":/g,
    app.slice(app.indexOf("function schemaWidget")).split("\n}")[0]);
  const undoc = types.filter(t => !doc.includes("`" + t + "`"));
  ok("every widget type documented (" + types.length + ")", !undoc.length, undoc.join());
}

console.log("\n5. No stale identifier survives");
{
  ["serve.py", "omSection", "hip_fracture", "HIP_SECTIONS", "fallRisk",
   "assessmentProgress", "1a5276", "ortho-v1\"", "New Assessment", "EXPIRY_WARN",
   "renderAssessmentCard", "Starter Brief"].forEach(s =>
    ok("no \"" + s + "\"", !doc.includes(s)));
  ok("no State.modal", !/State\.modal|modal: null/.test(doc));
  ok("no milestone or pre-build section",
     !/before starting|First-milestone|What YOU/.test(doc));
}

console.log(fail ? "\n" + fail + " FAILURE(S)" : "\nALL CHECKS PASS");
process.exitCode = fail ? 1 : 0;
