ScholarTrack — Student Scholarship Monitoring and Academic Compliance System

Course: Systems Analysis and Design Laboratory
Student Name: Angelo Nuer
Section: BSIT-3B

GitHub Repository: https://github.com/nuerangelo5/scholarship-monitoring-system
Live Application: https://nuerangelo5.github.io/scholarship-monitoring-system/

Project Overview

ScholarTrack is a web-based Student Scholarship Monitoring and Academic Compliance System designed to help scholarship offices manage scholars, scholarship programs, academic requirements, grade submissions, verification, compliance evaluation, and scholarship status monitoring.

The system centralizes scholarship-related information and provides a workflow for monitoring whether scholars meet the academic requirements of their assigned scholarship programs.

The project was developed as part of the Systems Analysis and Design Laboratory and follows the required workflow:

Scholar Registration → Scholarship Assignment → Grade Submission → Verification → Compliance Evaluation → Status Monitoring

System Access

There are two ways to access and test the system.

Option 1 — Login Using a Testing Account

The following accounts are provided for testing purposes.

Admin Account

Email: admin@test.com
Password: Admin123!

Staff Account

Email: staff@test.com
Password: Staff123!

Student Account

Email: student@test.com
Password: Student123!

Login Steps
Open the Live Application.
Enter one of the testing email addresses above.
Enter the corresponding password.
Click Sign In.
The system will open the workspace according to the account's assigned role.
Explore the available modules and functions.

Note: These accounts are provided only for laboratory demonstration and system testing.

Option 2 — Demo Workspace

If you do not want to log in using an account, you can use the built-in Demo Workspace.

How to Use the Demo Workspace
Open the Live Application.
On the login page, select Open Demo Workspace.
The system will load sample scholarship and scholar data.
Explore the dashboard and available system functions.
No account login is required.

The Demo Workspace is intended for quick demonstrations and testing of the system without using an authenticated account.

Live System
Live Application

https://nuerangelo5.github.io/scholarship-monitoring-system/

GitHub Repository

https://github.com/nuerangelo5/scholarship-monitoring-system

Core Features
1. Authentication and Access Control

The system provides authentication through Supabase and supports different user roles.

Supported roles include:

Admin
Staff
Student

Users can sign in and sign out of the system using their registered accounts.

2. Dashboard

The dashboard provides an overview of scholarship monitoring activities.

It displays information such as:

Total Scholars
Pending Grade Submissions
Verified Submissions
Compliant Scholars
Scholars With Deficiency
Recent scholarship activity
3. Scholar Management

The Scholar Management module allows authorized users to manage scholar information.

Scholar records may contain:

Student ID
Full Name
Degree Program
Year Level
Assigned Scholarship
Scholar Status
4. Scholarship Management

The system allows scholarship programs and their academic requirements to be managed.

Scholarship requirements include:

Scholarship Program Name
Required GWA
Minimum Units
Failing Grade Policy
Active/Inactive Status

Different scholarship programs can have different academic requirements.

5. Grade Submission

The Grade Submission module allows academic information to be recorded for a scholar.

A submission includes information such as:

Scholar
Academic Year
Semester
GWA
Units Enrolled
Failed Subjects
Incomplete Subjects

New submissions are initially placed in a pending or verification state.

6. Grade Verification

Authorized staff can review submitted academic records.

A pending submission can be:

Verified
Returned for Correction

Only verified academic records are used for the final compliance evaluation.

7. Compliance Evaluation

After a grade submission has been verified, the system evaluates the scholar's academic performance against the requirements of the assigned scholarship program.

The system checks conditions such as:

GWA requirement
Minimum enrolled units
Failing grade policy

The resulting compliance status can include:

COMPLIANT

The scholar satisfies the required scholarship conditions.

WITH DEFICIENCY

The scholar fails one or more scholarship requirements.

8. Search and Filtering

The system provides search and filtering functions for easier record management.

Users can search for scholars using:

Student ID
Scholar Name

Records can also be filtered according to scholarship or status.

9. Reports

The system provides scholarship and compliance information for monitoring and reporting purposes.

Reports can be used to review:

Scholar records
Scholarship information
Academic submissions
Compliance results
Deficiencies

The system also supports data export for reporting purposes.

Main System Workflow
User Login
    |
    v
Dashboard
    |
    v
Register / Select Scholar
    |
    v
Assign Scholarship Program
    |
    v
Submit Semester Grades
    |
    v
Validate Grade Information
    |
    v
Pending / For Verification
    |
    v
Staff Verification
    |
    v
Compliance Evaluation
    |
    +----------------------+
    |                      |
    v                      v
COMPLIANT          WITH DEFICIENCY
    |                      |
    +----------+-----------+
               |
               v
        Dashboard Update
Recommended Demonstration

For a laboratory demonstration, the following workflow can be performed:

Step 1 — Access the System

Open:

https://nuerangelo5.github.io/scholarship-monitoring-system/

Log in using one of the testing accounts or select Open Demo Workspace.

Step 2 — Register a Scholar

Create or select a scholar record containing:

Student ID
Full Name
Degree Program
Year Level
Scholarship Program
Status
Step 3 — Assign a Scholarship

Select an appropriate scholarship program and associate it with the scholar.

