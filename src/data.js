import { createClient } from "@supabase/supabase-js";
import {
  evaluateCompliance,
  summarizeGrades,
  validateProgram,
  validateScholar,
  TERMS,
} from "./domain.js";

const url =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://gfuloljzxqokmpnvupsr.supabase.co";
const key =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_0iLSYm5loorPaQaTpp2VTA_VnasAcLQ";
export const supabase = createClient(url, key);
const STORAGE_KEY = "scholartrack-demo-v1";
export const isDemo = () =>
  sessionStorage.getItem("scholartrack-mode") === "demo";
const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();
export function demoSeed() {
  const names = [
    "Isabella Reyes",
    "Gabriel Santos",
    "Sophia Mendoza",
    "Ethan Villanueva",
    "Olivia Cruz",
    "Lucas Garcia",
    "Amelia Torres",
    "Noah Ramos",
    "Mia Flores",
    "Liam Bautista",
    "Ava Castillo",
    "Elijah Navarro",
  ];
  const courses = [
    "BS Computer Science",
    "BS Information Technology",
    "BS Accountancy",
    "BS Civil Engineering",
  ];
  const programs = [
    {
      id: "p1",
      name: "Academic Excellence",
      description: "Supporting outstanding academic achievement.",
      max_gwa: 1.75,
      min_units: 18,
      allow_failing: false,
      status: "active",
      award: "Full tuition",
      color: "purple",
    },
    {
      id: "p2",
      name: "University Merit Grant",
      description: "Helping dedicated students reach their potential.",
      max_gwa: 2.25,
      min_units: 18,
      allow_failing: false,
      status: "active",
      award: "Partial tuition",
      color: "blue",
    },
    {
      id: "p3",
      name: "Community Scholars",
      description: "Opening doors through accessible education.",
      max_gwa: 2.5,
      min_units: 15,
      allow_failing: true,
      status: "active",
      award: "Financial assistance",
      color: "orange",
    },
  ];
  const scholars = names.map((name, i) => ({
    id: `s${i}`,
    student_id: `202${(i % 3) + 4}-${String(1001 + i)}`,
    full_name: name,
    email: `${name.toLowerCase().replace(" ", ".")}@example.edu`,
    course: courses[i % 4],
    year_level: (i % 4) + 1,
    status: "active",
    created_at: now(),
  }));
  const assignments = scholars.slice(0, 11).map((s, i) => ({
    id: `a${i}`,
    scholar_id: s.id,
    program_id: programs[i % 3].id,
    term: TERMS[0],
    max_gwa: programs[i % 3].max_gwa,
    min_units: programs[i % 3].min_units,
    allow_failing: programs[i % 3].allow_failing,
    created_at: now(),
  }));
  const submissions = assignments.slice(0, 9).map((a, i) => {
    const grade = [1.5, 1.75, 2, 2.25, 1.5, 2.25, 1.25, 1.75, 2][i];
    const courses = Array.from({ length: 6 }, (_, c) => ({
      code: `SUBJ ${c + 101}`,
      units: 3,
      grade,
    }));
    return {
      id: `g${i}`,
      assignment_id: a.id,
      courses,
      ...summarizeGrades(courses),
      status: i < 6 ? "verified" : "pending",
      feedback: "",
      created_at: now(),
    };
  });
  const evaluations = submissions.slice(0, 6).map((s, i) => ({
    id: `e${i}`,
    submission_id: s.id,
    ...evaluateCompliance(s, assignments[i]),
    created_at: now(),
  }));
  return {
    scholars,
    programs,
    assignments,
    submissions,
    evaluations,
    activity: [
      {
        id: "ev1",
        message: "Welcome to your scholarship workspace",
        created_at: now(),
      },
    ],
  };
}
export async function enterDemo() {
  await supabase.auth.signOut({ scope: "local" });
  sessionStorage.setItem("scholartrack-mode", "demo");
  if (!localStorage.getItem(STORAGE_KEY))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(demoSeed()));
}
export async function getUser() {
  if (isDemo())
    return {
      id: "demo",
      full_name: "Alex Morgan",
      role: "staff",
      email: "demo@example.edu",
    };
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error) throw error;
  if (!session) return null;
  const { data, error: profileError } = await supabase
    .from("scholartrack_profiles")
    .select("id, full_name, role")
    .eq("id", session.user.id)
    .single();
  if (profileError)
    throw new Error(
      "Your account profile is unavailable. Apply the Supabase schema and contact your administrator.",
    );
  return { ...data, email: session.user.email };
}
export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  sessionStorage.removeItem("scholartrack-mode");
}
export async function signOut() {
  if (!isDemo()) {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }
  sessionStorage.removeItem("scholartrack-mode");
}
export async function loadData() {
  if (isDemo()) return JSON.parse(localStorage.getItem(STORAGE_KEY));
  const names = [
    "scholars",
    "programs",
    "assignments",
    "submissions",
    "evaluations",
    "activity",
  ];
  const results = await Promise.all(
    names.map(async (name) => {
      const records = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await supabase
          .from(`scholartrack_${name}`)
          .select("*")
          .order("created_at", { ascending: false })
          .order("id")
          .range(offset, offset + 499);
        if (error)
          throw new Error(
            `${error.message}. Check the database setup and account permissions.`,
          );
        records.push(...data);
        if (data.length < 500) return records;
      }
    }),
  );
  return Object.fromEntries(names.map((name, i) => [name, results[i]]));
}
export async function mutate(action, input) {
  if (action === "register_scholar") validateScholar(input);
  if (action === "create_program") validateProgram(input);
  if (action === "submit_grades") summarizeGrades(input.courses);
  if (!isDemo()) {
    const { data, error } = await supabase.rpc("scholartrack_action", {
      p_action: action,
      p_data: input,
    });
    if (error) throw new Error(error.message);
    return data;
  }
  const db = await loadData();
  let message = "";
  if (action === "register_scholar") {
    if (
      db.scholars.some(
        (s) =>
          s.student_id === input.student_id ||
          s.email.toLowerCase() === input.email.toLowerCase(),
      )
    )
      throw new Error(
        "A scholar with this Student ID or email already exists.",
      );
    db.scholars.unshift({
      ...input,
      id: id(),
      status: "active",
      created_at: now(),
    });
    message = `Registered ${input.full_name}`;
  } else if (action === "create_program") {
    if (
      db.programs.some((p) => p.name.toLowerCase() === input.name.toLowerCase())
    )
      throw new Error("This scholarship name already exists.");
    db.programs.push({
      ...input,
      id: id(),
      status: "active",
      created_at: now(),
    });
    message = `Created ${input.name}`;
  } else if (action === "assign_scholarship") {
    const scholar = db.scholars.find((s) => s.id === input.scholar_id);
    const program = db.programs.find((p) => p.id === input.program_id);
    if (
      !scholar ||
      scholar.status !== "active" ||
      !program ||
      program.status !== "active"
    )
      throw new Error("Choose an active scholar and scholarship.");
    if (
      db.assignments.some(
        (a) => a.scholar_id === input.scholar_id && a.term === input.term,
      )
    )
      throw new Error("This scholar already has a scholarship for that term.");
    db.assignments.unshift({
      ...input,
      id: id(),
      max_gwa: program.max_gwa,
      min_units: program.min_units,
      allow_failing: program.allow_failing,
      created_at: now(),
    });
    message = `Assigned ${program.name} to ${scholar.full_name}`;
  } else if (action === "submit_grades") {
    if (!db.assignments.some((a) => a.id === input.assignment_id))
      throw new Error("Select a scholarship assignment.");
    const old = db.submissions.find(
      (s) => s.assignment_id === input.assignment_id,
    );
    if (old && old.status !== "rejected")
      throw new Error(
        "Grades are already submitted. Only returned submissions can be resubmitted.",
      );
    const record = {
      ...input,
      ...summarizeGrades(input.courses),
      status: "pending",
      feedback: "",
      created_at: now(),
    };
    if (old) Object.assign(old, record);
    else db.submissions.unshift({ ...record, id: id() });
    message = "Submitted grades for verification";
  } else if (action === "verify_grades") {
    const sub = db.submissions.find((s) => s.id === input.submission_id);
    if (!sub || sub.status !== "pending")
      throw new Error("Only pending grades can be reviewed.");
    if (!["verified", "rejected"].includes(input.status))
      throw new Error("Invalid verification decision.");
    if (input.status === "rejected" && !input.feedback?.trim())
      throw new Error("Explain what the scholar needs to correct.");
    Object.assign(sub, { status: input.status, feedback: input.feedback });
    message =
      input.status === "verified"
        ? "Verified academic grades"
        : "Returned grades for correction";
  } else if (action === "evaluate_compliance") {
    const sub = db.submissions.find((s) => s.id === input.submission_id);
    if (!sub) throw new Error("Submission not found.");
    const policy = db.assignments.find((a) => a.id === sub.assignment_id);
    if (db.evaluations.some((e) => e.submission_id === sub.id))
      throw new Error("This submission has already been evaluated.");
    const result = evaluateCompliance(sub, policy);
    db.evaluations.unshift({
      id: id(),
      submission_id: sub.id,
      ...result,
      created_at: now(),
    });
    message = `Evaluated compliance: ${result.status.replaceAll("_", " ")}`;
  } else throw new Error("Unknown action.");
  db.activity.unshift({ id: id(), message, created_at: now() });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}
export function resetDemo() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(demoSeed()));
}
