import "./style.css";
import {
  createIcons,
  GraduationCap,
  LayoutDashboard,
  Users,
  Award,
  BookOpen,
  ShieldCheck,
  BarChart3,
  Settings,
  LogOut,
  Search,
  Bell,
  ChevronDown,
  ChevronRight,
  ArrowUpRight,
  ArrowRight,
  Plus,
  X,
  Check,
  Clock,
  AlertCircle,
  Download,
  Filter,
  Mail,
  Menu,
  CheckCircle2,
  FileText,
  RefreshCw,
  ArrowLeft,
  Eye,
  CircleHelp,
} from "lucide";
import { TERMS, summarizeGrades } from "./domain.js";
import {
  getUser,
  signIn,
  signOut,
  enterDemo,
  isDemo,
  loadData,
  mutate,
  resetDemo,
  supabase,
} from "./data.js";
const icons = {
  GraduationCap,
  LayoutDashboard,
  Users,
  Award,
  BookOpen,
  ShieldCheck,
  BarChart3,
  Settings,
  LogOut,
  Search,
  Bell,
  ChevronDown,
  ChevronRight,
  ArrowUpRight,
  ArrowRight,
  Plus,
  X,
  Check,
  Clock,
  AlertCircle,
  Download,
  Filter,
  Mail,
  Menu,
  CheckCircle2,
  FileText,
  RefreshCw,
  ArrowLeft,
  Eye,
  CircleHelp,
};
const app = document.querySelector("#app");
let user,
  db,
  page = "dashboard",
  search = "",
  statusFilter = "all",
  term = TERMS[0],
  busy = false,
  modalOpener;
const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const ic = (name, cls = "") => `<i data-lucide="${name}" class="${cls}"></i>`;
const initials = (name) =>
  name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");
const iconize = () => createIcons({ icons });
const staff = () => ["staff", "admin"].includes(user?.role);
const moneyDate = (date) =>
  new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
const labels = {
  active: "Active",
  inactive: "Inactive",
  graduated: "Graduated",
  pending: "Pending Submission",
  verified: "Verified",
  rejected: "Returned",
  compliant: "Compliant",
  non_compliant: "With Deficiency",
  unassigned: "Not assigned",
  not_submitted: "Not submitted",
  awaiting_evaluation: "Pending Evaluation",
};
const badge = (status) =>
  `<span class="badge ${escape(status)}"><span></span>${escape(labels[status] || status)}</span>`;
const empty = (title, description) =>
  `<div class="empty">${ic("FileText")}<h3>${escape(title)}</h3><p>${escape(description)}</p></div>`;