Step 4 — Submit Grades

Create a semester grade submission containing:

Academic Year
Semester
GWA
Units Enrolled
Failed Subjects
Incomplete Subjects
Step 5 — Verify Submission

The submission should initially appear as pending.

An authorized staff user can review and verify the submission.

Step 6 — Evaluate Compliance

After verification, the system evaluates the academic record against the scholarship requirements.

The result will be displayed as:

Compliant, or
With Deficiency
Step 7 — Check Dashboard

The dashboard should reflect the updated submission and compliance information.

Database Structure

The system uses Supabase PostgreSQL for data storage and Supabase Authentication for user authentication.

profiles
Field	Description
id	Authenticated user ID
full_name	User's full name
role	Admin, Staff, or Student
scholarship_programs
Field	Description
id	Primary key
program_name	Scholarship name
required_gwa	Required GWA
min_units	Minimum required units
allow_failing_grade	Failing-grade policy
active	Scholarship program status
scholars
Field	Description
id	Primary key
student_id	Unique student identifier
full_name	Scholar name
degree_program	Academic program
year_level	Current year level
scholarship_id	Assigned scholarship
status	Current scholar status
grade_submissions
Field	Description
id	Primary key
scholar_id	Scholar reference
academic_year	Academic year
semester	Semester
gwa	Grade Weighted Average
units_enrolled	Enrolled units
failed_subjects	Number of failed subjects
incomplete_subjects	Number of incomplete subjects
submission_status	Pending / Verified / Returned
submitted_at	Submission date
verified_by	Staff user
verified_at	Verification date
Functional Requirements
ID	Requirement	Implemented Feature
FR-01	Register Scholar Records	Scholar Management
FR-02	Associate Scholar with Scholarship	Scholarship Assignment
FR-03	Maintain Scholarship Requirements	Scholarship Management
FR-04	Submit Semester Grades	Grade Submission
FR-05	Record Academic Year and Semester	Grade Submission
FR-06	Verify Grade Submission	Verification Module
FR-07	Evaluate Academic Compliance	Compliance Evaluation
FR-08	Identify Deficiencies	Compliance Status
FR-09	Maintain Scholar Status	Scholar Management
FR-10	Identify Pending Grade Submissions	Dashboard
Business Rules
Every scholar must be assigned to an active scholarship program.
Every scholarship program must define its academic requirements.
A grade submission must belong to a scholar, academic year, and semester.
Only authorized personnel may verify submitted grades.
Only verified submissions may be used for final compliance evaluation.
A scholar cannot be marked Compliant while mandatory requirements are incomplete.
Scholar status is based on the requirements of the assigned scholarship program.
Changes to verified academic records should be traceable.
A submission cannot be verified twice without an authorized correction process.
Sensitive grade information should only be accessible to authorized users.
Functional Test Cases
Test ID	Scenario	Expected Result	Result
TC-01	Login with valid account	Dashboard opens	Passed
TC-02	Create scholar with complete data	Scholar is saved	Passed
TC-03	Create scholar without Student ID	Submission is rejected	Passed
TC-04	Submit semester grades	Record is saved as Pending	Passed
TC-05	Verify pending submission	Status becomes Verified	Passed
TC-06	Evaluate scholar meeting requirements	Result is Compliant	Passed
TC-07	Evaluate scholar failing a requirement	Result is With Deficiency	Passed
TC-08	Search scholar	Matching scholar is displayed	Passed
TC-09	Filter scholars	Correct subset is displayed	Passed
TC-10	Open deployed URL	System is accessible online	Passed
Technology Stack
HTML
CSS
JavaScript
Supabase
PostgreSQL
Supabase Authentication
GitHub
GitHub Pages
Vite
Node.js
Local Development
Prerequisites
Node.js 20.19+ or 22.12+
npm
Git
Installation

Clone the repository:

git clone https://github.com/nuerangelo5/scholarship-monitoring-system.git

Enter the project directory:

cd scholarship-monitoring-system

Install dependencies:

npm ci

Start the development server:

npm run dev

Open the local URL displayed by Vite in your browser.

Testing and Build Commands

Run the test suite:

npm test

Build the project:

npm run build

Preview the production build:

npm run preview
Git Commit History

The project was developed incrementally using Git.

7982c9e Align status labels with laboratory requirements
5ad52f3 Add compliance evaluation dashboard and deployment
4823a90 Implement grade submission and verification
24ea355 Create scholar and scholarship database modules
23b9bbf Initialize scholarship monitoring system
Deployment

The application is deployed using GitHub Pages.

Repository:
https://github.com/nuerangelo5/scholarship-monitoring-system

Live Application:
https://nuerangelo5.github.io/scholarship-monitoring-system/

To update the README or other project files:

git add .
git commit -m "Update project documentation"
git push origin main
Laboratory Completion

The system demonstrates the required end-to-end workflow:

REQUIREMENT
     |
     v
USE CASE
     |
     v
DATABASE RECORD
     |
     v
USER ACTION
     |
     v
BUSINESS RULE
     |
     v
SYSTEM RESULT
     |
     v
TEST

The completed prototype demonstrates scholarship management, academic grade submission, verification, compliance evaluation, dashboard monitoring, authentication, search, filtering, and online deployment.
