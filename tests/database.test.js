import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const staff = "00000000-0000-0000-0000-000000000001";
const student = "00000000-0000-0000-0000-000000000002";
const other = "00000000-0000-0000-0000-000000000003";
test("PostgreSQL workflow, validation, role checks, and RLS isolation", async (t) => {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth;
 create table public.scholars(id text); create table public.profiles(id text); grant select on public.scholars to anon;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth,public to authenticated,anon;
 grant execute on function auth.uid() to authenticated,anon;`);
  await db.exec(
    await readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8"),
  );
  await db.query(
    "insert into auth.users(id,email) values ($1,'staff@example.edu'),($2,'student@example.edu'),($3,'other@example.edu')",
    [staff, student, other],
  );
  await db.query(
    "update public.scholartrack_profiles set role='staff' where id=$1",
    [staff],
  );
  async function as(who, role = "authenticated") {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      who,
    ]);
    await db.exec(`set role ${role}`);
  }
  const action = (name, data) =>
    db.query("select public.scholartrack_action($1,$2::jsonb)", [
      name,
      JSON.stringify(data),
    ]);
  const select = async (table) =>
    (await db.query(`select * from public.scholartrack_${table}`)).rows;
  await as(staff);
  let scholar, program, assignment, submission;
  await t.test(
    "staff register, create program, and assign with saved requirements",
    async () => {
      await action("register_scholar", {
        student_id: "2026-1001",
        full_name: "Sample Scholar",
        email: "student@example.edu",
        course: "BS Computer Science",
        year_level: 1,
      });
      scholar = (await select("scholars"))[0];
      assert.equal(scholar.user_id, student);
      await action("create_program", {
        name: "Merit",
        max_gwa: 1.75,
        min_units: 18,
        allow_failing: false,
      });
      program = (await select("programs"))[0];
      await action("assign_scholarship", {
        scholar_id: scholar.id,
        program_id: program.id,
        term: "1st Semester 2026–2027",
      });
      assignment = (await select("assignments"))[0];
      assert.equal(Number(assignment.max_gwa), 1.75);
      await assert.rejects(
        action("assign_scholarship", {
          scholar_id: scholar.id,
          program_id: program.id,
          term: assignment.term,
        }),
        /unique/,
      );
    },
  );
  await t.test(
    "database rejects duplicate and malformed scholar records",
    async () => {
      await assert.rejects(
        action("register_scholar", {
          student_id: "not-valid",
          full_name: "X",
          email: "x@example.edu",
          course: "BS CS",
          year_level: 1,
        }),
        /check constraint/,
      );
      await assert.rejects(
        action("register_scholar", {
          student_id: "2026-1001",
          full_name: "X",
          email: "x@example.edu",
          course: "BS CS",
          year_level: 1,
        }),
        /unique/,
      );
    },
  );
  await t.test(
    "student cannot escalate role, administer scholarships, or read another scholar",
    async () => {
      await as(other);
      assert.equal((await select("scholars")).length, 0);
      assert.equal((await select("assignments")).length, 0);
      await assert.rejects(
        db.query(
          "update public.scholartrack_profiles set role='admin' where id=$1",
          [other],
        ),
        /permission denied/,
      );
      await assert.rejects(
        action("create_program", {
          name: "Fake",
          max_gwa: 5,
          min_units: 1,
          allow_failing: true,
        }),
        /Staff access/,
      );
      await assert.rejects(
        action("submit_grades", {
          assignment_id: assignment.id,
          courses: [{ code: "CS", units: 3, grade: 1 }],
        }),
        /only your own/,
      );
    },
  );
  await t.test(
    "server validates courses and ignores forged GWA and units",
    async () => {
      await as(student);
      assert.equal((await select("scholars")).length, 1);
      for (const courses of [
        [],
        [{ code: "CS", units: 3, grade: 0 }],
        [{ code: "CS", units: 0, grade: 1 }],
        [{ code: "CS", units: 3.25, grade: 1 }],
        [
          { code: "CS", units: 3, grade: 1 },
          { code: " cs ", units: 3, grade: 2 },
        ],
      ])
        await assert.rejects(
          action("submit_grades", { assignment_id: assignment.id, courses }),
        );
      const courses = Array.from({ length: 6 }, (_, i) => ({
        code: `CS${i}`,
        units: 3,
        grade: 1.75,
      }));
      await action("submit_grades", {
        assignment_id: assignment.id,
        courses,
        gwa: 1,
        units: 100,
        status: "verified",
      });
      submission = (await select("submissions"))[0];
      assert.equal(Number(submission.gwa), 1.75);
      assert.equal(Number(submission.units), 18);
      assert.equal(submission.status, "pending");
      await assert.rejects(
        action("verify_grades", {
          submission_id: submission.id,
          status: "verified",
        }),
        /Staff access/,
      );
      await assert.rejects(
        action("submit_grades", { assignment_id: assignment.id, courses }),
        /Only returned/,
      );
    },
  );
  await t.test(
    "verification is required; returning requires feedback and supports resubmission",
    async () => {
      await as(staff);
      await assert.rejects(
        action("evaluate_compliance", { submission_id: submission.id }),
        /Verify grades/,
      );
      await assert.rejects(
        action("verify_grades", {
          submission_id: submission.id,
          status: "bad",
        }),
        /Invalid decision/,
      );
      await assert.rejects(
        action("verify_grades", {
          submission_id: submission.id,
          status: "rejected",
          feedback: " ",
        }),
        /Feedback/,
      );
      await action("verify_grades", {
        submission_id: submission.id,
        status: "rejected",
        feedback: "Please correct the record.",
      });
      await as(student);
      await action("submit_grades", {
        assignment_id: assignment.id,
        courses: Array.from({ length: 6 }, (_, i) => ({
          code: `CS${i}`,
          units: 3,
          grade: 1.75,
        })),
      });
      assert.equal((await select("submissions"))[0].feedback, "");
      await as(staff);
      await action("verify_grades", {
        submission_id: submission.id,
        status: "verified",
      });
      await action("evaluate_compliance", { submission_id: submission.id });
      assert.equal((await select("evaluations"))[0].status, "compliant");
      await assert.rejects(
        action("evaluate_compliance", { submission_id: submission.id }),
        /unique/,
      );
    },
  );
  await t.test(
    "compliance uses the assignment snapshot and records every failure",
    async () => {
      await action("assign_scholarship", {
        scholar_id: scholar.id,
        program_id: program.id,
        term: "2nd Semester 2026–2027",
      });
      const second = (await select("assignments")).find(
        (a) => a.id !== assignment.id,
      );
      await db.exec("reset role");
      await db.query(
        "update public.scholartrack_programs set max_gwa=5,min_units=1,allow_failing=true where id=$1",
        [program.id],
      );
      await as(staff);
      await action("submit_grades", {
        assignment_id: second.id,
        courses: [{ code: "CS", units: 3, grade: 5 }],
      });
      const secondSub = (await select("submissions")).find(
        (s) => s.assignment_id === second.id,
      );
      await action("verify_grades", {
        submission_id: secondSub.id,
        status: "verified",
      });
      await action("evaluate_compliance", { submission_id: secondSub.id });
      const result = (await select("evaluations")).find(
        (e) => e.submission_id === secondSub.id,
      );
      assert.equal(result.status, "non_compliant");
      assert.equal(result.reasons.length, 3);
    },
  );
  await t.test(
    "other students cannot read grades/evaluations and anonymous access is denied",
    async () => {
      await as(other);
      assert.equal((await select("submissions")).length, 0);
      assert.equal((await select("evaluations")).length, 0);
      await as(student);
      assert.equal((await select("evaluations")).length, 2);
      await as("", "anon");
      await assert.rejects(select("scholars"), /permission denied/);
      await assert.rejects(action("submit_grades", {}), /permission denied/);
    },
  );
  await t.test(
    "installation preserves preexisting tables and grants",
    async () => {
      await as("", "anon");
      assert.deepEqual(
        (await db.query("select * from public.scholars")).rows,
        [],
      );
    },
  );
  await db.close();
});
