# ScholarTrack · Scholarship Monitoring System

A responsive student laboratory project using HTML, CSS, JavaScript, Supabase, and GitHub Pages. No application server is needed in production.

## Run locally

Requires Node.js 20.19+ or 22.12+ (Node 24 recommended).

```sh
npm ci
npm run dev -- --port 5173
```

Open the printed URL, then choose **Open demo workspace**. Demo records are synthetic and saved in localStorage; demo login persists for the browser tab. The demo is a staff experience and does not connect its records to Supabase. Settings includes a reset option. Signing out allows real Supabase login.

```sh
npm test
npm run build
npm run preview -- --port 4173
```

## Connect your Supabase project

The app uses the supplied project URL and **publishable** key by default. These browser credentials are public by design. No service-role key or database password belongs in source code. Optional overrides are documented in `.env.example`; copy it to `.env.local` for local use.

1. Open your Supabase project's **SQL Editor** and run `supabase/schema.sql` once. It creates tables, constraints, RLS policies, account profiles, and the protected workflow function. All tables and functions use a `scholartrack_` prefix so the existing project tables remain intact. The script runs in a transaction and does not drop data or change permissions on unrelated tables. If you have already installed this schema, use migrations rather than running the initial script again.
2. In **Authentication → Users**, create an administrator account with a confirmed email and a strong password.
3. Promote that exact account through the SQL Editor (replace the example email):

   ```sql
   update public.scholartrack_profiles
   set role = 'admin', full_name = 'Scholarship Administrator'
   where id = (select id from auth.users where email = 'admin@your-university.edu');
   ```

4. Create coordinator accounts the same way and set `role = 'staff'`. All new Auth accounts get the `student` role. Users cannot change their own role through the app or REST API.
5. For a student portal, create the student's Auth account **before registering the scholar**, using the same email. Registration links the matching Auth identity. If you created the account later, an administrator can explicitly link it:

   ```sql
   update public.scholartrack_scholars s
   set user_id = u.id
   from auth.users u
   where lower(s.email) = lower(u.email)
     and s.student_id = '2026-1001'
     and s.user_id is null;
   ```

6. In the app, sign in, create scholarship programs, register scholars, and assign scholarships. The live database starts empty.

The supplied PostgreSQL connection string includes `[YOUR-PASSWORD]`, which is a placeholder. A publishable/anon key permits client operations subject to RLS; it cannot apply this schema or provision administrators. No hosted database schema changes are performed automatically by the app.

## Core workflow

1. **Login:** Supabase Auth email/password session; database profile determines access.
2. **Register Scholar:** staff enter student ID, full name, email, degree program, and year.
3. **Assign Scholarship:** staff select a scholar, scholarship, and term. One assignment per scholar per term. Requirements are copied into the assignment so later policy changes cannot alter historical decisions.
4. **Submit Grades:** staff can submit for scholars; students can submit only their own assigned records. Enter course codes, grades, and units. GWA and units are calculated independently in the browser and database.
5. **Verify Grades:** staff verify pending records or return them with required feedback. Only returned submissions can be edited and resubmitted; verified records are immutable through the app.
6. **Evaluate Compliance:** staff evaluate verified grades. GWA must be at or below the saved maximum; total enrolled units must meet the minimum; failing grades must meet the program's policy. All failure reasons are recorded. A term is evaluated once; noncompliance records a result without deleting the scholarship.
7. **Dashboard:** period filters, search, scholarship distribution, attention counts, recent activity, compliance tables, and CSV reports derive from visible records.

### Validation and laboratory assumptions

- Student ID: `YYYY-NNNN`, with 4–6 digits after the dash; globally unique.
- GWA scale: 1.00 best, 3.00 passing, above 3.00 failing, 5.00 worst.
- Weighted GWA: `sum(grade × units) / sum(units)`, rounded to two decimals before comparison. Course grades use numeric values; INC, dropped subjects, and pass/fail subjects need an institution-specific extension.
- Units: 1–12 per course, in half-unit increments; 1–15 courses per submission. Minimum scholarship units: whole numbers 1–40. Minimum load uses enrolled units, not earned units.
- Course codes must be nonempty and unique within a submission, ignoring case and surrounding spaces.
- Scholar statuses: active, inactive, graduated. New registrations are active; lifecycle changes are administrator-managed in this version.
- No full laboratory rubric was supplied. Uploading original grade documents, financial disbursement, self-registration, email notifications, appeals/reversal, and automatic renewal are outside the implemented workflow.

## Security model

Every application table has RLS. Anonymous users have no data access. Staff/admin can read operational records; student access is limited to their linked scholar, assignments, submissions, and evaluations (program definitions are readable by signed-in users). The client does not select its own role.

Authenticated clients have SELECT access only. All mutations use `scholartrack_action`, a narrowly granted security-definer function with an empty search path, explicit authentication/role checks, and qualified object names. It validates transitions, computes grades and compliance server-side, locks rows, and writes an activity record in the same transaction. Database constraints enforce IDs, uniqueness, ranges, and allowed statuses. User-supplied content is escaped before HTML rendering; exported CSV text is protected against formula injection.

The demo is not a security boundary. Changing its browser storage never affects live Supabase data.

## Deploy to GitHub Pages

1. Publish this project to the repository's `main` branch.
2. In **Settings → Pages → Build and deployment**, select **GitHub Actions**.
3. The included workflow tests and builds the application, then publishes `dist`. Builds use relative asset paths for `/scholarship-monitoring-system/` hosting.
4. Optional GitHub Actions variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`. Only use the public key.
5. Set the deployed URL as the Supabase Auth Site URL if using email invitations or future email redirect flows. Current login is password based.

## Structure

- `src/main.js`: navigation, accessible dialogs, forms, dashboard, reports.
- `src/style.css`: responsive interface and visual design.
- `src/data.js`: isolated demo adapter and Supabase queries/RPC.
- `src/domain.js`: pure grade calculations and client validation.
- `supabase/schema.sql`: authoritative persistence, permissions, validation, and compliance.
- `tests/`: domain and embedded PostgreSQL workflow/security regression tests.

To change institutional grading rules, update the database function and domain module together and extend the boundary tests. To add academic terms, update `TERMS` in `src/domain.js`; existing assignment terms also appear in report filters.
