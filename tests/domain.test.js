import test from "node:test";
import assert from "node:assert/strict";
import {
  summarizeGrades,
  evaluateCompliance,
  validateScholar,
  validateProgram,
} from "../src/domain.js";

test("GWA is weighted by units and rounded to two places", () => {
  assert.deepEqual(
    summarizeGrades([
      { code: "CS101", units: 3, grade: 1.25 },
      { code: "PE101", units: 2, grade: 2 },
    ]),
    { gwa: 1.55, units: 5, has_failing_grade: false },
  );
  assert.equal(
    summarizeGrades([
      { code: "a", units: 1, grade: 1 },
      { code: "b", units: 2, grade: 2 },
    ]).gwa,
    1.67,
  );
});
test("passing boundary is 3.00, failing boundary is above 3.00", () => {
  assert.equal(
    summarizeGrades([{ code: "A", units: 3, grade: 3 }]).has_failing_grade,
    false,
  );
  assert.equal(
    summarizeGrades([{ code: "A", units: 3, grade: 3.01 }]).has_failing_grade,
    true,
  );
});
test("rejects missing, duplicate, invalid and out-of-range course values", () => {
  for (const courses of [
    [],
    [{ code: "", units: 3, grade: 1 }],
    [{ code: "A", units: 3, grade: 0 }],
    [{ code: "A", units: 3, grade: 5.01 }],
    [{ code: "A", units: 0, grade: 1 }],
    [{ code: "A", units: 3.25, grade: 1 }],
    [{ code: "A", units: 3, grade: "" }],
    [{ code: "A", units: 3, grade: NaN }],
    [
      { code: " A ", units: 3, grade: 1 },
      { code: "a", units: 3, grade: 2 },
    ],
  ])
    assert.throws(() => summarizeGrades(courses));
});
test("compliance accepts exact thresholds and reports every failing rule", () => {
  const policy = { max_gwa: 1.75, min_units: 18, allow_failing: false };
  assert.deepEqual(
    evaluateCompliance(
      { status: "verified", gwa: 1.75, units: 18, has_failing_grade: false },
      policy,
    ),
    { status: "compliant", reasons: [] },
  );
  assert.equal(
    evaluateCompliance(
      { status: "verified", gwa: 1.76, units: 17, has_failing_grade: true },
      policy,
    ).reasons.length,
    3,
  );
  assert.equal(
    evaluateCompliance(
      { status: "verified", gwa: 2, units: 18, has_failing_grade: true },
      { max_gwa: 2.5, min_units: 18, allow_failing: true },
    ).status,
    "compliant",
  );
});
test("pending and rejected grades cannot be evaluated", () => {
  for (const status of ["pending", "rejected"])
    assert.throws(() =>
      evaluateCompliance(
        { status, gwa: 1, units: 20 },
        { max_gwa: 2, min_units: 18 },
      ),
    );
});
test("scholar and scholarship inputs are constrained", () => {
  const scholar = {
    student_id: "2026-1001",
    full_name: "Test Scholar",
    email: "test@example.edu",
    course: "BS Computer Science",
    year_level: 1,
  };
  assert.doesNotThrow(() => validateScholar(scholar));
  for (const patch of [
    { student_id: "bad" },
    { email: "bad" },
    { full_name: " " },
    { year_level: 0 },
    { year_level: 1.5 },
  ])
    assert.throws(() => validateScholar({ ...scholar, ...patch }));
  assert.doesNotThrow(() =>
    validateProgram({ name: "Merit", max_gwa: 1.75, min_units: 18 }),
  );
  assert.throws(() =>
    validateProgram({ name: "Merit", max_gwa: 6, min_units: 18 }),
  );
  assert.throws(() =>
    validateProgram({ name: "Merit", max_gwa: 2, min_units: 17.5 }),
  );
});
