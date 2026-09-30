export const TERMS = [
  "1st Semester 2026–2027",
  "2nd Semester 2025–2026",
  "1st Semester 2025–2026",
];
export function validateScholar(input) {
  if (!/^\d{4}-\d{4,6}$/.test(input.student_id))
    throw new Error(
      "Student ID must use YYYY-NNNN (4–6 digits after the dash).",
    );
  if (!input.full_name?.trim() || input.full_name.trim().length > 120)
    throw new Error("Enter a full name of up to 120 characters.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email))
    throw new Error("Enter a valid email address.");
  if (!input.course?.trim()) throw new Error("Select a degree program.");
  if (
    !Number.isInteger(Number(input.year_level)) ||
    Number(input.year_level) < 1 ||
    Number(input.year_level) > 5
  )
    throw new Error("Year level must be from 1 to 5.");
}
export function summarizeGrades(courses) {
  if (!Array.isArray(courses) || !courses.length || courses.length > 15)
    throw new Error("Enter 1–15 courses.");
  const codes = new Set();
  let units = 0,
    weighted = 0,
    has_failing_grade = false;
  for (const course of courses) {
    const code = course.code?.trim().toUpperCase();
    if (!code || code.length > 40 || codes.has(code))
      throw new Error(
        "Every course needs a unique code of up to 40 characters.",
      );
    codes.add(code);
    const grade = Number(course.grade),
      load = Number(course.units);
    if (
      course.grade === "" ||
      !Number.isFinite(grade) ||
      grade < 1 ||
      grade > 5
    )
      throw new Error("Grades must be from 1.00 to 5.00.");
    if (
      course.units === "" ||
      !Number.isFinite(load) ||
      load < 1 ||
      load > 12 ||
      (load * 2) % 1 !== 0
    )
      throw new Error("Course units must be 1–12 in half-unit increments.");
    units += load;
    weighted += grade * load;
    has_failing_grade ||= grade > 3;
  }
  return {
    gwa: Math.round((weighted / units + Number.EPSILON) * 100) / 100,
    units,
    has_failing_grade,
  };
}
export function evaluateCompliance(submission, policy) {
  if (submission.status !== "verified")
    throw new Error(
      "Verify this grade submission before evaluating compliance.",
    );
  const reasons = [];
  if (Number(submission.gwa) > Number(policy.max_gwa))
    reasons.push(`GWA exceeds ${Number(policy.max_gwa).toFixed(2)}`);
  if (Number(submission.units) < Number(policy.min_units))
    reasons.push(`Below ${policy.min_units} required units`);
  if (!policy.allow_failing && submission.has_failing_grade)
    reasons.push("Failing grade is not allowed");
  return { status: reasons.length ? "non_compliant" : "compliant", reasons };
}
export function validateProgram(input) {
  if (!input.name?.trim() || input.name.trim().length > 100)
    throw new Error("Enter a scholarship name of up to 100 characters.");
  if (
    !Number.isFinite(Number(input.max_gwa)) ||
    Number(input.max_gwa) < 1 ||
    Number(input.max_gwa) > 5
  )
    throw new Error("Maximum GWA must be 1.00–5.00.");
  if (
    !Number.isInteger(Number(input.min_units)) ||
    Number(input.min_units) < 1 ||
    Number(input.min_units) > 40
  )
    throw new Error("Minimum units must be a whole number from 1 to 40.");
}
