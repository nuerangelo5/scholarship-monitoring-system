# Laboratory Alignment Notes
## Student Scholarship Monitoring and Academic Compliance System

This document maps the laboratory requirements to the implemented ScholarTrack system.

### 1. Core Workflow Coverage (Lab Section V)

| Lab Step | Implemented Feature |
|----------|---------------------|
| 1. Authorized user logs in | Supabase Auth + Demo mode |
| 2. Staff registers or selects scholar | Scholar directory + Register form |
| 3. Scholar associated with scholarship | Assign Scholarship action |
| 4. Semester grade submission created | Grade submission form (course-level) |
| 5. System validates required fields | Client + server validation |
| 6. Submission marked Pending | status = pending → displayed as "Pending Submission" |
| 7. Staff verifies submission | Verify / Return action |
| 8. System evaluates against requirements | Evaluate Compliance action |
| 9. Displays Compliant or With Deficiency | Labels: Compliant / With Deficiency |
| 10. Dashboard totals updated | Live counts on Dashboard |

### 2. Status Mapping (Lab Section G)

| Lab Status              | System Internal Code     | Display Label            |
|-------------------------|--------------------------|--------------------------|
| Active                  | active                   | Active                   |
| Pending Submission      | pending                  | Pending Submission       |
| For Verification        | pending / verified       | Pending Submission / Verified |
| Compliant               | compliant                | Compliant                |
| With Deficiency         | non_compliant            | With Deficiency          |
| Probationary / others   | (not fully expanded)     | Can be extended          |

### 3. Functional Requirements Mapping

| Lab FR     | Implemented As |
|------------|----------------|
| FR-01 Register Scholar | Register Scholar form + scholartrack_scholars |
| FR-02 Associate scholarship | Assign Scholarship (creates assignment) |
| FR-03 Maintain academic requirements | scholarship programs (max_gwa, min_units, allow_failing) |
| FR-04 Semester grade submission | Grade submission with course list → auto GWA |
| FR-05 Academic year & semester | TERMS list + assignment term |
| FR-06 Verify grade submission | Staff verify / return action |
| FR-07 Evaluate compliance | evaluateCompliance() + server RPC |
| FR-08 Identify deficiencies | reasons array on evaluation |
| FR-09 Maintain scholar status | scholar status + evaluation status |
| FR-10 Identify pending submissions | Dashboard + Grades nav count |

### 4. Database Mapping (Lab Minimum Structure)

| Lab Table              | Implemented Table(s)                          | Notes |
|------------------------|-----------------------------------------------|-------|
| profiles               | scholartrack_profiles                         | role: admin / staff / student |
| scholarship_programs   | scholartrack_programs                         | required_gwa → max_gwa |
| scholars               | scholartrack_scholars                         | degree_program → course |
| grade_submissions      | scholartrack_assignments + submissions + evaluations | More normalized; supports course-level detail |

The system uses a more normalized design for better data integrity and security (all mutations go through a single security-definer function). This still fully supports the required vertical slice.

### 5. Validation (Lab Section XIII)

- Student ID format validated
- Scholarship program must be selected (assignment required)
- GWA calculated and range-checked (1.00–5.00)
- Units cannot be negative
- Failing grade policy enforced
- Only verified submissions can be evaluated
- Only staff/admin can verify

### 6. Recommended Screenshots for Submission

1. Login screen
2. Scholar registration / directory
3. Grade submission form (with courses)
4. Verification + Compliance result (Compliant / With Deficiency)
5. Dashboard showing counts