function toast(message, error = false) {
  const el = document.querySelector("#toast");
  el.textContent = message;
  el.className = `show ${error ? "error" : ""}`;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => {
    el.className = "";
  }, 5000);
}
function relation(a) {
  const scholar = db.scholars.find((s) => s.id === a.scholar_id);
  const program = db.programs.find((p) => p.id === a.program_id);
  const sub = db.submissions.find((s) => s.assignment_id === a.id);
  const evaluation =
    sub && db.evaluations.find((e) => e.submission_id === sub.id);
  return {
    a,
    scholar,
    program,
    sub,
    evaluation,
    status:
      evaluation?.status ||
      (sub?.status === "verified" ? "awaiting_evaluation" : sub?.status) ||
      "not_submitted",
  };
}
const rows = () => db.assignments.filter((a) => a.term === term).map(relation);
function scholarRows() {
  return db.scholars.map((s) => {
    const a = db.assignments.find(
      (a) => a.scholar_id === s.id && a.term === term,
    );
    return a ? relation(a) : { scholar: s, status: "unassigned" };
  });
}
function matching(items) {
  return items.filter(
    (r) =>
      `${r.scholar?.full_name} ${r.scholar?.student_id} ${r.program?.name}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (statusFilter === "all" || r.status === statusFilter),
  );
}
function avatar(name, index = 0) {
  return `<span class="avatar avatar-${index % 5}">${escape(initials(name))}</span>`;
}
function person(s, index) {
  return `<div class="person">${avatar(s.full_name, index)}<div><strong>${escape(s.full_name)}</strong><small>${escape(s.student_id)}</small></div></div>`;
}
function renderLogin() {
  app.innerHTML = `<main class="login-layout"><section class="login-story"><a class="brand" href="#">${ic("GraduationCap")}<span>Scholar<span class="brand-light">Track</span></span></a><div><span class="eyebrow">EVERY SCHOLAR. EVERY POSSIBILITY.</span><h1>Bright futures.<br>Thoughtfully supported.</h1><p>From the first application to the next achievement.<br>A clearer way to manage your scholarship community.</p><div class="login-illustration"><div class="illustration-orbit"></div>${ic("GraduationCap")}<span class="floating-note">${ic("ShieldCheck")} Potential, supported.</span></div></div><small>Scholarship Monitoring System · Academic workspace</small></section><section class="login-panel"><div class="login-form"><span class="tiny-label">WELCOME TO SCHOLARTRACK</span><h2>Your next chapter<br>starts here.</h2><p>Sign in to your scholarship workspace.</p><form id="login-form"><label>Email address<input name="email" type="email" placeholder="you@university.edu" autocomplete="username" required></label><label>Password<input name="password" type="password" placeholder="Enter your password" autocomplete="current-password" required></label><p class="form-error" role="alert"></p><button class="button primary full" type="submit">Sign in ${ic("ArrowRight")}</button></form><div class="divider"><span>or explore the experience</span></div><button class="button full" data-action="demo">Open demo workspace ${ic("ArrowUpRight")}</button><p class="login-hint">Demo uses sample data saved only in this browser.<br>For a live account, contact your administrator.</p><div class="secure-note">${ic("ShieldCheck")} Secure authentication powered by Supabase</div></div></section></main>`;
  iconize();
}
const nav = [
  ["dashboard", "LayoutDashboard", "Overview"],
  ["scholars", "Users", "Scholars"],
  ["scholarships", "Award", "Scholarships"],
  ["grades", "BookOpen", "Grade submissions"],
  ["compliance", "ShieldCheck", "Compliance"],
  ["reports", "BarChart3", "Reports"],
];
function render() {
  if (!user || !db) return;
  const pending = rows().filter((r) => r.sub?.status === "pending").length;
  const titles = {
    dashboard: "Workspace overview",
    scholars: "Scholar directory",
    scholarships: "Scholarship programs",
    grades: "Academic records",
    compliance: "Compliance monitoring",
    reports: "Reports & insights",
    settings: "Workspace settings",
  };
  const terms = [...new Set([...TERMS, ...db.assignments.map((a) => a.term)])];
  app.innerHTML = `<div class="workspace"><aside class="sidebar"><a class="brand" href="#dashboard">${ic("GraduationCap")}<span>Scholar<span class="brand-light">Track</span></span></a><div class="workspace-switch"><div class="workspace-logo">U</div><div><strong>University workspace</strong><small>Scholarship management</small></div><span class="live-dot"></span></div><span class="nav-caption">WORKSPACE</span><nav aria-label="Main navigation">${nav.map(([id, icon, label]) => `<a href="#${id}" class="nav-item ${page === id ? "selected" : ""}" ${page === id ? 'aria-current="page"' : ""}>${ic(icon)}<span>${label}</span>${id === "grades" && pending ? `<b class="nav-count">${pending}</b>` : ""}</a>`).join("")}</nav><div class="sidebar-bottom"><div class="support-card"><span class="support-icon">${ic("GraduationCap")}</span><strong>Empowering potential.</strong><p>A little support today.<br>A brighter future tomorrow.</p><button data-action="guide">Your workflow guide ${ic("ArrowRight")}</button></div><a class="nav-item ${page === "settings" ? "selected" : ""}" href="#settings">${ic("Settings")}<span>Settings & setup</span></a><button class="nav-item logout" data-action="logout">${ic("LogOut")}<span>Sign out</span></button><div class="sidebar-footer"><span class="live-dot"></span> ${isDemo() ? "Demo workspace" : "Connected to Supabase"}<span>v1.0</span></div></div></aside><div class="main-shell"><header class="topbar"><div class="breadcrumb"><button class="icon-button mobile-menu" data-action="menu" aria-label="Toggle navigation">${ic("Menu")}</button><span>Workspace</span>${ic("ChevronRight")}<strong>${titles[page]}</strong></div><div class="topbar-right"><span class="academic-year">AY 2026–2027</span><button class="icon-button notification-button" data-action="activity" aria-label="View activity">${ic("Bell")}<span></span></button><div class="user-menu">${avatar(user.full_name || "Scholar User")}<div><strong>${escape(user.full_name || "Scholar User")}</strong><small>${staff() ? "Scholarship " + (user.role === "admin" ? "Administrator" : "Coordinator") : "Student scholar"}</small></div></div></div></header>${isDemo() ? `<div class="demo-banner"><span><b>Demo workspace</b> · Sample records, stored in your browser.</span><button data-action="logout">Connect your account ${ic("ArrowRight")}</button></div>` : ""}<main class="content" id="main-content"><div class="page-heading"><div><div class="section-kicker">${page === "dashboard" ? "YOUR SCHOLARSHIP WORKSPACE" : "SCHOLARTRACK / " + page.toUpperCase()}</div><h1>${page === "dashboard" ? `A brighter future starts here<span class="heading-dot">.</span>` : { scholars: "Your scholars", scholarships: "Opportunities that matter", grades: "Every achievement, recorded", compliance: "Keep progress on track", reports: "The bigger picture", settings: "Make yourself at home" }[page]}</h1><p>${{ dashboard: "A little clarity for the big work of supporting your scholars.", scholars: "Manage your scholar community, one bright future at a time.", scholarships: "Clear requirements. Meaningful support. More possibilities.", grades: "Submit, review, and verify academic performance.", compliance: "Turn verified academic records into clear scholarship decisions.", reports: "Understand academic performance and scholarship outcomes.", settings: "Your account, connection, and workspace essentials." }[page]}</p></div>${page === "dashboard" || page === "scholars" ? (staff() ? `<button class="button primary" data-action="register">${ic("Plus")} Register scholar</button>` : "") : page === "scholarships" && staff() ? `<button class="button primary" data-action="program">${ic("Plus")} Add scholarship</button>` : page === "grades" ? `<button class="button primary" data-action="submit">${ic("Plus")} Submit grades</button>` : page === "reports" ? `<button class="button primary" data-action="export">${ic("Download")} Export CSV</button>` : ""}</div>${!["settings", "scholarships"].includes(page) ? `<div class="period-row"><span class="period-label">${ic("BookOpen")} Academic period</span><label class="sr-only" for="term-select">Academic period</label><select id="term-select">${terms.map((t) => `<option ${t === term ? "selected" : ""}>${escape(t)}</option>`).join("")}</select><span class="period-active"><span></span> ${term === TERMS[0] ? "Current semester" : "Previous semester"}</span><span class="period-right">${ic("RefreshCw")} ${isDemo() ? "Local demo data" : "Live workspace data"}</span></div>` : ""}${{ dashboard: dashboard, scholars: scholarsPage, scholarships: programsPage, grades: gradesPage, compliance: compliancePage, reports: reportsPage, settings: settingsPage }[page]()}<footer class="content-footer"><span>Supporting scholars. Shaping futures.</span><span>ScholarTrack <span>·</span> Scholarship Monitoring System</span></footer></main></div></div>`;
  iconize();
}
function stat(icon, cls, title, value, foot) {
  return `<article class="stat-card"><div class="stat-top"><span>${title}</span><span class="stat-icon ${cls}">${ic(icon)}</span></div><div class="stat-value">${value}</div><div class="stat-foot">${foot}</div></article>`;
}
function stats() {
  const rs = rows(),
    compliant = rs.filter((r) => r.status === "compliant").length,
    issues = rs.filter((r) => r.status === "non_compliant").length;
  return `<div class="stats-grid">${stat("Users", "purple", "Registered scholars", db.scholars.length, `<span class="stat-highlight">${db.scholars.filter((s) => s.status === "active").length} active</span><span>in your community</span>`)}${stat("Award", "blue", "Scholarships assigned", rs.length, `<span class="stat-highlight blue-text">${db.programs.filter((p) => p.status === "active").length} programs</span><span>supporting scholars</span>`)}${stat("ShieldCheck", "green", "Compliant scholars", compliant, `<span class="stat-highlight green-text">${rs.length ? Math.round((compliant / rs.length) * 100) : 0}% of assigned</span><span>meeting requirements</span>`)}${stat("Clock", "orange", "Needs attention", rs.filter((r) => !r.evaluation || r.status === "non_compliant").length, `<span class="stat-highlight orange-text">${issues} non-compliant</span><span>follow-up needed</span>`)}</div>`;
}
function dashboard() {
  const rs = rows(),
    pending = rs.filter((r) => r.sub?.status === "pending").length,
    ready = rs.filter((r) => r.status === "awaiting_evaluation").length;
  return `${stats()}<div class="dashboard-middle"><section class="panel distribution"><div class="panel-heading"><div><h2>Scholarship distribution</h2><p>A home for every kind of potential.</p></div><a href="#scholarships" class="subtle-link">View programs ${ic("ArrowUpRight")}</a></div><div class="distribution-body"><div class="donut" style="background:${donutGradient()}"><div><strong>${rs.length}</strong><span>assigned scholars</span></div></div><div class="chart-legend">${db.programs
    .slice(0, 4)
    .map(
      (p, i) =>
        `<div><span class="legend-dot color-${i % 4}"></span><span>${escape(p.name)}</span><strong>${rs.filter((r) => r.program?.id === p.id).length}</strong><small>${rs.length ? Math.round((rs.filter((r) => r.program?.id === p.id).length / rs.length) * 100) : 0}%</small></div>`,
    )
    .join(
      "",
    )}${!db.programs.length ? "<p>No programs yet. Add your first scholarship to get started.</p>" : ""}${db.programs.length > 4 ? "<small>Additional programs are included in the chart.</small>" : ""}</div></div></section><section class="panel attention"><div class="panel-heading"><div><h2>A little attention goes a long way</h2><p>Your next steps, all in one place.</p></div><span class="attention-spark">${ic("CheckCircle2")}</span></div><a href="#grades" class="action-row"><span class="action-icon orange">${ic("BookOpen")}</span><div><strong>${pending} grade submission${pending === 1 ? "" : "s"} to review</strong><small>Help scholars move forward</small></div>${ic("ChevronRight")}</a><a href="#compliance" class="action-row"><span class="action-icon purple">${ic("ShieldCheck")}</span><div><strong>${ready} ready for evaluation</strong><small>Verified grades, waiting for a decision</small></div>${ic("ChevronRight")}</a><div class="attention-note">${ic("CircleHelp")} Small steps today. Lasting impact tomorrow.</div></section></div><section class="panel"><div class="panel-heading"><div><h2>Your scholar community <span class="count-pill">${db.scholars.length}</span></h2><p>A snapshot of progress this semester.</p></div><a href="#scholars" class="subtle-link">View all scholars ${ic("ArrowRight")}</a></div>${scholarTable(scholarRows().slice(0, 5))}<div class="table-footer"><span>Showing ${Math.min(5, db.scholars.length)} of ${db.scholars.length} scholars</span><span class="table-footer-note"><span class="live-dot"></span> Every scholar counts.</span></div></section><div class="bottom-grid"><section class="panel recent-panel"><div class="panel-heading"><h2>Recent activity</h2><button class="subtle-link" data-action="activity">View activity ${ic("ArrowRight")}</button></div>${activityList(3)}</section><section class="inspiration"><span class="eyebrow">BEHIND EVERY NUMBER, A FUTURE.</span><h2>More than a scholarship.<br>A step toward possibility.</h2><p>Thank you for helping your scholars thrive.</p>${ic("GraduationCap")}</section></div>`;
}
function donutGradient() {
  const rs = rows();
  if (!rs.length) return "#eeedf4";
  let start = 0;
  const colors = ["#7b68d9", "#91b8e7", "#f0bd81", "#99cbb9"];
  return `conic-gradient(${db.programs
    .map((p, i) => {
      const end =
        start +
        (rs.filter((r) => r.program?.id === p.id).length / rs.length) * 100;
      const stop = `${colors[i % 4]} ${start}% ${end}%`;
      start = end;
      return stop;
    })
    .join(",")})`;
}
function filters(options) {
  return `<div class="table-toolbar"><div class="search-input">${ic("Search")}<input id="search" aria-label="Search scholars" placeholder="Search by name, student ID, or scholarship..." value="${escape(search)}"></div><div class="filter-control">${ic("Filter")}<select id="status-filter" aria-label="Filter by status"><option value="all">All statuses</option>${options.map((s) => `<option value="${s}" ${statusFilter === s ? "selected" : ""}>${labels[s]}</option>`).join("")}</select></div></div>`;
}
function scholarTable(items) {
  return items.length
    ? `<div class="table-scroll"><table><thead><tr><th>Scholar</th><th>Degree program</th><th>Scholarship</th><th>GWA</th><th>Compliance status</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>${items.map((r, i) => `<tr><td>${person(r.scholar, i)}</td><td><span class="course-text">${escape(r.scholar.course)}</span><small class="cell-small">Year ${escape(r.scholar.year_level)}</small></td><td>${r.program ? `<span class="program-label"><span class="program-dot color-${db.programs.findIndex((p) => p.id === r.program.id) % 4}"></span>${escape(r.program.name)}</span>` : '<span class="muted">Not assigned</span>'}</td><td class="gwa">${r.sub ? Number(r.sub.gwa).toFixed(2) : "—"}</td><td>${badge(r.status)}</td><td><button class="icon-button" data-action="detail" data-id="${escape(r.scholar.id)}" aria-label="View ${escape(r.scholar.full_name)}">${ic("ArrowUpRight")}</button></td></tr>`).join("")}</tbody></table></div>`
    : empty(
        "No scholars to show",
        "Register a scholar or adjust your search and filters.",
      );
}
function scholarsPage() {
  return `<section class="panel"><div class="panel-heading"><div><h2>Scholar directory <span class="count-pill">${db.scholars.length}</span></h2><p>Scholarship assignments and academic standing for the selected period.</p></div>${staff() ? `<button class="button" data-action="assign">${ic("Award")} Assign scholarship</button>` : ""}</div>${filters(["compliant", "non_compliant", "pending", "verified", "awaiting_evaluation", "rejected", "not_submitted", "unassigned"])}<div id="filtered-content">${scholarTable(matching(scholarRows()))}</div></section>`;
}
function programsPage() {
  return `<div class="programs-grid">${db.programs.map((p, i) => `<article class="panel program-card"><div class="program-card-top"><span class="large-icon color-bg-${i % 3}">${ic("Award")}</span>${badge(p.status)}</div><h2>${escape(p.name)}</h2><p>${escape(p.description || "Scholarship support for your academic journey.")}</p><span class="award-type">${ic("GraduationCap")}${escape(p.award)}</span><div class="requirements"><div><span>Maximum GWA</span><strong>${Number(p.max_gwa).toFixed(2)}</strong></div><div><span>Minimum units</span><strong>${p.min_units} units</strong></div><div><span>Failing grades</span><strong>${p.allow_failing ? "Allowed" : "Not allowed"}</strong></div></div><div class="program-card-bottom"><span>${db.assignments.filter((a) => a.program_id === p.id).length} total assignments</span>${staff() ? `<button class="subtle-link" data-action="assign" data-id="${escape(p.id)}">Assign scholar ${ic("ArrowRight")}</button>` : ""}</div></article>`).join("") || empty("Your first opportunity starts here", "Create a scholarship and define its academic requirements.")}</div><div class="info-callout">${ic("ShieldCheck")}<div><strong>Clear rules from the start</strong><p>Requirements are saved with each assignment. GWA uses a 1.00–5.00 scale; lower is better. Grades above 3.00 count as failing.</p></div></div>`;
}
function gradeTable(items) {
  return items.length
    ? `<div class="table-scroll"><table><thead><tr><th>Scholar</th><th>Scholarship</th><th>GWA / Units</th><th>Verification</th><th>Action</th></tr></thead><tbody>${items.map((r, i) => `<tr><td>${person(r.scholar, i)}</td><td>${escape(r.program.name)}</td><td><strong>${r.sub ? Number(r.sub.gwa).toFixed(2) : "—"}</strong><small class="cell-small">${r.sub ? r.sub.units + " units" : "No grades yet"}</small></td><td>${badge(r.sub?.status || "not_submitted")}</td><td>${r.sub ? `<button class="button small" data-action="review" data-id="${escape(r.sub.id)}">${staff() && r.sub.status === "pending" ? "Review grades" : "View grades"}</button>` : `<button class="button small" data-action="submit" data-id="${escape(r.a.id)}">Submit grades</button>`}</td></tr>`).join("")}</tbody></table></div>`
    : empty(
        "No submissions here yet",
        "Assign a scholarship for this period to start tracking grades.",
      );
}
function gradesPage() {
  return `<section class="panel"><div class="panel-heading"><div><h2>Grade submissions <span class="count-pill">${rows().filter((r) => r.sub).length}</span></h2><p>Only verified grades can be used for compliance evaluation.</p></div></div>${filters(["pending", "verified", "rejected", "not_submitted"])}<div id="filtered-content">${gradeTable(matching(rows().map((r) => ({ ...r, status: r.sub?.status || "not_submitted" }))))}</div></section>`;
}
function complianceTable(items) {
  return items.length
    ? `<div class="table-scroll"><table><thead><tr><th>Scholar</th><th>Academic requirements</th><th>Result</th><th>Details</th><th>Action</th></tr></thead><tbody>${items.map((r, i) => `<tr><td>${person(r.scholar, i)}</td><td>GWA ≤ ${Number(r.a.max_gwa).toFixed(2)}<small class="cell-small">${r.a.min_units}+ units · ${r.a.allow_failing ? "Failing grades allowed" : "No failing grades"}</small></td><td>${badge(r.status)}</td><td class="reason-cell">${r.evaluation ? (r.evaluation.reasons.length ? escape(r.evaluation.reasons.join("; ")) : "All requirements met") : r.sub?.status === "verified" ? "Ready to evaluate" : "Waiting for verified grades"}</td><td>${staff() && r.status === "awaiting_evaluation" ? `<button class="button small primary" data-action="evaluate" data-id="${escape(r.sub.id)}">Evaluate</button>` : `<button class="icon-button" data-action="detail" data-id="${escape(r.scholar.id)}" aria-label="View scholar">${ic("ArrowUpRight")}</button>`}</td></tr>`).join("")}</tbody></table></div>`
    : empty(
        "No compliance records",
        "Assigned scholars will appear here for the selected period.",
      );
}
function compliancePage() {
  return `${stats()}<section class="panel"><div class="panel-heading"><div><h2>Compliance tracker</h2><p>Each decision is based on the requirements saved at assignment.</p></div></div>${filters(["compliant", "non_compliant", "awaiting_evaluation", "pending", "rejected", "not_submitted"])}<div id="filtered-content">${complianceTable(matching(rows()))}</div></section>`;
}
function reportsPage() {
  const rs = rows(),
    evaluated = rs.filter((r) => r.evaluation),
    pass = evaluated.filter((r) => r.status === "compliant").length;
  return `${stats()}<div class="reports-grid"><section class="panel report-panel"><h2>Compliance by program</h2><p class="muted">Evaluated scholars meeting their requirements.</p>${db.programs
    .map((p, i) => {
      const group = evaluated.filter((r) => r.program.id === p.id),
        count = group.filter((r) => r.status === "compliant").length;
      return `<div class="bar-group"><div><span>${escape(p.name)}</span><strong>${count} / ${group.length}</strong></div><div class="bar-track"><span class="color-${i % 4}" style="width:${group.length ? (count / group.length) * 100 : 0}%"></span></div></div>`;
    })
    .join(
      "",
    )}</section><section class="panel report-panel"><h2>Semester summary</h2><dl class="summary-list"><div><dt>Selected period</dt><dd>${escape(term)}</dd></div><div><dt>Evaluations completed</dt><dd>${evaluated.length}</dd></div><div><dt>Compliance rate among evaluated</dt><dd>${evaluated.length ? Math.round((pass / evaluated.length) * 100) + "%" : "—"}</dd></div><div><dt>Missing submissions</dt><dd>${rs.filter((r) => !r.sub).length}</dd></div><div><dt>Pending verification</dt><dd>${rs.filter((r) => r.sub?.status === "pending").length}</dd></div></dl><button class="button full" data-action="export">${ic("Download")} Download semester report</button></section></div>`;
}
function settingsPage() {
  return `<div class="reports-grid"><section class="panel report-panel"><h2>Your account</h2><dl class="summary-list"><div><dt>Name</dt><dd>${escape(user.full_name || "Scholar User")}</dd></div><div><dt>Email</dt><dd>${escape(user.email)}</dd></div><div><dt>Role</dt><dd class="capitalize">${escape(user.role)}</dd></div><div><dt>Data source</dt><dd>${isDemo() ? "Local demo" : "Supabase"}</dd></div></dl><p class="muted">Account roles are managed by your database administrator.</p>${isDemo() ? `<button class="button" data-action="reset">${ic("RefreshCw")} Reset demo records</button>` : ""}</section><section class="panel report-panel"><h2>Workspace essentials</h2><p class="muted">Live mode uses Supabase authentication and protected database operations.</p><ol class="setup-list"><li>Apply <code>supabase/schema.sql</code> in your Supabase SQL editor.</li><li>Create users in Supabase Authentication. Assign a staff role using the README instructions.</li><li>Create student accounts before registering matching scholar email addresses.</li><li>Add scholarships, register scholars, and begin your workflow.</li></ol><button class="button" data-action="guide">${ic("BookOpen")} Open workflow guide</button></section></div>`;
}
function activityList(limit) {
  return db.activity.length
    ? `<div class="activity-list">${db.activity
        .slice(0, limit)
        .map(
          (a) =>
            `<div><span class="activity-dot"></span><p>${escape(a.message)}<small>${moneyDate(a.created_at)}</small></p>${ic("Check")}</div>`,
        )
        .join("")}</div>`
    : empty(
        "A fresh start",
        "Workspace activity will appear as you complete actions.",
      );
}

function modal(title, subtitle, body, wide = false) {
  modalOpener = document.activeElement;
  document.querySelector("#modal-root").innerHTML =
    `<div class="modal-backdrop"><section class="modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header><div><h2 id="modal-title">${title}</h2><p>${subtitle}</p></div><button class="icon-button" data-action="close" aria-label="Close dialog">${ic("X")}</button></header><div class="modal-body">${body}</div></section></div>`;
  iconize();
  document.querySelector(".modal input, .modal select, .modal button")?.focus();
}
function closeModal() {
  document.querySelector("#modal-root").innerHTML = "";
  modalOpener?.focus();
}
function form(action, fields, submitLabel = "Save", extra = "") {
  return `<form data-mutation="${action}" ${extra}>${fields}<p class="form-error" role="alert"></p><div class="modal-footer"><button type="button" class="button" data-action="close">Cancel</button><button type="submit" class="button primary">${submitLabel}${ic("ArrowRight")}</button></div></form>`;
}
const field = (label, html) => `<label>${label}${html}</label>`;
const input = (name, attrs = "") => `<input name="${name}" ${attrs} required>`;
const select = (name, options) =>
  `<select name="${name}" required><option value="">Select an option</option>${options}</select>`;
const options = (items, key = "name", selected = "") =>
  items
    .map(
      (i) =>
        `<option value="${escape(i.id)}" ${i.id === selected ? "selected" : ""}>${escape(i[key])}</option>`,
    )
    .join("");
function openRegister() {
  modal(
    "Register a scholar",
    "Welcome a new scholar to your community.",
    form(
      "register_scholar",
      `<div class="form-grid">${field("Full name", input("full_name", 'maxlength="120" placeholder="e.g. Isabella Reyes"'))}${field("Student ID", input("student_id", 'pattern="[0-9]{4}-[0-9]{4,6}" placeholder="2026-1001"'))}${field("Email address", input("email", 'type="email" placeholder="scholar@university.edu"'))}${field("Degree program", select("course", ["BS Computer Science", "BS Information Technology", "BS Accountancy", "BS Civil Engineering", "BS Business Administration", "BS Education", "BS Nursing"].map((c) => `<option>${c}</option>`).join("")))}${field("Year level", select("year_level", [1, 2, 3, 4, 5].map((n) => `<option value="${n}">Year ${n}</option>`).join("")))}</div><p class="field-hint">Student ID format: YYYY-NNNN (4–6 digits after the dash). For student portal access, create the Auth account with this email first.</p>`,
      "Register scholar",
    ),
  );
}
function openProgram() {
  modal(
    "Create a scholarship",
    "Define the support and the standards.",
    form(
      "create_program",
      `${field("Scholarship name", input("name", 'maxlength="100" placeholder="e.g. Academic Excellence"'))}${field("Description", '<textarea name="description" rows="2" maxlength="500" placeholder="Who does this scholarship support?"></textarea>')}${field("Award / benefit", input("award", 'maxlength="100" placeholder="e.g. Full tuition"'))}<div class="form-grid">${field("Maximum GWA", input("max_gwa", 'type="number" min="1" max="5" step="0.01" value="1.75"'))}${field("Minimum units", input("min_units", 'type="number" min="1" max="40" step="1" value="18"'))}</div><label class="checkbox-label"><input type="checkbox" name="allow_failing"> Allow failing grades (above 3.00)</label>`,
      "Create scholarship",
    ),
  );
}
function openAssign(programId = "", scholarId = "") {
  modal(
    "Assign a scholarship",
    "One scholarship per scholar, per academic period.",
    form(
      "assign_scholarship",
      `${field(
        "Scholar",
        select(
          "scholar_id",
          options(
            db.scholars
              .filter((s) => s.status === "active")
              .map((s) => ({
                ...s,
                label: s.full_name + " · " + s.student_id,
              })),
            "label",
            scholarId,
          ),
        ),
      )}${field(
        "Scholarship program",
        select(
          "program_id",
          options(
            db.programs.filter((p) => p.status === "active"),
            "name",
            programId,
          ),
        ),
      )}${field("Academic period", select("term", TERMS.map((t) => `<option value="${escape(t)}" ${t === term ? "selected" : ""}>${escape(t)}</option>`).join("")))}<p class="field-hint">The program’s GWA, unit, and failing-grade requirements will be saved with this assignment.</p>`,
      "Assign scholarship",
    ),
  );
}
function courseRow(course = { code: "", units: 3, grade: "" }) {
  return `<div class="course-row">${input("code", `maxlength="40" placeholder="e.g. CS 101" aria-label="Course code" value="${escape(course.code)}"`)}${input("units", `type="number" min="1" max="12" step="0.5" aria-label="Course units" value="${escape(course.units)}"`)}${input("grade", `type="number" min="1" max="5" step="0.01" aria-label="Course grade" placeholder="1.00" value="${escape(course.grade)}"`)}<button type="button" class="icon-button" data-action="remove-course" aria-label="Remove course">${ic("X")}</button></div>`;
}
function openSubmit(assignmentId = "") {
  const available = db.assignments.filter((a) => {
    const s = db.submissions.find((s) => s.assignment_id === a.id);
    return !s || s.status === "rejected";
  });
  const existing = db.submissions.find(
    (s) => s.assignment_id === assignmentId && s.status === "rejected",
  );
  modal(
    "Submit academic grades",
    "Enter the final grades shown on your academic record.",
    form(
      "submit_grades",
      `${field(
        "Scholarship assignment",
        select(
          "assignment_id",
          options(
            available.map((a) => ({
              id: a.id,
              name: `${db.scholars.find((s) => s.id === a.scholar_id)?.full_name} · ${a.term}`,
            })),
            "name",
            assignmentId,
          ),
        ),
      )}${available.length ? "" : '<p class="field-hint">No eligible assignments. Assign a scholarship first, or wait for pending grades to be reviewed.</p>'}<div class="course-labels"><span>Course code</span><span>Units</span><span>Grade</span><span></span></div><div id="course-rows">${(existing?.courses || [{ code: "", units: 3, grade: "" }]).map(courseRow).join("")}</div><button type="button" class="button small" data-action="add-course">${ic("Plus")} Add course</button><div class="grade-summary" id="grade-summary">GWA and units are calculated from your courses.</div><p class="field-hint">1.00 is highest; 3.00 is passing. Grades above 3.00 are failing. GWA is weighted by course units and rounded to two decimals.</p>`,
      "Submit for verification",
    ),
    true,
  );
}
function openReview(subId) {
  const sub = db.submissions.find((s) => s.id === subId),
    r = relation(db.assignments.find((a) => a.id === sub.assignment_id));
  const body = `<div class="review-person">${person(r.scholar, 0)}${badge(sub.status)}</div><div class="table-scroll"><table><thead><tr><th>Course</th><th>Units</th><th>Grade</th></tr></thead><tbody>${sub.courses.map((c) => `<tr><td>${escape(c.code)}</td><td>${escape(c.units)}</td><td>${Number(c.grade).toFixed(2)}</td></tr>`).join("")}</tbody></table></div><div class="grade-summary"><strong>GWA ${Number(sub.gwa).toFixed(2)}</strong><span>${sub.units} units · ${sub.has_failing_grade ? "Includes failing grades" : "No failing grades"}</span></div>${sub.feedback ? `<div class="info-callout"><div><strong>Reviewer feedback</strong><p>${escape(sub.feedback)}</p></div></div>` : ""}`;
  modal(
    "Academic grade record",
    `${escape(r.program.name)} · ${escape(r.a.term)}`,
    body +
      (staff() && sub.status === "pending"
        ? form(
            "verify_grades",
            `<input type="hidden" name="submission_id" value="${escape(sub.id)}">${field("Review decision", '<select name="status" required><option value="verified">Verify these grades</option><option value="rejected">Return for correction</option></select>')}${field("Reviewer feedback", '<textarea name="feedback" rows="2" maxlength="1000" placeholder="Required when returning grades"></textarea>')}`,
            "Save review",
          )
        : sub.status === "rejected"
          ? `<button class="button primary full" data-action="submit" data-id="${escape(r.a.id)}">Correct and resubmit ${ic("ArrowRight")}</button>`
          : ""),
    true,
  );
}
function openDetail(scholarId) {
  const s = db.scholars.find((s) => s.id === scholarId),
    assignments = db.assignments.filter((a) => a.scholar_id === s.id);
  modal(
    "Scholar profile",
    "The person behind the progress.",
    `<div class="review-person">${person(s, 0)}${badge(s.status)}</div><dl class="summary-list"><div><dt>Degree program</dt><dd>${escape(s.course)}</dd></div><div><dt>Year level</dt><dd>${s.year_level}</dd></div><div><dt>Email</dt><dd>${escape(s.email)}</dd></div></dl><h3>Scholarship history</h3>${
      assignments
        .map((a) => {
          const r = relation(a);
          return `<div class="history-item"><div><strong>${escape(r.program.name)}</strong><small>${escape(a.term)}</small></div>${badge(r.status)}</div>`;
        })
        .join("") || '<p class="muted">No scholarships assigned yet.</p>'
    }${staff() ? `<button class="button primary full" data-action="assign-scholar" data-id="${escape(s.id)}">${ic("Award")} Assign scholarship</button>` : ""}`,
  );
}
function exportReport() {
  const cell = (v) => {
    let text = String(v ?? "");
    if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
    return `"${text.replaceAll('"', '""')}"`;
  };
  const data = [
    [
      "Student ID",
      "Name",
      "Program",
      "Term",
      "GWA",
      "Units",
      "Verification",
      "Compliance",
      "Reasons",
    ],
    ...rows().map((r) => [
      r.scholar.student_id,
      r.scholar.full_name,
      r.program.name,
      r.a.term,
      r.sub?.gwa,
      r.sub?.units,
      r.sub?.status || "not_submitted",
      r.evaluation?.status || "not_evaluated",
      r.evaluation?.reasons.join("; ") || "",
    ]),
  ];
  const url = URL.createObjectURL(
    new Blob(
      ["\uFEFF" + data.map((row) => row.map(cell).join(",")).join("\r\n")],
      { type: "text/csv;charset=utf-8" },
    ),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "scholartrack-semester-report.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("Semester report downloaded.");
}
async function refresh() {
  db = await loadData();
  render();
}
async function handleAction(action, id, button) {
  if (busy && action !== "menu") return;
  switch (action) {
    case "demo":
      busy = true;
      button.disabled = true;
      try {
        await enterDemo();
        user = await getUser();
        await refresh();
      } finally {
        busy = false;
        button.disabled = false;
      }
      break;
    case "logout":
      await signOut();
      user = null;
      db = null;
      closeModal();
      renderLogin();
      break;
    case "register":
      openRegister();
      break;
    case "program":
      openProgram();
      break;
    case "assign":
      openAssign(id);
      break;
    case "assign-scholar":
      openAssign("", id);
      break;
    case "submit":
      openSubmit(id);
      break;
    case "review":
      openReview(id);
      break;
    case "detail":
      openDetail(id);
      break;
    case "close":
      closeModal();
      break;
    case "add-course":
      if (document.querySelectorAll(".course-row").length >= 15)
        return toast("Maximum 15 courses.", true);
      document
        .querySelector("#course-rows")
        .insertAdjacentHTML("beforeend", courseRow());
      iconize();
      break;
    case "remove-course":
      if (document.querySelectorAll(".course-row").length > 1) {
        button.closest(".course-row").remove();
        updateGradeSummary();
      }
      break;
    case "evaluate":
      modal(
        "Evaluate compliance",
        "Confirm evaluation using this assignment’s saved requirements.",
        form(
          "evaluate_compliance",
          `<input type="hidden" name="submission_id" value="${escape(id)}"><p>GWA, minimum units, and the failing-grade policy will be checked against verified grades. The result is saved as a final record.</p>`,
          "Evaluate compliance",
        ),
      );
      break;
    case "export":
      exportReport();
      break;
    case "activity":
      modal(
        "Workspace activity",
        "A record of the steps that move scholars forward.",
        activityList(30),
      );
      break;
    case "guide":
      modal(
        "From potential to progress",
        "Your scholarship workflow, one step at a time.",
        `<ol class="workflow-list">${["Sign in with your assigned account.", "Register a scholar with a unique student ID.", "Create a scholarship and assign it for a semester.", "Submit course grades; GWA and units are calculated.", "Staff verify grades or return them with feedback.", "Evaluate verified grades against scholarship requirements.", "Track results in your dashboard and export reports."].map((s, i) => `<li><span>${i + 1}</span>${s}</li>`).join("")}</ol>`,
      );
      break;
    case "reset":
      modal(
        "Reset demo workspace?",
        "This replaces local demo records with the original sample data.",
        `<p>Your additions and changes in this browser will be removed.</p><div class="modal-footer"><button class="button" data-action="close">Cancel</button><button class="button primary" data-action="confirm-reset">Reset demo</button></div>`,
      );
      break;
    case "confirm-reset":
      resetDemo();
      closeModal();
      await refresh();
      toast("Demo records reset.");
      break;
    case "menu":
      document.querySelector(".sidebar")?.classList.toggle("open");
      break;
  }
}
function readCourses() {
  return [...document.querySelectorAll(".course-row")].map((row) => ({
    code: row.querySelector("[name=code]").value.trim(),
    units: row.querySelector("[name=units]").value,
    grade: row.querySelector("[name=grade]").value,
  }));
}
function updateGradeSummary() {
  const el = document.querySelector("#grade-summary");
  if (!el) return;
  try {
    const s = summarizeGrades(readCourses());
    el.textContent = `Calculated GWA: ${s.gwa.toFixed(2)} · ${s.units} units · ${s.has_failing_grade ? "Includes failing grades" : "No failing grades"}`;
  } catch {
    el.textContent = "Complete all course fields to calculate GWA and units.";
  }
}
document.addEventListener("click", (event) => {
  const b = event.target.closest("[data-action]");
  if (b) {
    event.preventDefault();
    handleAction(b.dataset.action, b.dataset.id, b).catch((error) =>
      toast(error.message, true),
    );
  }
  if (event.target.classList.contains("modal-backdrop") && !busy) closeModal();
});
document.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (busy) return;
  const form = event.target,
    errorEl = form.querySelector(".form-error"),
    button = form.querySelector("[type=submit]");
  if (!button) return;
  busy = true;
  button.disabled = true;
  const label = button.innerHTML;
  button.textContent = "Please wait…";
  errorEl.textContent = "";
  try {
    const data = Object.fromEntries(new FormData(form));
    if (form.id === "login-form") {
      await signIn(data.email.trim(), data.password);
      user = await getUser();
      await refresh();
    } else {
      if (form.dataset.mutation === "submit_grades")
        data.courses = readCourses();
      if (form.dataset.mutation === "create_program")
        data.allow_failing = form.elements.allow_failing.checked;
      if (form.dataset.mutation === "register_scholar") {
        data.full_name = data.full_name.trim();
        data.email = data.email.trim();
        data.student_id = data.student_id.trim();
      }
      await mutate(form.dataset.mutation, data);
      closeModal();
      toast("Saved successfully.");
      try {
        await refresh();
      } catch (error) {
        toast(
          `Saved, but refresh failed: ${error.message}. Reload to see the latest data.`,
          true,
        );
      }
    }
  } catch (error) {
    errorEl.textContent =
      error.message || "Something went wrong. Please try again.";
  } finally {
    busy = false;
    button.disabled = false;
    button.innerHTML = label;
    iconize();
  }
});
document.addEventListener("input", (event) => {
  if (event.target.id === "search") {
    search = event.target.value;
    renderFiltered();
  }
  if (event.target.closest(".course-row")) updateGradeSummary();
});
document.addEventListener("change", (event) => {
  if (event.target.id === "term-select") {
    term = event.target.value;
    search = "";
    statusFilter = "all";
    render();
  }
  if (event.target.id === "status-filter") {
    statusFilter = event.target.value;
    renderFiltered();
  }
  if (
    event.target.name === "status" &&
    event.target.closest('[data-mutation="verify_grades"]')
  )
    event.target.form.elements.feedback.required =
      event.target.value === "rejected";
});
function renderFiltered() {
  const el = document.querySelector("#filtered-content");
  if (!el) return;
  el.innerHTML =
    page === "scholars"
      ? scholarTable(matching(scholarRows()))
      : page === "grades"
        ? gradeTable(
            matching(
              rows().map((r) => ({
                ...r,
                status: r.sub?.status || "not_submitted",
              })),
            ),
          )
        : complianceTable(matching(rows()));
  iconize();
}
document.addEventListener("keydown", (event) => {
  const modal = document.querySelector(".modal");
  if (!modal) return;
  if (event.key === "Escape" && !busy) closeModal();
  if (event.key === "Tab") {
    const nodes = [
        ...modal.querySelectorAll(
          "button:not(:disabled),input:not([type=hidden]),select,textarea,a[href]",
        ),
      ],
      first = nodes[0],
      last = nodes.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
});
function route() {
  const next = location.hash.slice(1);
  page = [...nav.map((n) => n[0]), "settings"].includes(next)
    ? next
    : "dashboard";
  search = "";
  statusFilter = "all";
  if (user && db) render();
}
window.addEventListener("hashchange", route);
async function start() {
  app.innerHTML = '<div class="loading-screen">Opening your workspace…</div>';
  try {
    if (new URLSearchParams(location.search).get("demo") === "1") {
      await enterDemo();
      history.replaceState(null, "", location.pathname + location.hash);
    }
    user = await getUser();
    if (user) {
      db = await loadData();
      route();
    } else renderLogin();
  } catch (error) {
    renderLogin();
    toast(error.message, true);
  }
}
supabase.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT" && !isDemo() && user) {
    user = null;
    db = null;
    closeModal();
    renderLogin();
  }
});
start();
