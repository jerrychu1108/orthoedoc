// The exact-match note blocks the team specified, rebuilt after the scratchpad was
// cleared. Targets come from the team's own written specs, as amended by later rounds.
const { load, ok, block, report, textOf, chipNamed } = require("./lib/harness");

(async () => {
const app = await load();

const parts = extra => {
  const a = { formType: "ghf_initial" };
  app.seedSchemaFields(a, app.GHF_SECTIONS);
  Object.assign(a, extra);
  return app.buildSchemaSummary(a, app.GHF_SECTIONS, app.GHF_PARTS);
};
const build = extra => parts(extra).A;
const sectOf = (text, head) => {
  const A = text.split("\n");
  const i = A.indexOf(head);
  if (i < 0) return "";
  let j = A.findIndex((l, k) => k > i && /^[A-Z][A-Z (]+\)?$/.test(l));
  if (j < 0) j = A.length;
  return A.slice(i, j).join("\n").replace(/\n+$/, "");
};
const sect = (extra, head) => {
  const A = build(extra).split("\n");
  const i = A.indexOf(head);
  if (i < 0) return "";
  let j = A.findIndex((l, k) => k > i && /^[A-Z][A-Z (]+\)?$/.test(l));
  if (j < 0) j = A.length;
  return A.slice(i, j).join("\n").replace(/\n+$/, "");
};

console.log("A. FUNCTIONAL ASSESSMENT");
block("matches exactly", sect({
  ghf_mbi: { bowels:10, bladder:10, grooming:5, toileting:10, feeding:10,
             dressing:10, bathing:5, transfer:15, mobility:"0", wheelchair:5, stairs:10 },
  ghf_mbiComment: "Fair activity tolerance",
  ghf_mbiOverall: ["supervision"],
  ghf_lawton: { phone:3, transport:3, shopping:3, meal:3, housework:3,
                handyman:3, laundry:3, medication:3, money:3 }
}, "FUNCTIONAL ASSESSMENT"),
`FUNCTIONAL ASSESSMENT
Modified Barthel Index (MBI): 90/100
Bowels: 10/10   Bladder: 10/10   Grooming: 5/5   Toileting: 10/10   Feeding: 10/10
Dressing: 10/10   Bathing: 5/5   Transfer: 15/15   Wheelchair: 5/5   Stairs: 10/10
Comment: Fair activity tolerance
Overall functional level: Supervision

Chinese Lawton IADL: 27/27
Use of telephone: 3/3   Transportation: 3/3   Shopping: 3/3   Meal preparation: 3/3   Housework: 3/3
Handyman work: 3/3   Laundry: 3/3   Medication Mx: 3/3   Money Mx: 3/3`);

console.log("\nB. FALL ASSESSMENT");
block("matches exactly", sect({
  ghf_fallRisk: "yes", ghf_fallRiskLevel: "low",
  ghf_fallRiskFactors: ["Dizziness", "LL weakness", "Poor safety awareness"],
  ghf_fallAny: "yes", ghf_fallCount: 2, ghf_fallDetails: "S/F in the toilet"
}, "FALL ASSESSMENT"),
`FALL ASSESSMENT
Fall Risk: Yes (Low risk); Risk factors: Dizziness, LL weakness, Poor safety awareness
History of fall in recent year: Yes; Frequency: 2
Fall Details: S/F in the toilet`);

console.log("\nC. HOME DISCHARGE READINESS SCALE (HDRS)");
block("matches exactly", sect({ ghf_hdrs: { f1_e1:1, f1_e2:1, f2_e1:1,
  f2_e2:1, f3_e1:1, f3_e2:1 } }, "HOME DISCHARGE READINESS SCALE (HDRS)"),
`HOME DISCHARGE READINESS SCALE (HDRS)
Factor 1 (Patient) — Rating: 1/5  [Patient attitude: 1/5  Patient sense of competency: 1/5]
Factor 2 (Carer) — Rating: 1/5  [Availability of carer: 1/5  Carer attitude and competency: 1/5]
Factor 3 (Environment) — Rating: 1/5  [Specific home safety: 1/5  Specific home environment: 1/5]
Level of Readiness: Level 1 (Very Low)`);

console.log("\nD. Mobility / Wheelchair substitution");
{
  const mbi = extra => sect({ ghf_mbi: Object.assign({ bowels:10, bladder:10, grooming:5,
    toileting:10, feeding:10, dressing:10, bathing:5, transfer:15, stairs:10 }, extra) },
    "FUNCTIONAL ASSESSMENT");
  ok("Wheelchair unrated → Mobility", /Mobility: 15\/15/.test(mbi({ mobility: 15 })) &&
     !/Wheelchair/.test(mbi({ mobility: 15 })));
  ok("Wheelchair rated → Wheelchair only",
     /Wheelchair: 5\/5/.test(mbi({ mobility:"0", wheelchair:5 })) &&
     !/Mobility/.test(mbi({ mobility:"0", wheelchair:5 })));
  ok("Mobility 0, Wheelchair untouched → Mobility: 0/15",
     /Mobility: 0\/15/.test(mbi({ mobility:"0" })));
  ok("denominator stays 100", /85\/100/.test(mbi({ mobility:"0" })));
  ok("no shared heading anywhere", !/Mobility\/Wheelchair/.test(build({})));
}

console.log("\nE. Quick fill");
{
  // The real chip handler is driven, so exclusivity and the fill rules are exercised
  // as written rather than re-implemented here.
  const tap = (qid, label) => {
    const a = { id: "t", formType: "ghf_initial", date: "2026-03-04" };
    app.seedSchemaFields(a, app.GHF_SECTIONS);
    app.State.assessments = { t: a };
    app.State.currentId = "t";
    const q = app.schemaQuestions(app.GHF_SECTIONS).find(x => x.id === qid);
    const chip = chipNamed(app.schemaWidget(a, q), label);
    if (!chip) return null;
    chip.handlers.click.forEach(fn => fn());
    return a;
  };
  ok("MBI Full → 100/100 and no Wheelchair",
     /Modified Barthel Index \(MBI\): 100\/100/.test(build(tap("ghf_mbi", "Full score"))) &&
     !/Wheelchair/.test(build(tap("ghf_mbi", "Full score"))));
  ok("MBI Zero → 0/100 with the Wheelchair row",
     /Modified Barthel Index \(MBI\): 0\/100/.test(build(tap("ghf_mbi", "Zero score"))) &&
     /Wheelchair: 0\/5/.test(build(tap("ghf_mbi", "Zero score"))));
  ok("AMT Full → 10/10", /Abbreviated Mental Test \(AMT\): 10\/10/
     .test(build(tap("ghf_amt", "Full score"))));
  ok("CDT Zero still prints", /Clock Drawing Test \(CDT\): 0\/10/
     .test(build(tap("ghf_cdt", "Zero score"))));
  ok("HDRS has no quick fill", tap("ghf_hdrs", "Full score") === null);
}

console.log("\nF. The retired sections stay retired");
{
  const stale = build({ ghf_frat: 18, ghf_fes: 60, ghf_mbiImpression: "old text",
    ghf_riskChecklist: ["mobility"], ghf_fallReasons: ["dizziness"] });
  ["FRAT", "Fall Efficacy", "Impression:", "Reason:", "FALL RISK ASSESSMENT",
   "HOME DISCHARGE READINESS\n"].forEach(t =>
    ok("no \"" + t.trim() + "\"", !stale.includes(t)));
  ok("no Carer contact / Care plan / destination",
     !/Carer contact:|Care plan:|Potential discharge destination:/.test(
       Object.values(parts({ ghf_carer: { contact: "x" }, ghf_carerPlan: "y",
         ghf_destination: "z" })).join("\n")));
  ok("the HDRS tab reads HDRS",
     app.GHF_SECTIONS.find(s => s.id === "hdrs").label === "HDRS");
}

console.log("\nG. The Green Box");
{
  const p = parts({
    ghf_otComment: "Good rehabilitation potential",
    ghf_preMbi: { bowels:10, bladder:10, grooming:5, toileting:10, feeding:10,
                  dressing:10, bathing:5, transfer:15, mobility:15, stairs:10 },
    ghf_mbi: { bowels:10, bladder:10, grooming:5, toileting:10, feeding:10,
               dressing:5, bathing:1, transfer:3, mobility:0, wheelchair:0, stairs:10 },
    ghf_mbiOverall: ["moderate"],
    ghf_amt: { age:1, time:1, addr:1, year:1, place:1, recog:1 }, ghf_cdt: 10,
    ghf_moca: { visuospatial:3, naming:2, attention:4, language:2, abstraction:1,
                recall:1, orientation:3 },
    ghf_mocaAge: "70-79", ghf_mocaEdu: 2
  });
  ok("one line, no break", !/\n/.test(p.G) && p.G.length === 179, String(p.G.length));
  ok("semicolon-separated", p.G ===
     "Good rehabilitation potential; Premorbid ADL: MBI 100/100; Current ADL: MBI 64/100 " +
     "(Moderate assistance); Cognitive function: AMT: 6/10; CDT: 10/10; MoCA: 16/30 " +
     "(>16th percentile)", p.G);
  ok("Green Box is the first part", app.GHF_PARTS[0].key === "G");
  ok("OT COMMENT sits in part A", /\nOT COMMENT\n/.test(p.A));
}

console.log("\nH. Ortho Day Rehab is untouched");
{
  const a = { formType: "ortho_day", od_frat: 18, od_autoHigh: ["dizziness"],
    od_mbi: { mobility: "0", wheelchair: 4, bowels: 10 },
    od_problems: ["deconditioning"] };
  const od = Object.values(app.buildSummary(a)).join("\n");
  ok("keeps its FALL RISK ASSESSMENT", /FALL RISK ASSESSMENT/.test(od));
  ok("keeps its High Risk banding", /High Risk/.test(od));
  ok("shares the Wheelchair substitution", /Wheelchair: 4\/5/.test(od) && !/Mobility/.test(od));
  ok("picks up no \" done\" suffix", !/ done/.test(od));
}

console.log("\nI. Vital signs — Room air or a flow rate, never both");
{
  // The oxygen status joins SpO2 with a comma while the other readings stay
  // semicolon-separated, and contributes nothing at all when unanswered.
  const vitals = extra => {
    const a = { formType: "ghf_initial" };
    app.seedSchemaFields(a, app.GHF_SECTIONS);
    Object.assign(a, { ghf_vitals: { bp: "123/75", pulse: "80", spo2: "95" },
                       ghf_temp: "afebrile" }, extra);
    // A hidden answer is erased on every render, so sweep before reading the note.
    app.clearHiddenSchemaAnswers(a, app.GHF_SECTIONS);
    return app.buildSchemaSummary(a, app.GHF_SECTIONS, app.GHF_PARTS).A
      .split("\n").find(l => l.startsWith("Vital signs")) || "(no Vital signs line)";
  };

  block("a flow rate", vitals({ ghf_o2Flow: "1" }),
    "Vital signs: BP 123/75 mmHg; Pulse 80/min; SpO2 95%, 1L O2; Afebrile");
  block("Room air", vitals({ ghf_o2: "room" }),
    "Vital signs: BP 123/75 mmHg; Pulse 80/min; SpO2 95%, Room air; Afebrile");
  block("neither — no stray comma", vitals({}),
    "Vital signs: BP 123/75 mmHg; Pulse 80/min; SpO2 95%; Afebrile");

  ok("the unit is the app's, not the typist's", /\b2L O2\b/.test(vitals({ ghf_o2Flow: "2" })));
  ok("a decimal flow reads back whole", /\b0.5L O2\b/.test(vitals({ ghf_o2Flow: "0.5" })));

  // Room air wins even if a flow was typed first, because selecting it hides the
  // field and the stale-value rule then clears it from the record.
  ok("Room air clears a flow typed earlier",
     vitals({ ghf_o2: "room", ghf_o2Flow: "9" }) ===
     "Vital signs: BP 123/75 mmHg; Pulse 80/min; SpO2 95%, Room air; Afebrile");

  // Driving the real chip handler, so the clearing is exercised as written.
  {
    const a = { id: "t", formType: "ghf_initial", date: "2026-03-04",
                ghf_vitals: { bp: "123/75", pulse: "80", spo2: "95" },
                ghf_o2Flow: "3" };
    app.seedSchemaFields(a, app.GHF_SECTIONS);
    a.ghf_o2Flow = "3";
    app.State.assessments = { t: a };
    app.State.currentId = "t";
    const q = app.schemaQuestions(app.GHF_SECTIONS).find(x => x.id === "ghf_o2");
    const chip = chipNamed(app.schemaWidget(a, q), "Room air");
    ok("the Room air chip exists", !!chip);
    if (chip) {
      chip.handlers.click.forEach(fn => fn());
      ok("tapping it selects Room air", a.ghf_o2 === "room", String(a.ghf_o2));
      app.clearHiddenSchemaAnswers(a, app.GHF_SECTIONS);
      ok("and the flow rate is cleared from the record",
         !a.ghf_o2Flow, JSON.stringify(a.ghf_o2Flow));
      chip.handlers.click.forEach(fn => fn());
      ok("tapping again deselects, so the field comes back", a.ghf_o2 === "");
    }
  }

  ok("the retired free-text box is gone",
     !app.schemaQuestions(app.GHF_SECTIONS).find(q => q.id === "ghf_vitals")
        .parts.some(p => p.id === "o2"));
}

console.log("\nJ. The note's title and the operation status");
{
  const noteA = extra => {
    const a = { formType: "ghf_initial" };
    app.seedSchemaFields(a, app.GHF_SECTIONS);
    Object.assign(a, { ghf_vitals: { bp: "123/78", pulse: "90", spo2: "99" },
                       ghf_o2: "room", ghf_temp: "afebrile" }, extra);
    app.clearHiddenSchemaAnswers(a, app.GHF_SECTIONS);
    return app.buildSchemaSummary(a, app.GHF_SECTIONS, app.GHF_PARTS).A;
  };
  const head = extra => noteA(extra).split("\n").slice(0, 4).join("\n");

  block("pre-operation", head({ ghf_opTiming: "pre" }),
`<Initial Assessment Note>

[Pre-operation]
Vital signs: BP 123/78 mmHg; Pulse 90/min; SpO2 99%, Room air; Afebrile`);

  block("post-operation carries its day",
    head({ ghf_opTiming: "post", ghf_opTiming__d_post: "2" }),
`<Initial Assessment Note>

[Post-operation Day 2]
Vital signs: BP 123/78 mmHg; Pulse 90/min; SpO2 99%, Room air; Afebrile`);

  // The title heads the note, so it must not depend on the operation status having
  // been answered — but it must not appear over nothing either.
  ok("the title stands without an operation status",
     head({}).startsWith("<Initial Assessment Note>\n\nVital signs:"), JSON.stringify(head({})));

  const blank = () => {
    const a = { formType: "ghf_initial" };
    app.seedSchemaFields(a, app.GHF_SECTIONS);
    return app.buildSchemaSummary(a, app.GHF_SECTIONS, app.GHF_PARTS);
  };
  ok("an untouched assessment prints no title at all", blank().A === "",
     JSON.stringify(blank().A));

  // The handover line is its own thing and takes no heading — it is one line for a
  // 250-character field, and a title would eat a fifth of it.
  const g = () => {
    const a = { formType: "ghf_initial" };
    app.seedSchemaFields(a, app.GHF_SECTIONS);   // seeds blanks, so answer after it
    a.ghf_otComment = "Good rehab potential";
    return app.buildSchemaSummary(a, app.GHF_SECTIONS, app.GHF_PARTS).G;
  };
  ok("the Green Box carries no title", g() === "Good rehab potential", JSON.stringify(g()));
  ok("only part A declares a header",
     app.GHF_PARTS.filter(p => p.header).map(p => p.key).join() === "A",
     app.GHF_PARTS.filter(p => p.header).map(p => p.key).join());

  ok("the operation status opens the vitals section",
     app.GHF_SECTIONS.find(s => s.id === "vitals").questions[0].id === "ghf_opTiming");
}

console.log("\nK. The cognitive line says when the tests were done");
{
  // One computed field feeds both the OT comment and the Green Box, so the wording
  // cannot drift between the note and the handover line.
  const built = timing => {
    const a = { formType: "ghf_initial" };
    app.seedSchemaFields(a, app.GHF_SECTIONS);
    a.ghf_amt = { age:1, time:1, addr:1, year:1, place:1, recog:1 };
    a.ghf_cdt = 10;
    a.ghf_otComment = "Good rehab potential";
    a.ghf_cogTiming = timing;
    if (timing === "post") a.ghf_cogTiming__d_post = "2";
    app.clearHiddenSchemaAnswers(a, app.GHF_SECTIONS);
    const p = app.buildSchemaSummary(a, app.GHF_SECTIONS, app.GHF_PARTS);
    const A = p.A.split("\n");
    const i = A.indexOf("OT COMMENT");
    return { green: p.G, comment: i < 0 ? "" : A.slice(i + 1, i + 3).join("\n") };
  };

  const pre = built("pre"), post = built("post"), none = built("");

  block("OT comment, pre-operation", pre.comment,
`Good rehab potential
Pre-op cognitive function: AMT: 6/10; CDT: 10/10`);
  block("OT comment, post-operation", post.comment,
`Good rehab potential
Post-op cognitive function: AMT: 6/10; CDT: 10/10`);

  block("Green Box, pre-operation", pre.green,
    "Good rehab potential; Pre-op cognitive function: AMT: 6/10; CDT: 10/10");
  block("Green Box, post-operation", post.green,
    "Good rehab potential; Post-op cognitive function: AMT: 6/10; CDT: 10/10");

  // Unanswered keeps the original wording rather than guessing, and keeps its capital.
  block("unanswered stays as it was", none.green,
    "Good rehab potential; Cognitive function: AMT: 6/10; CDT: 10/10");

  // The day belongs to the full heading above, not to this one-line summary.
  ok("the summary carries no day number", !/Day 2/.test(post.green + post.comment),
     post.green);
  ok("but the block heading above still does",
     /Cognitive Assessment \(Post-operation Day 2\):/.test(
       (() => {
         const a = { formType: "ghf_initial" };
         app.seedSchemaFields(a, app.GHF_SECTIONS);
         a.ghf_cogTiming = "post"; a.ghf_cogTiming__d_post = "2"; a.ghf_cdt = 10;
         app.clearHiddenSchemaAnswers(a, app.GHF_SECTIONS);
         return app.buildSchemaSummary(a, app.GHF_SECTIONS, app.GHF_PARTS).A;
       })()));
}

console.log("\nL. Reality orientation says what failed, not only what passed");
{
  const line = picks => {
    const a = { formType: "ghf_initial" };
    app.seedSchemaFields(a, app.GHF_SECTIONS);
    a.ghf_orientation = picks;
    app.clearHiddenSchemaAnswers(a, app.GHF_SECTIONS);
    return app.buildSchemaSummary(a, app.GHF_SECTIONS, app.GHF_PARTS).A
      .split("\n").find(l => /rient/.test(l)) || "";
  };

  block("all three", line(["time", "place", "person"]),
    "Oriented to time, place and person");
  block("one of three", line(["time"]),
    "Oriented to time; Disoriented to place and person");
  block("two of three", line(["time", "place"]),
    "Oriented to time and place; Disoriented to person");
  block("declared order, not tap order", line(["person", "time"]),
    "Oriented to time and person; Disoriented to place");
  block("disoriented to all", line(["disoriented"]),
    "Disoriented to time, place and person");
  block("unable to assess is unchanged", line(["unable"]),
    "Unable to assess orientation");

  // Nothing ticked already means "not asked" — which is exactly why the chip exists.
  ok("nothing ticked prints no line", line([]) === "", JSON.stringify(line([])));

  // Driving the real chip handler, so exclusivity is exercised as written.
  const tap = (start, label) => {
    const a = { id: "t", formType: "ghf_initial", date: "2026-03-04" };
    app.seedSchemaFields(a, app.GHF_SECTIONS);
    a.ghf_orientation = start;
    app.State.assessments = { t: a };
    app.State.currentId = "t";
    const q = app.schemaQuestions(app.GHF_SECTIONS).find(x => x.id === "ghf_orientation");
    const chip = chipNamed(app.schemaWidget(a, q), label);
    if (!chip) return null;
    chip.handlers.click.forEach(fn => fn());
    return a.ghf_orientation;
  };

  ok("\"Disoriented to all\" clears the three",
     JSON.stringify(tap(["time", "place"], "Disoriented to all")) === '["disoriented"]',
     JSON.stringify(tap(["time", "place"], "Disoriented to all")));
  ok("and picking one clears it back",
     JSON.stringify(tap(["disoriented"], "Time")) === '["time"]',
     JSON.stringify(tap(["disoriented"], "Time")));
  ok("\"Unable to assess\" still clears everything",
     JSON.stringify(tap(["time", "place"], "Unable to assess")) === '["unable"]',
     JSON.stringify(tap(["time", "place"], "Unable to assess")));
  ok("the two exclusives clear each other",
     JSON.stringify(tap(["disoriented"], "Unable to assess")) === '["unable"]',
     JSON.stringify(tap(["disoriented"], "Unable to assess")));

  ok("the caption no longer says \"oriented to\"",
     app.schemaQuestions(app.GHF_SECTIONS)
        .find(q => q.id === "ghf_orientation").label === "Reality orientation");
}

console.log("\nM. One Pre-op / Post-op choice for the whole Functional Assessment");
{
  const MBI = { bowels:10, bladder:10, grooming:5, toileting:10, feeding:10,
                dressing:10, bathing:5, transfer:15, mobility:15, stairs:10 };
  const IADL = { phone:3, transport:3, shopping:3, meal:3, housework:3,
                 handyman:3, laundry:3, medication:3, money:3 };
  const fa = extra => {
    const a = { formType: "ghf_initial" };
    app.seedSchemaFields(a, app.GHF_SECTIONS);
    Object.assign(a, extra);
    app.clearHiddenSchemaAnswers(a, app.GHF_SECTIONS);
    return { a, block: sectOf(app.buildSchemaSummary(a, app.GHF_SECTIONS, app.GHF_PARTS).A,
      "FUNCTIONAL ASSESSMENT") };
  };

  block("pre-op: both instruments, no timing line of its own",
    fa({ ghf_funcTiming: "pre" }).block,
`FUNCTIONAL ASSESSMENT
Modified Barthel Index (MBI): Not tested due to pre-operation
Chinese Lawton IADL: Not tested due to pre-operation`);

  // Post-op wording is unchanged from before the section had a choice at all.
  ok("post-op still reads \"Post-operation Day 2\"",
     fa({ ghf_funcTiming: "post", ghf_funcTiming__d_post: "2", ghf_mbi: MBI, ghf_lawton: IADL })
       .block.split("\n")[1] === "Post-operation Day 2");
  ok("and the scores still print under it",
     /Modified Barthel Index \(MBI\): 100\/100/.test(
       fa({ ghf_funcTiming: "post", ghf_funcTiming__d_post: "2", ghf_mbi: MBI }).block));

  // The gate now comes from two directions, and a hidden answer is erased, so a score
  // entered before Pre-op was chosen must not survive behind it.
  const switched = fa({ ghf_funcTiming: "pre", ghf_mbi: MBI, ghf_lawton: IADL,
                        ghf_mbiComment: "fair tolerance", ghf_mbiOverall: ["supervision"] });
  ok("choosing Pre-op clears a score entered first",
     app.isBlankAnswer(switched.a.ghf_mbi) && app.isBlankAnswer(switched.a.ghf_lawton),
     JSON.stringify([switched.a.ghf_mbi, switched.a.ghf_lawton]));
  ok("and the comment and overall level with it",
     !switched.a.ghf_mbiComment && app.isBlankAnswer(switched.a.ghf_mbiOverall));

  // "Not tested" for a reason of its own is a separate matter and still works.
  ok("a reason other than pre-op still prints",
     /Modified Barthel Index \(MBI\): Not tested due to pain/.test(
       fa({ ghf_funcTiming: "post", ghf_funcTiming__d_post: "2",
            ghf_mbiStatus: "not_tested", ghf_mbiStatus__d_not_tested: "pain" }).block));

  // The whole point: these two could contradict each other before.
  ok("neither instrument offers Pre-op any more",
     ["ghf_mbiStatus", "ghf_lawtonStatus"].every(id =>
       !app.qOptions(app.schemaQuestions(app.GHF_SECTIONS).find(q => q.id === id))
          .some(o => o.value === "pre_op")));
  ok("and the day box is gone with it",
     !app.schemaQuestions(app.GHF_SECTIONS).some(q => q.id === "ghf_funcPod"));

  // The handover line reads the same fact from a different place, so it has to follow.
  const otLine = t => {
    const a = { formType: "ghf_initial" };
    app.seedSchemaFields(a, app.GHF_SECTIONS);
    a.ghf_funcTiming = t;
    app.clearHiddenSchemaAnswers(a, app.GHF_SECTIONS);
    return app.buildSchemaSummary(a, app.GHF_SECTIONS, app.GHF_PARTS).G;
  };
  ok("the Green Box says why there is no ADL score",
     otLine("pre") === "Current ADL: Not tested due to pre-operation", otLine("pre"));
  ok("and says nothing of the sort when post-op", otLine("post") === "", otLine("post"));
}

report();
})();
