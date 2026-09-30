import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { JSDOM, VirtualConsole } from "jsdom";
import { randomUUID } from "node:crypto";

const waitFor = async (predicate) => {
  for (let i = 0; i < 100; i++) {
    if (predicate()) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error("Interface did not reach expected state");
};
test("demo interface completes the full scholarship workflow and safely renders input", async (t) => {
  const result = await build({
    entryPoints: ["src/main.js"],
    bundle: true,
    write: false,
    format: "iife",
    loader: { ".css": "empty" },
    define: { "import.meta.env": "{}" },
    logLevel: "silent",
  });
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", (e) => errors.push(e.message));
  const dom = new JSDOM(
    '<div id="app"></div><div id="toast"></div><div id="modal-root"></div>',
    {
      url: "http://localhost/?demo=1",
      runScripts: "outside-only",
      pretendToBeVisual: true,
      virtualConsole,
    },
  );
  const w = dom.window,
    d = w.document;
  Object.defineProperty(w.crypto, "randomUUID", { value: randomUUID });
  w.fetch = () => {
    throw new Error("Demo should not require a network request");
  };
  w.eval(result.outputFiles[0].text);
  const click = (selector) => {
    const el = d.querySelector(selector);
    assert.ok(el, `Missing ${selector}`);
    el.click();
  };
  const fill = (name, value) => {
    const el = d.querySelector(`.modal [name="${name}"]`);
    assert.ok(el, name);
    el.value = value;
  };
  const submit = () =>
    d
      .querySelector(".modal form")
      .dispatchEvent(
        new w.Event("submit", { bubbles: true, cancelable: true }),
      );
  const saved = async () => {
    await waitFor(() => !d.querySelector(".modal"));
    await new Promise((r) => setTimeout(r, 20));
  };
  const stored = () =>
    JSON.parse(w.localStorage.getItem("scholartrack-demo-v1"));
  await waitFor(() => d.querySelector(".stats-grid"));
  await t.test("dashboard and all navigation destinations render", async () => {
    assert.match(d.body.textContent, /A brighter future starts here/);
    for (const page of [
      "scholars",
      "scholarships",
      "grades",
      "compliance",
      "reports",
      "settings",
      "dashboard",
    ]) {
      w.location.hash = page;
      await waitFor(() => d.querySelector(`[href="#${page}"].selected`));
      assert.ok(d.querySelector("h1"));
    }
  });
  let scholar, assignment, submission;
  await t.test("registers scholar and escapes markup", async () => {
    click("[data-action=register]");
    fill("full_name", "Test <img src=x onerror=alert(1)>");
    fill("student_id", "2026-9999");
    fill("email", "new@example.edu");
    fill("course", "BS Computer Science");
    fill("year_level", "1");
    submit();
    await saved();
    scholar = stored().scholars.find((s) => s.student_id === "2026-9999");
    assert.ok(scholar);
    assert.ok(d.body.textContent.includes(scholar.full_name));
    assert.equal(d.querySelector("img[src=x]"), null);
  });
  await t.test("assigns scholarship for a semester", async () => {
    w.location.hash = "scholars";
    await waitFor(() => d.querySelector("[data-action=assign]"));
    click("[data-action=assign]");
    fill("scholar_id", scholar.id);
    fill("program_id", "p1");
    fill("term", "1st Semester 2026–2027");
    submit();
    await saved();
    assignment = stored().assignments.find((a) => a.scholar_id === scholar.id);
    assert.ok(assignment);
  });
  await t.test("submits courses and computes weighted GWA", async () => {
    w.location.hash = "grades";
    await waitFor(() => d.querySelector("[data-action=submit]"));
    click("[data-action=submit]");
    fill("assignment_id", assignment.id);
    for (let i = 0; i < 5; i++) click("[data-action=add-course]");
    for (const [i, row] of [...d.querySelectorAll(".course-row")].entries()) {
      row.querySelector("[name=code]").value = `CS${i}`;
      row.querySelector("[name=units]").value = "3";
      row.querySelector("[name=grade]").value = "1.5";
    }
    submit();
    await saved();
    submission = stored().submissions.find(
      (s) => s.assignment_id === assignment.id,
    );
    assert.equal(submission.gwa, 1.5);
    assert.equal(submission.units, 18);
    assert.equal(submission.status, "pending");
  });
  await t.test("verifies then evaluates the submission", async () => {
    click(`[data-action=review][data-id="${submission.id}"]`);
    fill("status", "verified");
    submit();
    await saved();
    w.location.hash = "compliance";
    await waitFor(() =>
      d.querySelector(`[data-action=evaluate][data-id="${submission.id}"]`),
    );
    click(`[data-action=evaluate][data-id="${submission.id}"]`);
    submit();
    await saved();
    assert.equal(
      stored().evaluations.find((e) => e.submission_id === submission.id)
        .status,
      "compliant",
    );
  });
  await t.test(
    "search filters without losing focus; sign-out restores login",
    async () => {
      w.location.hash = "scholars";
      await waitFor(() => d.querySelector('[href="#scholars"].selected'));
      const search = d.querySelector("#search");
      search.focus();
      search.value = "2026-9999";
      search.dispatchEvent(new w.Event("input", { bubbles: true }));
      assert.equal(d.querySelectorAll("tbody tr").length, 1);
      assert.equal(d.activeElement, search);
      click("[data-action=logout]");
      await waitFor(() => d.querySelector("#login-form"));
      assert.equal(w.sessionStorage.getItem("scholartrack-mode"), null);
    },
  );
  assert.deepEqual(errors, []);
  dom.window.close();
});
